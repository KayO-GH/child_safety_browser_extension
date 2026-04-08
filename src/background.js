// background.js - Handles requests from the UI, runs the model, then sends back a response

import { pipeline, env } from '@huggingface/transformers';

// Skip initial check for local models, since we are not loading any local models.
env.allowLocalModels = false;

// ============ WebGPU Configuration ============
// Enable WebGPU backend for better performance with fallback to WASM
async function configureBackend() {
    // Check if we're in a service worker context
    const isServiceWorker = typeof ServiceWorkerGlobalScope !== 'undefined' && 
                           self instanceof ServiceWorkerGlobalScope;
    
    if (isServiceWorker) {
        console.log('Service worker detected, using WASM backend (WebGPU not supported in service workers)');
        // Due to a bug in onnxruntime-web, we must disable multithreading for WASM.
        // See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
        env.backends.onnx.wasm.numThreads = 1;
        env.backends.onnx.wasm.proxy = false;
        return 'wasm';
    }
    
    try {
        // Check if WebGPU is available (only in non-service worker contexts)
        if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                console.log('WebGPU is available, enabling WebGPU backend');
                env.backends.onnx.wasm.proxy = false;
                // WebGPU doesn't have the multithreading bug, so we can enable it
                env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
                return 'webgpu';
            }
        }
    } catch (error) {
        console.warn('WebGPU not available, falling back to WASM:', error);
    }
    
    // Fallback to WASM
    // Due to a bug in onnxruntime-web, we must disable multithreading for WASM.
    // See https://github.com/microsoft/onnxruntime/issues/14445 for more information.
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    return 'wasm';
}

// Initialize backend configuration
let backendType = 'wasm';
configureBackend().then(type => {
    backendType = type;
    console.log(`Using backend: ${backendType}`);
});

// ============ Caching System ============

// LRU Cache implementation for in-memory caching
class LRUCache {
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        // Delete if exists to update position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        // Add to end
        this.cache.set(key, value);
        // Evict oldest if over capacity
        if (this.cache.size > this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    has(key) {
        return this.cache.has(key);
    }

    clear() {
        this.cache.clear();
    }
}

// Create cache instances
const textClassificationCache = new LRUCache(200);
const imageClassificationCache = new LRUCache(100);

// IndexedDB persistent cache
const DB_NAME = 'nsfw_classification_cache';
const DB_VERSION = 1;
const TEXT_STORE = 'text_classifications';
const IMAGE_STORE = 'image_classifications';

let db = null;

// Initialize IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(TEXT_STORE)) {
                const textStore = db.createObjectStore(TEXT_STORE, { keyPath: 'hash' });
                textStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
            
            if (!db.objectStoreNames.contains(IMAGE_STORE)) {
                const imageStore = db.createObjectStore(IMAGE_STORE, { keyPath: 'url' });
                imageStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

// Simple hash function for text
function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
}

// Get from IndexedDB
async function getFromDB(storeName, key) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        
        request.onsuccess = () => {
            const result = request.result;
            // Check if cache entry is still valid (7 days)
            if (result && (Date.now() - result.timestamp < 7 * 24 * 60 * 60 * 1000)) {
                resolve(result.data);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => resolve(null); // Fail silently
    });
}

// Save to IndexedDB
async function saveToDB(storeName, key, data) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put({
            [storeName === TEXT_STORE ? 'hash' : 'url']: key,
            data: data,
            timestamp: Date.now()
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Fail silently
    });
}

// Clean old cache entries (keep last 1000 entries per store)
async function cleanOldCacheEntries() {
    if (!db) return;
    
    for (const storeName of [TEXT_STORE, IMAGE_STORE]) {
        try {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev');
            
            let count = 0;
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    count++;
                    if (count > 1000) {
                        cursor.delete();
                    }
                    cursor.continue();
                }
            };
        } catch (error) {
            console.warn('Error cleaning cache:', error);
        }
    }
}

// Initialize DB on startup
initDB().then(() => {
    console.log('IndexedDB cache initialized');
    // Clean old entries periodically
    cleanOldCacheEntries();
    setInterval(cleanOldCacheEntries, 60 * 60 * 1000); // Every hour
}).catch(err => {
    console.warn('IndexedDB initialization failed, will use memory cache only:', err);
});


// ============ Model Pipeline Singletons ============

class TextPipelineSingleton {
    static task = 'text-classification';
    static model = 'Xenova/toxic-bert'; // Public model for toxic/inappropriate content detection
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            console.log('Loading text classification model...');
            // pipeline() is now async in v4
            // Use device auto-detection with WebGPU preference
            const options = { 
                progress_callback,
                // Use WebGPU if available, otherwise WASM
                device: backendType === 'webgpu' ? 'webgpu' : 'wasm',
            };
            this.instance = await pipeline(this.task, this.model, options);
            console.log('Text classification model loaded successfully');
        }
        return this.instance;
    }
}


class ImagePipelineSingleton {
    static task = 'image-classification';
    static model = 'AdamCodd/vit-base-nsfw-detector';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            console.log('Loading image classification model...');
            // pipeline() is now async in v4
            // Use device auto-detection with WebGPU preference
            const options = { 
                progress_callback,
                // Use WebGPU if available, otherwise WASM
                device: backendType === 'webgpu' ? 'webgpu' : 'wasm',
            };
            this.instance = await pipeline(this.task, this.model, options);
            console.log('Image classification model loaded successfully');
        }
        return this.instance;
    }
}

// ============ Classification Functions ============

// Create generic classify function with caching
const classify = async (text) => {
    // Generate cache key
    const cacheKey = hashText(text.substring(0, 1000)); // Hash first 1000 chars
    
    // Check in-memory cache first
    let cached = textClassificationCache.get(cacheKey);
    if (cached) {
        console.log('Text classification cache hit (memory)');
        performanceStats.textClassifications.cached++;
        return cached;
    }
    
    // Check IndexedDB cache
    cached = await getFromDB(TEXT_STORE, cacheKey);
    if (cached) {
        console.log('Text classification cache hit (IndexedDB)');
        performanceStats.textClassifications.cached++;
        textClassificationCache.set(cacheKey, cached);
        return cached;
    }
    
    // Get the pipeline instance. This will load and build the model when run for the first time.
    let model = await TextPipelineSingleton.getInstance((data) => {
        // You can track the progress of the pipeline creation here.
        // e.g., you can send `data` back to the UI to indicate a progress bar
        // console.log('progress', data)
    });

    // Actually run the model on the input text
    let result = await model(text);
    
    // Cache the result
    textClassificationCache.set(cacheKey, result);
    saveToDB(TEXT_STORE, cacheKey, result).catch(err => 
        console.warn('Failed to save to IndexedDB:', err)
    );
    
    return result;
};

// Create classifyImage function with caching
const classifyImage = async (url) => {
    // Check in-memory cache first
    let cached = imageClassificationCache.get(url);
    if (cached) {
        console.log('Image classification cache hit (memory)');
        performanceStats.imageClassifications.cached++;
        return cached;
    }
    
    // Check IndexedDB cache
    cached = await getFromDB(IMAGE_STORE, url);
    if (cached) {
        console.log('Image classification cache hit (IndexedDB)');
        performanceStats.imageClassifications.cached++;
        imageClassificationCache.set(url, cached);
        return cached;
    }
    
    let classificationResults = null;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load image');

        const blob = await response.blob();
        
        // More efficient image processing using ImageBitmap
        const imageBitmap = await createImageBitmap(blob);

        // Create an offscreen canvas for image processing
        const offscreenCanvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
        const ctx = offscreenCanvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0);

        // Convert the canvas to a Blob and then to a data URL
        const blobURL = await offscreenCanvas.convertToBlob().then(blob => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        });

        // Get the pipeline instance. This will load and build the model when run for the first time.
        let model = await ImagePipelineSingleton.getInstance((data) => {
            // You can track the progress of the pipeline creation here.
            // e.g., you can send `data` back to the UI to indicate a progress bar
            // console.log('progress', data)
        });
        
        classificationResults = await model([blobURL]); // Classify the image
        console.log('Predicted class: ', classificationResults[0].label);
        
        // Cache the successful result
        imageClassificationCache.set(url, classificationResults);
        saveToDB(IMAGE_STORE, url, classificationResults).catch(err => 
            console.warn('Failed to save to IndexedDB:', err)
        );
        
        return classificationResults;
    } catch (error) {
        console.error('Error classifying image:', error);
        classificationResults = {"error": error.message};
    } finally {
        return classificationResults;
    }

};

////////////////////// 0. Preload Models //////////////////////
// Preload models on installation and startup for faster first use
async function preloadModels() {
    console.log('Preloading models...');
    try {
        // Wait for backend configuration to complete
        await configureBackend();
        
        // Preload both models in parallel
        await Promise.all([
            TextPipelineSingleton.getInstance((data) => {
                console.log('Text model loading progress:', data);
            }),
            ImagePipelineSingleton.getInstance((data) => {
                console.log('Image model loading progress:', data);
            })
        ]);
        console.log(`Models preloaded successfully using ${backendType} backend!`);
    } catch (error) {
        console.error('Error preloading models:', error);
    }
}

// Cache management functions
async function clearAllCaches() {
    textClassificationCache.clear();
    imageClassificationCache.clear();
    
    if (db) {
        try {
            const transaction = db.transaction([TEXT_STORE, IMAGE_STORE], 'readwrite');
            await Promise.all([
                transaction.objectStore(TEXT_STORE).clear(),
                transaction.objectStore(IMAGE_STORE).clear()
            ]);
            console.log('All caches cleared');
        } catch (error) {
            console.warn('Error clearing IndexedDB caches:', error);
        }
    }
}

// Performance monitoring
const performanceStats = {
    textClassifications: { total: 0, cached: 0, totalTime: 0 },
    imageClassifications: { total: 0, cached: 0, totalTime: 0 }
};

function logPerformanceStats() {
    console.log('=== Performance Statistics ===');
    console.log('Text Classifications:', {
        total: performanceStats.textClassifications.total,
        cached: performanceStats.textClassifications.cached,
        cacheHitRate: (performanceStats.textClassifications.cached / performanceStats.textClassifications.total * 100).toFixed(2) + '%',
        avgTime: (performanceStats.textClassifications.totalTime / performanceStats.textClassifications.total).toFixed(2) + 'ms'
    });
    console.log('Image Classifications:', {
        total: performanceStats.imageClassifications.total,
        cached: performanceStats.imageClassifications.cached,
        cacheHitRate: (performanceStats.imageClassifications.cached / performanceStats.imageClassifications.total * 100).toFixed(2) + '%',
        avgTime: (performanceStats.imageClassifications.totalTime / performanceStats.imageClassifications.total).toFixed(2) + 'ms'
    });
    console.log(`Backend: ${backendType}`);
}

////////////////////// 1. Context Menus //////////////////////
//
// Add a listener to create the initial context menu items,
// context menu items only need to be created at runtime.onInstalled
chrome.runtime.onInstalled.addListener(function () {
    // Register a context menu item that will only show up for selection text.
    chrome.contextMenus.create({
        id: 'classify-selection',
        title: 'Classify "%s"',
        contexts: ['selection'],
    });
    
    // Preload models for faster first use
    preloadModels();
    
    // Log performance stats every 5 minutes
    setInterval(logPerformanceStats, 5 * 60 * 1000);
});

// Also preload models when browser starts
chrome.runtime.onStartup.addListener(function () {
    preloadModels();
    
    // Log performance stats every 5 minutes
    setInterval(logPerformanceStats, 5 * 60 * 1000);
});

// Perform inference when the user clicks a context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    // Ignore context menu clicks that are not for classifications (or when there is no input)
    if (info.menuItemId !== 'classify-selection' || !info.selectionText) return;

    // Perform classification on the selected text
    let result = await classify(info.selectionText);

    // Do something with the result
    chrome.scripting.executeScript({
        target: { tabId: tab.id },    // Run in the tab that the user clicked in
        args: [result],               // The arguments to pass to the function
        function: (result) => {       // The function to run
            // NOTE: This function is run in the context of the web page, meaning that `document` is available.
            console.log('result', result)
            console.log('document', document)
        },
    });
});
//////////////////////////////////////////////////////////////

////////////////////// 2. Message Events /////////////////////
// 
// Listen for messages from the UI, process it, and send the result back.
// --- Throttling for image classification requests ---
const MAX_CONCURRENT_IMAGE_JOBS = 2; // Tune this for your performance
let imageJobQueue = [];
let activeImageJobs = 0;

function processNextImageJob() {
    if (imageJobQueue.length === 0 || activeImageJobs >= MAX_CONCURRENT_IMAGE_JOBS) return;
    const { message, sendResponse, startTime } = imageJobQueue.shift();
    activeImageJobs++;
    (async function () {
        try {
            let result = await classifyImage(message.img_src);
            const endTime = performance.now();
            
            // Update performance stats
            performanceStats.imageClassifications.total++;
            performanceStats.imageClassifications.totalTime += (endTime - startTime);
            
            sendResponse(result);
        } catch (error) {
            console.error('Image classification error:', error);
            sendResponse({ error: error.message });
        } finally {
            activeImageJobs--;
            processNextImageJob();
        }
    })();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('sender', sender)

    let responded = false;
    const safeSendResponse = (resp) => {
        if (!responded) {
            responded = true;
            sendResponse(resp);
        }
    };

    if (message.action === 'checkModelsReady') {
        try {
            const ready = TextPipelineSingleton.instance !== null && ImagePipelineSingleton.instance !== null;
            safeSendResponse({ ready, backend: backendType });
        } catch (error) {
            safeSendResponse({ error: error.message });
        }
        return true;
    } else if (message.action === 'classify') {
        (async function () {
            const startTime = performance.now();
            try {
                let result = await classify(message.text);
                const endTime = performance.now();
                
                // Update performance stats
                performanceStats.textClassifications.total++;
                performanceStats.textClassifications.totalTime += (endTime - startTime);
                
                safeSendResponse(result);
            } catch (error) {
                console.error('Text classification error:', error);
                safeSendResponse({ error: error.message });
            }
        })();
        return true;
    } else if (message.action === 'classifyImage') {
        // Throttle image jobs with performance tracking
        imageJobQueue.push({ 
            message, 
            sendResponse: safeSendResponse,
            startTime: performance.now()
        });
        processNextImageJob();
        // Set a timeout in case the job never completes (service worker may be suspended)
        setTimeout(() => {
            safeSendResponse({ error: 'Image classification timed out' });
        }, 15000); // 15 seconds timeout
        return true;
    } else if (message.action === 'clearCache') {
        // New action to clear all caches
        (async function () {
            try {
                await clearAllCaches();
                safeSendResponse({ success: true });
            } catch (error) {
                safeSendResponse({ error: error.message });
            }
        })();
        return true;
    } else if (message.action === 'getPerformanceStats') {
        // New action to get performance statistics
        safeSendResponse({
            stats: performanceStats,
            backend: backendType
        });
        return true;
    } else {
        // Ignore messages that are not meant for classification.
        safeSendResponse({ error: 'Unknown action' });
        return false;
    }
});
//////////////////////////////////////////////////////////////

