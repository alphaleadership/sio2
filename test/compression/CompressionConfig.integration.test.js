const assert = require('assert');
const path = require('path');
const CompressionConfig = require('../../lib/compression/CompressionConfig');

/**
 * Tests d'intégration pour CompressionConfig
 * Vérifie que la configuration respecte tous les requirements 2.1, 2.2, 2.3, 2.4
 */
async function runIntegrationTests() {
    console.log('Running CompressionConfig integration tests...\n');

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

    // Requirement 2.1: Permettre de définir le niveau de compression
    await test('Requirement 2.1: should allow configuring compression level', () => {
        const config = new CompressionConfig({ compressionLevel: 9 });
        assert.strictEqual(config.compressionLevel, 9);
        
        // Test validation des niveaux invalides
        const invalidConfig = new CompressionConfig({ compressionLevel: 15 });
        const validation = invalidConfig.validate();
        assert.strictEqual(validation.isValid, false);
        assert(validation.errors.some(err => err.includes('niveau de compression')));
    });

    // Requirement 2.2: Permettre de définir les types de fichiers à compresser
    await test('Requirement 2.2: should allow configuring compressible file types', () => {
        const customTypes = ['.txt', '.log', '.csv'];
        const config = new CompressionConfig({ compressibleTypes: customTypes });
        
        assert.deepStrictEqual(config.compressibleTypes, customTypes);
        assert.strictEqual(config.isCompressible('test.txt'), true);
        assert.strictEqual(config.isCompressible('data.log'), true);
        assert.strictEqual(config.isCompressible('script.js'), false); // Pas dans la liste personnalisée
    });

    // Requirement 2.3: Permettre de définir la taille minimale pour déclencher la compression
    await test('Requirement 2.3: should allow configuring minimum file size', () => {
        const config = new CompressionConfig({ minFileSize: 2048 });
        
        assert.strictEqual(config.minFileSize, 2048);
        assert.strictEqual(config.isValidSize(1000), false); // Trop petit
        assert.strictEqual(config.isValidSize(3000), true);  // Assez grand
        
        // Test validation des tailles invalides
        const invalidConfig = new CompressionConfig({ minFileSize: -100 });
        const validation = invalidConfig.validate();
        assert.strictEqual(validation.isValid, false);
        assert(validation.errors.some(err => err.includes('taille minimale')));
    });

    // Requirement 2.4: Utiliser des valeurs par défaut optimales si aucune configuration
    await test('Requirement 2.4: should use optimal default values', () => {
        const config = new CompressionConfig();
        
        // Vérifier les valeurs par défaut optimales
        assert.strictEqual(config.compressionLevel, 6); // Bon compromis vitesse/ratio
        assert.strictEqual(config.minFileSize, 1024);   // 1KB minimum raisonnable
        assert.strictEqual(config.compressionTimeout, 5000); // 5 secondes timeout
        assert.strictEqual(config.algorithm, 'gzip');   // Algorithme largement supporté
        assert.strictEqual(config.maxFileSize, 100 * 1024 * 1024); // 100MB maximum
        
        // Vérifier que les types par défaut incluent les formats texte courants
        assert(config.compressibleTypes.includes('.txt'));
        assert(config.compressibleTypes.includes('.js'));
        assert(config.compressibleTypes.includes('.css'));
        assert(config.compressibleTypes.includes('.html'));
        assert(config.compressibleTypes.includes('.json'));
        
        // Vérifier que les types binaires sont exclus par défaut
        assert(config.excludeTypes.includes('.jpg'));
        assert(config.excludeTypes.includes('.zip'));
        assert(config.excludeTypes.includes('.mp4'));
        
        // La configuration par défaut doit être valide
        const validation = config.validate();
        assert.strictEqual(validation.isValid, true);
    });

    // Test intégration complète: configuration personnalisée complète
    await test('Complete configuration integration test', () => {
        const customConfig = {
            compressionLevel: 8,
            compressibleTypes: ['.txt', '.js', '.css', '.html', '.json', '.xml'],
            excludeTypes: ['.jpg', '.png', '.zip', '.mp4'],
            minFileSize: 512,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            compressionTimeout: 8000,
            algorithm: 'brotli'
        };
        
        const config = new CompressionConfig(customConfig);
        
        // Vérifier que tous les paramètres sont correctement appliqués
        assert.strictEqual(config.compressionLevel, 8);
        assert.deepStrictEqual(config.compressibleTypes, customConfig.compressibleTypes);
        assert.deepStrictEqual(config.excludeTypes, customConfig.excludeTypes);
        assert.strictEqual(config.minFileSize, 512);
        assert.strictEqual(config.maxFileSize, 50 * 1024 * 1024);
        assert.strictEqual(config.compressionTimeout, 8000);
        assert.strictEqual(config.algorithm, 'brotli');
        
        // Vérifier la validation
        const validation = config.validate();
        assert.strictEqual(validation.isValid, true);
        
        // Tester la logique de décision de compression
        assert.strictEqual(config.isCompressible('test.txt'), true);
        assert.strictEqual(config.isCompressible('image.jpg'), false);
        assert.strictEqual(config.isValidSize(400), false);  // Trop petit
        assert.strictEqual(config.isValidSize(1000), true);  // Valide
        assert.strictEqual(config.isValidSize(60 * 1024 * 1024), false); // Trop grand
    });

    // Test de mise à jour de configuration
    await test('Configuration update functionality', () => {
        const config = new CompressionConfig();
        const originalLevel = config.compressionLevel;
        
        // Mettre à jour partiellement
        config.update({
            compressionLevel: 9,
            minFileSize: 2048
        });
        
        assert.strictEqual(config.compressionLevel, 9);
        assert.strictEqual(config.minFileSize, 2048);
        // Les autres paramètres doivent rester inchangés
        assert.strictEqual(config.algorithm, 'gzip');
        
        // La configuration mise à jour doit rester valide
        const validation = config.validate();
        assert.strictEqual(validation.isValid, true);
    });

    // Test de sérialisation JSON
    await test('JSON serialization preserves all configuration', () => {
        const originalConfig = new CompressionConfig({
            compressionLevel: 7,
            minFileSize: 1500,
            algorithm: 'brotli'
        });
        
        const json = originalConfig.toJSON();
        const newConfig = new CompressionConfig(json);
        
        // Vérifier que toutes les propriétés sont préservées
        assert.strictEqual(newConfig.compressionLevel, 7);
        assert.strictEqual(newConfig.minFileSize, 1500);
        assert.strictEqual(newConfig.algorithm, 'brotli');
        assert.deepStrictEqual(newConfig.compressibleTypes, originalConfig.compressibleTypes);
        assert.deepStrictEqual(newConfig.excludeTypes, originalConfig.excludeTypes);
    });

    // Résultats
    console.log(`\nIntegration Test Results:`);
    console.log(`✓ Passed: ${testsPassed}`);
    console.log(`✗ Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);

    if (testsFailed > 0) {
        process.exit(1);
    }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
    runIntegrationTests().catch(console.error);
}

module.exports = { runIntegrationTests };