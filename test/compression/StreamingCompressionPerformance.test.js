const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const StreamingCompressionService = require('../../lib/compression/StreamingCompressionService');

// Test de performance pour la compression streaming
async function runPerformanceTests() {
  console.log('Running StreamingCompressionService performance tests...\n');
  
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

  // Test 1: Compression d'un petit fichier (mode régulier)
  await test('should use regular compression for small files', async () => {
    const streamingService = new StreamingCompressionService({
      largeFileThreshold: 1024 * 1024 // 1MB
    });
    
    const inputPath = path.join(testDir, 'small_file.txt');
    const outputPath = path.join(testDir, 'small_file.txt.gz');
    const testContent = 'Small file content. '.repeat(100); // ~2KB
    
    // Créer le fichier de test
    await fs.writeFile(inputPath, testContent);
    
    // Compresser le fichier
    const result = await streamingService.compressFile(inputPath, outputPath);
    
    // Vérifications
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.streamingUsed, false);
    assert.strictEqual(result.memoryOptimized, false);
    assert(result.originalSize > 0);
    assert(result.compressedSize > 0);
    assert(result.compressedSize < result.originalSize);
    
    // Vérifier que le fichier compressé existe
    const compressedExists = await fs.access(outputPath).then(() => true).catch(() => false);
    assert.strictEqual(compressedExists, true);
  });

  // Test 2: Compression d'un gros fichier (mode streaming)
  await test('should use streaming compression for large files', async () => {
    const streamingService = new StreamingCompressionService({
      largeFileThreshold: 1024 * 1024, // 1MB
      bufferSize: 64 * 1024 // 64KB
    });
    
    const inputPath = path.join(testDir, 'large_file.txt');
    const outputPath = path.join(testDir, 'large_file.txt.gz');
    
    // Créer un fichier de 2MB
    const chunkSize = 1024;
    const totalChunks = 2048; // 2MB
    const chunk = 'A'.repeat(chunkSize);
    
    console.log('Creating 2MB test file...');
    let content = '';
    for (let i = 0; i < totalChunks; i++) {
      content += chunk;
    }
    await fs.writeFile(inputPath, content);
    
    // Suivre le progrès
    let progressUpdates = 0;
    const progressCallback = (progress) => {
      progressUpdates++;
      console.log(`Progress: ${progress.progress}% (${progress.phase})`);
    };
    
    // Compresser le fichier
    console.log('Starting streaming compression...');
    const startTime = Date.now();
    const result = await streamingService.compressFile(inputPath, outputPath, {
      progressCallback
    });
    const duration = Date.now() - startTime;
    
    // Vérifications
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.streamingUsed, true);
    assert.strictEqual(result.memoryOptimized, true);
    assert(result.originalSize >= 2 * 1024 * 1024); // Au moins 2MB
    assert(result.compressedSize > 0);
    assert(result.compressedSize < result.originalSize);
    assert(progressUpdates > 0); // Le callback de progrès a été appelé
    
    console.log(`Compression completed in ${duration}ms`);
    console.log(`Original size: ${streamingService.formatBytes(result.originalSize)}`);
    console.log(`Compressed size: ${streamingService.formatBytes(result.compressedSize)}`);
    console.log(`Compression ratio: ${(result.compressionRatio * 100).toFixed(2)}%`);
    console.log(`Space saved: ${streamingService.formatBytes(result.spaceSaved)}`);
  });

  // Test 3: Décompression streaming
  await test('should decompress large files using streaming', async () => {
    const streamingService = new StreamingCompressionService({
      largeFileThreshold: 1024 * 1024 // 1MB
    });
    
    const originalPath = path.join(testDir, 'original_for_decomp.txt');
    const compressedPath = path.join(testDir, 'compressed_for_decomp.txt.gz');
    const decompressedPath = path.join(testDir, 'decompressed.txt');
    
    // Créer un fichier de test de 1.5MB
    const testContent = 'Decompression test content. '.repeat(50000); // ~1.5MB
    await fs.writeFile(originalPath, testContent);
    
    // Compresser d'abord
    await streamingService.compressFile(originalPath, compressedPath);
    
    // Décompresser avec suivi du progrès
    let progressUpdates = 0;
    const progressCallback = (progress) => {
      progressUpdates++;
    };
    
    const result = await streamingService.decompressFile(compressedPath, decompressedPath, {
      progressCallback
    });
    
    // Vérifications
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.streamingUsed, true);
    assert(result.originalSize > 0);
    assert(result.compressedSize > 0);
    assert(progressUpdates > 0);
    
    // Vérifier que le contenu est identique
    const decompressedContent = await fs.readFile(decompressedPath, 'utf8');
    assert.strictEqual(decompressedContent, testContent);
  });

  // Test 4: Test de performance mémoire
  await test('should maintain low memory usage during streaming', async () => {
    const streamingService = new StreamingCompressionService({
      largeFileThreshold: 512 * 1024, // 512KB
      bufferSize: 32 * 1024, // 32KB
      maxMemoryUsage: 50 * 1024 * 1024 // 50MB
    });
    
    const inputPath = path.join(testDir, 'memory_test.txt');
    const outputPath = path.join(testDir, 'memory_test.txt.gz');
    
    // Créer un fichier de 5MB
    console.log('Creating 5MB test file for memory test...');
    const chunkSize = 1024;
    const totalChunks = 5120; // 5MB
    const chunk = 'Memory test content. '.repeat(40); // ~1KB par chunk
    
    let content = '';
    for (let i = 0; i < totalChunks; i++) {
      content += chunk;
    }
    await fs.writeFile(inputPath, content);
    
    // Mesurer l'utilisation mémoire avant
    const memBefore = process.memoryUsage().heapUsed;
    
    // Compresser le fichier
    const result = await streamingService.compressFile(inputPath, outputPath);
    
    // Mesurer l'utilisation mémoire après
    const memAfter = process.memoryUsage().heapUsed;
    const memIncrease = memAfter - memBefore;
    
    // Obtenir les statistiques de performance
    const stats = streamingService.getPerformanceStats();
    
    console.log(`Memory usage increase: ${streamingService.formatBytes(memIncrease)}`);
    console.log(`Peak memory usage: ${stats.memoryUsageFormatted.peak}`);
    console.log(`File size: ${streamingService.formatBytes(result.originalSize)}`);
    
    // Vérifications
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.streamingUsed, true);
    
    // L'augmentation mémoire ne devrait pas dépasser significativement la taille du buffer
    const maxExpectedIncrease = streamingService.bufferSize * 10; // 10x le buffer size
    assert(memIncrease < maxExpectedIncrease, 
      `Memory increase ${streamingService.formatBytes(memIncrease)} should be less than ${streamingService.formatBytes(maxExpectedIncrease)}`);
  });

  // Test 5: Test de performance avec différents algorithmes
  await test('should support different compression algorithms', async () => {
    const streamingService = new StreamingCompressionService({
      largeFileThreshold: 512 * 1024 // 512KB
    });
    
    const inputPath = path.join(testDir, 'algorithm_test.txt');
    const gzipPath = path.join(testDir, 'algorithm_test_gzip.gz');
    const brotliPath = path.join(testDir, 'algorithm_test_brotli.br');
    
    // Créer un fichier de test de 1MB
    const testContent = 'Algorithm comparison test. '.repeat(40000); // ~1MB
    await fs.writeFile(inputPath, testContent);
    
    // Test avec gzip
    const gzipResult = await streamingService.compressFile(inputPath, gzipPath, {
      algorithm: 'gzip',
      level: 6
    });
    
    // Test avec brotli
    const brotliResult = await streamingService.compressFile(inputPath, brotliPath, {
      algorithm: 'brotli',
      level: 6
    });
    
    // Vérifications
    assert.strictEqual(gzipResult.success, true);
    assert.strictEqual(gzipResult.algorithm, 'gzip');
    assert.strictEqual(brotliResult.success, true);
    assert.strictEqual(brotliResult.algorithm, 'brotli');
    
    console.log(`Gzip compression ratio: ${(gzipResult.compressionRatio * 100).toFixed(2)}%`);
    console.log(`Brotli compression ratio: ${(brotliResult.compressionRatio * 100).toFixed(2)}%`);
    
    // Brotli devrait généralement avoir un meilleur ratio de compression
    // (mais ce n'est pas garanti pour tous les types de données)
    assert(gzipResult.compressionRatio > 0);
    assert(brotliResult.compressionRatio > 0);
  });

  // Test 6: Statistiques de performance
  await test('should provide accurate performance statistics', async () => {
    const streamingService = new StreamingCompressionService();
    
    // Réinitialiser les statistiques
    streamingService.resetStats();
    
    const inputPath = path.join(testDir, 'stats_test.txt');
    const outputPath = path.join(testDir, 'stats_test.txt.gz');
    
    // Créer plusieurs fichiers de test
    const files = [];
    for (let i = 0; i < 3; i++) {
      const filePath = path.join(testDir, `stats_test_${i}.txt`);
      const compressedPath = path.join(testDir, `stats_test_${i}.txt.gz`);
      const content = `Stats test file ${i}. `.repeat(1000);
      
      await fs.writeFile(filePath, content);
      files.push({ input: filePath, output: compressedPath });
    }
    
    // Compresser tous les fichiers
    for (const file of files) {
      await streamingService.compressFile(file.input, file.output);
    }
    
    // Obtenir les statistiques
    const stats = streamingService.getPerformanceStats();
    
    // Vérifications
    assert.strictEqual(stats.totalFilesProcessed, 3);
    assert(stats.totalBytesProcessed > 0);
    assert(stats.averageCompressionTime > 0);
    assert(typeof stats.throughput.filesPerSecond === 'number');
    assert(typeof stats.throughput.bytesPerSecond === 'number');
    assert(typeof stats.configuration.bufferSize === 'string');
    
    console.log('Performance Statistics:');
    console.log(`Files processed: ${stats.totalFilesProcessed}`);
    console.log(`Bytes processed: ${streamingService.formatBytes(stats.totalBytesProcessed)}`);
    console.log(`Average compression time: ${stats.averageCompressionTime.toFixed(2)}ms`);
    console.log(`Streaming compressions: ${stats.streamingCompressions}`);
    console.log(`Regular compressions: ${stats.regularCompressions}`);
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
  console.log(`\nPerformance Test Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { runPerformanceTests };