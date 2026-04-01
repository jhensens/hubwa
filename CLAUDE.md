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
| `core.js` | ~430 | Global state, utilities, 49 save keys, modals, confirmAction |
| `storage.js` | ~190 | saveToDisk(), Firebase sync, backup, import/export |
| `auth.js` | ~280 | PIN hashing (SHA-256), lock state, auto-lock, role-based access |
| `nav.js` | ~265 | View routing (59 views), global search, ID generation |
| `notifications.js` | ~260 | Audit logging, print reports, DOMContentLoaded init |
| `venues.js` | ~190 | Multi-venue framework, venue switching, theming |
| `inventory.js` | ~1,876 | Stock, PAR, suppliers, yield fixers, price trends, Where Used, 8 sort modes |
| `recipes.js` | ~1,305 | Recipe costing, GP calc, ingredient linking (inv+batch), reordering, auto-reparse |
| `depletion.js` | ~1,590 | POS linking, wastage, BWI Smart Matcher (177 aliases) |
| `menu-engineering.js` | ~650 | AI recipe import (Gemini 2.5 Flash), batch linking |
| `compliance.js` | ~1,010 | Rotational tasks, checklists, temp logging (freezer/fridge aware), overview widget |
| `dashboard.js` | ~1,245 | KPIs, covers tracker, handover/debrief, version info |
| `engagement.js` | ~1,690 | Roster, badges, announcements, staff hub |
| `analytics.js` | ~700 | Sales analytics, GP reports, weekly summaries |
| `documents.js` | ~805 | Knowledge base (SOPs), digital safe |
| `invoices.js` | ~800 | Invoice processing, supplier linking |
| `ordering.js` | ~660 | PAR-based ordering, order history |
| `stocktake.js` | ~730 | Stock count workflow, reconciliation |
| `staff.js` | ~566 | Staff directory, qualifications, onboarding |
| `tanda.js` | ~390 | Tanda roster sync, timesheet integration |
| `sw.js` | ~102 | Service worker, app shell caching (31 files) |

## Data Model
- `window.saveKeys` (core.js) — 49 arrays that get persisted
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
- Ingredients can also link to batch recipes: `ing.type='batch'` + `ing.ref` (recipe ID)
- Unlinked ingredients: `ing.type='raw'` — $0 cost, shows clickable link button
- `ing.name` is frozen at link time — use live lookup `inv.recipeName||inv.name` for display
- `ing._rawName` preserves original recipe text from before AI batch linking — never delete
- `ing._qtyConfirmed` flag marks ingredients where qty=1 is intentionally correct
- `commitBatchLinks()` in menu-engineering.js handles bulk ingredient-to-inventory linking
- `recalcAllCosts()` recalculates ALL recipe costs (batches first, then menus)
- `cascadeRecipeCosts([invIds])` recalculates only recipes using specific inventory items
- Cost formula: `ingredientCost = ing.qty * (inv.price / inv.yield)` — GP target: 67%
- Batch recipes flow cost through: batch ingredients -> batch cost/yieldQty -> menu recipe cost

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
