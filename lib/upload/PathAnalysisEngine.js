const path = require('path');

/**
 * PathAnalysisEngine - Analyzes upload requests to determine the correct path construction strategy
 * 
 * This class implements intelligent upload type detection to distinguish between:
 * - Individual file uploads (that should use basename strategy)
 * - Legitimate folder uploads (that should preserve webkit path structure)
 * 
 * Requirements addressed: 2.1, 2.2, 2.3
 */
class PathAnalysisEngine {
  constructor() {
    this.logger = console; // Can be injected for testing
  }

  /**
   * Analyzes upload context and determines path construction strategy
   * @param {Array} files - Multer files array
   * @param {string} destFolder - Destination folder path
   * @returns {Object} Analysis result with strategy recommendations
   */
  analyzeUploadContext(files, destFolder) {
    const startTime = Date.now();
    
    try {
      // Input validation
      if (!destFolder || typeof destFolder !== 'string') {
        throw new Error('Invalid destination folder provided');
      }

      if (!files || !Array.isArray(files)) {
        throw new Error('Files must be provided as an array');
      }

      if (files.length === 0) {
        return this._createAnalysisResult('individual', 'basename', 1.0, [], 
          'No files provided - defaulting to individual upload');
      }

      // Validate file objects
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file || !file.originalname) {
          throw new Error(`File at index ${i} is invalid or missing originalname`);
        }
      }

      const analysis = this._performDetailedAnalysis(files, destFolder);
      const processingTime = Date.now() - startTime;
      
      this.logger.debug(`PathAnalysisEngine: Analysis completed in ${processingTime}ms`, {
        uploadType: analysis.uploadType,
        strategy: analysis.strategy,
        confidence: analysis.confidence,
        fileCount: files.length
      });

      return analysis;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error(`PathAnalysisEngine: Analysis failed in ${processingTime}ms`, {
        error: error.message,
        fileCount: files ? files.length : 0,
        destFolder: destFolder
      });

      // Return safe fallback analysis result
      return this._createAnalysisResult('individual', 'basename', 0.1, 
        [`Analysis error: ${error.message}`], 
        `Analysis failed, using safe fallback: ${error.message}`);
    }
  }

  /**
   * Performs detailed analysis of the upload context
   * @private
   */
  _performDetailedAnalysis(files, destFolder) {
    const fileCount = files.length;
    const filesWithWebkitPath = files.filter(f => f.webkitRelativePath);
    const webkitPathPatterns = this._extractWebkitPathPatterns(filesWithWebkitPath);
    
    // Single file analysis
    if (fileCount === 1) {
      return this._analyzeSingleFileUpload(files[0], destFolder, webkitPathPatterns);
    }

    // Multiple files analysis
    return this._analyzeMultipleFileUpload(files, destFolder, webkitPathPatterns);
  }

  /**
   * Analyzes single file upload scenarios
   * @private
   */
  _analyzeSingleFileUpload(file, destFolder, webkitPathPatterns) {
    const warnings = [];
    
    // If no webkitRelativePath or empty, it's definitely an individual file
    if (!file.webkitRelativePath || file.webkitRelativePath.trim() === '') {
      return this._createAnalysisResult('individual', 'basename', 1.0, warnings,
        'Single file without webkitRelativePath - individual upload');
    }

    // Check if webkitRelativePath indicates folder structure
    const webkitSegments = this._getPathSegments(file.webkitRelativePath);
    const destSegments = this._getPathSegments(destFolder);
    
    // If webkitRelativePath only contains the filename, it's an individual file
    if (webkitSegments.length === 1) {
      return this._createAnalysisResult('individual', 'basename', 0.95, warnings,
        'Single file with webkitRelativePath containing only filename');
    }

    // If webkitRelativePath is just the filename (same as originalname), use basename
    if (webkitSegments.length === 1 && webkitSegments[0] === file.originalname) {
      return this._createAnalysisResult('individual', 'basename', 1.0, warnings,
        'webkitRelativePath matches originalname - individual upload');
    }

    // Check for potential duplication patterns
    const hasPotentialDuplication = this._detectPotentialDuplication(destSegments, webkitSegments);
    if (hasPotentialDuplication) {
      warnings.push('Potential path duplication detected in webkitRelativePath');
      return this._createAnalysisResult('individual', 'basename', 0.9, warnings,
        'Single file with suspicious webkitRelativePath pattern - likely individual upload');
    }

    // Additional safety check: if webkit path seems invalid, use basename
    if (!this._isValidWebkitPath(file.webkitRelativePath)) {
      warnings.push('Invalid webkitRelativePath detected');
      return this._createAnalysisResult('individual', 'basename', 0.8, warnings,
        'Invalid webkitRelativePath - using basename fallback');
    }

    // If webkitRelativePath has multiple segments but no duplication, 
    // it could be a legitimate single-file folder upload
    const confidence = this._calculateSingleFileConfidence(webkitSegments, destSegments);
    
    // Be more conservative: only use webkit_path if confidence is very high
    const strategy = confidence > 0.8 ? 'webkit_path' : 'basename';
    const uploadType = confidence > 0.8 ? 'folder' : 'individual';
    
    return this._createAnalysisResult(uploadType, strategy, confidence, warnings,
      `Single file with ${webkitSegments.length} webkit path segments - confidence: ${confidence}`);
  }

  /**
   * Analyzes multiple file upload scenarios
   * @private
   */
  _analyzeMultipleFileUpload(files, destFolder, webkitPathPatterns) {
    const warnings = [];
    const filesWithWebkitPath = files.filter(f => f.webkitRelativePath && f.webkitRelativePath.trim() !== '');
    const filesWithValidWebkitPath = filesWithWebkitPath.filter(f => this._isValidWebkitPath(f.webkitRelativePath));
    
    // If no files have valid webkitRelativePath, it's individual files
    if (filesWithValidWebkitPath.length === 0) {
      if (filesWithWebkitPath.length > 0) {
        warnings.push('Files have webkitRelativePath but they appear invalid');
      }
      return this._createAnalysisResult('individual', 'basename', 1.0, warnings,
        'Multiple files without valid webkitRelativePath - individual uploads');
    }

    // If only a small percentage of files have valid webkit paths, treat as individual
    const validWebkitRatio = filesWithValidWebkitPath.length / files.length;
    if (validWebkitRatio < 0.5) {
      warnings.push('Less than 50% of files have valid webkitRelativePath');
      return this._createAnalysisResult('individual', 'basename', 0.9, warnings,
        'Majority of files lack valid webkitRelativePath - treating as individual uploads');
    }

    // Analyze webkit path patterns for folder structure indicators
    const validWebkitPatterns = this._extractWebkitPathPatterns(filesWithValidWebkitPath);
    const folderStructureIndicators = this._analyzeFolderStructureIndicators(validWebkitPatterns);
    
    // If all files share common folder structure, likely a folder upload
    if (folderStructureIndicators.hasCommonStructure) {
      const confidence = this._calculateFolderUploadConfidence(folderStructureIndicators, files);
      
      // Be more conservative: only use webkit_path if confidence is very high
      const strategy = confidence > 0.8 ? 'webkit_path' : 'basename';
      const uploadType = confidence > 0.8 ? 'folder' : 'individual';
      
      return this._createAnalysisResult(uploadType, strategy, confidence, warnings,
        `Multiple files with common folder structure - confidence: ${confidence}`);
    }

    // Mixed scenario - use basename for safety
    warnings.push('Mixed upload patterns detected - using basename for safety');
    return this._createAnalysisResult('individual', 'basename', 0.7, warnings,
      'Multiple files with mixed webkit path patterns - using basename fallback');
  }

  /**
   * Extracts webkit path patterns from files
   * @private
   */
  _extractWebkitPathPatterns(filesWithWebkitPath) {
    return filesWithWebkitPath.map(file => ({
      originalname: file.originalname,
      webkitRelativePath: file.webkitRelativePath,
      segments: this._getPathSegments(file.webkitRelativePath),
      depth: this._getPathSegments(file.webkitRelativePath).length
    }));
  }

  /**
   * Gets path segments from a path string
   * @private
   */
  _getPathSegments(pathString) {
    if (!pathString) return [];
    return pathString.split(/[/\\]/).filter(segment => segment.length > 0);
  }

  /**
   * Detects potential duplication between destination and webkit paths
   * @private
   */
  _detectPotentialDuplication(destSegments, webkitSegments) {
    // Check if any destination segments appear in webkit path
    for (const destSegment of destSegments) {
      if (webkitSegments.includes(destSegment)) {
        return true;
      }
    }
    
    // Check for consecutive duplicates within webkit path
    for (let i = 0; i < webkitSegments.length - 1; i++) {
      if (webkitSegments[i] === webkitSegments[i + 1]) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Calculates confidence for single file upload classification
   * @private
   */
  _calculateSingleFileConfidence(webkitSegments, destSegments) {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence if webkit path has meaningful folder structure
    if (webkitSegments.length > 2) {
      confidence += 0.2;
    }
    
    // Lower confidence if webkit segments match destination segments
    const hasMatchingSegments = webkitSegments.some(seg => destSegments.includes(seg));
    if (hasMatchingSegments) {
      confidence -= 0.3;
    }
    
    // Higher confidence if webkit path looks like a real folder structure
    const hasRealisticStructure = this._hasRealisticFolderStructure(webkitSegments);
    if (hasRealisticStructure) {
      confidence += 0.2;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  /**
   * Analyzes folder structure indicators in webkit paths
   * @private
   */
  _analyzeFolderStructureIndicators(webkitPathPatterns) {
    if (webkitPathPatterns.length === 0) {
      return { hasCommonStructure: false, commonPrefix: '', avgDepth: 0 };
    }

    // Find common prefix among all webkit paths
    const commonPrefix = this._findCommonPrefix(webkitPathPatterns.map(p => p.webkitRelativePath));
    
    // Calculate average depth
    const avgDepth = webkitPathPatterns.reduce((sum, p) => sum + p.depth, 0) / webkitPathPatterns.length;
    
    // Check if there's a meaningful common structure
    const hasCommonStructure = commonPrefix.length > 0 && avgDepth > 1.5;
    
    return {
      hasCommonStructure,
      commonPrefix,
      avgDepth,
      maxDepth: Math.max(...webkitPathPatterns.map(p => p.depth)),
      minDepth: Math.min(...webkitPathPatterns.map(p => p.depth))
    };
  }

  /**
   * Calculates confidence for folder upload classification
   * @private
   */
  _calculateFolderUploadConfidence(indicators, files) {
    let confidence = 0.7; // Base confidence for folder uploads
    
    // Higher confidence with deeper folder structures
    if (indicators.avgDepth > 2) {
      confidence += 0.1;
    }
    
    // Higher confidence with consistent depth
    const depthVariance = indicators.maxDepth - indicators.minDepth;
    if (depthVariance <= 1) {
      confidence += 0.1;
    }
    
    // Higher confidence with more files
    if (files.length > 3) {
      confidence += 0.05;
    }
    
    return Math.min(0.95, confidence);
  }

  /**
   * Checks if webkit segments represent a realistic folder structure
   * @private
   */
  _hasRealisticFolderStructure(segments) {
    // Avoid single-character folder names (often indicates duplication)
    const hasShortSegments = segments.some(seg => seg.length <= 2);
    if (hasShortSegments) return false;
    
    // Look for common folder patterns
    const commonFolderNames = ['src', 'lib', 'assets', 'images', 'docs', 'components', 'pages'];
    const hasCommonPatterns = segments.some(seg => 
      commonFolderNames.includes(seg.toLowerCase())
    );
    
    return hasCommonPatterns || segments.length >= 2;
  }

  /**
   * Finds common prefix among paths
   * @private
   */
  _findCommonPrefix(paths) {
    if (paths.length === 0) return '';
    if (paths.length === 1) return path.dirname(paths[0]);
    
    let commonPrefix = paths[0];
    for (let i = 1; i < paths.length; i++) {
      commonPrefix = this._getCommonPrefix(commonPrefix, paths[i]);
      if (commonPrefix.length === 0) break;
    }
    
    return commonPrefix;
  }

  /**
   * Gets common prefix between two paths
   * @private
   */
  _getCommonPrefix(path1, path2) {
    const segments1 = this._getPathSegments(path1);
    const segments2 = this._getPathSegments(path2);
    
    const commonSegments = [];
    const minLength = Math.min(segments1.length, segments2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (segments1[i] === segments2[i]) {
        commonSegments.push(segments1[i]);
      } else {
        break;
      }
    }
    
    return commonSegments.join('/');
  }

  /**
   * Validates if a webkit path is valid and safe to use
   * @private
   */
  _isValidWebkitPath(webkitPath) {
    if (!webkitPath || typeof webkitPath !== 'string') {
      return false;
    }

    // Check for security issues
    if (webkitPath.includes('..') || webkitPath.includes('\\')) {
      return false;
    }

    // Check for empty or whitespace-only path
    if (webkitPath.trim() === '') {
      return false;
    }

    // Check for paths that are just the filename
    const segments = this._getPathSegments(webkitPath);
    if (segments.length === 0) {
      return false;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /^[a-f0-9]{32}$/, // MD5 hash-like
      /^[a-f0-9]{40}$/, // SHA1 hash-like
      /^tmp_/, // Temporary file prefix
      /^temp_/, // Temporary file prefix
    ];

    for (const segment of segments) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(segment)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Creates standardized analysis result object
   * @private
   */
  _createAnalysisResult(uploadType, strategy, confidence, warnings, reasoning) {
    return {
      uploadType,
      strategy,
      confidence: Math.round(confidence * 100) / 100, // Round to 2 decimal places
      warnings: [...warnings],
      reasoning,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = PathAnalysisEngine;