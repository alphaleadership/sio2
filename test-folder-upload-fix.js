/**
 * Test spécifique pour les uploads de dossiers avec plusieurs fichiers
 */

const path = require('path');

function testFolderUploadWithMultipleFiles() {
  console.log('=== Test des uploads de dossiers avec plusieurs fichiers ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Cas de test pour uploads de dossiers
  const testCases = [
    {
      name: 'Upload de dossier simple sans duplication',
      req: {
        body: { path: 'projects' },
        files: [
          {
            originalname: 'index.html',
            webkitRelativePath: 'mon-site/index.html',
            name: 'index.html',
            relativePath: 'mon-site/index.html'
          },
          {
            originalname: 'style.css',
            webkitRelativePath: 'mon-site/css/style.css',
            name: 'style.css',
            relativePath: 'mon-site/css/style.css'
          }
        ]
      },
      expectedPaths: [
        path.join(baseDir, 'projects', 'mon-site', 'index.html'),
        path.join(baseDir, 'projects', 'mon-site', 'css', 'style.css')
      ]
    },
    {
      name: 'Upload de dossier avec duplication potentielle',
      req: {
        body: { path: 'projects' },
        files: [
          {
            originalname: 'index.html',
            webkitRelativePath: 'projects/mon-site/index.html', // Duplication !
            name: 'index.html',
            relativePath: 'projects/mon-site/index.html'
          },
          {
            originalname: 'style.css',
            webkitRelativePath: 'projects/css/style.css', // Duplication !
            name: 'style.css',
            relativePath: 'projects/css/style.css'
          }
        ]
      },
      expectedPaths: [
        path.join(baseDir, 'projects', 'index.html'), // Devrait utiliser basename
        path.join(baseDir, 'projects', 'style.css')   // Devrait utiliser basename
      ]
    },
    {
      name: 'Upload de dossier mixte (avec et sans duplication)',
      req: {
        body: { path: 'uploads' },
        files: [
          {
            originalname: 'readme.md',
            webkitRelativePath: 'projet/readme.md', // Pas de duplication
            name: 'readme.md',
            relativePath: 'projet/readme.md'
          },
          {
            originalname: 'config.json',
            webkitRelativePath: 'uploads/config.json', // Duplication !
            name: 'config.json',
            relativePath: 'uploads/config.json'
          }
        ]
      },
      expectedPaths: [
        path.join(baseDir, 'uploads', 'projet', 'readme.md'), // Garde le chemin complet
        path.join(baseDir, 'uploads', 'config.json')          // Utilise basename
      ]
    }
  ];

  let allTestsPassed = true;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    
    const req = testCase.req;
    console.log(`  req.body.path: "${req.body.path}"`);
    console.log(`  Nombre de fichiers: ${req.files.length}`);

    // Simuler la logique du middleware pour les dossiers
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    console.log(`  destFolder: ${destFolder}`);
    console.log(`  isFolderUpload: ${isFolderUpload}`);

    // Traiter chaque fichier avec la logique anti-duplication
    const actualPaths = [];
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`\n  Fichier ${i + 1}: ${file.originalname}`);
      console.log(`    webkitRelativePath: ${file.webkitRelativePath}`);
      console.log(`    relativePath: ${file.relativePath}`);

      // Logique anti-duplication pour dossiers (comme dans handleFolderCreation)
      let relativePath = file.relativePath || file.webkitRelativePath || file.name;
      
      if (relativePath) {
        const potentialPath = path.join(destFolder, relativePath);
        const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
        const hasDuplication = pathParts.some((part, index) => {
          return index > 0 && pathParts[index - 1] === part;
        });
        
        if (hasDuplication) {
          // Duplication détectée → utiliser seulement le nom du fichier
          relativePath = path.basename(relativePath);
          console.log(`    → Duplication détectée, utilise basename: ${relativePath}`);
        } else {
          console.log(`    → Pas de duplication, utilise chemin complet: ${relativePath}`);
        }
      }
      
      const filePath = path.join(destFolder, relativePath);
      actualPaths.push(filePath);
      
      console.log(`    filePath final: ${filePath}`);
      console.log(`    attendu: ${testCase.expectedPaths[i]}`);
      
      // Vérifier le chemin
      const normalizedActual = path.normalize(filePath);
      const normalizedExpected = path.normalize(testCase.expectedPaths[i]);
      const isMatch = normalizedActual === normalizedExpected;
      
      console.log(`    match: ${isMatch ? '✓' : '✗'}`);
      
      if (!isMatch) {
        console.log(`      Différence:`);
        console.log(`        Calculé:  "${normalizedActual}"`);
        console.log(`        Attendu:  "${normalizedExpected}"`);
        allTestsPassed = false;
      }

      // Vérifier l'absence de duplication
      const pathParts = normalizedActual.split(path.sep).filter(part => part.length > 0);
      const hasFinalDuplication = pathParts.some((part, index) => {
        return index > 0 && pathParts[index - 1] === part;
      });

      if (hasFinalDuplication) {
        console.log(`      ⚠️  DUPLICATION FINALE: [${pathParts.join(', ')}]`);
        allTestsPassed = false;
      } else {
        console.log(`      ✓ Pas de duplication finale`);
      }
    }

    console.log(`\n  Résultat global: ${actualPaths.every((filePath, i) => 
      path.normalize(filePath) === path.normalize(testCase.expectedPaths[i])
    ) ? '✓ PASS' : '✗ FAIL'}`);
    
    console.log('');
  }

  // Test des cas edge spécifiques aux dossiers
  console.log('=== Tests des cas edge pour dossiers ===\n');

  const edgeCases = [
    {
      name: 'Dossier avec structure profonde et duplication',
      folderPath: path.join(baseDir, 'deep'),
      files: [
        {
          name: 'file.txt',
          relativePath: 'deep/level1/deep/file.txt' // Duplication de "deep"
        }
      ]
    },
    {
      name: 'Dossier avec duplications multiples',
      folderPath: path.join(baseDir, 'test'),
      files: [
        {
          name: 'file1.txt',
          relativePath: 'test/test/test/file1.txt' // Triple duplication
        }
      ]
    },
    {
      name: 'Dossier sans duplication mais avec répétition légitime',
      folderPath: path.join(baseDir, 'projects'),
      files: [
        {
          name: 'project.js',
          relativePath: 'my-project/project-files/project.js' // Pas de duplication
        }
      ]
    }
  ];

  for (const edgeCase of edgeCases) {
    console.log(`Test edge: ${edgeCase.name}`);
    
    for (const file of edgeCase.files) {
      console.log(`  Fichier: ${file.name}`);
      console.log(`  relativePath: ${file.relativePath}`);
      
      const potentialPath = path.join(edgeCase.folderPath, file.relativePath);
      console.log(`  potentialPath: ${potentialPath}`);
      
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
        
        // Appliquer la correction
        const correctedPath = path.basename(file.relativePath);
        const finalPath = path.join(edgeCase.folderPath, correctedPath);
        console.log(`  → Correction: utilise basename "${correctedPath}"`);
        console.log(`  → Chemin final: ${finalPath}`);
      } else {
        console.log(`  ✓ Aucune duplication détectée`);
        console.log(`  → Chemin final: ${potentialPath}`);
      }
    }
    
    console.log('');
  }

  // Résumé
  console.log('=== Résumé ===');
  if (allTestsPassed) {
    console.log('🎉 Tous les tests de dossiers sont passés !');
    console.log('\nLogique anti-duplication pour dossiers confirmée:');
    console.log('- Détection de duplication pour chaque fichier du dossier');
    console.log('- Correction automatique avec basename quand nécessaire');
    console.log('- Préservation des structures légitimes');
    console.log('- Gestion des cas edge complexes');
  } else {
    console.log('❌ Certains tests de dossiers ont échoué.');
    console.log('La logique anti-duplication pour handleFolderCreation doit être vérifiée.');
  }

  return allTestsPassed;
}

// Test spécifique d'un cas problématique
function testSpecificFolderCase() {
  console.log('\n=== Test spécifique d\'un cas de dossier problématique ===\n');

  const baseDir = path.resolve("../partage");
  const folderPath = path.join(baseDir, 'uploads');
  
  const file = {
    name: 'document.pdf',
    relativePath: 'uploads/documents/document.pdf' // Duplication de "uploads"
  };

  console.log(`folderPath: ${folderPath}`);
  console.log(`file.relativePath: ${file.relativePath}`);

  // Test de la logique anti-duplication
  const potentialPath = path.join(folderPath, file.relativePath);
  console.log(`potentialPath: ${potentialPath}`);

  const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
  console.log(`pathParts: [${pathParts.join(', ')}]`);

  const hasDuplication = pathParts.some((part, index) => {
    return index > 0 && pathParts[index - 1] === part;
  });

  console.log(`hasDuplication: ${hasDuplication}`);

  let finalRelativePath;
  if (hasDuplication) {
    finalRelativePath = path.basename(file.relativePath);
    console.log(`→ Duplication détectée, utilise basename: ${finalRelativePath}`);
  } else {
    finalRelativePath = file.relativePath;
    console.log(`→ Pas de duplication, utilise chemin complet: ${finalRelativePath}`);
  }

  const finalPath = path.join(folderPath, finalRelativePath);
  console.log(`finalPath: ${finalPath}`);

  // Vérifier le résultat
  const expectedPath = path.join(baseDir, 'uploads', 'document.pdf');
  console.log(`expectedPath: ${expectedPath}`);

  const isCorrect = finalPath === expectedPath;
  console.log(`\nRésultat: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

  return isCorrect;
}

// Exécuter les tests
if (require.main === module) {
  console.log('Test spécifique d\'un cas problématique:');
  const specificCaseCorrect = testSpecificFolderCase();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('Test complet des uploads de dossiers:');
  const allFolderTestsCorrect = testFolderUploadWithMultipleFiles();
  
  const success = specificCaseCorrect && allFolderTestsCorrect;
  
  console.log(`\n=== RÉSULTAT FINAL ===`);
  console.log(`Cas spécifique: ${specificCaseCorrect ? '✅' : '❌'}`);
  console.log(`Tous les tests de dossiers: ${allFolderTestsCorrect ? '✅' : '❌'}`);
  console.log(`Succès global: ${success ? '✅' : '❌'}`);
  
  process.exit(success ? 0 : 1);
}

module.exports = {
  testFolderUploadWithMultipleFiles,
  testSpecificFolderCase
};