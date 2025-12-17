import { Elysia, t, } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import { customSession } from './lib/session-plugin.mjs';
import { 
 Html
 } from '@elysiajs/html'
 import { jwt } from '@elysiajs/jwt'
import ejs from 'ejs';
import path from 'path';
import fs from 'fs';
import { node } from '@elysiajs/node';
import * as CompressionConfig from './lib/compression/CompressionConfig.js';
import CompressionStats from './lib/compression/CompressionStats.cjs';
import CompressionService from './lib/compression/CompressionService.cjs';
import FileStorageMiddleware from './lib/compression/FileStorageMiddleware.cjs';
import FileMetadataManager from './lib/compression/FileMetadataManager.cjs';
import { openapi
 } from '@elysiajs/openapi'
 function html(body, init={}) {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/html')
  return new Response(body, { ...init, headers })
}
const __dirname = new URL('.', import.meta.url).pathname;
console.log(CompressionStats)
// --- EJS rendering helper ---
async function renderEjs(templatePath, data = {}) {
  const filePath = path.join(process.cwd(), 'views', `${templatePath}.ejs`);
  return new Promise((resolve, reject) => {
    ejs.renderFile(filePath, data, (err, str) => {
      if (err) {
        return reject(err);
      }
      resolve(html(str || ''));
    });
  });
}

// --- User loading ---
const usersPath = path.resolve("..", 'users.json');
let users = []; 
function loadUsers() {
  try {
    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }
  } catch (e) {
    users = [];
  }
}
loadUsers();


// --- Initialization logic from app.js and routes/index.js ---

// Initialisation de la configuration de compression globale
async function initializeCompressionConfig() {
  try {
    const configPath = path.join(".", 'temp', 'compression-config.json');
    console.log(new CompressionConfig.default())
    // Charger la configuration depuis le fichier ou utiliser les valeurs par défaut
    global.compressionConfig = await new CompressionConfig.default().loadFromFile(configPath);
    global.compressionConfigLoadedAt = new Date().toISOString();
    
    // Sauvegarder la configuration par défaut si le fichier n'existait pas
    await global.compressionConfig.saveToFile(configPath);
    
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la configuration de compression:', error);
    // Utiliser la configuration par défaut en cas d'erreur
    global.compressionConfig = new CompressionConfig.default();
  }
}

// Initialiser le système de statistiques
let compressionStats = new CompressionStats.default(); // Instance par défaut immédiate

async function initializeCompressionStats() {
  try {
    const statsPath = path.join(".", 'temp', 'compression-stats.json');
    const loadedStats = await CompressionStats.default.loadFromFile(statsPath);

    // Remplacer l'instance par défaut par les statistiques chargées
    compressionStats = loadedStats;

  } catch (error) {
    console.error('Erreur lors du chargement des statistiques:', error.message);
    // Garder l'instance par défaut
  }
}

const compressionConfig = global.compressionConfig || new CompressionConfig.default();
const compressionService = new CompressionService.default();
const fileStorageMiddleware = new FileStorageMiddleware(compressionService, compressionConfig, compressionStats);


// --- Start App ---

// Initialize configurations
await initializeCompressionConfig();
await initializeCompressionStats();

const baseDir = path.resolve(process.cwd(), "public", "partage");
const globalShareDir = path.join(baseDir, 'global');
if (!fs.existsSync(globalShareDir)) fs.mkdirSync(globalShareDir, { recursive: true });

async function getFilesInDir(dirPath, relPath = "") {
  //  console.log(dirPath)
   // console.log(relPath)
    const files = fs.readdirSync(dirPath.replace("global\\global", "global").replace("global/global", "global"), { withFileTypes: true });
    const processedFiles = [];
    const seenFiles = new Set(); // Pour éviter les doublons

    for (const file of files) {
      const fullPath = path.join(dirPath.replace("global\\global", "global").replace("global/global", "global"), file.name);
      const relativePath = path.join(relPath.replace("global\\global", "global").replace("global/global", "global"), file.name);

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

async function renderFiles(set, query, user, userDir, relBase) {
  try {
    const reqPath = query.path ? path.join(baseDir, query.path) : baseDir;
    const relPath = path.relative(userDir, reqPath);
    const files = await getFilesInDir(reqPath, relPath);

    const html2 = await renderEjs('index', { title: 'Explorateur de fichiers', files: files, path: reqPath.replace(userDir, relBase).replace(/\\/g, '/'), user: user });
   // set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return html2;

  } catch (err) {
    console.log(err);
    set.status = 500;
    return "Erreur lors de la lecture du dossier.";
  }
}



const app = new Elysia({ adapter: node("test"),aot:false }) .use(
        jwt({
            name: 'jwt',
            secret: 'Fischl von Luftschloss Narfidort'
        })
    )
.use(openapi())
 customSession()(app)
  app.use(staticPlugin({ assets: 'public', prefix: '/' }))
  
  app.get('/', async ({  query, set,redirect,response, cookie: { auth },jwt }) => {
    console.log(auth.value)
    if(!auth.value) {
      set.redirect="/login";
      return
    }
    const session = await jwt.verify(auth.value);
    console.log(session)
    const user = session.user;
    if (!user) {
      
       set.redirect="/login";
       return
    }

    if (user.role === 'admin') {
      // Admin has full access, render files directly
      const reqPath = query.path ? path.join(baseDir, query.path) : baseDir;
      if (!reqPath.startsWith(baseDir)) {
        set.status = 400;
        return 'Chemin invalide.';
      }
      return renderFiles(set, query, user, baseDir, '')
    }

    // If we are here, it's a regular user
    let rootChoices = [];
    let userDir = baseDir;
    let relBase = '';

    if (!query.path || query.path === '' || query.path === '/') {
      // User is at their root, show choices
      rootChoices = [
        { name: 'Mon dossier', path: '/users/' + user.username },
        { name: 'Partage global', path: '/global' }
      ];
      const html2 = await renderEjs('index', { title: 'Explorateur de fichiers', files: [], path: '/', user: user, rootChoices });
      //set.headers['Content-Type'] = 'text/html; charset=utf-8';
      return html2;
    }

    if (query.path.startsWith('/users/' + user.username)) {
      // User is in their own folder
      userDir = path.join(baseDir, 'users', user.username);
      relBase = '/users/' + user.username;
      const subPath = query.path.replace(relBase, '').replace(/^\/+/, '');
      const reqPath = subPath ? path.join(userDir, subPath) : userDir;
      if (!reqPath.startsWith(userDir)) {
        set.status = 400;
        return 'Chemin invalide.';
      }
      return (renderFiles(set, { path: query.path }, user, userDir, relBase));
    }

    if (query.path.startsWith('/global')) {
      // User is in global share
      const subPath = query.path.replace(/^\/+/, '').replace("/global", "");
      const reqPath = subPath ? path.join(globalShareDir, subPath) : globalShareDir;
      if (!reqPath.startsWith(globalShareDir)) {
        set.status = 400;
        return 'Chemin invalide.';
      }
      return (renderFiles(set, { path: query.path }, user, baseDir, ''));
    }

    // If a regular user tries to access any other path, redirect them to their root.
    set.redirect = '/';
  })
  .post('/upload', async ({ body, set, headers }) => {
      const { file, path: bodyPath } = body;
      const files = Array.isArray(file) ? file : [file];

      // Re-create a simplified req object for the middleware
      const req = {
          files: files.map(f => ({
              ...f,
              path: f.path, // Elysia already provides a temporary path
              originalname: f.name,
              webkitRelativePath: f.webkitRelativePath
          })),
          body: {
              path: bodyPath
          }
      };

      await new Promise((resolve, reject) => {
          const res = {
              status: (code) => ({
                  send: (message) => {
                      set.status = code;
                      reject(new Error(message));
                  }
              }),
              redirect: (url) => {
                set.redirect = url;
                resolve();
              }
          };
          const next = (err) => {
              if (err) {
                  return reject(err);
              }
              resolve();
          };

          fileStorageMiddleware.handleUpload(req, res, next);
      });
      
      const referer = headers.referer || '/';
      set.redirect = referer;

  }, {
      body: [t.Object({
          file: t.Any(),
          path: t.Optional(t.String())
      })]
  })
  .get('/login', async ({ set }) => {
    const html2 = await renderEjs('login', { error: null });
   
   // set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return html2;
  })
  .post('/login', async ({jwt, body, session, set,cookie: { auth }  }) => {
    loadUsers()
    const { username, password } = body;
    console.log(body)
    const user = users.find(u => u.username === username && u.password === password);
    console.log(users)
    console.log(jwt)
    if (user) {
      session=session||{}
      session.user = { username: user.username, role: user.role || "user" };
      const userDir = path.join(__dirname, 'public', 'partage', 'users', user.username);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      set.redirect = '/';
      const value = await jwt.sign({user: session.user})
        console.log(value)
        if(auth){
           auth.set({
            value,
            httpOnly: true,
            maxAge: 7 * 86400,
            path: '/',
        })
        }
       
      return value
    } else {
      const html = await renderEjs('login', { error: 'Nom d\'utilisateur ou mot de passe incorrect.' });
     // set.headers['Content-Type'] = 'text/html; charset=utf-8';
      return (html);
    }
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })
  .get('/register', async ({ set }) => {
    const html = await renderEjs('register');
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return (html);
  })
  .post('/register', async ({ body, set }) => {
    const { username, password } = body;
    if (!username || !password) {
      set.status = 400;
      return 'Nom d\'utilisateur et mot de passe requis';
    }

    if (users.find(u => u.username === username)) {
      set.status = 400;
      return 'Nom d\'utilisateur déjà utilisé';
    }
    users.push({ username: username, password: password, role: 'user' });
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    set.redirect = '/login';
  }, {
    body: t.Object({
      username: t.String(),
      password: t.String()
    })
  })
const trashDir = path.join(process.cwd(), '.corbeille');
if (!fs.existsSync(trashDir)) {
  fs.mkdirSync(trashDir, { recursive: true });
}

app.post('/delete', async ({ body, set, headers }) => {
    const { file } = body;
    if (!file) {
        set.status = 400;
        return 'Fichier non spécifié.';
    }
    const absFile = path.join(baseDir, file);
    if (!absFile.startsWith(baseDir)) {
        set.status = 400;
        return 'Chemin invalide.';
    }
    if (!fs.existsSync(absFile)) {
        set.status = 404;
        return 'Fichier non trouvé.';
    }
    // Empêcher suppression de la corbeille elle-même
    if (absFile.startsWith(trashDir)) {
        set.status = 400;
        return 'Action interdite.';
    }
    // Générer un nom unique dans la corbeille
    const fileName = path.basename(absFile);
    const trashPath = path.join(trashDir, Date.now() + '_' + fileName);
    fs.renameSync(absFile, trashPath);
    
    const referer = headers.referer || '/';
    set.redirect = referer;
}, {
    body: t.Object({
        file: t.String()
    })
});

const adminAuth = (handler) => async (context) => {
    const { session, set,jwt,cookie:{auth} } = context;
    const user = await jwt.verify(auth.value);
    console.log(user.user)
    if (user && user.user.role === 'admin') {
        return handler(context);
    }
    set.status = 403;
    return 'Accès refusé: Rôle insuffisant.';
};

app.get('/admin/trash', adminAuth(async ({ set }) => {
  try {
    const files = fs.readdirSync(trashDir)
      .filter(f => fs.statSync(path.join(trashDir, f)).isFile())
      .map(f => ({
        name: f,
        mtime: fs.statSync(path.join(trashDir, f)).mtime,
        size: fs.statSync(path.join(trashDir, f)).size
      }));
    const html = await renderEjs('trash', { title: 'Corbeille', files });
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return html;
  } catch (e) {
    set.status = 500;
    return 'Erreur lecture corbeille';
  }
}));

app.get('/admin/users', adminAuth(async () => {
    return users.map(u => ({ username: u.username, role: u.role }));
}));

app.get('/admin/compression-stats', adminAuth(async ({ set }) => {
    try {
        const statsPath = path.join(__dirname, '..', 'temp', 'compression-stats.json');
        const compressionStatsResult = await CompressionStats.loadFromFile(statsPath);
        const report = compressionStatsResult.generateReport();
        const html = await renderEjs('compression-stats', {
            title: 'Statistiques de Compression',
            report: report,
            globalStats: report.summary,
            statsByType: report.byFileType,
            topPerformers: report.topPerformers
        });
        set.headers['Content-Type'] = 'text/html; charset=utf-8';
        return html;
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques de compression:', error);
        set.status = 500;
        const html = await renderEjs('error', {
            message: 'Erreur lors du chargement des statistiques de compression',
            error: { status: 500, stack: error.stack }
        });
        set.headers['Content-Type'] = 'text/html; charset=utf-8';
        return html;
    }
}));

app.get('/admin/compression-config', adminAuth(async ({ query, set }) => {
    try {
        const configPath = path.join(__dirname, '..', 'temp', 'compression-config.json');
        const config = await CompressionConfig.loadFromFile(configPath);
        const html = await renderEjs('compression-config', {
            title: 'Configuration de Compression',
            config: config.toJSON(),
            message: query.message || null,
            messageType: query.type || null
        });
        set.headers['Content-Type'] = 'text/html; charset=utf-8';
        return html;
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration de compression:', error);
        set.status = 500;
        const html = await renderEjs('error', {
            message: 'Erreur lors du chargement de la configuration de compression',
            error: { status: 500, stack: error.stack }
        });
        set.headers['Content-Type'] = 'text/html; charset=utf-8';
        return html;
    }
}));

app.post('/admin/compression-config', adminAuth(async ({ body, set }) => {
    try {
        const configPath = path.join(__dirname, '..', 'temp', 'compression-config.json');
        let config = await CompressionConfig.loadFromFile(configPath);
        const newConfigData = {
            compressionLevel: parseInt(body.compressionLevel) || config.compressionLevel,
            minFileSize: parseInt(body.minFileSize) || config.minFileSize,
            maxFileSize: parseInt(body.maxFileSize) || config.maxFileSize,
            compressionTimeout: parseInt(body.compressionTimeout) || config.compressionTimeout,
            algorithm: body.algorithm || config.algorithm
        };
        if (body.compressibleTypes) {
            const types = body.compressibleTypes.split(',').map(type => type.trim()).filter(type => type.length > 0).map(type => type.startsWith('.') ? type : '.' + type);
            newConfigData.compressibleTypes = types;
        }
        if (body.excludeTypes) {
            const types = body.excludeTypes.split(',').map(type => type.trim()).filter(type => type.length > 0).map(type => type.startsWith('.') ? type : '.' + type);
            newConfigData.excludeTypes = types;
        }
        config.update(newConfigData);
        const validation = config.validate();
        if (!validation.isValid) {
            set.redirect = `/admin/compression-config?message=${encodeURIComponent('Erreurs de validation: ' + validation.errors.join(', '))}&type=error`;
            return;
        }
        await config.saveToFile(configPath);
        if (global.compressionConfig) {
            global.compressionConfig.update(newConfigData);
        }
        let message = 'Configuration sauvegardée avec succès';
        if (validation.warnings.length > 0) {
            message += '. Avertissements: ' + validation.warnings.join(', ');
        }
        set.redirect = `/admin/compression-config?message=${encodeURIComponent(message)}&type=success`;
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la configuration:', error);
        set.redirect = `/admin/compression-config?message=${encodeURIComponent('Erreur lors de la sauvegarde: ' + error.message)}&type=error`;
    }
}), {
    body: t.Object({
        compressionLevel: t.Optional(t.String()),
        minFileSize: t.Optional(t.String()),
        maxFileSize: t.Optional(t.String()),
        compressionTimeout: t.Optional(t.String()),
        algorithm: t.Optional(t.String()),
        compressibleTypes: t.Optional(t.String()),
        excludeTypes: t.Optional(t.String())
    })
});

app.post('/admin/compression-config/reload', adminAuth(async ({ set }) => {
    try {
        const configPath = path.join(__dirname, '..', 'temp', 'compression-config.json');
        const newConfig = await CompressionConfig.loadFromFile(configPath);
        const validation = newConfig.validate();
        if (!validation.isValid) {
            set.status = 400;
            return {
                success: false,
                error: 'Configuration invalide: ' + validation.errors.join(', ')
            };
        }
        global.compressionConfig = newConfig;
        return {
            success: true,
            message: 'Configuration rechargée avec succès',
            config: newConfig.toJSON(),
            warnings: validation.warnings
        };
    } catch (error) {
        set.status = 500;
        return {
            success: false,
            error: 'Erreur lors du rechargement: ' + error.message
        };
    }
}));

app.get('/admin/compression-config/current', adminAuth(() => {
    try {
        const config = global.compressionConfig || new CompressionConfig();
        const validation = config.validate();
        return {
            success: true,
            config: config.toJSON(),
            validation: validation,
            loadedAt: global.compressionConfigLoadedAt || null
        };
    } catch (error) {
        return {
            success: false,
            error: 'Erreur lors de la récupération: ' + error.message
        };
    }
}));

app.get('/admin/users/manage', adminAuth(async ({ set }) => {
    const html = await renderEjs('admin-users');
    set.headers['Content-Type'] = 'text/html; charset=utf-8';
    return html;
}));

app.post('/admin/restore', adminAuth(async ({ body, set }) => {
    const { file } = body;
    if (!file) {
        set.status = 400;
        return 'Fichier non spécifié.';
    }
    const absTrashFile = path.join(trashDir, file);
    if (!absTrashFile.startsWith(trashDir) || !fs.existsSync(absTrashFile)) {
        set.status = 404;
        return 'Fichier non trouvé dans la corbeille.';
    }
    const origName = file.replace(/^\d+_/, '');
    const destPath = path.join(baseDir, origName);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    try {
        fs.renameSync(absTrashFile, destPath);
        set.redirect = '/admin/trash';
    } catch (e) {
        set.status = 500;
        return 'Erreur restauration.';
    }
}), {
    body: t.Object({
        file: t.String()
    })
});

app.post('/admin/delete', adminAuth(async ({ body, set }) => {
    const { file } = body;
    if (!file) {
        set.status = 400;
        return 'Fichier non spécifié.';
    }
    const absTrashFile = path.join(trashDir, file);
    if (!absTrashFile.startsWith(trashDir) || !fs.existsSync(absTrashFile)) {
        set.status = 404;
        return 'Fichier non trouvé dans la corbeille.';
    }
    try {
        fs.unlinkSync(absTrashFile);
        set.redirect = '/admin/trash';
    } catch (e) {
        set.status = 500;
        return 'Erreur suppression.';
    }
}), {
    body: t.Object({
        file: t.String()
    })
});

app.get('/download', async ({ query, set }) => {
    await new Promise((resolve, reject) => {
        const req = { query };
        const res = {
            status: (code) => ({
                send: (message) => {
                    set.status = code;
                    reject(new Error(message));
                }
            }),
            setHeader: (name, value) => {
                set.headers[name] = value;
            },
            sendFile: (filePath, options, callback) => {
                const fileContent = fs.readFileSync(filePath);
                if(callback) callback();
                resolve(fileContent);
            }
        };
        const next = (err) => {
            if (err) {
                return reject(err);
            }
            // If next is called, it means the middleware did not handle the response
            // and we should proceed with the original file
            const reqFile = query.file ? path.join(baseDir, query.file) : null;
            if (reqFile && fs.existsSync(reqFile)) {
                const fileContent = fs.readFileSync(reqFile);
                resolve(fileContent);
            } else {
                reject(new Error("Fichier non trouvé."));
            }
        };

        fileStorageMiddleware.handleDownload(req, res, next)
            .catch(reject);
    }).then(fileContent => {
        return (fileContent, { headers: set.headers });
    }).catch(err => {
        set.status = 500;
        return err.message;
    });
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);/*
console.log(staticPlugin().catch((error) => {
    console.error('Erreur lors de la configuration du plugin statique:', error);
  }).then((item)=>{
    console.log(item)
  }))*/