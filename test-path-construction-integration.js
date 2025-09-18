const PathConstructionStrategy = require('./lib/upload/PathConstructionStrategy');

console.log('Testing PathConstructionStrategy Integration...\n');

const strategy = new PathConstructionStrategy();

// Test case from requirements: individual file with problematic webkitRelativePath
console.log('=== Test Case 1: Individual file with duplicate folder ===');
const file1 = {
  originalname: 'rapport.pdf',
  webkitRelativePath: 'documents/rapport.pdf'
};
const result1 = strategy.constructSmartPath('documents', file1);
console.log(`Input: destFolder='documents', webkitRelativePath='documents/rapport.pdf'`);
console.log(`Expected: documents/rapport.pdf`);
console.log(`Actual: ${result1}`);
console.log(`✓ ${result1 === 'documents\\rapport.pdf' ? 'PASS' : 'FAIL'}\n`);

// Test case: legitimate folder upload
console.log('=== Test Case 2: Legitimate folder upload ===');
const file2 = {
  originalname: 'index.html',
  webkitRelativePath: 'my-site/pages/index.html'
};
const result2 = strategy.constructSmartPath('projects', file2);
console.log(`Input: destFolder='projects', webkitRelativePath='my-site/pages/index.html'`);
console.log(`Expected: projects/my-site/pages/index.html`);
console.log(`Actual: ${result2}`);
console.log(`✓ ${result2 === 'projects\\my-site\\pages\\index.html' ? 'PASS' : 'FAIL'}\n`);

// Test case: security - directory traversal
console.log('=== Test Case 3: Security - Directory traversal ===');
const file3 = {
  originalname: 'malicious.txt',
  webkitRelativePath: '../../../etc/passwd'
};
const result3 = strategy.constructWebkitPath('documents', file3);
console.log(`Input: destFolder='documents', webkitRelativePath='../../../etc/passwd'`);
console.log(`Expected: documents/malicious.txt (fallback to basename)`);
console.log(`Actual: ${result3}`);
console.log(`✓ ${result3 === 'documents\\malicious.txt' ? 'PASS' : 'FAIL'}\n`);

// Test case: basename strategy
console.log('=== Test Case 4: Basename strategy ===');
const file4 = {
  originalname: 'simple-file.pdf'
};
const result4 = strategy.constructBasename('uploads', file4);
console.log(`Input: destFolder='uploads', originalname='simple-file.pdf'`);
console.log(`Expected: uploads/simple-file.pdf`);
console.log(`Actual: ${result4}`);
console.log(`✓ ${result4 === 'uploads\\simple-file.pdf' ? 'PASS' : 'FAIL'}\n`);

console.log('Integration tests completed!');