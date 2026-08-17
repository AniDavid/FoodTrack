/**
 * Food Track - Firebase Sync Service
 * 
 * Provides real-time synchronization with Cloud Firestore and Authentication.
 * Local-first: works offline, caches in IndexedDB and localStorage, auto-syncs when online.
 */

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    signOut 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager, 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { 
    getActiveFirebaseConfig, 
    saveActiveFirebaseConfig, 
    isFirebaseConfigured 
} from './firebase-config.js';

let app = null;
let auth = null;
let db = null;
let currentUser = null;
let unsubscribeUserDoc = null;
let syncStatus = 'unconfigured'; // 'unconfigured' | 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error' | 'offline'
let lastSyncTime = null;
let isPushingToCloud = false;
let pendingPushTimeout = null;

let isAuthResolved = false;
let resolveAuthReady;
const authReadyPromise = new Promise((resolve) => {
    resolveAuthReady = resolve;
});

const statusListeners = new Set();

/**
 * Notify all registered UI listeners about a status or user change.
 */
const notifyStatusChange = () => {
    const payload = {
        status: syncStatus,
        user: currentUser,
        lastSyncTime,
        isConfigured: isFirebaseConfigured(),
        isAuthResolved
    };
    statusListeners.forEach(fn => {
        try { fn(payload); } catch (e) { console.error(e); }
    });

    window.dispatchEvent(new CustomEvent('foodTrack:syncStatusChanged', { detail: payload }));
};

/**
 * Set current sync status and notify listeners.
 * @param {string} status 
 */
const setSyncStatus = (status) => {
    syncStatus = status;
    notifyStatusChange();
};

/**
 * Deeply merge local food logs with remote food logs without losing entries.
 * @param {Object} local 
 * @param {Object} remote 
 * @returns {Object}
 */
export const mergeFoodData = (local = {}, remote = {}) => {
    const merged = { ...local };

    for (const [dateKey, remoteEntries] of Object.entries(remote)) {
        if (!Array.isArray(remoteEntries)) continue;
        if (!merged[dateKey]) {
            merged[dateKey] = [...remoteEntries];
        } else {
            const localEntries = merged[dateKey] || [];
            const entryMap = new Map();

            // Put local entries first
            localEntries.forEach(entry => {
                if (entry && entry.id) entryMap.set(String(entry.id), entry);
            });

            // Remote entries overwrite/add based on ID
            remoteEntries.forEach(entry => {
                if (entry && entry.id) entryMap.set(String(entry.id), entry);
            });

            merged[dateKey] = Array.from(entryMap.values());
        }
    }

    return merged;
};

/**
 * Merge dropdown options and auto-complete associations.
 * @param {Object} local 
 * @param {Object} remote 
 * @returns {Object}
 */
export const mergeOptionData = (local = {}, remote = {}) => {
    const combineUnique = (arr1 = [], arr2 = []) => {
        const set = new Set();
        [...arr1, ...arr2].forEach(item => {
            if (typeof item === 'string' && item.trim()) {
                set.add(item.trim());
            }
        });
        return Array.from(set);
    };

    return {
        foodNames: combineUnique(local.foodNames, remote.foodNames),
        foodTypes: combineUnique(local.foodTypes, remote.foodTypes),
        units: combineUnique(local.units, remote.units),
        associations: {
            ...(local.associations || {}),
            ...(remote.associations || {})
        }
    };
};

/**
 * Initializes the Firebase instance if config is present.
 */
export const initFirebase = async () => {
    const config = getActiveFirebaseConfig();
    if (!config) {
        setSyncStatus('unconfigured');
        if (!isAuthResolved) {
            isAuthResolved = true;
            resolveAuthReady(null);
            window.dispatchEvent(new CustomEvent('foodTrack:authResolved', { detail: { user: null } }));
        }
        return false;
    }

    try {
        setSyncStatus('connecting');

        if (!getApps().length) {
            app = initializeApp(config);
        } else {
            app = getApp();
        }

        auth = getAuth(app);

        // Enable offline persistence in Firestore
        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });
        } catch (dbErr) {
            console.warn('Firestore multi-tab cache init note (using existing or fallback db):', dbErr);
            db = getFirestore(app);
        }

        // Handle redirect result if user was redirected for Google login on mobile
        try {
            const redirectResult = await getRedirectResult(auth);
            if (redirectResult && redirectResult.user) {
                console.log('Google login via redirect successful:', redirectResult.user.displayName);
            }
        } catch (e) {
            console.warn('Redirect sign-in check:', e);
        }

        // Listen for authentication changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = {
                    uid: user.uid,
                    displayName: user.displayName || user.email?.split('@')[0] || 'משתמש',
                    email: user.email || '',
                    photoURL: user.photoURL || ''
                };
                setSyncStatus('connected');
                subscribeToUserData(user.uid);
            } else {
                currentUser = null;
                if (unsubscribeUserDoc) {
                    unsubscribeUserDoc();
                    unsubscribeUserDoc = null;
                }
                setSyncStatus('disconnected');
            }

            if (!isAuthResolved) {
                isAuthResolved = true;
                resolveAuthReady(currentUser);
                window.dispatchEvent(new CustomEvent('foodTrack:authResolved', { detail: { user: currentUser } }));
            }
        });

        // Monitor online/offline network events
        window.addEventListener('online', () => {
            if (currentUser) setSyncStatus('connected');
        });
        window.addEventListener('offline', () => {
            if (currentUser) setSyncStatus('offline');
        });

        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        setSyncStatus('error');
        if (!isAuthResolved) {
            isAuthResolved = true;
            resolveAuthReady(null);
            window.dispatchEvent(new CustomEvent('foodTrack:authResolved', { detail: { user: null } }));
        }
        return false;
    }
};

/**
 * Subscribe to real-time changes in Firestore for the current user.
 * @param {string} uid 
 */
const subscribeToUserData = (uid) => {
    if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
    }

    if (!db || !uid) return;

    const userDocRef = doc(db, 'users', uid);

    unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
        if (isPushingToCloud) {
            // Ignore snapshot triggered by our own local push
            return;
        }

        if (docSnap.exists()) {
            const remoteData = docSnap.data();
            const remoteFoodData = remoteData.foodTrackerData || {};
            const remoteOptionData = remoteData.foodTrackerOptions || {};

            // Read current local storage
            let localFoodData = {};
            let localOptionData = {};
            try {
                localFoodData = JSON.parse(localStorage.getItem('foodTrackerData') || '{}');
                localOptionData = JSON.parse(localStorage.getItem('foodTrackerOptions') || '{}');
            } catch (e) {
                console.warn('Error reading local storage during sync merge:', e);
            }

            const mergedFoodData = mergeFoodData(localFoodData, remoteFoodData);
            const mergedOptionData = mergeOptionData(localOptionData, remoteOptionData);

            // Update localStorage
            localStorage.setItem('foodTrackerData', JSON.stringify(mergedFoodData));
            localStorage.setItem('foodTrackerOptions', JSON.stringify(mergedOptionData));

            lastSyncTime = new Date();
            setSyncStatus('connected');

            // Dispatch global event for script.js to refresh calendar & active logs
            window.dispatchEvent(new CustomEvent('foodTrack:cloudDataUpdated', {
                detail: {
                    foodData: mergedFoodData,
                    optionData: mergedOptionData,
                    updatedAt: remoteData.updatedAt || new Date().toISOString()
                }
            }));
        } else {
            // User doc does not exist in Firestore yet.
            // Automatically push local data to initialize the cloud account!
            pushToCloud(true);
        }
    }, (error) => {
        console.error('Firestore onSnapshot error:', error);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
    });
};

/**
 * Pushes local data to Cloud Firestore.
 * @param {boolean} immediate Whether to skip debouncing.
 */
export const pushToCloud = async (immediate = false) => {
    if (!db || !currentUser || !currentUser.uid) {
        return;
    }

    if (pendingPushTimeout) {
        clearTimeout(pendingPushTimeout);
        pendingPushTimeout = null;
    }

    const executePush = async () => {
        try {
            isPushingToCloud = true;
            setSyncStatus('syncing');

            let foodTrackerData = {};
            let foodTrackerOptions = {};

            try {
                foodTrackerData = JSON.parse(localStorage.getItem('foodTrackerData') || '{}');
                foodTrackerOptions = JSON.parse(localStorage.getItem('foodTrackerOptions') || '{}');
            } catch (e) {
                console.error('Failed to parse local data for cloud push:', e);
            }

            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, {
                foodTrackerData,
                foodTrackerOptions,
                updatedAt: new Date().toISOString(),
                clientTimestamp: Date.now(),
                userEmail: currentUser.email || '',
                userDisplayName: currentUser.displayName || ''
            }, { merge: true });

            lastSyncTime = new Date();
            setSyncStatus(navigator.onLine ? 'connected' : 'offline');
        } catch (error) {
            console.error('Error saving data to Cloud Firestore:', error);
            setSyncStatus(navigator.onLine ? 'error' : 'offline');
        } finally {
            setTimeout(() => {
                isPushingToCloud = false;
            }, 500);
        }
    };

    if (immediate) {
        await executePush();
    } else {
        pendingPushTimeout = setTimeout(executePush, 800);
    }
};

/**
 * Sign in with Google (Popup with fallback to Redirect).
 */
export const loginWithGoogle = async () => {
    if (!auth) {
        const initialized = await initFirebase();
        if (!initialized) {
            throw new Error('יש להגדיר תחילה את פרטי Firebase');
        }
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        setSyncStatus('connecting');
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (popupError) {
        console.warn('Popup login failed/blocked, attempting redirect login:', popupError);
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user' || /mobile|iphone|android/i.test(navigator.userAgent)) {
            await signInWithRedirect(auth, provider);
        } else {
            setSyncStatus('error');
            throw popupError;
        }
    }
};

/**
 * Sign in with Email and Password.
 * @param {string} email 
 * @param {string} password 
 */
export const loginWithEmail = async (email, password) => {
    if (!auth) {
        const initialized = await initFirebase();
        if (!initialized) {
            throw new Error('יש להגדיר תחילה את פרטי Firebase');
        }
    }

    setSyncStatus('connecting');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
};

/**
 * Register a new account with Email and Password.
 * @param {string} email 
 * @param {string} password 
 * @param {string} displayName 
 */
export const registerWithEmail = async (email, password, displayName = '') => {
    if (!auth) {
        const initialized = await initFirebase();
        if (!initialized) {
            throw new Error('יש להגדיר תחילה את פרטי Firebase');
        }
    }

    setSyncStatus('connecting');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && userCredential.user) {
        try {
            await updateProfile(userCredential.user, { displayName });
            currentUser.displayName = displayName;
            notifyStatusChange();
        } catch (e) {
            console.warn('Failed to update display name:', e);
        }
    }
    return userCredential.user;
};

/**
 * Sign out from Firebase.
 */
export const logoutUser = async () => {
    if (!auth) return;
    try {
        if (unsubscribeUserDoc) {
            unsubscribeUserDoc();
            unsubscribeUserDoc = null;
        }
        await signOut(auth);
        currentUser = null;
        setSyncStatus('disconnected');
    } catch (e) {
        console.error('Logout error:', e);
        throw e;
    }
};

/**
 * Expose global FoodTrackSync object for script.js and console usage.
 */
window.FoodTrackSync = {
    init: initFirebase,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout: logoutUser,
    pushToCloud,
    getActiveConfig: getActiveFirebaseConfig,
    saveConfig: (cfg) => {
        saveActiveFirebaseConfig(cfg);
        return initFirebase();
    },
    isConfigured: isFirebaseConfigured,
    getUser: () => currentUser,
    getStatus: () => syncStatus,
    getLastSyncTime: () => lastSyncTime,
    isAuthResolved: () => isAuthResolved,
    whenAuthReady: () => authReadyPromise,
    onStatusChange: (callback) => {
        if (typeof callback === 'function') {
            statusListeners.add(callback);
            callback({
                status: syncStatus,
                user: currentUser,
                lastSyncTime,
                isConfigured: isFirebaseConfigured(),
                isAuthResolved
            });
        }
    }
};

// Auto-initialize when the script module loads
if (isFirebaseConfigured()) {
    initFirebase();
} else {
    isAuthResolved = true;
    resolveAuthReady(null);
}
