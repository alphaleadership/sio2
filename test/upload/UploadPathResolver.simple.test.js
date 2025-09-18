const { describe, test } = require('node:test');
const assert = require('node:assert');
const UploadPathResolver = require('../../lib/upload/UploadPathResolver');

describe('UploadPathResolver - Core Functionality', () => {
  const resolver = new UploadPathResolver();

  test('should handle individual file upload without webkitRelativePath', () => {
    const file = {
      originalname: 'document.pdf'
    };
    const destFolder = 'uploads';

    const result = resolver.resolvePath(file, destFolder);

    assert.strictEqual(result.finalPath, 'uploads/document.pdf');
    assert.strictEqual(result.strategy, 'basename');
    assert.strictEqual(result.duplicationPrevented, false);
    assert.strictEqual(result.error, undefined);
  });

  test('should handle individual file with problematic webkitRelativePath', () => {
    const file = {
      originalname: 'rapport.pdf',
      webkitRelativePath: 'documents/rapport.pdf'
    };
    const destFolder = 'documents';

    const result = resolver.resolvePath(file, destFolder);

    assert.strictEqual(result.finalPath, 'documents/rapport.pdf');
    assert.strictEqual(result.duplicationPrevented, true);
    assert.ok(result.warnings.some(w => w.includes('duplication')));
  });

  test('should handle consecutive duplicate detection', () => {
    const file = {
      originalname: 'file.txt',
      webkitRelativePath: 'docs/docs/file.txt'
    };
    const destFolder = 'docs';

    const result = resolver.resolvePath(file, destFolder);

    assert.strictEqual(result.duplicationPrevented, true);
    assert.strictEqual(result.finalPath, 'docs/file.txt');
  });

  test('should handle invalid file object', () => {
    const result = resolver.resolvePath(null, 'uploads');

    assert.strictEqual(result.error, true);
    assert.strictEqual(result.strategy, 'basename');
    assert.ok(result.warnings[0].includes('Invalid file object'));
  });

  test('should handle invalid destination folder', () => {
    const file = { originalname: 'test.txt' };
    const result = resolver.resolvePath(file, null);

    assert.strictEqual(result.error, true);
    assert.ok(result.warnings[0].includes('Invalid destination folder'));
  });

  test('should track performance metrics', () => {
    const file = { originalname: 'test.txt' };
    const destFolder = 'uploads';

    resolver.resolvePath(file, destFolder);
    resolver.resolvePath(file, destFolder);

    const metrics = resolver.getPerformanceMetrics();

    assert.ok(metrics.totalResolutions >= 2);
    assert.ok(metrics.averageResolutionTime > 0);
    assert.ok(metrics.strategiesUsed.basename >= 2);
  });

  test('should resolve multiple files in batch', () => {
    const files = [
      { originalname: 'file1.txt' },
      { originalname: 'file2.txt' },
      { originalname: 'file3.txt' }
    ];
    const destFolder = 'uploads';

    const results = resolver.resolvePathsBatch(files, destFolder);

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].finalPath, 'uploads/file1.txt');
    assert.strictEqual(results[1].finalPath, 'uploads/file2.txt');
    assert.strictEqual(results[2].finalPath, 'uploads/file3.txt');
  });

  test('should include comprehensive metadata', () => {
    const file = {
      originalname: 'test.pdf',
      webkitRelativePath: 'folder/test.pdf'
    };
    const destFolder = 'uploads';

    const result = resolver.resolvePath(file, destFolder);

    assert.deepStrictEqual(result.originalFile, {
      originalname: 'test.pdf',
      webkitRelativePath: 'folder/test.pdf'
    });
    assert.ok(result.processingTime > 0);
    assert.ok(result.confidence > 0);
    assert.ok(result.metadata.hasOwnProperty('uploadType'));
    assert.ok(result.metadata.hasOwnProperty('duplicationType'));
  });

  console.log('✅ All UploadPathResolver tests completed successfully');
});