# HOBART HUB — Technical Handover v3

**Date:** 26 March 2026
**Session 4 Complete** — Role-Based Access, SW Cache Versioning, Print Exports
**Total Codebase:** ~13,175 lines across 6 source files

---

## WHAT WAS DONE IN SESSION 4

### 1. Unified Stock Depletion Pipeline (from earlier in session)
- Multi-level batch cascade (recipes → sub-recipes → ingredients)
- Unified confirmation UI for both CSV and AI depletion paths
- Stock Impact Preview before committing
- Depletion Log populating on Takings page (was always empty before)
- Duplicate day detection with Add/Replace options
- Undo/reversal with REVERSED badge
- Depletion History view with navigation

### 2. Service Worker Cache Versioning
- **sw.js**: `CACHE_NAME = 'hobart-hub-20260325'` — bump date on each deploy
- **index.html**: Update-aware registration — detects new SW, shows blue "Update available — tap to reload" banner
- Checks for updates every 30 minutes
- Version number displayed in sidebar footer (`hobart-hub-20260325`)
- `GET_VERSION` message handler in SW for querying current version

### 3. Print-Friendly Exports
- **`window.printReport(title, html, options)`** in core.js — reusable print template with venue branding, date header/footer, clean table styles, A4/landscape support
- **Temperature Log print** — `window.printTempLog()` in mgmt.js, last 30 entries, PASS/FAIL colour coding
- **Stock Levels print** — `window.printStockLevels()` in ops.js, grouped by category, below-PAR flags
- **Stocktake Report print** — `window.printStocktakeReport(id)` in ops.js, variance analysis per item
- Enhanced `@media print` CSS — hides sidebar, header, update banner

### 4. Role-Based Access Control
- **5 roles**: FOH, BOH, Bar, Kitchen Hand, Manager
- **`allowedViews`** per role in `staffHubConfig.roles` — configurable via Staff Hub Config view
- **`window.applyRoleAccess()`** — filters sidebar nav items based on role, hides entire sections if no visible children
- **`showView()` enforcement** — blocks navigation to views outside role's allowedViews
- **Dashboard financial gating** — `_showFinancials` flag hides:
  - Revenue/Labor/P&L cards
  - AI Morning Briefing
  - 7-Day Revenue chart
  - Quick Actions (manager-only: All Venues, EOD Summary, EOD Run, Handover, Covers, Ask Hub)
  - Margin Alerts
  - Recent Handover notes
- **Audit log** now records `user` field (staff name, Manager, or System)
- **Auto-lock** clears staff session
- **Section collapse** restores from localStorage on staff logout
- **Staff Hub Config** — green "Allowed Views" toggle pills per role

---

## FILE MANIFEST

| File | Lines | Purpose |
|------|-------|---------|
| core.js | ~1,752 | Global state, PIN system, Firebase sync, Tanda integration, modals, search, notifications, venue management, printReport utility, role-based access |
| ops.js | ~5,140 | Inventory, recipes, ordering, invoices, wastage, stocktake, AI features, menu engineering, print functions |
| mgmt.js | ~5,355 | Dashboard, analytics, staff hub, maintenance, handover, incidents, roster, digital safe, knowledge base, noticeboard, badges, staff hub config |
| style.css | ~595 | Dark theme, responsive design, mobile optimizations, print CSS, update banner animation |
| index.html | ~251 | App shell, sidebar with data-view attributes, Firebase init, SW registration with update detection |
| sw.js | ~82 | Service Worker: cache-first for app shell, network-first for APIs, version messaging |

---

## GLOBAL STATE: 47 DATA ARRAYS

All persisted via `window.saveToDisk()` → localStorage (immediate) → Firebase Firestore (debounced 4s).

**Core**: inventoryItems, recipes, salesData, suppliers, posMappings
**Logs**: wastageLogs, tempLogs, complianceLogs, defectLogs, contractorLogs, depletionLogs
**Staff**: staffDirectory, orientationLogs, rotationalTasks, taskHistory, shiftFeedbackTags, shiftRosters, shiftChecklistItems
**Docs**: knowledgeBase, digitalSafe, phoneBook
**Incidents**: incidentLogs, handoverLogs
**Financial**: salesTargets, priceHistory, invoiceMatchMap, lsImportLog, lsSalesByData
**Venue**: storageZones, fridgeUnits, masterChecklists, equipmentData, orderHistory, stockMovements, stocktakes
**Engagement**: announcements, kudos, dailyBriefings, badgeDefinitions
**Config**: staffHubConfig, handoverTemplateConfig, onboardingTemplates, qualificationTypes, inventorySubcategories, kbSubcategories, kbCategories, safeSubcategories, safeCategories
**Audit**: auditLog (last 500 entries, includes user field)

---

## SECURITY SYSTEM

### Manager PIN
- SHA-256 hashed with salt `'_hobarthub_salt'`
- Stored in `localStorage.venuePin`
- Auto-lock: 10-minute inactivity timeout
- 3-tier confirmation system: Standard → Dangerous (PIN required) → Critical (PIN + type word)

### Staff PINs
- Per-staff 4-digit PIN, SHA-256 hashed on staff record
- `window.showStaffPinEntry()` → keypad modal → match against staffDirectory
- Sets `window._activeStaffMember` on success
- SessionStorage for display name (clears on tab close)

### Role-Based Access Flow
1. Staff logs in → `applyRoleAccess()` filters sidebar
2. `showView()` enforces allowedViews check
3. Dashboard hides financial cards via `_showFinancials`
4. Manager role has `allowedViews: ['*']` (full access)
5. Auto-lock clears staff session + restores sidebar collapse state

---

## VIEW ROUTER: 41 ROUTES

**Hub Wrappers** (tabbed): Inventory Hub, Recipe Hub, Analytics Hub, Staff Hub, Compliance Hub
**Standalone Views**: dashboard, compliance, wastage, prep-list, invoice, ai-order, suppliers, tasks, maintenance, safe, incidents, handover, knowledge, rosters, zones, menu-engineering, sell-price-editor, price-alerts, cross-venue, lightspeed-import, bulk-category-editor, pos-alias-editor, depletion-history, ask-hub, my-hub, badge-management, staff-hub-config, noticeboard, audit-log, costing-report, prime-cost

**Restricted Views** (23): sales, suppliers, recipes, invoice, orientation, safe, handover, margins, menu-engineering, sell-price-editor, price-alerts, forecast, staff-directory, bulk-category-editor, pos-alias-editor, ai-order, cross-venue, par-editor, batch-linker, costing-report, prime-cost, lightspeed-import, badge-management, staff-hub-config, audit-log

---

## INTEGRATIONS

### Tanda API
- OAuth token in localStorage, auto-refresh
- Pulls: users, schedules, timesheets, clocked-in staff, leave, qualifications
- Auto-sync: full every 15 min, clocked-in every 5 min
- Wage data populates daily breakdown on Takings page

### Google Gemini 2.5 Flash
- Recipe parsing, batch linking, allergen detection, invoice OCR, POS product mix extraction, menu engineering recommendations, AI briefing, Ask Hub queries, anomaly detection

### Lightspeed POS
- Manual CSV upload (Sales By, Guests, Reconciliation)
- AI depletion: paste product mix → Gemini extracts → recipe cascade → stock impact preview → confirm

### Open-Meteo
- Free weather API, no auth — Hobart daily temps for dashboard

---

## DEPLOYMENT

### Cache Update Process
1. Edit code files
2. Change `CACHE_NAME` date in sw.js line 2: `'hobart-hub-YYYYMMDD'`
3. Upload files to hosting
4. Users see blue "Update available" banner → tap to reload
5. Old cache auto-deleted

### Backup & Restore
- Dashboard → Backup Data (JSON export of all 47 arrays)
- Dashboard → Restore Data (file upload, validates before loading)

---

## WHAT TO DO NEXT

### Immediate (ready to test)
- [ ] **Test print buttons** — Compliance temp log, Inventory stock levels, Stocktake report
- [ ] **Build more recipes** — need real menu data for depletion to have meaningful impact
- [ ] **iPad deployment** — push to actual device, test PWA install, verify SW updates work

### Short-term enhancements
- [ ] **Tanda leave/qualifications** — API token needs broader scope (currently 403 on leave, leave_balances, qualifications, unavailability endpoints)
- [ ] **Dashboard refinement** — Consider what non-financial operational cards staff should see
- [ ] **Recipe import from Lightspeed** — if Lightspeed has recipe/modifier data available

### Medium-term
- [ ] **PDF generation** — proper PDF export (not just browser print) for compliance audits
- [ ] **Staff scheduling AI** — predictive staffing from historical covers/revenue
- [ ] **Supplier order automation** — auto-generate orders when stock hits PAR
- [ ] **Mobile app wrapper** — Ionic/Cordova for app store distribution

---

## CRITICAL CONSTANTS

| Constant | Location | Current Value | When to Change |
|----------|----------|---------------|----------------|
| `CACHE_NAME` | sw.js:2 | `'hobart-hub-20260325'` | Every deployment |
| `_autoLockMinutes` | core.js:265 | `10` | If timeout too short/long |
| `_restrictedViews` | core.js:282-288 | 23 view names | When adding new restricted views |
| `_defaultStaffViews` | core.js:51 | 13 view names | When changing default staff access |
| Gemini API key | localStorage | Per-venue | If key rotates or billing changes |
| Tanda OAuth | localStorage | Per-venue | If token expires (quarterly check) |
| Firebase config | index.html | Inline config object | If project changes |

---

**Handover Version:** 3.0
**Previous Version:** 2.0 (pre-Session 4)
**Author:** Claude + Developer
**Next Session:** Test print functions, build recipes, iPad deployment planning
