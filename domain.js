const debug = require("debug");
debug.enable("*");
require("dotenv").config();
const ngrok = require('@ngrok/ngrok');
const fs = require("fs");
const path = require("path");

// Configuration du système de logs
const LOG_FILE = path.join(__dirname, "tunnel.log");
const MAX_CONNECTIONS = 2;

// Suivi des connexions actives
let activeConnections = 0;
const connectionHistory = [];
let currentListener = null;

// Fonction de logging
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    
    const logLine = `[${timestamp}] [${level}] ${message} ${JSON.stringify(data)} (Connexions actives: ${activeConnections})\n`;
    
    // Log dans la console
    console.log(logLine.trim());
    
    // Log dans le fichier
    fs.appendFileSync(LOG_FILE, logLine);
}

// Fonction pour créer le tunnel ngrok
async function createTunnel() {
    try {
        log("INFO", "Démarrage du tunnel ngrok", { port: 3000 });
        
        const listener = await ngrok.connect({ 
            addr: 3000, 
            authtoken_from_env: true 
        });
        
        currentListener = listener;
        const url = listener.url();
        
        log("INFO", "Tunnel ngrok créé avec succès", { url });
        
        fs.writeFileSync("tunnel.txt", url);
        log("INFO", "URL du tunnel sauvegardée dans tunnel.txt");
        
        console.log(`Ingress established at: ${url}`);
        
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
    if (currentListener) {
        try {
            log("INFO", "Fermeture de l'ancien tunnel");
            await currentListener.close();
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

// Empêcher le processus de se terminer
process.stdin.resume();

// Heartbeat pour garder le processus actif
setInterval(() => {
    log("DEBUG", "Heartbeat - processus actif", { 
        uptime: process.uptime(),
        tunnelActive: currentListener !== null,
        activeConnections
    });
}, 60000); // Log toutes les 60 secondes

// Démarrage initial
createTunnel();

// Garder le processus actif indéfiniment
process.on('uncaughtException', (err) => {
    log("ERROR", "Exception non capturée", { error: err.message, stack: err.stack });
    // Ne pas arrêter le processus, juste logger l'erreur
});

process.on('unhandledRejection', (reason, promise) => {
    log("ERROR", "Promesse rejetée non gérée", { reason: String(reason) });
    // Ne pas arrêter le processus, juste logger l'erreur
});
