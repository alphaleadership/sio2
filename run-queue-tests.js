// Test runner for CompressionQueue
console.log('Starting CompressionQueue tests...\n');

try {
  require('./test/compression/CompressionQueue.test.js');
} catch (error) {
  console.error('Test execution failed:', error);
  process.exit(1);
}