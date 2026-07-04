# FRIDA DomainCheck Design System

This document is the single source of truth for visual design tokens, component patterns, and layout conventions in the FRIDA DomainCheck application. All values originate from `globals.css` and component source code. Do not invent tokens that do not exist in the codebase.

---

## 1. Overview & Design Philosophy

### Project Identity

FRIDA DomainCheck is a domain verification and management platform built for the German cybersecurity association FRIDA e.V. The interface prioritizes clarity, administrative efficiency, and visual parity with the Mendix platform that preceded this rewrite.

### Design Principles

- **Mendix parity first.** Open Sans, the teal color direction, and the general UI density match Mendix conventions. Deviations must be intentional and justified.
- **German-first locale.** The root `<html>` element carries `lang="de"`. All UI text defaults to German.
- **Three-layer token architecture.** Raw values live in `--stitch-*` variables, semantic mappings in `--frida-*`, and Tailwind utility bindings via `@theme inline`. This prevents drift between design intent and rendered output.
- **Accessibility as baseline.** Focus rings, color contrast, keyboard navigation, and `aria-*` attributes are built into component primitives, not bolted on.
- **Progressive enhancement.** Base-ui provides headless component primitives (Button, Input, Dialog, Menu, Tabs). Visual styling is applied via Tailwind and CSS variables, making the system easy to theme.

### Tech Stack

| Concern | Choice |
|---------|--------|
| Font | Open Sans via `next/font/google` (weights 300, 400, 600, 700) |
| Icons | Lucide React v1.16 |
| CSS framework | Tailwind v4 + `@theme inline` (no `tailwind.config.*`) |
| Component primitives | `@base-ui/react` (Button, Input, Dialog, Menu, Tabs) |
| Animation | CSS transitions + `tw-animate-css` (no motion library) |
| Dark mode | Variables defined in `.dark` block, toggle not wired (planned for T5) |

---

## 2. Brand Identity & Atmosphere

### Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--frida-primary` | `#00696d` | Primary actions, active nav, brand text |
| `--frida-gradient-start` | `#00696d` | Auth screen gradient start |
| `--frida-gradient-end` | `#002021` | Auth screen gradient end, dark mode background |
| `--frida-logo-accent` | `#93f2f6` | Line motif accents, dark mode ring color |
| `--frida-brand` | `#00696d` | Brand element direct reference |
| `--frida-brand-hover` | `#004f52` | Brand interactive hover state |

### Visual Atmosphere

- **Clean, administrative.** High-contrast surfaces (`#f9f9f9` background, `#1a1c1c` text) with subtle shadows and thin borders.
- **Teal accent system.** Primary `#00696d` paired with container `#1ab3b9` and fixed `#93f2f6` creates a calm but recognizable brand identity.
- **Line motif.** Auth screens and page backgrounds use a repeating diagonal line pattern (`--stitch-line-motif`) overlaid at 8-10% opacity of the primary-container color. This is the only decorative element.
- **Auth experience.** Full-screen gradient background (`--frida-gradient-background`: `#00696d` to `#002021`), centered card layout with brand header.

### Logo

- FRIDA icon (`/frida-icon.png`) displayed at `32px` (`--frida-logo-size`).
- Rendered as `<Image>` with `unoptimized` flag (no Next.js image optimization for the static PNG).
- Small drop shadow on the topbar logo instance.

---

## 3. Color Palette

All color tokens are defined in `:root` (light) with overrides in `.dark` for dark mode.

### Stitch Core Palette (Base Layer)

These are the raw color values. Every other color token maps to one of these.

#### Primary / Secondary / Tertiary

| Token | Value | Role |
|-------|-------|------|
| `--stitch-primary` | `#00696d` | Brand primary, interactive states |
| `--stitch-primary-container` | `#1ab3b9` | Container backgrounds, motif base |
| `--stitch-secondary` | `#00696d` | Secondary (same as primary) |
| `--stitch-secondary-container` | `#90eff3` | Secondary container |
| `--stitch-secondary-fixed` | `#93f2f6` | Fixed secondary, logo accent |
| `--stitch-on-secondary-fixed-variant` | `#004f52` | Text on fixed secondary, hover states |
| `--stitch-tertiary` | `#964914` | Tertiary accent (ochre) |
| `--stitch-tertiary-container` | `#e98a51` | Tertiary container |

#### Error

| Token | Value |
|-------|-------|
| `--stitch-error` | `#ba1a1a` |
| `--stitch-error-container` | `#ffdad6` |

#### Surface & Background

| Token | Value | Role |
|-------|-------|------|
| `--stitch-background` | `#f9f9f9` | App background |
| `--stitch-on-background` | `#1a1c1c` | Text on background |
| `--stitch-surface` | `#f9f9f9` | Generic surface |
| `--stitch-surface-bright` | `#f9f9f9` | Bright surface variant |
| `--stitch-surface-dim` | `#dadada` | Dim surface variant |
| `--stitch-surface-container-lowest` | `#ffffff` | Cards, topbar, sidebar |
| `--stitch-surface-container-low` | `#f3f3f3` | Warm app background alternative |
| `--stitch-surface-container` | `#eeeeee` | Muted surface, hover backgrounds |
| `--stitch-surface-container-high` | `#e8e8e8` | High container |
| `--stitch-surface-container-highest` | `#e2e2e2` | Highest container |
| `--stitch-surface-variant` | `#e2e2e2` | Surface variant |
| `--stitch-on-surface` | `#1a1c1c` | Primary text color |
| `--stitch-on-surface-variant` | `#3c494a` | Secondary text, nav items |

#### Outline & Border

| Token | Value | Role |
|-------|-------|------|
| `--stitch-outline` | `#6c7a7a` | Dark gray (frida-dark-gray maps here) |
| `--stitch-outline-variant` | `#bbc9c9` | Default borders, card borders, input borders |

#### Inverse

| Token | Value |
|-------|-------|
| `--stitch-inverse-surface` | `#2f3131` |
| `--stitch-inverse-on-surface` | `#f1f1f1` |
| `--stitch-inverse-primary` | `#55d9df` |

### Frida Semantic Palette (Application Layer)

#### Color Mappings

| Token | Value (resolved) | Maps From |
|-------|------------------|-----------|
| `--frida-primary` | `#00696d` | `--stitch-primary` |
| `--frida-gradient-start` | `#00696d` | `--stitch-primary` |
| `--frida-gradient-end` | `#002021` | literal |
| `--frida-logo-accent` | `#93f2f6` | `--stitch-secondary-fixed` |
| `--frida-dark-gray` | `#6c7a7a` | `--stitch-outline` |
| `--frida-header-text` | `#1a1c1c` | `--stitch-on-surface` |
| `--frida-app-background` | `#f9f9f9` | `--stitch-background` |
| `--frida-app-background-warm` | `#f3f3f3` | `--stitch-surface-container-low` |
| `--frida-surface` | `#ffffff` | `--stitch-surface-container-lowest` |
| `--frida-muted-surface` | `#eeeeee` | `--stitch-surface-container` |
| `--frida-border-default` | `#bbc9c9` | `--stitch-outline-variant` |
| `--frida-input-border` | `#bbc9c9` | `--stitch-outline-variant` |
| `--frida-brand` | `#00696d` | `--stitch-primary` |
| `--frida-brand-hover` | `#004f52` | `--stitch-on-secondary-fixed-variant` |
| `--frida-detail` | `#6c717e` | `--muted-foreground` |
| `--frida-gray-primary` | `#eeeeee` | `--frida-muted-surface` |

### Tailwind Semantic Shim Layer

These tokens bridge frida values to the Tailwind utility class system via `@theme inline {}`.

#### Light Mode (`:root`)

| Token | Value |
|-------|-------|
| `--background` | `#f9f9f9` |
| `--foreground` | `#1a1c1c` |
| `--card` | `#ffffff` |
| `--card-foreground` | `#1a1c1c` |
| `--primary` | `#00696d` |
| `--primary-foreground` | `#ffffff` |
| `--secondary` | `#eeeeee` |
| `--secondary-foreground` | `#1a1c1c` |
| `--muted` | `#eeeeee` |
| `--muted-foreground` | `#6c717e` |
| `--accent` | `#eeeeee` |
| `--accent-foreground` | `#1a1c1c` |
| `--destructive` | `#e33f4e` |
| `--destructive-foreground` | `#ffffff` |
| `--border` | `#bbc9c9` |
| `--input` | `#bbc9c9` |
| `--ring` | `#00696d` |

#### Dark Mode Overrides (`.dark`)

| Token | Value |
|-------|-------|
| `--background` | `#002021` |
| `--foreground` | `#f9f9f9` |
| `--card` | `#1a1c1c` |
| `--card-foreground` | `#f9f9f9` |
| `--primary` | `#00696d` |
| `--primary-foreground` | `#ffffff` |
| `--secondary` | `#6c7a7a` |
| `--secondary-foreground` | `#f9f9f9` |
| `--muted` | `#6c7a7a` |
| `--muted-foreground` | `#d7dee4` |
| `--accent` | `#00696d` |
| `--accent-foreground` | `#ffffff` |
| `--destructive` | oklch(0.396 0.141 25.723) |
| `--destructive-foreground` | oklch(0.637 0.237 25.331) |
| `--border` | `#6c7a7a` |
| `--input` | `#bbc9c9` |
| `--ring` | `#93f2f6` |

#### Sidebar Tokens

| Token | Light | Dark |
|-------|-------|------|
| `--sidebar` | `#ffffff` | `#2f3131` |
| `--sidebar-foreground` | `#1a1c1c` | `#f1f1f1` |
| `--sidebar-primary` | `#00696d` | `#55d9df` |
| `--sidebar-primary-foreground` | `#ffffff` | `#ffffff` |
| `--sidebar-accent` | `#eeeeee` | color-mix(in srgb, #55d9df 14%, transparent) |
| `--sidebar-accent-foreground` | `#00696d` | `#f1f1f1` |
| `--sidebar-border` | `#bbc9c9` | color-mix(in srgb, #f1f1f1 16%, transparent) |
| `--sidebar-ring` | `#00696d` | `#55d9df` |

#### Chart Tokens (oklch)

| Token | Light | Dark |
|-------|-------|------|
| `--chart-1` | oklch(0.646 0.222 41.116) | oklch(0.488 0.243 264.376) |
| `--chart-2` | oklch(0.6 0.118 184.704) | oklch(0.696 0.17 162.48) |
| `--chart-3` | oklch(0.398 0.07 227.392) | oklch(0.769 0.188 70.08) |
| `--chart-4` | oklch(0.828 0.189 84.429) | oklch(0.627 0.265 303.9) |
| `--chart-5` | oklch(0.769 0.188 70.08) | oklch(0.645 0.246 16.439) |

---

## 4. Typography

### Font Family

**Open Sans** is loaded via `next/font/google` with weights 300, 400, 600, 700 and assigned to the CSS variable `--font-open-sans`.

```css
--frida-font-family: var(--font-open-sans, "Open Sans", sans-serif);
```

This is set on `<body>` and bound in `@theme inline` as `--font-sans`. Open Sans was chosen deliberately for visual parity with the Mendix platform. Do not change it.

### Font Sizes

| Token | Value | Usage |
|-------|-------|-------|
| `--frida-font-size-h1` | 24px | Page titles |
| `--frida-font-size-h2` | 20px | Section headings, mobile page titles |
| `--frida-font-size-h3` | 18px | Subsection headings |
| `--frida-font-size-h4` | 16px | Card titles, dialog titles |
| `--frida-font-size-large` | 15px | Large body text |
| `--frida-font-size-default` | 14px | Body text, buttons, inputs, labels |
| `--frida-font-size-small` | 12px | Chips, metadata, secondary info |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--frida-font-weight-header` | 700 (bold) | All headings, nav items, labels, sidebar nav |
| Normal (400) | Body text, inputs |
| Semibold (600) | Buttons |

### Line Height

| Token | Value |
|-------|-------|
| `--frida-line-height-base` | 1.45 |

### Letter Spacing

- Page headings: `0` (normal)
- Sidebar nav items: `0.05em` (uppercase with tracking)
- Dropdown menu shortcuts: `tracking-widest`

---

## 5. Component Primitives & States

### Button (`@base-ui/react/button`)

Base component with `cva` variant system.

#### Variants

| Variant | Background | Text | Border | Hover |
|---------|------------|------|--------|-------|
| `default` | `--stitch-primary` (#00696d) | white | transparent | `--stitch-on-secondary-fixed-variant` (#004f52) |
| `outline` | `--stitch-surface-container-lowest` (#fff) | `--stitch-primary` | `--stitch-primary` | bg `--stitch-surface-container` |
| `secondary` | `--secondary` (muted) | `--secondary-foreground` | transparent | 80% opacity |
| `ghost` | transparent | `--stitch-on-surface` | transparent | bg `--stitch-surface-container`, text `--stitch-primary` |
| `destructive` | `--destructive` / 10% opacity | `--destructive` | transparent | 20% opacity bg |
| `link` | transparent | `--primary` | transparent | underline |

#### Sizes

| Size | Height | Icon Size | Notes |
|------|--------|-----------|-------|
| `default` | 32px (h-8) | 16px | Standard |
| `xs` | 24px (h-6) | 12px | Compact |
| `sm` | 28px (h-7) | 14px | Small |
| `lg` | 36px (h-9) | 16px | Large |
| `icon` | 32px (size-8) | 16px | Square icon button |
| `icon-xs` | 24px (size-6) | 12px | Tiny icon button |
| `icon-sm` | 28px (size-7) | -- | Small icon button |
| `icon-lg` | 36px (size-9) | -- | Large icon button |

#### States

| State | Behavior |
|-------|----------|
| Default | Base variant styles |
| Hover | Variant-specific hover background/text |
| Active (`:active`) | `translateY(1px)` via `active:not-aria-[haspopup]:translate-y-px` |
| Focus-visible | `--stitch-primary` border + 3px ring at 25% opacity |
| Disabled | `pointer-events-none`, `opacity-50` |
| Invalid (`aria-invalid`) | `--destructive` border, 3px destructive ring at 20% opacity |
| Expanded (`aria-expanded`) | Outline/ghost variants switch to active style |

### Card

#### Sizes

| Size | Padding | Gap |
|------|---------|-----|
| `default` | py-4 (16px), px-4 (16px) | gap-4 |
| `sm` | py-3 (12px), px-3 (12px) | gap-3 |

#### Sub-components

| Part | Role |
|------|------|
| `Card` | Container, `--stitch-card-radius` (6px), `--stitch-outline-variant` border, `--stitch-shadow-card` shadow |
| `CardHeader` | Title + description + optional action grid |
| `CardTitle` | 16px, semibold, `--stitch-on-surface` color |
| `CardDescription` | 14px, `--muted-foreground` |
| `CardAction` | Action slot in header (top-right) |
| `CardContent` | Body content area, px-4 |
| `CardFooter` | Bottom bar, `--stitch-surface-container-low` bg, border-top |

#### States

| State | Behavior |
|-------|----------|
| Default | Border + shadow |
| Hover | `transition-colors` (card body inherits) |

### Input (`@base-ui/react/input`)

| Property | Value |
|----------|-------|
| Height | 40px (h-10) |
| Radius | `--stitch-control-radius` (4px) |
| Border | `--stitch-outline-variant` (`#bbc9c9`) |
| Background | `--stitch-surface-container-lowest` (#fff) |
| Shadow | `--stitch-shadow-card` |
| Text color | `--stitch-on-surface` |
| Placeholder | `--muted-foreground` |

#### States

| State | Behavior |
|-------|----------|
| Default | Border `--stitch-outline-variant`, card shadow |
| Focus-visible | Border `--stitch-primary`, 3px ring at 20% opacity |
| Disabled | `pointer-events-none`, `cursor-not-allowed`, `opacity-50`, 50% bg |
| Invalid (`aria-invalid`) | `--destructive` border, 3px destructive ring at 20% opacity |

### Badge

| Property | Value |
|----------|-------|
| Height | 20px (h-5) |
| Radius | `--stitch-pill-radius` (9999px) |
| Font | 12px, semibold |
| Padding | px-2 (8px), py-0.5 (2px) |

#### Variants

| Variant | Style |
|---------|-------|
| `default` | `--primary` bg, `--primary-foreground` text |
| `secondary` | `--secondary` bg, `--secondary-foreground` text |
| `destructive` | 10% destructive bg, destructive text |
| `outline` | `--border` border, `--foreground` text |
| `ghost` | Transparent, hover gets muted bg |
| `link` | `--primary` text, underline on hover |

### Dialog (`@base-ui/react/dialog`)

| Property | Value |
|----------|-------|
| Overlay | Fixed inset, `rgba(0,0,0,0.1)`, backdrop-blur |
| Content | Rounded-xl, popover bg, ring, centered fixed position |
| Max width | `calc(100% - 2rem)`, sm breakpoint: 384px |
| Footer | Border-top, muted bg, flex row-reverse on mobile |

#### Parts

| Part | Role |
|------|------|
| `DialogTrigger` | Opens the dialog |
| `DialogOverlay` | Backdrop with blur |
| `DialogContent` | Popup panel with close button |
| `DialogHeader` | Title + description stack |
| `DialogTitle` | 16px, medium weight |
| `DialogDescription` | 14px, muted |
| `DialogFooter` | Action buttons, close option |
| `DialogClose` | Ghost icon button (X icon) |

#### States

| State | Behavior |
|-------|----------|
| Open | `animate-in`, `fade-in-0`, `zoom-in-95` |
| Closed | `animate-out`, `fade-out-0`, `zoom-out-95` |

### Tabs (`@base-ui/react/tabs`)

#### Variants

| Variant | Style |
|---------|-------|
| `default` | Muted background list, raised active tab with shadow |
| `line` | Transparent list, underline indicator on active tab |

#### Orientation

- Horizontal (default): Flex row tabs, bottom underline for line variant
- Vertical: Flex column tabs, right-side underline for line variant

#### States

| State | Behavior |
|-------|----------|
| Default | `--muted-foreground` text (60% opacity) |
| Hover | Full opacity foreground |
| Active | `--background` bg, `--foreground` text, shadow-sm |
| Focus-visible | Ring around trigger |
| Disabled | `pointer-events-none`, `opacity-50` |

### Dropdown Menu (`@base-ui/react/menu`)

| Property | Value |
|----------|-------|
| Content bg | `--popover` |
| Content radius | rounded-lg (8px) |
| Shadow | shadow-md |
| Item padding | px-1.5 (6px), py-1 (4px) |
| Item radius | rounded-md (6px) |

#### Item Variants

| Variant | Style |
|---------|-------|
| `default` | `--accent` highlight on focus, `--accent-foreground` text |
| `destructive` | `--destructive` text, destructive-tinted focus bg |

#### States

| State | Behavior |
|-------|----------|
| Default | Normal text |
| Focus/hover | `--accent` bg, `--accent-foreground` text |
| Disabled | `opacity-50`, no pointer events |
| Open (open) | `animate-in`, `fade-in-0`, `zoom-in-95` |
| Closed | `animate-out`, `fade-out-0`, `zoom-out-95` |

### Chip (`.mx-admin-chip` utility class)

| Property | Value |
|----------|-------|
| Radius | 9999px (pill) |
| Border | `--frida-input-border` |
| Padding | 4px 12px |
| Font | `--frida-font-size-small` (12px) |
| Transition | 160ms ease (border-color, background, color) |

#### States

| State | Behavior |
|-------|----------|
| Default | Border `--frida-input-border` |
| Hover | Border `--frida-primary` |
| Selected (`.mx-admin-chip--selected`) | `--frida-primary` bg + border, `--frida-surface` text |

---

## 6. Spacing, Layout & Grid

### Spacing Scale

Two parallel spacing systems exist. Use frida tokens for semantic spacing, stitch tokens for direct reference.

| Stitch Token | Frida Token | Value |
|-------------|-------------|-------|
| `--stitch-space-xs` | `--frida-space-smaller` | 4px |
| `--stitch-space-sm` | `--frida-space-small` | 8px |
| `--stitch-space-md` | `--frida-space-medium` | 16px |
| `--stitch-space-lg` | `--frida-space-large` | 24px |
| `--stitch-space-xl` | `--frida-space-larger` | 32px |
| -- | `--frida-space-smallest` | 2px |
| -- | `--frida-space-largest` | 48px |

### Border Radii

| Token | Value | Usage |
|-------|-------|-------|
| `--stitch-control-radius` | 4px | Buttons, inputs, form controls, sidebar items, alerts |
| `--stitch-card-radius` | 6px | Cards, dialogs, table cards, legal cards, auth cards |
| `--stitch-pill-radius` | 9999px | Badges, chips |
| `--radius` | 4px | Tailwind `rounded-*` base (maps from `--stitch-control-radius`) |
| `--radius-sm` | 0px | Tailwind `rounded-sm` (calc(--radius - 4px)) |
| `--radius-md` | 2px | Tailwind `rounded-md` (calc(--radius - 2px)) |
| `--radius-lg` | 4px | Tailwind `rounded-lg` (= --radius) |
| `--radius-xl` | 6px | Tailwind `rounded-xl` (= --frida-card-radius) |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--stitch-shadow-card` | `0 2px 4px rgb(0 0 0 / 5%)` | Cards, inputs, buttons (default variant) |
| `--stitch-shadow-topbar` | `0 1px 2px rgb(26 28 28 / 10%)` | Topbar (mapped to `--frida-topbar-shadow`) |
| `--frida-shadow-topbar` | `0 1px 1px 1px #556B8240` | Alternative topbar shadow (less used) |
| `--frida-shadow-sidebar` | `0 0 4px rgb(0 0 0 / 14%), 2px 4px 8px rgb(0 0 0 / 28%)` | Sidebar |
| `.mx-admin-dialog` | `0 8px 24px rgb(26 28 28 / 12%)` | Dialog popups |
| `.frida-auth-card` | `0 18px 40px rgb(0 0 0 / 18%)` | Auth card |

### Layout Dimensions

| Token | Value | Usage |
|-------|-------|-------|
| `--stitch-topbar-height` | 56px | Top navigation bar |
| `--stitch-sidebar-width` | 240px | Sidebar open state |
| `--stitch-sidebar-width-collapsed` | 56px | Sidebar collapsed state (icons only) |
| `--frida-mobile-header-height` | 45px | Mobile topbar height |
| `--frida-logo-size` | 32px | Logo image dimensions |

### Page Layout

#### App Shell

```
+---------------------------------------------+
|  Topbar (56px, sticky, z-50)                 |
+------+--------------------------------------+
|      |                                       |
| Side |  Main content area                    |
| bar  |  (.mx-admin-page or .frida-content-   |
| open |   page)                               |
| 240  |  padding: 24px                        |
| px / |  bg: line-motif + app-background      |
| 56px |                                       |
| coll |                                       |
| apse |                                       |
| d)   |                                       |
|      |                                       |
+------+--------------------------------------+
|  Footer (border-top, 32px logo + links)      |
+----------------------------------------------+
```

- Topbar: Sticky, full width, border-bottom, z-50.
- Sidebar: Collapsible (open 240px, collapsed 56px icons only), border-right, managed by `SidebarProvider`.
- Main: `min-width: 0`, `flex: 1`, column layout.
- Footer: Border-top, centered content, FRIDA icon + copyright + nav links.

#### Page Content Widths

| Width | Max | Usage |
|-------|-----|-------|
| Narrow | 56rem (896px) | `.mx-admin-page--narrow` |
| Wide | 80rem (1280px) | `.mx-admin-page--wide`, auto-centered |

#### Page Template Classes

| Class | Purpose |
|-------|---------|
| `.mx-admin-page` | Standard admin page, padding 24px, min-height fills below topbar |
| `.mx-admin-pageheader` | Page title + description + optional actions, margin-bottom 24px |
| `.mx-admin-card` | Card container, border + radius + shadow |
| `.mx-admin-table-card` | Table wrapper with card styling |
| `.mx-admin-empty-state` | Centered empty state, transparent card, min-height 200px |
| `.mx-admin-dropzone` | Dashed border drop zone, 48px padding |
| `.mx-admin-alert` | Error/warning/success alert banners |
| `.mx-admin-form-label` | Bold form labels |
| `.frida-screen` | Generic full-height screen below topbar |
| `.frida-content-page` | Content page with 24px padding |
| `.frida-legal-page` | Legal pages (impressum/datenschutz), 48px vertical padding |
| `.frida-legal-card` | Legal content card, max-width 56rem |
| `.frida-auth-shell` | Auth screen, full gradient background, centered grid |
| `.frida-auth-card` | Auth form card, max-width 420px |

#### Responsive Breakpoints

| Breakpoint | Changes |
|------------|---------|
| `< 640px` | Page padding reduces to 16px, pageheader stacks vertically, h1 shrinks to 20px, empty/dropzone padding reduces to 32px/16px |
| `< 768px` | Topbar nav items hidden (`.hidden md:flex`) |

---

## 7. Motion & Interaction Patterns

### Current State

No motion library is in use. All animations are CSS transitions and the `tw-animate-css` utility classes.

### Transition Durations

| Context | Duration | Easing | Property |
|---------|----------|--------|----------|
| Chip hover/select | 160ms | ease | border-color, background, color |
| Dialog overlay | 100ms | -- | opacity |
| Dialog content | 100ms | -- | opacity, transform (zoom) |
| Button hover | instant | -- | background-color (transition-all) |
| Card | instant | -- | transition-colors |
| Default Tailwind | 150ms | ease | (via Tailwind default) |

### Animation Patterns

#### Entry / Exit (`data-open` / `data-closed`)

Dialogs and dropdown menus use these `tw-animate-css` classes:

| Pattern | Classes |
|---------|---------|
| Dialog open | `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` |
| Dialog close | `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` |
| Menu open | `data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95` |
| Menu close | `data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95` |
| Menu slide | `data-[side=bottom]:slide-in-from-top-2` (and per-side variants) |

#### Dropdown Arrow Indicator

Dropdown menu items with submenus use a `ChevronRightIcon` that rotates or appears on hover via CSS.

#### Button Press

All buttons get a `translateY(1px)` on `:active` (except elements with `aria-haspopup`).

### Hover Interactions

| Element | Effect |
|---------|--------|
| Nav link (topbar) | Background to `--stitch-surface-container`, text to `--stitch-primary` |
| Nav link (active, topbar) | Background to `--stitch-primary`, text to white |
| Sidebar item | Background to `--stitch-surface-container`, text to `--stitch-primary` |
| Sidebar item (active) | Left border `--stitch-primary` (4px), bg `--stitch-surface-container` |
| Dropzone | Border to `--stitch-primary` |
| Table row | `--frida-primary` tint at 7% |
| Footer link | Text to `--stitch-primary` |
| Avatar | Opacity 80% |

### Dark Mode Toggle

The dark mode toggle is **defined but not wired**. The `Header` component accepts `onToggleDark` and `isDark` props and renders a `MoonIcon`/`SunIcon` button, but no caller in the application passes these props. Dark mode activation is planned for T5.

---

## Appendix: Tailwind Theme Bindings

The `@theme inline {}` block in `globals.css` maps design tokens to Tailwind utility names:

```css
@theme inline {
  --color-background: var(--background);
  --color-frida-primary: var(--frida-primary);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: var(--frida-card-radius);
  --shadow-frida-input: var(--frida-input-shadow);
  --shadow-frida-topbar: var(--frida-topbar-shadow);
  --shadow-frida-sidebar: var(--frida-sidebar-shadow);
  --spacing-frida-topbar: var(--frida-topbar-height);
  --spacing-frida-sidebar-open: var(--frida-sidebar-width-open);
  --spacing-frida-sidebar-collapsed: var(--frida-sidebar-width-collapsed);
  --font-sans: var(--frida-font-family);
}
```

This means you can use Tailwind utilities like `bg-frida-primary`, `shadow-frida-input`, `rounded-xl`, `mt-frida-topbar`, and `font-sans` throughout the codebase.

---

## Appendix: Token Reference Summary

| Category | Count | Prefix |
|----------|-------|--------|
| Stitch core colors | 28 | `--stitch-*` |
| Stitch radii/spacing/layout | 10 | `--stitch-*` |
| Frida semantic colors | 20+ | `--frida-*` |
| Frida spacing | 7 | `--frida-space-*` |
| Frida typography | 10 | `--frida-font-*` |
| Frida shadows/borders | 5+ | `--frida-shadow-*`, `--frida-*-border` |
| Frida layout | 6 | `--frida-*-height`, `--frida-*-width` |
| Tailwind shim | 20+ | `@theme inline` |
| Dark mode overrides | 20+ | `.dark` block |
