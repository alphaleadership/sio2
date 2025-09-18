// Direct test execution
console.log('Starting CompressionService tests...\n');

try {
  require('./test/compression/CompressionService.test.js');
} catch (error) {
  console.error('Test execution failed:', error);
  process.exit(1);
}