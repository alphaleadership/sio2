// Integration tests for API compatibility with existing routes
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const multer = require('multer');

// Import required modules
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

console.log('Running API Compatibility Integration tests...\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test setup
  const testDir = path.join(__dirname, '../temp/api-compatibility');
  const baseDir = path.join(testDir, 'partage');
  const trashDir = path.join(testDir, '.corbeille');
  const tmpUploadsDir = path.join(testDir, 'tmp_uploads');
  const usersDir = path.join(baseDir, 'users');
  const globalDir = path.join(baseDir, 'global');
  
  // Clean and create test directories
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(trashDir, { recursive: true });
  fs.mkdirSync(tmpUploadsDir, { recursive: true });
  fs.mkdirSync(usersDir, { recursive: true });
  fs.mkdirSync(globalDir, { recursive: true });

  const config = new CompressionConfig();
  const compressionService = new CompressionService();
  const fileStorageMiddleware = new FileStorageMiddleware(compressionService, config);
  const metadataManager = new FileMetadataManager();

  // Create test users
  const testUsers = [
    { username: 'testuser', password: 'testpass', role: 'user' },
    { username: 'admin', password: 'adminpass', role: 'admin' }
  ];
  fs.writeFileSync(path.join(testDir, 'users.json'), JSON.stringify(testUsers, null, 2));

  // Create test server with routes similar to main app
  const app = express();
  const upload = multer({ dest: tmpUploadsDir });

  // Session middleware simulation
  app.use((req, res, next) => {
    req.session = {};
    next();
  });

  // Authentication middleware
  function userAuth(role = null) {
    return function(req, res, next) {
      if (req.session && req.session.user) {
        if (!role || req.session.user.role === role) return next();
        return res.status(403).send('Accès interdit.');
      }
      
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="User Area"');
        return res.status(401).send('Authentification requise');
      }
      
      const b64 = auth.split(' ')[1];
      const [username, password] = Buffer.from(b64, 'base64').toString().split(':');
      const user = testUsers.find(u => u.username === username && u.password === password);
      
      if (user && (!role || user.role === role)) {
        req.session.user = { username: user.username, role: user.role };
        return next();
      }
      
      res.set('WWW-Authenticate', 'Basic realm="User Area"');
      return res.status(401).send('Accès refusé');
    };
  }

  const adminAuth = userAuth('admin');

  // File listing route
  app.get('/', userAuth(), function(req, res) {
    const reqPath = req.query.path ? path.join(baseDir, req.query.path) : baseDir;
    
    if (!reqPath.startsWith(baseDir)) {
      return res.status(400).send('Chemin invalide.');
    }

    try {
      const files = fs.readdirSync(reqPath, { withFileTypes: true });
      const processedFiles = [];
      const seenFiles = new Set();

      for (const file of files) {
        const fullPath = path.join(reqPath, file.name);
        
        // Skip .meta files
        if (file.name.endsWith('.meta')) continue;
        
        if (file.isDirectory()) {
          const stats = fs.statSync(fullPath);
          processedFiles.push({
            name: file.name,
            isDirectory: true,
            size: stats.size,
            mtime: stats.mtime
          });
          continue;
        }

        // Handle compressed files
        if (file.name.endsWith('.gz')) {
          const originalName = file.name.slice(0, -3);
          
          if (seenFiles.has(originalName)) continue;
          seenFiles.add(originalName);

          try {
            const originalPath = path.join(path.dirname(fullPath), originalName);
            const metadata = await metadataManager.loadMetadata(originalPath);
            const stats = fs.statSync(fullPath);
            
            processedFiles.push({
              name: originalName,
              isDirectory: false,
              size: metadata ? metadata.originalSize : stats.size,
              mtime: stats.mtime,
              isCompressed: true
            });
          } catch (error) {
            const stats = fs.statSync(fullPath);
            processedFiles.push({
              name: originalName,
              isDirectory: false,
              size: stats.size,
              mtime: stats.mtime,
              isCompressed: true
            });
          }
          continue;
        }

        // Handle normal files
        const compressedPath = fullPath + '.gz';
        if (fs.existsSync(compressedPath)) continue; // Skip if compressed version exists
        
        if (seenFiles.has(file.name)) continue;
        seenFiles.add(file.name);

        const stats = fs.statSync(fullPath);
        processedFiles.push({
          name: file.name,
          isDirectory: false,
          size: stats.size,
          mtime: stats.mtime,
          isCompressed: false
        });
      }

      res.json({ files: processedFiles, path: req.query.path || '' });
    } catch (error) {
      res.status(500).send('Erreur lors de la lecture du dossier.');
    }
  });

  // Upload route
  app.post('/upload', upload.array('file'), fileStorageMiddleware.createUploadMiddleware(), function(req, res) {
    res.json({ 
      success: true, 
      compressionResults: req.compressionResults,
      folderStats: req.folderStats 
    });
  });

  // Download route
  app.get('/download', fileStorageMiddleware.createDownloadMiddleware(), function(req, res) {
    const reqFile = req.query.file ? path.join(baseDir, req.query.file) : null;
    
    if (!reqFile || !reqFile.startsWith(baseDir)) {
      return res.status(400).send("Chemin invalide.");
    }

    fs.stat(reqFile, (err, stats) => {
      if (err || !stats.isFile()) {
        return res.status(404).send("Fichier non trouvé.");
      }
      res.download(reqFile, path.basename(reqFile));
    });
  });

  // Delete route (move to trash)
  app.post('/delete', function(req, res) {
    const relFile = req.body.file;
    if (!relFile) return res.status(400).send('Fichier non spécifié.');
    
    const absFile = path.join(baseDir, relFile);
    if (!absFile.startsWith(baseDir)) return res.status(400).send('Chemin invalide.');
    if (!fs.existsSync(absFile)) return res.status(404).send('Fichier non trouvé.');
    
    const fileName = path.basename(absFile);
    const trashPath = path.join(trashDir, Date.now() + '_' + fileName);
    
    try {
      // Handle compressed files - move both .gz and .meta files
      if (fs.existsSync(absFile + '.gz')) {
        fs.renameSync(absFile + '.gz', trashPath + '.gz');
        if (fs.existsSync(absFile + '.meta')) {
          fs.renameSync(absFile + '.meta', trashPath + '.meta');
        }
      } else {
        fs.renameSync(absFile, trashPath);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).send('Erreur lors du déplacement.');
    }
  });

  // Admin trash route
  app.get('/admin/trash', adminAuth, function(req, res) {
    try {
      const files = fs.readdirSync(trashDir)
        .filter(f => fs.statSync(path.join(trashDir, f)).isFile())
        .filter(f => !f.endsWith('.meta')) // Hide metadata files
        .map(f => {
          const stats = fs.statSync(path.join(trashDir, f));
          return {
            name: f,
            mtime: stats.mtime,
            size: stats.size,
            isCompressed: f.endsWith('.gz')
          };
        });
      res.json({ files });
    } catch (error) {
      res.status(500).send('Erreur lecture corbeille');
    }
  });

  // Admin restore route
  app.post('/admin/restore', adminAuth, function(req, res) {
    const trashFile = req.body.file;
    if (!trashFile) return res.status(400).send('Fichier non spécifié.');
    
    const absTrashFile = path.join(trashDir, trashFile);
    if (!absTrashFile.startsWith(trashDir) || !fs.existsSync(absTrashFile)) {
      return res.status(404).send('Fichier non trouvé dans la corbeille.');
    }
    
    const origName = trashFile.replace(/^\d+_/, '');
    const destPath = path.join(baseDir, origName);
    
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      
      // Handle compressed files restoration
      if (trashFile.endsWith('.gz')) {
        fs.renameSync(absTrashFile, destPath + '.gz');
        const metaFile = absTrashFile.replace('.gz', '.meta');
        if (fs.existsSync(metaFile)) {
          fs.renameSync(metaFile, destPath + '.meta');
        }
      } else {
        fs.renameSync(absTrashFile, destPath);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).send('Erreur restauration.');
    }
  });

  const server = http.createServer(app);
  const port = 3002;
  
  await new Promise((resolve) => {
    server.listen(port, resolve);
  });

  try {
    // Test 1: Existing routes work without modification
    console.log('Testing: Existing routes work without modification');
    
    // Create test files (both compressed and uncompressed)
    const testFiles = [
      { name: 'normal.txt', content: 'Normal file content', compress: false },
      { name: 'compressed.txt', content: 'This is a longer file that will be compressed automatically. '.repeat(50), compress: true }
    ];

    for (const testFile of testFiles) {
      const filePath = path.join(baseDir, testFile.name);
      fs.writeFileSync(filePath, testFile.content);
      
      if (testFile.compress) {
        // Compress the file
        const compressedPath = filePath + '.gz';
        await compressionService.compressFile(filePath, compressedPath);
        
        // Save metadata
        const metadata = {
          originalPath: filePath,
          compressedPath: compressedPath,
          isCompressed: true,
          originalSize: testFile.content.length,
          compressedSize: fs.statSync(compressedPath).size,
          compressionRatio: 0.5,
          algorithm: 'gzip',
          compressedAt: new Date(),
          checksum: 'test-checksum'
        };
        await metadataManager.saveMetadata(filePath, metadata);
        fs.unlinkSync(filePath); // Remove original
      }
    }

    // Test file listing
    try {
      const listResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/',
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + Buffer.from('admin:adminpass').toString('base64')
          }
        }, resolve);
        req.on('error', reject);
        req.end();
      });

      let listData = '';
      listResponse.on('data', chunk => listData += chunk);
      await new Promise(resolve => listResponse.on('end', resolve));
      
      const listResult = JSON.parse(listData);
      
      if (listResult.files && listResult.files.length === 2) {
        const normalFile = listResult.files.find(f => f.name === 'normal.txt');
        const compressedFile = listResult.files.find(f => f.name === 'compressed.txt');
        
        if (normalFile && !normalFile.isCompressed && 
            compressedFile && compressedFile.isCompressed) {
          console.log('✓ Existing routes work without modification passed');
          testsPassed++;
        } else {
          console.log('✗ Existing routes work without modification failed - file properties');
          testsFailed++;
        }
      } else {
        console.log('✗ Existing routes work without modification failed - file count');
        console.log('Files found:', listResult.files?.length || 0);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ File listing error:', error.message);
      testsFailed++;
    }

    // Test 2: Authentication and permissions with compressed files
    console.log('Testing: Authentication and permissions with compressed files');
    
    // Create user directory and files
    const userDir = path.join(usersDir, 'testuser');
    fs.mkdirSync(userDir, { recursive: true });
    
    const userFile = path.join(userDir, 'user-file.txt');
    const userContent = 'User private file content that should be compressed. '.repeat(30);
    fs.writeFileSync(userFile, userContent);
    
    // Compress user file
    const userCompressed = userFile + '.gz';
    await compressionService.compressFile(userFile, userCompressed);
    
    const userMetadata = {
      originalPath: userFile,
      compressedPath: userCompressed,
      isCompressed: true,
      originalSize: userContent.length,
      compressedSize: fs.statSync(userCompressed).size,
      compressionRatio: 0.4,
      algorithm: 'gzip',
      compressedAt: new Date(),
      checksum: 'user-checksum'
    };
    await metadataManager.saveMetadata(userFile, userMetadata);
    fs.unlinkSync(userFile);

    // Test user authentication with compressed files
    try {
      const userResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/?path=users/testuser',
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + Buffer.from('testuser:testpass').toString('base64')
          }
        }, resolve);
        req.on('error', reject);
        req.end();
      });

      let userData = '';
      userResponse.on('data', chunk => userData += chunk);
      await new Promise(resolve => userResponse.on('end', resolve));
      
      const userResult = JSON.parse(userData);
      
      if (userResult.files && userResult.files.length === 1) {
        const userFileResult = userResult.files[0];
        if (userFileResult.name === 'user-file.txt' && userFileResult.isCompressed) {
          console.log('✓ Authentication and permissions with compressed files passed');
          testsPassed++;
        } else {
          console.log('✗ Authentication and permissions with compressed files failed - file properties');
          testsFailed++;
        }
      } else {
        console.log('✗ Authentication and permissions with compressed files failed - file access');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ User authentication error:', error.message);
      testsFailed++;
    }

    // Test 3: Trash management with compressed files
    console.log('Testing: Trash management with compressed files');
    
    // Delete a compressed file
    try {
      const deleteResponse = await new Promise((resolve, reject) => {
        const postData = 'file=compressed.txt';
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/delete',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Basic ' + Buffer.from('admin:adminpass').toString('base64')
          }
        }, resolve);
        req.on('error', reject);
        req.write(postData);
        req.end();
      });

      let deleteData = '';
      deleteResponse.on('data', chunk => deleteData += chunk);
      await new Promise(resolve => deleteResponse.on('end', resolve));
      
      // Check if file was moved to trash
      const trashFiles = fs.readdirSync(trashDir);
      const compressedInTrash = trashFiles.some(f => f.includes('compressed.txt.gz'));
      const metaInTrash = trashFiles.some(f => f.includes('compressed.txt.meta'));
      
      if (compressedInTrash && metaInTrash) {
        console.log('✓ Trash management with compressed files (delete) passed');
        testsPassed++;
      } else {
        console.log('✗ Trash management with compressed files (delete) failed');
        console.log('Compressed in trash:', compressedInTrash, 'Meta in trash:', metaInTrash);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Delete compressed file error:', error.message);
      testsFailed++;
    }

    // Test trash listing
    try {
      const trashResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/admin/trash',
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + Buffer.from('admin:adminpass').toString('base64')
          }
        }, resolve);
        req.on('error', reject);
        req.end();
      });

      let trashData = '';
      trashResponse.on('data', chunk => trashData += chunk);
      await new Promise(resolve => trashResponse.on('end', resolve));
      
      const trashResult = JSON.parse(trashData);
      
      if (trashResult.files && trashResult.files.length > 0) {
        const compressedTrashFile = trashResult.files.find(f => f.name.includes('compressed.txt'));
        if (compressedTrashFile && compressedTrashFile.isCompressed) {
          console.log('✓ Trash management with compressed files (listing) passed');
          testsPassed++;
        } else {
          console.log('✗ Trash management with compressed files (listing) failed - file not found');
          testsFailed++;
        }
      } else {
        console.log('✗ Trash management with compressed files (listing) failed - no files');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Trash listing error:', error.message);
      testsFailed++;
    }

    // Test file restoration
    try {
      const trashFiles = fs.readdirSync(trashDir);
      const compressedTrashFile = trashFiles.find(f => f.includes('compressed.txt.gz'));
      
      if (compressedTrashFile) {
        const restoreData = `file=${compressedTrashFile}`;
        const restoreResponse = await new Promise((resolve, reject) => {
          const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/admin/restore',
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(restoreData),
              'Authorization': 'Basic ' + Buffer.from('admin:adminpass').toString('base64')
            }
          }, resolve);
          req.on('error', reject);
          req.write(restoreData);
          req.end();
        });

        let restoreResponseData = '';
        restoreResponse.on('data', chunk => restoreResponseData += chunk);
        await new Promise(resolve => restoreResponse.on('end', resolve));
        
        // Check if file was restored
        const restoredCompressed = fs.existsSync(path.join(baseDir, 'compressed.txt.gz'));
        const restoredMeta = fs.existsSync(path.join(baseDir, 'compressed.txt.meta'));
        
        if (restoredCompressed && restoredMeta) {
          console.log('✓ Trash management with compressed files (restore) passed');
          testsPassed++;
        } else {
          console.log('✗ Trash management with compressed files (restore) failed');
          console.log('Restored compressed:', restoredCompressed, 'Restored meta:', restoredMeta);
          testsFailed++;
        }
      } else {
        console.log('✗ No compressed file found in trash for restoration test');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ File restoration error:', error.message);
      testsFailed++;
    }

    // Test 4: Download compatibility
    console.log('Testing: Download compatibility with compressed files');
    
    try {
      const downloadResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/download?file=compressed.txt',
          method: 'GET',
          headers: {
            'Authorization': 'Basic ' + Buffer.from('admin:adminpass').toString('base64')
          }
        }, resolve);
        req.on('error', reject);
        req.end();
      });

      let downloadedContent = '';
      downloadResponse.on('data', chunk => downloadedContent += chunk);
      await new Promise(resolve => downloadResponse.on('end', resolve));
      
      const expectedContent = testFiles.find(f => f.name === 'compressed.txt').content;
      
      if (downloadedContent === expectedContent) {
        console.log('✓ Download compatibility with compressed files passed');
        testsPassed++;
      } else {
        console.log('✗ Download compatibility with compressed files failed');
        console.log('Expected length:', expectedContent.length, 'Actual length:', downloadedContent.length);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Download compatibility error:', error.message);
      testsFailed++;
    }

  } catch (error) {
    console.error('API compatibility test error:', error.message);
    testsFailed++;
  } finally {
    // Cleanup
    server.close();
    
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Results
  console.log('\nAPI Compatibility Integration Test Results:');
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  return testsFailed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('API compatibility test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };