const path = require('path');
const CompressionStats = require('./CompressionStats');

/**
 * Gestionnaire de persistance des statistiques de compression
 * Gère le chargement, la sauvegarde et la synchronisation des statistiques
 */
class StatsManager {
  /**
   * Constructeur du gestionnaire de statistiques
   * @param {string} statsFilePath - Chemin du fichier de statistiques
   * @param {number} autoSaveInterval - Intervalle de sauvegarde automatique en ms (0 = désactivé)
   */
  constructor(statsFilePath = null, autoSaveInterval = 30000) {
    this.statsFilePath = statsFilePath || path.join(process.cwd(), 'data', 'compression-stats.json');
    this.autoSaveInterval = autoSaveInterval;
    this.stats = null;
    this.autoSaveTimer = null;
    this.isDirty = false;
  }

  /**
   * Initialise le gestionnaire et charge les statistiques existantes
   * @returns {Promise<CompressionStats>} Instance des statistiques chargées
   */
  async initialize() {
    try {
      this.stats = await CompressionStats.loadFromFile(this.statsFilePath);
      
      // Démarrer la sauvegarde automatique si configurée
      if (this.autoSaveInterval > 0) {
        this.startAutoSave();
      }
      
      return this.stats;
    } catch (error) {
      throw new Error(`Erreur lors de l'initialisation du gestionnaire de statistiques: ${error.message}`);
    }
  }

  /**
   * Obtient l'instance des statistiques
   * @returns {CompressionStats} Instance des statistiques
   */
  getStats() {
    if (!this.stats) {
      throw new Error('Le gestionnaire de statistiques n\'est pas initialisé. Appelez initialize() d\'abord.');
    }
    return this.stats;
  }

  /**
   * Enregistre une opération de compression et marque les données comme modifiées
   * @param {Object} compressionResult - Résultat de la compression
   */
  recordCompression(compressionResult) {
    if (!this.stats) {
      throw new Error('Le gestionnaire de statistiques n\'est pas initialisé.');
    }
    
    this.stats.recordCompression(compressionResult);
    this.isDirty = true;
  }

  /**
   * Sauvegarde immédiate des statistiques
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.stats) {
      throw new Error('Le gestionnaire de statistiques n\'est pas initialisé.');
    }
    
    try {
      await this.stats.saveToFile(this.statsFilePath);
      this.isDirty = false;
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des statistiques: ${error.message}`);
    }
  }

  /**
   * Sauvegarde conditionnelle (seulement si les données ont été modifiées)
   * @returns {Promise<boolean>} True si la sauvegarde a été effectuée
   */
  async saveIfDirty() {
    if (this.isDirty) {
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Démarre la sauvegarde automatique périodique
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setInterval(async () => {
      try {
        const saved = await this.saveIfDirty();
        if (saved) {
          console.log(`[StatsManager] Statistiques sauvegardées automatiquement: ${this.statsFilePath}`);
        }
      } catch (error) {
        console.error(`[StatsManager] Erreur lors de la sauvegarde automatique: ${error.message}`);
      }
    }, this.autoSaveInterval);
  }

  /**
   * Arrête la sauvegarde automatique
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Génère un rapport complet des statistiques
   * @returns {Object} Rapport détaillé
   */
  generateReport() {
    if (!this.stats) {
      throw new Error('Le gestionnaire de statistiques n\'est pas initialisé.');
    }
    
    return this.stats.generateReport();
  }

  /**
   * Remet à zéro toutes les statistiques
   * @returns {Promise<void>}
   */
  async reset() {
    if (!this.stats) {
      throw new Error('Le gestionnaire de statistiques n\'est pas initialisé.');
    }
    
    this.stats.reset();
    this.isDirty = true;
    await this.save();
  }

  /**
   * Ferme proprement le gestionnaire et sauvegarde les données
   * @returns {Promise<void>}
   */
  async close() {
    this.stopAutoSave();
    
    if (this.isDirty) {
      await this.save();
    }
  }

  /**
   * Obtient les statistiques globales
   * @returns {Object} Statistiques globales
   */
  getGlobalStats() {
    return this.getStats().getGlobalStats();
  }

  /**
   * Obtient les statistiques par type de fichier
   * @param {string} fileType - Type de fichier (optionnel)
   * @returns {Object|Map} Statistiques par type
   */
  getStatsByType(fileType = null) {
    return this.getStats().getStatsByType(fileType);
  }

  /**
   * Obtient l'espace disque économisé en format lisible
   * @returns {string} Espace économisé formaté
   */
  getFormattedSpaceSaved() {
    return this.getStats().getFormattedSpaceSaved();
  }

  /**
   * Crée une instance de gestionnaire avec configuration par défaut
   * @param {string} dataDir - Dossier de données (optionnel)
   * @returns {StatsManager} Instance configurée
   */
  static createDefault(dataDir = null) {
    const defaultDataDir = dataDir || path.join(process.cwd(), 'data');
    const statsFilePath = path.join(defaultDataDir, 'compression-stats.json');
    
    return new StatsManager(statsFilePath, 30000); // Sauvegarde toutes les 30 secondes
  }
}

module.exports = StatsManager;