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
    defaultViews: ['dashboard','compliance','wastage','tasks','maintenance','incidents','knowledge','noticeboard','rosters','my-hub','zones']
};
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

// --- 3. KIOSK PIN SECURITY (SHA-256 Hashed) ---
window._hashPin = async (pin) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_hobarthub_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Migrate plaintext PIN to hashed on first load
(function() {
    const storedPin = localStorage.getItem('venuePin');
    if (storedPin && storedPin.length < 64) {
        // Still plaintext — hash it now
        window._hashPin(storedPin).then(hashed => {
            localStorage.setItem('venuePin', hashed);
            localStorage.setItem('venuePinHashed', 'true');
        });
    }
})();

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
            window._activeStaffMember = null;
            sessionStorage.removeItem('activeStaffName');
            window.checkLockState();
            window.showToast('Hub auto-locked after inactivity.');
        }
    }
}, 60000);

window._restrictedViews = [
    'sales', 'suppliers', 'recipes', 'invoice', 'orientation', 'safe', 'handover',
    'margins', 'menu-engineering', 'sell-price-editor', 'price-alerts', 'forecast',
    'staff-directory', 'bulk-category-editor', 'pos-alias-editor', 'ai-order',
    'cross-venue', 'par-editor', 'batch-linker', 'costing-report', 'prime-cost', 'lightspeed-import',
    'badge-management', 'staff-hub-config', 'audit-log'
];

window.checkLockState = () => {
    // If a staff member is logged in, apply role-based filtering instead
    if (window._activeStaffMember) {
        window.applyRoleAccess();
        return;
    }
    const restrictedItems = document.querySelectorAll('.restricted');
    const lockBtn = document.getElementById('btn-lock');
    const staffBtn = document.getElementById('btn-staff-hub');
    if (window.isLocked) {
        restrictedItems.forEach(el => el.style.display = 'none');
        if (lockBtn) { lockBtn.innerHTML = '🔓 Unlock Hub'; lockBtn.style.background = 'rgba(59,130,246,0.1)'; lockBtn.style.color = 'var(--blue)'; lockBtn.style.borderColor = 'rgba(59,130,246,0.2)'; }
        if (staffBtn) staffBtn.style.display = 'flex';
        if (window._restrictedViews.includes(window.currentView)) window.showView('dashboard');
    } else {
        restrictedItems.forEach(el => {
            el.style.display = el.classList.contains('nav-section') ? 'block' : 'flex';
        });
        if (lockBtn) { lockBtn.innerHTML = '🔒 Lock Hub'; lockBtn.style.background = 'rgba(239,68,68,0.1)'; lockBtn.style.color = 'var(--red)'; lockBtn.style.borderColor = 'rgba(239,68,68,0.2)'; }
        if (staffBtn) staffBtn.style.display = 'none';
        window._activeStaffMember = null;
    }
};

// --- ROLE-BASED SIDEBAR FILTERING ---
// When a staff member is logged in, show only their role's allowed views
window.applyRoleAccess = () => {
    var staff = window._activeStaffMember;
    if (!staff) return;
    var role = staff.role || 'FOH';
    var config = ((window.staffHubConfig || {}).roles || {})[role] || {};
    var allowed = config.allowedViews || (window.staffHubConfig || {}).defaultViews || [];
    var isFullAccess = allowed.includes('*');

    // Filter sidebar nav items by data-view attribute
    document.querySelectorAll('.nav-item[data-view]').forEach(function(el) {
        var view = el.getAttribute('data-view');
        el.style.display = (isFullAccess || allowed.includes(view)) ? 'flex' : 'none';
    });

    // Hide/show entire nav sections if all their items are hidden
    document.querySelectorAll('.nav-section').forEach(function(sec) {
        var items = sec.querySelectorAll('.nav-item[data-view]');
        var anyVisible = Array.from(items).some(function(el) { return el.style.display !== 'none'; });
        var header = sec.querySelector('.nav-section-header');
        if (header) header.style.display = anyVisible ? 'flex' : 'none';
        if (!anyVisible) sec.style.display = 'none';
        else sec.style.display = 'block';
    });

    // Show lock button as "Lock" (staff can lock themselves out)
    var lockBtn = document.getElementById('btn-lock');
    if (lockBtn) { lockBtn.innerHTML = '🔒 Lock'; lockBtn.style.background = 'rgba(239,68,68,0.1)'; lockBtn.style.color = 'var(--red)'; lockBtn.style.borderColor = 'rgba(239,68,68,0.2)'; lockBtn.onclick = function() { window.lockStaffHub(); }; }

    // Hide staff hub button (already logged in), hide backup/restore
    var staffBtn = document.getElementById('btn-staff-hub');
    if (staffBtn) staffBtn.style.display = 'none';
    document.querySelectorAll('.btn-backup, .btn-restore').forEach(function(el) { el.style.display = 'none'; });
};

// --- STAFF HUB PIN ENTRY ---
window.showStaffPinEntry = () => {
    window._showPinModal('👤 Staff Hub', 'Enter your personal PIN to access My Hub', async (attempt) => {
        const hashed = await window._hashPin(attempt);
        const match = (window.staffDirectory || []).find(s => s.pin && s.pin === hashed && s.status !== 'Inactive');
        if (match) {
            window._activeStaffMember = match;
            sessionStorage.setItem('activeStaffName', match.name);
            window._lastActivity = Date.now();
            window.closeModal();
            window.applyRoleAccess();
            window.showView('my-hub');
            window.showToast('Welcome, ' + match.name + '!');
        } else {
            window._pinBuffer = '';
            const dots = document.querySelectorAll('.pin-dot');
            dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.textContent = 'PIN not recognised. Ask your manager to set your PIN.';
        }
    });
};

window.lockStaffHub = () => {
    window._activeStaffMember = null;
    sessionStorage.removeItem('activeStaffName');
    // Restore lock button to normal toggleLock behaviour
    var lockBtn = document.getElementById('btn-lock');
    if (lockBtn) lockBtn.onclick = function() { window.toggleLock(); };
    window.checkLockState();
    window.showView('dashboard');
    window.showToast('Staff Hub locked.');
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
    window._showPinModal('🔒 Enter PIN', 'Manager PIN required to continue', async (attempt) => {
        const hashed = await window._hashPin(attempt);
        if (hashed === pin) {
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
        window._showPinModal('🔐 Set Manager PIN', 'Choose a 4+ digit PIN to secure restricted areas', async (newPin) => {
            if (newPin.length >= 4) {
                const hashed = await window._hashPin(newPin);
                localStorage.setItem('venuePin', hashed);
                localStorage.setItem('venuePinHashed', 'true');
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
window.saveKeys = ['inventoryItems', 'recipes', 'wastageLogs', 'suppliers', 'salesData', 'salesTargets', 'orientationLogs', 'rotationalTasks', 'taskHistory', 'tempLogs', 'complianceLogs', 'defectLogs', 'equipmentData', 'contractorLogs', 'digitalSafe', 'phoneBook', 'incidentLogs', 'handoverLogs', 'knowledgeBase', 'shiftRosters', 'onboardingTemplates', 'fridgeUnits', 'masterChecklists', 'posMappings', 'storageZones', 'depletionLogs', 'safeCategories', 'kbCategories', 'orderHistory', 'staffDirectory', 'lsImportLog', 'lsSalesByData', 'shiftChecklistItems', 'invoiceMatchMap', 'priceHistory', 'inventorySubcategories', 'kbSubcategories', 'safeSubcategories', 'handoverTemplateConfig', 'qualificationTypes', 'stockMovements', 'stocktakes', 'auditLog', 'announcements', 'kudos', 'dailyBriefings', 'badgeDefinitions', 'staffHubConfig', 'shiftFeedbackTags'];


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

// --- TANDA HOURS HELPER ---
window._tandaCalcHours = (s) => {
    if (s.duration) return s.duration / 3600;
    if (s.finish && s.start) return (s.finish - s.start) / 3600;
    if (s.finish_time && s.start_time) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [fh, fm] = s.finish_time.split(':').map(Number);
        let hrs = ((fh * 60 + fm) - (sh * 60 + sm)) / 60;
        if (hrs < 0) hrs += 24;
        return hrs;
    }
    return 0;
};

// --- TANDA FULL DATA LOAD ---
window._tandaData = window._tandaData || null;
window._tandaStaff = [];
window._tandaDepartments = [];

window.loadTandaData = async () => {
    if (!window.getTandaToken()) return;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // 1. Users (full profiles)
    const usersData = await window.fetchTanda('users');
    if (!usersData) { return; }
    const users = Array.isArray(usersData) ? usersData : (usersData.users || []);
    if (users.length === 0) { return; }

    // Store full staff profiles
    window._tandaStaff = users.map(u => ({
        id: u.id, name: u.name || '', phone: u.phone || '', email: u.email || '',
        photo: u.photo_url || u.photo || '', dob: u.date_of_birth || '',
        startDate: u.employment_start_date || '', departmentIds: u.department_ids || [],
        active: u.active !== false
    }));

    const userIds = users.map(u => u.id).join(',');

    // 2. Departments
    const deptData = await window.fetchTanda('departments');
    if (deptData) {
        const depts = Array.isArray(deptData) ? deptData : (deptData.departments || []);
        window._tandaDepartments = depts.map(d => ({ id: d.id, name: d.name || 'Unknown' }));
    }

    // 3. Weekly roster — Mon to Sun of current week
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today); weekStart.setDate(today.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const weekSchedData = await window.fetchTanda(
        'schedules?from=' + weekStartStr + '&to=' + weekEndStr + '&user_ids=' + userIds + '&show_costs=true&include_names=true'
    );
    const weekSchedules = weekSchedData ? (Array.isArray(weekSchedData) ? weekSchedData : (weekSchedData.schedules || [])) : [];

    // Parse today's schedules from the weekly pull
    let rosteredHours = 0, rosteredCost = 0, rosteredStaff = [];
    // Build weekly roster grid: { date: [ { name, start, finish, hours, dept } ] }
    const weeklyRoster = {};
    for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart); dt.setDate(weekStart.getDate() + d);
        weeklyRoster[dt.toISOString().split('T')[0]] = [];
    }

    weekSchedules.forEach(s => {
        const hrs = window._tandaCalcHours(s);
        const user = users.find(u => u.id === s.user_id);
        const name = (user && user.name) || s.user_name || ('Staff #' + (s.user_id || ''));
        const dept = window._tandaDepartments.find(d => d.id === s.department_id);
        const startTime = s.start_time || (s.start ? new Date(s.start * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '');
        const finishTime = s.finish_time || (s.finish ? new Date(s.finish * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '');
        // Determine date from start timestamp or from schedule date
        let schedDate = dateStr;
        if (s.start) { schedDate = new Date(s.start * 1000).toISOString().split('T')[0]; }
        else if (s.date) { schedDate = s.date; }
        if (weeklyRoster[schedDate]) {
            weeklyRoster[schedDate].push({ name, start: startTime, finish: finishTime, hours: hrs.toFixed(1), dept: dept ? dept.name : '', userId: s.user_id });
        }
        // Accumulate today's totals
        if (schedDate === dateStr) {
            rosteredHours += hrs;
            if (s.cost) rosteredCost += Number(s.cost);
            rosteredStaff.push({ name, hours: hrs > 0 ? hrs.toFixed(1) : 'Rostered', start: startTime });
        }
    });

    // 4. Weekly shifts (actual hours worked)
    const weekShiftsData = await window.fetchTanda(
        'shifts?from=' + weekStartStr + '&to=' + weekEndStr + '&show_costs=true'
    );
    const weekShifts = weekShiftsData ? (Array.isArray(weekShiftsData) ? weekShiftsData : (weekShiftsData.shifts || [])) : [];
    let actualHours = 0, actualCost = 0, actualStaff = [];
    const weeklyActual = {};
    weekShifts.forEach(s => {
        const hrs = window._tandaCalcHours(s);
        const user = users.find(u => u.id === s.user_id);
        const name = (user && user.name) || ('Staff #' + (s.user_id || ''));
        let shiftDate = dateStr;
        if (s.start) shiftDate = new Date(s.start * 1000).toISOString().split('T')[0];
        if (!weeklyActual[shiftDate]) weeklyActual[shiftDate] = { hours: 0, cost: 0, count: 0 };
        weeklyActual[shiftDate].hours += hrs;
        if (s.cost) weeklyActual[shiftDate].cost += Number(s.cost);
        weeklyActual[shiftDate].count++;
        // Today's totals
        if (shiftDate === dateStr) {
            actualHours += hrs;
            if (s.cost) actualCost += Number(s.cost);
            actualStaff.push({ name, hours: hrs.toFixed(1) });
        }
    });

    // 5. Clocked in right now
    let clockedIn = [];
    const clockedData = await window.fetchTanda('users/clocked_in');
    if (clockedData) {
        const cArr = Array.isArray(clockedData) ? clockedData : (clockedData.users || []);
        clockedIn = cArr.map(u => {
            // Look up name from users array since clocked_in may only return IDs
            const userId = u.id || u.user_id;
            const knownUser = userId ? users.find(usr => usr.id === userId) : null;
            const name = u.name || (knownUser && knownUser.name) || ('Staff #' + (userId || '?'));
            const since = u.clocked_in_at ? new Date(u.clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (u.last_clocked_in_at ? new Date(u.last_clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
            return { name, since };
        });
    }

    // 6. Leave (next 14 days)
    const leaveEnd = new Date(today); leaveEnd.setDate(leaveEnd.getDate() + 14);
    const leaveEndStr = leaveEnd.toISOString().split('T')[0];
    let upcomingLeave = [];
    const leaveData = await window.fetchTanda('leave?from=' + dateStr + '&to=' + leaveEndStr);
    if (leaveData) {
        const lArr = Array.isArray(leaveData) ? leaveData : (leaveData.leave || []);
        upcomingLeave = lArr.filter(l => l.status === 'approved' || l.status === 'pending').map(l => {
            const user = users.find(u => u.id === l.user_id);
            return {
                name: (user && user.name) || ('Staff #' + l.user_id),
                from: l.start_date || l.from || '',
                to: l.finish_date || l.end_date || l.to || '',
                type: l.leave_type || l.type || 'Leave',
                status: l.status || 'approved'
            };
        });
    }

    // 7. Leave balances
    let leaveBalances = [];
    const balData = await window.fetchTanda('leave_balances?user_ids=' + userIds);
    if (balData) {
        const bArr = Array.isArray(balData) ? balData : (balData.leave_balances || []);
        leaveBalances = bArr.map(b => {
            const user = users.find(u => u.id === b.user_id);
            return { name: (user && user.name) || ('Staff #' + b.user_id), balance: b.balance || 0, typeId: b.leave_type_id };
        });
    }

    // 8. Qualifications (RSA, Food Handler, etc.)
    let qualifications = [];
    const qualData = await window.fetchTanda('qualifications');
    if (qualData) {
        const qArr = Array.isArray(qualData) ? qualData : (qualData.qualifications || []);
        qualifications = qArr.map(q => {
            const user = users.find(u => u.id === q.user_id);
            return {
                name: (user && user.name) || ('Staff #' + q.user_id),
                userId: q.user_id,
                type: q.qualification_type || q.name || 'Unknown',
                expiry: q.expiry_date || q.expiry || null,
                issued: q.issue_date || null
            };
        });
    }

    // 9. Unavailability (next 14 days)
    let unavailability = [];
    const unavData = await window.fetchTanda('unavailability?from=' + dateStr + '&to=' + leaveEndStr);
    if (unavData) {
        const uArr = Array.isArray(unavData) ? unavData : (unavData.unavailability || []);
        unavailability = uArr.map(u => {
            const user = users.find(usr => usr.id === u.user_id);
            return { name: (user && user.name) || ('Staff #' + u.user_id), from: u.start_date || '', to: u.finish_date || '', reason: u.reason || '', recurring: !!u.recurring };
        });
    }

    // Build combined data object
    window._tandaData = {
        date: dateStr,
        // Rostered (planned) — today
        rosteredHours: rosteredHours.toFixed(1),
        estimatedWageCost: rosteredCost.toFixed(2),
        staffCount: rosteredStaff.length,
        staff: rosteredStaff,
        // Actual (worked) — today
        actualHours: actualHours.toFixed(1),
        actualWageCost: actualCost.toFixed(2),
        actualStaffCount: actualStaff.length,
        actualStaff: actualStaff,
        // Weekly roster grid
        weeklyRoster: weeklyRoster,
        weeklyActual: weeklyActual,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        // Live
        clockedIn: clockedIn,
        // Leave & availability
        upcomingLeave: upcomingLeave,
        leaveBalances: leaveBalances,
        unavailability: unavailability,
        // Qualifications
        qualifications: qualifications,
        // Meta
        lastUpdated: new Date().toLocaleTimeString(),
        userCount: users.length
    };
    if (['dashboard', 'prime-cost', 'orientation'].includes(window.currentView)) window.showView(window.currentView);
};

// --- TANDA CLOCKED-IN QUICK REFRESH (lightweight) ---
window.loadTandaClockedIn = async () => {
    if (!window.getTandaToken() || !window._tandaData) return;
    const clockedData = await window.fetchTanda('users/clocked_in');
    if (!clockedData) return;
    const cArr = Array.isArray(clockedData) ? clockedData : (clockedData.users || []);
    window._tandaData.clockedIn = cArr.map(u => {
        const userId = u.id || u.user_id;
        const knownUser = userId ? (window._tandaStaff || []).find(s => s.id === userId) : null;
        const name = u.name || (knownUser && knownUser.name) || ('Staff #' + (userId || '?'));
        const since = u.clocked_in_at ? new Date(u.clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (u.last_clocked_in_at ? new Date(u.last_clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
        return { name, since };
    });
    window._tandaData.lastUpdated = new Date().toLocaleTimeString();
};

// --- TANDA AUTO-REFRESH ---
window._tandaFullInterval = null;
window._tandaQuickInterval = null;
window.startTandaAutoRefresh = () => {
    window.stopTandaAutoRefresh();
    // Full refresh every 15 minutes
    window._tandaFullInterval = setInterval(() => {
        if (!document.hidden && window.getTandaToken()) window.loadTandaData();
    }, 15 * 60 * 1000);
    // Clocked-in refresh every 5 minutes
    window._tandaQuickInterval = setInterval(() => {
        if (!document.hidden && window.getTandaToken()) window.loadTandaClockedIn();
    }, 5 * 60 * 1000);
};
window.stopTandaAutoRefresh = () => {
    if (window._tandaFullInterval) { clearInterval(window._tandaFullInterval); window._tandaFullInterval = null; }
    if (window._tandaQuickInterval) { clearInterval(window._tandaQuickInterval); window._tandaQuickInterval = null; }
};

// --- TANDA STAFF SYNC → STAFF DIRECTORY ---
window.syncTandaStaff = () => {
    if (!window._tandaStaff || window._tandaStaff.length === 0) return window.showToast('No Tanda staff data. Refresh Tanda first.', 'error');
    let added = 0, updated = 0;
    window._tandaStaff.filter(ts => ts.active).forEach(ts => {
        const existing = (window.staffDirectory || []).find(s => s.name && ts.name && s.name.toLowerCase().trim() === ts.name.toLowerCase().trim());
        if (existing) {
            // Merge: fill blanks only
            if (!existing.phone && ts.phone) { existing.phone = ts.phone; updated++; }
            if (!existing.email && ts.email) { existing.email = ts.email; updated++; }
            if (!existing.startDate && ts.startDate) existing.startDate = ts.startDate;
            if (ts.departmentIds && ts.departmentIds.length > 0 && window._tandaDepartments.length > 0) {
                const deptName = window._tandaDepartments.find(d => d.id === ts.departmentIds[0]);
                if (deptName && !existing.role) existing.role = deptName.name;
            }
        } else {
            // Add new staff
            let role = '';
            if (ts.departmentIds && ts.departmentIds.length > 0 && window._tandaDepartments.length > 0) {
                const dept = window._tandaDepartments.find(d => d.id === ts.departmentIds[0]);
                if (dept) role = dept.name;
            }
            window.staffDirectory.push({
                name: ts.name, role: role, phone: ts.phone, email: ts.email,
                emergency: '', status: 'Active', startDate: ts.startDate, notes: 'Synced from Tanda',
                qualifications: {}
            });
            added++;
        }
    });
    // Sync qualifications from Tanda
    let qualSynced = 0;
    if (window._tandaData && window._tandaData.qualifications) {
        window._tandaData.qualifications.forEach(function(tq) {
            const staff = (window.staffDirectory || []).find(s => s.name && tq.name && s.name.toLowerCase().trim() === tq.name.toLowerCase().trim());
            if (!staff) return;
            if (!staff.qualifications) staff.qualifications = {};
            // Map Tanda qual type to a slug
            const slug = tq.type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
            if (!staff.qualifications[slug] || (tq.expiry && !staff.qualifications[slug].expiry)) {
                staff.qualifications[slug] = { expiry: tq.expiry || '', verified: true };
                qualSynced++;
            }
            // Ensure qualification type exists in Hub
            if (window.qualificationTypes && !window.qualificationTypes.find(qt => qt.id === slug)) {
                window.qualificationTypes.push({ id: slug, name: tq.type, requiresExpiry: !!tq.expiry });
            }
        });
    }
    window.saveToDisk();
    window.showToast('Tanda sync: ' + added + ' added, ' + updated + ' fields updated' + (qualSynced > 0 ? ', ' + qualSynced + ' quals synced' : '') + '.');
    if (window.currentView === 'orientation') window.showView('orientation');
};

// --- TANDA SETTINGS MODAL ---
window.openTandaSettings = () => {
    const token = window.getTandaToken();
    const td = window._tandaData;
    const connected = !!token;
    const statusDot = connected ? '🟢' : '🔴';
    const statusText = connected ? 'Connected' : 'Not Connected';

    let html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);">' +
        '<span style="font-size:18px;">' + statusDot + '</span>' +
        '<div><div style="font-weight:600;font-size:14px;">' + statusText + '</div>' +
        (td ? '<div style="font-size:11px;color:var(--text-muted);">Last sync: ' + td.lastUpdated + '</div>' : '') +
        '</div></div>';

    html += '<label style="font-size:11px;color:var(--text-muted);">API Token — get from: <a href="https://my.tanda.co/api/v2/my_tokens" target="_blank" style="color:var(--blue);">my.tanda.co/api/v2/my_tokens ↗</a></label>';
    html += '<input type="text" id="tanda-token" class="input-box" value="' + token + '" placeholder="Paste Tanda API token...">';
    html += '<button onclick="window.saveTandaToken()" class="btn btn-green" style="width:100%;margin-bottom:8px;">Save & Connect</button>';

    if (connected) {
        html += '<button onclick="window.showLoadingOverlay(\'Refreshing Tanda...\');window.loadTandaData().then(()=>{window.hideLoadingOverlay();window.openTandaSettings();});" class="btn btn-outline" style="width:100%;margin-bottom:8px;">🔄 Refresh All Data</button>';
        html += '<button onclick="window.syncTandaStaff();window.closeModal();" class="btn btn-outline" style="width:100%;margin-bottom:12px;">👥 Sync Staff to Hub Directory</button>';
    }

    if (td) {
        html += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">';
        html += '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--brand-dark);">📊 Data Summary</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--text-muted);">';
        html += '<div>👥 Staff synced: <strong>' + td.userCount + '</strong></div>';
        html += '<div>📋 Rostered today: <strong>' + td.staffCount + '</strong></div>';
        html += '<div>⏱️ Rostered hours: <strong>' + td.rosteredHours + 'h</strong></div>';
        html += '<div>💰 Est. wages: <strong>$' + td.estimatedWageCost + '</strong></div>';
        if (Number(td.actualHours) > 0) {
            html += '<div>✅ Actual hours: <strong>' + td.actualHours + 'h</strong></div>';
            html += '<div>💵 Actual cost: <strong>$' + td.actualWageCost + '</strong></div>';
        }
        html += '<div>🟢 Clocked in: <strong>' + (td.clockedIn || []).length + '</strong></div>';
        html += '<div>🏖️ Upcoming leave: <strong>' + (td.upcomingLeave || []).length + '</strong></div>';
        html += '</div></div>';
    }

    window.openModal('⏱️ Tanda Integration', html);
};

window.saveTandaToken = () => {
    const token = document.getElementById('tanda-token').value.trim();
    if (!token) return window.showToast('Token required.','error');
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_tandaApiToken', token);
    window.closeModal();
    window.showToast('Tanda connected!');
    window.showLoadingOverlay('Connecting to Tanda...');
    window.loadTandaData().then(() => { window.hideLoadingOverlay(); window.startTandaAutoRefresh(); });
};

// --- LOG TRIMMING (prevent unbounded growth) ---
window._trimLogs = () => {
    const caps = { stockMovements: 500, depletionLogs: 200, wastageLogs: 200 };
    Object.keys(caps).forEach(k => {
        if (window[k] && Array.isArray(window[k]) && window[k].length > caps[k]) {
            window[k] = window[k].slice(-caps[k]);
        }
    });
};

// --- DATA SIZE MONITOR ---
window.getStorageUsage = () => {
    var total = 0;
    try { for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); total += (key.length + localStorage.getItem(key).length) * 2; } } catch(e) {}
    return total;
};
window.checkStorageHealth = () => {
    var bytes = window.getStorageUsage();
    var mb = (bytes / (1024 * 1024)).toFixed(1);
    if (bytes > 4 * 1024 * 1024 && !window._storageBannerShown) {
        window._storageBannerShown = true;
        if (window.showToast) window.showToast('Storage at ' + mb + 'MB / 5MB — consider exporting a backup and clearing old data.', 'error');
    }
    return { bytes: bytes, mb: parseFloat(mb) };
};

// --- AUTO-BACKUP TO FIREBASE ---
window._lastBackupDate = localStorage.getItem('lastBackupDate') || '';
window._runDailyBackup = () => {
    var today = new Date().toISOString().split('T')[0];
    if (window._lastBackupDate === today) return;
    if (typeof db === 'undefined') return;
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    var payload = {}; window.saveKeys.forEach(k => { payload[k] = window[k]; });
    payload._backupTime = new Date().toISOString();
    db.collection('backups').doc(vid + '_' + today).set(payload)
        .then(() => {
            window._lastBackupDate = today;
            localStorage.setItem('lastBackupDate', today);
            // Clean old backups (keep 7 days)
            var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
            var cutoffStr = cutoff.toISOString().split('T')[0];
            db.collection('backups').where('__name__', '<', vid + '_' + cutoffStr)
                .get().then(snap => { snap.forEach(doc => doc.ref.delete()); }).catch(() => {});
        }).catch(() => {});
};

// Debounced Firebase write — max once every 4 seconds
window._saveTimer = null;
window._lastFirebaseSave = 0;
window._firebaseRetryCount = 0;

window.saveToDisk = () => {
    // Trim unbounded log arrays before saving
    window._trimLogs();
    const syncLabel = document.getElementById('sync-status');
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';

    // Always save to localStorage immediately
    window.saveKeys.forEach(k => {
        try {
            localStorage.setItem(vid+'_'+k, JSON.stringify(window[k]));
        } catch(e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                if (window.showToast && !window._quotaWarned) { window.showToast('Storage nearly full — data saved to cloud only. Consider exporting a backup.', 'error'); window._quotaWarned = true; }
            }
        }
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
                window._runDailyBackup();
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

// --- 5. GLOBAL TOAST NOTIFICATIONS (stacking) ---
window._getToastContainer = () => {
    let c = document.getElementById('hub-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'hub-toast-container';
        c.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column-reverse;gap:8px;align-items:center;pointer-events:none;';
        document.body.appendChild(c);
    }
    // Add keyframes only once
    if (!document.getElementById('toast-keyframes')) {
        const s = document.createElement('style'); s.id = 'toast-keyframes';
        s.innerHTML = '@keyframes toastIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes toastOut{from{transform:translateY(0);opacity:1}to{transform:translateY(20px);opacity:0}}';
        document.head.appendChild(s);
    }
    return c;
};
window.showToast = (msg, type = "success") => {
    const container = window._getToastContainer();
    // Max 3 visible — remove oldest
    while (container.children.length >= 3) container.lastChild.remove();
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.cssText = 'background:' + (type === 'error' ? 'var(--red)' : 'var(--green)') + ';color:white;padding:12px 24px;border-radius:30px;font-weight:bold;font-size:14px;box-shadow:0 10px 25px rgba(0,0,0,0.5);animation:toastIn 0.3s ease forwards;pointer-events:auto;white-space:nowrap;';
    container.insertBefore(toast, container.firstChild);
    setTimeout(() => { toast.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- THEME TOGGLE ---
window.toggleTheme = () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('hubTheme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.innerHTML = isLight ? '☀️ Light Mode' : '🌙 Dark Mode';
};
// Apply saved theme on load
(function() {
    if (localStorage.getItem('hubTheme') === 'light') {
        document.body.classList.add('light-mode');
        setTimeout(() => { const btn = document.getElementById('btn-theme'); if (btn) btn.innerHTML = '☀️ Light Mode'; }, 100);
    }
})();

// --- 6. VIEW ROUTER ---
window.currentView = 'dashboard';
window.showView = (view) => {
    window.closeModal(); // Clean up any open modals to prevent glitching
    if (window.isLocked && !window._activeStaffMember && (window._restrictedViews||[]).includes(view)) {
        window.requirePin(() => window.showView(view));
        return;
    }
    // Role-based access enforcement for staff sessions
    if (window._activeStaffMember && view !== 'my-hub' && view !== 'dashboard') {
        var _role = window._activeStaffMember.role || 'FOH';
        var _rc = ((window.staffHubConfig||{}).roles||{})[_role] || {};
        var _allowed = _rc.allowedViews || (window.staffHubConfig||{}).defaultViews || [];
        if (!_allowed.includes('*') && !_allowed.includes(view)) {
            window.showToast('Access restricted for ' + _role + ' role.', 'error');
            return;
        }
    }
    
    window.currentView = view;
    // Auto-close mobile sidebar on navigation
    const sb = document.querySelector('.sidebar'); if (sb) sb.classList.remove('mobile-open');
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
        // --- INVENTORY HUB (absorbs stocktake, stock-audit, par-editor, stock-count) ---
        if (view === 'inventory') { content.innerHTML = window.renderInventoryHub(); }
        else if (view === 'stocktake') { window._invHubTab = 'stocktake'; content.innerHTML = window.renderInventoryHub(); }
        else if (view === 'stock-audit') { window._invHubTab = 'audit'; content.innerHTML = window.renderInventoryHub(); }
        else if (view === 'par-editor') { window._invHubTab = 'par'; content.innerHTML = window.renderInventoryHub(); }
        else if (view === 'stock-count') { window._invHubTab = 'levels'; content.innerHTML = window.renderInventoryHub(); }
        // --- RECIPE HUB (absorbs margins, batch-linker, allergens, sheet-gen) ---
        else if (view === 'recipes') { content.innerHTML = window.renderRecipeHub(); }
        else if (view === 'margins') { window._recHubTab = 'margins'; content.innerHTML = window.renderRecipeHub(); }
        else if (view === 'batch-linker') { window._recHubTab = 'linker'; content.innerHTML = window.renderRecipeHub(); }
        else if (view === 'allergens') { window._recHubTab = 'allergens'; content.innerHTML = window.renderRecipeHub(); }
        else if ((view === 'runsheet' || view === 'sheet-gen')) { window._recHubTab = 'runsheet'; content.innerHTML = window.renderRecipeHub(); }
        // --- ANALYTICS HUB (absorbs prime-cost, variance, forecast) ---
        else if (view === 'sales') { content.innerHTML = window.renderAnalyticsHub(); }
        else if (view === 'prime-cost') { window._analyticsTab = 'primecost'; content.innerHTML = window.renderAnalyticsHub(); }
        else if (view === 'variance') { window._analyticsTab = 'variance'; content.innerHTML = window.renderAnalyticsHub(); }
        else if (view === 'forecast') { window._analyticsTab = 'forecast'; content.innerHTML = window.renderAnalyticsHub(); }
        // --- ORDER HUB (invoice now has tab bar) ---
        else if ((view === 'prep-list' || view === 'preplist') && window.renderPrepListView) content.innerHTML = window.renderPrepListView();
        else if (view === 'invoice' && window.renderInvoiceView) content.innerHTML = window.renderInvoiceView();
        else if (view === 'ai-order' && window.renderAiOrderView) content.innerHTML = window.renderAiOrderView();
        // --- STANDALONE VIEWS ---
        else if (view === 'dashboard' && window.renderManagerHub) content.innerHTML = window.renderManagerHub();
        else if (view === 'suppliers' && window.renderSupplierView) content.innerHTML = window.renderSupplierView();
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
        else if (view === 'wastage' && window.renderWastageView) content.innerHTML = window.renderWastageView();
        else if (view === 'zones' && window.renderZoneManager) content.innerHTML = window.renderZoneManager();
        else if (view === 'menu-engineering' && window.renderMenuEngineeringView) content.innerHTML = window.renderMenuEngineeringView();
        else if (view === 'sell-price-editor' && window.renderSellPriceEditor) content.innerHTML = window.renderSellPriceEditor();
        else if (view === 'price-alerts' && window.renderPriceAlertsView) content.innerHTML = window.renderPriceAlertsView();
        else if (view === 'staff-directory' && window.renderStaffHubView) { window._staffHubTab = 'directory'; content.innerHTML = window.renderStaffHubView(); }
        else if (view === 'cross-venue') { if (window.renderCrossVenueDashboard) window.renderCrossVenueDashboard(); }
        else if (view === 'lightspeed-import' && window.renderLightspeedImportView) content.innerHTML = window.renderLightspeedImportView();
        else if (view === 'bulk-category-editor' && window.renderBulkCategoryEditor) content.innerHTML = window.renderBulkCategoryEditor();
        else if (view === 'pos-alias-editor' && window.renderPosAliasEditor) content.innerHTML = window.renderPosAliasEditor();
        else if (view === 'haccp-history' && window.renderComplianceView) { window._complianceTab = 'haccp'; content.innerHTML = window.renderComplianceView(); }
        else if (view === 'noticeboard' && window.renderNoticeboardView) content.innerHTML = window.renderNoticeboardView();
        else if (view === 'audit-log' && window.renderAuditLogView) content.innerHTML = window.renderAuditLogView();
        else if (view === 'depletion-history' && window.renderDepletionHistoryView) content.innerHTML = window.renderDepletionHistoryView();
        else if (view === 'ask-hub' && window.renderAskHubView) content.innerHTML = window.renderAskHubView();
        else if (view === 'my-hub' && window.renderMyHubView) content.innerHTML = window.renderMyHubView();
        else if (view === 'badge-management' && window.renderBadgeManagementView) content.innerHTML = window.renderBadgeManagementView();
        else if (view === 'staff-hub-config' && window.renderStaffHubConfigView) content.innerHTML = window.renderStaffHubConfigView();
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
            results.push({ type: 'inventory', icon: '📦', label: item.name, sub: (item.category || '') + ' · ' + (item.supplier || 'No supplier'), action: "window.editInvItem('" + window.escAttr(item.id) + "')" });
        }
    });
    
    // Search recipes
    (window.recipes || []).filter(r => !r.archived).forEach(r => {
        if (r.name.toLowerCase().includes(q) || (r.posAlias && r.posAlias.toLowerCase().includes(q))) {
            results.push({ type: 'recipe', icon: '⚖️', label: r.name, sub: r.type + ' · ' + (r.station || 'Kitchen'), action: "window.editRecipeForm('" + window.escAttr(r.id) + "')" });
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
    
    // Quick-nav views
    var viewLinks = [
        { keywords: ['depletion', 'deplete', 'eod', 'stock depletion'], icon: '📉', label: 'Depletion History', sub: 'Stock depletion run history & undo', view: 'depletion-history' },
        { keywords: ['audit', 'audit log', 'trail'], icon: '📋', label: 'Audit Log', sub: 'Full change audit trail', view: 'audit-log' }
    ];
    viewLinks.forEach(function(vl) {
        if (vl.keywords.some(function(k) { return k.includes(q) || q.includes(k); })) {
            results.push({ type: 'nav', icon: vl.icon, label: vl.label, sub: vl.sub, action: "window.showView('" + vl.view + "')" });
        }
    });

    return results.slice(0, 15);
};

window._debouncedGlobalSearch = window.debounce ? window.debounce((val) => window.renderGlobalSearchResults(val), 250) : (val) => window.renderGlobalSearchResults(val);

window._highlightMatch = (text, query) => {
    if (!query || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark style="background:var(--purple);color:#fff;border-radius:2px;padding:0 2px;">$1</mark>');
};

window.renderGlobalSearchResults = (query) => {
    const resultsDiv = document.getElementById('global-search-results');
    if (!resultsDiv) return;
    if (!query || query.length < 2) { resultsDiv.style.display = 'none'; return; }
    const results = window.globalSearch(query);
    if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="padding:15px;color:var(--text-muted);font-size:13px;text-align:center;">No results for "' + window.esc(query) + '"</div>';
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
            const hl = window._highlightMatch(r.label, query);
            const hlSub = window._highlightMatch(r.sub, query);
            html += '<div onclick="' + r.action + ';document.getElementById(\'global-search-results\').style.display=\'none\';document.getElementById(\'global-search-input\').value=\'\';" style="padding:10px 15px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.15s;border-bottom:1px solid var(--border);" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\'" onmouseout="this.style.background=\'\'"><span style="font-size:16px;">' + r.icon + '</span><div><div style="font-size:13px;font-weight:500;">' + hl + '</div><div style="font-size:11px;color:var(--text-muted);">' + hlSub + '</div></div></div>';
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


// --- 7b. AUDIT TRAIL ---
window.logAudit = function(collection, action, itemId, details) {
    if (!window.auditLog) window.auditLog = [];
    window.auditLog.unshift({
        id: window.generateId('aud'),
        timestamp: new Date().toISOString(),
        collection: collection,
        action: action,
        itemId: itemId || '',
        details: details || '',
        venue: window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi',
        user: window._activeStaffMember ? window._activeStaffMember.name : (window.isLocked ? 'System' : 'Manager')
    });
    // Keep last 500 entries
    if (window.auditLog.length > 500) window.auditLog = window.auditLog.slice(0, 500);
};

// --- PRINT REPORT UTILITY ---
// Reusable print template: opens new window with venue branding + auto-triggers print
window.printReport = function(title, contentHtml, options) {
    options = options || {};
    var venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'Bar Wa Izakaya';
    var dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    var win = window.open('', '_blank');
    if (!win) return window.showToast('Pop-up blocked. Allow pop-ups for printing.', 'error');
    win.document.write('<!DOCTYPE html><html><head><title>' + title + ' — ' + venue + '</title>' +
    '<style>' +
        'body{font-family:Inter,-apple-system,sans-serif;font-size:13px;color:#222;max-width:900px;margin:30px auto;line-height:1.6;}' +
        '.print-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #333;padding-bottom:10px;margin-bottom:20px;}' +
        '.print-header h1{font-size:20px;margin:0;}.print-header .venue{font-size:12px;color:#888;}' +
        '.print-footer{margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#aaa;display:flex;justify-content:space-between;}' +
        'table{width:100%;border-collapse:collapse;}' +
        'th{padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #333;background:#f9fafb;}' +
        'td{padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;}' +
        'tr:nth-child(even){background:#f9fafb;}' +
        '.section-title{font-size:14px;font-weight:700;margin:20px 0 8px;padding:6px 0;border-bottom:1px solid #ddd;}' +
        '.flag-red{color:#dc2626;font-weight:bold;} .flag-green{color:#16a34a;}' +
        '@media print{body{margin:10mm;max-width:none;}@page{margin:10mm;size:' + (options.landscape ? 'A4 landscape' : 'A4') + ';}}' +
        (options.extraCss || '') +
    '</style></head><body>' +
    '<div class="print-header"><div><h1>' + title + '</h1><div class="venue">' + venue + '</div></div>' +
    '<div style="text-align:right;font-size:12px;color:#888;">' + dateStr + (options.subtitle ? '<br>' + options.subtitle : '') + '</div></div>' +
    contentHtml +
    '<div class="print-footer"><span>' + venue + ' &middot; Hobart Hub</span><span>Printed ' + dateStr + '</span></div>' +
    '<script>window.onload=function(){window.print();}<\/script></body></html>');
    win.document.close();
};

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

    // Supplier order cutoff reminders
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = dayNames[tomorrow.getDay()];
    const currentHHMM = now.getHours() * 100 + now.getMinutes();
    (window.suppliers || []).forEach(s => {
        if (!s.cutoff || !s.deliveryDays) return;
        // Check if supplier delivers tomorrow
        if (!s.deliveryDays.includes(tomorrowDay)) return;
        // Parse cutoff time (e.g. "15:00")
        const parts = s.cutoff.split(':');
        const cutoffMins = parseInt(parts[0]) * 100 + parseInt(parts[1] || 0);
        // Alert if within 2 hours before cutoff
        if (currentHHMM >= (cutoffMins - 200) && currentHHMM <= cutoffMins) {
            // Check if any items from this supplier are below par
            const lowItems = (window.inventoryItems || []).filter(i => !i.archived && i.supplier === s.name && i.par && i.stock < i.par);
            if (lowItems.length > 0) {
                notifs.push({type:'order', icon:'📦', text: s.name + ' cutoff ' + s.cutoff + ' — ' + lowItems.length + ' items below par', view:'prep-list', priority:0});
            }
        }
    });

    // Unread announcements
    const unreadAnn = (window.announcements || []).filter(a => {
        if (a.expiry && new Date(a.expiry) < now) return false;
        return a.priority === 'urgent' && (!a.acknowledged || a.acknowledged.length === 0);
    });
    unreadAnn.forEach(a => {
        notifs.push({type:'announce', icon:'📢', text: a.title, view:'noticeboard', priority:0});
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
    setTimeout(() => { window.checkStorageHealth(); }, 1500);
    setTimeout(() => { window.loadTandaData(); window.startTandaAutoRefresh(); }, 2000);

    // Force PIN setup if no PIN exists
    setTimeout(() => {
        if (!localStorage.getItem('venuePin')) {
            window._showPinModal('🔐 Setup Manager PIN', 'A PIN is required to secure restricted areas. Choose a 4+ digit PIN.', async (newPin) => {
                if (newPin.length >= 4) {
                    const hashed = await window._hashPin(newPin);
                    localStorage.setItem('venuePin', hashed);
                    localStorage.setItem('venuePinHashed', 'true');
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
