import { logger } from './logger.js';
import { progress } from './progress.js';
import { testSourceConnection, testDestConnection, areSameDatabase } from './connection.js';
import { performMigration } from './migration.js';

// DOM Elements
const el = {
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

// Parse Firebase Config - IMPROVED
function parseFirebaseConfig(text) {
    try {
        let configText = text;
        
        // STRATEGY 1: Cari const firebaseConfig = {...}
        let match = text.match(/const\s+firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
        if (match) {
            configText = match[1];
        }
        
        // STRATEGY 2: Cari const config = {...}
        if (!match) {
            match = text.match(/const\s+config\s*=\s*(\{[\s\S]*?\});/);
            if (match) configText = match[1];
        }
        
        // STRATEGY 3: Cari var firebaseConfig = {...}
        if (!match) {
            match = text.match(/var\s+firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
            if (match) configText = match[1];
        }
        
        // STRATEGY 4: Cari let firebaseConfig = {...}
        if (!match) {
            match = text.match(/let\s+firebaseConfig\s*=\s*(\{[\s\S]*?\});/);
            if (match) configText = match[1];
        }
        
        // STRATEGY 5: Cari object biasa yang ada apiKey
        if (!match) {
            match = text.match(/(\{[\s\S]*?apiKey[\s\S]*?\})/);
            if (match) configText = match[1];
        }
        
        // STRATEGY 6: Cari object biasa yang ada authDomain
        if (!match) {
            match = text.match(/(\{[\s\S]*?authDomain[\s\S]*?\})/);
            if (match) configText = match[1];
        }
        
        // STRATEGY 7: Cari object biasa yang ada databaseURL
        if (!match) {
            match = text.match(/(\{[\s\S]*?databaseURL[\s\S]*?\})/);
            if (match) configText = match[1];
        }
        
        // Bersihkan text
        let cleaned = configText
            .replace(/\/\/.*$/gm, '')           // Hapus comments //
            .replace(/\/\*[\s\S]*?\*\//g, '')    // Hapus comments /* */
            .replace(/\s+/g, ' ')                // Normalize whitespace
            .replace(/(\w+):/g, '"$1":')         // Add quotes to keys
            .replace(/'/g, '"')                  // Single quote to double quote
            .trim();
        
        // Parse JSON
        const config = JSON.parse(cleaned);
        
        // Validasi
        const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
        const missing = required.filter(f => !config[f]);
        
        if (missing.length > 0) {
            throw new Error('Missing: ' + missing.join(', '));
        }
        
        return config;
    } catch (error) {
        throw new Error('Parse error: ' + error.message);
    }
}

// Fill Form
function fillForm(type, config) {
    const e = el[type];
    
    e.apiKey.value = config.apiKey || '';
    e.authDomain.value = config.authDomain || '';
    e.databaseURL.value = config.databaseURL || '';
    e.projectId.value = config.projectId || '';
    e.storageBucket.value = config.storageBucket || '';
    e.messagingSenderId.value = config.messagingSenderId || '';
    e.appId.value = config.appId || '';
    
    // Add filled class
    ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(field => {
        const input = e[field];
        if (input.value) {
            input.classList.add('filled');
        } else {
            input.classList.remove('filled');
        }
    });
    
    // Reset connection
    if (type === 'source') {
        sourceConnected = false;
        e.status.textContent = 'Not Connected';
        e.status.className = 'status-badge';
        e.info.style.display = 'none';
    } else {
        destConnected = false;
        e.status.textContent = 'Not Connected';
        e.status.className = 'status-badge';
        e.info.style.display = 'none';
    }
    
    updateStartBtn();
    logger.info(type + ' config parsed successfully');
}

// Handle Input
function handleInput(type, event) {
    const text = event.target.value;
    if (text.trim().length === 0) {
        // Clear form if empty
        const e = el[type];
        ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(field => {
            e[field].value = '';
            e[field].classList.remove('filled');
        });
        return;
    }
    
    try {
        const config = parseFirebaseConfig(text);
        fillForm(type, config);
        logger.success(type + ' auto-parsed! ✅');
    } catch (error) {
        // Only log if there was previous data
        const e = el[type];
        const hasData = e.apiKey.value || e.authDomain.value || e.databaseURL.value;
        if (hasData) {
            logger.warning('Parse failed: ' + error.message);
        }
        // Don't clear on error, keep existing data
    }
}

// Update Start Button
function updateStartBtn() {
    const btn = el.startBtn;
    const enabled = sourceConnected && destConnected && !isMigrating;
    
    if (enabled && areSameDatabase()) {
        btn.disabled = true;
        btn.textContent = '⚠️ Same Database';
        logger.warning('Source and destination are the same');
        return;
    }
    
    btn.disabled = !enabled;
    btn.textContent = enabled ? '🚀 Start Migration' : '⏳ Connect Both Databases';
}

// Get Config from form
function getConfig(type) {
    const e = el[type];
    return {
        apiKey: e.apiKey.value.trim(),
        authDomain: e.authDomain.value.trim(),
        databaseURL: e.databaseURL.value.trim(),
        projectId: e.projectId.value.trim(),
        storageBucket: e.storageBucket.value.trim(),
        messagingSenderId: e.messagingSenderId.value.trim(),
        appId: e.appId.value.trim(),
    };
}

// Update UI functions
export const updateUI = {};

updateUI.sourceConnected = function(connected, result) {
    sourceConnected = connected;
    const status = el.source.status;
    const info = el.source.info;
    
    if (connected && result) {
        status.textContent = '✅ Connected';
        status.className = 'status-badge connected';
        info.style.display = 'block';
        el.source.projectName.textContent = result.projectId;
        el.source.dbUrl.textContent = result.databaseURL;
    } else {
        status.textContent = '❌ Failed';
        status.className = 'status-badge error';
        info.style.display = 'none';
    }
    updateStartBtn();
};

updateUI.destConnected = function(connected, result) {
    destConnected = connected;
    const status = el.dest.status;
    const info = el.dest.info;
    
    if (connected && result) {
        status.textContent = '✅ Connected';
        status.className = 'status-badge connected';
        info.style.display = 'block';
        el.dest.projectName.textContent = result.projectId;
        el.dest.dbUrl.textContent = result.databaseURL;
    } else {
        status.textContent = '❌ Failed';
        status.className = 'status-badge error';
        info.style.display = 'none';
    }
    updateStartBtn();
};

updateUI.updateProgress = function(percentage, status) {
    progress.update(percentage, status);
};

updateUI.migrationStarted = function() {
    isMigrating = true;
    el.startBtn.disabled = true;
    el.startBtn.textContent = '⏳ Migrating...';
    progress.start();
    el.summarySection.style.display = 'none';
};

updateUI.migrationFailed = function(error) {
    isMigrating = false;
    el.startBtn.disabled = false;
    el.startBtn.textContent = '🚀 Start Migration';
    progress.complete('Failed');
    updateStartBtn();
};

export function updateSummary(summary) {
    el.summarySection.style.display = 'block';
    el.summary.status.textContent = summary.status;
    el.summary.status.className = 'summary-value ' + (summary.success ? 'success' : 'error');
    el.summary.time.textContent = summary.time;
    el.summary.nodes.textContent = summary.nodes;
    el.summary.size.textContent = summary.size;
    el.summary.verification.textContent = summary.verification;
    el.summary.verification.className = 'summary-value ' + (summary.success ? 'success' : 'error');
}

// Initialize
export function initializeUI() {
    // Source auto-parse
    el.source.input.addEventListener('input', (e) => handleInput('source', e));
    el.source.input.addEventListener('paste', (e) => {
        setTimeout(() => handleInput('source', e), 100);
    });
    
    // Dest auto-parse
    el.dest.input.addEventListener('input', (e) => handleInput('dest', e));
    el.dest.input.addEventListener('paste', (e) => {
        setTimeout(() => handleInput('dest', e), 100);
    });
    
    // Test Source
    el.source.testBtn.addEventListener('click', async () => {
        const config = getConfig('source');
        el.source.testBtn.disabled = true;
        el.source.testBtn.textContent = '⏳ Testing...';
        try {
            await testSourceConnection(config);
        } catch (error) {}
        el.source.testBtn.disabled = false;
        el.source.testBtn.textContent = '🔍 Test Connection';
    });
    
    // Test Dest
    el.dest.testBtn.addEventListener('click', async () => {
        const config = getConfig('dest');
        el.dest.testBtn.disabled = true;
        el.dest.testBtn.textContent = '⏳ Testing...';
        try {
            await testDestConnection(config);
        } catch (error) {}
        el.dest.testBtn.disabled = false;
        el.dest.testBtn.textContent = '🔍 Test Connection';
    });
    
    // Start Migration
    el.startBtn.addEventListener('click', async () => {
        if (isMigrating) return;
        const options = {
            overwrite: el.options.overwrite.checked,
            clearDestination: el.options.clearDest.checked,
            verify: el.options.verify.checked,
            stopOnError: el.options.stopOnError.checked,
        };
        try {
            await performMigration(options);
        } catch (error) {
            logger.error('Migration error: ' + error.message);
        } finally {
            isMigrating = false;
            updateStartBtn();
        }
    });
    
    // Clear logs
    el.clearLogs.addEventListener('click', () => {
        logger.clear();
    });
}

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    logger.info('Migration tool ready - Paste FULL config to auto-fill!');
    el.startBtn.disabled = true;
    el.startBtn.textContent = '⏳ Connect Both Databases';
});
