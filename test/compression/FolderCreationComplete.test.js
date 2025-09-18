const assert = require('assert');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');

/**
 * Tests complets pour la création de structure de dossiers compressés
 * Teste l'adaptation de la logique fs.mkdirSync pour les fichiers compressés
 */
async function runFolderCreationCompleteTests() {
  console.log('Running Complete Folder Creation tests...\n');
  
  const testDir = path.join(__dirname, '../temp/folder-creation-complete-test');
  
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

  // Initialiser les services
  const config = new CompressionConfig({
    minFileSize: 50,
    compressibleTypes: ['.txt', '.js', '.json', '.md', '.css', '.html'],
    excludeTypes: ['.jpg', '.png', '.zip']
  });
  const compressionService = new CompressionService();
  const middleware = new FileStorageMiddleware(compressionService, config);

  // Test 1: Adaptation de fs.mkdirSync avec { recursive: true } pour fichiers compressés
  await test('should adapt fs.mkdirSync logic for compressed files with deep hierarchy', async () => {
    const folderPath = path.join(testDir, 'deep-hierarchy');
    
    // Créer une structure profonde similaire à ce que fs.mkdirSync({ recursive: true }) créerait
    const files = [
      {
        name: 'app.js',
        relativePath: 'src/components/ui/buttons/primary/app.js',
        content: 'export default function PrimaryButton() { return "Primary Button Component"; }',
        size: 0
      },
      {
        name: 'styles.css',
        relativePath: 'src/assets/styles/themes/dark/styles.css',
        content: '.dark-theme { background: #000; color: #fff; }',
        size: 0
      },
      {
        name: 'config.json',
        relativePath: 'config/environments/production/database/config.json',
        content: '{"host": "prod.db.com", "port": 5432, "ssl": true}',
        size: 0
      }
    ];

    // Créer les fichiers temporaires
    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `deep-temp-${i}.txt`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
      
      tempFiles.push(file);
    }

    const result = await middleware.handleFolderCreation(folderPath, tempFiles);

    // Vérifications de la hiérarchie créée
    assert.strictEqual(result.totalFiles, 3);
    assert(result.compressedFiles > 0, 'Some files should be compressed');
    
    // Vérifier que tous les niveaux de dossiers sont trackés
    const expectedFolders = [
      'src',
      'src/components',
      'src/components/ui',
      'src/components/ui/buttons',
      'src/components/ui/buttons/primary',
      'src/assets',
      'src/assets/styles',
      'src/assets/styles/themes',
      'src/assets/styles/themes/dark',
      'config',
      'config/environments',
      'config/environments/production',
      'config/environments/production/database'
    ];

    for (const expectedFolder of expectedFolders) {
      assert(result.foldersCreated.includes(expectedFolder), 
        `Should include folder: ${expectedFolder}. Got: ${result.foldersCreated.join(', ')}`);
    }

    // Vérifier que la structure physique existe
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'src/components/ui/buttons/primary')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'src/assets/styles/themes/dark')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'config/environments/production/database')), true);
  });

  // Test 2: Maintien de la hiérarchie lors de la compression
  await test('should maintain folder hierarchy when compressing files', async () => {
    const folderPath = path.join(testDir, 'hierarchy-test');
    
    const files = [
      {
        name: 'readme.md',
        relativePath: 'docs/user-guide/installation/readme.md',
        content: '# Installation Guide\n\nThis is a comprehensive installation guide for the application.',
        size: 0
      },
      {
        name: 'api.md',
        relativePath: 'docs/developer/api/v1/api.md',
        content: '# API Documentation\n\nComplete API reference for version 1.0',
        size: 0
      },
      {
        name: 'changelog.md',
        relativePath: 'docs/changelog.md',
        content: '# Changelog\n\n## v1.0.0\n- Initial release',
        size: 0
      }
    ];

    // Créer les fichiers temporaires
    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `hierarchy-temp-${i}.md`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
      
      tempFiles.push(file);
    }

    const result = await middleware.handleFolderCreation(folderPath, tempFiles);

    // Vérifier que les fichiers éligibles sont compressés (dépend de la taille et configuration)
    assert(result.compressedFiles >= 2, `Expected at least 2 compressed files, got ${result.compressedFiles}`);
    assert.strictEqual(result.totalFiles, 3);
    assert.strictEqual(result.compressedFiles + result.uncompressedFiles, 3);

    // Vérifier que les fichiers compressés existent dans la bonne hiérarchie
    // Debug: vérifier quels fichiers existent réellement
    const readmeExists = fsSync.existsSync(path.join(folderPath, 'docs/user-guide/installation/readme.md.gz'));
    const apiExists = fsSync.existsSync(path.join(folderPath, 'docs/developer/api/v1/api.md.gz'));
    const changelogCompressed = fsSync.existsSync(path.join(folderPath, 'docs/changelog.md.gz'));
    const changelogOriginal = fsSync.existsSync(path.join(folderPath, 'docs/changelog.md'));
    
    console.log(`Debug - Files exist: readme.gz=${readmeExists}, api.gz=${apiExists}, changelog.gz=${changelogCompressed}, changelog.md=${changelogOriginal}`);
    console.log(`Debug - Result: compressed=${result.compressedFiles}, uncompressed=${result.uncompressedFiles}`);
    
    assert.strictEqual(readmeExists, true, 'readme.md.gz should exist');
    assert.strictEqual(apiExists, true, 'api.md.gz should exist');
    // Le changelog pourrait être compressé ou non selon sa taille
    assert(changelogCompressed || changelogOriginal, 'changelog should exist in some form');

    // Vérifier que les dossiers intermédiaires existent
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'docs')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'docs/user-guide')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'docs/user-guide/installation')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'docs/developer/api/v1')), true);
  });

  // Test 3: Gestion des chemins Windows vs Unix
  await test('should handle Windows and Unix path separators correctly', async () => {
    const folderPath = path.join(testDir, 'path-separator-test');
    
    const files = [
      {
        name: 'component.js',
        relativePath: 'src\\components\\Button.js', // Windows style
        content: 'export default Button;',
        size: 0
      },
      {
        name: 'utils.js',
        relativePath: 'src/utils/helpers.js', // Unix style
        content: 'export function helper() {}',
        size: 0
      }
    ];

    // Créer les fichiers temporaires
    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `path-temp-${i}.js`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
      
      tempFiles.push(file);
    }

    const result = await middleware.handleFolderCreation(folderPath, tempFiles);

    // Les deux styles de chemins devraient être normalisés
    assert(result.foldersCreated.includes('src'));
    assert(result.foldersCreated.includes('src/components'));
    assert(result.foldersCreated.includes('src/utils'));

    // Vérifier que les fichiers existent dans la structure normalisée
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'src', 'components')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'src', 'utils')), true);
  });

  // Test 4: Performance avec beaucoup de dossiers
  await test('should handle large folder structures efficiently', async () => {
    const folderPath = path.join(testDir, 'large-structure');
    
    // Créer 50 fichiers dans différents dossiers
    const files = [];
    for (let i = 0; i < 50; i++) {
      const depth = Math.floor(i / 10) + 1; // Varier la profondeur
      const folderParts = Array.from({ length: depth }, (_, j) => `level${j + 1}`);
      const relativePath = [...folderParts, `file${i}.txt`].join('/');
      
      files.push({
        name: `file${i}.txt`,
        relativePath: relativePath,
        content: `Content for file ${i} in ${relativePath}`,
        size: 0
      });
    }

    // Créer les fichiers temporaires
    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `large-temp-${i}.txt`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
      
      tempFiles.push(file);
    }

    const startTime = Date.now();
    const result = await middleware.handleFolderCreation(folderPath, tempFiles);
    const duration = Date.now() - startTime;

    // Vérifications de performance et résultats
    assert.strictEqual(result.totalFiles, 50);
    assert(duration < 5000, `Operation should complete in under 5 seconds, took ${duration}ms`);
    assert(result.foldersCreated.length > 0, 'Should create multiple folders');
    
    // Vérifier quelques dossiers spécifiques
    assert(result.foldersCreated.includes('level1'));
    assert(result.foldersCreated.includes('level1/level2'));
    assert(result.foldersCreated.includes('level1/level2/level3'));
  });

  // Test 5: Compatibilité avec l'API existante
  await test('should maintain compatibility with existing fs.mkdirSync patterns', async () => {
    const folderPath = path.join(testDir, 'compatibility-test');
    
    // Simuler le pattern existant: fs.mkdirSync(path.dirname(destPath), { recursive: true })
    const files = [
      {
        name: 'index.html',
        relativePath: 'public/index.html',
        content: '<html><body>Hello World</body></html>',
        size: 0
      }
    ];

    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `compat-temp-${i}.html`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
      
      tempFiles.push(file);
    }

    const result = await middleware.handleFolderCreation(folderPath, tempFiles);

    // Le comportement devrait être identique à fs.mkdirSync(path.dirname(destPath), { recursive: true })
    const expectedPath = path.join(folderPath, 'public');
    assert.strictEqual(fsSync.existsSync(expectedPath), true);
    assert(result.foldersCreated.includes('public'));
    
    // Le fichier devrait être traité (compressé ou non selon les critères)
    assert.strictEqual(result.totalFiles, 1);
    assert.strictEqual(result.processedFiles.length, 1);
  });

  // Nettoyage
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignorer les erreurs de nettoyage
  }

  // Résultats
  console.log(`\nComplete Folder Creation Test Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runFolderCreationCompleteTests().catch(console.error);
}

module.exports = { runFolderCreationCompleteTests };