const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

// Simple test runner for FileMetadataManager
async function runTests() {
  console.log('Running FileMetadataManager tests...\n');
  
  const metadataManager = new FileMetadataManager();
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

  // Test 1: Génération du chemin de métadonnées
  await test('getMetadataPath should generate correct metadata path', () => {
    const filePath = '/path/to/file.txt';
    const metadataPath = metadataManager.getMetadataPath(filePath);
    assert.strictEqual(metadataPath, '/path/to/file.txt.meta');
  });

  // Test 2: Sauvegarde et chargement des métadonnées
  await test('saveMetadata and loadMetadata should work correctly', async () => {
    const testFile = path.join(testDir, 'test-file.txt');
    const testContent = 'Test content for metadata';
    
    // Créer un fichier de test
    await fs.writeFile(testFile, testContent);
    
    const metadata = {
      originalPath: testFile,
      compressedPath: testFile + '.gz',
      isCompressed: true,
      originalSize: testContent.length,
      compressedSize: 15,
      compressionRatio: 0.5,
      algorithm: 'gzip',
      compressedAt: new Date(),
      checksum: 'abc123'
    };
    
    // Sauvegarder les métadonnées
    await metadataManager.saveMetadata(testFile, metadata);
    
    // Charger les métadonnées
    const loadedMetadata = await metadataManager.loadMetadata(testFile);
    
    assert.strictEqual(loadedMetadata.originalPath, metadata.originalPath);
    assert.strictEqual(loadedMetadata.isCompressed, metadata.isCompressed);
    assert.strictEqual(loadedMetadata.algorithm, metadata.algorithm);
    assert.strictEqual(loadedMetadata.checksum, metadata.checksum);
    assert(loadedMetadata.savedAt); // Doit avoir un timestamp
    assert.strictEqual(loadedMetadata.version, '1.0');
  });

  // Test 3: Vérification d'existence des métadonnées
  await test('hasMetadata should detect existing metadata', async () => {
    const testFile = path.join(testDir, 'test-has-metadata.txt');
    await fs.writeFile(testFile, 'test');
    
    // Initialement, pas de métadonnées
    const hasBefore = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasBefore, false);
    
    // Sauvegarder des métadonnées
    await metadataManager.saveMetadata(testFile, { test: 'data' });
    
    // Maintenant, doit détecter les métadonnées
    const hasAfter = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasAfter, true);
  });

  // Test 4: Calcul de checksum
  await test('calculateChecksum should calculate correct checksum', async () => {
    const testFile = path.join(testDir, 'checksum-test.txt');
    const testContent = 'Content for checksum test';
    
    await fs.writeFile(testFile, testContent);
    
    const checksum = await metadataManager.calculateChecksum(testFile);
    
    assert(typeof checksum === 'string');
    assert(checksum.length === 64); // SHA256 produit 64 caractères hex
    
    // Vérifier que le même contenu produit le même checksum
    const checksum2 = await metadataManager.calculateChecksum(testFile);
    assert.strictEqual(checksum, checksum2);
  });

  // Test 5: Validation d'intégrité
  await test('validateIntegrity should validate file integrity', async () => {
    const testFile = path.join(testDir, 'integrity-test.txt');
    const testContent = 'Content for integrity test';
    
    await fs.writeFile(testFile, testContent);
    
    // Calculer le checksum correct
    const correctChecksum = await metadataManager.calculateChecksum(testFile);
    
    // Sauvegarder les métadonnées avec le bon checksum
    await metadataManager.saveMetadata(testFile, {
      checksum: correctChecksum
    });
    
    // La validation doit réussir
    const isValid = await metadataManager.validateIntegrity(testFile);
    assert.strictEqual(isValid, true);
    
    // Modifier le fichier
    await fs.writeFile(testFile, testContent + ' modified');
    
    // La validation doit échouer
    const isValidAfter = await metadataManager.validateIntegrity(testFile);
    assert.strictEqual(isValidAfter, false);
  });

  // Test 6: Suppression des métadonnées
  await test('deleteMetadata should remove metadata file', async () => {
    const testFile = path.join(testDir, 'delete-test.txt');
    await fs.writeFile(testFile, 'test');
    
    // Sauvegarder des métadonnées
    await metadataManager.saveMetadata(testFile, { test: 'data' });
    
    // Vérifier qu'elles existent
    const hasBefore = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasBefore, true);
    
    // Supprimer les métadonnées
    await metadataManager.deleteMetadata(testFile);
    
    // Vérifier qu'elles n'existent plus
    const hasAfter = await metadataManager.hasMetadata(testFile);
    assert.strictEqual(hasAfter, false);
  });

  // Test 7: Chargement de métadonnées inexistantes
  await test('loadMetadata should return null for non-existent metadata', async () => {
    const nonExistentFile = path.join(testDir, 'non-existent.txt');
    
    const metadata = await metadataManager.loadMetadata(nonExistentFile);
    assert.strictEqual(metadata, null);
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