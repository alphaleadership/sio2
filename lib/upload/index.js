/**
 * Upload Path Analysis Module
 * 
 * This module provides components for analyzing and fixing upload path duplications
 * in file upload systems. It addresses issues where webkitRelativePath creates
 * duplicate folder structures for individual file uploads.
 */

const DuplicationDetector = require('./DuplicationDetector');
const PathAnalysisEngine = require('./PathAnalysisEngine');
const PathConstructionStrategy = require('./PathConstructionStrategy');
const UploadPathResolver = require('./UploadPathResolver');
const ErrorHandler = require('./ErrorHandler');
const PerformanceMonitor = require('./PerformanceMonitor');
const PerformanceBenchmark = require('./PerformanceBenchmark');

module.exports = {
  DuplicationDetector,
  PathAnalysisEngine,
  PathConstructionStrategy,
  UploadPathResolver,
  ErrorHandler,
  PerformanceMonitor,
  PerformanceBenchmark
};