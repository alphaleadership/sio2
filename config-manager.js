/**
 * Utilitaire de gestion de la configuration de compression
 * Permet de valider, charger et sauvegarder la configuration
 */

const CompressionConfig = require('./lib/compression/CompressionConfig');
const path = require('path');
const fs = require('fs').promises;

class ConfigurationManager {
  constructor() {
    this.configPath = path.join(__dirname, 'temp', 'compression-config.json');
  }

  /**
   * Charge la configuration actuelle
   */
  async loadConfiguration() {
    try {
      return await CompressionConfig.loadFromFile(this.configPath);
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error.message);
      return new CompressionConfig(); // Configuration par défaut
    }
  }

  /**
   * Sauvegarde une nouvelle configuration
   */
  async saveConfiguration(configData) {
    try {
      const config = new CompressionConfig(configData);
      
      // Valider la configuration
      const validation = config.validate();
      if (!validation.isValid) {
        throw new Error('Configuration invalide: ' + validation.errors.join(', '));
      }
      
      // Sauvegarder
      await config.saveToFile(this.configPath);
      
      return {
        success: true,
        config: config.toJSON(),
        warnings: validation.warnings
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Valide une configuration sans la sauvegarder
   */
  validateConfiguration(configData) {
    try {
      const config = new CompressionConfig(configData);
      return config.validate();
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Remet la configuration aux valeurs par défaut
   */
  async resetToDefaults() {
    try {
      const defaultConfig = new CompressionConfig();
      await defaultConfig.saveToFile(this.configPath);
      
      return {
        success: true,
        config: defaultConfig.toJSON(),
        message: 'Configuration remise aux valeurs par défaut'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Affiche la configuration actuelle de manière lisible
   */
  async displayCurrentConfiguration() {
    try {
      const config = await this.loadConfiguration();
      const validation = config.validate();
      
      console.log('=== Configuration Actuelle de Compression ===\n');
      
      console.log('Paramètres généraux:');
      console.log(`  Niveau de compression: ${config.compressionLevel}`);
      console.log(`  Algorithme: ${config.algorithm}`);
      console.log(`  Timeout: ${config.compressionTimeout}ms`);
      
      console.log('\nLimites de taille:');
      console.log(`  Taille minimale: ${config.minFileSize} bytes (${Math.round(config.minFileSize / 1024)}KB)`);
      console.log(`  Taille maximale: ${config.maxFileSize} bytes (${Math.round(config.maxFileSize / (1024 * 1024))}MB)`);
      
      console.log('\nTypes de fichiers:');
      console.log(`  Compressibles: ${config.compressibleTypes.join(', ')}`);
      console.log(`  Exclus: ${config.excludeTypes.join(', ')}`);
      
      console.log('\nValidation:');
      if (validation.isValid) {
        console.log('  ✓ Configuration valide');
      } else {
        console.log('  ✗ Configuration invalide');
        validation.errors.forEach(error => console.log(`    - ${error}`));
      }
      
      if (validation.warnings.length > 0) {
        console.log('  Avertissements:');
        validation.warnings.forEach(warning => console.log(`    - ${warning}`));
      }
      
      return config;
      
    } catch (error) {
      console.error('Erreur lors de l\'affichage de la configuration:', error.message);
      return null;
    }
  }

  /**
   * Teste la configuration avec différents types de fichiers
   */
  async testConfiguration() {
    try {
      const config = await this.loadConfiguration();
      
      console.log('=== Test de Configuration ===\n');
      
      const testFiles = [
        { name: 'document.txt', size: 2048 },
        { name: 'script.js', size: 5120 },
        { name: 'image.jpg', size: 1048576 },
        { name: 'archive.zip', size: 2097152 },
        { name: 'small.txt', size: 100 },
        { name: 'huge.log', size: 200 * 1024 * 1024 }
      ];
      
      testFiles.forEach(file => {
        const isCompressible = config.isCompressible(file.name);
        const isValidSize = config.isValidSize(file.size);
        const shouldCompress = isCompressible && isValidSize;
        
        console.log(`${file.name} (${Math.round(file.size / 1024)}KB):`);
        console.log(`  Type compressible: ${isCompressible ? '✓' : '✗'}`);
        console.log(`  Taille valide: ${isValidSize ? '✓' : '✗'}`);
        console.log(`  Sera compressé: ${shouldCompress ? '✓' : '✗'}`);
        console.log('');
      });
      
    } catch (error) {
      console.error('Erreur lors du test de configuration:', error.message);
    }
  }
}

// Interface en ligne de commande
async function main() {
  const manager = new ConfigurationManager();
  const command = process.argv[2];
  
  switch (command) {
    case 'show':
      await manager.displayCurrentConfiguration();
      break;
      
    case 'test':
      await manager.testConfiguration();
      break;
      
    case 'reset':
      const resetResult = await manager.resetToDefaults();
      if (resetResult.success) {
        console.log('✓ Configuration remise aux valeurs par défaut');
      } else {
        console.error('✗ Erreur:', resetResult.error);
      }
      break;
      
    case 'validate':
      const config = await manager.loadConfiguration();
      const validation = manager.validateConfiguration(config.toJSON());
      
      if (validation.isValid) {
        console.log('✓ Configuration valide');
      } else {
        console.log('✗ Configuration invalide:');
        validation.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (validation.warnings.length > 0) {
        console.log('Avertissements:');
        validation.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      break;
      
    default:
      console.log('Utilitaire de gestion de la configuration de compression\n');
      console.log('Commandes disponibles:');
      console.log('  show     - Afficher la configuration actuelle');
      console.log('  test     - Tester la configuration avec différents fichiers');
      console.log('  validate - Valider la configuration actuelle');
      console.log('  reset    - Remettre aux valeurs par défaut');
      console.log('\nExemple: node config-manager.js show');
  }
}

// Exécuter si appelé directement
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ConfigurationManager;