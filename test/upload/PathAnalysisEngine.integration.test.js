const { describe, test } = require('node:test');
const assert = require('node:assert');
const { PathAnalysisEngine, DuplicationDetector } = require('../../lib/upload');

describe('PathAnalysisEngine Integration Tests', () => {
  const engine = new PathAnalysisEngine();
  const detector = new DuplicationDetector();

  test('should integrate with DuplicationDetector for comprehensive analysis', () => {
    // Test case from requirements: documents/documents/rapport.pdf issue
    const files = [{
      originalname: 'rapport.pdf',
      webkitRelativePath: 'documents/rapport.pdf'
    }];

    const analysisResult = engine.analyzeUploadContext(files, 'documents');

    // Verify PathAnalysisEngine correctly identifies this as individual upload
    assert.strictEqual(analysisResult.uploadType, 'individual');
    assert.strictEqual(analysisResult.strategy, 'basename');
    assert(analysisResult.warnings.includes('Potential path duplication detected in webkitRelativePath'));

    // Verify DuplicationDetector would catch the duplication
    const testPath = 'documents/documents/rapport.pdf';
    const duplicationResult = detector.detectConsecutiveDuplicates(testPath);
    assert.strictEqual(duplicationResult.hasDuplication, true);
  });

  test('should handle legitimate folder uploads without false positives', () => {
    const files = [
      {
        originalname: 'index.html',
        webkitRelativePath: 'my-project/src/index.html'
      },
      {
        originalname: 'styles.css',
        webkitRelativePath: 'my-project/assets/styles.css'
      }
    ];

    const result = engine.analyzeUploadContext(files, 'projects');

    // Should correctly identify as folder upload
    assert.strictEqual(result.uploadType, 'folder');
    assert.strictEqual(result.strategy, 'webkit_path');
    assert(result.confidence > 0.7);

    // Should not have duplication warnings for legitimate structure
    assert(!result.warnings.some(w => w.includes('duplication')));
  });

  test('should provide consistent results for edge cases', () => {
    // Test multiple scenarios that should all be individual uploads
    const testCases = [
      {
        files: [{ originalname: 'file.pdf', webkitRelativePath: '' }],
        destFolder: 'uploads',
        description: 'No webkit path'
      },
      {
        files: [{ originalname: 'doc.pdf', webkitRelativePath: 'uploads/doc.pdf' }],
        destFolder: 'uploads',
        description: 'Webkit path matches destination'
      },
      {
        files: [{ originalname: 'report.txt', webkitRelativePath: 'report.txt' }],
        destFolder: 'documents',
        description: 'Webkit path is just filename'
      }
    ];

    testCases.forEach(testCase => {
      const result = engine.analyzeUploadContext(testCase.files, testCase.destFolder);

      assert.strictEqual(result.uploadType, 'individual',
        `Failed for case: ${testCase.description}`);
      assert.strictEqual(result.strategy, 'basename',
        `Failed strategy for case: ${testCase.description}`);
      assert(result.confidence > 0.8,
        `Low confidence for case: ${testCase.description}`);
    });
  });

  test('should handle performance requirements', () => {
    // Test with larger file sets to ensure performance
    const largeFileSet = [];
    for (let i = 0; i < 50; i++) {
      largeFileSet.push({
        originalname: `file${i}.txt`,
        webkitRelativePath: `folder${i}/file${i}.txt`
      });
    }

    const startTime = Date.now();
    const result = engine.analyzeUploadContext(largeFileSet, 'uploads');
    const processingTime = Date.now() - startTime;

    // Should complete analysis quickly (< 50ms for 50 files)
    assert(processingTime < 50, `Processing took too long: ${processingTime}ms`);

    // Should still provide valid results
    assert(result.uploadType);
    assert(result.strategy);
    assert(typeof result.confidence === 'number');
  });
});