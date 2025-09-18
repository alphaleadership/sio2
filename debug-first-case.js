/**
 * Debug spécifique pour le premier cas en erreur
 */

const path = require('path');

function debugFirstCase() {
  console.log('=== Debug du premier cas en erreur ===\n');

  const baseDir = path.resolve("../partage");
  console.log(`Base directory: ${baseDir}\n`);

  // Premier cas problématique
  const req = {
    body: { path: 'documents' },
    files: [{
      originalname: 'rapport.pdf',
      webkitRelativePath: 'documents/rapport.pdf'
    }]
  };

  console.log('=== INPUT ===');
  console.log(`req.body.path: "${req.body.path}"`);
  console.log(`file.originalname: "${req.files[0].originalname}"`);
  console.log(`file.webkitRelativePath: "${req.files[0].webkitRelativePath}"`);

  console.log('\n=== ÉTAPE PAR ÉTAPE ===');

  // Étape 1: destFolder
  const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
  console.log(`1. destFolder = ${destFolder}`);

  // Étape 2: isFolderUpload
  const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
  console.log(`2. isFolderUpload = ${isFolderUpload}`);
  console.log(`   Logique: webkitRelativePath="${req.files[0].webkitRelativePath}" contains "/" = ${req.files[0].webkitRelativePath.includes('/')}`);

  // Étape 3: relPath
  const file = req.files[0];
  const relPath = file.originalname.replace(/\\/g, '/');
  console.log(`3. relPath = "${relPath}"`);

  // Étape 4: subPath (logique corrigée)
  let subPath;
  if (isFolderUpload && file.webkitRelativePath) {
    subPath = file.webkitRelativePath;
    console.log(`4. subPath = "${subPath}" (utilise webkitRelativePath car isFolderUpload=true)`);
  } else {
    subPath = path.basename(relPath);
    console.log(`4. subPath = "${subPath}" (utilise basename car isFolderUpload=false ou pas de webkitRelativePath)`);
  }

  // Étape 5: destPath
  const destPath = path.join(destFolder, subPath);
  console.log(`5. destPath = path.join("${destFolder}", "${subPath}") = "${destPath}"`);

  // Étape 6: Chemin attendu
  const expectedPath = path.join(baseDir, 'documents', 'rapport.pdf');
  console.log(`6. expectedPath = "${expectedPath}"`);

  console.log('\n=== ANALYSE ===');
  console.log(`destPath === expectedPath: ${destPath === expectedPath}`);

  if (destPath !== expectedPath) {
    console.log('\n❌ PROBLÈME IDENTIFIÉ:');
    console.log(`Le webkitRelativePath "${file.webkitRelativePath}" contient "/" donc isFolderUpload=true`);
    console.log(`Mais c'est un upload individuel qui devrait ignorer webkitRelativePath !`);
    
    console.log('\n🔧 SOLUTION:');
    console.log('La logique de détection isFolderUpload doit être améliorée');
    console.log('ou la logique de subPath doit être plus stricte pour les uploads individuels');
  }

  // Test avec logique alternative
  console.log('\n=== TEST LOGIQUE ALTERNATIVE ===');
  
  // Alternative 1: Toujours ignorer webkitRelativePath pour uploads individuels
  console.log('\nAlternative 1: Ignorer webkitRelativePath si pas vraiment un dossier');
  
  // Détecter si c'est vraiment un upload de dossier (plusieurs fichiers ou structure complexe)
  const isRealFolderUpload = req.files.length > 1 || 
    (req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.split('/').length > 2));
  
  console.log(`isRealFolderUpload: ${isRealFolderUpload}`);
  
  let alternativeSubPath;
  if (isRealFolderUpload && file.webkitRelativePath) {
    alternativeSubPath = file.webkitRelativePath;
  } else {
    alternativeSubPath = path.basename(relPath);
  }
  
  const alternativeDestPath = path.join(destFolder, alternativeSubPath);
  console.log(`Alternative destPath: "${alternativeDestPath}"`);
  console.log(`Alternative correcte: ${alternativeDestPath === expectedPath}`);

  // Alternative 2: Vérifier si webkitRelativePath cause une duplication
  console.log('\nAlternative 2: Détecter les duplications potentielles');
  
  const potentialPath = path.join(destFolder, file.webkitRelativePath);
  const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
  const hasDuplication = pathParts.some((part, index) => {
    return index > 0 && pathParts[index - 1] === part;
  });
  
  console.log(`Chemin avec webkitRelativePath: "${potentialPath}"`);
  console.log(`Segments: [${pathParts.join(', ')}]`);
  console.log(`Duplication détectée: ${hasDuplication}`);
  
  let smartSubPath;
  if (hasDuplication) {
    smartSubPath = path.basename(relPath);
    console.log(`Duplication détectée → utilise basename: "${smartSubPath}"`);
  } else {
    smartSubPath = file.webkitRelativePath || path.basename(relPath);
    console.log(`Pas de duplication → utilise webkitRelativePath: "${smartSubPath}"`);
  }
  
  const smartDestPath = path.join(destFolder, smartSubPath);
  console.log(`Smart destPath: "${smartDestPath}"`);
  console.log(`Smart correcte: ${smartDestPath === expectedPath}`);

  return {
    destPath,
    expectedPath,
    isCorrect: destPath === expectedPath,
    alternatives: {
      realFolderUpload: {
        path: alternativeDestPath,
        isCorrect: alternativeDestPath === expectedPath
      },
      smartDuplication: {
        path: smartDestPath,
        isCorrect: smartDestPath === expectedPath
      }
    }
  };
}

// Test avec différents scénarios
function testDifferentScenarios() {
  console.log('\n=== Test de différents scénarios ===\n');

  const scenarios = [
    {
      name: 'Upload individuel avec webkitRelativePath problématique',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: 'documents/rapport.pdf'
        }]
      }
    },
    {
      name: 'Upload individuel sans webkitRelativePath',
      req: {
        body: { path: 'documents' },
        files: [{
          originalname: 'rapport.pdf',
          webkitRelativePath: undefined
        }]
      }
    },
    {
      name: 'Vrai upload de dossier',
      req: {
        body: { path: 'projects' },
        files: [{
          originalname: 'index.html',
          webkitRelativePath: 'mon-site/pages/index.html'
        }]
      }
    },
    {
      name: 'Upload multiple (dossier)',
      req: {
        body: { path: 'uploads' },
        files: [
          {
            originalname: 'file1.txt',
            webkitRelativePath: 'folder/file1.txt'
          },
          {
            originalname: 'file2.txt',
            webkitRelativePath: 'folder/file2.txt'
          }
        ]
      }
    }
  ];

  for (const scenario of scenarios) {
    console.log(`Scénario: ${scenario.name}`);
    
    const req = scenario.req;
    const baseDir = path.resolve("../partage");
    
    // Logique actuelle
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    
    console.log(`  Nombre de fichiers: ${req.files.length}`);
    console.log(`  isFolderUpload (actuel): ${isFolderUpload}`);
    
    // Logique améliorée
    const isRealFolderUpload = req.files.length > 1 || 
      req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.split('/').length > 2);
    
    console.log(`  isRealFolderUpload (amélioré): ${isRealFolderUpload}`);
    
    // Traiter le premier fichier
    const file = req.files[0];
    if (file.webkitRelativePath) {
      const potentialPath = path.join(destFolder, file.webkitRelativePath);
      const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
      const hasDuplication = pathParts.some((part, index) => {
        return index > 0 && pathParts[index - 1] === part;
      });
      
      console.log(`  webkitRelativePath: "${file.webkitRelativePath}"`);
      console.log(`  Duplication potentielle: ${hasDuplication}`);
    }
    
    console.log('');
  }
}

// Exécuter le debug
if (require.main === module) {
  const result = debugFirstCase();
  testDifferentScenarios();
  
  console.log('\n=== RECOMMANDATIONS ===');
  
  if (!result.isCorrect) {
    console.log('❌ Le premier cas échoue avec la logique actuelle');
    
    if (result.alternatives.smartDuplication.isCorrect) {
      console.log('✅ La détection de duplication résoudrait le problème');
      console.log('   → Recommandation: Implémenter la logique anti-duplication');
    }
    
    if (result.alternatives.realFolderUpload.isCorrect) {
      console.log('✅ Une meilleure détection de dossier résoudrait le problème');
      console.log('   → Recommandation: Améliorer la logique isFolderUpload');
    }
  } else {
    console.log('✅ Le premier cas fonctionne correctement');
  }
}

module.exports = {
  debugFirstCase,
  testDifferentScenarios
};