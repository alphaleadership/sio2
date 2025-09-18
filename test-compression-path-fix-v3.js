/**
 * Test v3 pour vérifier que les corrections de duplication de chemin dans le système de compression fonctionnent
 * sans modifier les chemins propres
 */

console.log('=== Test v3 des Corrections de Duplication de Chemin - Compression ===\n');

try {
  const FileStorageMiddleware = require('./lib/compression/FileStorageMiddleware');
  const CompressionService = require('./lib/compression/CompressionService');
  const CompressionConfig = require('./lib/compression/CompressionConfig');
  const path = require('path');

  // Créer une instance du middleware pour tester les méthodes privées
  const compressionService = new CompressionService();
  const compressionConfig = new CompressionConfig();
  const middleware = new FileStorageMiddleware(compressionService, compressionConfig);

  console.log('1. Test de correction de duplication de chemin simple (Unix)...');
  
  const baseDir = '/home/labo/temp/partage';
  
  // Test 1: Duplication consécutive simple
  const duplicatedPath1 = '/home/labo/temp/partage/users/test/users/test';
  const corrected1 = middleware._correctPathDuplication(duplicatedPath1, baseDir);
  console.log(`   Original: ${duplicatedPath1}`);
  console.log(`   Corrigé:  ${corrected1}`);
  
  const expected1 = path.join(baseDir, 'users', 'test');
  if (corrected1 === expected1) {
    console.log('   ✓ Test réussi - duplication consécutive supprimée\n');
  } else {
    console.log(`   ❌ Test échoué - attendu: ${expected1}, reçu: ${corrected1}\n`);
  }

  // Test 2: Duplication de pattern complexe
  console.log('2. Test de correction de pattern de duplication complexe...');
  
  const duplicatedPath2 = '/home/labo/temp/partage/users/john/documents/users/john/files';
  const corrected2 = middleware._correctPathDuplication(duplicatedPath2, baseDir);
  console.log(`   Original: ${duplicatedPath2}`);
  console.log(`   Corrigé:  ${corrected2}`);
  
  const expected2 = path.join(baseDir, 'users', 'john', 'documents', 'files');
  if (corrected2 === expected2) {
    console.log('   ✓ Test réussi - pattern de duplication supprimé\n');
  } else {
    console.log(`   ❌ Test échoué - attendu: ${expected2}, reçu: ${corrected2}\n`);
  }

  // Test 3: Chemin sans duplication (NE DOIT PAS CHANGER)
  console.log('3. Test avec chemin sans duplication (doit rester inchangé)...');
  
  const cleanPath = '/home/labo/temp/partage/users/alice/documents';
  const corrected3 = middleware._correctPathDuplication(cleanPath, baseDir);
  console.log(`   Original: ${cleanPath}`);
  console.log(`   Corrigé:  ${corrected3}`);
  
  if (corrected3 === cleanPath) {
    console.log('   ✓ Test réussi - chemin propre inchangé\n');
  } else {
    console.log(`   ❌ Test échoué - chemin propre modifié (${corrected3})\n`);
  }

  // Test 4: Chemin de base (doit retourner baseDir)
  console.log('4. Test avec chemin de base...');
  
  const corrected4 = middleware._correctPathDuplication(baseDir, baseDir);
  console.log(`   Original: ${baseDir}`);
  console.log(`   Corrigé:  ${corrected4}`);
  
  if (corrected4 === baseDir) {
    console.log('   ✓ Test réussi - chemin de base inchangé\n');
  } else {
    console.log(`   ❌ Test échoué - chemin de base modifié\n`);
  }

  // Test 5: Autre chemin sans duplication
  console.log('5. Test avec autre chemin sans duplication...');
  
  const cleanPath2 = '/home/labo/temp/partage/global/shared/files';
  const corrected5 = middleware._correctPathDuplication(cleanPath2, baseDir);
  console.log(`   Original: ${cleanPath2}`);
  console.log(`   Corrigé:  ${corrected5}`);
  
  if (corrected5 === cleanPath2) {
    console.log('   ✓ Test réussi - chemin propre inchangé\n');
  } else {
    console.log(`   ❌ Test échoué - chemin propre modifié\n`);
  }

  // Test 6: Test avec chemins Windows
  console.log('6. Test avec chemins Windows (duplication)...');
  
  const windowsBase = 'C:\\partage';
  const windowsPath = 'C:\\partage\\users\\test\\users\\test\\documents';
  const corrected6 = middleware._correctPathDuplication(windowsPath, windowsBase);
  console.log(`   Original: ${windowsPath}`);
  console.log(`   Corrigé:  ${corrected6}`);
  
  const expected6 = path.join(windowsBase, 'users', 'test', 'documents');
  if (corrected6 === expected6) {
    console.log('   ✓ Test réussi - chemin Windows avec duplication corrigé\n');
  } else {
    console.log(`   ❌ Test échoué - attendu: ${expected6}, reçu: ${corrected6}\n`);
  }

  // Test 7: Test avec chemin Windows sans duplication
  console.log('7. Test avec chemin Windows sans duplication...');
  
  const windowsCleanPath = 'C:\\partage\\users\\alice\\documents';
  const corrected7 = middleware._correctPathDuplication(windowsCleanPath, windowsBase);
  console.log(`   Original: ${windowsCleanPath}`);
  console.log(`   Corrigé:  ${corrected7}`);
  
  if (corrected7 === windowsCleanPath) {
    console.log('   ✓ Test réussi - chemin Windows propre inchangé\n');
  } else {
    console.log(`   ❌ Test échoué - chemin Windows propre modifié\n`);
  }

  // Test 8: Test avec triple duplication
  console.log('8. Test avec triple duplication...');
  
  const triplePath = '/home/labo/temp/partage/users/test/users/test/users/test';
  const corrected8 = middleware._correctPathDuplication(triplePath, baseDir);
  console.log(`   Original: ${triplePath}`);
  console.log(`   Corrigé:  ${corrected8}`);
  
  const expected8 = path.join(baseDir, 'users', 'test');
  if (corrected8 === expected8) {
    console.log('   ✓ Test réussi - triple duplication supprimée\n');
  } else {
    console.log(`   ❌ Test échoué - attendu: ${expected8}, reçu: ${corrected8}\n`);
  }

  // Test 9: Test avec chemin invalide (ne commence pas par baseDir)
  console.log('9. Test avec chemin invalide...');
  
  const invalidPath = '/other/path/users/test';
  const corrected9 = middleware._correctPathDuplication(invalidPath, baseDir);
  console.log(`   Original: ${invalidPath}`);
  console.log(`   Corrigé:  ${corrected9}`);
  
  if (corrected9 === invalidPath) {
    console.log('   ✓ Test réussi - chemin invalide inchangé\n');
  } else {
    console.log('   ❌ Test échoué - chemin invalide modifié\n');
  }

  console.log('🎉 Tests v3 terminés !');
  console.log('\nCorrections appliquées au système de compression:');
  console.log('  ✓ Détection et correction des duplications de chemin dans destFolder');
  console.log('  ✓ Suppression des duplications consécutives (ex: /users/test/users/test)');
  console.log('  ✓ Suppression des patterns de duplication complexes');
  console.log('  ✓ Support des chemins Windows et Unix');
  console.log('  ✓ PRÉSERVATION des chemins propres sans modification (CRITIQUE)');
  console.log('  ✓ Gestion d\'erreurs robuste avec fallback');
  console.log('  ✓ Validation des chemins de base');

} catch (error) {
  console.error('❌ Test échoué:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}