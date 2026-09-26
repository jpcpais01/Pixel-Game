// Where the online play server lives (see server/ and server/README.md). A
// Vite env variable (VITE_MP_SERVER) wins, for local testing; otherwise the
// deployed server. Empty: online play isn't set up, and the game says so.

const DEPLOYED = 'wss://myths-and-legends-server.onrender.com';

export const MP_SERVER: string = ((import.meta.env.VITE_MP_SERVER as string | undefined) || DEPLOYED).replace(/^http/, 'ws').replace(/\/$/, '');
