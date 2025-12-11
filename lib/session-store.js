// lib/session-store.js

const sessions = new Map();

// Simple session store
export class SessionStore {
    constructor(timeout = 3600000) { // Default timeout: 1 hour
        this.sessions = new Map();
        this.timeout = timeout;
        setInterval(() => this.cleanup(), this.timeout);
    }

    // Get a session
    get(sid) {
        const session = this.sessions.get(sid);
        if (session) {
            if (session.cookie.expires && session.cookie.expires < new Date()) {
                this.destroy(sid);
                return null;
            }
            return session;
        }
        return null;
    }

    // Set a session
    set(sid, session) {
        this.sessions.set(sid, session);
    }

    // Create a new session
    create(sid) {
        const expires = new Date(Date.now() + this.timeout);
        const session = {
            sid,
            cookie: {
                expires
            },
            data: {}
        };
        this.sessions.set(sid, session);
        return session;
    }
    
    // Destroy a session
    destroy(sid) {
        this.sessions.delete(sid);
    }

    // Cleanup expired sessions
    cleanup() {
        const now = new Date();
        for (const [sid, session] of this.sessions.entries()) {
            if (session.cookie.expires && session.cookie.expires < now) {
                this.destroy(sid);
            }
        }
    }
}
