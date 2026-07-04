import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, remove, child } from 'firebase/database';

/**
 * Firebase utility functions for managing Realtime Database operations
 */

/**
 * Initialize Firebase app with config
 * @param {Object} config - Firebase config object
 * @param {string} name - App name (optional)
 * @returns {Object} Firebase app instance
 */
export function initFirebaseApp(config, name = null) {
    try {
        const appName = name || `app_${Date.now()}`;
        return initializeApp(config, appName);
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
            'firebasedatabase.app'
        ];
        
        const isValidDomain = validDomains.some(domain => 
            url.hostname.endsWith(domain)
        );
        
        if (!isValidDomain) {
            return {
                valid: false,
                error: 'Invalid database URL. Must be a Firebase Realtime Database URL'
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
 * Export default
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
    getDatabaseStats
};
