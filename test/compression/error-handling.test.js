const assert = require('assert');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const CompressionService = require('../../lib/compression/CompressionService');
const ErrorHandler = require('../../lib/compression/ErrorHandler');
const CompressionLogger = require('../../lib/compression/CompressionLogger');

// Simple test runner for error handling
async function runErrorHandlingTests() {
  console.log('Running Compression Error Handling tests...\n');
  
  let compressionService;
  let errorHandler;
  let logger;
  let testDir;
  let testFile;
  let backupDir;
  
  let testsPassed = 0;
  let testsFailed = 0;

  async function test(name, testFn) {
    try {
      console.log(`Testing: ${name}`);
      await testFn();
      console.log(`✓ ${name} passed\n`);
      testsPassed++;
    } catch (error) {
      console.log(`✗ ${name} failed: ${error.message}\n`);
      testsFailed++;
    }
  }

  async function setup() {
    testDir = path.join(__dirname, '..', 'temp', 'error-handling-test');
    backupDir = path.join(testDir, 'backup');
    
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(backupDir, { recursive: true });

    // Créer un fichier de test
    testFile = path.join(testDir, 'test-file.txt');
    await fs.writeFile(testFile, 'Contenu de test pour la compression\n'.repeat(100));

    // Initialiser les services avec configuration de test
    const config = {
      errorHandling: {
        compressionTimeout: 1000,
        decompressionTimeout: 500,
        maxRetries: 2,
        backupEnabled: true
      },
      logging: {
        logLevel: 'DEBUG',
        logDir: path.join(testDir, 'logs'),
        enableConsole: false,
        enableFile: true,
        alertThreshold: 3
      }
    };

    compressionService = new CompressionService(config);
    errorHandler = new ErrorHandler(config.errorHandling);
    logger = new CompressionLogger(config.logging);
  }

  async function cleanup() {
    try {
      if (fsSync.existsSync(testDir)) {
        await fs.rmdir(testDir, { recursive: true });
      }
    } catch (error) {
      console.warn(`Erreur lors du nettoyage: ${error.message}`);
    }
  }

  await setup();

  // Test ErrorHandler - Backup creation
  await test('ErrorHandler should create backup before compression', async () => {
    const mockCompressionOperation = async (input, output) => {
      const content = await fs.readFile(input);
      await fs.writeFile(output, content);
      return { success: true, originalSize: content.length, compressedSize: content.length };
    };

    const outputPath = path.join(testDir, 'compressed.gz');
    
    const result = await errorHandler.executeCompressionWithFallback(
      mockCompressionOperation,
      testFile,
      outputPath
    );

    assert.strictEqual(result.success, true);
    assert(result.backupPath);
    assert.strictEqual(fsSync.existsSync(result.backupPath), true);
  });

  // Test ErrorHandler - Fallback strategy
  await test('ErrorHandler should fallback to original file when compression fails', async () => {
    const mockFailingCompression = async () => {
      throw new Error('Compression simulée échouée');
    };

    const outputPath = path.join(testDir, 'compressed.gz');
    
    const result = await errorHandler.executeCompressionWithFallback(
      mockFailingCompression,
      testFile,
      outputPath
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.fallbackUsed, true);
    assert.strictEqual(result.fallbackResult.success, true);
    assert.strictEqual(fsSync.existsSync(result.fallbackResult.fallbackPath), true);
  });

  // Test ErrorHandler - Timeout handling
  await test('ErrorHandler should handle compression timeout', async () => {
    const mockSlowCompression = async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    };

    const outputPath = path.join(testDir, 'compressed.gz');
    
    const result = await errorHandler.executeCompressionWithFallback(
      mockSlowCompression,
      testFile,
      outputPath
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.fallbackUsed, true);
    assert(result.error.includes('timeout'));
  });

  // Test ErrorHandler - Recovery from backup
  await test('ErrorHandler should recover from backup when decompression fails', async () => {
    const backupPath = await errorHandler.createBackup(testFile);
    assert(backupPath);

    const mockFailingDecompression = async () => {
      throw new Error('Décompression simulée échouée');
    };

    const outputPath = path.join(testDir, 'decompressed.txt');
    
    const result = await errorHandler.executeDecompressionWithRecovery(
      mockFailingDecompression,
      testFile + '.gz',
      outputPath
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.recoveryUsed, true);
    assert.strictEqual(fsSync.existsSync(outputPath), true);
  });

  // Test ErrorHandler - Integrity verification
  await test('ErrorHandler should verify compression integrity', async () => {
    const outputPath = path.join(testDir, 'test-output.gz');
    
    // Créer un fichier de sortie vide (mauvaise intégrité)
    await fs.writeFile(outputPath, '');
    
    const isValid = await errorHandler.verifyCompressionIntegrity(testFile, outputPath);
    assert.strictEqual(isValid, false);

    // Créer un fichier de sortie avec du contenu
    await fs.writeFile(outputPath, 'contenu compressé simulé');
    
    const isValidWithContent = await errorHandler.verifyCompressionIntegrity(testFile, outputPath);
    assert.strictEqual(isValidWithContent, true);
  });

  // Test CompressionLogger - Success logging
  await test('CompressionLogger should log compression success', async () => {
    const operation = {
      inputPath: testFile,
      outputPath: testFile + '.gz',
      originalSize: 1000,
      compressedSize: 500,
      compressionRatio: 0.5,
      algorithm: 'gzip',
      duration: 100,
      spaceSaved: 500
    };

    await logger.logCompressionSuccess(operation);

    const logDir = logger.config.logDir;
    const logFiles = await fs.readdir(logDir);
    assert(logFiles.length > 0);

    const logContent = await fs.readFile(path.join(logDir, logFiles[0]), 'utf8');
    assert(logContent.includes('COMPRESSION_SUCCESS'));
    assert(logContent.includes(testFile));
  });

  // Test CompressionLogger - Error logging
  await test('CompressionLogger should log compression error with error code', async () => {
    const error = new Error('Test compression error');
    const context = {
      inputPath: testFile,
      outputPath: testFile + '.gz',
      algorithm: 'gzip',
      fileSize: 1000
    };

    await logger.logCompressionError(
      CompressionLogger.ERROR_CODES.COMPRESSION_FAILED,
      error,
      context
    );

    const logDir = logger.config.logDir;
    const logFiles = await fs.readdir(logDir);
    const logContent = await fs.readFile(path.join(logDir, logFiles[0]), 'utf8');
    
    assert(logContent.includes('COMPRESSION_ERROR'));
    assert(logContent.includes('COMP_001'));
    assert(logContent.includes('Test compression error'));
  });

  // Test CompressionLogger - Alert triggering
  await test('CompressionLogger should trigger alert after threshold errors', async () => {
    const error = new Error('Repeated error');
    const context = { inputPath: testFile };

    // Simuler plusieurs erreurs du même type
    for (let i = 0; i < 4; i++) {
      await logger.logCompressionError(
        CompressionLogger.ERROR_CODES.COMPRESSION_FAILED,
        error,
        context
      );
    }

    const logDir = logger.config.logDir;
    const logFiles = await fs.readdir(logDir);
    const logContent = await fs.readFile(path.join(logDir, logFiles[0]), 'utf8');
    
    assert(logContent.includes('COMPRESSION_ALERT'));
    assert(logContent.includes('CRITICAL'));
  });

  // Test CompressionLogger - Fallback logging
  await test('CompressionLogger should log fallback operation', async () => {
    const fallback = {
      originalOperation: 'compression',
      fallbackStrategy: 'store_original',
      reason: 'Compression timeout',
      inputPath: testFile,
      fallbackPath: testFile + '_original',
      success: true
    };

    await logger.logFallbackOperation(fallback);

    const logDir = logger.config.logDir;
    const logFiles = await fs.readdir(logDir);
    const logContent = await fs.readFile(path.join(logDir, logFiles[0]), 'utf8');
    
    assert(logContent.includes('FALLBACK_OPERATION'));
    assert(logContent.includes('store_original'));
  });

  // Test Integration - CompressionService with error handling
  await test('CompressionService should handle compression with error handling and logging', async () => {
    const outputPath = path.join(testDir, 'service-test.gz');
    
    const result = await compressionService.compressFile(testFile, outputPath, {
      level: 6,
      algorithm: 'gzip'
    });

    assert.strictEqual(result.success, true);
    assert(result.duration !== undefined);
    assert.strictEqual(fsSync.existsSync(outputPath), true);

    // Vérifier que les logs ont été créés
    const logDir = compressionService.logger.config.logDir;
    const logFiles = await fs.readdir(logDir);
    assert(logFiles.length > 0);
  });

  // Test Integration - Service statistics
  await test('CompressionService should provide service statistics', () => {
    const stats = compressionService.getServiceStats();
    
    assert.strictEqual(stats.errorHandler, 'enabled');
    assert(stats.logger);
    assert(stats.config);
  });

  // Test CompressionLogger - Error descriptions and recommendations
  await test('CompressionLogger should provide error descriptions and recommendations', () => {
    const description = logger.getErrorDescription(CompressionLogger.ERROR_CODES.COMPRESSION_FAILED);
    assert(description.includes('compression'));

    const recommendations = logger.getErrorRecommendations(CompressionLogger.ERROR_CODES.COMPRESSION_TIMEOUT);
    assert(Array.isArray(recommendations));
    assert(recommendations.length > 0);
  });

  await cleanup();

  // Résultats
  console.log(`\nError Handling Test Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runErrorHandlingTests().catch(console.error);
}

module.exports = { runErrorHandlingTests };