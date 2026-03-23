// --- 1. GLOBAL STATE INITIALIZATION ---
window.inventoryItems = []; 
window.recipes = []; 
window.wastageLogs = [];
window.posMappings = {};
window.storageZones = [];

// UPDATED: Commercial Supplier data (Min spend & Delivery Days)
window.suppliers = [
    {name: "Moco Food Services", cutoff: "15:00", contact: "orders@moco.com.au", minSpend: 150, deliveryDays: ["Mon", "Wed", "Fri"]},
    {name: "Freshline Tasmania", cutoff: "17:00", contact: "admin@freshline.net.au", minSpend: 100, deliveryDays: ["Mon", "Tue", "Thu", "Sat"]}
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
    sections: ['Service Summary', "What's 86'd", 'Stock Alerts', 'Issues / Follow-ups', 'Opening Notes for Tomorrow'],
    requireStaff: true
};
window.lsImportLog = [];
window.lsSalesByData = {};
window.safeCategories = [
    'Licenses & Permits', 'Insurance', 'Fire Safety & Emergency', 'Food Safety & HACCP',
    'Staff RSAs & Certs', 'Employment & HR', 'Lease & Property', 'Supplier Agreements',
    'Financial & Tax', 'Training & Procedures', 'Health & Safety (WHS)', 'Menus & Marketing', 'General / Other'
];
window.kbCategories = [];
window.onboardingTemplates = {
    'FOH (Front of House)': { 'Day 1: Basics': [{id: 'foh1', label: 'Venue Tour & Safety'}], 'Compliance': [{id: 'foh3', label: 'Upload RSA', isUpload: true, cat: 'Staff RSAs'}] },
    'BOH (Back of House)': { 'Day 1: Kitchen': [{id: 'boh1', label: 'Kitchen Safety'}], 'Compliance': [{id: 'boh3', label: 'Upload Food Safety Cert', isUpload: true, cat: 'Food Safety Certs'}] }
};
window.fridgeUnits = ["Walk-in Coolroom", "Kitchen Fridge 1", "Bar Reach-in"];
window.masterChecklists = { "Opening Duties": ["Unlock doors", "Check coffee machine"], "Closing Kitchen": ["Deep clean grill", "Empty bins"] };

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

// --- 2b. AUTOFOCUS ON MODAL OPEN ---
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

// --- 3. KIOSK PIN SECURITY ---
window.isLocked = !!localStorage.getItem('venuePin');
window._lastActivity = Date.now();
window._autoLockMinutes = 10;

['click','keypress','touchstart'].forEach(evt =>
    document.addEventListener(evt, () => { window._lastActivity = Date.now(); }, { passive: true })
);

setInterval(() => {
    if (!window.isLocked && localStorage.getItem('venuePin')) {
        const idleMinutes = (Date.now() - window._lastActivity) / 60000;
        if (idleMinutes >= window._autoLockMinutes) {
            window.isLocked = true;
            window.checkLockState();
            window.showToast('Hub auto-locked after inactivity.');
        }
    }
}, 60000);

window._restrictedViews = [
    'sales', 'suppliers', 'recipes', 'invoice', 'orientation', 'safe', 'handover',
    'margins', 'menu-engineering', 'sell-price-editor', 'price-alerts', 'forecast',
    'staff-directory', 'bulk-category-editor', 'pos-alias-editor', 'ai-order',
    'cross-venue', 'par-editor', 'batch-linker', 'costing-report', 'prime-cost', 'lightspeed-import'
];

window.checkLockState = () => {
    const restrictedItems = document.querySelectorAll('.restricted');
    const lockBtn = document.getElementById('btn-lock');
    if (window.isLocked) {
        restrictedItems.forEach(el => el.style.display = 'none');
        if (lockBtn) { lockBtn.innerHTML = '🔓 Unlock Hub'; lockBtn.style.background = 'rgba(59,130,246,0.1)'; lockBtn.style.color = 'var(--blue)'; lockBtn.style.borderColor = 'rgba(59,130,246,0.2)'; }
        if (window._restrictedViews.includes(window.currentView)) window.showView('dashboard');
    } else {
        restrictedItems.forEach(el => el.style.display = 'flex');
        if (lockBtn) { lockBtn.innerHTML = '🔒 Lock Hub'; lockBtn.style.background = 'rgba(239,68,68,0.1)'; lockBtn.style.color = 'var(--red)'; lockBtn.style.borderColor = 'rgba(239,68,68,0.2)'; }
    }
};

window._showPinModal = (title, subtitle, onSuccess) => {
    window._pinBuffer = '';
    window._pinCallback = onSuccess;
    const body = '<div style="text-align:center;">' +
        (subtitle ? '<p style="color:var(--text-muted);font-size:13px;margin:0 0 20px;">' + subtitle + '</p>' : '') +
        '<div id="pin-dots" style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;">' +
            '<div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div>' +
        '</div>' +
        '<div id="pin-error" style="color:var(--red);font-size:12px;min-height:20px;margin-bottom:12px;"></div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:240px;margin:0 auto;">' +
            [1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => {
                if (k === '') return '<div></div>';
                if (k === '⌫') return '<button onclick="window._pinKey(\'del\')" class="btn btn-outline" style="font-size:18px;padding:14px;border-radius:12px;">⌫</button>';
                return '<button onclick="window._pinKey(\'' + k + '\')" class="btn btn-outline" style="font-size:20px;font-weight:600;padding:14px;border-radius:12px;">' + k + '</button>';
            }).join('') +
        '</div>' +
    '</div>';
    _origOpenModal(title, body);
};

window._pinKey = (key) => {
    const errEl = document.getElementById('pin-error');
    if (errEl) errEl.textContent = '';
    if (key === 'del') {
        window._pinBuffer = window._pinBuffer.slice(0, -1);
    } else if (window._pinBuffer.length < 8) {
        window._pinBuffer += key;
    }
    // Update dots
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => {
        d.style.background = i < window._pinBuffer.length ? 'var(--brand-dark)' : 'transparent';
        d.style.border = '2px solid ' + (i < window._pinBuffer.length ? 'var(--brand-dark)' : 'var(--border)');
    });
    // Auto-submit at 4+ digits after short delay
    if (window._pinBuffer.length >= 4) {
        setTimeout(() => {
            if (window._pinCallback) window._pinCallback(window._pinBuffer);
        }, 200);
    }
};

window.requirePin = (onSuccess) => {
    const pin = localStorage.getItem('venuePin');
    if (!pin) { onSuccess(); return; }
    if (!window.isLocked) { onSuccess(); return; }
    window._showPinModal('🔒 Enter PIN', 'Manager PIN required to continue', (attempt) => {
        if (attempt === pin) {
            window.isLocked = false;
            window._lastActivity = Date.now();
            window.closeModal();
            window.checkLockState();
            window.showToast('Hub unlocked.');
            onSuccess();
        } else {
            window._pinBuffer = '';
            const dots = document.querySelectorAll('.pin-dot');
            dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.textContent = 'Incorrect PIN. Try again.';
        }
    });
};

window.toggleLock = () => {
    const pin = localStorage.getItem('venuePin');
    if (!pin) {
        // First time — set up PIN via styled modal
        window._showPinModal('🔐 Set Manager PIN', 'Choose a 4+ digit PIN to secure restricted areas', (newPin) => {
            if (newPin.length >= 4) {
                localStorage.setItem('venuePin', newPin);
                window.isLocked = true;
                window.closeModal();
                window.checkLockState();
                window.showToast('PIN set. Hub locked.');
            }
        });
    } else if (window.isLocked) {
        window.requirePin(() => {});
    } else {
        window.isLocked = true;
        window.checkLockState();
        window.showView('dashboard');
        window.showToast('Hub locked.');
    }
};

// --- 4. FIREBASE & LOCAL BACKUP CONNECTOR ---
window.saveKeys = ['inventoryItems', 'recipes', 'wastageLogs', 'suppliers', 'salesData', 'salesTargets', 'orientationLogs', 'rotationalTasks', 'taskHistory', 'tempLogs', 'complianceLogs', 'defectLogs', 'equipmentData', 'contractorLogs', 'digitalSafe', 'phoneBook', 'incidentLogs', 'handoverLogs', 'knowledgeBase', 'shiftRosters', 'onboardingTemplates', 'fridgeUnits', 'masterChecklists', 'posMappings', 'storageZones', 'depletionLogs', 'safeCategories', 'kbCategories', 'orderHistory', 'staffDirectory', 'lsImportLog', 'lsSalesByData', 'shiftChecklistItems', 'invoiceMatchMap', 'priceHistory', 'inventorySubcategories', 'kbSubcategories', 'safeSubcategories', 'handoverTemplateConfig', 'qualificationTypes', 'stockMovements', 'stocktakes'];


// =============================================================================
// MULTI-VENUE FRAMEWORK (LIA)
// Venue selector persisted in localStorage
// Each venue has its own Firebase doc + localStorage namespace
// =============================================================================
// =============================================================================
// MULTI-VENUE SYSTEM
// =============================================================================
window._venues = [
    { id: 'bwi', name: 'Bar Wa Izakaya', emoji: '🍶', color: '#7c3aed', docId: 'hobartHub' },
    { id: 'lia', name: 'Lost In Asia', emoji: '🌴', color: '#22d3ee', docId: 'lia' }
];

window.getCurrentVenue = () => {
    // Check URL param first (for setup), then localStorage, then default to bwi
    const urlParams = new URLSearchParams(window.location.search);
    const urlVenue = urlParams.get('venue');
    if (urlVenue && window._venues.find(v=>v.id===urlVenue)) {
        // Set this device's default venue from URL param
        if (urlParams.get('setup') === 'true') {
            localStorage.setItem('hubDeviceVenue', urlVenue);
            // Remove the URL params without reload
            window.history.replaceState({}, '', window.location.pathname);
            window.showToast('Device set to ' + urlVenue.toUpperCase() + ' permanently!');
        }
    }
    // Device venue = permanent venue for this device (set during setup)
    // Active venue = current session venue (can be switched by PIN holders)
    const deviceVenue = localStorage.getItem('hubDeviceVenue') || 'bwi';
    const activeVenue = localStorage.getItem('hubActiveVenue') || deviceVenue;
    return window._venues.find(v=>v.id===activeVenue) || window._venues[0];
};

window.getVenueDocId = () => window.getCurrentVenue().docId;
window.getDeviceVenue = () => localStorage.getItem('hubDeviceVenue') || 'bwi';

// localStorage keys are venue-prefixed to avoid cross-contamination on shared devices
window.getLocalKey = (key) => window.getCurrentVenue().id + '_' + key;

window.renderVenueSwitcher = () => {
    if (window.isLocked && localStorage.getItem('venuePin')) {
        window.requirePin(() => window.renderVenueSwitcher());
        return;
    }
    const current = window.getCurrentVenue();
    const deviceVenue = window.getDeviceVenue();
    const venueHtml = window._venues.map(v => {
        const isActive = current.id === v.id;
        const isDevice = deviceVenue === v.id;
        return '<div onclick="window.switchVenue(\'' + v.id + '\')" ' +
            'style="display:flex;align-items:center;gap:12px;padding:15px;border-radius:10px;cursor:pointer;' +
            'border:2px solid ' + (isActive?v.color:'var(--border)') + ';' +
            'background:' + (isActive?'rgba(139,92,246,0.08)':'var(--bg-main)') + ';' +
            'margin-bottom:10px;transition:all 0.2s;">' +
            '<div style="font-size:32px;">' + v.emoji + '</div>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:bold;font-size:15px;color:' + (isActive?v.color:'var(--text-main)') + ';">' + v.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + 
                    (isActive ? 'Currently active' : 'Click to switch') + 
                    (isDevice ? ' · <strong>This device</strong>' : '') + 
                '</div>' +
            '</div>' +
            (isActive ? '<div style="color:' + v.color + ';font-size:20px;">✓</div>' : '') +
        '</div>';
    }).join('');

    const setupHtml = '<div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--border);">' +
        '<div style="margin-bottom:15px;padding:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px;">' +
        '<p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">🗑️ <strong>Wipe Venue Data</strong> — Reset current venue to blank:</p>' +
        '<button onclick="window.wipeVenueData()" class="btn btn-outline" style="width:100%;color:var(--red);border-color:var(--red);font-size:13px;">⚠️ Wipe ' + current.name + ' Data</button>' +
        '</div>' +
        '<p style="font-size:12px;color:var(--text-muted);margin:0 0 10px 0;">⚙️ <strong>Device Setup</strong> — Set which venue this device defaults to:</p>' +
        '<div style="display:flex;gap:8px;margin-bottom:15px;">' +
        window._venues.map(v => 
            '<button onclick="window.setDeviceVenue(\'' + v.id + '\')" class="btn ' + (deviceVenue===v.id?'btn-dark':'btn-outline') + '" style="flex:1;font-size:13px;">' + v.emoji + ' ' + v.name + '</button>'
        ).join('') +
        '</div>' +
        '<p style="font-size:11px;color:var(--text-muted);margin:0;">Device venue determines which data loads by default and what staff see.</p>' +
    '</div>';

    window.openModal('🏢 Venue Management', venueHtml + setupHtml);
};

window.wipeVenueData = () => {
    const v = window.getCurrentVenue();
    window.closeModal();
    window.confirmAction({
        title: '⚠️ Wipe All Data',
        message: 'This will permanently delete <strong>all</strong> inventory, recipes, takings, compliance logs, staff data and settings for <strong>' + window.esc(v.name) + '</strong>.<br><br>This <strong>cannot be undone</strong>.',
        confirmLabel: 'Wipe Everything',
        confirmColor: 'var(--red)',
        tier: 'critical',
        typeWord: 'WIPE',
        onConfirm: () => {
            const vid = v.id;
            window.saveKeys.forEach(k => {
                const emptyVal = Array.isArray(window[k]) ? [] : (typeof window[k] === 'object' ? {} : '');
                window[k] = emptyVal;
                localStorage.removeItem(vid + '_' + k);
                localStorage.removeItem(k);
            });
            window.saveToDisk();
            window.showToast(v.name + ' data wiped. Starting fresh!');
            setTimeout(() => location.reload(), 1000);
        }
    });
};

window.switchVenue = (id) => {
    if (id === window.getCurrentVenue().id) { window.closeModal(); return; }
    localStorage.setItem('hubActiveVenue', id);
    window.closeModal();
    window.showToast('Switching to ' + (window._venues.find(v=>v.id===id)||{}).name + '...');
    setTimeout(() => location.reload(), 600);
};

window.setDeviceVenue = (id) => {
    const venue = window._venues.find(v=>v.id===id);
    if (!venue) return;
    window.closeModal();
    window.confirmAction({
        title: '🏢 Set Device Venue',
        message: 'Set this device to always default to <strong>' + window.esc(venue.name) + '</strong>?<br>This affects what staff see when they open the Hub.',
        confirmLabel: 'Set Default',
        confirmColor: 'var(--blue)',
        tier: 'standard',
        onConfirm: () => {
            localStorage.setItem('hubDeviceVenue', id);
            localStorage.setItem('hubActiveVenue', id);
            window.showToast('Device set to ' + venue.name + '!');
            setTimeout(() => location.reload(), 600);
        }
    });
};

window.updateVenueBadge = () => {
    const v = window.getCurrentVenue();
    const badge = document.getElementById('venue-badge');
    if (badge) {
        badge.textContent = v.emoji + ' ' + v.name;
        badge.style.borderColor = v.color;
        badge.style.color = v.color;
    }
    // Apply venue theme
    window.applyVenueTheme(v);
};

window.applyVenueTheme = (v) => {
    const root = document.documentElement;
    const body = document.body;
    // Remove all venue classes
    body.classList.remove('venue-bwi', 'venue-lia');
    body.classList.add('venue-' + v.id);

    if (v.id === 'lia') {
        root.style.setProperty('--brand-dark', '#22d3ee');
        root.style.setProperty('--brand-accent', '#0ea5e9');
        root.style.setProperty('--sidebar-bg', '#041a1a');
        root.style.setProperty('--sidebar-hover', '#083030');
        root.style.setProperty('--blue', '#22d3ee');
        root.style.setProperty('--purple', '#22d3ee');
        root.style.setProperty('--card-bg', '#0a1f1f');
        root.style.setProperty('--bg-main', '#041515');
        // Top bar colour
        const header = document.querySelector('.main-header');
        if (header) { header.style.borderBottom = '3px solid #22d3ee'; header.style.background = 'linear-gradient(135deg, #041a1a, #083030)'; }
        // Logo
        const logoEl = document.getElementById('venue-logo');
        if (logoEl) { logoEl.src = './lia-logo.png'; logoEl.style.filter = 'none'; logoEl.style.width = '120px'; logoEl.style.marginTop = '4px'; }
        document.title = 'Lost In Asia Hub';
    } else {
        root.style.setProperty('--brand-dark', '#a78bfa');
        root.style.setProperty('--brand-accent', '#7c3aed');
        root.style.setProperty('--sidebar-bg', '#090912');
        root.style.setProperty('--sidebar-hover', '#1e1e2e');
        root.style.setProperty('--blue', '#3b82f6');
        root.style.setProperty('--purple', '#8b5cf6');
        root.style.setProperty('--card-bg', '#13131a');
        root.style.setProperty('--bg-main', '#0d0d14');
        // Reset top bar
        const header = document.querySelector('.main-header');
        if (header) { header.style.borderBottom = ''; header.style.background = ''; }
        // Logo
        const logoEl = document.getElementById('venue-logo');
        if (logoEl) { logoEl.src = './bwi-logo.png'; logoEl.style.filter = 'invert(1) contrast(1.4) brightness(1.3)'; logoEl.style.width = '88px'; }
        document.title = 'Hobart Hub | Bar Wa Izakaya';
    }
};



// =============================================================================
// TANDA API
// =============================================================================
window.getTandaToken = () => {
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    return localStorage.getItem(vid + '_tandaApiToken') || '';
};

window.fetchTanda = async (endpoint) => {
    const token = window.getTandaToken();
    if (!token) return null;
    try {
        const res = await fetch('https://my.tanda.co/api/v2/' + endpoint, {
            headers: { 'Authorization': 'bearer ' + token, 'Content-Type': 'application/json' }
        });
        if (!res.ok) return null;
        return await res.json();
    } catch(e) { return null; }
};

window.loadTandaData = async () => {
    if (!window.getTandaToken()) return;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Step 1: Get all users in the organisation
    const usersData = await window.fetchTanda('users');
    if (!usersData) { console.log('Tanda: could not fetch users'); return; }

    const users = Array.isArray(usersData) ? usersData : (usersData.users || []);
    if (users.length === 0) { console.log('Tanda: no users found'); return; }

    const userIds = users.map(u => u.id).join(',');
    console.log('Tanda: fetching schedules for', users.length, 'staff');

    // Step 2: Get schedules for ALL users for today
    const schedData = await window.fetchTanda(
        'schedules?from=' + dateStr + '&to=' + dateStr + '&user_ids=' + userIds + '&show_costs=true&include_names=true'
    );

    if (!schedData) { console.log('Tanda: no schedule data'); return; }

    const schedules = Array.isArray(schedData) ? schedData : (schedData.schedules || []);
    let totalHours = 0, totalCost = 0, staff = [];

    schedules.forEach(s => {
        // Calculate hours from duration, or from start/finish timestamps
        let hrs = 0;
        if (s.duration) {
            hrs = s.duration / 3600;
        } else if (s.finish && s.start) {
            hrs = (s.finish - s.start) / 3600;
        } else if (s.finish_time && s.start_time) {
            // Time strings like "09:00" - calculate difference
            const [sh, sm] = s.start_time.split(':').map(Number);
            const [fh, fm] = s.finish_time.split(':').map(Number);
            hrs = ((fh * 60 + fm) - (sh * 60 + sm)) / 60;
            if (hrs < 0) hrs += 24; // overnight shift
        }
        totalHours += hrs;
        if (s.cost) totalCost += Number(s.cost);
        // Find user name
        const user = users.find(u => u.id === s.user_id);
        const name = (user && user.name) || s.user_name || ('Staff #' + (s.user_id||''));
        // Count staff even if hours are 0 (shift may not have started yet)
        if (name) staff.push({ name, hours: hrs > 0 ? hrs.toFixed(1) : 'Rostered' });
    });

    window._tandaData = {
        date: dateStr,
        rosteredHours: totalHours.toFixed(1),
        estimatedWageCost: totalCost.toFixed(2),
        staffCount: staff.length,
        staff,
        lastUpdated: new Date().toLocaleTimeString()
    };
    console.log('Tanda loaded:', window._tandaData);
    if (window.currentView === 'dashboard' || window.currentView === 'prime-cost') window.showView(window.currentView);
};

window.openTandaSettings = () => {
    const token = window.getTandaToken();
    const html = '<p style="font-size:13px;color:var(--text-muted);margin-top:0;">Connect Tanda to automatically pull rostered hours and wage costs.</p>' +
        '<label style="font-size:11px;color:var(--text-muted);">API Token — get from: my.tanda.co/api/v2/my_tokens</label>' +
        '<input type="text" id="tanda-token" class="input-box" value="' + token + '" placeholder="Paste Tanda API token...">' +
        '<button onclick="window.saveTandaToken()" class="btn btn-green" style="width:100%;margin-bottom:8px;">Save & Connect</button>' +
        (token ? '<button onclick="window.loadTandaData();window.closeModal();window.showToast(\'Refreshing...\')" class="btn btn-outline" style="width:100%;">🔄 Refresh Now</button>' : '') +
        (window._tandaData ? '<div style="margin-top:12px;font-size:12px;color:var(--text-muted);">Last sync: ' + window._tandaData.lastUpdated + ' · ' + window._tandaData.staffCount + ' staff · Est. $' + window._tandaData.estimatedWageCost + '</div>' : '');
    window.openModal('⏱️ Tanda Integration', html);
};

window.saveTandaToken = () => {
    const token = document.getElementById('tanda-token').value.trim();
    if (!token) return window.showToast('Token required.','error');
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_tandaApiToken', token);
    window.closeModal();
    window.showToast('Tanda connected!');
    window.loadTandaData();
};

// Debounced Firebase write — max once every 4 seconds
window._saveTimer = null;
window._lastFirebaseSave = 0;
window._firebaseRetryCount = 0;

window.saveToDisk = () => {
    const syncLabel = document.getElementById('sync-status');
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';

    // Always save to localStorage immediately
    window.saveKeys.forEach(k => {
        try { localStorage.setItem(vid+'_'+k, JSON.stringify(window[k])); } catch(e) {}
    });

    if (syncLabel) { syncLabel.innerHTML = '💾 Saved Local'; syncLabel.style.color = 'var(--blue)'; }
    window.updateNotifBadge();

    // Debounce Firebase — only write if 4+ seconds since last write
    if (window._saveTimer) clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => {
        if (typeof db === 'undefined') {
            if (syncLabel) { syncLabel.innerHTML = '🟢 Saved Local'; syncLabel.style.color = 'var(--green)'; }
            return;
        }
        const now = Date.now();
        if (now - window._lastFirebaseSave < 4000) return; // Extra guard
        window._lastFirebaseSave = now;
        let payload = {}; window.saveKeys.forEach(k => payload[k] = window[k]);
        db.collection('venueData').doc(window.getVenueDocId()).set(payload, { merge: true })
            .then(() => {
                window._firebaseRetryCount = 0;
                if (syncLabel) { syncLabel.innerHTML = '🟢 Live Sync'; syncLabel.style.color = 'var(--green)'; }
            })
            .catch(err => {
                console.error('Firebase save error:', err);
                window._firebaseRetryCount++;
                if (window._firebaseRetryCount <= 3) {
                    if (syncLabel) { syncLabel.innerHTML = '🔄 Retrying sync (' + window._firebaseRetryCount + '/3)...'; syncLabel.style.color = 'var(--orange)'; }
                    if (window.showToast && window._firebaseRetryCount === 1) window.showToast('Sync failed — retrying...', 'error');
                    setTimeout(() => { window._lastFirebaseSave = 0; window.saveToDisk(); }, 10000);
                } else {
                    if (syncLabel) { syncLabel.innerHTML = '❌ Sync Failed — <span onclick="window._firebaseRetryCount=0;window.saveToDisk()" style="cursor:pointer;text-decoration:underline;">Retry</span>'; syncLabel.style.color = 'var(--red)'; }
                    if (window.showToast) window.showToast('Data not synced to cloud. Check your connection.', 'error');
                }
            });
    }, 3000); // Wait 3 seconds after last save call before writing to Firebase
};

window.loadData = () => {
    // Manual reload — pull from Firebase and re-render
    const _vidLD = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => { try { window[k] = JSON.parse(localStorage.getItem(_vidLD+'_'+k) || localStorage.getItem(k)) || window[k]; } catch(e) {} });
    if (typeof db !== 'undefined') {
        db.collection('venueData').doc(window.getVenueDocId()).get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                window.saveKeys.forEach(k => { if (data[k] !== undefined) window[k] = data[k]; });
                const _vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => localStorage.setItem(_vid+'_'+k, JSON.stringify(window[k])));
                window.checkLockState();
                // Don't re-render here — avoid loop. User can navigate normally.
            }
        }).catch(err => console.error("Firebase read error:", err));
    } else {
        window.checkLockState();
    }
};

window.exportData = () => {
    let payload = {};
    window.saveKeys.forEach(k => payload[k] = window[k]);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
    const downloadAnchorNode = document.createElement('a'); downloadAnchorNode.setAttribute("href", dataStr); downloadAnchorNode.setAttribute("download", "HobartHub_Backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
};

window.importData = (event) => {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            window.saveKeys.forEach(k => { window[k] = data[k] || window[k]; });
            window.saveToDisk(); window.showToast('Data restored and synced to Firebase!'); window.showView('dashboard');
        } catch (err) { window.showToast('Error importing file.', 'error'); console.error(err); }
    };
    reader.readAsText(file);
};

// --- 5. GLOBAL TOAST NOTIFICATIONS ---
window.showToast = (msg, type = "success") => {
    const existing = document.getElementById('hub-toast');
    if(existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.id = 'hub-toast';
    toast.innerText = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = type === 'error' ? 'var(--red)' : 'var(--green)';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '30px';
    toast.style.fontWeight = 'bold';
    toast.style.fontSize = '14px';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    toast.style.zIndex = '10000';
    toast.style.animation = 'slideUp 0.3s ease forwards';
    
    // Add keyframes only once
    if (!document.getElementById('toast-keyframes')) {
        const style = document.createElement('style');
        style.id = 'toast-keyframes';
        style.innerHTML = '@keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 20px; opacity: 1; } } @keyframes slideDown { from { bottom: 20px; opacity: 1; } to { bottom: -50px; opacity: 0; } }';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideDown 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- 6. VIEW ROUTER ---
window.currentView = 'dashboard';
window.showView = (view) => {
    window.closeModal(); // Clean up any open modals to prevent glitching
    if (window.isLocked && (window._restrictedViews||[]).includes(view)) {
        window.requirePin(() => window.showView(view));
        return;
    }
    
    window.currentView = view;
    const content = document.getElementById('mainContent');
    const viewTitle = document.getElementById('viewTitle');
    if (!content) return;
    
    // Update Sidebar Active State & Header Title
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeNav = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick') === `window.showView('${view}')`);
    if(activeNav) {
        activeNav.classList.add('active');
        if(viewTitle) viewTitle.innerText = activeNav.innerText.replace(/[^\x00-\x7F]/g, "").trim(); // Strips emojis from the top header
    }
    
    try {
        if (view === 'dashboard' && window.renderManagerHub) content.innerHTML = window.renderManagerHub();
        else if (view === 'inventory' && window.renderInventoryView) content.innerHTML = window.renderInventoryView();
        else if (view === 'suppliers' && window.renderSupplierView) content.innerHTML = window.renderSupplierView();
        else if (view === 'sales' && window.renderSalesView) content.innerHTML = window.renderSalesView();
        else if ((view === 'orientation' || view === 'training') && window.renderStaffHubView) { if (view === 'training') window._staffHubTab = 'onboarding'; content.innerHTML = window.renderStaffHubView(); }
        else if (view === 'tasks' && window.renderTaskView) content.innerHTML = window.renderTaskView();
        else if (view === 'compliance' && window.renderComplianceView) content.innerHTML = window.renderComplianceView();
        else if (view === 'maintenance' && window.renderMaintenanceView) content.innerHTML = window.renderMaintenanceView();
        else if (view === 'safe' && window.renderSafeView) content.innerHTML = window.renderSafeView();
        else if ((view === 'phonebook' || view === 'contacts') && window.renderStaffHubView) { window._staffHubTab = 'phonebook'; content.innerHTML = window.renderStaffHubView(); }
        else if (view === 'incidents' && window.renderIncidentView) content.innerHTML = window.renderIncidentView();
        else if (view === 'handover' && window.renderHandoverView) content.innerHTML = window.renderHandoverView();
        else if ((view === 'knowledge' || view === 'sops') && window.renderKnowledgeView) content.innerHTML = window.renderKnowledgeView();
        else if (view === 'rosters' && window.renderRosterView) content.innerHTML = window.renderRosterView();
        else if (view === 'recipes' && window.renderRecipeView) content.innerHTML = window.renderRecipeView();
        else if (view === 'invoice' && window.renderInvoiceView) content.innerHTML = window.renderInvoiceView();
        else if (view === 'wastage' && window.renderWastageView) content.innerHTML = window.renderWastageView();
        else if (view === 'allergens' && window.renderAllergenView) content.innerHTML = window.renderAllergenView();
        else if ((view === 'runsheet' || view === 'sheet-gen') && window.renderSheetGenView) content.innerHTML = window.renderSheetGenView();
        else if ((view === 'prep-list' || view === 'preplist') && window.renderPrepListView) content.innerHTML = window.renderPrepListView();
        else if (view === 'zones' && window.renderZoneManager) content.innerHTML = window.renderZoneManager();
        else if (view === 'margins' && window.renderMarginView) content.innerHTML = window.renderMarginView();
        else if (view === 'menu-engineering' && window.renderMenuEngineeringView) content.innerHTML = window.renderMenuEngineeringView();
        else if (view === 'batch-linker' && window.renderAiBatchLinker) content.innerHTML = window.renderAiBatchLinker();
        else if (view === 'par-editor' && window.renderParEditor) content.innerHTML = window.renderParEditor();
        else if (view === 'sell-price-editor' && window.renderSellPriceEditor) content.innerHTML = window.renderSellPriceEditor();
        else if (view === 'price-alerts' && window.renderPriceAlertsView) content.innerHTML = window.renderPriceAlertsView();
        else if (view === 'staff-directory' && window.renderStaffHubView) { window._staffHubTab = 'directory'; content.innerHTML = window.renderStaffHubView(); }
        else if (view === 'forecast' && window.renderForecastView) content.innerHTML = window.renderForecastView();
        else if (view === 'cross-venue') { if (window.renderCrossVenueDashboard) window.renderCrossVenueDashboard(); }
        else if (view === 'ai-order' && window.renderAiOrderView) content.innerHTML = window.renderAiOrderView();
        else if (view === 'prime-cost' && window.renderPrimeCostView) content.innerHTML = window.renderPrimeCostView();
        else if (view === 'lightspeed-import' && window.renderLightspeedImportView) content.innerHTML = window.renderLightspeedImportView();
        else if (view === 'bulk-category-editor' && window.renderBulkCategoryEditor) content.innerHTML = window.renderBulkCategoryEditor();
        else if (view === 'pos-alias-editor' && window.renderPosAliasEditor) content.innerHTML = window.renderPosAliasEditor();
        else if (view === 'stock-count' && window.renderQuickStockCount) content.innerHTML = window.renderQuickStockCount();
        else if (view === 'variance' && window.renderVarianceReport) content.innerHTML = window.renderVarianceReport();
        else if (view === 'haccp-history' && window.renderComplianceView) { window._complianceTab = 'haccp'; content.innerHTML = window.renderComplianceView(); }
        else if (view === 'stock-audit' && window.renderStockAuditView) content.innerHTML = window.renderStockAuditView();
        else if (view === 'stocktake' && window.renderStocktakeView) content.innerHTML = window.renderStocktakeView();
        else content.innerHTML = `<div class="card" style="text-align:center;"><h3>Page Not Found</h3><p>Could not find view: ${view}</p></div>`;
    } catch (err) {
        console.error("Error rendering view:", err);
        content.innerHTML = `<div class="card" style="border-left:5px solid var(--red);"><h3>⚠️ Page Error</h3><p>${err.message}</p></div>`;
    }
};

window.generateId = (prefix) => { return prefix + '_' + Math.random().toString(36).substr(2, 9); };

// --- GLOBAL SEARCH ---
window.globalSearch = (query) => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    const results = [];
    
    // Search inventory
    (window.inventoryItems || []).filter(i => !i.archived).forEach(item => {
        if (item.name.toLowerCase().includes(q) || (item.sku && item.sku.toLowerCase().includes(q)) || (item.supplier && item.supplier.toLowerCase().includes(q))) {
            results.push({ type: 'inventory', icon: '📦', label: item.name, sub: (item.category || '') + ' · ' + (item.supplier || 'No supplier'), action: "window.editInvItem('" + item.id + "')" });
        }
    });
    
    // Search recipes
    (window.recipes || []).filter(r => !r.archived).forEach(r => {
        if (r.name.toLowerCase().includes(q) || (r.posAlias && r.posAlias.toLowerCase().includes(q))) {
            results.push({ type: 'recipe', icon: '⚖️', label: r.name, sub: r.type + ' · ' + (r.station || 'Kitchen'), action: "window.editRecipeForm('" + r.id + "')" });
        }
    });
    
    // Search Knowledge Base
    (window.knowledgeBase || []).forEach((k, i) => {
        if (k.title.toLowerCase().includes(q) || (k.content && k.content.toLowerCase().includes(q)) || (k.category && k.category.toLowerCase().includes(q))) {
            results.push({ type: 'sop', icon: '📚', label: k.title, sub: k.category || 'General', action: "window.viewSOP(" + i + ")" });
        }
    });
    
    // Search contacts
    (window.phoneBook || []).forEach((c, i) => {
        if (c.name.toLowerCase().includes(q) || (c.phone && c.phone.toLowerCase().includes(q))) {
            results.push({ type: 'contact', icon: '📞', label: c.name, sub: c.category || '', action: "window.showView('phonebook')" });
        }
    });
    
    // Search Digital Safe (name + notes)
    (window.digitalSafe || []).forEach((d, i) => {
        if (d.name.toLowerCase().includes(q) || (d.category && d.category.toLowerCase().includes(q)) || (d.notes && d.notes.toLowerCase().includes(q))) {
            results.push({ type: 'document', icon: '🔒', label: d.name, sub: d.category || 'General', action: "window.showView('safe')" });
        }
    });
    
    // Search Staff Directory
    (window.staffDirectory || []).forEach((s, i) => {
        if (s.name.toLowerCase().includes(q) || (s.role && s.role.toLowerCase().includes(q))) {
            results.push({ type: 'staff', icon: '👥', label: s.name, sub: s.role || 'Staff', action: "window.showView('staff-directory')" });
        }
    });
    
    // Search suppliers
    (window.suppliers || []).forEach((s, i) => {
        if (s.name.toLowerCase().includes(q)) {
            results.push({ type: 'supplier', icon: '🚚', label: s.name, sub: s.contact || '', action: "window.showView('suppliers')" });
        }
    });
    
    return results.slice(0, 15);
};

window.renderGlobalSearchResults = (query) => {
    const resultsDiv = document.getElementById('global-search-results');
    if (!resultsDiv) return;
    if (!query || query.length < 2) { resultsDiv.style.display = 'none'; return; }
    const results = window.globalSearch(query);
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:15px;color:var(--text-muted);font-size:13px;text-align:center;">No results for "' + query + '"</div>';
        resultsDiv.style.display = 'block';
        return;
    }
    const grouped = {};
    results.forEach(r => { if (!grouped[r.type]) grouped[r.type] = []; grouped[r.type].push(r); });
    const typeLabels = { inventory:'Inventory', recipe:'Recipes', sop:'Knowledge Base', contact:'Contacts', document:'Digital Safe', staff:'Staff', supplier:'Suppliers' };
    let html = '';
    Object.keys(grouped).forEach(type => {
        html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 15px 4px;font-weight:bold;">' + (typeLabels[type]||type) + '</div>';
        grouped[type].forEach(r => {
            html += '<div onclick="' + r.action + ';document.getElementById(\'global-search-results\').style.display=\'none\';document.getElementById(\'global-search-input\').value=\'\';" style="padding:10px 15px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.15s;border-bottom:1px solid var(--border);" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'\'"><span style="font-size:16px;">' + r.icon + '</span><div><div style="font-size:13px;font-weight:500;">' + r.label + '</div><div style="font-size:11px;color:var(--text-muted);">' + r.sub + '</div></div></div>';
        });
    });
    resultsDiv.innerHTML = html;
    resultsDiv.style.display = 'block';
};

// Close search results on outside click
document.addEventListener('click', (e) => {
    const resultsDiv = document.getElementById('global-search-results');
    const searchInput = document.getElementById('global-search-input');
    if (resultsDiv && searchInput && !resultsDiv.contains(e.target) && e.target !== searchInput) {
        resultsDiv.style.display = 'none';
    }
});


// --- 8. NOTIFICATION CENTER ---
window._notifOpen = false;
window.getNotifications = function() {
    const notifs = [];
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-AU');
    const freqDays = { Weekly: 7, Fortnightly: 14, Monthly: 30, Quarterly: 90 };

    // Overdue rotational tasks
    (window.rotationalTasks || []).forEach(t => {
        if (t.dueDateMode === 'specific') {
            if (t.specificDueDate && new Date(t.specificDueDate) <= now) notifs.push({type:'task', icon:'🔄', text: t.name + ' is overdue', view:'tasks', priority:1});
        } else if (t.lastLogIso) {
            const days = (now - new Date(t.lastLogIso)) / 86400000;
            if (days >= (freqDays[t.freq] || 7)) notifs.push({type:'task', icon:'🔄', text: t.name + ' is overdue', view:'tasks', priority:1});
        } else if (t.anchorDate) {
            const anchor = new Date(t.anchorDate);
            if (anchor <= now) notifs.push({type:'task', icon:'🔄', text: t.name + ' is due', view:'tasks', priority:1});
        } else {
            notifs.push({type:'task', icon:'🔄', text: t.name + ' needs attention', view:'tasks', priority:2});
        }
    });

    // Expiring documents (<30 days)
    (window.digitalSafe || []).forEach(d => {
        if (!d.expiry) return;
        const exp = new Date(d.expiry);
        const daysLeft = (exp - now) / 86400000;
        if (daysLeft < 0) notifs.push({type:'doc', icon:'📄', text: d.name + ' has EXPIRED', view:'safe', priority:0});
        else if (daysLeft <= 30) notifs.push({type:'doc', icon:'📄', text: d.name + ' expires in ' + Math.ceil(daysLeft) + 'd', view:'safe', priority:1});
    });

    // Below par stock
    (window.inventoryItems || []).filter(i => !i.archived && i.par && i.stock < i.par).forEach(i => {
        notifs.push({type:'stock', icon:'📦', text: i.name + ' below par (' + (i.stock||0) + '/' + i.par + ')', view:'inventory', priority:2});
    });

    // Open maintenance tickets
    (window.defectLogs || []).filter(d => d.status !== 'Resolved').forEach(d => {
        notifs.push({type:'maint', icon:'🛠️', text: (d.item || 'Issue') + ' — open ticket', view:'maintenance', priority:2});
    });

    // Staff qualification expiry
    (window.staffDirectory || []).forEach(s => {
        if (!s.qualifications || s.status === 'Inactive') return;
        (window.qualificationTypes || []).forEach(qt => {
            const q = s.qualifications[qt.id];
            if (!q || !q.expiry) return;
            const daysLeft = (new Date(q.expiry) - now) / 86400000;
            if (daysLeft < 0) notifs.push({type:'qual', icon:'🎓', text: (s.name||'Staff') + ' — ' + qt.name + ' EXPIRED', view:'orientation', priority:0});
            else if (daysLeft <= 30) notifs.push({type:'qual', icon:'🎓', text: (s.name||'Staff') + ' — ' + qt.name + ' expires in ' + Math.ceil(daysLeft) + 'd', view:'orientation', priority:1});
        });
    });

    // HACCP breaches today
    (window.tempLogs || []).forEach(t => {
        if (t.time && t.time.includes && t.time.includes(todayStr) && parseFloat(t.value) > 5) {
            notifs.push({type:'haccp', icon:'🌡️', text: (t.unit||'Unit') + ' temp breach: ' + t.value + '°C', view:'compliance', priority:0});
        }
    });

    // Sort by priority (0=critical first)
    notifs.sort((a, b) => a.priority - b.priority);
    return notifs;
};

window.updateNotifBadge = function() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = window.getNotifications().length;
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
};

window.toggleNotifPanel = function() {
    window._notifOpen = !window._notifOpen;
    let panel = document.getElementById('notif-panel');
    if (!window._notifOpen) { if (panel) panel.remove(); return; }

    const notifs = window.getNotifications();
    const items = notifs.length === 0
        ? '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">✅ All clear — nothing needs attention</div>'
        : notifs.slice(0, 12).map(n =>
            `<div onclick="window.showView('${n.view}');window.toggleNotifPanel();" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                <span style="font-size:16px;flex-shrink:0;">${n.icon}</span>
                <span style="color:${n.priority===0?'var(--red)':n.priority===1?'var(--orange)':'var(--text-main)'}">${window.esc(n.text)}</span>
            </div>`
        ).join('');

    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.innerHTML = `<div style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);font-weight:700;border-bottom:1px solid var(--border);">Notifications (${notifs.length})</div>${items}`;
    panel.style.cssText = 'position:absolute;top:100%;right:0;width:340px;max-height:420px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.4);z-index:500;';
    const bell = document.getElementById('notif-bell');
    if (bell) bell.appendChild(panel);
};

// Close notif panel on outside click
document.addEventListener('click', (e) => {
    if (window._notifOpen && !e.target.closest('#notif-bell')) { window._notifOpen = false; const p = document.getElementById('notif-panel'); if (p) p.remove(); }
});

document.addEventListener('DOMContentLoaded', () => {
    // Show loading state immediately
    const content = document.getElementById('mainContent');
    if (content) content.innerHTML = '<div class="loading-state"><h2>Loading Hub...</h2><p>Connecting to Firebase...</p></div>';

    // Load from localStorage first for instant render
    window.saveKeys.forEach(k => {
        const _vid2 = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; const stored = localStorage.getItem(_vid2+'_'+k) || localStorage.getItem(k);
        if (stored) {
            try { window[k] = JSON.parse(stored); } catch(e) {}
        }
    });

    // Run init callbacks (e.g., restore active stocktake)
    (window._hubInitCallbacks || []).forEach(function(fn) { try { fn(); } catch(e) { console.error('Init callback error:', e); } });

    // Render immediately from localStorage
    window.checkLockState();
    window.updateVenueBadge();
    window.showView('dashboard');
    setTimeout(() => window.updateNotifBadge(), 500);
    setTimeout(() => window.loadTandaData(), 2000);

    // Force PIN setup if no PIN exists
    setTimeout(() => {
        if (!localStorage.getItem('venuePin')) {
            window._showPinModal('🔐 Setup Manager PIN', 'A PIN is required to secure restricted areas. Choose a 4+ digit PIN.', (newPin) => {
                if (newPin.length >= 4) {
                    localStorage.setItem('venuePin', newPin);
                    window.isLocked = true;
                    window.closeModal();
                    window.checkLockState();
                    window.showToast('PIN set! Hub is now secured.');
                }
            });
        }
    }, 800);

    // Then sync from Firebase in background and re-render if data differs
    if (typeof db !== 'undefined') {
        db.collection('venueData').doc(window.getVenueDocId()).get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                let changed = false;
                window.saveKeys.forEach(k => {
                    if (data[k] !== undefined) {
                        const newLen = Array.isArray(data[k]) ? data[k].length : JSON.stringify(data[k]).length;
                        const oldLen = Array.isArray(window[k]) ? window[k].length : JSON.stringify(window[k]).length;
                        if (newLen !== oldLen) changed = true;
                        window[k] = data[k];
                    }
                });
                // Also save Firebase data back to localStorage for next load
                const _vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => localStorage.setItem(_vid+'_'+k, JSON.stringify(window[k])));
                if (changed) {
                    window.checkLockState();
                    // Only re-render if on dashboard - avoid re-render loop
                    if (!window.currentView || window.currentView === 'dashboard') {
                        window.showView('dashboard');
                    }
                }
                const syncLabel = document.getElementById('sync-status');
                if (syncLabel) { syncLabel.innerHTML = '🟢 Live Sync'; syncLabel.style.color = 'var(--green)'; }
            }
        }).catch(err => {
            console.error("Firebase read error:", err);
            const syncLabel = document.getElementById('sync-status');
            if (syncLabel) { syncLabel.innerHTML = '⚠️ Offline Mode'; syncLabel.style.color = 'var(--orange)'; }
        });
    }
});
