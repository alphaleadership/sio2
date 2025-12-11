import express from "express";
import multer from "multer";
import fs from "fs-extra";
import path from "path";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Dossier de stockage des fichiers
const STORAGE_DIR = "./storage";
fs.ensureDirSync(STORAGE_DIR);

// Liste tous les fichiers
router.get("/", (req, res) => {
  const files = fs.readdirSync(STORAGE_DIR);
  res.json(files);
});

// Télécharge un fichier
router.get("/:filename", (req, res) => {
  const filePath = path.join(STORAGE_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Fichier non trouvé");
  }
});

// Upload un fichier
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).send("Aucun fichier uploadé.");
  }
  const destPath = path.join(STORAGE_DIR, req.file.originalname);
  fs.renameSync(req.file.path, destPath);
  res.status(201).send("Fichier uploadé avec succès.");
});

// Supprime un fichier
router.delete("/:filename", (req, res) => {
  const filePath = path.join(STORAGE_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.status(200).send("Fichier supprimé avec succès.");
  } else {
    res.status(404).send("Fichier non trouvé");
  }
});

export default router;