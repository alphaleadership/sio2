const { test, describe } = require('node:test');
const assert = require('node:assert');
const PathConstructionStrategy = require('../../lib/upload/PathConstructionStrategy');
const path = require('path');

describe('PathConstructionStrategy', () => {
  describe('constructBasename', () => {
    test('should construct path using only filename', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'document.pdf' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'document.pdf'));
    });

    test('should handle nested file paths by extracting basename', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'folder/subfolder/document.pdf' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'document.pdf'));
    });

    test('should sanitize destination folder', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'document.pdf' };
      const result = strategy.constructBasename('docs<>:|', file);

      assert.strictEqual(result, path.join('docs', 'document.pdf'));
    });

    test('should create fallback path for invalid filenames', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: '' };
      const result = strategy.constructBasename('documents', file);

      assert.match(result, /documents[/\\]upload_\d+\.file/);
    });

    test('should handle files with no extension', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'README' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'README'));
    });
  });

  describe('constructWebkitPath', () => {
    test('should construct path using webkitRelativePath', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'index.html',
        webkitRelativePath: 'my-site/pages/index.html'
      };
      const result = strategy.constructWebkitPath('projects', file);

      assert.strictEqual(result, path.join('projects', 'my-site', 'pages', 'index.html'));
    });

    test('should fallback to basename when webkitRelativePath is missing', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'document.pdf' };
      const result = strategy.constructWebkitPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'document.pdf'));
    });

    test('should sanitize webkitRelativePath', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: 'folder<>:|/file.txt'
      };
      const result = strategy.constructWebkitPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'folder', 'file.txt'));
    });

    test('should handle empty webkitRelativePath', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'document.pdf',
        webkitRelativePath: ''
      };
      const result = strategy.constructWebkitPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'document.pdf'));
    });
  });

  describe('constructSmartPath', () => {
    test('should detect and prevent folder duplication', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'rapport.pdf',
        webkitRelativePath: 'documents/rapport.pdf'
      };
      const result = strategy.constructSmartPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'rapport.pdf'));
    });

    test('should preserve legitimate folder structure', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'index.html',
        webkitRelativePath: 'my-site/pages/index.html'
      };
      const result = strategy.constructSmartPath('projects', file);

      assert.strictEqual(result, path.join('projects', 'my-site', 'pages', 'index.html'));
    });

    test('should handle multiple level duplications', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: 'docs/file.txt'
      };
      const result = strategy.constructSmartPath('docs', file);

      assert.strictEqual(result, path.join('docs', 'file.txt'));
    });

    test('should fallback to basename when no webkitRelativePath', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'document.pdf' };
      const result = strategy.constructSmartPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'document.pdf'));
    });

    test('should handle nested destination folders', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'report.pdf',
        webkitRelativePath: 'shared/report.pdf'
      };
      const result = strategy.constructSmartPath('user/shared', file);

      assert.strictEqual(result, path.join('user', 'shared', 'report.pdf'));
    });

    test('should fallback to basename when remaining path is empty', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: 'documents/'
      };
      const result = strategy.constructSmartPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'file.txt'));
    });
  });

  describe('path validation', () => {
    test('should reject paths with directory traversal', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: '../../../etc/passwd'
      };
      const result = strategy.constructWebkitPath('documents', file);

      // Should fallback to basename strategy
      assert.strictEqual(result, path.join('documents', 'file.txt'));
    });

    test('should reject absolute paths', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: '/etc/passwd'
      };
      const result = strategy.constructWebkitPath('documents', file);

      // Should fallback to basename strategy
      assert.strictEqual(result, path.join('documents', 'file.txt'));
    });

    test('should handle very long paths', () => {
      const strategy = new PathConstructionStrategy();
      const longPath = 'a'.repeat(300);
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: `${longPath}/file.txt`
      };
      const result = strategy.constructWebkitPath('documents', file);

      // Should fallback to basename strategy due to path length
      assert.strictEqual(result, path.join('documents', 'file.txt'));
    });
  });

  describe('filename sanitization', () => {
    test('should remove forbidden characters', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'file<>:|*.txt' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'file_.txt'));
    });

    test('should handle reserved Windows filenames', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'CON.txt' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'file_CON.txt'));
    });

    test('should limit filename length', () => {
      const strategy = new PathConstructionStrategy();
      const longName = 'a'.repeat(150) + '.txt';
      const file = { originalname: longName };
      const result = strategy.constructBasename('documents', file);

      const filename = path.basename(result);
      assert(filename.length <= 100);
      assert.match(filename, /\.txt$/);
    });

    test('should handle filenames with only dots and spaces', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: '  ...  ' };
      const result = strategy.constructBasename('documents', file);

      assert.match(result, /documents[/\\]upload_\d+\.file/);
    });
  });

  describe('fallback behavior', () => {
    test('should create timestamp-based fallback for invalid inputs', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: null };
      const result = strategy.constructBasename('documents', file);

      assert.match(result, /documents[/\\]upload_\d+\.file/);
    });

    test('should handle missing file object gracefully', () => {
      const strategy = new PathConstructionStrategy();
      const result = strategy.constructBasename('documents', {});

      assert.match(result, /documents[/\\]upload_\d+\.file/);
    });

    test('should sanitize destination folder in fallback', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: '' };
      const result = strategy.constructBasename('', file);

      assert.match(result, /uploads[/\\]upload_\d+\.file/);
    });
  });

  describe('edge cases', () => {
    test('should handle Unicode filenames', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'файл.txt' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'файл.txt'));
    });

    test('should handle files with multiple extensions', () => {
      const strategy = new PathConstructionStrategy();
      const file = { originalname: 'archive.tar.gz' };
      const result = strategy.constructBasename('documents', file);

      assert.strictEqual(result, path.join('documents', 'archive.tar.gz'));
    });

    test('should handle mixed path separators in webkitRelativePath', () => {
      const strategy = new PathConstructionStrategy();
      const file = {
        originalname: 'file.txt',
        webkitRelativePath: 'folder\\subfolder/file.txt'
      };
      const result = strategy.constructWebkitPath('documents', file);

      assert.strictEqual(result, path.join('documents', 'folder', 'subfolder', 'file.txt'));
    });
  });
});