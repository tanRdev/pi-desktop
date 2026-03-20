# Spec: Obsidian Command Design Update

## Overview
Update the visual design of PiDesk to follow the "Obsidian Command" aesthetic: high-density, monochromatic, and technical, with zero border radius and sharp background shifts for sectioning.

## Design Rules
- **Border Radius**: 0px everywhere.
- **Palette**: Monochromatic (#131313, #ffffff, #0e0e0e, #353535, #474747).
- **Typography**: JetBrains Mono for technical/code text, Space Grotesk for headlines.
- **Shadows**: None.
- **Layout**: No-line rule (use background shifts for sectioning).
- **Aesthetic**: Aggressive technical look, high density.

## Component Analysis & Update Plan

### 1. Canvas & Grid
- **canvas-container.tsx**: Remove rounded corners from snap previews. Update zoom control styling to be square and monochromatic.
- **canvas-grid.tsx**: Update radial gradient dots to be sharper/smaller or use a more technical pattern that fits the monochromatic scheme.

### 2. Window Chrome & Routing
- **window-chrome.tsx**: 
    - Change `rounded-full` traffic lights to square or sharp icons.
    - Remove all `rounded-lg` or `rounded-sm`.
    - Replace `shadow-lg` with high-contrast borders or background shifts.
    - Update title bar to use Space Grotesk for titles.
- **window-content-router.tsx**: Ensure entering animations are sharp/linear or removed if they feel too "soft".

### 3. UI Components
- **file-viewer.tsx**: (And related `file-window-content.tsx`) Update toolbar to use square buttons. Ensure no rounding on file icons or containers.
- **terminal.tsx**: Ensure xterm theme matches the monochromatic palette. Update error states to be sharp boxes.
- **code-editor.tsx**: Update Monaco options to use JetBrains Mono and ensure no rounded elements in the editor UI (minimap, etc.).
- **code-block.tsx**: Remove rounding from code containers. Update "too large" and "loading" overlays to be sharp and monochromatic.
- **markdown.tsx**: 
    - Update headings to use Space Grotesk.
    - Update code blocks (inline and block) to be square.
    - Remove rounding from images and tables.
    - Replace bullet points with technical markers (e.g., square dots or ASCII-like markers).
- **reasoning.tsx**: Remove rounding from the expansion container. Use background shifts instead of shadows/borders for depth.
- **response-stream.tsx**: Ensure the typewriter/fade animations feel "glitchy" or "mechanical" rather than "soft".
- **thinking-bar.tsx**: Update shimmer effect to be more technical. Remove rounding from the bar and buttons.
- **tool.tsx**: 
    - Remove `rounded-lg` and `rounded-full`.
    - Update badge styling to be square boxes.
    - Update icons to be sharper.
- **chain-of-thought.tsx**: 
    - Remove rounding from trigger and content.
    - Update the "connector" lines to be sharp and high-contrast.

## Implementation Details
- Use `cn()` to override existing Tailwind classes.
- Ensure all transitions are short or linear to maintain the "aggressive" feel.
- Verify `Space Grotesk` and `JetBrains Mono` are available in the project's font setup.

## Verification Plan
- Run `tsc` to ensure type safety.
- Visual inspection of all updated components in the canvas.
- Check accessibility (contrast) of the monochromatic palette.
