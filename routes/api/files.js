const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../tmp_uploads') });

// Réutiliser les services existants
const CompressionService = require('../../lib/compression/CompressionService');
const compressionService = new CompressionService();
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const compressionConfig = global.compressionConfig || new (require('../../lib/compression/CompressionConfig'))();
const compressionStats = global.compressionStats || new (require('../../lib/compression/CompressionStats'))();

const fileStorageMiddleware = new FileStorageMiddleware(compressionService, compressionConfig, compressionStats);

// Dossier de base pour les fichiers partagés
const baseDir = path.resolve("../partage");

// Middleware pour vérifier l'authentification (optionnel, à adapter selon tes besoins)
const ensureAuthenticated = require('../index').ensureAuthenticated;

// GET /api/files - Liste les fichiers disponibles
router.get('/', ensureAuthenticated('user'), async (req, res) => {
  try {
    const user = req.session.user;
    let userDir = baseDir;
    
    if (user.role === 'admin') {
      // Admin voit tout
    } else {
      // Utilisateur normal : restreint à son dossier
      userDir = path.join(baseDir, 'users', user.username);
    }
    
    const files = fs.readdirSync(userDir)
      .filter(f => !f.endsWith('.meta') && !f.endsWith('.gz'))
      .map(f => {
        const fullPath = path.join(userDir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          size: stat.size,
          mtime: stat.mtime,
          isDirectory: stat.isDirectory()
        };
      });
    
    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la lecture des fichiers." });
  }
});

// GET /api/files/:filename - Télécharge un fichier
router.get('/:filename', ensureAuthenticated('user'), (req, res) => {
  const user = req.session.user;
  let userDir = baseDir;
  
  if (user.role !== 'admin') {
    userDir = path.join(baseDir, 'users', user.username);
  }
  
  const filePath = path.join(userDir, req.params.filename);
  if (!filePath.startsWith(userDir) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier non trouvé." });
  }
  
  res.sendFile(filePath);
});

// POST /api/files - Upload un fichier
router.post('/', ensureAuthenticated('user'), upload.single('file'), fileStorageMiddleware.createUploadMiddleware(), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier uploadé." });
  }
  
  if (req.compressionResults) {
    const compressedCount = req.compressionResults.filter(r => r.compressed).length;
    console.log(`Fichiers compressés : ${compressedCount}/${req.compressionResults.length}`);
  }
  
  res.status(201).json({ message: "Fichier uploadé avec succès." });
});

// DELETE /api/files/:filename - Supprime un fichier
router.delete('/:filename', ensureAuthenticated('user'), (req, res) => {
  const user = req.session.user;
  let userDir = baseDir;
  
  if (user.role !== 'admin') {
    userDir = path.join(baseDir, 'users', user.username);
  }
  
  const filePath = path.join(userDir, req.params.filename);
  if (!filePath.startsWith(userDir) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier non trouvé." });
  }
  
  fs.unlinkSync(filePath);
  res.json({ message: "Fichier supprimé avec succès." });
});

module.exports = router;