// --- HOBART HUB: Core Module ---
// Global state initialization, HTML escape utilities, UI utilities, modal system, keyboard shortcuts

// --- 1. GLOBAL STATE INITIALIZATION ---
window.inventoryItems = [];
window.recipes = [];
window.wastageLogs = [];
window.posMappings = {};
window.storageZones = [];

// Commercial Supplier data (Min spend & Delivery Days)
window.suppliers = [
    {name: "JFT Tasmania", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Tue", "Thu"]},
    {name: "SHV Wholesalers", cutoff: "14:00", contact: "", minSpend: 0, deliveryDays: ["Mon", "Wed", "Fri"]},
    {name: "Best Fresh Wholesale", cutoff: "14:00", contact: "", minSpend: 0, deliveryDays: ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    {name: "Freshline Tasmania", cutoff: "17:00", contact: "", minSpend: 100, deliveryDays: ["Mon", "Tue", "Thu", "Sat"]},
    {name: "Scottsdale Pork", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Tue", "Fri"]},
    {name: "Ashmores", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Mon", "Wed", "Fri"]},
    {name: "Doppio Foods", cutoff: "15:00", contact: "", minSpend: 0, deliveryDays: ["Tue", "Thu"]},
    {name: "Bidfood", cutoff: "15:00", contact: "", minSpend: 150, deliveryDays: ["Mon", "Wed", "Fri"]},
    {name: "ALM", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    {name: "JFC Australia", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Wed"]},
    {name: "Jun Pacific", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Wed"]},
    {name: "S&J International", cutoff: "12:00", contact: "", minSpend: 0, deliveryDays: ["Wed"]},
    {name: "Woolworths", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    {name: "Valley Fresh Farm", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Tue", "Fri"]},
    {name: "Ziggys Supreme Smallgoods", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Mon", "Thu"]},
    {name: "Lenah Game Meats", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Thu"]},
    {name: "Bruny Island Game Meats", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Thu"]},
    {name: "Barilla Bay Seafoods", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Tue", "Thu"]},
    {name: "Brands on Parade", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Wed"]},
    {name: "Superior Food Group", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Mon", "Wed", "Fri"]},
    {name: "Officeworks", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Mon", "Tue", "Wed", "Thu", "Fri"]},
    {name: "Exquisite Flavours", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Wed"]},
    {name: "Fresh Cut (TAS)", cutoff: "", contact: "", minSpend: 0, deliveryDays: ["Mon", "Wed", "Fri"]}
];
window.salesData = [];
window.salesTargets = { wageTarget: 30 };
window.orientationLogs = [];
window.rotationalTasks = [];
window.taskHistory = [];
window.tempLogs = [];
window.complianceLogs = [];
window.defectLogs = [];
window.equipmentData = [];
window.contractorLogs = [];
window.digitalSafe = [];
window.phoneBook = [];
window.incidentLogs = [];
window.handoverLogs = [];
window.knowledgeBase = [];
window.shiftRosters = [];
window.depletionLogs = [];
window.orderHistory = [];
window.stockMovements = [];
window.stocktakes = [];
window.staffDirectory = [];
window.auditLog = [];
window.announcements = [];
window.kudos = [];
window.dailyBriefings = [];
window.badgeDefinitions = [];
window.staffHubConfig = {
    roles: {
        'FOH': { visibleCards: ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'], quickActions: ['log-temps','wastage','maintenance','incident','sops'], allowedViews: ['dashboard','inventory','compliance','wastage','prep-list','noticeboard','rosters','tasks','maintenance','incidents','knowledge','zones','my-hub'] },
        'BOH': { visibleCards: ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'], quickActions: ['log-temps','wastage','maintenance','incident'], allowedViews: ['dashboard','inventory','compliance','wastage','noticeboard','tasks','maintenance','incidents','knowledge','zones','my-hub'] },
        'Bar': { visibleCards: ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'], quickActions: ['log-temps','wastage','maintenance','incident','sops'], allowedViews: ['dashboard','inventory','compliance','wastage','prep-list','noticeboard','rosters','tasks','maintenance','incidents','knowledge','zones','my-hub'] },
        'Manager': { visibleCards: ['shifts','qualifications','announcements','kudos','achievements','feedback','actions','leaderboard'], quickActions: ['log-temps','wastage','maintenance','incident','sops'], allowedViews: ['*'] },
        'Kitchen Hand': { visibleCards: ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'], quickActions: ['log-temps','wastage','maintenance','incident'], allowedViews: ['dashboard','inventory','compliance','wastage','noticeboard','tasks','maintenance','incidents','knowledge','zones','my-hub'] }
    },
    defaultCards: ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'],
    defaultActions: ['log-temps','wastage','maintenance','incident','sops'],
    defaultViews: ['dashboard','inventory','compliance','wastage','prep-list','noticeboard','rosters','tasks','maintenance','incidents','knowledge','zones','my-hub']
};
window._defaultStaffViews = window.staffHubConfig.defaultViews; // shared fallback for role access
window.shiftFeedbackTags = ['Busy','Quiet','Short-staffed','Great team','Equipment issues','Good tips','Stressful'];
window._activeStaffMember = null;
window.qualificationTypes = [
    { id: 'rsa', name: 'RSA', expiryRequired: true },
    { id: 'food-handler', name: 'Food Handler Certificate', expiryRequired: true },
    { id: 'fire-warden', name: 'Fire Warden', expiryRequired: true },
    { id: 'first-aid', name: 'First Aid', expiryRequired: true },
    { id: 'police-check', name: 'Police Check', expiryRequired: false }
];
window.shiftChecklistItems = null;
window.invoiceMatchMap = window.invoiceMatchMap || {};
window.priceHistory = window.priceHistory || {};
window.inventorySubcategories = window.inventorySubcategories || {};
window.kbSubcategories = window.kbSubcategories || {};
window.safeSubcategories = window.safeSubcategories || {};
window.handoverTemplateConfig = window.handoverTemplateConfig || {
    sections: ['Service Summary', 'Off Menu Items', 'Stock Alerts', 'Issues / Follow-ups', 'Opening Notes for Tomorrow'],
    requireStaff: true
};
window.lsImportLog = [];
window.lsSalesByData = {};
window.safeCategories = [
    'Licenses & Permits', 'Insurance', 'Fire Safety & Emergency', 'Food Safety & HACCP',
    'Staff RSAs & Certs', 'Employment & HR', 'Lease & Property', 'Supplier Agreements',
    'Financial & Tax', 'Training & Procedures', 'Health & Safety (WHS)', 'Menus & Marketing', 'General / Other'
];
window.kbCategories = ["Opening & Closing", "Food Safety & HACCP", "Bar Procedures", "FOH Procedures", "BOH Procedures", "Emergency & Safety", "Equipment Guides", "HR & Policies"];
window.onboardingTemplates = {
    'FOH (Front of House)': { 'Day 1: Basics': [{id: 'foh1', label: 'Venue Tour & Safety'}], 'Compliance': [{id: 'foh3', label: 'Upload RSA', isUpload: true, cat: 'Staff RSAs'}] },
    'BOH (Back of House)': { 'Day 1: Kitchen': [{id: 'boh1', label: 'Kitchen Safety'}], 'Compliance': [{id: 'boh3', label: 'Upload Food Safety Cert', isUpload: true, cat: 'Food Safety Certs'}] }
};
window.fridgeUnits = ["Walk-in Coolroom", "Walk-in Freezer", "Kitchen Line Fridge", "Kitchen Prep Fridge", "Bar Under-counter 1", "Bar Under-counter 2", "Bar Display Fridge", "Dessert Reach-in"];
window.masterChecklists = {
    "Weekly Deep Clean \u2014 Kitchen": ["Exhaust hood & filters degreased","Behind all equipment pulled out & cleaned","Cool room shelves & floor scrubbed","Grease traps flushed & scraped","Under benches & sinks wiped","Oven interior deep clean","Dry stores shelving wiped & organised","Dishwasher & glasswasher interior cleaned"],
    "Weekly Deep Clean \u2014 Bar": ["Speed rail & well drains flushed","Ice machine interior sanitised","Beer tap lines & drip trays cleaned","Under-counter fridges wiped out","Back bar shelving dusted & organised","Glass polishing check \u2014 no water marks","Garnish station containers deep cleaned","Bar mats & floor mats soaked & scrubbed"],
    "Weekly Deep Clean \u2014 FOH": ["All table bases & legs wiped","Window sills & ledges dusted","Bathroom deep clean (tiles, mirrors, fixtures)","Entry area & signage cleaned","Menu holders / stands wiped","Skirting boards & corners swept","Air conditioning filters / vents dusted"],
    "Monthly Safety Walk": ["Fire extinguishers checked (pressure, pin, signage)","Exit signs illuminated & visible","First aid kit fully stocked","Slip hazards assessed & addressed","Chemical storage secure & labelled (SDS available)","Emergency procedures posted & legible"]
};

// --- 1b. HTML ESCAPE UTILITY (XSS Prevention) ---
window.esc = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
};

// --- 1c. URL SANITIZER (Block javascript: and data: injection) ---
window.safeUrl = function(url) {
    if (!url || typeof url !== 'string') return '#';
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html') || trimmed.startsWith('vbscript:')) return '#';
    return url;
};

// Escape a string for safe use inside onclick attribute single quotes
window.escAttr = function(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
};

// --- LOADING OVERLAY ---
window.showLoadingOverlay = function(msg) {
    var el = document.getElementById('hub-loading-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'hub-loading-overlay';
        el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.6);display:flex;flex-direction:column;align-items:center;justify-content:center;';
        document.body.appendChild(el);
    }
    el.innerHTML = '<div style="background:var(--card-bg);padding:30px 40px;border-radius:12px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);"><div class="loading-spinner" style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;"></div><p style="margin:0;color:var(--text-muted);font-size:14px;">' + (msg || 'Processing...') + '</p></div>';
    el.style.display = 'flex';
};
window.hideLoadingOverlay = function() {
    var el = document.getElementById('hub-loading-overlay');
    if (el) el.style.display = 'none';
};

// --- 2. GLOBAL MODAL SYSTEM (Zero Context Switching) ---
window.openModal = (titleHtml, bodyHtml) => {
    const overlay = document.getElementById('global-modal-overlay');
    const content = document.getElementById('global-modal-content');
    if(!overlay || !content) return;

    content.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--card-bg); z-index: 10; border-radius: 12px 12px 0 0;">
            <h3 style="margin: 0; color: var(--brand-dark); font-size: 18px;">${titleHtml}</h3>
            <button onclick="window.closeModal()" style="background: none; border: none; color: var(--text-muted); font-size: 24px; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        <div style="padding: 20px;">
            ${bodyHtml}
        </div>
    `;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeModal = () => {
    const overlay = document.getElementById('global-modal-overlay');
    if(overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
};

// --- 2b. KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
    // Esc → close modal
    if (e.key === 'Escape') {
        const overlay = document.getElementById('global-modal-overlay');
        if (overlay && overlay.style.display !== 'none') { window.closeModal(); e.preventDefault(); return; }
    }
    const mod = e.metaKey || e.ctrlKey;
    // Cmd/Ctrl + S → save
    if (mod && e.key === 's') { e.preventDefault(); if (window.saveToDisk) window.saveToDisk(); if (window.showToast) window.showToast('Saved.'); return; }
    // Cmd/Ctrl + K → focus search
    if (mod && e.key === 'k') { e.preventDefault(); const si = document.getElementById('global-search-input'); if (si) { si.focus(); si.select(); } return; }
});

// --- 2c. AUTOFOCUS ON MODAL OPEN ---
// After modal opens, focus first visible input/textarea/select
window._autoFocusModal = () => {
    setTimeout(() => {
        const modal = document.getElementById('global-modal-content');
        if (!modal) return;
        const focusable = modal.querySelector('input[type="text"]:not([style*="display:none"]):not([type="hidden"]), textarea, select, input[type="number"], input[type="date"], input[type="email"], input[type="tel"]');
        if (focusable) focusable.focus();
    }, 80);
};

// Patch openModal to auto-focus
const _origOpenModal = window.openModal;
window.openModal = (titleHtml, bodyHtml) => {
    _origOpenModal(titleHtml, bodyHtml);
    window._autoFocusModal();
};

// --- 2c. STYLED CONFIRMATION SYSTEM ---
// Three tiers: standard (just buttons), dangerous (PIN required), critical (PIN + type word)
window.confirmAction = (opts) => {
    // opts: { title, message, confirmLabel, confirmColor, tier, typeWord, onConfirm }
    // tier: 'standard' | 'dangerous' | 'critical'
    const tier = opts.tier || 'standard';
    const confirmLabel = opts.confirmLabel || 'Confirm';
    const confirmColor = opts.confirmColor || 'var(--red)';
    const typeWord = opts.typeWord || 'WIPE';

    let body = '<div style="margin-bottom:20px;color:var(--text-main);font-size:14px;line-height:1.6;">' + opts.message + '</div>';

    if (tier === 'critical') {
        body += '<div style="margin-bottom:16px;">' +
            '<label style="font-size:12px;color:var(--text-muted);font-weight:600;">Type <strong style="color:var(--red);">' + typeWord + '</strong> to confirm:</label>' +
            '<input type="text" id="confirm-type-input" class="input-box" style="margin-top:6px;" placeholder="Type ' + typeWord + ' here..." autocomplete="off">' +
            '</div>';
    }

    body += '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
        '<button onclick="window.closeModal()" class="btn btn-outline" style="min-width:90px;">Cancel</button>' +
        '<button id="confirm-action-btn" onclick="window._execConfirmAction()" class="btn" style="min-width:90px;background:' + confirmColor + ';color:#fff;border:none;font-weight:600;">' + confirmLabel + '</button>' +
        '</div>';

    window._pendingConfirmAction = opts.onConfirm;
    window._pendingConfirmTier = tier;
    window._pendingConfirmTypeWord = typeWord;

    if (tier === 'dangerous' || tier === 'critical') {
        // Require PIN first, then show the confirmation modal
        window.requirePin(() => {
            _origOpenModal(opts.title || '⚠️ Confirm Action', body);
            window._autoFocusModal();
        });
    } else {
        _origOpenModal(opts.title || 'Confirm', body);
        window._autoFocusModal();
    }
};

window._execConfirmAction = () => {
    const tier = window._pendingConfirmTier;
    if (tier === 'critical') {
        const input = document.getElementById('confirm-type-input');
        if (!input || input.value.trim().toUpperCase() !== window._pendingConfirmTypeWord) {
            return window.showToast('Type ' + window._pendingConfirmTypeWord + ' to confirm.', 'error');
        }
    }
    window.closeModal();
    if (window._pendingConfirmAction) window._pendingConfirmAction();
    window._pendingConfirmAction = null;
};

// --- 2d. DEBOUNCE UTILITY ---
window.debounce = (fn, delay) => {
    let timer;
    return function() {
        const args = arguments;
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

// =============================================================================
// BWI SETUP WIZARD — Central seeder with status indicators
// =============================================================================
window.seedOnboardingTemplates = () => {
    window.onboardingTemplates = {
        'FOH (Front of House)': {
            'Day 1: Orientation': [
                { id:'foh-tour', label:'Venue tour — exits, bathrooms, storage, staff areas' },
                { id:'foh-pos', label:'POS training — orders, payments, voids, splits' },
                { id:'foh-tables', label:'Table numbers & sections walkthrough' },
                { id:'foh-menu', label:'Menu knowledge — key dishes, descriptions, prices' },
                { id:'foh-allergens', label:'Allergen matrix overview & communication protocol' }
            ],
            'Day 2: Service Standards': [
                { id:'foh-greet', label:'Guest greeting & seating procedure' },
                { id:'foh-service', label:'Service sequence — timing, check-backs, clearing' },
                { id:'foh-rsa', label:'RSA awareness — signs of intoxication, refusal steps' },
                { id:'foh-billing', label:'Billing, splitting, tips & cash handling' },
                { id:'foh-complaints', label:'Handling guest complaints & feedback' }
            ],
            'Compliance': [
                { id:'foh-rsa-cert', label:'Upload RSA Certificate', isUpload: true, cat:'Staff RSAs & Certs' },
                { id:'foh-emergency', label:'Read & acknowledge Emergency Evacuation SOP' },
                { id:'foh-food-safety', label:'Food safety basics acknowledgement' }
            ]
        },
        'BOH (Back of House)': {
            'Day 1: Kitchen Orientation': [
                { id:'boh-safety', label:'Kitchen safety — burns, cuts, slips, lifting' },
                { id:'boh-stations', label:'Station orientation — prep, line, pass, wash' },
                { id:'boh-knives', label:'Knife safety & storage protocol' },
                { id:'boh-hygiene', label:'Hygiene standards — handwashing, gloves, hair nets' },
                { id:'boh-fifo', label:'FIFO, date labelling & storage procedures' }
            ],
            'Day 2: Operations': [
                { id:'boh-prep', label:'Prep lists — how to read and execute' },
                { id:'boh-temps', label:'Temperature logging — how to use Hub temp log' },
                { id:'boh-waste', label:'Waste management — logging in Hub, separation' },
                { id:'boh-receive', label:'Receiving deliveries — temp checks, rejection criteria' },
                { id:'boh-cleaning', label:'Cleaning schedule & chemical safety (SDS location)' }
            ],
            'Compliance': [
                { id:'boh-food-cert', label:'Upload Food Safety Certificate', isUpload: true, cat:'Food Safety & HACCP' },
                { id:'boh-whs', label:'WHS induction sign-off' },
                { id:'boh-emergency', label:'Emergency procedures acknowledgement' }
            ]
        },
        'Bar': {
            'Day 1: Bar Orientation': [
                { id:'bar-layout', label:'Bar layout — wells, speed rail, back bar, fridges' },
                { id:'bar-pos', label:'POS operation — drink orders, tabs, payments' },
                { id:'bar-glass', label:'Glassware knowledge — types, handling, breakage protocol' },
                { id:'bar-spirits', label:'Spirits knowledge — house pours, premium options' },
                { id:'bar-beer', label:'Beer & wine list — tap beers, wine by glass, sake' }
            ],
            'Day 2: Skills & Compliance': [
                { id:'bar-cocktails', label:'Cocktail menu — recipes, garnishes, presentation' },
                { id:'bar-stock', label:'Stock rotation, par levels & restocking procedure' },
                { id:'bar-rsa', label:'RSA protocol — ID checking, refusal, intoxication signs' },
                { id:'bar-close', label:'Bar closing procedure — clean, restock, secure' },
                { id:'bar-coffee', label:'Coffee machine operation (if applicable)' }
            ],
            'Compliance': [
                { id:'bar-rsa-cert', label:'Upload RSA Certificate', isUpload: true, cat:'Staff RSAs & Certs' },
                { id:'bar-allergen', label:'Allergen awareness for cocktails & beverages' },
                { id:'bar-emergency', label:'Emergency procedures acknowledgement' }
            ]
        }
    };
    window.saveToDisk();
    window.showToast('Onboarding templates loaded! (FOH, BOH, Bar)');
};

window.renderBWISetupWizard = () => {
    const E = window.esc;
    const checks = {
        tasks: (window.rotationalTasks||[]).length,
        checklists: window.shiftChecklistItems ? (window.shiftChecklistItems.opening||[]).length : 0,
        fridges: (window.fridgeUnits||[]).length > 3 ? (window.fridgeUnits||[]).length : 0,
        masterCL: Object.keys(window.masterChecklists||{}).length > 2 ? Object.keys(window.masterChecklists||{}).length : 0,
        kbCats: (window.kbCategories||[]).length,
        sops: (window.knowledgeBase||[]).length,
        badges: (window.badgeDefinitions||[]).length,
        onboarding: Object.keys(window.onboardingTemplates||{}).length > 2 ? Object.keys(window.onboardingTemplates||{}).length : 0
    };

    const row = (label, count, unit, seedFn, icon) => {
        const done = count > 0;
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:20px;">${icon}</span>
                <div>
                    <strong style="font-size:14px;">${E(label)}</strong>
                    <div style="font-size:12px;color:${done?'var(--green)':'var(--text-muted)'};">${done ? count + ' ' + unit + ' loaded' : 'Not configured'}</div>
                </div>
            </div>
            <button onclick="${seedFn}" class="btn ${done?'btn-outline':'btn-blue'}" style="font-size:12px;padding:6px 14px;">${done?'Reset':'Load Defaults'}</button>
        </div>`;
    };

    const html = `<div style="margin-bottom:20px;">
        <p style="color:var(--text-muted);font-size:13px;margin:0 0 15px 0;">Load Bar Wa Izakaya operational defaults. Each section can be fully edited after loading. Existing data will ask for confirmation before replacing.</p>
        ${row('Rotational Tasks', checks.tasks, 'tasks', 'window.seedRotationalTasks()', '🔄')}
        ${row('Shift Checklists', checks.checklists, 'items (opening)', 'window.seedShiftChecklists()', '✅')}
        ${row('Fridge / Freezer Units', checks.fridges, 'units', 'window.seedFridgeUnits()', '🌡️')}
        ${row('Custom Checklists', checks.masterCL, 'categories', 'window.seedMasterChecklists()', '📋')}
        ${row('KB Categories', checks.kbCats, 'categories', 'window._seedKBCatsWizard()', '📂')}
        ${row('Knowledge Base SOPs', checks.sops, 'SOPs', 'window.seedKnowledgeBase()', '📚')}
        ${row('Badge Definitions', checks.badges, 'badges', 'window._seedBadgesWizard()', '🏆')}
        ${row('Onboarding Templates', checks.onboarding, 'roles', 'window._seedOnboardingWizard()', '👤')}
    </div>
    <button onclick="window._seedAllBWI()" class="btn btn-green" style="width:100%;font-size:15px;padding:12px;">🚀 Load All BWI Defaults</button>
    <p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px;">Only populates sections that are empty or have placeholder data. Will not overwrite your customisations.</p>`;

    window.openModal('🏮 BWI Setup Wizard', html);
};

// Wizard wrappers (avoid escaped quotes in template literals)
window._seedKBCatsWizard = () => { window.seedKBCategories(); window.saveToDisk(); window.showToast('Categories loaded!'); window.closeModal(); window.renderBWISetupWizard(); };
window._seedBadgesWizard = () => { window._seedDefaultBadges(); window.closeModal(); window.renderBWISetupWizard(); };
window._seedOnboardingWizard = () => { window.seedOnboardingTemplates(); window.closeModal(); window.renderBWISetupWizard(); };

window._seedAllBWI = () => {
    let count = 0;
    // Tasks
    if ((window.rotationalTasks||[]).length === 0) { window._doSeedTasks(); count++; }
    // Shift checklists — seed if null or using defaults
    if (!window.shiftChecklistItems || (window.shiftChecklistItems.opening||[]).length <= 8) { window._doSeedChecklists(); count++; }
    // Fridges — seed if still on generic defaults
    if ((window.fridgeUnits||[]).length <= 3) { window._doSeedFridges(); count++; }
    // Master checklists — seed if placeholder
    const clKeys = Object.keys(window.masterChecklists||{});
    if (clKeys.length <= 2 && (clKeys.includes('Opening Duties') || clKeys.length === 0)) { window._doSeedMasterChecklists(); count++; }
    // KB categories
    if ((window.kbCategories||[]).length === 0) { window.seedKBCategories(); count++; }
    // SOPs
    if ((window.knowledgeBase||[]).length === 0) { window._doSeedKB(); count++; }
    // Badges
    if ((window.badgeDefinitions||[]).length === 0) { window._seedDefaultBadges(); count++; }
    // Onboarding
    if (Object.keys(window.onboardingTemplates||{}).length <= 2) { window.seedOnboardingTemplates(); count++; }

    window.saveToDisk();
    window.closeModal();
    if (count > 0) {
        window.showToast('BWI defaults loaded across ' + count + ' sections!');
    } else {
        window.showToast('All sections already have data — nothing to seed.');
    }
    window.showView('dashboard');
};

// --- 4. FIREBASE & LOCAL BACKUP CONNECTOR ---
window.saveKeys =['inventoryItems', 'recipes', 'wastageLogs', 'suppliers', 'salesData', 'salesTargets', 'orientationLogs', 'rotationalTasks', 'taskHistory', 'tempLogs', 'complianceLogs', 'defectLogs', 'equipmentData', 'contractorLogs', 'digitalSafe', 'phoneBook', 'incidentLogs', 'handoverLogs', 'knowledgeBase', 'shiftRosters', 'onboardingTemplates', 'fridgeUnits', 'masterChecklists', 'posMappings', 'storageZones', 'depletionLogs', 'safeCategories', 'kbCategories', 'orderHistory', 'staffDirectory', 'lsImportLog', 'lsSalesByData', 'shiftChecklistItems', 'invoiceMatchMap', 'priceHistory', 'inventorySubcategories', 'kbSubcategories', 'safeSubcategories', 'handoverTemplateConfig', 'qualificationTypes', 'stockMovements', 'stocktakes', 'auditLog', 'announcements', 'kudos', 'dailyBriefings', 'badgeDefinitions', 'staffHubConfig', 'shiftFeedbackTags'];
