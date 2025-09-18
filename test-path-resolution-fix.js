/**
 * Test pour vérifier que les corrections de résolution de chemin fonctionnent
 */

console.log('=== Test des Corrections de Résolution de Chemin ===\n');

try {
  const UploadPathResolver = require('./lib/upload/UploadPathResolver');
  const PathAnalysisEngine = require('./lib/upload/PathAnalysisEngine');
  const PathConstructionStrategy = require('./lib/upload/PathConstructionStrategy');

  console.log('1. Test avec fichiers sans webkitRelativePath...');
  
  const resolver = new UploadPathResolver({
    enableCaching: true,
    enableDetailedMetrics: true
  });

  // Test 1: Fichier sans webkitRelativePath
  const fileWithoutWebkit = {
    originalname: 'test.log',
    // webkitRelativePath manquant
  };

  const result1 = resolver.resolvePath(fileWithoutWebkit, '/home/test/uploads', [fileWithoutWebkit]);
  console.log(`   Résultat: ${result1.finalPath}`);
  console.log(`   Stratégie: ${result1.strategy}`);
  console.log(`   Erreur: ${result1.error || 'Non'}`);
  console.log(`   Avertissements: ${result1.warnings ? result1.warnings.join(', ') : 'Aucun'}`);
  
  if (result1.strategy === 'basename' && !result1.error) {
    console.log('   ✓ Test réussi - utilise basename comme attendu\n');
  } else {
    console.log('   ❌ Test échoué - devrait utiliser basename sans erreur\n');
  }

  // Test 2: Fichier avec webkitRelativePath vide
  console.log('2. Test avec webkitRelativePath vide...');
  
  const fileWithEmptyWebkit = {
    originalname: 'test2.log',
    webkitRelativePath: ''
  };

  const result2 = resolver.resolvePath(fileWithEmptyWebkit, '/home/test/uploads', [fileWithEmptyWebkit]);
  console.log(`   Résultat: ${result2.finalPath}`);
  console.log(`   Stratégie: ${result2.strategy}`);
  console.log(`   Erreur: ${result2.error || 'Non'}`);
  console.log(`   Avertissements: ${result2.warnings ? result2.warnings.join(', ') : 'Aucun'}`);
  
  if (result2.strategy === 'basename' && !result2.error) {
    console.log('   ✓ Test réussi - utilise basename comme attendu\n');
  } else {
    console.log('   ❌ Test échoué - devrait utiliser basename sans erreur\n');
  }

  // Test 3: Fichier avec webkitRelativePath valide
  console.log('3. Test avec webkitRelativePath valide...');
  
  const fileWithValidWebkit = {
    originalname: 'document.pdf',
    webkitRelativePath: 'documents/subfolder/document.pdf'
  };

  const result3 = resolver.resolvePath(fileWithValidWebkit, '/home/test/uploads', [fileWithValidWebkit]);
  console.log(`   Résultat: ${result3.finalPath}`);
  console.log(`   Stratégie: ${result3.strategy}`);
  console.log(`   Erreur: ${result3.error || 'Non'}`);
  console.log(`   Avertissements: ${result3.warnings ? result3.warnings.join(', ') : 'Aucun'}`);
  
  if (!result3.error) {
    console.log('   ✓ Test réussi - traite le webkit valide correctement\n');
  } else {
    console.log('   ❌ Test échoué - devrait traiter le webkit valide sans erreur\n');
  }

  // Test 4: Test de l'analyse de chemin
  console.log('4. Test de l\'analyse de chemin...');
  
  const engine = new PathAnalysisEngine();
  
  const filesWithoutWebkit = [
    { originalname: 'file1.log' },
    { originalname: 'file2.log' },
    { originalname: 'file3.log' }
  ];

  const analysis1 = engine.analyzeUploadContext(filesWithoutWebkit, '/home/test/uploads');
  console.log(`   Type d'upload: ${analysis1.uploadType}`);
  console.log(`   Stratégie recommandée: ${analysis1.strategy}`);
  console.log(`   Confiance: ${analysis1.confidence}`);
  console.log(`   Raisonnement: ${analysis1.reasoning}`);
  
  if (analysis1.strategy === 'basename') {
    console.log('   ✓ Test réussi - recommande basename pour fichiers sans webkit\n');
  } else {
    console.log('   ❌ Test échoué - devrait recommander basename\n');
  }

  // Test 5: Test de construction de chemin directe
  console.log('5. Test de construction de chemin directe...');
  
  const strategy = new PathConstructionStrategy();
  
  try {
    const path1 = strategy.constructBasename('/home/test/uploads', { originalname: 'test.log' });
    console.log(`   Basename: ${path1}`);
    console.log('   ✓ Construction basename réussie');
  } catch (error) {
    console.log(`   ❌ Erreur basename: ${error.message}`);
  }

  try {
    const path2 = strategy.constructWebkitPath('/home/test/uploads', { originalname: 'test.log' });
    console.log(`   ❌ Webkit sans webkitRelativePath devrait échouer mais a réussi: ${path2}`);
  } catch (error) {
    console.log(`   ✓ Webkit sans webkitRelativePath échoue comme attendu: ${error.message}`);
  }

  try {
    const path3 = strategy.constructWebkitPath('/home/test/uploads', { 
      originalname: 'test.log', 
      webkitRelativePath: 'docs/test.log' 
    });
    console.log(`   ✓ Webkit avec webkitRelativePath réussit: ${path3}`);
  } catch (error) {
    console.log(`   ❌ Erreur webkit valide: ${error.message}`);
  }

  console.log('\n6. Test de métriques de performance...');
  
  const metrics = resolver.getPerformanceMetrics();
  console.log(`   Total des résolutions: ${metrics.summary.totalResolutions}`);
  console.log(`   Temps moyen: ${metrics.summary.averageResolutionTime.toFixed(2)}ms`);
  console.log(`   Taux d'erreur: ${(metrics.summary.errorRate * 100).toFixed(1)}%`);
  
  if (metrics.summary.errorRate < 0.5) { // Moins de 50% d'erreurs
    console.log('   ✓ Taux d\'erreur acceptable');
  } else {
    console.log('   ⚠️  Taux d\'erreur élevé');
  }

  console.log('\n🎉 Tests terminés !');
  console.log('\nCorrections appliquées:');
  console.log('  ✓ Amélioration de la détection de webkitRelativePath manquant/vide');
  console.log('  ✓ Logique plus conservatrice dans PathAnalysisEngine');
  console.log('  ✓ Meilleure gestion d\'erreurs dans UploadPathResolver');
  console.log('  ✓ Validation améliorée dans PathConstructionStrategy');
  console.log('  ✓ Fallback automatique vers basename en cas d\'erreur');

} catch (error) {
  console.error('❌ Test échoué:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}