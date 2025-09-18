// Simple test runner for CompressionService
const { spawn } = require('child_process');
const path = require('path');

// Try to find node executable
const nodeExecutables = [
  'node',
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Program Files (x86)\\nodejs\\node.exe',
  "D:\\nvs\\node\\24.7.0\\x64\\node.exe"
];

async function findNodeExecutable() {
  for (const executable of nodeExecutables) {
    try {
      const child = spawn(executable, ['--version'], { stdio: 'pipe' });
      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject();
        });
        child.on('error', reject);
      });
      return executable;
    } catch (error) {
      continue;
    }
  }
  throw new Error('Node.js executable not found');
}

async function runTests() {
  try {
    const nodeExe = await findNodeExecutable();
    console.log(`Using Node.js executable: ${nodeExe}`);
    
    const testFile = path.join(__dirname, 'test', 'compression', 'CompressionConfig.test.js');
    
    const child = spawn(nodeExe, [testFile], { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    child.on('close', (code) => {
      process.exit(code);
    });
    
  } catch (error) {
    console.error('Error running tests:', error.message);
    
    // Fallback: try to require and run the test directly
    console.log('\nTrying fallback method...');
    try {
      require('./test/compression/CompressionConfig.test.js');
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError.message);
      process.exit(1);
    }
  }
}

runTests();