const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const CompressionService = require('../../lib/compression/CompressionService');

// Simple test runner
async function runTests() {
  console.log('Running CompressionService tests...\n');
  
  const compressionService = new CompressionService();
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

  // Test 1: Compression basique
  await test('compressFile should compress a text file with gzip', async () => {
    const inputPath = path.join(testDir, 'test.txt');
    const outputPath = path.join(testDir, 'test.txt.gz');
    const testContent = 'Ceci est un fichier de test pour la compression. '.repeat(100);
    
    // Créer le fichier de test
    await fs.writeFile(inputPath, testContent);
    
    // Compresser le fichier
    const result = await compressionService.compressFile(inputPath, outputPath);
    
    // Vérifications
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.algorithm, 'gzip');
    assert(result.originalSize > 0);
    assert(result.compressedSize > 0);
    assert(result.compressedSize < result.originalSize);
    assert(result.compressionRatio < 1);
    assert(typeof result.checksum === 'string');
    assert(result.spaceSaved > 0);
    
    // Vérifier que le fichier compressé existe
    const compressedExists = await fs.access(outputPath).then(() => true).catch(() => false);
    assert.strictEqual(compressedExists, true);
  });

  // Test 2: Décompression
  await test('decompressFile should decompress a gzip file correctly', async () => {
    const originalPath = path.join(testDir, 'original.txt');
    const compressedPath = path.join(testDir, 'compressed.txt.gz');
    const decompressedPath = path.join(testDir, 'decompressed.txt');
    const testContent = 'Contenu original du fichier de test.';
    
    // Créer et compresser le fichier
    await fs.writeFile(originalPath, testContent);
    await compressionService.compressFile(originalPath, compressedPath);
    
    // Décompresser le fichier
    const result = await compressionService.decompressFile(compressedPath, decompressedPath);
    
    // Vérifications
    assert.strictEqual(result.success, true);
    assert(result.originalSize > 0);
    assert(result.compressedSize > 0);
    assert(typeof result.checksum === 'string');
    
    // Vérifier que le contenu est identique
    const decompressedContent = await fs.readFile(decompressedPath, 'utf8');
    assert.strictEqual(decompressedContent, testContent);
  });

  // Test 3: Détection de compression par extension
  await test('isCompressed should detect gzip file by extension', () => {
    const result = compressionService.isCompressed('/path/to/file.gz');
    assert.strictEqual(result, true);
  });

  // Test 4: Détection de fichier non compressé
  await test('isCompressed should detect non-compressed file', () => {
    const result = compressionService.isCompressed('/path/to/file.txt');
    assert.strictEqual(result, false);
  });

  // Test 5: Estimation du ratio de compression
  await test('estimateCompressionRatio should estimate compression ratio', async () => {
    const testPath = path.join(testDir, 'estimate.txt');
    const testContent = 'Contenu répétitif pour estimation. '.repeat(50);
    
    await fs.writeFile(testPath, testContent);
    
    const ratio = await compressionService.estimateCompressionRatio(testPath);
    
    assert(typeof ratio === 'number');
    assert(ratio >= 0 && ratio <= 1);
  });

  // Test 6: Gestion d'erreur pour fichier inexistant
  await test('compressFile should handle non-existent file error', async () => {
    const inputPath = path.join(testDir, 'inexistant.txt');
    const outputPath = path.join(testDir, 'inexistant.txt.gz');
    
    try {
      await compressionService.compressFile(inputPath, outputPath);
      throw new Error('Should have thrown an error');
    } catch (error) {
      assert(error.message.includes('Erreur lors de la compression'));
    }
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
  console.log(`\nTest Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };