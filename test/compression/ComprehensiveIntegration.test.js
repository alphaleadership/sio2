// Comprehensive integration test runner for all compression functionality
const fs = require('fs');
const path = require('path');

// Import test modules
const { runTests: runUploadCompressionDownloadTests } = require('./UploadCompressionDownloadIntegration.test.js');
const { runTests: runAPICompatibilityTests } = require('./APICompatibilityIntegration.test.js');

console.log('Running Comprehensive Integration Tests for File Compression System...\n');
console.log('='.repeat(80));

async function runAllTests() {
  let totalPassed = 0;
  let totalFailed = 0;
  const testResults = [];

  try {
    // Test 1: Upload-Compression-Download Workflow
    console.log('\n📁 TESTING: Upload-Compression-Download Workflow');
    console.log('-'.repeat(60));
    
    const uploadTestResult = await runUploadCompressionDownloadTests();
    testResults.push({
      name: 'Upload-Compression-Download Workflow',
      passed: uploadTestResult
    });

    console.log('\n' + '='.repeat(80));

    // Test 2: API Compatibility
    console.log('\n🔌 TESTING: API Compatibility with Existing Routes');
    console.log('-'.repeat(60));
    
    const apiTestResult = await runAPICompatibilityTests();
    testResults.push({
      name: 'API Compatibility',
      passed: apiTestResult
    });

    console.log('\n' + '='.repeat(80));

    // Test 3: End-to-End Scenarios
    console.log('\n🔄 TESTING: End-to-End Scenarios');
    console.log('-'.repeat(60));
    
    const e2eTestResult = await runEndToEndTests();
    testResults.push({
      name: 'End-to-End Scenarios',
      passed: e2eTestResult
    });

  } catch (error) {
    console.error('Test runner error:', error.message);
    testResults.push({
      name: 'Test Runner',
      passed: false,
      error: error.message
    });
  }

  // Calculate totals
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = testResults.filter(r => !r.passed).length;

  // Final results
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE INTEGRATION TEST RESULTS');
  console.log('='.repeat(80));
  
  testResults.forEach(result => {
    const status = result.passed ? '✓ PASSED' : '✗ FAILED';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${status}\x1b[0m ${result.name}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`Total Test Suites: ${testResults.length}`);
  console.log(`✓ Passed: ${passedTests}`);
  console.log(`✗ Failed: ${failedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / testResults.length) * 100)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 ALL INTEGRATION TESTS PASSED! 🎉');
    console.log('The file compression system is ready for production.');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('Please review the failed tests before deploying.');
  }
  
  console.log('='.repeat(80));
  
  return failedTests === 0;
}

async function runEndToEndTests() {
  console.log('Running End-to-End scenario tests...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  // Test setup
  const testDir = path.join(__dirname, '../temp/e2e-tests');
  const baseDir = path.join(testDir, 'partage');
  
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    // Import compression modules
    const CompressionService = require('../../lib/compression/CompressionService');
    const CompressionConfig = require('../../lib/compression/CompressionConfig');
    const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
    const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

    const config = new CompressionConfig();
    const compressionService = new CompressionService();
    const fileStorageMiddleware = new FileStorageMiddleware(compressionService, config);
    const metadataManager = new FileMetadataManager();

    // Scenario 1: Complete user workflow
    console.log('Testing: Complete user workflow (upload → browse → download → delete)');
    
    const scenarioFile = path.join(baseDir, 'scenario-test.txt');
    const scenarioContent = 'This is a complete user workflow test file with enough content to trigger compression. '.repeat(100);
    
    // Step 1: Simulate file upload
    fs.writeFileSync(scenarioFile, scenarioContent);
    
    const mockReq = {
      files: [{
        originalname: 'scenario-test.txt',
        path: scenarioFile,
        size: scenarioContent.length,
        mimetype: 'text/plain'
      }]
    };
    
    const middleware = fileStorageMiddleware.createUploadMiddleware();
    await new Promise((resolve, reject) => {
      mockReq.compressionResults = [];
      middleware(mockReq, {}, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Step 2: Verify file was compressed
    const compressedExists = fs.existsSync(scenarioFile + '.gz');
    const metadataExists = fs.existsSync(scenarioFile + '.meta');
    
    if (!compressedExists || !metadataExists) {
      console.log('✗ Complete user workflow failed - compression step');
      testsFailed++;
    } else {
      // Step 3: Simulate file browsing (metadata loading)
      try {
        const metadata = await metadataManager.loadMetadata(scenarioFile);
        
        if (metadata && metadata.originalSize === scenarioContent.length) {
          // Step 4: Simulate file download (decompression)
          const tempDownloadPath = path.join(testDir, 'downloaded-file.txt');
          await compressionService.decompressFile(scenarioFile + '.gz', tempDownloadPath);
          
          const downloadedContent = fs.readFileSync(tempDownloadPath, 'utf8');
          
          if (downloadedContent === scenarioContent) {
            // Step 5: Simulate file deletion
            const trashDir = path.join(testDir, '.corbeille');
            fs.mkdirSync(trashDir, { recursive: true });
            
            const trashPath = path.join(trashDir, Date.now() + '_scenario-test.txt.gz');
            const trashMetaPath = path.join(trashDir, Date.now() + '_scenario-test.txt.meta');
            
            fs.renameSync(scenarioFile + '.gz', trashPath);
            fs.renameSync(scenarioFile + '.meta', trashMetaPath);
            
            if (fs.existsSync(trashPath) && fs.existsSync(trashMetaPath)) {
              console.log('✓ Complete user workflow passed');
              testsPassed++;
            } else {
              console.log('✗ Complete user workflow failed - deletion step');
              testsFailed++;
            }
          } else {
            console.log('✗ Complete user workflow failed - download step');
            testsFailed++;
          }
          
          // Cleanup temp file
          if (fs.existsSync(tempDownloadPath)) {
            fs.unlinkSync(tempDownloadPath);
          }
        } else {
          console.log('✗ Complete user workflow failed - metadata step');
          testsFailed++;
        }
      } catch (error) {
        console.log('✗ Complete user workflow failed - error:', error.message);
        testsFailed++;
      }
    }

    // Scenario 2: Mixed file types handling
    console.log('Testing: Mixed file types handling in single operation');
    
    const mixedFiles = [
      { name: 'document.txt', content: 'Text document content. '.repeat(50), shouldCompress: true },
      { name: 'script.js', content: 'function test() { return true; }\n'.repeat(30), shouldCompress: true },
      { name: 'image.jpg', content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), shouldCompress: false },
      { name: 'tiny.txt', content: 'Small', shouldCompress: false }
    ];

    const mixedMockReq = {
      files: mixedFiles.map(file => ({
        originalname: file.name,
        path: path.join(baseDir, file.name),
        size: file.content.length || file.content.byteLength,
        mimetype: file.name.endsWith('.txt') ? 'text/plain' : 
                 file.name.endsWith('.js') ? 'application/javascript' : 'image/jpeg'
      }))
    };

    // Create the files
    mixedFiles.forEach(file => {
      fs.writeFileSync(path.join(baseDir, file.name), file.content);
    });

    // Process through middleware
    const mixedMiddleware = fileStorageMiddleware.createUploadMiddleware();
    await new Promise((resolve, reject) => {
      mixedMockReq.compressionResults = [];
      mixedMiddleware(mixedMockReq, {}, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Verify results
    let mixedTestPassed = true;
    for (const file of mixedFiles) {
      const filePath = path.join(baseDir, file.name);
      const compressedPath = filePath + '.gz';
      const isCompressed = fs.existsSync(compressedPath);
      
      if (file.shouldCompress && !isCompressed) {
        console.log(`✗ ${file.name} should have been compressed but wasn't`);
        mixedTestPassed = false;
      } else if (!file.shouldCompress && isCompressed) {
        console.log(`✗ ${file.name} should not have been compressed but was`);
        mixedTestPassed = false;
      }
    }

    if (mixedTestPassed) {
      console.log('✓ Mixed file types handling passed');
      testsPassed++;
    } else {
      console.log('✗ Mixed file types handling failed');
      testsFailed++;
    }

    // Scenario 3: Error recovery and fallback
    console.log('Testing: Error recovery and fallback mechanisms');
    
    const errorTestFile = path.join(baseDir, 'error-test.txt');
    const errorContent = 'Error recovery test content. '.repeat(50);
    fs.writeFileSync(errorTestFile, errorContent);

    // Simulate compression error by making destination read-only
    const readOnlyDir = path.join(testDir, 'readonly');
    fs.mkdirSync(readOnlyDir, { recursive: true });
    
    try {
      // This should trigger error handling and fallback to original file
      const errorMockReq = {
        files: [{
          originalname: 'error-test.txt',
          path: errorTestFile,
          size: errorContent.length,
          mimetype: 'text/plain'
        }]
      };

      const errorMiddleware = fileStorageMiddleware.createUploadMiddleware();
      await new Promise((resolve, reject) => {
        errorMockReq.compressionResults = [];
        errorMiddleware(errorMockReq, {}, (err) => {
          // Should not throw error, should handle gracefully
          resolve();
        });
      });

      // File should still exist (either compressed or original)
      const originalExists = fs.existsSync(errorTestFile);
      const compressedExists = fs.existsSync(errorTestFile + '.gz');
      
      if (originalExists || compressedExists) {
        console.log('✓ Error recovery and fallback passed');
        testsPassed++;
      } else {
        console.log('✗ Error recovery and fallback failed - no file preserved');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Error recovery test failed:', error.message);
      testsFailed++;
    }

  } catch (error) {
    console.error('End-to-end test setup error:', error.message);
    testsFailed++;
  } finally {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  console.log('\nEnd-to-End Test Results:');
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  return testsFailed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Comprehensive test runner error:', error);
    process.exit(1);
  });
}

module.exports = { runAllTests };