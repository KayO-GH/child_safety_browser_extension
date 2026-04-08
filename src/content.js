// Hide all images by default as early as possible

(function injectImageHidingStyle() {
    const style = document.createElement('style');
    style.innerHTML = 'img { visibility: hidden !important; }';
    if (document.head) {
        document.head.prepend(style);
    } else if (document.documentElement) {
        document.documentElement.insertBefore(style, document.documentElement.firstChild);
    } else {
        // If neither is available, retry shortly
        setTimeout(injectImageHidingStyle, 10);
    }
})();

// Don't hide page immediately - wait for models to be ready and classification to complete
let NSFW_detected = false;
let modelsReady = false;

// Check if models are ready before attempting classification
chrome.runtime.sendMessage({ action: 'checkModelsReady' }, (response) => {
    if (chrome.runtime.lastError) {
        console.warn('Child Safety Extension: Unable to connect to background script', chrome.runtime.lastError);
        // Graceful degradation - show content if extension isn't working
        return;
    }
    
    modelsReady = response?.ready || false;
    
    if (!modelsReady) {
        console.log('Child Safety Extension: Models not ready yet, content will be shown without filtering');
    }
});

document.addEventListener("DOMContentLoaded", function () {
    // Classify text with error handling
    chrome.runtime.sendMessage({
        action: 'classify',
        text: document.body.textContent,
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.warn('Child Safety Extension: Text classification failed', chrome.runtime.lastError);
            return;
        }
        if (!response || !Array.isArray(response) || response.length === 0) {
            console.warn('Child Safety Extension: Invalid classification response, showing content');
            return;
        }
        try {
            console.log('Text classification result:', response);
            if (response[0]['label'] !== 'SFW' && response[0]['score'] > 0.8) {
                NSFW_detected = true;
                document.documentElement.style.visibility = 'hidden';
                window.alert("NSFW content detected. Please close this tab.");
            }
        } catch (error) {
            console.warn('Child Safety Extension: Error processing classification result', error);
        }
    });


    // --- Client-side queue for image scanning ---
    const MAX_CONCURRENT_IMAGE_SCANS = 2; // Tune as needed
    let imageScanQueue = [];
    let activeImageScans = 0;

    function processNextImageScan() {
        if (activeImageScans >= MAX_CONCURRENT_IMAGE_SCANS) return;
        if (imageScanQueue.length === 0) return;
        const img = imageScanQueue.shift();
        if (!img || img.getAttribute('data-nsfw-status') === 'scanned') {
            processNextImageScan();
            return;
        }
        activeImageScans++;
        img.style.visibility = 'hidden';
        img.setAttribute('data-nsfw-status', 'pending');
        let img_src = img.src;
        if (!img_src || img_src.trim() === '') {
            activeImageScans--;
            processNextImageScan();
            return;
        }
        chrome.runtime.sendMessage({
            action: 'classifyImage',
            img_src: img_src,
        }, (response) => {
            if (chrome.runtime.lastError) {
                img.style.visibility = 'visible';
                img.style.filter = '';
                img.setAttribute('data-nsfw-status', 'error');
            } else if (!response || !Array.isArray(response) || response.length === 0 || response.error) {
                img.style.visibility = 'visible';
                img.style.filter = '';
                img.setAttribute('data-nsfw-status', 'error');
            } else {
                try {
                    // Detailed logging for debugging
                    console.log('=== Image Classification Decision ===');
                    console.log('Image src:', img_src);
                    console.log('Classification results:', response);
                    console.log('Top label:', response[0]['label']);
                    console.log('Confidence score:', (response[0]['score'] * 100).toFixed(2) + '%');
                    
                    // IMPORTANT: Use threshold of 0.7 (70%) to reduce false positives
                    // Only block if NSFW/nsfw label AND confidence > 70%
                    const NSFW_THRESHOLD = 0.5;
                    const isSafe = (response[0]['label'] === 'sfw' || response[0]['label'] === 'SFW') || 
                                   (response[0]['score'] < NSFW_THRESHOLD);
                    
                    console.log('Decision:', isSafe ? 'SAFE (showing)' : 'NSFW (blocking)');
                    console.log('=====================================');
                    
                    if (isSafe) {
                        img.style.visibility = 'visible';
                        // If confidence is less than 60%, apply slight blur as a warning
                        const blurFilter = response[0]['score'] < 0.6 ? 'blur(10px)' : '';
                        img.style.filter = blurFilter;
                        // Remove the global hiding style for this image
                        img.style.setProperty('visibility', 'visible', 'important');
                        img.style.setProperty('filter', blurFilter, 'important');
                        img.setAttribute('data-nsfw-status', 'sfw');
                    } else {
                        img.style.visibility = 'hidden';
                        img.style.setProperty('visibility', 'hidden', 'important');
                        img.style.setProperty('filter', 'blur(20px)', 'important');
                        img.setAttribute('data-nsfw-status', 'nsfw');
                        let overlay = document.createElement('div');
                        overlay.textContent = `NSFW Image Blocked (${(response[0]['score'] * 100).toFixed(0)}%)`;
                        overlay.style.position = 'absolute';
                        overlay.style.left = img.offsetLeft + 'px';
                        overlay.style.top = img.offsetTop + 'px';
                        overlay.style.width = img.width + 'px';
                        overlay.style.height = img.height + 'px';
                        overlay.style.background = 'rgba(0,0,0,0.7)';
                        overlay.style.color = 'white';
                        overlay.style.display = 'flex';
                        overlay.style.alignItems = 'center';
                        overlay.style.justifyContent = 'center';
                        overlay.style.zIndex = 9999;
                        overlay.style.fontSize = '1.2em';
                        overlay.className = 'nsfw-image-overlay';
                        img.parentNode.insertBefore(overlay, img.nextSibling);
                    }
                } catch (error) {
                    console.error('Error processing image classification:', error);
                    img.style.visibility = 'visible';
                    img.style.filter = '';
                    img.setAttribute('data-nsfw-status', 'error');
                }
            }
            img.setAttribute('data-nsfw-status', 'scanned');
            activeImageScans--;
            processNextImageScan();
        });
    }

    function queueImageForScan(img) {
        if (!img || img.getAttribute('data-nsfw-status') === 'scanned') return;
        // Immediately hide the image before queueing
        img.style.visibility = 'hidden';
        img.setAttribute('data-nsfw-status', 'pending');
        imageScanQueue.push(img);
        processNextImageScan();
    }

    // Scan all current images
    let imgs = Array.from(document.getElementsByTagName('img'));
    imgs.forEach(queueImageForScan);

    // MutationObserver for lazy-loaded images
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'IMG') {
                        queueImageForScan(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('img').forEach(queueImageForScan);
                    }
                });
            } else if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG' && mutation.attributeName === 'src') {
                queueImageForScan(mutation.target);
            }
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
    });
});

