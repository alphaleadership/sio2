const path = require('path');
const fs = require('fs').promises;

/**
 * ErrorHandler - Comprehensive error handling for upload path resolution
 * 
 * Provides graceful fallback strategies, detailed error logging, and recovery mechanisms
 * for filesystem operations in the upload path resolution system.
 * 
 * Requirements addressed: 4.2, 5.1, 5.2, 5.3
 */
class ErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enableDetailedLogging = options.enableDetailedLogging || false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.fallbackDirectory = options.fallbackDirectory || 'uploads';
    
    // Error categories for classification
    this.errorCategories = {
      PATH_CONSTRUCTION: 'path_construction',
      FILESYSTEM: 'filesystem',
      VALIDATION: 'validation',
      SECURITY: 'security',
      DUPLICATION: 'duplication',
      UNKNOWN: 'unknown'
    };
    
    // Error severity levels
    this.severityLevels = {
      LOW: 'low',
      MEDIUM: 'medium',
      HIGH: 'high',
      CRITICAL: 'critical'
    };
    
    // Error statistics tracking
    this.errorStats = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      recoverySuccessRate: 0,
      fallbackUsageCount: 0
    };
  }

  /**
   * Handles errors during path construction with fallback strategies
   * @param {Error} error - The original error
   * @param {Object} context - Context information for error handling
   * @returns {Object} Error handling result with fallback path
   */
  handlePathConstructionError(error, context = {}) {
    const errorInfo = this._categorizeError(error, context);
    
    this._logError('Path construction error', errorInfo, context);
    
    // Apply appropriate fallback strategy based on error category
    const fallbackResult = this._applyFallbackStrategy(errorInfo, context);
    
    // Update error statistics
    this._updateErrorStats(errorInfo);
    
    return {
      success: fallbackResult.success,
      fallbackPath: fallbackResult.path,
      strategy: fallbackResult.strategy,
      errorInfo: errorInfo,
      reasoning: fallbackResult.reasoning,
      warnings: fallbackResult.warnings || []
    };
  }

  /**
   * Handles filesystem operation errors with retry mechanisms
   * @param {Function} operation - The filesystem operation to retry
   * @param {Object} context - Context for the operation
   * @param {number} maxRetries - Maximum number of retries (optional)
   * @returns {Promise<Object>} Operation result with retry information
   */
  async handleFilesystemOperation(operation, context = {}, maxRetries = null) {
    const retries = maxRetries !== null ? maxRetries : this.maxRetries;
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= retries) {
      try {
        const result = await operation();
        
        // Log successful recovery if this wasn't the first attempt
        if (attempt > 0) {
          this._logRecovery('Filesystem operation succeeded after retry', {
            operation: context.operation || 'unknown',
            attempt: attempt,
            totalAttempts: attempt + 1,
            context: context
          });
          
          this._updateRecoveryStats(true);
        }
        
        return {
          success: true,
          result: result,
          attempts: attempt + 1,
          recovered: attempt > 0
        };
        
      } catch (error) {
        lastError = error;
        attempt++;
        
        const errorInfo = this._categorizeError(error, context);
        
        // Log retry attempt
        if (attempt <= retries) {
          this._logRetry('Filesystem operation failed, retrying', {
            error: error.message,
            attempt: attempt,
            maxRetries: retries,
            nextRetryIn: this.retryDelay,
            errorCategory: errorInfo.category,
            context: context
          });
          
          // Wait before retry (with exponential backoff)
          await this._delay(this.retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }
    
    // All retries failed
    const errorInfo = this._categorizeError(lastError, context);
    this._logError('Filesystem operation failed after all retries', errorInfo, {
      ...context,
      totalAttempts: attempt,
      maxRetries: retries
    });
    
    this._updateRecoveryStats(false);
    this._updateErrorStats(errorInfo);
    
    return {
      success: false,
      error: lastError,
      errorInfo: errorInfo,
      attempts: attempt,
      recovered: false
    };
  }

  /**
   * Creates a safe fallback path when all else fails
   * @param {Object} context - Context information for fallback creation
   * @returns {Object} Fallback path result
   */
  createSafeFallbackPath(context = {}) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    
    let filename = 'unknown_file';
    let extension = '.file';
    
    // Try to extract meaningful filename information
    if (context.file) {
      if (context.file.originalname) {
        const parsed = path.parse(context.file.originalname);
        filename = this._sanitizeFilename(parsed.name) || 'unknown_file';
        extension = parsed.ext || '.file';
      }
    }
    
    // Create safe destination folder
    const destFolder = this._sanitizePath(context.destFolder) || this.fallbackDirectory;
    
    // Create unique filename to avoid conflicts
    const safeFilename = `${filename}_${timestamp}_${randomId}${extension}`;
    const fallbackPath = path.join(destFolder, safeFilename);
    
    this._logFallback('Created safe fallback path', {
      originalContext: context,
      fallbackPath: fallbackPath,
      reasoning: 'All path construction strategies failed'
    });
    
    this.errorStats.fallbackUsageCount++;
    
    return {
      success: true,
      path: fallbackPath,
      strategy: 'safe_fallback',
      reasoning: 'Generated safe fallback path due to path construction failures',
      warnings: ['Using generated fallback path due to errors']
    };
  }

  /**
   * Validates and sanitizes error recovery paths
   * @param {string} recoveryPath - Path to validate for recovery
   * @param {Object} context - Context for validation
   * @returns {Object} Validation result
   */
  validateRecoveryPath(recoveryPath, context = {}) {
    try {
      // Basic path validation
      if (!recoveryPath || typeof recoveryPath !== 'string') {
        throw new Error('Invalid recovery path: path is empty or not a string');
      }
      
      // Security validation
      if (path.isAbsolute(recoveryPath)) {
        throw new Error('Invalid recovery path: absolute paths not allowed');
      }
      
      if (recoveryPath.includes('..')) {
        throw new Error('Invalid recovery path: directory traversal detected');
      }
      
      // Length validation
      if (recoveryPath.length > 260) {
        throw new Error('Invalid recovery path: path too long');
      }
      
      // Character validation
      const forbiddenChars = /[<>:"|?*\x00-\x1f]/;
      if (forbiddenChars.test(recoveryPath)) {
        throw new Error('Invalid recovery path: contains forbidden characters');
      }
      
      return {
        isValid: true,
        sanitizedPath: recoveryPath,
        warnings: []
      };
      
    } catch (error) {
      this._logError('Recovery path validation failed', {
        category: this.errorCategories.VALIDATION,
        severity: this.severityLevels.MEDIUM,
        message: error.message
      }, { recoveryPath, context });
      
      return {
        isValid: false,
        error: error.message,
        warnings: ['Recovery path validation failed']
      };
    }
  }

  /**
   * Gets comprehensive error statistics
   * @returns {Object} Error statistics and metrics
   */
  getErrorStatistics() {
    const totalRecoveryAttempts = this.errorStats.totalErrors;
    const recoverySuccessRate = totalRecoveryAttempts > 0 
      ? Math.round((this.errorStats.recoverySuccessRate / totalRecoveryAttempts) * 100) 
      : 0;
    
    return {
      ...this.errorStats,
      recoverySuccessRatePercentage: recoverySuccessRate,
      errorDistribution: this._calculateErrorDistribution()
    };
  }

  /**
   * Resets error statistics
   */
  resetErrorStatistics() {
    this.errorStats = {
      totalErrors: 0,
      errorsByCategory: {},
      errorsBySeverity: {},
      recoverySuccessRate: 0,
      fallbackUsageCount: 0
    };
  }

  /**
   * Categorizes an error based on its characteristics
   * @private
   */
  _categorizeError(error, context = {}) {
    let category = this.errorCategories.UNKNOWN;
    let severity = this.severityLevels.MEDIUM;
    
    const errorMessage = error.message || error.toString();
    
    // Categorize based on error message patterns
    if (errorMessage.includes('ENOENT') || errorMessage.includes('ENOTDIR')) {
      category = this.errorCategories.FILESYSTEM;
      severity = this.severityLevels.MEDIUM;
    } else if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
      category = this.errorCategories.FILESYSTEM;
      severity = this.severityLevels.HIGH;
    } else if (errorMessage.includes('EMFILE') || errorMessage.includes('ENFILE')) {
      category = this.errorCategories.FILESYSTEM;
      severity = this.severityLevels.CRITICAL;
    } else if (errorMessage.includes('path') || errorMessage.includes('Path')) {
      category = this.errorCategories.PATH_CONSTRUCTION;
      severity = this.severityLevels.MEDIUM;
    } else if (errorMessage.includes('security') || errorMessage.includes('traversal')) {
      category = this.errorCategories.SECURITY;
      severity = this.severityLevels.HIGH;
    } else if (errorMessage.includes('duplication') || errorMessage.includes('duplicate')) {
      category = this.errorCategories.DUPLICATION;
      severity = this.severityLevels.LOW;
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      category = this.errorCategories.VALIDATION;
      severity = this.severityLevels.MEDIUM;
    }
    
    return {
      category: category,
      severity: severity,
      message: errorMessage,
      originalError: error,
      timestamp: new Date().toISOString(),
      context: context
    };
  }

  /**
   * Applies appropriate fallback strategy based on error category
   * @private
   */
  _applyFallbackStrategy(errorInfo, context) {
    switch (errorInfo.category) {
      case this.errorCategories.PATH_CONSTRUCTION:
        return this._handlePathConstructionFallback(errorInfo, context);
      
      case this.errorCategories.FILESYSTEM:
        return this._handleFilesystemFallback(errorInfo, context);
      
      case this.errorCategories.SECURITY:
        return this._handleSecurityFallback(errorInfo, context);
      
      case this.errorCategories.DUPLICATION:
        return this._handleDuplicationFallback(errorInfo, context);
      
      case this.errorCategories.VALIDATION:
        return this._handleValidationFallback(errorInfo, context);
      
      default:
        return this._handleUnknownErrorFallback(errorInfo, context);
    }
  }

  /**
   * Handles path construction fallback
   * @private
   */
  _handlePathConstructionFallback(errorInfo, context) {
    // Try basename strategy as fallback
    if (context.file && context.destFolder) {
      try {
        const basename = path.basename(context.file.originalname || 'unknown_file');
        const sanitizedBasename = this._sanitizeFilename(basename);
        const fallbackPath = path.join(context.destFolder, sanitizedBasename);
        
        return {
          success: true,
          path: fallbackPath,
          strategy: 'basename_fallback',
          reasoning: 'Used basename strategy after path construction failure',
          warnings: ['Path construction failed, using basename fallback']
        };
      } catch (fallbackError) {
        // If basename strategy also fails, use safe fallback
        return this.createSafeFallbackPath(context);
      }
    }
    
    return this.createSafeFallbackPath(context);
  }

  /**
   * Handles filesystem operation fallback
   * @private
   */
  _handleFilesystemFallback(errorInfo, context) {
    // For filesystem errors, try alternative directory structure
    if (context.destFolder) {
      try {
        const alternativeFolder = path.join(context.destFolder, 'recovered');
        const filename = context.file ? 
          this._sanitizeFilename(path.basename(context.file.originalname || 'recovered_file')) :
          'recovered_file';
        
        const fallbackPath = path.join(alternativeFolder, filename);
        
        return {
          success: true,
          path: fallbackPath,
          strategy: 'filesystem_recovery',
          reasoning: 'Used alternative directory structure after filesystem error',
          warnings: ['Filesystem error occurred, using recovery directory']
        };
      } catch (fallbackError) {
        return this.createSafeFallbackPath(context);
      }
    }
    
    return this.createSafeFallbackPath(context);
  }

  /**
   * Handles security-related fallback
   * @private
   */
  _handleSecurityFallback(errorInfo, context) {
    // For security errors, use highly sanitized safe fallback
    const safeContext = {
      ...context,
      destFolder: this.fallbackDirectory // Force safe directory
    };
    
    const result = this.createSafeFallbackPath(safeContext);
    result.warnings.push('Security violation detected, using secure fallback');
    result.reasoning = 'Used secure fallback due to security violation';
    
    return result;
  }

  /**
   * Handles duplication-related fallback
   * @private
   */
  _handleDuplicationFallback(errorInfo, context) {
    // For duplication errors, use basename with timestamp
    if (context.file && context.destFolder) {
      try {
        const timestamp = Date.now();
        const basename = path.basename(context.file.originalname || 'file');
        const parsed = path.parse(basename);
        const uniqueFilename = `${parsed.name}_${timestamp}${parsed.ext}`;
        const fallbackPath = path.join(context.destFolder, uniqueFilename);
        
        return {
          success: true,
          path: fallbackPath,
          strategy: 'duplication_recovery',
          reasoning: 'Added timestamp to filename to resolve duplication',
          warnings: ['Path duplication detected, added timestamp to filename']
        };
      } catch (fallbackError) {
        return this.createSafeFallbackPath(context);
      }
    }
    
    return this.createSafeFallbackPath(context);
  }

  /**
   * Handles validation-related fallback
   * @private
   */
  _handleValidationFallback(errorInfo, context) {
    // For validation errors, sanitize and retry
    if (context.file && context.destFolder) {
      try {
        const sanitizedFolder = this._sanitizePath(context.destFolder);
        const sanitizedFilename = this._sanitizeFilename(
          path.basename(context.file.originalname || 'validated_file')
        );
        const fallbackPath = path.join(sanitizedFolder, sanitizedFilename);
        
        return {
          success: true,
          path: fallbackPath,
          strategy: 'validation_recovery',
          reasoning: 'Sanitized path components after validation failure',
          warnings: ['Validation failed, sanitized path components']
        };
      } catch (fallbackError) {
        return this.createSafeFallbackPath(context);
      }
    }
    
    return this.createSafeFallbackPath(context);
  }

  /**
   * Handles unknown error fallback
   * @private
   */
  _handleUnknownErrorFallback(errorInfo, context) {
    const result = this.createSafeFallbackPath(context);
    result.warnings.push('Unknown error occurred, using safe fallback');
    result.reasoning = 'Used safe fallback due to unknown error type';
    
    return result;
  }

  /**
   * Sanitizes a filename for safe filesystem usage
   * @private
   */
  _sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'sanitized_file';
    }
    
    // Remove forbidden characters
    let sanitized = filename.replace(/[<>:"|?*\x00-\x1f]/g, '_');
    
    // Remove leading/trailing dots and spaces
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
    
    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'sanitized_file';
    }
    
    // Limit length
    if (sanitized.length > 100) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      sanitized = name.substring(0, 100 - ext.length) + ext;
    }
    
    return sanitized;
  }

  /**
   * Sanitizes a path for safe filesystem usage
   * @private
   */
  _sanitizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return this.fallbackDirectory;
    }
    
    // Normalize separators and remove dangerous patterns
    let sanitized = inputPath.replace(/[/\\]+/g, path.sep);
    sanitized = sanitized.replace(/\.\./g, ''); // Remove directory traversal
    
    // Remove leading/trailing separators and spaces
    sanitized = sanitized.trim().replace(/^[/\\]+|[/\\]+$/g, '');
    
    if (!sanitized) {
      return this.fallbackDirectory;
    }
    
    return sanitized;
  }

  /**
   * Updates error statistics
   * @private
   */
  _updateErrorStats(errorInfo) {
    this.errorStats.totalErrors++;
    
    // Update category stats
    const category = errorInfo.category;
    this.errorStats.errorsByCategory[category] = (this.errorStats.errorsByCategory[category] || 0) + 1;
    
    // Update severity stats
    const severity = errorInfo.severity;
    this.errorStats.errorsBySeverity[severity] = (this.errorStats.errorsBySeverity[severity] || 0) + 1;
  }

  /**
   * Updates recovery statistics
   * @private
   */
  _updateRecoveryStats(success) {
    if (success) {
      this.errorStats.recoverySuccessRate++;
    }
  }

  /**
   * Calculates error distribution percentages
   * @private
   */
  _calculateErrorDistribution() {
    const total = this.errorStats.totalErrors;
    if (total === 0) return {};
    
    const distribution = {};
    
    // Category distribution
    distribution.byCategory = {};
    for (const [category, count] of Object.entries(this.errorStats.errorsByCategory)) {
      distribution.byCategory[category] = Math.round((count / total) * 100);
    }
    
    // Severity distribution
    distribution.bySeverity = {};
    for (const [severity, count] of Object.entries(this.errorStats.errorsBySeverity)) {
      distribution.bySeverity[severity] = Math.round((count / total) * 100);
    }
    
    return distribution;
  }

  /**
   * Logs detailed error information
   * @private
   */
  _logError(message, errorInfo, context = {}) {
    const logData = {
      message: message,
      category: errorInfo.category,
      severity: errorInfo.severity,
      error: errorInfo.message,
      timestamp: errorInfo.timestamp,
      context: context
    };
    
    if (this.enableDetailedLogging) {
      logData.stackTrace = errorInfo.originalError?.stack;
    }
    
    // Log at appropriate level based on severity
    switch (errorInfo.severity) {
      case this.severityLevels.CRITICAL:
        this.logger.error(`[CRITICAL ERROR] ${message}`, logData);
        break;
      case this.severityLevels.HIGH:
        this.logger.error(`[HIGH ERROR] ${message}`, logData);
        break;
      case this.severityLevels.MEDIUM:
        this.logger.warn(`[MEDIUM ERROR] ${message}`, logData);
        break;
      case this.severityLevels.LOW:
        this.logger.info(`[LOW ERROR] ${message}`, logData);
        break;
      default:
        this.logger.warn(`[ERROR] ${message}`, logData);
    }
  }

  /**
   * Logs retry attempts
   * @private
   */
  _logRetry(message, retryInfo) {
    this.logger.info(`[RETRY] ${message}`, retryInfo);
  }

  /**
   * Logs successful recovery
   * @private
   */
  _logRecovery(message, recoveryInfo) {
    this.logger.info(`[RECOVERY] ${message}`, recoveryInfo);
  }

  /**
   * Logs fallback usage
   * @private
   */
  _logFallback(message, fallbackInfo) {
    this.logger.warn(`[FALLBACK] ${message}`, fallbackInfo);
  }

  /**
   * Creates a delay for retry mechanisms
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ErrorHandler;