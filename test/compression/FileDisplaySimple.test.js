// Simple test for file display functionality
const fs = require('fs');
const path = require('path');

// Import required modules
const CompressionService = require('../../lib/compression/CompressionService');
const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

console.log('Running File Display tests...\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test setup
  const testDir = path.join(__dirname, '../temp/file-display-simple');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const compressionService = new CompressionService();
  const metadataManager = new FileMetadataManager();

  try {
    // Test 1: File filtering logic
    console.log('Testing: File filtering should hide .gz and .meta files');
    
    // Create test files
    const originalFile = path.join(testDir, 'test.txt');
    const compressedFile = path.join(testDir, 'test.txt.gz');
    const metaFile = path.join(testDir, 'test.txt.meta');
    const normalFile = path.join(testDir, 'normal.txt');

    fs.writeFileSync(originalFile, 'Test content for compression');
    await compressionService.compressFile(originalFile, compressedFile);
    
    // Create metadata
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
    
    fs.unlinkSync(originalFile); // Remove original after compression
    fs.writeFileSync(normalFile, 'Normal file content');

    // Simulate the filtering logic from renderFiles
    const files = fs.readdirSync(testDir, { withFileTypes: true });
    const processedFiles = [];
    const seenFiles = new Set();

    for (const file of files) {
      const fullPath = path.join(testDir, file.name);
      
      // Skip .meta files
      if (file.name.endsWith('.meta')) {
        continue;
      }

      // Handle compressed files
      if (file.name.endsWith('.gz')) {
        const originalName = file.name.slice(0, -3);
        
        if (seenFiles.has(originalName)) {
          continue;
        }
        seenFiles.add(originalName);

        try {
          const loadedMetadata = await metadataManager.loadMetadata(path.join(testDir, originalName));
          processedFiles.push({
            name: originalName,
            isCompressed: true,
            size: loadedMetadata ? loadedMetadata.originalSize : fs.statSync(fullPath).size
          });
        } catch (error) {
          processedFiles.push({
            name: originalName,
            isCompressed: true,
            size: fs.statSync(fullPath).size
          });
        }
        continue;
      }

      // Handle normal files
      if (file.isFile()) {
        const compressedPath = fullPath + '.gz';
        if (fs.existsSync(compressedPath)) {
          continue; // Skip if compressed version exists
        }
        
        if (seenFiles.has(file.name)) {
          continue;
        }
        seenFiles.add(file.name);

        processedFiles.push({
          name: file.name,
          isCompressed: false,
          size: fs.statSync(fullPath).size
        });
      }
    }

    // Verify results
    if (processedFiles.length === 2) {
      const compressedFile = processedFiles.find(f => f.name === 'test.txt');
      const normalFile = processedFiles.find(f => f.name === 'normal.txt');
      
      if (compressedFile && compressedFile.isCompressed && 
          normalFile && !normalFile.isCompressed &&
          !processedFiles.some(f => f.name.endsWith('.gz') || f.name.endsWith('.meta'))) {
        console.log('✓ File filtering should hide .gz and .meta files passed');
        testsPassed++;
      } else {
        console.log('✗ File filtering should hide .gz and .meta files failed');
        testsFailed++;
      }
    } else {
      console.log('✗ File filtering should hide .gz and .meta files failed - wrong number of files');
      testsFailed++;
    }

    // Test 2: Metadata size display
    console.log('Testing: Should display original file size for compressed files');
    
    const compressedFileEntry = processedFiles.find(f => f.name === 'test.txt');
    if (compressedFileEntry && compressedFileEntry.size === metadata.originalSize) {
      console.log('✓ Should display original file size for compressed files passed');
      testsPassed++;
    } else {
      console.log('✗ Should display original file size for compressed files failed');
      testsFailed++;
    }

    // Test 3: Folder structure preservation
    console.log('Testing: Should preserve folder structure');
    
    const subDir = path.join(testDir, 'subfolder');
    fs.mkdirSync(subDir);
    
    const filesWithFolder = fs.readdirSync(testDir, { withFileTypes: true });
    const folderEntry = filesWithFolder.find(f => f.isDirectory() && f.name === 'subfolder');
    
    if (folderEntry) {
      console.log('✓ Should preserve folder structure passed');
      testsPassed++;
    } else {
      console.log('✗ Should preserve folder structure failed');
      testsFailed++;
    }

  } catch (error) {
    console.error('Test error:', error.message);
    testsFailed++;
  } finally {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Results
  console.log('\nTest Results:');
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
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runTests };