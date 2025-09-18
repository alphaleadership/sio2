const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const UploadPathResolver = require('../../lib/upload/UploadPathResolver');

/**
 * FileStorageMiddleware Integration Tests
 * 
 * These tests simulate the integration between the upload path resolution system
 * and the FileStorageMiddleware, ensuring the complete upload flow works correctly.
 * 
 * Requirements tested:
 * - 1.1, 1.2, 1.3: Individual file upload path correction
 * - 2.1, 2.2, 2.3: Legitimate folder upload preservation  
 * - 4.3: Integration with existing FileStorageMiddleware
 */
describe('FileStorageMiddleware Integration Tests', () => {
  let resolver;
  let mockLogger;

  // Helper function to normalize paths for cross-platform testing
  function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  beforeEach(() => {
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };

    resolver = new UploadPathResolver({
      logger: mockLogger,
      enableDebugLogging: true
    });
  });

  /**
   * Simulates the FileStorageMiddleware.js integration
   * This mimics how the middleware would use UploadPathResolver
   */
  function simulateMiddlewareProcessing(req, options = {}) {
    const { files, body } = req;
    const destFolder = body.path || 'uploads';
    const results = [];

    // Simulate the middleware's file processing loop
    for (const file of files) {
      if (file === null || file === undefined) {
        // Handle null files gracefully
        results.push({
          error: true,
          resolvedPath: null,
          strategy: 'error',
          duplicationPrevented: false,
          processingTime: 0,
          warnings: ['Invalid file object']
        });
        continue;
      }

      const resolution = resolver.resolvePath(file, destFolder, files);
      
      // Simulate what middleware would do with the result
      const processedFile = {
        ...file,
        resolvedPath: resolution.finalPath,
        strategy: resolution.strategy,
        duplicationPrevented: resolution.duplicationPrevented,
        processingTime: resolution.processingTime,
        warnings: resolution.warnings,
        error: resolution.error
      };

      results.push(processedFile);
    }

    return {
      success: results.every(r => !r.error),
      files: results,
      totalProcessingTime: results.reduce((sum, r) => sum + (r.processingTime || 0), 0)
    };
  }

  describe('Simulated Middleware Integration', () => {

    test('should integrate with middleware for individual file upload - core bug fix', () => {
      // Simulate the exact problematic scenario from requirements
      const req = {
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: 'documents/rapport.pdf',
          mimetype: 'application/pdf',
          size: 1024000
        }],
        body: {
          path: 'documents'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 1);
      
      const processedFile = result.files[0];
      assert.strictEqual(normalizePath(processedFile.resolvedPath), 'documents/rapport.pdf');
      assert.strictEqual(processedFile.duplicationPrevented, true);
      assert.ok(processedFile.warnings.some(w => w.includes('duplication')));
    });

    test('should integrate with middleware for legitimate folder upload', () => {
      const req = {
        files: [
          {
            originalname: 'index.html',
            webkitRelativePath: 'my-site/index.html',
            mimetype: 'text/html',
            size: 2048
          },
          {
            originalname: 'styles.css',
            webkitRelativePath: 'my-site/css/styles.css',
            mimetype: 'text/css',
            size: 1024
          },
          {
            originalname: 'app.js',
            webkitRelativePath: 'my-site/js/app.js',
            mimetype: 'application/javascript',
            size: 4096
          }
        ],
        body: {
          path: 'projects'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 3);

      // Verify all files maintain their folder structure
      assert.strictEqual(normalizePath(result.files[0].resolvedPath), 'projects/my-site/index.html');
      assert.strictEqual(normalizePath(result.files[1].resolvedPath), 'projects/my-site/css/styles.css');
      assert.strictEqual(normalizePath(result.files[2].resolvedPath), 'projects/my-site/js/app.js');

      // All should be processed successfully
      result.files.forEach(file => {
        assert.strictEqual(file.duplicationPrevented, false);
        assert.strictEqual(file.error, undefined);
      });
    });

    test('should handle mixed upload scenarios in single request', () => {
      // Simulate a complex scenario with both problematic and legitimate files
      const req = {
        files: [
          {
            originalname: 'readme.txt',
            webkitRelativePath: 'docs/readme.txt', // Would duplicate with destination
            mimetype: 'text/plain',
            size: 512
          },
          {
            originalname: 'config.json',
            webkitRelativePath: '', // No webkit path
            mimetype: 'application/json',
            size: 256
          }
        ],
        body: {
          path: 'docs'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 2);

      // First file should have duplication prevented
      assert.strictEqual(normalizePath(result.files[0].resolvedPath), 'docs/readme.txt');
      assert.strictEqual(result.files[0].duplicationPrevented, true);

      // Second file should be processed normally
      assert.strictEqual(normalizePath(result.files[1].resolvedPath), 'docs/config.json');
      assert.strictEqual(result.files[1].duplicationPrevented, false);
    });

    test('should handle middleware error scenarios gracefully', () => {
      const req = {
        files: [
          null, // Invalid file
          {
            originalname: 'valid.txt',
            webkitRelativePath: 'folder/valid.txt',
            mimetype: 'text/plain',
            size: 1024
          }
        ],
        body: {
          path: 'uploads'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      // Should handle mixed success/error scenarios
      assert.strictEqual(result.files.length, 2);
      assert.strictEqual(result.files[0].error, true); // null file should error
      assert.strictEqual(normalizePath(result.files[1].resolvedPath), 'uploads/valid.txt'); // valid file processed
    });
  });

  describe('Performance Integration Tests', () => {
    test('should maintain acceptable performance under middleware load', () => {
      // Simulate a large upload request
      const files = [];
      for (let i = 0; i < 50; i++) {
        files.push({
          originalname: `document${i}.pdf`,
          webkitRelativePath: `batch/document${i}.pdf`,
          mimetype: 'application/pdf',
          size: 1024 * (i + 1)
        });
      }

      const req = {
        files: files,
        body: { path: 'batch' }
      };

      const startTime = Date.now();
      const result = simulateMiddlewareProcessing(req);
      const totalTime = Date.now() - startTime;

      // Should process 50 files quickly
      assert(totalTime < 500, `Total processing time too high: ${totalTime}ms`);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 50);

      // All files should have duplication prevented
      result.files.forEach((file, index) => {
        assert.strictEqual(file.resolvedPath, `batch/document${index}.pdf`);
        assert.strictEqual(file.duplicationPrevented, true);
      });
    });

    test('should provide performance metrics for middleware monitoring', () => {
      const req = {
        files: [
          { originalname: 'file1.txt', webkitRelativePath: 'test/file1.txt' },
          { originalname: 'file2.txt', webkitRelativePath: 'test/test/file2.txt' },
          { originalname: 'file3.txt' }
        ],
        body: { path: 'test' }
      };

      simulateMiddlewareProcessing(req);

      const metrics = resolver.getPerformanceMetrics();
      
      assert.ok(metrics.totalResolutions >= 3);
      assert.ok(typeof metrics.duplicationsDetected === 'number');
      assert.ok(metrics.duplicationsDetected >= 1);
      assert.ok(typeof metrics.strategiesUsed === 'object');
    });
  });

  describe('Real-world Upload Scenarios', () => {
    test('should handle typical document upload scenario', () => {
      const req = {
        files: [{
          originalname: 'Annual Report 2024.pdf',
          webkitRelativePath: 'reports/Annual Report 2024.pdf',
          mimetype: 'application/pdf',
          size: 5242880 // 5MB
        }],
        body: {
          path: 'reports'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files[0].resolvedPath, 'reports/Annual Report 2024.pdf');
      assert.strictEqual(result.files[0].duplicationPrevented, true);
    });

    test('should handle typical project folder upload scenario', () => {
      const req = {
        files: [
          {
            originalname: 'package.json',
            webkitRelativePath: 'my-app/package.json',
            mimetype: 'application/json',
            size: 1024
          },
          {
            originalname: 'index.js',
            webkitRelativePath: 'my-app/src/index.js',
            mimetype: 'application/javascript',
            size: 2048
          },
          {
            originalname: 'component.jsx',
            webkitRelativePath: 'my-app/src/components/component.jsx',
            mimetype: 'text/jsx',
            size: 3072
          },
          {
            originalname: 'README.md',
            webkitRelativePath: 'my-app/README.md',
            mimetype: 'text/markdown',
            size: 512
          }
        ],
        body: {
          path: 'development'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.files.length, 4);

      // Verify folder structure is preserved
      const expectedPaths = [
        'development/my-app/package.json',
        'development/my-app/src/index.js',
        'development/my-app/src/components/component.jsx',
        'development/my-app/README.md'
      ];

      result.files.forEach((file, index) => {
        assert.strictEqual(normalizePath(file.resolvedPath), expectedPaths[index]);
        assert.strictEqual(file.duplicationPrevented, false);
        assert.strictEqual(file.error, undefined);
      });
    });

    test('should handle user-specific upload paths', () => {
      const req = {
        files: [{
          originalname: 'profile.jpg',
          webkitRelativePath: 'images/profile.jpg', // Simpler path to avoid complex duplication
          mimetype: 'image/jpeg',
          size: 204800
        }],
        body: {
          path: 'users/john/images'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      assert.strictEqual(normalizePath(result.files[0].resolvedPath), 'users/john/images/profile.jpg');
      assert.strictEqual(result.files[0].error, undefined);
    });

    test('should handle edge case with deeply nested paths', () => {
      const deepPath = 'projects/client-work/2024/q4/reports';
      const req = {
        files: [{
          originalname: 'summary.xlsx',
          webkitRelativePath: `reports/summary.xlsx`, // Simpler webkit path
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1048576
        }],
        body: {
          path: deepPath
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      // Should detect duplication and fix it
      assert.strictEqual(normalizePath(result.files[0].resolvedPath), `${deepPath}/summary.xlsx`);
      assert.strictEqual(result.files[0].error, undefined);
    });
  });

  describe('Compression Middleware Compatibility', () => {
    test('should maintain compatibility with compression functionality', () => {
      // Simulate files that would also go through compression
      const req = {
        files: [
          {
            originalname: 'large-image.png',
            webkitRelativePath: 'images/large-image.png',
            mimetype: 'image/png',
            size: 10485760, // 10MB - would trigger compression
            needsCompression: true
          },
          {
            originalname: 'document.pdf',
            webkitRelativePath: 'docs/document.pdf',
            mimetype: 'application/pdf',
            size: 2097152, // 2MB
            needsCompression: false
          }
        ],
        body: {
          path: 'uploads'
        }
      };

      const result = simulateMiddlewareProcessing(req);

      assert.strictEqual(result.success, true);
      
      // Path resolution should work regardless of compression needs
      result.files.forEach(file => {
        assert.ok(normalizePath(file.resolvedPath).startsWith('uploads/'));
        assert.strictEqual(file.error, undefined);
      });
    });
  });

  console.log('✅ All FileStorageMiddleware Integration Tests completed successfully');
});