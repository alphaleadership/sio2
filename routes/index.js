// Dossier corbeille (non visible)

var express = require('express');
var router = express.Router();
const path = require("path");
const fs = require("fs");
const baseDir = path.resolve("../partage");
const multer = require('multer');
const upload = multer({ dest: path.join(baseDir, '..', 'tmp_uploads') }); // dossier temporaire pour upload
// dossier temporaire pour upload
// Initialisation du système de compression
const CompressionService = require('../lib/compression/CompressionService');
const CompressionConfig = require('../lib/compression/CompressionConfig');
const CompressionStats = require('../lib/compression/CompressionStats');
const FileStorageMiddleware = require('../lib/compression/FileStorageMiddleware');

// Créer les instances des services de compression
// Utiliser la configuration globale si disponible, sinon créer une instance par défaut
const compressionConfig = global.compressionConfig || new CompressionConfig();
const compressionService = new CompressionService();

// Initialiser le système de statistiques
let compressionStats = new CompressionStats(); // Instance par défaut immédiate

async function initializeCompressionStats() {
  try {
    const statsPath = path.join(__dirname, '..', 'temp', 'compression-stats.json');
    const loadedStats = await CompressionStats.loadFromFile(statsPath);

    // Remplacer l'instance par défaut par les statistiques chargées
    compressionStats = loadedStats;

    // Mettre à jour la référence dans le middleware
    if (fileStorageMiddleware) {
      fileStorageMiddleware.stats = compressionStats;
    }

    console.log('Statistiques de compression chargées:', {
      totalFilesProcessed: compressionStats.stats.totalFilesProcessed,
      totalFilesCompressed: compressionStats.stats.totalFilesCompressed,
      totalSpaceSaved: compressionStats.getFormattedSpaceSaved()
    });
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error.message);
    // Garder l'instance par défaut
  }
}

// Initialiser les statistiques de manière asynchrone
initializeCompressionStats().catch(console.error);

// Fonction pour sauvegarder les statistiques
async function saveCompressionStats() {
  if (compressionStats) {
    try {
      const statsPath = path.join(__dirname, '..', 'temp', 'compression-stats.json');
      await compressionStats.saveToFile(statsPath);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des statistiques:', error.message);
    }
  }
}

// Sauvegarder les statistiques toutes les 5 minutes
setInterval(saveCompressionStats, 5 * 60 * 1000);

// Sauvegarder les statistiques lors de l'arrêt de l'application
process.on('SIGINT', async () => {
  console.log('Sauvegarde des statistiques avant fermeture...');
  await saveCompressionStats();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Sauvegarde des statistiques avant fermeture...');
  await saveCompressionStats();
  process.exit(0);
});

// Créer le middleware avec les statistiques (sera mis à jour quand les stats seront chargées)
const fileStorageMiddleware = new FileStorageMiddleware(compressionService, compressionConfig, compressionStats);

router.post('/upload', upload.array('file'), fileStorageMiddleware.createUploadMiddleware(), function (req, res, next) {
  // Le middleware de compression a déjà traité les fichiers
  // Les résultats sont disponibles dans req.compressionResults

  if (req.compressionResults) {
    const hasErrors = req.compressionResults.some(result => result.error);
    if (hasErrors) {
      console.warn('Some files had compression errors:', req.compressionResults.filter(r => r.error));
    }

    const compressedCount = req.compressionResults.filter(r => r.compressed).length;
    const totalCount = req.compressionResults.length;

    if (compressedCount > 0) {
      console.log(`Successfully compressed ${compressedCount}/${totalCount} files`);
    }

    // Afficher les statistiques de dossier si disponibles
    if (req.folderStats) {
      console.log(`Folder upload processed: ${req.folderStats.totalFiles} files, ${req.folderStats.foldersCreated.length} folders created`);
      if (req.folderStats.totalSpaceSaved > 0) {
        console.log(`Space saved: ${Math.round(req.folderStats.totalSpaceSaved / 1024)}KB`);
      }
    }

    // Afficher les avertissements de validation si disponibles
    if (req.folderValidation && req.folderValidation.warnings.length > 0) {
      console.warn('Folder validation warnings:', req.folderValidation.warnings);
    }
  }

  res.redirect(req.get('referer') || '/');
});
/* GET home page. */

// Dossier global partagé
const globalShareDir = path.join(baseDir, 'global');
if (!fs.existsSync(globalShareDir)) fs.mkdirSync(globalShareDir, { recursive: true });

router.get('/', userAuth(), function (req, res, next) {
  let rootChoices = [];
  let userDir = baseDir;
  let relBase = '';
  let isRoot = false;
  if (req.session.user && req.session.user.role === 'user') {
    // Racine : choix entre "Mon dossier" et "Partage global"
    if (!req.query.path || req.query.path === '' || req.query.path === '/') {
      isRoot = true;
      rootChoices = [
        { name: 'Mon dossier', path: '/users/' + req.session.user.username },
        { name: 'Partage global', path: '/global' }
      ];
    }
    // Navigation dans le dossier perso
    if (req.query.path && req.query.path.startsWith('/users/' + req.session.user.username)) {
      userDir = path.join(baseDir, 'users', req.session.user.username);
      relBase = '/users/' + req.session.user.username;
      const subPath = req.query.path.replace(relBase, '').replace(/^\/+/, '');
      const reqPath = subPath ? path.join(userDir, subPath) : userDir;
      if (!reqPath.startsWith(userDir)) return res.status(400).send('Chemin invalide.');
      return renderFiles(req, res, reqPath, baseDir, relBase);
    }
    // Navigation dans le partage global
    if (req.query.path && req.query.path.startsWith('/global')) {
      const subPath = req.query.path.replace(/^\/+/, '').replace("/global", "");
      const reqPath = subPath ? path.join(globalShareDir, subPath) : globalShareDir;
      if (!reqPath.startsWith(globalShareDir)) return res.status(400).send('Chemin invalide.');
      return renderFiles(req, res, reqPath, baseDir, '');
    }
    // Sinon, affiche le choix racine
    if (isRoot) {
      return res.render('index', { title: 'Explorateur de fichiers', files: [], path: '/', user: req.session.user, rootChoices });
    }
    // Empêche d'accéder à d'autres partages
    return res.redirect('/');
  }
  // Admin : accès complet
  const reqPath = req.query.path ? path.join(baseDir, req.query.path) : baseDir;
  if (!reqPath.startsWith(baseDir)) return res.status(400).send('Chemin invalide.');
  renderFiles(req, res, reqPath, baseDir, '');
});

function renderFiles(req, res, reqPath, userDir, relBase) {
  async function getFilesInDir(dirPath, relPath = "") {
    console.log(dirPath)
    console.log(relPath)
    const files = fs.readdirSync(dirPath.replace("global/global", "global"), { withFileTypes: true });
    const processedFiles = [];
    const seenFiles = new Set(); // Pour éviter les doublons

    for (const file of files) {
      const fullPath = path.join(dirPath.replace("global/global", "global"), file.name);
      const relativePath = path.join(relPath.replace("global/global", "global"), file.name);

      // Ignorer les fichiers .meta (métadonnées de compression)
      if (file.name.endsWith('.meta')) {
        continue;
      }

      // Si c'est un dossier, l'ajouter directement
      if (file.isDirectory()) {
        const stats = fs.statSync(fullPath);
        processedFiles.push({
          name: relativePath.replace(/\\/g, '/'),
          fullPath: fullPath,
          relativePath: relativePath,
          isDirectory: true,
          isFile: false,
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime,
          atime: stats.atime,
          mode: stats.mode
        });
        continue;
      }

      // Si c'est un fichier compressé (.gz)
      if (file.name.endsWith('.gz')) {
        const originalName = file.name.slice(0, -3); // Enlever l'extension .gz
        const originalPath = path.join(path.dirname(fullPath), originalName);
        const originalRelativePath = path.join(path.dirname(relativePath), originalName);

        // Éviter les doublons si le fichier original existe aussi
        if (seenFiles.has(originalName)) {
          continue;
        }
        seenFiles.add(originalName);

        try {
          // Essayer de charger les métadonnées pour obtenir la taille originale
          const FileMetadataManager = require('../lib/compression/FileMetadataManager');
          const metadataManager = new FileMetadataManager();
          const metadata = await metadataManager.loadMetadata(originalPath);

          const stats = fs.statSync(fullPath);

          processedFiles.push({
            name: originalRelativePath.replace(/\\/g, '/'),
            fullPath: originalPath, // Utiliser le chemin original pour les liens
            relativePath: originalRelativePath,
            isDirectory: false,
            isFile: true,
            size: metadata ? metadata.originalSize : stats.size, // Taille originale si disponible
            mtime: stats.mtime,
            ctime: stats.ctime,
            atime: stats.atime,
            mode: stats.mode,
            isCompressed: true // Marquer comme compressé pour information
          });
        } catch (error) {
          // En cas d'erreur, afficher avec les stats du fichier compressé
          const stats = fs.statSync(fullPath);
          processedFiles.push({
            name: originalRelativePath.replace(/\\/g, '/'),
            fullPath: originalPath,
            relativePath: originalRelativePath,
            isDirectory: false,
            isFile: true,
            size: stats.size,
            mtime: stats.mtime,
            ctime: stats.ctime,
            atime: stats.atime,
            mode: stats.mode,
            isCompressed: true
          });
        }
        continue;
      }

      // Fichier normal (non compressé)
      const originalName = file.name;

      // Vérifier s'il existe une version compressée
      const compressedPath = fullPath + '.gz';
      const hasCompressedVersion = fs.existsSync(compressedPath);

      // Si une version compressée existe, ignorer le fichier original
      if (hasCompressedVersion) {
        continue;
      }

      // Éviter les doublons
      if (seenFiles.has(originalName)) {
        continue;
      }
      seenFiles.add(originalName);

      const stats = fs.statSync(fullPath);
      processedFiles.push({
        name: relativePath.replace(/\\/g, '/'),
        fullPath: fullPath,
        relativePath: relativePath,
        isDirectory: false,
        isFile: true,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        atime: stats.atime,
        mode: stats.mode,
        isCompressed: false
      });
    }

    return processedFiles;
  }

  // Rendre la fonction asynchrone pour gérer les métadonnées
  (async () => {
    let files = [];
    try {
      const relPath = path.relative(userDir, reqPath);
      console.log(relPath)
      console.log(reqPath)
      files = await getFilesInDir(reqPath, relPath);
      console.log(files)
    } catch (err) {
      console.log(err);
      return res.status(500).send("Erreur lors de la lecture du dossier.");
    }
    res.render('index', { title: 'Explorateur de fichiers', files: files, path: reqPath.replace(userDir, relBase).replace(/\\/g, '/'), user: req.session.user });
  })();
}

const trashDir = path.join(baseDir, '..', '..', '.corbeille');
if (!fs.existsSync(trashDir)) {
  fs.mkdirSync(trashDir, { recursive: true });
}

// --- Authentification utilisateurs (admin et non-admin) ---
const usersPath = path.resolve(__dirname, '../users.json');
let users = [];
function loadUsers() {
  try {
    users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  } catch (e) {
    users = [];
  }
}
loadUsers();

function userAuth(role = null) {
  return function (req, res, next) {
    if (req.session && req.session.user) {
      if (!role || req.session.user.role === role) return next();
      return res.status(403).send('Accès interdit.');
    }
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
      if (req.accepts('html')) return res.redirect('/login');
      res.set('WWW-Authenticate', 'Basic realm="User Area"');
      return res.status(401).send('Authentification requise');
    }
    const b64 = auth.split(' ')[1];
    const [username, password] = Buffer.from(b64, 'base64').toString().split(':');
    const user = users.find(u => u.username === username && u.password === password);
    if (user && (!role || user.role === role)) {
      if (req.session) req.session.user = { username: user.username, role: user.role };
      // Crée le dossier perso si non existant
      //if (user.role === 'user') {
      const userDir = path.join(baseDir, 'users', user.username);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

      return next();
    }
    if (req.accepts('html')) return res.redirect('/');
    res.set('WWW-Authenticate', 'Basic realm="User Area"');
    return res.status(401).send('Accès refusé');
  }
}

// Pour compatibilité, alias adminAuth
const adminAuth = userAuth('admin');

// Vue de login générique
router.get('/login', function (req, res) {
  res.render('login');
});
// Route pour afficher le formulaire d'inscription
router.get('/register', function (req, res) {
  res.render('register');
});

// Route pour traiter l'inscription
router.post('/register', express.urlencoded({ extended: true }), function (req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Nom d\'utilisateur et mot de passe requis');
  }
  // Charger les utilisateurs existants
  let users = [];
  try {
    users = JSON.parse(fs.readFileSync(path.join(__dirname, '../users.json')));
  } catch (e) { }
  if (users.find(u => u.username === username)) {
    return res.status(400).send('Nom d\'utilisateur déjà utilisé');
  }
  users.push({ username: username, password: password, role: 'user' });
  fs.writeFileSync(path.join(__dirname, '../users.json'), JSON.stringify(users, null, 2));
  res.redirect('/login');
});

// --- Route admin : liste des fichiers dans la corbeille ---
router.get('/admin/trash', adminAuth, function (req, res) {
  try {
    const files = fs.readdirSync(trashDir)
      .filter(f => fs.statSync(path.join(trashDir, f)).isFile())
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(trashDir, f)).mtime,
        size: fs.statSync(path.join(trashDir, f)).size
      }));
    res.render('trash', { title: 'Corbeille', files });
  } catch (e) {
    res.status(500).send('Erreur lecture corbeille');
  }
});

// --- Route admin : restauration d'un fichier de la corbeille ---
router.post('/admin/restore', adminAuth, function (req, res) {
  const trashFile = req.body.file;
  if (!trashFile) return res.status(400).send('Fichier non spécifié.');
  const absTrashFile = path.join(trashDir, trashFile);
  if (!absTrashFile.startsWith(trashDir) || !fs.existsSync(absTrashFile)) {
    return res.status(404).send('Fichier non trouvé dans la corbeille.');
  }
  // Retrouver le nom original (après le timestamp)
  const origName = trashFile.replace(/^\d+_/, '');
  const destPath = path.join(baseDir, origName);
  // Créer dossier si besoin
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    fs.renameSync(absTrashFile, destPath);
    res.redirect('/admin/trash');
  } catch (e) {
    res.status(500).send('Erreur restauration.');
  }
});

// Route pour supprimer (déplacer) un fichier dans la corbeille
router.post('/delete', function (req, res, next) {
  const relFile = req.body.file;
  if (!relFile) return res.status(400).send('Fichier non spécifié.');
  const absFile = path.join(baseDir, relFile);
  if (!absFile.startsWith(baseDir)) return res.status(400).send('Chemin invalide.');
  if (!fs.existsSync(absFile)) return res.status(404).send('Fichier non trouvé.');
  // Empêcher suppression de la corbeille elle-même
  if (absFile.startsWith(trashDir)) return res.status(400).send('Action interdite.');
  // Générer un nom unique dans la corbeille
  const fileName = path.basename(absFile);
  const trashPath = path.join(trashDir, Date.now() + '_' + fileName);
  fs.rename(absFile, trashPath, (err) => {
    if (err) return res.status(500).send('Erreur lors du déplacement.');
    res.redirect(req.get('referer') || '/');
  });
});
// Route de téléchargement de fichier avec décompression automatique
router.get('/download', fileStorageMiddleware.createDownloadMiddleware(), function (req, res, next) {
  const reqFile = req.query.file ? path.join(baseDir, req.query.file) : null;
  console.log(reqFile);

  // Vérifie que le chemin est valide et dans le dossier de base
  if (!reqFile || !reqFile.startsWith(baseDir)) {
    return res.status(400).send("Chemin invalide.");
  }

  // Vérifie que le fichier existe et que c'est bien un fichier
  fs.stat(reqFile, (err, stats) => {
    if (err || !stats.isFile()) {
      return res.status(404).send("Fichier non trouvé.");
    }
    res.download(reqFile, path.basename(reqFile));
  });
});
// --- Gestion des comptes admin (API REST simple) ---

router.get('/admin/users', adminAuth, (req, res) => {
  loadUsers();
  res.json(users.map(u => ({ username: u.username, role: u.role })));
});


router.post('/admin/users', adminAuth, (req, res) => {
  loadUsers();
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'Champs manquants' });
  if (users.some(u => u.username === username)) return res.status(409).json({ error: 'Déjà existant' });
  users.push({ username, password, role });
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ ok: true });
});


router.delete('/admin/users', adminAuth, (req, res) => {
  loadUsers();
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Nom manquant' });
  users = users.filter(u => u.username !== username);
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
  res.json({ ok: true });
});

// Vue gestion comptes admin
router.get('/admin/users/manage', adminAuth, (req, res) => {
  res.render('admin-users');
});

// Route admin : statistiques de compression
router.get('/admin/compression-stats', adminAuth, async (req, res) => {
  try {
    const CompressionStats = require('../lib/compression/CompressionStats');
    const statsPath = path.join(__dirname, '..', 'temp', 'compression-stats.json');

    // Charger les statistiques depuis le fichier
    const compressionStats = await CompressionStats.loadFromFile(statsPath);

    // Générer le rapport complet
    const report = compressionStats.generateReport();

    res.render('compression-stats', {
      title: 'Statistiques de Compression',
      report: report,
      globalStats: report.summary,
      statsByType: report.byFileType,
      topPerformers: report.topPerformers
    });
  } catch (error) {
    console.error('Erreur lors du chargement des statistiques de compression:', error);
    res.status(500).render('error', {
      message: 'Erreur lors du chargement des statistiques de compression',
      error: { status: 500, stack: error.stack }
    });
  }
});

// Route admin : configuration de compression (GET)
router.get('/admin/compression-config', adminAuth, async (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'temp', 'compression-config.json');

    // Charger la configuration actuelle
    const config = await CompressionConfig.loadFromFile(configPath);

    res.render('compression-config', {
      title: 'Configuration de Compression',
      config: config.toJSON(),
      message: req.query.message || null,
      messageType: req.query.type || null
    });
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration de compression:', error);
    res.status(500).render('error', {
      message: 'Erreur lors du chargement de la configuration de compression',
      error: { status: 500, stack: error.stack }
    });
  }
});

// Route admin : configuration de compression (POST)
router.post('/admin/compression-config', adminAuth, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'temp', 'compression-config.json');

    // Charger la configuration actuelle
    let config = await CompressionConfig.loadFromFile(configPath);

    // Préparer les nouvelles données de configuration
    const newConfigData = {
      compressionLevel: parseInt(req.body.compressionLevel) || config.compressionLevel,
      minFileSize: parseInt(req.body.minFileSize) || config.minFileSize,
      maxFileSize: parseInt(req.body.maxFileSize) || config.maxFileSize,
      compressionTimeout: parseInt(req.body.compressionTimeout) || config.compressionTimeout,
      algorithm: req.body.algorithm || config.algorithm
    };

    // Traiter les types de fichiers compressibles
    if (req.body.compressibleTypes) {
      const types = req.body.compressibleTypes
        .split(',')
        .map(type => type.trim())
        .filter(type => type.length > 0)
        .map(type => type.startsWith('.') ? type : '.' + type);
      newConfigData.compressibleTypes = types;
    }

    // Traiter les types de fichiers exclus
    if (req.body.excludeTypes) {
      const types = req.body.excludeTypes
        .split(',')
        .map(type => type.trim())
        .filter(type => type.length > 0)
        .map(type => type.startsWith('.') ? type : '.' + type);
      newConfigData.excludeTypes = types;
    }

    // Mettre à jour la configuration
    config.update(newConfigData);

    // Valider la nouvelle configuration
    const validation = config.validate();
    if (!validation.isValid) {
      return res.redirect(`/admin/compression-config?message=${encodeURIComponent('Erreurs de validation: ' + validation.errors.join(', '))}&type=error`);
    }

    // Sauvegarder la configuration
    await config.saveToFile(configPath);

    // Recharger la configuration dans l'application
    if (global.compressionConfig) {
      global.compressionConfig.update(newConfigData);
    }

    let message = 'Configuration sauvegardée avec succès';
    if (validation.warnings.length > 0) {
      message += '. Avertissements: ' + validation.warnings.join(', ');
    }

    res.redirect(`/admin/compression-config?message=${encodeURIComponent(message)}&type=success`);

  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration:', error);
    res.redirect(`/admin/compression-config?message=${encodeURIComponent('Erreur lors de la sauvegarde: ' + error.message)}&type=error`);
  }
});

// Route API : rechargement à chaud de la configuration
router.post('/admin/compression-config/reload', adminAuth, async (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'temp', 'compression-config.json');

    // Recharger la configuration depuis le fichier
    const newConfig = await CompressionConfig.loadFromFile(configPath);

    // Valider la nouvelle configuration
    const validation = newConfig.validate();
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Configuration invalide: ' + validation.errors.join(', ')
      });
    }

    // Mettre à jour la configuration globale
    global.compressionConfig = newConfig;

    console.log('Configuration de compression rechargée à chaud:', {
      level: newConfig.compressionLevel,
      algorithm: newConfig.algorithm,
      minSize: newConfig.minFileSize,
      maxSize: newConfig.maxFileSize
    });

    res.json({
      success: true,
      message: 'Configuration rechargée avec succès',
      config: newConfig.toJSON(),
      warnings: validation.warnings
    });

  } catch (error) {
    console.error('Erreur lors du rechargement de la configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rechargement: ' + error.message
    });
  }
});

// Route API : obtenir la configuration actuelle
router.get('/admin/compression-config/current', adminAuth, (req, res) => {
  try {
    const config = global.compressionConfig || new CompressionConfig();
    const validation = config.validate();

    res.json({
      success: true,
      config: config.toJSON(),
      validation: validation,
      loadedAt: global.compressionConfigLoadedAt || null
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération: ' + error.message
    });
  }
});

module.exports = router;
