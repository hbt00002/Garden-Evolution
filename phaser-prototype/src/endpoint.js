// Where the game's server is. On the website it is the page's own origin, so
// paths stay relative. The store apps (Capacitor) load the game from inside the
// app, so their build sets VITE_API_BASE to the live address.
export const API_BASE = (import.meta.env?.VITE_API_BASE || "").replace(/\/$/, "");

export const apiUrl = path => `${API_BASE}${path}`;
