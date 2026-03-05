
const lt = require("localtunnel");
const fs = require("fs");
const path = require("path");

// Configuration du système de logs
const LOG_FILE = path.join(__dirname, "tunnel.log");
const MAX_CONNECTIONS = 60;

// Suivi des connexions actives
let activeConnections = 0;
const connectionHistory = [];

// Fonction de logging
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    
    const logLine = `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)} (Connexions actives: ${activeConnections})\n`;
    
    // Log dans la console
    console.log(logLine.trim());
    
    // Log dans le fichier
    fs.appendFileSync(LOG_FILE, logLine);
}

// Initialisation du tunnel
log("INFO", "Démarrage du tunnel localtunnel", { port: 3000, subdomain: "partagesiochaptal" });

lt({ port: 3000, subdomain: "partagesiochaptal" }).then(tunnel => {
    log("INFO", "Tunnel créé avec succès", { url: tunnel.url });
    tunnel.tunnelCluster.opts.max_conn=MAX_CONNECTIONS
     log("INFO", "Cluster du tunnel", { cluster: tunnel.tunnelCluster });
    
    if (tunnel.url !== "https://partagesiochaptal.loca.lt") {
        log("ERROR", "URL du tunnel incorrecte", { expected: "https://partagesiochaptal.loca.lt", actual: tunnel.url });
        process.exit(0);
    }
    
   
    fs.writeFileSync("tunnel.txt", tunnel.url);
    log("INFO", "URL du tunnel sauvegardée dans tunnel.txt");
    
    // Gestion des événements du tunnel
    tunnel.on('request', (info) => {
        // Enregistrer toutes les informations de la requête
        log("INFO", "Requête reçue", {
            method: info.method,
            path: info.path,
            headers: info.headers,
            remoteAddress: info.remoteAddress,
            timestamp: new Date().toISOString()
        });
        
        if (activeConnections >= MAX_CONNECTIONS) {
            log("WARN", "Connexion refusée - limite atteinte", {
                method: info.method,
                path: info.path,
                activeConnections
            });
        } else {
            activeConnections++;
            const connectionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            
            log("INFO", "Nouvelle connexion acceptée", {
                connectionId,
                method: info.method,
                path: info.path,
                activeConnections
            });
            
            connectionHistory.push({
                id: connectionId,
                startTime: Date.now()
            });
            
            // Simuler la fin de connexion après un délai
            setTimeout(() => {
                if (activeConnections > 0) {
                    activeConnections--;
                    const conn = connectionHistory.find(c => c.id === connectionId);
                    log("INFO", "Connexion terminée", {
                        connectionId,
                        duration: conn ? Date.now() - conn.startTime : 0,
                        activeConnections
                    });
                }
            }, 5000); // Timeout de 5 secondes par connexion
        }
    });
    
    tunnel.on('error', (err) => {
        log("ERROR", "Erreur du tunnel", { error: err.message });
    });
    
    tunnel.on('close', () => {
        log("INFO", "Tunnel fermé");
    });
    
    process.on("exit", () => {
        log("INFO", "Fermeture du tunnel");
        tunnel.close();
    });
    
    process.on("SIGINT", () => {
        log("INFO", "Signal SIGINT reçu - arrêt du tunnel");
        process.exit(0);
    });
    
    process.on("SIGTERM", () => {
        log("INFO", "Signal SIGTERM reçu - arrêt du tunnel");
        process.exit(0);
    });
    
}).catch(e => {
    log("ERROR", "Erreur lors de la création du tunnel", { error: e.message, stack: e.stack });
    console.error(e);
    process.exit(1);
});
