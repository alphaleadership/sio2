const PerformanceMonitor = require('./PerformanceMonitor');
const UploadPathResolver = require('./UploadPathResolver');
const DuplicationDetector = require('./DuplicationDetector');
const PathAnalysisEngine = require('./PathAnalysisEngine');

/**
 * PerformanceBenchmark - Comprehensive benchmarking suite for upload path resolution
 * 
 * This class provides standardized benchmarks to measure and validate
 * performance improvements in path resolution operations.
 * 
 * Requirements addressed: 4.1, 4.2
 */
class PerformanceBenchmark {
    constructor(options = {}) {
        this.options = {
            iterations: options.iterations || 1000,
            warmupIterations: options.warmupIterations || 100,
            enableProfiling: options.enableProfiling || false,
            testDataSets: options.testDataSets || this.getDefaultTestDataSets(),
            performanceTargets: options.performanceTargets || {
                pathResolution: 10, // ms
                duplicationDetection: 5, // ms
                pathAnalysis: 8, // ms
                stringOperations: 2, // ms
                cacheHitRate: 0.8, // 80%
                memoryUsage: 50 * 1024 * 1024 // 50MB
            }
        };

        this.performanceMonitor = new PerformanceMonitor({
            enableCaching: true,
            enableDetailedMetrics: true,
            enableAlerts: false // Disable alerts during benchmarking
        });

        this.results = {
            pathResolution: [],
            duplicationDetection: [],
            pathAnalysis: [],
            stringOperations: [],
            caching: [],
            memory: []
        };
    }

    /**
     * Runs complete benchmark suite
     * @returns {Object} Comprehensive benchmark results
     */
    async runCompleteBenchmark() {
        console.log('Starting comprehensive performance benchmark...');

        const startTime = Date.now();
        const initialMemory = process.memoryUsage();

        try {
            // Warmup phase
            await this.runWarmup();

            // Core benchmarks
            const pathResolutionResults = await this.benchmarkPathResolution();
            const duplicationDetectionResults = await this.benchmarkDuplicationDetection();
            const pathAnalysisResults = await this.benchmarkPathAnalysis();
            const stringOperationsResults = await this.benchmarkStringOperations();
            const cachingResults = await this.benchmarkCaching();
            const memoryResults = await this.benchmarkMemoryUsage();

            // Compile results
            const totalTime = Date.now() - startTime;
            const finalMemory = process.memoryUsage();

            const results = {
                summary: {
                    totalBenchmarkTime: totalTime,
                    iterations: this.options.iterations,
                    warmupIterations: this.options.warmupIterations,
                    timestamp: new Date().toISOString()
                },
                pathResolution: pathResolutionResults,
                duplicationDetection: duplicationDetectionResults,
                pathAnalysis: pathAnalysisResults,
                stringOperations: stringOperationsResults,
                caching: cachingResults,
                memory: memoryResults,
                performanceTargets: this.options.performanceTargets,
                compliance: this.checkPerformanceCompliance({
                    pathResolution: pathResolutionResults,
                    duplicationDetection: duplicationDetectionResults,
                    pathAnalysis: pathAnalysisResults,
                    stringOperations: stringOperationsResults,
                    caching: cachingResults,
                    memory: memoryResults
                }),
                memoryDelta: {
                    heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                    heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
                    external: finalMemory.external - initialMemory.external,
                    rss: finalMemory.rss - initialMemory.rss
                }
            };

            console.log('Benchmark completed successfully');
            return results;

        } catch (error) {
            console.error('Benchmark failed:', error);
            throw error;
        }
    }

    /**
     * Runs warmup iterations to stabilize performance
     * @private
     */
    async runWarmup() {
        console.log(`Running ${this.options.warmupIterations} warmup iterations...`);

        const resolver = new UploadPathResolver();
        const testData = this.options.testDataSets.individual[0];

        for (let i = 0; i < this.options.warmupIterations; i++) {
            resolver.resolvePath(testData.file, testData.destFolder, [testData.file]);
        }

        // Clear metrics after warmup
        this.performanceMonitor.resetMetrics();
    }

    /**
     * Benchmarks path resolution operations
     * @private
     */
    async benchmarkPathResolution() {
        console.log('Benchmarking path resolution operations...');

        const resolver = new UploadPathResolver();
        const results = {
            individual: [],
            folder: [],
            mixed: []
        };

        // Test individual file uploads
        for (const testCase of this.options.testDataSets.individual) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                resolver.resolvePath(testCase.file, testCase.destFolder, [testCase.file]);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000); // Convert to ms
            }

            results.individual.push({
                testCase: testCase.name,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times),
                p95: this.calculatePercentile(times, 0.95),
                p99: this.calculatePercentile(times, 0.99)
            });
        }

        // Test folder uploads
        for (const testCase of this.options.testDataSets.folder) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();

                for (const file of testCase.files) {
                    resolver.resolvePath(file, testCase.destFolder, testCase.files);
                }

                const endTime = process.hrtime.bigint();
                times.push(Number(endTime - startTime) / 1000000);
            }

            results.folder.push({
                testCase: testCase.name,
                fileCount: testCase.files.length,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times),
                p95: this.calculatePercentile(times, 0.95),
                p99: this.calculatePercentile(times, 0.99)
            });
        }

        return results;
    }

    /**
     * Benchmarks duplication detection operations
     * @private
     */
    async benchmarkDuplicationDetection() {
        console.log('Benchmarking duplication detection operations...');

        const detector = new DuplicationDetector();
        const results = {
            consecutive: [],
            userPattern: [],
            noDuplication: []
        };

        // Test consecutive duplicates
        const consecutivePaths = [
            'documents/documents/file.pdf',
            'users/john/users/john/data.txt',
            'projects/myapp/projects/myapp/src/index.js'
        ];

        for (const testPath of consecutivePaths) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                detector.analyzePathDuplication(testPath);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.consecutive.push({
                path: testPath,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times)
            });
        }

        // Test user pattern duplicates
        const userPatternPaths = [
            'users/alice/documents/users/alice/reports/file.pdf',
            'teams/dev/projects/teams/dev/src/app.js'
        ];

        for (const testPath of userPatternPaths) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                detector.analyzePathDuplication(testPath);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.userPattern.push({
                path: testPath,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times)
            });
        }

        // Test paths without duplication
        const cleanPaths = [
            'documents/reports/quarterly.pdf',
            'projects/webapp/src/components/Header.js',
            'users/bob/images/vacation/beach.jpg'
        ];

        for (const testPath of cleanPaths) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                detector.analyzePathDuplication(testPath);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.noDuplication.push({
                path: testPath,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times)
            });
        }

        return results;
    }

    /**
     * Benchmarks path analysis operations
     * @private
     */
    async benchmarkPathAnalysis() {
        console.log('Benchmarking path analysis operations...');

        const engine = new PathAnalysisEngine();
        const results = [];

        for (const testCase of [...this.options.testDataSets.individual, ...this.options.testDataSets.folder]) {
            const times = [];
            const files = testCase.files || [testCase.file];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                engine.analyzeUploadContext(files, testCase.destFolder);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.push({
                testCase: testCase.name,
                fileCount: files.length,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length,
                min: Math.min(...times),
                max: Math.max(...times),
                p95: this.calculatePercentile(times, 0.95)
            });
        }

        return results;
    }

    /**
     * Benchmarks string operations
     * @private
     */
    async benchmarkStringOperations() {
        console.log('Benchmarking string operations...');

        const results = {
            segmentSplit: [],
            pathJoin: [],
            normalize: []
        };

        const testPaths = [
            'simple/path/file.txt',
            'complex\\mixed/separators\\with/file.pdf',
            'very/long/path/with/many/segments/and/deep/nesting/structure/file.js',
            'path/with/../relative/./segments/file.html'
        ];

        // Test segment splitting
        for (const testPath of testPaths) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                this.performanceMonitor.optimizedStringOperation('segmentSplit', testPath);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.segmentSplit.push({
                path: testPath,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length
            });
        }

        // Test path joining
        const testSegments = [
            ['simple', 'path'],
            ['complex', 'path', 'with', 'many', 'segments'],
            ['path', 'with', 'empty', '', 'segments'],
            ['single']
        ];

        for (const segments of testSegments) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                this.performanceMonitor.optimizedStringOperation('pathJoin', segments);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.pathJoin.push({
                segments: segments.join('/'),
                segmentCount: segments.length,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length
            });
        }

        // Test normalization
        for (const testPath of testPaths) {
            const times = [];

            for (let i = 0; i < this.options.iterations; i++) {
                const startTime = process.hrtime.bigint();
                this.performanceMonitor.optimizedStringOperation('normalize', testPath);
                const endTime = process.hrtime.bigint();

                times.push(Number(endTime - startTime) / 1000000);
            }

            results.normalize.push({
                path: testPath,
                times,
                average: times.reduce((a, b) => a + b, 0) / times.length
            });
        }

        return results;
    }

    /**
     * Benchmarks caching performance
     * @private
     */
    async benchmarkCaching() {
        console.log('Benchmarking caching performance...');

        const detector = new DuplicationDetector();
        const testPaths = [
            'documents/documents/file1.pdf',
            'documents/documents/file2.pdf',
            'users/john/users/john/data.txt',
            'projects/app/projects/app/src/index.js'
        ];

        const results = {
            coldCache: [],
            warmCache: [],
            hitRate: 0
        };

        // Test cold cache performance
        this.performanceMonitor.clearCache();

        for (const testPath of testPaths) {
            const startTime = process.hrtime.bigint();
            await this.performanceMonitor.monitorDuplicationDetection(testPath,
                (path) => detector.analyzePathDuplication(path));
            const endTime = process.hrtime.bigint();

            results.coldCache.push({
                path: testPath,
                time: Number(endTime - startTime) / 1000000
            });
        }

        // Test warm cache performance (repeat same operations)
        for (const testPath of testPaths) {
            const startTime = process.hrtime.bigint();
            await this.performanceMonitor.monitorDuplicationDetection(testPath,
                (path) => detector.analyzePathDuplication(path));
            const endTime = process.hrtime.bigint();

            results.warmCache.push({
                path: testPath,
                time: Number(endTime - startTime) / 1000000
            });
        }

        // Calculate cache hit rate
        const metrics = this.performanceMonitor.getMetrics();
        results.hitRate = metrics.cache.hitRate;
        results.cacheSize = metrics.cache.size;
        results.totalHits = metrics.cache.hits;
        results.totalMisses = metrics.cache.misses;

        return results;
    }

    /**
     * Benchmarks memory usage
     * @private
     */
    async benchmarkMemoryUsage() {
        console.log('Benchmarking memory usage...');

        const initialMemory = process.memoryUsage();
        const resolver = new UploadPathResolver();
        const memorySnapshots = [];

        // Perform operations and track memory
        for (let i = 0; i < this.options.iterations; i++) {
            // Perform various operations
            for (const testCase of this.options.testDataSets.individual) {
                resolver.resolvePath(testCase.file, testCase.destFolder, [testCase.file]);
            }

            // Take memory snapshot every 100 iterations
            if (i % 100 === 0) {
                const currentMemory = process.memoryUsage();
                memorySnapshots.push({
                    iteration: i,
                    heapUsed: currentMemory.heapUsed,
                    heapTotal: currentMemory.heapTotal,
                    external: currentMemory.external,
                    rss: currentMemory.rss
                });
            }
        }

        const finalMemory = process.memoryUsage();

        return {
            initial: initialMemory,
            final: finalMemory,
            snapshots: memorySnapshots,
            delta: {
                heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
                external: finalMemory.external - initialMemory.external,
                rss: finalMemory.rss - initialMemory.rss
            },
            peakHeapUsed: Math.max(...memorySnapshots.map(s => s.heapUsed)),
            averageHeapUsed: memorySnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / memorySnapshots.length
        };
    }

    /**
     * Checks performance compliance against targets
     * @private
     */
    checkPerformanceCompliance(results) {
        const compliance = {
            pathResolution: true,
            duplicationDetection: true,
            pathAnalysis: true,
            stringOperations: true,
            caching: true,
            memory: true,
            overall: true
        };

        // Check path resolution compliance
        const pathResolutionAvg = this.calculateOverallAverage(results.pathResolution.individual);
        if (pathResolutionAvg > this.options.performanceTargets.pathResolution) {
            compliance.pathResolution = false;
            compliance.overall = false;
        }

        // Check duplication detection compliance
        const duplicationAvg = this.calculateOverallAverage(results.duplicationDetection.consecutive);
        if (duplicationAvg > this.options.performanceTargets.duplicationDetection) {
            compliance.duplicationDetection = false;
            compliance.overall = false;
        }

        // Check path analysis compliance
        const analysisAvg = this.calculateOverallAverage(results.pathAnalysis);
        if (analysisAvg > this.options.performanceTargets.pathAnalysis) {
            compliance.pathAnalysis = false;
            compliance.overall = false;
        }

        // Check string operations compliance
        const stringOpsAvg = this.calculateOverallAverage(results.stringOperations.segmentSplit);
        if (stringOpsAvg > this.options.performanceTargets.stringOperations) {
            compliance.stringOperations = false;
            compliance.overall = false;
        }

        // Check caching compliance
        if (results.caching.hitRate < this.options.performanceTargets.cacheHitRate) {
            compliance.caching = false;
            compliance.overall = false;
        }

        // Check memory compliance
        if (results.memory.peakHeapUsed > this.options.performanceTargets.memoryUsage) {
            compliance.memory = false;
            compliance.overall = false;
        }

        return compliance;
    }

    /**
     * Calculates percentile from array of values
     * @private
     */
    calculatePercentile(values, percentile) {
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.floor(sorted.length * percentile);
        return sorted[index] || 0;
    }

    /**
     * Calculates overall average from benchmark results
     * @private
     */
    calculateOverallAverage(results) {
        if (!Array.isArray(results) || results.length === 0) return 0;

        const allAverages = results.map(r => r.average || 0);
        return allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length;
    }

    /**
     * Gets default test data sets
     * @private
     */
    getDefaultTestDataSets() {
        return {
            individual: [
                {
                    name: 'Simple individual file',
                    file: { originalname: 'document.pdf', webkitRelativePath: '' },
                    destFolder: 'documents'
                },
                {
                    name: 'Individual file with problematic webkit path',
                    file: { originalname: 'report.pdf', webkitRelativePath: 'documents/report.pdf' },
                    destFolder: 'documents'
                },
                {
                    name: 'Individual file with deep webkit path',
                    file: { originalname: 'data.json', webkitRelativePath: 'users/john/documents/data.json' },
                    destFolder: 'users/john/documents'
                }
            ],
            folder: [
                {
                    name: 'Small folder upload',
                    destFolder: 'projects',
                    files: [
                        { originalname: 'index.html', webkitRelativePath: 'website/index.html' },
                        { originalname: 'style.css', webkitRelativePath: 'website/css/style.css' },
                        { originalname: 'app.js', webkitRelativePath: 'website/js/app.js' }
                    ]
                },
                {
                    name: 'Large folder upload',
                    destFolder: 'projects',
                    files: Array.from({ length: 50 }, (_, i) => ({
                        originalname: `file${i}.txt`,
                        webkitRelativePath: `large-project/src/components/file${i}.txt`
                    }))
                }
            ]
        };
    }

    /**
     * Generates performance report
     * @param {Object} results - Benchmark results
     * @returns {string} Formatted report
     */
    generateReport(results) {
        let report = '\n=== UPLOAD PATH RESOLUTION PERFORMANCE BENCHMARK REPORT ===\n\n';

        report += `Benchmark completed: ${results.summary.timestamp}\n`;
        report += `Total benchmark time: ${results.summary.totalBenchmarkTime}ms\n`;
        report += `Iterations per test: ${results.summary.iterations}\n`;
        report += `Warmup iterations: ${results.summary.warmupIterations}\n\n`;

        // Path Resolution Results
        report += '--- PATH RESOLUTION PERFORMANCE ---\n';
        results.pathResolution.individual.forEach(result => {
            report += `${result.testCase}: avg=${result.average.toFixed(2)}ms, p95=${result.p95.toFixed(2)}ms, p99=${result.p99.toFixed(2)}ms\n`;
        });

        // Duplication Detection Results
        report += '\n--- DUPLICATION DETECTION PERFORMANCE ---\n';
        results.duplicationDetection.consecutive.forEach(result => {
            report += `${result.path}: avg=${result.average.toFixed(2)}ms\n`;
        });

        // Caching Results
        report += '\n--- CACHING PERFORMANCE ---\n';
        report += `Cache hit rate: ${(results.caching.hitRate * 100).toFixed(1)}%\n`;
        report += `Cache size: ${results.caching.cacheSize} entries\n`;

        // Memory Results
        report += '\n--- MEMORY USAGE ---\n';
        report += `Peak heap used: ${(results.memory.peakHeapUsed / 1024 / 1024).toFixed(2)}MB\n`;
        report += `Memory delta: ${(results.memory.delta.heapUsed / 1024 / 1024).toFixed(2)}MB\n`;

        // Compliance Results
        report += '\n--- PERFORMANCE COMPLIANCE ---\n';
        report += `Overall compliance: ${results.compliance.overall ? 'PASS' : 'FAIL'}\n`;
        report += `Path resolution: ${results.compliance.pathResolution ? 'PASS' : 'FAIL'}\n`;
        report += `Duplication detection: ${results.compliance.duplicationDetection ? 'PASS' : 'FAIL'}\n`;
        report += `Caching: ${results.compliance.caching ? 'PASS' : 'FAIL'}\n`;
        report += `Memory usage: ${results.compliance.memory ? 'PASS' : 'FAIL'}\n`;

        report += '\n=== END REPORT ===\n';

        return report;
    }
}

module.exports = PerformanceBenchmark;