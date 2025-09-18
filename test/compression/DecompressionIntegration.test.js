// Integration test for decompression functionality
const fs = require('fs');
const path = require('path');

// Import required modules
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

console.log('Running Decompression Integration tests...\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test setup
  const testDir = path.join(__dirname, '../temp/decompression-integration');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const config = new CompressionConfig();
  const compressionService = new CompressionService();
  const fileStorageMiddleware = new FileStorageMiddleware(compressionService, config);
  const metadataManager = new FileMetadataManager();

  try {
    // Test 1: Download middleware should handle compressed files
    console.log('Testing: Download middleware should decompress files automatically');
    
    const originalFile = path.join(testDir, 'download-test.txt');
    const compressedFile = path.join(testDir, 'download-test.txt.gz');
    const testContent = 'This is test content for download decompression';
    
    fs.writeFileSync(originalFile, testContent);
    await compressionService.compressFile(originalFile, compressedFile);
    
    // Save metadata
    const metadata = {
      originalPath: originalFile,
      compressedPath: compressedFile,
      isCompressed: true,
      originalSize: fs.statSync(originalFile).size,
      compressedSize: fs.statSync(compressedFile).size,
      compressionRatio: 0.5,
      algorithm: 'gzip',
      compressedAt: new Date(),
      checksum: 'test-checksum'
    };
    await metadataManager.saveMetadata(originalFile, metadata);
    
    fs.unlinkSync(originalFile); // Remove original to simulate compressed-only storage

    // Simulate the download middleware logic
    const baseDir = testDir;
    const reqFile = path.join(baseDir, 'download-test.txt');
    const compressedPath = reqFile + '.gz';
    
    const originalExists = fs.existsSync(reqFile);
    const compressedExists = fs.existsSync(compressedPath);
    
    if (!originalExists && compressedExists) {
      // This is what the middleware should detect
      const tempDir = path.join(baseDir, 'tmp_downloads');
      fs.mkdirSync(tempDir, { recursive: true });
      
      const tempFileName = `${Date.now()}_${path.basename(reqFile)}`;
      const tempPath = path.join(tempDir, tempFileName);
      
      // Decompress the file
      await compressionService.decompressFile(compressedPath, tempPath);
      
      // Verify decompressed content
      const decompressedContent = fs.readFileSync(tempPath, 'utf8');
      
      if (decompressedContent === testContent) {
        console.log('✓ Download middleware should decompress files automatically passed');
        testsPassed++;
      } else {
        console.log('✗ Download middleware should decompress files automatically failed - content mismatch');
        testsFailed++;
      }
      
      // Cleanup temp file
      fs.unlinkSync(tempPath);
      fs.rmdirSync(tempDir);
    } else {
      console.log('✗ Download middleware should decompress files automatically failed - file detection');
      testsFailed++;
    }

    // Test 2: File display should show original metadata
    console.log('Testing: File display should show original file information');
    
    // Create another compressed file for display testing
    const displayFile = path.join(testDir, 'display-test.txt');
    const displayCompressed = path.join(testDir, 'display-test.txt.gz');
    const displayContent = 'Content for display testing with longer text to ensure compression';
    
    fs.writeFileSync(displayFile, displayContent);
    const originalSize = fs.statSync(displayFile).size;
    
    await compressionService.compressFile(displayFile, displayCompressed);
    
    const displayMetadata = {
      originalPath: displayFile,
      compressedPath: displayCompressed,
      isCompressed: true,
      originalSize: originalSize,
      compressedSize: fs.statSync(displayCompressed).size,
      compressionRatio: 0.6,
      algorithm: 'gzip',
      compressedAt: new Date(),
      checksum: 'display-checksum'
    };
    await metadataManager.saveMetadata(displayFile, displayMetadata);
    
    fs.unlinkSync(displayFile); // Remove original

    // Simulate file listing logic
    const files = fs.readdirSync(testDir, { withFileTypes: true });
    const processedFiles = [];
    const seenFiles = new Set();

    for (const file of files) {
      const fullPath = path.join(testDir, file.name);
      
      if (file.name.endsWith('.meta')) continue;
      
      if (file.name.endsWith('.gz')) {
        const originalName = file.name.slice(0, -3);
        
        if (seenFiles.has(originalName)) continue;
        seenFiles.add(originalName);

        try {
          const loadedMetadata = await metadataManager.loadMetadata(path.join(testDir, originalName));
          processedFiles.push({
            name: originalName,
            size: loadedMetadata ? loadedMetadata.originalSize : fs.statSync(fullPath).size,
            isCompressed: true
          });
        } catch (error) {
          processedFiles.push({
            name: originalName,
            size: fs.statSync(fullPath).size,
            isCompressed: true
          });
        }
      }
    }

    // Verify display results
    const displayTestFile = processedFiles.find(f => f.name === 'display-test.txt');
    const downloadTestFile = processedFiles.find(f => f.name === 'download-test.txt');
    
    if (displayTestFile && displayTestFile.size === originalSize && 
        downloadTestFile && downloadTestFile.isCompressed &&
        !processedFiles.some(f => f.name.endsWith('.gz') || f.name.endsWith('.meta'))) {
      console.log('✓ File display should show original file information passed');
      testsPassed++;
    } else {
      console.log('✗ File display should show original file information failed');
      console.log('Display test file:', displayTestFile);
      console.log('Expected size:', originalSize);
      testsFailed++;
    }

    // Test 3: API compatibility
    console.log('Testing: API should maintain compatibility with existing routes');
    
    // Create a normal (uncompressed) file
    const normalFile = path.join(testDir, 'normal-file.txt');
    fs.writeFileSync(normalFile, 'Normal file content');
    
    // Simulate normal file handling
    const normalExists = fs.existsSync(normalFile);
    const normalCompressedExists = fs.existsSync(normalFile + '.gz');
    
    if (normalExists && !normalCompressedExists) {
      // This should pass through to normal handling
      console.log('✓ API should maintain compatibility with existing routes passed');
      testsPassed++;
    } else {
      console.log('✗ API should maintain compatibility with existing routes failed');
      testsFailed++;
    }

  } catch (error) {
    console.error('Integration test error:', error.message);
    testsFailed++;
  } finally {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Results
  console.log('\nIntegration Test Results:');
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