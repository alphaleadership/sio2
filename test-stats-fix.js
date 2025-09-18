/**
 * Script de test rapide pour vérifier le correctif des statistiques de compression
 */

const path = require('path');
const fs = require('fs').promises;

async function testStatsFix() {
  console.log('=== Test du correctif des statistiques de compression ===\n');

  try {
    // 1. Vérifier que les modules se chargent correctement
    console.log('1. Chargement des modules...');
    const CompressionStats = require('./lib/compression/CompressionStats');
    const CompressionService = require('./lib/compression/CompressionService');
    const CompressionConfig = require('./lib/compression/CompressionConfig');
    const FileStorageMiddleware = require('./lib/compression/FileStorageMiddleware');
    console.log('✓ Modules chargés avec succès\n');

    // 2. Créer les instances comme dans routes/index.js
    console.log('2. Création des instances...');
    const config = new CompressionConfig();
    const service = new CompressionService();
    const stats = new CompressionStats();
    const middleware = new FileStorageMiddleware(service, config, stats);
    console.log('✓ Instances créées avec succès\n');

    // 3. Vérifier que le middleware a bien reçu les statistiques
    console.log('3. Vérification de l\'intégration...');
    if (middleware.stats) {
      console.log('✓ Le middleware a bien reçu l\'instance de statistiques');
    } else {
      console.log('✗ Le middleware n\'a pas reçu l\'instance de statistiques');
      return false;
    }

    // 4. Simuler des opérations de compression
    console.log('\n4. Simulation d\'opérations...');
    
    // Simuler 3 compressions réussies
    middleware._recordCompressionStats('/test/file1.txt', 1000, 400, true);
    middleware._recordCompressionStats('/test/file2.js', 2000, 800, true);
    middleware._recordCompressionStats('/test/file3.css', 1500, 600, true);
    
    // Simuler 1 compression échouée
    middleware._recordCompressionStats('/test/image.jpg', 500000, 500000, false);
    
    console.log('✓ 4 opérations simulées\n');

    // 5. Vérifier les statistiques
    console.log('5. Vérification des statistiques...');
    const globalStats = stats.getGlobalStats();
    
    console.log(`   - Fichiers traités: ${globalStats.totalFilesProcessed}`);
    console.log(`   - Fichiers compressés: ${globalStats.totalFilesCompressed}`);
    console.log(`   - Taux de compression: ${globalStats.compressionRate.toFixed(1)}%`);
    console.log(`   - Espace économisé: ${globalStats.formattedSpaceSaved}`);
    
    // Vérifications
    const expectedProcessed = 4;
    const expectedCompressed = 3;
    const expectedSpaceSaved = (1000-400) + (2000-800) + (1500-600); // 2300
    
    if (globalStats.totalFilesProcessed !== expectedProcessed) {
      console.log(`✗ Erreur: attendu ${expectedProcessed} fichiers traités, obtenu ${globalStats.totalFilesProcessed}`);
      return false;
    }
    
    if (globalStats.totalFilesCompressed !== expectedCompressed) {
      console.log(`✗ Erreur: attendu ${expectedCompressed} fichiers compressés, obtenu ${globalStats.totalFilesCompressed}`);
      return false;
    }
    
    if (globalStats.totalSpaceSaved !== expectedSpaceSaved) {
      console.log(`✗ Erreur: attendu ${expectedSpaceSaved} bytes économisés, obtenu ${globalStats.totalSpaceSaved}`);
      return false;
    }
    
    console.log('✓ Toutes les statistiques sont correctes\n');

    // 6. Tester la sauvegarde
    console.log('6. Test de sauvegarde...');
    const tempDir = path.join(__dirname, 'temp');
    const statsPath = path.join(tempDir, 'test-stats-fix.json');
    
    // Créer le dossier si nécessaire
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // Ignorer si le dossier existe déjà
    }
    
    // Sauvegarder
    await stats.saveToFile(statsPath);
    console.log('✓ Statistiques sauvegardées');
    
    // Vérifier que le fichier existe
    const fileStats = await fs.stat(statsPath);
    console.log(`✓ Fichier créé (${fileStats.size} bytes)\n`);
    
    // 7. Tester le chargement
    console.log('7. Test de chargement...');
    const loadedStats = await CompressionStats.loadFromFile(statsPath);
    const loadedGlobalStats = loadedStats.getGlobalStats();
    
    if (loadedGlobalStats.totalFilesProcessed === globalStats.totalFilesProcessed &&
        loadedGlobalStats.totalFilesCompressed === globalStats.totalFilesCompressed &&
        loadedGlobalStats.totalSpaceSaved === globalStats.totalSpaceSaved) {
      console.log('✓ Chargement vérifié avec succès');
    } else {
      console.log('✗ Erreur lors du chargement des statistiques');
      return false;
    }
    
    // 8. Nettoyer le fichier de test
    try {
      await fs.unlink(statsPath);
      console.log('✓ Fichier de test nettoyé\n');
    } catch (error) {
      // Ignorer si le fichier n'existe pas
    }

    console.log('🎉 Tous les tests sont passés ! Le système de statistiques fonctionne correctement.\n');
    
    console.log('📋 Prochaines étapes:');
    console.log('   1. Redémarrer l\'application pour appliquer les changements');
    console.log('   2. Uploader quelques fichiers pour tester en conditions réelles');
    console.log('   3. Consulter /admin/compression-stats pour voir les résultats');
    
    return true;

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message);
    console.error(error.stack);
    return false;
  }
}

// Exécuter le test
if (require.main === module) {
  testStatsFix()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { testStatsFix };