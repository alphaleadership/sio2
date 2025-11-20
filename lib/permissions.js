const path = require('path');

function checkFileAccess(req, res, next) {
    // First, check if user is authenticated at all.
    // Unauthenticated users should not have access to any /partage/ files.
    if (!req.session.user) {
        // This part of the check is particularly for direct URL access.
        // The ensureAuthenticated middleware already protects the main page routes.
        if (req.path.startsWith('/partage/')) {
            return res.status(403).send('Accès interdit.');
        }
        return next();
    }

    // Allow access to the global shared folder for any authenticated user
    if (req.path.startsWith('/partage/global/')) {
        return next();
    }

    // Check for access to user-specific folders
    if (req.path.startsWith('/partage/users/')) {
        const user = req.session.user;
        const isAdmin = user.role === 'admin';

        // Extract the username from the requested path
        // e.g., /partage/users/johndoe/documents/file.txt -> extracts 'johndoe'
        const pathParts = req.path.split('/');
        const requestedUsername = pathParts[3]; // ['', 'partage', 'users', 'johndoe', ...]

        // Grant access if the user is an admin or is accessing their own folder
        if (isAdmin || (requestedUsername && requestedUsername === user.username)) {
            return next();
        } else {
            // If not an admin and not their folder, deny access.
            return res.status(403).send('Accès interdit. Vous ne pouvez accéder qu\'à vos propres fichiers.');
        }
    }

    // For any other path that is not under /partage/, just continue.
    // This allows access to CSS, public images, client-side JS, etc.
    return next();
}

module.exports = { checkFileAccess };
