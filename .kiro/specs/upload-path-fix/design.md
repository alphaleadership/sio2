# Design Document

## Overview

The upload path fix addresses a critical bug where individual file uploads with `webkitRelativePath` create duplicate folder structures. The current system incorrectly classifies individual files as folder uploads when browsers set `webkitRelativePath`, leading to paths like `documents/documents/rapport.pdf` instead of the expected `documents/rapport.pdf`.

The solution implements intelligent path duplication detection and improved folder upload classification to ensure correct file placement while maintaining backward compatibility with existing functionality.

## Architecture

### Current System Analysis

The current upload logic in `FileStorageMiddleware.js` has the following flow:

1. **Folder Detection**: `isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'))`
2. **Path Construction**: Uses `webkitRelativePath` when `isFolderUpload` is true
3. **Problem**: Individual files with `webkitRelativePath` are incorrectly classified as folder uploads

### Proposed Architecture

```
Upload Request
     ↓
Path Analysis Engine
     ↓
┌─────────────────────┐
│ Duplication Detector │
├─────────────────────┤
│ - Segment Analysis  │
│ - Pattern Detection │
│ - User Path Validation │
└─────────────────────┘
     ↓
Path Construction Strategy
     ↓
┌──────────────┬──────────────┐
│ Individual   │ Folder       │
│ File Upload  │ Upload       │
│ (basename)   │ (full path)  │
└──────────────┴──────────────┘
     ↓
File Storage
```

## Components and Interfaces

### 1. PathAnalysisEngine

**Purpose**: Analyzes upload requests to determine the correct path construction strategy.

```javascript
class PathAnalysisEngine {
  /**
   * Analyzes upload context and determines path construction strategy
   * @param {Array} files - Multer files array
   * @param {string} destFolder - Destination folder path
   * @returns {Object} Analysis result with strategy recommendations
   */
  analyzeUploadContext(files, destFolder) {
    return {
      uploadType: 'individual' | 'folder',
      strategy: 'basename' | 'webkit_path' | 'smart_path',
      confidence: 0.0-1.0,
      warnings: []
    };
  }
}
```

### 2. DuplicationDetector

**Purpose**: Detects potential path duplications before they occur.

```javascript
class DuplicationDetector {
  /**
   * Detects consecutive duplicate segments in a path
   * @param {string} fullPath - Complete file path to analyze
   * @returns {Object} Detection result
   */
  detectConsecutiveDuplicates(fullPath) {
    return {
      hasDuplication: boolean,
      duplicatedSegments: [],
      suggestedPath: string
    };
  }

  /**
   * Detects user pattern duplications (e.g., /users/john/users/john/)
   * @param {string} fullPath - Complete file path to analyze
   * @returns {Object} Detection result
   */
  detectUserPatternDuplication(fullPath) {
    return {
      hasUserDuplication: boolean,
      duplicatedPattern: string,
      suggestedPath: string
    };
  }
}
```

### 3. PathConstructionStrategy

**Purpose**: Implements different strategies for constructing file paths.

```javascript
class PathConstructionStrategy {
  /**
   * Constructs path using basename strategy (individual files)
   * @param {string} destFolder - Destination folder
   * @param {Object} file - File object
   * @returns {string} Constructed path
   */
  constructBasename(destFolder, file) {
    return path.join(destFolder, path.basename(file.originalname));
  }

  /**
   * Constructs path using webkit path strategy (folder uploads)
   * @param {string} destFolder - Destination folder
   * @param {Object} file - File object
   * @returns {string} Constructed path
   */
  constructWebkitPath(destFolder, file) {
    return path.join(destFolder, file.webkitRelativePath);
  }

  /**
   * Constructs path using smart strategy (anti-duplication)
   * @param {string} destFolder - Destination folder
   * @param {Object} file - File object
   * @returns {string} Constructed path
   */
  constructSmartPath(destFolder, file) {
    // Implement intelligent path construction with duplication prevention
  }
}
```

### 4. UploadPathResolver

**Purpose**: Main orchestrator that coordinates all components.

```javascript
class UploadPathResolver {
  constructor(pathAnalysisEngine, duplicationDetector, pathConstructionStrategy) {
    this.pathAnalysisEngine = pathAnalysisEngine;
    this.duplicationDetector = duplicationDetector;
    this.pathConstructionStrategy = pathConstructionStrategy;
  }

  /**
   * Resolves the correct path for a file upload
   * @param {Object} file - File object from multer
   * @param {string} destFolder - Destination folder
   * @param {Array} allFiles - All files in the upload batch
   * @returns {Object} Resolution result
   */
  resolvePath(file, destFolder, allFiles) {
    return {
      finalPath: string,
      strategy: string,
      reasoning: string,
      warnings: []
    };
  }
}
```

## Data Models

### UploadAnalysis

```javascript
{
  uploadType: 'individual' | 'folder',
  fileCount: number,
  hasWebkitRelativePath: boolean,
  webkitPathPatterns: string[],
  confidence: number,
  warnings: string[]
}
```

### DuplicationResult

```javascript
{
  hasDuplication: boolean,
  duplicationType: 'consecutive' | 'user_pattern' | 'custom',
  duplicatedSegments: string[],
  originalPath: string,
  suggestedPath: string,
  confidence: number
}
```

### PathResolution

```javascript
{
  originalFile: Object,
  finalPath: string,
  strategy: 'basename' | 'webkit_path' | 'smart_path',
  reasoning: string,
  duplicationPrevented: boolean,
  warnings: string[],
  processingTime: number
}
```

## Error Handling

### 1. Graceful Fallback Strategy

- **Primary Strategy**: Smart path construction with duplication detection
- **Fallback 1**: Basename strategy for individual files
- **Fallback 2**: Original webkit path for legitimate folder uploads
- **Last Resort**: Timestamp-based unique naming

### 2. Error Categories

```javascript
const ErrorTypes = {
  PATH_DUPLICATION: 'Path duplication detected',
  INVALID_WEBKIT_PATH: 'Invalid webkitRelativePath format',
  SECURITY_VIOLATION: 'Path traversal attempt detected',
  FILESYSTEM_ERROR: 'Filesystem operation failed'
};
```

### 3. Error Recovery

- Log all path construction decisions for debugging
- Provide detailed error messages with suggested corrections
- Maintain audit trail of path modifications
- Implement retry logic for transient filesystem errors

## Testing Strategy

### 1. Unit Tests

- **PathAnalysisEngine**: Test upload type detection accuracy
- **DuplicationDetector**: Test various duplication patterns
- **PathConstructionStrategy**: Test each strategy independently
- **UploadPathResolver**: Test integration scenarios

### 2. Integration Tests

- **End-to-End Upload Flows**: Test complete upload scenarios
- **Edge Case Handling**: Test problematic webkitRelativePath values
- **Backward Compatibility**: Ensure existing functionality works
- **Performance Testing**: Measure path resolution performance

### 3. Test Scenarios

```javascript
const TestScenarios = [
  {
    name: 'Individual file with problematic webkitRelativePath',
    input: {
      bodyPath: 'documents',
      files: [{
        originalname: 'rapport.pdf',
        webkitRelativePath: 'documents/rapport.pdf'
      }]
    },
    expected: 'documents/rapport.pdf'
  },
  {
    name: 'Legitimate folder upload',
    input: {
      bodyPath: 'projects',
      files: [{
        originalname: 'index.html',
        webkitRelativePath: 'my-site/pages/index.html'
      }]
    },
    expected: 'projects/my-site/pages/index.html'
  },
  {
    name: 'Multiple level duplication',
    input: {
      bodyPath: 'docs',
      files: [{
        originalname: 'file.txt',
        webkitRelativePath: 'docs/docs/file.txt'
      }]
    },
    expected: 'docs/file.txt'
  }
];
```

### 4. Performance Benchmarks

- Path analysis should complete in < 1ms per file
- Duplication detection should handle paths up to 260 characters
- Memory usage should remain constant regardless of upload size
- Support concurrent uploads without performance degradation

## Implementation Notes

### 1. Backward Compatibility

- Existing upload functionality must remain unchanged
- No breaking changes to API endpoints
- Preserve existing file organization for current users
- Maintain compatibility with compression middleware

### 2. Security Considerations

- Validate all path components for directory traversal attempts
- Sanitize webkitRelativePath values before processing
- Implement path length limits to prevent buffer overflow
- Log suspicious path construction attempts

### 3. Performance Optimizations

- Cache path analysis results for similar upload patterns
- Use efficient string operations for path manipulation
- Minimize filesystem operations during path construction
- Implement lazy evaluation for expensive operations

### 4. Logging and Monitoring

- Log all path construction decisions with reasoning
- Track duplication detection accuracy over time
- Monitor upload success rates after implementation
- Provide debugging information for troubleshooting