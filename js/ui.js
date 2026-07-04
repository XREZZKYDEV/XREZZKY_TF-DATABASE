import { logger } from './logger.js';
import { progress } from './progress.js';
import { testSourceConnection, testDestConnection, areBothConnected, areSameDatabase } from './connection.js';
import { performMigration } from './migration.js';

/**
 * UI controller
 */

// DOM Elements
const elements = {
    source: {
        apiKey: document.getElementById('sourceApiKey'),
        authDomain: document.getElementById('sourceAuthDomain'),
        databaseURL: document.getElementById('sourceDatabaseURL'),
        projectId: document.getElementById('sourceProjectId'),
        storageBucket: document.getElementById('sourceStorageBucket'),
        messagingSenderId: document.getElementById('sourceMessagingSenderId'),
        appId: document.getElementById('sourceAppId'),
        testBtn: document.getElementById('testSourceBtn'),
        status: document.getElementById('sourceStatus'),
        info: document.getElementById('sourceConnectionInfo'),
        projectName: document.getElementById('sourceProjectName'),
        dbUrl: document.getElementById('sourceDbUrl'),
    },
    dest: {
        apiKey: document.getElementById('destApiKey'),
        authDomain: document.getElementById('destAuthDomain'),
        databaseURL: document.getElementById('destDatabaseURL'),
        projectId: document.getElementById('destProjectId'),
        storageBucket: document.getElementById('destStorageBucket'),
        messagingSenderId: document.getElementById('destMessagingSenderId'),
        appId: document.getElementById('destAppId'),
        testBtn: document.getElementById('testDestBtn'),
        status: document.getElementById('destStatus'),
        info: document.getElementById('destConnectionInfo'),
        projectName: document.getElementById('destProjectName'),
        dbUrl: document.getElementById('destDbUrl'),
    },
    options: {
        overwrite: document.getElementById('optOverwrite'),
        clearDest: document.getElementById('optClearDest'),
        verify: document.getElementById('optVerify'),
        stopOnError: document.getElementById('optStopOnError'),
    },
    startBtn: document.getElementById('startMigrationBtn'),
    progressSection: document.getElementById('progressSection'),
    summarySection: document.getElementById('summarySection'),
    summary: {
        status: document.getElementById('summaryStatus'),
        time: document.getElementById('summaryTime'),
        nodes: document.getElementById('summaryNodes'),
        size: document.getElementById('summarySize'),
        verification: document.getElementById('summaryVerification'),
    },
    clearLogs: document.getElementById('clearLogsBtn'),
};

// State
let sourceConnected = false;
let destConnected = false;
let isMigrating = false;

/**
 * Update UI for source connection status
 * @param {boolean} connected - Connection status
 * @param {Object} result - Connection result
 */
export function updateUI(connected, result) {
    // This is handled by sourceConnected and destConnected functions
}

/**
 * Update source connection status
 * @param {boolean} connected - Connection status
 * @param {Object} result - Connection result
 */
updateUI.sourceConnected = function(connected, result) {
    sourceConnected = connected;
    const status = elements.source.status;
    const info = elements.source.info;
    
    if (connected && result) {
        status.textContent = '✅ Connected';
        status.className = 'status-badge connected';
        info.style.display = 'block';
        elements.source.projectName.textContent = result.projectId;
        elements.source.dbUrl.textContent = result.databaseURL;
    } else {
        status.textContent = '❌ Failed';
        status.className = 'status-badge error';
        info.style.display = 'none';
    }
    
    updateStartButton();
};

/**
 * Update destination connection status
 * @param {boolean} connected - Connection status
 * @param {Object} result - Connection result
 */
updateUI.destConnected = function(connected, result) {
    destConnected = connected;
    const status = elements.dest.status;
    const info = elements.dest.info;
    
    if (connected && result) {
        status.textContent = '✅ Connected';
        status.className = 'status-badge connected';
        info.style.display = 'block';
        elements.dest.projectName.textContent = result.projectId;
        elements.dest.dbUrl.textContent = result.databaseURL;
    } else {
        status.textContent = '❌ Failed';
        status.className = 'status-badge error';
        info.style.display = 'none';
    }
    
    updateStartButton();
};

/**
 * Update migration start button state
 */
function updateStartButton() {
    const btn = elements.startBtn;
    const enabled = sourceConnected && destConnected && !isMigrating;
    
    if (enabled && areSameDatabase()) {
        btn.disabled = true;
        btn.textContent = '⚠️ Same Database';
        logger.warning('Source and destination databases are the same');
        return;
    }
    
    btn.disabled = !enabled;
    btn.textContent = enabled ? '🚀 Start Migration' : '⏳ Connect Both Databases';
}

/**
 * Update progress
 * @param {number} percentage - Progress percentage
 * @param {string} status - Status message
 */
updateUI.updateProgress = function(percentage, status) {
    progress.update(percentage, status);
};

/**
 * Handle migration started
 */
updateUI.migrationStarted = function() {
    isMigrating = true;
    elements.startBtn.disabled = true;
    elements.startBtn.textContent = '⏳ Migrating...';
    progress.start();
    elements.summarySection.style.display = 'none';
};

/**
 * Handle migration failed
 * @param {string} error - Error message
 */
updateUI.migrationFailed = function(error) {
    isMigrating = false;
    elements.startBtn.disabled = false;
    elements.startBtn.textContent = '🚀 Start Migration';
    progress.complete('Failed');
    updateStartButton();
};

/**
 * Update migration summary
 * @param {Object} summary - Migration summary
 */
export function updateSummary(summary) {
    const section = elements.summarySection;
    section.style.display = 'block';
    
    elements.summary.status.textContent = summary.status;
    elements.summary.status.className = `summary-value ${summary.success ? 'success' : 'error'}`;
    
    elements.summary.time.textContent = summary.time;
    elements.summary.nodes.textContent = summary.nodes;
    elements.summary.size.textContent = summary.size;
    elements.summary.verification.textContent = summary.verification;
    elements.summary.verification.className = `summary-value ${summary.success ? 'success' : 'error'}`;
}

/**
 * Initialize UI event handlers
 */
export function initializeUI() {
    // Source test
    elements.source.testBtn.addEventListener('click', async () => {
        const config = getConfig('source');
        elements.source.testBtn.disabled = true;
        elements.source.testBtn.textContent = '⏳ Testing...';
        
        try {
            await testSourceConnection(config);
        } catch (error) {
            // Error handled in connection.js
        } finally {
            elements.source.testBtn.disabled = false;
            elements.source.testBtn.textContent = '🔍 Test Connection';
        }
    });
    
    // Destination test
    elements.dest.testBtn.addEventListener('click', async () => {
        const config = getConfig('dest');
        elements.dest.testBtn.disabled = true;
        elements.dest.testBtn.textContent = '⏳ Testing...';
        
        try {
            await testDestConnection(config);
        } catch (error) {
            // Error handled in connection.js
        } finally {
            elements.dest.testBtn.disabled = false;
            elements.dest.testBtn.textContent = '🔍 Test Connection';
        }
    });
    
    // Start migration
    elements.startBtn.addEventListener('click', async () => {
        if (isMigrating) return;
        
        const options = {
            overwrite: elements.options.overwrite.checked,
            clearDestination: elements.options.clearDest.checked,
            verify: elements.options.verify.checked,
            stopOnError: elements.options.stopOnError.checked,
        };
        
        try {
            await performMigration(options);
        } catch (error) {
            logger.error(`Migration error: ${error.message}`);
        } finally {
            isMigrating = false;
            updateStartButton();
        }
    });
    
    // Clear logs
    elements.clearLogs.addEventListener('click', () => {
        logger.clear();
    });
    
    // Input listeners for start button
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            // Reset connection status when config changes
            if (input.id.includes('source') && sourceConnected) {
                sourceConnected = false;
                elements.source.status.textContent = 'Not Connected';
                elements.source.status.className = 'status-badge';
                elements.source.info.style.display = 'none';
                updateStartButton();
            }
            if (input.id.includes('dest') && destConnected) {
                destConnected = false;
                elements.dest.status.textContent = 'Not Connected';
                elements.dest.status.className = 'status-badge';
                elements.dest.info.style.display = 'none';
                updateStartButton();
            }
        });
    });
}

/**
 * Get config from form
 * @param {string} type - 'source' or 'dest'
 * @returns {Object} Firebase config
 */
function getConfig(type) {
    const prefix = type === 'source' ? 'source' : 'dest';
    const el = elements[type];
    
    return {
        apiKey: el.apiKey.value.trim(),
        authDomain: el.authDomain.value.trim(),
        databaseURL: el.databaseURL.value.trim(),
        projectId: el.projectId.value.trim(),
        storageBucket: el.storageBucket.value.trim(),
        messagingSenderId: el.messagingSenderId.value.trim(),
        appId: el.appId.value.trim(),
    };
}

/**
 * Initialize on load
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    logger.info('Migration tool ready');
    
    // Auto-update start button
    const startBtn = elements.startBtn;
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = '⏳ Connect Both Databases';
    }
});
