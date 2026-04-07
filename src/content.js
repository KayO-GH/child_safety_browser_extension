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

    // --- UX improvement: Hide all images by default, reveal after scan ---
    let imgs = Array.from(document.getElementsByTagName('img'));
    for (let img of imgs) {
        // Hide image initially
        img.style.visibility = 'hidden';
        img.style.filter = 'blur(20px)';
        img.setAttribute('data-nsfw-status', 'pending');
    }

    for (let img of imgs) {
        let img_src = img.src;
        if (!img_src || img_src.trim() === '') continue;

        chrome.runtime.sendMessage({
            action: 'classifyImage',
            img_src: img_src,
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Child Safety Extension: Image classification failed for', img_src, chrome.runtime.lastError);
                // Show image if scan fails (graceful degradation)
                img.style.visibility = 'visible';
                img.style.filter = '';
                img.setAttribute('data-nsfw-status', 'error');
                return;
            }
            if (!response || !Array.isArray(response) || response.length === 0 || response.error) {
                console.warn('Child Safety Extension: Invalid image classification response', response);
                img.style.visibility = 'visible';
                img.style.filter = '';
                img.setAttribute('data-nsfw-status', 'error');
                return;
            }
            try {
                console.log('Image classification result for', img_src, ':', response);
                if (response[0]['label'] === 'sfw' || response[0]['label'] === 'SFW') {
                    // Reveal SFW image
                    img.style.visibility = 'visible';
                    img.style.filter = '';
                    img.setAttribute('data-nsfw-status', 'sfw');
                } else {
                    // Hide or overlay NSFW image
                    img.style.visibility = 'hidden';
                    img.style.filter = 'blur(20px)';
                    img.setAttribute('data-nsfw-status', 'nsfw');
                    // Optionally, overlay a warning
                    let overlay = document.createElement('div');
                    overlay.textContent = 'NSFW Image Blocked';
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
                console.warn('Child Safety Extension: Error processing image classification result', error);
                img.style.visibility = 'visible';
                img.style.filter = '';
                img.setAttribute('data-nsfw-status', 'error');
            }
        });
    }
});

