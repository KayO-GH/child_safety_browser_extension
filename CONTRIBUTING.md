# Contributing to Child Safety Browser Extension

Thank you for your interest in contributing! This document provides guidelines and information for contributors.

---

## 🌟 Ways to Contribute

### 1. Testing & Feedback
- Test the extension on different websites
- Report classification accuracy issues
- Document false positives/negatives
- Share performance observations

### 2. Code Contributions
- Bug fixes
- Performance improvements
- New features
- Model improvements
- UI/UX enhancements

### 3. Documentation
- Improve README, PROGRESS, ARCHITECTURE docs
- Add code comments
- Create tutorials or guides
- Translate documentation

### 4. Research
- Evaluate alternative ML models
- Research better classification techniques
- Study child safety best practices
- Benchmark performance

---

## 🚀 Getting Started

### Prerequisites
- Node.js 14+ and npm
- Chrome or Edge browser
- Git
- Basic understanding of JavaScript and browser extensions

### Setup Development Environment

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/child_safety_browser_extension.git
   cd child_safety_browser_extension
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build Extension**
   ```bash
   npm run dev  # Auto-rebuilds on changes
   ```

4. **Load in Browser**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `build` directory

5. **Make Changes**
   - Edit files in `src/` directory
   - Extension rebuilds automatically
   - Reload extension in browser to see changes

---

## 📝 Development Guidelines

### Code Style
- Use clear, descriptive variable names
- Add comments for complex logic
- Follow existing code patterns
- Keep functions focused and small

### JavaScript Conventions
```javascript
// Use async/await for asynchronous operations
async function classifyText(text) {
    const result = await model(text);
    return result;
}

// Use clear error handling
try {
    const result = await classifyImage(url);
    handleResult(result);
} catch (error) {
    console.error('Classification failed:', error);
    showFallback();
}

// Use descriptive constants
const NSFW_THRESHOLD = 0.5;
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
```

### File Organization
```
src/
├── background.js    # ML pipeline, caching, API
├── content.js       # Content filtering
├── popup.js         # UI logic
├── popup.html       # UI structure
└── popup.css        # UI styling
```

### Comments
```javascript
// Good: Explains WHY, not WHAT
// Use WASM backend in service workers because WebGPU is not supported
env.backends.onnx.wasm.proxy = false;

// Bad: States the obvious
// Set proxy to false
env.backends.onnx.wasm.proxy = false;
```

---

## 🐛 Reporting Bugs

### Before Reporting
1. Check existing issues
2. Test with latest version
3. Verify it's not a configuration issue
4. Try clearing cache and reloading extension

### Bug Report Template
```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14]
- Extension version: [e.g., 0.0.1]

**Console Logs**
```
Paste relevant console logs here
```

**Additional context**
Any other context about the problem.
```

---

## 💡 Suggesting Features

### Feature Request Template
```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other context about the feature.

**Would you be willing to implement this?**
[ ] Yes
[ ] No
[ ] With guidance
```

---

## 🔀 Pull Request Process

### Before Submitting
1. Create a new branch for your changes
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
   - Follow code style guidelines
   - Add comments where needed
   - Test thoroughly

3. Test your changes
   - Load extension and verify functionality
   - Check console for errors
   - Test on multiple websites
   - Verify performance impact

4. Commit with clear messages
   ```bash
   git commit -m "Add image batch processing feature"
   ```

### PR Template
```markdown
**Description**
Brief description of changes.

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Documentation update
- [ ] Code refactoring

**Testing**
- [ ] Tested in Chrome
- [ ] Tested in Edge
- [ ] Tested on multiple websites
- [ ] Verified no console errors
- [ ] Checked performance impact

**Screenshots (if applicable)**
Add screenshots showing the changes.

**Related Issues**
Closes #123, Fixes #456

**Checklist**
- [ ] Code follows project style
- [ ] Comments added for complex logic
- [ ] Documentation updated (if needed)
- [ ] No breaking changes
- [ ] Tested thoroughly
```

### Review Process
1. Maintainer reviews PR
2. Address feedback if requested
3. Once approved, PR will be merged
4. Your contribution will be credited

---

## 🧪 Testing Guidelines

### Manual Testing Checklist
- [ ] Extension loads without errors
- [ ] Models load successfully
- [ ] Text classification works
- [ ] Image classification works
- [ ] Safe content displays correctly
- [ ] NSFW content blocks correctly
- [ ] Popup shows correct stats
- [ ] Cache clearing works
- [ ] Context menu works
- [ ] No console errors

### Testing Scenarios
1. **Safe websites**: Verify content shows normally
2. **Mixed content**: Verify selective filtering
3. **Slow networks**: Test timeout handling
4. **Large images**: Test size limits
5. **Invalid images**: Test error handling
6. **Rapid navigation**: Test cleanup and performance

### Performance Testing
```javascript
// Monitor classification times
console.time('classification');
const result = await classify(text);
console.timeEnd('classification');

// Check cache hit rates
chrome.runtime.sendMessage({ action: 'getPerformanceStats' }, (stats) => {
    console.log('Cache hit rate:', 
        stats.imageClassifications.cached / stats.imageClassifications.total);
});
```

---

## 📚 Key Files to Understand

### `background.js` (~650 lines)
**Core functionality**: ML pipeline, caching, request handling

**Key sections**:
- Backend configuration (lines 1-50)
- Caching system (lines 50-250)
- Model pipelines (lines 250-300)
- Classification functions (lines 300-450)
- Message handlers (lines 550-650)

### `content.js` (~150 lines)
**Core functionality**: Content filtering and DOM manipulation

**Key sections**:
- Image hiding style injection (lines 1-15)
- Text classification handler (lines 30-50)
- Image scan queue (lines 50-150)

### `popup.js` (~100 lines)
**Core functionality**: UI controls and stats display

**Key sections**:
- Status display (lines 1-30)
- Stats refresh (lines 30-60)
- Manual testing (lines 60-100)

---

## 🎯 Priority Areas for Contribution

### High Priority
1. **Testing across websites**: More real-world testing needed
2. **UI improvements**: Better blocked content screens
3. **Performance optimization**: Reduce memory usage
4. **Error handling**: More robust error recovery

### Medium Priority
1. **Additional models**: Evaluate and integrate new models
2. **Parental controls**: Settings page, whitelist/blacklist
3. **Better caching**: Smart cache invalidation
4. **Documentation**: More examples and guides

### Low Priority
1. **Internationalization**: Multi-language support
2. **Themes**: Dark mode, custom themes
3. **Advanced features**: Multiple profiles, cloud sync

---

## 🤝 Community Guidelines

### Be Respectful
- Treat everyone with respect and kindness
- Assume good intentions
- Provide constructive feedback
- Focus on the issue, not the person

### Be Patient
- Maintainers are volunteers
- Reviews take time
- Response delays are normal
- Not all PRs will be accepted

### Be Clear
- Write clear descriptions
- Provide context
- Include examples
- Ask questions if unclear

---

## 📞 Getting Help

### Questions?
- Open a Discussion on GitHub
- Check existing issues and docs
- Ask in PR/issue comments

### Need Guidance?
- Comment on an issue you'd like to work on
- Ask for mentorship on complex features
- Request code review guidance

---

## 🏆 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md (if created)
- Mentioned in release notes
- Credited in relevant documentation

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You

Thank you for considering contributing to this project! Every contribution, no matter how small, helps make the internet safer for children.

---

**Last Updated**: April 8, 2026

For more information, see:
- [README.md](README.md) - Project overview
- [PROGRESS.md](PROGRESS.md) - Current status and roadmap
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details
