/**
 * Test d'intégration du système de statistiques de compression
 * Vérifie que les statistiques sont correctement collectées et sauvegardées
 */

const path = require('path');
const fs = require('fs').promises;
const CompressionStats = require('./lib/compression/CompressionStats');
const CompressionService = require('./lib/compression/CompressionService');
const CompressionConfig = require('./lib/compression/CompressionConfig');
const FileStorageMiddleware = require('./lib/compression/FileStorageMiddleware');

async function testCompressionStatsIntegration() {
  console.log('=== Test d\'intégration des statistiques de compression ===\n');

  try {
    // 1. Créer les instances nécessaires
    console.log('1. Initialisation des composants...');
    const config = new CompressionConfig();
    const service = new CompressionService();
    const stats = new CompressionStats();
    const middleware = new FileStorageMiddleware(service, config, stats);
    
    console.log('✓ Composants initialisés\n');

    // 2. Simuler des opérations de compression via le middleware
    console.log('2. Simulation d\'opérations de compression...');
    
    // Simuler une compression réussie
    middleware._recordCompressionStats('/test/document.txt', 5000, 2000, true);
    middleware._recordCompressionStats('/test/script.js', 8000, 3200, true);
    middleware._recordCompressionStats('/test/style.css', 3000, 1200, true);
    
    // Simuler une compression échouée
    middleware._recordCompressionStats('/test/image.jpg', 2000000, 2000000, false);
    middleware._recordCompressionStats('/test/video.mp4', 50000000, 50000000, false);
    
    console.log('✓ 5 opérations simulées\n');

    // 3. Vérifier les statistiques globales
    console.log('3. Vérification des statistiques globales...');
    const globalStats = stats.getGlobalStats();
    
    console.log(`   - Fichiers traités: ${globalStats.totalFilesProcessed}`);
    console.log(`   - Fichiers compressés: ${globalStats.totalFilesCompressed}`);
    console.log(`   - Taux de compression: ${globalStats.compressionRate.toFixed(1)}%`);
    console.log(`   - Espace économisé: ${globalStats.formattedSpaceSaved}`);
    console.log(`   - Ratio moyen: ${(globalStats.averageCompressionRatio * 100).toFixed(1)}%`);
    
    // Vérifications
    if (globalStats.totalFilesProcessed !== 5) {
      throw new Error(`Attendu 5 fichiers traités, obtenu ${globalStats.totalFilesProcessed}`);
    }
    if (globalStats.totalFilesCompressed !== 3) {
      throw new Error(`Attendu 3 fichiers compressés, obtenu ${globalStats.totalFilesCompressed}`);
    }
    if (globalStats.totalSpaceSaved !== 6800) { // (5000-2000) + (8000-3200) + (3000-1200)
      throw new Error(`Attendu 6800 bytes économisés, obtenu ${globalStats.totalSpaceSaved}`);
    }
    
    console.log('✓ Statistiques globales correctes\n');

    // 4. Vérifier les statistiques par type
    console.log('4. Vérification des statistiques par type...');
    const statsByType = stats.getStatsByType();
    
    const expectedTypes = ['.txt', '.js', '.css', '.jpg', '.mp4'];
    for (const type of expectedTypes) {
      if (!statsByType[type]) {
        throw new Error(`Type ${type} manquant dans les statistiques`);
      }
      console.log(`   ${type}: ${statsByType[type].filesProcessed} traités, ${statsByType[type].filesCompressed} compressés`);
    }
    
    console.log('✓ Statistiques par type correctes\n');

    // 5. Tester la sauvegarde et le chargement
    console.log('5. Test de sauvegarde et chargement...');
    const testStatsPath = path.join(__dirname, 'temp', 'test-compression-stats.json');
    
    // Sauvegarder
    await stats.saveToFile(testStatsPath);
    console.log('✓ Statistiques sauvegardées');
    
    // Charger dans une nouvelle instance
    const loadedStats = await CompressionStats.loadFromFile(testStatsPath);
    const loadedGlobalStats = loadedStats.getGlobalStats();
    
    // Vérifier que les données sont identiques
    if (loadedGlobalStats.totalFilesProcessed !== globalStats.totalFilesProcessed) {
      throw new Error('Données chargées différentes des données originales');
    }
    
    console.log('✓ Chargement vérifié\n');

    // 6. Tester la génération de rapport
    console.log('6. Test de génération de rapport...');
    const report = stats.generateReport();
    
    if (!report.summary || !report.byFileType || !report.topPerformers) {
      throw new Error('Structure de rapport invalide');
    }
    
    console.log(`   Résumé: ${report.summary.efficiency}`);
    console.log(`   Types de fichiers: ${Object.keys(report.byFileType).length}`);
    console.log(`   Meilleurs performers: ${report.topPerformers.mostEfficient.length}`);
    
    console.log('✓ Rapport généré correctement\n');

    // 7. Nettoyer le fichier de test
    try {
      await fs.unlink(testStatsPath);
      console.log('✓ Fichier de test nettoyé\n');
    } catch (error) {
      // Ignorer si le fichier n'existe pas
    }

    console.log('=== Test d\'intégration réussi ===');
    return true;

  } catch (error) {
    console.error('❌ Erreur lors du test d\'intégration:', error.message);
    return false;
  }
}

async function testRealTimeStatsSaving() {
  console.log('\n=== Test de sauvegarde en temps réel ===\n');

  try {
    // Créer une instance de middleware avec sauvegarde automatique
    const config = new CompressionConfig();
    const service = new CompressionService();
    const stats = new CompressionStats();
    const middleware = new FileStorageMiddleware(service, config, stats);
    
    const testStatsPath = path.join(__dirname, 'temp', 'realtime-stats-test.json');
    
    // Simuler plusieurs opérations rapides
    console.log('Simulation d\'opérations rapides...');
    for (let i = 0; i < 10; i++) {
      middleware._recordCompressionStats(`/test/file${i}.txt`, 1000 + i * 100, 500 + i * 50, true);
    }
    
    // Attendre que la sauvegarde automatique se déclenche
    console.log('Attente de la sauvegarde automatique...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Vérifier que le fichier a été créé
    try {
      const fileStats = await fs.stat(testStatsPath);
      console.log(`✓ Fichier de statistiques créé (${fileStats.size} bytes)`);
      
      // Charger et vérifier le contenu
      const loadedStats = await CompressionStats.loadFromFile(testStatsPath);
      const globalStats = loadedStats.getGlobalStats();
      
      if (globalStats.totalFilesProcessed === 10) {
        console.log('✓ Sauvegarde automatique fonctionne correctement');
      } else {
        console.log(`✗ Données incorrectes: ${globalStats.totalFilesProcessed} au lieu de 10`);
      }
      
      // Nettoyer
      await fs.unlink(testStatsPath);
      
    } catch (error) {
      console.log('✗ Fichier de statistiques non trouvé ou erreur:', error.message);
    }

  } catch (error) {
    console.error('❌ Erreur lors du test de sauvegarde temps réel:', error.message);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  testCompressionStatsIntegration()
    .then(success => {
      if (success) {
        return testRealTimeStatsSaving();
      }
    })
    .then(() => {
      console.log('\n🎉 Tous les tests terminés');
    })
    .catch(error => {
      console.error('Erreur générale:', error);
      process.exit(1);
    });
}

module.exports = {
  testCompressionStatsIntegration,
  testRealTimeStatsSaving
};