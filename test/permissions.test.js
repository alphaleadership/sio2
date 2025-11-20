const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../app'); // Assurez-vous que app est exporté pour les tests

// Créez le serveur mais ne le démarrez pas encore.
const server = http.createServer(app);

const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

const user1Dir = path.join(__dirname, '..', 'public', 'partage', 'users', 'testuser1');
const user2Dir = path.join(__dirname, '..', 'public', 'partage', 'users', 'testuser2');
const user1File = path.join(user1Dir, 'file.txt');
const user2File = path.join(user2Dir, 'file.txt');

// Helper function to perform requests
function request(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ 
                    statusCode: res.statusCode, 
                    headers: res.headers, 
                    data: data 
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Helper pour simuler une connexion et obtenir un cookie
async function login(username, password) {
    const postData = new URLSearchParams({ username, password }).toString();
    const options = {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
        },
    };
    const response = await request(options, postData);
    return response.headers['set-cookie'] ? response.headers['set-cookie'][0] : null;
}

test.describe('Permissions System Tests', () => {

    test.before(async () => {
        // Start the server
        await new Promise(resolve => server.listen(TEST_PORT, resolve));
        console.log(`Test server running on port ${TEST_PORT}`);

        // Create dummy directories and files
        if (!fs.existsSync(user1Dir)) fs.mkdirSync(user1Dir, { recursive: true });
        if (!fs.existsSync(user2Dir)) fs.mkdirSync(user2Dir, { recursive: true });
        fs.writeFileSync(user1File, 'user1 content');
        fs.writeFileSync(user2File, 'user2 content');
    });

    test.after(async () => {
        // Stop the server
        await new Promise(resolve => server.close(resolve));
        console.log('Test server stopped.');

        // Cleanup
        fs.unlinkSync(user1File);
        fs.rmdirSync(user1Dir);
        fs.unlinkSync(user2File);
        fs.rmdirSync(user2Dir);
    });

    test.it('should deny access to unauthenticated users', async () => {
        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/partage/users/testuser1/file.txt',
            method: 'GET',
        };
        const response = await request(options);
        assert.strictEqual(response.statusCode, 403, 'Should return 403 for unauthenticated access');
    });

    test.it('should allow access to own files for an authenticated user', async () => {
        // NOTE: This assumes a user 'testuser1' with password 'password' can be created or mocked.
        // The current login logic in routes/index.js creates a user session on successful login
        // without actual password validation against a database.
        const cookie = await login('testuser1', 'password');
        assert.ok(cookie, 'Login should be successful and return a cookie');

        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/partage/users/testuser1/file.txt',
            method: 'GET',
            headers: { 'Cookie': cookie }
        };

        const response = await request(options);
        assert.strictEqual(response.statusCode, 200, 'Should return 200 for own file');
        assert.strictEqual(response.data, 'user1 content');
    });

    test.it('should deny access to other users files', async () => {
        const cookie = await login('testuser1', 'password');
        assert.ok(cookie, 'Login should be successful');

        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/partage/users/testuser2/file.txt',
            method: 'GET',
            headers: { 'Cookie': cookie }
        };

        const response = await request(options);
        assert.strictEqual(response.statusCode, 403, 'Should return 403 for other user\'s file');
    });

    test.it('should allow access to any file for an admin user', async () => {
        // The login route assigns 'admin' role if username is 'admin'
        const cookie = await login('admin', 'password');
        assert.ok(cookie, 'Admin login should be successful');

        // Access user1's file
        const options1 = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/partage/users/testuser1/file.txt',
            method: 'GET',
            headers: { 'Cookie': cookie }
        };
        const response1 = await request(options1);
        assert.strictEqual(response1.statusCode, 200, 'Admin should access user1 file');

        // Access user2's file
        const options2 = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/partage/users/testuser2/file.txt',
            method: 'GET',
            headers: { 'Cookie': cookie }
        };
        const response2 = await request(options2);
        assert.strictEqual(response2.statusCode, 200, 'Admin should access user2 file');
    });
});
