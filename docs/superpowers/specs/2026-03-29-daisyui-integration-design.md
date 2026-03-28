# DaisyUI Integration Design Spec

## Overview

Fully replace the app's bespoke Tailwind component layer with DaisyUI v4. Simultaneously apply Outfit as the app font, configure `night` + `corporate` themes with a persistent toggle, and build a responsive, one-handed-friendly layout with a bottom tab bar on mobile.

---

## Decisions

| Decision | Choice |
|---|---|
| Migration strategy | Full rewrite — all custom classes replaced in one branch |
| Dark theme | `night` |
| Light theme | `corporate` |
| Font | Outfit (Google Fonts, weights 400–700) |
| Mobile navigation | Bottom tab bar (`btm-nav`) + FAB for "New Bet" |
| Theme persistence | `localStorage` via `ThemeProvider` component |

---

## 1. Installation & Config

### Package
```bash
npm install daisyui@latest
```

### `tailwind.config.ts`
- Add `require('daisyui')` to `plugins`
- Add top-level `daisyui` config:
  ```ts
  daisyui: { themes: ['night', 'corporate'] }
  ```
- Remove `theme.extend.colors` (`primary`, `success`, `danger`, `warning`) — replaced by DaisyUI CSS variables
- Add font override:
  ```ts
  theme: { extend: { fontFamily: { sans: ['Outfit', 'sans-serif'] } } }
  ```

### `app/globals.css`
- Remove the entire `@layer components` block (all `.btn-*`, `.card`, `.card-sm`, `.input`, `.label`, `.table`, `.badge-*`, `.modal`, `.modal-content`, `.stat-card`, `.stat-label`, `.stat-value`, `.nav-link`, `.nav-link-active`)
- Replace Google Fonts import with Outfit:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
  ```
- Update `body` font to `'Outfit', sans-serif`
- Keep: base resets, scrollbar styles, `input[type=number]` spin-button tweak, `select` arrow SVG, `input[type=date]` calendar picker filter, reduced-motion media query

---

## 2. Themes & Font

### `components/ThemeProvider.tsx`
Client component. On mount, reads `localStorage.getItem('theme')` (defaults to `'night'`). Sets `document.documentElement.setAttribute('data-theme', theme)`. Exposes a `useTheme()` hook returning `{ theme, toggle }`. Toggle writes back to `localStorage` and updates the attribute.

### Theme Toggle Button
A `btn btn-ghost btn-circle` button with a sun/moon icon (Lucide `Sun` / `Moon`). Placed in:
- Desktop: sidebar footer
- Mobile: top-right of the mobile header bar

---

## 3. Layout & Navigation

### Desktop (md+)
Existing sidebar structure is preserved. Sidebar nav items use DaisyUI `menu` + `menu-item`. Active item uses `active` class on `<li>`. Theme toggle in sidebar footer.

### Mobile (< md)
**Bottom tab bar** using DaisyUI `btm-nav`. Fixed at the bottom of the viewport. 4 tabs, role-aware:

| Role | Tabs shown |
|---|---|
| ADMIN | Dashboard, Bets, Series, Admin |
| USER | Dashboard, Bets, Series, History |
| FRIEND | Dashboard, Bets, Notifications |

Tab bar lives inside each role layout: `app/dashboard/layout.tsx` (new), `app/admin/layout.tsx` (new), `app/friend/layout.tsx` (update existing).

**FAB** — `btn btn-primary btn-circle` fixed above the tab bar (`bottom-20 right-4`) on pages where "New Bet" is relevant (`/dashboard`, `/dashboard/new-bet`).

**Mobile header** — a slim top bar (visible only on mobile) showing the current page title and the theme toggle. Hidden on desktop (`md:hidden`).

### Modals
All modals use `modal-bottom sm:modal-middle` so they slide up as a bottom sheet on mobile. Thumb-friendly confirm/cancel buttons stacked vertically on mobile, horizontal on desktop.

### Scroll padding
All scrollable page containers get `pb-20 md:pb-0` to prevent content hiding behind the bottom nav on mobile.

---

## 4. Component Mapping

Every page and component is updated. No custom component classes remain in `globals.css`.

| Current class | DaisyUI replacement |
|---|---|
| `.btn-primary` | `btn btn-primary` |
| `.btn-secondary` | `btn btn-neutral` |
| `.btn-danger` | `btn btn-error` |
| `.btn-success` | `btn btn-success` |
| `.btn-ghost` | `btn btn-ghost` |
| `.card` / `.card-sm` | `card bg-base-200 shadow-sm` + `card-body` |
| `.input` | `input input-bordered w-full` |
| `.label` + `label` element | `label` + `label-text` (DaisyUI label structure) |
| `.table` + `th`/`td` styles | `table table-zebra` (wrapper in `overflow-x-auto`) |
| `.badge-success` | `badge badge-success` |
| `.badge-warning` | `badge badge-warning` |
| `.badge-danger` | `badge badge-error` |
| `.badge-info` | `badge badge-info` |
| `.badge-muted` | `badge badge-ghost` |
| `.modal` | `modal modal-open` |
| `.modal-content` | `modal-box` |
| `.stat-card` / `.stat-label` / `.stat-value` | `stats shadow` → `stat` → `stat-title` / `stat-value` |
| `.nav-link` / `.nav-link-active` | `li` + `a` inside DaisyUI `menu`; active via `active` on `<li>` |

**Select elements:** Wrap in `select select-bordered w-full` and remove the custom SVG arrow background from `globals.css`.

**Toast / Alert:** Existing `useToast` hook is kept. The `Toast` component is restyled to use DaisyUI `alert` classes (`alert alert-success`, `alert alert-error`, `alert alert-warning`, `alert alert-info`) instead of hand-rolled styles.

---

## 5. UX Principles

### One-Handed Usability
- All interactive targets minimum 44×44px (DaisyUI `btn` default satisfies this)
- Destructive confirmation dialogs use `modal-bottom` (bottom sheet, not center dialog)
- Forms are full-width on mobile; labels always above inputs
- Page content has `pb-20 md:pb-0` to clear the fixed bottom nav
- FAB for primary action ("New Bet") reachable with right thumb

### Micro-interactions
- Buttons show `loading loading-spinner` during async operations (replace hand-rolled SVG spinner)
- Initial data fetches show `skeleton` placeholders to prevent layout shift
- Badge status transitions use `transition-colors duration-300`
- All interactive elements retain `transition-all duration-200` for hover/focus feedback
- Form errors shown inline below the field using DaisyUI `label` + `label-text-alt text-error`

### Findable
- Breadcrumbs (`breadcrumbs` DaisyUI) on deep pages: Series detail, Admin subsections
- Mobile header shows current page title on every screen
- Empty states include a clear CTA (e.g. "No bets yet" + "Add Bet" button)
- Bets list page gets a search/filter bar (`input input-bordered` with Lucide `Search` icon)

### Credible
- All P&L values formatted with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`
- Skeleton loaders on every data-fetching page (no blank flash)
- Specific API error messages surfaced to the user (not generic fallback text)
- Settlement badge colors are consistent across all pages: `badge-success` = collected, `badge-warning` = pending, `badge-error` = lost/disputed

---

## 6. Files Affected

### New files
- `components/ThemeProvider.tsx` — theme context + toggle hook
- `app/dashboard/layout.tsx` — dashboard layout with sidebar (desktop) + btm-nav (mobile)
- `app/admin/layout.tsx` — admin layout with sidebar + btm-nav

### Modified files
- `tailwind.config.ts` — DaisyUI plugin + themes + Outfit font
- `app/globals.css` — remove @layer components, update font
- `app/layout.tsx` — wrap with `ThemeProvider`
- `app/friend/layout.tsx` — add btm-nav
- `components/Toast.tsx` — restyle with DaisyUI alert classes
- All 17 page files — replace custom classes with DaisyUI equivalents

### Unchanged
- All API routes, Prisma schema, lib/ files — no backend changes
