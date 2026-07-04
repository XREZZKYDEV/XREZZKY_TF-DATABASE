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
            return {};
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
        const { clearDestination, overwrite } = options;
        
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
        if (options.verify) {
            onProgress('Verifying data...');
            const verifyResult = await verifyData(db, data);
            return {
                success: true,
                verified: verifyResult
            };
        }
        
        return {
            success: true,
            verified: true
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
    
    // Validate databaseURL format
    if (!config.databaseURL.match(/^https:\/\/.+\.firebaseio\.com$/)) {
        return {
            valid: false,
            error: 'Invalid databaseURL format. Should be: https://project-id.firebaseio.com'
        };
    }
    
    return {
        valid: true
    };
}
