# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-10-01

This is a **minor version bump** to prepare for publishing to npm. While we've made significant improvements since 0.1.0, we're holding off on 1.0 until we receive user feedback and validate the API is stable.

### ✨ Added
- Stunning landing page with cyan/teal theme showcasing CodeMesh features
- Agent-driven auto-augmentation capability for self-improving documentation
- Environment variable substitution for secure config management (${VAR:-default} syntax)
- Tool augmentation system with markdown documentation
- Augmentation reminders injected during exploration mode
- XML tags for clearer augmentation instructions

### ♻️ Changed
- **BREAKING**: Exploration mode now returns ERROR (not success) to force augmentation creation
- Simplified exploration detection to ONLY check for `// EXPLORING` comment
- Improved exploration pattern detection to match real agent behavior
- Show augmentation reminder BEFORE output, not after
- Made augmentation instructions MUCH more assertive
- Enhanced tool descriptions with scoped names
- Rebranded CodeMode to CodeMesh throughout

### 🔒 Security
- Aligned environment variable handling with official MCP SDK standards
- Implemented principle of least privilege for config management

### 🐛 Fixed
- Consistent PascalCase type name for namespacedServerName in metadata
- Console output now redirects to log file for stdio compatibility
- Improved config robustness for stdio transport support

### 📝 Documentation
- Added comprehensive README with auto-augmentation workflow
- Created GitHub social preview image
- Added CodeMesh logo to README and landing page
- Enhanced CLAUDE.md with development guidelines

**Why minor version?** Added new features (auto-augmentation, env vars) with one breaking change (exploration ERROR behavior), but API isn't finalized yet. Waiting for community feedback before 1.0.

## [0.1.0] - 2025-09-28

Initial release of CodeMesh (rebranded from CodeMode).

### ✨ Features
- Multi-server MCP orchestration (HTTP, stdio, websocket)
- Context-efficient tiered discovery system
- Type-safe TypeScript code execution in VM2 sandbox
- Scoped tool names with namespace support
- `discover-tools`, `get-tool-apis`, `execute-code` tools

[0.2.0]: https://github.com/kiliman/codemesh/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/kiliman/codemesh/releases/tag/v0.1.0
