# UI Component Library — Extraction + Normalization Design

**Date:** 2026-04-14
**Scope:** Build a full `components/ui/` library by extracting repeated patterns from existing pages, normalizing inconsistencies, and establishing clean variant-based APIs.

## Context

Reparilo's frontend has 7 built pages but no reusable base components. Every page builds inputs, buttons, badges, tables, and icons from scratch using raw HTML + Tailwind. This causes:

- **61 raw `<button>` elements** with inconsistent styling (hardcoded hex vs design tokens)
- **38 raw form inputs** with varying padding, backgrounds, and icon placement
- **4 separate `<table>` implementations** with slightly different header styles
- **92 Material Icon `<span>` wrappers** each with inline size/color classes
- **8+ badge/chip patterns** with inconsistent sizing/padding

## Strategy: Extract + Normalize

Extract repeated patterns into `components/ui/` with clean variant APIs. Fix 5 known inconsistencies during extraction (no visual overhaul, just normalization).

## Normalization Rules

1. **Button gradients** — Replace hardcoded `from-[#0040a1] to-[#0056d2]` with design tokens `from-primary to-primary-container`. Single consistent `primary` variant.
2. **Input backgrounds** — Normalize to `bg-surface-container-lowest` with consistent `px-4 py-3.5`. Icon slots via `iconStart`/`iconEnd` props.
3. **Icon sizes** — Normalize to scale: `xs=14px`, `sm=18px`, `md=20px`, `lg=24px`, `xl=32px`.
4. **Badge/chip padding** — Normalize to `sm` (`px-2 py-0.5 text-[10px]`) and `md` (`px-3 py-1 text-xs`).
5. **Table headers** — Normalize to `text-[10px] uppercase tracking-widest`.

## Components

### Tier 1: Base UI Primitives

#### Button

```tsx
import { Button } from "@/components/ui";

<Button variant="primary" size="md" icon="add_box">New Intake</Button>
<Button variant="secondary" size="md">Export</Button>
<Button variant="ghost" size="sm">Cancel</Button>
<Button variant="destructive" size="sm">Delete</Button>
<Button variant="primary" size="md" iconOnly>+</Button>
```

Variants:
- `primary` — Gradient `from-primary to-primary-container`, white text, shadow. The main CTA.
- `secondary` — `bg-surface-container-highest`, `text-on-secondary-fixed-variant`. Secondary action.
- `ghost` — Transparent bg, text color only. Tertiary/minor actions.
- `destructive` — Error-toned for delete/remove actions.

Sizes: `sm` (`px-3 py-2 text-xs`), `md` (`px-5 py-2.5 text-sm`), `lg` (`px-8 py-3 text-base`).

Props: `variant`, `size`, `icon` (Material Symbol name, rendered before children), `iconOnly` (icon-only button, square), `loading`, `disabled`, all `<button>` HTML attrs.

#### Input

```tsx
import { Input } from "@/components/ui";

<Input placeholder="Search..." />
<Input iconStart="person" placeholder="Username" />
<Input iconEnd="visibility_off" type="password" placeholder="Password" />
<Input iconStart="link" type="url" placeholder="https://..." />
```

Props: `iconStart` (Material Symbol name), `iconEnd` (Material Symbol name), all `<input>` HTML attrs. Background: `bg-surface-container-lowest`. Border-radius: `rounded-xl`. Focus: `ring-2 ring-primary/20`.

#### Select

```tsx
import { Select } from "@/components/ui";

<Select>
  <option value="DZD">DZD — Algerian Dinar</option>
  <option value="USD">USD — US Dollar</option>
</Select>
```

Same styling as Input. Props: all `<select>` HTML attrs.

#### Textarea

```tsx
import { Textarea } from "@/components/ui";

<Textarea rows={3} placeholder="Shop address..." />
```

Same styling as Input. Props: all `<textarea>` HTML attrs.

#### Label

```tsx
import { Label } from "@/components/ui";

<Label htmlFor="shop-name">Shop Name</Label>
```

Style: `font-bold text-[11px] text-on-surface-variant uppercase tracking-wider`. Props: all `<label>` HTML attrs.

#### Badge

```tsx
import { Badge } from "@/components/ui";

<Badge variant="primary">Default</Badge>
<Badge variant="error">Low Stock</Badge>
<Badge variant="secondary">Standard</Badge>
<Badge variant="tertiary">VIP</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="outline">Optional</Badge>
```

Variants with mapped styles:
- `primary` → `bg-primary-fixed text-on-primary-fixed`
- `secondary` → `bg-secondary-container text-on-secondary-container`
- `tertiary` → `bg-tertiary-fixed text-on-tertiary-fixed-variant`
- `error` → `bg-error-container text-on-error-container`
- `success` → `bg-primary/10 text-primary`
- `outline` → `border border-outline-variant text-on-surface-variant`

Sizes: `sm` (`px-2 py-0.5 text-[10px]`), `md` (`px-3 py-1 text-xs`). Default: `md`.

Props: `variant`, `size`, children.

#### Icon

```tsx
import { Icon } from "@/components/ui";

<Icon name="edit" size="sm" />
<Icon name="check_circle" size="md" color="text-primary" />
```

Replaces all `<span className="material-symbols-outlined text-[18px]">icon_name</span>`.

Sizes: `xs`(14px), `sm`(18px), `md`(20px), `lg`(24px), `xl`(32px). Default: `md`.

Props: `name` (Material Symbol name, required), `size`, `color` (optional Tailwind text-color class).

#### Checkbox

```tsx
import { Checkbox } from "@/components/ui";

<Checkbox id="terms" checked={agreed} onChange={setAgreed} />
```

Style: `h-5 w-5 rounded border-none bg-surface-container-highest text-primary focus:ring-primary/20`.

Props: all standard checkbox attrs.

### Tier 2: Domain Components

#### MetricCard

```tsx
import { MetricCard } from "@/components/ui";

<MetricCard
  icon="precision_manufacturing"
  label="Active Jobs"
  value="24"
  detail="Since 8am"
  unit="DZD"
>
  {/* Optional slot: progress bar, sparkline, etc. */}
  <ProgressBar value={75} />
</MetricCard>
```

Currently duplicated across dashboard, jobs, parts, repairs pages. Consolidate the single `metric-card.tsx` that already exists in `components/modules/dashboard/` into `ui/` with normalized API.

Props: `icon` (Material Symbol), `iconColor` (Tailwind text class), `label`, `value`, `detail`, `unit`, children (slot for extra content).

#### StatusBadge

```tsx
import { StatusBadge } from "@/components/ui";

<StatusBadge status="IN_REPAIR" />
<StatusBadge status="DONE" />
```

Auto-maps `JobStatusType` to color variant and display label. Replaces inline status badge markup in Jobs and Repairs pages.

Props: `status` (JobStatusType), `size` (sm|md).

#### StockBar

```tsx
import { StockBar } from "@/components/ui";

<StockBar level={3} max={50} />
```

Auto-colors: green (30%+), amber (10-30%), red (<10%). Currently in Parts page only but reusable.

Props: `level`, `max`.

#### ProgressBar

```tsx
import { ProgressBar } from "@/components/ui";

<ProgressBar value={75} color="primary" />
<ProgressBar value={50} color="error" />
```

Generic progress indicator. Used in dashboard metric cards.

Props: `value` (0-100), `color` (Tailwind bg class or named token), `className`.

#### Avatar

```tsx
import { Avatar } from "@/components/ui";

<Avatar initials="KB" />
<Avatar src="/photo.jpg" />
```

Initials or image. Fixed size circle. Used in Jobs mobile cards.

Props: `initials` or `src`, `size` (`sm`|`md`|`lg`).

## File Structure

```
src/components/ui/
├── button.tsx
├── input.tsx
├── select.tsx
├── textarea.tsx
├── label.tsx
├── badge.tsx
├── icon.tsx
├── checkbox.tsx
├── metric-card.tsx
├── status-badge.tsx
├── stock-bar.tsx
├── progress-bar.tsx
├── avatar.tsx
└── index.ts
```

## Conventions

- Named exports only (no default exports)
- Barrel re-export via `index.ts` for `import { Button } from "@/components/ui"`
- Props defined as `interface ComponentNameProps`
- No `forwardRef` needed (React 19)
- RTL-compatible: use `start`/`end` (not `left`/`right`) in Tailwind
- Use existing MD3 design tokens (`text-on-surface`, `bg-primary`, etc.) — no hardcoded colors
- Each component: ~30-80 lines, single responsibility
- No comments per project code style rules

## Implementation Order

1. `icon.tsx` — foundational, used by everything else
2. `label.tsx` — simple, used by all form components
3. `button.tsx` — highest usage (61 instances), enables page refactors
4. `input.tsx` — second highest usage (38 form elements)
5. `select.tsx` + `textarea.tsx` — depend on Input patterns
6. `checkbox.tsx` — simple standalone
7. `badge.tsx` — used across tables, cards, filters
8. `progress-bar.tsx` — used by MetricCard
9. `metric-card.tsx` — consolidate from modules/dashboard/
10. `status-badge.tsx` — depends on Badge
11. `stock-bar.tsx` — depends on ProgressBar
12. `avatar.tsx` — simple standalone
13. `index.ts` — barrel export last

## Not In Scope (Future)

- Refactoring existing pages to use new components (follow-up task)
- Compound components (PageHeader, DataTable, FilterChips)
- Toast/notification system
- Modal/Dialog component
- DropdownMenu component
- Pagination component
- Tabs component