# Design System Strategy: Precision & Trust

## 1. Overview & Creative North Star
The North Star for this design system is **"The Engineering Atelier."** 

In a fast-paced repair environment, a UI shouldn't just be a tool; it should be a precision instrument. We are moving away from the "generic SaaS" look of boxes-inside-boxes. Instead, we embrace a high-end editorial approach that mirrors the technical sophistication of a master mechanic. This is achieved through **Tonal Layering**—using varying depths of light and color rather than harsh lines to organize information. The layout prioritizes "glanceability" for a shop floor while maintaining a sophisticated, premium aesthetic that builds immediate trust with high-value clients.

## 2. Colors & Surface Philosophy
This system rejects the "flat" web. We use color to define physical space and technical hierarchy.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are prohibited for sectioning. Structural boundaries must be created through background color shifts. 
- A `surface-container-low` card sits on a `background` (or `surface`) canvas. 
- Use `surface-container-highest` for sidebars to create a natural, unlined vertical break.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested, physical layers.
- **Canvas:** `background` (#f7f9ff)
- **Primary Workspaces:** `surface-container-low` (#f1f4fa)
- **Actionable Cards:** `surface-container-lowest` (#ffffff)
- **Information Overlays:** `surface-container-high` (#e5e8ee)

### The "Glass & Gradient" Rule
To elevate the "Reliable Blue" beyond a standard utility color:
- **Signature CTAs:** Main buttons (Intake/Delivery) should use a subtle linear gradient from `primary` (#0040a1) to `primary_container` (#0056d2) at a 135-degree angle.
- **Glassmorphism:** For floating modals or "In-Progress" status overlays, use `surface_container_lowest` at 80% opacity with a `20px` backdrop-blur. This keeps the shop floor context visible while focusing the user.

## 3. Typography
We utilize a dual-typeface system to balance technical authority with high-speed readability.

*   **The Authority (Manrope):** Used for `display` and `headline` scales. Its geometric nature feels engineered and modern. Use `headline-md` for vehicle models or customer names to give them a "hero" presence.
*   **The Utility (Inter):** Used for `title`, `body`, and `label` scales. Inter’s high x-height and neutral tone ensure that part numbers, VINs, and labor hours are legible even on a grease-smudged tablet.

**Editorial Hierarchy:** Use `label-sm` in `on-surface-variant` for metadata (e.g., "Last Service Date") paired immediately with `title-md` for the value. This "Small Label/Big Value" pairing mimics technical spec sheets.

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Stacking**, not shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a "soft lift."
*   **Ambient Shadows:** If a card must "float" (e.g., a drag-and-drop repair ticket), use a shadow with a 40px blur at 6% opacity, tinted with `primary` (#0040a1). Never use pure black or grey shadows; they feel "dirty."
*   **The Ghost Border Fallback:** If high-contrast accessibility is required, use a "Ghost Border": `outline_variant` (#c3c6d6) at 15% opacity. It should be felt, not seen.

## 5. Components

### Cards & Lists (The Core)
*   **The Rule of Flow:** Forbid divider lines. Separate "Jobs" in a list using 16px of vertical white space and a subtle background shift to `surface-container-low` on hover.
*   **Status Indicators:** Use `tertiary` (#822800) for "Pending," `primary` for "In Progress," and a custom success state (derived from secondary) for "Ready for Pickup." Statuses are not just dots; they are full-width "header caps" on cards using `surface_container_highest`.

### Buttons (Intake & Delivery)
*   **Primary (The Engine):** Gradient fill (`primary` to `primary_container`), `xl` (0.75rem) roundedness. 
*   **Secondary (The Tool):** `secondary_fixed_dim` background with `on_secondary_fixed` text. No border.
*   **Tertiary (The Manual):** Text-only, using `primary` color, strictly for low-emphasis actions like "View History."

### Input Fields
*   **Stateful Design:** Use `surface_container_highest` for the input background. On focus, transition the background to `surface_container_lowest` and add a 2px "Ghost Border" of `primary`.

### Repair Progress Chips
*   Compact `label-md` text inside `secondary_container` backgrounds. Use `full` (9999px) roundedness to contrast against the `xl` (0.75rem) roundedness of the main cards.

## 6. Do's and Don'ts

### Do
*   **DO** use `display-sm` for big, bold "Days in Shop" counters. Make the data the hero.
*   **DO** use asymmetrical layouts. A wide column for "Repair Details" and a narrow, `surface-container-high` column for "Parts List" creates a sophisticated, non-template feel.
*   **DO** leave "Breathing Room." High-speed environments require more white space, not less, to prevent cognitive overload.

### Don't
*   **DON'T** use 100% opaque `outline` colors for borders. It breaks the "Engineering Atelier" sophistication.
*   **DON'T** use standard "Alert Red" for everything. Use `error_container` with `on_error_container` text for a more integrated, high-end look that alerts the user without causing panic.
*   **DON'T** use icons without labels in the main navigation. Speed requires clarity; labels provide it.