// popup.js - handles interaction with the extension's popup, sends requests to the
// service worker (background.js), and updates the popup's UI (popup.html) on completion.

const inputElement = document.getElementById('text');
const outputElement = document.getElementById('output');
const backendStatusElement = document.getElementById('backend-status');
const modelsStatusElement = document.getElementById('models-status');
const statsDisplayElement = document.getElementById('stats-display');
const refreshStatsButton = document.getElementById('refresh-stats');
const clearCacheButton = document.getElementById('clear-cache');

// Check backend and model status on popup open
chrome.runtime.sendMessage({ action: 'checkModelsReady' }, (response) => {
    if (response && !response.error) {
        backendStatusElement.innerText = `Backend: ${response.backend || 'unknown'}`;
        modelsStatusElement.innerText = `Models: ${response.ready ? 'Ready ✓' : 'Loading...'}`;
    }
});

// Function to update performance stats display
function updateStatsDisplay(stats, backend) {
    const textStats = stats.textClassifications;
    const imageStats = stats.imageClassifications;
    
    const textCacheRate = textStats.total > 0 
        ? (textStats.cached / textStats.total * 100).toFixed(1) 
        : 0;
    const imageCacheRate = imageStats.total > 0 
        ? (imageStats.cached / imageStats.total * 100).toFixed(1) 
        : 0;
    const textAvgTime = textStats.total > 0 
        ? (textStats.totalTime / textStats.total).toFixed(0) 
        : 0;
    const imageAvgTime = imageStats.total > 0 
        ? (imageStats.totalTime / imageStats.total).toFixed(0) 
        : 0;
    
    statsDisplayElement.innerHTML = `
        <div class="stat-group">
            <strong>Backend:</strong> ${backend}
        </div>
        <div class="stat-group">
            <strong>Text Classifications:</strong>
            <ul>
                <li>Total: ${textStats.total}</li>
                <li>Cached: ${textStats.cached} (${textCacheRate}% hit rate)</li>
                <li>Avg Time: ${textAvgTime}ms</li>
            </ul>
        </div>
        <div class="stat-group">
            <strong>Image Classifications:</strong>
            <ul>
                <li>Total: ${imageStats.total}</li>
                <li>Cached: ${imageStats.cached} (${imageCacheRate}% hit rate)</li>
                <li>Avg Time: ${imageAvgTime}ms</li>
            </ul>
        </div>
    `;
}

// Refresh stats button handler
refreshStatsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getPerformanceStats' }, (response) => {
        if (response && !response.error) {
            updateStatsDisplay(response.stats, response.backend);
        } else {
            statsDisplayElement.innerText = 'Error loading stats';
        }
    });
});

// Clear cache button handler
clearCacheButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all cached classification results?')) {
        chrome.runtime.sendMessage({ action: 'clearCache' }, (response) => {
            if (response && response.success) {
                alert('Cache cleared successfully!');
                // Refresh stats after clearing
                refreshStatsButton.click();
            } else {
                alert('Error clearing cache');
            }
        });
    }
});

// Listen for changes made to the textbox.
inputElement.addEventListener('input', (event) => {
    // Bundle the input data into a message.
    const message = {
        action: 'classify',
        text: event.target.value,
    }

    // Send this message to the service worker.
    chrome.runtime.sendMessage(message, (response) => {
        // Handle results returned by the service worker (`background.js`) and update the popup's UI.
        outputElement.innerText = JSON.stringify(response, null, 2);
    });
});

// Auto-load stats on popup open
refreshStatsButton.click();
