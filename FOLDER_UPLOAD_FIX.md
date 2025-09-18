# Correctif des Uploads de Dossiers avec Plusieurs Fichiers

## Problème identifié

Les uploads de dossiers avec plusieurs fichiers avaient des problèmes de duplication de chemin similaires aux uploads individuels, mais dans la méthode `handleFolderCreation`.

### Symptômes
- Fichiers de dossiers placés dans des chemins dupliqués
- Structure : `/partage/uploads/uploads/document.pdf` au lieu de `/partage/uploads/document.pdf`
- Problème spécifique aux uploads de dossiers multiples

### Cause racine

Dans `handleFolderCreation`, la logique utilisait directement `file.relativePath` ou `file.webkitRelativePath` sans vérifier les duplications potentielles :

```javascript
// ❌ LOGIQUE PROBLÉMATIQUE (avant correctif)
const relativePath = file.relativePath || file.webkitRelativePath || file.name;
const filePath = path.join(folderPath, relativePath); // Duplication possible !
```

## Solution implémentée

### Extension de la logique anti-duplication aux dossiers

La même logique anti-duplication utilisée pour les uploads individuels a été appliquée à `handleFolderCreation` :

```javascript
// ✅ LOGIQUE CORRIGÉE
let relativePath = file.relativePath || file.webkitRelativePath || file.name;

// Vérifier si l'utilisation du relativePath causerait une duplication
if (relativePath) {
  const potentialPath = path.join(folderPath, relativePath);
  const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
  const hasDuplication = pathParts.some((part, index) => {
    return index > 0 && pathParts[index - 1] === part;
  });
  
  if (hasDuplication) {
    // Duplication détectée → utiliser seulement le nom du fichier
    relativePath = path.basename(relativePath);
    console.log(`Duplication évitée dans dossier pour ${file.name}`);
  }
}

const filePath = path.join(folderPath, relativePath);
```

## Cas de test couverts

### 1. Upload de dossier simple sans duplication

**Scénario** : Upload d'un dossier `mon-site/` dans `/projects`

```javascript
// Fichiers
files: [
  { relativePath: 'mon-site/index.html' },
  { relativePath: 'mon-site/css/style.css' }
]

// Résultats
/partage/projects/mon-site/index.html ✅
/partage/projects/mon-site/css/style.css ✅
```

### 2. Upload de dossier avec duplication potentielle

**Scénario** : Upload avec `relativePath` contenant le nom du dossier de destination

```javascript
// Fichiers problématiques
files: [
  { relativePath: 'projects/mon-site/index.html' }, // Duplication !
  { relativePath: 'projects/css/style.css' }        // Duplication !
]

// Avant le correctif
/partage/projects/projects/mon-site/index.html ❌
/partage/projects/projects/css/style.css ❌

// Après le correctif
/partage/projects/index.html ✅ (utilise basename)
/partage/projects/style.css ✅ (utilise basename)
```

### 3. Upload de dossier mixte

**Scénario** : Certains fichiers avec duplication, d'autres sans

```javascript
// Fichiers mixtes
files: [
  { relativePath: 'projet/readme.md' },      // Pas de duplication
  { relativePath: 'uploads/config.json' }    // Duplication !
]

// Résultats
/partage/uploads/projet/readme.md ✅ (garde le chemin complet)
/partage/uploads/config.json ✅ (utilise basename)
```

## Logique de détection intelligente

### Algorithme de détection

```javascript
function detectDuplication(folderPath, relativePath) {
  const potentialPath = path.join(folderPath, relativePath);
  const pathParts = potentialPath.split(path.sep).filter(part => part.length > 0);
  
  return pathParts.some((part, index) => {
    return index > 0 && pathParts[index - 1] === part;
  });
}
```

### Exemples de détection

| folderPath | relativePath | Duplication | Action |
|------------|--------------|-------------|---------|
| `/partage/docs` | `readme.md` | Non | Garde le chemin |
| `/partage/docs` | `docs/readme.md` | Oui | Utilise `readme.md` |
| `/partage/uploads` | `project/file.txt` | Non | Garde le chemin |
| `/partage/uploads` | `uploads/project/file.txt` | Oui | Utilise `file.txt` |

## Cas edge gérés

### 1. Duplications multiples
```javascript
// Cas problématique
folderPath: '/partage/test'
relativePath: 'test/test/test/file.txt'

// Détection: Oui (triple duplication)
// Action: Utilise 'file.txt'
// Résultat: '/partage/test/file.txt'
```

### 2. Répétitions légitimes
```javascript
// Cas légitime
folderPath: '/partage/projects'
relativePath: 'my-project/project-files/project.js'

// Détection: Non (pas de duplication consécutive)
// Action: Garde le chemin complet
// Résultat: '/partage/projects/my-project/project-files/project.js'
```

### 3. Structure profonde avec duplication
```javascript
// Cas complexe
folderPath: '/partage/deep'
relativePath: 'deep/level1/deep/file.txt'

// Détection: Oui (duplication de "deep")
// Action: Utilise 'file.txt'
// Résultat: '/partage/deep/file.txt'
```

## Vérification du correctif

### Test automatique
```bash
node test-folder-upload-fix.js
```

### Test d'un cas spécifique
```bash
# Le test inclut un cas spécifique problématique
# uploads/documents/document.pdf → uploads/document.pdf
```

### Résultats attendus

```
=== Test spécifique d'un cas de dossier problématique ===

folderPath: D:\partage\uploads
file.relativePath: uploads/documents/document.pdf
potentialPath: D:\partage\uploads\uploads\documents\document.pdf
pathParts: [D:, partage, uploads, uploads, documents, document.pdf]
hasDuplication: true
→ Duplication détectée, utilise basename: document.pdf
finalPath: D:\partage\uploads\document.pdf
expectedPath: D:\partage\uploads\document.pdf

Résultat: ✅ CORRECT
```

## Impact sur les fonctionnalités

### ✅ Fonctionnalités préservées
- **Structure de dossiers** : Préservée quand légitime
- **Uploads individuels** : Fonctionnent toujours correctement
- **Compression** : Système inchangé
- **Métadonnées** : Gestion préservée

### ✅ Améliorations apportées
- **Pas de duplication** : Élimination complète pour les dossiers
- **Logique cohérente** : Même algorithme pour individuels et dossiers
- **Robustesse** : Gestion des cas edge complexes
- **Performance** : Détection efficace des duplications

## Intégration avec le système existant

### Méthodes modifiées
- `handleFolderCreation` : Ajout de la logique anti-duplication
- Logique identique à celle des uploads individuels
- Préservation de toute la logique existante

### Compatibilité
- **Uploads individuels** : Inchangés
- **Uploads de dossiers simples** : Inchangés si pas de duplication
- **Uploads problématiques** : Corrigés automatiquement

## Dépannage

### Problème : Fichiers de dossier dans le mauvais endroit
**Cause** : Duplication dans `relativePath`
**Solution** : La logique anti-duplication corrige automatiquement

### Problème : Structure de dossier aplatie
**Cause** : Tous les fichiers utilisent `basename`
**Solution** : Vérifier que seuls les cas avec duplication utilisent `basename`

```javascript
// Debug
console.log('relativePath original:', file.relativePath);
console.log('potentialPath:', potentialPath);
console.log('hasDuplication:', hasDuplication);
console.log('relativePath final:', finalRelativePath);
```

### Problème : Perte de structure légitime
**Cause** : Fausse détection de duplication
**Solution** : Vérifier l'algorithme de détection

```javascript
// L'algorithme ne détecte que les duplications consécutives
pathParts[i] === pathParts[i - 1] // Consécutif seulement
```

## Tests de régression

### Avant le correctif
```
Upload dossier dans /uploads :
- relativePath: "uploads/document.pdf"
- Résultat: /partage/uploads/uploads/document.pdf ❌
```

### Après le correctif
```
Upload dossier dans /uploads :
- relativePath: "uploads/document.pdf" (duplication détectée)
- Résultat: /partage/uploads/document.pdf ✅
```

## Monitoring

### Logs recommandés
```javascript
console.log('Folder upload processing:', {
  folderPath,
  originalRelativePath: file.relativePath,
  hasDuplication,
  finalRelativePath,
  finalPath
});
```

### Métriques à surveiller
- Absence d'erreurs de duplication dans les dossiers
- Structure de dossiers préservée quand légitime
- Performance des uploads de dossiers multiples

---

**Date du correctif** : $(date)
**Fichiers modifiés** : `lib/compression/FileStorageMiddleware.js` (méthode `handleFolderCreation`)
**Impact** : Élimination des duplications dans les uploads de dossiers
**Statut** : ✅ Résolu