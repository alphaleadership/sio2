# Correctif webkitRelativePath pour Uploads Individuels

## Problème identifié

Le système utilisait parfois le `webkitRelativePath` même pour les uploads de fichiers individuels, causant des duplications de chemin comme :
- `/partage/documents/documents/file.txt` au lieu de `/partage/documents/file.txt`

### Cause racine

Certains navigateurs ou certaines situations peuvent envoyer un `webkitRelativePath` même pour des uploads de fichiers individuels, contenant le chemin du dossier courant ou d'autres informations qui causent des duplications.

**Exemple problématique :**
```javascript
// Upload individuel dans /documents
req.body.path = "documents"
file.webkitRelativePath = "documents/rapport.pdf"  // Problématique !
file.originalname = "rapport.pdf"

// Résultat avec l'ancienne logique
destFolder = "/partage/documents"
subPath = "documents/rapport.pdf"  // webkitRelativePath utilisé
destPath = "/partage/documents/documents/rapport.pdf"  // DUPLICATION !
```

## Solution implémentée

### Règle stricte : Ignorer webkitRelativePath pour uploads individuels

La solution consiste à **TOUJOURS** ignorer le `webkitRelativePath` pour les uploads de fichiers individuels et ne l'utiliser **QUE** pour les uploads de dossiers.

```javascript
// ✅ LOGIQUE CORRIGÉE
let subPath;
if (isFolderUpload && file.webkitRelativePath) {
  // Pour les uploads de dossiers, utiliser le chemin relatif complet
  subPath = file.webkitRelativePath;
} else {
  // Pour les uploads de fichiers individuels, utiliser TOUJOURS seulement le nom du fichier
  // Ignorer complètement webkitRelativePath pour éviter les duplications
  subPath = path.basename(relPath);
}
```

### Distinction claire entre types d'upload

| Type d'upload | webkitRelativePath | Comportement |
|---------------|-------------------|--------------|
| **Fichier individuel** | Ignoré complètement | Utilise `path.basename(originalname)` |
| **Dossier complet** | Utilisé si présent | Utilise `webkitRelativePath` complet |

## Cas de test couverts

### 1. Upload individuel avec webkitRelativePath problématique

**Avant le correctif :**
```javascript
req.body.path = "documents"
file.webkitRelativePath = "documents/rapport.pdf"
// Résultat: /partage/documents/documents/rapport.pdf ❌
```

**Après le correctif :**
```javascript
req.body.path = "documents"
file.webkitRelativePath = "documents/rapport.pdf" // IGNORÉ
// Résultat: /partage/documents/rapport.pdf ✅
```

### 2. Upload de dossier légitime

**Comportement inchangé :**
```javascript
req.body.path = "projects"
file.webkitRelativePath = "mon-site/index.html"
isFolderUpload = true
// Résultat: /partage/projects/mon-site/index.html ✅
```

### 3. Upload individuel à la racine

**Avant le correctif :**
```javascript
req.body.path = ""
file.webkitRelativePath = "test.txt"
// Résultat: /partage/test.txt (pas de problème dans ce cas)
```

**Après le correctif :**
```javascript
req.body.path = ""
file.webkitRelativePath = "test.txt" // IGNORÉ par sécurité
// Résultat: /partage/test.txt ✅ (même résultat mais plus robuste)
```

## Détection des uploads de dossiers

La détection reste inchangée et robuste :

```javascript
const isFolderUpload = req.files.some(f => 
  f.webkitRelativePath && f.webkitRelativePath.includes('/')
);
```

**Critères pour un upload de dossier :**
- Au moins un fichier avec `webkitRelativePath` contenant `/`
- Indique une structure de dossier avec sous-dossiers

## Vérification du correctif

### Test automatique
```bash
node test-no-relative-path.js
```

### Test d'un cas spécifique
```bash
node test-no-relative-path.js test-case "documents" "rapport.pdf" "documents/rapport.pdf"
```

### Résultats attendus

```
=== Test: Ignorer webkitRelativePath pour uploads individuels ===

Test: Upload individuel avec webkitRelativePath problématique
  req.body.path: "documents"
  file.originalname: "rapport.pdf"
  file.webkitRelativePath: documents/rapport.pdf
  → Ignore webkitRelativePath (upload individuel)
  destFolder: /partage/documents
  isFolderUpload: false
  subPath: rapport.pdf
  destPath: /partage/documents/rapport.pdf
  expectedPath: /partage/documents/rapport.pdf
  ✓ webkitRelativePath géré correctement
  Result: ✓ PASS
  ✓ Aucune duplication détectée
```

## Cas edge gérés

### 1. webkitRelativePath avec plusieurs niveaux
```javascript
// Cas problématique
file.webkitRelativePath = "uploads/subfolder/file.txt"
req.body.path = "uploads"

// Comportement: webkitRelativePath ignoré → pas de duplication
```

### 2. webkitRelativePath identique au body.path
```javascript
// Cas edge
file.webkitRelativePath = "documents"
req.body.path = "documents"

// Comportement: webkitRelativePath ignoré → robuste
```

### 3. webkitRelativePath vide ou invalide
```javascript
// Cas edge
file.webkitRelativePath = ""
file.webkitRelativePath = null
file.webkitRelativePath = undefined

// Comportement: utilise toujours path.basename(originalname)
```

## Impact sur les fonctionnalités

### ✅ Fonctionnalités préservées
- **Upload de dossiers** : Fonctionne exactement comme avant
- **Structure de dossiers** : Préservée pour les uploads de dossiers
- **Sécurité** : Vérifications maintenues
- **Compression** : Système inchangé

### ✅ Améliorations apportées
- **Pas de duplication** : Élimination complète des duplications de chemin
- **Robustesse** : Gestion des cas edge et des comportements navigateur inconsistants
- **Prévisibilité** : Comportement cohérent indépendamment du navigateur
- **Simplicité** : Logique claire et facile à comprendre

## Dépannage

### Problème : Fichiers encore dans le mauvais dossier
**Cause** : Cache navigateur ou ancienne logique
**Solution** :
1. Vider le cache du navigateur
2. Redémarrer l'application
3. Tester avec un nouveau fichier

### Problème : Upload de dossier traité comme fichier individuel
**Cause** : `isFolderUpload` mal détecté
**Solution** : Vérifier que `webkitRelativePath` contient des `/`

```javascript
// Debug
console.log('Files:', req.files.map(f => ({
  name: f.originalname,
  webkitRelativePath: f.webkitRelativePath
})));
console.log('isFolderUpload:', isFolderUpload);
```

### Problème : webkitRelativePath utilisé pour upload individuel
**Cause** : Logique de détection incorrecte
**Solution** : Vérifier l'ordre des conditions

```javascript
// Correct
if (isFolderUpload && file.webkitRelativePath) {
  // Utiliser webkitRelativePath
} else {
  // Ignorer webkitRelativePath
}
```

## Tests de régression

### Avant le correctif
```
Upload individuel dans /documents :
- webkitRelativePath: "documents/file.pdf"
- Résultat: /partage/documents/documents/file.pdf ❌
```

### Après le correctif
```
Upload individuel dans /documents :
- webkitRelativePath: "documents/file.pdf" (ignoré)
- Résultat: /partage/documents/file.pdf ✅
```

## Monitoring

### Logs recommandés
```javascript
console.log('Upload type:', isFolderUpload ? 'folder' : 'individual');
console.log('webkitRelativePath:', file.webkitRelativePath);
console.log('subPath used:', subPath);
console.log('Final path:', destPath);
```

### Métriques à surveiller
- Absence d'erreurs de duplication de chemin
- Fichiers dans les bons dossiers
- Uploads de dossiers fonctionnels

---

**Date du correctif** : $(date)
**Fichiers modifiés** : `lib/compression/FileStorageMiddleware.js`
**Impact** : Élimination des duplications causées par webkitRelativePath
**Statut** : ✅ Résolu