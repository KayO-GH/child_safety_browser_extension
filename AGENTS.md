# AGENTS.md

## Agent Modes for child_safety_browser_extension

This document defines specialized agent behaviors for different development contexts in this browser extension project.

---

## Available Agent Modes

### 1. default
**Purpose**: Standard GitHub Copilot code suggestions for browser extension development.

**Key Behaviors**:
- Follows best practices for Manifest V3 Chrome extensions
- Suggests modular, maintainable JavaScript patterns
- Considers browser compatibility (Chrome, Edge, Brave)
- Respects service worker limitations
- Provides security-conscious code suggestions

**When to Use**: General coding, bug fixes, refactoring, feature additions

---

### 2. transformers
**Purpose**: Specialized mode for ML/AI features using Transformers.js

**Key Behaviors**:
- Prioritizes use of `@huggingface/transformers` (v4.0.0+) for all ML/NLP tasks
- Ensures all ML code is browser-compatible and uses async/await
- Considers WebGPU vs WASM backend differences
- Optimizes for model loading, caching, and inference performance
- Aware of service worker context limitations (no WebGPU in service workers)

**Example Usage**:
```javascript
import { pipeline, env } from '@huggingface/transformers';

// Configure backend
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

// Create pipeline
const classifier = await pipeline('text-classification', 'Xenova/toxic-bert', {
    device: 'wasm',  // or 'webgpu' if available
});

// Run inference
const result = await classifier('sample text');
```

**Reference**: https://github.com/huggingface/transformers.js

**When to Use**: 
- Adding new classification models
- Optimizing ML performance
- Debugging model loading or inference issues
- Implementing new ML features

---

### 3. performance
**Purpose**: Focus on performance optimization and monitoring

**Key Behaviors**:
- Analyzes cache hit rates and suggests improvements
- Optimizes memory usage and model loading
- Suggests batching and throttling strategies
- Monitors and reduces extension overhead
- Considers IndexedDB and in-memory caching patterns

**When to Use**:
- Extension feels slow or laggy
- High memory usage
- Improving cache strategies
- Optimizing classification throughput

---

### 4. ui-ux
**Purpose**: Child-friendly user interface and experience

**Key Behaviors**:
- Considers child safety and age-appropriate design
- Focuses on clear, non-technical language
- Suggests visual feedback and loading states
- Implements accessible, intuitive interfaces
- Balances protection with usability

**When to Use**:
- Building popup UI features
- Designing blocked content overlays
- Creating parental control dashboards
- Improving user feedback and notifications

---

### 5. security
**Purpose**: Security-first development for child safety features

**Key Behaviors**:
- Validates all inputs (URLs, text, images)
- Implements proper error handling
- Considers content security policy (CSP) restrictions
- Prevents XSS and injection attacks
- Follows principle of least privilege for permissions

**When to Use**:
- Adding new content script features
- Handling user-generated content
- Implementing authentication/authorization
- Reviewing security vulnerabilities

---

## Custom Workflows

### Model Evaluation
When evaluating or comparing ML models:
1. Use **transformers** mode for implementation
2. Use **performance** mode for benchmarking
3. Document results in PROGRESS.md

### Feature Development
When building new features:
1. Start with **default** mode for basic implementation
2. Switch to **transformers** mode for ML integration
3. Use **ui-ux** mode for user-facing components
4. Use **security** mode for validation and hardening
5. Use **performance** mode for optimization

### Bug Fixing
1. Use **default** mode for general bugs
2. Use **transformers** mode for ML-related issues
3. Use **performance** mode for slowness/lag issues
4. Use **security** mode for vulnerability fixes

---

## Adding New Agent Modes

When adding new agent modes, document:
- **Mode name**: Clear, descriptive identifier
- **Purpose**: One-sentence summary
- **Key Behaviors**: Bullet list of what makes this mode special
- **Example usage**: Code sample if applicable
- **When to use**: Specific scenarios where this mode helps

---

## Notes

- Agent modes are hints/preferences, not strict constraints
- Multiple modes can apply to a single task
- Default mode is suitable for most general development
- Specialized modes help Copilot provide more context-aware suggestions

---

**Last Updated**: April 8, 2026

For more details on the project, see:
- [README.md](README.md) - Project overview and setup
- [PROGRESS.md](PROGRESS.md) - Detailed progress tracking
- `.instructions.md` - Low-level development instructions (if present)
