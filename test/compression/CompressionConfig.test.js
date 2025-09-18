const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const CompressionConfig = require('../../lib/compression/CompressionConfig');

describe('CompressionConfig', () => {
  
  describe('Constructor and Default Values', () => {
    test('should create instance with default values', () => {
      const config = new CompressionConfig();
      
      assert.strictEqual(config.compressionLevel, 6);
      assert.strictEqual(config.algorithm, 'gzip');
      assert.strictEqual(config.minFileSize, 1024);
      assert.strictEqual(config.maxFileSize, 100 * 1024 * 1024);
      assert.strictEqual(config.compressionTimeout, 5000);
      assert(Array.isArray(config.compressibleTypes));
      assert(Array.isArray(config.excludeTypes));
    });
    
    test('should create instance with custom options', () => {
      const options = {
        compressionLevel: 9,
        algorithm: 'brotli',
        minFileSize: 2048,
        maxFileSize: 50 * 1024 * 1024,
        compressionTimeout: 10000,
        compressibleTypes: ['.txt', '.js'],
        excludeTypes: ['.jpg', '.png']
      };
      
      const config = new CompressionConfig(options);
      
      assert.strictEqual(config.compressionLevel, 9);
      assert.strictEqual(config.algorithm, 'brotli');
      assert.strictEqual(config.minFileSize, 2048);
      assert.strictEqual(config.maxFileSize, 50 * 1024 * 1024);
      assert.strictEqual(config.compressionTimeout, 10000);
      assert.deepStrictEqual(config.compressibleTypes, ['.txt', '.js']);
      assert.deepStrictEqual(config.excludeTypes, ['.jpg', '.png']);
    });
  });
  
  describe('Validation', () => {
    test('should validate correct configuration', () => {
      const config = new CompressionConfig();
      const validation = config.validate();
      
      assert.strictEqual(validation.isValid, true);
      assert.strictEqual(validation.errors.length, 0);
    });
    
    test('should detect invalid compression level', () => {
      const config = new CompressionConfig({ compressionLevel: 10 });
      const validation = config.validate();
      
      assert.strictEqual(validation.isValid, false);
      assert(validation.errors.some(error => error.includes('niveau de compression')));
    });
    
    test('should detect invalid file sizes', () => {
      const config = new CompressionConfig({ 
        minFileSize: 1000,
        maxFileSize: 500 
      });
      const validation = config.validate();
      
      assert.strictEqual(validation.isValid, false);
      assert(validation.errors.some(error => error.includes('taille minimale doit être inférieure')));
    });
    
    test('should detect invalid algorithm', () => {
      const config = new CompressionConfig({ algorithm: 'invalid' });
      const validation = config.validate();
      
      assert.strictEqual(validation.isValid, false);
      assert(validation.errors.some(error => error.includes('Algorithme non supporté')));
    });
    
    test('should generate warnings for high compression level', () => {
      const config = new CompressionConfig({ compressionLevel: 8 });
      const validation = config.validate();
      
      assert.strictEqual(validation.isValid, true);
      assert(validation.warnings.some(warning => warning.includes('niveau de compression élevé')));
    });
    
    test('should generate warnings for very low min file size', () => {
      const config = new CompressionConfig({ minFileSize: 50 });
      const validation = config.validate();
      
      assert.strictEqual(validation.isValid, true);
      assert(validation.warnings.some(warning => warning.includes('taille minimale très faible')));
    });
  });
  
  describe('File Type Checking', () => {
    test('should identify compressible files', () => {
      const config = new CompressionConfig({
        compressibleTypes: ['.txt', '.js', '.css'],
        excludeTypes: ['.jpg', '.png']
      });
      
      assert.strictEqual(config.isCompressible('test.txt'), true);
      assert.strictEqual(config.isCompressible('script.js'), true);
      assert.strictEqual(config.isCompressible('style.css'), true);
    });
    
    test('should exclude non-compressible files', () => {
      const config = new CompressionConfig({
        compressibleTypes: ['.txt', '.js'],
        excludeTypes: ['.jpg', '.png']
      });
      
      assert.strictEqual(config.isCompressible('image.jpg'), false);
      assert.strictEqual(config.isCompressible('photo.png'), false);
      assert.strictEqual(config.isCompressible('document.pdf'), false);
    });
    
    test('should handle case insensitive extensions', () => {
      const config = new CompressionConfig({
        compressibleTypes: ['.txt'],
        excludeTypes: ['.jpg']
      });
      
      assert.strictEqual(config.isCompressible('test.TXT'), true);
      assert.strictEqual(config.isCompressible('image.JPG'), false);
    });
  });
  
  describe('Size Validation', () => {
    test('should validate file sizes within limits', () => {
      const config = new CompressionConfig({
        minFileSize: 1000,
        maxFileSize: 10000
      });
      
      assert.strictEqual(config.isValidSize(500), false);   // Too small
      assert.strictEqual(config.isValidSize(1500), true);  // Valid
      assert.strictEqual(config.isValidSize(15000), false); // Too large
    });
  });
  
  describe('Configuration Update', () => {
    test('should update configuration properties', () => {
      const config = new CompressionConfig();
      const originalLevel = config.compressionLevel;
      
      config.update({ compressionLevel: 9 });
      
      assert.strictEqual(config.compressionLevel, 9);
      assert.notStrictEqual(config.compressionLevel, originalLevel);
    });
    
    test('should preserve unchanged properties', () => {
      const config = new CompressionConfig();
      const originalAlgorithm = config.algorithm;
      
      config.update({ compressionLevel: 9 });
      
      assert.strictEqual(config.algorithm, originalAlgorithm);
    });
  });
  
  describe('File Operations', () => {
    const testConfigPath = path.join(__dirname, '..', 'temp', 'test-config.json');
    
    test('should save and load configuration from file', async () => {
      const originalConfig = new CompressionConfig({
        compressionLevel: 7,
        algorithm: 'brotli',
        minFileSize: 2048
      });
      
      // Sauvegarder
      await originalConfig.saveToFile(testConfigPath);
      
      // Charger
      const loadedConfig = await CompressionConfig.loadFromFile(testConfigPath);
      
      assert.strictEqual(loadedConfig.compressionLevel, 7);
      assert.strictEqual(loadedConfig.algorithm, 'brotli');
      assert.strictEqual(loadedConfig.minFileSize, 2048);
      
      // Nettoyer
      try {
        await fs.unlink(testConfigPath);
      } catch (e) {
        // Ignorer si le fichier n'existe pas
      }
    });
    
    test('should return default config when file does not exist', async () => {
      const nonExistentPath = path.join(__dirname, '..', 'temp', 'non-existent-config.json');
      
      const config = await CompressionConfig.loadFromFile(nonExistentPath);
      
      assert.strictEqual(config.compressionLevel, 6); // Valeur par défaut
      assert.strictEqual(config.algorithm, 'gzip');   // Valeur par défaut
    });
    
    test('should throw error when saving invalid configuration', async () => {
      const invalidConfig = new CompressionConfig({ compressionLevel: 15 }); // Invalid
      
      await assert.rejects(
        async () => await invalidConfig.saveToFile(testConfigPath),
        /Configuration invalide/
      );
    });
  });
  
  describe('JSON Serialization', () => {
    test('should serialize to JSON correctly', () => {
      const config = new CompressionConfig({
        compressionLevel: 8,
        compressibleTypes: ['.txt', '.js'],
        excludeTypes: ['.jpg']
      });
      
      const json = config.toJSON();
      
      assert.strictEqual(json.compressionLevel, 8);
      assert.deepStrictEqual(json.compressibleTypes, ['.txt', '.js']);
      assert.deepStrictEqual(json.excludeTypes, ['.jpg']);
      assert.strictEqual(typeof json.minFileSize, 'number');
      assert.strictEqual(typeof json.maxFileSize, 'number');
    });
    
    test('should create independent arrays in JSON', () => {
      const config = new CompressionConfig();
      const json = config.toJSON();
      
      // Modifier le JSON ne doit pas affecter la configuration originale
      json.compressibleTypes.push('.new');
      
      assert.notDeepStrictEqual(config.compressibleTypes, json.compressibleTypes);
    });
  });
});