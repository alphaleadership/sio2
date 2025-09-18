# Système de Statistiques de Compression

Ce document décrit l'utilisation du système de statistiques de compression qui collecte et analyse les métriques d'efficacité de la compression de fichiers.

## Vue d'ensemble

Le système de statistiques comprend deux composants principaux :

- **CompressionStats** : Collecteur de statistiques en mémoire
- **StatsManager** : Gestionnaire de persistance avec sauvegarde automatique

## Utilisation de base

### 1. Initialisation

```javascript
const { createCompressionSystem, StatsManager } = require('./lib/compression');

// Méthode 1: Via la factory (recommandée)
const compressionSystem = await createCompressionSystem({
  dataDir: './data'
});
const { stats, statsManager } = compressionSystem;

// Méthode 2: Création manuelle
const statsManager = StatsManager.createDefault('./data');
await statsManager.initialize();
const stats = statsManager.getStats();
```

### 2. Enregistrement des opérations

```javascript
// Compression réussie
stats.recordCompression({
  filePath: '/uploads/document.txt',
  originalSize: 5000,
  compressedSize: 2000,
  fileType: '.txt',
  success: true
});

// Compression échouée
stats.recordCompression({
  filePath: '/uploads/image.jpg',
  originalSize: 2000000,
  compressedSize: 2000000,
  fileType: '.jpg',
  success: false
});
```

### 3. Consultation des statistiques

```javascript
// Statistiques globales
const globalStats = statsManager.getGlobalStats();
console.log(`Fichiers compressés: ${globalStats.totalFilesCompressed}`);
console.log(`Espace économisé: ${globalStats.formattedSpaceSaved}`);
console.log(`Taux de compression: ${globalStats.compressionRate}%`);

// Statistiques par type de fichier
const txtStats = statsManager.getStatsByType('.txt');
console.log(`Fichiers .txt compressés: ${txtStats.filesCompressed}`);

// Toutes les statistiques par type
const allTypeStats = statsManager.getStatsByType();
for (const [type, stats] of Object.entries(allTypeStats)) {
  console.log(`${type}: ${stats.compressionRate}% de taux de compression`);
}
```

### 4. Génération de rapports

```javascript
const report = statsManager.generateReport();

console.log('Résumé:', report.summary);
console.log('Par type:', report.byFileType);
console.log('Top performers:', report.topPerformers);
```

## Intégration automatique

Le système s'intègre automatiquement avec `FileStorageMiddleware` :

```javascript
const { createCompressionSystem } = require('./lib/compression');

const compressionSystem = await createCompressionSystem();
const { middleware, statsManager } = compressionSystem;

// Le middleware enregistre automatiquement les statistiques
app.use('/upload', middleware.createUploadMiddleware());

// Les statistiques sont collectées automatiquement lors des uploads
```

## Persistance des données

### Sauvegarde automatique

```javascript
// Sauvegarde automatique toutes les 30 secondes (par défaut)
const statsManager = new StatsManager('./data/stats.json', 30000);

// Désactiver la sauvegarde automatique
const statsManager = new StatsManager('./data/stats.json', 0);
```

### Sauvegarde manuelle

```javascript
// Sauvegarde immédiate
await statsManager.save();

// Sauvegarde conditionnelle (seulement si modifié)
const wasSaved = await statsManager.saveIfDirty();
```

### Chargement des données

```javascript
// Les données sont chargées automatiquement à l'initialisation
await statsManager.initialize();

// Rechargement manuel depuis le fichier
const loadedStats = await CompressionStats.loadFromFile('./data/stats.json');
```

## API des statistiques

### Statistiques globales

```javascript
const globalStats = statsManager.getGlobalStats();
// Retourne:
{
  totalFilesProcessed: number,
  totalFilesCompressed: number,
  totalSpaceSaved: number,
  averageCompressionRatio: number,
  compressionRate: number, // Pourcentage
  formattedSpaceSaved: string, // "1.2 MB"
  lastUpdated: Date
}
```

### Statistiques par type

```javascript
const typeStats = statsManager.getStatsByType('.txt');
// Retourne:
{
  filesProcessed: number,
  filesCompressed: number,
  totalOriginalSize: number,
  totalCompressedSize: number,
  totalSpaceSaved: number,
  averageCompressionRatio: number,
  compressionRate: number,
  formattedSpaceSaved: string
}
```

### Rapport complet

```javascript
const report = statsManager.generateReport();
// Retourne:
{
  summary: {
    totalFilesProcessed: number,
    totalFilesCompressed: number,
    totalSpaceSaved: number,
    averageCompressionRatio: number,
    compressionRate: number,
    efficiency: string,
    formattedSpaceSaved: string,
    lastUpdated: Date
  },
  byFileType: { [fileType]: TypeStats },
  topPerformers: {
    mostEfficient: Array<{type, compressionRatio, spaceSaved, filesCompressed}>,
    mostSpaceSaved: Array<{type, spaceSaved}>
  },
  generatedAt: string
}
```

## Intégration Express

### Routes d'administration

```javascript
// Route pour le tableau de bord des statistiques
app.get('/admin/compression-stats', (req, res) => {
  const report = statsManager.generateReport();
  res.render('admin/compression-stats', { report });
});

// API JSON pour les statistiques
app.get('/api/compression/stats', (req, res) => {
  const globalStats = statsManager.getGlobalStats();
  res.json(globalStats);
});

// Statistiques par type de fichier
app.get('/api/compression/stats/:type', (req, res) => {
  const typeStats = statsManager.getStatsByType(req.params.type);
  res.json(typeStats);
});

// Rapport complet
app.get('/api/compression/report', (req, res) => {
  const report = statsManager.generateReport();
  res.json(report);
});
```

### Middleware de logging

```javascript
// Middleware pour logger les statistiques après upload
app.use('/upload', middleware.createUploadMiddleware(), (req, res, next) => {
  if (req.compressionResults) {
    const compressed = req.compressionResults.filter(r => r.compressed).length;
    const total = req.compressionResults.length;
    console.log(`Upload terminé: ${compressed}/${total} fichiers compressés`);
  }
  next();
});
```

## Gestion des erreurs

```javascript
try {
  await statsManager.initialize();
} catch (error) {
  console.error('Erreur d\'initialisation des statistiques:', error.message);
  // Fallback: continuer sans statistiques
}

// Vérifier si les statistiques sont disponibles
if (statsManager.getStats()) {
  // Utiliser les statistiques
} else {
  // Mode dégradé sans statistiques
}
```

## Maintenance

### Remise à zéro

```javascript
// Remettre à zéro toutes les statistiques
await statsManager.reset();
```

### Fermeture propre

```javascript
// Fermer le gestionnaire et sauvegarder
await statsManager.close();

// Ou dans un gestionnaire de signal
process.on('SIGINT', async () => {
  await statsManager.close();
  process.exit(0);
});
```

## Configuration

### Paramètres du StatsManager

```javascript
const statsManager = new StatsManager(
  './data/compression-stats.json', // Chemin du fichier
  30000 // Intervalle de sauvegarde automatique (ms)
);
```

### Paramètres par défaut

```javascript
// Configuration par défaut
const statsManager = StatsManager.createDefault('./data');
// Équivalent à:
// new StatsManager('./data/compression-stats.json', 30000)
```

## Exemples complets

Voir le fichier `examples/compression-stats-usage.js` pour des exemples complets d'utilisation.