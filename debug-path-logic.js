/**
 * Debug de la logique de chemin pour identifier le problème exact
 */

const path = require('path');

function debugPathLogic() {
  console.log('=== Debug de la logique de chemin ===\n');

  // Simuler exactement la logique du middleware
  const baseDir = path.resolve("../partage");
  console.log(`baseDir: ${baseDir}`);

  // Test 1: Upload fichier individuel dans dossier documents
  console.log('\n--- Test 1: Upload fichier individuel dans dossier documents ---');
  
  const test1 = {
    bodyPath: 'documents',
    file: {
      originalname: 'rapport.pdf',
      webkitRelativePath: undefined
    },
    isFolderUpload: false
  };

  console.log(`req.body.path: "${test1.bodyPath}"`);
  console.log(`file.originalname: "${test1.file.originalname}"`);
  console.log(`file.webkitRelativePath: ${test1.file.webkitRelativePath}`);
  console.log(`isFolderUpload: ${test1.isFolderUpload}`);

  // Logique du middleware
  const destFolder1 = test1.bodyPath ? path.join(baseDir, test1.bodyPath) : baseDir;
  console.log(`destFolder: ${destFolder1}`);

  const relPath1 = test1.file.originalname.replace(/\\/g, '/');
  console.log(`relPath: ${relPath1}`);

  let subPath1;
  if (test1.file.webkitRelativePath && test1.isFolderUpload) {
    subPath1 = test1.file.webkitRelativePath;
  } else {
    subPath1 = path.basename(relPath1);
  }
  console.log(`subPath: ${subPath1}`);

  const destPath1 = path.join(destFolder1, subPath1);
  console.log(`destPath: ${destPath1}`);

  const expectedPath1 = path.join(baseDir, 'documents', 'rapport.pdf');
  console.log(`expectedPath: ${expectedPath1}`);

  console.log(`Chemins identiques: ${destPath1 === expectedPath1}`);
  if (destPath1 !== expectedPath1) {
    console.log(`Différence détectée:`);
    console.log(`  Calculé:  "${destPath1}"`);
    console.log(`  Attendu:  "${expectedPath1}"`);
  }

  // Test 2: Upload fichier individuel à la racine
  console.log('\n--- Test 2: Upload fichier individuel à la racine ---');
  
  const test2 = {
    bodyPath: '',
    file: {
      originalname: 'test.txt',
      webkitRelativePath: undefined
    },
    isFolderUpload: false
  };

  console.log(`req.body.path: "${test2.bodyPath}"`);
  console.log(`file.originalname: "${test2.file.originalname}"`);
  console.log(`file.webkitRelativePath: ${test2.file.webkitRelativePath}`);
  console.log(`isFolderUpload: ${test2.isFolderUpload}`);

  const destFolder2 = test2.bodyPath ? path.join(baseDir, test2.bodyPath) : baseDir;
  console.log(`destFolder: ${destFolder2}`);

  const relPath2 = test2.file.originalname.replace(/\\/g, '/');
  console.log(`relPath: ${relPath2}`);

  let subPath2;
  if (test2.file.webkitRelativePath && test2.isFolderUpload) {
    subPath2 = test2.file.webkitRelativePath;
  } else {
    subPath2 = path.basename(relPath2);
  }
  console.log(`subPath: ${subPath2}`);

  const destPath2 = path.join(destFolder2, subPath2);
  console.log(`destPath: ${destPath2}`);

  const expectedPath2 = path.join(baseDir, 'test.txt');
  console.log(`expectedPath: ${expectedPath2}`);

  console.log(`Chemins identiques: ${destPath2 === expectedPath2}`);
  if (destPath2 !== expectedPath2) {
    console.log(`Différence détectée:`);
    console.log(`  Calculé:  "${destPath2}"`);
    console.log(`  Attendu:  "${expectedPath2}"`);
  }

  // Test 3: Upload de dossier (pour comparaison)
  console.log('\n--- Test 3: Upload de dossier avec structure ---');
  
  const test3 = {
    bodyPath: 'uploads',
    file: {
      originalname: 'readme.md',
      webkitRelativePath: 'mon-projet/docs/readme.md'
    },
    isFolderUpload: true
  };

  console.log(`req.body.path: "${test3.bodyPath}"`);
  console.log(`file.originalname: "${test3.file.originalname}"`);
  console.log(`file.webkitRelativePath: ${test3.file.webkitRelativePath}`);
  console.log(`isFolderUpload: ${test3.isFolderUpload}`);

  const destFolder3 = test3.bodyPath ? path.join(baseDir, test3.bodyPath) : baseDir;
  console.log(`destFolder: ${destFolder3}`);

  const relPath3 = test3.file.originalname.replace(/\\/g, '/');
  console.log(`relPath: ${relPath3}`);

  let subPath3;
  if (test3.file.webkitRelativePath && test3.isFolderUpload) {
    subPath3 = test3.file.webkitRelativePath;
  } else {
    subPath3 = path.basename(relPath3);
  }
  console.log(`subPath: ${subPath3}`);

  const destPath3 = path.join(destFolder3, subPath3);
  console.log(`destPath: ${destPath3}`);

  const expectedPath3 = path.join(baseDir, 'uploads', 'mon-projet', 'docs', 'readme.md');
  console.log(`expectedPath: ${expectedPath3}`);

  console.log(`Chemins identiques: ${destPath3 === expectedPath3}`);
  if (destPath3 !== expectedPath3) {
    console.log(`Différence détectée:`);
    console.log(`  Calculé:  "${destPath3}"`);
    console.log(`  Attendu:  "${expectedPath3}"`);
  }

  // Analyse des différences
  console.log('\n=== Analyse des différences ===');
  
  console.log(`Système d'exploitation: ${process.platform}`);
  console.log(`Séparateur de chemin: "${path.sep}"`);
  console.log(`Dossier de travail: ${process.cwd()}`);
  console.log(`baseDir résolu: ${baseDir}`);
  
  // Vérifier si le problème vient de la normalisation
  console.log('\n--- Test de normalisation ---');
  const testPath1 = path.join(baseDir, 'documents', 'rapport.pdf');
  const testPath2 = path.normalize(testPath1);
  console.log(`Avant normalisation: ${testPath1}`);
  console.log(`Après normalisation: ${testPath2}`);
  console.log(`Identiques: ${testPath1 === testPath2}`);
}

// Fonction pour tester différentes approches de construction de chemin
function testPathConstructionApproaches() {
  console.log('\n=== Test des approches de construction de chemin ===\n');

  const baseDir = path.resolve("../partage");
  const bodyPath = 'documents';
  const fileName = 'rapport.pdf';

  console.log(`baseDir: ${baseDir}`);
  console.log(`bodyPath: ${bodyPath}`);
  console.log(`fileName: ${fileName}`);

  // Approche 1: path.join direct
  const approach1 = path.join(baseDir, bodyPath, fileName);
  console.log(`Approche 1 (path.join direct): ${approach1}`);

  // Approche 2: étapes séparées (comme dans le middleware)
  const destFolder = bodyPath ? path.join(baseDir, bodyPath) : baseDir;
  const subPath = path.basename(fileName);
  const approach2 = path.join(destFolder, subPath);
  console.log(`Approche 2 (étapes séparées): ${approach2}`);

  // Approche 3: avec normalisation
  const approach3 = path.normalize(approach2);
  console.log(`Approche 3 (avec normalisation): ${approach3}`);

  console.log(`\nComparaisons:`);
  console.log(`Approche 1 === Approche 2: ${approach1 === approach2}`);
  console.log(`Approche 2 === Approche 3: ${approach2 === approach3}`);
  console.log(`Approche 1 === Approche 3: ${approach1 === approach3}`);
}

// Exécuter le debug
if (require.main === module) {
  debugPathLogic();
  testPathConstructionApproaches();
}

module.exports = {
  debugPathLogic,
  testPathConstructionApproaches
};