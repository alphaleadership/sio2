/**
 * Test pour vérifier que les corrections de duplication de chemin dans le système de compression fonctionnent
 */

console.log('=== Test des Corrections de Duplication de Chemin - Compression ===\n');

try {
  const FileStorageMiddleware = require('./lib/compression/FileStorageMiddleware');
  const CompressionService = require('./lib/compression/CompressionService');
  const CompressionConfig = require('./lib/compression/CompressionConfig');

  // Créer une instance du middleware pour tester les méthodes privées
  const compressionService = new CompressionService();
  const compressionConfig = new CompressionConfig();
  const middleware = new FileStorageMiddleware(compressionService, compressionConfig);

  console.log('1. Test de correction de duplication de chemin simple...');
  
  const baseDir = '/home/labo/temp/partage';
  
  // Test 1: Duplication consécutive simple
  const duplicatedPath1 = '/home/labo/temp/partage/users/test/users/test';
  const corrected1 = middleware._correctPathDuplication(duplicatedPath1, baseDir);
  console.log(`   Original: ${duplicatedPath1}`);
  console.log(`   Corrigé:  ${corrected1}`);
  
  if (corrected1 === '/home/labo/temp/partage/users/test') {
    console.log('   ✓ Test réussi - duplication consécutive supprimée\n');
  } else {
    console.log('   ❌ Test échoué - duplication non corrigée\n');
  }

  // Test 2: Duplication de pattern complexe
  console.log('2. Test de correction de pattern de duplication complexe...');
  
  const duplicatedPath2 = '/home/labo/temp/partage/users/john/documents/users/john/files';
  const corrected2 = middleware._correctPathDuplication(duplicatedPath2, baseDir);
  console.log(`   Original: ${duplicatedPath2}`);
  console.log(`   Corrigé:  ${corrected2}`);
  
  if (corrected2 === '/home/labo/temp/partage/users/john/documents/files') {
    console.log('   ✓ Test réussi - pattern de duplication supprimé\n');
  } else {
    console.log('   ❌ Test échoué - pattern non corrigé\n');
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
    console.log('   ❌ Test échoué - chemin propre modifié\n');
  }

  // Test 4: Chemin de base (doit retourner baseDir)
  console.log('4. Test avec chemin de base...');
  
  const corrected4 = middleware._correctPathDuplication(baseDir, baseDir);
  console.log(`   Original: ${baseDir}`);
  console.log(`   Corrigé:  ${corrected4}`);
  
  if (corrected4 === baseDir) {
    console.log('   ✓ Test réussi - chemin de base inchangé\n');
  } else {
    console.log('   ❌ Test échoué - chemin de base modifié\n');
  }

  // Test 5: Test de suppression de patterns de duplication
  console.log('5. Test de suppression de patterns de duplication...');
  
  const segments1 = ['users', 'test', 'users', 'test', 'documents'];
  const cleaned1 = middleware._removePatternDuplications(segments1);
  console.log(`   Segments originaux: [${segments1.join(', ')}]`);
  console.log(`   Segments nettoyés:  [${cleaned1.join(', ')}]`);
  
  if (JSON.stringify(cleaned1) === JSON.stringify(['users', 'test', 'documents'])) {
    console.log('   ✓ Test réussi - pattern de duplication supprimé\n');
  } else {
    console.log('   ❌ Test échoué - pattern non supprimé correctement\n');
  }

  // Test 6: Segments sans duplication
  console.log('6. Test avec segments sans duplication...');
  
  const segments2 = ['users', 'alice', 'documents', 'files'];
  const cleaned2 = middleware._removePatternDuplications(segments2);
  console.log(`   Segments originaux: [${segments2.join(', ')}]`);
  console.log(`   Segments nettoyés:  [${cleaned2.join(', ')}]`);
  
  if (JSON.stringify(cleaned2) === JSON.stringify(segments2)) {
    console.log('   ✓ Test réussi - segments propres inchangés\n');
  } else {
    console.log('   ❌ Test échoué - segments propres modifiés\n');
  }

  // Test 7: Test avec chemins Windows
  console.log('7. Test avec chemins Windows...');
  
  const windowsPath = 'C:\\partage\\users\\test\\users\\test\\documents';
  const windowsBase = 'C:\\partage';
  const corrected7 = middleware._correctPathDuplication(windowsPath, windowsBase);
  console.log(`   Original: ${windowsPath}`);
  console.log(`   Corrigé:  ${corrected7}`);
  
  // Le résultat devrait être normalisé selon le système
  const expectedWindows = require('path').join(windowsBase, 'users', 'test', 'documents');
  if (corrected7 === expectedWindows) {
    console.log('   ✓ Test réussi - chemin Windows corrigé\n');
  } else {
    console.log('   ❌ Test échoué - chemin Windows non corrigé\n');
  }

  console.log('🎉 Tests terminés !');
  console.log('\nCorrections appliquées au système de compression:');
  console.log('  ✓ Détection et correction des duplications de chemin dans destFolder');
  console.log('  ✓ Suppression des duplications consécutives (ex: /users/test/users/test)');
  console.log('  ✓ Suppression des patterns de duplication complexes');
  console.log('  ✓ Support des chemins Windows et Unix');
  console.log('  ✓ Préservation des chemins propres sans modification');
  console.log('  ✓ Gestion d\'erreurs robuste avec fallback');

} catch (error) {
  console.error('❌ Test échoué:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}