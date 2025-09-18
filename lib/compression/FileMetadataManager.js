const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Gestionnaire des métadonnées étendues pour les fichiers compressés
 * Gère la persistance et la récupération des informations de compression
 */
class FileMetadataManager {
  /**
   * Constructeur du gestionnaire de métadonnées
   */
  constructor() {
    this.metadataExtension = '.meta';
  }

  /**
   * Sauvegarde les métadonnées d'un fichier compressé
   * @param {string} filePath - Chemin du fichier original
   * @param {Object} metadata - Métadonnées à sauvegarder
   * @param {string} metadata.originalPath - Chemin original du fichier
   * @param {string} metadata.compressedPath - Chemin du fichier compressé
   * @param {boolean} metadata.isCompressed - Statut de compression
   * @param {number} metadata.originalSize - Taille originale en bytes
   * @param {number} metadata.compressedSize - Taille compressée en bytes
   * @param {number} metadata.compressionRatio - Ratio de compression
   * @param {string} metadata.algorithm - Algorithme utilisé
   * @param {Date} metadata.compressedAt - Date de compression
   * @param {string} metadata.checksum - Checksum du fichier original
   * @returns {Promise<void>}
   */
  async saveMetadata(filePath, metadata) {
    try {
      const metadataPath = this.getMetadataPath(filePath);
      
      // Créer le dossier parent si nécessaire
      const metadataDir = path.dirname(metadataPath);
      await fs.mkdir(metadataDir, { recursive: true });
      
      // Préparer les métadonnées avec timestamp
      const metadataToSave = {
        ...metadata,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      
      // Sauvegarder en JSON
      await fs.writeFile(metadataPath, JSON.stringify(metadataToSave, null, 2), 'utf8');
      
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des métadonnées: ${error.message}`);
    }
  }

  /**
   * Charge les métadonnées d'un fichier
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<Object|null>} Métadonnées ou null si non trouvées
   */
  async loadMetadata(filePath) {
    try {
      const metadataPath = this.getMetadataPath(filePath);
      
      // Vérifier si le fichier de métadonnées existe
      try {
        await fs.access(metadataPath);
      } catch (error) {
        return null; // Fichier de métadonnées n'existe pas
      }
      
      // Lire et parser les métadonnées
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      return metadata;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new Error(`Erreur lors du chargement des métadonnées: ${error.message}`);
    }
  }

  /**
   * Vérifie si des métadonnées existent pour un fichier
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<boolean>} True si les métadonnées existent
   */
  async hasMetadata(filePath) {
    try {
      const metadataPath = this.getMetadataPath(filePath);
      await fs.access(metadataPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Supprime les métadonnées d'un fichier
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<void>}
   */
  async deleteMetadata(filePath) {
    try {
      const metadataPath = this.getMetadataPath(filePath);
      await fs.unlink(metadataPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw new Error(`Erreur lors de la suppression des métadonnées: ${error.message}`);
      }
      // Ignorer si le fichier n'existe pas
    }
  }

  /**
   * Calcule le checksum d'un fichier pour validation
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<string>} Checksum SHA256 du fichier
   */
  async calculateChecksum(filePath) {
    try {
      const fileContent = await fs.readFile(filePath);
      const hash = crypto.createHash('sha256');
      hash.update(fileContent);
      return hash.digest('hex');
    } catch (error) {
      throw new Error(`Erreur lors du calcul du checksum: ${error.message}`);
    }
  }

  /**
   * Valide l'intégrité d'un fichier compressé
   * @param {string} filePath - Chemin du fichier
   * @returns {Promise<boolean>} True si le fichier est intègre
   */
  async validateIntegrity(filePath) {
    try {
      // Charger les métadonnées
      const metadata = await this.loadMetadata(filePath);
      if (!metadata || !metadata.checksum) {
        return false; // Pas de métadonnées ou pas de checksum
      }
      
      // Calculer le checksum actuel du fichier
      const currentChecksum = await this.calculateChecksum(filePath);
      
      // Comparer avec le checksum stocké
      return currentChecksum === metadata.checksum;
      
    } catch (error) {
      return false; // En cas d'erreur, considérer comme non intègre
    }
  }

  /**
   * Génère le chemin du fichier de métadonnées
   * @param {string} filePath - Chemin du fichier original
   * @returns {string} Chemin du fichier de métadonnées
   */
  getMetadataPath(filePath) {
    return filePath + this.metadataExtension;
  }
}

module.exports = FileMetadataManager;