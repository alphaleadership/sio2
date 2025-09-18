const assert = require('assert');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');

// Test spécialisé pour les uploads de dossiers
async function runFolderUploadTests() {
  console.log('Running Folder Upload tests...\n');
  
  const testDir = path.join(__dirname, '../temp/folder-upload-test');
  
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
    compressibleTypes: ['.txt', '.js', '.json', '.md'],
    excludeTypes: ['.jpg', '.png', '.zip']
  });
  const compressionService = new CompressionService();
  const middleware = new FileStorageMiddleware(compressionService, config);

  // Test 1: Upload de dossier simple avec sous-dossiers
  await test('should handle simple folder upload with subdirectories', async () => {
    const folderPath = path.join(testDir, 'simple-folder');
    
    // Créer des fichiers de test
    const files = [
      {
        name: 'readme.txt',
        relativePath: 'readme.txt',
        content: 'This is a readme file in the root of the project folder.',
        size: 0
      },
      {
        name: 'main.js',
        relativePath: 'src/main.js',
        content: 'console.log("Hello world from main.js"); // This file should be compressed',
        size: 0
      },
      {
        name: 'utils.js',
        relativePath: 'src/utils/utils.js',
        content: 'function utility() { return "This is a utility function"; }',
        size: 0
      },
      {
        name: 'config.json',
        relativePath: 'config/config.json',
        content: '{"name": "test-project", "version": "1.0.0", "compression": true}',
        size: 0
      }
    ];

    // Créer les fichiers temporaires
    const tempFiles = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `temp-${i}.txt`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
      
      tempFiles.push(file);
    }

    const result = await middleware.handleFolderCreation(folderPath, tempFiles);

    // Vérifications
    assert.strictEqual(result.totalFiles, 4);
    assert(result.compressedFiles > 0, 'Some files should be compressed');
    assert(result.foldersCreated.length > 0, 'Folders should be created');
    assert(result.foldersCreated.includes('src'));
    assert(result.foldersCreated.includes('src/utils'));
    assert(result.foldersCreated.includes('config'));

    // Vérifier que la structure existe
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'src')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'src/utils')), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'config')), true);
  });

  // Test 2: Upload de dossier avec fichiers mixtes (compressibles et non-compressibles)
  await test('should handle mixed file types in folder upload', async () => {
    const folderPath = path.join(testDir, 'mixed-folder');
    
    const files = [
      {
        name: 'document.txt',
        relativePath: 'docs/document.txt',
        content: 'This is a long document that should definitely be compressed because it contains a lot of text content.',
        size: 0,
        tempPath: null
      },
      {
        name: 'small.txt',
        relativePath: 'small.txt',
        content: 'Hi', // Trop petit pour être compressé
        size: 0,
        tempPath: null
      },
      {
        name: 'image.jpg',
        relativePath: 'images/image.jpg',
        content: 'fake-image-content', // Type exclu
        size: 0,
        tempPath: null
      }
    ];

    // Créer les fichiers temporaires
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempPath = path.join(testDir, `mixed-temp-${i}.txt`);
      await fs.writeFile(tempPath, file.content);
      
      const stats = await fs.stat(tempPath);
      file.size = stats.size;
      file.tempPath = tempPath;
    }

    const result = await middleware.handleFolderCreation(folderPath, files);

    // Vérifications
    assert.strictEqual(result.totalFiles, 3);
    assert.strictEqual(result.compressedFiles, 1); // Seul le gros document.txt
    assert.strictEqual(result.uncompressedFiles, 2); // small.txt et image.jpg
    assert(result.foldersCreated.includes('docs'));
    assert(result.foldersCreated.includes('images'));
  });

  // Test 3: Analyse de structure complexe
  await test('should analyze complex folder structure correctly', async () => {
    const multerFiles = [
      {
        originalname: 'index.html',
        webkitRelativePath: 'website/index.html',
        size: 2048
      },
      {
        originalname: 'style.css',
        webkitRelativePath: 'website/css/style.css',
        size: 1024
      },
      {
        originalname: 'script.js',
        webkitRelativePath: 'website/js/script.js',
        size: 3072
      },
      {
        originalname: 'logo.png',
        webkitRelativePath: 'website/images/logo.png',
        size: 5120
      },
      {
        originalname: 'utils.js',
        webkitRelativePath: 'website/js/utils/utils.js',
        size: 1536
      }
    ];

    const structure = middleware.analyzeFolderStructure(multerFiles);

    assert.strictEqual(structure.files.length, 5);
    assert.strictEqual(structure.totalSize, 12800);
    assert(structure.folders.includes('website'));
    assert(structure.folders.includes('website/css'));
    assert(structure.folders.includes('website/js'));
    assert(structure.folders.includes('website/images'));
    assert(structure.folders.includes('website/js/utils'));
    
    // Vérifier les types de fichiers
    assert.strictEqual(structure.fileTypes.get('.html'), 1);
    assert.strictEqual(structure.fileTypes.get('.css'), 1);
    assert.strictEqual(structure.fileTypes.get('.js'), 2);
    assert.strictEqual(structure.fileTypes.get('.png'), 1);
  });

  // Test 4: Validation de structure avec avertissements
  await test('should validate folder structure and provide warnings', async () => {
    // Structure avec beaucoup de fichiers pour déclencher des avertissements
    const largeStructure = {
      files: Array.from({ length: 1500 }, (_, i) => ({
        originalname: `file${i}.txt`,
        size: 1024,
        pathParts: ['deep', 'nested', 'folder', 'structure', 'level5', 'level6', `file${i}.txt`]
      })),
      folders: ['deep', 'deep/nested', 'deep/nested/folder'],
      totalSize: 1500 * 1024, // 1.5MB
      fileTypes: new Map([['.txt', 1500]])
    };

    const validation = middleware.validateFolderStructure(largeStructure);

    assert.strictEqual(validation.isValid, true);
    assert(validation.warnings.length > 0, 'Should have warnings for large structure');
    assert(validation.warnings.some(w => w.includes('Nombre de fichiers élevé')));
    assert(validation.warnings.some(w => w.includes('Hiérarchie de dossiers profonde')));
  });

  // Test 5: Gestion d'erreurs lors de la création de dossiers
  await test('should handle errors gracefully during folder creation', async () => {
    // Simuler une erreur en utilisant un chemin invalide
    const invalidFolderPath = path.join(testDir, 'invalid\x00folder'); // Caractère null invalide
    
    const files = [
      {
        name: 'test.txt',
        relativePath: 'test.txt',
        content: 'Test content',
        size: 12,
        tempPath: path.join(testDir, 'error-test.txt')
      }
    ];

    // Créer le fichier temporaire
    await fs.writeFile(files[0].tempPath, files[0].content);

    try {
      await middleware.handleFolderCreation(invalidFolderPath, files);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert(error.message.includes('Erreur lors de la création du dossier'));
    }
  });

  // Nettoyage
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignorer les erreurs de nettoyage
  }

  // Résultats
  console.log(`\nFolder Upload Test Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runFolderUploadTests().catch(console.error);
}

module.exports = { runFolderUploadTests };