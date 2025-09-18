const assert = require('assert');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');
const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

// Test d'intégration pour vérifier que FileMetadataManager fonctionne avec FileStorageMiddleware
async function runIntegrationTests() {
  console.log('Running FileMetadataManager Integration tests...\n');
  
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

  // Test 1: Vérifier que les métadonnées sont sauvegardées lors de la compression
  await test('Metadata should be saved during compression', async () => {
    const compressionService = new CompressionService();
    const config = new CompressionConfig();
    const metadataManager = new FileMetadataManager();
    const middleware = new FileStorageMiddleware(compressionService, config, null, metadataManager);
    
    // Créer un fichier de test
    const testFile = path.join(testDir, 'metadata-test.txt');
    const testContent = 'This is a test file for metadata integration testing. It should be long enough to trigger compression.';
    await fs.writeFile(testFile, testContent);
    
    // Simuler une compression
    const compressedPath = testFile + '.gz';
    const compressionResult = await compressionService.compressFile(testFile, compressedPath);
    
    // Calculer le checksum et sauvegarder les métadonnées comme le ferait le middleware
    const checksum = await metadataManager.calculateChecksum(testFile);
    const metadata = {
      originalPath: testFile,
      compressedPath: compressedPath,
      isCompressed: true,
      originalSize: testContent.length,
      compressedSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio,
      algorithm: 'gzip',
      compressedAt: new Date(),
      checksum: checksum
    };
    
    await metadataManager.saveMetadata(compressedPath, metadata);
    
    // Vérifier que les métadonnées ont été sauvegardées
    const savedMetadata = await metadataManager.loadMetadata(compressedPath);
    assert(savedMetadata, 'Metadata should be saved');
    assert.strictEqual(savedMetadata.originalPath, testFile);
    assert.strictEqual(savedMetadata.isCompressed, true);
    assert.strictEqual(savedMetadata.algorithm, 'gzip');
    assert(savedMetadata.checksum, 'Checksum should be present');
    
    // Nettoyer
    if (fsSync.existsSync(testFile)) await fs.unlink(testFile);
    if (fsSync.existsSync(compressedPath)) await fs.unlink(compressedPath);
    await metadataManager.deleteMetadata(compressedPath);
  });

  // Test 2: Vérifier la validation d'intégrité
  await test('Integrity validation should work correctly', async () => {
    const metadataManager = new FileMetadataManager();
    
    // Créer un fichier de test
    const testFile = path.join(testDir, 'integrity-test.txt');
    const testContent = 'Content for integrity validation test';
    await fs.writeFile(testFile, testContent);
    
    // Calculer le checksum correct
    const correctChecksum = await metadataManager.calculateChecksum(testFile);
    
    // Sauvegarder les métadonnées avec le bon checksum
    const metadata = {
      originalPath: testFile,
      compressedPath: testFile + '.gz',
      isCompressed: true,
      originalSize: testContent.length,
      compressedSize: 20,
      compressionRatio: 0.6,
      algorithm: 'gzip',
      compressedAt: new Date(),
      checksum: correctChecksum
    };
    
    await metadataManager.saveMetadata(testFile, metadata);
    
    // La validation doit réussir avec le fichier original
    const isValid = await metadataManager.validateIntegrity(testFile);
    assert.strictEqual(isValid, true, 'Integrity validation should pass for unmodified file');
    
    // Modifier le fichier
    await fs.writeFile(testFile, testContent + ' modified');
    
    // La validation doit échouer
    const isValidAfter = await metadataManager.validateIntegrity(testFile);
    assert.strictEqual(isValidAfter, false, 'Integrity validation should fail for modified file');
    
    // Nettoyer
    if (fsSync.existsSync(testFile)) await fs.unlink(testFile);
    await metadataManager.deleteMetadata(testFile);
  });

  // Test 3: Vérifier que les métadonnées sont correctement formatées
  await test('Metadata format should be correct', async () => {
    const metadataManager = new FileMetadataManager();
    
    // Créer un fichier de test
    const testFile = path.join(testDir, 'format-test.txt');
    const testContent = 'Test content for format validation';
    await fs.writeFile(testFile, testContent);
    
    const checksum = await metadataManager.calculateChecksum(testFile);
    const compressedAt = new Date();
    
    const metadata = {
      originalPath: testFile,
      compressedPath: testFile + '.gz',
      isCompressed: true,
      originalSize: testContent.length,
      compressedSize: 15,
      compressionRatio: 0.5,
      algorithm: 'gzip',
      compressedAt: compressedAt,
      checksum: checksum
    };
    
    await metadataManager.saveMetadata(testFile, metadata);
    
    // Charger et vérifier le format
    const savedMetadata = await metadataManager.loadMetadata(testFile);
    
    // Vérifier tous les champs requis
    assert(savedMetadata.originalPath, 'originalPath should be present');
    assert(savedMetadata.compressedPath, 'compressedPath should be present');
    assert(typeof savedMetadata.isCompressed === 'boolean', 'isCompressed should be boolean');
    assert(typeof savedMetadata.originalSize === 'number', 'originalSize should be number');
    assert(typeof savedMetadata.compressedSize === 'number', 'compressedSize should be number');
    assert(typeof savedMetadata.compressionRatio === 'number', 'compressionRatio should be number');
    assert(savedMetadata.algorithm, 'algorithm should be present');
    assert(savedMetadata.compressedAt, 'compressedAt should be present');
    assert(savedMetadata.checksum, 'checksum should be present');
    assert(savedMetadata.savedAt, 'savedAt should be added automatically');
    assert(savedMetadata.version, 'version should be added automatically');
    
    // Nettoyer
    if (fsSync.existsSync(testFile)) await fs.unlink(testFile);
    await metadataManager.deleteMetadata(testFile);
  });

  // Test 4: Vérifier la gestion des fichiers .meta
  await test('Meta files should be created and managed correctly', async () => {
    const metadataManager = new FileMetadataManager();
    
    const testFile = path.join(testDir, 'meta-file-test.txt');
    const expectedMetaFile = testFile + '.meta';
    
    // Créer un fichier de test
    await fs.writeFile(testFile, 'Test content');
    
    // Vérifier qu'il n'y a pas de fichier .meta initialement
    const hasMetaBefore = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasMetaBefore, false, 'Should not have metadata initially');
    
    // Sauvegarder des métadonnées
    const metadata = {
      originalPath: testFile,
      compressedPath: testFile + '.gz',
      isCompressed: true,
      checksum: 'test-checksum'
    };
    
    await metadataManager.saveMetadata(testFile, metadata);
    
    // Vérifier que le fichier .meta existe
    const hasMetaAfter = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasMetaAfter, true, 'Should have metadata after saving');
    
    // Vérifier que le fichier .meta existe physiquement
    const metaExists = fsSync.existsSync(expectedMetaFile);
    assert.strictEqual(metaExists, true, 'Meta file should exist on filesystem');
    
    // Supprimer les métadonnées
    await metadataManager.deleteMetadata(testFile);
    
    // Vérifier que le fichier .meta a été supprimé
    const hasMetaDeleted = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasMetaDeleted, false, 'Should not have metadata after deletion');
    
    const metaExistsAfterDelete = fsSync.existsSync(expectedMetaFile);
    assert.strictEqual(metaExistsAfterDelete, false, 'Meta file should not exist after deletion');
    
    // Nettoyer
    if (fsSync.existsSync(testFile)) await fs.unlink(testFile);
  });

  // Nettoyage final
  try {
    const files = await fs.readdir(testDir);
    for (const file of files) {
      const filePath = path.join(testDir, file);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignorer les erreurs de suppression
      }
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