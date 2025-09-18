# Design Document - Compression Transparente des Fichiers

## Overview

Ce système ajoute une couche de compression transparente à l'application de partage de fichiers existante. La compression sera intégrée au niveau du middleware de gestion des fichiers, permettant une compression/décompression automatique sans modification de l'API existante.

L'architecture utilise une approche middleware avec des intercepteurs sur les opérations de lecture/écriture de fichiers, garantissant la transparence pour l'utilisateur final.

## Architecture

### Composants Principaux

1. **CompressionService** - Service central de gestion de la compression
2. **FileStorageMiddleware** - Middleware interceptant les opérations fichiers
3. **CompressionConfig** - Configuration des paramètres de compression
4. **CompressionStats** - Collecte et gestion des statistiques
5. **FileMetadataManager** - Gestion des métadonnées étendues

### Flux de Données

```
Upload: Client → Multer → CompressionMiddleware → Stockage Compressé
Download: Stockage Compressé → DecompressionMiddleware → Client
```

## Components and Interfaces

### 1. CompressionService

```javascript
class CompressionService {
  // Compresse un fichier avec l'algorithme configuré
  async compressFile(inputPath, outputPath, options = {})
  
  // Décompresse un fichier
  async decompressFile(inputPath, outputPath)
  
  // Vérifie si un fichier est compressé
  isCompressed(filePath)
  
  // Calcule le ratio de compression potentiel
  estimateCompressionRatio(filePath)
}
```

### 2. FileStorageMiddleware

```javascript
class FileStorageMiddleware {
  // Intercepte l'upload pour compression
  async handleUpload(req, res, next)
  
  // Intercepte le download pour décompression
  async handleDownload(req, res, next)
  
  // Gère la création de dossiers avec compression
  async handleFolderCreation(folderPath, files)
}
```

### 3. CompressionConfig

```javascript
class CompressionConfig {
  // Niveau de compression (1-9)
  compressionLevel: 6
  
  // Types de fichiers à compresser
  compressibleTypes: ['.txt', '.js', '.css', '.html', '.json', '.xml']
  
  // Taille minimale pour déclencher compression (bytes)
  minFileSize: 1024
  
  // Timeout pour opérations de compression (ms)
  compressionTimeout: 5000
  
  // Algorithme utilisé (gzip, brotli, lz4)
  algorithm: 'gzip'
}
```

## Data Models

### Métadonnées de Fichier Étendues

```javascript
{
  originalPath: string,
  compressedPath: string,
  isCompressed: boolean,
  originalSize: number,
  compressedSize: number,
  compressionRatio: number,
  algorithm: string,
  compressedAt: Date,
  checksum: string
}
```

### Statistiques de Compression

```javascript
{
  totalFilesProcessed: number,
  totalFilesCompressed: number,
  totalSpaceSaved: number,
  averageCompressionRatio: number,
  compressionsByType: Map<string, CompressionStats>,
  lastUpdated: Date
}
```

## Error Handling

### Stratégies de Gestion d'Erreur

1. **Compression Échouée**
   - Stockage du fichier original sans compression
   - Log de l'erreur avec détails
   - Notification optionnelle à l'administrateur

2. **Décompression Échouée**
   - Tentative de récupération depuis backup
   - Retour d'erreur 500 si impossible
   - Log critique de l'incident

3. **Timeout de Compression**
   - Annulation de l'opération après timeout
   - Stockage du fichier original
   - Mise en queue pour retry différé

4. **Corruption de Fichier**
   - Vérification par checksum
   - Restauration depuis backup si disponible
   - Alerte administrateur

### Codes d'Erreur Spécifiques

```javascript
const COMPRESSION_ERRORS = {
  COMPRESSION_FAILED: 'COMP_001',
  DECOMPRESSION_FAILED: 'COMP_002',
  COMPRESSION_TIMEOUT: 'COMP_003',
  FILE_CORRUPTED: 'COMP_004',
  UNSUPPORTED_FORMAT: 'COMP_005'
};
```

## Testing Strategy

### Tests Unitaires

1. **CompressionService**
   - Test de compression/décompression pour différents types de fichiers
   - Test de gestion des erreurs et timeouts
   - Test de calcul des ratios de compression

2. **FileStorageMiddleware**
   - Test d'interception des uploads/downloads
   - Test de préservation de la structure de dossiers
   - Test de transparence API

3. **CompressionConfig**
   - Test de validation des configurations
   - Test de chargement/sauvegarde des paramètres

### Tests d'Intégration

1. **Workflow Complet**
   - Upload → Compression → Stockage → Récupération → Décompression
   - Test avec différents types et tailles de fichiers
   - Test de performance sous charge

2. **Compatibilité API**
   - Vérification que l'API existante fonctionne sans modification
   - Test des métadonnées de fichiers (taille, dates)
   - Test des permissions et sécurité

### Tests de Performance

1. **Benchmarks de Compression**
   - Mesure du temps de compression par type/taille de fichier
   - Comparaison des algorithmes (gzip vs brotli vs lz4)
   - Impact sur la mémoire et CPU

2. **Tests de Charge**
   - Simulation d'uploads multiples simultanés
   - Test de dégradation gracieuse sous charge
   - Vérification des timeouts et queues

### Tests de Récupération

1. **Scénarios de Panne**
   - Interruption pendant compression
   - Corruption de fichiers compressés
   - Perte de métadonnées

2. **Migration et Compatibilité**
   - Migration de fichiers existants non-compressés
   - Compatibilité ascendante/descendante
   - Rollback en cas de problème

## Implementation Notes

### Intégration avec Multer

Le middleware de compression s'intégrera avec Multer existant en interceptant les fichiers après upload temporaire mais avant déplacement final.

### Gestion des Dossiers

Pour l'exigence de création de dossiers lors d'upload, le système :
- Préservera la structure `webkitRelativePath` existante
- Appliquera la compression individuellement à chaque fichier
- Maintiendra les métadonnées de structure dans un index

### Algorithmes de Compression

- **gzip** : Bon compromis vitesse/ratio, largement supporté
- **brotli** : Meilleur ratio mais plus lent, pour fichiers texte
- **lz4** : Très rapide, pour gros fichiers binaires

### Stockage des Métadonnées

Les métadonnées seront stockées dans des fichiers `.meta` adjacents aux fichiers compressés, permettant une récupération rapide sans décompression.

### Configuration par Défaut

```javascript
const DEFAULT_CONFIG = {
  compressionLevel: 6,
  minFileSize: 1024,
  compressionTimeout: 5000,
  algorithm: 'gzip',
  compressibleTypes: ['.txt', '.js', '.css', '.html', '.json', '.xml', '.md'],
  excludeTypes: ['.jpg', '.png', '.gif', '.zip', '.rar', '.7z', '.mp4', '.mp3']
};
```