/**
 * Utilitaire de diagnostic pour le système de statistiques de compression
 * Aide à identifier et résoudre les problèmes de collecte de statistiques
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

async function diagnoseCompressionStats() {
  console.log('=== Diagnostic du système de statistiques de compression ===\n');

  const issues = [];
  const recommendations = [];

  try {
    // 1. Vérifier la disponibilité des modules
    console.log('1. Vérification des modules...');
    
    try {
      const CompressionStats = require('./lib/compression/CompressionStats');
      const CompressionService = require('./lib/compression/CompressionService');
      const CompressionConfig = require('./lib/compression/CompressionConfig');
      const FileStorageMiddleware = require('./lib/compression/FileStorageMiddleware');
      console.log('✓ Tous les modules sont disponibles');
    } catch (error) {
      issues.push(`Module manquant: ${error.message}`);
      console.log(`✗ Erreur de module: ${error.message}`);
    }

    // 2. Vérifier le dossier temp
    console.log('\n2. Vérification du dossier temp...');
    const tempDir = path.join(__dirname, 'temp');
    
    try {
      await fs.access(tempDir);
      console.log('✓ Dossier temp existe');
    } catch (error) {
      try {
        await fs.mkdir(tempDir, { recursive: true });
        console.log('✓ Dossier temp créé');
      } catch (createError) {
        issues.push(`Impossible de créer le dossier temp: ${createError.message}`);
        console.log(`✗ Erreur création dossier temp: ${createError.message}`);
      }
    }

    // 3. Vérifier le fichier de statistiques
    console.log('\n3. Vérification du fichier de statistiques...');
    const statsPath = path.join(tempDir, 'compression-stats.json');
    
    try {
      const stats = await fs.stat(statsPath);
      console.log(`✓ Fichier de statistiques existe (${stats.size} bytes, modifié: ${stats.mtime.toLocaleString()})`);
      
      // Vérifier le contenu
      try {
        const content = await fs.readFile(statsPath, 'utf8');
        const data = JSON.parse(content);
        
        console.log(`   - Fichiers traités: ${data.totalFilesProcessed || 0}`);
        console.log(`   - Fichiers compressés: ${data.totalFilesCompressed || 0}`);
        console.log(`   - Espace économisé: ${data.totalSpaceSaved || 0} bytes`);
        
        if (data.totalFilesProcessed === 0) {
          issues.push('Aucune statistique collectée - le système ne semble pas fonctionner');
          recommendations.push('Vérifier que le middleware FileStorageMiddleware reçoit bien l\'instance CompressionStats');
        }
        
      } catch (parseError) {
        issues.push(`Fichier de statistiques corrompu: ${parseError.message}`);
        console.log(`✗ Contenu invalide: ${parseError.message}`);
      }
      
    } catch (error) {
      console.log('ℹ Fichier de statistiques n\'existe pas encore (normal au premier démarrage)');
      recommendations.push('Le fichier sera créé automatiquement lors de la première opération de compression');
    }

    // 4. Tester la création d'instance CompressionStats
    console.log('\n4. Test de création d\'instance CompressionStats...');
    
    try {
      const CompressionStats = require('./lib/compression/CompressionStats');
      const stats = new CompressionStats();
      
      // Test d'enregistrement
      stats.recordCompression({
        filePath: '/test/diagnostic.txt',
        originalSize: 1000,
        compressedSize: 400,
        fileType: '.txt',
        success: true
      });
      
      const globalStats = stats.getGlobalStats();
      if (globalStats.totalFilesProcessed === 1 && globalStats.totalFilesCompressed === 1) {
        console.log('✓ CompressionStats fonctionne correctement');
      } else {
        issues.push('CompressionStats ne collecte pas correctement les données');
      }
      
    } catch (error) {
      issues.push(`Erreur CompressionStats: ${error.message}`);
      console.log(`✗ Erreur CompressionStats: ${error.message}`);
    }

    // 5. Vérifier l'intégration dans routes/index.js
    console.log('\n5. Vérification de l\'intégration dans routes/index.js...');
    
    try {
      const routesPath = path.join(__dirname, 'routes', 'index.js');
      const routesContent = await fs.readFile(routesPath, 'utf8');
      
      const checks = [
        { pattern: /const CompressionStats = require/, name: 'Import CompressionStats' },
        { pattern: /compressionStats.*=.*new CompressionStats/, name: 'Création instance CompressionStats' },
        { pattern: /FileStorageMiddleware.*compressionStats/, name: 'Passage stats au middleware' },
        { pattern: /saveCompressionStats/, name: 'Fonction de sauvegarde' }
      ];
      
      for (const check of checks) {
        if (check.pattern.test(routesContent)) {
          console.log(`✓ ${check.name}`);
        } else {
          issues.push(`Manque dans routes/index.js: ${check.name}`);
          console.log(`✗ ${check.name}`);
        }
      }
      
    } catch (error) {
      issues.push(`Impossible de vérifier routes/index.js: ${error.message}`);
    }

    // 6. Vérifier les permissions
    console.log('\n6. Vérification des permissions...');
    
    try {
      const testFile = path.join(tempDir, 'permission-test.json');
      await fs.writeFile(testFile, '{"test": true}');
      await fs.unlink(testFile);
      console.log('✓ Permissions d\'écriture OK');
    } catch (error) {
      issues.push(`Problème de permissions: ${error.message}`);
      console.log(`✗ Permissions: ${error.message}`);
    }

    // 7. Vérifier la configuration globale
    console.log('\n7. Vérification de la configuration globale...');
    
    if (global.compressionConfig) {
      console.log('✓ Configuration globale disponible');
      console.log(`   - Niveau: ${global.compressionConfig.compressionLevel}`);
      console.log(`   - Algorithme: ${global.compressionConfig.algorithm}`);
    } else {
      issues.push('Configuration globale non initialisée');
      recommendations.push('Vérifier l\'initialisation dans app.js');
    }

    // 8. Résumé et recommandations
    console.log('\n=== Résumé du diagnostic ===');
    
    if (issues.length === 0) {
      console.log('🎉 Aucun problème détecté ! Le système devrait fonctionner correctement.');
    } else {
      console.log(`⚠️  ${issues.length} problème(s) détecté(s):`);
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    if (recommendations.length > 0) {
      console.log('\n📋 Recommandations:');
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    // 9. Actions correctives automatiques
    console.log('\n=== Actions correctives ===');
    
    if (issues.some(issue => issue.includes('dossier temp'))) {
      try {
        await fs.mkdir(tempDir, { recursive: true });
        console.log('✓ Dossier temp créé');
      } catch (error) {
        console.log(`✗ Impossible de créer le dossier temp: ${error.message}`);
      }
    }
    
    if (issues.some(issue => issue.includes('Aucune statistique collectée'))) {
      console.log('ℹ Pour tester la collecte de statistiques, uploadez un fichier via l\'interface web');
    }

    return {
      success: issues.length === 0,
      issues,
      recommendations
    };

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error.message);
    return {
      success: false,
      issues: [`Erreur générale: ${error.message}`],
      recommendations: ['Vérifier l\'installation et la configuration du système']
    };
  }
}

async function fixCommonIssues() {
  console.log('\n=== Correction automatique des problèmes courants ===\n');

  try {
    // 1. Créer le dossier temp s'il n'existe pas
    const tempDir = path.join(__dirname, 'temp');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      console.log('✓ Dossier temp vérifié/créé');
    } catch (error) {
      console.log(`✗ Erreur création dossier temp: ${error.message}`);
    }

    // 2. Créer un fichier de statistiques vide s'il n'existe pas
    const statsPath = path.join(tempDir, 'compression-stats.json');
    try {
      await fs.access(statsPath);
      console.log('✓ Fichier de statistiques existe déjà');
    } catch (error) {
      const emptyStats = {
        totalFilesProcessed: 0,
        totalFilesCompressed: 0,
        totalSpaceSaved: 0,
        averageCompressionRatio: 0,
        compressionsByType: {},
        lastUpdated: new Date().toISOString()
      };
      
      await fs.writeFile(statsPath, JSON.stringify(emptyStats, null, 2));
      console.log('✓ Fichier de statistiques vide créé');
    }

    // 3. Vérifier et corriger les permissions
    try {
      const testFile = path.join(tempDir, 'permission-test.json');
      await fs.writeFile(testFile, '{"test": true}');
      await fs.unlink(testFile);
      console.log('✓ Permissions vérifiées');
    } catch (error) {
      console.log(`✗ Problème de permissions: ${error.message}`);
    }

    console.log('\n✅ Corrections automatiques terminées');

  } catch (error) {
    console.error('❌ Erreur lors des corrections:', error.message);
  }
}

// Interface en ligne de commande
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'fix':
      await fixCommonIssues();
      break;
      
    case 'diagnose':
    default:
      const result = await diagnoseCompressionStats();
      
      if (!result.success) {
        console.log('\n💡 Essayez: node diagnose-compression-stats.js fix');
        process.exit(1);
      }
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  diagnoseCompressionStats,
  fixCommonIssues
};