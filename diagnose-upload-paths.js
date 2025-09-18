/**
 * Diagnostic des problèmes de chemin d'upload
 * Aide à identifier et résoudre les problèmes de dossier de destination
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

async function diagnoseUploadPaths() {
  console.log('=== Diagnostic des chemins d\'upload ===\n');

  const issues = [];
  const recommendations = [];

  try {
    // 1. Vérifier la structure des dossiers de base
    console.log('1. Vérification de la structure des dossiers...');
    
    const baseDir = path.resolve("../partage");
    console.log(`   Dossier de base: ${baseDir}`);
    
    try {
      const baseStat = await fs.stat(baseDir);
      if (baseStat.isDirectory()) {
        console.log('   ✓ Dossier de base existe');
      } else {
        issues.push('Le dossier de base n\'est pas un dossier');
      }
    } catch (error) {
      issues.push(`Dossier de base inaccessible: ${error.message}`);
      recommendations.push('Créer le dossier de base ../partage');
    }
    
    // Vérifier les sous-dossiers importants
    const importantDirs = ['global', 'users'];
    for (const dir of importantDirs) {
      const dirPath = path.join(baseDir, dir);
      try {
        await fs.access(dirPath);
        console.log(`   ✓ Dossier ${dir} existe`);
      } catch (error) {
        console.log(`   ℹ Dossier ${dir} n'existe pas (sera créé automatiquement)`);
      }
    }

    // 2. Vérifier le dossier temporaire d'upload
    console.log('\n2. Vérification du dossier temporaire...');
    
    const tmpUploadDir = path.join(baseDir, '..', 'tmp_uploads');
    console.log(`   Dossier temporaire: ${tmpUploadDir}`);
    
    try {
      const tmpStat = await fs.stat(tmpUploadDir);
      if (tmpStat.isDirectory()) {
        console.log('   ✓ Dossier temporaire existe');
        
        // Vérifier les permissions
        try {
          const testFile = path.join(tmpUploadDir, 'test-permission.tmp');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
          console.log('   ✓ Permissions d\'écriture OK');
        } catch (permError) {
          issues.push(`Problème de permissions sur le dossier temporaire: ${permError.message}`);
        }
      } else {
        issues.push('Le dossier temporaire n\'est pas un dossier');
      }
    } catch (error) {
      issues.push(`Dossier temporaire inaccessible: ${error.message}`);
      recommendations.push('Créer le dossier temporaire tmp_uploads');
    }

    // 3. Simuler différents scénarios d'upload
    console.log('\n3. Simulation des scénarios d\'upload...');
    
    const uploadScenarios = [
      {
        name: 'Upload à la racine',
        bodyPath: '',
        fileName: 'test.txt',
        webkitRelativePath: undefined
      },
      {
        name: 'Upload dans un dossier utilisateur',
        bodyPath: 'users/testuser',
        fileName: 'document.pdf',
        webkitRelativePath: undefined
      },
      {
        name: 'Upload de dossier avec structure',
        bodyPath: 'uploads',
        fileName: 'readme.md',
        webkitRelativePath: 'mon-projet/docs/readme.md'
      },
      {
        name: 'Upload dans le partage global',
        bodyPath: 'global',
        fileName: 'shared.txt',
        webkitRelativePath: undefined
      }
    ];
    
    for (const scenario of uploadScenarios) {
      console.log(`\n   Scénario: ${scenario.name}`);
      console.log(`   - req.body.path: "${scenario.bodyPath}"`);
      console.log(`   - Nom de fichier: ${scenario.fileName}`);
      console.log(`   - webkitRelativePath: ${scenario.webkitRelativePath || 'undefined'}`);
      
      // Simuler la logique du middleware
      const destFolder = scenario.bodyPath ? path.join(baseDir, scenario.bodyPath) : baseDir;
      console.log(`   - Dossier de destination: ${destFolder}`);
      
      // Simuler la logique de fichier
      const relPath = scenario.fileName.replace(/\\/g, '/');
      const subPath = scenario.webkitRelativePath || relPath;
      const finalPath = path.join(destFolder, subPath);
      console.log(`   - Chemin final: ${finalPath}`);
      
      // Vérifier la sécurité
      if (finalPath.startsWith(baseDir)) {
        console.log('   ✓ Chemin sécurisé');
      } else {
        console.log('   ⚠️  Chemin potentiellement dangereux');
        issues.push(`Chemin dangereux détecté pour le scénario: ${scenario.name}`);
      }
      
      // Vérifier si le dossier parent peut être créé
      const parentDir = path.dirname(finalPath);
      console.log(`   - Dossier parent: ${parentDir}`);
      
      try {
        // Simuler la création (dry run)
        const relativePath = path.relative(baseDir, parentDir);
        if (relativePath && !relativePath.startsWith('..')) {
          console.log('   ✓ Dossier parent valide');
        } else {
          console.log('   ⚠️  Dossier parent problématique');
        }
      } catch (error) {
        console.log(`   ✗ Erreur de dossier parent: ${error.message}`);
      }
    }

    // 4. Vérifier la configuration Multer
    console.log('\n4. Vérification de la configuration Multer...');
    
    try {
      // Lire le fichier routes/index.js pour vérifier la configuration
      const routesPath = path.join(__dirname, 'routes', 'index.js');
      const routesContent = await fs.readFile(routesPath, 'utf8');
      
      // Vérifier la configuration du dossier temporaire
      const multerDestMatch = routesContent.match(/dest:\s*path\.join\([^)]+\)/);
      if (multerDestMatch) {
        console.log(`   Configuration Multer trouvée: ${multerDestMatch[0]}`);
        console.log('   ✓ Configuration Multer présente');
      } else {
        issues.push('Configuration Multer non trouvée ou incorrecte');
      }
      
      // Vérifier l'utilisation du middleware
      if (routesContent.includes('fileStorageMiddleware.createUploadMiddleware()')) {
        console.log('   ✓ Middleware de compression utilisé');
      } else {
        issues.push('Middleware de compression non utilisé dans la route upload');
      }
      
    } catch (error) {
      issues.push(`Impossible de vérifier la configuration: ${error.message}`);
    }

    // 5. Tester les chemins problématiques
    console.log('\n5. Test des chemins problématiques...');
    
    const problematicPaths = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '/etc/passwd',
      'C:\\Windows\\System32',
      '../../..',
      'users/../admin'
    ];
    
    for (const problematicPath of problematicPaths) {
      console.log(`\n   Test: "${problematicPath}"`);
      
      const destFolder = path.join(baseDir, 'uploads');
      const finalPath = path.join(destFolder, problematicPath);
      
      console.log(`   - Chemin calculé: ${finalPath}`);
      console.log(`   - Dans la base: ${finalPath.startsWith(baseDir) ? 'Oui' : 'Non'}`);
      
      if (!finalPath.startsWith(baseDir)) {
        console.log('   ⚠️  Chemin dangereux détecté (sera bloqué par la sécurité)');
      } else {
        console.log('   ✓ Chemin sécurisé');
      }
    }

    // 6. Résumé et recommandations
    console.log('\n=== Résumé du diagnostic ===');
    
    if (issues.length === 0) {
      console.log('🎉 Aucun problème détecté ! Le système d\'upload devrait fonctionner correctement.');
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

    // 7. Actions correctives
    console.log('\n=== Actions correctives disponibles ===');
    console.log('   - Créer les dossiers manquants');
    console.log('   - Vérifier les permissions');
    console.log('   - Tester un upload réel');
    
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

async function fixUploadPathIssues() {
  console.log('\n=== Correction automatique des problèmes d\'upload ===\n');

  try {
    const baseDir = path.resolve("../partage");
    
    // 1. Créer le dossier de base
    try {
      await fs.mkdir(baseDir, { recursive: true });
      console.log('✓ Dossier de base vérifié/créé');
    } catch (error) {
      console.log(`✗ Erreur création dossier de base: ${error.message}`);
    }

    // 2. Créer les sous-dossiers importants
    const importantDirs = ['global', 'users'];
    for (const dir of importantDirs) {
      try {
        const dirPath = path.join(baseDir, dir);
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`✓ Dossier ${dir} vérifié/créé`);
      } catch (error) {
        console.log(`✗ Erreur création dossier ${dir}: ${error.message}`);
      }
    }

    // 3. Créer le dossier temporaire
    try {
      const tmpUploadDir = path.join(baseDir, '..', 'tmp_uploads');
      await fs.mkdir(tmpUploadDir, { recursive: true });
      console.log('✓ Dossier temporaire vérifié/créé');
    } catch (error) {
      console.log(`✗ Erreur création dossier temporaire: ${error.message}`);
    }

    // 4. Créer le dossier de téléchargements temporaires
    try {
      const tmpDownloadDir = path.join(baseDir, '..', 'tmp_downloads');
      await fs.mkdir(tmpDownloadDir, { recursive: true });
      console.log('✓ Dossier téléchargements temporaires vérifié/créé');
    } catch (error) {
      console.log(`✗ Erreur création dossier téléchargements: ${error.message}`);
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
      await fixUploadPathIssues();
      break;
      
    case 'diagnose':
    default:
      const result = await diagnoseUploadPaths();
      
      if (!result.success) {
        console.log('\n💡 Essayez: node diagnose-upload-paths.js fix');
        process.exit(1);
      }
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  diagnoseUploadPaths,
  fixUploadPathIssues
};