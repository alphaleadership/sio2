// Test runner for StreamingCompressionService performance tests
console.log('Starting StreamingCompressionService performance tests...\n');

try {
  require('./test/compression/StreamingCompressionPerformance.test.js');
} catch (error) {
  console.error('Test execution failed:', error);
  process.exit(1);
}