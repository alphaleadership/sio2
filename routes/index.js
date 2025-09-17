// Dossier corbeille (non visible)

var express = require('express');
var router = express.Router();
const path = require("path");
const fs = require("fs");
  const baseDir = path.resolve("../partage");
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

// Dossier global partagé
const globalShareDir = path.join(baseDir, 'global');
if (!fs.existsSync(globalShareDir)) fs.mkdirSync(globalShareDir, { recursive: true });

router.get('/', userAuth(), function(req, res, next) {
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
      const subPath = req.query.path.replace(/^\/+/, '').replace("/global","");
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
  function getFilesInDir(dirPath, relPath = "") {
console.log(dirPath)
console.log(relPath)   
 const files = fs.readdirSync(dirPath.replace("global/global","global"), { withFileTypes: true });
    return files.map((file) => {
      const fullPath = path.join(dirPath.replace("global/global","global"), file.name);
      const stats = fs.statSync(fullPath);
      const relativePath = path.join(relPath.replace("global/global","global"), file.name);
console.log(relPath)
      return {
        name: relativePath.replace(/\\/g, '/'),
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
    const relPath = path.relative(userDir, reqPath);
	console.log(relPath)
console.log(reqPath)
    files = getFilesInDir(reqPath,  relPath);
console.log(files)
  } catch (err) {
	console.log(err);
    return res.status(500).send("Erreur lors de la lecture du dossier.");
  }
  res.render('index', { title: 'Explorateur de fichiers', files: files, path: reqPath.replace(userDir, relBase).replace(/\\/g, '/'), user: req.session.user });
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
  return function(req, res, next) {
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
router.get('/login', function(req, res) {
  res.render('login');
});
// Route pour afficher le formulaire d'inscription
router.get('/register', function(req, res) {
  res.render('register');
});

// Route pour traiter l'inscription
router.post('/register', express.urlencoded({ extended: true }), function(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Nom d\'utilisateur et mot de passe requis');
  }
  // Charger les utilisateurs existants
  let users = [];
  try {
    users = JSON.parse(fs.readFileSync(path.join(__dirname, '../users.json')));
  } catch (e) {}
  if (users.find(u => u.username === username)) {
    return res.status(400).send('Nom d\'utilisateur déjà utilisé');
  }
  users.push({ username:username, password:password,role:'user' });
  fs.writeFileSync(path.join(__dirname, '../users.json'), JSON.stringify(users, null, 2));
  res.redirect('/login');
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
module.exports = router;
