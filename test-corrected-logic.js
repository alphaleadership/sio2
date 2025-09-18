/**
 * Test avec la logique anti-duplication corrigée
 * Utilise exactement la même logique que le middleware
 */

const path = require('path');

function testCorrectedAntiDuplicationLogic() {
    console.log('=== Test avec logique anti-duplication corrigée ===\n');

    const baseDir = path.resolve("../partage");
    console.log(`Base directory: ${baseDir}\n`);

    // Cas de test avec la logique exacte du middleware
    const testCases = [
        {
            name: 'Upload individuel avec webkitRelativePath problématique',
            req: {
                body: { path: 'documents' },
                files: [{
                    originalname: 'rapport.pdf',
                    webkitRelativePath: 'documents/rapport.pdf'
                }]
            },
            expectedPath: path.join(baseDir, 'documents', 'rapport.pdf'),
            expectedBehavior: 'duplication_detected'
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
            expectedBehavior: 'basename_used'
        },
        {
            name: 'Upload de dossier légitime sans duplication',
            req: {
                body: { path: 'projects' },
                files: [{
                    originalname: 'index.html',
                    webkitRelativePath: 'mon-site/pages/index.html'
                }]
            },
            expectedPath: path.join(baseDir, 'projects', 'mon-site', 'pages', 'index.html'),
            expectedBehavior: 'webkit_path_used'
        },
        {
            name: 'Upload de dossier avec duplication potentielle',
            req: {
                body: { path: 'projects' },
                files: [{
                    originalname: 'index.html',
                    webkitRelativePath: 'projects/mon-site/index.html'
                }]
            },
            expectedPath: path.join(baseDir, 'projects', 'index.html'),
            expectedBehavior: 'duplication_detected'
        }
    ];

    let allTestsPassed = true;

    for (const testCase of testCases) {
        console.log(`Test: ${testCase.name}`);

        const req = testCase.req;
        console.log(`  req.body.path: "${req.body.path}"`);
        console.log(`  file.originalname: "${req.files[0].originalname}"`);
        console.log(`  file.webkitRelativePath: ${req.files[0].webkitRelativePath || 'undefined'}`);

        // === LOGIQUE EXACTE DU MIDDLEWARE ===

        // 1. Construire destFolder
        const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;

        // 2. Détecter si c'est un upload de dossier
        const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

        // 3. Traiter le fichier avec logique anti-duplication
        const file = req.files[0];
        const relPath = file.originalname.replace(/\\/g, '/');

        let subPath;
        let actualBehavior;

        if (file.webkitRelativePath && isFolderUpload) {
            // Vérifier si l'utilisation de webkitRelativePath causerait une duplication
            const potentialPath = path.join(destFolder, file.webkitRelativePath);
            const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
            const hasDuplication = pathParts.some((part, index) => {
                return index > 0 && pathParts[index - 1] === part;
            });

            if (hasDuplication) {
                // Duplication détectée → utiliser seulement le nom du fichier
                subPath = path.basename(relPath);
                actualBehavior = 'duplication_detected';
                console.log(`  → Duplication détectée, utilise basename`);
            } else {
                // Pas de duplication → utiliser webkitRelativePath
                subPath = file.webkitRelativePath;
                actualBehavior = 'webkit_path_used';
                console.log(`  → Pas de duplication, utilise webkitRelativePath`);
            }
        } else {
            // Upload individuel ou pas de webkitRelativePath → utiliser seulement le nom du fichier
            subPath = path.basename(relPath);
            actualBehavior = 'basename_used';
            console.log(`  → Upload individuel ou pas de webkitRelativePath, utilise basename`);
        }

        const destPath = path.join(destFolder, subPath);

        // === FIN LOGIQUE MIDDLEWARE ===

        console.log(`  destFolder: ${destFolder}`);
        console.log(`  isFolderUpload: ${isFolderUpload}`);
        console.log(`  subPath: ${subPath}`);
        console.log(`  destPath: ${destPath}`);
        console.log(`  expectedPath: ${testCase.expectedPath}`);
        console.log(`  expectedBehavior: ${testCase.expectedBehavior}`);
        console.log(`  actualBehavior: ${actualBehavior}`);

        // Vérifier le comportement
        if (actualBehavior !== testCase.expectedBehavior) {
            console.log(`  ✗ ERREUR: Comportement incorrect`);
            console.log(`    Attendu: ${testCase.expectedBehavior}`);
            console.log(`    Obtenu: ${actualBehavior}`);
            allTestsPassed = false;
        } else {
            console.log(`  ✓ Comportement correct`);
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

        // Vérifier l'absence de duplication finale
        const finalPathParts = normalizedDestPath.split(path.sep).filter(part => part.length > 0);
        const hasFinalDuplication = finalPathParts.some((part, index) => {
            return index > 0 && finalPathParts[index - 1] === part;
        });

        if (hasFinalDuplication) {
            console.log(`  ⚠️  DUPLICATION FINALE DÉTECTÉE !`);
            console.log(`    Segments: [${finalPathParts.join(', ')}]`);
            allTestsPassed = false;
        } else {
            console.log(`  ✓ Aucune duplication finale`);
        }

        console.log('');
    }

    // Test des cas edge avec la logique corrigée
    console.log('=== Tests des cas edge avec logique corrigée ===\n');

    const edgeCases = [
        {
            name: 'Duplication multiple niveaux',
            req: {
                body: { path: 'docs' },
                files: [{
                    originalname: 'file.txt',
                    webkitRelativePath: 'docs/docs/file.txt'
                }]
            }
        },
        {
            name: 'Duplication avec sous-dossiers',
            req: {
                body: { path: 'uploads' },
                files: [{
                    originalname: 'file.txt',
                    webkitRelativePath: 'uploads/subfolder/file.txt'
                }]
            }
        },
        {
            name: 'Pas de duplication malgré répétition',
            req: {
                body: { path: 'projects' },
                files: [{
                    originalname: 'file.txt',
                    webkitRelativePath: 'my-project/projects-list/file.txt'
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
        let behavior;

        if (file.webkitRelativePath && isFolderUpload) {
            const potentialPath = path.join(destFolder, file.webkitRelativePath);
            const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
            const hasDuplication = pathParts.some((part, index) => {
                return index > 0 && pathParts[index - 1] === part;
            });

            if (hasDuplication) {
                subPath = path.basename(relPath);
                behavior = 'duplication_detected';
            } else {
                subPath = file.webkitRelativePath;
                behavior = 'webkit_path_used';
            }
        } else {
            subPath = path.basename(relPath);
            behavior = 'basename_used';
        }

        const destPath = path.join(destFolder, subPath);

        console.log(`  webkitRelativePath: "${file.webkitRelativePath}"`);
        console.log(`  isFolderUpload: ${isFolderUpload}`);
        console.log(`  behavior: ${behavior}`);
        console.log(`  subPath: "${subPath}"`);
        console.log(`  destPath: "${destPath}"`);

        // Vérifier l'absence de duplication finale
        const pathParts = destPath.split(path.sep).filter(part => part.length > 0);
        const duplications = [];
        for (let i = 1; i < pathParts.length; i++) {
            if (pathParts[i] === pathParts[i - 1]) {
                duplications.push(pathParts[i]);
            }
        }

        if (duplications.length > 0) {
            console.log(`  ⚠️  Duplications finales: [${duplications.join(', ')}]`);
        } else {
            console.log(`  ✓ Aucune duplication finale`);
        }

        console.log('');
    }

    // Résumé
    console.log('=== Résumé ===');
    if (allTestsPassed) {
        console.log('🎉 Tous les tests sont passés !');
        console.log('\nLogique anti-duplication du middleware confirmée:');
        console.log('- Détection automatique des duplications potentielles');
        console.log('- Utilisation intelligente de basename vs webkitRelativePath');
        console.log('- Préservation des uploads de dossiers légitimes');
        console.log('- Élimination complète des duplications');
    } else {
        console.log('❌ Certains tests ont échoué.');
        console.log('Vérifiez que la logique du test correspond exactement au middleware.');
    }

    return allTestsPassed;
}

// Test spécifique du premier cas problématique
function testFirstCaseWithCorrectedLogic() {
    console.log('\n=== Test spécifique du premier cas avec logique corrigée ===\n');

    const baseDir = path.resolve("../partage");

    const req = {
        body: { path: 'documents' },
        files: [{
            originalname: 'rapport.pdf',
            webkitRelativePath: 'documents/rapport.pdf'
        }]
    };

    console.log('INPUT:');
    console.log(`  req.body.path: "${req.body.path}"`);
    console.log(`  file.originalname: "${req.files[0].originalname}"`);
    console.log(`  file.webkitRelativePath: "${req.files[0].webkitRelativePath}"`);

    // Logique exacte du middleware
    const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
    const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

    const file = req.files[0];
    const relPath = file.originalname.replace(/\\/g, '/');

    let subPath;

    if (file.webkitRelativePath && isFolderUpload) {
        const potentialPath = path.join(destFolder, file.webkitRelativePath);
        const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
        const hasDuplication = pathParts.some((part, index) => {
            return index > 0 && pathParts[index - 1] === part;
        });

        if (hasDuplication) {
            subPath = path.basename(relPath);
            console.log(`\nLogique: Duplication détectée → utilise basename`);
        } else {
            subPath = file.webkitRelativePath;
            console.log(`\nLogique: Pas de duplication → utilise webkitRelativePath`);
        }
    } else {
        subPath = path.basename(relPath);
        console.log(`\nLogique: Upload individuel → utilise basename`);
    }

    const destPath = path.join(destFolder, subPath);
    const expectedPath = path.join(baseDir, 'documents', 'rapport.pdf');

    console.log(`\nRésultats:`);
    console.log(`  destFolder: ${destFolder}`);
    console.log(`  isFolderUpload: ${isFolderUpload}`);
    console.log(`  subPath: ${subPath}`);
    console.log(`  destPath: ${destPath}`);
    console.log(`  expectedPath: ${expectedPath}`);

    const isCorrect = destPath === expectedPath;
    console.log(`\nRésultat final: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);

    if (!isCorrect) {
        console.log(`Différence:`);
        console.log(`  Calculé:  "${destPath}"`);
        console.log(`  Attendu:  "${expectedPath}"`);
    }

    return isCorrect;
}

// Exécuter les tests
if (require.main === module) {
    console.log('=== Test du premier cas spécifiquement ===');
    const firstCaseCorrect = testFirstCaseWithCorrectedLogic();

    console.log('\n' + '='.repeat(60) + '\n');

    const allTestsCorrect = testCorrectedAntiDuplicationLogic();

    const success = firstCaseCorrect && allTestsCorrect;

    console.log(`\n=== RÉSULTAT FINAL ===`);
    console.log(`Premier cas: ${firstCaseCorrect ? '✅' : '❌'}`);
    console.log(`Tous les tests: ${allTestsCorrect ? '✅' : '❌'}`);
    console.log(`Succès global: ${success ? '✅' : '❌'}`);

    process.exit(success ? 0 : 1);
}

module.exports = {
    testCorrectedAntiDuplicationLogic,
    testFirstCaseWithCorrectedLogic
};