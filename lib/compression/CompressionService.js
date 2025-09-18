const fs = require('fs').promises;
const zlib = require('zlib');
const path = require('path');
const crypto = require('crypto');
const ErrorHandler = require('./ErrorHandler');
const CompressionLogger = require('./CompressionLogger');
const StreamingCompressionService = require('./StreamingCompressionService');

/**
 * Service central de gestion de la compression des fichiers
 * Fournit les méthodes pour compresser, décompresser et analyser les fichiers
 * Intègre la gestion d'erreurs robuste et le logging
 */
class CompressionService {
  /**
   * Constructeur du service de compression
   * @param {Object} config - Configuration du service
   */
  constructor(config = {}) {
    this.config = config;
    this.errorHandler = new ErrorHandler(config.errorHandling || {});
    this.logger = new CompressionLogger(config.logging || {});
    
    // Initialiser le service de compression streaming
    this.streamingService = new StreamingCompressionService({
      bufferSize: config.bufferSize || 64 * 1024,
      largeFileThreshold: config.largeFileThreshold || 10 * 1024 * 1024,
      maxMemoryUsage: config.maxMemoryUsage || 100 * 1024 * 1024
    });
  }
  /**
   * Compresse un fichier avec l'algorithme configuré
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin du fichier compressé de sortie
   * @param {Object} options - Options de compression
   * @param {number} options.level - Niveau de compression (1-9)
   * @param {string} options.algorithm - Algorithme à utiliser ('gzip', 'brotli', 'lz4')
   * @returns {Promise<Object>} Résultat de la compression avec métadonnées
   */
  async compressFile(inputPath, outputPath, options = {}) {
    const startTime = Date.now();
    const { level = 6, algorithm = 'gzip' } = options;
    
    const context = {
      inputPath,
      outputPath,
      algorithm,
      level,
      operation: 'compression'
    };

    try {
      // Vérifier la taille du fichier pour décider d'utiliser le streaming
      const stats = await fs.stat(inputPath);
      const fileSize = stats.size;
      const useStreaming = this.streamingService.shouldUseStreaming(fileSize);
      
      let result;
      
      if (useStreaming) {
        // Utiliser la compression streaming pour les gros fichiers
        result = await this.errorHandler.executeCompressionWithFallback(
          async (input, output, opts) => {
            return await this.streamingService.compressFile(input, output, opts);
          },
          inputPath,
          outputPath,
          { level, algorithm, progressCallback: options.progressCallback }
        );
      } else {
        // Utiliser la compression régulière pour les petits fichiers
        result = await this.errorHandler.executeCompressionWithFallback(
          async (input, output, opts) => {
            return await this._performCompression(input, output, opts);
          },
          inputPath,
          outputPath,
          { level, algorithm }
        );
      }

      const duration = Date.now() - startTime;

      if (result.success) {
        // Logger le succès
        await this.logger.logCompressionSuccess({
          inputPath,
          outputPath,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          compressionRatio: result.compressionRatio,
          algorithm,
          duration,
          spaceSaved: result.spaceSaved
        });
      } else if (result.fallbackUsed) {
        // Logger l'opération de fallback
        await this.logger.logFallbackOperation({
          originalOperation: 'compression',
          fallbackStrategy: 'store_original',
          reason: result.error,
          inputPath,
          fallbackPath: result.fallbackResult.fallbackPath,
          success: true
        });
      }

      return {
        ...result,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Déterminer le code d'erreur approprié
      let errorCode = CompressionLogger.ERROR_CODES.COMPRESSION_FAILED;
      if (error.message.includes('timeout')) {
        errorCode = CompressionLogger.ERROR_CODES.COMPRESSION_TIMEOUT;
      } else if (error.message.includes('ENOENT')) {
        errorCode = CompressionLogger.ERROR_CODES.FILE_NOT_FOUND;
      } else if (error.message.includes('EACCES')) {
        errorCode = CompressionLogger.ERROR_CODES.FILE_ACCESS_DENIED;
      } else if (error.message.includes('ENOSPC')) {
        errorCode = CompressionLogger.ERROR_CODES.SYSTEM_DISK_FULL;
      }

      // Logger l'erreur
      await this.logger.logCompressionError(errorCode, error, {
        ...context,
        duration,
        fileSize: await this._getFileSize(inputPath)
      });

      throw error;
    }
  }

  /**
   * Effectue la compression réelle (méthode interne)
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin du fichier de sortie
   * @param {Object} options - Options de compression
   * @returns {Promise<Object>} Résultat de la compression
   */
  async _performCompression(inputPath, outputPath, options = {}) {
    const { level = 6, algorithm = 'gzip' } = options;
    
    // Vérifier que le fichier source existe
    const stats = await fs.stat(inputPath);
    const originalSize = stats.size;
    
    // Lire le fichier source
    const inputData = await fs.readFile(inputPath);
    
    // Calculer le checksum du fichier original
    const checksum = crypto.createHash('sha256').update(inputData).digest('hex');
    
    let compressedData;
    
    // Compression selon l'algorithme choisi
    switch (algorithm) {
      case 'gzip':
        compressedData = await new Promise((resolve, reject) => {
          zlib.gzip(inputData, { level }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        break;
      default:
        throw new Error(`Algorithme de compression non supporté: ${algorithm}`);
    }
    
    // Écrire le fichier compressé
    await fs.writeFile(outputPath, compressedData);
    
    const compressedSize = compressedData.length;
    const compressionRatio = compressedSize / originalSize;
    
    return {
      success: true,
      originalSize,
      compressedSize,
      compressionRatio,
      algorithm,
      checksum,
      spaceSaved: originalSize - compressedSize
    };
  }

  /**
   * Décompresse un fichier
   * @param {string} inputPath - Chemin du fichier compressé
   * @param {string} outputPath - Chemin du fichier décompressé de sortie
   * @param {Object} options - Options de décompression (optionnel)
   * @returns {Promise<Object>} Résultat de la décompression avec métadonnées
   */
  async decompressFile(inputPath, outputPath, options = {}) {
    const startTime = Date.now();
    
    const context = {
      inputPath,
      outputPath,
      operation: 'decompression'
    };

    try {
      // Vérifier la taille du fichier pour décider d'utiliser le streaming
      const stats = await fs.stat(inputPath);
      const fileSize = stats.size;
      const useStreaming = this.streamingService.shouldUseStreaming(fileSize);
      
      let result;
      
      if (useStreaming) {
        // Utiliser la décompression streaming pour les gros fichiers
        result = await this.errorHandler.executeDecompressionWithRecovery(
          async (input, output) => {
            return await this.streamingService.decompressFile(input, output, {
              progressCallback: options.progressCallback
            });
          },
          inputPath,
          outputPath
        );
      } else {
        // Utiliser la décompression régulière pour les petits fichiers
        result = await this.errorHandler.executeDecompressionWithRecovery(
          async (input, output) => {
            return await this._performDecompression(input, output);
          },
          inputPath,
          outputPath
        );
      }

      const duration = Date.now() - startTime;

      if (result.success) {
        if (result.recoveryUsed) {
          // Logger l'opération de récupération
          await this.logger.logRecoveryOperation({
            originalError: result.originalError,
            recoveryMethod: 'backup_restore',
            backupPath: result.recoveryResult.backupPath,
            recoveredPath: outputPath,
            success: true,
            reason: 'Decompression failed, recovered from backup'
          });
        }

        // Logger le succès de décompression
        await this.logger.logDecompressionSuccess({
          inputPath,
          outputPath,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
          algorithm: 'gzip', // Pour l'instant on assume gzip
          duration
        });
      }

      return {
        ...result,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Déterminer le code d'erreur approprié
      let errorCode = CompressionLogger.ERROR_CODES.DECOMPRESSION_FAILED;
      if (error.message.includes('timeout')) {
        errorCode = CompressionLogger.ERROR_CODES.DECOMPRESSION_TIMEOUT;
      } else if (error.message.includes('corrupted') || error.message.includes('invalid')) {
        errorCode = CompressionLogger.ERROR_CODES.DECOMPRESSION_CORRUPTED_FILE;
      } else if (error.message.includes('format')) {
        errorCode = CompressionLogger.ERROR_CODES.DECOMPRESSION_INVALID_FORMAT;
      } else if (error.message.includes('ENOENT')) {
        errorCode = CompressionLogger.ERROR_CODES.FILE_NOT_FOUND;
      }

      // Logger l'erreur
      await this.logger.logDecompressionError(errorCode, error, {
        ...context,
        duration,
        expectedSize: await this._getFileSize(inputPath)
      });

      throw error;
    }
  }

  /**
   * Effectue la décompression réelle (méthode interne)
   * @param {string} inputPath - Chemin du fichier compressé
   * @param {string} outputPath - Chemin du fichier de sortie
   * @returns {Promise<Object>} Résultat de la décompression
   */
  async _performDecompression(inputPath, outputPath) {
    // Vérifier que le fichier compressé existe
    const stats = await fs.stat(inputPath);
    const compressedSize = stats.size;
    
    // Lire le fichier compressé
    const compressedData = await fs.readFile(inputPath);
    
    // Détecter l'algorithme de compression et décompresser
    let decompressedData;
    
    if (this.isCompressed(inputPath)) {
      // Pour l'instant, on assume gzip
      decompressedData = await new Promise((resolve, reject) => {
        zlib.gunzip(compressedData, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    } else {
      throw new Error('Le fichier ne semble pas être compressé');
    }
    
    // Écrire le fichier décompressé
    await fs.writeFile(outputPath, decompressedData);
    
    const originalSize = decompressedData.length;
    
    // Calculer le checksum du fichier décompressé
    const checksum = crypto.createHash('sha256').update(decompressedData).digest('hex');
    
    return {
      success: true,
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      checksum
    };
  }

  /**
   * Vérifie si un fichier est compressé
   * @param {string} filePath - Chemin du fichier à vérifier
   * @returns {boolean} True si le fichier est compressé
   */
  isCompressed(filePath) {
    try {
      // Vérifier l'extension du fichier
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.gz') {
        return true;
      }
      
      // Vérifier les magic bytes pour gzip (1f 8b)
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath, { start: 0, end: 2 });
        if (buffer.length >= 2) {
          return buffer[0] === 0x1f && buffer[1] === 0x8b;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calcule le ratio de compression potentiel pour un fichier
   * @param {string} filePath - Chemin du fichier à analyser
   * @returns {Promise<number>} Ratio de compression estimé (0-1)
   */
  async estimateCompressionRatio(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const originalSize = stats.size;
      
      if (originalSize === 0) {
        return 1; // Pas de compression possible sur un fichier vide
      }
      
      // Lire un échantillon du fichier pour estimation rapide
      const sampleSize = Math.min(originalSize, 8192); // 8KB max pour l'échantillon
      const buffer = Buffer.alloc(sampleSize);
      const fileHandle = await fs.open(filePath, 'r');
      
      try {
        await fileHandle.read(buffer, 0, sampleSize, 0);
        
        // Compresser l'échantillon pour estimer le ratio
        const compressedSample = await new Promise((resolve, reject) => {
          zlib.gzip(buffer, { level: 6 }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        
        const sampleRatio = compressedSample.length / sampleSize;
        return Math.min(sampleRatio, 1); // S'assurer que le ratio ne dépasse pas 1
        
      } finally {
        await fileHandle.close();
      }
      
    } catch (error) {
      throw new Error(`Erreur lors de l'estimation du ratio: ${error.message}`);
    }
  }

  /**
   * Obtient la taille d'un fichier de manière sécurisée
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<number>} Taille du fichier en bytes, ou 0 si erreur
   */
  async _getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Obtient les statistiques du service de compression
   * @returns {Object} Statistiques du service
   */
  getServiceStats() {
    return {
      errorHandler: this.errorHandler ? 'enabled' : 'disabled',
      logger: this.logger ? this.logger.getLoggingStats() : null,
      streaming: this.streamingService ? this.streamingService.getPerformanceStats() : null,
      config: this.config
    };
  }

  /**
   * Obtient les statistiques de performance du streaming
   * @returns {Object} Statistiques de performance
   */
  getStreamingStats() {
    return this.streamingService ? this.streamingService.getPerformanceStats() : null;
  }

  /**
   * Réinitialise les statistiques de streaming
   */
  resetStreamingStats() {
    if (this.streamingService) {
      this.streamingService.resetStats();
    }
  }
}

module.exports = CompressionService;