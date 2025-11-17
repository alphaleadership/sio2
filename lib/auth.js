const path = require("path");
const fs = require("fs");

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

function ensureAuthenticated(role = null) {
  return function (req, res, next) {
    if (req.session && req.session.user) {
      const userRole = req.session.user.role;
      if (!role) { // No specific role required, just authenticated
        return next();
      } else if (role === 'user') { // 'user' role required, allow 'user' and 'admin'
        if (userRole === 'user' || userRole === 'admin') {
          return next();
        }
      } else if (userRole === role) { // Specific role required, must match
        return next();
      } else {
        return res.status(403).send('Accès refusé: Rôle insuffisant.');
      }
     
    } else {
      // Not authenticated
      res.redirect('/login');
    }
  }
}

const adminAuth = ensureAuthenticated('admin');

// Function to save users to the JSON file
function saveUsers() {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

module.exports = {
  ensureAuthenticated,
  adminAuth,
  users,
  loadUsers,
  saveUsers,
  baseDir: path.resolve(__dirname, "../partage"),
};
