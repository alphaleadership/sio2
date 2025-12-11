// lib/session-plugin.js
import { SessionStore } from './session-store.js';
import { nanoid } from 'nanoid';

export const customSession = (options = {}) => {
    const store = options.store || new SessionStore();
    const cookieName = options.cookieName || 'sid';

    return (app) => app
        .derive(async ({ cookie }) => {
            let sessionId = cookie[cookieName].value;
            let session;

            if (sessionId) {
                session = store.get(sessionId);
            }

            if (!session) {
                sessionId = nanoid();
                session = store.create(sessionId);
                cookie[cookieName].set({
                    value: sessionId,
                    ...options.cookieOptions,
                    httpOnly: true,
                    path: '/'
                });
            }

            const sessionProxy = new Proxy(session.data, {
                set(target, prop, value) {
                    target[prop] = value;
                    session.isModified = true;
                    return true;
                }
            });

            return {
                session: sessionProxy,
                _sessionInternals: session 
            };
        })
        .onAfterResponse(({ _sessionInternals }) => {
            if (_sessionInternals.isModified) {
                store.set(_sessionInternals.sid, _sessionInternals);
            }
        });
};
