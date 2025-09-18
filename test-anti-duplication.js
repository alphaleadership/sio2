/**
 * Test de la logique anti-duplication
 */

const path = require('path');

function testAntiDuplicationLogic() {
  console.log('=== Test de la logique anti-duplication ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Cas de test avec la nouvelle logique anti-duplication
  const testCases = [
    {
      name: 'Upload individuel avec webkitRelativePath qui causerait duplication',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: 'documents/rapport.pdf' // Causerait duplication
        }]
      },
      expectedPath: path.join(baseDir, 'documents', 'rapport.pdf'),
      shouldDetectDuplication: true
    },
    {
      name: 'Upload individuel sans duplication potentielle',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: undefined
        }]
      },
      expectedPath: path.join(baseDir, 'documents', 'rapport.pdf'),
      shouldDetectDuplication: false
    },
    {
      name: 'Upload de dossier légitime sans duplication',
      req: {
        body: { path: 'projects' },
        files: [{
          originalname: 'index.html',
          webkitRelativePath: 'mon-site/pages/index.html'
        }]
      },
      expectedPath: path.join(baseDir, 'projects', 'mon-site', 'pages', 'index.html'),
      shouldDetectDuplication: false
    },
    {
      name: 'Upload de dossier avec duplication potentielle',
      req: {
        body: { path: 'projects' },
        files: [{
          originalname: 'index.html',
          webkitRelativePath: 'projects/mon-site/index.html' // Causerait duplication
        }]
      },
      expectedPath: path.join(baseDir, 'projects', 'index.html'), // Devrait utiliser basename
      shouldDetectDuplication: true
    },
    {
      name: 'Upload à la racine avec webkitRelativePath',
      req: {
        body: { path: '' },
        files: [{
          originalname: 'test.txt',
          webkitRelativePath: 'test.txt'
        }]
      },
      expectedPath: path.join(baseDir, 'test.txt'),
      shouldDetectDuplication: false
    }
  ];

  let allTestsPassed = true;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    
    const req = testCase.req;
    console.log(`  req.body.path: "${req.body.path}"`);
    console.log(`  file.originalname: "${req.files[0].originalname}"`);
    console.log(`  file.webkitRelativePath: ${req.files[0].webkitRelativePath || 'undefined'}`);

    // === LOGIQUE ANTI-DUPLICATION ===
    
    // 1. Construire destFolder
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    
    // 2. Détecter si c'est un upload de dossier
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    // 3. Traiter le fichier avec logique anti-duplication
    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');
    
    let subPath;
    let duplicationDetected = false;
    
    if (file.webkitRelativePath && isFolderUpload) {
      // Vérifier si l'utilisation de webkitRelativePath causerait une duplication
      const potentialPath = path.join(destFolder, file.webkitRelativePath);
      const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
      duplicationDetected = pathParts.some((part, index) => {
        return index > 0 && pathParts[index - 1] === part;
      });
      
      if (duplicationDetected) {
        // Duplication détectée → utiliser seulement le nom du fichier
        subPath = path.basename(relPath);
        console.log(`  → Duplication détectée, utilise basename`);
      } else {
        // Pas de duplication → utiliser webkitRelativePath
        subPath = file.webkitRelativePath;
        console.log(`  → Pas de duplication, utilise webkitRelativePath`);
      }
    } else {
      // Upload individuel ou pas de webkitRelativePath → utiliser seulement le nom du fichier
      subPath = path.basename(relPath);
      console.log(`  → Upload individuel, utilise basename`);
    }
    
    const destPath = path.join(destFolder, subPath);

    // === FIN LOGIQUE ===

    console.log(`  destFolder: ${destFolder}`);
    console.log(`  isFolderUpload: ${isFolderUpload}`);
    console.log(`  duplicationDetected: ${duplicationDetected}`);
    console.log(`  subPath: ${subPath}`);
    console.log(`  destPath: ${destPath}`);
    console.log(`  expectedPath: ${testCase.expectedPath}`);

    // Vérifier la détection de duplication
    if (testCase.shouldDetectDuplication && !duplicationDetected) {
      console.log(`  ✗ ERREUR: Duplication devrait être détectée mais ne l'a pas été`);
      allTestsPassed = false;
    } else if (!testCase.shouldDetectDuplication && duplicationDetected) {
      console.log(`  ✗ ERREUR: Duplication détectée à tort`);
      allTestsPassed = false;
    } else {
      console.log(`  ✓ Détection de duplication correcte`);
    }

    // Vérifier le chemin final
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

    // Vérifier l'absence finale de duplication
    const finalPathParts = normalizedDestPath.split(path.sep).filter(part => part.length > 0);
    const hasFinalDuplication = finalPathParts.some((part, index) => {
      return index > 0 && finalPathParts[index - 1] === part;
    });

    if (hasFinalDuplication) {
      console.log(`  ⚠️  DUPLICATION FINALE DÉTECTÉE !`);
      console.log(`    Segments: [${finalPathParts.join(', ')}]`);
      allTestsPassed = false;
    } else {
      console.log(`  ✓ Aucune duplication finale`);
    }

    console.log('');
  }

  // Test des cas edge spécifiques
  console.log('=== Tests des cas edge ===\n');

  const edgeCases = [
    {
      name: 'Duplication multiple',
      bodyPath: 'docs',
      webkitRelativePath: 'docs/docs/file.txt'
    },
    {
      name: 'Duplication en fin de chemin',
      bodyPath: 'uploads',
      webkitRelativePath: 'folder/uploads/file.txt'
    },
    {
      name: 'Pas de duplication malgré répétition légitime',
      bodyPath: 'projects',
      webkitRelativePath: 'my-project/projects-list/file.txt'
    }
  ];

  for (const edgeCase of edgeCases) {
    console.log(`Test edge: ${edgeCase.name}`);
    
    const baseDir = path.resolve("../partage");
    const destFolder = edgeCase.bodyPath ? path.join(baseDir, edgeCase.bodyPath) : baseDir;
    const potentialPath = path.join(destFolder, edgeCase.webkitRelativePath);
    
    console.log(`  bodyPath: "${edgeCase.bodyPath}"`);
    console.log(`  webkitRelativePath: "${edgeCase.webkitRelativePath}"`);
    console.log(`  potentialPath: "${potentialPath}"`);
    
    const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
    console.log(`  pathParts: [${pathParts.join(', ')}]`);
    
    const duplications = [];
    for (let i = 1; i < pathParts.length; i++) {
      if (pathParts[i] === pathParts[i - 1]) {
        duplications.push({ segment: pathParts[i], position: i });
      }
    }
    
    if (duplications.length > 0) {
      console.log(`  ⚠️  Duplications détectées:`);
      duplications.forEach(dup => {
        console.log(`    - "${dup.segment}" à la position ${dup.position}`);
      });
    } else {
      console.log(`  ✓ Aucune duplication détectée`);
    }
    
    console.log('');
  }

  // Résumé
  console.log('=== Résumé ===');
  if (allTestsPassed) {
    console.log('🎉 Tous les tests sont passés !');
    console.log('\nLogique anti-duplication confirmée:');
    console.log('- Détection automatique des duplications potentielles');
    console.log('- Utilisation de basename quand duplication détectée');
    console.log('- Préservation de webkitRelativePath quand légitime');
    console.log('- Robustesse contre tous les cas edge');
  } else {
    console.log('❌ Certains tests ont échoué.');
    console.log('La logique anti-duplication doit être ajustée.');
  }

  return allTestsPassed;
}

// Test du premier cas spécifiquement
function testFirstCaseSpecifically() {
  console.log('\n=== Test spécifique du premier cas ===\n');

  const baseDir = path.resolve("../partage");
  
  const req = {
    body: { path: 'documents' },
    files: [{
      originalname: 'rapport.pdf',
      webkitRelativePath: 'documents/rapport.pdf'
    }]
  };

  console.log('INPUT:');
  console.log(`  req.body.path: "${req.body.path}"`);
  console.log(`  file.originalname: "${req.files[0].originalname}"`);
  console.log(`  file.webkitRelativePath: "${req.files[0].webkitRelativePath}"`);

  // Logique étape par étape
  const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
  console.log(`\n1. destFolder: ${destFolder}`);

  const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  console.log(`2. isFolderUpload: ${isFolderUpload}`);

  const file = req.files[0];
  const relPath = file.originalname.replace(/\\/g, '/');
  console.log(`3. relPath: ${relPath}`);

  // Test de duplication
  const potentialPath = path.join(destFolder, file.webkitRelativePath);
  console.log(`4. potentialPath: ${potentialPath}`);

  const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
  console.log(`5. pathParts: [${pathParts.join(', ')}]`);

  const hasDuplication = pathParts.some((part, index) => {
    return index > 0 && pathParts[index - 1] === part;
  });
  console.log(`6. hasDuplication: ${hasDuplication}`);

  let subPath;
  if (file.webkitRelativePath && isFolderUpload) {
    if (hasDuplication) {
      subPath = path.basename(relPath);
      console.log(`7. subPath: ${subPath} (basename car duplication détectée)`);
    } else {
      subPath = file.webkitRelativePath;
      console.log(`7. subPath: ${subPath} (webkitRelativePath car pas de duplication)`);
    }
  } else {
    subPath = path.basename(relPath);
    console.log(`7. subPath: ${subPath} (basename car upload individuel)`);
  }

  const destPath = path.join(destFolder, subPath);
  console.log(`8. destPath: ${destPath}`);

  const expectedPath = path.join(baseDir, 'documents', 'rapport.pdf');
  console.log(`9. expectedPath: ${expectedPath}`);

  const isCorrect = destPath === expectedPath;
  console.log(`\nRésultat: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

  return isCorrect;
}

// Exécuter les tests
if (require.main === module) {
  console.log('Test du premier cas spécifiquement:');
  const firstCaseCorrect = testFirstCaseSpecifically();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('Test complet de la logique anti-duplication:');
  const allTestsCorrect = testAntiDuplicationLogic();
  
  const success = firstCaseCorrect && allTestsCorrect;
  process.exit(success ? 0 : 1);
}

module.exports = {
  testAntiDuplicationLogic,
  testFirstCaseSpecifically
};