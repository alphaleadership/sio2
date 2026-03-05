 const debug=require("debug")
 debug.enable("*")
 const lt = require("localtunnel");
const fs = require("fs");
const path = require("path");

// Configuration du système de logs
const LOG_FILE = path.join(__dirname, "tunnel.log");
const MAX_CONNECTIONS = 60;

// Suivi des connexions actives
let activeConnections = 0;
const connectionHistory = [];
let currentTunnel = null;

// Fonction de logging
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    
    const logLine = `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)} (Connexions actives: ${activeConnections})\n`;
    
    // Log dans la console
    console.log(logLine.trim());
    
    // Log dans le fichier
    fs.appendFileSync(LOG_FILE, logLine);
}

// Fonction pour créer le tunnel
async function createTunnel() {
    try {
        log("INFO", "Démarrage du tunnel localtunnel", { port: 3000, subdomain: "partagesio2chaptal" });
        
        const tunnel = await lt({ port: 3000, subdomain: "partagesiochaptal",max_conn:60 });
        tunnel.tunnelCluster.max_conn=MAX_CONNECTIONS
        currentTunnel = tunnel;
        
        log("INFO", "Tunnel créé avec succès", { url: tunnel.url });
        
        if (tunnel.url !== "https://partagesiochaptal.loca.lt") {
            log("WARN", "URL du tunnel incorrecte", { expected: "https://partagesiochaptal.loca.lt", actual: tunnel.url });
            throw new Error("URL du tunnel incorrecte");
        }
        
        log("INFO", "Cluster du tunnel", { cluster: tunnel.tunnelCluster });
        
        fs.writeFileSync("tunnel.txt", tunnel.url);
        log("INFO", "URL du tunnel sauvegardée dans tunnel.txt");
        
        // Gestion des événements du tunnel
        tunnel.on('request', (info) => {
            // Enregistrer toutes les informations de la requête
            const connectionId = Date.now() + '-' + Math.random().toString(36).substring(2, 11);
            
            log("INFO", "Requête reçue", {
                connectionId,
                method: info.method,
                path: info.path,
                headers: info.headers,
                remoteAddress: info.remoteAddress,
                timestamp: new Date().toISOString()
            });
            
            if (activeConnections >= MAX_CONNECTIONS) {
                log("WARN", "Connexion refusée - limite atteinte", {
                    connectionId,
                    method: info.method,
                    path: info.path,
                    activeConnections
                });
            } else {
                activeConnections++;
                
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
            }
        });
        
        tunnel.on('close', (info) => {
            // Marquer la requête comme fermée
            activeConnections = Math.max(0, activeConnections - 1);
            
            const conn = connectionHistory.find(c => c.id && Date.now() - c.startTime < 60000);
            
            log("INFO", "Requête terminée", {
                statusCode: info.statusCode,
                method: info.method,
                path: info.path,
                duration: conn ? Date.now() - conn.startTime : 'unknown',
                activeConnections
            });
        });
        
        tunnel.on('error', (err) => {
            log("ERROR", "Erreur du tunnel", { error: err.message });
            // Recréer le tunnel en cas d'erreur
            setTimeout(() => {
                log("INFO", "Tentative de recréation du tunnel après erreur");
                recreateTunnel();
            }, 5000);
        });
        
        tunnel.on('close', () => {
            log("INFO", "Tunnel fermé");
            // Recréer le tunnel automatiquement
            setTimeout(() => {
                log("INFO", "Recréation automatique du tunnel");
                recreateTunnel();
            }, 2000);
        });
        
    } catch (e) {
        log("ERROR", "Erreur lors de la création du tunnel", { error: e.message, stack: e.stack });
        console.error(e);
        // Réessayer après 5 secondes
        setTimeout(() => {
            log("INFO", "Nouvelle tentative de création du tunnel");
            createTunnel();
        }, 5000);
    }
}

// Fonction pour recréer le tunnel sans arrêter le processus
async function recreateTunnel() {
    if (currentTunnel) {
        try {
            log("INFO", "Fermeture de l'ancien tunnel");
            currentTunnel.close();
        } catch (e) {
            log("WARN", "Erreur lors de la fermeture de l'ancien tunnel", { error: e.message });
        }
    }
    
    // Réinitialiser les connexions
    activeConnections = 0;
    
    // Créer un nouveau tunnel
    await createTunnel();
}

// Gestion des signaux sans arrêter le processus
process.on("SIGINT", () => {
    log("INFO", "Signal SIGINT reçu - recréation du tunnel");
    recreateTunnel();
});

process.on("SIGTERM", () => {
    log("INFO", "Signal SIGTERM reçu - recréation du tunnel");
    recreateTunnel();
});

// Démarrage initial
createTunnel();
