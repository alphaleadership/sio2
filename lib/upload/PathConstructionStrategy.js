const path = require('path');

/**
 * PathConstructionStrategy - Implements different strategies for constructing file paths
 * Provides basename, webkit, and smart path construction methods with validation and sanitization
 */
class PathConstructionStrategy {
  constructor() {
    // Maximum path length to prevent filesystem issues
    this.MAX_PATH_LENGTH = 260;
    // Forbidden characters in file paths
    this.FORBIDDEN_CHARS = /[<>:"|?*\x00-\x1f]/g;
    // Reserved Windows filenames
    this.RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
  }

  /**
   * Constructs path using basename strategy (individual files)
   * Ignores webkitRelativePath and uses only the filename
   * @param {string} destFolder - Destination folder
   * @param {Object} file - File object with originalname property
   * @returns {string} Constructed path using basename
   */
  constructBasename(destFolder, file) {
    try {
      if (!file || !file.originalname) {
        throw new Error('File object or originalname is missing');
      }

      const sanitizedDestFolder = this._sanitizePath(destFolder);
      if (!sanitizedDestFolder) {
        throw new Error('Invalid destination folder after sanitization');
      }

      const filename = this._sanitizeFilename(path.basename(file.originalname));
      
      // If filename becomes empty after sanitization, throw error for proper handling
      if (!filename || filename === 'unnamed_file') {
        throw new Error(`Filename could not be sanitized: ${file.originalname}`);
      }
      
      const constructedPath = path.join(sanitizedDestFolder, filename);
      
      if (!this._validatePath(constructedPath)) {
        throw new Error(`Constructed path failed validation: ${constructedPath}`);
      }
      
      return constructedPath;
    } catch (error) {
      // Re-throw with more context for error handler
      throw new Error(`Basename construction failed: ${error.message}`);
    }
  }

  /**
   * Constructs path using webkit path strategy (folder uploads)
   * Uses the full webkitRelativePath to preserve folder structure
   * @param {string} destFolder - Destination folder
   * @param {Object} file - File object with webkitRelativePath property
   * @returns {string} Constructed path using webkit relative path
   */
  constructWebkitPath(destFolder, file) {
    try {
      if (!file.webkitRelativePath) {
        throw new Error('webkitRelativePath is missing, cannot use webkit strategy');
      }

      // Check for security issues before sanitization
      if (this._hasSecurityIssues(file.webkitRelativePath)) {
        throw new Error(`Security violation in webkitRelativePath: ${file.webkitRelativePath}`);
      }

      const sanitizedDestFolder = this._sanitizePath(destFolder);
      if (!sanitizedDestFolder) {
        throw new Error('Invalid destination folder after sanitization');
      }

      const sanitizedWebkitPath = this._sanitizePath(file.webkitRelativePath);
      if (!sanitizedWebkitPath) {
        throw new Error(`webkitRelativePath could not be sanitized: ${file.webkitRelativePath}`);
      }
      
      const constructedPath = path.join(sanitizedDestFolder, sanitizedWebkitPath);
      
      if (!this._validatePath(constructedPath)) {
        throw new Error(`Webkit path failed validation: ${constructedPath}`);
      }
      
      return constructedPath;
    } catch (error) {
      // Re-throw with more context for error handler
      throw new Error(`Webkit path construction failed: ${error.message}`);
    }
  }

  /**
   * Constructs path using smart strategy (anti-duplication)
   * Analyzes the path for potential duplications and applies intelligent construction
   * @param {string} destFolder - Destination folder
   * @param {Object} file - File object
   * @returns {string} Constructed path with duplication prevention
   */
  constructSmartPath(destFolder, file) {
    try {
      // If no webkitRelativePath, delegate to basename strategy
      if (!file.webkitRelativePath) {
        throw new Error('webkitRelativePath is missing, cannot use smart strategy');
      }

      // Check for security issues before processing
      if (this._hasSecurityIssues(file.webkitRelativePath)) {
        throw new Error(`Security violation in webkitRelativePath for smart strategy: ${file.webkitRelativePath}`);
      }

      const sanitizedDestFolder = this._sanitizePath(destFolder);
      if (!sanitizedDestFolder) {
        throw new Error('Invalid destination folder after sanitization');
      }

      const sanitizedWebkitPath = this._sanitizePath(file.webkitRelativePath);
      if (!sanitizedWebkitPath) {
        throw new Error(`webkitRelativePath could not be sanitized: ${file.webkitRelativePath}`);
      }
      
      // Check if webkitRelativePath starts with the destination folder name
      const destFolderName = path.basename(sanitizedDestFolder);
      const webkitSegments = sanitizedWebkitPath.split(path.sep).filter(s => s.length > 0);
      
      // If first segment of webkit path matches destination folder, it's likely duplication
      if (webkitSegments.length > 0 && webkitSegments[0] === destFolderName) {
        // Remove the duplicated segment and use the rest
        const remainingSegments = webkitSegments.slice(1);
        if (remainingSegments.length > 0) {
          const remainingPath = remainingSegments.join(path.sep);
          const constructedPath = path.join(sanitizedDestFolder, remainingPath);
          if (this._validatePath(constructedPath)) {
            return constructedPath;
          } else {
            throw new Error(`Smart path with duplication removal failed validation: ${constructedPath}`);
          }
        } else {
          throw new Error('Smart path duplication removal resulted in empty path');
        }
      }
      
      // No duplication detected, delegate to webkit path strategy
      try {
        return this.constructWebkitPath(destFolder, file);
      } catch (webkitError) {
        throw new Error(`Smart path fallback to webkit failed: ${webkitError.message}`);
      }
    } catch (error) {
      // Re-throw with more context for error handler
      throw new Error(`Smart path construction failed: ${error.message}`);
    }
  }

  /**
   * Checks for security issues in a path before processing
   * @param {string} inputPath - Path to check
   * @returns {boolean} True if path has security issues
   * @private
   */
  _hasSecurityIssues(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return false;
    }

    // Check for directory traversal attempts
    if (inputPath.includes('..') || inputPath.includes('./') || inputPath.includes('.\\')) {
      return true;
    }

    // Check for absolute paths (security risk)
    if (path.isAbsolute(inputPath)) {
      return true;
    }

    // Check path length
    if (inputPath.length > this.MAX_PATH_LENGTH) {
      return true;
    }

    return false;
  }

  /**
   * Validates a constructed path for security and filesystem compatibility
   * @param {string} filePath - Path to validate
   * @returns {boolean} True if path is valid
   * @private
   */
  _validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    // Check path length
    if (filePath.length > this.MAX_PATH_LENGTH) {
      return false;
    }

    // Check for directory traversal attempts
    if (filePath.includes('..') || filePath.includes('./') || filePath.includes('.\\')) {
      return false;
    }

    // Check for absolute paths (security risk)
    if (path.isAbsolute(filePath)) {
      return false;
    }

    // Validate each path segment
    const segments = filePath.split(path.sep);
    for (const segment of segments) {
      if (!this._validatePathSegment(segment)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates an individual path segment
   * @param {string} segment - Path segment to validate
   * @returns {boolean} True if segment is valid
   * @private
   */
  _validatePathSegment(segment) {
    if (!segment || segment.trim() === '') {
      return false;
    }

    // Check for forbidden characters
    if (this.FORBIDDEN_CHARS.test(segment)) {
      return false;
    }

    // Check for reserved names
    if (this.RESERVED_NAMES.test(segment)) {
      return false;
    }

    // Check for segments that are only dots or spaces
    if (/^[.\s]+$/.test(segment)) {
      return false;
    }

    return true;
  }

  /**
   * Sanitizes a path by removing or replacing invalid characters
   * @param {string} inputPath - Path to sanitize
   * @returns {string} Sanitized path
   * @private
   */
  _sanitizePath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
      return '';
    }

    // Normalize path separators
    let sanitized = inputPath.replace(/[/\\]+/g, path.sep);
    
    // Remove leading/trailing whitespace and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
    
    // Split into segments and sanitize each
    const segments = sanitized.split(path.sep)
      .map(segment => this._sanitizePathSegment(segment))
      .filter(segment => segment.length > 0);
    
    return segments.join(path.sep);
  }

  /**
   * Sanitizes a single path segment
   * @param {string} segment - Path segment to sanitize
   * @returns {string} Sanitized segment
   * @private
   */
  _sanitizePathSegment(segment) {
    if (!segment || typeof segment !== 'string') {
      return '';
    }

    // Remove forbidden characters
    let sanitized = segment.replace(this.FORBIDDEN_CHARS, '');
    
    // Remove leading/trailing whitespace and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
    
    // Handle reserved names
    if (this.RESERVED_NAMES.test(sanitized)) {
      sanitized = `file_${sanitized}`;
    }
    
    // Ensure segment is not empty
    if (!sanitized) {
      sanitized = 'unnamed_file';
    }
    
    return sanitized;
  }

  /**
   * Sanitizes a filename by removing or replacing invalid characters
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   * @private
   */
  _sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      return 'unnamed_file';
    }

    // Remove forbidden characters (replace with single underscore, then collapse multiple underscores)
    let sanitized = filename.replace(this.FORBIDDEN_CHARS, '_').replace(/_+/g, '_');
    
    // Remove leading/trailing whitespace and dots
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
    
    // Handle reserved names (check the base name without extension)
    const ext = path.extname(sanitized);
    const baseName = path.basename(sanitized, ext);
    if (this.RESERVED_NAMES.test(baseName)) {
      sanitized = `file_${sanitized}`;
    }
    
    // Ensure filename is not empty
    if (!sanitized) {
      sanitized = 'unnamed_file';
    }
    
    // Limit filename length (keeping extension)
    if (sanitized.length > 100) {
      const extension = path.extname(sanitized);
      const name = path.basename(sanitized, extension);
      sanitized = name.substring(0, 100 - extension.length) + extension;
    }
    
    return sanitized;
  }

  /**
   * Creates a fallback path when normal construction fails
   * @param {string} destFolder - Destination folder
   * @param {string} originalname - Original filename
   * @returns {string} Safe fallback path
   * @private
   */
  _createFallbackPath(destFolder, originalname) {
    const timestamp = Date.now();
    let ext = '';
    
    if (originalname && typeof originalname === 'string') {
      ext = path.extname(originalname);
      // If extension is just dots or spaces, don't use it
      if (!ext || /^[.\s]+$/.test(ext)) {
        ext = '';
      }
    }
    
    const safeName = `upload_${timestamp}${ext || '.file'}`;
    
    const sanitizedDestFolder = this._sanitizePath(destFolder) || 'uploads';
    return path.join(sanitizedDestFolder, safeName);
  }
}

module.exports = PathConstructionStrategy;