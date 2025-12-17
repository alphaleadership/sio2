import * as fs from'fs/promises';
import *  as path from 'path';

/**
 * Configuration des paramètres de compression
 * Gère les paramètres par défaut et la validation de la configuration
 */
export default class CompressionConfig {
  /**
   * Constructeur avec configuration par défaut
   * @param {Object} options - Options de configuration
   */
  constructor(options = {}) {
    // Configuration par défaut
    this.compressionLevel = options.compressionLevel || 6;
    this.compressibleTypes = options.compressibleTypes || [
      '.txt', '.js', '.css', '.html', '.json', '.xml', '.md',
      '.csv', '.log', '.sql', '.php', '.py', '.rb', '.java'
    ];
    this.excludeTypes = options.excludeTypes || [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
      '.zip', '.rar', '.7z', '.gz', '.bz2',
      '.mp4', '.avi', '.mov', '.mp3', '.wav', '.flac'
    ];
    this.minFileSize = options.minFileSize || 1024; // 1KB minimum
    this.compressionTimeout = options.compressionTimeout || 5000; // 5 secondes
    this.algorithm = options.algorithm || 'gzip';
    this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB maximum
  }

  /**
   * Valide la configuration actuelle
   * @returns {Object} Résultat de la validation avec erreurs éventuelles
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    // Validation du niveau de compression
    if (typeof this.compressionLevel !== 'number' || this.compressionLevel < 1 || this.compressionLevel > 9) {
      errors.push('Le niveau de compression doit être un nombre entre 1 et 9');
    }
    
    // Validation de la taille minimale
    if (typeof this.minFileSize !== 'number' || this.minFileSize < 0) {
      errors.push('La taille minimale doit être un nombre positif');
    }
    
    // Validation de la taille maximale
    if (typeof this.maxFileSize !== 'number' || this.maxFileSize <= 0) {
      errors.push('La taille maximale doit être un nombre positif');
    }
    
    // Validation de la cohérence des tailles
    if (this.minFileSize >= this.maxFileSize) {
      errors.push('La taille minimale doit être inférieure à la taille maximale');
    }
    
    // Validation du timeout
    if (typeof this.compressionTimeout !== 'number' || this.compressionTimeout <= 0) {
      errors.push('Le timeout de compression doit être un nombre positif');
    }
    
    // Validation de l'algorithme
    const supportedAlgorithms = ['gzip', 'brotli', 'lz4'];
    if (!supportedAlgorithms.includes(this.algorithm)) {
      errors.push(`Algorithme non supporté: ${this.algorithm}. Algorithmes supportés: ${supportedAlgorithms.join(', ')}`);
    }
    
    // Validation des types de fichiers
    if (!Array.isArray(this.compressibleTypes)) {
      errors.push('Les types compressibles doivent être un tableau');
    }
    
    if (!Array.isArray(this.excludeTypes)) {
      errors.push('Les types exclus doivent être un tableau');
    }
    
    // Avertissements
    if (this.compressionLevel > 7) {
      warnings.push('Un niveau de compression élevé peut impacter les performances');
    }
    
    if (this.minFileSize < 100) {
      warnings.push('Une taille minimale très faible peut réduire l\'efficacité de la compression');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Charge la configuration depuis un fichier JSON
   * @param {string} configPath - Chemin du fichier de configuration
   * @returns {Promise<CompressionConfig>} Instance configurée
   */
   async loadFromFile(configPath) {
    try {
      // Vérifier si le fichier existe
      await fs.access(configPath);
      
      // Lire et parser le fichier de configuration
      const configContent = await fs.readFile(configPath, 'utf8');
      const configData = JSON.parse(configContent);
      
      // Créer une nouvelle instance avec la configuration chargée
      const config = new CompressionConfig(configData);
      
      // Valider la configuration chargée
      const validation = config.validate();
      if (!validation.isValid) {
        throw new Error(`Configuration invalide: ${validation.errors.join(', ')}`);
      }
      
      return config;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Fichier n'existe pas, retourner la configuration par défaut
        return new CompressionConfig();
      }
      throw new Error(`Erreur lors du chargement de la configuration: ${error.message}`);
    }
  }

  /**
   * Sauvegarde la configuration dans un fichier JSON
   * @param {string} configPath - Chemin du fichier de configuration
   * @returns {Promise<void>}
   */
  async saveToFile(configPath) {
    try {
      // Valider la configuration avant sauvegarde
      const validation = this.validate();
      if (!validation.isValid) {
        throw new Error(`Configuration invalide: ${validation.errors.join(', ')}`);
      }
      
      // Créer le dossier parent si nécessaire
      const configDir = path.dirname(configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      // Préparer les données de configuration
      const configData = {
        compressionLevel: this.compressionLevel,
        compressibleTypes: this.compressibleTypes,
        excludeTypes: this.excludeTypes,
        minFileSize: this.minFileSize,
        maxFileSize: this.maxFileSize,
        compressionTimeout: this.compressionTimeout,
        algorithm: this.algorithm,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      // Sauvegarder en JSON formaté
      await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8');
      
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde de la configuration: ${error.message}`);
    }
  }

  /**
   * Vérifie si un type de fichier est compressible
   * @param {string} filePath - Chemin du fichier
   * @returns {boolean} True si le fichier est compressible
   */
  isCompressible(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Vérifier d'abord si le type est exclu
    if (this.isExcluded(filePath)) {
      return false;
    }
    
    // Vérifier si le type est dans la liste des types compressibles
    return this.compressibleTypes.includes(ext);
  }

  /**
   * Vérifie si un fichier doit être exclu de la compression
   * @param {string} filePath - Chemin du fichier
   * @returns {boolean} True si le fichier doit être exclu
   */
  isExcluded(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.excludeTypes.includes(ext);
  }

  /**
   * Met à jour la configuration avec de nouveaux paramètres
   * @param {Object} newConfig - Nouveaux paramètres
   * @returns {CompressionConfig} Instance mise à jour
   */
  update(newConfig) {
    // Mettre à jour les propriétés existantes
    if (newConfig.compressionLevel !== undefined) {
      this.compressionLevel = newConfig.compressionLevel;
    }
    if (newConfig.compressibleTypes !== undefined) {
      this.compressibleTypes = newConfig.compressibleTypes;
    }
    if (newConfig.excludeTypes !== undefined) {
      this.excludeTypes = newConfig.excludeTypes;
    }
    if (newConfig.minFileSize !== undefined) {
      this.minFileSize = newConfig.minFileSize;
    }
    if (newConfig.maxFileSize !== undefined) {
      this.maxFileSize = newConfig.maxFileSize;
    }
    if (newConfig.compressionTimeout !== undefined) {
      this.compressionTimeout = newConfig.compressionTimeout;
    }
    if (newConfig.algorithm !== undefined) {
      this.algorithm = newConfig.algorithm;
    }
    
    return this;
  }

  /**
   * Vérifie si un fichier respecte les critères de taille pour la compression
   * @param {number} fileSize - Taille du fichier en bytes
   * @returns {boolean} True si la taille est dans les limites
   */
  isValidSize(fileSize) {
    return fileSize >= this.minFileSize && fileSize <= this.maxFileSize;
  }

  /**
   * Retourne une copie de la configuration actuelle
   * @returns {Object} Configuration actuelle
   */
  toJSON() {
    return {
      compressionLevel: this.compressionLevel,
      compressibleTypes: [...this.compressibleTypes],
      excludeTypes: [...this.excludeTypes],
      minFileSize: this.minFileSize,
      maxFileSize: this.maxFileSize,
      compressionTimeout: this.compressionTimeout,
      algorithm: this.algorithm
    };
  }
}

