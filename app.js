var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');


// Ajout de la configuration de session


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();
require('./session-config')(app);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
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

app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

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
