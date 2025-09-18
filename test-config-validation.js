/**
 * Utilitaire de test pour la validation de la configuration de compression
 * Peut être exécuté manuellement pour vérifier le bon fonctionnement
 */

const CompressionConfig = require('./lib/compression/CompressionConfig');
const path = require('path');

async function runConfigurationTests() {
  console.log('=== Tests de Configuration de Compression ===\n');
  
  let passedTests = 0;
  let totalTests = 0;
  
  function test(name, testFn) {
    totalTests++;
    try {
      testFn();
      console.log(`✓ ${name}`);
      passedTests++;
    } catch (error) {
      console.log(`✗ ${name}: ${error.message}`);
    }
  }
  
  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }
  
  // Test 1: Configuration par défaut
  test('Configuration par défaut', () => {
    const config = new CompressionConfig();
    assert(config.compressionLevel === 6, 'Niveau de compression par défaut incorrect');
    assert(config.algorithm === 'gzip', 'Algorithme par défaut incorrect');
    assert(config.minFileSize === 1024, 'Taille minimale par défaut incorrecte');
    assert(Array.isArray(config.compressibleTypes), 'Types compressibles doivent être un tableau');
  });
  
  // Test 2: Configuration personnalisée
  test('Configuration personnalisée', () => {
    const config = new CompressionConfig({
      compressionLevel: 9,
      algorithm: 'brotli',
      minFileSize: 2048
    });
    assert(config.compressionLevel === 9, 'Niveau de compression personnalisé incorrect');
    assert(config.algorithm === 'brotli', 'Algorithme personnalisé incorrect');
    assert(config.minFileSize === 2048, 'Taille minimale personnalisée incorrecte');
  });
  
  // Test 3: Validation correcte
  test('Validation configuration correcte', () => {
    const config = new CompressionConfig();
    const validation = config.validate();
    assert(validation.isValid === true, 'Configuration par défaut devrait être valide');
    assert(validation.errors.length === 0, 'Aucune erreur attendue pour configuration par défaut');
  });
  
  // Test 4: Validation niveau de compression invalide
  test('Validation niveau de compression invalide', () => {
    const config = new CompressionConfig({ compressionLevel: 15 });
    const validation = config.validate();
    assert(validation.isValid === false, 'Configuration avec niveau 15 devrait être invalide');
    assert(validation.errors.some(e => e.includes('niveau de compression')), 'Erreur de niveau de compression attendue');
  });
  
  // Test 5: Validation tailles de fichiers incohérentes
  test('Validation tailles incohérentes', () => {
    const config = new CompressionConfig({ 
      minFileSize: 1000,
      maxFileSize: 500 
    });
    const validation = config.validate();
    assert(validation.isValid === false, 'Configuration avec tailles incohérentes devrait être invalide');
    assert(validation.errors.some(e => e.includes('taille minimale doit être inférieure')), 'Erreur de tailles attendue');
  });
  
  // Test 6: Détection de fichiers compressibles
  test('Détection fichiers compressibles', () => {
    const config = new CompressionConfig({
      compressibleTypes: ['.txt', '.js'],
      excludeTypes: ['.jpg', '.png']
    });
    assert(config.isCompressible('test.txt') === true, 'Fichier .txt devrait être compressible');
    assert(config.isCompressible('script.js') === true, 'Fichier .js devrait être compressible');
    assert(config.isCompressible('image.jpg') === false, 'Fichier .jpg ne devrait pas être compressible');
    assert(config.isCompressible('document.pdf') === false, 'Fichier .pdf ne devrait pas être compressible');
  });
  
  // Test 7: Validation de taille
  test('Validation de taille de fichier', () => {
    const config = new CompressionConfig({
      minFileSize: 1000,
      maxFileSize: 10000
    });
    assert(config.isValidSize(500) === false, 'Fichier trop petit devrait être rejeté');
    assert(config.isValidSize(5000) === true, 'Fichier de taille correcte devrait être accepté');
    assert(config.isValidSize(15000) === false, 'Fichier trop gros devrait être rejeté');
  });
  
  // Test 8: Mise à jour de configuration
  test('Mise à jour de configuration', () => {
    const config = new CompressionConfig();
    const originalLevel = config.compressionLevel;
    config.update({ compressionLevel: 9 });
    assert(config.compressionLevel === 9, 'Niveau de compression devrait être mis à jour');
    assert(config.algorithm === 'gzip', 'Algorithme non modifié devrait être préservé');
  });
  
  // Test 9: Sérialisation JSON
  test('Sérialisation JSON', () => {
    const config = new CompressionConfig({
      compressionLevel: 8,
      compressibleTypes: ['.txt', '.js']
    });
    const json = config.toJSON();
    assert(json.compressionLevel === 8, 'Niveau de compression dans JSON incorrect');
    assert(Array.isArray(json.compressibleTypes), 'Types compressibles dans JSON doivent être un tableau');
    assert(json.compressibleTypes.includes('.txt'), 'Types compressibles dans JSON incorrects');
  });
  
  // Test 10: Sauvegarde et chargement de fichier
  test('Sauvegarde et chargement de fichier', async () => {
    const testPath = path.join(__dirname, 'temp', 'test-config.json');
    
    const originalConfig = new CompressionConfig({
      compressionLevel: 7,
      algorithm: 'brotli',
      minFileSize: 2048
    });
    
    // Sauvegarder
    await originalConfig.saveToFile(testPath);
    
    // Charger
    const loadedConfig = await CompressionConfig.loadFromFile(testPath);
    
    assert(loadedConfig.compressionLevel === 7, 'Niveau de compression chargé incorrect');
    assert(loadedConfig.algorithm === 'brotli', 'Algorithme chargé incorrect');
    assert(loadedConfig.minFileSize === 2048, 'Taille minimale chargée incorrecte');
    
    // Nettoyer
    const fs = require('fs').promises;
    try {
      await fs.unlink(testPath);
    } catch (e) {
      // Ignorer si le fichier n'existe pas
    }
  });
  
  console.log(`\n=== Résultats des Tests ===`);
  console.log(`Tests réussis: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('✓ Tous les tests sont passés avec succès!');
    return true;
  } else {
    console.log('✗ Certains tests ont échoué.');
    return false;
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runConfigurationTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Erreur lors de l\'exécution des tests:', error);
      process.exit(1);
    });
}

module.exports = { runConfigurationTests };