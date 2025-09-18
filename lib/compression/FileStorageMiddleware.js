const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const CompressionQueue = require('./CompressionQueue');
const UploadPathResolver = require('../upload/UploadPathResolver');

/**
 * Middleware pour intercepter les opérations de stockage de fichiers
 * Gère la compression automatique lors des uploads et la décompression lors des downloads
 * Utilise un système de queue pour éviter le blocage des uploads
 */
class FileStorageMiddleware {
  /**
   * Constructeur du middleware
   * @param {CompressionService} compressionService - Service de compression
   * @param {CompressionConfig} config - Configuration de compression
   * @param {CompressionStats} stats - Collecteur de statistiques (optionnel)
   * @param {FileMetadataManager} metadataManager - Gestionnaire de métadonnées (optionnel)
   * @param {Object} queueOptions - Options pour la queue de compression (optionnel)
   */
  constructor(compressionService, config, stats = null, metadataManager = null, queueOptions = {}) {
    this.compressionService = compressionService;
    this.config = config;
    this.stats = stats;
    this.metadataManager = metadataManager;

    // Initialiser la queue de compression
    this.compressionQueue = new CompressionQueue({
      maxConcurrent: queueOptions.maxConcurrent || 3,
      maxRetries: queueOptions.maxRetries || 3,
      retryDelay: queueOptions.retryDelay || 1000,
      timeout: queueOptions.timeout || 30000
    });

    // Initialize the new upload path resolver
    this.uploadPathResolver = new UploadPathResolver({
      enableDebugLogging: queueOptions.enableDebugLogging || false,
      logger: console
    });

    // Écouter les événements de la queue pour le logging
    this.setupQueueEventListeners();
  }

  /**
   * Configure les écouteurs d'événements pour la queue de compression
   */
  setupQueueEventListeners() {
    this.compressionQueue.on('taskCompleted', (event) => {
      console.log(`Compression completed: ${event.taskId} in ${event.duration}ms`);
    });

    this.compressionQueue.on('taskFailed', (event) => {
      console.warn(`Compression failed: ${event.taskId} after ${event.attempts} attempts - ${event.error}`);
    });

    this.compressionQueue.on('taskError', (event) => {
      console.warn(`Compression error: ${event.taskId} attempt ${event.attempt}/${event.maxRetries} - ${event.error}`);
    });
  }

  /**
   * Intercepte l'upload pour compression automatique
   * Traite les fichiers après upload Multer et applique la compression si nécessaire
   * Utilise la queue pour éviter le blocage des uploads
   * @param {Object} req - Objet request Express
   * @param {Object} res - Objet response Express
   * @param {Function} next - Fonction next du middleware Express
   * @returns {Promise<void>}
   */
  async handleUpload(req, res, next) {
    try {
      // Vérifier qu'il y a des fichiers à traiter
      if (!req.files || req.files.length === 0) {
        return next();
      }

      const baseDir = path.resolve("../partage");
      let destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;

      // Corriger les duplications de chemin dans destFolder
      destFolder = this._correctPathDuplication(destFolder, baseDir);

      // Sécurité : empêcher la traversée de dossier
      if (!destFolder.startsWith(baseDir)) {
        // Nettoyer les fichiers temporaires
        req.files.forEach(f => {
          if (fsSync.existsSync(f.path)) {
            fsSync.unlinkSync(f.path);
          }
        });
        return res.status(400).send("Chemin invalide.");
      }

      // Analyser la structure des fichiers uploadés
      const folderStructure = this.analyzeFolderStructure(req.files);

      // Valider la structure
      const validation = this.validateFolderStructure(folderStructure);

      // Ajouter les informations de validation au request
      req.folderValidation = validation;

      // Détecter si c'est un upload de dossier (plusieurs fichiers avec webkitRelativePath)
      const isFolderUpload = req.files.some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));

      let processedFiles = [];

      if (false) {
        // Utiliser la logique spécialisée pour les dossiers
        console.log(`Processing folder upload with ${req.files.length} files and ${folderStructure.folders.length} folders`);

        // Préparer les fichiers pour handleFolderCreation
        const filesForFolderCreation = req.files.map(file => ({
          ...file,
          tempPath: file.path,
          relativePath: file.webkitRelativePath || file.originalname,
          size: file.size || (fsSync.existsSync(file.path) ? fsSync.statSync(file.path).size : 0)
        }));

        const folderResult = await this.handleFolderCreation(destFolder, filesForFolderCreation);
        processedFiles = folderResult.processedFiles;

        // Ajouter les statistiques de dossier au request
        req.folderStats = {
          totalFiles: folderResult.totalFiles,
          compressedFiles: folderResult.compressedFiles,
          uncompressedFiles: folderResult.uncompressedFiles,
          totalSpaceSaved: folderResult.totalSpaceSaved,
          foldersCreated: folderResult.foldersCreated,
          errors: folderResult.errors
        };

      } else {
        // Traitement fichier par fichier pour uploads individuels
        for (const file of req.files) {
          try {
            // Use the new UploadPathResolver to determine the correct path
            const pathResolution = this.uploadPathResolver.resolvePath(file, destFolder, req.files);

            // Log path resolution details for debugging
            if (pathResolution.duplicationPrevented) {
              console.log(`Path duplication prevented for ${file.originalname}: ${pathResolution.reasoning}`);
            }

            // Log any warnings from path resolution
            if (pathResolution.warnings && pathResolution.warnings.length > 0) {
              console.warn(`Path resolution warnings for ${file.originalname}:`, pathResolution.warnings);
            }

            const destPath = pathResolution.finalPath;

            // Créer les dossiers nécessaires
            await fs.mkdir(path.dirname(destPath), { recursive: true });

            // Vérifier si le fichier doit être compressé
            const fileStats = await fs.stat(file.path);
            const shouldCompress = this.shouldCompress(destPath, fileStats.size);

            if (shouldCompress) {
              // Déplacer d'abord le fichier vers sa destination temporaire
              const tempDestPath = destPath + '.tmp';
              await fs.rename(file.path, tempDestPath);

              // Ajouter la compression à la queue (non-bloquant)
              const taskId = `compress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              const compressedPath = destPath + '.gz';

              // Démarrer la compression en arrière-plan
              this.compressionQueue.addTask({
                id: taskId,
                inputPath: tempDestPath,
                outputPath: compressedPath,
                options: {
                  level: this.config.compressionLevel,
                  algorithm: this.config.algorithm
                },
                compressionFunction: async (input, output, opts) => {
                  return await this.compressionService.compressFile(input, output, opts);
                },
                metadata: {
                  originalPath: destPath,
                  fileSize: fileStats.size,
                  uploadTime: new Date()
                }
              }).then(async (compressionResult) => {
                // Compression réussie - sauvegarder les métadonnées
                if (this.metadataManager) {
                  const checksum = await this.metadataManager.calculateChecksum(tempDestPath);
                  const metadata = {
                    originalPath: destPath,
                    compressedPath: compressedPath,
                    isCompressed: true,
                    originalSize: compressionResult.originalSize || fileStats.size,
                    compressedSize: compressionResult.compressedSize,
                    compressionRatio: compressionResult.compressionRatio,
                    algorithm: this.config.algorithm,
                    compressedAt: new Date(),
                    checksum: checksum
                  };

                  await this.metadataManager.saveMetadata(compressedPath, metadata);
                }

                // Enregistrer les statistiques de compression réussie
                this._recordCompressionStats(
                  destPath,
                  compressionResult.originalSize || fileStats.size,
                  compressionResult.compressedSize,
                  true
                );

                // Supprimer le fichier temporaire
                await fs.unlink(tempDestPath);

              }).catch(async (compressionError) => {
                // En cas d'échec de compression, déplacer le fichier original
                console.warn(`Compression failed for ${destPath}: ${compressionError.message}`);

                // Enregistrer les statistiques d'échec de compression
                this._recordCompressionStats(destPath, fileStats.size, fileStats.size, false);

                // Déplacer le fichier temporaire vers la destination finale
                try {
                  await fs.rename(tempDestPath, destPath);
                } catch (renameError) {
                  console.error(`Failed to move file after compression failure: ${renameError.message}`);
                }
              });

              // Retourner immédiatement le résultat (upload non-bloquant)
              processedFiles.push({
                originalPath: destPath,
                finalPath: compressedPath,
                compressed: 'queued',
                taskId: taskId,
                queuedAt: new Date()
              });

            } else {
              // Enregistrer les statistiques pour fichier non compressé
              this._recordCompressionStats(destPath, fileStats.size, fileStats.size, false);

              // Déplacer le fichier sans compression
              await fs.rename(file.path, destPath);

              processedFiles.push({
                originalPath: destPath,
                finalPath: destPath,
                compressed: false,
                reason: 'File does not meet compression criteria'
              });
            }

          } catch (fileError) {
            console.error(`Error processing file ${file.originalname}: ${fileError.message}`);

            // Nettoyer le fichier temporaire en cas d'erreur
            if (fsSync.existsSync(file.path)) {
              fsSync.unlinkSync(file.path);
            }

            processedFiles.push({
              originalPath: file.originalname,
              finalPath: null,
              compressed: false,
              error: fileError.message
            });
          }
        }
      }

      // Ajouter les résultats au request pour usage ultérieur
      req.compressionResults = processedFiles;

      // Log path resolver performance metrics
      const pathResolverMetrics = this.uploadPathResolver.getPerformanceMetrics();
      if (pathResolverMetrics.totalResolutions > 0) {
        console.log('Path resolver metrics:', {
          totalResolutions: pathResolverMetrics.totalResolutions,
          duplicationsPreventedPercentage: pathResolverMetrics.duplicationsPreventedPercentage,
          averageResolutionTime: pathResolverMetrics.averageResolutionTime
        });
      }

      next();

    } catch (error) {
      console.error('Error in compression middleware:', error);

      // Nettoyer tous les fichiers temporaires en cas d'erreur globale
      if (req.files) {
        req.files.forEach(f => {
          if (fsSync.existsSync(f.path)) {
            fsSync.unlinkSync(f.path);
          }
        });
      }

      return res.status(500).send("Erreur lors du traitement des fichiers.");
    }
  }

  /**
   * Intercepte le download pour décompression automatique
   * @param {Object} req - Objet request Express
   * @param {Object} res - Objet response Express
   * @param {Function} next - Fonction next du middleware Express
   * @returns {Promise<void>}
   */
  async handleDownload(req, res, next) {
    try {
      const baseDir = path.resolve("../partage");
      const reqFile = req.query.file ? path.join(baseDir, req.query.file) : null;

      // Vérifications de sécurité de base
      if (!reqFile || !reqFile.startsWith(baseDir)) {
        return res.status(400).send("Chemin invalide.");
      }

      // Vérifier si le fichier compressé existe
      const compressedPath = reqFile + '.gz';
      const originalExists = fsSync.existsSync(reqFile);
      const compressedExists = fsSync.existsSync(compressedPath);

      // Si le fichier original existe et n'est pas compressé, passer au middleware suivant
      if (originalExists && !compressedExists) {
        return next();
      }

      // Si le fichier compressé existe, le décompresser temporairement
      if (compressedExists) {
        try {
          // Valider l'intégrité du fichier compressé si le gestionnaire de métadonnées est disponible
          if (this.metadataManager) {
            const isValid = await this.metadataManager.validateIntegrity(compressedPath);
            if (!isValid) {
              console.warn(`File integrity check failed for ${compressedPath}`);
              // Continuer quand même mais logger l'avertissement
            }
          }

          // Créer un fichier temporaire pour la décompression
          const tempDir = path.join(baseDir, '..', 'tmp_downloads');
          await fs.mkdir(tempDir, { recursive: true });

          const tempFileName = `${Date.now()}_${path.basename(reqFile)}`;
          const tempPath = path.join(tempDir, tempFileName);

          // Décompresser le fichier
          await this.compressionService.decompressFile(compressedPath, tempPath);

          // Servir le fichier décompressé avec le nom original
          const originalFileName = path.basename(reqFile);

          // Configurer les headers pour le téléchargement
          res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
          res.setHeader('Content-Type', 'application/octet-stream');

          // Envoyer le fichier décompressé
          res.sendFile(tempPath, (err) => {
            // Nettoyer le fichier temporaire après envoi
            fsSync.unlink(tempPath, (unlinkErr) => {
              if (unlinkErr) {
                console.warn(`Erreur lors de la suppression du fichier temporaire: ${unlinkErr.message}`);
              }
            });

            if (err) {
              console.error(`Erreur lors de l'envoi du fichier: ${err.message}`);
              if (!res.headersSent) {
                return res.status(500).send("Erreur lors du téléchargement.");
              }
            }
          });

          return; // Ne pas appeler next() car nous avons géré la réponse

        } catch (decompressionError) {
          console.error(`Erreur lors de la décompression: ${decompressionError.message}`);

          // Fallback: essayer de servir le fichier original s'il existe
          if (originalExists) {
            return next();
          }

          return res.status(500).send("Erreur lors de la décompression du fichier.");
        }
      }

      // Si ni le fichier original ni le fichier compressé n'existent
      return res.status(404).send("Fichier non trouvé.");

    } catch (error) {
      console.error('Erreur dans le middleware de décompression:', error);
      return res.status(500).send("Erreur lors du traitement de la demande.");
    }
  }

  /**
   * Gère la création de dossiers avec compression des fichiers contenus
   * Adapte la logique existante de fs.mkdirSync pour les fichiers compressés
   * @param {string} folderPath - Chemin du dossier à créer
   * @param {Array<Object>} files - Liste des fichiers à traiter
   * @returns {Promise<Object>} Résultat de l'opération avec statistiques
   */
  async handleFolderCreation(folderPath, files) {
    try {
      // Corriger les duplications de chemin dans folderPath
      const baseDir = path.resolve("../partage");
      const correctedFolderPath = this._correctPathDuplication(folderPath, baseDir);

      // Créer la structure de dossiers racine
      await fs.mkdir(correctedFolderPath, { recursive: true });

      const results = {
        totalFiles: files.length,
        compressedFiles: 0,
        uncompressedFiles: 0,
        totalSpaceSaved: 0,
        foldersCreated: new Set(),
        errors: [],
        processedFiles: []
      };

      // Traiter chaque fichier dans le dossier
      for (const file of files) {
        try {
          // Use the new UploadPathResolver for folder uploads as well
          const fileForResolution = {
            originalname: file.name || file.originalname,
            webkitRelativePath: file.relativePath || file.webkitRelativePath
          };

          const pathResolution = this.uploadPathResolver.resolvePath(fileForResolution, correctedFolderPath, files);

          // Log path resolution details for debugging
          if (pathResolution.duplicationPrevented) {
            console.log(`Path duplication prevented in folder for ${file.name}: ${pathResolution.reasoning}`);
          }

          // Log any warnings from path resolution
          if (pathResolution.warnings && pathResolution.warnings.length > 0) {
            console.warn(`Path resolution warnings for folder file ${file.name}:`, pathResolution.warnings);
          }

          const filePath = pathResolution.finalPath;

          // Créer les sous-dossiers si nécessaire et tracker toute la hiérarchie
          const fileDir = path.dirname(filePath);
          if (fileDir !== correctedFolderPath) {
            // Utiliser la logique adaptée de fs.mkdirSync avec { recursive: true }
            await fs.mkdir(fileDir, { recursive: true });

            // Tracker tous les dossiers intermédiaires créés
            const relativeDirPath = path.relative(correctedFolderPath, fileDir);
            // Normaliser les séparateurs pour être cohérent avec les tests (utiliser '/')
            const normalizedPath = relativeDirPath.replace(/\\/g, '/');
            const pathParts = normalizedPath.split('/').filter(part => part.length > 0);

            // Ajouter chaque niveau de dossier à la liste des dossiers créés
            for (let i = 0; i < pathParts.length; i++) {
              const partialPath = pathParts.slice(0, i + 1).join('/');
              results.foldersCreated.add(partialPath);
            }
          }

          // Vérifier si le fichier doit être compressé
          if (this.shouldCompress(filePath, file.size)) {
            // Déplacer d'abord le fichier vers sa destination temporaire
            const tempDestPath = filePath + '.tmp';
            await fs.rename(file.tempPath || file.path, tempDestPath);

            // Ajouter la compression à la queue (non-bloquant)
            const taskId = `compress_folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const compressedPath = filePath + '.gz';

            // Démarrer la compression en arrière-plan
            this.compressionQueue.addTask({
              id: taskId,
              inputPath: tempDestPath,
              outputPath: compressedPath,
              options: {
                level: this.config.compressionLevel,
                algorithm: this.config.algorithm
              },
              compressionFunction: async (input, output, opts) => {
                return await this.compressionService.compressFile(input, output, opts);
              },
              metadata: {
                originalPath: filePath,
                fileSize: file.size,
                uploadTime: new Date(),
                folderUpload: true
              }
            }).then(async (compressionResult) => {
              // Compression réussie - sauvegarder les métadonnées
              if (this.metadataManager) {
                const checksum = await this.metadataManager.calculateChecksum(tempDestPath);
                const metadata = {
                  originalPath: filePath,
                  compressedPath: compressedPath,
                  isCompressed: true,
                  originalSize: compressionResult.originalSize || file.size,
                  compressedSize: compressionResult.compressedSize,
                  compressionRatio: compressionResult.compressionRatio,
                  algorithm: this.config.algorithm,
                  compressedAt: new Date(),
                  checksum: checksum
                };

                await this.metadataManager.saveMetadata(compressedPath, metadata);
              }

              // Enregistrer les statistiques de compression réussie
              this._recordCompressionStats(
                filePath,
                compressionResult.originalSize || file.size,
                compressionResult.compressedSize,
                true
              );

              // Supprimer le fichier temporaire après compression réussie
              await fs.unlink(tempDestPath);

            }).catch(async (compressionError) => {
              // En cas d'échec de compression, déplacer le fichier original
              console.warn(`Compression failed for ${filePath}: ${compressionError.message}`);

              // Enregistrer les statistiques d'échec de compression
              this._recordCompressionStats(filePath, file.size, file.size, false);

              // Déplacer le fichier temporaire vers la destination finale
              try {
                await fs.rename(tempDestPath, filePath);
              } catch (renameError) {
                console.error(`Failed to move file after compression failure: ${renameError.message}`);
              }
            });

            // Compter comme compressé (en queue) pour les statistiques immédiates
            results.compressedFiles++;
            results.processedFiles.push({
              originalPath: filePath,
              finalPath: compressedPath,
              compressed: 'queued',
              taskId: taskId,
              queuedAt: new Date()
            });

          } else {
            // Enregistrer les statistiques pour fichier non compressé
            this._recordCompressionStats(filePath, file.size, file.size, false);

            // Stocker sans compression
            await fs.rename(file.tempPath || file.path, filePath);
            results.uncompressedFiles++;
            results.processedFiles.push({
              originalPath: filePath,
              finalPath: filePath,
              compressed: false,
              reason: 'File does not meet compression criteria'
            });
          }

        } catch (fileError) {
          results.errors.push({
            file: file.name || 'unknown',
            error: fileError.message
          });
          results.processedFiles.push({
            originalPath: file.name || 'unknown',
            finalPath: null,
            compressed: false,
            error: fileError.message
          });
        }
      }

      // Convertir le Set en Array pour la sérialisation
      results.foldersCreated = Array.from(results.foldersCreated);

      return results;

    } catch (error) {
      throw new Error(`Erreur lors de la création du dossier: ${error.message}`);
    }
  }

  /**
   * Analyse la structure d'un dossier uploadé et prépare les fichiers pour traitement
   * @param {Array<Object>} multerFiles - Fichiers provenant de Multer
   * @returns {Object} Structure analysée avec hiérarchie de dossiers
   */
  analyzeFolderStructure(multerFiles) {
    const structure = {
      files: [],
      folders: new Set(),
      totalSize: 0,
      fileTypes: new Map()
    };

    for (const file of multerFiles) {
      const relativePath = file.webkitRelativePath || file.originalname;
      const pathParts = relativePath.split('/').filter(part => part.length > 0);

      // Ajouter tous les dossiers parents à la structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderPath = pathParts.slice(0, i + 1).join('/');
        structure.folders.add(folderPath);
      }

      // Analyser le fichier
      const fileExt = path.extname(file.originalname).toLowerCase();
      const fileSize = file.size || 0;

      structure.files.push({
        ...file,
        relativePath,
        pathParts,
        extension: fileExt,
        size: fileSize
      });

      structure.totalSize += fileSize;

      // Compter les types de fichiers
      const count = structure.fileTypes.get(fileExt) || 0;
      structure.fileTypes.set(fileExt, count + 1);
    }

    structure.folders = Array.from(structure.folders);

    return structure;
  }

  /**
   * Valide la structure d'un dossier avant traitement
   * @param {Object} folderStructure - Structure analysée du dossier
   * @returns {Object} Résultat de la validation avec warnings/erreurs
   */
  validateFolderStructure(folderStructure) {
    const validation = {
      isValid: true,
      warnings: [],
      errors: [],
      recommendations: []
    };

    // Vérifier la taille totale
    const maxTotalSize = this.config.maxFileSize * folderStructure.files.length;
    if (folderStructure.totalSize > maxTotalSize) {
      validation.warnings.push(`Taille totale importante: ${Math.round(folderStructure.totalSize / 1024 / 1024)}MB`);
    }

    // Vérifier le nombre de fichiers
    if (folderStructure.files.length > 1000) {
      validation.warnings.push(`Nombre de fichiers élevé: ${folderStructure.files.length}`);
    }

    // Vérifier la profondeur des dossiers - améliorer la logique pour gérer différents formats
    let maxDepth = 0;

    for (const file of folderStructure.files) {
      let depth = 0;

      if (file.pathParts && Array.isArray(file.pathParts)) {
        // Utiliser pathParts si disponible
        depth = file.pathParts.length;
      } else {
        // Fallback: calculer la profondeur à partir du nom de fichier ou relativePath
        const filePath = file.relativePath || file.webkitRelativePath || file.originalname || file.name || '';
        const pathParts = filePath.split('/').filter(part => part.length > 0);
        depth = pathParts.length;
      }

      maxDepth = Math.max(maxDepth, depth);
    }

    if (maxDepth > 5) {
      validation.warnings.push(`Hiérarchie de dossiers profonde: ${maxDepth} niveaux`);
    }

    // Analyser les types de fichiers pour recommandations
    const compressibleFiles = folderStructure.files.filter(f =>
      this.config.isCompressible(f.originalname) &&
      this.config.isValidSize(f.size)
    );

    if (compressibleFiles.length > 0) {
      const compressionRatio = compressibleFiles.length / folderStructure.files.length;
      validation.recommendations.push(
        `${compressibleFiles.length}/${folderStructure.files.length} fichiers seront compressés (${Math.round(compressionRatio * 100)}%)`
      );
    }

    return validation;
  }

  /**
   * Gets path resolver performance metrics
   * @returns {Object} Path resolver performance metrics
   */
  getPathResolverMetrics() {
    return this.uploadPathResolver.getPerformanceMetrics();
  }

  /**
   * Resets path resolver performance metrics
   */
  resetPathResolverMetrics() {
    this.uploadPathResolver.resetPerformanceMetrics();
  }

  /**
   * Vérifie si un fichier doit être compressé selon la configuration
   * @param {string} filePath - Chemin du fichier
   * @param {number} fileSize - Taille du fichier en bytes
   * @returns {boolean} True si le fichier doit être compressé
   */
  shouldCompress(filePath, fileSize) {
    // Vérifier la taille du fichier
    if (!this.config.isValidSize(fileSize)) {
      return false;
    }

    // Vérifier si le type de fichier est compressible
    if (!this.config.isCompressible(filePath)) {
      return false;
    }

    // Vérifier si le fichier n'est pas déjà compressé
    if (this.compressionService.isCompressed(filePath)) {
      return false;
    }

    return true;
  }

  /**
   * Crée un middleware Express pour l'upload avec compression
   * @returns {Function} Middleware Express
   */
  createUploadMiddleware() {
    return (req, res, next) => {
      this.handleUpload(req, res, next).catch(next);
    };
  }

  /**
   * Crée un middleware Express pour le download avec décompression
   * @returns {Function} Middleware Express
   */
  createDownloadMiddleware() {
    return (req, res, next) => {
      this.handleDownload(req, res, next).catch(next);
    };
  }

  /**
   * Corrige les duplications de chemin dans le dossier de destination
   * @param {string} destFolder - Dossier de destination potentiellement dupliqué
   * @param {string} baseDir - Dossier de base
   * @returns {string} Chemin corrigé sans duplications
   * @private
   */
  _correctPathDuplication(destFolder, baseDir) {
    try {
      // Normaliser les séparateurs de chemin pour la comparaison
      const normalizedDestFolder = destFolder.replace(/\\/g, '/');
      const normalizedBaseDir = baseDir.replace(/\\/g, '/');

      // Vérifier si destFolder commence par baseDir
      if (!normalizedDestFolder.startsWith(normalizedBaseDir)) {
        console.warn(`destFolder does not start with baseDir: ${destFolder}`);
        return destFolder;
      }

      // Si destFolder est exactement baseDir, pas de correction nécessaire
      if (normalizedDestFolder === normalizedBaseDir) {
        return baseDir;
      }

      // Extraire la partie relative en supprimant baseDir du début
      let relativePart = normalizedDestFolder.substring(normalizedBaseDir.length);

      // Supprimer le slash de début s'il existe
      if (relativePart.startsWith('/')) {
        relativePart = relativePart.substring(1);
      }

      // Si pas de partie relative, retourner baseDir
      if (!relativePart) {
        return baseDir;
      }

      // Diviser en segments
      const segments = relativePart.split('/').filter(segment => segment.length > 0);

      if (segments.length === 0) {
        return baseDir;
      }

      // Détecter et supprimer les duplications consécutives
      const cleanedSegments = [];
      let hasConsecutiveDuplication = false;
      
      for (let i = 0; i < segments.length; i++) {
        const currentSegment = segments[i];
        const previousSegment = segments[i - 1];

        // Ignorer les segments dupliqués consécutifs
        if (currentSegment !== previousSegment) {
          cleanedSegments.push(currentSegment);
        } else {
          console.log(`Consecutive duplication detected and removed: ${currentSegment}`);
          hasConsecutiveDuplication = true;
        }
      }

      // Détecter les patterns de duplication plus complexes (ex: /users/john/users/john/)
      const furtherCleanedSegments = this._removePatternDuplications(cleanedSegments);
      const hasPatternDuplication = JSON.stringify(furtherCleanedSegments) !== JSON.stringify(cleanedSegments);

      // Si aucune duplication n'a été trouvée, retourner le chemin original
      if (!hasConsecutiveDuplication && !hasPatternDuplication) {
        return destFolder;
      }

      // Reconstruire le chemin corrigé seulement si des duplications ont été trouvées
      if (furtherCleanedSegments.length === 0) {
        return baseDir;
      }

      // Utiliser path.join pour reconstruire le chemin avec les séparateurs appropriés du système
      const correctedPath = path.join(baseDir, ...furtherCleanedSegments);

      // Log si une correction a été appliquée
      console.log(`Path corrected: ${destFolder} -> ${correctedPath}`);

      return correctedPath;

    } catch (error) {
      console.warn(`Error correcting path duplication: ${error.message}, using original path`);
      return destFolder;
    }
  }

  /**
   * Supprime les patterns de duplication plus complexes dans les segments de chemin
   * @param {Array<string>} segments - Segments de chemin
   * @returns {Array<string>} Segments nettoyés
   * @private
   */
  _removePatternDuplications(segments) {
    if (segments.length < 4) {
      return segments;
    }

    // Chercher des patterns comme [users, john, users, john]
    for (let i = 0; i < segments.length - 1; i++) {
      for (let j = i + 2; j < segments.length - 1; j++) {
        // Vérifier si on a un pattern de duplication
        if (segments[i] === segments[j] && segments[i + 1] === segments[j + 1]) {
          console.log(`Pattern duplication detected and removed: ${segments[i]}/${segments[i + 1]}`);

          // Supprimer la duplication en gardant la première occurrence
          const cleanedSegments = [
            ...segments.slice(0, j),
            ...segments.slice(j + 2)
          ];

          // Récursion pour détecter d'autres patterns
          return this._removePatternDuplications(cleanedSegments);
        }
      }
    }

    return segments;
  }

  /**
   * Enregistre les statistiques de compression si un collecteur est configuré
   * @param {string} filePath - Chemin du fichier
   * @param {number} originalSize - Taille originale
   * @param {number} compressedSize - Taille compressée
   * @param {boolean} success - Succès de l'opération
   * @private
   */
  _recordCompressionStats(filePath, originalSize, compressedSize, success) {
    if (this.stats) {
      const fileType = path.extname(filePath).toLowerCase();
      this.stats.recordCompression({
        filePath,
        originalSize,
        compressedSize,
        fileType,
        success
      });

      // Sauvegarder les statistiques de manière asynchrone (sans bloquer)
      this._saveStatsAsync();
    }
  }

  /**
   * Sauvegarde les statistiques de manière asynchrone
   * @private
   */
  _saveStatsAsync() {
    if (this.stats && !this._savingStats) {
      this._savingStats = true;

      // Utiliser un délai pour éviter de sauvegarder trop fréquemment
      if (this._saveStatsTimeout) {
        clearTimeout(this._saveStatsTimeout);
      }

      this._saveStatsTimeout = setTimeout(async () => {
        try {
          const path = require('path');
          const statsPath = path.join(__dirname, '..', '..', 'temp', 'compression-stats.json');
          await this.stats.saveToFile(statsPath);
        } catch (error) {
          console.error('Erreur lors de la sauvegarde des statistiques:', error.message);
        } finally {
          this._savingStats = false;
        }
      }, 2000); // Sauvegarder après 2 secondes d'inactivité
    }
  }

  /**
   * Obtient le statut d'une tâche de compression
   * @param {string} taskId - Identifiant de la tâche
   * @returns {Object|null} Statut de la tâche
   */
  getCompressionTaskStatus(taskId) {
    return this.compressionQueue.getTaskStatus(taskId);
  }

  /**
   * Obtient les statistiques de la queue de compression
   * @returns {Object} Statistiques de la queue
   */
  getCompressionQueueStats() {
    return this.compressionQueue.getStats();
  }

  /**
   * Pause la queue de compression
   */
  pauseCompressionQueue() {
    this.compressionQueue.pause();
  }

  /**
   * Reprend la queue de compression
   */
  resumeCompressionQueue() {
    this.compressionQueue.resume();
  }

  /**
   * Vide la queue de compression (annule toutes les tâches en attente)
   * @returns {number} Nombre de tâches annulées
   */
  clearCompressionQueue() {
    return this.compressionQueue.clear();
  }

  /**
   * Arrête proprement la queue de compression
   * @returns {Promise<void>}
   */
  async shutdownCompressionQueue() {
    await this.compressionQueue.shutdown();
  }

  /**
   * Obtient les statistiques de performance du streaming
   * @returns {Object} Statistiques de streaming
   */
  getStreamingStats() {
    return this.compressionService.getStreamingStats();
  }

  /**
   * Réinitialise les statistiques de streaming
   */
  resetStreamingStats() {
    this.compressionService.resetStreamingStats();
  }
}

module.exports = FileStorageMiddleware;