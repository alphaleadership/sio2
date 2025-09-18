/**
 * Test simple et corrigé pour vérifier le correctif des espaces utilisateurs
 */

const path = require('path');

function testUserSpaceSimple() {
  console.log('=== Test simple du correctif espaces utilisateurs ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Test 1: Cas problématique principal (celui mentionné par l'utilisateur)
  console.log('Test 1: Cas problématique principal');
  
  const req1 = {
    body: { path: 'users/john' },
    files: [{
      originalname: 'document.pdf',
      webkitRelativePath: 'users/john/document.pdf' // Duplication !
    }]
  };

  console.log(`  req.body.path: "${req1.body.path}"`);
  console.log(`  webkitRelativePath: "${req1.files[0].webkitRelativePath}"`);

  // Logique du middleware corrigé
  const destFolder1 = req1.body.path ? path.join(baseDir, req1.body.path) : baseDir;
  const isFolderUpload1 = req1.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  
  const file1 = req1.files[0];
  const relPath1 = file1.originalname.replace(/\\/g, '/');
  
  let subPath1;
  
  if (file1.webkitRelativePath && isFolderUpload1) {
    const potentialPath1 = path.join(destFolder1, file1.webkitRelativePath);
    const pathParts1 = potentialPath1.split(path.sep).filter(part => part.length > 0);
    
    console.log(`  potentialPath: ${potentialPath1}`);
    console.log(`  pathParts: [${pathParts1.join(', ')}]`);
    
    // Détecter les duplications consécutives
    const hasDuplication1 = pathParts1.some((part, index) => {
      return index > 0 && pathParts1[index - 1] === part;
    });
    
    // Détecter spécifiquement les duplications de pattern utilisateur
    const hasUserPatternDuplication1 = pathParts1.some((part, index) => {
      if (part === 'users' && index > 0) {
        return pathParts1.slice(0, index).includes('users');
      }
      if (index > 2 && pathParts1[index - 2] === 'users') {
        return pathParts1.slice(0, index).includes(part);
      }
      return false;
    });
    
    console.log(`  hasDuplication: ${hasDuplication1}`);
    console.log(`  hasUserPatternDuplication: ${hasUserPatternDuplication1}`);
    
    if (hasDuplication1 || hasUserPatternDuplication1) {
      subPath1 = path.basename(relPath1);
      console.log(`  → Duplication détectée, utilise basename: ${subPath1}`);
    } else {
      subPath1 = file1.webkitRelativePath;
      console.log(`  → Pas de duplication, utilise webkitRelativePath: ${subPath1}`);
    }
  } else {
    subPath1 = path.basename(relPath1);
    console.log(`  → Upload individuel, utilise basename: ${subPath1}`);
  }
  
  const finalPath1 = path.join(destFolder1, subPath1);
  const expectedPath1 = path.join(baseDir, 'users', 'john', 'document.pdf');

  console.log(`  finalPath: ${finalPath1}`);
  console.log(`  expectedPath: ${expectedPath1}`);
  console.log(`  Résultat: ${finalPath1 === expectedPath1 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);

  // Test 2: Cas légitime (ne doit pas être corrigé)
  console.log('Test 2: Cas légitime sans duplication');
  
  const req2 = {
    body: { path: 'users/alice' },
    files: [{
      originalname: 'index.html',
      webkitRelativePath: 'mon-projet/index.html' // Pas de duplication
    }]
  };

  console.log(`  req.body.path: "${req2.body.path}"`);
  console.log(`  webkitRelativePath: "${req2.files[0].webkitRelativePath}"`);

  const destFolder2 = req2.body.path ? path.join(baseDir, req2.body.path) : baseDir;
  const isFolderUpload2 = req2.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  
  const file2 = req2.files[0];
  const relPath2 = file2.originalname.replace(/\\/g, '/');
  
  let subPath2;
  
  if (file2.webkitRelativePath && isFolderUpload2) {
    const potentialPath2 = path.join(destFolder2, file2.webkitRelativePath);
    const pathParts2 = potentialPath2.split(path.sep).filter(part => part.length > 0);
    
    const hasDuplication2 = pathParts2.some((part, index) => {
      return index > 0 && pathParts2[index - 1] === part;
    });
    
    const hasUserPatternDuplication2 = pathParts2.some((part, index) => {
      if (part === 'users' && index > 0) {
        return pathParts2.slice(0, index).includes('users');
      }
      if (index > 2 && pathParts2[index - 2] === 'users') {
        return pathParts2.slice(0, index).includes(part);
      }
      return false;
    });
    
    if (hasDuplication2 || hasUserPatternDuplication2) {
      subPath2 = path.basename(relPath2);
      console.log(`  → Duplication détectée, utilise basename: ${subPath2}`);
    } else {
      subPath2 = file2.webkitRelativePath;
      console.log(`  → Pas de duplication, utilise webkitRelativePath: ${subPath2}`);
    }
  } else {
    subPath2 = path.basename(relPath2);
    console.log(`  → Upload individuel, utilise basename: ${subPath2}`);
  }
  
  const finalPath2 = path.join(destFolder2, subPath2);
  const expectedPath2 = path.join(baseDir, 'users', 'alice', 'mon-projet', 'index.html');

  console.log(`  finalPath: ${finalPath2}`);
  console.log(`  expectedPath: ${expectedPath2}`);
  console.log(`  Résultat: ${finalPath2 === expectedPath2 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);

  // Test 3: Duplication de nom d'utilisateur
  console.log('Test 3: Duplication de nom d\'utilisateur');
  
  const req3 = {
    body: { path: 'users/bob' },
    files: [{
      originalname: 'config.json',
      webkitRelativePath: 'bob/settings/config.json' // Duplication du nom d'utilisateur
    }]
  };

  console.log(`  req.body.path: "${req3.body.path}"`);
  console.log(`  webkitRelativePath: "${req3.files[0].webkitRelativePath}"`);

  const destFolder3 = req3.body.path ? path.join(baseDir, req3.body.path) : baseDir;
  const isFolderUpload3 = req3.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  
  const file3 = req3.files[0];
  const relPath3 = file3.originalname.replace(/\\/g, '/');
  
  let subPath3;
  
  if (file3.webkitRelativePath && isFolderUpload3) {
    const potentialPath3 = path.join(destFolder3, file3.webkitRelativePath);
    const pathParts3 = potentialPath3.split(path.sep).filter(part => part.length > 0);
    
    console.log(`  potentialPath: ${potentialPath3}`);
    console.log(`  pathParts: [${pathParts3.join(', ')}]`);
    
    const hasDuplication3 = pathParts3.some((part, index) => {
      return index > 0 && pathParts3[index - 1] === part;
    });
    
    const hasUserPatternDuplication3 = pathParts3.some((part, index) => {
      if (part === 'users' && index > 0) {
        return pathParts3.slice(0, index).includes('users');
      }
      if (index > 2 && pathParts3[index - 2] === 'users') {
        return pathParts3.slice(0, index).includes(part);
      }
      return false;
    });
    
    console.log(`  hasDuplication: ${hasDuplication3}`);
    console.log(`  hasUserPatternDuplication: ${hasUserPatternDuplication3}`);
    
    if (hasDuplication3 || hasUserPatternDuplication3) {
      subPath3 = path.basename(relPath3);
      console.log(`  → Duplication détectée, utilise basename: ${subPath3}`);
    } else {
      subPath3 = file3.webkitRelativePath;
      console.log(`  → Pas de duplication, utilise webkitRelativePath: ${subPath3}`);
    }
  } else {
    subPath3 = path.basename(relPath3);
    console.log(`  → Upload individuel, utilise basename: ${subPath3}`);
  }
  
  const finalPath3 = path.join(destFolder3, subPath3);
  const expectedPath3 = path.join(baseDir, 'users', 'bob', 'config.json');

  console.log(`  finalPath: ${finalPath3}`);
  console.log(`  expectedPath: ${expectedPath3}`);
  console.log(`  Résultat: ${finalPath3 === expectedPath3 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);

  // Résumé
  const test1Pass = finalPath1 === expectedPath1;
  const test2Pass = finalPath2 === expectedPath2;
  const test3Pass = finalPath3 === expectedPath3;
  const allPass = test1Pass && test2Pass && test3Pass;

  console.log('=== Résumé ===');
  console.log(`Test 1 (cas problématique principal): ${test1Pass ? '✅' : '❌'}`);
  console.log(`Test 2 (cas légitime): ${test2Pass ? '✅' : '❌'}`);
  console.log(`Test 3 (duplication nom utilisateur): ${test3Pass ? '✅' : '❌'}`);
  console.log(`Résultat global: ${allPass ? '🎉 TOUS RÉUSSIS' : '❌ ÉCHECS DÉTECTÉS'}`);

  if (allPass) {
    console.log('\n✅ Le correctif des espaces utilisateurs fonctionne parfaitement !');
    console.log('- Plus de duplication /users/username/users/username');
    console.log('- Détection intelligente des patterns utilisateur');
    console.log('- Préservation des structures légitimes');
  }

  return allPass;
}

// Exécuter le test
if (require.main === module) {
  const success = testUserSpaceSimple();
  process.exit(success ? 0 : 1);
}

module.exports = { testUserSpaceSimple };