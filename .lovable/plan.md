

## Problem

The "Mi Perfil" tab exists in the navigation but is cut off because the horizontal tab bar overflows. On the screenshot, the last visible tab is "Facturación" — "Mi Perfil" requires horizontal scrolling to reach, which users don't notice.

## Solution

Restructure the dashboard tab navigation to ensure all tabs are visible and accessible:

### 1. Make tab navigation wrap or use a more compact layout

**File: `src/pages/Dashboard.tsx`** (~lines 428-447)

- Replace the single-row horizontal scroll with a **two-row wrapping grid on mobile** and keep the horizontal bar on desktop
- Change `flex gap-1 min-w-max` to `flex flex-wrap gap-1` so tabs wrap to a second line instead of scrolling off-screen
- Remove `overflow-x-auto` and `min-w-max` — these are what hide the last tabs
- Ensure labels are always visible (remove `hidden sm:inline` from the `<span>`) but use shorter labels on small screens (e.g., "Perfil" instead of "Mi Perfil", "Autos" instead of "Mis autos") to fit

### 2. Alternative: Use a compact icon-only mobile nav with labels below

If wrapping looks too crowded, use a **scrollable nav with a visible scroll indicator** or add a visual cue (gradient fade on the right edge) so users know there's more to scroll.

**Recommended approach**: Wrapping flex with shorter labels is simplest and most discoverable.

### Changes summary

- `renderNavigation()`: Remove `overflow-x-auto`, `min-w-max`, `-mx-4 px-4`
- Change to `flex flex-wrap gap-1.5`
- Always show labels (remove `hidden sm:inline`)
- Shorten mobile labels to fit: "Dashboard", "Plan", "Próximos", "Autos", "Historial", "Facturación", "Perfil"

