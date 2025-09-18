const { describe, test } = require('node:test');
const assert = require('node:assert');
const PathAnalysisEngine = require('../../lib/upload/PathAnalysisEngine');

describe('PathAnalysisEngine', () => {
  const engine = new PathAnalysisEngine();

  describe('Individual File Upload Detection (Requirement 2.1)', () => {
    test('should detect single file without webkitRelativePath as individual upload', () => {
      const files = [{
        originalname: 'rapport.pdf',
        webkitRelativePath: ''
      }];

      const result = engine.analyzeUploadContext(files, 'documents');

      assert.strictEqual(result.uploadType, 'individual');
      assert.strictEqual(result.strategy, 'basename');
      assert.strictEqual(result.confidence, 1.0);
      assert(result.reasoning.includes('individual upload'));
    });

    test('should detect single file with problematic webkitRelativePath as individual upload', () => {
      const files = [{
        originalname: 'rapport.pdf',
        webkitRelativePath: 'documents/rapport.pdf'
      }];

      const result = engine.analyzeUploadContext(files, 'documents');

      assert.strictEqual(result.uploadType, 'individual');
      assert.strictEqual(result.strategy, 'basename');
      assert(result.confidence > 0.8);
      assert(result.warnings.includes('Potential path duplication detected in webkitRelativePath'));
    });

    test('should detect multiple files without webkitRelativePath as individual uploads', () => {
      const files = [
        { originalname: 'file1.pdf', webkitRelativePath: '' },
        { originalname: 'file2.pdf', webkitRelativePath: '' }
      ];

      const result = engine.analyzeUploadContext(files, 'documents');

      assert.strictEqual(result.uploadType, 'individual');
      assert.strictEqual(result.strategy, 'basename');
      assert.strictEqual(result.confidence, 1.0);
    });
  });

  describe('Folder Upload Detection (Requirement 2.2)', () => {
    test('should detect legitimate folder upload with common structure', () => {
      const files = [
        {
          originalname: 'index.html',
          webkitRelativePath: 'my-site/pages/index.html'
        },
        {
          originalname: 'style.css',
          webkitRelativePath: 'my-site/assets/style.css'
        },
        {
          originalname: 'script.js',
          webkitRelativePath: 'my-site/assets/script.js'
        }
      ];

      const result = engine.analyzeUploadContext(files, 'projects');

      assert.strictEqual(result.uploadType, 'folder');
      assert.strictEqual(result.strategy, 'webkit_path');
      assert(result.confidence > 0.7);
    });

    test('should detect folder upload with deep structure', () => {
      const files = [
        {
          originalname: 'component.js',
          webkitRelativePath: 'src/components/header/component.js'
        },
        {
          originalname: 'styles.css',
          webkitRelativePath: 'src/components/header/styles.css'
        }
      ];

      const result = engine.analyzeUploadContext(files, 'project');

      assert.strictEqual(result.uploadType, 'folder');
      assert.strictEqual(result.strategy, 'webkit_path');
      assert(result.confidence > 0.7);
    });
  });

  describe('Upload Type Distinction (Requirement 2.3)', () => {
    test('should distinguish between individual files and folder uploads correctly', () => {
      // Individual file case
      const individualFiles = [{
        originalname: 'document.pdf',
        webkitRelativePath: 'documents/document.pdf'
      }];

      const individualResult = engine.analyzeUploadContext(individualFiles, 'documents');
      assert.strictEqual(individualResult.uploadType, 'individual');

      // Folder upload case
      const folderFiles = [
        {
          originalname: 'index.html',
          webkitRelativePath: 'website/pages/index.html'
        },
        {
          originalname: 'about.html',
          webkitRelativePath: 'website/pages/about.html'
        }
      ];

      const folderResult = engine.analyzeUploadContext(folderFiles, 'projects');
      assert.strictEqual(folderResult.uploadType, 'folder');
    });

    test('should handle mixed upload patterns with smart strategy', () => {
      const files = [
        {
          originalname: 'file1.pdf',
          webkitRelativePath: 'folder1/file1.pdf'
        },
        {
          originalname: 'file2.pdf',
          webkitRelativePath: 'different-folder/file2.pdf'
        }
      ];

      const result = engine.analyzeUploadContext(files, 'uploads');

      assert.strictEqual(result.strategy, 'smart_path');
      assert(result.warnings.includes('Mixed upload patterns detected - using smart strategy'));
    });
  });

  describe('Confidence Scoring', () => {
    test('should provide high confidence for clear individual file uploads', () => {
      const files = [{
        originalname: 'report.pdf',
        webkitRelativePath: ''
      }];

      const result = engine.analyzeUploadContext(files, 'documents');

      assert.strictEqual(result.confidence, 1.0);
    });

    test('should provide high confidence for clear folder uploads', () => {
      const files = [
        {
          originalname: 'component.js',
          webkitRelativePath: 'src/components/component.js'
        },
        {
          originalname: 'test.js',
          webkitRelativePath: 'src/tests/test.js'
        },
        {
          originalname: 'readme.md',
          webkitRelativePath: 'src/docs/readme.md'
        }
      ];

      const result = engine.analyzeUploadContext(files, 'project');

      assert(result.confidence > 0.8);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty files array', () => {
      const result = engine.analyzeUploadContext([], 'documents');

      assert.strictEqual(result.uploadType, 'individual');
      assert.strictEqual(result.strategy, 'basename');
      assert.strictEqual(result.confidence, 1.0);
    });

    test('should handle null files array', () => {
      const result = engine.analyzeUploadContext(null, 'documents');

      assert.strictEqual(result.uploadType, 'individual');
      assert.strictEqual(result.strategy, 'basename');
      assert.strictEqual(result.confidence, 1.0);
    });
  });

  describe('Path Duplication Detection', () => {
    test('should detect consecutive duplicate segments', () => {
      const files = [{
        originalname: 'file.txt',
        webkitRelativePath: 'docs/docs/file.txt'
      }];

      const result = engine.analyzeUploadContext(files, 'uploads');

      assert.strictEqual(result.uploadType, 'individual');
      assert(result.warnings.includes('Potential path duplication detected in webkitRelativePath'));
    });

    test('should detect destination folder duplication in webkit path', () => {
      const files = [{
        originalname: 'report.pdf',
        webkitRelativePath: 'documents/report.pdf'
      }];

      const result = engine.analyzeUploadContext(files, 'documents');

      assert.strictEqual(result.uploadType, 'individual');
      assert(result.warnings.includes('Potential path duplication detected in webkitRelativePath'));
    });
  });

  describe('Analysis Result Structure', () => {
    test('should include reasoning in analysis result', () => {
      const files = [{
        originalname: 'file.txt',
        webkitRelativePath: ''
      }];

      const result = engine.analyzeUploadContext(files, 'uploads');

      assert(result.reasoning);
      assert(typeof result.reasoning === 'string');
      assert(result.reasoning.length > 0);
    });

    test('should include timestamp in analysis result', () => {
      const files = [{
        originalname: 'file.txt',
        webkitRelativePath: ''
      }];

      const result = engine.analyzeUploadContext(files, 'uploads');

      assert(result.timestamp);
      assert(new Date(result.timestamp) instanceof Date);
    });
  });
});