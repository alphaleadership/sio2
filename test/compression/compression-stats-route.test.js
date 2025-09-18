const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs').promises;

// Mock des modules nécessaires pour le test
const CompressionStats = require('../../lib/compression/CompressionStats');

describe('Compression Stats Route Tests', () => {
  test('CompressionStats peut générer un rapport vide', async () => {
    const stats = new CompressionStats();
    const report = stats.generateReport();
    
    assert.strictEqual(report.summary.totalFilesProcessed, 0);
    assert.strictEqual(report.summary.totalFilesCompressed, 0);
    assert.strictEqual(report.summary.totalSpaceSaved, 0);
    assert.strictEqual(typeof report.byFileType, 'object');
    assert.strictEqual(Array.isArray(report.topPerformers.mostEfficient), true);
    assert.strictEqual(Array.isArray(report.topPerformers.mostSpaceSaved), true);
  });

  test('CompressionStats peut enregistrer et générer des statistiques', async () => {
    const stats = new CompressionStats();
    
    // Simuler quelques compressions
    stats.recordCompression({
      filePath: '/test/file1.txt',
      originalSize: 1000,
      compressedSize: 600,
      fileType: '.txt',
      success: true
    });
    
    stats.recordCompression({
      filePath: '/test/file2.js',
      originalSize: 2000,
      compressedSize: 1200,
      fileType: '.js',
      success: true
    });
    
    const report = stats.generateReport();
    
    assert.strictEqual(report.summary.totalFilesProcessed, 2);
    assert.strictEqual(report.summary.totalFilesCompressed, 2);
    assert.strictEqual(report.summary.totalSpaceSaved, 600);
    assert.strictEqual(Object.keys(report.byFileType).length, 2);
    assert.ok(report.byFileType['.txt']);
    assert.ok(report.byFileType['.js']);
  });

  test('Route handler peut traiter les statistiques vides', async () => {
    // Créer un fichier de stats vide temporaire
    const tempStatsPath = path.join(__dirname, '..', 'temp', 'test-compression-stats.json');
    
    try {
      // Créer le dossier temp s'il n'existe pas
      await fs.mkdir(path.dirname(tempStatsPath), { recursive: true });
      
      // Charger les statistiques depuis un fichier inexistant (devrait créer une instance vide)
      const stats = await CompressionStats.loadFromFile(tempStatsPath);
      const report = stats.generateReport();
      
      // Vérifier que le rapport est valide même sans données
      assert.strictEqual(typeof report, 'object');
      assert.strictEqual(typeof report.summary, 'object');
      assert.strictEqual(typeof report.byFileType, 'object');
      assert.strictEqual(typeof report.topPerformers, 'object');
      assert.strictEqual(report.summary.totalFilesProcessed, 0);
      
    } catch (error) {
      // Nettoyer en cas d'erreur
      try {
        await fs.unlink(tempStatsPath);
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      throw error;
    }
  });

  test('Formatage des bytes fonctionne correctement', () => {
    const stats = new CompressionStats();
    
    // Tester la méthode privée via une compression
    stats.recordCompression({
      filePath: '/test/large.txt',
      originalSize: 1048576, // 1 MB
      compressedSize: 524288, // 512 KB
      fileType: '.txt',
      success: true
    });
    
    const formatted = stats.getFormattedSpaceSaved();
    assert.ok(formatted.includes('KB') || formatted.includes('MB'));
  });
});