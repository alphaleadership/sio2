// Session store utilisant un fichier JSON
const session = require('express-session');
const FileStore = require('session-file-store')(session);

module.exports = function(app) {
  app.use(session({
    store: new FileStore({
      path: './temp/session-store',
      fileExtension: '.json',
      retries: 1
    }),
    secret: 'votre_secret_a_personnaliser',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  }));
};
