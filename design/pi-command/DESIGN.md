# Design System Specification: Obsidian Command

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Monolith Architect."** 

This system rejects the soft, approachable "SaaS-standard" aesthetic in favor of an aggressive, high-density technical harness. It is designed for elite operators who prioritize information velocity over visual hand-holding. We achieve a premium editorial feel not through decoration, but through **mathematical precision, razor-sharp edges, and extreme tonal contrast.** 

The layout breaks the "template" look by utilizing intentional asymmetry—heavy sidebar densities contrasted against expansive, stark code canvases. We treat the screen not as a webpage, but as a high-performance terminal interface where every pixel must justify its existence.

---

## 2. Colors & Surface Logic
The palette is restricted to a monochromatic spectrum. By removing hue, we force the user to focus on hierarchy and logic.

### Core Palette
- **Background (Base):** `#131313` (The void)
- **Primary:** `#ffffff` (Pure light / Action)
- **Surface Container Lowest:** `#0e0e0e` (Recessed areas/Terminal wells)
- **Surface Container Highest:** `#353535` (Active overlays)
- **Outline Variant:** `#474747` (The structural thread)

### The "No-Line" Rule for Sectioning
While the prompt allows for 1px borders, they must never be used to define major layout sections. Sectioning is achieved through **Background Color Shifts**. A sidebar in `surface_container_low` sits against a `surface` editor without a vertical line. Lines are reserved strictly for internal component anatomy (e.g., input fields, table cells).

### Surface Hierarchy & Nesting
Treat the UI as a series of physical "slabs" of obsidian:
1.  **Level 0 (The Floor):** `surface` (#131313) - The primary work area.
2.  **Level 1 (Recessed):** `surface_container_lowest` (#0e0e0e) - Used for sidebars and navigation to "push" the content forward.
3.  **Level 2 (Elevated):** `surface_container_high` (#2a2a2a) - Used for floating command palettes or context menus.

### Signature Textures
To prevent the UI from feeling "dead," use a subtle linear gradient on primary CTAs: `primary` (#ffffff) to `primary_container` (#d4d4d4) at a 135-degree angle. This provides a "machined metal" finish that feels intentional and premium.

---

## 3. Typography
The typographic system relies on the tension between the geometric brutality of **Space Grotesk** and the rhythmic utility of **JetBrains Mono**.

*   **Display & Headlines (Space Grotesk):** Used for high-level navigation and section headers. Set these with tight letter-spacing (-0.02em) to emphasize the "aggressive" aesthetic.
*   **Technical Labels & Code (JetBrains Mono):** This is the workhorse. All metadata, line numbers, and "functional" UI (buttons, chips) use JetBrains Mono to signal that they are actionable technical elements.
*   **Hierarchy as Authority:** We use extreme scale shifts. A `display-lg` (3.5rem) header may sit directly next to a `label-sm` (0.6875rem) data point to create a sophisticated, editorial contrast.

---

## 4. Elevation & Depth
In this design system, "depth" is a measure of density and focus, not physical height.

*   **The Layering Principle:** Avoid shadows. Depth is achieved by "stacking." A `surface_container_highest` tooltip placed over a `surface` background provides enough tonal contrast to be legible without artificial drop shadows.
*   **The "Ghost Border" Fallback:** If a component requires a boundary for accessibility, use the `outline_variant` (#474747) at **30% opacity**. This creates a "glint" on the edge of the obsidian slab rather than a heavy container line.
*   **Glassmorphism & Depth:** For the command palette (CMD+K), use `surface_container_highest` with a 12px backdrop-blur and 80% opacity. This allows the code beneath to be sensed but not read, maintaining the "Monolith" feel.

---

## 5. Components

### Buttons
- **Shape:** 0px radius (Razor-sharp).
- **Primary:** `on_primary_container` (Black text) on `primary` (White fill). 
- **Secondary:** `primary` (White text) on 1px `outline` border. No fill.
- **Padding:** Compact. `2` (0.3rem) vertical / `4` (0.75rem) horizontal.

### Input Fields
- **Styling:** 1px `outline_variant` bottom-border only. 
- **Focus State:** Transition the bottom border to `primary` (White) and add a 10% opacity white fill to the container.
- **Typography:** Always JetBrains Mono for input text.

### Chips (Technical Tags)
- **Styling:** Small, rectangular boxes. `surface_container_high` background.
- **Text:** `label-sm` in JetBrains Mono, all caps.
- **Interaction:** On hover, background shifts to `primary`, text shifts to `background`.

### Cards & Lists
- **Rule:** **Strictly no dividers.** 
- Separate list items using the `1.5` (0.225rem) spacing token. 
- Distinguish "Selected" items by shifting the background to `surface_container_highest`.

### The "Status Bar" (Custom Component)
A 24px high strip at the bottom of the viewport using `surface_container_lowest`. It uses `label-sm` JetBrains Mono text to display system vitals (Git branch, Line/Col, Language). This anchors the "High-Density" aesthetic.

---

## 6. Do's and Don'ts

### Do
*   **Do** use extreme density. If there is "empty" space, consider if more metadata can be surfaced.
*   **Do** use `0px` border radius everywhere. No exceptions for "friendliness."
*   **Do** rely on `JetBrains Mono` for anything that represents data or logic.
*   **Do** use `Space Grotesk` in light weights (300-400) for a refined, architectural feel.

### Don't
*   **Don't** use blue, even for links. Use `primary` (White) with an underline, or the `secondary` (Grey) token.
*   **Don't** use standard "drop shadows." They soften the interface; this system must remain hard.
*   **Don't** use 100% opaque borders for layout containers. Use tonal shifts.
*   **Don't** use "Soft" or "Humanist" terminology in the UI. Keep labels clinical and precise (e.g., "Execute" instead of "Go").

---

## 7. Spacing Scale (Reference)
*   **Micro:** `0.5` (0.075rem) - For tight element relationships (label to input).
*   **Standard:** `2` (0.3rem) - For component internal padding.
*   **Layout:** `6` (1.1rem) - For gutter widths between major panels.