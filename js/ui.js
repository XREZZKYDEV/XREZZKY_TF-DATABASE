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
        pasteBtn: document.getElementById('pasteSourceBtn'),
        textarea: document.getElementById('sourceConfigTextarea'),
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
        pasteBtn: document.getElementById('pasteDestBtn'),
        textarea: document.getElementById('destConfigTextarea'),
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
 * Parse Firebase config from text
 * @param {string} text - Firebase config text
 * @returns {Object} Parsed config
 */
function parseFirebaseConfig(text) {
    try {
        // Try to extract firebaseConfig object
        let configText = text;
        
        // Find firebaseConfig object
        const configMatch = text.match(/const\s+firebaseConfig\s*=\s*({[\s\S]*?});/);
        if (configMatch) {
            configText = configMatch[1];
        }
        
        // Find firebaseConfig with different variable names
        const configMatch2 = text.match(/const\s+config\s*=\s*({[\s\S]*?});/);
        if (configMatch2 && !configMatch) {
            configText = configMatch2[1];
        }
        
        // Find any object with Firebase config keys
        const configMatch3 = text.match(/({[\s\S]*?(?:apiKey|authDomain|databaseURL|projectId)[\s\S]*?})/);
        if (configMatch3 && !configMatch && !configMatch2) {
            configText = configMatch3[1];
        }
        
        // Clean up and parse
        const cleaned = configText
            .replace(/\/\/.*$/gm, '') // Remove comments
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/(\w+):/g, '"$1":') // Add quotes to keys
            .replace(/'/g, '"'); // Replace single quotes with double quotes
        
        // Parse JSON
        const config = JSON.parse(cleaned);
        
        // Validate required fields
        const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
        const missing = required.filter(field => !config[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        return config;
    } catch (error) {
        throw new Error(`Failed to parse Firebase config: ${error.message}`);
    }
}

/**
 * Fill form with config
 * @param {string} type - 'source' or 'dest'
 * @param {Object} config - Firebase config
 */
function fillFormWithConfig(type, config) {
    const el = elements[type];
    
    el.apiKey.value = config.apiKey || '';
    el.authDomain.value = config.authDomain || '';
    el.databaseURL.value = config.databaseURL || '';
    el.projectId.value = config.projectId || '';
    el.storageBucket.value = config.storageBucket || '';
    el.messagingSenderId.value = config.messagingSenderId || '';
    el.appId.value = config.appId || '';
    
    // Reset connection status
    if (type === 'source') {
        sourceConnected = false;
        el.status.textContent = 'Not Connected';
        el.status.className = 'status-badge';
        el.info.style.display = 'none';
    } else {
        destConnected = false;
        el.status.textContent = 'Not Connected';
        el.status.className = 'status-badge';
        el.info.style.display = 'none';
    }
    
    updateStartButton();
    logger.info(`${type === 'source' ? 'Source' : 'Destination'} config filled from paste`);
}

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
    // Source paste button
    elements.source.pasteBtn.addEventListener('click', () => {
        const textarea = elements.source.textarea;
        if (textarea.style.display === 'block') {
            textarea.style.display = 'none';
            elements.source.pasteBtn.textContent = '📋 Paste Firebase Config';
            return;
        }
        textarea.style.display = 'block';
        textarea.classList.add('active');
        elements.source.pasteBtn.textContent = '❌ Cancel';
        textarea.focus();
    });
    
    // Source paste textarea
    elements.source.textarea.addEventListener('blur', () => {
        // Don't auto-close on blur, user can click cancel
    });
    
    elements.source.textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.source.textarea.style.display = 'none';
            elements.source.textarea.classList.remove('active');
            elements.source.pasteBtn.textContent = '📋 Paste Firebase Config';
        }
    });
    
    // Source paste submit (Ctrl+Enter or Cmd+Enter)
    elements.source.textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            try {
                const config = parseFirebaseConfig(elements.source.textarea.value);
                fillFormWithConfig('source', config);
                elements.source.textarea.style.display = 'none';
                elements.source.textarea.classList.remove('active');
                elements.source.pasteBtn.textContent = '📋 Paste Firebase Config';
                logger.success('Source config pasted successfully');
            } catch (error) {
                logger.error(`Failed to parse source config: ${error.message}`);
                alert(`Failed to parse config: ${error.message}`);
            }
        }
    });
    
    // Destination paste button
    elements.dest.pasteBtn.addEventListener('click', () => {
        const textarea = elements.dest.textarea;
        if (textarea.style.display === 'block') {
            textarea.style.display = 'none';
            elements.dest.pasteBtn.textContent = '📋 Paste Firebase Config';
            return;
        }
        textarea.style.display = 'block';
        textarea.classList.add('active');
        elements.dest.pasteBtn.textContent = '❌ Cancel';
        textarea.focus();
    });
    
    // Destination paste textarea
    elements.dest.textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            elements.dest.textarea.style.display = 'none';
            elements.dest.textarea.classList.remove('active');
            elements.dest.pasteBtn.textContent = '📋 Paste Firebase Config';
        }
    });
    
    // Destination paste submit (Ctrl+Enter or Cmd+Enter)
    elements.dest.textarea.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            try {
                const config = parseFirebaseConfig(elements.dest.textarea.value);
                fillFormWithConfig('dest', config);
                elements.dest.textarea.style.display = 'none';
                elements.dest.textarea.classList.remove('active');
                elements.dest.pasteBtn.textContent = '📋 Paste Firebase Config';
                logger.success('Destination config pasted successfully');
            } catch (error) {
                logger.error(`Failed to parse destination config: ${error.message}`);
                alert(`Failed to parse config: ${error.message}`);
            }
        }
    });
    
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
