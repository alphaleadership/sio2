const { test, describe } = require('node:test');
const assert = require('node:assert');
const PerformanceMonitor = require('../../lib/upload/PerformanceMonitor');
const UploadPathResolver = require('../../lib/upload/UploadPathResolver');
const DuplicationDetector = require('../../lib/upload/DuplicationDetector');

describe('PerformanceMonitor - Simple Tests', () => {
  test('should create PerformanceMonitor instance', () => {
    const monitor = new PerformanceMonitor();
    assert.ok(monitor instanceof PerformanceMonitor);
  });

  test('should track path resolution performance', () => {
    const monitor = new PerformanceMonitor({
      enableCaching: true,
      enableAlerts: false
    });
    
    const operationId = 'test-operation';
    const tracker = monitor.startPathResolution(operationId, {
      filename: 'test.pdf',
      destFolder: 'documents'
    });

    // Simulate some work
    const start = Date.now();
    while (Date.now() - start < 2) {
      // Busy wait for 2ms
    }

    const duration = tracker.finish({ success: true, strategy: 'basename' });
    
    assert.ok(duration > 0, 'Duration should be greater than 0');

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.pathResolution.totalOperations, 1);
    assert.ok(metrics.pathResolution.averageTime > 0);
  });

  test('should perform optimized string operations', () => {
    const monitor = new PerformanceMonitor();
    
    const testPath = 'documents\\projects//file.pdf';
    const segments = monitor.optimizedStringOperation('segmentSplit', testPath);
    const normalized = monitor.optimizedStringOperation('normalize', testPath);
    const joined = monitor.optimizedStringOperation('pathJoin', segments);
    
    assert.deepStrictEqual(segments, ['documents', 'projects', 'file.pdf']);
    assert.strictEqual(normalized, 'documents/projects/file.pdf');
    assert.strictEqual(joined, 'documents/projects/file.pdf');
  });

  test('should handle caching for duplication detection', () => {
    const monitor = new PerformanceMonitor({
      enableCaching: true
    });
    const detector = new DuplicationDetector();
    const testPath = 'documents/documents/file.pdf';

    // First call - cache miss
    const result1 = monitor.monitorDuplicationDetectionSync(
      testPath,
      (path) => detector.analyzePathDuplication(path)
    );

    assert.strictEqual(result1.fromCache, false);
    assert.strictEqual(result1.hasDuplication, true);
    assert.ok(result1.performanceData.duration > 0);

    // Second call - cache hit
    const result2 = monitor.monitorDuplicationDetectionSync(
      testPath,
      (path) => detector.analyzePathDuplication(path)
    );

    assert.strictEqual(result2.fromCache, true);
    assert.strictEqual(result2.hasDuplication, true);
    assert.strictEqual(result2.performanceData.cacheHit, true);

    const metrics = monitor.getMetrics();
    assert.strictEqual(metrics.cache.hits, 1);
    assert.strictEqual(metrics.cache.misses, 1);
  });

  test('should integrate with UploadPathResolver', () => {
    const resolver = new UploadPathResolver({
      enableCaching: true,
      enableDetailedMetrics: true
    });

    const testFile = {
      originalname: 'test.pdf',
      webkitRelativePath: 'documents/test.pdf'
    };

    const result = resolver.resolvePath(testFile, 'documents', [testFile]);
    
    assert.ok(result.finalPath);
    assert.ok(result.strategy);
    assert.ok(result.processingTime >= 0);
    assert.ok(result.performanceData);
    assert.ok(result.performanceData.monitoringDuration >= 0);

    const metrics = resolver.getPerformanceMetrics();
    assert.ok(metrics.enhanced);
    assert.ok(metrics.summary);
    assert.strictEqual(metrics.summary.totalResolutions, 1);
  });

  test('should handle errors gracefully', () => {
    const monitor = new PerformanceMonitor();
    
    // Test invalid string operation
    assert.throws(() => {
      monitor.optimizedStringOperation('invalidOperation', 'test');
    }, /Unknown string operation/);

    // Test invalid cache operations
    const result = monitor.getCachedResult(null);
    assert.strictEqual(result, null);
  });

  test('should reset metrics correctly', () => {
    const monitor = new PerformanceMonitor();
    
    // Generate some metrics
    const tracker = monitor.startPathResolution('reset-test');
    tracker.finish({ success: true });

    let metrics = monitor.getMetrics();
    assert.strictEqual(metrics.pathResolution.totalOperations, 1);

    monitor.resetMetrics();

    metrics = monitor.getMetrics();
    assert.strictEqual(metrics.pathResolution.totalOperations, 0);
    assert.strictEqual(metrics.cache.size, 0);
  });
});

describe('PerformanceBenchmark - Simple Tests', () => {
  test('should create PerformanceBenchmark instance', () => {
    const benchmark = new (require('../../lib/upload/PerformanceBenchmark'))({
      iterations: 5,
      warmupIterations: 2
    });
    assert.ok(benchmark);
  });

  test('should have required methods', () => {
    const PerformanceBenchmark = require('../../lib/upload/PerformanceBenchmark');
    const benchmark = new PerformanceBenchmark({
      iterations: 5,
      warmupIterations: 2
    });
    
    assert.ok(typeof benchmark.runCompleteBenchmark === 'function');
    assert.ok(typeof benchmark.generateReport === 'function');
  });
});