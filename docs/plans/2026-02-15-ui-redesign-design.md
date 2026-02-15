# Aura UI Redesign — "Obsidian Glass"

| Field           | Value                |
|-----------------|----------------------|
| **Created**     | 2026-02-15           |
| **Status**      | Approved             |
| **Aesthetic**   | Linear/Raycast-inspired, dark, refined, premium |

---

## Aesthetic Direction

Dark, refined interface with precision and restraint. Deep charcoal/slate palette with electric blue accent used sparingly. Sharp geometric typography. Subtle purposeful animations. Information-dense but not cluttered.

---

## Layout & Navigation

**Icon Rail (48px, fixed left)**
- Background: `--bg-raised` (#0f1117), 1px right border with faint glow
- Icons: 20px, stroke-style, muted by default
- Active: electric blue accent with soft pill-shaped background highlight
- Hover: brighten with 150ms transition
- Top: Aura logo mark. Bottom: settings gear (separated by spacer)

**Nav items:** Issues, Pull Requests, Repos (top). Settings (bottom-pinned).

**Main content area**
- Background: `--bg-base` (#0a0c10, near-black with blue tint)
- Header bar per page: title (left), actions (right), subtle bottom border
- Content scrolls independently below header
- Max-width ~1200px, centered on ultra-wide

**Typography**
- Headings: Geist Sans (geometric, sharp)
- Data/values: Geist Mono (branch names, issue keys, timestamps)
- Scale: 13px body, 12px secondary, 11px meta, 18px page titles

---

## Unified Issue & PR Lists

**Row anatomy (~52px tall)**
- Left: provider icon (16px, muted)
- Center: title (13px, white, truncated) + meta line (12px, mono, muted) showing `owner/repo #123` or `PROJ-456`
- Right: status pill (tiny, color-coded) + time ago (11px, muted)
- Far right: label dots/micro-pills (up to 2)

**PR rows** swap meta for: repo name + source → target branch (monospace with arrow glyph)

**Interactions**
- Hover: row bg shifts to `--bg-hover` (#141720), 120ms ease
- Click: opens in browser (external link icon appears on hover)
- Staggered fade-in on load (30ms delay, first 20 items)

**Filtering**
- Pill-shaped filter chips in header: Provider, Status, Sort
- Active filters: accent color background
- Sort: Updated (default), Created, Priority

**States**
- Loading: shimmer skeleton rows (3-4)
- Empty: centered icon + message + suggestion
- Error: inline banner per provider, dismissable, retry button

---

## Repos Page

**Folder tree**
- Folder nodes: 36px tall, 20px indent per level
- Folder icon + name (13px) + repo count pill (muted, right)
- Chevron rotates 90deg on expand (150ms CSS)
- Expanded: subtle left border line connecting children

**Repo rows (~44px)**
- Left: colored dot (green=clean, amber=dirty)
- Name (13px, white) + branch name (12px, mono, muted) with git-branch icon
- Right (hover reveal, 120ms fade): tool launch icon buttons (28px, ghost style, tooltips)

**Header:** Title + refresh button (spin while scanning) + repo count badge

---

## Settings Page

**Card-based layout** — single column, max-width ~720px, centered.

Cards: subtle border (#1e2130), rounded-lg, bg `--bg-raised`.
Each card: title (14px, semi-bold), description (12px, muted), content.

**Cards:**
1. **GitHub** — status dot + "Connected as @user" or "Not connected" + re-check button
2. **Azure DevOps** — same pattern with org/project info
3. **Jira Cloud** — status when connected, expandable form (URL, email, token) when not
4. **FogBugz** — same as Jira
5. **Scan Directories** — path list (mono) with X remove buttons, autocomplete input at bottom
6. **Detected Tools** — 2-column grid of tool badges (icon + name + availability dot)

**States:** Connected = green dot, "Connected as X". Disconnected = muted, action button. Checking = spinner replacing dot.

---

## Motion & Polish

**Page transitions**
- Content fades in + 8px upward slide (200ms ease-out)
- No exit animation (instant feels snappier)

**List stagger**
- 30ms delay per item, capped at 20. CSS-only animation-delay.

**Micro-interactions**
- Nav icon hover: brighten + scale(1.05), 150ms
- Active nav: pill bg slides via CSS transition on pseudo-element
- Buttons: bg darken on press, 100ms
- Filter chips: smooth bg color transition
- Refresh: icon spin while loading
- Settings status dots: single pulse on mount when connected

**Skeleton loading**
- CSS gradient shimmer (left-to-right sweep)
- 3-4 rows matching actual row dimensions

---

## Color System (CSS Variables)

```
--bg-base: #0a0c10
--bg-raised: #0f1117
--bg-hover: #141720
--border: #1e2130
--text-primary: #e2e4e9
--text-secondary: #6b7280
--text-tertiary: #3d4350
--accent: #3b82f6
--accent-muted: #1e3a5f
--status-green: #22c55e
--status-amber: #f59e0b
--status-red: #ef4444
```

## Fonts

- Geist Sans — headings, UI labels
- Geist Mono — data values, code, keys

Loaded via @font-face (local files or CDN). No external animation libraries — all CSS-only.

---

## Scope

This redesign covers the frontend only. No changes to:
- Rust backend / Tauri commands
- Hooks / data fetching logic
- TypeScript types
- Business logic

All existing functionality is preserved with a new visual layer.
