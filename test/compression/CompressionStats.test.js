const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const CompressionStats = require('../../lib/compression/CompressionStats');

// Simple test runner for CompressionStats
async function runTests() {
    console.log('Running CompressionStats tests...\n');

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

    // Test 1: Enregistrement de compression réussie
    await test('should record successful compression', () => {
        const stats = new CompressionStats();
        const compressionResult = {
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        };

        stats.recordCompression(compressionResult);

        const globalStats = stats.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 1);
        assert.strictEqual(globalStats.totalFilesCompressed, 1);
        assert.strictEqual(globalStats.totalSpaceSaved, 400);
    });

    // Test 2: Enregistrement de compression échouée
    await test('should record failed compression', () => {
        const stats = new CompressionStats();
        const compressionResult = {
            filePath: '/test/file.jpg',
            originalSize: 1000,
            compressedSize: 1200,
            fileType: '.jpg',
            success: false
        };

        stats.recordCompression(compressionResult);

        const globalStats = stats.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 1);
        assert.strictEqual(globalStats.totalFilesCompressed, 0);
        assert.strictEqual(globalStats.totalSpaceSaved, 0);
    });

    // Test 3: Suivi des statistiques par type de fichier
    await test('should track statistics by file type', () => {
        const stats = new CompressionStats();
        
        stats.recordCompression({
            filePath: '/test/file1.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });

        stats.recordCompression({
            filePath: '/test/file2.txt',
            originalSize: 2000,
            compressedSize: 1000,
            fileType: '.txt',
            success: true
        });

        const txtStats = stats.getStatsByType('.txt');
        assert.strictEqual(txtStats.filesProcessed, 2);
        assert.strictEqual(txtStats.filesCompressed, 2);
        assert.strictEqual(txtStats.totalSpaceSaved, 1400);
    });

    // Test 4: Statistiques globales correctes
    await test('should return correct global statistics', () => {
        const stats = new CompressionStats();
        
        stats.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });

        const globalStats = stats.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 1);
        assert.strictEqual(globalStats.totalFilesCompressed, 1);
        assert.strictEqual(globalStats.compressionRate, 100);
        assert.strictEqual(globalStats.formattedSpaceSaved, '400 B');
    });

    // Test 5: Sauvegarde et chargement de fichier
    await test('should save and load statistics correctly', async () => {
        const stats = new CompressionStats();
        const tempStatsFile = path.join(testDir, `compression-stats-test-${Date.now()}.json`);
        
        stats.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });

        await stats.saveToFile(tempStatsFile);

        const loadedStats = await CompressionStats.loadFromFile(tempStatsFile);
        const originalGlobal = stats.getGlobalStats();
        const loadedGlobal = loadedStats.getGlobalStats();

        assert.strictEqual(loadedGlobal.totalFilesProcessed, originalGlobal.totalFilesProcessed);
        assert.strictEqual(loadedGlobal.totalFilesCompressed, originalGlobal.totalFilesCompressed);
        assert.strictEqual(loadedGlobal.totalSpaceSaved, originalGlobal.totalSpaceSaved);

        // Nettoyage
        await fs.unlink(tempStatsFile);
    });

    // Test 6: Chargement de fichier inexistant
    await test('should return new instance when file does not exist', async () => {
        const nonExistentFile = path.join(testDir, 'non-existent-stats.json');
        const loadedStats = await CompressionStats.loadFromFile(nonExistentFile);
        
        const globalStats = loadedStats.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 0);
        assert.strictEqual(globalStats.totalFilesCompressed, 0);
    });

    // Test 7: Génération de rapport complet
    await test('should generate comprehensive report', () => {
        const stats = new CompressionStats();
        
        stats.recordCompression({
            filePath: '/test/file1.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });

        stats.recordCompression({
            filePath: '/test/file2.js',
            originalSize: 2000,
            compressedSize: 1200,
            fileType: '.js',
            success: true
        });

        const report = stats.generateReport();
        
        assert.strictEqual(report.summary.totalFilesProcessed, 2);
        assert.strictEqual(report.summary.totalFilesCompressed, 2);
        assert(report.byFileType.hasOwnProperty('.txt'));
        assert(report.byFileType.hasOwnProperty('.js'));
        assert.strictEqual(report.topPerformers.mostEfficient.length, 2);
        assert(report.generatedAt);
    });

    // Test 8: Remise à zéro des statistiques
    await test('should reset all statistics', () => {
        const stats = new CompressionStats();
        
        stats.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 600,
            fileType: '.txt',
            success: true
        });

        stats.reset();

        const globalStats = stats.getGlobalStats();
        assert.strictEqual(globalStats.totalFilesProcessed, 0);
        assert.strictEqual(globalStats.totalFilesCompressed, 0);
        assert.strictEqual(globalStats.totalSpaceSaved, 0);
    });

    // Test 9: Formatage des bytes
    await test('should format bytes correctly', () => {
        const stats = new CompressionStats();
        
        // Test avec différentes tailles
        stats.recordCompression({
            filePath: '/test/file1.txt',
            originalSize: 1024,
            compressedSize: 512,
            fileType: '.txt',
            success: true
        });

        const globalStats = stats.getGlobalStats();
        assert.strictEqual(globalStats.formattedSpaceSaved, '512 B');

        // Test avec des KB
        stats.recordCompression({
            filePath: '/test/file2.txt',
            originalSize: 2048,
            compressedSize: 1024,
            fileType: '.txt',
            success: true
        });

        const updatedStats = stats.getGlobalStats();
        assert.strictEqual(updatedStats.formattedSpaceSaved, '1.5 KB');
    });

    // Test 10: Calcul du ratio de compression
    await test('should calculate compression ratios correctly', () => {
        const stats = new CompressionStats();
        
        stats.recordCompression({
            filePath: '/test/file.txt',
            originalSize: 1000,
            compressedSize: 500,
            fileType: '.txt',
            success: true
        });

        const txtStats = stats.getStatsByType('.txt');
        assert.strictEqual(txtStats.averageCompressionRatio, 0.5);
        assert.strictEqual(txtStats.compressionRate, 100);
    });

    // Nettoyage
    try {
        const files = await fs.readdir(testDir);
        for (const file of files) {
            if (file.includes('compression-stats-test')) {
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