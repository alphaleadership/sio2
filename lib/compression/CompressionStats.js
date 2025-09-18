const fs = require('fs').promises;
const path = require('path');

/**
 * Collecteur et gestionnaire des statistiques de compression
 * Fournit des métriques sur l'efficacité et l'utilisation de la compression
 */
class CompressionStats {
  /**
   * Constructeur des statistiques de compression
   */
  constructor() {
    this.stats = {
      totalFilesProcessed: 0,
      totalFilesCompressed: 0,
      totalSpaceSaved: 0,
      averageCompressionRatio: 0,
      compressionsByType: new Map(),
      lastUpdated: new Date()
    };
  }

  /**
   * Enregistre une opération de compression
   * @param {Object} compressionResult - Résultat de la compression
   * @param {string} compressionResult.filePath - Chemin du fichier
   * @param {number} compressionResult.originalSize - Taille originale
   * @param {number} compressionResult.compressedSize - Taille compressée
   * @param {string} compressionResult.fileType - Type de fichier
   * @param {boolean} compressionResult.success - Succès de l'opération
   * @returns {void}
   */
  recordCompression(compressionResult) {
    const { originalSize, compressedSize, fileType, success } = compressionResult;
    
    // Incrémenter le nombre total de fichiers traités
    this.stats.totalFilesProcessed++;
    
    if (success && compressedSize < originalSize) {
      // Incrémenter le nombre de fichiers compressés avec succès
      this.stats.totalFilesCompressed++;
      
      // Calculer l'espace économisé
      const spaceSaved = originalSize - compressedSize;
      this.stats.totalSpaceSaved += spaceSaved;
      
      // Mettre à jour les statistiques par type de fichier
      if (!this.stats.compressionsByType.has(fileType)) {
        this.stats.compressionsByType.set(fileType, {
          filesProcessed: 0,
          filesCompressed: 0,
          totalOriginalSize: 0,
          totalCompressedSize: 0,
          totalSpaceSaved: 0,
          averageCompressionRatio: 0
        });
      }
      
      const typeStats = this.stats.compressionsByType.get(fileType);
      typeStats.filesProcessed++;
      typeStats.filesCompressed++;
      typeStats.totalOriginalSize += originalSize;
      typeStats.totalCompressedSize += compressedSize;
      typeStats.totalSpaceSaved += spaceSaved;
      
      // Calculer le ratio de compression pour ce type
      typeStats.averageCompressionRatio = 
        typeStats.totalCompressedSize / typeStats.totalOriginalSize;
    } else {
      // Fichier traité mais pas compressé (échec ou pas d'économie)
      if (!this.stats.compressionsByType.has(fileType)) {
        this.stats.compressionsByType.set(fileType, {
          filesProcessed: 0,
          filesCompressed: 0,
          totalOriginalSize: 0,
          totalCompressedSize: 0,
          totalSpaceSaved: 0,
          averageCompressionRatio: 1.0
        });
      }
      
      const typeStats = this.stats.compressionsByType.get(fileType);
      typeStats.filesProcessed++;
    }
    
    // Recalculer le ratio de compression moyen global
    this._updateGlobalCompressionRatio();
    
    // Mettre à jour la date de dernière modification
    this.stats.lastUpdated = new Date();
  }

  /**
   * Calcule les statistiques globales
   * @returns {Object} Statistiques complètes
   */
  getGlobalStats() {
    return {
      totalFilesProcessed: this.stats.totalFilesProcessed,
      totalFilesCompressed: this.stats.totalFilesCompressed,
      totalSpaceSaved: this.stats.totalSpaceSaved,
      averageCompressionRatio: this.stats.averageCompressionRatio,
      compressionRate: this.stats.totalFilesProcessed > 0 
        ? (this.stats.totalFilesCompressed / this.stats.totalFilesProcessed) * 100 
        : 0,
      formattedSpaceSaved: this.getFormattedSpaceSaved(),
      lastUpdated: this.stats.lastUpdated
    };
  }

  /**
   * Obtient les statistiques par type de fichier
   * @param {string} fileType - Type de fichier (optionnel)
   * @returns {Object|Map} Statistiques pour un type ou tous les types
   */
  getStatsByType(fileType = null) {
    if (fileType) {
      const typeStats = this.stats.compressionsByType.get(fileType);
      if (!typeStats) {
        return {
          filesProcessed: 0,
          filesCompressed: 0,
          totalOriginalSize: 0,
          totalCompressedSize: 0,
          totalSpaceSaved: 0,
          averageCompressionRatio: 0,
          compressionRate: 0
        };
      }
      
      return {
        ...typeStats,
        compressionRate: typeStats.filesProcessed > 0 
          ? (typeStats.filesCompressed / typeStats.filesProcessed) * 100 
          : 0,
        formattedSpaceSaved: this._formatBytes(typeStats.totalSpaceSaved)
      };
    }
    
    // Retourner toutes les statistiques par type
    const result = {};
    for (const [type, stats] of this.stats.compressionsByType) {
      result[type] = {
        ...stats,
        compressionRate: stats.filesProcessed > 0 
          ? (stats.filesCompressed / stats.filesProcessed) * 100 
          : 0,
        formattedSpaceSaved: this._formatBytes(stats.totalSpaceSaved)
      };
    }
    
    return result;
  }

  /**
   * Sauvegarde les statistiques dans un fichier JSON
   * @param {string} statsPath - Chemin du fichier de statistiques
   * @returns {Promise<void>}
   */
  async saveToFile(statsPath) {
    try {
      // Créer le dossier parent si nécessaire
      const dir = path.dirname(statsPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Convertir la Map en objet pour la sérialisation JSON
      const serializedStats = {
        ...this.stats,
        compressionsByType: Object.fromEntries(this.stats.compressionsByType)
      };
      
      // Sauvegarder avec formatage pour lisibilité
      await fs.writeFile(
        statsPath, 
        JSON.stringify(serializedStats, null, 2), 
        'utf8'
      );
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des statistiques: ${error.message}`);
    }
  }

  /**
   * Charge les statistiques depuis un fichier JSON
   * @param {string} statsPath - Chemin du fichier de statistiques
   * @returns {Promise<CompressionStats>} Instance avec statistiques chargées
   */
  static async loadFromFile(statsPath) {
    try {
      const data = await fs.readFile(statsPath, 'utf8');
      const parsedStats = JSON.parse(data);
      
      const instance = new CompressionStats();
      
      // Restaurer les statistiques de base
      instance.stats.totalFilesProcessed = parsedStats.totalFilesProcessed || 0;
      instance.stats.totalFilesCompressed = parsedStats.totalFilesCompressed || 0;
      instance.stats.totalSpaceSaved = parsedStats.totalSpaceSaved || 0;
      instance.stats.averageCompressionRatio = parsedStats.averageCompressionRatio || 0;
      instance.stats.lastUpdated = new Date(parsedStats.lastUpdated || Date.now());
      
      // Restaurer la Map des statistiques par type
      if (parsedStats.compressionsByType) {
        instance.stats.compressionsByType = new Map(
          Object.entries(parsedStats.compressionsByType)
        );
      }
      
      return instance;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Fichier n'existe pas, retourner une nouvelle instance
        return new CompressionStats();
      }
      throw new Error(`Erreur lors du chargement des statistiques: ${error.message}`);
    }
  }

  /**
   * Remet à zéro les statistiques
   * @returns {void}
   */
  reset() {
    this.stats = {
      totalFilesProcessed: 0,
      totalFilesCompressed: 0,
      totalSpaceSaved: 0,
      averageCompressionRatio: 0,
      compressionsByType: new Map(),
      lastUpdated: new Date()
    };
  }

  /**
   * Calcule l'espace disque économisé en format lisible
   * @returns {string} Espace économisé formaté (ex: "1.2 MB")
   */
  getFormattedSpaceSaved() {
    return this._formatBytes(this.stats.totalSpaceSaved);
  }

  /**
   * Génère un rapport détaillé des statistiques
   * @returns {Object} Rapport complet avec métriques détaillées
   */
  generateReport() {
    const globalStats = this.getGlobalStats();
    const statsByType = this.getStatsByType();
    
    // Calculer les types les plus efficaces
    const typeEfficiency = Object.entries(statsByType)
      .filter(([, stats]) => stats.filesCompressed > 0)
      .map(([type, stats]) => ({
        type,
        compressionRatio: stats.averageCompressionRatio,
        spaceSaved: stats.totalSpaceSaved,
        filesCompressed: stats.filesCompressed
      }))
      .sort((a, b) => a.compressionRatio - b.compressionRatio);
    
    return {
      summary: {
        ...globalStats,
        efficiency: globalStats.totalFilesProcessed > 0 
          ? `${globalStats.compressionRate.toFixed(1)}% des fichiers compressés`
          : 'Aucun fichier traité'
      },
      byFileType: statsByType,
      topPerformers: {
        mostEfficient: typeEfficiency.slice(0, 5),
        mostSpaceSaved: Object.entries(statsByType)
          .filter(([, stats]) => stats.totalSpaceSaved > 0)
          .map(([type, stats]) => ({ type, spaceSaved: stats.totalSpaceSaved }))
          .sort((a, b) => b.spaceSaved - a.spaceSaved)
          .slice(0, 5)
      },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Méthode privée pour recalculer le ratio de compression global
   * @private
   */
  _updateGlobalCompressionRatio() {
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    
    for (const typeStats of this.stats.compressionsByType.values()) {
      totalOriginalSize += typeStats.totalOriginalSize;
      totalCompressedSize += typeStats.totalCompressedSize;
    }
    
    this.stats.averageCompressionRatio = totalOriginalSize > 0 
      ? totalCompressedSize / totalOriginalSize 
      : 0;
  }

  /**
   * Méthode privée pour formater les bytes en format lisible
   * @param {number} bytes - Nombre de bytes
   * @returns {string} Taille formatée
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }
}

module.exports = CompressionStats;