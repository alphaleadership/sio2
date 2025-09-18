const assert = require('assert');
const CompressionQueue = require('../../lib/compression/CompressionQueue');

// Simple test runner
async function runTests() {
  console.log('Running CompressionQueue tests...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  async function test(name, testFn) {
    try {
      console.log(`Testing: ${name}`);
      await testFn();
      console.log(`✓ ${name} passed\n`);
      testsPassed++;
    } catch (error) {
      console.log(`✗ ${name} failed: ${error.message}\n`);
      testsFailed++;
    }
  }

  // Test 1: Initialization with default values
  await test('should initialize with correct default values', async () => {
    const queue = new CompressionQueue();
    assert.strictEqual(queue.maxConcurrent, 3);
    assert.strictEqual(queue.maxRetries, 3);
    assert.strictEqual(queue.retryDelay, 1000);
    assert.strictEqual(queue.timeout, 30000);
    await queue.shutdown();
  });

  // Test 2: Initialization with custom options
  await test('should initialize with custom options', async () => {
    const queue = new CompressionQueue({
      maxConcurrent: 2,
      maxRetries: 2,
      retryDelay: 100,
      timeout: 1000
    });
    assert.strictEqual(queue.maxConcurrent, 2);
    assert.strictEqual(queue.maxRetries, 2);
    assert.strictEqual(queue.retryDelay, 100);
    assert.strictEqual(queue.timeout, 1000);
    await queue.shutdown();
  });

  // Test 3: Empty queue stats
  await test('should start with empty queue and correct stats', async () => {
    const queue = new CompressionQueue();
    const stats = queue.getStats();
    assert.strictEqual(stats.totalQueued, 0);
    assert.strictEqual(stats.totalProcessed, 0);
    assert.strictEqual(stats.currentActive, 0);
    assert.strictEqual(stats.currentPending, 0);
    assert.strictEqual(stats.isRunning, true);
    await queue.shutdown();
  });

  // Test 4: Add task successfully
  await test('should add task to queue successfully', async () => {
    const queue = new CompressionQueue({ timeout: 1000 });
    let functionCalled = false;
    let calledWith = null;
    
    const mockCompressionFunction = async (input, output, options) => {
      functionCalled = true;
      calledWith = { input, output, options };
      return { success: true };
    };
    
    const taskPromise = queue.addTask({
      id: 'test-task-1',
      inputPath: '/input/test.txt',
      outputPath: '/output/test.txt.gz',
      compressionFunction: mockCompressionFunction,
      options: { level: 6 }
    });

    const stats = queue.getStats();
    assert.strictEqual(stats.totalQueued, 1);

    const result = await taskPromise;
    assert.strictEqual(result.success, true);
    assert.strictEqual(functionCalled, true);
    assert.strictEqual(calledWith.input, '/input/test.txt');
    assert.strictEqual(calledWith.output, '/output/test.txt.gz');
    assert.deepStrictEqual(calledWith.options, { level: 6 });
    
    await queue.shutdown();
  });

  // Test 5: Reject invalid tasks
  await test('should reject invalid tasks', async () => {
    const queue = new CompressionQueue();
    
    try {
      await queue.addTask({
        id: 'invalid-task'
        // Missing required properties
      });
      throw new Error('Should have thrown an error');
    } catch (error) {
      assert(error.message.includes('Tâche invalide'));
    }
    
    await queue.shutdown();
  });

  // Test 6: Process multiple tasks concurrently
  await test('should process multiple tasks concurrently', async () => {
    const queue = new CompressionQueue({ maxConcurrent: 2, timeout: 2000 });
    
    let task1Started = false;
    let task2Started = false;
    
    const mockFunction1 = async () => {
      task1Started = true;
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true, id: 1 };
    };
    
    const mockFunction2 = async () => {
      task2Started = true;
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true, id: 2 };
    };

    const task1Promise = queue.addTask({
      id: 'concurrent-task-1',
      inputPath: '/input/test1.txt',
      outputPath: '/output/test1.txt.gz',
      compressionFunction: mockFunction1
    });

    const task2Promise = queue.addTask({
      id: 'concurrent-task-2',
      inputPath: '/input/test2.txt',
      outputPath: '/output/test2.txt.gz',
      compressionFunction: mockFunction2
    });

    const startTime = Date.now();
    const results = await Promise.all([task1Promise, task2Promise]);
    const duration = Date.now() - startTime;

    // Should complete in roughly 200ms (concurrent) rather than 400ms (sequential)
    assert(duration < 350, `Duration ${duration}ms should be less than 350ms`);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].success, true);
    assert.strictEqual(results[1].success, true);
    assert.strictEqual(task1Started, true);
    assert.strictEqual(task2Started, true);
    
    await queue.shutdown();
  });

  // Test 7: Retry failed tasks
  await test('should retry failed tasks', async () => {
    const queue = new CompressionQueue({ 
      maxRetries: 2, 
      retryDelay: 50,
      timeout: 2000 
    });
    
    let attemptCount = 0;
    const mockFunction = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Temporary failure');
      }
      return { success: true, attempts: attemptCount };
    };

    const result = await queue.addTask({
      id: 'retry-task',
      inputPath: '/input/test.txt',
      outputPath: '/output/test.txt.gz',
      compressionFunction: mockFunction
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.attempts, 3);
    assert.strictEqual(attemptCount, 3);
    
    await queue.shutdown();
  });

  // Test 8: Fail after max retries
  await test('should fail after max retries', async () => {
    const queue = new CompressionQueue({ 
      maxRetries: 2, 
      retryDelay: 50,
      timeout: 2000 
    });
    
    let attemptCount = 0;
    const mockFunction = async () => {
      attemptCount++;
      throw new Error('Persistent failure');
    };

    try {
      await queue.addTask({
        id: 'fail-task',
        inputPath: '/input/test.txt',
        outputPath: '/output/test.txt.gz',
        compressionFunction: mockFunction
      });
      throw new Error('Should have thrown an error');
    } catch (error) {
      assert(error.message.includes('Persistent failure'));
      // Should try initial + 2 retries = 3 times
      assert.strictEqual(attemptCount, 3);
    }
    
    await queue.shutdown();
  });

  // Test 9: Handle timeout
  await test('should handle timeout', async () => {
    const queue = new CompressionQueue({ timeout: 500 });
    
    const mockFunction = async () => {
      // Wait longer than timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    };

    try {
      await queue.addTask({
        id: 'timeout-task',
        inputPath: '/input/test.txt',
        outputPath: '/output/test.txt.gz',
        compressionFunction: mockFunction
      });
      throw new Error('Should have thrown a timeout error');
    } catch (error) {
      assert(error.message.includes('Timeout de compression'));
    }
    
    await queue.shutdown();
  });

  // Test 10: Pause and resume queue
  await test('should pause and resume queue', async () => {
    const queue = new CompressionQueue({ timeout: 2000 });
    let functionCalled = false;
    
    const mockFunction = async () => {
      functionCalled = true;
      return { success: true };
    };
    
    queue.pause();
    assert.strictEqual(queue.getStats().isRunning, false);

    // Add task while paused
    const taskPromise = queue.addTask({
      id: 'paused-task',
      inputPath: '/input/test.txt',
      outputPath: '/output/test.txt.gz',
      compressionFunction: mockFunction
    });

    // Wait a bit to ensure task doesn't start
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.strictEqual(functionCalled, false);

    // Resume and task should complete
    queue.resume();
    assert.strictEqual(queue.getStats().isRunning, true);

    await taskPromise;
    assert.strictEqual(functionCalled, true);
    
    await queue.shutdown();
  });

  // Test 11: Task status tracking
  await test('should track task status correctly', async () => {
    const queue = new CompressionQueue({ timeout: 2000 });
    
    const mockFunction = async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { success: true };
    };

    const taskPromise = queue.addTask({
      id: 'status-task',
      inputPath: '/input/test.txt',
      outputPath: '/output/test.txt.gz',
      compressionFunction: mockFunction
    });

    // Check pending status
    let status = queue.getTaskStatus('status-task');
    assert.strictEqual(status.status, 'pending');

    // Wait for processing to start
    await new Promise(resolve => setTimeout(resolve, 50));
    status = queue.getTaskStatus('status-task');
    assert.strictEqual(status.status, 'processing');

    // Wait for completion
    await taskPromise;
    status = queue.getTaskStatus('status-task');
    assert.strictEqual(status, null); // Task removed after completion
    
    await queue.shutdown();
  });

  // Test 12: Statistics accuracy
  await test('should provide accurate statistics', async () => {
    const queue = new CompressionQueue({ 
      maxRetries: 1, 
      retryDelay: 50,
      timeout: 1000 
    });
    
    const mockSuccess = async () => ({ success: true });
    const mockFailure = async () => { throw new Error('Test failure'); };

    // Add successful task
    await queue.addTask({
      id: 'success-task',
      inputPath: '/input/success.txt',
      outputPath: '/output/success.txt.gz',
      compressionFunction: mockSuccess
    });

    // Add failing task
    try {
      await queue.addTask({
        id: 'fail-task',
        inputPath: '/input/fail.txt',
        outputPath: '/output/fail.txt.gz',
        compressionFunction: mockFailure
      });
    } catch (error) {
      // Expected to fail
    }

    const stats = queue.getStats();
    assert.strictEqual(stats.totalQueued, 2);
    assert.strictEqual(stats.totalProcessed, 2);
    assert.strictEqual(stats.totalSucceeded, 1);
    assert.strictEqual(stats.totalFailed, 1);
    assert.strictEqual(stats.successRate, 50);
    
    await queue.shutdown();
  });

  // Résultats
  console.log(`\nTest Results:`);
  console.log(`✓ Passed: ${testsPassed}`);
  console.log(`✗ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Exécuter les tests si ce fichier est appelé directement
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };