/**
 * Diagnostic spécifique pour les problèmes de création de dossier
 * Identifie les problèmes dans la logique de mkdir du FileStorageMiddleware
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

async function diagnoseFolderCreation() {
  console.log('=== Diagnostic de la création de dossiers ===\n');

  const issues = [];
  const recommendations = [];

  try {
    // 1. Tester la logique de path.dirname()
    console.log('1. Test de la logique path.dirname()...');
    
    const testCases = [
      {
        name: 'Fichier à la racine',
        destPath: '/partage/test.txt',
        expectedDir: '/partage'
      },
      {
        name: 'Fichier dans sous-dossier',
        destPath: '/partage/documents/test.txt',
        expectedDir: '/partage/documents'
      },
      {
        name: 'Fichier dans structure profonde',
        destPath: '/partage/users/john/projects/app/src/main.js',
        expectedDir: '/partage/users/john/projects/app/src'
      },
      {
        name: 'Chemin Windows',
        destPath: 'C:\\partage\\documents\\test.txt',
        expectedDir: 'C:\\partage\\documents'
      },
      {
        name: 'Chemin relatif',
        destPath: 'documents/test.txt',
        expectedDir: 'documents'
      },
      {
        name: 'Fichier sans extension',
        destPath: '/partage/documents/README',
        expectedDir: '/partage/documents'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n   Test: ${testCase.name}`);
      console.log(`   - Chemin: ${testCase.destPath}`);
      
      const dirname = path.dirname(testCase.destPath);
      console.log(`   - path.dirname(): ${dirname}`);
      console.log(`   - Attendu: ${testCase.expectedDir}`);
      
      if (dirname === testCase.expectedDir) {
        console.log('   ✓ Correct');
      } else {
        console.log('   ⚠️  Différent (peut être normal selon l\'OS)');
      }
      
      // Vérifier si le dirname est valide pour mkdir
      if (dirname && dirname !== '.' && dirname !== '/') {
        console.log('   ✓ Dirname valide pour mkdir');
      } else {
        console.log('   ⚠️  Dirname problématique pour mkdir');
        if (dirname === '.') {
          console.log('     → Dossier courant, pas besoin de créer');
        } else if (dirname === '/') {
          console.log('     → Racine système, ne pas créer');
        }
      }
    }

    // 2. Simuler la logique du middleware
    console.log('\n2. Simulation de la logique du middleware...');
    
    const baseDir = path.resolve("../partage");
    console.log(`   Base directory: ${baseDir}`);
    
    const simulationCases = [
      {
        name: 'Upload simple',
        bodyPath: 'documents',
        fileName: 'test.txt',
        webkitRelativePath: undefined
      },
      {
        name: 'Upload de dossier',
        bodyPath: 'uploads',
        fileName: 'readme.md',
        webkitRelativePath: 'mon-projet/docs/readme.md'
      },
      {
        name: 'Upload à la racine',
        bodyPath: '',
        fileName: 'root-file.txt',
        webkitRelativePath: undefined
      }
    ];
    
    for (const simCase of simulationCases) {
      console.log(`\n   Simulation: ${simCase.name}`);
      
      // Reproduire la logique du middleware
      const destFolder = simCase.bodyPath ? path.join(baseDir, simCase.bodyPath) : baseDir;
      const relPath = simCase.fileName.replace(/\\/g, '/');
      const subPath = simCase.webkitRelativePath || relPath;
      const destPath = path.join(destFolder, subPath);
      
      console.log(`   - destFolder: ${destFolder}`);
      console.log(`   - subPath: ${subPath}`);
      console.log(`   - destPath: ${destPath}`);
      
      const dirToCreate = path.dirname(destPath);
      console.log(`   - Dossier à créer: ${dirToCreate}`);
      
      // Vérifier si le dossier à créer est valide
      if (dirToCreate === destFolder) {
        console.log('   ℹ  Dossier parent = dossier de destination (pas de sous-dossier)');
      } else if (dirToCreate.startsWith(baseDir)) {
        console.log('   ✓ Dossier valide et sécurisé');
      } else {
        console.log('   ⚠️  Dossier potentiellement problématique');
        issues.push(`Dossier problématique pour ${simCase.name}: ${dirToCreate}`);
      }
      
      // Tester si on peut créer le dossier (simulation)
      try {
        const relativePath = path.relative(baseDir, dirToCreate);
        if (relativePath && !relativePath.startsWith('..')) {
          console.log('   ✓ Chemin relatif valide');
        } else {
          console.log('   ⚠️  Chemin relatif problématique');
        }
      } catch (error) {
        console.log(`   ✗ Erreur de chemin: ${error.message}`);
      }
    }

    // 3. Tester les cas problématiques
    console.log('\n3. Test des cas problématiques...');
    
    const problematicCases = [
      {
        name: 'Fichier à la racine système',
        destPath: '/test.txt'
      },
      {
        name: 'Fichier dans dossier courant',
        destPath: './test.txt'
      },
      {
        name: 'Fichier avec chemin vide',
        destPath: 'test.txt'
      },
      {
        name: 'Chemin avec doubles slashes',
        destPath: '/partage//documents//test.txt'
      }
    ];
    
    for (const probCase of problematicCases) {
      console.log(`\n   Cas problématique: ${probCase.name}`);
      console.log(`   - Chemin: ${probCase.destPath}`);
      
      const dirname = path.dirname(probCase.destPath);
      console.log(`   - dirname: ${dirname}`);
      
      if (dirname === '.' || dirname === '/' || dirname === '') {
        console.log('   ⚠️  Dirname problématique - nécessite une gestion spéciale');
        recommendations.push(`Gérer le cas spécial: ${probCase.name}`);
      } else {
        console.log('   ✓ Dirname acceptable');
      }
    }

    // 4. Vérifier les permissions de création
    console.log('\n4. Test des permissions de création...');
    
    const testDirs = [
      path.join(baseDir, 'test-creation'),
      path.join(baseDir, 'documents', 'test-sub'),
      path.join(baseDir, 'users', 'testuser', 'deep', 'nested', 'folder')
    ];
    
    for (const testDir of testDirs) {
      console.log(`\n   Test création: ${testDir}`);
      
      try {
        // Tenter de créer le dossier
        await fs.mkdir(testDir, { recursive: true });
        console.log('   ✓ Création réussie');
        
        // Vérifier qu'il existe
        const stats = await fs.stat(testDir);
        if (stats.isDirectory()) {
          console.log('   ✓ Dossier confirmé');
        } else {
          console.log('   ✗ Pas un dossier');
        }
        
        // Nettoyer (supprimer le dossier de test)
        await fs.rmdir(testDir, { recursive: true });
        console.log('   ✓ Nettoyage effectué');
        
      } catch (error) {
        console.log(`   ✗ Erreur: ${error.message}`);
        issues.push(`Impossible de créer ${testDir}: ${error.message}`);
      }
    }

    // 5. Analyser les problèmes potentiels
    console.log('\n5. Analyse des problèmes potentiels...');
    
    // Vérifier si le dossier de base existe
    try {
      const baseStat = await fs.stat(baseDir);
      if (baseStat.isDirectory()) {
        console.log('   ✓ Dossier de base existe');
      } else {
        issues.push('Le dossier de base n\'est pas un dossier');
      }
    } catch (error) {
      issues.push(`Dossier de base inaccessible: ${error.message}`);
    }
    
    // Vérifier les permissions du dossier de base
    try {
      const testFile = path.join(baseDir, 'permission-test.tmp');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      console.log('   ✓ Permissions d\'écriture OK sur le dossier de base');
    } catch (error) {
      issues.push(`Problème de permissions sur le dossier de base: ${error.message}`);
    }

    // 6. Recommandations spécifiques
    console.log('\n6. Recommandations pour améliorer la création de dossiers...');
    
    console.log('   Améliorations suggérées:');
    console.log('   - Ajouter une vérification avant mkdir pour éviter les cas problématiques');
    console.log('   - Gérer spécialement les cas où dirname === "." ou "/"');
    console.log('   - Ajouter des logs pour déboguer les problèmes de création');
    console.log('   - Valider que le dossier parent est dans la zone autorisée');

    // 7. Résumé
    console.log('\n=== Résumé du diagnostic ===');
    
    if (issues.length === 0) {
      console.log('🎉 Aucun problème majeur détecté avec la création de dossiers.');
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

// Fonction pour proposer un correctif amélioré
function generateImprovedMkdirLogic() {
  console.log('\n=== Logique améliorée pour la création de dossiers ===\n');
  
  const improvedCode = `
// Logique améliorée pour la création de dossiers
async function createDirectorySafely(destPath, baseDir) {
  try {
    const dirToCreate = path.dirname(destPath);
    
    // Cas spéciaux à éviter
    if (dirToCreate === '.' || dirToCreate === '/' || dirToCreate === '') {
      console.log('Pas besoin de créer de dossier pour:', destPath);
      return true;
    }
    
    // Vérification de sécurité
    if (!dirToCreate.startsWith(baseDir)) {
      throw new Error('Tentative de création de dossier hors de la zone autorisée');
    }
    
    // Vérifier si le dossier existe déjà
    try {
      const stats = await fs.stat(dirToCreate);
      if (stats.isDirectory()) {
        console.log('Dossier existe déjà:', dirToCreate);
        return true;
      }
    } catch (error) {
      // Le dossier n'existe pas, on va le créer
    }
    
    // Créer le dossier avec gestion d'erreur
    await fs.mkdir(dirToCreate, { recursive: true });
    console.log('Dossier créé:', dirToCreate);
    
    return true;
    
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error.message);
    throw error;
  }
}

// Utilisation dans le middleware
// Remplacer:
// await fs.mkdir(path.dirname(destPath), { recursive: true });
// 
// Par:
// await createDirectorySafely(destPath, baseDir);
`;

  console.log(improvedCode);
}

// Interface en ligne de commande
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'improve':
      generateImprovedMkdirLogic();
      break;
      
    case 'diagnose':
    default:
      const result = await diagnoseFolderCreation();
      
      if (!result.success) {
        console.log('\n💡 Essayez: node diagnose-folder-creation.js improve');
      }
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  diagnoseFolderCreation,
  generateImprovedMkdirLogic
};