/**
 * Logger utility for terminal logging
 */

let logs = [];

/**
 * Log entry types
 */
const LEVELS = {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    PROGRESS: 'progress'
};

/**
 * Add log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 */
function addLog(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { level, message, timestamp };
    logs.push(entry);
    
    // Update UI
    const terminal = document.getElementById('logsTerminal');
    if (terminal) {
        const entryElement = document.createElement('div');
        entryElement.className = `log-entry ${level}`;
        entryElement.textContent = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        terminal.appendChild(entryElement);
        terminal.scrollTop = terminal.scrollHeight;
    }
}

/**
 * Logger API
 */
export const logger = {
    /**
     * Log info message
     * @param {string} message 
     */
    info: (message) => {
        addLog(LEVELS.INFO, message);
    },
    
    /**
     * Log success message
     * @param {string} message 
     */
    success: (message) => {
        addLog(LEVELS.SUCCESS, message);
    },
    
    /**
     * Log error message
     * @param {string} message 
     */
    error: (message) => {
        addLog(LEVELS.ERROR, message);
    },
    
    /**
     * Log warning message
     * @param {string} message 
     */
    warning: (message) => {
        addLog(LEVELS.WARNING, message);
    },
    
    /**
     * Log progress message
     * @param {string} message 
     */
    progress: (message) => {
        addLog(LEVELS.PROGRESS, message);
    },
    
    /**
     * Clear all logs
     */
    clear: () => {
        logs = [];
        const terminal = document.getElementById('logsTerminal');
        if (terminal) {
            terminal.innerHTML = '<div class="log-entry info">[INFO] Logs cleared</div>';
        }
    },
    
    /**
     * Get all logs
     * @returns {Array} Log entries
     */
    getLogs: () => {
        return logs;
    }
};
