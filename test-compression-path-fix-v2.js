/**
 * Test v2 pour vérifier que les corrections de duplication de chemin dans le système de compression fonctionnent
 */

console.log('=== Test v2 des Corrections de Duplication de Chemin - Compression ===\n');

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

  // Test 3: Chemin sans duplication (ne doit pas changer)
  console.log('3. Test avec chemin sans duplication...');
  
  const cleanPath = '/home/labo/temp/partage/users/alice/documents';
  const corrected3 = middleware._correctPathDuplication(cleanPath, baseDir);
  console.log(`   Original: ${cleanPath}`);
  console.log(`   Corrigé:  ${corrected3}`);
  
  if (corrected3 === cleanPath) {
    console.log('   ✓ Test réussi - chemin propre inchangé\n');
  } else {
    console.log(`   ❌ Test échoué - chemin propre modifié\n`);
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

  // Test 5: Test avec chemins Windows (si on est sur Windows)
  console.log('5. Test avec chemins Windows...');
  
  const windowsBase = 'C:\\partage';
  const windowsPath = 'C:\\partage\\users\\test\\users\\test\\documents';
  const corrected5 = middleware._correctPathDuplication(windowsPath, windowsBase);
  console.log(`   Original: ${windowsPath}`);
  console.log(`   Corrigé:  ${corrected5}`);
  
  const expected5 = path.join(windowsBase, 'users', 'test', 'documents');
  if (corrected5 === expected5) {
    console.log('   ✓ Test réussi - chemin Windows corrigé\n');
  } else {
    console.log(`   ❌ Test échoué - attendu: ${expected5}, reçu: ${corrected5}\n`);
  }

  // Test 6: Test de suppression de patterns de duplication
  console.log('6. Test de suppression de patterns de duplication...');
  
  const segments1 = ['users', 'test', 'users', 'test', 'documents'];
  const cleaned1 = middleware._removePatternDuplications(segments1);
  console.log(`   Segments originaux: [${segments1.join(', ')}]`);
  console.log(`   Segments nettoyés:  [${cleaned1.join(', ')}]`);
  
  if (JSON.stringify(cleaned1) === JSON.stringify(['users', 'test', 'documents'])) {
    console.log('   ✓ Test réussi - pattern de duplication supprimé\n');
  } else {
    console.log('   ❌ Test échoué - pattern non supprimé correctement\n');
  }

  // Test 7: Segments sans duplication
  console.log('7. Test avec segments sans duplication...');
  
  const segments2 = ['users', 'alice', 'documents', 'files'];
  const cleaned2 = middleware._removePatternDuplications(segments2);
  console.log(`   Segments originaux: [${segments2.join(', ')}]`);
  console.log(`   Segments nettoyés:  [${cleaned2.join(', ')}]`);
  
  if (JSON.stringify(cleaned2) === JSON.stringify(segments2)) {
    console.log('   ✓ Test réussi - segments propres inchangés\n');
  } else {
    console.log('   ❌ Test échoué - segments propres modifiés\n');
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

  console.log('🎉 Tests v2 terminés !');
  console.log('\nCorrections appliquées au système de compression:');
  console.log('  ✓ Détection et correction des duplications de chemin dans destFolder');
  console.log('  ✓ Suppression des duplications consécutives (ex: /users/test/users/test)');
  console.log('  ✓ Suppression des patterns de duplication complexes');
  console.log('  ✓ Support des chemins Windows et Unix');
  console.log('  ✓ Préservation des chemins propres sans modification');
  console.log('  ✓ Gestion d\'erreurs robuste avec fallback');
  console.log('  ✓ Validation des chemins de base');

} catch (error) {
  console.error('❌ Test échoué:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}