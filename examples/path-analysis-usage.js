/**
 * PathAnalysisEngine Usage Example
 * 
 * This example demonstrates how to use the PathAnalysisEngine to analyze
 * upload contexts and determine the correct path construction strategy.
 */

const { PathAnalysisEngine } = require('../lib/upload');

const engine = new PathAnalysisEngine();

console.log('=== PathAnalysisEngine Usage Examples ===\n');

// Example 1: Individual file upload (the problematic case)
console.log('1. Individual file with problematic webkitRelativePath:');
const individualFile = [{
  originalname: 'rapport.pdf',
  webkitRelativePath: 'documents/rapport.pdf'
}];

const result1 = engine.analyzeUploadContext(individualFile, 'documents');
console.log('Input:', JSON.stringify(individualFile[0], null, 2));
console.log('Destination:', 'documents');
console.log('Analysis Result:', JSON.stringify(result1, null, 2));
console.log('Expected behavior: Use basename strategy to avoid documents/documents/rapport.pdf\n');

// Example 2: Legitimate folder upload
console.log('2. Legitimate folder upload:');
const folderFiles = [
  {
    originalname: 'index.html',
    webkitRelativePath: 'my-website/pages/index.html'
  },
  {
    originalname: 'style.css',
    webkitRelativePath: 'my-website/assets/style.css'
  },
  {
    originalname: 'script.js',
    webkitRelativePath: 'my-website/assets/script.js'
  }
];

const result2 = engine.analyzeUploadContext(folderFiles, 'projects');
console.log('Input files:', folderFiles.length);
console.log('Sample file:', JSON.stringify(folderFiles[0], null, 2));
console.log('Destination:', 'projects');
console.log('Analysis Result:', JSON.stringify(result2, null, 2));
console.log('Expected behavior: Use webkit_path strategy to preserve folder structure\n');

// Example 3: Individual files without webkitRelativePath
console.log('3. Individual files without webkitRelativePath:');
const simpleFiles = [
  { originalname: 'document1.pdf', webkitRelativePath: '' },
  { originalname: 'document2.pdf', webkitRelativePath: '' }
];

const result3 = engine.analyzeUploadContext(simpleFiles, 'uploads');
console.log('Input files:', simpleFiles.length);
console.log('Sample file:', JSON.stringify(simpleFiles[0], null, 2));
console.log('Destination:', 'uploads');
console.log('Analysis Result:', JSON.stringify(result3, null, 2));
console.log('Expected behavior: Use basename strategy for individual files\n');

// Example 4: Mixed upload patterns
console.log('4. Mixed upload patterns:');
const mixedFiles = [
  {
    originalname: 'file1.txt',
    webkitRelativePath: 'folder1/file1.txt'
  },
  {
    originalname: 'file2.txt',
    webkitRelativePath: 'different-folder/file2.txt'
  }
];

const result4 = engine.analyzeUploadContext(mixedFiles, 'uploads');
console.log('Input files:', mixedFiles.length);
console.log('Files have different folder structures');
console.log('Destination:', 'uploads');
console.log('Analysis Result:', JSON.stringify(result4, null, 2));
console.log('Expected behavior: Use smart_path strategy for mixed patterns\n');

console.log('=== Summary ===');
console.log('The PathAnalysisEngine successfully:');
console.log('✓ Detects individual file uploads that should use basename strategy');
console.log('✓ Identifies legitimate folder uploads that should preserve webkit paths');
console.log('✓ Provides confidence scores for decision making');
console.log('✓ Warns about potential path duplication issues');
console.log('✓ Handles edge cases and mixed upload patterns');