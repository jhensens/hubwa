# Hobart Hub

## What is this?
A PWA for hospitality venue management. Two venues: **Bar Wa Izakaya** (BWI) and **Lost In Asia** (LIA), both in Hobart, Tasmania. Built with vanilla JS + Firebase — no frameworks.

## Architecture
- Single-page app, all state on `window` namespace
- Firebase Firestore + localStorage (offline-first)
- `window.saveToDisk()` persists to localStorage (immediate) + Firebase (debounced 3-4s, merge:true)
- Daily auto-backups to Firebase `backups` collection (7-day rolling)
- Service worker for offline caching
- Firebase Hosting at hobart-hub.web.app

## Critical Rules
- **ALWAYS bump `sw.js` CACHE_NAME date before running `firebase deploy --only hosting`** — without this, browsers serve stale cached JS
- **localhost:8080 writes to the REAL Firebase database** — treat it as a live environment for data
- When using `recipeName` on inventory items, always use the pattern `inv.recipeName||inv.name` to fall back gracefully
- The `_rawName` field on recipe ingredients preserves the original recipe text from before AI batch linking — never delete it

## Key Files
| File | Lines | Purpose |
|------|-------|---------|
| `core.js` | ~430 | Global state, utilities, 47 save keys, modals |
| `storage.js` | ~190 | saveToDisk(), Firebase sync, backup, import/export |
| `inventory.js` | ~1,700 | Stock, PAR levels, suppliers, recipeName field |
| `recipes.js` | ~870 | Recipe costing, GP calc, ingredient linking |
| `depletion.js` | ~1,500 | POS linking, wastage, BWI Smart Matcher |
| `menu-engineering.js` | ~650 | AI recipe import (Gemini), batch linking |
| `compliance.js` | ~950 | Rotational tasks, checklists, temp logging |
| `dashboard.js` | ~1,170 | KPIs, covers tracker, handover/debrief |
| `engagement.js` | ~1,690 | Roster, badges, announcements, staff hub |
| `nav.js` | ~260 | View routing, global search, role-based access |

## Data Model
- `window.saveKeys` (core.js) — 56 arrays that get persisted
- Firebase doc: `venueData/{docId}` — one doc per venue, merge writes
- Backups: `backups/{venueId}_{YYYY-MM-DD}` — daily, 7-day retention
- Manual export: JSON download via sidebar button

## Venues
| Venue | ID | Firebase docId |
|-------|----|----------------|
| Bar Wa Izakaya | bwi | hobartHub |
| Lost In Asia | lia | lia |

## Recipe & Inventory System
- Inventory items have a `recipeName` field — clean display name (e.g. "Unsalted Butter" vs "500gm Unsalted Butter-Dairy Farmers (12)")
- Recipe ingredients link to inventory via `ing.type='inv'` + `ing.ref` (inventory item ID)
- `ing.name` is frozen at link time — use live lookup `inv.recipeName||inv.name` for display
- `ing._rawName` preserves original recipe text from before AI batch linking
- `commitBatchLinks()` in menu-engineering.js handles bulk ingredient-to-inventory linking

## POS Depletion System
- 4-level cascade: posMappings → recipe.posAlias → recipe.name → direct inventory match
- BWI Smart Matcher: `_bwiPOSClean()` strips venue tags + `_bwiAliasMap` (177 curated aliases)
- 3-phase matching: alias lookup → fuzzy match → token overlap

## Conventions
- All global functions on `window` namespace
- Private/internal functions use underscore prefix: `window._internalFunc`
- HTML escaping via `window.esc()` — always use for user content
- Modals via `window.openModal()`, toasts via `window.showToast()`
- IDs generated via `window.generateId(prefix)` e.g. `generateId('inv')` → `inv_abc123`
