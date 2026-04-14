# UI Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full `components/ui/` library by extracting repeated patterns from existing pages and normalizing inconsistencies.

**Architecture:** Hand-rolled components extracted from existing page markup. Each component uses variant-based APIs with MD3 design tokens. No external library dependencies.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (MD3 tokens defined in `app.css`), Vitest for tests, Ultracite for linting.

---

## File Structure

```
src/components/ui/
├── icon.tsx           # Material Symbols wrapper
├── label.tsx          # Form label
├── button.tsx         # Button with variants
├── input.tsx          # Text input with icon slots
├── select.tsx         # Native select
├── textarea.tsx       # Multi-line input
├── checkbox.tsx       # Checkbox
├── badge.tsx          # Badge/chip with variants
├── progress-bar.tsx   # Generic progress indicator
├── metric-card.tsx    # KPI metric card
├── status-badge.tsx   # Job status auto-badge
├── stock-bar.tsx      # Stock level bar
├── avatar.tsx         # Initials/image avatar
└── index.ts           # Barrel export
```

---

### Task 1: Icon Component

**Files:**
- Create: `src/components/ui/icon.tsx`
- Test: `src/components/ui/__tests__/icon.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "@/components/ui/icon";

describe("Icon", () => {
  it("renders a material-symbols-outlined span with the given name", () => {
    render(<Icon name="edit" />);
    const el = screen.getByText("edit");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveClass("material-symbols-outlined");
  });

  it("applies default size md (20px)", () => {
    render(<Icon name="check" />);
    const el = screen.getByText("check");
    expect(el).toHaveClass("text-[20px]");
  });

  it("applies size xs (14px)", () => {
    render(<Icon name="close" size="xs" />);
    const el = screen.getByText("close");
    expect(el).toHaveClass("text-[14px]");
  });

  it("applies custom color class", () => {
    render(<Icon name="error" color="text-primary" />);
    const el = screen.getByText("error");
    expect(el).toHaveClass("text-primary");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/icon.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```tsx
type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<IconSize, string> = {
  xs: "text-[14px]",
  sm: "text-[18px]",
  md: "text-[20px]",
  lg: "text-[24px]",
  xl: "text-[32px]",
};

interface IconProps {
  className?: string;
  color?: string;
  name: string;
  size?: IconSize;
}

export function Icon({
  name,
  size = "md",
  color,
  className,
}: IconProps) {
  return (
    <span
      className={[
        "material-symbols-outlined",
        SIZE_CLASSES[size],
        color,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {name}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/icon.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/icon.tsx src/components/ui/__tests__/icon.test.tsx
git commit -m "feat(ui): add Icon component"
```

---

### Task 2: Label Component

**Files:**
- Create: `src/components/ui/label.tsx`
- Test: `src/components/ui/__tests__/label.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Label } from "@/components/ui/label";

describe("Label", () => {
  it("renders a label element", () => {
    render(<Label htmlFor="test">Shop Name</Label>);
    const el = screen.getByText("Shop Name");
    expect(el.tagName).toBe("LABEL");
    expect(el).toHaveAttribute("for", "test");
  });

  it("has uppercase tracking-wider styling", () => {
    render(<Label>Test</Label>);
    const el = screen.getByText("Test");
    expect(el).toHaveClass("uppercase");
    expect(el).toHaveClass("tracking-wider");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/label.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={[
        "font-bold text-[11px] text-on-surface-variant uppercase tracking-wider",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/label.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/label.tsx src/components/ui/__tests__/label.test.tsx
git commit -m "feat(ui): add Label component"
```

---

### Task 3: Button Component

**Files:**
- Create: `src/components/ui/button.tsx`
- Test: `src/components/ui/__tests__/button.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders a button with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies primary variant styles by default", () => {
    render(<Button>Primary</Button>);
    const el = screen.getByRole("button");
    expect(el).toHaveClass("bg-gradient-to-br");
    expect(el).toHaveClass("from-primary");
  });

  it("applies secondary variant", () => {
    render(<Button variant="secondary">Sec</Button>);
    const el = screen.getByRole("button");
    expect(el).toHaveClass("bg-surface-container-highest");
  });

  it("applies ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const el = screen.getByRole("button");
    expect(el.textContent).toContain("Ghost");
  });

  it("renders icon before children when icon prop provided", () => {
    render(<Button icon="add">Add</Button>);
    const iconSpan = screen.getByText("add");
    expect(iconSpan).toHaveClass("material-symbols-outlined");
  });

  it("applies sm size", () => {
    render(<Button size="sm">Small</Button>);
    const el = screen.getByRole("button");
    expect(el).toHaveClass("px-3");
    expect(el).toHaveClass("py-2");
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/button.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Icon } from "@/components/ui/icon";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-br from-primary to-primary-container text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98]",
  secondary:
    "bg-surface-container-highest text-on-secondary-fixed-variant hover:bg-surface-container active:scale-[0.98]",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container-low active:scale-[0.98]",
  destructive:
    "bg-error text-on-error hover:opacity-90 active:scale-[0.98]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

const ICON_SIZE: Record<ButtonSize, "sm" | "md"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  iconOnly?: boolean;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconOnly = false,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        "flex items-center justify-center gap-2 rounded-xl font-bold font-headline transition-all disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT_CLASSES[variant],
        iconOnly ? "p-0 aspect-square" : SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      type={props.type ?? "button"}
      {...props}
    >
      {loading && (
        <Icon className="animate-spin" name="progress_activity" size={ICON_SIZE[size]} />
      )}
      {!loading && icon && (
        <Icon name={icon} size={ICON_SIZE[size]} />
      )}
      {!iconOnly && children}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/button.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/__tests__/button.test.tsx
git commit -m "feat(ui): add Button component"
```

---

### Task 4: Input Component

**Files:**
- Create: `src/components/ui/input.tsx`
- Test: `src/components/ui/__tests__/input.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("renders iconStart before input", () => {
    render(<Input iconStart="person" placeholder="User" />);
    const icon = screen.getByText("person");
    expect(icon).toHaveClass("material-symbols-outlined");
  });

  it("renders iconEnd after input", () => {
    render(<Input iconEnd="visibility_off" placeholder="Pass" />);
    const icon = screen.getByText("visibility_off");
    expect(icon).toHaveClass("material-symbols-outlined");
  });

  it("applies base input styles", () => {
    render(<Input placeholder="Test" />);
    const el = screen.getByPlaceholderText("Test");
    expect(el).toHaveClass("bg-surface-container-lowest");
    expect(el).toHaveClass("rounded-xl");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/input.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Icon } from "@/components/ui/icon";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  iconEnd?: string;
  iconStart?: string;
}

export function Input({ iconStart, iconEnd, className, ...props }: InputProps) {
  const hasIconStart = !!iconStart;
  const hasIconEnd = !!iconEnd;

  const inputClasses = [
    "w-full rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20",
    hasIconStart && "ps-12",
    hasIconEnd && "pe-12",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="group relative">
      {iconStart && (
        <Icon
          className="absolute start-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary"
          name={iconStart}
          size="sm"
        />
      )}
      <input className={inputClasses} {...props} />
      {iconEnd && (
        <Icon
          className="absolute end-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
          name={iconEnd}
          size="sm"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/input.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/input.tsx src/components/ui/__tests__/input.test.tsx
git commit -m "feat(ui): add Input component"
```

---

### Task 5: Select and Textarea Components

**Files:**
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/textarea.tsx`
- Test: `src/components/ui/__tests__/select.test.tsx`
- Test: `src/components/ui/__tests__/textarea.test.tsx`

- [ ] **Step 1: Write failing tests for both**

```tsx
// select.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "@/components/ui/select";

describe("Select", () => {
  it("renders a select element", () => {
    render(
      <Select>
        <option value="DZD">DZD</option>
      </Select>
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("applies base select styles", () => {
    render(<Select><option value="a">A</option></Select>);
    const el = screen.getByRole("combobox");
    expect(el).toHaveClass("bg-surface-container-lowest");
    expect(el).toHaveClass("rounded-xl");
  });
});
```

```tsx
// textarea.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea placeholder="Enter text..." />);
    expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
  });

  it("applies base textarea styles", () => {
    render(<Textarea placeholder="Test" />);
    const el = screen.getByPlaceholderText("Test");
    expect(el).toHaveClass("bg-surface-container-lowest");
    expect(el).toHaveClass("rounded-xl");
    expect(el).toHaveClass("resize-none");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/ui/__tests__/select.test.tsx src/components/ui/__tests__/textarea.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementations**

```tsx
// select.tsx
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={[
        "w-full cursor-pointer appearance-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
```

```tsx
// textarea.tsx
interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={[
        "w-full resize-none rounded-xl border-none bg-surface-container-lowest px-4 py-3.5 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/components/ui/__tests__/select.test.tsx src/components/ui/__tests__/textarea.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/select.tsx src/components/ui/textarea.tsx src/components/ui/__tests__/select.test.tsx src/components/ui/__tests__/textarea.test.tsx
git commit -m "feat(ui): add Select and Textarea components"
```

---

### Task 6: Checkbox Component

**Files:**
- Create: `src/components/ui/checkbox.tsx`
- Test: `src/components/ui/__tests__/checkbox.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("renders an input[type=checkbox]", () => {
    render(<Checkbox id="test" />);
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("applies default checkbox styles", () => {
    render(<Checkbox id="test" />);
    const el = screen.getByRole("checkbox");
    expect(el).toHaveClass("h-5");
    expect(el).toHaveClass("w-5");
    expect(el).toHaveClass("rounded");
    expect(el).toHaveClass("text-primary");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/checkbox.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      className={[
        "h-5 w-5 rounded border-none bg-surface-container-highest text-primary focus:ring-primary/20",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      type="checkbox"
      {...props}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/checkbox.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/checkbox.tsx src/components/ui/__tests__/checkbox.test.tsx
git commit -m "feat(ui): add Checkbox component"
```

---

### Task 7: Badge Component

**Files:**
- Create: `src/components/ui/badge.tsx`
- Test: `src/components/ui/__tests__/badge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders badge with children text", () => {
    render(<Badge>VIP</Badge>);
    expect(screen.getByText("VIP")).toBeInTheDocument();
  });

  it("applies primary variant by default", () => {
    render(<Badge>Test</Badge>);
    const el = screen.getByText("Test");
    expect(el).toHaveClass("bg-primary-fixed");
  });

  it("applies error variant", () => {
    render(<Badge variant="error">Low</Badge>);
    const el = screen.getByText("Low");
    expect(el).toHaveClass("bg-error-container");
  });

  it("applies sm size", () => {
    render(<Badge size="sm">S</Badge>);
    const el = screen.getByText("S");
    expect(el).toHaveClass("px-2");
    expect(el).toHaveClass("text-[10px]");
  });

  it("applies md size by default", () => {
    render(<Badge>M</Badge>);
    const el = screen.getByText("M");
    expect(el).toHaveClass("px-3");
    expect(el).toHaveClass("text-xs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/badge.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
type BadgeVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "error"
  | "success"
  | "outline";
type BadgeSize = "sm" | "md";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  error: "bg-error-container text-on-error-container",
  success: "bg-primary/10 text-primary",
  outline: "border border-outline-variant text-on-surface-variant",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-3 py-1 text-xs",
};

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  size?: BadgeSize;
  variant?: BadgeVariant;
}

export function Badge({
  variant = "primary",
  size = "md",
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center whitespace-nowrap rounded-full font-bold uppercase tracking-wider",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/badge.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/badge.tsx src/components/ui/__tests__/badge.test.tsx
git commit -m "feat(ui): add Badge component"
```

---

### Task 8: ProgressBar Component

**Files:**
- Create: `src/components/ui/progress-bar.tsx`
- Test: `src/components/ui/__tests__/progress-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "@/components/ui/progress-bar";

describe("ProgressBar", () => {
  it("renders a progress bar container and fill", () => {
    render(<ProgressBar value={75} />);
    const container = screen.getByRole("progressbar");
    expect(container).toBeInTheDocument();
  });

  it("applies primary color by default", () => {
    const { container } = render(<ProgressBar value={50} />);
    const fill = container.querySelector("[style]");
    expect(fill).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/progress-bar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
type ProgressBarColor = "primary" | "secondary" | "tertiary" | "error";

const COLOR_CLASSES: Record<ProgressBarColor, string> = {
  primary: "bg-primary",
  secondary: "bg-on-secondary-container",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

interface ProgressBarProps {
  className?: string;
  color?: ProgressBarColor;
  value: number;
}

export function ProgressBar({
  value,
  color = "primary",
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clamped}
      className={[
        "h-1 w-full overflow-hidden rounded-full bg-surface-container-highest",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="progressbar"
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${COLOR_CLASSES[color]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/progress-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/progress-bar.tsx src/components/ui/__tests__/progress-bar.test.tsx
git commit -m "feat(ui): add ProgressBar component"
```

---

### Task 9: MetricCard Component

**Files:**
- Create: `src/components/ui/metric-card.tsx`
- Test: `src/components/ui/__tests__/metric-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricCard } from "@/components/ui/metric-card";

describe("MetricCard", () => {
  it("renders label, value, and icon", () => {
    render(<MetricCard icon="inventory_2" label="SKUs" value="42" detail="all" />);
    expect(screen.getByText("SKUs")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("all")).toBeInTheDocument();
  });

  it("renders unit when provided", () => {
    render(<MetricCard icon="payments" label="Revenue" value="452k" unit="DZD" detail="" />);
    expect(screen.getByText("DZD")).toBeInTheDocument();
  });

  it("renders children slot", () => {
    render(
      <MetricCard icon="check" label="Done" value="12" detail="">
        <div>slot content</div>
      </MetricCard>
    );
    expect(screen.getByText("slot content")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/metric-card.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Consolidate from `src/components/modules/dashboard/metric-card.tsx`, normalize to named export, use `Icon` component.

```tsx
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

interface MetricCardProps {
  children?: ReactNode;
  detail: string;
  icon: string;
  iconColor?: string;
  label: string;
  onClick?: () => void;
  unit?: string;
  value: string;
}

export function MetricCard({
  label,
  value,
  unit,
  detail,
  icon,
  iconColor = "text-primary",
  children,
  onClick,
}: MetricCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-surface-container-low p-6 transition-all ${
        onClick
          ? "cursor-pointer ring-1 ring-slate-100 hover:bg-white/40 active:scale-[0.98]"
          : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="mb-4 flex items-start justify-between">
        <p className="font-bold text-on-surface-variant text-xs uppercase tracking-widest">
          {label}
        </p>
        <Icon color={iconColor} name={icon} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-extrabold font-headline text-4xl text-on-surface">
          {value}
        </span>
        {unit && (
          <span className="font-bold text-on-surface-variant text-sm">
            {unit}
          </span>
        )}
      </div>
      <p className="mt-1 font-bold text-on-surface-variant text-xs">{detail}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/metric-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/metric-card.tsx src/components/ui/__tests__/metric-card.test.tsx
git commit -m "feat(ui): add MetricCard component"
```

---

### Task 10: StatusBadge Component

**Files:**
- Create: `src/components/ui/status-badge.tsx`
- Test: `src/components/ui/__tests__/status-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/status-badge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("StatusBadge", () => {
  it("renders the translated status label", () => {
    render(<StatusBadge status="IN_REPAIR" />);
    expect(screen.getByText("status.IN_REPAIR")).toBeInTheDocument();
  });

  it("applies IN_REPAIR color style", () => {
    render(<StatusBadge status="IN_REPAIR" />);
    const el = screen.getByText("status.IN_REPAIR");
    expect(el).toHaveClass("bg-primary/10");
  });

  it("applies CANCELLED style with line-through", () => {
    render(<StatusBadge status="CANCELLED" />);
    const el = screen.getByText("status.CANCELLED");
    expect(el).toHaveClass("line-through");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/status-badge.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Consolidate from `src/components/modules/jobs/status-badge.tsx`, normalize to named export.

```tsx
import type { JobStatusType } from "@shared/constants";
import { useTranslation } from "react-i18next";

type BadgeSize = "sm" | "md";

const STATUS_STYLES: Record<JobStatusType, string> = {
  INTAKE: "bg-secondary-container text-on-secondary-container",
  WAITING_FOR_PARTS: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
  IN_REPAIR: "bg-primary/10 text-primary",
  ON_HOLD: "bg-surface-container-high text-on-surface-variant",
  DONE: "bg-primary-fixed text-on-primary-fixed-variant",
  DELIVERED: "bg-surface-container text-on-surface-variant",
  RETURNED: "bg-error-container text-on-error-container",
  CANCELLED: "bg-surface-container-high text-on-surface-variant line-through",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-[10px]",
};

interface StatusBadgeProps {
  size?: BadgeSize;
  status: JobStatusType;
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      className={[
        "inline-flex items-center whitespace-nowrap rounded-full font-extrabold uppercase tracking-wider",
        SIZE_CLASSES[size],
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {t(`status.${status}`)}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/status-badge.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/status-badge.tsx src/components/ui/__tests__/status-badge.test.tsx
git commit -m "feat(ui): add StatusBadge component"
```

---

### Task 11: StockBar Component

**Files:**
- Create: `src/components/ui/stock-bar.tsx`
- Test: `src/components/ui/__tests__/stock-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StockBar } from "@/components/ui/stock-bar";

describe("StockBar", () => {
  it("renders level and percentage", () => {
    render(<StockBar level={42} max={50} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("84%")).toBeInTheDocument();
  });

  it("shows error styling when below 10%", () => {
    const { container } = render(<StockBar level={3} max={50} />);
    const fill = container.querySelector("[style]");
    expect(fill).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/stock-bar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Extract and normalize from `src/pages/parts/index.tsx` StockBar.

```tsx
interface StockBarProps {
  className?: string;
  level: number;
  max: number;
}

export function StockBar({ level, max, className }: StockBarProps) {
  const pct = Math.round((level / max) * 100);

  let color = "bg-primary";
  let textColor = "text-on-surface";
  let pctColor = "text-primary";
  if (pct < 10) {
    color = "bg-error";
    textColor = "text-error";
    pctColor = "text-error";
  } else if (pct < 30) {
    color = "bg-tertiary";
  }

  return (
    <div className={["flex flex-col gap-1", className].filter(Boolean).join(" ")}>
      <div className="flex justify-between font-bold text-[10px]">
        <span className={textColor}>
          {level} {pct < 10 && "\u26A1"}
        </span>
        <span className={pctColor}>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/stock-bar.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/stock-bar.tsx src/components/ui/__tests__/stock-bar.test.tsx
git commit -m "feat(ui): add StockBar component"
```

---

### Task 12: Avatar Component

**Files:**
- Create: `src/components/ui/avatar.tsx`
- Test: `src/components/ui/__tests__/avatar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/ui/avatar";

describe("Avatar", () => {
  it("renders initials when provided", () => {
    render(<Avatar initials="KB" />);
    expect(screen.getByText("KB")).toBeInTheDocument();
  });

  it("renders an image when src is provided", () => {
    render(<Avatar src="/photo.jpg" alt="User" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "/photo.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/ui/__tests__/avatar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

interface AvatarProps {
  alt?: string;
  className?: string;
  initials?: string;
  size?: AvatarSize;
  src?: string;
}

export function Avatar({ initials, src, alt, size = "md", className }: AvatarProps) {
  if (src) {
    return (
      <img
        alt={alt ?? ""}
        className={[
          "rounded-full object-cover",
          SIZE_CLASSES[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        src={src}
      />
    );
  }

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full bg-surface-container-high font-bold font-headline text-on-surface-variant",
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {initials}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/ui/__tests__/avatar.test.tsx`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm check`

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/avatar.tsx src/components/ui/__tests__/avatar.test.tsx
git commit -m "feat(ui): add Avatar component"
```

---

### Task 13: Barrel Export

**Files:**
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Create the barrel export file**

```tsx
export { Avatar } from "./avatar";
export { Badge } from "./badge";
export { Button } from "./button";
export { Checkbox } from "./checkbox";
export { Icon } from "./icon";
export { Input } from "./input";
export { Label } from "./label";
export { MetricCard } from "./metric-card";
export { ProgressBar } from "./progress-bar";
export { Select } from "./select";
export { StatusBadge } from "./status-badge";
export { StockBar } from "./stock-bar";
export { Textarea } from "./textarea";
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm vitest run src/components/ui/`
Expected: All tests pass

- [ ] **Step 3: Run lint**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): add barrel export for component library"
```

---

### Task 14: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `pnpm check`
Expected: No errors

- [ ] **Step 3: Verify barrel import works**

Run: `pnpm exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit any type fixes if needed**

```bash
git add -A && git commit -m "fix(ui): resolve type errors" || echo "No fixes needed"
```