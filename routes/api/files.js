const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');
const router = express.Router();
const upload = multer({ dest: path.join(__dirname, '../../tmp_uploads') });

// Clé secrète pour vérifier les tokens (doit être la même que dans auth.js)
const JWT_SECRET = process.env.JWT_SECRET || 'ta_cle_secrete_ici';

// Réutiliser les services existants
const CompressionService = require('../../lib/compression/CompressionService');
const compressionService = new CompressionService();
const FileStorageMiddleware = require('../../lib/compression/FileStorageMiddleware');
const compressionConfig = global.compressionConfig || new (require('../../lib/compression/CompressionConfig'))();
const compressionStats = global.compressionStats || new (require('../../lib/compression/CompressionStats'))();

const fileStorageMiddleware = new FileStorageMiddleware(compressionService, compressionConfig, compressionStats);

// Dossier de base pour les fichiers partagés
const baseDir = path.resolve("../partage");

// Middleware pour vérifier le token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// GET /api/files - Liste les fichiers disponibles
router.get('/', authenticateToken, async (req, res) => {
  try {
    let userDir = baseDir;
    
    if (req.user.role !== 'admin') {
      // Utilisateur normal : restreint à son dossier
      userDir = path.join(baseDir, 'users', req.user.username);
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
router.get('/:filename', authenticateToken, (req, res) => {
  let userDir = baseDir;
  
  if (req.user.role !== 'admin') {
    userDir = path.join(baseDir, 'users', req.user.username);
  }
  
  const filePath = path.join(userDir, req.params.filename);
  if (!filePath.startsWith(userDir) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier non trouvé." });
  }
  
  res.sendFile(filePath);
});

// POST /api/files - Upload un fichier
router.post('/', authenticateToken, upload.single('file'), fileStorageMiddleware.createUploadMiddleware(), (req, res) => {
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
router.delete('/:filename', authenticateToken, (req, res) => {
  let userDir = baseDir;
  
  if (req.user.role !== 'admin') {
    userDir = path.join(baseDir, 'users', req.user.username);
  }
  
  const filePath = path.join(userDir, req.params.filename);
  if (!filePath.startsWith(userDir) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier non trouvé." });
  }
  
  fs.unlinkSync(filePath);
  res.json({ message: "Fichier supprimé avec succès." });
});

module.exports = router;