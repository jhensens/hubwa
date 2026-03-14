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
window.saveKeys = ['inventoryItems', 'recipes', 'wastageLogs', 'suppliers', 'salesData', 'salesTargets', 'orientationLogs', 'rotationalTasks', 'taskHistory', 'tempLogs', 'complianceLogs', 'defectLogs', 'equipmentData', 'contractorLogs', 'digitalSafe', 'phoneBook', 'incidentLogs', 'handoverLogs', 'knowledgeBase', 'shiftRosters', 'onboardingTemplates', 'fridgeUnits', 'masterChecklists', 'posMappings', 'storageZones'];

window.saveToDisk = () => {
    const syncLabel = document.getElementById('sync-status');
    if (syncLabel) { syncLabel.innerHTML = '☁️ Saving...'; syncLabel.style.color = 'var(--blue)'; }

    window.saveKeys.forEach(k => localStorage.setItem(k, JSON.stringify(window[k])));
    
    if (typeof db !== 'undefined') {
        let payload = {}; window.saveKeys.forEach(k => payload[k] = window[k]);
        db.collection('venueData').doc('hobartHub').set(payload, { merge: true })
        .then(() => { if (syncLabel) setTimeout(() => { syncLabel.innerHTML = '🟢 Live Sync'; syncLabel.style.color = 'var(--green)'; }, 800); })
        .catch(err => { console.error("Firebase save error:", err); if (syncLabel) { syncLabel.innerHTML = '⚠️ Offline Sync'; syncLabel.style.color = 'var(--orange)'; } });
    } else {
        if (syncLabel) setTimeout(() => { syncLabel.innerHTML = '🟢 Saved Local'; syncLabel.style.color = 'var(--green)'; }, 800);
    }
};

window.loadData = () => {
    window.saveKeys.forEach(k => { window[k] = JSON.parse(localStorage.getItem(k)) || window[k]; });

    if (typeof db !== 'undefined') {
        db.collection('venueData').doc('hobartHub').get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                window.saveKeys.forEach(k => { window[k] = data[k] || window[k]; });
                if(window.currentView) window.showView(window.currentView);
                window.checkLockState();
            }
        }).catch(err => console.error("Firebase read error:", err));
    }
    window.checkLockState();
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
        else if (view === 'margins' && window.renderMarginView) content.innerHTML = window.renderMarginView();
        else content.innerHTML = `<div class="card" style="text-align:center;"><h3>Page Not Found</h3><p>Could not find view: ${view}</p></div>`;
    } catch (err) {
        console.error("Error rendering view:", err);
        content.innerHTML = `<div class="card" style="border-left:5px solid var(--red);"><h3>⚠️ Page Error</h3><p>${err.message}</p></div>`;
    }
};

window.generateId = (prefix) => { return prefix + '_' + Math.random().toString(36).substr(2, 9); };

document.addEventListener('DOMContentLoaded', () => { window.loadData(); window.showView('dashboard'); });
