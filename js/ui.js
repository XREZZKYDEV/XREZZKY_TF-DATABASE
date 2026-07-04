import { logger } from './logger.js';
import { progress } from './progress.js';
import { testSourceConnection, testDestConnection, areSameDatabase } from './connection.js';
import { performMigration } from './migration.js';

const el = {
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

let sourceConnected = false;
let destConnected = false;
let isMigrating = false;

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

function updateStartBtn() {
    const btn = el.startBtn;
    const enabled = sourceConnected && destConnected && !isMigrating;
    
    if (enabled && areSameDatabase()) {
        btn.disabled = true;
        btn.textContent = '⚠️ Same Database';
        return;
    }
    
    btn.disabled = !enabled;
    btn.textContent = enabled ? '🚀 Start Migration' : '⏳ Connect Both Databases';
}

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

export function initializeUI() {
    // Test Source
    el.source.testBtn.addEventListener('click', async () => {
        const config = getConfig('source');
        if (!config.apiKey || !config.databaseURL) {
            logger.error('Isi semua field source dulu!');
            return;
        }
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
        if (!config.apiKey || !config.databaseURL) {
            logger.error('Isi semua field destination dulu!');
            return;
        }
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

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    logger.info('🔥 Migration tool ready!');
    el.startBtn.disabled = true;
    el.startBtn.textContent = '⏳ Connect Both Databases';
});
