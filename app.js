var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const fs =require("fs")
// Ajout de la configuration de session

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var filesRouter = require('./routes/files'); // Route pour l'interface web
var apiFilesRouter = require('./routes/api/files'); // Route pour l'API REST

var app = express();

// Initialisation de la configuration de compression globale
async function initializeCompressionConfig() {
  try {
    const CompressionConfig = require('./lib/compression/CompressionConfig');
    const configPath = path.join(__dirname, 'temp', 'compression-config.json');
    
    // Charger la configuration depuis le fichier ou utiliser les valeurs par défaut
    global.compressionConfig = await CompressionConfig.loadFromFile(configPath);
    global.compressionConfigLoadedAt = new Date().toISOString();
    
    // Sauvegarder la configuration par défaut si le fichier n'existait pas
    await global.compressionConfig.saveToFile(configPath);
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la configuration de compression:', error);
    // Utiliser la configuration par défaut en cas d'erreur
    const CompressionConfig = require('./lib/compression/CompressionConfig');
    global.compressionConfig = new CompressionConfig();
  }
}

// Initialiser la configuration de compression de manière asynchrone
initializeCompressionConfig().catch(console.error);

require('./session-config')(app);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })

// setup the logger
app.use(logger('combined', { stream: accessLogStream }))
app.use(logger('combined'))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Middleware pour enregistrer les URLs visitées dans la session
app.use(function(req, res, next) {
  if (!req.session) return next();
  if (!req.session.urlsVisited) req.session.urlsVisited = [];
  // On ignore les assets statiques
  if (!req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/i)) {
    req.session.urlsVisited.push(req.originalUrl);
    // Limite la taille de l'historique à 50 URLs
    if (req.session.urlsVisited.length > 50) {
      req.session.urlsVisited = req.session.urlsVisited.slice(-50);
    }
  }
  next();
});

// Middleware de sécurité pour vérifier l'accès aux fichiers
const { checkFileAccess } = require('./lib/permissions');
app.use(checkFileAccess);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/files', filesRouter); // Route pour l'interface web
app.use('/api/files', apiFilesRouter); // Route pour l'API REST

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;