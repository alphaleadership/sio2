/**
 * Test pour vérifier que webkitRelativePath est ignoré pour les uploads individuels
 */

const path = require('path');

function testNoRelativePathForIndividualUploads() {
    console.log('=== Test: Ignorer webkitRelativePath pour uploads individuels ===\n');

    const baseDir = path.resolve("../partage");
    console.log(`Base directory: ${baseDir}\n`);

    // Cas de test problématiques où webkitRelativePath pourrait causer des duplications
    const testCases = [
        {
            name: 'Upload individuel avec webkitRelativePath problématique',
            req: {
                body: { path: 'documents' },
                files: [{
                    originalname: 'rapport.pdf',
                    webkitRelativePath: 'documents/rapport.pdf' // Problématique !
                }]
            },
            expectedPath: path.join(baseDir, 'documents', 'rapport.pdf'),
            shouldIgnoreWebkitRelativePath: true
        },
        {
            name: 'Upload individuel sans webkitRelativePath',
            req: {
                body: { path: 'documents' },
                files: [{
                    originalname: 'rapport.pdf',
                    webkitRelativePath: undefined
                }]
            },
            expectedPath: path.join(baseDir, 'documents', 'rapport.pdf'),
            shouldIgnoreWebkitRelativePath: false
        },
        {
            name: 'Upload de dossier avec webkitRelativePath légitime',
            req: {
                body: { path: 'projects' },
                files: [{
                    originalname: 'index.html',
                    webkitRelativePath: 'mon-site/index.html'
                }]
            },
            expectedPath: path.join(baseDir, 'projects', 'mon-site', 'index.html'),
            shouldIgnoreWebkitRelativePath: false
        },
        {
            name: 'Upload individuel à la racine avec webkitRelativePath',
            req: {
                body: { path: '' },
                files: [{
                    originalname: 'test.txt',
                    webkitRelativePath: 'test.txt' // Devrait être ignoré
                }]
            },
            expectedPath: path.join(baseDir, 'test.txt'),
            shouldIgnoreWebkitRelativePath: true
        }
    ];

    let allTestsPassed = true;

    for (const testCase of testCases) {
        console.log(`Test: ${testCase.name}`);

        const req = testCase.req;
        console.log(`  req.body.path: "${req.body.path}"`);
        console.log(`  file.originalname: "${req.files[0].originalname}"`);
        console.log(`  file.webkitRelativePath: ${req.files[0].webkitRelativePath || 'undefined'}`);

        // === LOGIQUE CORRIGÉE DU MIDDLEWARE ===

        // 1. Construire destFolder
        const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;

        // 2. Détecter si c'est un upload de dossier
        const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

        // 3. Traiter le fichier avec la logique corrigée
        const file = req.files[0];
        const relPath = file.originalname.replace(/\\/g, '/');

        let subPath;
        if (isFolderUpload && file.webkitRelativePath) {
            // Pour les uploads de dossiers, utiliser le chemin relatif complet
            subPath = file.webkitRelativePath;
            console.log(`  → Utilise webkitRelativePath (upload de dossier)`);
        } else {
            // Pour les uploads de fichiers individuels, utiliser TOUJOURS seulement le nom du fichier
            // Ignorer complètement webkitRelativePath pour éviter les duplications
            subPath = path.basename(relPath);
            console.log(`  → Ignore webkitRelativePath (upload individuel)`);
        }

        const destPath = path.join(destFolder, subPath);

        // === FIN LOGIQUE MIDDLEWARE ===

        console.log(`  destFolder: ${destFolder}`);
        console.log(`  isFolderUpload: ${isFolderUpload}`);
        console.log(`  subPath: ${subPath}`);
        console.log(`  destPath: ${destPath}`);
        console.log(`  expectedPath: ${testCase.expectedPath}`);

        // Vérifier que webkitRelativePath est ignoré quand il le faut
        const webkitRelativePathUsed = subPath === file.webkitRelativePath;
        const shouldIgnore = testCase.shouldIgnoreWebkitRelativePath;

        if (shouldIgnore && webkitRelativePathUsed) {
            console.log(`  ✗ ERREUR: webkitRelativePath devrait être ignoré mais a été utilisé`);
            allTestsPassed = false;
        } else if (!shouldIgnore && !webkitRelativePathUsed && file.webkitRelativePath) {
            console.log(`  ✗ ERREUR: webkitRelativePath devrait être utilisé mais a été ignoré`);
            allTestsPassed = false;
        } else {
            console.log(`  ✓ webkitRelativePath géré correctement`);
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

        // Vérifier l'absence de duplication
        const pathParts = normalizedDestPath.split(path.sep).filter(part => part.length > 0);
        const hasDuplication = pathParts.some((part, index) => {
            return index > 0 && pathParts[index - 1] === part;
        });

        if (hasDuplication) {
            console.log(`  ⚠️  DUPLICATION DÉTECTÉE dans le chemin !`);
            console.log(`    Segments: [${pathParts.join(', ')}]`);
            allTestsPassed = false;
        } else {
            console.log(`  ✓ Aucune duplication détectée`);
        }

        console.log('');
    }

    // Test spécifique pour les cas edge
    console.log('=== Tests des cas edge ===\n');

    const edgeCases = [
        {
            name: 'webkitRelativePath avec plusieurs niveaux pour upload individuel',
            req: {
                body: { path: 'uploads' },
                files: [{
                    originalname: 'file.txt',
                    webkitRelativePath: 'uploads/subfolder/file.txt' // Très problématique !
                }]
            }
        },
        {
            name: 'webkitRelativePath identique au body.path',
            req: {
                body: { path: 'documents' },
                files: [{
                    originalname: 'test.pdf',
                    webkitRelativePath: 'documents' // Edge case
                }]
            }
        }
    ];

    for (const edgeCase of edgeCases) {
        console.log(`Test edge: ${edgeCase.name}`);

        const req = edgeCase.req;
        const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
        const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

        const file = req.files[0];
        const relPath = file.originalname.replace(/\\/g, '/');

        let subPath;
        if (isFolderUpload && file.webkitRelativePath) {
            subPath = file.webkitRelativePath;
        } else {
            subPath = path.basename(relPath);
        }

        const destPath = path.join(destFolder, subPath);

        console.log(`  webkitRelativePath: "${file.webkitRelativePath}"`);
        console.log(`  isFolderUpload: ${isFolderUpload}`);
        console.log(`  subPath utilisé: "${subPath}"`);
        console.log(`  destPath: "${destPath}"`);

        // Analyser les duplications
        const pathParts = destPath.split(path.sep).filter(part => part.length > 0);
        const duplications = [];
        for (let i = 1; i < pathParts.length; i++) {
            if (pathParts[i] === pathParts[i - 1]) {
                duplications.push(pathParts[i]);
            }
        }

        if (duplications.length > 0) {
            console.log(`  ⚠️  Duplications: [${duplications.join(', ')}]`);
        } else {
            console.log(`  ✓ Pas de duplication`);
        }

        console.log('');
    }

    // Résumé
    console.log('=== Résumé ===');
    if (allTestsPassed) {
        console.log('🎉 Tous les tests sont passés !');
        console.log('\nComportement confirmé:');
        console.log('- Upload individuel → webkitRelativePath TOUJOURS ignoré');
        console.log('- Upload de dossier → webkitRelativePath utilisé si présent');
        console.log('- Pas de duplication de segments de chemin');
        console.log('- Logique robuste contre les cas edge');
    } else {
        console.log('❌ Certains tests ont échoué.');
        console.log('La logique doit être ajustée pour ignorer webkitRelativePath dans tous les cas d\'upload individuel.');
    }

    return allTestsPassed;
}

// Fonction pour tester un cas spécifique
function testSpecificCase(bodyPath, originalname, webkitRelativePath) {
    console.log(`\n=== Test cas spécifique ===`);
    console.log(`bodyPath: "${bodyPath}"`);
    console.log(`originalname: "${originalname}"`);
    console.log(`webkitRelativePath: "${webkitRelativePath || 'undefined'}"`);

    const baseDir = path.resolve("../partage");

    // Simuler un seul fichier
    const req = {
        body: { path: bodyPath },
        files: [{
            originalname: originalname,
            webkitRelativePath: webkitRelativePath
        }]
    };

    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');

    let subPath;
    if (isFolderUpload && file.webkitRelativePath) {
        subPath = file.webkitRelativePath;
    } else {
        subPath = path.basename(relPath);
    }

    const destPath = path.join(destFolder, subPath);

    console.log(`\nRésultats:`);
    console.log(`destFolder: ${destFolder}`);
    console.log(`isFolderUpload: ${isFolderUpload}`);
    console.log(`subPath: ${subPath}`);
    console.log(`destPath: ${destPath}`);
    console.log(`webkitRelativePath utilisé: ${subPath === webkitRelativePath}`);

    // Analyser les duplications
    const pathParts = destPath.split(path.sep).filter(part => part.length > 0);
    const duplications = [];
    for (let i = 1; i < pathParts.length; i++) {
        if (pathParts[i] === pathParts[i - 1]) {
            duplications.push(pathParts[i]);
        }
    }

    if (duplications.length > 0) {
        console.log(`⚠️  Duplications détectées: [${duplications.join(', ')}]`);
    } else {
        console.log(`✓ Aucune duplication`);
    }
}

// Interface en ligne de commande
function main() {
    const command = process.argv[2];

    switch (command) {
        case 'test-case':
            const bodyPath = process.argv[3] || '';
            const originalname = process.argv[4] || 'test.txt';
            const webkitRelativePath = process.argv[5];
            testSpecificCase(bodyPath, originalname, webkitRelativePath);
            break;

        case 'test':
        default:
            const success = testNoRelativePathForIndividualUploads();
            process.exit(success ? 0 : 1);
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    main();
}

module.exports = {
    testNoRelativePathForIndividualUploads,
    testSpecificCase
};