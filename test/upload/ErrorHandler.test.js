const ErrorHandler = require('../../lib/upload/ErrorHandler');
const path = require('path');

describe('ErrorHandler', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };

    errorHandler = new ErrorHandler({
      logger: mockLogger,
      enableDetailedLogging: true,
      maxRetries: 2,
      retryDelay: 100,
      fallbackDirectory: 'test_uploads'
    });
  });

  afterEach(() => {
    errorHandler.resetErrorStatistics();
  });

  describe('handlePathConstructionError', () => {
    it('should handle path construction errors with appropriate fallback', () => {
      const error = new Error('Path construction failed');
      const context = {
        file: { originalname: 'test.txt' },
        destFolder: 'documents'
      };

      const result = errorHandler.handlePathConstructionError(error, context);

      expect(result.success).toBe(true);
      expect(result.fallbackPath).toContain('documents');
      expect(result.fallbackPath).toContain('test.txt');
      expect(result.strategy).toBe('basename_fallback');
      expect(result.warnings).toContain('Path construction failed, using basename fallback');
    });

    it('should handle security violations with secure fallback', () => {
      const error = new Error('Security violation in webkitRelativePath');
      const context = {
        file: { originalname: '../../../etc/passwd' },
        destFolder: 'documents'
      };

      const result = errorHandler.handlePathConstructionError(error, context);

      expect(result.success).toBe(true);
      expect(result.fallbackPath).toContain('test_uploads'); // Uses fallback directory
      expect(result.warnings).toContain('Security violation detected, using secure fallback');
    });

    it('should handle duplication errors with timestamp fallback', () => {
      const error = new Error('Path duplication detected');
      const context = {
        file: { originalname: 'report.pdf' },
        destFolder: 'documents'
      };

      const result = errorHandler.handlePathConstructionError(error, context);

      expect(result.success).toBe(true);
      expect(result.fallbackPath).toContain('documents');
      expect(result.fallbackPath).toContain('report');
      expect(result.strategy).toBe('duplication_recovery');
      expect(result.warnings).toContain('Path duplication detected, added timestamp to filename');
    });

    it('should update error statistics correctly', () => {
      const error = new Error('Test error');
      const context = { file: { originalname: 'test.txt' }, destFolder: 'docs' };

      errorHandler.handlePathConstructionError(error, context);

      const stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorsByCategory).toHaveProperty('path_construction');
    });
  });

  describe('handleFilesystemOperation', () => {
    it('should retry failed operations and succeed on retry', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('ENOENT: no such file or directory');
        }
        return 'success';
      });

      const result = await errorHandler.handleFilesystemOperation(operation, {
        operation: 'mkdir'
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(result.recovered).toBe(true);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));

      const result = await errorHandler.handleFilesystemOperation(operation, {
        operation: 'writeFile'
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(result.recovered).toBe(false);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should use exponential backoff for retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Retry test'));
      const startTime = Date.now();

      await errorHandler.handleFilesystemOperation(operation, {
        operation: 'test'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should have waited at least 100ms + 200ms for exponential backoff
      expect(duration).toBeGreaterThan(250);
    });
  });

  describe('createSafeFallbackPath', () => {
    it('should create safe fallback path with timestamp and random ID', () => {
      const context = {
        file: { originalname: 'document.pdf' },
        destFolder: 'uploads'
      };

      const result = errorHandler.createSafeFallbackPath(context);

      expect(result.success).toBe(true);
      expect(result.path).toContain('uploads');
      expect(result.path).toContain('document');
      expect(result.path).toContain('.pdf');
      expect(result.strategy).toBe('safe_fallback');
    });

    it('should handle missing file information gracefully', () => {
      const context = { destFolder: 'uploads' };

      const result = errorHandler.createSafeFallbackPath(context);

      expect(result.success).toBe(true);
      expect(result.path).toContain('uploads');
      expect(result.path).toContain('unknown_file');
    });

    it('should sanitize dangerous filenames', () => {
      const context = {
        file: { originalname: '<script>alert("xss")</script>.txt' },
        destFolder: 'uploads'
      };

      const result = errorHandler.createSafeFallbackPath(context);

      expect(result.success).toBe(true);
      expect(result.path).not.toContain('<');
      expect(result.path).not.toContain('>');
      expect(result.path).not.toContain('script');
    });
  });

  describe('validateRecoveryPath', () => {
    it('should validate safe recovery paths', () => {
      const result = errorHandler.validateRecoveryPath('documents/file.txt');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedPath).toBe('documents/file.txt');
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject paths with directory traversal', () => {
      const result = errorHandler.validateRecoveryPath('../../../etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('directory traversal');
    });

    it('should reject absolute paths', () => {
      const result = errorHandler.validateRecoveryPath('/etc/passwd');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('absolute paths not allowed');
    });

    it('should reject paths that are too long', () => {
      const longPath = 'a'.repeat(300);
      const result = errorHandler.validateRecoveryPath(longPath);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('path too long');
    });

    it('should reject paths with forbidden characters', () => {
      const result = errorHandler.validateRecoveryPath('file<>:|?.txt');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('forbidden characters');
    });
  });

  describe('error categorization', () => {
    it('should categorize filesystem errors correctly', () => {
      const enoentError = new Error('ENOENT: no such file or directory');
      const result = errorHandler.handlePathConstructionError(enoentError, {});

      expect(result.errorInfo.category).toBe('filesystem');
      expect(result.errorInfo.severity).toBe('medium');
    });

    it('should categorize permission errors as high severity', () => {
      const epermError = new Error('EPERM: operation not permitted');
      const result = errorHandler.handlePathConstructionError(epermError, {});

      expect(result.errorInfo.category).toBe('filesystem');
      expect(result.errorInfo.severity).toBe('high');
    });

    it('should categorize security errors correctly', () => {
      const securityError = new Error('Security violation: directory traversal detected');
      const result = errorHandler.handlePathConstructionError(securityError, {});

      expect(result.errorInfo.category).toBe('security');
      expect(result.errorInfo.severity).toBe('high');
    });

    it('should categorize duplication errors as low severity', () => {
      const duplicationError = new Error('Path duplication detected');
      const result = errorHandler.handlePathConstructionError(duplicationError, {});

      expect(result.errorInfo.category).toBe('duplication');
      expect(result.errorInfo.severity).toBe('low');
    });
  });

  describe('error statistics', () => {
    it('should track error statistics correctly', () => {
      // Generate various types of errors
      errorHandler.handlePathConstructionError(new Error('ENOENT'), {});
      errorHandler.handlePathConstructionError(new Error('Security violation'), {});
      errorHandler.handlePathConstructionError(new Error('Path duplication'), {});

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory.filesystem).toBe(1);
      expect(stats.errorsByCategory.security).toBe(1);
      expect(stats.errorsByCategory.duplication).toBe(1);
    });

    it('should calculate error distribution percentages', () => {
      // Generate errors with known distribution
      errorHandler.handlePathConstructionError(new Error('ENOENT'), {});
      errorHandler.handlePathConstructionError(new Error('ENOENT'), {});
      errorHandler.handlePathConstructionError(new Error('Security violation'), {});
      errorHandler.handlePathConstructionError(new Error('Security violation'), {});

      const stats = errorHandler.getErrorStatistics();

      expect(stats.errorDistribution.byCategory.filesystem).toBe(50);
      expect(stats.errorDistribution.byCategory.security).toBe(50);
    });

    it('should reset statistics correctly', () => {
      errorHandler.handlePathConstructionError(new Error('Test'), {});
      
      let stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(1);

      errorHandler.resetErrorStatistics();
      
      stats = errorHandler.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
    });
  });

  describe('logging behavior', () => {
    it('should log errors at appropriate levels', () => {
      const criticalError = new Error('EMFILE: too many open files');
      errorHandler.handlePathConstructionError(criticalError, {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL ERROR]'),
        expect.any(Object)
      );
    });

    it('should log retry attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      await errorHandler.handleFilesystemOperation(operation, {
        operation: 'test'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[RETRY]'),
        expect.any(Object)
      );
    });

    it('should log successful recoveries', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce('success');

      await errorHandler.handleFilesystemOperation(operation, {
        operation: 'test'
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[RECOVERY]'),
        expect.any(Object)
      );
    });

    it('should log fallback usage', () => {
      const error = new Error('Test error');
      errorHandler.handlePathConstructionError(error, {});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[FALLBACK]'),
        expect.any(Object)
      );
    });
  });
});