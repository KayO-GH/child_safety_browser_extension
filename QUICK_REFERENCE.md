# Quick Reference Guide

Fast lookup for key configuration values, constants, and common tasks.

---

## 🔧 Configuration Values

### Classification Thresholds

**Text Classification** (`background.js` & `content.js`):
```javascript
// Block if toxic AND confidence > 80%
if (response[0]['score'] > 0.8) {
    NSFW_detected = true;
}
```

**Image Classification** (`content.js`):
```javascript
// Block if NSFW AND confidence > 50%
const NSFW_THRESHOLD = 0.5;
const isSafe = (response[0]['label'] === 'sfw') || (response[0]['score'] < NSFW_THRESHOLD);
```

---

### Cache Configuration

**In-Memory Cache** (`background.js`):
```javascript
const textClassificationCache = new LRUCache(200);   // 200 text entries
const imageClassificationCache = new LRUCache(100);  // 100 image entries
```

**IndexedDB Persistent Cache** (`background.js`):
```javascript
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;  // 7 days
const MAX_PERSISTENT_ENTRIES = 1000;         // Per store (text/image)
```

**Cleanup Interval**:
```javascript
setInterval(cleanOldCacheEntries, 60 * 60 * 1000);  // Every hour
```

---

### Request Throttling

**Content Script** (`content.js`):
```javascript
const MAX_CONCURRENT_IMAGE_SCANS = 2;  // Max parallel image scans per page
```

**Background Script** (`background.js`):
```javascript
const MAX_CONCURRENT_IMAGE_JOBS = 2;   // Max parallel model inferences
```

**Timeout**:
```javascript
setTimeout(() => {
    safeSendResponse({ error: 'Image classification timed out' });
}, 15000);  // 15 seconds
```

---

### Image Validation

**Size Limits** (`background.js`):
```javascript
if (blob.size === 0) throw new Error('Empty image');
if (blob.size > 50 * 1024 * 1024) throw new Error('Image too large');  // 50MB max
```

**Content Type**:
```javascript
const contentType = response.headers.get('content-type');
if (contentType && !contentType.startsWith('image/')) {
    throw new Error('Invalid content type');
}
```

---

### Model Configuration

**Text Model** (`background.js`):
```javascript
class TextPipelineSingleton {
    static task = 'text-classification';
    static model = 'Xenova/toxic-bert';
    static instance = null;
}
```

**Image Model** (`background.js`):
```javascript
class ImagePipelineSingleton {
    static task = 'image-classification';
    static model = 'AdamCodd/vit-base-nsfw-detector';
    static instance = null;
}
```

**Backend Selection**:
```javascript
// Service workers use WASM (WebGPU not supported)
// Other contexts prefer WebGPU, fallback to WASM
device: backendType === 'webgpu' ? 'webgpu' : 'wasm'
```

---

### WASM Configuration

**Thread Settings** (`background.js`):
```javascript
// Bug workaround: disable threads in WASM
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
```

---

## 📋 Common Tasks

### Adding a New Model

1. **Define Pipeline Singleton** (`background.js`):
```javascript
class NewModelPipelineSingleton {
    static task = 'your-task';
    static model = 'model-name';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            const options = { 
                progress_callback,
                device: backendType
            };
            this.instance = await pipeline(this.task, this.model, options);
        }
        return this.instance;
    }
}
```

2. **Create Classification Function**:
```javascript
const classifyNewTask = async (input) => {
    // Add caching logic
    let model = await NewModelPipelineSingleton.getInstance();
    let result = await model(input);
    return result;
};
```

3. **Add Message Handler**:
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'classifyNewTask') {
        (async function () {
            const result = await classifyNewTask(message.data);
            sendResponse(result);
        })();
        return true;
    }
});
```

4. **Preload in Startup**:
```javascript
async function preloadModels() {
    await Promise.all([
        TextPipelineSingleton.getInstance(),
        ImagePipelineSingleton.getInstance(),
        NewModelPipelineSingleton.getInstance()  // Add here
    ]);
}
```

---

### Adjusting Sensitivity

**Make More Restrictive** (block more content):
```javascript
// Lower threshold = block more
const NSFW_THRESHOLD = 0.3;  // Was 0.5 (block at 30% instead of 50%)
```

**Make Less Restrictive** (block less content):
```javascript
// Higher threshold = block less
const NSFW_THRESHOLD = 0.7;  // Was 0.5 (block at 70% instead of 50%)
```

---

### Testing Classification Manually

**Via Popup**:
1. Click extension icon
2. Type text in input box
3. View JSON result

**Via Console** (`content.js`):
```javascript
chrome.runtime.sendMessage({
    action: 'classify',
    text: 'Your test text here'
}, (response) => {
    console.log('Result:', response);
});
```

**Via Context Menu**:
1. Select text on any page
2. Right-click → "Classify [text]"
3. Check console for results

---

### Clearing Cache

**Via Popup**:
1. Click "Clear Cache" button
2. Confirm dialog
3. Reload extension

**Via Code** (`background.js`):
```javascript
chrome.runtime.sendMessage({ action: 'clearCache' }, (response) => {
    console.log('Cache cleared:', response.success);
});
```

**Manually**:
```javascript
// Clear in-memory caches
textClassificationCache.clear();
imageClassificationCache.clear();

// Clear IndexedDB
indexedDB.deleteDatabase('nsfw_classification_cache');
```

---

### Viewing Performance Stats

**Via Popup**:
1. Click "Refresh Stats" button
2. View cache hit rates, avg times

**Via Console** (`popup.js`):
```javascript
chrome.runtime.sendMessage({ action: 'getPerformanceStats' }, (stats) => {
    console.log('Stats:', stats);
});
```

---

## 🔍 Debugging

### Enable Verbose Logging

**Backend Configuration** (`background.js`):
```javascript
configureBackend().then(type => {
    backendType = type;
    console.log(`Using backend: ${backendType}`);
    console.log('WebGPU available:', type === 'webgpu');
});
```

**Model Loading** (`background.js`):
```javascript
const model = await TextPipelineSingleton.getInstance((data) => {
    console.log('Model loading progress:', data);
});
```

**Classification Results** (`background.js`):
```javascript
console.log('=== Image Classification Results ===');
console.log('Image URL:', url);
console.log('Full results:', JSON.stringify(classificationResults, null, 2));
console.log('Top prediction:', classificationResults[0].label);
```

---

### Common Error Messages

**"Models not ready yet"**:
- Models still downloading/loading
- Wait 30-60 seconds after install
- Check console for loading progress

**"Failed to load image"**:
- Image URL inaccessible
- CORS restrictions
- Invalid image format
- Exceeds 50MB size limit

**"Image classification timed out"**:
- Image too large or slow network
- Increase timeout in `background.js`
- Currently 15 seconds

**"WebGPU not available"**:
- Expected in service workers
- Falls back to WASM automatically
- No action needed

---

## 📊 Performance Optimization

### Reduce Memory Usage

1. **Lower cache sizes**:
```javascript
const textClassificationCache = new LRUCache(100);  // Was 200
const imageClassificationCache = new LRUCache(50);   // Was 100
```

2. **Reduce persistent cache**:
```javascript
const MAX_PERSISTENT_ENTRIES = 500;  // Was 1000
```

3. **Shorter TTL**:
```javascript
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000;  // 3 days instead of 7
```

---

### Improve Response Time

1. **Increase concurrent requests**:
```javascript
const MAX_CONCURRENT_IMAGE_JOBS = 4;  // Was 2 (requires more memory)
```

2. **Prefer WebGPU**:
- Ensure browser supports WebGPU
- Check: `chrome://gpu/`
- 2-3x faster than WASM

3. **Preload models**:
- Already implemented on install/startup
- Models ready instantly when needed

---

## 🗂️ File Locations

### Source Files
- **Background script**: `src/background.js` (~650 lines)
- **Content script**: `src/content.js` (~150 lines)
- **Popup UI**: `src/popup.html`, `src/popup.js`, `src/popup.css`
- **Manifest**: `public/manifest.json`

### Build Output
- **Extension**: `build/` directory
- **Background**: `build/background.js`
- **Content**: `build/content.js`
- **Popup**: `build/popup.html`, `build/popup.js`
- **Manifest**: `build/manifest.json`

### Documentation
- **README**: `README.md`
- **Progress**: `PROGRESS.md`
- **Architecture**: `ARCHITECTURE.md`
- **Contributing**: `CONTRIBUTING.md`
- **Agents**: `AGENTS.md`
- **This file**: `QUICK_REFERENCE.md`

---

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Build once
npm run build

# Build with auto-reload
npm run dev

# Load extension
# 1. chrome://extensions/
# 2. Enable Developer mode
# 3. Load unpacked → select build/

# Reload after code changes
# 1. chrome://extensions/
# 2. Click refresh icon on extension
# 3. Reload web pages to see content script changes
```

---

## 📞 Quick Links

- **GitHub**: https://github.com/KayO-GH/child_safety_browser_extension
- **Transformers.js**: https://github.com/huggingface/transformers.js
- **Text Model**: https://huggingface.co/Xenova/toxic-bert
- **Image Model**: https://huggingface.co/AdamCodd/vit-base-nsfw-detector
- **Chrome Extensions**: https://developer.chrome.com/docs/extensions/

---

**Last Updated**: April 8, 2026
