// Check if middleware can be loaded
try {
  console.log('Loading CompressionService...');
  const CompressionService = require('./lib/compression/CompressionService');
  console.log('✓ CompressionService loaded');

  console.log('Loading CompressionConfig...');
  const CompressionConfig = require('./lib/compression/CompressionConfig');
  console.log('✓ CompressionConfig loaded');

  console.log('Loading FileStorageMiddleware...');
  const FileStorageMiddleware = require('./lib/compression/FileStorageMiddleware');
  console.log('✓ FileStorageMiddleware loaded');

  console.log('Creating instances...');
  const config = new CompressionConfig();
  const service = new CompressionService();
  const middleware = new FileStorageMiddleware(service, config);
  console.log('✓ All instances created successfully');

  console.log('Testing shouldCompress method...');
  const result = middleware.shouldCompress('test.txt', 1024);
  console.log(`✓ shouldCompress result: ${result}`);

  console.log('\nAll checks passed! Middleware is ready to use.');

} catch (error) {
  console.error('Error loading middleware:', error);
  process.exit(1);
}