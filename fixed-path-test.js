/**
 * Test corrigé pour la logique de chemin sans duplication
 * Reproduit exactement la logique du middleware
 */

const path = require('path');

function testFixedPathLogic() {
  console.log('=== Test de la logique de chemin corrigée ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Cas de test reproduisant exactement la logique du middleware
  const testCases = [
    {
      name: 'Upload fichier individuel dans dossier documents',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: undefined
        }]
      },
      expectedPath: path.join(baseDir, 'documents', 'rapport.pdf')
    },
    {
      name: 'Upload fichier individuel à la racine',
      req: {
        body: { path: '' },
        files: [{
          originalname: 'test.txt',
          webkitRelativePath: undefined
        }]
      },
      expectedPath: path.join(baseDir, 'test.txt')
    },
    {
      name: 'Upload de dossier avec structure',
      req: {
        body: { path: 'uploads' },
        files: [{
          originalname: 'readme.md',
          webkitRelativePath: 'mon-projet/docs/readme.md'
        }]
      },
      expectedPath: path.join(baseDir, 'uploads', 'mon-projet', 'docs', 'readme.md')
    },
    {
      name: 'Upload de dossier à la racine',
      req: {
        body: { path: '' },
        files: [{
          originalname: 'index.html',
          webkitRelativePath: 'website/index.html'
        }]
      },
      expectedPath: path.join(baseDir, 'website', 'index.html')
    }
  ];

  let allTestsPassed = true;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    
    const req = testCase.req;
    console.log(`  req.body.path: "${req.body.path}"`);
    console.log(`  file.originalname: "${req.files[0].originalname}"`);
    console.log(`  file.webkitRelativePath: ${req.files[0].webkitRelativePath || 'undefined'}`);

    // === LOGIQUE EXACTE DU MIDDLEWARE ===
    
    // 1. Construire destFolder
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    
    // 2. Détecter si c'est un upload de dossier
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    // 3. Traiter le fichier
    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');
    
    let subPath;
    if (file.webkitRelativePath && isFolderUpload) {
      // Pour les uploads de dossiers, utiliser le chemin relatif complet
      subPath = file.webkitRelativePath;
    } else {
      // Pour les uploads de fichiers individuels, utiliser seulement le nom du fichier
      subPath = path.basename(relPath);
    }
    
    const destPath = path.join(destFolder, subPath);

    // === FIN LOGIQUE MIDDLEWARE ===

    console.log(`  destFolder: ${destFolder}`);
    console.log(`  isFolderUpload: ${isFolderUpload}`);
    console.log(`  relPath: ${relPath}`);
    console.log(`  subPath: ${subPath}`);
    console.log(`  destPath: ${destPath}`);
    console.log(`  expectedPath: ${testCase.expectedPath}`);

    // Normaliser les chemins pour la comparaison
    const normalizedDestPath = path.normalize(destPath);
    const normalizedExpectedPath = path.normalize(testCase.expectedPath);

    const isMatch = normalizedDestPath === normalizedExpectedPath;
    console.log(`  Result: ${isMatch ? '✓ PASS' : '✗ FAIL'}`);

    if (!isMatch) {
      console.log(`    Différence détectée:`);
      console.log(`      Calculé:  "${normalizedDestPath}"`);
      console.log(`      Attendu:  "${normalizedExpectedPath}"`);
      allTestsPassed = false;
    }

    console.log('');
  }

  // Test spécifique pour détecter les duplications
  console.log('=== Test de détection de duplication ===\n');

  const duplicationTestCases = [
    {
      name: 'Cas problématique potentiel - documents/documents',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'documents/file.txt', // Nom de fichier problématique
          webkitRelativePath: undefined
        }]
      }
    },
    {
      name: 'Upload normal dans documents',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'file.txt',
          webkitRelativePath: undefined
        }]
      }
    }
  ];

  for (const testCase of duplicationTestCases) {
    console.log(`Test duplication: ${testCase.name}`);
    
    const req = testCase.req;
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');
    
    let subPath;
    if (file.webkitRelativePath && isFolderUpload) {
      subPath = file.webkitRelativePath;
    } else {
      subPath = path.basename(relPath);
    }
    
    const destPath = path.join(destFolder, subPath);

    console.log(`  originalname: "${file.originalname}"`);
    console.log(`  subPath: "${subPath}"`);
    console.log(`  destPath: "${destPath}"`);

    // Détecter la duplication
    const pathParts = destPath.split(path.sep).filter(part => part.length > 0);
    const hasDuplication = pathParts.some((part, index) => {
      return index > 0 && pathParts[index - 1] === part;
    });

    console.log(`  Duplication détectée: ${hasDuplication ? 'OUI ⚠️' : 'NON ✓'}`);
    console.log('');
  }

  // Résumé
  console.log('=== Résumé ===');
  if (allTestsPassed) {
    console.log('🎉 Tous les tests principaux sont passés !');
    console.log('\nLa logique corrigée fonctionne correctement:');
    console.log('- Upload fichier individuel → utilise path.basename()');
    console.log('- Upload de dossier → utilise webkitRelativePath complet');
    console.log('- Pas de duplication de segments de chemin');
  } else {
    console.log('❌ Certains tests ont échoué.');
    console.log('Vérifiez la logique de construction des chemins dans le middleware.');
  }

  return allTestsPassed;
}

// Fonction pour analyser un chemin spécifique
function analyzeSpecificPath(bodyPath, originalname, webkitRelativePath) {
  console.log(`\n=== Analyse du chemin spécifique ===`);
  console.log(`bodyPath: "${bodyPath}"`);
  console.log(`originalname: "${originalname}"`);
  console.log(`webkitRelativePath: ${webkitRelativePath || 'undefined'}`);

  const baseDir = path.resolve("../partage");
  
  // Simuler la logique
  const destFolder = bodyPath ? path.join(baseDir, bodyPath) : baseDir;
  const isFolderUpload = webkitRelativePath && webkitRelativePath.includes('/');
  const relPath = originalname.replace(/\\/g, '/');
  
  let subPath;
  if (webkitRelativePath && isFolderUpload) {
    subPath = webkitRelativePath;
  } else {
    subPath = path.basename(relPath);
  }
  
  const destPath = path.join(destFolder, subPath);

  console.log(`\nRésultats:`);
  console.log(`destFolder: ${destFolder}`);
  console.log(`isFolderUpload: ${isFolderUpload}`);
  console.log(`subPath: ${subPath}`);
  console.log(`destPath: ${destPath}`);

  // Analyser les duplications
  const pathParts = destPath.split(path.sep).filter(part => part.length > 0);
  console.log(`pathParts: [${pathParts.join(', ')}]`);
  
  const duplications = [];
  for (let i = 1; i < pathParts.length; i++) {
    if (pathParts[i] === pathParts[i - 1]) {
      duplications.push(pathParts[i]);
    }
  }
  
  if (duplications.length > 0) {
    console.log(`⚠️  Duplications détectées: [${duplications.join(', ')}]`);
  } else {
    console.log(`✓ Aucune duplication détectée`);
  }
}

// Interface en ligne de commande
function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'analyze':
      const bodyPath = process.argv[3] || '';
      const originalname = process.argv[4] || 'test.txt';
      const webkitRelativePath = process.argv[5];
      analyzeSpecificPath(bodyPath, originalname, webkitRelativePath);
      break;
      
    case 'test':
    default:
      const success = testFixedPathLogic();
      process.exit(success ? 0 : 1);
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  testFixedPathLogic,
  analyzeSpecificPath
};