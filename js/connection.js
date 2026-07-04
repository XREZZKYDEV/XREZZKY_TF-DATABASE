import { testConnection, validateConfig } from './firebase.js';
import { logger } from './logger.js';
import { updateUI } from './ui.js';

/**
 * Connection management for source and destination databases
 */

let sourceConnection = null;
let destConnection = null;

/**
 * Test source database connection
 * @param {Object} config - Firebase config
 * @returns {Promise<Object>} Connection result
 */
export async function testSourceConnection(config) {
    try {
        logger.info('Testing source connection...');
        
        const validation = validateConfig(config);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        const result = await testConnection(config);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        sourceConnection = {
            config,
            app: result.app,
            projectId: result.projectId,
            databaseURL: result.databaseURL
        };
        
        logger.success('Source connection successful');
        updateUI.sourceConnected(true, result);
        return result;
    } catch (error) {
        logger.error(`Source connection failed: ${error.message}`);
        updateUI.sourceConnected(false, null);
        throw error;
    }
}

/**
 * Test destination database connection
 * @param {Object} config - Firebase config
 * @returns {Promise<Object>} Connection result
 */
export async function testDestConnection(config) {
    try {
        logger.info('Testing destination connection...');
        
        const validation = validateConfig(config);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        
        const result = await testConnection(config);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        destConnection = {
            config,
            app: result.app,
            projectId: result.projectId,
            databaseURL: result.databaseURL
        };
        
        logger.success('Destination connection successful');
        updateUI.destConnected(true, result);
        return result;
    } catch (error) {
        logger.error(`Destination connection failed: ${error.message}`);
        updateUI.destConnected(false, null);
        throw error;
    }
}

/**
 * Get source connection
 * @returns {Object|null} Source connection
 */
export function getSourceConnection() {
    return sourceConnection;
}

/**
 * Get destination connection
 * @returns {Object|null} Destination connection
 */
export function getDestConnection() {
    return destConnection;
}

/**
 * Check if both connections are established
 * @returns {boolean} Both connected
 */
export function areBothConnected() {
    return sourceConnection !== null && destConnection !== null;
}

/**
 * Check if source and destination URLs are the same
 * @returns {boolean} Same URL
 */
export function areSameDatabase() {
    if (!sourceConnection || !destConnection) {
        return false;
    }
    return sourceConnection.databaseURL === destConnection.databaseURL;
}

/**
 * Clear connections
 */
export function clearConnections() {
    sourceConnection = null;
    destConnection = null;
}
