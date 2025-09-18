const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionQueue = require('../../lib/compression/CompressionQueue');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');

// Test d'intégration entre la queue et le streaming
async function runIntegrationTests() {
  console.log('Running Queue + Streaming Integration tests...\n');
  
  const testDir = path.join(__dirname, '../temp');
  
  // Créer le dossier de test
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    // Le dossier existe déjà
  }
  
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

  // Test 1: Queue avec compression streaming
  await test('should queue streaming compression tasks correctly', async () => {
    const compressionService = new CompressionService({
      largeFileThreshold: 512 * 1024 // 512KB
    });
    
    const queue = new CompressionQueue({
      maxConcurrent: 2,
      timeout: 10000
    });
    
    // Créer plusieurs fichiers de test de différentes tailles
    const files = [];
    
    // Petit fichier (compression régulière)
    const smallFile = path.join(testDir, 'small_queue.txt');
    const smallContent = 'Small file content. '.repeat(100); // ~2KB
    await fs.writeFile(smallFile, smallContent);
    files.push({
      input: smallFile,
      output: smallFile + '.gz',
      expectedStreaming: false
    });
    
    // Gros fichier (compression streaming)
    const largeFile = path.join(testDir, 'large_queue.txt');
    const largeContent = 'Large file content for streaming. '.repeat(20000); // ~700KB
    await fs.writeFile(largeFile, largeContent);
    files.push({
      input: largeFile,
      output: largeFile + '.gz',
      expectedStreaming: true
    });
    
    // Ajouter les tâches à la queue
    const promises = [];
    for (const file of files) {
      const taskPromise = queue.addTask({
        id: `compress_${path.basename(file.input)}`,
        inputPath: file.input,
        outputPath: file.output,
        compressionFunction: async (input, output, options) => {
          return await compressionService.compressFile(input, output, options);
        },
        options: { level: 6 }
      });
      promises.push(taskPromise);
    }
    
    // Attendre que toutes les compressions se terminent
    const results = await Promise.all(promises);
    
    // Vérifications
    assert.strictEqual(results.length, 2);
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const file = files[i];
      
      assert.strictEqual(result.success, true);
      assert(result.originalSize > 0);
      assert(result.compressedSize > 0);
      
      // Vérifier si le streaming a été utilisé comme attendu
      if (file.expectedStreaming) {
        assert.strictEqual(result.streamingUsed, true, 'Large file should use streaming');
      } else {
        assert.strictEqual(result.streamingUsed, false, 'Small file should not use streaming');
      }
    }
    
    // Vérifier les statistiques de la queue
    const queueStats = queue.getStats();
    assert.strictEqual(queueStats.totalProcessed, 2);
    assert.strictEqual(queueStats.totalSucceeded, 2);
    assert.strictEqual(queueStats.totalFailed, 0);
    
    await queue.shutdown();
  });

  // Test 2: Middleware avec queue et streaming
  await test('should integrate queue and streaming in middleware', async () => {
    const compressionService = new CompressionService({
      largeFileThreshold: 512 * 1024, // 512KB
      bufferSize: 32 * 1024 // 32KB
    });
    
    // Configuration mock pour le middleware
    const mockConfig = {
      compressionLevel: 6,
      algorithm: 'gzip',
      isValidSize: (size) => size >= 1024 && size <= 100 * 1024 * 1024,
      isCompressible: (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        return ['.txt', '.js', '.css', '.html', '.json'].includes(ext);
      }
    };
    
    const middleware = new FileStorageMiddleware(
      compressionService,
      mockConfig,
      null, // stats
      null, // metadataManager
      {
        maxConcurrent: 2,
        timeout: 10000
      }
    );
    
    // Créer des fichiers de test simulant un upload
    const mockFiles = [];
    
    // Petit fichier
    const smallFile = path.join(testDir, 'middleware_small.txt');
    const smallContent = 'Middleware small file. '.repeat(200); // ~4KB
    await fs.writeFile(smallFile, smallContent);
    mockFiles.push({
      path: smallFile,
      originalname: 'middleware_small.txt',
      size: smallContent.length
    });
    
    // Gros fichier
    const largeFile = path.join(testDir, 'middleware_large.txt');
    const largeContent = 'Middleware large file content. '.repeat(25000); // ~750KB
    await fs.writeFile(largeFile, largeContent);
    mockFiles.push({
      path: largeFile,
      originalname: 'middleware_large.txt',
      size: largeContent.length
    });
    
    // Simuler une requête Express
    const mockReq = {
      files: mockFiles,
      body: { path: '' }
    };
    
    const mockRes = {
      status: (code) => ({ send: (msg) => console.log(`Response: ${code} - ${msg}`) })
    };
    
    let nextCalled = false;
    const mockNext = () => { nextCalled = true; };
    
    // Traiter l'upload avec le middleware
    await middleware.handleUpload(mockReq, mockRes, mockNext);
    
    // Vérifications
    assert.strictEqual(nextCalled, true);
    assert(Array.isArray(mockReq.compressionResults));
    assert.strictEqual(mockReq.compressionResults.length, 2);
    
    // Vérifier que les fichiers ont été traités
    for (const result of mockReq.compressionResults) {
      assert(result.originalPath);
      assert(result.finalPath);
      
      // Les compressions sont en queue, donc compressed devrait être 'queued'
      assert.strictEqual(result.compressed, 'queued');
      assert(result.taskId);
    }
    
    // Attendre un peu pour que les tâches en queue se terminent
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Vérifier les statistiques de la queue
    const queueStats = middleware.getCompressionQueueStats();
    console.log('Queue stats:', queueStats);
    
    // Vérifier les statistiques de streaming
    const streamingStats = middleware.getStreamingStats();
    console.log('Streaming stats:', streamingStats);
    
    assert(queueStats.totalQueued >= 2);
    assert(streamingStats.totalFilesProcessed >= 0);
    
    await middleware.shutdownCompressionQueue();
  });

  // Test 3: Performance sous charge avec queue et streaming
  await test('should handle high load with queue and streaming', async () => {
    const compressionService = new CompressionService({
      largeFileThreshold: 256 * 1024, // 256KB
      bufferSize: 16 * 1024 // 16KB pour forcer plus d'opérations streaming
    });
    
    const queue = new CompressionQueue({
      maxConcurrent: 3,
      timeout: 15000
    });
    
    // Créer plusieurs fichiers de différentes tailles
    const files = [];
    const numFiles = 8;
    
    console.log(`Creating ${numFiles} test files...`);
    for (let i = 0; i < numFiles; i++) {
      const fileName = `load_test_${i}.txt`;
      const filePath = path.join(testDir, fileName);
      
      // Alterner entre petits et gros fichiers
      const isLarge = i % 2 === 0;
      const contentSize = isLarge ? 30000 : 1000; // ~300KB ou ~10KB
      const content = `Load test file ${i}. `.repeat(contentSize);
      
      await fs.writeFile(filePath, content);
      files.push({
        input: filePath,
        output: filePath + '.gz',
        expectedStreaming: isLarge
      });
    }
    
    console.log('Starting concurrent compression tasks...');
    const startTime = Date.now();
    
    // Ajouter toutes les tâches à la queue
    const promises = files.map((file, index) => {
      return queue.addTask({
        id: `load_test_${index}`,
        inputPath: file.input,
        outputPath: file.output,
        compressionFunction: async (input, output, options) => {
          return await compressionService.compressFile(input, output, options);
        },
        options: { level: 6 }
      });
    });
    
    // Attendre que toutes les compressions se terminent
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    console.log(`All ${numFiles} files compressed in ${totalTime}ms`);
    
    // Vérifications
    assert.strictEqual(results.length, numFiles);
    
    let streamingCount = 0;
    let regularCount = 0;
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const file = files[i];
      
      assert.strictEqual(result.success, true);
      assert(result.originalSize > 0);
      assert(result.compressedSize > 0);
      
      if (result.streamingUsed) {
        streamingCount++;
      } else {
        regularCount++;
      }
      
      // Vérifier que le fichier compressé existe
      const compressedExists = await fs.access(file.output).then(() => true).catch(() => false);
      assert.strictEqual(compressedExists, true);
    }
    
    console.log(`Streaming compressions: ${streamingCount}`);
    console.log(`Regular compressions: ${regularCount}`);
    
    // Vérifier les statistiques finales
    const queueStats = queue.getStats();
    const streamingStats = compressionService.getStreamingStats();
    
    assert.strictEqual(queueStats.totalProcessed, numFiles);
    assert.strictEqual(queueStats.totalSucceeded, numFiles);
    assert.strictEqual(queueStats.totalFailed, 0);
    assert(streamingStats.totalFilesProcessed >= streamingCount);
    
    console.log('Final queue stats:', queueStats);
    console.log('Final streaming stats summary:', {
      totalFiles: streamingStats.totalFilesProcessed,
      streamingCompressions: streamingStats.streamingCompressions,
      regularCompressions: streamingStats.regularCompressions,
      averageTime: streamingStats.averageCompressionTime.toFixed(2) + 'ms'
    });
    
    await queue.shutdown();
  });

  // Nettoyage
  try {
    const files = await fs.readdir(testDir);
    for (const file of files) {
      await fs.unlink(path.join(testDir, file));
    }
  } catch (error) {
    // Ignorer les erreurs de nettoyage
  }

  // Résultats
  console.log(`\nIntegration Test Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runIntegrationTests().catch(console.error);
}

module.exports = { runIntegrationTests };