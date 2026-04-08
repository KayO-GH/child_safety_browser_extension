# Changelog

All notable changes to the Child Safety Browser Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Parental controls dashboard with settings
- Whitelist/blacklist URL management
- Password protection for settings
- Activity logs and reporting
- Loading indicators for model initialization
- Better handling of dynamically loaded images
- Multiple user profiles
- Browser settings sync

---

## [0.1.0] - 2026-04-08

### Added - Initial Release

#### Core Features
- **Text Classification**: Detect toxic/inappropriate text using `Xenova/toxic-bert` model
- **Image Classification**: Detect NSFW images using `AdamCodd/vit-base-nsfw-detector` model
- **Real-time Content Filtering**: Automatically scan and filter web page content
- **Context Menu Integration**: Right-click to classify selected text

#### Performance Optimizations
- **WebGPU Support**: Automatic GPU acceleration with WASM fallback
- **Two-tier Caching**: 
  - In-memory LRU cache (200 text, 100 image entries)
  - IndexedDB persistent cache (7-day TTL, 1000 entries per type)
- **Model Preloading**: Load models on extension install/startup
- **Request Throttling**: Queue-based system limiting concurrent operations
- **Performance Monitoring**: Track cache hit rates and processing times

#### User Interface
- **Extension Popup**: Dashboard showing model status and statistics
- **Manual Testing**: Text input for testing classification
- **Cache Management**: Buttons to refresh stats and clear caches
- **Visual Feedback**: Blocked image overlays with confidence scores

#### Technical Infrastructure
- Chrome Manifest V3 support
- Service worker background script
- Content script injection at `document_start`
- IndexedDB for persistent storage
- Comprehensive error handling and logging

### Technical Details
- Models: ~500MB total download
- Text threshold: 80% confidence to block
- Image threshold: 50% confidence to block
- Max concurrent classifications: 2 per type
- Image size limit: 50MB
- Classification timeout: 15 seconds

### Documentation
- Comprehensive README.md with setup instructions
- PROGRESS.md tracking features and roadmap
- ARCHITECTURE.md explaining technical design
- CONTRIBUTING.md for contributor guidelines
- AGENTS.md for development agent modes
- QUICK_REFERENCE.md for configuration lookup

---

## [0.0.1] - Initial Development

### Added
- Basic extension scaffold from Transformers.js example
- Initial text and image classification implementation
- Basic popup UI
- Webpack build configuration

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-04-08 | Initial release with full feature set |
| 0.0.1 | - | Initial development |

---

## Upgrade Notes

### From 0.0.1 to 0.1.0
This is the first production-ready release. If you were using 0.0.1:

**Breaking Changes**:
- Extension name changed from "extension" to "Child Safety Extension"
- Package name changed to "child-safety-browser-extension"
- Model initialization is now asynchronous (preloading on startup)

**Migration Steps**:
1. Uninstall old version from `chrome://extensions/`
2. Run `npm install` to update dependencies
3. Run `npm run build` to rebuild
4. Load new version as unpacked extension
5. Models will download on first use (~500MB)

**What's New**:
- Much faster performance with caching
- WebGPU acceleration (2-3x faster on supported browsers)
- Better error handling and graceful degradation
- Performance statistics and monitoring
- Improved UI with better user feedback

---

## Future Versions

### [0.2.0] - Planned
- Parental controls dashboard
- Settings persistence with chrome.storage.sync
- Whitelist/blacklist functionality
- Password protection
- Enhanced UI/UX

### [0.3.0] - Planned
- Additional classification models
- Batch image processing
- Web Worker integration
- Model quantization for smaller sizes

### [1.0.0] - Planned
- Stable API
- Full test coverage
- Production-ready for public distribution
- Chrome Web Store publication

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to this changelog and the project.

---

**Last Updated**: April 8, 2026
