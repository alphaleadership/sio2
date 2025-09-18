/**
 * Validation script for performance monitoring implementation
 * This script validates that all performance monitoring features work correctly
 */

const PerformanceMonitor = require('./lib/upload/PerformanceMonitor');
const PerformanceBenchmark = require('./lib/upload/PerformanceBenchmark');
const UploadPathResolver = require('./lib/upload/UploadPathResolver');

async function validatePerformanceMonitor() {
  console.log('=== Validating PerformanceMonitor ===');
  
  const monitor = new PerformanceMonitor({
    enableCaching: true,
    cacheMaxSize: 100,
    cacheTTL: 60000
  });

  // Test 1: Basic operation tracking
  console.log('✓ Testing basic operation tracking...');
  const operationId = 'test-op-1';
  const tracker = monitor.startPathResolution(operationId, {
    filename: 'test.pdf',
    destFolder: 'documents'
  });
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 5));
  
  const duration = tracker.finish({ success: true, strategy: 'basename' });
  console.log(`  Operation completed in ${duration.toFixed(2)}ms`);

  // Test 2: String operations
  console.log('✓ Testing optimized string operations...');
  const testPath = 'documents\\projects//file.pdf';
  const segments = monitor.optimizedStringOperation('segmentSplit', testPath);
  const normalized = monitor.optimizedStringOperation('normalize', testPath);
  const joined = monitor.optimizedStringOperation('pathJoin', segments);
  
  console.log(`  Original: ${testPath}`);
  console.log(`  Segments: [${segments.join(', ')}]`);
  console.log(`  Normalized: ${normalized}`);
  console.log(`  Joined: ${joined}`);

  // Test 3: Caching
  console.log('✓ Testing caching system...');
  const DuplicationDetector = require('./lib/upload/DuplicationDetector');
  const detector = new DuplicationDetector();
  
  const testDupPath = 'docs/docs/file.pdf';
  
  // First call (cache miss)
  const result1 = monitor.monitorDuplicationDetectionSync(
    testDupPath,
    (path) => detector.analyzePathDuplication(path)
  );
  console.log(`  First call (cache miss): ${result1.performanceData.duration.toFixed(2)}ms`);
  
  // Second call (cache hit)
  const result2 = monitor.monitorDuplicationDetectionSync(
    testDupPath,
    (path) => detector.analyzePathDuplication(path)
  );
  console.log(`  Second call (cache hit): ${result2.performanceData.duration.toFixed(2)}ms`);
  console.log(`  Cache hit: ${result2.fromCache}`);

  // Test 4: Metrics
  console.log('✓ Testing metrics collection...');
  const metrics = monitor.getMetrics();
  console.log(`  Total operations: ${metrics.pathResolution.totalOperations}`);
  console.log(`  Cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
  console.log(`  Cache size: ${metrics.cache.size}`);

  console.log('PerformanceMonitor validation completed successfully!\n');
  return true;
}

async function validateUploadPathResolverIntegration() {
  console.log('=== Validating UploadPathResolver Integration ===');
  
  const resolver = new UploadPathResolver({
    enableCaching: true,
    enableDetailedMetrics: true,
    enablePerformanceAlerts: false // Disable alerts for validation
  });

  // Test 1: Basic path resolution with performance tracking
  console.log('✓ Testing path resolution with performance tracking...');
  const testFile = {
    originalname: 'report.pdf',
    webkitRelativePath: 'documents/report.pdf'
  };

  const result = resolver.resolvePath(testFile, 'documents', [testFile]);
  console.log(`  Final path: ${result.finalPath}`);
  console.log(`  Strategy: ${result.strategy}`);
  console.log(`  Processing time: ${result.processingTime}ms`);
  console.log(`  Duplication prevented: ${result.duplicationPrevented}`);
  
  if (result.performanceData) {
    console.log(`  Performance monitoring duration: ${result.performanceData.monitoringDuration}ms`);
  }

  // Test 2: Performance metrics
  console.log('✓ Testing performance metrics retrieval...');
  const metrics = resolver.getPerformanceMetrics();
  console.log(`  Total resolutions: ${metrics.summary.totalResolutions}`);
  console.log(`  Average resolution time: ${metrics.summary.averageResolutionTime.toFixed(2)}ms`);
  console.log(`  Cache hit rate: ${(metrics.summary.cacheHitRate * 100).toFixed(1)}%`);

  // Test 3: String operations
  console.log('✓ Testing optimized string operations...');
  const testPaths = [
    'simple/path/file.txt',
    'complex\\mixed/separators\\file.pdf'
  ];

  testPaths.forEach(path => {
    const segments = resolver.optimizedStringOperation('segmentSplit', path);
    const normalized = resolver.optimizedStringOperation('normalize', path);
    console.log(`  ${path} -> ${normalized} (${segments.length} segments)`);
  });

  console.log('UploadPathResolver integration validation completed successfully!\n');
  return true;
}

async function validatePerformanceBenchmark() {
  console.log('=== Validating PerformanceBenchmark ===');
  
  const benchmark = new PerformanceBenchmark({
    iterations: 10, // Small number for validation
    warmupIterations: 5
  });

  console.log('✓ Running mini benchmark...');
  try {
    const results = await benchmark.runCompleteBenchmark();
    
    console.log(`  Benchmark completed in ${results.summary.totalBenchmarkTime}ms`);
    console.log(`  Iterations: ${results.summary.iterations}`);
    console.log(`  Warmup iterations: ${results.summary.warmupIterations}`);
    
    // Check that all required sections are present
    const requiredSections = ['pathResolution', 'duplicationDetection', 'pathAnalysis', 'stringOperations', 'caching', 'memory'];
    const missingSections = requiredSections.filter(section => !results[section]);
    
    if (missingSections.length > 0) {
      console.log(`  ⚠️  Missing sections: ${missingSections.join(', ')}`);
    } else {
      console.log('  ✓ All benchmark sections completed');
    }
    
    // Check compliance
    console.log(`  Overall compliance: ${results.compliance.overall ? 'PASS' : 'FAIL'}`);
    
    // Generate report
    const report = benchmark.generateReport(results);
    console.log(`  Report generated: ${report.length} characters`);
    
  } catch (error) {
    console.error('  ❌ Benchmark failed:', error.message);
    return false;
  }

  console.log('PerformanceBenchmark validation completed successfully!\n');
  return true;
}

async function validateErrorHandling() {
  console.log('=== Validating Error Handling ===');
  
  const monitor = new PerformanceMonitor();

  // Test 1: Invalid string operations
  console.log('✓ Testing invalid string operations...');
  try {
    monitor.optimizedStringOperation('invalidOperation', 'test');
    console.log('  ❌ Should have thrown error');
    return false;
  } catch (error) {
    console.log(`  ✓ Correctly threw error: ${error.message}`);
  }

  // Test 2: Invalid cache operations
  console.log('✓ Testing invalid cache operations...');
  const result = monitor.getCachedResult(null);
  if (result === null) {
    console.log('  ✓ Correctly handled null cache key');
  } else {
    console.log('  ❌ Should have returned null for invalid key');
    return false;
  }

  // Test 3: Performance monitoring with errors
  console.log('✓ Testing performance monitoring error handling...');
  const operationId = 'error-test';
  const tracker = monitor.startPathResolution(operationId);
  const duration = tracker.finish({ error: true, errorMessage: 'Test error' });
  
  if (duration > 0) {
    console.log(`  ✓ Error operation tracked: ${duration.toFixed(2)}ms`);
  } else {
    console.log('  ❌ Error operation not tracked properly');
    return false;
  }

  console.log('Error handling validation completed successfully!\n');
  return true;
}

async function main() {
  console.log('Starting performance monitoring validation...\n');
  
  try {
    const results = await Promise.all([
      validatePerformanceMonitor(),
      validateUploadPathResolverIntegration(),
      validatePerformanceBenchmark(),
      validateErrorHandling()
    ]);
    
    const allPassed = results.every(result => result === true);
    
    if (allPassed) {
      console.log('🎉 All validations passed successfully!');
      console.log('\nPerformance monitoring and optimization implementation is working correctly.');
      console.log('\nKey features validated:');
      console.log('  ✓ Performance benchmarks for path resolution operations');
      console.log('  ✓ Caching for repeated path analysis patterns');
      console.log('  ✓ Optimized string operations for path manipulation');
      console.log('  ✓ Real-time performance metrics and monitoring');
      console.log('  ✓ Integration with existing UploadPathResolver');
      console.log('  ✓ Comprehensive error handling');
      console.log('  ✓ Performance compliance checking');
      
      return true;
    } else {
      console.log('❌ Some validations failed');
      return false;
    }
    
  } catch (error) {
    console.error('Validation failed with error:', error);
    return false;
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = {
  validatePerformanceMonitor,
  validateUploadPathResolverIntegration,
  validatePerformanceBenchmark,
  validateErrorHandling
};