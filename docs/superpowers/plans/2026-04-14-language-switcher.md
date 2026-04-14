# Language Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal cycle-toggle language switcher in the TopBar, directly before the notification bell, supporting EN/FR/AR with RTL awareness.

**Architecture:** Single self-contained `<LanguageToggle />` component that uses `react-i18next` to read and change the active language. Placed in the existing TopBar right-side flex container.

**Tech Stack:** React, react-i18next, Tailwind CSS, Material Symbols

---

### Task 1: Create LanguageToggle Component

**Files:**
- Create: `src/components/modules/language-toggle.tsx`

- [ ] **Step 1: Write the LanguageToggle component**

```tsx
import { useTranslation } from "react-i18next";

const LANGUAGES = ["en", "fr", "ar"] as const;

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const currentIndex = LANGUAGES.indexOf(i18n.language as typeof LANGUAGES[number]);
  const nextIndex = (currentIndex + 1) % LANGUAGES.length;

  const handleClick = () => {
    i18n.changeLanguage(LANGUAGES[nextIndex]);
  };

  return (
    <button
      className="flex items-center gap-1 rounded-lg bg-surface-container-high px-2 py-1 text-xs font-bold text-on-surface-variant transition-colors hover:text-primary"
      type="button"
      onClick={handleClick}
    >
      <span className="material-symbols-outlined text-sm">translate</span>
      {i18n.language.toUpperCase()}
    </button>
  );
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `language-toggle.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/language-toggle.tsx
git commit -m "feat: add LanguageToggle cycle component"
```

---

### Task 2: Integrate LanguageToggle into TopBar

**Files:**
- Modify: `src/components/modules/top-bar.tsx:1-73`

- [ ] **Step 1: Add import and render LanguageToggle before notification bell**

Add import at top of `top-bar.tsx` (after existing imports):

```tsx
import LanguageToggle from "./language-toggle";
```

Insert `<LanguageToggle />` directly before the notification bell button. The right-side flex container (line 38) should become:

```tsx
      <div className="flex items-center gap-2 md:gap-3">
        {import.meta.env.DEV && (
          <select
            className="rounded-lg border border-amber-400 bg-amber-50 px-2 py-1 font-bold text-[10px] text-amber-800 uppercase"
            onChange={(e) => setRole(e.target.value as RoleType)}
            title="DEV: Switch role"
            value={role}
          >
            {DEV_ROLES.map((r) => (
              <option key={r} value={r}>
                DEV: {r}
              </option>
            ))}
          </select>
        )}
        <LanguageToggle />
        <button
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
          type="button"
        >
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div className="hidden h-8 w-px bg-slate-200 md:block" />
        <button
          className="hidden items-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-container px-3 py-2 font-semibold text-white text-xs shadow-md transition-transform hover:scale-95 md:flex md:px-4 md:text-sm"
          type="button"
        >
          <span className="material-symbols-outlined">
            {role === "TECHNICIAN" ? "swap_horiz" : "add_circle"}
          </span>
          {role === "TECHNICIAN"
            ? t("tech_dashboard.update_job_status")
            : t("new_intake")}
        </button>
      </div>
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm exec tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/modules/top-bar.tsx
git commit -m "feat: integrate LanguageToggle into TopBar"
```

---

### Task 3: Verify in Browser

- [ ] **Step 1: Start dev server and open in Chrome DevTools**

Run: `pnpm dev`

- [ ] **Step 2: Verify language toggle renders before the bell**

Open the app in the browser. Confirm a pill with `translate` icon and "EN" appears to the left of the notification bell.

- [ ] **Step 3: Verify cycle behavior**

Click the toggle — language should cycle EN → FR → AR → EN. Confirm the UI text updates and the document direction toggles for Arabic (RTL).

- [ ] **Step 4: Verify persistence**

Refresh the page. Confirm the last selected language persists.

- [ ] **Step 5: Verify RTL layout**

Switch to Arabic. Confirm the toggle mirror-positions correctly (appears after the bell in RTL flow). Confirm no layout breaks.

- [ ] **Step 6: Run lint**

Run: `pnpm exec ultracite check src/components/modules/language-toggle.tsx src/components/modules/top-bar.tsx`
Expected: No errors