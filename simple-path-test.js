/**
 * Test simple et direct de la logique de chemin
 */

const path = require('path');

function simplePathTest() {
  console.log('=== Test simple de la logique de chemin ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Test 1: Upload fichier individuel dans documents
  console.log('Test 1: Upload fichier individuel dans documents');
  
  const req1 = {
    body: { path: 'documents' },
    files: [{
      originalname: 'rapport.pdf',
      webkitRelativePath: undefined
    }]
  };

  console.log('Input:');
  console.log(`  req.body.path: "${req1.body.path}"`);
  console.log(`  file.originalname: "${req1.files[0].originalname}"`);
  console.log(`  file.webkitRelativePath: ${req1.files[0].webkitRelativePath}`);

  // Logique exacte du middleware
  const destFolder1 = req1.body.path ? path.join(baseDir, req1.body.path) : baseDir;
  const isFolderUpload1 = req1.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  const relPath1 = req1.files[0].originalname.replace(/\\/g, '/');
  
  let subPath1;
  if (req1.files[0].webkitRelativePath && isFolderUpload1) {
    subPath1 = req1.files[0].webkitRelativePath;
  } else {
    subPath1 = path.basename(relPath1);
  }
  
  const destPath1 = path.join(destFolder1, subPath1);

  console.log('Calculs:');
  console.log(`  destFolder: ${destFolder1}`);
  console.log(`  isFolderUpload: ${isFolderUpload1}`);
  console.log(`  relPath: ${relPath1}`);
  console.log(`  subPath: ${subPath1}`);
  console.log(`  destPath: ${destPath1}`);

  const expected1 = path.join(baseDir, 'documents', 'rapport.pdf');
  console.log(`  expected: ${expected1}`);
  console.log(`  match: ${destPath1 === expected1 ? '✓' : '✗'}\n`);

  // Test 2: Upload fichier individuel à la racine
  console.log('Test 2: Upload fichier individuel à la racine');
  
  const req2 = {
    body: { path: '' },
    files: [{
      originalname: 'test.txt',
      webkitRelativePath: undefined
    }]
  };

  console.log('Input:');
  console.log(`  req.body.path: "${req2.body.path}"`);
  console.log(`  file.originalname: "${req2.files[0].originalname}"`);
  console.log(`  file.webkitRelativePath: ${req2.files[0].webkitRelativePath}`);

  const destFolder2 = req2.body.path ? path.join(baseDir, req2.body.path) : baseDir;
  const isFolderUpload2 = req2.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  const relPath2 = req2.files[0].originalname.replace(/\\/g, '/');
  
  let subPath2;
  if (req2.files[0].webkitRelativePath && isFolderUpload2) {
    subPath2 = req2.files[0].webkitRelativePath;
  } else {
    subPath2 = path.basename(relPath2);
  }
  
  const destPath2 = path.join(destFolder2, subPath2);

  console.log('Calculs:');
  console.log(`  destFolder: ${destFolder2}`);
  console.log(`  isFolderUpload: ${isFolderUpload2}`);
  console.log(`  relPath: ${relPath2}`);
  console.log(`  subPath: ${subPath2}`);
  console.log(`  destPath: ${destPath2}`);

  const expected2 = path.join(baseDir, 'test.txt');
  console.log(`  expected: ${expected2}`);
  console.log(`  match: ${destPath2 === expected2 ? '✓' : '✗'}\n`);

  // Test 3: Upload de dossier
  console.log('Test 3: Upload de dossier');
  
  const req3 = {
    body: { path: 'uploads' },
    files: [{
      originalname: 'readme.md',
      webkitRelativePath: 'mon-projet/docs/readme.md'
    }]
  };

  console.log('Input:');
  console.log(`  req.body.path: "${req3.body.path}"`);
  console.log(`  file.originalname: "${req3.files[0].originalname}"`);
  console.log(`  file.webkitRelativePath: ${req3.files[0].webkitRelativePath}`);

  const destFolder3 = req3.body.path ? path.join(baseDir, req3.body.path) : baseDir;
  const isFolderUpload3 = req3.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  const relPath3 = req3.files[0].originalname.replace(/\\/g, '/');
  
  let subPath3;
  if (req3.files[0].webkitRelativePath && isFolderUpload3) {
    subPath3 = req3.files[0].webkitRelativePath;
  } else {
    subPath3 = path.basename(relPath3);
  }
  
  const destPath3 = path.join(destFolder3, subPath3);

  console.log('Calculs:');
  console.log(`  destFolder: ${destFolder3}`);
  console.log(`  isFolderUpload: ${isFolderUpload3}`);
  console.log(`  relPath: ${relPath3}`);
  console.log(`  subPath: ${subPath3}`);
  console.log(`  destPath: ${destPath3}`);

  const expected3 = path.join(baseDir, 'uploads', 'mon-projet', 'docs', 'readme.md');
  console.log(`  expected: ${expected3}`);
  console.log(`  match: ${destPath3 === expected3 ? '✓' : '✗'}\n`);

  // Résumé
  const results = [
    destPath1 === expected1,
    destPath2 === expected2,
    destPath3 === expected3
  ];

  const passedTests = results.filter(r => r).length;
  console.log(`=== Résumé: ${passedTests}/3 tests réussis ===`);

  if (passedTests === 3) {
    console.log('🎉 Tous les tests sont passés !');
  } else {
    console.log('❌ Certains tests ont échoué.');
    
    if (!results[0]) console.log('  - Test 1 (fichier individuel dans documents) a échoué');
    if (!results[1]) console.log('  - Test 2 (fichier individuel à la racine) a échoué');
    if (!results[2]) console.log('  - Test 3 (upload de dossier) a échoué');
  }

  return passedTests === 3;
}

// Fonction pour analyser les différences de chemin
function analyzePathDifferences() {
  console.log('\n=== Analyse des différences de chemin ===\n');

  const baseDir = path.resolve("../partage");
  
  // Cas problématique potentiel
  const bodyPath = 'documents';
  const fileName = 'rapport.pdf';

  console.log(`baseDir: ${baseDir}`);
  console.log(`bodyPath: ${bodyPath}`);
  console.log(`fileName: ${fileName}`);

  // Méthode 1: Construction directe
  const method1 = path.join(baseDir, bodyPath, fileName);
  console.log(`\nMéthode 1 (directe): ${method1}`);

  // Méthode 2: Comme dans le middleware
  const destFolder = bodyPath ? path.join(baseDir, bodyPath) : baseDir;
  const subPath = path.basename(fileName);
  const method2 = path.join(destFolder, subPath);
  console.log(`Méthode 2 (middleware): ${method2}`);

  // Comparaison
  console.log(`\nIdentiques: ${method1 === method2}`);
  
  if (method1 !== method2) {
    console.log('Différences détectées:');
    console.log(`  Longueur 1: ${method1.length}`);
    console.log(`  Longueur 2: ${method2.length}`);
    
    // Analyser caractère par caractère
    const maxLen = Math.max(method1.length, method2.length);
    for (let i = 0; i < maxLen; i++) {
      const char1 = method1[i] || '(fin)';
      const char2 = method2[i] || '(fin)';
      if (char1 !== char2) {
        console.log(`  Différence à la position ${i}: "${char1}" vs "${char2}"`);
        break;
      }
    }
  }

  // Test avec normalisation
  const normalized1 = path.normalize(method1);
  const normalized2 = path.normalize(method2);
  console.log(`\nAprès normalisation:`);
  console.log(`  Méthode 1: ${normalized1}`);
  console.log(`  Méthode 2: ${normalized2}`);
  console.log(`  Identiques: ${normalized1 === normalized2}`);
}

// Exécuter les tests
if (require.main === module) {
  const success = simplePathTest();
  analyzePathDifferences();
  process.exit(success ? 0 : 1);
}

module.exports = {
  simplePathTest,
  analyzePathDifferences
};