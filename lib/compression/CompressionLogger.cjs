const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

/**
 * Système de logging spécialisé pour les opérations de compression
 * Gère les logs, codes d'erreur standardisés et alertes critiques
 */
class CompressionLogger {
  /**
   * Constructeur du logger de compression
   * @param {Object} config - Configuration du logging
   */
  constructor(config = {}) {
    this.config = {
      logLevel: config.logLevel || 'INFO',
      logDir: config.logDir || path.resolve('../logs'),
      maxLogSize: config.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: config.maxLogFiles || 5,
      enableConsole: config.enableConsole !== false,
      enableFile: config.enableFile !== false,
      alertThreshold: config.alertThreshold || 10, // Nombre d'erreurs avant alerte
      ...config
    };

    // Initialiser le système de logging
    this.initializeLogging();
    
    // Compteurs pour les alertes
    this.errorCounts = new Map();
    this.lastAlertTime = new Map();
  }

  /**
   * Codes d'erreur standardisés pour les opérations de compression
   */
  static ERROR_CODES = {
    // Erreurs de compression
    COMPRESSION_FAILED: 'COMP_001',
    COMPRESSION_TIMEOUT: 'COMP_002',
    COMPRESSION_INVALID_INPUT: 'COMP_003',
    COMPRESSION_INSUFFICIENT_SPACE: 'COMP_004',
    
    // Erreurs de décompression
    DECOMPRESSION_FAILED: 'DECOMP_001',
    DECOMPRESSION_TIMEOUT: 'DECOMP_002',
    DECOMPRESSION_CORRUPTED_FILE: 'DECOMP_003',
    DECOMPRESSION_INVALID_FORMAT: 'DECOMP_004',
    
    // Erreurs de fichier
    FILE_NOT_FOUND: 'FILE_001',
    FILE_ACCESS_DENIED: 'FILE_002',
    FILE_CORRUPTED: 'FILE_003',
    FILE_TOO_LARGE: 'FILE_004',
    
    // Erreurs système
    SYSTEM_OUT_OF_MEMORY: 'SYS_001',
    SYSTEM_DISK_FULL: 'SYS_002',
    SYSTEM_PERMISSION_DENIED: 'SYS_003',
    SYSTEM_NETWORK_ERROR: 'SYS_004',
    
    // Erreurs de configuration
    CONFIG_INVALID_PARAMETER: 'CFG_001',
    CONFIG_MISSING_REQUIRED: 'CFG_002',
    CONFIG_INCOMPATIBLE_VERSION: 'CFG_003'
  };

  /**
   * Niveaux de log disponibles
   */
  static LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
  };

  /**
   * Initialise le système de logging
   */
  async initializeLogging() {
    try {
      if (this.config.enableFile) {
        await fs.mkdir(this.config.logDir, { recursive: true });
      }
    } catch (error) {
      console.error(`Impossible d'initialiser le logging: ${error.message}`);
    }
  }

  /**
   * Log une opération de compression réussie
   * @param {Object} operation - Détails de l'opération
   */
  async logCompressionSuccess(operation) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      type: 'COMPRESSION_SUCCESS',
      operation: {
        inputPath: operation.inputPath,
        outputPath: operation.outputPath,
        originalSize: operation.originalSize,
        compressedSize: operation.compressedSize,
        compressionRatio: operation.compressionRatio,
        algorithm: operation.algorithm,
        duration: operation.duration,
        spaceSaved: operation.spaceSaved
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log une erreur de compression avec code d'erreur
   * @param {string} errorCode - Code d'erreur standardisé
   * @param {Error} error - Objet erreur
   * @param {Object} context - Contexte de l'erreur
   */
  async logCompressionError(errorCode, error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      type: 'COMPRESSION_ERROR',
      errorCode,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context: {
        inputPath: context.inputPath,
        outputPath: context.outputPath,
        algorithm: context.algorithm,
        fileSize: context.fileSize,
        operation: context.operation,
        ...context
      }
    };

    await this.writeLog(logEntry);
    await this.checkForAlert(errorCode, context);
  }

  /**
   * Log une opération de décompression réussie
   * @param {Object} operation - Détails de l'opération
   */
  async logDecompressionSuccess(operation) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      type: 'DECOMPRESSION_SUCCESS',
      operation: {
        inputPath: operation.inputPath,
        outputPath: operation.outputPath,
        originalSize: operation.originalSize,
        compressedSize: operation.compressedSize,
        algorithm: operation.algorithm,
        duration: operation.duration
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log une erreur de décompression
   * @param {string} errorCode - Code d'erreur standardisé
   * @param {Error} error - Objet erreur
   * @param {Object} context - Contexte de l'erreur
   */
  async logDecompressionError(errorCode, error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      type: 'DECOMPRESSION_ERROR',
      errorCode,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context: {
        inputPath: context.inputPath,
        outputPath: context.outputPath,
        expectedSize: context.expectedSize,
        actualSize: context.actualSize,
        checksum: context.checksum,
        ...context
      }
    };

    await this.writeLog(logEntry);
    await this.checkForAlert(errorCode, context);
  }

  /**
   * Log une opération de fallback
   * @param {Object} fallback - Détails du fallback
   */
  async logFallbackOperation(fallback) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      type: 'FALLBACK_OPERATION',
      fallback: {
        originalOperation: fallback.originalOperation,
        fallbackStrategy: fallback.fallbackStrategy,
        reason: fallback.reason,
        inputPath: fallback.inputPath,
        fallbackPath: fallback.fallbackPath,
        success: fallback.success
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log une opération de récupération
   * @param {Object} recovery - Détails de la récupération
   */
  async logRecoveryOperation(recovery) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: recovery.success ? 'INFO' : 'ERROR',
      type: 'RECOVERY_OPERATION',
      recovery: {
        originalError: recovery.originalError,
        recoveryMethod: recovery.recoveryMethod,
        backupPath: recovery.backupPath,
        recoveredPath: recovery.recoveredPath,
        success: recovery.success,
        reason: recovery.reason
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log des statistiques de performance
   * @param {Object} stats - Statistiques de performance
   */
  async logPerformanceStats(stats) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      type: 'PERFORMANCE_STATS',
      stats: {
        totalOperations: stats.totalOperations,
        successfulCompressions: stats.successfulCompressions,
        failedCompressions: stats.failedCompressions,
        averageCompressionTime: stats.averageCompressionTime,
        averageCompressionRatio: stats.averageCompressionRatio,
        totalSpaceSaved: stats.totalSpaceSaved,
        memoryUsage: stats.memoryUsage,
        cpuUsage: stats.cpuUsage
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Écrit une entrée de log
   * @param {Object} logEntry - Entrée de log à écrire
   */
  async writeLog(logEntry) {
    try {
      // Log vers la console si activé
      if (this.config.enableConsole && this.shouldLog(logEntry.level)) {
        this.logToConsole(logEntry);
      }

      // Log vers fichier si activé
      if (this.config.enableFile && this.shouldLog(logEntry.level)) {
        await this.logToFile(logEntry);
      }

    } catch (error) {
      console.error(`Erreur lors de l'écriture du log: ${error.message}`);
    }
  }

  /**
   * Log vers la console avec formatage coloré
   * @param {Object} logEntry - Entrée de log
   */
  logToConsole(logEntry) {
    const colors = {
      ERROR: '\x1b[31m', // Rouge
      WARN: '\x1b[33m',  // Jaune
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m', // Magenta
      TRACE: '\x1b[37m'  // Blanc
    };

    const reset = '\x1b[0m';
    const color = colors[logEntry.level] || colors.INFO;
    
    const message = `${color}[${logEntry.timestamp}] ${logEntry.level} ${logEntry.type}${reset}`;
    
    switch (logEntry.level) {
      case 'ERROR':
        console.error(message, logEntry);
        break;
      case 'WARN':
        console.warn(message, logEntry);
        break;
      default:
        console.log(message, logEntry);
    }
  }

  /**
   * Log vers fichier avec rotation
   * @param {Object} logEntry - Entrée de log
   */
  async logToFile(logEntry) {
    try {
      const logFileName = `compression-${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.config.logDir, logFileName);
      
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Vérifier la taille du fichier et effectuer la rotation si nécessaire
      if (fsSync.existsSync(logFilePath)) {
        const stats = await fs.stat(logFilePath);
        if (stats.size > this.config.maxLogSize) {
          await this.rotateLogFile(logFilePath);
        }
      }
      
      // Écrire la ligne de log
      await fs.appendFile(logFilePath, logLine, 'utf8');

    } catch (error) {
      console.error(`Erreur lors de l'écriture du fichier de log: ${error.message}`);
    }
  }

  /**
   * Effectue la rotation des fichiers de log
   * @param {string} logFilePath - Chemin du fichier de log actuel
   */
  async rotateLogFile(logFilePath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = logFilePath.replace('.log', `_${timestamp}.log`);
      
      await fs.rename(logFilePath, rotatedPath);
      
      // Nettoyer les anciens fichiers de log
      await this.cleanupOldLogFiles();

    } catch (error) {
      console.error(`Erreur lors de la rotation du log: ${error.message}`);
    }
  }

  /**
   * Nettoie les anciens fichiers de log
   */
  async cleanupOldLogFiles() {
    try {
      const logFiles = await fs.readdir(this.config.logDir);
      const compressionLogs = logFiles
        .filter(file => file.startsWith('compression-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.config.logDir, file),
          mtime: fsSync.statSync(path.join(this.config.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Supprimer les fichiers excédentaires
      if (compressionLogs.length > this.config.maxLogFiles) {
        const toDelete = compressionLogs.slice(this.config.maxLogFiles);
        
        for (const logFile of toDelete) {
          await fs.unlink(logFile.path);
        }
      }

    } catch (error) {
      console.error(`Erreur lors du nettoyage des logs: ${error.message}`);
    }
  }

  /**
   * Vérifie si une entrée doit être loggée selon le niveau configuré
   * @param {string} level - Niveau de l'entrée
   * @returns {boolean} True si l'entrée doit être loggée
   */
  shouldLog(level) {
    const configLevel = CompressionLogger.LOG_LEVELS[this.config.logLevel] || CompressionLogger.LOG_LEVELS.INFO;
    const entryLevel = CompressionLogger.LOG_LEVELS[level] || CompressionLogger.LOG_LEVELS.INFO;
    
    return entryLevel <= configLevel;
  }

  /**
   * Vérifie s'il faut déclencher une alerte pour un type d'erreur
   * @param {string} errorCode - Code d'erreur
   * @param {Object} context - Contexte de l'erreur
   */
  async checkForAlert(errorCode, context) {
    try {
      // Incrémenter le compteur d'erreurs
      const currentCount = this.errorCounts.get(errorCode) || 0;
      this.errorCounts.set(errorCode, currentCount + 1);

      // Vérifier si le seuil d'alerte est atteint
      if (currentCount + 1 >= this.config.alertThreshold) {
        const lastAlert = this.lastAlertTime.get(errorCode);
        const now = Date.now();
        
        // Éviter le spam d'alertes (minimum 1 heure entre les alertes du même type)
        if (!lastAlert || now - lastAlert > 60 * 60 * 1000) {
          await this.triggerAlert(errorCode, currentCount + 1, context);
          this.lastAlertTime.set(errorCode, now);
          
          // Réinitialiser le compteur après alerte
          this.errorCounts.set(errorCode, 0);
        }
      }

    } catch (error) {
      console.error(`Erreur lors de la vérification d'alerte: ${error.message}`);
    }
  }

  /**
   * Déclenche une alerte critique
   * @param {string} errorCode - Code d'erreur
   * @param {number} errorCount - Nombre d'erreurs
   * @param {Object} context - Contexte de l'erreur
   */
  async triggerAlert(errorCode, errorCount, context) {
    const alert = {
      timestamp: new Date().toISOString(),
      level: 'CRITICAL',
      type: 'COMPRESSION_ALERT',
      alert: {
        errorCode,
        errorCount,
        threshold: this.config.alertThreshold,
        description: this.getErrorDescription(errorCode),
        context,
        recommendations: this.getErrorRecommendations(errorCode)
      }
    };

    // Log l'alerte
    await this.writeLog(alert);

    // Envoyer l'alerte (email, webhook, etc.)
    await this.sendAlert(alert);
  }

  /**
   * Envoie une alerte via les canaux configurés
   * @param {Object} alert - Détails de l'alerte
   */
  async sendAlert(alert) {
    try {
      // Pour l'instant, juste un log critique
      console.error('🚨 ALERTE CRITIQUE COMPRESSION 🚨');
      console.error(`Code d'erreur: ${alert.alert.errorCode}`);
      console.error(`Nombre d'occurrences: ${alert.alert.errorCount}`);
      console.error(`Description: ${alert.alert.description}`);
      console.error(`Recommandations: ${alert.alert.recommendations.join(', ')}`);

      // TODO: Implémenter l'envoi d'emails, webhooks, etc.
      
    } catch (error) {
      console.error(`Erreur lors de l'envoi d'alerte: ${error.message}`);
    }
  }

  /**
   * Obtient la description d'un code d'erreur
   * @param {string} errorCode - Code d'erreur
   * @returns {string} Description de l'erreur
   */
  getErrorDescription(errorCode) {
    const descriptions = {
      [CompressionLogger.ERROR_CODES.COMPRESSION_FAILED]: 'Échec répété des opérations de compression',
      [CompressionLogger.ERROR_CODES.COMPRESSION_TIMEOUT]: 'Timeouts fréquents lors de la compression',
      [CompressionLogger.ERROR_CODES.DECOMPRESSION_FAILED]: 'Échec répété des opérations de décompression',
      [CompressionLogger.ERROR_CODES.DECOMPRESSION_CORRUPTED_FILE]: 'Détection répétée de fichiers corrompus',
      [CompressionLogger.ERROR_CODES.SYSTEM_OUT_OF_MEMORY]: 'Problèmes de mémoire récurrents',
      [CompressionLogger.ERROR_CODES.SYSTEM_DISK_FULL]: 'Espace disque insuffisant'
    };

    return descriptions[errorCode] || `Erreur récurrente: ${errorCode}`;
  }

  /**
   * Obtient les recommandations pour un code d'erreur
   * @param {string} errorCode - Code d'erreur
   * @returns {Array<string>} Liste de recommandations
   */
  getErrorRecommendations(errorCode) {
    const recommendations = {
      [CompressionLogger.ERROR_CODES.COMPRESSION_FAILED]: [
        'Vérifier l\'espace disque disponible',
        'Réduire le niveau de compression',
        'Vérifier les permissions de fichiers'
      ],
      [CompressionLogger.ERROR_CODES.COMPRESSION_TIMEOUT]: [
        'Augmenter le timeout de compression',
        'Réduire la taille des fichiers traités',
        'Vérifier les performances du système'
      ],
      [CompressionLogger.ERROR_CODES.DECOMPRESSION_CORRUPTED_FILE]: [
        'Vérifier l\'intégrité du stockage',
        'Activer les backups automatiques',
        'Examiner les logs système'
      ],
      [CompressionLogger.ERROR_CODES.SYSTEM_OUT_OF_MEMORY]: [
        'Augmenter la mémoire disponible',
        'Traiter les fichiers par plus petits lots',
        'Optimiser la configuration'
      ]
    };

    return recommendations[errorCode] || ['Examiner les logs détaillés', 'Contacter le support technique'];
  }

  /**
   * Obtient les statistiques de logging
   * @returns {Object} Statistiques du logger
   */
  getLoggingStats() {
    return {
      errorCounts: Object.fromEntries(this.errorCounts),
      lastAlertTimes: Object.fromEntries(this.lastAlertTime),
      config: this.config
    };
  }
}

module.exports = CompressionLogger;