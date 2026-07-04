import { logger } from './logger.js';
import { progress } from './progress.js';
import { testSourceConnection, testDestConnection, areBothConnected, areSameDatabase } from './connection.js';
import { performMigration } from './migration.js';

// DOM Elements
const elements = {
    source: {
        input: document.getElementById('sourceConfigInput'),
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
        input: document.getElementById('destConfigInput'),
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
            .replace(/'/g, '"') // Replace single quotes with double quotes
            .trim();
        
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
    
    // Fill form fields
    const fields = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    let hasData = false;
    
    fields.forEach(field => {
        const input = el[field];
        const value = config[field] || '';
        if (value) hasData = true;
        input.value = value;
        input.classList.toggle('filled', !!value);
    });
    
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
    logger.info(`${type === 'source' ? 'Source' : 'Destination'} config parsed successfully`);
}

/**
 * Handle paste/input event
 * @param {string} type - 'source' or 'dest'
 * @param {Event} event - Input event
 */
function handleConfigInput(type, event) {
    const text = event.target.value;
    
    // Only parse if there's content
    if (text.trim().length === 0) {
        return;
    }
    
    try {
        const config = parseFirebaseConfig(text);
        fillFormWithConfig(type, config);
        logger.success(`${type === 'source' ? 'Source' : 'Destination'} config auto-parsed!`);
    } catch (error) {
        // Silent fail, don't show error on every keystroke
        // Only log if there was previous valid config
        const el = elements[type];
        const hasValues = el.apiKey.value || el.authDomain.value || el.databaseURL.value;
        if (hasValues) {
            // Clear if parse fails
            const fields = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
            fields.forEach(field => {
                el[field].value = '';
                el[field].classList.remove('filled');
            });
        }
    }
}

/**
 * Update UI for source connection status
 */
function updateUI() {}

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

updateUI.updateProgress = function(percentage, status) {
    progress.update(percentage, status);
};

updateUI.migrationStarted = function() {
    isMigrating = true;
    elements.startBtn.disabled = true;
    elements.startBtn.textContent = '⏳ Migrating...';
    progress.start();
    elements.summarySection.style.display = 'none';
};

updateUI.migrationFailed = function(error) {
    isMigrating = false;
    elements.startBtn.disabled = false;
    elements.startBtn.textContent = '🚀 Start Migration';
    progress.complete('Failed');
    updateStartButton();
};

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

export function initializeUI() {
    // Source input - auto parse on paste/input
    elements.source.input.addEventListener('input', (e) => handleConfigInput('source', e));
    elements.source.input.addEventListener('paste', (e) => {
        // Allow paste to complete, then parse
        setTimeout(() => handleConfigInput('source', e), 100);
    });
    
    // Destination input - auto parse on paste/input
    elements.dest.input.addEventListener('input', (e) => handleConfigInput('dest', e));
    elements.dest.input.addEventListener('paste', (e) => {
        setTimeout(() => handleConfigInput('dest', e), 100);
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
}

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

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    logger.info('Migration tool ready');
    
    const startBtn = elements.startBtn;
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.textContent = '⏳ Connect Both Databases';
    }
});
