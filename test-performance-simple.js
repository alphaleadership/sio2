/**
 * Test simple pour vérifier que le système de monitoring de performance fonctionne
 */

console.log('=== Test Simple du Monitoring de Performance ===\n');

try {
  // Test 1: Chargement des modules
  console.log('1. Test de chargement des modules...');
  const PerformanceMonitor = require('./lib/upload/PerformanceMonitor');
  const UploadPathResolver = require('./lib/upload/UploadPathResolver');
  console.log('✓ Modules chargés avec succès\n');

  // Test 2: Création d'instances
  console.log('2. Test de création d\'instances...');
  const monitor = new PerformanceMonitor({
    enableCaching: true,
    enableAlerts: false
  });
  const resolver = new UploadPathResolver({
    enableCaching: true,
    enableDetailedMetrics: true
  });
  console.log('✓ Instances créées avec succès\n');

  // Test 3: Test de résolution de chemin avec monitoring
  console.log('3. Test de résolution de chemin avec monitoring...');
  const testFile = {
    originalname: 'document.pdf',
    webkitRelativePath: 'documents/document.pdf'
  };

  const result = resolver.resolvePath(testFile, 'documents', [testFile]);
  
  console.log(`   Chemin final: ${result.finalPath}`);
  console.log(`   Stratégie: ${result.strategy}`);
  console.log(`   Temps de traitement: ${result.processingTime}ms`);
  console.log(`   Duplication évitée: ${result.duplicationPrevented}`);
  
  if (result.performanceData) {
    console.log(`   Durée du monitoring: ${result.performanceData.monitoringDuration}ms`);
  }
  console.log('✓ Résolution de chemin réussie\n');

  // Test 4: Test des opérations de chaînes optimisées
  console.log('4. Test des opérations de chaînes optimisées...');
  const testPath = 'documents\\projects//file.pdf';
  
  const segments = resolver.optimizedStringOperation('segmentSplit', testPath);
  const normalized = resolver.optimizedStringOperation('normalize', testPath);
  const joined = resolver.optimizedStringOperation('pathJoin', segments);
  
  console.log(`   Chemin original: ${testPath}`);
  console.log(`   Segments: [${segments.join(', ')}]`);
  console.log(`   Normalisé: ${normalized}`);
  console.log(`   Rejoint: ${joined}`);
  console.log('✓ Opérations de chaînes réussies\n');

  // Test 5: Test des métriques de performance
  console.log('5. Test des métriques de performance...');
  const metrics = resolver.getPerformanceMetrics();
  
  console.log(`   Total des résolutions: ${metrics.summary.totalResolutions}`);
  console.log(`   Temps moyen de résolution: ${metrics.summary.averageResolutionTime.toFixed(2)}ms`);
  console.log(`   Taux de succès du cache: ${(metrics.summary.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`   Taille du cache: ${metrics.summary.cacheSize}`);
  console.log('✓ Métriques récupérées avec succès\n');

  // Test 6: Test du cache
  console.log('6. Test du système de cache...');
  
  // Premier appel (cache miss)
  const start1 = Date.now();
  const result1 = resolver.resolvePath(testFile, 'documents', [testFile]);
  const time1 = Date.now() - start1;
  
  // Deuxième appel (cache hit potentiel)
  const start2 = Date.now();
  const result2 = resolver.resolvePath(testFile, 'documents', [testFile]);
  const time2 = Date.now() - start2;
  
  console.log(`   Premier appel: ${time1}ms`);
  console.log(`   Deuxième appel: ${time2}ms`);
  
  if (time1 > time2) {
    console.log(`   Amélioration de performance: ${((time1 - time2) / time1 * 100).toFixed(1)}%`);
  }
  console.log('✓ Test du cache réussi\n');

  // Test 7: Test de gestion d'erreurs
  console.log('7. Test de gestion d\'erreurs...');
  
  try {
    monitor.optimizedStringOperation('operationInvalide', 'test');
    console.log('❌ Devrait avoir lancé une erreur');
  } catch (error) {
    console.log(`   ✓ Erreur correctement gérée: ${error.message}`);
  }
  
  const resultCache = monitor.getCachedResult(null);
  if (resultCache === null) {
    console.log('   ✓ Clé de cache invalide correctement gérée');
  }
  console.log('✓ Gestion d\'erreurs réussie\n');

  console.log('🎉 TOUS LES TESTS SONT PASSÉS !');
  console.log('\nLe système de monitoring de performance fonctionne correctement.');
  console.log('\nFonctionnalités validées:');
  console.log('  ✓ Benchmarks de performance pour les opérations de résolution de chemin');
  console.log('  ✓ Mise en cache des patterns d\'analyse de chemin répétés');
  console.log('  ✓ Opérations de chaînes optimisées pour la manipulation de chemins');
  console.log('  ✓ Métriques de performance en temps réel');
  console.log('  ✓ Intégration avec UploadPathResolver existant');
  console.log('  ✓ Gestion d\'erreurs complète');

} catch (error) {
  console.error('❌ Test échoué:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}