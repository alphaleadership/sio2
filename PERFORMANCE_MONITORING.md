# Performance Monitoring and Optimization

This document describes the performance monitoring and optimization features implemented for the upload path resolution system.

## Overview

The performance monitoring system provides comprehensive tracking, caching, and optimization for upload path resolution operations. It addresses the requirements for performance benchmarks, caching of repeated patterns, and string operation optimizations.

## Components

### PerformanceMonitor

The main performance monitoring class that provides:

- **Real-time Performance Tracking**: Monitors path resolution operations with detailed timing
- **Intelligent Caching**: Caches repeated path analysis patterns to improve performance
- **String Operation Optimization**: Optimized string operations for path manipulation
- **Performance Metrics**: Comprehensive metrics collection and analysis
- **Performance Alerts**: Configurable alerts for performance threshold violations

#### Key Features

```javascript
const PerformanceMonitor = require('./lib/upload/PerformanceMonitor');

const monitor = new PerformanceMonitor({
  enableCaching: true,
  cacheMaxSize: 1000,
  cacheTTL: 300000, // 5 minutes
  enableAlerts: true,
  performanceThresholds: {
    pathResolution: 10, // ms
    duplicationDetection: 5, // ms
    pathAnalysis: 8, // ms
    stringOperations: 2 // ms
  }
});
```

#### Performance Tracking

```javascript
// Start monitoring an operation
const tracker = monitor.startPathResolution('operation-id', {
  filename: 'document.pdf',
  destFolder: 'documents'
});

// Add sample points during operation
tracker.addSample('analysis_start');
tracker.addSample('duplication_check', { hasDuplication: false });

// Finish monitoring
const duration = tracker.finish({ success: true, strategy: 'basename' });
```

#### Caching System

```javascript
// Monitor with automatic caching
const result = await monitor.monitorDuplicationDetection(
  path,
  (path) => detector.analyzePathDuplication(path)
);

console.log(`Cache hit: ${result.fromCache}`);
console.log(`Duration: ${result.performanceData.duration}ms`);
```

#### Optimized String Operations

```javascript
// Optimized path operations
const segments = monitor.optimizedStringOperation('segmentSplit', 'path/to/file.pdf');
const normalized = monitor.optimizedStringOperation('normalize', 'path\\to//file.pdf');
const joined = monitor.optimizedStringOperation('pathJoin', ['path', 'to', 'file.pdf']);
```

### PerformanceBenchmark

Comprehensive benchmarking suite for measuring and validating performance:

```javascript
const PerformanceBenchmark = require('./lib/upload/PerformanceBenchmark');

const benchmark = new PerformanceBenchmark({
  iterations: 1000,
  warmupIterations: 100,
  performanceTargets: {
    pathResolution: 10, // ms
    duplicationDetection: 5, // ms
    pathAnalysis: 8, // ms
    stringOperations: 2, // ms
    cacheHitRate: 0.8, // 80%
    memoryUsage: 50 * 1024 * 1024 // 50MB
  }
});

const results = await benchmark.runCompleteBenchmark();
console.log(benchmark.generateReport(results));
```

### Enhanced UploadPathResolver

The UploadPathResolver now includes integrated performance monitoring:

```javascript
const UploadPathResolver = require('./lib/upload/UploadPathResolver');

const resolver = new UploadPathResolver({
  enableCaching: true,
  enableDetailedMetrics: true,
  enablePerformanceAlerts: true,
  cacheMaxSize: 1000,
  cacheTTL: 300000
});

// Path resolution with performance tracking
const result = resolver.resolvePath(file, destFolder, allFiles);
console.log(`Processing time: ${result.processingTime}ms`);
console.log(`Performance data:`, result.performanceData);

// Get comprehensive metrics
const metrics = resolver.getPerformanceMetrics();
console.log(`Average resolution time: ${metrics.summary.averageResolutionTime}ms`);
console.log(`Cache hit rate: ${metrics.summary.cacheHitRate * 100}%`);
```

## Performance Metrics

The system tracks comprehensive performance metrics:

### Path Resolution Metrics
- Total operations count
- Average, minimum, maximum resolution times
- 95th and 99th percentile times
- Slow operations count (above threshold)
- Error count and rate

### Duplication Detection Metrics
- Cache hit/miss rates
- Detection times
- Duplications found count
- Error tracking

### Path Analysis Metrics
- Strategy usage distribution
- Upload type distribution
- Analysis times

### String Operations Metrics
- Operation counts by type
- Optimization rates
- Performance improvements

### Cache Metrics
- Hit rate and efficiency
- Cache size and evictions
- Memory usage

## Performance Optimizations

### 1. Intelligent Caching

The system implements multi-level caching:

- **Result Caching**: Caches duplication detection and path analysis results
- **Pattern Caching**: Recognizes and caches common path patterns
- **TTL Management**: Automatic cache expiration and cleanup
- **Size Limits**: Configurable cache size limits with LRU eviction

### 2. String Operation Optimization

Optimized string operations for path manipulation:

- **Pre-compiled Regex**: Uses pre-compiled regex patterns for better performance
- **Operation Caching**: Caches results of expensive string operations
- **Efficient Algorithms**: Optimized algorithms for path splitting, joining, and normalization
- **Memory Efficiency**: Minimizes string allocations and garbage collection

### 3. Performance Monitoring

Real-time performance monitoring with:

- **Threshold Alerts**: Configurable performance threshold monitoring
- **Percentile Tracking**: P95 and P99 performance tracking
- **Trend Analysis**: Historical performance data collection
- **Bottleneck Identification**: Identifies performance bottlenecks in real-time

## Usage Examples

### Basic Performance Monitoring

```javascript
const { UploadPathResolver } = require('./lib/upload');

const resolver = new UploadPathResolver({
  enableCaching: true,
  enableDetailedMetrics: true
});

// Process file with performance tracking
const file = { originalname: 'document.pdf', webkitRelativePath: 'docs/document.pdf' };
const result = resolver.resolvePath(file, 'documents', [file]);

console.log(`Final path: ${result.finalPath}`);
console.log(`Processing time: ${result.processingTime}ms`);
console.log(`Strategy used: ${result.strategy}`);
```

### Performance Benchmarking

```javascript
const { PerformanceBenchmark } = require('./lib/upload');

async function runBenchmark() {
  const benchmark = new PerformanceBenchmark({
    iterations: 1000,
    warmupIterations: 100
  });
  
  const results = await benchmark.runCompleteBenchmark();
  
  console.log('Benchmark Results:');
  console.log(`Path resolution avg: ${results.pathResolution.individual[0].average.toFixed(2)}ms`);
  console.log(`Cache hit rate: ${(results.caching.hitRate * 100).toFixed(1)}%`);
  console.log(`Memory usage: ${(results.memory.peakHeapUsed / 1024 / 1024).toFixed(2)}MB`);
  
  // Generate detailed report
  const report = benchmark.generateReport(results);
  console.log(report);
}
```

### Custom Performance Monitoring

```javascript
const { PerformanceMonitor } = require('./lib/upload');

const monitor = new PerformanceMonitor({
  enableCaching: true,
  performanceThresholds: {
    pathResolution: 5, // Stricter 5ms threshold
    duplicationDetection: 2
  }
});

// Listen for performance alerts
monitor.on('performanceAlert', (alert) => {
  console.warn(`Performance alert: ${alert.type} took ${alert.duration}ms (threshold: ${alert.threshold}ms)`);
});

// Monitor custom operations
const tracker = monitor.startPathResolution('custom-op');
// ... perform operations ...
const duration = tracker.finish({ success: true });
```

## Performance Targets

The system is designed to meet these performance targets:

- **Path Resolution**: < 10ms average
- **Duplication Detection**: < 5ms average
- **Path Analysis**: < 8ms average
- **String Operations**: < 2ms average
- **Cache Hit Rate**: > 80%
- **Memory Usage**: < 50MB peak

## Monitoring and Alerts

The system provides configurable monitoring and alerting:

### Performance Alerts
- Threshold-based alerts for slow operations
- Configurable alert levels and thresholds
- Event-based alert system

### Metrics Collection
- Real-time metrics updates
- Historical performance data
- Exportable metrics for external monitoring

### Health Checks
- Performance compliance checking
- Automated performance regression detection
- Benchmark-based validation

## Integration

The performance monitoring system integrates seamlessly with existing components:

1. **Automatic Integration**: UploadPathResolver automatically uses performance monitoring
2. **Optional Features**: All performance features can be enabled/disabled
3. **Backward Compatibility**: Maintains compatibility with existing code
4. **Minimal Overhead**: Low-overhead monitoring with configurable sampling

## Configuration

Performance monitoring can be configured through options:

```javascript
const options = {
  // Enable/disable features
  enableCaching: true,
  enableDetailedMetrics: true,
  enablePerformanceAlerts: true,
  
  // Cache configuration
  cacheMaxSize: 1000,
  cacheTTL: 300000, // 5 minutes
  
  // Performance thresholds
  performanceThresholds: {
    pathResolution: 10,
    duplicationDetection: 5,
    pathAnalysis: 8,
    stringOperations: 2
  },
  
  // Monitoring configuration
  sampleRate: 1.0, // 100% sampling
  enableDetailedMetrics: true
};
```

## Requirements Addressed

This implementation addresses the following requirements:

- **4.1**: Implement performance benchmarks for path resolution operations
- **4.2**: Add caching for repeated path analysis patterns and optimize string operations

The system provides comprehensive performance monitoring, intelligent caching, and optimized string operations while maintaining backward compatibility and providing extensive configuration options.