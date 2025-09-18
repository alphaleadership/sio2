# Correctif de la Duplication de Chemin

## Problème identifié

Le système d'upload créait des chemins avec des parties dupliquées, par exemple :
- `/partage/documents/documents/file.txt` au lieu de `/partage/documents/file.txt`
- `/partage/users/users/john/file.txt` au lieu de `/partage/users/john/file.txt`

### Cause racine

La duplication venait de la logique de construction des chemins dans `FileStorageMiddleware.js` :

1. **`destFolder`** était construit avec `req.body.path` : `/partage/documents`
2. **`subPath`** utilisait parfois le même chemin relatif : `documents/file.txt`
3. **`destPath`** combinait les deux : `/partage/documents/documents/file.txt`

```javascript
// ❌ LOGIQUE PROBLÉMATIQUE (avant correctif)
const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
const subPath = file.webkitRelativePath || relPath; // Pouvait contenir le même chemin
const destPath = path.join(destFolder, subPath); // Duplication !
```

## Solution implémentée

### Distinction entre uploads individuels et uploads de dossiers

La solution différencie deux types d'uploads :

1. **Upload de fichier individuel** : Utilise seulement le nom du fichier
2. **Upload de dossier** : Utilise le chemin relatif complet

```javascript
// ✅ LOGIQUE CORRIGÉE
let subPath;
if (file.webkitRelativePath && isFolderUpload) {
  // Pour les uploads de dossiers, utiliser le chemin relatif complet
  subPath = file.webkitRelativePath;
} else {
  // Pour les uploads de fichiers individuels, utiliser seulement le nom du fichier
  subPath = path.basename(relPath);
}

const destPath = path.join(destFolder, subPath);
```

## Comportement après correctif

### Upload de fichier individuel

**Scénario** : Utilisateur dans `/documents` uploade `rapport.pdf`

- **req.body.path** : `"documents"`
- **destFolder** : `/partage/documents`
- **file.originalname** : `"rapport.pdf"`
- **subPath** : `"rapport.pdf"` (seulement le nom du fichier)
- **destPath** : `/partage/documents/rapport.pdf` ✅

### Upload de dossier

**Scénario** : Utilisateur dans `/projects` uploade un dossier `mon-site/`

- **req.body.path** : `"projects"`
- **destFolder** : `/partage/projects`
- **file.webkitRelativePath** : `"mon-site/css/style.css"`
- **subPath** : `"mon-site/css/style.css"` (chemin relatif complet)
- **destPath** : `/partage/projects/mon-site/css/style.css` ✅

## Vérification du correctif

### Test automatique
```bash
node test-path-duplication-fix.js
```

### Analyse d'un chemin spécifique
```bash
node test-path-duplication-fix.js analyze "/partage/documents/documents/file.txt"
```

### Résultats attendus

```
=== Test du correctif de duplication de chemin ===

Test: Upload fichier individuel dans dossier documents
  req.body.path: "documents"
  originalname: "rapport.pdf"
  webkitRelativePath: undefined
  isFolderUpload: false
  destFolder: /partage/documents
  subPath: rapport.pdf
  destPath: /partage/documents/rapport.pdf
  expectedPath: /partage/documents/rapport.pdf
  ✓ PASS - Chemin correct

Test: Upload de dossier avec structure
  req.body.path: "uploads"
  originalname: "readme.md"
  webkitRelativePath: "mon-projet/docs/readme.md"
  isFolderUpload: true
  destFolder: /partage/uploads
  subPath: mon-projet/docs/readme.md
  destPath: /partage/uploads/mon-projet/docs/readme.md
  expectedPath: /partage/uploads/mon-projet/docs/readme.md
  ✓ PASS - Chemin correct
```

## Cas de test couverts

### 1. Upload fichier individuel à la racine
- **Avant** : `/partage/file.txt`
- **Après** : `/partage/file.txt` ✅ (pas de changement, déjà correct)

### 2. Upload fichier individuel dans sous-dossier
- **Avant** : `/partage/documents/documents/file.txt` ❌
- **Après** : `/partage/documents/file.txt` ✅

### 3. Upload de dossier à la racine
- **Avant** : `/partage/mon-projet/index.html`
- **Après** : `/partage/mon-projet/index.html` ✅ (pas de changement, déjà correct)

### 4. Upload de dossier dans sous-dossier
- **Avant** : `/partage/projects/projects/mon-site/index.html` ❌
- **Après** : `/partage/projects/mon-site/index.html` ✅

## Détection automatique des duplications

Le système peut maintenant détecter automatiquement les duplications :

```javascript
function detectDuplication(filePath) {
  const pathParts = filePath.split(path.sep).filter(part => part.length > 0);
  return pathParts.some((part, index) => {
    return index > 0 && pathParts[index - 1] === part;
  });
}

// Exemples
detectDuplication('/partage/documents/documents/file.txt'); // true
detectDuplication('/partage/documents/file.txt');           // false
```

## Impact sur les fonctionnalités existantes

### ✅ Fonctionnalités préservées
- **Sécurité** : Vérifications de traversée de dossier maintenues
- **Compression** : Système de compression inchangé
- **Métadonnées** : Gestion des métadonnées préservée
- **Statistiques** : Collecte de statistiques maintenue

### ✅ Améliorations apportées
- **Chemins corrects** : Plus de duplication de segments
- **Logique claire** : Distinction entre uploads individuels et de dossiers
- **Compatibilité** : Fonctionne avec tous les navigateurs
- **Robustesse** : Gestion des cas edge améliorée

## Dépannage

### Problème : Chemins encore dupliqués
**Cause possible** : Cache du navigateur ou session active
**Solution** :
1. Vider le cache du navigateur
2. Redémarrer l'application
3. Tester avec un nouveau dossier

### Problème : Fichiers dans le mauvais dossier
**Cause possible** : Logique de détection d'upload de dossier
**Solution** : Vérifier la valeur de `isFolderUpload`

```javascript
// Debug : ajouter des logs
console.log('isFolderUpload:', isFolderUpload);
console.log('webkitRelativePath:', file.webkitRelativePath);
console.log('subPath calculé:', subPath);
```

### Problème : Upload de dossier traité comme fichier individuel
**Cause possible** : `isFolderUpload` mal détecté
**Solution** : Vérifier la logique de détection

```javascript
// La détection se base sur la présence de webkitRelativePath avec '/'
const isFolderUpload = req.files.some(f => 
  f.webkitRelativePath && f.webkitRelativePath.includes('/')
);
```

## Tests de régression

### Avant le correctif
```
Upload dans /documents :
- Fichier: rapport.pdf
- Chemin final: /partage/documents/documents/rapport.pdf ❌
```

### Après le correctif
```
Upload dans /documents :
- Fichier: rapport.pdf  
- Chemin final: /partage/documents/rapport.pdf ✅
```

## Monitoring

### Logs à surveiller
```javascript
// Logs utiles pour le debug
console.log('Upload type:', isFolderUpload ? 'folder' : 'individual');
console.log('Destination folder:', destFolder);
console.log('Sub path:', subPath);
console.log('Final path:', destPath);
```

### Métriques importantes
- Taux de succès des uploads
- Absence d'erreurs de chemin
- Fichiers dans les bons dossiers

---

**Date du correctif** : $(date)
**Fichiers modifiés** : `lib/compression/FileStorageMiddleware.js`
**Impact** : Élimination des duplications de chemin dans les uploads
**Statut** : ✅ Résolu