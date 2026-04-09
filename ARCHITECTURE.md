Hi Ria# Architecture Overview

## Child Safety Browser Extension

Technical architecture and design decisions for the child safety browser extension.

---

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Web Pages                          │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │    content.js (Content Script)             │    │   │
│  │  │    - Injected into all pages               │    │   │
│  │  │    - Scans images/text                     │    │   │
│  │  │    - Hides/shows content                   │    │   │
│  │  │    - Client-side throttling                │    │   │
│  │  └────┬─────────────────────────────────┬─────┘    │   │
│  │       │                                 │           │   │
│  │       │ chrome.runtime.sendMessage()    │           │   │
│  │       │                                 │           │   │
│  └───────┼─────────────────────────────────┼───────────┘   │
│          │                                 │               │
│          │                                 │               │
│  ┌───────▼─────────────────────────────────▼───────────┐   │
│  │    background.js (Service Worker)                   │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │   ML Pipeline                                │  │   │
│  │  │   - TextPipelineSingleton                    │  │   │
│  │  │   - ImagePipelineSingleton                   │  │   │
│  │  │   - Model loading & inference                │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │   Caching System                             │  │   │
│  │  │   - In-Memory LRU Cache                      │  │   │
│  │  │   - IndexedDB Persistent Cache               │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │   Request Queue & Throttling                 │  │   │
│  │  │   - Image job queue                          │  │   │
│  │  │   - Concurrent request limiting              │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                      │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │   Performance Monitoring                     │  │   │
│  │  │   - Stats tracking                           │  │   │
│  │  │   - Cache metrics                            │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
│                     │ chrome.runtime.sendMessage()          │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │    popup.html/js (Extension Popup)                   │   │
│  │    - Model status display                            │   │
│  │    - Performance stats                               │   │
│  │    - Manual classification testing                   │   │
│  │    - Cache management                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### 1. Content Script (`content.js`)
**Role**: Injected into every web page to monitor and filter content

**Responsibilities**:
- Hide images immediately on page load
- Extract text content from pages
- Send classification requests to background script
- Handle classification responses
- Show/hide content based on results
- Add visual overlays to blocked content
- Manage client-side request queue

**Key Features**:
- Runs at `document_start` for early injection
- Client-side throttling (max 2 concurrent image scans)
- Graceful degradation if models not ready
- Error handling with console warnings

**Communication**:
```javascript
// Send classification request
chrome.runtime.sendMessage({
    action: 'classify' | 'classifyImage',
    text?: string,
    img_src?: string
}, (response) => {
    // Handle response
});
```

---

### 2. Background Script (`background.js`)
**Role**: Service worker that handles ML processing and caching

**Responsibilities**:
- Load and manage ML models
- Process classification requests
- Implement caching strategies
- Monitor performance
- Handle context menu actions
- Manage model preloading

**Key Components**:

#### ML Pipeline Singletons
```javascript
class TextPipelineSingleton {
    static task = 'text-classification';
    static model = 'Xenova/toxic-bert';
    static instance = null;
    
    static async getInstance(progress_callback) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, {
                device: backendType,
                progress_callback
            });
        }
        return this.instance;
    }
}
```

#### Caching System
- **LRU Cache**: Fast in-memory cache for recent classifications
  - Text: 200 entries
  - Images: 100 entries
- **IndexedDB**: Persistent cache across sessions
  - 7-day TTL
  - 1000 entries per type
  - Automatic cleanup

#### Request Throttling
```javascript
const MAX_CONCURRENT_IMAGE_JOBS = 2;
let imageJobQueue = [];
let activeImageJobs = 0;

function processNextImageJob() {
    // Queue-based processing
}
```

---

### 3. Popup UI (`popup.html/js`)
**Role**: Extension popup for monitoring and control

**Features**:
- Model status (loading/ready)
- Backend type (WebGPU/WASM)
- Performance statistics
  - Total classifications
  - Cache hit rates
  - Average processing times
- Manual text classification testing
- Cache management (clear, refresh)

**UI Components**:
```html
<div id="backend-status">Backend: webgpu</div>
<div id="models-status">Models: Ready ✓</div>
<div id="stats-display">
    <!-- Performance stats -->
</div>
<button id="refresh-stats">Refresh Stats</button>
<button id="clear-cache">Clear Cache</button>
```

---

## 🧠 ML Model Architecture

### Text Classification Pipeline
```
Input Text
    ↓
Tokenization (BERT tokenizer)
    ↓
Model Inference (toxic-bert)
    ↓
Sigmoid Activation
    ↓
Output: [{label: "SFW" | "toxic", score: 0-1}]
```

**Model**: `Xenova/toxic-bert`
- Architecture: BERT-base (12 layers, 768 hidden)
- Parameters: ~110M
- Input: Text (max 512 tokens)
- Output: Binary classification with confidence

### Image Classification Pipeline
```
Input Image URL
    ↓
Fetch & Decode (ImageBitmap)
    ↓
Canvas Processing (OffscreenCanvas)
    ↓
Model Inference (ViT)
    ↓
Softmax Activation
    ↓
Output: [{label: "sfw" | "nsfw", score: 0-1}]
```

**Model**: `AdamCodd/vit-base-nsfw-detector`
- Architecture: Vision Transformer (12 layers)
- Parameters: ~86M
- Input: Images (224x224 after preprocessing)
- Output: Binary classification with confidence

---

## 🔄 Data Flow

### Text Classification Flow
```
1. Page loads
2. content.js extracts document.body.textContent
3. Sends to background.js via chrome.runtime.sendMessage()
4. background.js checks cache
   ├── Cache hit → Return cached result
   └── Cache miss → Run model inference
5. Result sent back to content.js
6. If NSFW detected (score > 0.8):
   └── Hide entire page + show alert
```

### Image Classification Flow
```
1. Image element detected in DOM
2. content.js adds to scan queue
3. When slot available (max 2 concurrent):
   ├── Hide image
   ├── Set visibility: hidden
   └── Send URL to background.js
4. background.js:
   ├── Check in-memory cache
   ├── Check IndexedDB cache
   └── If miss:
       ├── Fetch image
       ├── Validate (size, type, format)
       ├── Create ImageBitmap
       ├── Process with OffscreenCanvas
       ├── Run model inference
       └── Cache result
5. Result sent back to content.js
6. If safe (SFW or score < 0.5):
   ├── Show image
   └── Apply blur if confidence < 60%
7. If NSFW (score > 0.5):
   ├── Keep hidden
   └── Add blocked overlay
```

---

## 🚀 Performance Optimizations

### 1. Backend Selection
```javascript
async function configureBackend() {
    if (isServiceWorker) {
        // Service workers can't use WebGPU
        return 'wasm';
    }
    
    if (navigator.gpu) {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter) {
            return 'webgpu'; // 2-3x faster
        }
    }
    
    return 'wasm'; // Fallback
}
```

### 2. Caching Strategy
```
Request → In-Memory LRU Cache
              ↓ (miss)
          IndexedDB Cache
              ↓ (miss)
          Model Inference
              ↓
          Cache in both layers
```

**Benefits**:
- In-memory: ~5ms latency
- IndexedDB: ~20-50ms latency
- Model inference: ~100-500ms latency

### 3. Request Throttling
- **Client-side** (content.js): Queue images, max 2 concurrent
- **Server-side** (background.js): Queue jobs, max 2 concurrent
- Prevents overwhelming the browser
- Maintains responsiveness

### 4. Model Preloading
```javascript
chrome.runtime.onInstalled.addListener(() => {
    preloadModels(); // Load immediately after install
});

chrome.runtime.onStartup.addListener(() => {
    preloadModels(); // Load on browser startup
});
```

**Benefits**:
- Models ready instantly when needed
- No loading delay on first classification
- Better user experience

---

## 🔒 Security Considerations

### Input Validation
```javascript
// Image validation
if (blob.size === 0) throw new Error('Empty image');
if (blob.size > 50 * 1024 * 1024) throw new Error('Image too large');
if (!blob.type.startsWith('image/')) throw new Error('Invalid type');
```

### Content Security Policy
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' 'wasm-unsafe-eval'"
  }
}
```

- Allows WASM execution for ML models
- Prevents external script injection
- Restricts to extension resources only

### Permissions
```json
{
  "permissions": [
    "activeTab",        // Access current tab content
    "scripting",        // Inject content scripts
    "contextMenus",     // Right-click menu
    "storage",          // IndexedDB access
    "unlimitedStorage"  // Large model files
  ]
}
```

**Principle of Least Privilege**: Only request necessary permissions

---

## 📊 State Management

### Extension State
- **Models**: Singleton instances, lazy-loaded
- **Caches**: Persistent across sessions (IndexedDB)
- **Stats**: In-memory, reset on extension reload
- **Queue**: In-memory, cleared on extension reload

### Page State
- **Content Script**: Re-injected on page reload
- **Classification Results**: Stored in DOM attributes
  - `data-nsfw-status`: "pending" | "scanned" | "sfw" | "nsfw" | "error"

---

## 🔧 Error Handling

### Graceful Degradation
```javascript
// If models fail to load
if (chrome.runtime.lastError) {
    console.warn('Extension unavailable, showing all content');
    return; // Don't block content
}

// If classification fails
if (!response || response.error) {
    img.style.visibility = 'visible'; // Show image
}
```

**Philosophy**: Better to show content than false-block if extension fails

### Error Types
1. **Model Loading Errors**: Logged, extension continues with degraded functionality
2. **Network Errors**: Image fetch failures → show image
3. **Classification Errors**: Log error, show content
4. **Timeout Errors**: 15s timeout → show content

---

## 🧪 Testing Strategy

### Manual Testing
- Load extension in browser
- Visit various websites
- Check console logs
- Verify classifications
- Monitor performance stats

### Test Cases
1. **Safe content**: Should show without issues
2. **NSFW images**: Should block with overlay
3. **Toxic text**: Should hide page + alert
4. **Mixed content**: Should filter selectively
5. **Large images**: Should handle or reject gracefully
6. **Slow networks**: Should timeout appropriately
7. **Invalid images**: Should fail gracefully

### Performance Testing
- Monitor memory usage
- Check classification latency
- Verify cache hit rates
- Test concurrent request handling

---

## 🔮 Future Architecture Enhancements

### Planned Improvements
1. **Firestore URL Blacklist Integration**: 
   - Cloud-based dangerous URL database
   - Real-time sync from curated online lists
   - Offline-first architecture with local caching
   - Admin API for blacklist management
   
2. **Video Classification Pipeline**:
   - Frame extraction and sampling
   - Video thumbnail NSFW detection
   - Embedded video support (YouTube, Vimeo, etc.)
   - Live streaming content monitoring
   
3. **Intelligent Image Processing**:
   - **Priority queue**: Process larger images first (likely content), defer small images (likely icons)
   - **Smart icon detection**: Detect images below threshold (e.g., 50x50px) and apply blur-only (no overlay)
   - **Size-based strategy**: 
     - Large images (>200px): Full classification + overlay if NSFW
     - Medium images (50-200px): Standard classification
     - Small images (<50px): Blur-only, skip classification
   
4. **Web Workers**: Offload processing from main thread

5. **Model Quantization**: Reduce model sizes with int8/int4

6. **Batch Processing**: Process multiple images in one inference

7. **Smart Caching**: Cache based on domain reputation

8. **Settings Storage**: chrome.storage.sync for user preferences

### Scalability Considerations
- Consider moving to side panel API for richer UI
- Implement background page for persistent state
- Add telemetry (privacy-preserving) for model tuning
- Support multiple user profiles
- Firestore integration for cross-device blacklist sync

---

## 📚 Technology Stack

### Core Technologies
- **Transformers.js v4.0+**: Browser-native ML inference
- **ONNX Runtime Web**: Model execution engine
- **WebGPU**: GPU acceleration (when available)
- **WASM**: CPU-based inference fallback

### Browser APIs
- **Chrome Extension APIs**: Manifest V3
- **Service Workers**: Background processing
- **Content Scripts**: Page injection
- **IndexedDB**: Persistent storage
- **OffscreenCanvas**: Image processing

### Cloud Services (Planned)
- **Firebase Firestore**: Cloud-based URL blacklist database
- **Firestore Offline Persistence**: Local caching for offline access

### Build Tools
- **Webpack 5**: Module bundling
- **npm**: Package management

---

## 📖 References

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [WebGPU Specification](https://www.w3.org/TR/webgpu/)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

**Last Updated**: April 8, 2026
