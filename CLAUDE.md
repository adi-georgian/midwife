# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Midwife is a tool for transforming ideas into action using the Socratic Method. It models discourse as a tree structure where a central thesis branches into aspects (questions/challenges), which can recursively contain their own child aspects.

## Running the Project

```bash
# Run the main example
python main.py

# Or use the Jupyter notebook for interactive development
jupyter notebook trial.ipynb
```

**Dependencies:** `pip install graphviz`

## Architecture

The codebase implements a Discourse Tree with two node types:

- **Thesis** (`components.py`): Root node representing the central idea. Contains `thesis_aspects` list of child Aspect nodes.
- **Aspect** (`components.py`): Child nodes representing questions or challenges to the thesis or parent aspect. Contains `aspect_children` list for nested aspects.

Both classes have:
- `add_aspect(content: str)` - Creates and attaches a child Aspect
- `get_aspect(content: str)` - Retrieves an aspect by its content string

**Key modules:**
- `components.py` - Data model (Thesis, Aspect classes)
- `visualize.py` - Renders the tree as a Graphviz directed graph via `build_tree(thesis)`
- `utils.py` - `summarize_aspect()` maps full content to short labels (currently hardcoded mappings)

## Known Issues

1. **Bug in `Aspect.get_aspect()` (line 61)**: References `self.thesis_aspects` instead of `self.aspect_children`
2. **Hardcoded label mappings**: `utils.py` only works with predefined content strings; unmapped content raises KeyError
3. **Type hint compatibility**: Uses `A | B` union syntax which requires Python 3.10+, but project targets Python 3.9
