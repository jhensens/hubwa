// --- HOBART HUB: Nav Module ---
// View router (showView), global search, ID generation

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
        if (_role === 'Manager') { /* full access */ } else {
        var _rc = ((window.staffHubConfig||{}).roles||{})[_role] || {};
        var _allowed = _rc.allowedViews || (window.staffHubConfig||{}).defaultViews || window._defaultStaffViews || [];
        if (!_allowed.includes('*') && !_allowed.includes(view)) {
            window.showToast('Access restricted for ' + _role + ' role.', 'error');
            return;
        }
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
        else if (view === 'supplier-spend') { window._analyticsTab = 'supplier-spend'; content.innerHTML = window.renderAnalyticsHub(); }
        // --- ORDER HUB (invoice now has tab bar) ---
        else if ((view === 'prep-list' || view === 'preplist') && window.renderPrepListView) content.innerHTML = window.renderPrepListView();
        else if (view === 'prep-gen' && window.renderPrepGenView) content.innerHTML = window.renderPrepGenView();
        else if (view === 'batch-invoice') { content.innerHTML = window.openBatchInvoiceUpload ? window.openBatchInvoiceUpload() : ''; return; }
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
        else if (view === 'pos-linker' && window.renderPOSLinkerView) content.innerHTML = window.renderPOSLinkerView();
        else if (view === 'haccp-history' && window.renderComplianceView) { window._complianceTab = 'haccp'; content.innerHTML = window.renderComplianceView(); }
        else if (view === 'noticeboard' && window.renderNoticeboardView) content.innerHTML = window.renderNoticeboardView();
        else if (view === 'audit-log' && window.renderAuditLogView) content.innerHTML = window.renderAuditLogView();
        else if (view === 'batch-qty-fix' && window.renderBatchQtyFixView) content.innerHTML = window.renderBatchQtyFixView();
        else if (view === 'depletion-match-rate' && window.renderDepletionMatchRateView) content.innerHTML = window.renderDepletionMatchRateView();
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
    // Re-apply role-based sidebar filtering after every view render
    if (window._activeStaffMember) window.applyRoleAccess();
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

    // Search rotational tasks
    (window.rotationalTasks || []).forEach((t, i) => {
        if (t.name.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q))) {
            results.push({ type: 'task', icon: '🔄', label: t.name, sub: (t.freq || 'Weekly') + (t.notes ? ' · ' + t.notes.substring(0, 40) : ''), action: "window.showView('tasks')" });
        }
    });

    // Search incidents
    (window.incidentLogs || []).forEach((inc, i) => {
        const searchStr = [inc.type, inc.description, inc.staff, inc.notes, inc.location].filter(Boolean).join(' ').toLowerCase();
        if (searchStr.includes(q)) {
            results.push({ type: 'incident', icon: '⚠️', label: inc.type || 'Incident', sub: (inc.date || '') + (inc.staff ? ' · ' + inc.staff : ''), action: "window.showView('incidents')" });
        }
    });

    // Search maintenance / defect logs
    (window.defectLogs || []).forEach((d, i) => {
        if ((d.item && d.item.toLowerCase().includes(q)) || (d.desc && d.desc.toLowerCase().includes(q))) {
            const status = d.status === 'Resolved' ? '✓ Resolved' : '⏳ Open';
            results.push({ type: 'maintenance', icon: '🛠️', label: d.item || 'Issue', sub: status + (d.desc ? ' · ' + d.desc.substring(0, 40) : ''), action: "window.showView('maintenance')" });
        }
    });

    // Search equipment / assets
    (window.equipmentData || []).forEach((e, i) => {
        if ((e.name && e.name.toLowerCase().includes(q)) || (e.code && e.code.toLowerCase().includes(q))) {
            results.push({ type: 'asset', icon: '⚙️', label: e.name, sub: 'Code: ' + (e.code || 'N/A') + ' · Service: every ' + (e.interval || '?') + ' months', action: "window.showView('maintenance')" });
        }
    });

    // Search announcements
    (window.announcements || []).forEach((a, i) => {
        if ((a.title && a.title.toLowerCase().includes(q)) || (a.body && a.body.toLowerCase().includes(q))) {
            results.push({ type: 'announcement', icon: '📢', label: a.title || 'Announcement', sub: (a.priority || 'info') + ' · ' + (a.date || ''), action: "window.showView('noticeboard')" });
        }
    });

    // Quick-nav views
    var viewLinks = [
        { keywords: ['depletion', 'deplete', 'eod', 'stock depletion'], icon: '📉', label: 'Depletion History', sub: 'Stock depletion run history & undo', view: 'depletion-history' },
        { keywords: ['audit', 'audit log', 'trail'], icon: '📋', label: 'Audit Log', sub: 'Full change audit trail', view: 'audit-log' },
        { keywords: ['wastage', 'waste', 'spoilage', 'waste log'], icon: '🗑️', label: 'Wastage Tracker', sub: 'Log spoilage, breakage, expired stock', view: 'wastage' },
        { keywords: ['handover', 'debrief', 'shift notes'], icon: '📋', label: 'Handover / Debrief', sub: 'Shift handover notes', view: 'handover' },
        { keywords: ['roster', 'schedule', 'shifts', 'tanda'], icon: '🗓️', label: 'Roster', sub: 'Staff scheduling & rosters', view: 'rosters' },
        { keywords: ['comply', 'compliance', 'checklist', 'temperature', 'temp log', 'haccp'], icon: '🌡️', label: 'Compliance', sub: 'Temps, shift checklists, HACCP', view: 'compliance' },
        { keywords: ['badge', 'recognition', 'kudos', 'achievement'], icon: '🏆', label: 'Badge Management', sub: 'Staff recognition badges', view: 'badge-management' },
        { keywords: ['onboard', 'orientation', 'training', 'new staff'], icon: '👥', label: 'Staff Management', sub: 'Onboarding, qualifications, directory', view: 'orientation' },
        { keywords: ['pos', 'linker', 'link', 'lightspeed', 'kounta', 'mapping', 'pos alias', 'auto-link'], icon: '🔗', label: 'POS Auto-Linker', sub: 'Import POS products & match to recipes', view: 'pos-linker' },
        { keywords: ['setup', 'wizard', 'seed', 'bwi default'], icon: '🏮', label: 'BWI Setup Wizard', sub: 'Load venue defaults', view: null }
    ];
    viewLinks.forEach(function(vl) {
        if (vl.keywords.some(function(k) { return k.includes(q) || q.includes(k); })) {
            const action = vl.view ? "window.showView('" + vl.view + "')" : "window.renderBWISetupWizard()";
            results.push({ type: 'nav', icon: vl.icon, label: vl.label, sub: vl.sub, action: action });
        }
    });

    return results.slice(0, 20);
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
    const typeLabels = { inventory:'Inventory', recipe:'Recipes', sop:'Knowledge Base', contact:'Contacts', document:'Digital Safe', staff:'Staff', supplier:'Suppliers', task:'Tasks', incident:'Incidents', maintenance:'Maintenance', asset:'Equipment', announcement:'Noticeboard', nav:'Quick Navigation' };
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
