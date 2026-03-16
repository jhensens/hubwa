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
window.staffDirectory = [];
window.shiftChecklistItems = null;
window.safeCategories = ['Licenses & Permits', 'Staff RSAs', 'Food Safety Certs', 'Maintenance Records', 'General / Other'];
window.kbCategories = [];
window.onboardingTemplates = {
    'FOH (Front of House)': { 'Day 1: Basics': [{id: 'foh1', label: 'Venue Tour & Safety'}], 'Compliance': [{id: 'foh3', label: 'Upload RSA', isUpload: true, cat: 'Staff RSAs'}] },
    'BOH (Back of House)': { 'Day 1: Kitchen': [{id: 'boh1', label: 'Kitchen Safety'}], 'Compliance': [{id: 'boh3', label: 'Upload Food Safety Cert', isUpload: true, cat: 'Food Safety Certs'}] }
};
window.fridgeUnits = ["Walk-in Coolroom", "Kitchen Fridge 1", "Bar Reach-in"];
window.masterChecklists = { "Opening Duties": ["Unlock doors", "Check coffee machine"], "Closing Kitchen": ["Deep clean grill", "Empty bins"] };

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
};

window.closeModal = () => {
    const overlay = document.getElementById('global-modal-overlay');
    if(overlay) overlay.style.display = 'none';
};

// --- 3. KIOSK PIN SECURITY ---
window.isLocked = !!localStorage.getItem('venuePin');
window.checkLockState = () => {
    const restrictedItems = document.querySelectorAll('.restricted');
    const lockBtn = document.getElementById('btn-lock');
    if (window.isLocked) {
        restrictedItems.forEach(el => el.style.display = 'none');
        if(lockBtn) { lockBtn.innerHTML = "🔓 Unlock Hub"; lockBtn.style.background = "rgba(59, 130, 246, 0.1)"; lockBtn.style.color = "var(--blue)"; lockBtn.style.borderColor = "rgba(59, 130, 246, 0.2)"; }
        // Kick them to dashboard if they refresh on a restricted page
        const restrictedViews = ['sales', 'suppliers', 'recipes', 'invoice', 'orientation', 'safe', 'handover'];
        if (restrictedViews.includes(window.currentView)) window.showView('dashboard');
    } else {
        restrictedItems.forEach(el => el.style.display = 'flex'); // flex to align with new sidebar css
        if(lockBtn) { lockBtn.innerHTML = "🔒 Lock Hub"; lockBtn.style.background = "rgba(239, 68, 68, 0.1)"; lockBtn.style.color = "var(--red)"; lockBtn.style.borderColor = "rgba(239, 68, 68, 0.2)"; }
    }
};

window.toggleLock = () => {
    let pin = localStorage.getItem('venuePin');
    if (!pin) {
        let newPin = prompt("Set a new 4-digit Master Manager PIN:");
        if (newPin && newPin.length >= 4) { localStorage.setItem('venuePin', newPin); window.isLocked = true; window.checkLockState(); window.showToast("Hub Locked."); }
    } else if (window.isLocked) {
        let attempt = prompt("Enter 4-digit PIN to unlock Manager Mode:");
        if (attempt === pin) { window.isLocked = false; window.checkLockState(); window.showToast("Hub Unlocked."); } else { alert("Incorrect PIN"); }
    } else {
        window.isLocked = true; window.checkLockState(); window.showView('dashboard'); window.showToast("Hub Locked.");
    }
};

// --- 4. FIREBASE & LOCAL BACKUP CONNECTOR ---
window.saveKeys = ['inventoryItems', 'recipes', 'wastageLogs', 'suppliers', 'salesData', 'salesTargets', 'orientationLogs', 'rotationalTasks', 'taskHistory', 'tempLogs', 'complianceLogs', 'defectLogs', 'equipmentData', 'contractorLogs', 'digitalSafe', 'phoneBook', 'incidentLogs', 'handoverLogs', 'knowledgeBase', 'shiftRosters', 'onboardingTemplates', 'fridgeUnits', 'masterChecklists', 'posMappings', 'storageZones', 'depletionLogs', 'safeCategories', 'kbCategories', 'orderHistory', 'staffDirectory'];


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
        '<p style="font-size:12px;color:var(--text-muted);margin:0 0 10px 0;">⚙️ <strong>Device Setup</strong> — Set which venue this device defaults to:</p>' +
        '<div style="display:flex;gap:8px;">' +
        window._venues.map(v => 
            '<button onclick="window.setDeviceVenue(\'' + v.id + '\')" class="btn ' + (deviceVenue===v.id?'btn-dark':'btn-outline') + '" style="flex:1;font-size:13px;">' + v.emoji + ' ' + v.name + '</button>'
        ).join('') +
        '</div>' +
        '<p style="font-size:11px;color:var(--text-muted);margin:8px 0 0 0;">Device venue determines which data loads by default and what staff see.</p>' +
    '</div>';

    window.openModal('🏢 Venue Management', venueHtml + setupHtml);
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
    if (!confirm('Set this device to always default to ' + venue.name + '?\nThis affects what staff see when they open the Hub.')) return;
    localStorage.setItem('hubDeviceVenue', id);
    localStorage.setItem('hubActiveVenue', id);
    window.closeModal();
    window.showToast('Device set to ' + venue.name + '!');
    setTimeout(() => location.reload(), 600);
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
    if (v.id === 'lia') {
        // LIA theme - teal accent, darker tropical feel
        root.style.setProperty('--brand-dark', '#22d3ee');
        root.style.setProperty('--brand-accent', '#0ea5e9');
        root.style.setProperty('--sidebar-bg', '#090f10');
        root.style.setProperty('--sidebar-hover', '#0f1f22');
        root.style.setProperty('--blue', '#22d3ee');
        // Update logo
        const logoEl = document.getElementById('venue-logo');
        if (logoEl) {
            logoEl.src = 'data:image/png;base64,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';
            logoEl.style.filter = 'none';
            logoEl.style.width = '120px';
            logoEl.style.marginTop = '4px';
        }
        // Update page title
        document.title = 'Lost In Asia Hub';
    } else {
        // BWI theme - restore defaults
        root.style.setProperty('--brand-dark', '#a78bfa');
        root.style.setProperty('--brand-accent', '#7c3aed');
        root.style.setProperty('--sidebar-bg', '#090912');
        root.style.setProperty('--sidebar-hover', '#1e1e2e');
        root.style.setProperty('--blue', '#3b82f6');
        // Restore BWI logo
        const logoEl = document.getElementById('venue-logo');
        if (logoEl) {
            logoEl.src = logoEl.dataset.bwiSrc || '';
            logoEl.style.filter = 'invert(1) contrast(1.4) brightness(1.3)';
            logoEl.style.width = '88px';
        }
        document.title = 'Hobart Hub | Bar Wa Izakaya';
    }
};


window.saveToDisk = () => {
    const syncLabel = document.getElementById('sync-status');
    if (syncLabel) { syncLabel.innerHTML = '☁️ Saving...'; syncLabel.style.color = 'var(--blue)'; }

    const _vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => localStorage.setItem(_vid+'_'+k, JSON.stringify(window[k])));
    
    if (typeof db !== 'undefined') {
        let payload = {}; window.saveKeys.forEach(k => payload[k] = window[k]);
        db.collection('venueData').doc(window.getVenueDocId()).set(payload, { merge: true })
        .then(() => { if (syncLabel) setTimeout(() => { syncLabel.innerHTML = '🟢 Live Sync'; syncLabel.style.color = 'var(--green)'; }, 800); })
        .catch(err => { console.error("Firebase save error:", err); if (syncLabel) { syncLabel.innerHTML = '⚠️ Offline Sync'; syncLabel.style.color = 'var(--orange)'; } });
    } else {
        if (syncLabel) setTimeout(() => { syncLabel.innerHTML = '🟢 Saved Local'; syncLabel.style.color = 'var(--green)'; }, 800);
    }
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
                if (window.currentView) window.showView(window.currentView);
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
            window.saveToDisk(); alert("✅ Data successfully restored and beamed to Firebase Cloud!"); window.showView('dashboard');
        } catch (err) { alert("Error importing file."); console.error(err); }
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
    
    // Add simple keyframes for the toast if not in CSS
    const style = document.createElement('style');
    style.innerHTML = `@keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 20px; opacity: 1; } } @keyframes slideDown { from { bottom: 20px; opacity: 1; } to { bottom: -50px; opacity: 0; } }`;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideDown 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- 6. VIEW ROUTER ---
window.currentView = 'dashboard';
window.showView = (view) => {
    window.closeModal(); // Clean up any open modals to prevent glitching
    const restrictedViews = ['sales', 'suppliers', 'recipes', 'invoice', 'orientation', 'safe', 'handover'];
    if (window.isLocked && restrictedViews.includes(view)) return alert("This area is locked. Enter Manager PIN to access.");
    
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
        else if ((view === 'orientation' || view === 'training') && window.renderOrientationView) content.innerHTML = window.renderOrientationView();
        else if (view === 'tasks' && window.renderTaskView) content.innerHTML = window.renderTaskView();
        else if (view === 'compliance' && window.renderComplianceView) content.innerHTML = window.renderComplianceView();
        else if (view === 'maintenance' && window.renderMaintenanceView) content.innerHTML = window.renderMaintenanceView();
        else if (view === 'safe' && window.renderSafeView) content.innerHTML = window.renderSafeView();
        else if ((view === 'phonebook' || view === 'contacts') && window.renderPhoneBookView) content.innerHTML = window.renderPhoneBookView();
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
        else if (view === 'staff-directory' && window.renderStaffDirectoryView) content.innerHTML = window.renderStaffDirectoryView();
        else if (view === 'forecast' && window.renderForecastView) content.innerHTML = window.renderForecastView();
        else if (view === 'cross-venue') { if (window.renderCrossVenueDashboard) window.renderCrossVenueDashboard(); }
        else if (view === 'ai-order' && window.renderAiOrderView) content.innerHTML = window.renderAiOrderView();
        else if (view === 'bulk-category-editor' && window.renderBulkCategoryEditor) content.innerHTML = window.renderBulkCategoryEditor();
        else if (view === 'pos-alias-editor' && window.renderPosAliasEditor) content.innerHTML = window.renderPosAliasEditor();
        else content.innerHTML = `<div class="card" style="text-align:center;"><h3>Page Not Found</h3><p>Could not find view: ${view}</p></div>`;
    } catch (err) {
        console.error("Error rendering view:", err);
        content.innerHTML = `<div class="card" style="border-left:5px solid var(--red);"><h3>⚠️ Page Error</h3><p>${err.message}</p></div>`;
    }
};

window.generateId = (prefix) => { return prefix + '_' + Math.random().toString(36).substr(2, 9); };

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

    // Render immediately from localStorage
    window.checkLockState();
    window.updateVenueBadge();
    window.showView('dashboard');

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
                    window.showView(window.currentView || 'dashboard');
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
