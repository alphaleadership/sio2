/**
 * Simple test to verify the performance monitoring syntax fix
 */

try {
  // Test basic require statements
  console.log('Testing require statements...');
  
  const PerformanceMonitor = require('./lib/upload/PerformanceMonitor');
  console.log('✓ PerformanceMonitor loaded successfully');
  
  const UploadPathResolver = require('./lib/upload/UploadPathResolver');
  console.log('✓ UploadPathResolver loaded successfully');
  
  const PerformanceBenchmark = require('./lib/upload/PerformanceBenchmark');
  console.log('✓ PerformanceBenchmark loaded successfully');
  
  // Test basic instantiation
  console.log('\nTesting basic instantiation...');
  
  const monitor = new PerformanceMonitor();
  console.log('✓ PerformanceMonitor instantiated successfully');
  
  const resolver = new UploadPathResolver();
  console.log('✓ UploadPathResolver instantiated successfully');
  
  // Test basic functionality
  console.log('\nTesting basic functionality...');
  
  const testFile = {
    originalname: 'test.pdf',
    webkitRelativePath: 'documents/test.pdf'
  };
  
  const result = resolver.resolvePath(testFile, 'documents', [testFile]);
  console.log('✓ Path resolution completed successfully');
  console.log(`  Final path: ${result.finalPath}`);
  console.log(`  Strategy: ${result.strategy}`);
  console.log(`  Processing time: ${result.processingTime}ms`);
  
  if (result.performanceData) {
    console.log(`  Performance monitoring duration: ${result.performanceData.monitoringDuration}ms`);
  }
  
  // Test performance metrics
  const metrics = resolver.getPerformanceMetrics();
  console.log('✓ Performance metrics retrieved successfully');
  console.log(`  Total resolutions: ${metrics.summary.totalResolutions}`);
  console.log(`  Average resolution time: ${metrics.summary.averageResolutionTime.toFixed(2)}ms`);
  
  // Test string operations
  console.log('\nTesting optimized string operations...');
  
  const testPath = 'documents\\projects//file.pdf';
  const segments = resolver.optimizedStringOperation('segmentSplit', testPath);
  const normalized = resolver.optimizedStringOperation('normalize', testPath);
  
  console.log('✓ String operations completed successfully');
  console.log(`  Original: ${testPath}`);
  console.log(`  Segments: [${segments.join(', ')}]`);
  console.log(`  Normalized: ${normalized}`);
  
  console.log('\n🎉 All tests passed! Performance monitoring is working correctly.');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}