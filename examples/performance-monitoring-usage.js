const UploadPathResolver = require('../lib/upload/UploadPathResolver');
const PerformanceBenchmark = require('../lib/upload/PerformanceBenchmark');

/**
 * Example demonstrating performance monitoring and optimization features
 * for the upload path resolution system.
 */

async function demonstratePerformanceMonitoring() {
  console.log('=== Upload Path Resolution Performance Monitoring Demo ===\n');

  // Create resolver with performance monitoring enabled
  const resolver = new UploadPathResolver({
    enableCaching: true,
    enableDetailedMetrics: true,
    enablePerformanceAlerts: true,
    cacheMaxSize: 500,
    cacheTTL: 300000 // 5 minutes
  });

  console.log('1. Basic Path Resolution with Performance Tracking');
  console.log('------------------------------------------------');

  // Test individual file upload
  const individualFile = {
    originalname: 'report.pdf',
    webkitRelativePath: 'documents/report.pdf'
  };

  const result1 = resolver.resolvePath(individualFile, 'documents', [individualFile]);
  console.log('Individual file result:', {
    finalPath: result1.finalPath,
    strategy: result1.strategy,
    duplicationPrevented: result1.duplicationPrevented,
    processingTime: result1.processingTime,
    performanceData: result1.performanceData
  });

  // Test folder upload
  const folderFiles = [
    { originalname: 'index.html', webkitRelativePath: 'my-website/index.html' },
    { originalname: 'style.css', webkitRelativePath: 'my-website/css/style.css' },
    { originalname: 'app.js', webkitRelativePath: 'my-website/js/app.js' }
  ];

  console.log('\n2. Folder Upload with Performance Tracking');
  console.log('------------------------------------------');

  const results = folderFiles.map(file => 
    resolver.resolvePath(file, 'projects', folderFiles)
  );

  results.forEach((result, index) => {
    console.log(`File ${index + 1}:`, {
      finalPath: result.finalPath,
      strategy: result.strategy,
      processingTime: result.processingTime
    });
  });

  console.log('\n3. Performance Metrics');
  console.log('---------------------');

  const metrics = resolver.getPerformanceMetrics();
  console.log('Summary metrics:', {
    totalResolutions: metrics.summary.totalResolutions,
    averageResolutionTime: `${metrics.summary.averageResolutionTime.toFixed(2)}ms`,
    p95ResolutionTime: `${metrics.summary.p95ResolutionTime.toFixed(2)}ms`,
    cacheHitRate: `${(metrics.summary.cacheHitRate * 100).toFixed(1)}%`,
    cacheSize: metrics.summary.cacheSize,
    errorRate: `${(metrics.summary.errorRate * 100).toFixed(1)}%`
  });

  console.log('\n4. String Operations Optimization');
  console.log('---------------------------------');

  // Demonstrate optimized string operations
  const testPaths = [
    'documents\\projects//file.pdf',
    'users/john/documents/data.txt',
    'complex/path/with/many/segments/file.js'
  ];

  testPaths.forEach(testPath => {
    const segments = resolver.optimizedStringOperation('segmentSplit', testPath);
    const normalized = resolver.optimizedStringOperation('normalize', testPath);
    const rejoined = resolver.optimizedStringOperation('pathJoin', segments);
    
    console.log(`Original: ${testPath}`);
    console.log(`Segments: [${segments.join(', ')}]`);
    console.log(`Normalized: ${normalized}`);
    console.log(`Rejoined: ${rejoined}\n`);
  });

  console.log('5. Cache Performance Demonstration');
  console.log('----------------------------------');

  // Test cache performance with repeated operations
  const testFile = {
    originalname: 'cached-test.pdf',
    webkitRelativePath: 'documents/documents/cached-test.pdf'
  };

  console.log('First resolution (cache miss):');
  const start1 = Date.now();
  const cachedResult1 = resolver.resolvePath(testFile, 'documents', [testFile]);
  const time1 = Date.now() - start1;
  console.log(`Time: ${time1}ms, Strategy: ${cachedResult1.strategy}`);

  console.log('Second resolution (cache hit):');
  const start2 = Date.now();
  const cachedResult2 = resolver.resolvePath(testFile, 'documents', [testFile]);
  const time2 = Date.now() - start2;
  console.log(`Time: ${time2}ms, Strategy: ${cachedResult2.strategy}`);
  console.log(`Performance improvement: ${((time1 - time2) / time1 * 100).toFixed(1)}%`);

  console.log('\n6. Performance History');
  console.log('---------------------');

  const history = resolver.getPerformanceHistory(5);
  console.log(`Recent operations (last ${history.length}):`);
  history.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.type}: ${entry.duration.toFixed(2)}ms`);
  });

  return resolver;
}

async function runPerformanceBenchmark() {
  console.log('\n=== Performance Benchmark ===\n');

  const benchmark = new PerformanceBenchmark({
    iterations: 100,
    warmupIterations: 20
  });

  console.log('Running comprehensive performance benchmark...');
  console.log('This may take a few moments...\n');

  try {
    const results = await benchmark.runCompleteBenchmark();
    
    console.log('Benchmark Results:');
    console.log('==================');
    
    console.log(`Total benchmark time: ${results.summary.totalBenchmarkTime}ms`);
    console.log(`Iterations: ${results.summary.iterations}`);
    console.log(`Warmup iterations: ${results.summary.warmupIterations}\n`);

    // Path resolution performance
    console.log('Path Resolution Performance:');
    if (results.pathResolution.individual.length > 0) {
      const avgTime = results.pathResolution.individual[0].average;
      const p95Time = results.pathResolution.individual[0].p95;
      console.log(`  Average time: ${avgTime.toFixed(2)}ms`);
      console.log(`  95th percentile: ${p95Time.toFixed(2)}ms`);
    }

    // Caching performance
    console.log('\nCaching Performance:');
    console.log(`  Hit rate: ${(results.caching.hitRate * 100).toFixed(1)}%`);
    console.log(`  Cache size: ${results.caching.cacheSize} entries`);

    // Memory usage
    console.log('\nMemory Usage:');
    console.log(`  Peak heap: ${(results.memory.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Memory delta: ${(results.memory.delta.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    // Compliance
    console.log('\nPerformance Compliance:');
    console.log(`  Overall: ${results.compliance.overall ? 'PASS' : 'FAIL'}`);
    console.log(`  Path resolution: ${results.compliance.pathResolution ? 'PASS' : 'FAIL'}`);
    console.log(`  Duplication detection: ${results.compliance.duplicationDetection ? 'PASS' : 'FAIL'}`);
    console.log(`  Caching: ${results.compliance.caching ? 'PASS' : 'FAIL'}`);
    console.log(`  Memory usage: ${results.compliance.memory ? 'PASS' : 'FAIL'}`);

    // Generate and display report
    console.log('\n=== Detailed Report ===');
    const report = benchmark.generateReport(results);
    console.log(report);

    return results;
  } catch (error) {
    console.error('Benchmark failed:', error);
    throw error;
  }
}

async function demonstratePerformanceOptimizations() {
  console.log('\n=== Performance Optimizations Demo ===\n');

  const resolver = new UploadPathResolver({
    enableCaching: true,
    enableDetailedMetrics: true
  });

  console.log('1. Testing Performance with Different File Scenarios');
  console.log('---------------------------------------------------');

  const scenarios = [
    {
      name: 'Simple individual file',
      file: { originalname: 'simple.pdf', webkitRelativePath: '' },
      destFolder: 'documents'
    },
    {
      name: 'Individual file with duplication',
      file: { originalname: 'dup.pdf', webkitRelativePath: 'docs/docs/dup.pdf' },
      destFolder: 'docs'
    },
    {
      name: 'Complex folder structure',
      file: { originalname: 'component.js', webkitRelativePath: 'project/src/components/ui/component.js' },
      destFolder: 'projects'
    },
    {
      name: 'Deep nested path',
      file: { originalname: 'deep.txt', webkitRelativePath: 'a/b/c/d/e/f/g/h/i/j/deep.txt' },
      destFolder: 'storage'
    }
  ];

  scenarios.forEach((scenario, index) => {
    console.log(`\nScenario ${index + 1}: ${scenario.name}`);
    
    const start = process.hrtime.bigint();
    const result = resolver.resolvePath(scenario.file, scenario.destFolder, [scenario.file]);
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    
    console.log(`  Result: ${result.finalPath}`);
    console.log(`  Strategy: ${result.strategy}`);
    console.log(`  Duplication prevented: ${result.duplicationPrevented}`);
    console.log(`  Processing time: ${duration.toFixed(3)}ms`);
  });

  console.log('\n2. Cache Effectiveness Test');
  console.log('---------------------------');

  const testFile = {
    originalname: 'cache-test.pdf',
    webkitRelativePath: 'cache/cache/test.pdf'
  };

  // Clear cache first
  resolver.clearPerformanceCache();

  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = process.hrtime.bigint();
    resolver.resolvePath(testFile, 'cache', [testFile]);
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000;
    times.push(duration);
    
    console.log(`Iteration ${i + 1}: ${duration.toFixed(3)}ms`);
  }

  const metrics = resolver.getPerformanceMetrics();
  console.log(`Cache hit rate: ${(metrics.summary.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`Average time improvement: ${((times[0] - times[times.length - 1]) / times[0] * 100).toFixed(1)}%`);

  console.log('\n3. String Operations Performance');
  console.log('--------------------------------');

  const stringTests = [
    'simple/path',
    'complex\\mixed/separators\\with/many/segments',
    'very/long/path/with/many/segments/and/deep/nesting/structure/that/goes/on/and/on',
    'path/with/../relative/./segments/and//double//slashes'
  ];

  stringTests.forEach((testPath, index) => {
    console.log(`\nString test ${index + 1}: ${testPath.substring(0, 50)}${testPath.length > 50 ? '...' : ''}`);
    
    // Test segment splitting
    const splitStart = process.hrtime.bigint();
    const segments = resolver.optimizedStringOperation('segmentSplit', testPath);
    const splitEnd = process.hrtime.bigint();
    const splitTime = Number(splitEnd - splitStart) / 1000000;
    
    // Test normalization
    const normalizeStart = process.hrtime.bigint();
    const normalized = resolver.optimizedStringOperation('normalize', testPath);
    const normalizeEnd = process.hrtime.bigint();
    const normalizeTime = Number(normalizeEnd - normalizeStart) / 1000000;
    
    // Test joining
    const joinStart = process.hrtime.bigint();
    const joined = resolver.optimizedStringOperation('pathJoin', segments);
    const joinEnd = process.hrtime.bigint();
    const joinTime = Number(joinEnd - joinStart) / 1000000;
    
    console.log(`  Split (${segments.length} segments): ${splitTime.toFixed(3)}ms`);
    console.log(`  Normalize: ${normalizeTime.toFixed(3)}ms`);
    console.log(`  Join: ${joinTime.toFixed(3)}ms`);
    console.log(`  Result: ${normalized}`);
  });

  return resolver;
}

// Main execution
async function main() {
  try {
    console.log('Starting performance monitoring demonstration...\n');
    
    // Run basic performance monitoring demo
    const resolver = await demonstratePerformanceMonitoring();
    
    // Run performance optimizations demo
    await demonstratePerformanceOptimizations();
    
    // Run comprehensive benchmark
    await runPerformanceBenchmark();
    
    console.log('\n=== Demo Complete ===');
    console.log('Performance monitoring and optimization features demonstrated successfully!');
    
  } catch (error) {
    console.error('Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = {
  demonstratePerformanceMonitoring,
  runPerformanceBenchmark,
  demonstratePerformanceOptimizations
};