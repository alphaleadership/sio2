// --- Gestion des comptes admin (API REST simple) ---
router.get('/admin/users', adminAuth, (req, res) => {
  loadAdminUsers();
  res.json(adminUsers.map(u => ({ username: u.username })));
});

router.post('/admin/users', adminAuth, (req, res) => {
  loadAdminUsers();
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
  if (adminUsers.some(u => u.username === username)) return res.status(409).json({ error: 'Déjà existant' });
  adminUsers.push({ username, password });
  fs.writeFileSync(adminUsersPath, JSON.stringify(adminUsers, null, 2));
  res.json({ ok: true });
});

router.delete('/admin/users', adminAuth, (req, res) => {
  loadAdminUsers();
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Nom manquant' });
  adminUsers = adminUsers.filter(u => u.username !== username);
  fs.writeFileSync(adminUsersPath, JSON.stringify(adminUsers, null, 2));
  res.json({ ok: true });
});

// Vue gestion comptes admin
router.get('/admin/users/manage', adminAuth, (req, res) => {
  res.render('admin-users');
});
// Dossier corbeille (non visible)

var express = require('express');
var router = express.Router();
const path = require("path");
const fs = require("fs");
  const baseDir = path.resolve("./public/partage");
  const multer = require('multer');
const upload = multer({ dest: path.join(baseDir, '..','tmp_uploads') }); // dossier temporaire pour upload
 // dossier temporaire pour upload
router.post('/upload', upload.array('file'), function(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send("Aucun fichier envoyé.");
  }

  const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;

  // Sécurité : empêcher la traversée de dossier
  if (!destFolder.startsWith(baseDir)) {
    req.files.forEach(f => fs.unlinkSync(f.path));
    return res.status(400).send("Chemin invalide.");
  }

  try {
    req.files.forEach(file => {
      // webkitRelativePath contient le chemin relatif du fichier dans le dossier uploadé
      const relPath = file.originalname.replace(/\\/g, '/');
      const subPath = file.webkitRelativePath || relPath;
      const destPath = path.join(destFolder, subPath);

      // Crée les dossiers nécessaires
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      // Déplace le fichier uploadé
      fs.renameSync(file.path, destPath);
    });
    res.redirect(req.get('referer') || '/');
  } catch (err) {
    req.files.forEach(f => fs.unlinkSync(f.path));
    return res.status(500).send("Erreur lors du déplacement des fichiers.");
  }
});
/* GET home page. */
router.get('/', function(req, res, next) {
    // Get the requested path from query, default to root folder

  const reqPath = req.query.path ? path.join(baseDir, req.query.path) : baseDir;

  // Prevent path traversal
  if (!reqPath.startsWith(baseDir)) {
    return res.status(400).send("Chemin invalide.");
  }

  function getFilesInDir(dirPath, relPath = "") {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    return files.map((file) => {
      const fullPath = path.join(dirPath, file.name);
      const stats = fs.statSync(fullPath);
      const relativePath = path.join(relPath, file.name);
      return {
        name: relativePath.replace(/\\/g, '/'), // name relatif au dossier de partage
        fullPath: fullPath,
        relativePath: relativePath,
        isDirectory: file.isDirectory(),
        isFile: file.isFile(),
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        atime: stats.atime,
        mode: stats.mode
      };
    });
  }

  let files = [];
  try {
    // Compute relative path from baseDir for correct navigation
    const relPath = path.relative(baseDir, reqPath);
    files = getFilesInDir(reqPath, relPath === "" ? "" : relPath);
  } catch (err) {
    return res.status(500).send("Erreur lors de la lecture du dossier.");
  }

  res.render('index', { title: 'Explorateur de fichiers', files: files,path: reqPath.replace(baseDir, "").replace(/\\/g, '/')  });
});

const trashDir = path.join(baseDir, '..', '..', '.corbeille');
if (!fs.existsSync(trashDir)) {
  fs.mkdirSync(trashDir, { recursive: true });
}

// --- Authentification admin basique ---
const adminUsersPath = path.resolve(__dirname, '../admin-users.json');
let adminUsers = [];
function loadAdminUsers() {
  try {
    adminUsers = JSON.parse(fs.readFileSync(adminUsersPath, 'utf8'));
  } catch (e) {
    adminUsers = [];
  }
}
loadAdminUsers();

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    if (req.accepts('html')) return res.redirect('/admin/login');
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    return res.status(401).send('Authentification requise');
  }
  const b64 = auth.split(' ')[1];
  const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
  // Vérifie dans la liste des admins
  if (adminUsers.some(u => u.username === user && u.password === pass)) return next();
  if (req.accepts('html')) return res.redirect('/admin/login');
  res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
  return res.status(401).send('Accès refusé');
}

// Vue de login admin
router.get('/admin/login', function(req, res) {
  res.render('login');
});
// --- Route admin : liste des fichiers dans la corbeille ---
router.get('/admin/trash', adminAuth, function(req, res) {
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
router.post('/admin/restore', adminAuth, function(req, res) {
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
router.post('/delete', function(req, res, next) {
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
// Route de téléchargement de fichier
router.get('/download', function(req, res, next) {

 
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

module.exports = router;
