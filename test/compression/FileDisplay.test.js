const fs = require('fs');
const path = require('path');
const request = require('supertest');
const express = require('express');

// Mock des modules de compression
const CompressionService = require('../../lib/compression/CompressionService');
const CompressionConfig = require('../../lib/compression/CompressionConfig');
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const FileMetadataManager = require('../../lib/compression/FileMetadataManager');

describe('File Display with Compression', () => {
  let testDir;
  let app;
  let compressionService;
  let fileStorageMiddleware;
  let metadataManager;

  beforeEach(() => {
    // Créer un dossier de test temporaire
    testDir = path.join(__dirname, '../temp/file-display-test');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Initialiser les services
    const config = new CompressionConfig();
    compressionService = new CompressionService();
    fileStorageMiddleware = new FileStorageMiddleware(compressionService, config);
    metadataManager = new FileMetadataManager();

    // Créer une app Express simple pour les tests
    app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../../views'));
  });

  afterEach(() => {
    // Nettoyer le dossier de test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('File filtering and display', () => {
    test('should hide .gz files and show original names', async () => {
      // Créer des fichiers de test
      const originalFile = path.join(testDir, 'test.txt');
      const compressedFile = path.join(testDir, 'test.txt.gz');
      const metaFile = path.join(testDir, 'test.txt.meta');
      const normalFile = path.join(testDir, 'normal.txt');

      // Créer le fichier original et le compresser
      fs.writeFileSync(originalFile, 'Test content for compression');
      await compressionService.compressFile(originalFile, compressedFile);
      
      // Créer les métadonnées
      const metadata = {
        originalPath: originalFile,
        compressedPath: compressedFile,
        isCompressed: true,
        originalSize: fs.statSync(originalFile).size,
        compressedSize: fs.statSync(compressedFile).size,
        compressionRatio: 0.5,
        algorithm: 'gzip',
        compressedAt: new Date(),
        checksum: 'test-checksum'
      };
      await metadataManager.saveMetadata(originalFile, metadata);

      // Supprimer le fichier original (simuler compression complète)
      fs.unlinkSync(originalFile);

      // Créer un fichier normal
      fs.writeFileSync(normalFile, 'Normal file content');

      // Simuler la fonction getFilesInDir modifiée
      const files = fs.readdirSync(testDir, { withFileTypes: true });
      const processedFiles = [];
      const seenFiles = new Set();

      for (const file of files) {
        const fullPath = path.join(testDir, file.name);
        
        // Ignorer les fichiers .meta
        if (file.name.endsWith('.meta')) {
          continue;
        }

        // Si c'est un fichier compressé (.gz)
        if (file.name.endsWith('.gz')) {
          const originalName = file.name.slice(0, -3);
          
          if (seenFiles.has(originalName)) {
            continue;
          }
          seenFiles.add(originalName);

          try {
            const loadedMetadata = await metadataManager.loadMetadata(path.join(testDir, originalName));
            const stats = fs.statSync(fullPath);
            
            processedFiles.push({
              name: originalName,
              fullPath: path.join(testDir, originalName),
              isDirectory: false,
              isFile: true,
              size: loadedMetadata ? loadedMetadata.originalSize : stats.size,
              mtime: stats.mtime,
              isCompressed: true
            });
          } catch (error) {
            // Fallback en cas d'erreur
            const stats = fs.statSync(fullPath);
            processedFiles.push({
              name: originalName,
              fullPath: path.join(testDir, originalName),
              isDirectory: false,
              isFile: true,
              size: stats.size,
              mtime: stats.mtime,
              isCompressed: true
            });
          }
          continue;
        }

        // Fichier normal
        if (file.isFile()) {
          const compressedPath = fullPath + '.gz';
          const hasCompressedVersion = fs.existsSync(compressedPath);
          
          if (hasCompressedVersion) {
            continue; // Ignorer si version compressée existe
          }
          
          if (seenFiles.has(file.name)) {
            continue;
          }
          seenFiles.add(file.name);

          const stats = fs.statSync(fullPath);
          processedFiles.push({
            name: file.name,
            fullPath: fullPath,
            isDirectory: false,
            isFile: true,
            size: stats.size,
            mtime: stats.mtime,
            isCompressed: false
          });
        }
      }

      // Vérifications
      expect(processedFiles).toHaveLength(2); // test.txt (compressé) + normal.txt
      
      const compressedFileEntry = processedFiles.find(f => f.name === 'test.txt');
      expect(compressedFileEntry).toBeDefined();
      expect(compressedFileEntry.isCompressed).toBe(true);
      expect(compressedFileEntry.size).toBe(metadata.originalSize); // Taille originale
      
      const normalFileEntry = processedFiles.find(f => f.name === 'normal.txt');
      expect(normalFileEntry).toBeDefined();
      expect(normalFileEntry.isCompressed).toBe(false);

      // Vérifier qu'aucun fichier .gz ou .meta n'est visible
      expect(processedFiles.find(f => f.name.endsWith('.gz'))).toBeUndefined();
      expect(processedFiles.find(f => f.name.endsWith('.meta'))).toBeUndefined();
    });

    test('should preserve folder structure', async () => {
      // Créer une structure de dossiers
      const subDir = path.join(testDir, 'subfolder');
      fs.mkdirSync(subDir, { recursive: true });
      
      const fileInSubdir = path.join(subDir, 'file-in-subdir.txt');
      fs.writeFileSync(fileInSubdir, 'Content in subdirectory');

      // Simuler la lecture des fichiers
      const files = fs.readdirSync(testDir, { withFileTypes: true });
      const processedFiles = [];

      for (const file of files) {
        if (file.isDirectory()) {
          const stats = fs.statSync(path.join(testDir, file.name));
          processedFiles.push({
            name: file.name,
            fullPath: path.join(testDir, file.name),
            isDirectory: true,
            isFile: false,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      }

      // Vérifications
      expect(processedFiles).toHaveLength(1);
      expect(processedFiles[0].name).toBe('subfolder');
      expect(processedFiles[0].isDirectory).toBe(true);
    });

    test('should handle files without metadata gracefully', async () => {
      // Créer un fichier compressé sans métadonnées
      const originalFile = path.join(testDir, 'no-metadata.txt');
      const compressedFile = path.join(testDir, 'no-metadata.txt.gz');

      fs.writeFileSync(originalFile, 'Test content');
      await compressionService.compressFile(originalFile, compressedFile);
      fs.unlinkSync(originalFile); // Supprimer l'original

      // Simuler le traitement sans métadonnées
      const files = fs.readdirSync(testDir, { withFileTypes: true });
      const processedFiles = [];

      for (const file of files) {
        if (file.name.endsWith('.gz')) {
          const originalName = file.name.slice(0, -3);
          
          try {
            // Essayer de charger les métadonnées (qui n'existent pas)
            await metadataManager.loadMetadata(path.join(testDir, originalName));
          } catch (error) {
            // Fallback: utiliser les stats du fichier compressé
            const stats = fs.statSync(path.join(testDir, file.name));
            processedFiles.push({
              name: originalName,
              fullPath: path.join(testDir, originalName),
              isDirectory: false,
              isFile: true,
              size: stats.size, // Taille compressée comme fallback
              mtime: stats.mtime,
              isCompressed: true
            });
          }
        }
      }

      // Vérifications
      expect(processedFiles).toHaveLength(1);
      expect(processedFiles[0].name).toBe('no-metadata.txt');
      expect(processedFiles[0].isCompressed).toBe(true);
    });
  });
});