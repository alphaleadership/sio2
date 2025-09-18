#!/usr/bin/env node

// Complete integration test runner for file compression system
const { runAllTests } = require('./test/compression/ComprehensiveIntegration.test.js');

console.log('🚀 Starting Complete Integration Test Suite for File Compression System');
console.log('This will test the entire upload-compression-download workflow and API compatibility.\n');

runAllTests().then(success => {
  if (success) {
    console.log('\n✅ All integration tests completed successfully!');
    console.log('The file compression system is fully tested and ready.');
    process.exit(0);
  } else {
    console.log('\n❌ Some integration tests failed.');
    console.log('Please review the test output and fix any issues before deployment.');
    process.exit(1);
  }
}).catch(error => {
  console.error('\n💥 Integration test runner crashed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});