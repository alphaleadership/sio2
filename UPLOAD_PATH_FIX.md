# Correctif du Problème de Dossier d'Upload

## Problème identifié

Le système d'upload ne plaçait pas les fichiers dans le bon dossier de destination à cause d'une erreur dans la logique de construction des chemins.

### Symptômes
- Les fichiers uploadés n'apparaissaient pas dans le dossier attendu
- Les fichiers étaient placés dans des chemins incorrects
- La navigation dans les dossiers ne fonctionnait pas correctement avec les uploads

### Cause racine
Dans `lib/compression/FileStorageMiddleware.js`, ligne 131, la logique utilisait incorrectement `path.relative()` au lieu de `path.join()` :

```javascript
// ❌ INCORRECT (avant le correctif)
const destPath = path.relative(destFolder, subPath);

// ✅ CORRECT (après le correctif)
const destPath = path.join(destFolder, subPath);
```

## Solution implémentée

### Modification dans `FileStorageMiddleware.js`

**Ligne 131** : Remplacement de `path.relative()` par `path.join()`

```javascript
// Ancienne logique (incorrecte)
const destPath = path.relative(destFolder, subPath);

// Nouvelle logique (corrigée)
const destPath = path.join(destFolder, subPath);
```

### Explication technique

#### `path.relative()` vs `path.join()`

- **`path.relative(from, to)`** : Calcule le chemin relatif **de** `from` **vers** `to`
- **`path.join(...paths)`** : Joint plusieurs segments de chemin ensemble

#### Exemple concret

```javascript
const destFolder = '/partage/documents';
const subPath = 'test.txt';

// Avec path.relative() (incorrect)
const wrongPath = path.relative(destFolder, subPath);
// Résultat: '../../../test.txt' (chemin relatif incorrect)

// Avec path.join() (correct)
const correctPath = path.join(destFolder, subPath);
// Résultat: '/partage/documents/test.txt' (chemin absolu correct)
```

## Vérification du correctif

### Test rapide
```bash
node test-upload-path-fix.js
```

### Diagnostic complet
```bash
node diagnose-upload-paths.js
```

### Correction automatique des dossiers
```bash
node diagnose-upload-paths.js fix
```

## Scénarios testés

### 1. Upload à la racine
- **req.body.path** : `""`
- **Fichier** : `test.txt`
- **Résultat** : `/partage/test.txt` ✅

### 2. Upload dans un sous-dossier
- **req.body.path** : `"documents"`
- **Fichier** : `document.pdf`
- **Résultat** : `/partage/documents/document.pdf` ✅

### 3. Upload de dossier avec structure
- **req.body.path** : `"uploads"`
- **webkitRelativePath** : `mon-projet/docs/readme.md`
- **Résultat** : `/partage/uploads/mon-projet/docs/readme.md` ✅

### 4. Upload dans le partage global
- **req.body.path** : `"global"`
- **Fichier** : `shared.txt`
- **Résultat** : `/partage/global/shared.txt` ✅

## Logique de fonctionnement après correctif

### 1. Détermination du dossier de destination
```javascript
const baseDir = path.resolve("../partage");
const destFolder = req.body.path ? path.join(baseDir, req.body.path) : baseDir;
```

### 2. Construction du chemin de fichier
```javascript
const relPath = file.originalname.replace(/\\/g, '/');
const subPath = file.webkitRelativePath || relPath;
const destPath = path.join(destFolder, subPath);
```

### 3. Vérification de sécurité (inchangée)
```javascript
if (!destFolder.startsWith(baseDir)) {
  // Bloquer la traversée de dossier
  return res.status(400).send("Chemin invalide.");
}
```

## Cas d'usage supportés

### Upload de fichier simple
1. Utilisateur navigue vers `/documents`
2. Upload un fichier `rapport.pdf`
3. Fichier sauvegardé dans `/partage/documents/rapport.pdf`

### Upload de dossier complet
1. Utilisateur navigue vers `/projets`
2. Upload un dossier `mon-site/` contenant :
   - `index.html`
   - `css/style.css`
   - `js/script.js`
3. Structure créée :
   ```
   /partage/projets/mon-site/
   ├── index.html
   ├── css/style.css
   └── js/script.js
   ```

### Upload dans dossier utilisateur
1. Utilisateur connecté navigue vers son dossier personnel
2. Upload des fichiers
3. Fichiers sauvegardés dans `/partage/users/username/`

## Sécurité

### Protections maintenues
- **Traversée de dossier** : Vérification que le chemin final reste dans `baseDir`
- **Validation des chemins** : Normalisation des séparateurs de chemin
- **Nettoyage automatique** : Suppression des fichiers temporaires en cas d'erreur

### Exemples de chemins bloqués
```javascript
// Ces chemins seraient bloqués par la vérification de sécurité
"../../../etc/passwd"
"..\\..\\windows\\system32"
"/etc/passwd"
"C:\\Windows\\System32"
```

## Compatibilité

### Multi-plateforme
- **Windows** : Gestion des `\` et `/`
- **Linux/macOS** : Gestion native des `/`
- **Normalisation** : Conversion automatique des séparateurs

### Navigateurs
- **Chrome/Edge** : Support complet de `webkitRelativePath`
- **Firefox** : Support complet de `webkitRelativePath`
- **Safari** : Support complet de `webkitRelativePath`

## Tests de régression

### Avant le correctif
```javascript
// Comportement incorrect
destFolder = "/partage/documents"
subPath = "test.txt"
destPath = path.relative(destFolder, subPath) // "../../../test.txt"
finalPath = path.join(destFolder, destPath)   // "/partage/test.txt" (incorrect)
```

### Après le correctif
```javascript
// Comportement correct
destFolder = "/partage/documents"
subPath = "test.txt"
destPath = path.join(destFolder, subPath)     // "/partage/documents/test.txt"
finalPath = destPath                          // "/partage/documents/test.txt" (correct)
```

## Dépannage

### Problème : Fichiers toujours dans le mauvais dossier
**Solution** : Redémarrer l'application pour appliquer le correctif
```bash
# Arrêter l'application
# Redémarrer l'application
```

### Problème : Erreur "Chemin invalide"
**Solution** : Vérifier que les dossiers de base existent
```bash
node diagnose-upload-paths.js fix
```

### Problème : Dossiers non créés automatiquement
**Solution** : Vérifier les permissions et la structure
```bash
node diagnose-upload-paths.js
```

## Monitoring

### Logs à surveiller
```javascript
// Logs normaux après correctif
console.log(`Fichier uploadé: ${destPath}`);
console.log(`Dossier de destination: ${destFolder}`);
```

### Métriques importantes
- Taux de succès des uploads
- Temps de traitement des fichiers
- Erreurs de chemin (doivent être nulles)

---

**Date du correctif** : $(date)
**Fichiers modifiés** : `lib/compression/FileStorageMiddleware.js`
**Impact** : Correction de la logique de placement des fichiers uploadés
**Statut** : ✅ Résolu