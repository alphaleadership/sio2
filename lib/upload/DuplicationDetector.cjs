const path = require('path');

/**
 * DuplicationDetector - Detects potential path duplications in file upload paths
 * 
 * This class implements algorithms to detect consecutive duplicate segments
 * and user pattern duplications in file paths to prevent incorrect folder
 * structure creation during uploads.
 */
class DuplicationDetector {
  /**
   * Detects consecutive duplicate segments in a path
   * @param {string} fullPath - Complete file path to analyze
   * @returns {Object} Detection result with duplication info and suggested path
   */
  detectConsecutiveDuplicates(fullPath) {
    if (!fullPath || typeof fullPath !== 'string') {
      return {
        hasDuplication: false,
        duplicatedSegments: [],
        suggestedPath: fullPath || ''
      };
    }

    // Normalize path separators and split into segments
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(segment => segment.length > 0);
    
    const duplicatedSegments = [];
    const cleanedSegments = [];
    
    for (let i = 0; i < segments.length; i++) {
      const currentSegment = segments[i];
      const previousSegment = segments[i - 1];
      
      // Check if current segment is identical to previous segment
      if (i > 0 && currentSegment === previousSegment) {
        duplicatedSegments.push(currentSegment);
        // Skip adding the duplicate segment
        continue;
      }
      
      cleanedSegments.push(currentSegment);
    }
    
    const hasDuplication = duplicatedSegments.length > 0;
    const suggestedPath = cleanedSegments.join('/');
    
    return {
      hasDuplication,
      duplicatedSegments,
      suggestedPath
    };
  }

  /**
   * Detects user pattern duplications (e.g., /users/john/users/john/)
   * @param {string} fullPath - Complete file path to analyze
   * @returns {Object} Detection result with pattern info and suggested path
   */
  detectUserPatternDuplication(fullPath) {
    if (!fullPath || typeof fullPath !== 'string') {
      return {
        hasUserDuplication: false,
        duplicatedPattern: '',
        suggestedPath: fullPath || ''
      };
    }

    // Normalize path separators and split into segments
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(segment => segment.length > 0);
    
    if (segments.length < 4) {
      // Need at least 4 segments to have a meaningful user pattern duplication
      return {
        hasUserDuplication: false,
        duplicatedPattern: '',
        suggestedPath: normalizedPath
      };
    }
    
    // Look for patterns like: /users/username/users/username/
    // or /folder/subfolder/folder/subfolder/
    for (let i = 0; i < segments.length - 1; i++) {
      for (let j = i + 2; j < segments.length - 1; j++) {
        // Check if we have a pattern where segments[i] === segments[j] 
        // and segments[i+1] === segments[j+1]
        if (segments[i] === segments[j] && segments[i + 1] === segments[j + 1]) {
          const duplicatedPattern = `${segments[i]}/${segments[i + 1]}`;
          
          // Create suggested path by removing the duplicate pattern
          const cleanedSegments = [
            ...segments.slice(0, j),
            ...segments.slice(j + 2)
          ];
          
          return {
            hasUserDuplication: true,
            duplicatedPattern,
            suggestedPath: cleanedSegments.join('/')
          };
        }
      }
    }
    
    return {
      hasUserDuplication: false,
      duplicatedPattern: '',
      suggestedPath: normalizedPath
    };
  }

  /**
   * Comprehensive duplication analysis combining all detection methods
   * @param {string} fullPath - Complete file path to analyze
   * @returns {Object} Complete analysis result
   */
  analyzePathDuplication(fullPath) {
    try {
      // Input validation
      if (!fullPath || typeof fullPath !== 'string') {
        throw new Error('Invalid path provided for duplication analysis');
      }

      if (fullPath.length > 260) {
        throw new Error('Path too long for duplication analysis');
      }

      const consecutiveResult = this.detectConsecutiveDuplicates(fullPath);
      const userPatternResult = this.detectUserPatternDuplication(fullPath);
      
      // If consecutive duplicates are found, prioritize that fix
      if (consecutiveResult.hasDuplication) {
        return {
          hasDuplication: true,
          duplicationType: 'consecutive',
          duplicatedSegments: consecutiveResult.duplicatedSegments,
          duplicatedPattern: '',
          originalPath: fullPath,
          suggestedPath: consecutiveResult.suggestedPath,
          confidence: 0.95
        };
      }
      
      // Check for user pattern duplications
      if (userPatternResult.hasUserDuplication) {
        return {
          hasDuplication: true,
          duplicationType: 'user_pattern',
          duplicatedSegments: [],
          duplicatedPattern: userPatternResult.duplicatedPattern,
          originalPath: fullPath,
          suggestedPath: userPatternResult.suggestedPath,
          confidence: 0.85
        };
      }
      
      // No duplication detected
      return {
        hasDuplication: false,
        duplicationType: 'none',
        duplicatedSegments: [],
        duplicatedPattern: '',
        originalPath: fullPath,
        suggestedPath: fullPath,
        confidence: 1.0
      };
    } catch (error) {
      // Return safe result on error
      return {
        hasDuplication: false,
        duplicationType: 'error',
        duplicatedSegments: [],
        duplicatedPattern: '',
        originalPath: fullPath || '',
        suggestedPath: fullPath || '',
        confidence: 0.0,
        error: error.message
      };
    }
  }
}

module.exports = DuplicationDetector;