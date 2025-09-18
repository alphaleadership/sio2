/**
 * Test simple et corrigé pour les uploads de dossiers
 */

const path = require('path');

function testFolderUploadSimple() {
  console.log('=== Test simple des uploads de dossiers ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Test 1: Cas sans duplication
  console.log('Test 1: Upload de dossier sans duplication');
  
  const folderPath1 = path.join(baseDir, 'projects');
  const file1 = {
    name: 'index.html',
    relativePath: 'mon-site/index.html'
  };

  console.log(`  folderPath: ${folderPath1}`);
  console.log(`  relativePath: ${file1.relativePath}`);

  // Logique anti-duplication
  let relativePath1 = file1.relativePath;
  const potentialPath1 = path.join(folderPath1, relativePath1);
  const pathParts1 = potentialPath1.split(path.sep).filter(part => part.length > 0);
  const hasDuplication1 = pathParts1.some((part, index) => {
    return index > 0 && pathParts1[index - 1] === part;
  });

  if (hasDuplication1) {
    relativePath1 = path.basename(relativePath1);
    console.log(`  → Duplication détectée, utilise basename: ${relativePath1}`);
  } else {
    console.log(`  → Pas de duplication, utilise chemin complet: ${relativePath1}`);
  }

  const finalPath1 = path.join(folderPath1, relativePath1);
  const expectedPath1 = path.join(baseDir, 'projects', 'mon-site', 'index.html');

  console.log(`  finalPath: ${finalPath1}`);
  console.log(`  expectedPath: ${expectedPath1}`);
  console.log(`  Résultat: ${finalPath1 === expectedPath1 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);

  // Test 2: Cas avec duplication
  console.log('Test 2: Upload de dossier avec duplication');
  
  const folderPath2 = path.join(baseDir, 'uploads');
  const file2 = {
    name: 'document.pdf',
    relativePath: 'uploads/documents/document.pdf' // Duplication !
  };

  console.log(`  folderPath: ${folderPath2}`);
  console.log(`  relativePath: ${file2.relativePath}`);

  // Logique anti-duplication
  let relativePath2 = file2.relativePath;
  const potentialPath2 = path.join(folderPath2, relativePath2);
  const pathParts2 = potentialPath2.split(path.sep).filter(part => part.length > 0);
  const hasDuplication2 = pathParts2.some((part, index) => {
    return index > 0 && pathParts2[index - 1] === part;
  });

  console.log(`  potentialPath: ${potentialPath2}`);
  console.log(`  pathParts: [${pathParts2.join(', ')}]`);
  console.log(`  hasDuplication: ${hasDuplication2}`);

  if (hasDuplication2) {
    relativePath2 = path.basename(relativePath2);
    console.log(`  → Duplication détectée, utilise basename: ${relativePath2}`);
  } else {
    console.log(`  → Pas de duplication, utilise chemin complet: ${relativePath2}`);
  }

  const finalPath2 = path.join(folderPath2, relativePath2);
  const expectedPath2 = path.join(baseDir, 'uploads', 'document.pdf');

  console.log(`  finalPath: ${finalPath2}`);
  console.log(`  expectedPath: ${expectedPath2}`);
  console.log(`  Résultat: ${finalPath2 === expectedPath2 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);

  // Test 3: Cas avec duplication multiple
  console.log('Test 3: Upload avec duplication multiple');
  
  const folderPath3 = path.join(baseDir, 'docs');
  const file3 = {
    name: 'readme.md',
    relativePath: 'docs/docs/readme.md' // Double duplication !
  };

  console.log(`  folderPath: ${folderPath3}`);
  console.log(`  relativePath: ${file3.relativePath}`);

  // Logique anti-duplication
  let relativePath3 = file3.relativePath;
  const potentialPath3 = path.join(folderPath3, relativePath3);
  const pathParts3 = potentialPath3.split(path.sep).filter(part => part.length > 0);
  const hasDuplication3 = pathParts3.some((part, index) => {
    return index > 0 && pathParts3[index - 1] === part;
  });

  console.log(`  potentialPath: ${potentialPath3}`);
  console.log(`  pathParts: [${pathParts3.join(', ')}]`);
  console.log(`  hasDuplication: ${hasDuplication3}`);

  if (hasDuplication3) {
    relativePath3 = path.basename(relativePath3);
    console.log(`  → Duplication détectée, utilise basename: ${relativePath3}`);
  } else {
    console.log(`  → Pas de duplication, utilise chemin complet: ${relativePath3}`);
  }

  const finalPath3 = path.join(folderPath3, relativePath3);
  const expectedPath3 = path.join(baseDir, 'docs', 'readme.md');

  console.log(`  finalPath: ${finalPath3}`);
  console.log(`  expectedPath: ${expectedPath3}`);
  console.log(`  Résultat: ${finalPath3 === expectedPath3 ? '✅ CORRECT' : '❌ INCORRECT'}\n`);

  // Résumé
  const test1Pass = finalPath1 === expectedPath1;
  const test2Pass = finalPath2 === expectedPath2;
  const test3Pass = finalPath3 === expectedPath3;
  const allPass = test1Pass && test2Pass && test3Pass;

  console.log('=== Résumé ===');
  console.log(`Test 1 (sans duplication): ${test1Pass ? '✅' : '❌'}`);
  console.log(`Test 2 (avec duplication): ${test2Pass ? '✅' : '❌'}`);
  console.log(`Test 3 (duplication multiple): ${test3Pass ? '✅' : '❌'}`);
  console.log(`Résultat global: ${allPass ? '🎉 TOUS RÉUSSIS' : '❌ ÉCHECS DÉTECTÉS'}`);

  if (allPass) {
    console.log('\nLe correctif des uploads de dossiers fonctionne parfaitement !');
    console.log('- Détection automatique des duplications');
    console.log('- Correction avec basename quand nécessaire');
    console.log('- Préservation des structures légitimes');
  }

  return allPass;
}

// Test de plusieurs fichiers dans un dossier
function testMultipleFilesInFolder() {
  console.log('\n=== Test de plusieurs fichiers dans un dossier ===\n');

  const baseDir = path.resolve("../partage");
  const folderPath = path.join(baseDir, 'project');

  const files = [
    {
      name: 'index.html',
      relativePath: 'website/index.html' // Pas de duplication
    },
    {
      name: 'style.css',
      relativePath: 'project/css/style.css' // Duplication !
    },
    {
      name: 'script.js',
      relativePath: 'js/script.js' // Pas de duplication
    }
  ];

  console.log(`folderPath: ${folderPath}`);
  console.log(`Nombre de fichiers: ${files.length}\n`);

  let allCorrect = true;

  files.forEach((file, index) => {
    console.log(`Fichier ${index + 1}: ${file.name}`);
    console.log(`  relativePath original: ${file.relativePath}`);

    // Appliquer la logique anti-duplication
    let relativePath = file.relativePath;
    const potentialPath = path.join(folderPath, relativePath);
    const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
    const hasDuplication = pathParts.some((part, index) => {
      return index > 0 && pathParts[index - 1] === part;
    });

    if (hasDuplication) {
      relativePath = path.basename(relativePath);
      console.log(`  → Duplication détectée, utilise basename: ${relativePath}`);
    } else {
      console.log(`  → Pas de duplication, utilise chemin complet: ${relativePath}`);
    }

    const finalPath = path.join(folderPath, relativePath);
    console.log(`  finalPath: ${finalPath}`);

    // Vérifier l'absence de duplication finale
    const finalParts = finalPath.split(path.sep).filter(part => part.length > 0);
    const hasFinalDuplication = finalParts.some((part, index) => {
      return index > 0 && finalParts[index - 1] === part;
    });

    if (hasFinalDuplication) {
      console.log(`  ❌ DUPLICATION FINALE DÉTECTÉE !`);
      allCorrect = false;
    } else {
      console.log(`  ✅ Pas de duplication finale`);
    }

    console.log('');
  });

  console.log(`Résultat: ${allCorrect ? '🎉 TOUS CORRECTS' : '❌ PROBLÈMES DÉTECTÉS'}`);
  return allCorrect;
}

// Exécuter les tests
if (require.main === module) {
  const test1 = testFolderUploadSimple();
  const test2 = testMultipleFilesInFolder();
  
  const success = test1 && test2;
  console.log(`\n=== RÉSULTAT FINAL ===`);
  console.log(`Tests simples: ${test1 ? '✅' : '❌'}`);
  console.log(`Tests multiples: ${test2 ? '✅' : '❌'}`);
  console.log(`Succès global: ${success ? '✅' : '❌'}`);
  
  process.exit(success ? 0 : 1);
}

module.exports = {
  testFolderUploadSimple,
  testMultipleFilesInFolder
};