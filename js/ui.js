import { logger } from './logger.js';
import { progress } from './progress.js';
import { testSourceConnection, testDestConnection, areSameDatabase } from './connection.js';
import { performMigration } from './migration.js';

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

function parseFirebaseConfig(text) {
    try {
        let configText = text;
        
        // Cari firebaseConfig
        const configMatch = text.match(/const\s+firebaseConfig\s*=\s*({[\s\S]*?});/);
        if (configMatch) {
            configText = configMatch[1];
        }
        
        // Cari config
        const configMatch2 = text.match(/const\s+config\s*=\s*({[\s\S]*?});/);
        if (configMatch2 && !configMatch) {
            configText = configMatch2[1];
        }
        
        // Cari object apa aja
        const configMatch3 = text.match(/({[\s\S]*?(?:apiKey|authDomain|databaseURL|projectId)[\s\S]*?})/);
        if (configMatch3 && !configMatch && !configMatch2) {
            configText = configMatch3[1];
        }
        
        // Bersihkan
        const cleaned = configText
            .replace(/\/\/.*$/gm, '')
            .replace(/\s+/g, ' ')
            .replace(/(\w+):/g, '"$1":')
            .replace(/'/g, '"')
            .trim();
        
        const config = JSON.parse(cleaned);
        
        const required = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
        const missing = required.filter(field => !config[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing: ${missing.join(', ')}`);
        }
        
        return config;
    } catch (error) {
        throw new Error(`Parse error: ${error.message}`);
    }
}

function fillForm(type, config) {
    const el = elements[type];
    
    const fields = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    
    fields.forEach(field => {
        const input = el[field];
        const value = config[field] || '';
        input.value = value;
        input.classList.toggle('filled', !!value);
    });
    
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
    logger.info(`${type === 'source' ? 'Source' : 'Destination'} config parsed`);
}

function handleInput(type, event) {
    const text = event.target.value;
    
    if (text.trim().length === 0) {
        return;
    }
    
    try {
        const config = parseFirebaseConfig(text);
        fillForm(type, config);
        logger.success(`${type === 'source' ? 'Source' : 'Destination'} auto-parsed!`);
    } catch (error) {
        // Silent
    }
}

updateUI = {};
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
        logger.warning('Source and destination are the same');
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
    // SOURCE - Auto parse on input/paste
    elements.source.input.addEventListener('input', (e) => handleInput('source', e));
    elements.source.input.addEventListener('paste', (e) => {
        setTimeout(() => handleInput('source', e), 100);
    });
    
    // DEST - Auto parse on input/paste
    elements.dest.input.addEventListener('input', (e) => handleInput('dest', e));
    elements.dest.input.addEventListener('paste', (e) => {
        setTimeout(() => handleInput('dest', e), 100);
    });
    
    // Test Source
    elements.source.testBtn.addEventListener('click', async () => {
        const config = getConfig('source');
        elements.source.testBtn.disabled = true;
        elements.source.testBtn.textContent = '⏳ Testing...';
        
        try {
            await testSourceConnection(config);
        } catch (error) {}
        finally {
            elements.source.testBtn.disabled = false;
            elements.source.testBtn.textContent = '🔍 Test Connection';
        }
    });
    
    // Test Dest
    elements.dest.testBtn.addEventListener('click', async () => {
        const config = getConfig('dest');
        elements.dest.testBtn.disabled = true;
        elements.dest.testBtn.textContent = '⏳ Testing...';
        
        try {
            await testDestConnection(config);
        } catch (error) {}
        finally {
            elements.dest.testBtn.disabled = false;
            elements.dest.testBtn.textContent = '🔍 Test Connection';
        }
    });
    
    // Start Migration
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
    logger.info('Migration tool ready - Paste config to auto-fill!');
    elements.startBtn.disabled = true;
    elements.startBtn.textContent = '⏳ Connect Both Databases';
});

export { updateUI };
