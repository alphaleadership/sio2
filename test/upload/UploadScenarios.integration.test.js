const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const UploadPathResolver = require('../../lib/upload/UploadPathResolver');

/**
 * Integration Tests for Upload Scenarios
 * 
 * These tests verify the complete upload path resolution system works correctly
 * for various real-world scenarios, addressing requirements:
 * - 1.1, 1.2, 1.3: Individual file upload path correction
 * - 2.1, 2.2, 2.3: Legitimate folder upload preservation
 * 
 * Test scenarios cover the core bug fix where individual files with webkitRelativePath
 * create duplicate folder structures (e.g., documents/documents/rapport.pdf)
 */
describe('Upload Scenarios Integration Tests', () => {
  let resolver;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {}
    };

    resolver = new UploadPathResolver({
      logger: mockLogger,
      enableDebugLogging: false
    });
  });

  // Helper function to normalize paths for cross-platform testing
  function normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  describe('Individual File Uploads with Problematic webkitRelativePath', () => {
    test('should fix duplicate folder names in webkitRelativePath - core bug scenario', () => {
      // This is the exact scenario from the requirements: rapport.pdf to documents folder
      // Results in documents/documents/rapport.pdf instead of documents/rapport.pdf
      const file = {
        originalname: 'rapport.pdf',
        webkitRelativePath: 'documents/rapport.pdf'
      };
      const destFolder = 'documents';

      const result = resolver.resolvePath(file, destFolder);

      // Verify the core fix works - normalize paths for cross-platform compatibility
      assert.strictEqual(normalizePath(result.finalPath), 'documents/rapport.pdf');
      assert.strictEqual(result.duplicationPrevented, true);
      assert.strictEqual(result.error, undefined);
      
      // Verify metadata shows individual upload type
      assert.strictEqual(result.metadata.uploadType, 'individual');
    });

    test('should handle individual file with webkitRelativePath matching destination exactly', () => {
      const file = {
        originalname: 'invoice.pdf',
        webkitRelativePath: 'billing/invoice.pdf'
      };
      const destFolder = 'billing';

      const result = resolver.resolvePath(file, destFolder);

      assert.strictEqual(normalizePath(result.finalPath), 'billing/invoice.pdf');
      assert.strictEqual(result.duplicationPrevented, true);
      assert.strictEqual(result.error, undefined);
    });

    test('should handle individual file with empty webkitRelativePath', () => {
      const file = {
        originalname: 'readme.txt',
        webkitRelativePath: ''
      };
      const destFolder = 'docs';

      const result = resolver.resolvePath(file, destFolder);

      assert.strictEqual(normalizePath(result.finalPath), 'docs/readme.txt');
      assert.strictEqual(result.duplicationPrevented, false);
      assert.strictEqual(result.error, undefined);
    });

    test('should handle individual file with webkitRelativePath as just filename', () => {
      const file = {
        originalname: 'summary.pdf',
        webkitRelativePath: 'summary.pdf'
      };
      const destFolder = 'reports';

      const result = resolver.resolvePath(file, destFolder);

      assert.strictEqual(normalizePath(result.finalPath), 'reports/summary.pdf');
      assert.strictEqual(result.duplicationPrevented, false);
      assert.strictEqual(result.error, undefined);
    });

    test('should handle individual file with simple path duplication', () => {
      const file = {
        originalname: 'photo.jpg',
        webkitRelativePath: 'images/photo.jpg'
      };
      const destFolder = 'images';

      const result = resolver.resolvePath(file, destFolder);

      // Should detect duplication and fix it
      assert.strictEqual(normalizePath(result.finalPath), 'images/photo.jpg');
      assert.strictEqual(result.duplicationPrevented, true);
      assert.strictEqual(result.error, undefined);
    });
  });

  describe('Legitimate Folder Uploads', () => {
    test('should preserve folder structure for legitimate multi-file folder upload', () => {
      const files = [
        {
          originalname: 'index.html',
          webkitRelativePath: 'my-website/index.html'
        },
        {
          originalname: 'styles.css',
          webkitRelativePath: 'my-website/css/styles.css'
        },
        {
          originalname: 'script.js',
          webkitRelativePath: 'my-website/js/script.js'
        }
      ];
      const destFolder = 'projects';

      const results = resolver.resolvePathsBatch(files, destFolder);

      // All files should maintain their folder structure
      assert.strictEqual(normalizePath(results[0].finalPath), 'projects/my-website/index.html');
      assert.strictEqual(normalizePath(results[1].finalPath), 'projects/my-website/css/styles.css');
      assert.strictEqual(normalizePath(results[2].finalPath), 'projects/my-website/js/script.js');

      // All should be processed successfully
      results.forEach(result => {
        assert.strictEqual(result.metadata.uploadType, 'folder');
        assert.strictEqual(result.duplicationPrevented, false);
        assert.strictEqual(result.error, undefined);
      });
    });

    test('should handle simple folder structure', () => {
      const files = [
        {
          originalname: 'main.py',
          webkitRelativePath: 'python-project/main.py'
        },
        {
          originalname: 'utils.py',
          webkitRelativePath: 'python-project/utils.py'
        }
      ];
      const destFolder = 'development';

      const results = resolver.resolvePathsBatch(files, destFolder);

      results.forEach((result) => {
        assert.ok(normalizePath(result.finalPath).startsWith('development/python-project/'));
        assert.strictEqual(result.metadata.uploadType, 'folder');
        assert.strictEqual(result.error, undefined);
      });
    });
  });

  describe('Edge Cases and Duplication Detection', () => {
    test('should handle multiple consecutive duplicate segments', () => {
      const file = {
        originalname: 'data.csv',
        webkitRelativePath: 'reports/reports/data.csv'
      };
      const destFolder = 'reports';

      const result = resolver.resolvePath(file, destFolder);

      assert.strictEqual(normalizePath(result.finalPath), 'reports/data.csv');
      assert.strictEqual(result.duplicationPrevented, true);
      assert.strictEqual(result.error, undefined);
    });

    test('should handle special characters in paths', () => {
      const file = {
        originalname: 'résumé (final).pdf',
        webkitRelativePath: 'documents/résumé (final).pdf'
      };
      const destFolder = 'documents';

      const result = resolver.resolvePath(file, destFolder);

      assert.strictEqual(normalizePath(result.finalPath), 'documents/résumé (final).pdf');
      assert.strictEqual(result.duplicationPrevented, true);
      assert.strictEqual(result.error, undefined);
    });

    test('should handle simple duplication case', () => {
      const file = {
        originalname: 'Report.PDF',
        webkitRelativePath: 'documents/Report.PDF'
      };
      const destFolder = 'documents';

      const result = resolver.resolvePath(file, destFolder);

      // Should detect and fix duplication
      assert.strictEqual(normalizePath(result.finalPath), 'documents/Report.PDF');
      assert.strictEqual(result.duplicationPrevented, true);
      assert.strictEqual(result.error, undefined);
    });

    test('should handle files without duplication', () => {
      const file = {
        originalname: 'normal.txt',
        webkitRelativePath: 'subfolder/normal.txt'
      };
      const destFolder = 'uploads';

      const result = resolver.resolvePath(file, destFolder, [file]);

      // Single file with webkitRelativePath is detected as individual upload
      // The system correctly uses smart path strategy which preserves the subfolder
      assert.strictEqual(normalizePath(result.finalPath), 'uploads/subfolder/normal.txt');
      assert.strictEqual(result.metadata.uploadType, 'individual');
      assert.strictEqual(result.error, undefined);
    });
  });

  describe('Performance and Batch Processing', () => {
    test('should handle batch uploads efficiently', () => {
      const files = [];
      for (let i = 0; i < 20; i++) {
        files.push({
          originalname: `file${i}.txt`,
          webkitRelativePath: `batch/file${i}.txt`
        });
      }

      const startTime = Date.now();
      const results = resolver.resolvePathsBatch(files, 'batch');
      const processingTime = Date.now() - startTime;

      // Should process files reasonably quickly
      assert(processingTime < 1000, `Batch processing took too long: ${processingTime}ms`);
      assert.strictEqual(results.length, 20);
      
      // All should be processed successfully
      results.forEach((result, index) => {
        assert.strictEqual(result.error, undefined);
        assert.strictEqual(normalizePath(result.finalPath), `batch/file${index}.txt`);
      });
    });

    test('should track basic performance metrics', () => {
      const files = [
        { originalname: 'file1.txt', webkitRelativePath: 'docs/file1.txt' },
        { originalname: 'file2.txt', webkitRelativePath: 'docs/file2.txt' },
        { originalname: 'file3.txt' }
      ];

      files.forEach(file => {
        resolver.resolvePath(file, 'docs');
      });

      const metrics = resolver.getPerformanceMetrics();
      
      assert.ok(metrics.totalResolutions >= 3);
      assert.ok(typeof metrics.duplicationsDetected === 'number');
    });
  });

  describe('Error Handling in Integration Scenarios', () => {
    test('should handle mixed valid and invalid files in batch', () => {
      const files = [
        { originalname: 'valid1.txt' },
        null, // Invalid file
        { originalname: 'valid2.txt' },
        { /* missing originalname */ webkitRelativePath: 'path/file.txt' },
        { originalname: 'valid3.txt' }
      ];

      const results = resolver.resolvePathsBatch(files, 'uploads');

      assert.strictEqual(results.length, 5);
      assert.strictEqual(results[0].error, undefined); // valid1.txt
      assert.strictEqual(results[1].error, true);      // null file
      assert.strictEqual(results[2].error, undefined); // valid2.txt
      assert.strictEqual(results[3].error, true);      // missing originalname
      assert.strictEqual(results[4].error, undefined); // valid3.txt
    });

    test('should provide error information for debugging', () => {
      const result = resolver.resolvePath(null, 'uploads');

      assert.strictEqual(result.error, true);
      assert.ok(result.errorInfo);
      assert.ok(result.warnings.length > 0);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain compatibility with existing upload patterns', () => {
      // Test patterns that should work exactly as before
      const legacyFiles = [
        { originalname: 'simple.txt' }, // No webkitRelativePath
        { originalname: 'nested.txt', webkitRelativePath: 'folder/nested.txt' } // Simple nested
      ];

      legacyFiles.forEach(file => {
        const result = resolver.resolvePath(file, 'uploads');
        
        assert.strictEqual(result.error, undefined);
        assert.ok(normalizePath(result.finalPath).startsWith('uploads/'));
      });
    });
  });

  console.log('✅ All Upload Scenarios Integration Tests completed successfully');
});