const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const DuplicationDetector = require('../../lib/upload/DuplicationDetector');

describe('DuplicationDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new DuplicationDetector();
  });

  describe('detectConsecutiveDuplicates', () => {
    test('should detect consecutive duplicate segments', () => {
      const result = detector.detectConsecutiveDuplicates('documents/documents/rapport.pdf');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.deepStrictEqual(result.duplicatedSegments, ['documents']);
      assert.strictEqual(result.suggestedPath, 'documents/rapport.pdf');
    });

    test('should detect multiple consecutive duplicates', () => {
      const result = detector.detectConsecutiveDuplicates('folder/folder/subfolder/subfolder/file.txt');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.deepStrictEqual(result.duplicatedSegments, ['folder', 'subfolder']);
      assert.strictEqual(result.suggestedPath, 'folder/subfolder/file.txt');
    });

    test('should handle paths with no duplicates', () => {
      const result = detector.detectConsecutiveDuplicates('documents/reports/rapport.pdf');
      
      assert.strictEqual(result.hasDuplication, false);
      assert.deepStrictEqual(result.duplicatedSegments, []);
      assert.strictEqual(result.suggestedPath, 'documents/reports/rapport.pdf');
    });

    test('should handle empty or invalid paths', () => {
      assert.deepStrictEqual(detector.detectConsecutiveDuplicates(''), {
        hasDuplication: false,
        duplicatedSegments: [],
        suggestedPath: ''
      });

      assert.deepStrictEqual(detector.detectConsecutiveDuplicates(null), {
        hasDuplication: false,
        duplicatedSegments: [],
        suggestedPath: ''
      });

      assert.deepStrictEqual(detector.detectConsecutiveDuplicates(undefined), {
        hasDuplication: false,
        duplicatedSegments: [],
        suggestedPath: ''
      });
    });

    test('should handle Windows-style path separators', () => {
      const result = detector.detectConsecutiveDuplicates('documents\\documents\\rapport.pdf');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.deepStrictEqual(result.duplicatedSegments, ['documents']);
      assert.strictEqual(result.suggestedPath, 'documents/rapport.pdf');
    });

    test('should handle single segment paths', () => {
      const result = detector.detectConsecutiveDuplicates('file.txt');
      
      assert.strictEqual(result.hasDuplication, false);
      assert.deepStrictEqual(result.duplicatedSegments, []);
      assert.strictEqual(result.suggestedPath, 'file.txt');
    });

    test('should handle paths with trailing slashes', () => {
      const result = detector.detectConsecutiveDuplicates('documents/documents/');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.deepStrictEqual(result.duplicatedSegments, ['documents']);
      assert.strictEqual(result.suggestedPath, 'documents');
    });
  });

  describe('detectUserPatternDuplication', () => {
    test('should detect user pattern duplications', () => {
      const result = detector.detectUserPatternDuplication('users/john/users/john/file.txt');
      
      assert.strictEqual(result.hasUserDuplication, true);
      assert.strictEqual(result.duplicatedPattern, 'users/john');
      assert.strictEqual(result.suggestedPath, 'users/john/file.txt');
    });

    test('should detect folder pattern duplications', () => {
      const result = detector.detectUserPatternDuplication('projects/myapp/projects/myapp/src/index.js');
      
      assert.strictEqual(result.hasUserDuplication, true);
      assert.strictEqual(result.duplicatedPattern, 'projects/myapp');
      assert.strictEqual(result.suggestedPath, 'projects/myapp/src/index.js');
    });

    test('should handle paths with no user pattern duplications', () => {
      const result = detector.detectUserPatternDuplication('users/john/documents/file.txt');
      
      assert.strictEqual(result.hasUserDuplication, false);
      assert.strictEqual(result.duplicatedPattern, '');
      assert.strictEqual(result.suggestedPath, 'users/john/documents/file.txt');
    });

    test('should handle short paths that cannot have user patterns', () => {
      const result = detector.detectUserPatternDuplication('users/john');
      
      assert.strictEqual(result.hasUserDuplication, false);
      assert.strictEqual(result.duplicatedPattern, '');
      assert.strictEqual(result.suggestedPath, 'users/john');
    });

    test('should handle empty or invalid paths', () => {
      assert.deepStrictEqual(detector.detectUserPatternDuplication(''), {
        hasUserDuplication: false,
        duplicatedPattern: '',
        suggestedPath: ''
      });

      assert.deepStrictEqual(detector.detectUserPatternDuplication(null), {
        hasUserDuplication: false,
        duplicatedPattern: '',
        suggestedPath: ''
      });
    });

    test('should handle Windows-style path separators', () => {
      const result = detector.detectUserPatternDuplication('users\\john\\users\\john\\file.txt');
      
      assert.strictEqual(result.hasUserDuplication, true);
      assert.strictEqual(result.duplicatedPattern, 'users/john');
      assert.strictEqual(result.suggestedPath, 'users/john/file.txt');
    });

    test('should detect complex nested pattern duplications', () => {
      const result = detector.detectUserPatternDuplication('company/dept/company/dept/project/file.txt');
      
      assert.strictEqual(result.hasUserDuplication, true);
      assert.strictEqual(result.duplicatedPattern, 'company/dept');
      assert.strictEqual(result.suggestedPath, 'company/dept/project/file.txt');
    });
  });

  describe('analyzePathDuplication', () => {
    test('should prioritize consecutive duplicates over user patterns', () => {
      const result = detector.analyzePathDuplication('documents/documents/users/john/users/john/file.txt');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.strictEqual(result.duplicationType, 'consecutive');
      assert.deepStrictEqual(result.duplicatedSegments, ['documents']);
      assert.strictEqual(result.suggestedPath, 'documents/users/john/users/john/file.txt');
      assert.strictEqual(result.confidence, 0.95);
    });

    test('should detect user patterns when no consecutive duplicates exist', () => {
      const result = detector.analyzePathDuplication('users/john/users/john/file.txt');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.strictEqual(result.duplicationType, 'user_pattern');
      assert.strictEqual(result.duplicatedPattern, 'users/john');
      assert.strictEqual(result.suggestedPath, 'users/john/file.txt');
      assert.strictEqual(result.confidence, 0.85);
    });

    test('should return no duplication for clean paths', () => {
      const result = detector.analyzePathDuplication('documents/reports/file.txt');
      
      assert.strictEqual(result.hasDuplication, false);
      assert.strictEqual(result.duplicationType, 'none');
      assert.strictEqual(result.originalPath, 'documents/reports/file.txt');
      assert.strictEqual(result.suggestedPath, 'documents/reports/file.txt');
      assert.strictEqual(result.confidence, 1.0);
    });

    test('should handle edge case with real-world problematic path', () => {
      // This is the actual problematic case from the requirements
      const result = detector.analyzePathDuplication('documents/documents/rapport.pdf');
      
      assert.strictEqual(result.hasDuplication, true);
      assert.strictEqual(result.duplicationType, 'consecutive');
      assert.deepStrictEqual(result.duplicatedSegments, ['documents']);
      assert.strictEqual(result.suggestedPath, 'documents/rapport.pdf');
    });

    test('should maintain original path reference', () => {
      const originalPath = 'test/test/file.txt';
      const result = detector.analyzePathDuplication(originalPath);
      
      assert.strictEqual(result.originalPath, originalPath);
      assert.strictEqual(result.suggestedPath, 'test/file.txt');
    });
  });
});