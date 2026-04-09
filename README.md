
# Child Safety Browser Extension 🛡️

**Privacy-first child safety using on-device AI** - No cloud, no tracking, no data collection.

A browser extension that uses machine learning models running locally in your browser to detect and filter NSFW/toxic content in real-time, protecting children while preserving privacy.

Built with [Transformers.js](https://github.com/xenova/transformers.js) v4.0+ and Chrome Manifest V3.

---

## ✨ Features

### 🔒 Privacy First
- All AI processing happens **locally in your browser**
- No data sent to external servers
- No tracking or analytics
- Complete offline functionality once models are downloaded

### 🧠 Dual AI Detection
- **Text Classification**: Detects toxic, offensive, and inappropriate text using the `Xenova/toxic-bert` model
- **Image Classification**: Identifies NSFW images using the `AdamCodd/vit-base-nsfw-detector` Vision Transformer model

### ⚡ Performance Optimized
- **WebGPU Acceleration**: Uses GPU when available, falls back to WASM
- **Two-Tier Caching**: In-memory + IndexedDB for fast repeat classifications
- **Model Preloading**: Models load on installation for instant usage
- **Smart Throttling**: Queue system prevents overwhelming the browser

### 🎯 Real-Time Protection
- Automatically scans all web pages as they load
- Hides inappropriate images with visual overlays
- Blocks pages with high toxic text content
- Context menu for on-demand classification of selected text

### 📊 Monitoring Dashboard
- View backend status (WebGPU vs WASM)
- Track classification statistics
- Monitor cache performance
- Clear cache and view detailed metrics

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 14+ and npm
- **Chrome** or **Edge** browser (Manifest V3 compatible)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KayO-GH/child_safety_browser_extension.git
   cd child_safety_browser_extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in browser**
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable **Developer mode** (toggle in top-right)
   - Click **"Load unpacked"**
   - Select the `build` directory from this project
   - Click **"Select Folder"**

5. **Done!** 🎉
   - The extension icon should appear in your browser toolbar
   - Models will download on first use (~500MB total)
   - Visit any website to see the extension in action

---

## 🛠️ Development

### Development Mode
Run with auto-rebuild on file changes:
```bash
npm run dev
```

### Project Structure

```
child_safety_browser_extension/
├── src/
│   ├── background.js      # Service worker - ML pipeline, caching, API
│   ├── content.js         # Content script - injected into all pages
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styling
│   └── popup.js           # Popup logic and stats display
├── public/
│   ├── manifest.json      # Extension manifest (Manifest V3)
│   └── icons/             # Extension icons
├── build/                 # Built extension (created by webpack)
├── webpack.config.js      # Build configuration
├── package.json           # Dependencies and scripts
├── README.md              # This file
├── PROGRESS.md            # Detailed progress tracking
└── AGENTS.md              # Agent mode configurations
```

### Key Files Explained

#### `background.js` (~650 lines)
The brain of the extension - runs as a service worker:
- Loads and manages ML models (text & image classification)
- Implements two-tier caching system (LRU + IndexedDB)
- Handles WebGPU/WASM backend configuration
- Processes classification requests from content script
- Manages performance monitoring and statistics

#### `content.js` (~150 lines)
Injected into every webpage:
- Hides images by default until classified
- Sends classification requests to background script
- Shows/hides content based on classification results
- Adds visual overlays to blocked NSFW images
- Implements client-side request throttling

#### `popup.js` (~100 lines)
Extension popup interface:
- Displays model status and backend information
- Shows real-time performance statistics
- Provides manual text classification testing
- Offers cache management controls

### After Making Changes

**Background Script Changes**:
- Go to `chrome://extensions/`
- Click the refresh icon on your extension
- (Changes to service worker require extension reload)

**Content Script Changes**:
- Refresh icon on extension
- Reload any open web pages

**Popup Changes**:
- Simply close and reopen the popup
- Or open popup in standalone tab: `chrome-extension://<ext_id>/popup.html`

---

## 🎮 Usage

### Automatic Protection
The extension works automatically once installed:
- ✅ All images are scanned before being displayed
- ✅ Page text is analyzed for toxic content
- ✅ NSFW content is blocked with visual indicators

### Manual Classification
1. **Select text** on any webpage
2. **Right-click** → **"Classify [selected text]"**
3. View results in browser console

### Dashboard
1. Click the extension icon in toolbar
2. View model status and backend type
3. See classification statistics
4. Test text classification manually
5. Clear cache if needed

---

## 🔧 Configuration

### Adjusting Confidence Thresholds

Edit in [src/background.js](src/background.js) and [src/content.js](src/content.js):

```javascript
// Text classification threshold (currently 80%)
if (response[0]['score'] > 0.8) {
    // Block content
}

// Image classification threshold (currently 50%)
const NSFW_THRESHOLD = 0.5;
```

### Cache Configuration

Edit in [src/background.js](src/background.js):

```javascript
// In-memory cache sizes
const textClassificationCache = new LRUCache(200);  // 200 entries
const imageClassificationCache = new LRUCache(100);  // 100 entries

// IndexedDB persistent cache
const MAX_PERSISTENT_ENTRIES = 1000;  // Per store
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;  // 7 days
```

### Concurrent Request Limits

```javascript
// In content.js
const MAX_CONCURRENT_IMAGE_SCANS = 2;

// In background.js
const MAX_CONCURRENT_IMAGE_JOBS = 2;
```

---

## 📊 Performance

### Typical Metrics
- **First-time Model Load**: 30-60 seconds (one-time download)
- **Text Classification**: 100-300ms (uncached) → 5ms (cached)
- **Image Classification**: 200-500ms (uncached) → 5ms (cached)
- **Cache Hit Rate**: 60-80% after initial browsing
- **Memory Usage**: ~300-500MB (includes models)

### Backend Performance
- **WebGPU**: 2-3x faster than WASM (when available)
- **WASM**: Available in all Chromium browsers
- Automatic fallback if WebGPU unavailable

---

## 🤖 Models Used

### Text Classification
**Model**: [`Xenova/toxic-bert`](https://huggingface.co/Xenova/toxic-bert)
- **Task**: Binary classification (SFW vs Toxic)
- **Architecture**: BERT-based transformer
- **Size**: ~400MB
- **Strengths**: Proven accuracy on toxic content detection

### Image Classification
**Model**: [`AdamCodd/vit-base-nsfw-detector`](https://huggingface.co/AdamCodd/vit-base-nsfw-detector)
- **Task**: Binary classification (SFW vs NSFW)
- **Architecture**: Vision Transformer (ViT)
- **Size**: ~100MB
- **Strengths**: High accuracy on diverse image types

---

## 🐛 Known Issues

- Images may briefly flash before being hidden (style injection timing)
- Large images (>50MB) are silently rejected
- Overlays on blocked images don't reposition on window resize
- WebGPU not supported in service workers (background script uses WASM)

See [PROGRESS.md](PROGRESS.md) for comprehensive issue tracking.

---

## 📋 Roadmap

### Coming Soon
- [ ] Parental controls dashboard with password protection
- [ ] **Firestore URL blacklist integration** - Cloud-based dangerous URL database with offline caching
- [ ] Whitelist/blacklist URL management with import from online threat lists
- [ ] Activity logs and reports
- [ ] Loading indicators and better user feedback
- [ ] Handle dynamically loaded images (infinite scroll, lazy loading)
- [ ] **Intelligent image processing** - Priority-based processing (large images first, smart icon handling)

### Future Enhancements
- [ ] **Video classification** - NSFW detection for video content and thumbnails
- [ ] Additional models (hate speech, violence detection)
- [ ] Multilingual support
- [ ] Multiple user profiles
- [ ] Browser sync for settings
- [ ] Performance optimizations (batch processing, Web Workers)

See [PROGRESS.md](PROGRESS.md) for detailed roadmap.

---

## 🤝 Contributing

Contributions welcome! Key areas:
- Testing across diverse websites and content types
- UI/UX improvements for child-friendly experiences
- Model evaluation and comparison
- Documentation and user guides
- Accessibility improvements

---

## 📄 License

MIT License - See [package.json](package.json)

---

## 🙏 Acknowledgments

- Built with [Transformers.js](https://github.com/xenova/transformers.js) by Xenova
- Models from [Hugging Face](https://huggingface.co/)
- Inspired by the need for privacy-preserving child safety tools

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/KayO-GH/child_safety_browser_extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KayO-GH/child_safety_browser_extension/discussions)

---

**⚠️ Important Note**: This extension is a proof-of-concept and should not be relied upon as the sole method of protecting children online. Parental supervision and education remain essential components of online safety.