# NumPy Documentation Search Changelog

## [1.0.0] - 2025-01-XX

### Added

- **Core Search Functionality**: Real-time search through NumPy Sphinx inventory with intelligent ranking
  - Prefix matching prioritization for accurate results
  - Short name search support (search "norm" to find "numpy.linalg.norm")
  - Filters out private members (functions/methods starting with `_` or `__`)
- **Documentation Display**: Rich documentation preview inside Raycast
  - Function/method signatures formatted as Python code blocks with enhanced syntax highlighting
  - Signatures now include `def` keyword, parameter type annotations, and return type annotations for better readability
  - Parameter lists with type annotations and descriptions
  - Return value documentation
  - Descriptive summaries extracted from official NumPy docs
- **Sphinx Inventory Integration**: Automatic loading and caching of NumPy API reference
  - Supports multiple Python object types (functions, methods, classes, attributes, properties, modules, exceptions)
  - Deduplication and filtering for clean search results
  - Direct links to official numpy.org documentation
- **User Actions**: Quick access to documentation and metadata
  - View full documentation in expanded detail view
  - Open official docs in browser
  - Copy URL, qualified name, or signature to clipboard
- **Test Coverage**: Comprehensive test suite for reliability
  - Search ranking and filtering tests
  - HTML documentation parsing tests
  - Inventory loading and deduplication tests
  - Fixtures mirroring NumPy documentation structure

### Improved

- **Enhanced Syntax Highlighting**: Function signatures now use Python-style function definitions with type hints
  - Added `def` keyword to function signatures for improved syntax highlighting
  - Integrated parameter type annotations from documentation into function signatures
  - Added return type annotations using `->` syntax
  - Signatures now appear as valid Python-style definitions with trailing colon for maximum highlighting
