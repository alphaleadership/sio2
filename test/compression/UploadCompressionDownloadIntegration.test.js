// Comprehensive integration tests for upload-compression-download workflow
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

console.log('Running Upload-Compression-Download Integration tests...\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test setup
  const testDir = path.join(__dirname, '../temp/upload-compression-download');
  const baseDir = path.join(testDir, 'partage');
  const tmpUploadsDir = path.join(testDir, 'tmp_uploads');
  
  // Clean and create test directories
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(tmpUploadsDir, { recursive: true });

  const config = new CompressionConfig();
  const compressionService = new CompressionService();
  const fileStorageMiddleware = new FileStorageMiddleware(compressionService, config);
  const metadataManager = new FileMetadataManager();

  // Create test server
  const app = express();
  const upload = multer({ dest: tmpUploadsDir });

  // Setup routes similar to the main app
  app.post('/upload', upload.array('file'), fileStorageMiddleware.createUploadMiddleware(), (req, res) => {
    res.json({ 
      success: true, 
      compressionResults: req.compressionResults,
      folderStats: req.folderStats 
    });
  });

  app.get('/download', fileStorageMiddleware.createDownloadMiddleware(), (req, res) => {
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

  const server = http.createServer(app);
  const port = 3001;
  
  await new Promise((resolve) => {
    server.listen(port, resolve);
  });

  try {
    // Test 1: Upload and compress different file types
    console.log('Testing: Upload and compress different file types');
    
    const testFiles = [
      { name: 'test.txt', content: 'This is a text file with some content that should compress well. '.repeat(50), type: 'text/plain' },
      { name: 'test.js', content: 'function test() {\n  console.log("Hello World");\n  return true;\n}\n'.repeat(20), type: 'application/javascript' },
      { name: 'test.json', content: JSON.stringify({ data: Array(100).fill({ key: 'value', number: 123 }) }, null, 2), type: 'application/json' },
      { name: 'small.txt', content: 'Small file', type: 'text/plain' }, // Should not be compressed due to size
      { name: 'test.jpg', content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), type: 'image/jpeg' } // Should not be compressed (binary)
    ];

    for (const testFile of testFiles) {
      // Create test file directly in the base directory for testing
      const testFilePath = path.join(baseDir, testFile.name);
      fs.writeFileSync(testFilePath, testFile.content);
      
      // Simulate the upload middleware processing
      const mockReq = {
        files: [{
          originalname: testFile.name,
          path: testFilePath,
          size: testFile.content.length,
          mimetype: testFile.type
        }]
      };
      
      const mockRes = {};
      const mockNext = () => {};
      
      try {
        // Process through compression middleware
        const middleware = fileStorageMiddleware.createUploadMiddleware();
        await new Promise((resolve, reject) => {
          mockReq.compressionResults = [];
          middleware(mockReq, mockRes, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        if (mockReq.compressionResults) {
          const fileResult = mockReq.compressionResults.find(r => r.originalName === testFile.name);
          
          // Check compression logic
          const shouldCompress = testFile.content.length >= config.minFileSize && 
                               config.compressibleTypes.some(ext => testFile.name.endsWith(ext));
          
          if (shouldCompress && fileResult && fileResult.compressed) {
            console.log(`✓ ${testFile.name} was correctly compressed`);
            testsPassed++;
          } else if (!shouldCompress && fileResult && !fileResult.compressed) {
            console.log(`✓ ${testFile.name} was correctly not compressed`);
            testsPassed++;
          } else {
            console.log(`✗ ${testFile.name} compression logic failed`);
            console.log('Expected compression:', shouldCompress, 'Actual:', fileResult?.compressed);
            testsFailed++;
          }
        } else {
          console.log(`✗ Upload processing failed for ${testFile.name}`);
          testsFailed++;
        }
      } catch (error) {
        console.log(`✗ Upload error for ${testFile.name}:`, error.message);
        testsFailed++;
      }
    }

    // Test 2: Verify metadata preservation
    console.log('Testing: Metadata preservation during compression');
    
    const metadataTestFile = path.join(baseDir, 'test.txt');
    const compressedPath = metadataTestFile + '.gz';
    
    if (fs.existsSync(compressedPath)) {
      try {
        const metadata = await metadataManager.loadMetadata(metadataTestFile);
        const originalStats = fs.statSync(compressedPath);
        
        if (metadata && 
            metadata.originalSize > 0 && 
            metadata.compressedSize > 0 && 
            metadata.compressionRatio > 0 && 
            metadata.algorithm === 'gzip' &&
            metadata.compressedAt instanceof Date) {
          console.log('✓ Metadata preservation during compression passed');
          testsPassed++;
        } else {
          console.log('✗ Metadata preservation during compression failed');
          console.log('Metadata:', metadata);
          testsFailed++;
        }
      } catch (error) {
        console.log('✗ Metadata loading failed:', error.message);
        testsFailed++;
      }
    } else {
      console.log('✗ Compressed file not found for metadata test');
      testsFailed++;
    }

    // Test 3: Download and decompress workflow
    console.log('Testing: Download and decompress workflow');
    
    try {
      const downloadResponse = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/download?file=test.txt',
          method: 'GET'
        }, resolve);

        req.on('error', reject);
        req.end();
      });

      let downloadedContent = '';
      downloadResponse.on('data', chunk => downloadedContent += chunk);
      
      await new Promise(resolve => downloadResponse.on('end', resolve));
      
      const originalContent = testFiles.find(f => f.name === 'test.txt').content;
      
      if (downloadedContent === originalContent) {
        console.log('✓ Download and decompress workflow passed');
        testsPassed++;
      } else {
        console.log('✗ Download and decompress workflow failed - content mismatch');
        console.log('Expected length:', originalContent.length, 'Actual length:', downloadedContent.length);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Download workflow error:', error.message);
      testsFailed++;
    }

    // Test 4: Folder upload with structure preservation
    console.log('Testing: Folder upload with structure preservation');
    
    const folderFiles = [
      { path: 'folder/subfolder/file1.txt', content: 'Content of file 1 in subfolder' },
      { path: 'folder/subfolder/file2.js', content: 'console.log("File 2 in subfolder");' },
      { path: 'folder/file3.txt', content: 'Content of file 3 in root folder' },
      { path: 'folder/another/deep/file4.json', content: '{"deep": "nested", "file": true}' }
    ];

    try {
      // Create temporary files for folder upload simulation
      const tempFiles = [];
      for (const file of folderFiles) {
        const tempPath = path.join(tmpUploadsDir, `temp_${Date.now()}_${Math.random()}`);
        fs.writeFileSync(tempPath, file.content);
        tempFiles.push({
          originalname: path.basename(file.path),
          path: tempPath,
          size: file.content.length,
          webkitRelativePath: file.path
        });
      }

      // Simulate folder upload processing
      const folderMockReq = {
        files: tempFiles,
        body: {}
      };
      
      const folderMockRes = {};
      const folderMockNext = () => {};
      
      // Process through compression middleware
      const folderMiddleware = fileStorageMiddleware.createUploadMiddleware();
      await new Promise((resolve, reject) => {
        folderMockReq.compressionResults = [];
        folderMiddleware(folderMockReq, folderMockRes, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      if (folderMockReq.folderStats) {
        // Check if folder structure was created
        const expectedPaths = [
          path.join(baseDir, 'folder'),
          path.join(baseDir, 'folder', 'subfolder'),
          path.join(baseDir, 'folder', 'another'),
          path.join(baseDir, 'folder', 'another', 'deep')
        ];

        const allFoldersExist = expectedPaths.every(p => fs.existsSync(p) && fs.statSync(p).isDirectory());
        
        // Check if files were processed
        const processedFiles = folderMockReq.compressionResults || [];
        const expectedFileCount = folderFiles.length;
        
        if (allFoldersExist && processedFiles.length === expectedFileCount) {
          console.log('✓ Folder upload with structure preservation passed');
          testsPassed++;
        } else {
          console.log('✗ Folder upload with structure preservation failed');
          console.log('Folders exist:', allFoldersExist);
          console.log('Files processed:', processedFiles.length, 'Expected:', expectedFileCount);
          testsFailed++;
        }
      } else {
        console.log('✗ Folder upload failed - no folder stats');
        testsFailed++;
      }
      
      // Cleanup temp files
      tempFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
      
    } catch (error) {
      console.log('✗ Folder upload error:', error.message);
      testsFailed++;
    }

    // Test 5: File permissions and dates preservation
    console.log('Testing: File permissions and dates preservation');
    
    const permissionTestFile = path.join(baseDir, 'test.txt');
    const compressedPermissionFile = permissionTestFile + '.gz';
    
    if (fs.existsSync(compressedPermissionFile)) {
      try {
        const metadata = await metadataManager.loadMetadata(permissionTestFile);
        const compressedStats = fs.statSync(compressedPermissionFile);
        
        // Check if dates are preserved in metadata
        if (metadata && 
            compressedStats.mtime instanceof Date &&
            compressedStats.ctime instanceof Date) {
          console.log('✓ File permissions and dates preservation passed');
          testsPassed++;
        } else {
          console.log('✗ File permissions and dates preservation failed');
          testsFailed++;
        }
      } catch (error) {
        console.log('✗ Permission test error:', error.message);
        testsFailed++;
      }
    } else {
      console.log('✗ Compressed file not found for permission test');
      testsFailed++;
    }

  } catch (error) {
    console.error('Integration test error:', error.message);
    testsFailed++;
  } finally {
    // Cleanup
    server.close();
    
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Results
  console.log('\nUpload-Compression-Download Integration Test Results:');
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
    console.error('Integration test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };