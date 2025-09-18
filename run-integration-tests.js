// Test runner for Queue + Streaming Integration tests
console.log('Starting Queue + Streaming Integration tests...\n');

try {
  require('./test/compression/QueueStreamingIntegration.test.js');
} catch (error) {
  console.error('Test execution failed:', error);
  process.exit(1);
}