const path = require('path');
const DuplicationDetector = require('./DuplicationDetector');
const PathAnalysisEngine = require('./PathAnalysisEngine');
const PathConstructionStrategy = require('./PathConstructionStrategy');
const ErrorHandler = require('./ErrorHandler');
const PerformanceMonitor = require('./PerformanceMonitor');

/**
 * UploadPathResolver - Main orchestrator that coordinates all path resolution components
 * 
 * This class integrates duplication detection, upload analysis, and path construction
 * to provide intelligent file path resolution for uploads. It addresses the core issue
 * where individual file uploads with webkitRelativePath create duplicate folder structures.
 * 
 * Requirements addressed: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3
 */
class UploadPathResolver {
  constructor(options = {}) {
    // Initialize component dependencies
    this.duplicationDetector = options.duplicationDetector || new DuplicationDetector();
    this.pathAnalysisEngine = options.pathAnalysisEngine || new PathAnalysisEngine();
    this.pathConstructionStrategy = options.pathConstructionStrategy || new PathConstructionStrategy();
    this.errorHandler = options.errorHandler || new ErrorHandler({
      logger: options.logger || console,
      enableDetailedLogging: options.enableDetailedLogging || false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      fallbackDirectory: options.fallbackDirectory || 'uploads'
    });
    
    // Initialize performance monitoring
    this.performanceMonitor = options.performanceMonitor || new PerformanceMonitor({
      enableCaching: options.enableCaching !== false,
      cacheMaxSize: options.cacheMaxSize || 1000,
      cacheTTL: options.cacheTTL || 300000,
      enableAlerts: options.enablePerformanceAlerts !== false,
      enableDetailedMetrics: options.enableDetailedMetrics !== false
    });
    
    // Configure logging
    this.logger = options.logger || console;
    this.enableDebugLogging = options.enableDebugLogging || false;
    
    // Legacy performance tracking (kept for backward compatibility)
    this.performanceMetrics = {
      totalResolutions: 0,
      averageResolutionTime: 0,
      duplicationsDetected: 0,
      strategiesUsed: {
        basename: 0,
        webkit_path: 0,
        smart_path: 0
      }
    };
    
    // Setup performance monitoring event listeners
    this.setupPerformanceMonitoring();
  }

  /**
   * Resolves the correct path for a file upload
   * @param {Object} file - File object from multer
   * @param {string} destFolder - Destination folder
   * @param {Array} allFiles - All files in the upload batch (for context)
   * @returns {Object} Resolution result with path, strategy, and metadata
   */
  resolvePath(file, destFolder, allFiles = []) {
    // Start performance monitoring
    const operationId = `resolve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const tracker = this.performanceMonitor.startPathResolution(operationId, {
      filename: file ? file.originalname : 'unknown',
      destFolder,
      batchSize: allFiles.length
    });
    
    const startTime = Date.now();
    
    try {
      // Input validation with error handling
      const validationResult = this._validateInputs(file, destFolder);
      if (!validationResult.isValid) {
        return this._handlePathResolutionError(
          new Error(validationResult.error), 
          { file, destFolder, allFiles }, 
          startTime
        );
      }

      this._logDebug('Starting path resolution', {
        filename: file.originalname,
        webkitRelativePath: file.webkitRelativePath,
        destFolder: destFolder,
        batchSize: allFiles.length
      });

      // Step 1: Analyze upload context to determine strategy with error handling
      let analysisResult;
      try {
        tracker.addSample('analysis_start');
        analysisResult = this.performanceMonitor.monitorPathAnalysisSync(
          allFiles, 
          destFolder, 
          (files, dest) => this.pathAnalysisEngine.analyzeUploadContext(files, dest)
        );
        tracker.addSample('analysis_complete', { strategy: analysisResult.strategy });
        this._logDebug('Upload analysis completed', analysisResult);
      } catch (analysisError) {
        tracker.finish({ error: true, step: 'analysis' });
        return this._handlePathResolutionError(
          analysisError, 
          { file, destFolder, allFiles, step: 'analysis' }, 
          startTime
        );
      }

      // Step 2: Construct initial path using determined strategy with error handling
      let initialPath;
      try {
        initialPath = this._constructPathWithStrategy(file, destFolder, analysisResult.strategy);
      } catch (constructionError) {
        return this._handlePathResolutionError(
          constructionError, 
          { file, destFolder, allFiles, step: 'construction', strategy: analysisResult.strategy }, 
          startTime
        );
      }
      
      // Step 3: Check for path duplications with error handling
      let duplicationAnalysis;
      try {
        tracker.addSample('duplication_analysis_start');
        let pathToAnalyze = initialPath;
        if (file.webkitRelativePath && analysisResult.strategy !== 'webkit_path') {
          // If we're not using webkit strategy but webkit path exists, check what webkit would produce
          pathToAnalyze = this.pathConstructionStrategy.constructWebkitPath(destFolder, file);
        }
        duplicationAnalysis = this.performanceMonitor.monitorDuplicationDetectionSync(
          pathToAnalyze,
          (path) => this.duplicationDetector.analyzePathDuplication(path)
        );
        tracker.addSample('duplication_analysis_complete', { 
          hasDuplication: duplicationAnalysis.hasDuplication,
          duplicationType: duplicationAnalysis.duplicationType 
        });
        this._logDebug('Duplication analysis completed', duplicationAnalysis);
      } catch (duplicationError) {
        tracker.finish({ error: true, step: 'duplication_analysis' });
        return this._handlePathResolutionError(
          duplicationError, 
          { file, destFolder, allFiles, step: 'duplication_analysis', initialPath }, 
          startTime
        );
      }

      // Step 4: Apply duplication fixes if needed with error handling
      let finalPath;
      try {
        finalPath = this._applyDuplicationFixes(file, destFolder, initialPath, duplicationAnalysis, analysisResult);
      } catch (fixError) {
        return this._handlePathResolutionError(
          fixError, 
          { file, destFolder, allFiles, step: 'duplication_fix', initialPath, duplicationAnalysis }, 
          startTime
        );
      }
      
      // Step 5: Final validation and result creation with error handling
      let result;
      try {
        result = this._createSuccessResult(file, destFolder, finalPath, analysisResult, duplicationAnalysis, startTime);
        
        // Update performance metrics
        this._updatePerformanceMetrics(result);
        
        // Finish performance monitoring
        const monitoringDuration = tracker.finish({
          success: true,
          strategy: result.strategy,
          duplicationPrevented: result.duplicationPrevented
        });
        
        // Add performance data to result
        result.performanceData = {
          monitoringDuration,
          cacheHits: this.performanceMonitor.getMetrics().cache.hits,
          totalOperations: this.performanceMonitor.getMetrics().pathResolution.totalOperations
        };
        
        this._logDebug('Path resolution completed', {
          originalPath: initialPath,
          finalPath: result.finalPath,
          strategy: result.strategy,
          duplicationPrevented: result.duplicationPrevented,
          performanceData: result.performanceData
        });

        return result;
      } catch (resultError) {
        return this._handlePathResolutionError(
          resultError, 
          { file, destFolder, allFiles, step: 'result_creation', finalPath }, 
          startTime
        );
      }
      
    } catch (error) {
      // Catch-all error handler for unexpected errors
      return this._handlePathResolutionError(
        error, 
        { file, destFolder, allFiles, step: 'unexpected' }, 
        startTime
      );
    }
  }

  /**
   * Validates input parameters for path resolution
   * @private
   */
  _validateInputs(file, destFolder) {
    if (!file) {
      return { isValid: false, error: 'File object is required' };
    }
    
    if (!file.originalname) {
      return { isValid: false, error: 'File must have an originalname property' };
    }
    
    if (!destFolder || typeof destFolder !== 'string') {
      return { isValid: false, error: 'Destination folder must be a non-empty string' };
    }
    
    // Additional security validation
    if (destFolder.includes('..')) {
      return { isValid: false, error: 'Destination folder contains directory traversal' };
    }
    
    return { isValid: true };
  }

  /**
   * Handles path resolution errors with comprehensive error handling
   * @private
   */
  _handlePathResolutionError(error, context, startTime) {
    const errorHandlingResult = this.errorHandler.handlePathConstructionError(error, context);
    
    // Create error result with fallback path
    const processingTime = Date.now() - startTime;
    
    return {
      originalFile: context.file ? {
        originalname: context.file.originalname,
        webkitRelativePath: context.file.webkitRelativePath
      } : null,
      finalPath: errorHandlingResult.fallbackPath,
      strategy: errorHandlingResult.strategy,
      reasoning: errorHandlingResult.reasoning,
      duplicationPrevented: false,
      warnings: errorHandlingResult.warnings,
      processingTime: processingTime,
      confidence: 0.1,
      error: true,
      errorInfo: errorHandlingResult.errorInfo,
      metadata: {
        uploadType: 'unknown',
        duplicationType: 'none',
        originalAnalysisStrategy: 'error_fallback',
        duplicationConfidence: 0,
        errorCategory: errorHandlingResult.errorInfo.category,
        errorSeverity: errorHandlingResult.errorInfo.severity
      }
    };
  }

  /**
   * Constructs path using the specified strategy with error handling
   * @private
   */
  _constructPathWithStrategy(file, destFolder, strategy) {
    try {
      switch (strategy) {
        case 'basename':
          return this.pathConstructionStrategy.constructBasename(destFolder, file);
        case 'webkit_path':
          // Additional validation before attempting webkit construction
          if (!file.webkitRelativePath || file.webkitRelativePath.trim() === '') {
            this.logger.warn(`Webkit strategy requested but webkitRelativePath is missing for file '${file.originalname}', falling back to basename`);
            return this.pathConstructionStrategy.constructBasename(destFolder, file);
          }
          return this.pathConstructionStrategy.constructWebkitPath(destFolder, file);
        case 'smart_path':
          // Additional validation before attempting smart construction
          if (!file.webkitRelativePath || file.webkitRelativePath.trim() === '') {
            this.logger.warn(`Smart strategy requested but webkitRelativePath is missing for file '${file.originalname}', falling back to basename`);
            return this.pathConstructionStrategy.constructBasename(destFolder, file);
          }
          return this.pathConstructionStrategy.constructSmartPath(destFolder, file);
        default:
          this.logger.warn(`Unknown strategy '${strategy}', falling back to basename`);
          return this.pathConstructionStrategy.constructBasename(destFolder, file);
      }
    } catch (error) {
      // Log the specific error for debugging
      this.logger.warn(`Strategy '${strategy}' failed for file '${file.originalname}': ${error.message}`);
      
      // Always fall back to basename as it's the most reliable
      try {
        return this.pathConstructionStrategy.constructBasename(destFolder, file);
      } catch (basenameError) {
        // If even basename fails, this is a serious error
        this.logger.error(`Basename fallback failed for file '${file.originalname}': ${basenameError.message}`);
        throw new Error(`All path construction strategies failed: ${error.message}`);
      }
    }
  }

  /**
   * Applies duplication fixes based on detection results
   * @private
   */
  _applyDuplicationFixes(file, destFolder, initialPath, duplicationAnalysis, analysisResult) {
    if (!duplicationAnalysis.hasDuplication) {
      return initialPath;
    }

    this._logDebug('Applying duplication fixes', {
      duplicationType: duplicationAnalysis.duplicationType,
      originalPath: initialPath,
      suggestedPath: duplicationAnalysis.suggestedPath
    });

    // If duplication detector suggests a path, validate and use it
    if (duplicationAnalysis.suggestedPath && duplicationAnalysis.suggestedPath !== initialPath) {
      const suggestedPath = duplicationAnalysis.suggestedPath;
      
      // Ensure the suggested path still includes the destination folder
      if (suggestedPath.startsWith(destFolder) || path.resolve(destFolder, suggestedPath).startsWith(path.resolve(destFolder))) {
        return duplicationAnalysis.suggestedPath;
      }
    }

    // Fallback strategies based on duplication type
    switch (duplicationAnalysis.duplicationType) {
      case 'consecutive':
        // For consecutive duplicates, try smart path strategy
        return this.pathConstructionStrategy.constructSmartPath(destFolder, file);
      
      case 'user_pattern':
        // For user pattern duplicates, use basename strategy
        return this.pathConstructionStrategy.constructBasename(destFolder, file);
      
      default:
        // For unknown duplication types, use basename as safest option
        return this.pathConstructionStrategy.constructBasename(destFolder, file);
    }
  }

  /**
   * Creates a successful resolution result
   * @private
   */
  _createSuccessResult(file, destFolder, finalPath, analysisResult, duplicationAnalysis, startTime) {
    const processingTime = Date.now() - startTime;
    
    // Determine final strategy used
    let finalStrategy = analysisResult.strategy;
    if (duplicationAnalysis.hasDuplication) {
      // If we had to fix duplications, the strategy might have changed
      if (finalPath !== this._constructPathWithStrategy(file, destFolder, analysisResult.strategy)) {
        finalStrategy = this._determineFinalStrategy(file, destFolder, finalPath);
      }
    }

    // Compile warnings
    const warnings = [...(analysisResult.warnings || [])];
    if (duplicationAnalysis.hasDuplication) {
      warnings.push(`Path duplication detected and fixed: ${duplicationAnalysis.duplicationType}`);
    }

    // Create reasoning explanation
    const reasoning = this._createReasoningExplanation(analysisResult, duplicationAnalysis, finalStrategy);

    return {
      originalFile: {
        originalname: file.originalname,
        webkitRelativePath: file.webkitRelativePath
      },
      finalPath: finalPath,
      strategy: finalStrategy,
      reasoning: reasoning,
      duplicationPrevented: duplicationAnalysis.hasDuplication,
      warnings: warnings,
      processingTime: processingTime,
      confidence: analysisResult.confidence,
      metadata: {
        uploadType: analysisResult.uploadType,
        duplicationType: duplicationAnalysis.duplicationType,
        originalAnalysisStrategy: analysisResult.strategy,
        duplicationConfidence: duplicationAnalysis.confidence
      }
    };
  }

  /**
   * Creates an error result when path resolution fails
   * @private
   */
  _createErrorResult(errorMessage, destFolder, startTime, file = null) {
    const processingTime = Date.now() - startTime;
    
    // Create a safe fallback path
    const fallbackPath = this.pathConstructionStrategy.constructBasename(
      destFolder || 'uploads', 
      file || { originalname: `error_${Date.now()}.file` }
    );

    return {
      originalFile: file ? {
        originalname: file.originalname,
        webkitRelativePath: file.webkitRelativePath
      } : null,
      finalPath: fallbackPath,
      strategy: 'basename',
      reasoning: `Error occurred during path resolution: ${errorMessage}. Using fallback strategy.`,
      duplicationPrevented: false,
      warnings: [`Path resolution error: ${errorMessage}`],
      processingTime: processingTime,
      confidence: 0.1,
      error: true,
      metadata: {
        uploadType: 'unknown',
        duplicationType: 'none',
        originalAnalysisStrategy: 'error_fallback',
        duplicationConfidence: 0
      }
    };
  }

  /**
   * Determines the final strategy used based on the constructed path
   * @private
   */
  _determineFinalStrategy(file, destFolder, finalPath) {
    // Check which strategy would produce this path
    const basenameResult = this.pathConstructionStrategy.constructBasename(destFolder, file);
    if (finalPath === basenameResult) {
      return 'basename';
    }

    const webkitResult = this.pathConstructionStrategy.constructWebkitPath(destFolder, file);
    if (finalPath === webkitResult) {
      return 'webkit_path';
    }

    const smartResult = this.pathConstructionStrategy.constructSmartPath(destFolder, file);
    if (finalPath === smartResult) {
      return 'smart_path';
    }

    return 'custom'; // Path was modified beyond standard strategies
  }

  /**
   * Creates a detailed reasoning explanation for the path resolution
   * @private
   */
  _createReasoningExplanation(analysisResult, duplicationAnalysis, finalStrategy) {
    let reasoning = `Upload analysis: ${analysisResult.reasoning}. `;
    reasoning += `Initial strategy: ${analysisResult.strategy}. `;
    
    if (duplicationAnalysis.hasDuplication) {
      reasoning += `Duplication detected (${duplicationAnalysis.duplicationType}), applied fixes. `;
    }
    
    reasoning += `Final strategy: ${finalStrategy}.`;
    
    return reasoning;
  }

  /**
   * Updates performance metrics
   * @private
   */
  _updatePerformanceMetrics(result) {
    this.performanceMetrics.totalResolutions++;
    
    // Update average resolution time
    const currentAvg = this.performanceMetrics.averageResolutionTime;
    const newAvg = (currentAvg * (this.performanceMetrics.totalResolutions - 1) + result.processingTime) / this.performanceMetrics.totalResolutions;
    this.performanceMetrics.averageResolutionTime = Math.round(newAvg * 100) / 100;
    
    // Track duplications
    if (result.duplicationPrevented) {
      this.performanceMetrics.duplicationsDetected++;
    }
    
    // Track strategy usage
    if (this.performanceMetrics.strategiesUsed[result.strategy] !== undefined) {
      this.performanceMetrics.strategiesUsed[result.strategy]++;
    }
  }

  /**
   * Logs debug information if debug logging is enabled
   * @private
   */
  _logDebug(message, data = {}) {
    if (this.enableDebugLogging) {
      this.logger.debug(`UploadPathResolver: ${message}`, data);
    }
  }

  /**
   * Gets current performance metrics
   * @returns {Object} Performance metrics object
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      duplicationsPreventedPercentage: this.performanceMetrics.totalResolutions > 0 
        ? Math.round((this.performanceMetrics.duplicationsDetected / this.performanceMetrics.totalResolutions) * 100)
        : 0
    };
  }

  /**
   * Resets performance metrics
   */
  resetPerformanceMetrics() {
    this.performanceMetrics = {
      totalResolutions: 0,
      averageResolutionTime: 0,
      duplicationsDetected: 0,
      strategiesUsed: {
        basename: 0,
        webkit_path: 0,
        smart_path: 0
      }
    };
  }

  /**
   * Batch resolves paths for multiple files with error handling
   * @param {Array} files - Array of file objects
   * @param {string} destFolder - Destination folder
   * @returns {Array} Array of resolution results
   */
  resolvePathsBatch(files, destFolder) {
    if (!Array.isArray(files)) {
      const error = new Error('Files must be an array');
      const errorResult = this.errorHandler.handlePathConstructionError(error, { files, destFolder });
      throw error;
    }

    const startTime = Date.now();
    this._logDebug('Starting batch path resolution', {
      fileCount: files.length,
      destFolder: destFolder
    });

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const result = this.resolvePath(file, destFolder, files);
        results.push(result);
        
        if (result.error) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch (batchError) {
        // Handle individual file errors in batch
        const errorResult = this._handlePathResolutionError(
          batchError, 
          { file, destFolder, allFiles: files, step: 'batch_processing' }, 
          startTime
        );
        results.push(errorResult);
        errorCount++;
      }
    }
    
    const batchTime = Date.now() - startTime;
    this._logDebug('Batch path resolution completed', {
      fileCount: files.length,
      successCount: successCount,
      errorCount: errorCount,
      batchTime: batchTime,
      averageTimePerFile: files.length > 0 ? Math.round(batchTime / files.length) : 0
    });

    return results;
  }

  /**
   * Performs filesystem operation with retry and error handling
   * @param {Function} operation - Filesystem operation to perform
   * @param {Object} context - Context for the operation
   * @returns {Promise<Object>} Operation result
   */
  async performFilesystemOperation(operation, context = {}) {
    return await this.errorHandler.handleFilesystemOperation(operation, context);
  }

  /**
   * Gets comprehensive error statistics from the error handler
   * @returns {Object} Error statistics and metrics
   */
  getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }

  /**
   * Resets error statistics
   */
  resetErrorStatistics() {
    this.errorHandler.resetErrorStatistics();
  }

  /**
   * Validates a recovery path for safety
   * @param {string} recoveryPath - Path to validate
   * @param {Object} context - Context for validation
   * @returns {Object} Validation result
   */
  validateRecoveryPath(recoveryPath, context = {}) {
    return this.errorHandler.validateRecoveryPath(recoveryPath, context);
  }

  /**
   * Creates a safe fallback path when all else fails
   * @param {Object} context - Context for fallback creation
   * @returns {Object} Fallback path result
   */
  createSafeFallbackPath(context = {}) {
    return this.errorHandler.createSafeFallbackPath(context);
  }

  /**
   * Sets up performance monitoring event listeners
   * @private
   */
  setupPerformanceMonitoring() {
    // Listen for performance alerts
    this.performanceMonitor.on('performanceAlert', (alert) => {
      this.logger.warn('Performance alert:', alert);
    });

    // Listen for metrics updates
    this.performanceMonitor.on('metricsUpdate', (metrics) => {
      if (this.enableDebugLogging) {
        this.logger.debug('Performance metrics updated:', {
          pathResolution: metrics.pathResolution.averageTime,
          cacheHitRate: metrics.cache.hitRate,
          totalOperations: metrics.pathResolution.totalOperations
        });
      }
    });

    // Listen for cache events
    this.performanceMonitor.on('cacheCleared', (event) => {
      this.logger.info('Performance cache cleared:', event);
    });
  }

  /**
   * Gets comprehensive performance metrics including benchmarks
   * @returns {Object} Performance metrics and benchmarks
   */
  getPerformanceMetrics() {
    const monitorMetrics = this.performanceMonitor.getMetrics();
    const benchmarks = this.performanceMonitor.getBenchmarks ? this.performanceMonitor.getBenchmarks() : {};
    
    return {
      // Legacy metrics for backward compatibility
      legacy: this.performanceMetrics,
      
      // Enhanced metrics from performance monitor
      enhanced: monitorMetrics,
      
      // Performance benchmarks
      benchmarks: benchmarks,
      
      // Combined summary
      summary: {
        totalResolutions: monitorMetrics.pathResolution.totalOperations,
        averageResolutionTime: monitorMetrics.pathResolution.averageTime,
        p95ResolutionTime: monitorMetrics.pathResolution.p95Time,
        p99ResolutionTime: monitorMetrics.pathResolution.p99Time,
        duplicationsDetected: monitorMetrics.pathResolution.duplicationsDetected || this.performanceMetrics.duplicationsDetected,
        cacheHitRate: monitorMetrics.cache.hitRate,
        cacheSize: monitorMetrics.cache.size,
        slowOperations: monitorMetrics.pathResolution.slowOperations,
        errorRate: monitorMetrics.pathResolution.totalOperations > 0 
          ? (monitorMetrics.pathResolution.errorCount || 0) / monitorMetrics.pathResolution.totalOperations
          : 0
      }
    };
  }

  /**
   * Resets all performance metrics
   */
  resetPerformanceMetrics() {
    // Reset legacy metrics
    this.performanceMetrics = {
      totalResolutions: 0,
      averageResolutionTime: 0,
      duplicationsDetected: 0,
      strategiesUsed: {
        basename: 0,
        webkit_path: 0,
        smart_path: 0
      }
    };
    
    // Reset enhanced metrics
    this.performanceMonitor.resetMetrics();
  }

  /**
   * Clears performance cache
   */
  clearPerformanceCache() {
    this.performanceMonitor.clearCache();
  }

  /**
   * Gets performance history for analysis
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Performance history entries
   */
  getPerformanceHistory(limit = 100) {
    return this.performanceMonitor.getPerformanceHistory(limit);
  }

  /**
   * Performs optimized string operations using the performance monitor
   * @param {string} operation - Operation type
   * @param {*} input - Input data
   * @returns {*} Operation result
   */
  optimizedStringOperation(operation, input) {
    return this.performanceMonitor.optimizedStringOperation(operation, input);
  }

  /**
   * Runs performance benchmark on this resolver instance
   * @param {Object} options - Benchmark options
   * @returns {Object} Benchmark results
   */
  async runPerformanceBenchmark(options = {}) {
    const PerformanceBenchmark = require('./PerformanceBenchmark');
    const benchmark = new PerformanceBenchmark({
      ...options,
      resolver: this
    });
    
    return await benchmark.runCompleteBenchmark();
  }
}

module.exports = UploadPathResolver;