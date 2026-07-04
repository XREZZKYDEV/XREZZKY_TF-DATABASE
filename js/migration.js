import { getDatabaseInstance, readDatabase, writeDatabase } from './firebase.js';
import { getSourceConnection, getDestConnection, areSameDatabase } from './connection.js';
import { logger } from './logger.js';
import { updateUI, updateSummary } from './ui.js';

/**
 * Migration orchestrator
 */

/**
 * Perform database migration
 * @param {Object} options - Migration options
 * @returns {Promise<Object>} Migration result
 */
export async function performMigration(options) {
    const startTime = Date.now();
    
    try {
        logger.info('=== Starting Migration Process ===');
        updateUI.migrationStarted();
        
        // Get connections
        const source = getSourceConnection();
        const dest = getDestConnection();
        
        if (!source || !dest) {
            throw new Error('Both source and destination must be connected');
        }
        
        // Check if same database
        if (areSameDatabase()) {
            throw new Error('Source and destination databases are the same. Migration cancelled.');
        }
        
        // Initialize databases
        logger.progress('Initializing source database...');
        const sourceDb = getDatabaseInstance(source.app);
        updateUI.updateProgress(5, 'Source database initialized');
        
        logger.progress('Initializing destination database...');
        const destDb = getDatabaseInstance(dest.app);
        updateUI.updateProgress(10, 'Destination database initialized');
        
        // Read source database
        logger.progress('Reading source database...');
        updateUI.updateProgress(15, 'Reading source database...');
        
        const { data, nodeCount, dataSize } = await readDatabase(sourceDb, (status) => {
            updateUI.updateProgress(30, status);
            logger.progress(status);
        });
        
        if (Object.keys(data).length === 0) {
            throw new Error('Source database is empty. Nothing to migrate.');
        }
        
        logger.info(`Read ${nodeCount} nodes, ${formatBytes(dataSize)} data`);
        updateUI.updateProgress(50, `Read ${nodeCount} nodes`);
        
        // Get migration options
        const migrationOptions = {
            clearDestination: options.clearDestination || false,
            overwrite: options.overwrite || true,
            verify: options.verify || true,
            stopOnError: options.stopOnError || false
        };
        
        // Write to destination
        logger.progress('Writing to destination database...');
        updateUI.updateProgress(60, 'Writing to destination...');
        
        const result = await writeDatabase(destDb, data, migrationOptions, (status) => {
            const progress = 60 + (status.includes('Verifying') ? 30 : 20);
            updateUI.updateProgress(progress, status);
            logger.progress(status);
        });
        
        // Completion
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        logger.success('Migration completed successfully!');
        updateUI.updateProgress(100, 'Migration completed!');
        
        // Build summary
        const summary = {
            status: 'Success',
            time: formatDuration(duration),
            nodes: nodeCount,
            size: formatBytes(dataSize),
            verification: result.verified ? '✅ Verified' : '⚠️ Not Verified',
            success: true
        };
        
        updateSummary(summary);
        logger.success(`Migration completed in ${formatDuration(duration)}`);
        
        return {
            success: true,
            summary,
            data,
            nodeCount,
            dataSize
        };
        
    } catch (error) {
        logger.error(`Migration failed: ${error.message}`);
        updateUI.migrationFailed(error.message);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const summary = {
            status: 'Failed',
            time: formatDuration(duration),
            nodes: 0,
            size: '0 B',
            verification: '❌ Failed',
            success: false
        };
        
        updateSummary(summary);
        
        return {
            success: false,
            error: error.message,
            summary
        };
    }
}

/**
 * Format bytes to human readable
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}
