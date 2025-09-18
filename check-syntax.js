// Check syntax of CompressionService
try {
  console.log('Checking CompressionService syntax...');
  const CompressionService = require('./lib/compression/CompressionService');
  console.log('✓ CompressionService loaded successfully');
  
  const service = new CompressionService();
  console.log('✓ CompressionService instance created successfully');
  
  // Test isCompressed method (synchronous)
  const result = service.isCompressed('test.gz');
  console.log('✓ isCompressed method works:', result);
  
} catch (error) {
  console.error('✗ Error:', error.message);
  console.error(error.stack);
}