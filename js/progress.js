/**
 * Progress management for migration
 */

let progressState = {
    percentage: 0,
    status: 'Ready',
    isActive: false
};

/**
 * Progress API
 */
export const progress = {
    /**
     * Start progress tracking
     */
    start: () => {
        progressState.isActive = true;
        progressState.percentage = 0;
        progressState.status = 'Starting...';
        updateUI();
    },
    
    /**
     * Update progress
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} status - Status message
     */
    update: (percentage, status) => {
        progressState.percentage = Math.min(100, Math.max(0, percentage));
        progressState.status = status || progressState.status;
        updateUI();
    },
    
    /**
     * Complete progress
     * @param {string} status - Final status message
     */
    complete: (status) => {
        progressState.percentage = 100;
        progressState.status = status || 'Completed!';
        progressState.isActive = false;
        updateUI();
    },
    
    /**
     * Reset progress
     */
    reset: () => {
        progressState.percentage = 0;
        progressState.status = 'Ready';
        progressState.isActive = false;
        updateUI();
    },
    
    /**
     * Get current progress state
     * @returns {Object} Progress state
     */
    getState: () => {
        return { ...progressState };
    }
};

/**
 * Update UI with current progress
 */
function updateUI() {
    const fill = document.getElementById('progressFill');
    const percentage = document.getElementById('progressPercentage');
    const status = document.getElementById('progressStatus');
    const section = document.getElementById('progressSection');
    
    if (fill) {
        fill.style.width = `${progressState.percentage}%`;
    }
    
    if (percentage) {
        percentage.textContent = `${Math.round(progressState.percentage)}%`;
    }
    
    if (status) {
        status.textContent = progressState.status;
    }
    
    if (section) {
        section.style.display = progressState.isActive || progressState.percentage > 0 ? 'block' : 'none';
    }
}
