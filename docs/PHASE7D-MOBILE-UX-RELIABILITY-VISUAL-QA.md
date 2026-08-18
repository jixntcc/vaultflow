# Phase 7D — Mobile UX Reliability & Visual QA

## Status: IMPLEMENTED

Phase 7D hardens the existing Phase 7A/7B mobile foundation without changing domain contracts or financial/habit business logic.

## Mobile reliability changes

### Viewport
- Exactly one viewport declaration in the document head.
- `width=device-width` remains the canonical mobile viewport.

### Touch interaction
A shared mobile baseline now guarantees:
- 44px minimum button/action targets
- 44px minimum form-control height
- 16px mobile form text to reduce browser zoom behavior
- `touch-action: manipulation`
- visible `:focus-visible` states

### Horizontal overflow
The page is guarded against accidental horizontal scrolling.
Dense data/table regions are allowed to scroll inside their own containers.

### Cards
Common mobile card surfaces receive:
- `min-width: 0`
- `max-width: 100%`

This prevents long labels/data from forcing the page wider than the viewport.

### Modals
Mobile modals now:
- respect safe-area insets
- use `100dvh`-aware maximum height
- scroll internally
- preserve footer space above the device safe area
- use contained overscroll behavior

### Small screens
At 480px and below:
- tighter page header spacing
- responsive page-title sizing
- flexible button labels
- safer modal radius
- safe-area-aware floating action button position

### Accessibility
Reduced-motion preferences are honored.

## Existing interaction coverage

The Phase 7B domain contracts remain intact:

- Transactions — shared desktop/mobile edit/delete action renderer
- Vaults — edit/delete
- Goals — open/edit/delete
- Habits — complete/skip/history actions
- Reports — filters/refresh
- Intelligence — refresh/search/domain actions
- Settings — backup/restore and settings actions

No domain contract was replaced.

## Visual QA limitation

This phase includes static visual/structural QA and mobile CSS hardening.

The repository does not contain Playwright or another browser automation dependency, so this pass does not claim to have produced real device screenshots or pixel-level browser rendering measurements.

The next browser-based QA step should run against actual viewport sizes such as:

- 320×568
- 360×800
- 390×844
- 412×915
- 768×1024

and verify:
- no horizontal page overflow
- modal keyboard behavior
- scroll locking
- touch targets
- card wrapping
- transaction edit/delete
- vault edit/delete
- goal edit/delete
- habit actions
- report filters
- settings forms

## Validation

Focused Phase 7D test: PASS

Full regression:
- PASS: 42
- SKIP: 1
- FAIL: 0

The remaining skip is the known live staging HTTP suite because `STAGING_BASE_URL` is not configured.

## Architectural rule

Phase 7D does not create mobile-specific business logic.

The rule remains:

`Entity → View Model → Action Contract → shared behavior → responsive presentation`.
