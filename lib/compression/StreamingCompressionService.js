const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

/**
 * Service de compression en streaming pour les gros fichiers
 * Optimise l'utilisation mémoire avec des buffers limités
 * Permet la compression asynchrone sans bloquer le processus principal
 */
class StreamingCompressionService {
  /**
   * Constructeur du service de compression streaming
   * @param {Object} options - Options de configuration
   * @param {number} options.bufferSize - Taille du buffer en bytes (défaut: 64KB)
   * @param {number} options.largeFileThreshold - Seuil pour considérer un fichier comme "gros" (défaut: 10MB)
   * @param {number} options.maxMemoryUsage - Utilisation mémoire maximale en bytes (défaut: 100MB)
   */
  constructor(options = {}) {
    this.bufferSize = options.bufferSize || 64 * 1024; // 64KB
    this.largeFileThreshold = options.largeFileThreshold || 10 * 1024 * 1024; // 10MB
    this.maxMemoryUsage = options.maxMemoryUsage || 100 * 1024 * 1024; // 100MB
    
    // Statistiques de performance
    this.stats = {
      totalFilesProcessed: 0,
      totalBytesProcessed: 0,
      averageCompressionTime: 0,
      peakMemoryUsage: 0,
      streamingCompressions: 0,
      regularCompressions: 0
    };
  }

  /**
   * Compresse un fichier en utilisant le streaming si nécessaire
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin du fichier compressé de sortie
   * @param {Object} options - Options de compression
   * @param {number} options.level - Niveau de compression (1-9)
   * @param {string} options.algorithm - Algorithme à utiliser ('gzip', 'brotli')
   * @param {Function} options.progressCallback - Callback pour le progrès (optionnel)
   * @returns {Promise<Object>} Résultat de la compression avec métadonnées
   */
  async compressFile(inputPath, outputPath, options = {}) {
    const startTime = Date.now();
    const { level = 6, algorithm = 'gzip', progressCallback } = options;
    
    try {
      // Obtenir les informations du fichier
      const stats = await this.getFileStats(inputPath);
      const fileSize = stats.size;
      
      // Décider si utiliser le streaming ou la compression régulière
      const useStreaming = this.shouldUseStreaming(fileSize);
      
      let result;
      if (useStreaming) {
        console.log(`Using streaming compression for large file: ${Math.round(fileSize / 1024 / 1024)}MB`);
        result = await this.compressFileStreaming(inputPath, outputPath, {
          level,
          algorithm,
          progressCallback,
          fileSize
        });
        this.stats.streamingCompressions++;
      } else {
        result = await this.compressFileRegular(inputPath, outputPath, {
          level,
          algorithm,
          fileSize
        });
        this.stats.regularCompressions++;
      }
      
      // Mettre à jour les statistiques
      const duration = Date.now() - startTime;
      this.updateStats(fileSize, duration);
      
      return {
        ...result,
        duration,
        streamingUsed: useStreaming,
        memoryOptimized: useStreaming
      };
      
    } catch (error) {
      throw new Error(`Erreur lors de la compression streaming: ${error.message}`);
    }
  }

  /**
   * Compresse un fichier en utilisant le streaming (pour gros fichiers)
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin du fichier de sortie
   * @param {Object} options - Options de compression
   * @returns {Promise<Object>} Résultat de la compression
   */
  async compressFileStreaming(inputPath, outputPath, options = {}) {
    const { level = 6, algorithm = 'gzip', progressCallback, fileSize } = options;
    
    return new Promise((resolve, reject) => {
      // Créer les streams
      let fulloutputPath
      const readStream = fs.createReadStream(inputPath, { 
        bufferSize: this.bufferSize,
        highWaterMark: this.bufferSize 
      });
      if(!outputPath.startsWith("/")){
        fulloutputPath= "/"+outputPath
      }else{
        fulloutputPath=outputPath
      }
      const writeStream = fs.createWriteStream(fulloutputPath);
      
      // Créer le stream de compression selon l'algorithme
      let compressionStream;
      switch (algorithm) {
        case 'gzip':
          compressionStream = zlib.createGzip({ 
            level,
            chunkSize: this.bufferSize
          });
          break;
        case 'brotli':
          compressionStream = zlib.createBrotliCompress({
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: level,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: fileSize
            },
            chunkSize: this.bufferSize
          });
          break;
        default:
          return reject(new Error(`Algorithme non supporté: ${algorithm}`));
      }
      
      // Variables pour le suivi du progrès et des statistiques
      let bytesProcessed = 0;
      let originalSize = 0;
      let compressedSize = 0;
      const hash = crypto.createHash('sha256');
      
      // Surveiller le progrès
      readStream.on('data', (chunk) => {
        bytesProcessed += chunk.length;
        originalSize += chunk.length;
        hash.update(chunk);
        
        // Callback de progrès si fourni
        if (progressCallback && fileSize > 0) {
          const progress = (bytesProcessed / fileSize) * 100;
          progressCallback({
            bytesProcessed,
            totalBytes: fileSize,
            progress: Math.round(progress),
            phase: 'compression'
          });
        }
        
        // Surveiller l'utilisation mémoire
        this.monitorMemoryUsage();
      });
      
      // Surveiller la taille compressée
      compressionStream.on('data', (chunk) => {
        compressedSize += chunk.length;
      });
      
      // Gestion des erreurs
      const handleError = (error) => {
        readStream.destroy();
        writeStream.destroy();
        compressionStream.destroy();
        reject(error);
      };
      
      readStream.on('error', handleError);
      writeStream.on('error', handleError);
      compressionStream.on('error', handleError);
      
      // Finalisation
      writeStream.on('finish', () => {
        const checksum = hash.digest('hex');
        const compressionRatio = compressedSize / originalSize;
        
        resolve({
          success: true,
          originalSize,
          compressedSize,
          compressionRatio,
          algorithm,
          checksum,
          spaceSaved: originalSize - compressedSize,
          streamingUsed: true
        });
      });
      
      // Créer le pipeline de streaming
      pipeline(readStream, compressionStream, writeStream)
        .catch(handleError);
    });
  }

  /**
   * Compresse un fichier de manière régulière (pour petits fichiers)
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin du fichier de sortie
   * @param {Object} options - Options de compression
   * @returns {Promise<Object>} Résultat de la compression
   */
  async compressFileRegular(inputPath, outputPath, options = {}) {
    const { level = 6, algorithm = 'gzip', fileSize } = options;
    
    // Lire le fichier en mémoire
    const inputData = await fs.promises.readFile(inputPath);
    const originalSize = inputData.length;
    
    // Calculer le checksum
    const checksum = crypto.createHash('sha256').update(inputData).digest('hex');
    
    let compressedData;
    
    // Compression selon l'algorithme
    switch (algorithm) {
      case 'gzip':
        compressedData = await new Promise((resolve, reject) => {
          zlib.gzip(inputData, { level }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        break;
      case 'brotli':
        compressedData = await new Promise((resolve, reject) => {
          zlib.brotliCompress(inputData, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: level,
              [zlib.constants.BROTLI_PARAM_SIZE_HINT]: fileSize
            }
          }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        break;
      default:
        throw new Error(`Algorithme non supporté: ${algorithm}`);
    }
    let fulloutputPath
      if(!outputPath.startsWith("/")){
        fulloutputPath= "/"+outputPath
      }else{
        fulloutputPath=outputPath
      }
    // Écrire le fichier compressé
    await fs.promises.writeFile(fulloutputPath, compressedData);
    
    const compressedSize = compressedData.length;
    const compressionRatio = compressedSize / originalSize;
    
    return {
      success: true,
      originalSize,
      compressedSize,
      compressionRatio,
      algorithm,
      checksum,
      spaceSaved: originalSize - compressedSize,
      streamingUsed: false
    };
  }

  /**
   * Décompresse un fichier en utilisant le streaming si nécessaire
   * @param {string} inputPath - Chemin du fichier compressé
   * @param {string} outputPath - Chemin du fichier décompressé de sortie
   * @param {Object} options - Options de décompression
   * @returns {Promise<Object>} Résultat de la décompression
   */
  async decompressFile(inputPath, outputPath, options = {}) {
    const { progressCallback } = options;
    
    try {
      // Obtenir les informations du fichier compressé
      const stats = await this.getFileStats(inputPath);
      const compressedSize = stats.size;
      
      // Détecter l'algorithme de compression
      const algorithm = this.detectCompressionAlgorithm(inputPath);
      
      // Utiliser le streaming pour la décompression
      const result = await this.decompressFileStreaming(inputPath, outputPath, {
        algorithm,
        progressCallback,
        compressedSize
      });
      
      return {
        ...result,
        streamingUsed: true
      };
      
    } catch (error) {
      throw new Error(`Erreur lors de la décompression streaming: ${error.message}`);
    }
  }

  /**
   * Décompresse un fichier en utilisant le streaming
   * @param {string} inputPath - Chemin du fichier compressé
   * @param {string} outputPath - Chemin du fichier de sortie
   * @param {Object} options - Options de décompression
   * @returns {Promise<Object>} Résultat de la décompression
   */
  async decompressFileStreaming(inputPath, outputPath, options = {}) {
    const { algorithm = 'gzip', progressCallback, compressedSize } = options;
    
    return new Promise((resolve, reject) => {
      // Créer les streams
      const readStream = fs.createReadStream(inputPath, { 
        bufferSize: this.bufferSize,
        highWaterMark: this.bufferSize 
      });
      
      const writeStream = fs.createWriteStream(outputPath);
      
      // Créer le stream de décompression selon l'algorithme
      let decompressionStream;
      switch (algorithm) {
        case 'gzip':
          decompressionStream = zlib.createGunzip({
            chunkSize: this.bufferSize
          });
          break;
        case 'brotli':
          decompressionStream = zlib.createBrotliDecompress({
            chunkSize: this.bufferSize
          });
          break;
        default:
          return reject(new Error(`Algorithme non supporté: ${algorithm}`));
      }
      
      // Variables pour le suivi du progrès et des statistiques
      let bytesProcessed = 0;
      let originalSize = 0;
      const hash = crypto.createHash('sha256');
      
      // Surveiller le progrès de lecture
      readStream.on('data', (chunk) => {
        bytesProcessed += chunk.length;
        
        // Callback de progrès si fourni
        if (progressCallback && compressedSize > 0) {
          const progress = (bytesProcessed / compressedSize) * 100;
          progressCallback({
            bytesProcessed,
            totalBytes: compressedSize,
            progress: Math.round(progress),
            phase: 'decompression'
          });
        }
      });
      
      // Surveiller la taille décompressée
      decompressionStream.on('data', (chunk) => {
        originalSize += chunk.length;
        hash.update(chunk);
      });
      
      // Gestion des erreurs
      const handleError = (error) => {
        readStream.destroy();
        writeStream.destroy();
        decompressionStream.destroy();
        reject(error);
      };
      
      readStream.on('error', handleError);
      writeStream.on('error', handleError);
      decompressionStream.on('error', handleError);
      
      // Finalisation
      writeStream.on('finish', () => {
        const checksum = hash.digest('hex');
        const compressionRatio = compressedSize / originalSize;
        
        resolve({
          success: true,
          originalSize,
          compressedSize,
          compressionRatio,
          algorithm,
          checksum
        });
      });
      
      // Créer le pipeline de streaming
      pipeline(readStream, decompressionStream, writeStream)
        .catch(handleError);
    });
  }

  /**
   * Détermine si le streaming doit être utilisé pour un fichier
   * @param {number} fileSize - Taille du fichier en bytes
   * @returns {boolean} True si le streaming doit être utilisé
   */
  shouldUseStreaming(fileSize) {
    return fileSize >= this.largeFileThreshold;
  }

  /**
   * Détecte l'algorithme de compression d'un fichier
   * @param {string} filePath - Chemin du fichier
   * @returns {string} Algorithme détecté ('gzip', 'brotli', 'unknown')
   */
  detectCompressionAlgorithm(filePath) {
    try {
      // Vérifier l'extension
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.gz') return 'gzip';
      if (ext === '.br') return 'brotli';
      
      // Vérifier les magic bytes
      const buffer = fs.readFileSync(filePath, { start: 0, end: 4 });
      
      // Magic bytes pour gzip: 1f 8b
      if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
        return 'gzip';
      }
      
      // Magic bytes pour brotli: pas de signature fixe, utiliser l'extension
      return 'gzip'; // Défaut
      
    } catch (error) {
      return 'gzip'; // Défaut en cas d'erreur
    }
  }

  /**
   * Obtient les statistiques d'un fichier
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<Object>} Statistiques du fichier
   */
  async getFileStats(filePath) {
    return await fs.promises.stat(filePath);
  }

  /**
   * Surveille l'utilisation mémoire
   */
  monitorMemoryUsage() {
    const memUsage = process.memoryUsage();
    const currentUsage = memUsage.heapUsed;
    
    if (currentUsage > this.stats.peakMemoryUsage) {
      this.stats.peakMemoryUsage = currentUsage;
    }
    
    // Déclencher le garbage collector si l'utilisation mémoire est trop élevée
    if (currentUsage > this.maxMemoryUsage && global.gc) {
      global.gc();
    }
  }

  /**
   * Met à jour les statistiques de performance
   * @param {number} fileSize - Taille du fichier traité
   * @param {number} duration - Durée du traitement en ms
   */
  updateStats(fileSize, duration) {
    this.stats.totalFilesProcessed++;
    this.stats.totalBytesProcessed += fileSize;
    
    // Calculer la moyenne mobile du temps de compression
    const currentAvg = this.stats.averageCompressionTime;
    const count = this.stats.totalFilesProcessed;
    this.stats.averageCompressionTime = ((currentAvg * (count - 1)) + duration) / count;
  }

  /**
   * Obtient les statistiques de performance
   * @returns {Object} Statistiques complètes
   */
  getPerformanceStats() {
    const memUsage = process.memoryUsage();
    
    return {
      ...this.stats,
      currentMemoryUsage: memUsage.heapUsed,
      memoryUsageFormatted: {
        current: this.formatBytes(memUsage.heapUsed),
        peak: this.formatBytes(this.stats.peakMemoryUsage),
        limit: this.formatBytes(this.maxMemoryUsage)
      },
      throughput: {
        filesPerSecond: this.stats.totalFilesProcessed / (this.stats.averageCompressionTime / 1000),
        bytesPerSecond: this.stats.totalBytesProcessed / (this.stats.averageCompressionTime / 1000)
      },
      configuration: {
        bufferSize: this.formatBytes(this.bufferSize),
        largeFileThreshold: this.formatBytes(this.largeFileThreshold),
        maxMemoryUsage: this.formatBytes(this.maxMemoryUsage)
      }
    };
  }

  /**
   * Formate une taille en bytes en format lisible
   * @param {number} bytes - Taille en bytes
   * @returns {string} Taille formatée
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Réinitialise les statistiques
   */
  resetStats() {
    this.stats = {
      totalFilesProcessed: 0,
      totalBytesProcessed: 0,
      averageCompressionTime: 0,
      peakMemoryUsage: 0,
      streamingCompressions: 0,
      regularCompressions: 0
    };
  }
}

module.exports = StreamingCompressionService;