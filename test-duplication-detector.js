/**
 * Test runner for DuplicationDetector class
 * Tests the core path analysis components for upload path fix
 */

const DuplicationDetector = require('./lib/upload/DuplicationDetector');

function runTests() {
    console.log('=== Testing DuplicationDetector ===\n');
    
    const detector = new DuplicationDetector();
    let allTestsPassed = true;
    
    // Test consecutive duplicates detection
    console.log('Testing consecutive duplicates detection...');
    
    const consecutiveTests = [
        {
            name: 'Basic consecutive duplicate',
            input: 'documents/documents/rapport.pdf',
            expected: {
                hasDuplication: true,
                duplicatedSegments: ['documents'],
                suggestedPath: 'documents/rapport.pdf'
            }
        },
        {
            name: 'Multiple consecutive duplicates',
            input: 'folder/folder/subfolder/subfolder/file.txt',
            expected: {
                hasDuplication: true,
                duplicatedSegments: ['folder', 'subfolder'],
                suggestedPath: 'folder/subfolder/file.txt'
            }
        },
        {
            name: 'No duplicates',
            input: 'documents/reports/rapport.pdf',
            expected: {
                hasDuplication: false,
                duplicatedSegments: [],
                suggestedPath: 'documents/reports/rapport.pdf'
            }
        },
        {
            name: 'Windows path separators',
            input: 'documents\\documents\\rapport.pdf',
            expected: {
                hasDuplication: true,
                duplicatedSegments: ['documents'],
                suggestedPath: 'documents/rapport.pdf'
            }
        }
    ];
    
    for (const test of consecutiveTests) {
        const result = detector.detectConsecutiveDuplicates(test.input);
        const passed = 
            result.hasDuplication === test.expected.hasDuplication &&
            JSON.stringify(result.duplicatedSegments) === JSON.stringify(test.expected.duplicatedSegments) &&
            result.suggestedPath === test.expected.suggestedPath;
            
        console.log(`  ${test.name}: ${passed ? '✓ PASS' : '✗ FAIL'}`);
        if (!passed) {
            console.log(`    Expected: ${JSON.stringify(test.expected)}`);
            console.log(`    Got: ${JSON.stringify(result)}`);
            allTestsPassed = false;
        }
    }
    
    console.log('\nTesting user pattern duplicates detection...');
    
    const userPatternTests = [
        {
            name: 'User pattern duplication',
            input: 'users/john/users/john/file.txt',
            expected: {
                hasUserDuplication: true,
                duplicatedPattern: 'users/john',
                suggestedPath: 'users/john/file.txt'
            }
        },
        {
            name: 'Project pattern duplication',
            input: 'projects/myapp/projects/myapp/src/index.js',
            expected: {
                hasUserDuplication: true,
                duplicatedPattern: 'projects/myapp',
                suggestedPath: 'projects/myapp/src/index.js'
            }
        },
        {
            name: 'No user pattern duplication',
            input: 'users/john/documents/file.txt',
            expected: {
                hasUserDuplication: false,
                duplicatedPattern: '',
                suggestedPath: 'users/john/documents/file.txt'
            }
        }
    ];
    
    for (const test of userPatternTests) {
        const result = detector.detectUserPatternDuplication(test.input);
        const passed = 
            result.hasUserDuplication === test.expected.hasUserDuplication &&
            result.duplicatedPattern === test.expected.duplicatedPattern &&
            result.suggestedPath === test.expected.suggestedPath;
            
        console.log(`  ${test.name}: ${passed ? '✓ PASS' : '✗ FAIL'}`);
        if (!passed) {
            console.log(`    Expected: ${JSON.stringify(test.expected)}`);
            console.log(`    Got: ${JSON.stringify(result)}`);
            allTestsPassed = false;
        }
    }
    
    console.log('\nTesting comprehensive path analysis...');
    
    const analysisTests = [
        {
            name: 'Real-world problematic case',
            input: 'documents/documents/rapport.pdf',
            expected: {
                hasDuplication: true,
                duplicationType: 'consecutive',
                suggestedPath: 'documents/rapport.pdf'
            }
        },
        {
            name: 'User pattern case',
            input: 'users/john/users/john/file.txt',
            expected: {
                hasDuplication: true,
                duplicationType: 'user_pattern',
                suggestedPath: 'users/john/file.txt'
            }
        },
        {
            name: 'Clean path',
            input: 'documents/reports/file.txt',
            expected: {
                hasDuplication: false,
                duplicationType: 'none',
                suggestedPath: 'documents/reports/file.txt'
            }
        }
    ];
    
    for (const test of analysisTests) {
        const result = detector.analyzePathDuplication(test.input);
        const passed = 
            result.hasDuplication === test.expected.hasDuplication &&
            result.duplicationType === test.expected.duplicationType &&
            result.suggestedPath === test.expected.suggestedPath;
            
        console.log(`  ${test.name}: ${passed ? '✓ PASS' : '✗ FAIL'}`);
        if (!passed) {
            console.log(`    Expected: ${JSON.stringify(test.expected)}`);
            console.log(`    Got: ${JSON.stringify(result)}`);
            allTestsPassed = false;
        }
    }
    
    // Test edge cases
    console.log('\nTesting edge cases...');
    
    const edgeCaseTests = [
        {
            name: 'Empty string',
            input: '',
            shouldNotThrow: true
        },
        {
            name: 'Null input',
            input: null,
            shouldNotThrow: true
        },
        {
            name: 'Single segment',
            input: 'file.txt',
            shouldNotThrow: true
        }
    ];
    
    for (const test of edgeCaseTests) {
        try {
            const result1 = detector.detectConsecutiveDuplicates(test.input);
            const result2 = detector.detectUserPatternDuplication(test.input);
            const result3 = detector.analyzePathDuplication(test.input);
            
            console.log(`  ${test.name}: ✓ PASS (no errors thrown)`);
        } catch (error) {
            console.log(`  ${test.name}: ✗ FAIL (error thrown: ${error.message})`);
            allTestsPassed = false;
        }
    }
    
    console.log('\n=== Test Summary ===');
    if (allTestsPassed) {
        console.log('🎉 All tests passed! DuplicationDetector is working correctly.');
        console.log('\nKey features verified:');
        console.log('- Consecutive duplicate detection');
        console.log('- User pattern duplicate detection');
        console.log('- Comprehensive path analysis');
        console.log('- Edge case handling');
        console.log('- Cross-platform path support');
    } else {
        console.log('❌ Some tests failed. Check the implementation.');
    }
    
    return allTestsPassed;
}

// Run tests if called directly
if (require.main === module) {
    const success = runTests();
    process.exit(success ? 0 : 1);
}

module.exports = { runTests };