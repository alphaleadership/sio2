const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Clé secrète pour signer les tokens (à stocker dans une variable d'environnement en production)
const JWT_SECRET = process.env.JWT_SECRET || 'ta_cle_secrete_ici';

// Chemin vers le fichier des utilisateurs
const usersPath = path.resolve(__dirname, '../../users.json');

// Charger les utilisateurs
function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  } catch (e) {
    return [];
  }
}

// POST /api/auth/login - Génère un token JWT
router.post('/login', express.json(), (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
  }

  // Générer un token JWT valide 1h
  const token = jwt.sign(
    { username: user.username, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

module.exports = router;