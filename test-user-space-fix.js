/**
 * Test du correctif pour les duplications dans les espaces utilisateurs
 */

const path = require('path');

function testUserSpaceFix() {
  console.log('=== Test du correctif pour les espaces utilisateurs ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Cas de test spécifiques aux espaces utilisateurs
  const testCases = [
    {
      name: 'Upload utilisateur simple avec webkitRelativePath problématique',
      req: {
        body: { path: 'users/john' },
        files: [{
          originalname: 'document.pdf',
          webkitRelativePath: 'users/john/document.pdf' // Duplication !
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'john', 'document.pdf'),
      shouldDetectDuplication: true
    },
    {
      name: 'Upload utilisateur dans sous-dossier avec duplication',
      req: {
        body: { path: 'users/alice/documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: 'users/alice/documents/rapport.pdf' // Duplication !
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'alice', 'documents', 'rapport.pdf'),
      shouldDetectDuplication: true
    },
    {
      name: 'Upload utilisateur légitime sans duplication',
      req: {
        body: { path: 'users/bob' },
        files: [{
          originalname: 'index.html',
          webkitRelativePath: 'mon-projet/index.html' // Pas de duplication
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'bob', 'mon-projet', 'index.html'),
      shouldDetectDuplication: false
    },
    {
      name: 'Upload utilisateur avec duplication de nom d\'utilisateur',
      req: {
        body: { path: 'users/charlie' },
        files: [{
          originalname: 'config.json',
          webkitRelativePath: 'charlie/settings/config.json' // Duplication du nom d'utilisateur
        }]
      },
      expectedPath: path.join(baseDir, 'users', 'charlie', 'config.json'),
      shouldDetectDuplication: true
    }
  ];

  let allTestsPassed = true;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);
    
    const req = testCase.req;
    console.log(`  req.body.path: "${req.body.path}"`);
    console.log(`  file.originalname: "${req.files[0].originalname}"`);
    console.log(`  file.webkitRelativePath: ${req.files[0].webkitRelativePath || 'undefined'}`);

    // === LOGIQUE CORRIGÉE AVEC DÉTECTION UTILISATEUR ===
    
    // 1. Construire destFolder
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    
    // 2. Détecter si c'est un upload de dossier
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    // 3. Traiter le fichier avec logique anti-duplication étendue
    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');
    
    let subPath;
    let duplicationDetected = false;
    let userPatternDuplicationDetected = false;
    
    if (file.webkitRelativePath && isFolderUpload) {
      // Vérifier si l'utilisation de webkitRelativePath causerait une duplication
      const potentialPath = path.join(destFolder, file.webkitRelativePath);
      const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
      
      // Détecter les duplications consécutives
      duplicationDetected = pathParts.some((part, index) => {
        return index > 0 && pathParts[index - 1] === part;
      });
      
      // Détecter spécifiquement les duplications de pattern utilisateur
      userPatternDuplicationDetected = pathParts.some((part, index) => {
        if (part === 'users' && index > 0) {
          // Vérifier si "users" apparaît déjà avant
          return pathParts.slice(0, index).includes('users');
        }
        // Vérifier les duplications de nom d'utilisateur
        if (index > 2 && pathParts[index - 2] === 'users') {
          // Si c'est un nom d'utilisateur après /users/, vérifier les duplications
          return pathParts.slice(0, index).includes(part);
        }
        return false;
      });
      
      if (duplicationDetected || userPatternDuplicationDetected) {
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
    console.log(`  userPatternDuplicationDetected: ${userPatternDuplicationDetected}`);
    console.log(`  subPath: ${subPath}`);
    console.log(`  destPath: ${destPath}`);
    console.log(`  expectedPath: ${testCase.expectedPath}`);

    // Vérifier la détection de duplication
    const anyDuplicationDetected = duplicationDetected || userPatternDuplicationDetected;
    if (testCase.shouldDetectDuplication && !anyDuplicationDetected) {
      console.log(`  ✗ ERREUR: Duplication devrait être détectée mais ne l'a pas été`);
      allTestsPassed = false;
    } else if (!testCase.shouldDetectDuplication && anyDuplicationDetected) {
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

    // Vérifier aussi les duplications de pattern utilisateur dans le résultat final
    const hasFinalUserDuplication = finalPathParts.some((part, index) => {
      if (part === 'users' && index > 0) {
        return finalPathParts.slice(0, index).includes('users');
      }
      if (index > 2 && finalPathParts[index - 2] === 'users') {
        return finalPathParts.slice(0, index).includes(part);
      }
      return false;
    });

    if (hasFinalDuplication || hasFinalUserDuplication) {
      console.log(`  ⚠️  DUPLICATION FINALE DÉTECTÉE !`);
      console.log(`    Segments: [${finalPathParts.join(', ')}]`);
      if (hasFinalDuplication) console.log(`    - Duplication consécutive détectée`);
      if (hasFinalUserDuplication) console.log(`    - Duplication de pattern utilisateur détectée`);
      allTestsPassed = false;
    } else {
      console.log(`  ✓ Aucune duplication finale`);
    }

    console.log('');
  }

  // Test des patterns utilisateur spécifiques
  console.log('=== Test des patterns utilisateur spécifiques ===\n');

  const userPatterns = [
    {
      name: 'Double users/',
      path: '/partage/users/john/users/john/file.txt',
      shouldDetect: true
    },
    {
      name: 'Duplication nom utilisateur',
      path: '/partage/users/alice/alice/documents/file.txt',
      shouldDetect: true
    },
    {
      name: 'Pattern légitime avec répétition',
      path: '/partage/users/bob/projects/bob-project/file.txt',
      shouldDetect: false
    },
    {
      name: 'Triple duplication utilisateur',
      path: '/partage/users/charlie/users/charlie/charlie/file.txt',
      shouldDetect: true
    }
  ];

  for (const pattern of userPatterns) {
    console.log(`Pattern: ${pattern.name}`);
    console.log(`  Chemin: ${pattern.path}`);

    // Normaliser le chemin et le diviser correctement
    const normalizedPath = pattern.path.replace(/\//g, path.sep);
    const pathParts = normalizedPath.split(path.sep).filter(part => part.length > 0);
    console.log(`  Segments: [${pathParts.join(', ')}]`);

    // Détecter les duplications consécutives
    const hasConsecutiveDuplication = pathParts.some((part, index) => {
      return index > 0 && pathParts[index - 1] === part;
    });

    // Détecter les duplications de pattern utilisateur
    const hasUserPatternDuplication = pathParts.some((part, index) => {
      if (part === 'users' && index > 0) {
        return pathParts.slice(0, index).includes('users');
      }
      if (index > 2 && pathParts[index - 2] === 'users') {
        return pathParts.slice(0, index).includes(part);
      }
      return false;
    });

    const detected = hasConsecutiveDuplication || hasUserPatternDuplication;
    console.log(`  Duplication détectée: ${detected}`);
    console.log(`  Devrait détecter: ${pattern.shouldDetect}`);
    console.log(`  Résultat: ${detected === pattern.shouldDetect ? '✓' : '✗'}`);

    if (detected !== pattern.shouldDetect) {
      allTestsPassed = false;
    }

    console.log('');
  }

  // Résumé
  console.log('=== Résumé ===');
  if (allTestsPassed) {
    console.log('🎉 Tous les tests d\'espaces utilisateurs sont passés !');
    console.log('\nCorrectif des espaces utilisateurs confirmé:');
    console.log('- Détection des duplications consécutives');
    console.log('- Détection des duplications de pattern utilisateur');
    console.log('- Correction automatique avec basename quand nécessaire');
    console.log('- Préservation des structures légitimes');
  } else {
    console.log('❌ Certains tests d\'espaces utilisateurs ont échoué.');
    console.log('Le correctif pour les espaces utilisateurs doit être ajusté.');
  }

  return allTestsPassed;
}

// Test spécifique du cas mentionné par l'utilisateur
function testSpecificUserCase() {
  console.log('\n=== Test du cas spécifique mentionné ===\n');

  const baseDir = path.resolve("../partage");
  
  // Cas : utilisateur importe dans son espace et cela crée /users/username/users/username
  const req = {
    body: { path: 'users/john' }, // Navigation utilisateur
    files: [{
      originalname: 'document.pdf',
      webkitRelativePath: 'users/john/document.pdf' // Problématique !
    }]
  };

  console.log('Cas problématique spécifique:');
  console.log(`  req.body.path: "${req.body.path}"`);
  console.log(`  webkitRelativePath: "${req.files[0].webkitRelativePath}"`);

  // Logique corrigée
  const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
  const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  
  const file = req.files[0];
  const relPath = file.originalname.replace(/\\/g, '/');
  
  let subPath;
  
  if (file.webkitRelativePath && isFolderUpload) {
    const potentialPath = path.join(destFolder, file.webkitRelativePath);
    const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
    
    console.log(`  potentialPath: ${potentialPath}`);
    console.log(`  pathParts: [${pathParts.join(', ')}]`);
    
    // Détecter les duplications consécutives
    const hasDuplication = pathParts.some((part, index) => {
      return index > 0 && pathParts[index - 1] === part;
    });
    
    // Détecter spécifiquement les duplications de pattern utilisateur
    const hasUserPatternDuplication = pathParts.some((part, index) => {
      if (part === 'users' && index > 0) {
        return pathParts.slice(0, index).includes('users');
      }
      if (index > 2 && pathParts[index - 2] === 'users') {
        return pathParts.slice(0, index).includes(part);
      }
      return false;
    });
    
    console.log(`  hasDuplication: ${hasDuplication}`);
    console.log(`  hasUserPatternDuplication: ${hasUserPatternDuplication}`);
    
    if (hasDuplication || hasUserPatternDuplication) {
      subPath = path.basename(relPath);
      console.log(`  → Duplication détectée, utilise basename: ${subPath}`);
    } else {
      subPath = file.webkitRelativePath;
      console.log(`  → Pas de duplication, utilise webkitRelativePath: ${subPath}`);
    }
  } else {
    subPath = path.basename(relPath);
    console.log(`  → Upload individuel, utilise basename: ${subPath}`);
  }
  
  const finalPath = path.join(destFolder, subPath);
  const expectedPath = path.join(baseDir, 'users', 'john', 'document.pdf');

  console.log(`  finalPath: ${finalPath}`);
  console.log(`  expectedPath: ${expectedPath}`);

  const isCorrect = finalPath === expectedPath;
  console.log(`\nRésultat: ${isCorrect ? '✅ PROBLÈME RÉSOLU' : '❌ PROBLÈME PERSISTE'}`);

  if (isCorrect) {
    console.log('Le correctif fonctionne ! Plus de duplication /users/username/users/username');
  } else {
    console.log('Le problème persiste, le correctif doit être ajusté');
  }

  return isCorrect;
}

// Exécuter les tests
if (require.main === module) {
  console.log('Test du cas spécifique:');
  const specificCaseFixed = testSpecificUserCase();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('Test complet du correctif utilisateur:');
  const allUserTestsCorrect = testUserSpaceFix();
  
  const success = specificCaseFixed && allUserTestsCorrect;
  
  console.log(`\n=== RÉSULTAT FINAL ===`);
  console.log(`Cas spécifique résolu: ${specificCaseFixed ? '✅' : '❌'}`);
  console.log(`Tous les tests utilisateur: ${allUserTestsCorrect ? '✅' : '❌'}`);
  console.log(`Succès global: ${success ? '✅' : '❌'}`);
  
  if (success) {
    console.log('\n🎉 Le problème de duplication dans les espaces utilisateurs est résolu !');
  }
  
  process.exit(success ? 0 : 1);
}

module.exports = {
  testUserSpaceFix,
  testSpecificUserCase
};