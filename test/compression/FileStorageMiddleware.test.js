const assert = require('assert');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');

// Simple test runner
async function runTests() {
  console.log('Running FileStorageMiddleware tests...\n');
  
  const testDir = path.join(__dirname, '../temp/middleware-test');
  
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

  // Initialiser les services pour les tests
  const config = new CompressionConfig({
    minFileSize: 100,
    compressibleTypes: ['.txt', '.js', '.json'],
    excludeTypes: ['.jpg', '.png']
  });
  const compressionService = new CompressionService();
  const middleware = new FileStorageMiddleware(compressionService, config);

  // Test 1: shouldCompress - fichier compressible avec taille valide
  await test('shouldCompress should return true for compressible files with valid size', async () => {
    const result = middleware.shouldCompress('test.txt', 1024);
    assert.strictEqual(result, true);
  });

  // Test 2: shouldCompress - fichier trop petit
  await test('shouldCompress should return false for files too small', async () => {
    const result = middleware.shouldCompress('test.txt', 50);
    assert.strictEqual(result, false);
  });

  // Test 3: shouldCompress - type de fichier exclu
  await test('shouldCompress should return false for excluded file types', async () => {
    const result = middleware.shouldCompress('image.jpg', 1024);
    assert.strictEqual(result, false);
  });

  // Test 4: shouldCompress - type de fichier non compressible
  await test('shouldCompress should return false for non-compressible file types', async () => {
    const result = middleware.shouldCompress('document.pdf', 1024);
    assert.strictEqual(result, false);
  });

  // Test 5: handleUpload - traitement avec compression
  await test('handleUpload should process files with compression when criteria are met', async () => {
    // Créer un fichier temporaire de test
    const testContent = 'This is a test file content that should be compressed because it is long enough and has the right extension.';
    const tempFile = path.join(testDir, 'temp-upload.txt');
    await fs.writeFile(tempFile, testContent);

    // Simuler un objet request avec fichiers
    const req = {
      files: [{
        path: tempFile,
        originalname: 'test.txt',
        webkitRelativePath: undefined
      }],
      body: {
        path: ''
      }
    };

    const res = {
      status: () => res,
      send: () => {}
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Mocker path.resolve temporairement
    const originalResolve = path.resolve;
    path.resolve = (p) => {
      if (p === '../partage') {
        return testDir;
      }
      return originalResolve(p);
    };

    try {
      await middleware.handleUpload(req, res, next);

      // Vérifier que next() a été appelé
      assert.strictEqual(nextCalled, true);

      // Vérifier que les résultats de compression sont présents
      assert(req.compressionResults !== undefined);
      assert.strictEqual(req.compressionResults.length, 1);

      const result = req.compressionResults[0];
      assert.strictEqual(result.compressed, true);
      assert(result.finalPath.endsWith('.gz'));

      // Vérifier que le fichier compressé existe
      assert.strictEqual(fsSync.existsSync(result.finalPath), true);

    } finally {
      path.resolve = originalResolve;
    }
  });

  // Test 6: handleUpload - fichier ne respectant pas les critères
  await test('handleUpload should handle files that do not meet compression criteria', async () => {
    // Créer un petit fichier qui ne sera pas compressé
    const testContent = 'Small';
    const tempFile = path.join(testDir, 'temp-small.txt');
    await fs.writeFile(tempFile, testContent);

    const req = {
      files: [{
        path: tempFile,
        originalname: 'small.txt',
        webkitRelativePath: undefined
      }],
      body: {
        path: ''
      }
    };

    const res = {
      status: () => res,
      send: () => {}
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Mocker path.resolve
    const originalResolve = path.resolve;
    path.resolve = (p) => {
      if (p === '../partage') {
        return testDir;
      }
      return originalResolve(p);
    };

    try {
      await middleware.handleUpload(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert(req.compressionResults !== undefined);
      assert.strictEqual(req.compressionResults.length, 1);

      const result = req.compressionResults[0];
      assert.strictEqual(result.compressed, false);
      assert(result.reason.includes('compression criteria'));

    } finally {
      path.resolve = originalResolve;
    }
  });

  // Test 7: handleUpload - préservation de webkitRelativePath
  await test('handleUpload should preserve webkitRelativePath for folder uploads', async () => {
    // Créer un fichier de test
    const testContent = 'This is a test file in a subfolder that should preserve the folder structure.';
    const tempFile = path.join(testDir, 'temp-folder-file.txt');
    await fs.writeFile(tempFile, testContent);

    const req = {
      files: [{
        path: tempFile,
        originalname: 'subfolder/test.txt',
        webkitRelativePath: 'subfolder/test.txt'
      }],
      body: {
        path: ''
      }
    };

    const res = {
      status: () => res,
      send: () => {}
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Mocker path.resolve
    const originalResolve = path.resolve;
    path.resolve = (p) => {
      if (p === '../partage') {
        return testDir;
      }
      return originalResolve(p);
    };

    try {
      await middleware.handleUpload(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert(req.compressionResults !== undefined);

      const result = req.compressionResults[0];
      assert(result.originalPath.includes('subfolder'));
      assert(result.finalPath.includes('subfolder'));

      // Vérifier que le dossier a été créé
      const subfolderPath = path.join(testDir, 'subfolder');
      assert.strictEqual(fsSync.existsSync(subfolderPath), true);

    } finally {
      path.resolve = originalResolve;
    }
  });

  // Test 8: handleFolderCreation - création de structure de dossiers
  await test('handleFolderCreation should create folder structure and compress eligible files', async () => {
    const folderPath = path.join(testDir, 'test-folder');
    
    // Créer des fichiers temporaires de test
    const file1Content = 'This is a large text file that should be compressed because it meets all criteria.';
    const file2Content = 'Small';
    const tempFile1 = path.join(testDir, 'temp1.txt');
    const tempFile2 = path.join(testDir, 'temp2.txt');
    
    await fs.writeFile(tempFile1, file1Content);
    await fs.writeFile(tempFile2, file2Content);

    const files = [
      {
        name: 'large.txt',
        relativePath: 'subfolder/large.txt',
        size: file1Content.length,
        tempPath: tempFile1
      },
      {
        name: 'small.txt',
        relativePath: 'small.txt',
        size: file2Content.length,
        tempPath: tempFile2
      }
    ];

    const result = await middleware.handleFolderCreation(folderPath, files);

    assert.strictEqual(result.totalFiles, 2);
    assert.strictEqual(result.compressedFiles, 1); // Seul le gros fichier devrait être compressé
    assert.strictEqual(result.uncompressedFiles, 1);
    assert(result.totalSpaceSaved > 0);
    assert(result.foldersCreated.includes('subfolder'));

    // Vérifier que le dossier a été créé
    assert.strictEqual(fsSync.existsSync(folderPath), true);
    assert.strictEqual(fsSync.existsSync(path.join(folderPath, 'subfolder')), true);
  });

  // Test 9: analyzeFolderStructure - analyse de structure de dossier
  await test('analyzeFolderStructure should analyze folder structure correctly', async () => {
    const multerFiles = [
      {
        originalname: 'file1.txt',
        webkitRelativePath: 'folder1/file1.txt',
        size: 1024
      },
      {
        originalname: 'file2.js',
        webkitRelativePath: 'folder1/subfolder/file2.js',
        size: 2048
      },
      {
        originalname: 'file3.txt',
        webkitRelativePath: 'folder2/file3.txt',
        size: 512
      }
    ];

    const structure = middleware.analyzeFolderStructure(multerFiles);

    assert.strictEqual(structure.files.length, 3);
    assert.strictEqual(structure.folders.length, 3); // folder1, folder1/subfolder, folder2
    assert.strictEqual(structure.totalSize, 3584);
    assert(structure.folders.includes('folder1'));
    assert(structure.folders.includes('folder1/subfolder'));
    assert(structure.folders.includes('folder2'));
    assert.strictEqual(structure.fileTypes.get('.txt'), 2);
    assert.strictEqual(structure.fileTypes.get('.js'), 1);
  });

  // Test 10: validateFolderStructure - validation de structure
  await test('validateFolderStructure should validate folder structure', async () => {
    const folderStructure = {
      files: [
        { originalname: 'test1.txt', size: 1024, pathParts: ['folder', 'test1.txt'] },
        { originalname: 'test2.txt', size: 2048, pathParts: ['folder', 'test2.txt'] }
      ],
      folders: ['folder'],
      totalSize: 3072,
      fileTypes: new Map([['.txt', 2]])
    };

    const validation = middleware.validateFolderStructure(folderStructure);

    assert.strictEqual(validation.isValid, true);
    assert(Array.isArray(validation.warnings));
    assert(Array.isArray(validation.errors));
    assert(Array.isArray(validation.recommendations));
  });

  // Test 11: handleUpload avec dossier - upload de dossier complet
  await test('handleUpload should handle folder upload with webkitRelativePath', async () => {
    // Créer des fichiers de test pour simuler un upload de dossier
    const file1Content = 'This is a test file in the root of the uploaded folder.';
    const file2Content = 'This is a test file in a subfolder of the uploaded folder.';
    const tempFile1 = path.join(testDir, 'temp-root.txt');
    const tempFile2 = path.join(testDir, 'temp-sub.txt');
    
    await fs.writeFile(tempFile1, file1Content);
    await fs.writeFile(tempFile2, file2Content);

    const req = {
      files: [
        {
          path: tempFile1,
          originalname: 'root.txt',
          webkitRelativePath: 'uploaded-folder/root.txt',
          size: file1Content.length
        },
        {
          path: tempFile2,
          originalname: 'sub.txt',
          webkitRelativePath: 'uploaded-folder/subfolder/sub.txt',
          size: file2Content.length
        }
      ],
      body: {
        path: ''
      }
    };

    const res = {
      status: () => res,
      send: () => {}
    };

    let nextCalled = false;
    const next = () => { nextCalled = true; };

    // Mocker path.resolve
    const originalResolve = path.resolve;
    path.resolve = (p) => {
      if (p === '../partage') {
        return testDir;
      }
      return originalResolve(p);
    };

    try {
      await middleware.handleUpload(req, res, next);

      assert.strictEqual(nextCalled, true);
      assert(req.compressionResults !== undefined);
      assert(req.folderStats !== undefined);
      assert.strictEqual(req.folderStats.totalFiles, 2);

      // Vérifier que la structure de dossiers a été créée
      const uploadedFolderPath = path.join(testDir, 'uploaded-folder');
      const subfolderPath = path.join(uploadedFolderPath, 'subfolder');
      
      assert.strictEqual(fsSync.existsSync(uploadedFolderPath), true);
      assert.strictEqual(fsSync.existsSync(subfolderPath), true);

    } finally {
      path.resolve = originalResolve;
    }
  });

  // Test 12: createUploadMiddleware - retourne une fonction middleware valide
  await test('createUploadMiddleware should return a valid Express middleware function', async () => {
    const middlewareFunction = middleware.createUploadMiddleware();
    
    assert.strictEqual(typeof middlewareFunction, 'function');
    assert.strictEqual(middlewareFunction.length, 3); // req, res, next
  });

  // Test 13: createDownloadMiddleware - retourne une fonction middleware valide
  await test('createDownloadMiddleware should return a valid Express middleware function', async () => {
    const middlewareFunction = middleware.createDownloadMiddleware();
    
    assert.strictEqual(typeof middlewareFunction, 'function');
    assert.strictEqual(middlewareFunction.length, 3); // req, res, next
  });

  // Nettoyage
  try {
    await fs.rm(testDir, { recursive: true, force: true });
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