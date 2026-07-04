import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, remove, child } from 'firebase/database';

/**
 * Firebase utility functions for managing Realtime Database operations
 */

/**
 * Initialize Firebase app with config
 * @param {Object} config - Firebase config object
 * @returns {Object} Firebase app instance
 */
export function initFirebaseApp(config) {
    try {
        const app = initializeApp(config, `app_${Date.now()}`);
        return app;
    } catch (error) {
        throw new Error(`Failed to initialize Firebase: ${error.message}`);
    }
}

/**
 * Get database instance from app
 * @param {Object} app - Firebase app instance
 * @returns {Object} Database instance
 */
export function getDatabaseInstance(app) {
    return getDatabase(app);
}

/**
 * Test connection to Firebase Realtime Database
 * @param {Object} config - Firebase config
 * @returns {Promise<Object>} Connection test result
 */
export async function testConnection(config) {
    try {
        const app = initFirebaseApp(config);
        const db = getDatabaseInstance(app);
        const dbRef = ref(db, '.info/connected');
        
        const snapshot = await get(dbRef);
        const isConnected = snapshot.val() === true;
        
        if (!isConnected) {
            throw new Error('Database is not connected');
        }
        
        // Get project info
        const projectId = config.projectId || 'Unknown';
        const databaseURL = config.databaseURL || 'Unknown';
        
        return {
            success: true,
            projectId,
            databaseURL,
            app
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Read entire database from root
 * @param {Object} db - Database instance
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Database data
 */
export async function readDatabase(db, onProgress) {
    try {
        onProgress('Reading database root...');
        const rootRef = ref(db, '/');
        const snapshot = await get(rootRef);
        
        if (!snapshot.exists()) {
            return {
                data: {},
                nodeCount: 0,
                dataSize: 0
            };
        }
        
        const data = snapshot.val();
        const nodeCount = countNodes(data);
        const dataSize = estimateSize(data);
        
        return {
            data,
            nodeCount,
            dataSize
        };
    } catch (error) {
        throw new Error(`Failed to read database: ${error.message}`);
    }
}

/**
 * Count total nodes in data
 * @param {Object} data - Data object
 * @returns {number} Node count
 */
function countNodes(data) {
    if (!data || typeof data !== 'object') {
        return 0;
    }
    
    let count = 0;
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            count++;
            if (typeof data[key] === 'object' && data[key] !== null) {
                count += countNodes(data[key]);
            }
        }
    }
    return count;
}

/**
 * Estimate size of data in bytes
 * @param {*} data - Data to estimate
 * @returns {number} Size in bytes
 */
function estimateSize(data) {
    try {
        const json = JSON.stringify(data);
        return json.length;
    } catch (error) {
        return 0;
    }
}

/**
 * Write data to destination database
 * @param {Object} db - Destination database instance
 * @param {Object} data - Data to write
 * @param {Object} options - Migration options
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Write result
 */
export async function writeDatabase(db, data, options, onProgress) {
    try {
        const { clearDestination, overwrite, verify } = options;
        
        // Clear destination if requested
        if (clearDestination) {
            onProgress('Clearing destination database...');
            await remove(ref(db, '/'));
        }
        
        // Write data
        onProgress('Writing data to destination...');
        
        if (overwrite) {
            // Overwrite entire database
            await set(ref(db, '/'), data);
        } else {
            // Update existing data (merge)
            await update(ref(db, '/'), data);
        }
        
        // Verify if requested
        let verified = true;
        if (verify) {
            onProgress('Verifying data...');
            verified = await verifyData(db, data);
        }
        
        return {
            success: true,
            verified
        };
    } catch (error) {
        throw new Error(`Failed to write database: ${error.message}`);
    }
}

/**
 * Verify data integrity after migration
 * @param {Object} db - Destination database instance
 * @param {Object} sourceData - Source data to compare
 * @returns {Promise<boolean>} Verification result
 */
export async function verifyData(db, sourceData) {
    try {
        const rootRef = ref(db, '/');
        const snapshot = await get(rootRef);
        
        if (!snapshot.exists()) {
            return false;
        }
        
        const destData = snapshot.val();
        
        // Deep compare
        return JSON.stringify(sourceData) === JSON.stringify(destData);
    } catch (error) {
        throw new Error(`Verification failed: ${error.message}`);
    }
}

/**
 * Validate Firebase config
 * @param {Object} config - Firebase config
 * @returns {Object} Validation result
 */
export function validateConfig(config) {
    const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const missing = required.filter(field => !config[field] || config[field].trim() === '');
    
    if (missing.length > 0) {
        return {
            valid: false,
            error: `Missing required fields: ${missing.join(', ')}`
        };
    }
    
    // Validate databaseURL - support all Firebase Realtime Database URL formats
    const dbUrl = config.databaseURL.trim();
    
    // Check if URL is valid
    try {
        const url = new URL(dbUrl);
        
        // Must be https
        if (url.protocol !== 'https:') {
            return {
                valid: false,
                error: 'Database URL must use HTTPS protocol'
            };
        }
        
        // Must be Firebase Realtime Database domain
        const validDomains = [
            'firebaseio.com',
            'firebasedatabase.app',
            'firebaseio.com/',
            'firebasedatabase.app/'
        ];
        
        const isValidDomain = validDomains.some(domain => 
            url.hostname.endsWith(domain.replace('/', ''))
        );
        
        if (!isValidDomain) {
            return {
                valid: false,
                error: 'Invalid database URL. Must be a Firebase Realtime Database URL (e.g., https://project-id.firebaseio.com or https://project-id.firebasedatabase.app)'
            };
        }
        
        return {
            valid: true
        };
    } catch (error) {
        return {
            valid: false,
            error: 'Invalid database URL format. Please enter a valid URL'
        };
    }
}

/**
 * Check if database exists and has data
 * @param {Object} db - Database instance
 * @returns {Promise<boolean>} Database has data
 */
export async function hasData(db) {
    try {
        const rootRef = ref(db, '/');
        const snapshot = await get(rootRef);
        return snapshot.exists();
    } catch (error) {
        return false;
    }
}

/**
 * Get database size estimate
 * @param {Object} db - Database instance
 * @returns {Promise<number>} Size in bytes
 */
export async function getDatabaseSize(db) {
    try {
        const rootRef = ref(db, '/');
        const snapshot = await get(rootRef);
        
        if (!snapshot.exists()) {
            return 0;
        }
        
        const data = snapshot.val();
        return estimateSize(data);
    } catch (error) {
        return 0;
    }
}

/**
 * Get database statistics
 * @param {Object} db - Database instance
 * @returns {Promise<Object>} Database statistics
 */
export async function getDatabaseStats(db) {
    try {
        const rootRef = ref(db, '/');
        const snapshot = await get(rootRef);
        
        if (!snapshot.exists()) {
            return {
                nodeCount: 0,
                dataSize: 0,
                hasData: false
            };
        }
        
        const data = snapshot.val();
        const nodeCount = countNodes(data);
        const dataSize = estimateSize(data);
        
        return {
            nodeCount,
            dataSize,
            hasData: true
        };
    } catch (error) {
        throw new Error(`Failed to get database stats: ${error.message}`);
    }
}

/**
 * Get child nodes from a path
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @returns {Promise<Object>} Child nodes
 */
export async function getChildren(db, path = '/') {
    try {
        const nodeRef = ref(db, path);
        const snapshot = await get(nodeRef);
        
        if (!snapshot.exists()) {
            return {};
        }
        
        return snapshot.val();
    } catch (error) {
        throw new Error(`Failed to get children: ${error.message}`);
    }
}

/**
 * Get nested object from database
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @returns {Promise<Object>} Nested object
 */
export async function getNestedObject(db, path = '/') {
    try {
        const nodeRef = ref(db, path);
        const snapshot = await get(nodeRef);
        
        if (!snapshot.exists()) {
            return null;
        }
        
        return snapshot.val();
    } catch (error) {
        throw new Error(`Failed to get nested object: ${error.message}`);
    }
}

/**
 * Update specific path in database
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @param {*} data - Data to update
 * @returns {Promise<void>}
 */
export async function updatePath(db, path, data) {
    try {
        const nodeRef = ref(db, path);
        await update(nodeRef, data);
    } catch (error) {
        throw new Error(`Failed to update path: ${error.message}`);
    }
}

/**
 * Set specific path in database
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @param {*} data - Data to set
 * @returns {Promise<void>}
 */
export async function setPath(db, path, data) {
    try {
        const nodeRef = ref(db, path);
        await set(nodeRef, data);
    } catch (error) {
        throw new Error(`Failed to set path: ${error.message}`);
    }
}

/**
 * Remove specific path from database
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @returns {Promise<void>}
 */
export async function removePath(db, path) {
    try {
        const nodeRef = ref(db, path);
        await remove(nodeRef);
    } catch (error) {
        throw new Error(`Failed to remove path: ${error.message}`);
    }
}

/**
 * Push data to database
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @param {*} data - Data to push
 * @returns {Promise<string>} Key of pushed data
 */
export async function pushData(db, path, data) {
    try {
        const nodeRef = ref(db, path);
        const newRef = child(nodeRef, Date.now().toString());
        await set(newRef, data);
        return newRef.key;
    } catch (error) {
        throw new Error(`Failed to push data: ${error.message}`);
    }
}

/**
 * Check if path exists
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @returns {Promise<boolean>} Path exists
 */
export async function pathExists(db, path) {
    try {
        const nodeRef = ref(db, path);
        const snapshot = await get(nodeRef);
        return snapshot.exists();
    } catch (error) {
        return false;
    }
}

/**
 * Get value from path
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @returns {Promise<*>} Value at path
 */
export async function getValue(db, path) {
    try {
        const nodeRef = ref(db, path);
        const snapshot = await get(nodeRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        throw new Error(`Failed to get value: ${error.message}`);
    }
}

/**
 * Perform transaction
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @param {Function} transactionUpdate - Transaction update function
 * @returns {Promise<Object>} Transaction result
 */
export async function performTransaction(db, path, transactionUpdate) {
    try {
        const nodeRef = ref(db, path);
        const result = await nodeRef.transaction(transactionUpdate);
        return result;
    } catch (error) {
        throw new Error(`Transaction failed: ${error.message}`);
    }
}

/**
 * Listen to path changes (for debugging)
 * @param {Object} db - Database instance
 * @param {string} path - Database path
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function listenToPath(db, path, callback) {
    const nodeRef = ref(db, path);
    const unsubscribe = onValue(nodeRef, (snapshot) => {
        callback(snapshot.exists() ? snapshot.val() : null);
    });
    return unsubscribe;
}

/**
 * Export all database functions
 */
export default {
    initFirebaseApp,
    getDatabaseInstance,
    testConnection,
    readDatabase,
    writeDatabase,
    verifyData,
    validateConfig,
    hasData,
    getDatabaseSize,
    getDatabaseStats,
    getChildren,
    getNestedObject,
    updatePath,
    setPath,
    removePath,
    pushData,
    pathExists,
    getValue,
    performTransaction,
    listenToPath
};
