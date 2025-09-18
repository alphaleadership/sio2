/**
 * Exemple d'utilisation du système de statistiques de compression
 * Démontre comment intégrer et utiliser CompressionStats et StatsManager
 */

const { createCompressionSystem, StatsManager } = require('../lib/compression');
const path = require('path');

async function demonstrateCompressionStats() {
  console.log('=== Démonstration du système de statistiques de compression ===\n');

  try {
    // 1. Créer le système de compression avec statistiques
    console.log('1. Initialisation du système de compression...');
    const compressionSystem = await createCompressionSystem({
      dataDir: path.join(__dirname, '../data')
    });

    const { stats, statsManager } = compressionSystem;
    console.log('✓ Système initialisé avec succès\n');

    // 2. Simuler quelques opérations de compression
    console.log('2. Simulation d\'opérations de compression...');

    // Compression réussie d'un fichier texte
    stats.recordCompression({
      filePath: '/uploads/document.txt',
      originalSize: 5000,
      compressedSize: 2000,
      fileType: '.txt',
      success: true
    });

    // Compression réussie d'un fichier JavaScript
    stats.recordCompression({
      filePath: '/uploads/script.js',
      originalSize: 8000,
      compressedSize: 3200,
      fileType: '.js',
      success: true
    });

    // Compression échouée d'un fichier image
    stats.recordCompression({
      filePath: '/uploads/photo.jpg',
      originalSize: 2000000,
      compressedSize: 2000000,
      fileType: '.jpg',
      success: false
    });

    // Compression réussie d'un autre fichier texte
    stats.recordCompression({
      filePath: '/uploads/readme.md',
      originalSize: 3000,
      compressedSize: 1200,
      fileType: '.md',
      success: true
    });

    console.log('✓ 4 opérations simulées\n');

    // 3. Afficher les statistiques globales
    console.log('3. Statistiques globales:');
    const globalStats = statsManager.getGlobalStats();
    console.log(`   - Fichiers traités: ${globalStats.totalFilesProcessed}`);
    console.log(`   - Fichiers compressés: ${globalStats.totalFilesCompressed}`);
    console.log(`   - Taux de compression: ${globalStats.compressionRate.toFixed(1)}%`);
    console.log(`   - Espace économisé: ${globalStats.formattedSpaceSaved}`);
    console.log(`   - Ratio de compression moyen: ${(globalStats.averageCompressionRatio * 100).toFixed(1)}%\n`);

    // 4. Afficher les statistiques par type de fichier
    console.log('4. Statistiques par type de fichier:');
    const statsByType = statsManager.getStatsByType();

    for (const [fileType, typeStats] of Object.entries(statsByType)) {
      console.log(`   ${fileType}:`);
      console.log(`     - Fichiers traités: ${typeStats.filesProcessed}`);
      console.log(`     - Fichiers compressés: ${typeStats.filesCompressed}`);
      console.log(`     - Taux de compression: ${typeStats.compressionRate.toFixed(1)}%`);
      console.log(`     - Espace économisé: ${typeStats.formattedSpaceSaved}`);
      console.log(`     - Ratio moyen: ${(typeStats.averageCompressionRatio * 100).toFixed(1)}%`);
    }
    console.log();

    // 5. Générer un rapport complet
    console.log('5. Rapport complet:');
    const report = statsManager.generateReport();

    console.log(`   Résumé: ${report.summary.efficiency}`);
    console.log(`   Types les plus efficaces:`);
    report.topPerformers.mostEfficient.slice(0, 3).forEach((performer, index) => {
      console.log(`     ${index + 1}. ${performer.type} - ${(performer.compressionRatio * 100).toFixed(1)}% de ratio`);
    });

    console.log(`   Types économisant le plus d'espace:`);
    report.topPerformers.mostSpaceSaved.slice(0, 3).forEach((performer, index) => {
      const formattedSize = formatBytes(performer.spaceSaved);
      console.log(`     ${index + 1}. ${performer.type} - ${formattedSize} économisés`);
    });
    console.log();

    // 6. Sauvegarder les statistiques
    console.log('6. Sauvegarde des statistiques...');
    await statsManager.save();
    console.log('✓ Statistiques sauvegardées\n');

    // 7. Fermer proprement le gestionnaire
    console.log('7. Fermeture du gestionnaire...');
    await statsManager.close();
    console.log('✓ Gestionnaire fermé proprement\n');

    console.log('=== Démonstration terminée avec succès ===');

  } catch (error) {
    console.error('❌ Erreur lors de la démonstration:', error.message);
    process.exit(1);
  }
}

/**
 * Utilitaire pour formater les bytes en format lisible
 * @param {number} bytes - Nombre de bytes
 * @returns {string} Taille formatée
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Exemple d'intégration dans une application Express
function createExpressIntegrationExample() {
  console.log('\n=== Exemple d\'intégration Express ===\n');

  const exampleCode = `
// app.js - Intégration dans une application Express
const express = require('express');
const { createCompressionSystem } = require('./lib/compression');

async function setupApp() {
  const app = express();
  
  // Initialiser le système de compression
  const compressionSystem = await createCompressionSystem({
    dataDir: './data',
    compressionLevel: 6,
    minFileSize: 1024
  });
  
  const { middleware, statsManager } = compressionSystem;
  
  // Utiliser le middleware de compression pour les uploads
  app.use('/upload', middleware.createUploadMiddleware());
  
  // Route pour consulter les statistiques
  app.get('/admin/compression-stats', (req, res) => {
    const report = statsManager.generateReport();
    res.json(report);
  });
  
  // Route pour obtenir les statistiques globales
  app.get('/api/compression/stats', (req, res) => {
    const globalStats = statsManager.getGlobalStats();
    res.json(globalStats);
  });
  
  // Route pour obtenir les statistiques par type
  app.get('/api/compression/stats/:type', (req, res) => {
    const typeStats = statsManager.getStatsByType(req.params.type);
    res.json(typeStats);
  });
  
  // Fermeture propre lors de l'arrêt de l'application
  process.on('SIGINT', async () => {
    console.log('Fermeture de l\\'application...');
    await statsManager.close();
    process.exit(0);
  });
  
  return app;
}

module.exports = { setupApp };
`;

  console.log(exampleCode);
}

// Exécuter la démonstration si ce fichier est appelé directement
if (require.main === module) {
  demonstrateCompressionStats()
    .then(() => {
      createExpressIntegrationExample();
    })
    .catch(console.error);
}

module.exports = {
  demonstrateCompressionStats,
  createExpressIntegrationExample
};