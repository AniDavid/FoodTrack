/**
 * Food Track - Firebase Configuration
 * 
 * You can either:
 * 1. Fill in your Firebase project credentials below, OR
 * 2. Paste them into the "הגדרות ענן" (Cloud Settings) modal in the app UI.
 */
export const DEFAULT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyAwqTvNdJTjtcn2a1J6BJXCaw_gPsOimUc",
    authDomain: "food-track-b5cec.firebaseapp.com",
    projectId: "food-track-b5cec",
    storageBucket: "food-track-b5cec.firebasestorage.app",
    messagingSenderId: "1079260296391",
    appId: "1:1079260296391:web:a3f0b8c254dc8e2a19bae2",
};
// const firebaseConfig = {
//     apiKey: "AIzaSyAwqTvNdJTjtcn2a1J6BJXCaw_gPsOimUc",
//     authDomain: "food-track-b5cec.firebaseapp.com",
//     projectId: "food-track-b5cec",
//     storageBucket: "food-track-b5cec.firebasestorage.app",
//     messagingSenderId: "1079260296391",
//     appId: "1:1079260296391:web:a3f0b8c254dc8e2a19bae2",
//     measurementId: "G-06B0GXBTRJ"
//   };

const STORAGE_KEY = 'foodTrackFirebaseConfig';

/**
 * Gets the active Firebase configuration.
 * Checks localStorage first, then falls back to DEFAULT_FIREBASE_CONFIG.
 * @returns {Object|null}
 */
export const getActiveFirebaseConfig = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.apiKey && parsed.projectId) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn('Error reading stored Firebase config:', e);
    }

    if (DEFAULT_FIREBASE_CONFIG.apiKey && DEFAULT_FIREBASE_CONFIG.projectId) {
        return DEFAULT_FIREBASE_CONFIG;
    }

    return null;
};

/**
 * Saves Firebase configuration to localStorage.
 * @param {Object} config 
 */
export const saveActiveFirebaseConfig = (config) => {
    if (!config) {
        localStorage.removeItem(STORAGE_KEY);
    } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
};

/**
 * Checks if a valid Firebase configuration is available.
 * @returns {boolean}
 */
export const isFirebaseConfigured = () => {
    const config = getActiveFirebaseConfig();
    return Boolean(config && config.apiKey && config.projectId);
};
