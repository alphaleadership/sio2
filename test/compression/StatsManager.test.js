const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const StatsManager = require('../../lib/compression/StatsManager');

// Simple test runner for StatsManager
async function runTests() {
    console.log('Running StatsManager tests...\n');

    const testDir = path.join(__dirname, '../temp');
    
    // Créer le dossier de test
    try {
        await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
        // Le dossier existe déjà
    }

    let testsPassed = 0;
    let testsFailed = 0;

    async function test(name, testFn) {
        try {
            console.log(`Testing: ${name}`);
            await testFn();
            console.log(`✓ ${name} passed\n`);
            testsPassed++;
        } catch (error) {
            console.log(`✗ ${name} failed: ${error.message}\n`);
            testsFailed++;
        }
    }

    // Test 1: Initialisation du gestionnaire
    await test('should initialize stats manager correctly', async () => {
        const tempStatsFile = path.join(testDir, `stats-manager-test-${Date.now()}.json`);
        const manager = new StatsManager(tempStatsFile, 0); // Pas de sauvegarde auto
        
        const stats = await manager.initialize();
        assert(stats, 'Stats should be initialized');
        
        const globalStats = manager.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 0);
        
        await manager.close();
        
        // Nettoyage
        try {
            await fs.unlink(tempStatsFile);
        } catch (error) {
            // Ignorer si le fichier n'existe pas
        }
    });

    // Test 2: Enregistrement de compression via le gestionnaire
    await test('should record compression through manager', async () => {
        const tempStatsFile = path.join(testDir, `stats-manager-test-${Date.now()}.json`);
        const manager = new StatsManager(tempStatsFile, 0);
        
        await manager.initialize();
        
        manager.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });
        
        const globalStats = manager.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 1);
        assert.strictEqual(globalStats.totalFilesCompressed, 1);
        assert.strictEqual(globalStats.totalSpaceSaved, 400);
        
        await manager.close();
        
        // Nettoyage
        try {
            await fs.unlink(tempStatsFile);
        } catch (error) {
            // Ignorer si le fichier n'existe pas
        }
    });

    // Test 3: Sauvegarde et rechargement
    await test('should save and reload statistics', async () => {
        const tempStatsFile = path.join(testDir, `stats-manager-test-${Date.now()}.json`);
        
        // Premier gestionnaire - enregistrer des données
        const manager1 = new StatsManager(tempStatsFile, 0);
        await manager1.initialize();
        
        manager1.recordCompression({
            filePath: '/test/file1.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });
        
        manager1.recordCompression({
            filePath: '/test/file2.js',
            originalSize: 2000,
            compressedSize: 1200,
            fileType: '.js',
            success: true
        });
        
        await manager1.save();
        await manager1.close();
        
        // Deuxième gestionnaire - charger les données
        const manager2 = new StatsManager(tempStatsFile, 0);
        await manager2.initialize();
        
        const globalStats = manager2.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 2);
        assert.strictEqual(globalStats.totalFilesCompressed, 2);
        assert.strictEqual(globalStats.totalSpaceSaved, 1200);
        
        const txtStats = manager2.getStatsByType('.txt');
        assert.strictEqual(txtStats.filesCompressed, 1);
        assert.strictEqual(txtStats.totalSpaceSaved, 400);
        
        await manager2.close();
        
        // Nettoyage
        try {
            await fs.unlink(tempStatsFile);
        } catch (error) {
            // Ignorer si le fichier n'existe pas
        }
    });

    // Test 4: Sauvegarde conditionnelle (dirty flag)
    await test('should save only when dirty', async () => {
        const tempStatsFile = path.join(testDir, `stats-manager-test-${Date.now()}.json`);
        const manager = new StatsManager(tempStatsFile, 0);
        
        await manager.initialize();
        
        // Première sauvegarde - rien à sauvegarder
        const saved1 = await manager.saveIfDirty();
        assert.strictEqual(saved1, false, 'Should not save when not dirty');
        
        // Ajouter des données
        manager.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });
        
        // Deuxième sauvegarde - devrait sauvegarder
        const saved2 = await manager.saveIfDirty();
        assert.strictEqual(saved2, true, 'Should save when dirty');
        
        // Troisième sauvegarde - rien à sauvegarder
        const saved3 = await manager.saveIfDirty();
        assert.strictEqual(saved3, false, 'Should not save when not dirty after save');
        
        await manager.close();
        
        // Nettoyage
        try {
            await fs.unlink(tempStatsFile);
        } catch (error) {
            // Ignorer si le fichier n'existe pas
        }
    });

    // Test 5: Génération de rapport
    await test('should generate comprehensive report', async () => {
        const tempStatsFile = path.join(testDir, `stats-manager-test-${Date.now()}.json`);
        const manager = new StatsManager(tempStatsFile, 0);
        
        await manager.initialize();
        
        manager.recordCompression({
            filePath: '/test/file1.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });
        
        manager.recordCompression({
            filePath: '/test/file2.js',
            originalSize: 2000,
            compressedSize: 1200,
            fileType: '.js',
            success: true
        });
        
        const report = manager.generateReport();
        
        assert(report.summary, 'Report should have summary');
        assert(report.byFileType, 'Report should have stats by file type');
        assert(report.topPerformers, 'Report should have top performers');
        assert(report.generatedAt, 'Report should have generation timestamp');
        
        assert.strictEqual(report.summary.totalFilesProcessed, 2);
        assert.strictEqual(report.summary.totalFilesCompressed, 2);
        
        await manager.close();
        
        // Nettoyage
        try {
            await fs.unlink(tempStatsFile);
        } catch (error) {
            // Ignorer si le fichier n'existe pas
        }
    });

    // Test 6: Remise à zéro des statistiques
    await test('should reset statistics correctly', async () => {
        const tempStatsFile = path.join(testDir, `stats-manager-test-${Date.now()}.json`);
        const manager = new StatsManager(tempStatsFile, 0);
        
        await manager.initialize();
        
        // Ajouter des données
        manager.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });
        
        let globalStats = manager.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 1);
        
        // Remettre à zéro
        await manager.reset();
        
        globalStats = manager.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 0);
        assert.strictEqual(globalStats.totalFilesCompressed, 0);
        assert.strictEqual(globalStats.totalSpaceSaved, 0);
        
        await manager.close();
        
        // Nettoyage
        try {
            await fs.unlink(tempStatsFile);
        } catch (error) {
            // Ignorer si le fichier n'existe pas
        }
    });

    // Test 7: Création avec configuration par défaut
    await test('should create default manager correctly', async () => {
        const tempDataDir = path.join(testDir, `data-${Date.now()}`);
        const manager = StatsManager.createDefault(tempDataDir);
        
        await manager.initialize();
        
        const globalStats = manager.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 0);
        
        await manager.close();
        
        // Nettoyage
        try {
            await fs.rmdir(tempDataDir, { recursive: true });
        } catch (error) {
            // Ignorer les erreurs de nettoyage
        }
    });

    // Test 8: Gestion des erreurs d'initialisation
    await test('should handle initialization errors gracefully', async () => {
        // Tenter d'utiliser un gestionnaire non initialisé
        const manager = new StatsManager('/invalid/path/stats.json', 0);
        
        try {
            manager.getGlobalStats();
            assert.fail('Should throw error when not initialized');
        } catch (error) {
            assert(error.message.includes('n\'est pas initialisé'));
        }
        
        try {
            manager.recordCompression({
                filePath: '/test/file.txt',
                originalSize: 1000,
                compressedSize: 600,
                fileType: '.txt',
                success: true
            });
            assert.fail('Should throw error when not initialized');
        } catch (error) {
            assert(error.message.includes('n\'est pas initialisé'));
        }
    });

    // Nettoyage final
    try {
        const files = await fs.readdir(testDir);
        for (const file of files) {
            if (file.includes('stats-manager-test')) {
                await fs.unlink(path.join(testDir, file));
            }
        }
    } catch (error) {
        // Ignorer les erreurs de nettoyage
    }

    // Résultats
    console.log(`\nTest Results:`);
    console.log(`✓ Passed: ${testsPassed}`);
    console.log(`✗ Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);

    if (testsFailed > 0) {
        process.exit(1);
    }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = { runTests };