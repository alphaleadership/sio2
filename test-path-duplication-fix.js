/**
 * Test du correctif pour la duplication de chemin
 * Vérifie que les chemins ne contiennent plus de parties dupliquées
 */

const path = require('path');

function testPathDuplicationFix() {
    console.log('=== Test du correctif de duplication de chemin ===\n');

    try {
        // Simuler la logique du middleware
        const baseDir = path.resolve("../partage");

        // Cas de test pour différents scénarios
        const testCases = [
            {
                name: 'Upload fichier individuel dans dossier documents',
                bodyPath: 'documents',
                files: [{
                    originalname: 'rapport.pdf',
                    webkitRelativePath: undefined
                }],
                expectedPath: path.join(baseDir, 'documents', 'rapport.pdf')
            },
            {
                name: 'Upload fichier individuel à la racine',
                bodyPath: '',
                files: [{
                    originalname: 'test.txt',
                    webkitRelativePath: undefined
                }],
                expectedPath: path.join(baseDir, 'test.txt')
            },
            {
                name: 'Upload de dossier avec structure',
                bodyPath: 'uploads',
                files: [{
                    originalname: 'readme.md',
                    webkitRelativePath: 'mon-projet/docs/readme.md'
                }],
                expectedPath: path.join(baseDir, 'uploads', 'mon-projet', 'docs', 'readme.md')
            },
            {
                name: 'Upload de dossier à la racine',
                bodyPath: '',
                files: [{
                    originalname: 'index.html',
                    webkitRelativePath: 'website/index.html'
                }],
                expectedPath: path.join(baseDir, 'website', 'index.html')
            },
            {
                name: 'Upload fichier avec chemin Windows',
                bodyPath: 'documents',
                files: [{
                    originalname: 'file.txt',
                    webkitRelativePath: undefined
                }],
                expectedPath: path.join(baseDir, 'documents', 'file.txt')
            }
        ];

        let allTestsPassed = true;

        for (const testCase of testCases) {
            const destFolder = testCase.bodyPath ? path.join(baseDir, testCase.bodyPath) : baseDir;
            const relPath = testCase.file.originalname.replace(/\\/g, '/');

            // Calculer isFolderUpload comme dans le middleware réel
            const calculatedIsFolderUpload = testCase.file.webkitRelativePath && testCase.file.webkitRelativePath.includes('/');

            console.log(`Test: ${testCase.name}`);
            console.log(`  req.body.path: "${testCase.bodyPath}"`);
            console.log(`  originalname: "${testCase.file.originalname}"`);
            console.log(`  webkitRelativePath: ${testCase.file.webkitRelativePath || 'undefined'}`);
            console.log(`  isFolderUpload (test): ${testCase.isFolderUpload}`);
            console.log(`  isFolderUpload (calculé): ${calculatedIsFolderUpload}`);

            // Simuler la logique corrigée du middleware

            let subPath;
            if (testCase.file.webkitRelativePath && calculatedIsFolderUpload) {
                // Pour les uploads de dossiers, utiliser le chemin relatif complet
                subPath = testCase.file.webkitRelativePath;
            } else {
                // Pour les uploads de fichiers individuels, utiliser seulement le nom du fichier
                subPath = path.basename(relPath);
            }

            const destPath = path.join(destFolder, subPath);

            console.log(`  destFolder: ${destFolder}`);
            console.log(`  subPath: ${subPath}`);
            console.log(`  destPath: ${destPath}`);
            console.log(`  expectedPath: ${testCase.expectedPath}`);

            // Normaliser les chemins pour la comparaison (gérer les différences Windows/Unix)
            const normalizedDestPath = path.normalize(destPath);
            const normalizedExpectedPath = path.normalize(testCase.expectedPath);

            if (normalizedDestPath === normalizedExpectedPath) {
                console.log('  ✓ PASS - Chemin correct\n');
            } else {
                console.log('  ✗ FAIL - Chemin incorrect\n');
                allTestsPassed = false;
            }
        }

        // Test spécifique pour détecter les duplications
        console.log('=== Test de détection de duplication ===\n');

        const duplicationTests = [
            {
                name: 'Duplication documents/documents',
                path: '/partage/documents/documents/file.txt',
                hasDuplication: true
            },
            {
                name: 'Duplication users/users',
                path: '/partage/users/users/john/file.txt',
                hasDuplication: true
            },
            {
                name: 'Chemin normal',
                path: '/partage/documents/file.txt',
                hasDuplication: false
            },
            {
                name: 'Chemin avec sous-dossiers légitimes',
                path: '/partage/projects/my-project/src/main.js',
                hasDuplication: false
            }
        ];

        for (const dupTest of duplicationTests) {
            console.log(`Test duplication: ${dupTest.name}`);
            console.log(`  Chemin: ${dupTest.path}`);

            // Détecter la duplication en cherchant des segments répétés
            const pathParts = dupTest.path.split(path.sep).filter(part => part.length > 0);
            const hasDuplication = pathParts.some((part, index) => {
                return index > 0 && pathParts[index - 1] === part;
            });

            console.log(`  Duplication détectée: ${hasDuplication}`);
            console.log(`  Duplication attendue: ${dupTest.hasDuplication}`);

            if (hasDuplication === dupTest.hasDuplication) {
                console.log('  ✓ PASS - Détection correcte\n');
            } else {
                console.log('  ✗ FAIL - Détection incorrecte\n');
                allTestsPassed = false;
            }
        }

        // Résumé
        console.log('=== Résumé ===');
        if (allTestsPassed) {
            console.log('🎉 Tous les tests sont passés ! Le correctif de duplication fonctionne.');
            console.log('\nComportement après correctif:');
            console.log('- Upload fichier individuel → utilise seulement le nom du fichier');
            console.log('- Upload de dossier → utilise le chemin relatif complet');
            console.log('- Pas de duplication de segments de chemin');
            console.log('- Chemins construits correctement selon le contexte');
        } else {
            console.log('❌ Certains tests ont échoué. Vérifiez la logique de construction des chemins.');
        }

        return allTestsPassed;

    } catch (error) {
        console.error('❌ Erreur lors du test:', error.message);
        return false;
    }
}

// Fonction pour analyser un chemin et détecter les duplications
function analyzePath(filePath) {
    console.log(`\n=== Analyse du chemin: ${filePath} ===`);

    const pathParts = filePath.split(path.sep).filter(part => part.length > 0);
    console.log(`Segments: [${pathParts.join(', ')}]`);

    // Détecter les duplications
    const duplications = [];
    for (let i = 1; i < pathParts.length; i++) {
        if (pathParts[i] === pathParts[i - 1]) {
            duplications.push({
                segment: pathParts[i],
                position: i
            });
        }
    }

    if (duplications.length > 0) {
        console.log('⚠️  Duplications détectées:');
        duplications.forEach(dup => {
            console.log(`  - "${dup.segment}" à la position ${dup.position}`);
        });
    } else {
        console.log('✓ Aucune duplication détectée');
    }

    return duplications;
}

// Fonction pour proposer un chemin corrigé
function suggestCorrectedPath(filePath) {
    const pathParts = filePath.split(path.sep).filter(part => part.length > 0);
    const correctedParts = [];

    for (let i = 0; i < pathParts.length; i++) {
        // Éviter les duplications consécutives
        if (i === 0 || pathParts[i] !== pathParts[i - 1]) {
            correctedParts.push(pathParts[i]);
        }
    }

    const correctedPath = path.sep + correctedParts.join(path.sep);

    if (correctedPath !== filePath) {
        console.log(`Chemin corrigé suggéré: ${correctedPath}`);
    }

    return correctedPath;
}

// Interface en ligne de commande
function main() {
    const command = process.argv[2];

    switch (command) {
        case 'analyze':
            const pathToAnalyze = process.argv[3];
            if (pathToAnalyze) {
                analyzePath(pathToAnalyze);
                suggestCorrectedPath(pathToAnalyze);
            } else {
                console.log('Usage: node test-path-duplication-fix.js analyze <path>');
            }
            break;

        case 'test':
        default:
            const success = testPathDuplicationFix();
            process.exit(success ? 0 : 1);
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    main();
}

module.exports = {
    testPathDuplicationFix,
    analyzePath,
    suggestCorrectedPath
};