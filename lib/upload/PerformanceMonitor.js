const EventEmitter = require('events');

/**
 * PerformanceMonitor - Comprehensive performance monitoring and optimization for upload path resolution
 * 
 * This class provides:
 * - Performance benchmarks for path resolution operations
 * - Caching for repeated path analysis patterns
 * - String operation optimizations
 * - Real-time performance metrics and alerts
 * 
 * Requirements addressed: 4.1, 4.2
 */
class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.config = {
      enableCaching: options.enableCaching !== false,
      cacheMaxSize: options.cacheMaxSize || 1000,
      cacheTTL: options.cacheTTL || 300000, // 5 minutes
      performanceThresholds: {
        pathResolution: options.pathResolutionThreshold || 10, // ms
        duplicationDetection: options.duplicationDetectionThreshold || 5, // ms
        pathAnalysis: options.pathAnalysisThreshold || 8, // ms
        stringOperations: options.stringOperationsThreshold || 2 // ms
      },
      enableAlerts: options.enableAlerts !== false,
      sampleRate: options.sampleRate || 1.0, // 100% sampling by default
      enableDetailedMetrics: options.enableDetailedMetrics !== false
    };
    
    // Performance metrics storage
    this.metrics = {
      pathResolution: {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        p95Time: 0,
        p99Time: 0,
        recentTimes: [],
        slowOperations: 0,
        errorCount: 0
      },
      duplicationDetection: {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        duplicationsFound: 0
      },
      pathAnalysis: {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        strategiesUsed: {
          basename: 0,
          webkit_path: 0,
          smart_path: 0
        },
        uploadTypes: {
          individual: 0,
          folder: 0
        }
      },
      stringOperations: {
        totalOperations: 0,
        totalTime: 0,
        segmentSplits: 0,
        pathJoins: 0,
        normalizations: 0,
        optimizedOperations: 0
      },
      cache: {
        size: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0
      }
    };
    
    // Caching system
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // String operation optimizations
    this.stringOptimizer = new StringOptimizer();
    
    // Performance tracking
    this.activeOperations = new Map();
    this.performanceHistory = [];
    
    // Setup cache cleanup interval
    this.setupCacheCleanup();
    
    // Setup metrics calculation interval
    this.setupMetricsCalculation();
  }

  /**
   * Starts monitoring a path resolution operation
   * @param {string} operationId - Unique identifier for the operation
   * @param {Object} context - Operation context
   * @returns {Object} Operation tracker
   */
  startPathResolution(operationId, context = {}) {
    const startTime = process.hrtime.bigint();
    const operation = {
      id: operationId,
      type: 'pathResolution',
      startTime,
      context: { ...context },
      samples: []
    };
    
    this.activeOperations.set(operationId, operation);
    
    return {
      addSample: (sampleName, data = {}) => this.addOperationSample(operationId, sampleName, data),
      finish: (result = {}) => this.finishPathResolution(operationId, result)
    };
  }

  /**
   * Finishes monitoring a path resolution operation
   * @param {string} operationId - Operation identifier
   * @param {Object} result - Operation result
   */
  finishPathResolution(operationId, result = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - operation.startTime) / 1000000; // Convert to milliseconds
    
    // Update metrics
    this.updatePathResolutionMetrics(duration, result, operation.context);
    
    // Check for performance alerts
    this.checkPerformanceThresholds('pathResolution', duration, operation.context);
    
    // Clean up
    this.activeOperations.delete(operationId);
    
    // Store in history if detailed metrics enabled
    if (this.config.enableDetailedMetrics) {
      this.addToPerformanceHistory('pathResolution', duration, operation);
    }
    
    return duration;
  }

  /**
   * Monitors duplication detection with caching (synchronous version)
   * @param {string} path - Path to analyze
   * @param {Function} detectionFunction - Function to perform detection
   * @returns {Object} Detection result with performance data
   */
  monitorDuplicationDetectionSync(path, detectionFunction) {
    const startTime = process.hrtime.bigint();
    const cacheKey = this.generateCacheKey('duplication', path);
    
    // Check cache first
    if (this.config.enableCaching) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.metrics.duplicationDetection.cacheHits++;
        this.metrics.cache.hits++;
        
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
        this.updateDuplicationDetectionMetrics(duration, true);
        
        return {
          ...cachedResult,
          fromCache: true,
          performanceData: { duration, cacheHit: true }
        };
      }
    }
    
    // Perform detection
    let result;
    try {
      result = detectionFunction(path);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // Cache the result
      if (this.config.enableCaching && result) {
        this.setCachedResult(cacheKey, result);
        this.metrics.duplicationDetection.cacheMisses++;
        this.metrics.cache.misses++;
      }
      
      // Update metrics
      this.updateDuplicationDetectionMetrics(duration, false);
      
      // Track duplications found
      if (result && result.hasDuplication) {
        this.metrics.duplicationDetection.duplicationsFound++;
      }
      
      return {
        ...result,
        fromCache: false,
        performanceData: { duration, cacheHit: false }
      };
      
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateDuplicationDetectionMetrics(duration, false);
      this.metrics.duplicationDetection.errorCount = (this.metrics.duplicationDetection.errorCount || 0) + 1;
      throw error;
    }
  }

  /**
   * Monitors duplication detection with caching (async version)
   * @param {string} path - Path to analyze
   * @param {Function} detectionFunction - Function to perform detection
   * @returns {Object} Detection result with performance data
   */
  async monitorDuplicationDetection(path, detectionFunction) {
    const startTime = process.hrtime.bigint();
    const cacheKey = this.generateCacheKey('duplication', path);
    
    // Check cache first
    if (this.config.enableCaching) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.metrics.duplicationDetection.cacheHits++;
        this.metrics.cache.hits++;
        
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
        this.updateDuplicationDetectionMetrics(duration, true);
        
        return {
          ...cachedResult,
          fromCache: true,
          performanceData: { duration, cacheHit: true }
        };
      }
    }
    
    // Perform detection
    let result;
    try {
      result = await detectionFunction(path);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // Cache the result
      if (this.config.enableCaching && result) {
        this.setCachedResult(cacheKey, result);
        this.metrics.duplicationDetection.cacheMisses++;
        this.metrics.cache.misses++;
      }
      
      // Update metrics
      this.updateDuplicationDetectionMetrics(duration, false);
      
      // Track duplications found
      if (result && result.hasDuplication) {
        this.metrics.duplicationDetection.duplicationsFound++;
      }
      
      return {
        ...result,
        fromCache: false,
        performanceData: { duration, cacheHit: false }
      };
      
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateDuplicationDetectionMetrics(duration, false);
      this.metrics.duplicationDetection.errorCount = (this.metrics.duplicationDetection.errorCount || 0) + 1;
      throw error;
    }
  }

  /**
   * Monitors path analysis operations (synchronous version)
   * @param {Array} files - Files to analyze
   * @param {string} destFolder - Destination folder
   * @param {Function} analysisFunction - Function to perform analysis
   * @returns {Object} Analysis result with performance data
   */
  monitorPathAnalysisSync(files, destFolder, analysisFunction) {
    const startTime = process.hrtime.bigint();
    const cacheKey = this.generateCacheKey('analysis', { files: files.length, destFolder });
    
    // Check cache for similar analysis patterns
    if (this.config.enableCaching) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
        this.updatePathAnalysisMetrics(duration, cachedResult);
        
        return {
          ...cachedResult,
          fromCache: true,
          performanceData: { duration, cacheHit: true }
        };
      }
    }
    
    // Perform analysis
    try {
      const result = analysisFunction(files, destFolder);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // Cache the result pattern
      if (this.config.enableCaching && result) {
        this.setCachedResult(cacheKey, result);
      }
      
      // Update metrics
      this.updatePathAnalysisMetrics(duration, result);
      
      return {
        ...result,
        fromCache: false,
        performanceData: { duration, cacheHit: false }
      };
      
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updatePathAnalysisMetrics(duration, null);
      throw error;
    }
  }

  /**
   * Monitors path analysis operations (async version)
   * @param {Array} files - Files to analyze
   * @param {string} destFolder - Destination folder
   * @param {Function} analysisFunction - Function to perform analysis
   * @returns {Object} Analysis result with performance data
   */
  async monitorPathAnalysis(files, destFolder, analysisFunction) {
    const startTime = process.hrtime.bigint();
    const cacheKey = this.generateCacheKey('analysis', { files: files.length, destFolder });
    
    // Check cache for similar analysis patterns
    if (this.config.enableCaching) {
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
        this.updatePathAnalysisMetrics(duration, cachedResult);
        
        return {
          ...cachedResult,
          fromCache: true,
          performanceData: { duration, cacheHit: true }
        };
      }
    }
    
    // Perform analysis
    try {
      const result = await analysisFunction(files, destFolder);
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // Cache the result pattern
      if (this.config.enableCaching && result) {
        this.setCachedResult(cacheKey, result);
      }
      
      // Update metrics
      this.updatePathAnalysisMetrics(duration, result);
      
      return {
        ...result,
        fromCache: false,
        performanceData: { duration, cacheHit: false }
      };
      
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updatePathAnalysisMetrics(duration, null);
      throw error;
    }
  }

  /**
   * Optimized string operations for path manipulation
   * @param {string} operation - Type of operation
   * @param {*} input - Input data
   * @returns {*} Optimized result
   */
  optimizedStringOperation(operation, input) {
    const startTime = process.hrtime.bigint();
    
    let result;
    try {
      result = this.stringOptimizer.performOperation(operation, input);
      
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateStringOperationMetrics(duration, operation);
      
      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
      this.updateStringOperationMetrics(duration, operation);
      throw error;
    }
  }

  /**
   * Adds a sample point to an active operation
   * @param {string} operationId - Operation identifier
   * @param {string} sampleName - Sample name
   * @param {Object} data - Sample data
   */
  addOperationSample(operationId, sampleName, data = {}) {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;
    
    const sampleTime = process.hrtime.bigint();
    const elapsed = Number(sampleTime - operation.startTime) / 1000000;
    
    operation.samples.push({
      name: sampleName,
      timestamp: sampleTime,
      elapsed,
      data: { ...data }
    });
  }

  /**
   * Updates path resolution metrics
   * @private
   */
  updatePathResolutionMetrics(duration, result, context) {
    const metrics = this.metrics.pathResolution;
    
    metrics.totalOperations++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.totalOperations;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    
    // Track recent times for percentile calculations
    metrics.recentTimes.push(duration);
    if (metrics.recentTimes.length > 1000) {
      metrics.recentTimes.shift();
    }
    
    // Calculate percentiles
    this.calculatePercentiles(metrics);
    
    // Track slow operations
    if (duration > this.config.performanceThresholds.pathResolution) {
      metrics.slowOperations++;
    }
    
    // Track errors
    if (result && result.error) {
      metrics.errorCount++;
    }
  }

  /**
   * Updates duplication detection metrics
   * @private
   */
  updateDuplicationDetectionMetrics(duration, cacheHit) {
    const metrics = this.metrics.duplicationDetection;
    
    metrics.totalOperations++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.totalOperations;
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    
    if (cacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }
  }

  /**
   * Updates path analysis metrics
   * @private
   */
  updatePathAnalysisMetrics(duration, result) {
    const metrics = this.metrics.pathAnalysis;
    
    metrics.totalOperations++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.totalOperations;
    
    if (result) {
      // Track strategy usage
      if (result.strategy && metrics.strategiesUsed[result.strategy] !== undefined) {
        metrics.strategiesUsed[result.strategy]++;
      }
      
      // Track upload types
      if (result.uploadType && metrics.uploadTypes[result.uploadType] !== undefined) {
        metrics.uploadTypes[result.uploadType]++;
      }
    }
  }

  /**
   * Updates string operation metrics
   * @private
   */
  updateStringOperationMetrics(duration, operation) {
    const metrics = this.metrics.stringOperations;
    
    metrics.totalOperations++;
    metrics.totalTime += duration;
    
    // Track specific operation types
    switch (operation) {
      case 'segmentSplit':
        metrics.segmentSplits++;
        break;
      case 'pathJoin':
        metrics.pathJoins++;
        break;
      case 'normalize':
        metrics.normalizations++;
        break;
    }
    
    // Track if operation was optimized
    if (duration < this.config.performanceThresholds.stringOperations) {
      metrics.optimizedOperations++;
    }
  }

  /**
   * Calculates percentiles for performance metrics
   * @private
   */
  calculatePercentiles(metrics) {
    if (metrics.recentTimes.length === 0) return;
    
    const sorted = [...metrics.recentTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    metrics.p95Time = sorted[p95Index] || 0;
    metrics.p99Time = sorted[p99Index] || 0;
  }

  /**
   * Checks performance thresholds and emits alerts
   * @private
   */
  checkPerformanceThresholds(operationType, duration, context) {
    if (!this.config.enableAlerts) return;
    
    const threshold = this.config.performanceThresholds[operationType];
    if (threshold && duration > threshold) {
      this.emit('performanceAlert', {
        type: operationType,
        duration,
        threshold,
        context,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Generates cache key for operations
   * @private
   */
  generateCacheKey(type, input) {
    if (typeof input === 'string') {
      return `${type}:${this.stringOptimizer.hashString(input)}`;
    }
    
    return `${type}:${this.stringOptimizer.hashString(JSON.stringify(input))}`;
  }

  /**
   * Gets cached result if available and not expired
   * @private
   */
  getCachedResult(cacheKey) {
    if (!this.cache.has(cacheKey)) return null;
    
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (timestamp && Date.now() - timestamp > this.config.cacheTTL) {
      // Expired
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      this.metrics.cache.evictions++;
      return null;
    }
    
    return this.cache.get(cacheKey);
  }

  /**
   * Sets cached result with timestamp
   * @private
   */
  setCachedResult(cacheKey, result) {
    // Check cache size limit
    if (this.cache.size >= this.config.cacheMaxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
      this.metrics.cache.evictions++;
    }
    
    this.cache.set(cacheKey, result);
    this.cacheTimestamps.set(cacheKey, Date.now());
    this.metrics.cache.size = this.cache.size;
  }

  /**
   * Adds operation to performance history
   * @private
   */
  addToPerformanceHistory(type, duration, operation) {
    this.performanceHistory.push({
      type,
      duration,
      timestamp: Date.now(),
      operationId: operation.id,
      samples: operation.samples,
      context: operation.context
    });
    
    // Keep only recent history (last 1000 operations)
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
  }

  /**
   * Sets up cache cleanup interval
   * @private
   */
  setupCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];
      
      for (const [key, timestamp] of this.cacheTimestamps.entries()) {
        if (now - timestamp > this.config.cacheTTL) {
          keysToDelete.push(key);
        }
      }
      
      for (const key of keysToDelete) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
        this.metrics.cache.evictions++;
      }
      
      this.metrics.cache.size = this.cache.size;
    }, this.config.cacheTTL / 4); // Clean up every quarter of TTL
  }

  /**
   * Sets up metrics calculation interval
   * @private
   */
  setupMetricsCalculation() {
    setInterval(() => {
      // Calculate cache hit rate
      const totalCacheOperations = this.metrics.cache.hits + this.metrics.cache.misses;
      this.metrics.cache.hitRate = totalCacheOperations > 0 
        ? Math.round((this.metrics.cache.hits / totalCacheOperations) * 100) / 100
        : 0;
      
      // Emit metrics update event
      this.emit('metricsUpdate', this.getMetrics());
    }, 30000); // Update every 30 seconds
  }

  /**
   * Gets current performance metrics
   * @returns {Object} Complete metrics object
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
      activeOperations: this.activeOperations.size,
      cacheSize: this.cache.size
    };
  }

  /**
   * Gets performance benchmarks
   * @returns {Object} Benchmark results
   */
  getBenchmarks() {
    return {
      pathResolution: {
        averageTime: this.metrics.pathResolution.averageTime,
        p95Time: this.metrics.pathResolution.p95Time,
        p99Time: this.metrics.pathResolution.p99Time,
        slowOperationRate: this.metrics.pathResolution.totalOperations > 0
          ? this.metrics.pathResolution.slowOperations / this.metrics.pathResolution.totalOperations
          : 0
      },
      duplicationDetection: {
        averageTime: this.metrics.duplicationDetection.averageTime,
        cacheHitRate: this.metrics.cache.hitRate,
        duplicationsFoundRate: this.metrics.duplicationDetection.totalOperations > 0
          ? this.metrics.duplicationDetection.duplicationsFound / this.metrics.duplicationDetection.totalOperations
          : 0
      },
      pathAnalysis: {
        averageTime: this.metrics.pathAnalysis.averageTime,
        strategyDistribution: this.metrics.pathAnalysis.strategiesUsed,
        uploadTypeDistribution: this.metrics.pathAnalysis.uploadTypes
      },
      stringOperations: {
        averageTime: this.metrics.stringOperations.totalTime / Math.max(1, this.metrics.stringOperations.totalOperations),
        optimizationRate: this.metrics.stringOperations.totalOperations > 0
          ? this.metrics.stringOperations.optimizedOperations / this.metrics.stringOperations.totalOperations
          : 0
      }
    };
  }

  /**
   * Resets all performance metrics
   */
  resetMetrics() {
    // Reset metrics but preserve configuration
    this.metrics = {
      pathResolution: {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        p95Time: 0,
        p99Time: 0,
        recentTimes: [],
        slowOperations: 0,
        errorCount: 0
      },
      duplicationDetection: {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        duplicationsFound: 0
      },
      pathAnalysis: {
        totalOperations: 0,
        totalTime: 0,
        averageTime: 0,
        strategiesUsed: {
          basename: 0,
          webkit_path: 0,
          smart_path: 0
        },
        uploadTypes: {
          individual: 0,
          folder: 0
        }
      },
      stringOperations: {
        totalOperations: 0,
        totalTime: 0,
        segmentSplits: 0,
        pathJoins: 0,
        normalizations: 0,
        optimizedOperations: 0
      },
      cache: {
        size: 0,
        hits: 0,
        misses: 0,
        evictions: 0,
        hitRate: 0
      }
    };
    
    // Clear cache
    this.cache.clear();
    this.cacheTimestamps.clear();
    
    // Clear performance history
    this.performanceHistory = [];
    
    this.emit('metricsReset');
  }

  /**
   * Gets performance history for analysis
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Performance history entries
   */
  getPerformanceHistory(limit = 100) {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Clears cache manually
   */
  clearCache() {
    const previousSize = this.cache.size;
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.metrics.cache.size = 0;
    this.metrics.cache.evictions += previousSize;
    
    this.emit('cacheCleared', { previousSize });
  }
}

/**
 * StringOptimizer - Optimized string operations for path manipulation
 */
class StringOptimizer {
  constructor() {
    // Pre-compiled regex patterns for better performance
    this.patterns = {
      pathSeparator: /[/\\]/g,
      multipleSlashes: /\/+/g,
      trailingSlash: /\/$/,
      leadingSlash: /^\//,
      windowsPath: /\\/g
    };
    
    // String operation cache for frequently used operations
    this.operationCache = new Map();
  }

  /**
   * Performs optimized string operations
   * @param {string} operation - Operation type
   * @param {*} input - Input data
   * @returns {*} Operation result
   */
  performOperation(operation, input) {
    switch (operation) {
      case 'segmentSplit':
        return this.optimizedSegmentSplit(input);
      case 'pathJoin':
        return this.optimizedPathJoin(input);
      case 'normalize':
        return this.optimizedNormalize(input);
      case 'hash':
        return this.hashString(input);
      default:
        throw new Error(`Unknown string operation: ${operation}`);
    }
  }

  /**
   * Optimized path segment splitting
   * @param {string} path - Path to split
   * @returns {Array} Path segments
   */
  optimizedSegmentSplit(path) {
    if (!path || typeof path !== 'string') return [];
    
    // Check cache first
    const cacheKey = `split:${path}`;
    if (this.operationCache.has(cacheKey)) {
      return this.operationCache.get(cacheKey);
    }
    
    // Use pre-compiled regex for better performance
    const segments = path.split(this.patterns.pathSeparator).filter(segment => segment.length > 0);
    
    // Cache result
    this.operationCache.set(cacheKey, segments);
    
    return segments;
  }

  /**
   * Optimized path joining
   * @param {Array|string} parts - Path parts to join
   * @returns {string} Joined path
   */
  optimizedPathJoin(parts) {
    if (!parts) return '';
    
    const pathArray = Array.isArray(parts) ? parts : [parts];
    if (pathArray.length === 0) return '';
    
    // Filter out empty parts and join with single separator
    const validParts = pathArray.filter(part => part && typeof part === 'string' && part.length > 0);
    
    if (validParts.length === 0) return '';
    if (validParts.length === 1) return validParts[0];
    
    // Join and normalize in one step
    let result = validParts.join('/');
    
    // Remove multiple consecutive slashes
    result = result.replace(this.patterns.multipleSlashes, '/');
    
    return result;
  }

  /**
   * Optimized path normalization
   * @param {string} path - Path to normalize
   * @returns {string} Normalized path
   */
  optimizedNormalize(path) {
    if (!path || typeof path !== 'string') return '';
    
    // Check cache first
    const cacheKey = `normalize:${path}`;
    if (this.operationCache.has(cacheKey)) {
      return this.operationCache.get(cacheKey);
    }
    
    // Normalize separators to forward slashes
    let normalized = path.replace(this.patterns.windowsPath, '/');
    
    // Remove multiple consecutive slashes
    normalized = normalized.replace(this.patterns.multipleSlashes, '/');
    
    // Remove trailing slash (except for root)
    if (normalized.length > 1) {
      normalized = normalized.replace(this.patterns.trailingSlash, '');
    }
    
    // Cache result
    this.operationCache.set(cacheKey, normalized);
    
    return normalized;
  }

  /**
   * Fast string hashing for cache keys
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  hashString(str) {
    if (!str) return '0';
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

module.exports = PerformanceMonitor;