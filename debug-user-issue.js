/**
 * Debug pour identifier pourquoi la correction des espaces utilisateurs ne marche pas
 */

const path = require('path');

function debugUserIssue() {
  console.log('=== Debug du problème utilisateur ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Reproduire exactement le cas problématique
  console.log('Cas problématique exact:');
  console.log('- Utilisateur navigue dans son espace : /users/john');
  console.log('- Upload un fichier');
  console.log('- Le système crée : /users/john/users/john/fichier.txt\n');

  // Simuler la requête exacte
  const req = {
    body: { path: 'users/john' }, // Ce que l'interface envoie
    files: [{
      originalname: 'document.pdf',
      webkitRelativePath: 'users/john/document.pdf' // Ce que le navigateur peut envoyer
    }]
  };

  console.log('=== ANALYSE ÉTAPE PAR ÉTAPE ===\n');

  console.log('1. Input de la requête:');
  console.log(`   req.body.path: "${req.body.path}"`);
  console.log(`   file.webkitRelativePath: "${req.files[0].webkitRelativePath}"`);

  console.log('\n2. Construction du destFolder:');
  const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
  console.log(`   destFolder = path.join("${baseDir}", "${req.body.path}")`);
  console.log(`   destFolder = "${destFolder}"`);

  console.log('\n3. Détection isFolderUpload:');
  const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  console.log(`   webkitRelativePath contains '/': ${req.files[0].webkitRelativePath.includes('/')}`);
  console.log(`   isFolderUpload: ${isFolderUpload}`);

  console.log('\n4. Construction du potentialPath:');
  const file = req.files[0];
  const potentialPath = path.join(destFolder, file.webkitRelativePath);
  console.log(`   potentialPath = path.join("${destFolder}", "${file.webkitRelativePath}")`);
  console.log(`   potentialPath = "${potentialPath}"`);

  console.log('\n5. Analyse des segments:');
  const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
  console.log(`   pathParts: [${pathParts.join(', ')}]`);

  console.log('\n6. Détection des duplications consécutives:');
  const duplications = [];
  for (let i = 1; i < pathParts.length; i++) {
    if (pathParts[i] === pathParts[i - 1]) {
      duplications.push({ segment: pathParts[i], position: i });
    }
  }
  
  const hasDuplication = duplications.length > 0;
  console.log(`   Duplications consécutives: ${hasDuplication}`);
  if (hasDuplication) {
    duplications.forEach(dup => {
      console.log(`     - "${dup.segment}" à la position ${dup.position}`);
    });
  }

  console.log('\n7. Détection des patterns utilisateur:');
  const userPatternIssues = [];
  
  pathParts.forEach((part, index) => {
    if (part === 'users' && index > 0) {
      const previousUsersIndex = pathParts.slice(0, index).indexOf('users');
      if (previousUsersIndex !== -1) {
        userPatternIssues.push({
          type: 'double_users',
          positions: [previousUsersIndex, index]
        });
      }
    }
    
    if (index > 2 && pathParts[index - 2] === 'users') {
      const username = pathParts[index - 1];
      const previousUsernameIndex = pathParts.slice(0, index).indexOf(part);
      if (previousUsernameIndex !== -1 && part === username) {
        userPatternIssues.push({
          type: 'duplicate_username',
          username: username,
          positions: [previousUsernameIndex, index]
        });
      }
    }
  });

  const hasUserPatternDuplication = userPatternIssues.length > 0;
  console.log(`   Patterns utilisateur problématiques: ${hasUserPatternDuplication}`);
  if (hasUserPatternDuplication) {
    userPatternIssues.forEach(issue => {
      console.log(`     - ${issue.type}: positions [${issue.positions.join(', ')}]`);
    });
  }

  console.log('\n8. Décision finale:');
  const shouldUseBasename = hasDuplication || hasUserPatternDuplication;
  console.log(`   Utiliser basename: ${shouldUseBasename}`);

  let subPath;
  if (shouldUseBasename) {
    subPath = path.basename(file.originalname);
    console.log(`   subPath = path.basename("${file.originalname}") = "${subPath}"`);
  } else {
    subPath = file.webkitRelativePath;
    console.log(`   subPath = webkitRelativePath = "${subPath}"`);
  }

  console.log('\n9. Chemin final:');
  const finalPath = path.join(destFolder, subPath);
  console.log(`   finalPath = path.join("${destFolder}", "${subPath}")`);
  console.log(`   finalPath = "${finalPath}"`);

  const expectedPath = path.join(baseDir, 'users', 'john', 'document.pdf');
  console.log(`   expectedPath = "${expectedPath}"`);

  const isCorrect = finalPath === expectedPath;
  console.log(`\n=== RÉSULTAT ===`);
  console.log(`Correction fonctionne: ${isCorrect ? '✅ OUI' : '❌ NON'}`);

  if (!isCorrect) {
    console.log('\n❌ PROBLÈME IDENTIFIÉ:');
    console.log(`   Calculé:  "${finalPath}"`);
    console.log(`   Attendu:  "${expectedPath}"`);
    console.log(`   Différence: ${finalPath.length - expectedPath.length} caractères`);
    
    // Analyser caractère par caractère
    const maxLen = Math.max(finalPath.length, expectedPath.length);
    for (let i = 0; i < maxLen; i++) {
      const char1 = finalPath[i] || '(fin)';
      const char2 = expectedPath[i] || '(fin)';
      if (char1 !== char2) {
        console.log(`   Première différence à la position ${i}: "${char1}" vs "${char2}"`);
        break;
      }
    }
  }

  return isCorrect;
}

// Test de différentes approches de correction
function testCorrectionApproaches() {
  console.log('\n=== Test de différentes approches de correction ===\n');

  const baseDir = path.resolve("../partage");
  const bodyPath = 'users/john';
  const webkitRelativePath = 'users/john/document.pdf';
  const originalname = 'document.pdf';

  console.log(`baseDir: ${baseDir}`);
  console.log(`bodyPath: ${bodyPath}`);
  console.log(`webkitRelativePath: ${webkitRelativePath}`);
  console.log(`originalname: ${originalname}`);

  // Approche 1: Logique actuelle
  console.log('\nApproche 1: Logique actuelle du middleware');
  const destFolder1 = path.join(baseDir, bodyPath);
  const potentialPath1 = path.join(destFolder1, webkitRelativePath);
  const pathParts1 = potentialPath1.split(path.sep).filter(part => part.length > 0);
  
  const hasDuplication1 = pathParts1.some((part, index) => {
    return index > 0 && pathParts1[index - 1] === part;
  });
  
  const hasUserPattern1 = pathParts1.some((part, index) => {
    if (part === 'users' && index > 0) {
      return pathParts1.slice(0, index).includes('users');
    }
    if (index > 2 && pathParts1[index - 2] === 'users') {
      return pathParts1.slice(0, index).includes(part);
    }
    return false;
  });

  const subPath1 = (hasDuplication1 || hasUserPattern1) ? path.basename(originalname) : webkitRelativePath;
  const result1 = path.join(destFolder1, subPath1);
  
  console.log(`  potentialPath: ${potentialPath1}`);
  console.log(`  pathParts: [${pathParts1.join(', ')}]`);
  console.log(`  hasDuplication: ${hasDuplication1}`);
  console.log(`  hasUserPattern: ${hasUserPattern1}`);
  console.log(`  subPath: ${subPath1}`);
  console.log(`  result: ${result1}`);

  // Approche 2: Ignorer complètement webkitRelativePath pour les espaces utilisateurs
  console.log('\nApproche 2: Ignorer webkitRelativePath pour espaces utilisateurs');
  const isUserSpace = bodyPath.startsWith('users/');
  const subPath2 = isUserSpace ? path.basename(originalname) : webkitRelativePath;
  const result2 = path.join(destFolder1, subPath2);
  
  console.log(`  isUserSpace: ${isUserSpace}`);
  console.log(`  subPath: ${subPath2}`);
  console.log(`  result: ${result2}`);

  // Approche 3: Nettoyer webkitRelativePath des duplications
  console.log('\nApproche 3: Nettoyer webkitRelativePath');
  let cleanedWebkitPath = webkitRelativePath;
  
  // Si bodyPath est dans webkitRelativePath, le retirer
  if (webkitRelativePath.startsWith(bodyPath + '/')) {
    cleanedWebkitPath = webkitRelativePath.substring(bodyPath.length + 1);
  } else if (webkitRelativePath === bodyPath) {
    cleanedWebkitPath = path.basename(originalname);
  }
  
  const result3 = path.join(destFolder1, cleanedWebkitPath);
  
  console.log(`  cleanedWebkitPath: ${cleanedWebkitPath}`);
  console.log(`  result: ${result3}`);

  // Comparer les approches
  const expectedPath = path.join(baseDir, 'users', 'john', 'document.pdf');
  console.log(`\n=== COMPARAISON ===`);
  console.log(`Expected: ${expectedPath}`);
  console.log(`Approche 1: ${result1} ${result1 === expectedPath ? '✅' : '❌'}`);
  console.log(`Approche 2: ${result2} ${result2 === expectedPath ? '✅' : '❌'}`);
  console.log(`Approche 3: ${result3} ${result3 === expectedPath ? '✅' : '❌'}`);

  // Recommandation
  if (result1 === expectedPath) {
    console.log('\n✅ La logique actuelle devrait fonctionner');
  } else if (result2 === expectedPath) {
    console.log('\n💡 Recommandation: Utiliser l\'approche 2 (ignorer pour espaces utilisateurs)');
  } else if (result3 === expectedPath) {
    console.log('\n💡 Recommandation: Utiliser l\'approche 3 (nettoyer webkitRelativePath)');
  } else {
    console.log('\n❌ Aucune approche ne fonctionne, investigation plus poussée nécessaire');
  }
}

// Test en conditions réelles
function testRealWorldScenario() {
  console.log('\n=== Test en conditions réelles ===\n');

  // Simuler exactement ce qui se passe quand un utilisateur uploade
  console.log('Scénario réel:');
  console.log('1. Utilisateur "john" se connecte');
  console.log('2. Navigue vers "Mon dossier" → /users/john');
  console.log('3. Upload un fichier "document.pdf"');
  console.log('4. Le navigateur peut envoyer webkitRelativePath avec le chemin complet\n');

  const realScenario = {
    session: { user: { username: 'john', role: 'user' } },
    query: { path: '/users/john' }, // Navigation
    body: { path: 'users/john' },   // Formulaire d'upload
    files: [{
      originalname: 'document.pdf',
      webkitRelativePath: 'users/john/document.pdf', // Problématique
      path: '/tmp/upload_123456'
    }]
  };

  console.log('Données de la requête réelle:');
  console.log(`  req.session.user.username: ${realScenario.session.user.username}`);
  console.log(`  req.query.path: ${realScenario.query.path}`);
  console.log(`  req.body.path: ${realScenario.body.path}`);
  console.log(`  file.webkitRelativePath: ${realScenario.files[0].webkitRelativePath}`);

  // Analyser le problème
  console.log('\n=== ANALYSE DU PROBLÈME ===');
  
  const baseDir = path.resolve("../partage");
  const destFolder = realScenario.body.path ? path.join(baseDir, realScenario.body.path) : baseDir;
  
  console.log(`destFolder: ${destFolder}`);
  
  // Si on utilise webkitRelativePath directement
  const problematicPath = path.join(destFolder, realScenario.files[0].webkitRelativePath);
  console.log(`Chemin problématique: ${problematicPath}`);
  
  // Analyser les segments
  const segments = problematicPath.split(path.sep).filter(part => part.length > 0);
  console.log(`Segments: [${segments.join(', ')}]`);
  
  // Identifier les duplications
  const issues = [];
  for (let i = 1; i < segments.length; i++) {
    if (segments[i] === segments[i - 1]) {
      issues.push(`Duplication consécutive: "${segments[i]}" aux positions ${i-1} et ${i}`);
    }
  }
  
  // Identifier les patterns utilisateur
  const usersIndices = segments.map((part, index) => part === 'users' ? index : -1).filter(i => i !== -1);
  if (usersIndices.length > 1) {
    issues.push(`Multiple "users" aux positions: [${usersIndices.join(', ')}]`);
  }
  
  const johnIndices = segments.map((part, index) => part === 'john' ? index : -1).filter(i => i !== -1);
  if (johnIndices.length > 1) {
    issues.push(`Multiple "john" aux positions: [${johnIndices.join(', ')}]`);
  }

  console.log('\nProblèmes identifiés:');
  if (issues.length > 0) {
    issues.forEach((issue, index) => {
      console.log(`  ${index + 1}. ${issue}`);
    });
  } else {
    console.log('  Aucun problème détecté (étrange !)');
  }

  // Test de la solution
  console.log('\n=== TEST DE LA SOLUTION ===');
  
  const shouldCorrect = issues.length > 0;
  const correctedSubPath = shouldCorrect ? path.basename(realScenario.files[0].originalname) : realScenario.files[0].webkitRelativePath;
  const correctedPath = path.join(destFolder, correctedSubPath);
  
  console.log(`Correction nécessaire: ${shouldCorrect}`);
  console.log(`subPath corrigé: ${correctedSubPath}`);
  console.log(`Chemin corrigé: ${correctedPath}`);
  
  const expectedPath = path.join(baseDir, 'users', 'john', 'document.pdf');
  console.log(`Chemin attendu: ${expectedPath}`);
  
  const isFixed = correctedPath === expectedPath;
  console.log(`Solution fonctionne: ${isFixed ? '✅' : '❌'}`);

  return isFixed;
}

// Exécuter le debug
if (require.main === module) {
  console.log('Debug du problème utilisateur:');
  const debugResult = debugUserIssue();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('Test des approches de correction:');
  testCorrectionApproaches();
  
  console.log('\n' + '='.repeat(60) + '\n');
  
  console.log('Test en conditions réelles:');
  const realWorldResult = testRealWorldScenario();
  
  console.log(`\n=== CONCLUSION ===`);
  console.log(`Debug: ${debugResult ? '✅' : '❌'}`);
  console.log(`Conditions réelles: ${realWorldResult ? '✅' : '❌'}`);
  
  if (!debugResult || !realWorldResult) {
    console.log('\n🔧 ACTIONS RECOMMANDÉES:');
    console.log('1. Vérifier que la logique du middleware correspond exactement au test');
    console.log('2. Ajouter des logs dans le middleware pour debug en temps réel');
    console.log('3. Tester avec un upload réel pour confirmer le comportement');
  }
}

module.exports = {
  debugUserIssue,
  testRealWorldScenario
};