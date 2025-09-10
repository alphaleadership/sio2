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
