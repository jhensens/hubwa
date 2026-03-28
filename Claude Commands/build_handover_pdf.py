from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT

PURPLE = HexColor('#7c3aed')
DARK_BG = HexColor('#1a1a2e')
GRAY = HexColor('#666666')
LIGHT_GRAY = HexColor('#f0f0f0')
GREEN = HexColor('#10b981')
RED = HexColor('#ef4444')
BLUE = HexColor('#3b82f6')

doc = SimpleDocTemplate(
    r"C:\Users\jhens\Downloads\HUB WA  2203\hubwa-source\Hobart_Hub_Technical_Handover_v2.pdf",
    pagesize=A4, topMargin=25*mm, bottomMargin=20*mm, leftMargin=20*mm, rightMargin=20*mm
)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle('MainTitle', parent=styles['Title'], fontSize=32, textColor=PURPLE, spaceAfter=6))
styles.add(ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=14, textColor=GRAY, alignment=TA_CENTER, spaceAfter=20))
styles.add(ParagraphStyle('SectionHead', parent=styles['Heading1'], fontSize=20, textColor=PURPLE, spaceBefore=20, spaceAfter=10, borderWidth=0))
styles.add(ParagraphStyle('SubHead', parent=styles['Heading2'], fontSize=14, textColor=HexColor('#333333'), spaceBefore=14, spaceAfter=6))
styles.add(ParagraphStyle('SubHead3', parent=styles['Heading3'], fontSize=12, textColor=HexColor('#444444'), spaceBefore=10, spaceAfter=4))
styles.add(ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, spaceAfter=6))
styles.add(ParagraphStyle('BulletCustom', parent=styles['Normal'], fontSize=10, leading=14, leftIndent=15, bulletIndent=5, spaceAfter=3))
styles.add(ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, textColor=GRAY, alignment=TA_CENTER))
styles.add(ParagraphStyle('CodeBlock', parent=styles['Normal'], fontSize=9, fontName='Courier', leading=12, leftIndent=10, spaceAfter=4, textColor=HexColor('#333333')))
styles.add(ParagraphStyle('TableCell', parent=styles['Normal'], fontSize=9, leading=11))
styles.add(ParagraphStyle('CenterBody', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, spaceAfter=6))

def hr():
    return HRFlowable(width="100%", thickness=1, color=HexColor('#e0e0e0'), spaceAfter=8, spaceBefore=4)

def bullet(text):
    return Paragraph(f"&bull; {text}", styles['BulletCustom'])

story = []

# ===== COVER PAGE =====
story.append(Spacer(1, 80*mm))
story.append(Paragraph("HOBART HUB", styles['MainTitle']))
story.append(Paragraph("Technical Handover Document v2", styles['Subtitle']))
story.append(Spacer(1, 15*mm))
story.append(Paragraph("Bar Wa Izakaya &amp; Lost In Asia", ParagraphStyle('VenueName', parent=styles['Normal'], fontSize=16, textColor=PURPLE, alignment=TA_CENTER, spaceAfter=4)))
story.append(Paragraph("Hobart, Tasmania", styles['CenterBody']))
story.append(Spacer(1, 40*mm))
story.append(Paragraph("For AI Assistant Context | March 2026 | ~12,400 lines across 5 source files", styles['Small']))
story.append(PageBreak())

# ===== PROJECT OVERVIEW =====
story.append(Paragraph("Project Overview", styles['SectionHead']))
story.append(hr())
story.append(Paragraph("Hobart Hub is a single-page hospitality operations platform built for two venues: Bar Wa Izakaya and Lost In Asia in Hobart, Tasmania. It is a pure HTML/CSS/JavaScript application (no frameworks) with Firebase Firestore for cloud sync and localStorage for offline caching.", styles['Body']))

story.append(Paragraph("Tech Stack", styles['SubHead']))
story.append(bullet("Frontend: Vanilla HTML + CSS + JavaScript (no build tools, no frameworks)"))
story.append(bullet("Database: Firebase Firestore (cloud sync) + localStorage (offline cache)"))
story.append(bullet("File Storage: Firebase Storage (invoices, rosters, documents, photos)"))
story.append(bullet("AI: Google Gemini 2.5 Flash API (recipe parsing, invoice extraction, allergen detection, run sheets, menu advisor, anomaly detection, daily briefings, natural language queries)"))
story.append(bullet("Integrations: Tanda API (roster/timesheets/labour), Lightspeed POS (CSV imports), Open-Meteo (weather)"))
story.append(bullet("PWA: Service worker + manifest.json for offline iPad support"))

story.append(Paragraph("File Structure", styles['SubHead']))
story.append(Paragraph("All source files live in: hubwa-source/hubwa-main/", styles['Body']))

file_data = [
    ['File', 'Lines', 'Purpose'],
    ['index.html', '~220', 'App shell, sidebar nav, Firebase init, section state management'],
    ['core.js', '~1,600', 'Global state, PIN system (SHA-256), modals, Firebase sync, Tanda integration, search, notifications, venue management, staff auth, audit trail'],
    ['ops.js', '~4,700', 'Inventory, recipes, ordering, invoices, wastage, compliance data ops, stocktake, stock audit, AI features, menu engineering advisor'],
    ['mgmt.js', '~5,270', 'Dashboard, analytics, staff hub, maintenance, handover, incidents, roster, digital safe, knowledge base, noticeboard, kudos, My Hub, achievements, shift feedback, leaderboard, badge management, role config'],
    ['style.css', '~590', 'Dark theme, responsive design, component styles'],
    ['sw.js', '~75', 'Service worker for offline caching'],
    ['manifest.json', '~25', 'PWA manifest'],
]
t = Table(file_data, colWidths=[70, 45, 380])
t.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), PURPLE), ('TEXTCOLOR', (0,0), (-1,0), HexColor('#ffffff')),
    ('FONTSIZE', (0,0), (-1,-1), 8), ('LEADING', (0,0), (-1,-1), 11),
    ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dddddd')),
    ('VALIGN', (0,0), (-1,-1), 'TOP'), ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5), ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#ffffff'), HexColor('#f8f8fc')]),
]))
story.append(t)
story.append(PageBreak())

# ===== ARCHITECTURE =====
story.append(Paragraph("Architecture", styles['SectionHead']))
story.append(hr())

story.append(Paragraph("Data Flow", styles['SubHead']))
story.append(Paragraph("All data lives in global window arrays (e.g. window.inventoryItems, window.recipes). The saveToDisk() function in core.js serializes all arrays to both localStorage (immediate) and Firebase Firestore (debounced 4s). On startup, data loads from localStorage first (instant render), then Firebase syncs in the background.", styles['Body']))

story.append(Paragraph("Save Keys (47 data arrays)", styles['SubHead']))
story.append(Paragraph("inventoryItems, recipes, wastageLogs, suppliers, salesData, salesTargets, orientationLogs, rotationalTasks, taskHistory, tempLogs, complianceLogs, defectLogs, equipmentData, contractorLogs, digitalSafe, phoneBook, incidentLogs, handoverLogs, knowledgeBase, shiftRosters, onboardingTemplates, fridgeUnits, masterChecklists, posMappings, storageZones, depletionLogs, safeCategories, kbCategories, orderHistory, staffDirectory, lsImportLog, lsSalesByData, shiftChecklistItems, invoiceMatchMap, priceHistory, inventorySubcategories, kbSubcategories, safeSubcategories, handoverTemplateConfig, qualificationTypes, stockMovements, stocktakes, auditLog, announcements, kudos, dailyBriefings, badgeDefinitions, staffHubConfig, shiftFeedbackTags", styles['CodeBlock']))

story.append(Paragraph("View Router", styles['SubHead']))
story.append(Paragraph("window.showView(viewName) in core.js is the master router. It maps string view names to render functions. Views return HTML strings that get injected into #mainContent via innerHTML. Hub wrappers (renderInventoryHub, renderRecipeHub, renderAnalyticsHub) use tab state variables and delegate to sub-view render functions.", styles['Body']))

story.append(Paragraph("Multi-Venue", styles['SubHead']))
story.append(Paragraph("Two venues defined in window._venues array. Data isolated by venue ID prefix in localStorage keys and separate Firebase documents (hobartHub and lia). getCurrentVenue() checks URL params, then localStorage hubActiveVenue, then hubDeviceVenue, then defaults to bwi.", styles['Body']))
story.append(PageBreak())

# ===== NAVIGATION =====
story.append(Paragraph("Navigation Structure", styles['SectionHead']))
story.append(hr())
story.append(Paragraph("Sidebar has 5 collapsible sections (streamlined from original 7). Sections are grouped by workflow frequency.", styles['Body']))

nav_data = [
    ['Section', 'Items', 'Notes'],
    ['Operations', 'Inventory Hub, Compliance, Wastage Tracker, Order Hub, Handover', 'Daily shift workflow. Handover is restricted (manager only). Operations section open by default.'],
    ['Team & Venue', 'Noticeboard, Roster, Staff Management, Rotational Tasks, Maintenance, Incidents, Knowledge Base, Digital Safe', 'Ordered by frequency: daily items first, reference docs last. Staff Management and Digital Safe are restricted.'],
    ['Recipes & Financials', 'Recipe & Costing, Financials', 'Entire section is restricted — auto-hides when Hub is locked. No empty headers.'],
    ['Settings', 'Suppliers, Storage Zones, Tanda Settings, Badge Management, Staff Hub Config', 'Suppliers, Tanda, Badge Mgmt and Staff Hub Config are restricted.'],
    ['External Links', 'Tanda, Lightspeed, Me&u', 'Me&u is restricted.'],
]
t = Table(nav_data, colWidths=[90, 200, 200])
t.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), PURPLE), ('TEXTCOLOR', (0,0), (-1,0), HexColor('#ffffff')),
    ('FONTSIZE', (0,0), (-1,-1), 8), ('LEADING', (0,0), (-1,-1), 11),
    ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dddddd')),
    ('VALIGN', (0,0), (-1,-1), 'TOP'), ('TOPPADDING', (0,0), (-1,-1), 4), ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ('LEFTPADDING', (0,0), (-1,-1), 5), ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#ffffff'), HexColor('#f8f8fc')]),
]))
story.append(t)

story.append(Paragraph("Sidebar Footer", styles['SubHead']))
story.append(bullet("Dark/Light Mode toggle"))
story.append(bullet("Staff Hub button (visible only when Hub is locked - purple, for staff self-service PIN entry)"))
story.append(bullet("Lock/Unlock Hub button"))
story.append(bullet("Backup Data / Restore Data (restricted)"))
story.append(PageBreak())

# ===== SECURITY =====
story.append(Paragraph("Security Implementation", styles['SectionHead']))
story.append(hr())

story.append(Paragraph("PIN System (SHA-256 Hashed)", styles['SubHead']))
story.append(bullet("Manager PIN: SHA-256 hashed via Web Crypto API with salt ('_hobarthub_salt'). Stored in localStorage ('venuePin'). Auto-migration: existing plaintext PINs are automatically hashed on first load."))
story.append(bullet("Staff PINs: Individual 4-digit PINs per staff member, also SHA-256 hashed. Stored on each staffDirectory record as staff.pin. Collision detection warns if PIN matches manager PIN or another staff member."))
story.append(bullet("Auto-lock after 10 minutes inactivity for both manager and staff sessions."))
story.append(bullet("Forced PIN setup on first load if no PIN exists."))

story.append(Paragraph("Three-Tier Confirmations", styles['SubHead']))
story.append(bullet("Standard: styled modal with confirm/cancel (routine actions)"))
story.append(bullet("Dangerous: PIN required before confirm (bulk delete, stock reset)"))
story.append(bullet("Critical: PIN + type confirmation word (venue data wipe)"))

story.append(Paragraph("Restricted Views", styles['SubHead']))
story.append(Paragraph("Binary lock/unlock (no role-based access yet). When locked, .restricted class nav items hidden and restricted views redirect to dashboard. Full restricted views list: sales, suppliers, recipes, invoice, orientation, safe, handover, margins, menu-engineering, sell-price-editor, price-alerts, forecast, staff-directory, bulk-category-editor, pos-alias-editor, ai-order, cross-venue, par-editor, batch-linker, costing-report, prime-cost, lightspeed-import, badge-management, staff-hub-config, audit-log", styles['Body']))

story.append(Paragraph("XSS Prevention", styles['SubHead']))
story.append(bullet("window.esc() - HTML entity escaping for all user content in innerHTML"))
story.append(bullet("window.safeUrl() - blocks javascript:, data:text/html, vbscript: protocols"))
story.append(bullet("window.escAttr() - escapes quotes/backslashes for onclick attributes"))
story.append(bullet("YouTube-only iframe embeds - non-YouTube URLs rendered as safe links"))
story.append(PageBreak())

# ===== INTEGRATION DETAILS =====
story.append(Paragraph("Integration Details", styles['SectionHead']))
story.append(hr())

story.append(Paragraph("Tanda API", styles['SubHead']))
story.append(Paragraph("OAuth token stored in localStorage (per-venue prefixed). All calls via window.fetchTanda(endpoint) wrapper with Authorization header. Data pulled: users, schedules (weekly roster), timesheets, clocked-in staff, leave requests, qualifications, unavailability. Auto-refresh: full every 15 min, clocked-in every 5 min. Merges into staffDirectory (fills blanks only). Labour cost calculated from timesheets.", styles['Body']))

story.append(Paragraph("Lightspeed POS", styles['SubHead']))
story.append(Paragraph("Manual CSV upload only (no live API). Three CSV types: Sales By (product sales for depletion), Guests (covers data), Reconciliation (EOD totals). AI POS Depletion: paste product mix text, Gemini extracts items, matches to recipes via posAlias, cascades through ingredients including batch sub-recipes.", styles['Body']))

story.append(Paragraph("Google Gemini 2.5 Flash", styles['SubHead']))
story.append(Paragraph("API key stored in localStorage. Used for: AI recipe import, batch ingredient linker, allergen scanning, invoice text/vision extraction, POS depletion parsing, run sheet generation, order suggestions, menu engineering advisor, daily briefings, end-of-day summaries, anomaly detection, natural language Hub queries ('Ask Hub'). All calls wrapped with loading overlay. Error handling with toast notifications.", styles['Body']))

story.append(Paragraph("Firebase", styles['SubHead']))
story.append(Paragraph("Firestore: venueData collection with docs per venue. Backups collection for daily snapshots (7-day retention). Storage: files uploaded to rosters/, knowledge/, safe/ prefixes. Write retry: 3 attempts with 10s backoff, clickable retry link on failure. Sync status badge in header.", styles['Body']))
story.append(PageBreak())

# ===== NEW FEATURES (SESSION 1) =====
story.append(Paragraph("Recent Development: Session 1 Features", styles['SectionHead']))
story.append(hr())
story.append(Paragraph("Quick wins batch — 7 features added:", styles['Body']))

story.append(Paragraph("1. PIN Hashing (core.js)", styles['SubHead3']))
story.append(Paragraph("SHA-256 hashing via Web Crypto API. Auto-migration for existing plaintext PINs. All PIN setup, verification, and forced-setup flows use async hashing.", styles['Body']))

story.append(Paragraph("2. Audit Trail (core.js + mgmt.js)", styles['SubHead3']))
story.append(Paragraph("window.logAudit(collection, action, itemId, details) utility. auditLog saveKey (keeps last 500 entries). renderAuditLogView() with table showing time, action, area, details. Routed at 'audit-log' view.", styles['Body']))

story.append(Paragraph("3. Internal Noticeboard (mgmt.js + index.html + core.js)", styles['SubHead3']))
story.append(Paragraph("Full CRUD announcements. Priority levels: Info/Important/Urgent (color-coded). Expiry dates with auto-filtering. Acknowledgment tracking per staff member. Dashboard card showing top 3 active announcements. Urgent unread announcements appear in notification bell.", styles['Body']))

story.append(Paragraph("4. Kudos Board (mgmt.js + core.js)", styles['SubHead3']))
story.append(Paragraph("kudos saveKey with {from, to, message, date}. 'Give Kudos' form with staff directory dropdown. Dashboard card showing latest 5 kudos. Keeps last 100 entries.", styles['Body']))

story.append(Paragraph("5. Handover Pre-Population (mgmt.js)", styles['SubHead3']))
story.append(Paragraph("_generateHandoverPrefill() auto-fills ALL template sections: 86'd items, below-PAR stock with levels, open maintenance/incidents/temp breaches, today's revenue/covers/wastage, upcoming due tasks. Sections show 'auto-filled' badge.", styles['Body']))

story.append(Paragraph("6. Smart Order Reminders (core.js)", styles['SubHead3']))
story.append(Paragraph("Added to notification engine. Checks supplier cutoff times vs current time. If within 2 hours of cutoff AND supplier delivers tomorrow AND items below PAR: fires priority-0 notification with link to Order Hub.", styles['Body']))

story.append(Paragraph("7. AI Menu Engineering Advisor (ops.js)", styles['SubHead3']))
story.append(Paragraph("'AI Menu Advisor' button on menu engineering view. Sends full menu data to Gemini. Returns 5-7 specific actionable recommendations with dollar amounts. Dismissible card.", styles['Body']))
story.append(PageBreak())

# ===== NEW FEATURES (SESSION 2) =====
story.append(Paragraph("Recent Development: Session 2 Features", styles['SectionHead']))
story.append(hr())
story.append(Paragraph("Staff Self-Service Portal ('My Hub') — 6 phases:", styles['Body']))

story.append(Paragraph("Phase 1: Staff PINs & Authentication (core.js + mgmt.js + index.html)", styles['SubHead3']))
story.append(bullet("Individual 4-digit PINs per staff member, SHA-256 hashed"))
story.append(bullet("'Staff Hub' button in sidebar footer (visible when locked)"))
story.append(bullet("showStaffPinEntry() opens PIN keypad, iterates staffDirectory for match"))
story.append(bullet("Sets window._activeStaffMember and stores in sessionStorage"))
story.append(bullet("Collision detection for manager PIN and other staff PINs"))
story.append(bullet("lockStaffHub() to exit staff session"))

story.append(Paragraph("Phase 2: My Hub Dashboard (mgmt.js)", styles['SubHead3']))
story.append(bullet("renderMyHubView() - personalised dashboard with role-based card rendering"))
story.append(bullet("Cards determined by: staff.profileConfig > staffHubConfig.roles[role] > defaultCards"))
story.append(bullet("7 cards: My Shifts (Tanda filter), My Qualifications (expiry indicators), Announcements (with ack), My Kudos (received + give), Achievements (badge wall), Shift Feedback (mood rating), Quick Actions (role-configured)"))
story.append(bullet("Auto birthday detection and celebration message"))
story.append(bullet("Custom fields displayed as badges"))

story.append(Paragraph("Phase 3: Achievement Engine (mgmt.js)", styles['SubHead3']))
story.append(bullet("7 default auto-badges seeded: Temp Champion, Waste Warrior, Kudos Collector, Handover Hero, Eagle Eye, Safety First, Checklist Pro"))
story.append(bullet("Tiered system: Bronze/Silver/Gold with customisable thresholds"))
story.append(bullet("_calculateAchievements() counts metrics via case-insensitive name matching"))
story.append(bullet("Manager-awarded badges with citation"))
story.append(bullet("Badge Management view: full CRUD, toggle active/inactive, award to staff"))
story.append(bullet("Progress bars for unearned badges"))

story.append(Paragraph("Phase 4: Shift Feedback (mgmt.js)", styles['SubHead3']))
story.append(bullet("5-point emoji scale with 52px touch targets"))
story.append(bullet("Customisable tag chips (editable via Staff Hub Config)"))
story.append(bullet("One submission per staff per day"))
story.append(bullet("Manager dashboard card: 7d/30d averages, trend direction, top tags"))

story.append(Paragraph("Phase 5: Team Leaderboard (mgmt.js)", styles['SubHead3']))
story.append(bullet("Ranks staff by badges + kudos received"))
story.append(bullet("Medals for top 3. Shows on My Hub and manager dashboard"))

story.append(Paragraph("Phase 6: Role Config + Custom Fields (mgmt.js)", styles['SubHead3']))
story.append(bullet("renderStaffHubConfigView() - toggle cards and quick actions per role"))
story.append(bullet("Per-staff overrides via profileConfig.visibleCards"))
story.append(bullet("Custom profile fields (key=value pairs) on staff form"))
story.append(bullet("Editable feedback tags"))

story.append(Paragraph("Sidebar Restructure", styles['SubHead3']))
story.append(bullet("7 sections consolidated to 5: Operations, Team & Venue, Recipes & Financials, Settings, External Links"))
story.append(bullet("No single-item sections. Recipes & Financials auto-hides when locked (no empty headers)"))
story.append(bullet("Team & Venue ordered by frequency: daily > weekly > as-needed > reference"))
story.append(bullet("Handover moved to Operations (daily shift task). Staff Management renamed from 'Staff Hub' to avoid confusion with Staff Hub button"))
story.append(PageBreak())

# ===== KEY CODE PATTERNS =====
story.append(Paragraph("Key Code Patterns", styles['SectionHead']))
story.append(hr())

patterns = [
    ("View Rendering", "All views are functions that return HTML strings. window.showView(name) injects the result into #mainContent. Hub wrappers check a tab state variable and delegate to sub-view functions."),
    ("Modal System", "window.openModal(title, bodyHtml) renders into #global-modal-content overlay. Patched with autofocus and body scroll lock. window.confirmAction({title, message, tier, onConfirm}) for confirmations."),
    ("Toasts", "window.showToast(msg, type) creates floating notifications. Types: default (green), error (red). Auto-dismiss after 3s. Stacks vertically (max 3)."),
    ("Firebase Sync", "window.saveToDisk() writes to localStorage immediately, then debounces Firebase write by 4s. Retry logic on failure (3 attempts, 10s backoff). Daily backup on first successful sync each day."),
    ("Data Escaping", "window.esc(str) for innerHTML content. window.escAttr(str) for onclick attributes. window.safeUrl(url) for href/src attributes. Always use these when injecting user data."),
    ("Audit Logging", "window.logAudit(collection, action, itemId, details) records changes to auditLog array. Called at key mutation points. Keeps last 500 entries."),
    ("Staff Session", "window._activeStaffMember holds the current staff record when a staff member is authenticated via their PIN. Stored in sessionStorage. Cleared on lock or browser close."),
    ("PIN Hashing", "window._hashPin(pin) returns SHA-256 hex string via Web Crypto API with salt. Used for both manager and staff PINs. Async function."),
]
for title, desc in patterns:
    story.append(Paragraph(title, styles['SubHead3']))
    story.append(Paragraph(desc, styles['Body']))

story.append(Paragraph("Owner Preferences", styles['SubHead']))
story.append(bullet("Prefers batch changes over incremental"))
story.append(bullet("Discuss approach before coding"))
story.append(bullet("Short responses preferred"))
story.append(bullet("Everything should be editable by the user (avoid hardcoding)"))
story.append(bullet("iPad is the primary device - touch targets and scroll behaviour matter"))
story.append(bullet("Two venues: Bar Wa Izakaya (primary) and Lost In Asia"))
story.append(PageBreak())

# ===== REMAINING WORK =====
story.append(Paragraph("Remaining Work & Known Issues", styles['SectionHead']))
story.append(hr())

story.append(Paragraph("High Priority", styles['SubHead']))
story.append(bullet("Live Stock Depletion Pipeline: unify CSV import and AI depletion paths so both cascade through recipes identically"))
story.append(bullet("Role-Based Access: currently binary lock/unlock - needs manager vs staff roles with granular view permissions (Staff PINs are foundation for this)"))
story.append(bullet("Offline Data Conflict Resolution: if user edits data offline and Firebase has newer data, no merge strategy exists"))

story.append(Paragraph("Medium Priority", styles['SubHead']))
story.append(bullet("Lightspeed live API integration (currently CSV-only, manual upload)"))
story.append(bullet("Multi-venue shared resources (recipes, suppliers) - currently fully isolated"))
story.append(bullet("IndexedDB migration for large datasets (localStorage 5MB limit)"))
story.append(bullet("Print-friendly PDF exports for compliance, inventory, recipes"))
story.append(bullet("Full P&L / Expense Tracker (all expense categories beyond food/labor)"))
story.append(bullet("Supplier Performance Scorecard (price trends, delivery accuracy)"))
story.append(bullet("Theoretical vs Actual COGS Variance (shrinkage detection)"))

story.append(Paragraph("Low Priority / Nice to Have", styles['SubHead']))
story.append(bullet("Accessibility: nav divs should be semantic buttons with ARIA labels"))
story.append(bullet("Service worker cache versioning: bump CACHE_NAME on code changes"))
story.append(bullet("Recipe photo upload to Firebase Storage (currently URL-only)"))
story.append(bullet("Historical analytics: month-over-month trending, year-on-year comparison"))
story.append(bullet("Customer/booking management integration (SevenRooms API)"))
story.append(bullet("Google Reviews monitor"))
story.append(bullet("Accounting export (Xero/MYOB)"))
story.append(bullet("Event calendar (Dark MOFO, cruise ships, public holidays)"))
story.append(bullet("Shift Notes Feed (real-time per-shift communication log)"))
story.append(PageBreak())

# ===== iPad TEST INSTRUCTIONS =====
story.append(Paragraph("iPad Test Instructions", styles['SectionHead']))
story.append(hr())
story.append(Paragraph("Use a personal device (not the business iPad). Load the Hub via the hosted URL or local file. Test at normal zoom.", styles['Body']))

story.append(Paragraph("Session 1 Tests: Quick Wins", styles['SubHead']))

story.append(Paragraph("1. PIN Hashing", styles['SubHead3']))
story.append(bullet("If testing on a device with an existing PIN: unlock should still work (auto-migration hashes the old plaintext PIN on first load)"))
story.append(bullet("If testing on a fresh device: you'll be prompted to set a new PIN. Set it, lock, then unlock - verify it works"))
story.append(bullet("Check localStorage in browser dev tools: 'venuePin' should be a 64-character hex string, not your digits"))

story.append(Paragraph("2. Noticeboard", styles['SubHead3']))
story.append(bullet("Navigate to Team & Venue > Noticeboard"))
story.append(bullet("Tap '+ Post Notice' - create one of each priority (Info, Important, Urgent)"))
story.append(bullet("Verify colour coding: blue for Info, orange for Important, red for Urgent"))
story.append(bullet("Set an expiry date on one notice - verify it shows in the Expired section after that date"))
story.append(bullet("Tap 'Ack' on a notice - verify your name appears in the acknowledged count"))
story.append(bullet("Check Dashboard - top 3 announcements should show in a card"))
story.append(bullet("Check notification bell - urgent unread announcements should appear"))

story.append(Paragraph("3. Kudos Board", styles['SubHead3']))
story.append(bullet("On Dashboard, find the Team Kudos card"))
story.append(bullet("Tap '+ Give Kudos' - select a staff member, write a message, enter your name"))
story.append(bullet("Verify the kudos appears in the card immediately"))

story.append(Paragraph("4. Handover Pre-Population", styles['SubHead3']))
story.append(bullet("Navigate to Operations > Handover"))
story.append(bullet("Tap 'Log Tonight's Shift'"))
story.append(bullet("Check that sections show 'auto-filled' badges"))
story.append(bullet("Verify: 86'd section shows items with stock=0, Stock Alerts shows below-PAR items with levels, Issues shows open maintenance tickets and any temp breaches"))

story.append(Paragraph("5. Smart Order Reminders", styles['SubHead3']))
story.append(bullet("This triggers automatically when a supplier's cutoff is within 2 hours AND they deliver tomorrow AND items are below PAR"))
story.append(bullet("To test: edit a supplier's cutoff time to be 2 hours from now, ensure their delivery day includes tomorrow, and have items below PAR for that supplier"))
story.append(bullet("Check the notification bell - a priority-0 alert should appear"))

story.append(Paragraph("6. AI Menu Advisor", styles['SubHead3']))
story.append(bullet("Navigate to Recipes & Financials > Recipe & Costing > Margins tab > Menu Engineering"))
story.append(bullet("Tap 'AI Menu Advisor' button (requires Gemini API key set in Settings)"))
story.append(bullet("Verify it shows a loading state, then returns recommendations"))
story.append(bullet("Verify 'Dismiss' button clears the card"))

story.append(Paragraph("7. Audit Trail", styles['SubHead3']))
story.append(bullet("Create/edit/delete a noticeboard announcement"))
story.append(bullet("Navigate to audit-log view (type 'audit' in global search, or navigate directly)"))
story.append(bullet("Verify the actions appear with timestamps"))
story.append(PageBreak())

story.append(Paragraph("Session 2 Tests: Staff Self-Service Portal", styles['SubHead']))

story.append(Paragraph("1. Staff PIN Setup", styles['SubHead3']))
story.append(bullet("Unlock the Hub (manager PIN)"))
story.append(bullet("Go to Team & Venue > Staff Management"))
story.append(bullet("Edit a staff member - scroll down to the 'Staff PIN' section"))
story.append(bullet("Tap 'Set PIN' - enter a 4-digit PIN"))
story.append(bullet("Verify toast: 'PIN set for [name]!'"))
story.append(bullet("Verify form re-opens showing 'PIN set' with green checkmark"))
story.append(bullet("Try setting the same PIN for another staff member - should warn about collision"))

story.append(Paragraph("2. Staff Hub Entry", styles['SubHead3']))
story.append(bullet("Lock the Hub"))
story.append(bullet("Verify the purple 'Staff Hub' button appears in the sidebar footer"))
story.append(bullet("Tap it - PIN keypad should appear"))
story.append(bullet("Enter wrong PIN - should show 'PIN not recognised' error"))
story.append(bullet("Enter correct staff PIN - should show 'Welcome, [name]!' and open My Hub"))

story.append(Paragraph("3. My Hub Dashboard", styles['SubHead3']))
story.append(bullet("Verify welcome header shows staff name and role"))
story.append(bullet("Verify 'Lock' button is visible to exit"))
story.append(bullet("Check each card renders (shifts, qualifications, announcements, kudos, achievements, feedback, quick actions)"))
story.append(bullet("If the staff member has a birthday today: verify birthday message appears"))
story.append(bullet("If custom fields are set: verify they show as badges below the name"))

story.append(Paragraph("4. My Hub Cards", styles['SubHead3']))
story.append(bullet("Quick Actions: tap each button (Log Temps, Wastage, etc.) - verify navigation works"))
story.append(bullet("Announcements: tap 'Ack' on an announcement from Staff Hub"))
story.append(bullet("Kudos: verify received kudos show. Tap 'Give Kudos' and send one"))
story.append(bullet("Qualifications: verify red/amber/green indicators based on expiry dates"))

story.append(Paragraph("5. Achievements", styles['SubHead3']))
story.append(bullet("If staff has logged temp readings, wastage, etc: badges should auto-calculate"))
story.append(bullet("Check progress bars for unearned badges"))
story.append(bullet("Unlock the Hub (manager) - go to Settings > Badge Management"))
story.append(bullet("Create a manual badge, award it to a staff member"))
story.append(bullet("Log back in as that staff member - verify the awarded badge appears"))

story.append(Paragraph("6. Shift Feedback", styles['SubHead3']))
story.append(bullet("On My Hub, find the Shift Feedback card"))
story.append(bullet("Tap a mood emoji (min 48px touch target) - verify tags appear"))
story.append(bullet("Select tags, optionally add a note, tap Submit"))
story.append(bullet("Verify: 'Thanks for the feedback!' toast, card now shows submitted rating"))
story.append(bullet("Try submitting again same day - should show the already-submitted state"))

story.append(Paragraph("7. Leaderboard", styles['SubHead3']))
story.append(bullet("On the manager Dashboard, check the Team Leaderboard card"))
story.append(bullet("Verify it shows staff ranked by badges + kudos"))
story.append(bullet("Medals (gold, silver, bronze) for top 3"))

story.append(Paragraph("8. Role Configuration", styles['SubHead3']))
story.append(bullet("Go to Settings > Staff Hub Config"))
story.append(bullet("Toggle a card off for a role (e.g. remove 'leaderboard' from FOH)"))
story.append(bullet("Log in as a FOH staff member - verify that card is hidden"))
story.append(bullet("Edit feedback tags - verify changes appear in the Shift Feedback card"))

story.append(Paragraph("9. Sidebar Navigation", styles['SubHead3']))
story.append(bullet("When LOCKED: verify Recipes & Financials section is completely hidden (no empty header)"))
story.append(bullet("When LOCKED: verify Operations shows 4 items (Handover hidden)"))
story.append(bullet("When UNLOCKED: verify all 5 sections visible with correct items"))
story.append(bullet("Verify no duplicate emojis between section headers"))

story.append(Paragraph("10. General", styles['SubHead3']))
story.append(bullet("Test all touch targets are minimum 44px on iPad"))
story.append(bullet("Test offline: turn off WiFi, verify Hub still loads and functions from localStorage"))
story.append(bullet("Test Firebase sync: make changes, refresh, verify data persists"))
story.append(bullet("Check notification bell count updates when new alerts exist"))

story.append(Spacer(1, 10*mm))
story.append(Paragraph("Hobart Hub Technical Handover v2 | March 2026 | ~12,400 lines across 5 source files", styles['Small']))

doc.build(story)
print("PDF created successfully!")
