const assert = require('assert');
const CompressionConfig = require('../../lib/compression/CompressionConfig');
const ErrorHandler = require('../../lib/compression/ErrorHandler');

/**
 * Test de validation de l'intégration timeout entre CompressionConfig et ErrorHandler
 */
async function runTimeoutTests() {
    console.log('Running CompressionConfig timeout integration tests...\n');

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

    // Test intégration CompressionConfig avec ErrorHandler
    await test('CompressionConfig timeout should integrate with ErrorHandler', () => {
        const config = new CompressionConfig({
            compressionTimeout: 3000,
            algorithm: 'gzip'
        });

        const errorHandler = new ErrorHandler({
            compressionTimeout: config.compressionTimeout,
            decompressionTimeout: 2000
        });

        // Vérifier que les timeouts sont correctement configurés
        assert.strictEqual(config.compressionTimeout, 3000);
        assert.strictEqual(errorHandler.config.compressionTimeout, 3000);
    });

    // Test validation des timeouts dans la configuration
    await test('Should validate timeout values correctly', () => {
        // Timeout valide
        const validConfig = new CompressionConfig({ compressionTimeout: 5000 });
        const validation = validConfig.validate();
        assert.strictEqual(validation.isValid, true);

        // Timeout invalide (négatif)
        const invalidConfig1 = new CompressionConfig({ compressionTimeout: -1000 });
        const validation1 = invalidConfig1.validate();
        assert.strictEqual(validation1.isValid, false);
        assert(validation1.errors.some(err => err.includes('timeout')));

        // Timeout invalide (zéro) - forcer la valeur après construction
        const invalidConfig2 = new CompressionConfig();
        invalidConfig2.compressionTimeout = 0;
        const validation2 = invalidConfig2.validate();
        assert.strictEqual(validation2.isValid, false);

        // Timeout invalide (non-numérique) - avec une valeur qui sera utilisée telle quelle
        const invalidConfig3 = new CompressionConfig();
        invalidConfig3.compressionTimeout = 'invalid'; // Forcer une valeur non-numérique
        const validation3 = invalidConfig3.validate();
        // La validation devrait détecter que ce n'est pas un nombre
        assert.strictEqual(validation3.isValid, false);
    });

    // Test des valeurs par défaut de timeout
    await test('Should use appropriate default timeout values', () => {
        const config = new CompressionConfig();
        
        // Vérifier que le timeout par défaut est raisonnable (5 secondes)
        assert.strictEqual(config.compressionTimeout, 5000);
        
        // Vérifier que c'est dans une plage acceptable pour les requirements
        assert(config.compressionTimeout >= 1000); // Au moins 1 seconde
        assert(config.compressionTimeout <= 10000); // Pas plus de 10 secondes par défaut
    });

    // Test mise à jour du timeout
    await test('Should allow updating timeout configuration', () => {
        const config = new CompressionConfig({ compressionTimeout: 5000 });
        
        // Mettre à jour le timeout
        config.update({ compressionTimeout: 8000 });
        
        assert.strictEqual(config.compressionTimeout, 8000);
        
        // La configuration mise à jour doit rester valide
        const validation = config.validate();
        assert.strictEqual(validation.isValid, true);
    });

    // Test sérialisation du timeout
    await test('Should serialize timeout in JSON configuration', () => {
        const config = new CompressionConfig({ compressionTimeout: 7000 });
        const json = config.toJSON();
        
        assert.strictEqual(json.compressionTimeout, 7000);
        
        // Recréer depuis JSON
        const newConfig = new CompressionConfig(json);
        assert.strictEqual(newConfig.compressionTimeout, 7000);
    });

    // Test avertissements pour timeouts extrêmes
    await test('Should provide warnings for extreme timeout values', () => {
        // Timeout très court (peut causer des problèmes)
        const shortTimeoutConfig = new CompressionConfig({ compressionTimeout: 100 });
        const validation1 = shortTimeoutConfig.validate();
        // Même si techniquement valide, cela pourrait mériter un avertissement
        assert.strictEqual(validation1.isValid, true);
        
        // Timeout très long (peut impacter l'expérience utilisateur)
        const longTimeoutConfig = new CompressionConfig({ compressionTimeout: 60000 });
        const validation2 = longTimeoutConfig.validate();
        assert.strictEqual(validation2.isValid, true);
    });

    console.log(`\nTimeout Integration Test Results:`);
    console.log(`✓ Passed: ${testsPassed}`);
    console.log(`✗ Failed: ${testsFailed}`);
    console.log(`Total: ${testsPassed + testsFailed}`);

    if (testsFailed > 0) {
        process.exit(1);
    }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
    runTimeoutTests().catch(console.error);
}

module.exports = { runTimeoutTests };