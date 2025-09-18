const UploadPathResolver = require('../../lib/upload/UploadPathResolver');
const ErrorHandler = require('../../lib/upload/ErrorHandler');
const DuplicationDetector = require('../../lib/upload/DuplicationDetector');
const PathAnalysisEngine = require('../../lib/upload/PathAnalysisEngine');
const PathConstructionStrategy = require('../../lib/upload/PathConstructionStrategy');

describe('UploadPathResolver Error Handling Integration', () => {
  let resolver;
  let mockLogger;
  let mockErrorHandler;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };

    mockErrorHandler = new ErrorHandler({
      logger: mockLogger,
      enableDetailedLogging: true,
      maxRetries: 2,
      retryDelay: 50,
      fallbackDirectory: 'error_recovery'
    });

    resolver = new UploadPathResolver({
      logger: mockLogger,
      enableDebugLogging: true,
      errorHandler: mockErrorHandler
    });
  });

  afterEach(() => {
    resolver.resetErrorStatistics();
  });

  describe('input validation errors', () => {
    it('should handle missing file object gracefully', () => {
      const result = resolver.resolvePath(null, 'documents');

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.strategy).toBe('safe_fallback');
      expect(result.warnings).toContain('Using generated fallback path due to errors');
      expect(result.errorInfo.category).toBe('validation');
    });

    it('should handle missing originalname gracefully', () => {
      const file = { webkitRelativePath: 'docs/file.txt' };
      const result = resolver.resolvePath(file, 'documents');

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.errorInfo.category).toBe('validation');
    });

    it('should handle invalid destination folder', () => {
      const file = { originalname: 'test.txt' };
      const result = resolver.resolvePath(file, null);

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.errorInfo.category).toBe('validation');
    });

    it('should handle directory traversal in destination folder', () => {
      const file = { originalname: 'test.txt' };
      const result = resolver.resolvePath(file, '../../../etc');

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.errorInfo.category).toBe('validation');
    });
  });

  describe('path construction errors', () => {
    it('should handle path construction strategy failures with fallback', () => {
      // Mock PathConstructionStrategy to throw errors
      const mockStrategy = {
        constructBasename: jest.fn().mockImplementation(() => {
          throw new Error('Basename construction failed');
        }),
        constructWebkitPath: jest.fn().mockImplementation(() => {
          throw new Error('Webkit construction failed');
        }),
        constructSmartPath: jest.fn().mockImplementation(() => {
          throw new Error('Smart construction failed');
        })
      };

      const resolverWithMockStrategy = new UploadPathResolver({
        pathConstructionStrategy: mockStrategy,
        errorHandler: mockErrorHandler,
        logger: mockLogger
      });

      const file = { originalname: 'test.txt' };
      const result = resolverWithMockStrategy.resolvePath(file, 'documents');

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.strategy).toBe('safe_fallback');
    });

    it('should try fallback strategies when primary strategy fails', () => {
      // Mock strategy that fails on webkit but succeeds on basename
      const mockStrategy = {
        constructBasename: jest.fn().mockReturnValue('documents/test.txt'),
        constructWebkitPath: jest.fn().mockImplementation(() => {
          throw new Error('Webkit failed');
        }),
        constructSmartPath: jest.fn().mockImplementation(() => {
          throw new Error('Smart failed');
        })
      };

      const resolverWithMockStrategy = new UploadPathResolver({
        pathConstructionStrategy: mockStrategy,
        errorHandler: mockErrorHandler,
        logger: mockLogger
      });

      const file = { 
        originalname: 'test.txt',
        webkitRelativePath: 'folder/test.txt'
      };
      const result = resolverWithMockStrategy.resolvePath(file, 'documents', [file]);

      // Should succeed with basename fallback
      expect(result.error).toBeFalsy();
      expect(result.finalPath).toBe('documents/test.txt');
      expect(mockStrategy.constructBasename).toHaveBeenCalled();
    });
  });

  describe('duplication detection errors', () => {
    it('should handle duplication detector failures gracefully', () => {
      // Mock DuplicationDetector to throw errors
      const mockDetector = {
        analyzePathDuplication: jest.fn().mockImplementation(() => {
          throw new Error('Duplication analysis failed');
        })
      };

      const resolverWithMockDetector = new UploadPathResolver({
        duplicationDetector: mockDetector,
        errorHandler: mockErrorHandler,
        logger: mockLogger
      });

      const file = { originalname: 'test.txt' };
      const result = resolverWithMockDetector.resolvePath(file, 'documents');

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.errorInfo.category).toBe('path_construction');
    });
  });

  describe('analysis engine errors', () => {
    it('should handle analysis engine failures gracefully', () => {
      // Mock PathAnalysisEngine to throw errors
      const mockEngine = {
        analyzeUploadContext: jest.fn().mockImplementation(() => {
          throw new Error('Analysis failed');
        })
      };

      const resolverWithMockEngine = new UploadPathResolver({
        pathAnalysisEngine: mockEngine,
        errorHandler: mockErrorHandler,
        logger: mockLogger
      });

      const file = { originalname: 'test.txt' };
      const result = resolverWithMockEngine.resolvePath(file, 'documents');

      expect(result.error).toBe(true);
      expect(result.finalPath).toContain('error_recovery');
      expect(result.errorInfo.category).toBe('path_construction');
    });
  });

  describe('batch processing errors', () => {
    it('should handle individual file errors in batch processing', () => {
      const files = [
        { originalname: 'good.txt' },
        null, // This will cause an error
        { originalname: 'also_good.txt' }
      ];

      const results = resolver.resolvePathsBatch(files, 'documents');

      expect(results).toHaveLength(3);
      expect(results[0].error).toBeFalsy();
      expect(results[1].error).toBe(true);
      expect(results[2].error).toBeFalsy();
    });

    it('should handle non-array input to batch processing', () => {
      expect(() => {
        resolver.resolvePathsBatch('not an array', 'documents');
      }).toThrow('Files must be an array');
    });

    it('should provide batch statistics including error counts', () => {
      const files = [
        { originalname: 'file1.txt' },
        null, // Error
        { originalname: 'file2.txt' }
      ];

      const results = resolver.resolvePathsBatch(files, 'documents');
      
      // Check that debug logging includes error counts
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Batch path resolution completed',
        expect.objectContaining({
          fileCount: 3,
          successCount: 2,
          errorCount: 1
        })
      );
    });
  });

  describe('filesystem operation error handling', () => {
    it('should provide filesystem operation retry functionality', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('ENOENT: file not found');
        }
        return 'success';
      });

      const result = await resolver.performFilesystemOperation(operation, {
        operation: 'mkdir'
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.recovered).toBe(true);
    });
  });

  describe('error statistics and monitoring', () => {
    it('should track error statistics across multiple operations', () => {
      // Generate various errors
      resolver.resolvePath(null, 'documents'); // Validation error
      resolver.resolvePath({ originalname: 'test.txt' }, null); // Another validation error
      
      const stats = resolver.getErrorStatistics();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByCategory.validation).toBe(2);
    });

    it('should reset error statistics correctly', () => {
      resolver.resolvePath(null, 'documents');
      
      let stats = resolver.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      
      resolver.resetErrorStatistics();
      
      stats = resolver.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
    });

    it('should provide error distribution percentages', () => {
      // Generate errors with known distribution
      resolver.resolvePath(null, 'documents'); // Validation
      resolver.resolvePath(null, 'documents'); // Validation
      
      // Mock a security error by using the error handler directly
      mockErrorHandler.handlePathConstructionError(
        new Error('Security violation'), 
        { file: { originalname: 'test.txt' }, destFolder: 'docs' }
      );
      
      const stats = resolver.getErrorStatistics();
      
      expect(stats.errorDistribution.byCategory.validation).toBeGreaterThan(0);
      expect(stats.errorDistribution.byCategory.security).toBeGreaterThan(0);
    });
  });

  describe('recovery path validation', () => {
    it('should validate recovery paths for safety', () => {
      const validPath = 'documents/recovered/file.txt';
      const result = resolver.validateRecoveryPath(validPath);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPath).toBe(validPath);
    });

    it('should reject dangerous recovery paths', () => {
      const dangerousPath = '../../../etc/passwd';
      const result = resolver.validateRecoveryPath(dangerousPath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('directory traversal');
    });
  });

  describe('safe fallback path creation', () => {
    it('should create safe fallback paths when needed', () => {
      const context = {
        file: { originalname: 'document.pdf' },
        destFolder: 'uploads'
      };
      
      const result = resolver.createSafeFallbackPath(context);
      
      expect(result.success).toBe(true);
      expect(result.path).toContain('uploads');
      expect(result.path).toContain('document');
      expect(result.strategy).toBe('safe_fallback');
    });
  });

  describe('error logging and debugging', () => {
    it('should log detailed error information when debug logging is enabled', () => {
      resolver.resolvePath(null, 'documents');
      
      // Should have logged the error with detailed information
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        expect.objectContaining({
          category: expect.any(String),
          severity: expect.any(String)
        })
      );
    });

    it('should log fallback strategy usage', () => {
      resolver.resolvePath(null, 'documents');
      
      // Should have logged fallback usage
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('FALLBACK'),
        expect.any(Object)
      );
    });
  });

  describe('performance impact of error handling', () => {
    it('should not significantly impact performance for successful operations', () => {
      const file = { originalname: 'test.txt' };
      const startTime = Date.now();
      
      const result = resolver.resolvePath(file, 'documents');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(result.error).toBeFalsy();
      expect(duration).toBeLessThan(100); // Should be fast for successful operations
    });

    it('should track processing time even for error cases', () => {
      const result = resolver.resolvePath(null, 'documents');
      
      expect(result.processingTime).toBeGreaterThan(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });
});