/**
 * Test spécifique pour le problème de duplication dans l'espace utilisateur
 */

const path = require('path');

function testUserSpaceDuplication() {
  console.log('=== Test de duplication dans l\'espace utilisateur ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Scénario problématique : utilisateur "john" uploade dans son espace
  const testCases = [
    {
      name: 'Upload utilisateur dans son dossier racine',
      req: {
        body: { path: 'users/john' }, // Chemin depuis la navigation
        files: [{
          originalname: 'document.pdf',
          webkitRelativePath: undefined
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'john', 'document.pdf'),
      problemDescription: 'req.body.path contient déjà users/john'
    },
    {
      name: 'Upload utilisateur dans un sous-dossier',
      req: {
        body: { path: 'users/john/documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: undefined
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'john', 'documents', 'rapport.pdf'),
      problemDescription: 'req.body.path contient users/john/documents'
    },
    {
      name: 'Upload de dossier par utilisateur',
      req: {
        body: { path: 'users/alice' },
        files: [{
          originalname: 'index.html',
          webkitRelativePath: 'users/alice/mon-site/index.html' // Double problème !
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'alice', 'index.html'), // Devrait utiliser basename
      problemDescription: 'Double duplication : body.path + webkitRelativePath'
    }
  ];

  let allTestsPassed = true;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    console.log(`  Problème: ${testCase.problemDescription}`);
    
    const req = testCase.req;
    console.log(`  req.body.path: "${req.body.path}"`);
    console.log(`  file.originalname: "${req.files[0].originalname}"`);
    console.log(`  file.webkitRelativePath: ${req.files[0].webkitRelativePath || 'undefined'}`);

    // === LOGIQUE ACTUELLE (PROBLÉMATIQUE) ===
    
    // 1. Construire destFolder (logique actuelle)
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    console.log(`  destFolder (actuel): ${destFolder}`);
    
    // 2. Détecter si c'est un upload de dossier
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    // 3. Traiter le fichier avec logique anti-duplication actuelle
    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');
    
    let subPath;
    
    if (file.webkitRelativePath && isFolderUpload) {
      // Vérifier si l'utilisation de webkitRelativePath causerait une duplication
      const potentialPath = path.join(destFolder, file.webkitRelativePath);
      const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
      const hasDuplication = pathParts.some((part, index) => {
        return index > 0 && pathParts[index - 1] === part;
      });
      
      if (hasDuplication) {
        subPath = path.basename(relPath);
        console.log(`  → Duplication webkitRelativePath détectée, utilise basename`);
      } else {
        subPath = file.webkitRelativePath;
        console.log(`  → Pas de duplication webkitRelativePath, utilise chemin complet`);
      }
    } else {
      subPath = path.basename(relPath);
      console.log(`  → Upload individuel, utilise basename`);
    }
    
    const destPathActuel = path.join(destFolder, subPath);
    console.log(`  destPath (actuel): ${destPathActuel}`);
    console.log(`  expectedPath: ${testCase.expectedPath}`);

    // Vérifier si le chemin actuel a des duplications
    const actualParts = destPathActuel.split(path.sep).filter(part => part.length > 0);
    const hasActualDuplication = actualParts.some((part, index) => {
      return index > 0 && actualParts[index - 1] === part;
    });

    if (hasActualDuplication) {
      console.log(`  ⚠️  DUPLICATION DÉTECTÉE dans le chemin actuel !`);
      console.log(`    Segments: [${actualParts.join(', ')}]`);
      
      // Identifier les duplications
      const duplications = [];
      for (let i = 1; i < actualParts.length; i++) {
        if (actualParts[i] === actualParts[i - 1]) {
          duplications.push(actualParts[i]);
        }
      }
      console.log(`    Duplications: [${duplications.join(', ')}]`);
      allTestsPassed = false;
    } else {
      console.log(`  ✓ Pas de duplication dans le chemin actuel`);
    }

    // Vérifier si le chemin correspond à l'attendu
    const isMatch = destPathActuel === testCase.expectedPath;
    console.log(`  Result: ${isMatch ? '✓ PASS' : '✗ FAIL'}`);

    if (!isMatch) {
      console.log(`    Différence détectée:`);
      console.log(`      Calculé:  "${destPathActuel}"`);
      console.log(`      Attendu:  "${testCase.expectedPath}"`);
      allTestsPassed = false;
    }

    console.log('');
  }

  // Analyser les patterns de duplication spécifiques aux utilisateurs
  console.log('=== Analyse des patterns de duplication utilisateur ===\n');

  const userPatterns = [
    {
      name: 'Pattern classique utilisateur',
      bodyPath: 'users/john',
      webkitRelativePath: undefined,
      analysis: 'req.body.path contient déjà le chemin utilisateur complet'
    },
    {
      name: 'Pattern dossier utilisateur avec webkitRelativePath',
      bodyPath: 'users/alice',
      webkitRelativePath: 'users/alice/project/file.txt',
      analysis: 'Double duplication : body.path + webkitRelativePath contiennent tous deux users/alice'
    },
    {
      name: 'Pattern sous-dossier utilisateur',
      bodyPath: 'users/bob/documents',
      webkitRelativePath: undefined,
      analysis: 'Pas de duplication directe mais chemin long'
    }
  ];

  for (const pattern of userPatterns) {
    console.log(`Pattern: ${pattern.name}`);
    console.log(`  bodyPath: "${pattern.bodyPath}"`);
    console.log(`  webkitRelativePath: ${pattern.webkitRelativePath || 'undefined'}`);
    console.log(`  Analyse: ${pattern.analysis}`);

    const destFolder = path.join(baseDir, pattern.bodyPath);
    console.log(`  destFolder: ${destFolder}`);

    if (pattern.webkitRelativePath) {
      const potentialPath = path.join(destFolder, pattern.webkitRelativePath);
      console.log(`  potentialPath: ${potentialPath}`);

      const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
      console.log(`  pathParts: [${pathParts.join(', ')}]`);

      // Détecter les duplications
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
    }

    console.log('');
  }

  // Résumé
  console.log('=== Résumé ===');
  if (allTestsPassed) {
    console.log('✅ Aucun problème de duplication utilisateur détecté avec la logique actuelle');
  } else {
    console.log('❌ Problèmes de duplication utilisateur détectés !');
    console.log('\nProblèmes identifiés:');
    console.log('- req.body.path contient déjà le chemin utilisateur complet');
    console.log('- webkitRelativePath peut aussi contenir le chemin utilisateur');
    console.log('- La logique anti-duplication actuelle ne gère pas ce cas spécifique');
    
    console.log('\nSolution recommandée:');
    console.log('- Détecter les patterns utilisateur dans req.body.path');
    console.log('- Appliquer une logique anti-duplication spécifique aux espaces utilisateurs');
    console.log('- Étendre la détection de duplication pour inclure les patterns users/username');
  }

  return allTestsPassed;
}

// Test de la solution proposée
function testUserSpaceSolution() {
  console.log('\n=== Test de la solution pour les espaces utilisateurs ===\n');

  const baseDir = path.resolve("../partage");
  
  // Cas problématique
  const req = {
    body: { path: 'users/john' },
    files: [{
      originalname: 'document.pdf',
      webkitRelativePath: 'users/john/document.pdf' // Duplication !
    }]
  };

  console.log('Cas problématique:');
  console.log(`  req.body.path: "${req.body.path}"`);
  console.log(`  webkitRelativePath: "${req.files[0].webkitRelativePath}"`);

  // Solution proposée : détecter et nettoyer les duplications utilisateur
  const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
  console.log(`  destFolder: ${destFolder}`);

  const file = req.files[0];
  let subPath = file.webkitRelativePath || path.basename(file.originalname);

  // Logique anti-duplication étendue pour les utilisateurs
  if (subPath && subPath !== path.basename(file.originalname)) {
    const potentialPath = path.join(destFolder, subPath);
    const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
    
    // Détecter les duplications (incluant les patterns utilisateur)
    const hasDuplication = pathParts.some((part, index) => {
      return index > 0 && pathParts[index - 1] === part;
    });

    // Détecter spécifiquement les duplications de pattern utilisateur
    const hasUserPatternDuplication = pathParts.some((part, index) => {
      if (part === 'users' && index > 0) {
        // Vérifier si "users" apparaît déjà avant
        return pathParts.slice(0, index).includes('users');
      }
      return false;
    });

    console.log(`  hasDuplication: ${hasDuplication}`);
    console.log(`  hasUserPatternDuplication: ${hasUserPatternDuplication}`);

    if (hasDuplication || hasUserPatternDuplication) {
      subPath = path.basename(file.originalname);
      console.log(`  → Duplication détectée, utilise basename: ${subPath}`);
    } else {
      console.log(`  → Pas de duplication, utilise chemin complet: ${subPath}`);
    }
  }

  const finalPath = path.join(destFolder, subPath);
  const expectedPath = path.join(baseDir, 'users', 'john', 'document.pdf');

  console.log(`  finalPath: ${finalPath}`);
  console.log(`  expectedPath: ${expectedPath}`);

  const isCorrect = finalPath === expectedPath;
  console.log(`  Résultat: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

  return isCorrect;
}

// Exécuter les tests
if (require.main === module) {
  console.log('Test du problème de duplication utilisateur:');
  const problemExists = !testUserSpaceDuplication();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('Test de la solution proposée:');
  const solutionWorks = testUserSpaceSolution();
  
  console.log(`\n=== RÉSULTAT FINAL ===`);
  console.log(`Problème détecté: ${problemExists ? '✅' : '❌'}`);
  console.log(`Solution fonctionne: ${solutionWorks ? '✅' : '❌'}`);
  
  if (problemExists && solutionWorks) {
    console.log('🎯 Problème identifié et solution validée !');
  } else if (!problemExists) {
    console.log('ℹ️  Aucun problème détecté avec la logique actuelle');
  } else {
    console.log('⚠️  Problème détecté mais solution à améliorer');
  }
}

module.exports = {
  testUserSpaceDuplication,
  testUserSpaceSolution
};