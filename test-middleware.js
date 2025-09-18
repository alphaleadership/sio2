// Test runner for FileStorageMiddleware
console.log('Starting FileStorageMiddleware tests...\n');

try {
  require('./test/compression/FileStorageMiddleware.test.js');
} catch (error) {
  console.error('Test execution failed:', error);
  process.exit(1);
}