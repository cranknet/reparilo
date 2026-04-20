# Language Switcher — Cycle Toggle

## Context

Reparilo supports 3 languages (AR/FR/EN). Currently there is no UI to switch languages. The TopBar (`src/components/modules/top-bar.tsx`) has a notification bell button on the right side. The language switcher should sit directly before the bell.

## Design

### Placement

In the TopBar right-side flex container, after the DEV role switcher and before the notifications `<button>`. Position index: between the role switcher and the bell.

### Component: `<LanguageToggle />`

- **File:** `src/components/modules/language-toggle.tsx`
- **Dependencies:** `react-i18next` (already installed), Material Symbols

### Behavior

- Displays current language code in uppercase (EN / FR / AR) inside a pill
- Single click cycles: EN → FR → AR → EN
- Persists choice to localStorage via i18next (built-in support)
- RTL-aware: uses logical margin (`ms-2`/`me-2`), mirrors correctly for Arabic

### Visual

- Pill shape: `rounded-lg px-2 py-1 text-xs font-bold`
- Background: `bg-surface-container-high` (matches search input area)
- Text: `text-on-surface-variant`, hover highlights to `text-primary`
- Icon: `translate` Material Symbol before the code text
- Same rounded-lg + hover pattern as the notification bell button for visual consistency

## Code Changes

1. **New file:** `src/components/modules/language-toggle.tsx` — self-contained toggle component
2. **Edit:** `src/components/modules/top-bar.tsx` — import and render `<LanguageToggle />` before the notifications button

No new i18n keys needed — language codes are universal.