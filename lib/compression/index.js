/**
 * Point d'entrée principal du module de compression
 * Exporte toutes les classes et utilitaires de compression
 */

const CompressionService = require('./CompressionService');
const FileStorageMiddleware = require('./FileStorageMiddleware');
const CompressionConfig = require('./CompressionConfig');
const FileMetadataManager = require('./FileMetadataManager');
const CompressionStats = require('./CompressionStats');
const StatsManager = require('./StatsManager');

/**
 * Codes d'erreur spécifiques au système de compression
 */
const COMPRESSION_ERRORS = {
  COMPRESSION_FAILED: 'COMP_001',
  DECOMPRESSION_FAILED: 'COMP_002',
  COMPRESSION_TIMEOUT: 'COMP_003',
  FILE_CORRUPTED: 'COMP_004',
  UNSUPPORTED_FORMAT: 'COMP_005',
  METADATA_ERROR: 'COMP_006',
  CONFIG_INVALID: 'COMP_007'
};

/**
 * Factory pour créer une instance complète du système de compression
 * @param {Object} options - Options de configuration
 * @returns {Promise<Object>} Objet contenant tous les services configurés
 */
async function createCompressionSystem(options = {}) {
  const config = new CompressionConfig(options);
  const compressionService = new CompressionService();
  const metadataManager = new FileMetadataManager();
  
  // Créer et initialiser le gestionnaire de statistiques
  const statsManager = StatsManager.createDefault(options.dataDir);
  await statsManager.initialize();
  const stats = statsManager.getStats();
  
  const middleware = new FileStorageMiddleware(compressionService, config, stats, metadataManager);

  return {
    config,
    compressionService,
    metadataManager,
    stats,
    statsManager,
    middleware
  };
}

module.exports = {
  CompressionService,
  FileStorageMiddleware,
  CompressionConfig,
  FileMetadataManager,
  CompressionStats,
  StatsManager,
  COMPRESSION_ERRORS,
  createCompressionSystem
};