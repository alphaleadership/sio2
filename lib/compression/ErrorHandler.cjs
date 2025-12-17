const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Gestionnaire d'erreurs robuste pour les opérations de compression
 * Implémente les stratégies de fallback et la récupération d'erreurs
 */
class ErrorHandler {
  /**
   * Constructeur du gestionnaire d'erreurs
   * @param {Object} config - Configuration des timeouts et stratégies
   */
  constructor(config = {}) {
    this.config = {
      compressionTimeout: config.compressionTimeout || 5000,
      decompressionTimeout: config.decompressionTimeout || 2000,
      maxRetries: config.maxRetries || 3,
      backupEnabled: config.backupEnabled !== false,
      ...config
    };
    
    // Créer le dossier de backup si nécessaire
    this.backupDir = path.resolve('../partage_backup');
    this.initializeBackupDir();
  }

  /**
   * Initialise le dossier de backup
   */
  async initializeBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      console.warn(`Impossible de créer le dossier de backup: ${error.message}`);
    }
  }

  /**
   * Exécute une opération de compression avec gestion d'erreurs et fallback
   * @param {Function} compressionOperation - Fonction de compression à exécuter
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin du fichier de sortie
   * @param {Object} options - Options de compression
   * @returns {Promise<Object>} Résultat de l'opération avec statut de fallback
   */
  async executeCompressionWithFallback(compressionOperation, inputPath, outputPath, options = {}) {
    let backupPath = null;
    
    try {
      // Créer un backup du fichier original si activé
      if (this.config.backupEnabled) {
        backupPath = await this.createBackup(inputPath);
      }

      // Exécuter la compression avec timeout
      const result = await this.executeWithTimeout(
        () => compressionOperation(inputPath, outputPath, options),
        this.config.compressionTimeout,
        'Compression timeout'
      );

      // Vérifier l'intégrité du fichier compressé
      if (await this.verifyCompressionIntegrity(inputPath, outputPath)) {
        return {
          success: true,
          fallbackUsed: false,
          backupPath,
          ...result
        };
      } else {
        throw new Error('Échec de la vérification d\'intégrité après compression');
      }

    } catch (error) {
      console.warn(`Compression failed for ${inputPath}: ${error.message}`);
      
      // Stratégie de fallback: stocker le fichier original
      const fallbackResult = await this.fallbackToOriginalFile(inputPath, outputPath, error);
      
      return {
        success: false,
        fallbackUsed: true,
        fallbackResult,
        backupPath,
        error: error.message
      };
    }
  }

  /**
   * Exécute une opération de décompression avec gestion d'erreurs et récupération
   * @param {Function} decompressionOperation - Fonction de décompression à exécuter
   * @param {string} inputPath - Chemin du fichier compressé
   * @param {string} outputPath - Chemin du fichier de sortie
   * @returns {Promise<Object>} Résultat de l'opération avec statut de récupération
   */
  async executeDecompressionWithRecovery(decompressionOperation, inputPath, outputPath) {
    try {
      // Exécuter la décompression avec timeout
      const result = await this.executeWithTimeout(
        () => decompressionOperation(inputPath, outputPath),
        this.config.decompressionTimeout,
        'Decompression timeout'
      );

      return {
        success: true,
        recoveryUsed: false,
        ...result
      };

    } catch (error) {
      console.error(`Decompression failed for ${inputPath}: ${error.message}`);
      
      // Tentative de récupération depuis backup
      const recoveryResult = await this.attemptRecoveryFromBackup(inputPath, outputPath, error);
      
      if (recoveryResult.success) {
        return {
          success: true,
          recoveryUsed: true,
          recoveryResult,
          originalError: error.message
        };
      } else {
        throw new Error(`Décompression échouée et récupération impossible: ${error.message}`);
      }
    }
  }

  /**
   * Exécute une fonction avec un timeout configurable
   * @param {Function} operation - Opération à exécuter
   * @param {number} timeout - Timeout en millisecondes
   * @param {string} timeoutMessage - Message d'erreur en cas de timeout
   * @returns {Promise<any>} Résultat de l'opération
   */
  async executeWithTimeout(operation, timeout, timeoutMessage) {
    return new Promise(async (resolve, reject) => {
      // Créer le timer de timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeout);

      try {
        // Exécuter l'opération
        const result = await operation();
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Stratégie de fallback: stocker le fichier original sans compression
   * @param {string} inputPath - Chemin du fichier source
   * @param {string} outputPath - Chemin de sortie prévu
   * @param {Error} originalError - Erreur originale de compression
   * @returns {Promise<Object>} Résultat du fallback
   */
  async fallbackToOriginalFile(inputPath, outputPath, originalError) {
    try {
      // Déterminer le chemin de fallback (sans extension .gz)
      const fallbackPath = outputPath.endsWith('.gz') 
        ? outputPath.slice(0, -3) 
        : outputPath + '_original';

      // Copier le fichier original vers le chemin de fallback
      await fs.copyFile(inputPath, fallbackPath);

      // Obtenir les statistiques du fichier
      const stats = await fs.stat(fallbackPath);

      return {
        success: true,
        fallbackPath,
        originalSize: stats.size,
        compressedSize: stats.size,
        compressionRatio: 1.0,
        spaceSaved: 0,
        fallbackReason: originalError.message
      };

    } catch (fallbackError) {
      throw new Error(`Fallback failed: ${fallbackError.message}. Original error: ${originalError.message}`);
    }
  }

  /**
   * Tente de récupérer un fichier depuis le backup
   * @param {string} originalPath - Chemin original du fichier
   * @param {string} outputPath - Chemin de sortie souhaité
   * @param {Error} originalError - Erreur originale de décompression
   * @returns {Promise<Object>} Résultat de la récupération
   */
  async attemptRecoveryFromBackup(originalPath, outputPath, originalError) {
    try {
      // Chercher le fichier de backup correspondant
      const backupPath = await this.findBackupFile(originalPath);
      
      if (!backupPath) {
        return {
          success: false,
          reason: 'Aucun backup trouvé'
        };
      }

      // Vérifier que le backup existe et est accessible
      await fs.access(backupPath);

      // Copier le backup vers le chemin de sortie
      await fs.copyFile(backupPath, outputPath);

      // Vérifier l'intégrité du fichier récupéré
      const stats = await fs.stat(outputPath);

      return {
        success: true,
        recoveredFromBackup: true,
        backupPath,
        recoveredSize: stats.size,
        recoveryReason: originalError.message
      };

    } catch (recoveryError) {
      return {
        success: false,
        reason: `Récupération échouée: ${recoveryError.message}`
      };
    }
  }

  /**
   * Crée un backup d'un fichier
   * @param {string} filePath - Chemin du fichier à sauvegarder
   * @returns {Promise<string>} Chemin du fichier de backup créé
   */
  async createBackup(filePath) {
    try {
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${timestamp}_${fileName}`;
      const backupPath = path.join(this.backupDir, backupFileName);

      await fs.copyFile(filePath, backupPath);
      
      // Nettoyer les anciens backups (garder seulement les 10 plus récents par fichier)
      await this.cleanupOldBackups(fileName);

      return backupPath;

    } catch (error) {
      console.warn(`Impossible de créer le backup pour ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Trouve le fichier de backup le plus récent pour un fichier donné
   * @param {string} originalPath - Chemin du fichier original
   * @returns {Promise<string|null>} Chemin du backup ou null si non trouvé
   */
  async findBackupFile(originalPath) {
    try {
      const fileName = path.basename(originalPath);
      const backupFiles = await fs.readdir(this.backupDir);
      
      // Filtrer les backups pour ce fichier spécifique
      const relevantBackups = backupFiles
        .filter(backup => backup.endsWith(`_${fileName}`))
        .map(backup => ({
          name: backup,
          path: path.join(this.backupDir, backup),
          timestamp: backup.split('_')[0]
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Plus récent en premier

      return relevantBackups.length > 0 ? relevantBackups[0].path : null;

    } catch (error) {
      console.warn(`Erreur lors de la recherche de backup: ${error.message}`);
      return null;
    }
  }

  /**
   * Nettoie les anciens backups pour un fichier donné
   * @param {string} fileName - Nom du fichier
   * @param {number} keepCount - Nombre de backups à conserver (défaut: 10)
   */
  async cleanupOldBackups(fileName, keepCount = 10) {
    try {
      const backupFiles = await fs.readdir(this.backupDir);
      
      // Filtrer et trier les backups pour ce fichier
      const relevantBackups = backupFiles
        .filter(backup => backup.endsWith(`_${fileName}`))
        .map(backup => ({
          name: backup,
          path: path.join(this.backupDir, backup),
          timestamp: backup.split('_')[0]
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      // Supprimer les backups excédentaires
      if (relevantBackups.length > keepCount) {
        const toDelete = relevantBackups.slice(keepCount);
        
        for (const backup of toDelete) {
          try {
            await fs.unlink(backup.path);
          } catch (error) {
            console.warn(`Impossible de supprimer le backup ${backup.name}: ${error.message}`);
          }
        }
      }

    } catch (error) {
      console.warn(`Erreur lors du nettoyage des backups: ${error.message}`);
    }
  }

  /**
   * Vérifie l'intégrité d'un fichier compressé
   * @param {string} originalPath - Chemin du fichier original
   * @param {string} compressedPath - Chemin du fichier compressé
   * @returns {Promise<boolean>} True si l'intégrité est vérifiée
   */
  async verifyCompressionIntegrity(originalPath, compressedPath) {
    try {
      // Vérifier que le fichier compressé existe et n'est pas vide
      const compressedStats = await fs.stat(compressedPath);
      if (compressedStats.size === 0) {
        return false;
      }

      // Vérifier que le fichier compressé est plus petit que l'original (sauf cas particuliers)
      const originalStats = await fs.stat(originalPath);
      
      // Pour les très petits fichiers, la compression peut augmenter la taille
      if (originalStats.size > 1024 && compressedStats.size >= originalStats.size) {
        console.warn(`Fichier compressé plus grand que l'original: ${compressedPath}`);
        // Ne pas considérer comme une erreur, mais logger l'information
      }

      return true;

    } catch (error) {
      console.error(`Erreur lors de la vérification d'intégrité: ${error.message}`);
      return false;
    }
  }

  /**
   * Nettoie les ressources temporaires et backups anciens
   * @param {number} maxAgeHours - Âge maximum des backups en heures (défaut: 24h)
   */
  async cleanup(maxAgeHours = 24) {
    try {
      const backupFiles = await fs.readdir(this.backupDir);
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

      for (const backupFile of backupFiles) {
        try {
          const backupPath = path.join(this.backupDir, backupFile);
          const stats = await fs.stat(backupPath);
          
          if (stats.mtime < cutoffTime) {
            await fs.unlink(backupPath);
            console.log(`Backup ancien supprimé: ${backupFile}`);
          }
        } catch (error) {
          console.warn(`Erreur lors de la suppression du backup ${backupFile}: ${error.message}`);
        }
      }

    } catch (error) {
      console.warn(`Erreur lors du nettoyage: ${error.message}`);
    }
  }
}

module.exports = ErrorHandler;