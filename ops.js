// =============================================================================
// OPS.JS — Bar Wa Izakaya | Hobart Hub
// Phase 1: Editable Zones + Invoice Ripper Pro (PDF + Vision) + Inventory
// =============================================================================

// --- SECURE API KEY MANAGER ---
window.getApiKey = () => {
    let key = localStorage.getItem('geminiApiKey');
    if (!key) {
        key = prompt("Enter your Gemini API Key (from Google AI Studio):");
        if (key) localStorage.setItem('geminiApiKey', key.trim());
    }
    return key;
};
window.resetApiKey = () => { localStorage.removeItem('geminiApiKey'); window.showToast("API Key cleared."); };

// --- SHARED TAB BARS ---
window._marginsTabBar = function(activeView) {
    const tabs = [
        { id: 'margins', label: '📊 Margins', view: 'margins' },
        { id: 'price-alerts', label: '🚨 Price Alerts', view: 'price-alerts' },
        { id: 'menu-engineering', label: '🎯 Menu Engineering', view: 'menu-engineering' },
        { id: 'sell-price-editor', label: '💰 Sell Prices', view: 'sell-price-editor' }
    ];
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">' +
        tabs.map(t => `<span class="tag-pill ${t.id===activeView?'active':''}" onclick="window.showView('${t.view}')">${t.label}</span>`).join('') +
    '</div>';
};

window._orderTabBar = function(activeView) {
    const tabs = [
        { id: 'prep-list', label: '📝 Order List', view: 'prep-list' },
        { id: 'ai-order', label: '✨ AI Suggester', view: 'ai-order' }
    ];
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">' +
        tabs.map(t => `<span class="tag-pill ${t.id===activeView?'active':''}" onclick="window.showView('${t.view}')">${t.label}</span>`).join('') +
    '</div>';
};

// =============================================================================
// 1. STORAGE ZONE MANAGER
// Zones are now fully user-managed. Used everywhere: inventory, invoice, recipes.
// =============================================================================

// Default zones — only used if none exist yet in data
window.storageZones = window.storageZones || [
    { id: 'zone_coolroom',   name: 'Walk-in Coolroom',   area: 'BOH' },
    { id: 'zone_underbench', name: 'Pass Under-bench',   area: 'BOH' },
    { id: 'zone_drystore',   name: 'Dry Store',          area: 'BOH' },
    { id: 'zone_barfridge',  name: 'Main Bar Fridge',    area: 'FOH' },
    { id: 'zone_speedrail',  name: 'Speed Rail',         area: 'FOH' },
    { id: 'zone_cocktail',   name: 'Cocktail Station',   area: 'FOH' }
];

// Add storageZones to the save keys if not already there
if (!window.saveKeys.includes('storageZones')) window.saveKeys.push('storageZones');

// Helper: Build zone <select> HTML for any form
window.buildZoneSelect = (selectedZoneName = '', elId = 'iv-loc') => {
    const boh = (window.storageZones || []).filter(z => z.area === 'BOH');
    const foh = (window.storageZones || []).filter(z => z.area === 'FOH');
    const other = (window.storageZones || []).filter(z => z.area !== 'BOH' && z.area !== 'FOH');

    const buildOpts = (zones) => zones.map(z =>
        `<option value="${esc(z.name)}" ${z.name === selectedZoneName ? 'selected' : ''}>${esc(z.name)}</option>`
    ).join('');

    return `<select id="${elId}" class="input-box" style="margin:0;">
        <option value="">Unassigned</option>
        ${boh.length ? `<optgroup label="BOH (Kitchen)">${buildOpts(boh)}</optgroup>` : ''}
        ${foh.length ? `<optgroup label="FOH (Bar)">${buildOpts(foh)}</optgroup>` : ''}
        ${other.length ? `<optgroup label="Other">${buildOpts(other)}</optgroup>` : ''}
    </select>`;
};

window.renderZoneManager = () => {
    const zonesHtml = (window.storageZones || []).map((z, i) => `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 12px;"><strong style="font-size:13px;">${esc(z.name)}</strong></td>
            <td style="padding:8px 12px;">
                <select onchange="window.storageZones[${i}].area = this.value; window.saveToDisk(); window.showView('zones');" class="input-box" style="margin:0; padding:6px; width:120px;">
                    <option ${z.area==='BOH'?'selected':''}>BOH</option>
                    <option ${z.area==='FOH'?'selected':''}>FOH</option>
                    <option ${z.area==='Other'?'selected':''}>Other</option>
                </select>
            </td>
            <td style="padding:8px 12px; text-align:right;">
                <button onclick="window.editZoneForm(${i})" class="btn btn-outline" style="font-size:11px; padding:5px 10px; margin-right:5px;">Rename</button>
                <button onclick="window.deleteZone(${i})" class="btn btn-red" style="font-size:11px; padding:5px 10px;">Delete</button>
            </td>
        </tr>
    `).join('');

    return `
    <div style="max-width: 800px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0">🗄️ Storage Zones</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">These zones appear in Inventory, Invoice Ripper, and Recipe Quick-Add</div>
            </div>
            <button onclick="window.editZoneForm()" class="btn btn-blue">+ Add Zone</button>
        </div>
        <div class="card" style="padding:0; overflow:hidden;">
            <table style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background:#111; border-bottom:1px solid var(--border);">
                        <th style="padding:12px 15px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Zone Name</th>
                        <th style="padding:12px 15px; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Area</th>
                        <th style="padding:12px 15px; text-align:right; font-size:12px; color:var(--text-muted); text-transform:uppercase;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${zonesHtml.length ? zonesHtml : '<tr><td colspan="3" style="padding:40px;text-align:center;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px">🗄️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No storage zones</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Set up your walk-in, dry store, and bar areas for stock organisation</div></td></tr>'}
                </tbody>
            </table>
        </div>
        <div class="card" style="margin-top:20px; border-left:4px solid var(--blue);">
            <p style="margin:0; font-size:13px; color:var(--text-muted);">💡 <strong>Tip:</strong> BOH zones appear under "Kitchen" grouping. FOH zones appear under "Bar". You can have as many as you need — the walking order for stock counts follows this list top-to-bottom.</p>
        </div>
    </div>`;
};

window.editZoneForm = (i = null) => {
    const z = i !== null ? window.storageZones[i] : { name: '', area: 'BOH' };
    const html = `
        <label style="font-size:12px; color:var(--text-muted);">Zone Name</label>
        <input type="text" id="zone-name" class="input-box" value="${esc(z.name)}" placeholder="e.g. Beer Fridge, Freezer 2">
        <label style="font-size:12px; color:var(--text-muted);">Area</label>
        <select id="zone-area" class="input-box">
            <option ${z.area==='BOH'?'selected':''}>BOH</option>
            <option ${z.area==='FOH'?'selected':''}>FOH</option>
            <option ${z.area==='Other'?'selected':''}>Other</option>
        </select>
        <button onclick="window.saveZone(${i})" class="btn btn-green" style="width:100%; margin-top:10px; font-size:15px;">Save Zone</button>
    `;
    window.openModal(i !== null ? '✏️ Rename Zone' : '➕ Add New Zone', html);
};

window.saveZone = (i) => {
    const name = document.getElementById('zone-name').value.trim();
    const area = document.getElementById('zone-area').value;
    if (!name) return window.showToast("Zone name is required.", "error");
    if (i !== null) {
        window.storageZones[i] = { ...window.storageZones[i], name, area };
    } else {
        window.storageZones.push({ id: window.generateId('zone'), name, area });
    }
    window.saveToDisk();
    window.closeModal();
    window.showView('zones');
    window.showToast(`Zone "${name}" saved.`);
};

window.deleteZone = (i) => {
    const z = window.storageZones[i];
    window.confirmAction({
        title: '🗄️ Delete Zone',
        message: 'Delete zone <strong>' + window.esc(z.name) + '</strong>? Items using this zone will show as Unassigned.',
        confirmLabel: 'Delete', tier: 'standard',
        onConfirm: () => { window.storageZones.splice(i, 1); window.saveToDisk(); window.showView('zones'); window.showToast('Zone deleted.'); }
    });
};

// Zones view is registered in core.js router — no patch needed here

// =============================================================================
// 2. SUPPLIER MANAGEMENT
// =============================================================================

window.renderSupplierView = () => {
    const activeTab = window._supTab || 'suppliers';
    const btnS = activeTab === 'suppliers' ? 'btn-dark' : 'btn-outline';
    const btnH = activeTab === 'history' ? 'btn-dark' : 'btn-outline';
    let content = activeTab === 'history' ? window.renderOrderHistory() : `
        <table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse:collapse; overflow:hidden;">
            <thead>
                <tr style="text-align:left; border-bottom:1px solid var(--border); background:#111; font-size:11px; text-transform:uppercase; color:var(--text-muted);">
                    <th style="padding:8px 12px;">Supplier</th>
                    <th style="padding:8px 12px;">Contact</th>
                    <th style="padding:8px 12px;">Logistics</th>
                    <th style="text-align:right; padding:8px 12px;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${(window.suppliers||[]).length === 0
                    ? '<tr><td colspan="4" style="padding:48px 20px;text-align:center;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px">🚚</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No suppliers added</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add your suppliers to enable ordering and invoice matching</div></td></tr>'
                    : (window.suppliers||[]).map((s, i) => `
                    <tr style="border-bottom:1px solid var(--bg-main);">
                        <td style="padding:8px 12px;"><strong style="font-size:13px;">${esc(s.name)}</strong></td>
                        <td style="padding:8px 12px; font-size:12px;">${esc(s.contact) || 'N/A'}</td>
                        <td style="padding:8px 12px; font-size:12px; color:var(--brand-accent);">
                            Min Spend: <strong>$${s.minSpend || 0}</strong><br>
                            Cutoff: ${s.cutoff || 'N/A'}<br>
                            Days: ${s.deliveryDays && s.deliveryDays.length > 0 ? s.deliveryDays.join(', ') : 'All'}
                        </td>
                        <td style="text-align:right; padding:8px 12px;">
                            <button onclick="window.editSupplierForm(${i})" class="btn btn-outline" style="font-size:11px; padding:5px 10px;">Edit</button>
                            <button onclick="window.delSupplier(${i})" class="btn btn-red" style="font-size:11px; padding:5px 10px; margin-left:5px;">X</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
    return `
    <div style="max-width: 1000px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <div><h2 style="margin:0">🚚 Suppliers & Ordering</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Manage suppliers, delivery schedules, and order history</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="window._supTab='suppliers';window.showView('suppliers')" class="btn ${btnS}">Suppliers</button>
                <button onclick="window._supTab='history';window.showView('suppliers')" class="btn ${btnH}">📋 Order History</button>
                ${activeTab === 'suppliers' ? '<button onclick="window.editSupplierForm()" class="btn btn-blue">+ Add Supplier</button>' : ''}
            </div>
        </div>
        ${content}
    </div>`;
};

window.renderOrderHistory = () => {
    const history = (window.orderHistory || []).slice().reverse();
    if (history.length === 0) {
        return '<div class="card" style="text-align:center;padding:30px;">' +
            '<p style="color:var(--text-muted);margin:0;">No orders logged yet.</p>' +
            '<p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Orders are automatically logged when you use Copy Order Text in the Auto-Order List.</p>' +
        '</div>';
    }
    return history.map(o =>
        '<div class="card" style="margin-bottom:15px;border-top:4px solid var(--blue);">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px;">' +
            '<div><strong style="font-size:16px;">' + esc(o.supplier) + '</strong><span style="color:var(--text-muted);font-size:12px;margin-left:10px;">' + o.date + '</span></div>' +
            '<div style="text-align:right;"><strong style="color:var(--green);font-size:18px;">$' + Number(o.estSpend||0).toFixed(2) + '</strong><div style="font-size:11px;color:var(--text-muted);">Est. · ' + (o.items||[]).length + ' items</div></div>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--border);">' +
        '<th style="padding:6px 0;text-align:left;">Item</th><th style="padding:6px 0;text-align:right;">Qty</th><th style="padding:6px 0;text-align:right;">Price</th><th style="padding:6px 0;text-align:right;">Total</th>' +
        '</tr></thead><tbody>' +
        (o.items||[]).map(item =>
            '<tr style="border-bottom:1px dashed var(--border);">' +
            '<td style="padding:7px 0;">' + esc(item.name) + (item.sku ? ' <small style="color:var(--text-muted);">[' + esc(item.sku) + ']</small>' : '') + '</td>' +
            '<td style="padding:7px 0;text-align:right;">' + item.qty + ' ' + (item.unit||'') + '</td>' +
            '<td style="padding:7px 0;text-align:right;color:var(--brand-accent);">$' + Number(item.price||0).toFixed(2) + '</td>' +
            '<td style="padding:7px 0;text-align:right;font-weight:bold;">$' + (Number(item.qty||0)*Number(item.price||0)).toFixed(2) + '</td>' +
            '</tr>'
        ).join('') +
        '</tbody></table></div>'
    ).join('');
};


window.editSupplierForm = (i = null) => {
    let s = i !== null ? window.suppliers[i] : { name:'', contact:'', cutoff:'', minSpend: 0, deliveryDays: [] };
    let daysHtml = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d =>
        `<label style="margin-right:10px; font-size:13px;"><input type="checkbox" id="sup-day-${d}" ${s.deliveryDays && s.deliveryDays.includes(d) ? 'checked' : ''}> ${d}</label>`
    ).join('');

    document.getElementById('mainContent').innerHTML = `
    <div class="card" style="max-width:500px; margin:auto; border-top:5px solid var(--blue);">
        <h3 style="margin-top:0;">${i !== null ? 'Edit' : 'New'} Supplier</h3>
        <label style="font-size:12px; color:var(--text-muted);">Supplier Name</label>
        <input type="text" id="sup-n" class="input-box" value="${esc(s.name)}" placeholder="e.g. Moco Food Services">
        <label style="font-size:12px; color:var(--text-muted);">Contact (Email/Phone)</label>
        <input type="text" id="sup-c" class="input-box" value="${esc(s.contact)}" placeholder="orders@...">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div><label style="font-size:12px; color:var(--text-muted);">Min Spend ($)</label><input type="number" id="sup-min" class="input-box" value="${s.minSpend}"></div>
            <div><label style="font-size:12px; color:var(--text-muted);">Order Cutoff Time</label><input type="time" id="sup-cut" class="input-box" value="${s.cutoff}"></div>
        </div>
        <label style="font-size:12px; color:var(--text-muted); display:block; margin-bottom:5px;">Delivery Days</label>
        <div style="margin-bottom:15px; background:var(--bg-main); padding:10px; border-radius:6px;">${daysHtml}</div>
        <button onclick="window.subSupplier(${i})" class="btn btn-green" style="width:100%; margin-top:10px;">Save Supplier</button>
        <button onclick="window.showView('suppliers')" class="btn btn-outline" style="width:100%; margin-top:10px;">Cancel</button>
    </div>`;
};

window.subSupplier = (i) => {
    let selectedDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].filter(d => document.getElementById(`sup-day-${d}`).checked);
    let obj = {
        name: document.getElementById('sup-n').value.trim(),
        contact: document.getElementById('sup-c').value.trim(),
        cutoff: document.getElementById('sup-cut').value.trim(),
        minSpend: parseFloat(document.getElementById('sup-min').value) || 0,
        deliveryDays: selectedDays
    };
    if (!obj.name) return window.showToast("Supplier Name is required.", "error");
    if (i !== null && i !== undefined) window.suppliers[i] = obj; else window.suppliers.push(obj);
    window.saveToDisk(); window.showView('suppliers');
};
window.delSupplier = (i) => {
    window.confirmAction({
        title: '🚚 Delete Supplier',
        message: 'Remove this supplier? Inventory items linked to them will keep their data.',
        confirmLabel: 'Delete', tier: 'standard',
        onConfirm: () => { window.suppliers.splice(i, 1); window.saveToDisk(); window.showView('suppliers'); window.showToast('Supplier deleted.'); }
    });
};

// =============================================================================
// 3. LIVE INVENTORY
// =============================================================================

window.resetAllStock = () => {
    window.confirmAction({
        title: '⚠️ Reset All Stock',
        message: 'This will set <strong>every item</strong> in inventory to <strong>0 stock</strong>.<br>All items are kept — only quantities are wiped.<br><br>This <strong>cannot be undone</strong>.',
        confirmLabel: 'Reset All Stock',
        confirmColor: 'var(--red)',
        tier: 'dangerous',
        onConfirm: () => {
            let count = 0;
            (window.inventoryItems || []).forEach(i => { i.stock = 0; count++; });
            window.saveToDisk(); window.showView('inventory');
            window.showToast(count + ' items reset to 0 stock.', 'error');
        }
    });
};

window.invFilters = window.invFilters || { search: '', filter: 'Active', groupBy: 'Category' };
window._invSelected = window._invSelected || new Set();

window.renderInventoryView = () => {
    let isWeekend = [0, 5, 6].includes(new Date().getDay());

    let filtered = (window.inventoryItems || []).filter(item => {
        let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
        if (window.invFilters.filter === 'Active' && item.archived) return false;
        if (window.invFilters.filter === 'Archived' && !item.archived) return false;
        if (window.invFilters.filter === 'Below PAR' && (item.stock >= parTarget || item.archived)) return false;
        if (!['Active','Archived','Below PAR'].includes(window.invFilters.filter) && item.category !== window.invFilters.filter) return false;
        if (window.invFilters.search) {
            const s = window.invFilters.search.toLowerCase();
            return item.name.toLowerCase().includes(s) || (item.sku && item.sku.toLowerCase().includes(s));
        }
        return true;
    });

    const cats = [...new Set((window.inventoryItems || []).filter(i => !i.archived).map(i => i.category || 'Other'))];
    const belowParCount = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return i.stock < par;
    }).length;
    const belowBadge = belowParCount > 0 ? ' <span style="background:var(--red);color:white;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:3px;">' + belowParCount + '</span>' : '';
    const pillsHtml = ['Active', 'Below PAR', ...cats, 'Archived'].map(c =>
        '<div class="tag-pill ' + (window.invFilters.filter===c?'active':'') + '" onclick="window.invFilters.filter=\'' + c + '\'; window.showView(\'inventory\')">' +
        (c==='Below PAR' ? '🚨 Below PAR' + belowBadge : c) + '</div>'
    ).join('');

    let grouped = {};
    filtered.forEach(item => {
        let key = window.invFilters.groupBy === 'Zone'
            ? (item.location || 'Unassigned Zone')
            : (item.category || 'Unassigned Category');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    let accordionHtml = Object.keys(grouped).sort().map(groupName => {
        let itemsHtml = grouped[groupName].map(item => {
            let price = Number(item.price) || 0;
            let stock = Number(item.stock) || 0;
            let yieldVal = Number(item.yield) || 1;
            let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
            const isSelected = window._invSelected.has(item.id);
            return `
            <tr style="border-bottom:1px solid var(--bg-main); opacity:${item.archived?'0.5':'1'}; background:${isSelected?'rgba(59,130,246,0.07)':''};">
                <td style="padding:6px 6px; width:30px; text-align:center;">
                    <input type="checkbox" ${isSelected?'checked':''} onchange="window._invToggleSelect('${item.id}', this.checked)" style="transform:scale(1.1); cursor:pointer;">
                </td>
                <td style="padding:7px 8px;">
                    <strong style="cursor:pointer;font-size:13px;" onclick="window.editInvItem(this.getAttribute('data-id'))" data-id="${item.id}">${esc(item.name)}</strong>
                    <br><small style="color:var(--text-muted);font-size:11px;">${esc(item.sku) || 'No SKU'} · ${esc(item.supplier) || 'No Supplier'}</small>
                </td>
                <td style="padding:7px 8px;font-size:12px;white-space:nowrap;">
                    <strong style="color:var(--brand-accent);">$${price.toFixed(2)}</strong>/${esc(item.buyUnit || 'Unit')} <small style="color:var(--blue);">→ ${yieldVal} ${esc(item.useUnit || 'Unit')}</small><br>
                    <small style="color:var(--text-muted);">$${(price/yieldVal).toFixed(4)} per ${esc(item.useUnit || 'Unit')}</small>
                </td>
                <td style="padding:7px 8px; font-size:12px; color:var(--text-muted);">${esc(item.location) || '—'}</td>
                <td style="padding:7px 8px;">
                    <span style="color:${stock<parTarget?'var(--red)':'var(--green)'}; font-weight:bold; font-size:14px; cursor:pointer;" title="Click to edit stock" onclick="window._inlineEditStock('${item.id}')">${stock.toFixed(1)}</span>
                    <small style="color:var(--text-muted);"> / </small>
                    <span style="color:var(--text-muted); font-size:11px; cursor:pointer;" title="Click to edit PAR" onclick="window._inlineEditPar('${item.id}')">${parTarget}</span>
                </td>
                <td style="text-align:right; padding:7px 6px; white-space:nowrap;">
                    <button onclick="window.viewPriceTrend(this.getAttribute('data-id'))" data-id="${item.id}" class="btn btn-outline" style="font-size:10px; padding:8px 12px; border-color:var(--purple); color:var(--purple); margin-right:2px;">📈</button>
                    <button onclick="window.editInvItem(this.getAttribute('data-id'))" data-id="${item.id}" class="btn btn-outline" style="font-size:10px; padding:8px 12px;">Edit</button>
                </td>
            </tr>`;
        }).join('');

        const grpSel = grouped[groupName].filter(i => window._invSelected.has(i.id)).length;
        const allChk = grpSel === grouped[groupName].length && grouped[groupName].length > 0 ? 'checked' : '';
        return `
        <details class="card" style="padding:0; overflow:visible; margin-bottom:8px;" open>
            <summary style="padding:8px 12px; background:#111; cursor:pointer; font-weight:bold; color:var(--brand-dark); display:flex; justify-content:space-between; align-items:center; outline:none; border-bottom:1px solid var(--border); border-radius:10px 10px 0 0; font-size:14px;">
                <span style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" ${allChk} onclick="event.stopPropagation(); window._invSelectGroup('${groupName}', this.checked)" style="transform:scale(1.1);">
                    ${esc(groupName)} <span style="color:var(--text-muted); font-size:11px; font-weight:normal;">(${grouped[groupName].length})</span>
                </span>
                <span style="color:var(--blue); font-size:11px;">▼</span>
            </summary>
            <div id="inv-list-container" style="overflow-x:auto; overflow-y:visible;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr style="background:#0a0a0c; font-size:10px; color:var(--text-muted); text-transform:uppercase;">
                        <th style="padding:5px; width:30px;"></th>
                        <th style="padding:5px 8px; text-align:left;">Product</th>
                        <th style="padding:5px 8px; text-align:left;">Pricing</th>
                        <th style="padding:5px 8px; text-align:left;">Zone</th>
                        <th style="padding:5px 8px; text-align:left;">Stock / PAR</th>
                        <th style="padding:5px 8px;"></th>
                    </tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
            </div>
        </details>`;
    }).join('');

    if (Object.keys(grouped).length === 0) {
        accordionHtml = '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">📦</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No inventory items yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add your first item with "+ Add Product" or bulk import from a spreadsheet</div></div>';
    }

    const selCount = window._invSelected.size;
    const selWord = selCount === 1 ? 'item' : 'items';
    const bulkBar = selCount > 0 ? `
    <div style="position:sticky; bottom:20px; z-index:100; background:var(--card-bg); border:1px solid var(--blue); border-radius:12px; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 8px 30px rgba(0,0,0,0.5); flex-wrap:wrap; gap:10px; margin-top:15px;">
        <span style="font-weight:bold; color:var(--blue);">${selCount} ${selWord} selected</span>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button onclick="window._invBulkAction('zone')" class="btn btn-outline" style="font-size:12px; padding:6px 12px;">📍 Zone</button>
            <button onclick="window._invBulkAction('supplier')" class="btn btn-outline" style="font-size:12px; padding:6px 12px;">🚚 Supplier</button>
            <button onclick="window._invBulkAction('category')" class="btn btn-outline" style="font-size:12px; padding:6px 12px;">🏷️ Category</button>
            <button onclick="window._invBulkAction('archive')" class="btn btn-orange" style="font-size:12px; padding:6px 12px;">📦 Archive</button>
            <button onclick="window._invBulkAction('delete')" class="btn btn-red" style="font-size:12px; padding:6px 12px;">🗑️ Delete</button>
            <button onclick="window._invSelected=new Set(); window.showView(\'inventory\')" class="btn btn-outline" style="font-size:12px; padding:6px 12px; color:var(--text-muted);">✕ Clear</button>
        </div>
    </div>` : '';

    return `
    <div style="max-width:1100px; margin:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
            <div><h2 style="margin:0">📦 Live Inventory <span style="font-size:14px; color:var(--text-muted); font-weight:normal;">(${filtered.length} items)</span></h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Track stock levels, pricing, and PAR targets across all zones</div></div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button onclick="window.showView('stock-count')" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--green); color:var(--green);">✅ Quick Count</button>
                <button onclick="window.showView(\'par-editor\')" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--orange); color:var(--orange);">📋 PAR Editor</button>
                <button onclick="window.openStockCountSheet()" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--blue); color:var(--blue);">🖨️ Count Sheet</button>
                <button onclick="window.showView('zones')" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">⚙️ Zones</button>
                <button onclick="window.resetAllStock()" class="btn btn-outline" style="color:var(--red); border-color:var(--red); font-size:12px;">⚠️ Wipe Stock</button>
                <button onclick="window.editInvItem()" class="btn btn-blue">+ Add Product</button>
            </div>
        </div>
        <input type="text" class="search-bar" id="inv-search-box" placeholder="🔍 Search items or SKU..." value="${window.invFilters.search}" oninput="window.invFilters.search=this.value; window._debouncedInvRefresh()">
        <div style="margin-bottom:15px;">${pillsHtml}</div>
        <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:15px; flex-wrap:wrap;">
            <span style="font-size:12px; color:var(--text-muted); align-self:center;">Group By:</span>
            <button onclick="window.invFilters.groupBy='Category'; window.showView(\'inventory\')" class="btn ${window.invFilters.groupBy==='Category'?'btn-dark':'btn-outline'}" style="padding:6px 15px; font-size:12px;">Category</button>
            <button onclick="window.invFilters.groupBy='Zone'; window.showView(\'inventory\')" class="btn ${window.invFilters.groupBy==='Zone'?'btn-dark':'btn-outline'}" style="padding:6px 15px; font-size:12px;">Zone</button>
        </div>
        ${accordionHtml}
        ${bulkBar}
    </div>`;
};

// ── Bulk select helpers ──────────────────────────────────────
window._invToggleSelect = (id, checked) => {
    if (checked) window._invSelected.add(id); else window._invSelected.delete(id);
    window.showView('inventory');
};
window._invSelectGroup = (groupName, checked) => {
    (window.inventoryItems||[]).forEach(item => {
        const key = window.invFilters.groupBy==='Zone' ? (item.location||'Unassigned Zone') : (item.category||'Unassigned Category');
        if (key === groupName) { if (checked) window._invSelected.add(item.id); else window._invSelected.delete(item.id); }
    });
    window.showView('inventory');
};
window._invBulkAction = (action) => {
    const ids = [...window._invSelected];
    if (!ids.length) return;
    if (action === 'delete') {
        window.confirmAction({
            title: '🗑️ Bulk Delete',
            message: 'Permanently delete <strong>' + ids.length + ' items</strong>? This cannot be undone.',
            confirmLabel: 'Delete ' + ids.length + ' Items',
            tier: 'dangerous',
            onConfirm: () => {
                window.inventoryItems = window.inventoryItems.filter(i => !ids.includes(i.id));
                window._invSelected = new Set(); window.saveToDisk(); window.showToast(ids.length + ' items deleted.'); window.showView('inventory');
            }
        });
        return;
    }
    if (action === 'archive') {
        ids.forEach(id => { const it = window.inventoryItems.find(i=>i.id===id); if(it) it.archived=true; });
        window._invSelected = new Set(); window.saveToDisk(); window.showToast(ids.length + ' items archived.'); window.showView('inventory'); return;
    }
    const opts = action === 'zone'
        ? '<option value="">Unassigned</option>' + (window.storageZones||[]).map(z=>'<option value="'+esc(z.name)+'">'+esc(z.name)+'</option>').join('')
        : action === 'supplier'
        ? '<option value="">-- None --</option>' + (window.suppliers||[]).map(s=>'<option value="'+esc(s.name)+'">'+esc(s.name)+'</option>').join('')
        : ['Food','Beverage','Packaging','Chemicals','Other',...new Set((window.inventoryItems||[]).map(i=>i.category))].map(c=>'<option>'+esc(c)+'</option>').join('');
    const label = action === 'zone' ? 'Zone' : action === 'supplier' ? 'Supplier' : 'Category';
    window.openModal('Change ' + label + ' for ' + ids.length + ' items',
        '<select id="bulk-val" class="input-box">' + opts + '</select>' +
        '<button onclick="window._applyBulk(\'' + action + '\')" class="btn btn-green" style="width:100%;margin-top:10px;">Apply to ' + ids.length + ' Items</button>');
};
window._applyBulk = (action) => {
    const val = document.getElementById('bulk-val').value;
    const field = action === 'zone' ? 'location' : action;
    const ids = [...window._invSelected];
    ids.forEach(id => { const it = window.inventoryItems.find(i=>i.id===id); if(it) it[field]=val; });
    window._invSelected = new Set(); window.closeModal(); window.saveToDisk(); window.showToast(ids.length + ' items updated.'); window.showView('inventory');
};

// ── Inline stock & PAR edit ──────────────────────────────────
window._inlineEditStock = (id) => {
    const item = window.inventoryItems.find(i=>i.id===id); if (!item) return;
    const val = prompt('Update stock for "' + item.name + '" (current: ' + item.stock + ' ' + item.buyUnit + '):', item.stock);
    if (val === null) return;
    const n = parseFloat(val); if (isNaN(n)) return window.showToast('Invalid number.','error');
    item.stock = n; window.saveToDisk(); window.showToast(item.name + ' → ' + n + ' ' + item.buyUnit); window.showView('inventory');
};
window._inlineEditPar = (id) => {
    const item = window.inventoryItems.find(i=>i.id===id); if (!item) return;
    const isWe = [0,5,6].includes(new Date().getDay());
    const field = isWe ? 'parWeekend' : 'parWeekday';
    const label = (isWe ? 'Weekend' : 'Weekday') + ' PAR';
    const val = prompt('Update ' + label + ' for "' + item.name + '":', item[field]||0);
    if (val === null) return;
    const n = parseFloat(val); if (isNaN(n)) return window.showToast('Invalid number.','error');
    item[field] = n; item.par = n; window.saveToDisk(); window.showToast(item.name + ' ' + label + ' → ' + n); window.showView('inventory');
};

window.editInvItem = (id = null) => {
    const cleanId = id ? String(id).trim() : null;
    let found = cleanId ? window.inventoryItems.find(i => i.id === cleanId) : null;
    let e = found || {
        id: cleanId || window.generateId('inv'), name:'', category:'Food', supplier:'', price:0, sku:'',
        location:'', gstFree:false, buyUnit:'Unit', yield:1, useUnit:'Unit',
        stock:0, parWeekday:0, parWeekend:0, archived: false, history:[]
    };
    if (cleanId && !found) console.warn('editInvItem: no item found for id:', cleanId, '| available ids:', window.inventoryItems.slice(0,3).map(i=>i.id));
    let supplierOpts = (window.suppliers || []).map(s =>
        `<option value="${esc(s.name)}" ${e.supplier === s.name ? 'selected' : ''}>${esc(s.name)}</option>`
    ).join('');
    const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
    const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
    let pWd = e.parWeekday !== undefined ? e.parWeekday : (e.par || 0);
    let pWe = e.parWeekend !== undefined ? e.parWeekend : (e.par || 0);

    let html = `
    <div class="card" style="max-width:700px; margin:auto; padding-bottom: 80px;">
        <h2 style="margin-top:0;">${id ? 'Edit Product' : 'New Product'}</h2>
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Product Name</label><input type="text" id="iv-n" class="input-box" value="${esc(e.name)}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iv-cat" list="cat-list" class="input-box" value="${esc(e.category)}"><datalist id="cat-list">${catOpts}</datalist></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Sub-category</label><input type="text" id="iv-subcat" list="subcat-list" class="input-box" value="${esc(e.subcategory || '')}" placeholder="e.g. Proteins, Spirits..."><datalist id="subcat-list">${(() => { const subs = new Set(); (window.inventoryItems||[]).forEach(i => { if (i.subcategory) subs.add(i.subcategory); }); return [...subs].map(s => '<option value="'+esc(s)+'">').join(''); })()}</datalist></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Supplier</label><select id="iv-s" class="input-box"><option value="">-- None --</option>${supplierOpts}</select></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Supplier SKU / Order Code</label><input type="text" id="iv-sku" class="input-box" value="${esc(e.sku || '')}"></div>
        </div>
        <div style="background:var(--bg-main); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:15px;">
            <h4 style="margin:0 0 10px 0; color:var(--brand-accent);">Commercial Math & Yield</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px;">
                <div><label style="font-size:11px; color:var(--text-muted);">Buy Price ($)</label><input type="number" step="0.01" id="iv-p" class="input-box" value="${e.price}"></div>
                <div><label style="font-size:11px; color:var(--text-muted);">Buy Unit (e.g. Box, Keg)</label><input type="text" id="iv-buyUnit" class="input-box" value="${esc(e.buyUnit)}"></div>
                <div style="padding-top:20px;"><label style="font-size:13px; cursor:pointer;"><input type="checkbox" id="iv-gst" ${e.gstFree ? 'checked' : ''} style="transform:scale(1.2);"> GST Free</label></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding-top:10px; border-top:1px dashed var(--border);">
                <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-Units per Buy-Unit)</label><input type="number" step="0.01" id="iv-yield" class="input-box" value="${e.yield}" style="border-color:var(--blue);"></div>
                <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit (e.g. kg, ml, portion)</label><input type="text" id="iv-useUnit" class="input-box" value="${esc(e.useUnit)}" style="border-color:var(--blue);"></div>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Current Stock (Buy Units)</label><input type="number" step="0.1" id="iv-st" class="input-box" value="${e.stock}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Weekday PAR</label><input type="number" step="0.1" id="iv-parwd" class="input-box" value="${pWd}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Weekend PAR</label><input type="number" step="0.1" id="iv-parwe" class="input-box" value="${pWe}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Zone / Location</label>${window.buildZoneSelect(e.location, 'iv-loc')}</div>
        </div>
        <div class="sticky-footer">
            <button onclick="window.subInvItem('${e.id}', true)" class="btn btn-blue" style="flex:1;">Save & Add Another</button>
            <button onclick="window.subInvItem('${e.id}', false)" class="btn btn-green" style="flex:1;">Save & Close</button>
            ${id ? `<button onclick="window.archiveInv('${e.id}')" class="btn btn-orange" style="flex:0.5;">${e.archived ? 'Restore' : 'Archive'}</button>` : ''}
            <button onclick="window.showView(\'inventory\')" class="btn btn-outline" style="flex:0.5;">Cancel</button>
        </div>
    </div>`;
    document.getElementById('mainContent').innerHTML = html;
};

window.subInvItem = (id, addAnother, isModal = false) => {
    const nameVal = document.getElementById('iv-n').value.trim();
    if (!nameVal) return window.showToast('Item name is required.', 'error');
    let existingIdx = window.inventoryItems.findIndex(i => i.id === id);
    const price = parseFloat(document.getElementById('iv-p').value) || 0;
    let obj = {
        id: id,
        name: nameVal,
        category: document.getElementById('iv-cat').value.trim(),
        sku: document.getElementById('iv-sku').value.trim(),
        supplier: document.getElementById('iv-s').value.trim(),
        price: price,
        location: document.getElementById('iv-loc').value,
        subcategory: document.getElementById('iv-subcat') ? document.getElementById('iv-subcat').value : '',
        gstFree: document.getElementById('iv-gst').checked,
        stock: parseFloat(document.getElementById('iv-st').value) || 0,
        parWeekday: parseFloat(document.getElementById('iv-parwd').value) || 0,
        parWeekend: parseFloat(document.getElementById('iv-parwe').value) || 0,
        par: parseFloat(document.getElementById('iv-parwd').value) || 0,
        yield: parseFloat(document.getElementById('iv-yield').value) || 1,
        useUnit: document.getElementById('iv-useUnit').value,
        buyUnit: document.getElementById('iv-buyUnit').value,
        archived: existingIdx >= 0 ? window.inventoryItems[existingIdx].archived : false,
        history: existingIdx >= 0 ? window.inventoryItems[existingIdx].history : []
    };
    if (existingIdx >= 0) { window.inventoryItems[existingIdx] = obj; } else { window.inventoryItems.push(obj); }
    window.saveToDisk();
    window.showToast(`${obj.name} saved.`);
    if (isModal) {
        window.closeModal();
        if (window.tempRecipeId) window.editRecipeForm(window.tempRecipeId === 'new' ? null : window.tempRecipeId);
        return;
    }
    if (addAnother) { window.editInvItem(); } else { window.showView('inventory'); }
};


// =============================================================================
// BULK PAR EDITOR
// All items in a tabbed table grouped by category — tab through fields
// One save commits everything to Firebase
// =============================================================================




// =============================================================================
// INGREDIENT PRICE HISTORY
// =============================================================================
window.recordPriceChange = (itemId, oldPrice, newPrice, source) => {
    if (!window.priceHistory) window.priceHistory = {};
    if (!window.priceHistory[itemId]) window.priceHistory[itemId] = [];
    window.priceHistory[itemId].push({
        date: new Date().toISOString(),
        oldPrice: oldPrice,
        newPrice: newPrice,
        source: source || 'invoice'
    });
    // Keep last 50 entries per item
    if (window.priceHistory[itemId].length > 50) {
        window.priceHistory[itemId] = window.priceHistory[itemId].slice(-50);
    }
};

window.viewPriceTrend = (id) => {
    const item = (window.inventoryItems||[]).find(i => i.id === id);
    if (!item) return;
    const history = (window.priceHistory || {})[id] || [];
    const priceEntries = history.filter(h => h.newPrice !== undefined);
    
    if (priceEntries.length === 0) {
        window.openModal('📈 Price History — ' + esc(item.name),
            '<div style="text-align:center;padding:20px;">' +
            '<p style="color:var(--text-muted);margin:0;">No price history yet.</p>' +
            '<p style="font-size:13px;color:var(--text-muted);margin-top:8px;">Price changes are recorded when invoices are committed.</p>' +
            '<div style="margin-top:20px;font-size:18px;font-weight:bold;color:var(--brand-accent);">Current: $' + Number(item.price||0).toFixed(2) + ' / ' + (item.buyUnit||'unit') + '</div>' +
            '</div>'
        );
        return;
    }
    
    // Build SVG sparkline chart
    const maxPrice = Math.max(...priceEntries.map(p => p.newPrice), item.price||0);
    const minPrice = Math.min(...priceEntries.map(p => p.newPrice), item.price||0);
    const range = maxPrice - minPrice || 1;
    const chartW = 500, chartH = 150, padding = 30;
    const plotW = chartW - padding*2, plotH = chartH - padding*2;
    
    const allPoints = [...priceEntries.map(p => ({ price: p.newPrice, date: new Date(p.date) })), { price: item.price||0, date: new Date(), label: 'Current' }];
    allPoints.sort((a,b) => a.date - b.date);
    
    const dateRange = (allPoints[allPoints.length-1].date - allPoints[0].date) || 1;
    const points = allPoints.map(p => {
        const x = padding + ((p.date - allPoints[0].date) / dateRange) * plotW;
        const y = padding + plotH - ((p.price - minPrice) / range) * plotH;
        return { x, y, price: p.price, date: p.date, label: p.label };
    });
    
    const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const dots = points.map(p =>
        '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="' + (p.label==='Current'?'var(--green)':'var(--blue)') + '" stroke="var(--card-bg)" stroke-width="2"><title>$' + p.price.toFixed(2) + ' — ' + p.date.toLocaleDateString('en-AU') + '</title></circle>'
    ).join('');
    
    const firstPrice = priceEntries[0].newPrice;
    const currentPrice = item.price || 0;
    const pctChange = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice * 100).toFixed(1) : 0;
    const trendColor = pctChange > 5 ? 'var(--red)' : pctChange < -5 ? 'var(--green)' : 'var(--text-muted)';
    const trendLabel = pctChange > 0 ? '▲ +' + pctChange + '%' : pctChange < 0 ? '▼ ' + pctChange + '%' : '— No change';
    
    const svgHtml = '<svg width="' + chartW + '" height="' + chartH + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">' +
        '<rect width="' + chartW + '" height="' + chartH + '" fill="var(--bg-main)" rx="8"/>' +
        '<line x1="' + padding + '" y1="' + (chartH-padding) + '" x2="' + (chartW-padding) + '" y2="' + (chartH-padding) + '" stroke="var(--border)" stroke-width="1"/>' +
        '<text x="' + padding + '" y="' + (chartH-8) + '" fill="var(--text-muted)" font-size="10">' + allPoints[0].date.toLocaleDateString('en-AU',{month:'short',year:'2-digit'}) + '</text>' +
        '<text x="' + (chartW-padding) + '" y="' + (chartH-8) + '" fill="var(--text-muted)" font-size="10" text-anchor="end">' + allPoints[allPoints.length-1].date.toLocaleDateString('en-AU',{month:'short',year:'2-digit'}) + '</text>' +
        '<text x="' + (padding-5) + '" y="' + (padding+5) + '" fill="var(--text-muted)" font-size="10" text-anchor="end">$' + maxPrice.toFixed(0) + '</text>' +
        '<text x="' + (padding-5) + '" y="' + (chartH-padding) + '" fill="var(--text-muted)" font-size="10" text-anchor="end">$' + minPrice.toFixed(0) + '</text>' +
        '<path d="' + pathD + '" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linejoin="round"/>' +
        dots +
    '</svg>';
    
    const tableRows = priceEntries.slice().reverse().slice(0, 10).map(p =>
        '<tr style="border-bottom:1px dashed var(--border);">' +
        '<td style="padding:6px 0;font-size:12px;color:var(--text-muted);">' + new Date(p.date).toLocaleDateString('en-AU') + '</td>' +
        '<td style="padding:6px 0;font-size:12px;">$' + Number(p.oldPrice||0).toFixed(2) + ' → <strong>$' + Number(p.newPrice).toFixed(2) + '</strong></td>' +
        '<td style="padding:6px 0;font-size:11px;color:var(--text-muted);">' + (p.source||'invoice') + '</td>' +
        '</tr>'
    ).join('');
    
    const html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div><div style="font-size:28px;font-weight:bold;color:var(--brand-dark);">$' + currentPrice.toFixed(2) + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);">per ' + (item.buyUnit||'unit') + '</div></div>' +
        '<div style="text-align:right;"><div style="font-size:18px;font-weight:bold;color:' + trendColor + ';">' + trendLabel + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">Since first recorded</div></div>' +
    '</div>' +
    '<div style="margin-bottom:20px;overflow-x:auto;">' + svgHtml + '</div>' +
    (tableRows ? '<h4 style="margin:15px 0 8px 0;font-size:12px;color:var(--text-muted);text-transform:uppercase;">Recent Changes</h4>' +
    '<table style="width:100%;border-collapse:collapse;">' + tableRows + '</table>' : '');
    
    window.openModal('📈 Price History — ' + esc(item.name), html);
};

// =============================================================================
// STOCK COUNT SHEET — Print-friendly for physical stocktakes
// =============================================================================
window.openStockCountSheet = () => {
    const items = (window.inventoryItems||[]).filter(i=>!i.archived);
    if (items.length===0) return window.showToast('No inventory items yet.','error');

    const html = '<p style="font-size:13px;color:var(--text-muted);margin-top:0;">Print a blank count sheet to fill in during your stocktake.</p>' +
        '<label style="font-size:11px;color:var(--text-muted);">Group By</label>' +
        '<select id="cs-group" class="input-box">' +
            '<option value="zone">Zone (Walk-in, Bar Fridge etc)</option>' +
            '<option value="category">Category (Food, Beverage etc)</option>' +
        '</select>' +
        '<button onclick="window.printCountSheet()" class="btn btn-blue" style="width:100%;margin-top:5px;">🖨️ Print Count Sheet</button>';
    window.openModal('📋 Stock Count Sheet', html);
};

window.printCountSheet = () => {
    const groupBy = document.getElementById('cs-group') ? document.getElementById('cs-group').value : 'zone';
    const items = (window.inventoryItems||[]).filter(i=>!i.archived).sort((a,b)=>a.name.localeCompare(b.name));

    const grouped = {};
    items.forEach(item => {
        const key = groupBy === 'zone' ? (item.location||'Unassigned') : (item.category||'Uncategorised');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    const groupKeys = Object.keys(grouped).sort();
    let tableHtml = '';
    groupKeys.forEach(group => {
        tableHtml += '<tr><td colspan="4" style="background:#f3f4f6;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;color:#555;border-top:2px solid #ccc;">'+esc(group)+'</td></tr>';
        grouped[group].forEach(item => {
            const isWeekend = [0,5,6].includes(new Date().getDay());
            const par = isWeekend ? (item.parWeekend||item.par||0) : (item.parWeekday||item.par||0);
            tableHtml += '<tr>' +
                '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">'+esc(item.name)+'</td>' +
                '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#888;font-size:12px;">'+( item.buyUnit||'unit')+'</td>' +
                '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#888;font-size:12px;">'+(par > 0 ? 'PAR: '+par : 'No PAR')+'</td>' +
                '<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;"><div style="width:80px;border-bottom:2px solid #333;height:22px;"></div></td>' +
            '</tr>';
        });
    });

    const win = window.open('','_blank');
    if (!win) return window.showToast('Pop-up blocked.','error');
    win.document.write('<!DOCTYPE html><html><head><title>Stock Count Sheet</title>' +
        '<style>body{font-family:sans-serif;font-size:13px;max-width:900px;margin:20px auto;}' +
        'h1{font-size:20px;margin-bottom:4px;}' +
        '.meta{color:#888;font-size:12px;margin-bottom:20px;display:flex;justify-content:space-between;}' +
        'table{width:100%;border-collapse:collapse;}' +
        'th{padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #333;background:#f9fafb;}' +
        'th:last-child{text-align:right;}' +
        '@media print{body{margin:10px;max-width:none;}@page{margin:10mm;size:A4;}}' +
        '</style></head><body>');
    win.document.write('<h1>📦 Stock Count Sheet — ' + (window.getCurrentVenue ? window.getCurrentVenue().name : 'Bar Wa Izakaya') + '</h1>');
    win.document.write('<div class="meta"><span>Grouped by: '+( groupBy==='zone'?'Zone':'Category')+'</span><span>Date: _____________ &nbsp;&nbsp; Staff: _____________</span></div>');
    win.document.write('<table><thead><tr><th>Item</th><th>Unit</th><th>PAR</th><th style="text-align:right;">Count</th></tr></thead><tbody>'+tableHtml+'</tbody></table>');
    win.document.write('<div style="margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">'+items.length+' items · ' + (window.getCurrentVenue ? window.getCurrentVenue().name : 'Bar Wa Izakaya') + ' · Hobart Hub</div>');
    win.document.write('<script>window.onload=()=>{window.print();}<\/script></body></html>');
    win.document.close();
    window.closeModal();
};



// =============================================================================
// QUICK STOCK COUNT — Digital count entry, grouped by zone
// =============================================================================
window.renderQuickStockCount = () => {
    const items = (window.inventoryItems||[]).filter(i => !i.archived);
    if (items.length === 0) {
        return '<div style="max-width:900px;margin:auto;"><div class="card" style="text-align:center;padding:40px;"><h3 style="color:var(--text-muted);">No inventory items yet.</h3><button onclick="window.showView(\'inventory\')" class="btn btn-blue" style="margin-top:10px;">Go to Inventory</button></div></div>';
    }
    const isWeekend = [0,5,6].includes(new Date().getDay());
    const venueName = window.getCurrentVenue ? window.getCurrentVenue().name : 'Bar Wa Izakaya';
    
    // Group by zone (walking order)
    const grouped = {};
    items.forEach(item => {
        const zone = item.location || 'Unassigned Zone';
        if (!grouped[zone]) grouped[zone] = [];
        grouped[zone].push(item);
    });
    
    // Sort zones: BOH first, then FOH, then other
    const zoneOrder = (window.storageZones || []).map(z => z.name);
    const sortedZones = Object.keys(grouped).sort((a, b) => {
        const ai = zoneOrder.indexOf(a);
        const bi = zoneOrder.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
    
    let tabIdx = 0;
    const zonesHtml = sortedZones.map(zone => {
        const zoneItems = grouped[zone].sort((a,b) => a.name.localeCompare(b.name));
        const rows = zoneItems.map(item => {
            const par = isWeekend ? (item.parWeekend||item.par||0) : (item.parWeekday||item.par||0);
            const stock = Number(item.stock) || 0;
            const statusColor = stock < par ? 'var(--red)' : 'var(--green)';
            tabIdx++;
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:10px 12px;"><strong style="font-size:14px;">' + esc(item.name) + '</strong>' +
                '<br><small style="color:var(--text-muted);">' + esc(item.buyUnit||'unit') + ' · ' + (par > 0 ? 'PAR: ' + par : '<span style="color:var(--orange);">No PAR set</span>') + '</small></td>' +
                '<td style="padding:10px;text-align:center;"><span style="color:' + statusColor + ';font-weight:bold;font-size:14px;">' + stock.toFixed(1) + '</span></td>' +
                '<td style="padding:8px;width:120px;"><input type="number" step="0.1" min="0" tabindex="' + tabIdx + '" ' +
                    'id="sc-' + item.id + '" ' +
                    'class="stock-count-input" ' +
                    'placeholder="—" ' +
                    'data-original="' + stock + '" ' +
                    'oninput="this.classList.toggle(\\\'changed\\\', this.value !== \\\'\\\' && parseFloat(this.value) !== ' + stock + ')" ' +
                    'onkeydown="if(event.key===\\\'Enter\\\'){event.preventDefault();var inputs=document.querySelectorAll(\\\'.stock-count-input\\\');var arr=Array.from(inputs);var cur=arr.indexOf(this);if(arr[cur+1])arr[cur+1].focus();}">' +
                '</td>' +
            '</tr>';
        }).join('');
        
        return '<div class="card" style="padding:0;overflow:hidden;margin-bottom:15px;">' +
            '<div style="padding:10px 12px;background:#111;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
                '<strong style="color:var(--brand-dark);">' + esc(zone) + '</strong>' +
                '<span style="font-size:12px;color:var(--text-muted);">' + zoneItems.length + ' items</span>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;background:#0a0a0c;">' +
                '<th style="padding:8px 12px;text-align:left;">Item</th>' +
                '<th style="padding:8px;text-align:center;">Current</th>' +
                '<th style="padding:8px;text-align:center;">New Count</th>' +
                '</tr></thead><tbody>' + rows + '</tbody>' +
            '</table>' +
        '</div>';
    }).join('');
    
    return '<div style="max-width:900px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">Quick Stock Count</h2>' +
            '<small style="color:var(--text-muted);">' + venueName + ' · ' + new Date().toLocaleDateString('en-AU',{weekday:"long",day:"numeric",month:"long"}) + ' · ' + (isWeekend?'Weekend':'Weekday') + ' PARs</small></div>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="window.openStockCountSheet()" class="btn btn-outline" style="font-size:12px;">🖨️ Print Blank</button>' +
                '<button onclick="window.showView(\'inventory\')" class="btn btn-outline" style="font-size:12px;">← Inventory</button>' +
            '</div>' +
        '</div>' +
        '<div class="card" style="border-left:4px solid var(--blue);padding:12px 18px;margin-bottom:20px;">' +
            '<p style="margin:0;font-size:13px;color:var(--text-muted);">Tab through each item and enter the count. Only filled fields will update. Empty fields are skipped.</p>' +
        '</div>' +
        '<input type="text" class="search-bar" placeholder="🔍 Filter items..." oninput="window._filterStockCount(this.value)" style="margin-bottom:15px;">' +
        zonesHtml +
        '<div class="sticky-footer" style="justify-content:space-between;">' +
            '<span id="sc-changed-count" style="font-size:13px;color:var(--text-muted);">0 items changed</span>' +
            '<div style="display:flex;gap:10px;">' +
                '<button onclick="window.saveQuickStockCount()" class="btn btn-green" style="font-size:16px;padding:12px 30px;">💾 Save All Counts</button>' +
            '</div>' +
        '</div>' +
    '</div>';
};

window._filterStockCount = (query) => {
    const q = query.toLowerCase();
    document.querySelectorAll('.stock-count-input').forEach(input => {
        const row = input.closest('tr');
        if (!row) return;
        const name = row.querySelector('strong') ? row.querySelector('strong').textContent.toLowerCase() : '';
        row.style.display = !q || name.includes(q) ? '' : 'none';
    });
};

window.saveQuickStockCount = () => {
    let updated = 0;
    const timestamp = new Date().toISOString();
    (window.inventoryItems || []).filter(i => !i.archived).forEach(item => {
        const input = document.getElementById('sc-' + item.id);
        if (!input || input.value === '') return;
        const newVal = parseFloat(input.value);
        if (isNaN(newVal)) return;
        if (newVal !== Number(item.stock)) {
            // Record in price history as stock count event
            if (!window.priceHistory[item.id]) window.priceHistory[item.id] = [];
            window.priceHistory[item.id].push({ type:'count', date: timestamp, oldStock: item.stock, newStock: newVal });
            item.stock = newVal;
            updated++;
        }
    });
    if (updated === 0) return window.showToast('No changes to save.', 'error');
    window.saveToDisk();
    window.showToast(updated + ' stock levels updated!');
    window.showView('stock-count');
};

window.renderParEditor = () => {
    const items = (window.inventoryItems || []).filter(i => !i.archived);
    const cats = [...new Set(items.map(i => i.category || 'Uncategorised'))].sort();
    const isWeekend = [0, 5, 6].includes(new Date().getDay());

    if (items.length === 0) {
        return '<div style="max-width:900px;margin:auto;"><div class="card" style="text-align:center;padding:40px;"><h3 style="color:var(--text-muted);">No inventory items yet.</h3><button onclick="window.showView(\'inventory\')" class="btn btn-blue" style="margin-top:10px;">← Back to Inventory</button></div></div>';
    }

    const groupsHtml = cats.map(cat => {
        const catItems = items.filter(i => (i.category || 'Uncategorised') === cat);
        const rows = catItems.map((item, idx) => {
            const parWd = item.parWeekday || item.par || 0;
            const parWe = item.parWeekend || item.par || 0;
            const stock = Number(item.stock) || 0;
            const parTarget = isWeekend ? parWe : parWd;
            const stockColor = stock < parTarget ? 'var(--red)' : 'var(--green)';
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:7px 10px;"><strong style="font-size:12px;">' + esc(item.name) + '</strong>' +
                '<br><small style="color:var(--text-muted);">' + esc(item.supplier || 'No supplier') + ' · ' + esc(item.buyUnit || 'unit') + '</small></td>' +
                '<td style="padding:7px 10px;text-align:center;"><span style="color:' + stockColor + ';font-weight:bold;">' + stock.toFixed(1) + '</span></td>' +
                '<td style="padding:6px;"><input type="number" step="0.5" min="0" ' +
                'id="par-wd-' + item.id + '" ' +
                'value="' + parWd + '" ' +
                'class="input-box" style="margin:0;padding:5px 6px;text-align:center;width:70px;font-size:13px;"></td>' +
                '<td style="padding:6px;"><input type="number" step="0.5" min="0" ' +
                'id="par-we-' + item.id + '" ' +
                'value="' + parWe + '" ' +
                'class="input-box" style="margin:0;padding:5px 6px;text-align:center;width:70px;font-size:13px;"></td>' +
            '</tr>';
        }).join('');

        return '<details class="card" style="padding:0;overflow:hidden;margin-bottom:8px;" open>' +
            '<summary style="padding:8px 14px;background:#111;cursor:pointer;font-weight:bold;color:var(--brand-dark);display:flex;justify-content:space-between;align-items:center;outline:none;border-radius:10px 10px 0 0;font-size:14px;">' +
                '<span>' + esc(cat) + ' <span style="color:var(--text-muted);font-size:11px;font-weight:normal;">(' + catItems.length + ')</span></span>' +
                '<span style="color:var(--blue);font-size:11px;">▼</span>' +
            '</summary>' +
            '<div style="overflow-x:auto;">' +
                '<table style="width:100%;border-collapse:collapse;">' +
                    '<thead><tr style="background:#0a0a0c;font-size:10px;color:var(--text-muted);text-transform:uppercase;">' +
                        '<th style="padding:6px 10px;text-align:left;">Item</th>' +
                        '<th style="padding:6px 10px;text-align:center;">Stock</th>' +
                        '<th style="padding:6px 10px;text-align:center;color:var(--blue);">Weekday PAR</th>' +
                        '<th style="padding:6px 10px;text-align:center;color:var(--orange);">Weekend PAR</th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>' +
        '</details>';
    }).join('');

    return '<div style="max-width:1100px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">PAR Level Editor</h2>' +
            '<small style="color:var(--text-muted);">Set weekday and weekend PAR levels for all items. Tab between fields. Save all when done.</small></div>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="window.saveAllPars()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All PARs</button>' +
                '<button onclick="window.showView(\'inventory\')" class="btn btn-outline">← Inventory</button>' +
            '</div>' +
        '</div>' +
        '<div class="card" style="padding:12px 18px;margin-bottom:20px;border-left:4px solid var(--blue);font-size:13px;">' +
            '<strong style="color:var(--blue);">💡 Tips:</strong> ' +
            'Tab moves to Weekend PAR. Enter/Tab from Weekend moves to next item\'s Weekday PAR. ' +
            'Today is targeting <strong style="color:' + (isWeekend ? 'var(--orange)' : 'var(--blue)') + ';">' + (isWeekend ? 'WEEKEND' : 'WEEKDAY') + '</strong> PARs — stock in red is currently below target.' +
        '</div>' +
        groupsHtml +
        '<div style="position:sticky;bottom:20px;z-index:100;background:var(--card-bg);border:1px solid var(--green);border-radius:12px;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,0.5);margin-top:15px;">' +
            '<span style="color:var(--text-muted);font-size:13px;">' + items.length + ' items across ' + cats.length + ' categories</span>' +
            '<button onclick="window.saveAllPars()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All PARs</button>' +
        '</div>' +
    '</div>';
};

window.saveAllPars = () => {
    let count = 0;
    (window.inventoryItems || []).filter(i => !i.archived).forEach(item => {
        const wdEl = document.getElementById('par-wd-' + item.id);
        const weEl = document.getElementById('par-we-' + item.id);
        if (wdEl && weEl) {
            const wd = parseFloat(wdEl.value) || 0;
            const we = parseFloat(weEl.value) || 0;
            item.parWeekday = wd;
            item.parWeekend = we;
            item.par = wd; // keep legacy par field in sync
            count++;
        }
    });
    window.saveToDisk();
    window.showToast(count + ' PAR levels saved!');
    window.showView('inventory');
};

window.archiveInv = (id) => {
    let item = window.inventoryItems.find(i => i.id === id);
    if (item) { item.archived = !item.archived; window.saveToDisk(); window.showToast(item.archived ? 'Item Archived' : 'Item Restored'); window.showView('inventory'); }
};

window.viewPriceTrend = (id) => {
    const cleanId = String(id).trim();
    const item = window.inventoryItems.find(i => i.id === cleanId);
    if (!item) { console.warn('viewPriceTrend: no item for id:', cleanId); return window.showToast('Item not found.', 'error'); }
    const history = item.history || [];
    let historyHtml = history.length === 0
        ? '<p style="padding:20px; color:var(--text-muted);">No history found. History is built automatically when invoices are processed through Invoice Ripper.</p>'
        : `<table style="width:100%; border-collapse:collapse;">
            <tr style="text-align:left; color:var(--text-muted); font-size:11px; border-bottom:1px solid var(--border);">
                <th style="padding:10px;">Date</th><th style="padding:10px;">Supplier</th><th style="padding:10px;">Qty</th><th style="padding:10px;">Unit Price</th><th style="padding:10px;">Change</th>
            </tr>
            ${history.slice().reverse().map((h, idx, arr) => {
                const prev = arr[idx + 1];
                const change = prev ? (((h.price - prev.price) / prev.price) * 100).toFixed(1) : null;
                const changeHtml = change !== null
                    ? `<span style="color:${change > 0 ? 'var(--red)' : 'var(--green)'}; font-weight:bold;">${change > 0 ? '▲' : '▼'} ${Math.abs(change)}%</span>`
                    : '<span style="color:var(--text-muted);">—</span>';
                return `<tr style="border-bottom:1px solid var(--border); font-size:12px;">
                    <td style="padding:10px;">${esc(h.date)}</td>
                    <td style="padding:10px;">${esc(h.supplier)}</td>
                    <td style="padding:10px;">${h.qty}</td>
                    <td style="padding:10px; font-weight:bold; color:var(--brand-accent);">$${Number(h.price).toFixed(2)}</td>
                    <td style="padding:10px;">${changeHtml}</td>
                </tr>`;
            }).join('')}
        </table>`;
    window.openModal(`📈 Price Trend: ${esc(item.name)}`, `<div style="max-height:400px; overflow-y:auto;">${historyHtml}</div><button onclick="window.closeModal()" class="btn btn-dark" style="width:100%; margin-top:20px;">Close</button>`);
};

// =============================================================================
// 4. RECIPE ENGINE — PHASE 2
// Bulk HTML importer, photo/video, print, scale, station tags, status,
// Margin Health view, 67% GP threshold
// =============================================================================

const GP_TARGET = 67;

window.recFilters = window.recFilters || { search: '', filter: 'All', station: 'All', status: 'Active' };
// -----------------------------------------------------------------------
// SEARCH REFRESH HELPERS — update list only, no full page re-render
// Fixes the "click per letter" bug in search bars
// -----------------------------------------------------------------------
window._debouncedInvRefresh = window.debounce ? window.debounce(() => window._refreshInvList(), 250) : () => window._refreshInvList();
window._refreshInvList = () => {
    const container = document.getElementById('inv-list-container');
    if (!container) { window.showView('inventory'); return; }
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    let filtered = (window.inventoryItems || []).filter(item => {
        let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
        if (window.invFilters.filter === 'Active' && item.archived) return false;
        if (window.invFilters.filter === 'Archived' && !item.archived) return false;
        if (window.invFilters.filter === 'Low Stock' && (item.archived || item.stock >= parTarget)) return false;
        if (window.invFilters.groupBy !== 'All' && item.category !== window.invFilters.groupBy && window.invFilters.groupBy !== 'Category') {
            if (item.location !== window.invFilters.groupBy) return false;
        }
        if (window.invFilters.search) {
            const s = window.invFilters.search.toLowerCase();
            return (item.name && item.name.toLowerCase().includes(s)) ||
                   (item.sku && item.sku.toLowerCase().includes(s)) ||
                   (item.supplier && item.supplier.toLowerCase().includes(s));
        }
        return true;
    });
    // Re-render just the table body rows
    container.innerHTML = window._buildInvRows(filtered, isWeekend);
    // Re-attach bulk select
    window._invSelected = window._invSelected || new Set();
};

window._refreshRecList = () => {
    const container = document.getElementById('rec-list-container');
    if (!container) { window.showView('recipes'); return; }
    let filtered = (window.recipes || []).filter(r => {
        if (window.recFilters.status !== 'All' && (r.status || 'Active') !== window.recFilters.status) return false;
        if (window.recFilters.filter === 'Menu' && r.type !== 'Menu') return false;
        if (window.recFilters.filter === 'Batch' && r.type !== 'Batch') return false;
        if (window.recFilters.station !== 'All' && (r.station || 'Kitchen') !== window.recFilters.station) return false;
        if (window.recFilters.search) {
            const s = window.recFilters.search.toLowerCase();
            return r.name.toLowerCase().includes(s) || (r.posAlias && r.posAlias.toLowerCase().includes(s));
        }
        return true;
    });
    container.innerHTML = window._buildRecCards(filtered);
};


window.tempIngs = [];
window.tempRecipeId = null;

window._courseToType = (course) => {
    if (!course) return 'Menu';
    const c = course.toLowerCase();
    if (c.includes('prep') || c.includes('batch')) return 'Batch';
    return 'Menu';
};
window._courseToStation = (course) => {
    if (!course) return 'Kitchen';
    const c = course.toLowerCase();
    if (c.includes('cocktail') || c.includes('mocktail') || c.includes('bar') || c.includes('batched')) return 'Bar';
    if (c.includes('prep') || c.includes('preparation')) return 'Prep';
    return 'Kitchen';
};

window.renderRecipeView = () => {
    const stationColor = { 'Kitchen': 'var(--orange)', 'Bar': 'var(--blue)', 'Prep': 'var(--purple)' };
    let filtered = (window.recipes || []).filter(r => {
        if (window.recFilters.status !== 'All' && (r.status || 'Active') !== window.recFilters.status) return false;
        if (window.recFilters.filter === 'Menu' && r.type !== 'Menu') return false;
        if (window.recFilters.filter === 'Batch' && r.type !== 'Batch') return false;
        if (window.recFilters.station !== 'All' && (r.station || 'Kitchen') !== window.recFilters.station) return false;
        if (window.recFilters.search) {
            const s = window.recFilters.search.toLowerCase();
            return r.name.toLowerCase().includes(s) || (r.posAlias && r.posAlias.toLowerCase().includes(s));
        }
        return true;
    });
    const typePills = ['All','Menu','Batch'].map(c => `<div class="tag-pill ${window.recFilters.filter===c?'active':''}" onclick="window.recFilters.filter='${c}';window.showView(\'recipes\')">${c}</div>`).join('');
    const stationPills = ['All','Kitchen','Bar','Prep'].map(s => `<div class="tag-pill ${window.recFilters.station===s?'active':''}" onclick="window.recFilters.station='${s}';window.showView(\'recipes\')">${s}</div>`).join('');
    const statusPills = ['Active',"86'd",'Development'].map(s => `<div class="tag-pill ${window.recFilters.status===s?'active':''}" onclick="window.recFilters.status='${s}';window.showView(\'recipes\')">${s}</div>`).join('');
    return `
    <div style="max-width:1200px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <div><h2 style="margin:0">⚖️ Recipe Engine <span style="font-size:14px;color:var(--text-muted);font-weight:normal;">(${filtered.length} shown)</span></h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Create and manage recipes to track food costs and GP%</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="window.showView('sell-price-editor')" class="btn btn-outline" style="border-color:var(--green);color:var(--green);font-size:12px;">💰 Sell Prices</button>
                <button onclick="window.showView('bulk-category-editor')" class="btn btn-outline" style="border-color:var(--blue);color:var(--blue);font-size:12px;">🏷️ Categories</button>
                <button onclick="window.showView('pos-alias-editor')" class="btn btn-outline" style="border-color:var(--orange);color:var(--orange);font-size:12px;">🔗 POS Aliases</button>
                <button onclick="window.openCostingReport()" class="btn btn-outline" style="border-color:var(--purple);color:var(--purple);font-size:12px;">📊 Costing Report</button>
                <button onclick="window.exportRecipeBook()" class="btn btn-outline" style="font-size:12px;">📖 Recipe Book</button>
                <button onclick="window.showView('batch-linker')" class="btn btn-outline" style="font-size:12px;">🔗 Link Ingredients</button>
                <button onclick="window.openBulkHtmlImport()" class="btn btn-purple">📥 Bulk Import</button>
                <button onclick="window.editRecipeForm()" class="btn btn-blue">+ New Recipe</button>
            </div>
        </div>
        <input type="text" class="search-bar" id="rec-search-box" placeholder="🔍 Search recipes or POS alias..." value="${window.recFilters.search}" oninput="window.recFilters.search=this.value; window._refreshRecList()">
        <div style="display:flex;gap:20px;margin-bottom:15px;flex-wrap:wrap;">
            <div><small style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</small><div style="margin-top:5px;">${typePills}</div></div>
            <div><small style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Station</small><div style="margin-top:5px;">${stationPills}</div></div>
            <div><small style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Status</small><div style="margin-top:5px;">${statusPills}</div></div>
        </div>
        <div id="rec-list-container" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;">
            ${filtered.length===0?'<div style="text-align:center;padding:48px 20px;color:var(--text-muted);grid-column:1/-1;"><div style="font-size:36px;margin-bottom:12px">⚖️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No recipes yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Create your first recipe to start tracking food costs and GP%</div></div>':filtered.map(r=>{
                const gpColor=r.gp>=GP_TARGET?'var(--green)':r.gp>0?'var(--red)':'var(--text-muted)';
                const station=r.station||'Kitchen';
                const status=r.status||'Active';
                const statusColor=status==='Active'?'var(--green)':status==="86'd"?'var(--red)':'var(--orange)';
                return `<div class="card" style="border-top:4px solid ${stationColor[station]||'var(--border)'};cursor:pointer;transition:transform 0.15s;padding:12px;" onclick="window.viewRecipe('${r.id}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    ${r.photo?`<img src="${r.photo}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;">`:''}
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                        <h4 style="margin:0;font-size:14px;flex:1;padding-right:6px;line-height:1.3;">${esc(r.name)}</h4>
                        <span style="font-size:10px;color:${statusColor};border:1px solid ${statusColor};padding:2px 5px;border-radius:8px;white-space:nowrap;">${status}</span>
                    </div>
                    <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
                        <span style="font-size:11px;color:${stationColor[station]};border:1px solid ${stationColor[station]};padding:2px 7px;border-radius:8px;">${station}</span>
                        <span style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);padding:2px 7px;border-radius:8px;">${r.type}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;background:var(--bg-main);padding:6px 8px;border-radius:5px;font-size:11px;border:1px solid var(--border);">
                        <div style="color:var(--text-muted);">Cost:<strong style="color:var(--brand-accent);"> $${Number(r.cost||0).toFixed(2)}</strong><br>${r.type==='Menu'?`Sell: $${Number(r.price||0).toFixed(2)}`:`Yield: ${r.yieldQty} ${esc(r.yieldUnit)}`}</div>
                        ${r.type==='Menu'&&r.price>0?`<div style="font-size:20px;font-weight:bold;color:${gpColor};align-self:center;">${r.gp||0}%</div>`:''}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">📋 ${(r.ingredients||[]).filter(i=>i.type==='inv'||i.type==='batch').length} linked · ${(r.ingredients||[]).filter(i=>i.type==='raw').length} raw</div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
};

window.viewRecipe = (id) => {
    const E = window.esc;
    const r = window.recipes.find(x => x.id === id);
    if (!r) return;
    const stationColor = {'Kitchen':'var(--orange)','Bar':'var(--blue)','Prep':'var(--purple)'};
    const station = r.station||'Kitchen';
    const gpColor = r.gp>=GP_TARGET?'var(--green)':r.gp>0?'var(--red)':'var(--text-muted)';

    // Ingredients table
    const ingRows = (r.ingredients||[]).map(ing => {
        const inv = ing.type==='inv'?window.inventoryItems.find(i=>i.id===ing.ref):null;
        const batch = ing.type==='batch'?window.recipes.find(x=>x.id===ing.ref):null;
        const name = inv?E(inv.name):batch?E(batch.name):E(ing.name||'Unknown');
        const qty = ing.qty||'';
        const unit = inv?(inv.useUnit||''):batch?(batch.yieldUnit||''):'';
        const cost = inv?(ing.qty*((inv.price||0)/(inv.yield||1))).toFixed(2):batch?(ing.qty*((batch.cost||0)/(batch.yieldQty||1))).toFixed(2):'—';
        const source = ing.type==='inv'?'Inventory':ing.type==='batch'?'Batch':'<span style="color:var(--orange);">Unlinked</span>';
        return `<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px 12px;font-size:13px;">${name}</td><td style="padding:8px 12px;font-size:13px;text-align:center;">${qty}</td><td style="padding:8px 12px;font-size:13px;text-align:center;">${E(unit)}</td><td style="padding:8px 12px;font-size:13px;text-align:right;">$${cost}</td><td style="padding:8px 12px;font-size:11px;color:var(--text-muted);">${source}</td></tr>`;
    }).join('');

    const ingTable = (r.ingredients||[]).length > 0
        ? `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;background:var(--bg-main);border-radius:8px;"><thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:8px 12px;text-align:left;">Ingredient</th><th style="padding:8px 12px;text-align:center;">Qty</th><th style="padding:8px 12px;text-align:center;">Unit</th><th style="padding:8px 12px;text-align:right;">Cost</th><th style="padding:8px 12px;text-align:left;">Source</th></tr></thead><tbody>${ingRows}</tbody></table></div>`
        : '<p style="color:var(--text-muted);font-size:13px;">No ingredients yet.</p>';

    // Allergen pills
    const allergenColors = {GF:'var(--green)',VG:'var(--green)',VE:'var(--green)',DF:'var(--blue)',NF:'var(--orange)'};
    const allergenHtml = (r.allergens&&r.allergens.length>0)
        ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${r.allergens.map(a => `<span style="font-size:12px;padding:4px 12px;border-radius:12px;background:${allergenColors[a]||'var(--red)'};color:#fff;font-weight:600;">${E(a)}</span>`).join('')}</div>`
        : '<span style="color:var(--text-muted);font-size:13px;">No allergens flagged</span>';

    // Media section
    let mediaHtml = '';
    if (r.photo && r.videoUrl) {
        mediaHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;"><img src="${r.photo}" style="width:100%;max-height:250px;object-fit:cover;border-radius:8px;"><div style="position:relative;padding-bottom:56.25%;height:0;border-radius:8px;overflow:hidden;"><iframe src="${r.videoUrl.replace('watch?v=','embed/').replace('youtu.be/','youtube.com/embed/')}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div></div>`;
    } else if (r.photo) {
        mediaHtml = `<img src="${r.photo}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:20px;">`;
    } else if (r.videoUrl) {
        mediaHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:8px;overflow:hidden;margin-bottom:20px;"><iframe src="${r.videoUrl.replace('watch?v=','embed/').replace('youtu.be/','youtube.com/embed/')}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>`;
    }

    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:900px;margin:auto;">
        <!-- HEADER -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
            <div>
                <button onclick="window.showView('recipes')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;margin-bottom:6px;">← Back to Recipes</button>
                <h2 style="margin:0 0 8px 0;font-size:22px;">${E(r.name)}</h2>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <span style="font-size:12px;color:${stationColor[station]};border:1px solid ${stationColor[station]};padding:3px 10px;border-radius:12px;">${E(station)}</span>
                    <span style="font-size:12px;color:var(--text-muted);border:1px solid var(--border);padding:3px 10px;border-radius:12px;">${r.type}</span>
                    ${r.category?`<span style="font-size:12px;color:var(--text-muted);border:1px solid var(--border);padding:3px 10px;border-radius:12px;">${E(r.category)}</span>`:''}
                    ${r.type==='Menu'&&r.gp?`<span style="font-size:12px;font-weight:bold;color:#fff;background:${gpColor};padding:3px 10px;border-radius:12px;">${r.gp}% GP</span>`:''}
                </div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="window.duplicateRecipe('${r.id}')" class="btn btn-outline" style="font-size:12px;">📋 Duplicate</button>
                <button onclick="window.printRecipe('${r.id}')" class="btn btn-outline" style="font-size:12px;">🖨️ Print</button>
                <button onclick="window.editRecipeForm('${r.id}')" class="btn btn-blue" style="font-size:12px;">✏️ Edit</button>
            </div>
        </div>

        <!-- MEDIA -->
        ${mediaHtml}

        <!-- INGREDIENTS -->
        <div class="card" style="padding:18px;margin-bottom:15px;">
            <h3 style="margin:0 0 12px 0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Ingredients</h3>
            ${ingTable}
        </div>

        <!-- METHOD -->
        <div class="card" style="padding:18px;margin-bottom:15px;">
            <h3 style="margin:0 0 12px 0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Method</h3>
            <div style="font-size:14px;line-height:1.8;white-space:pre-wrap;">${r.method ? E(r.method) : '<span style="color:var(--text-muted);">No method written yet.</span>'}</div>
        </div>

        <!-- ALLERGENS -->
        <div class="card" style="padding:18px;margin-bottom:15px;">
            <h3 style="margin:0 0 12px 0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Allergens & Dietary</h3>
            ${allergenHtml}
        </div>

        <!-- COSTING FOOTER -->
        ${r.type==='Menu'?`<div class="card" style="padding:18px;border-top:4px solid ${gpColor};display:flex;justify-content:space-around;text-align:center;flex-wrap:wrap;gap:15px;">
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Food Cost</div><div style="font-size:20px;font-weight:bold;">$${Number(r.cost||0).toFixed(2)}</div></div>
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Sell Price</div><div style="font-size:20px;font-weight:bold;">$${Number(r.price||0).toFixed(2)}</div></div>
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Gross Profit</div><div style="font-size:20px;font-weight:bold;color:${gpColor};">${r.gp||0}%</div></div>
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Status</div><div style="font-size:14px;font-weight:bold;color:${gpColor};">${(r.gp||0)>=GP_TARGET?'✅ Healthy':'⚠️ Below Target'}</div></div>
        </div>`:''}
        ${r.type==='Batch'?`<div class="card" style="padding:18px;border-top:4px solid var(--purple);display:flex;justify-content:space-around;text-align:center;flex-wrap:wrap;gap:15px;">
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Batch Cost</div><div style="font-size:20px;font-weight:bold;">$${Number(r.cost||0).toFixed(2)}</div></div>
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Yield</div><div style="font-size:20px;font-weight:bold;">${r.yieldQty||0} ${E(r.yieldUnit||'')}</div></div>
            <div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Cost per Unit</div><div style="font-size:20px;font-weight:bold;">$${(r.yieldQty>0?(r.cost/r.yieldQty):0).toFixed(4)}</div></div>
        </div>`:''}
    </div>`;
};


// =============================================================================
// BATCH RECIPE COST CASCADE
// =============================================================================
window.cascadeRecipeCosts = (changedInvIds) => {
    if (!changedInvIds || changedInvIds.length === 0) return { updatedBatches:0, updatedMenus:0, gpAlerts:[] };
    let updatedBatches = 0, updatedMenus = 0;
    const batchRecipes = (window.recipes || []).filter(r => r.type === 'Batch' && !r.archived);
    batchRecipes.forEach(batch => {
        if ((batch.ingredients||[]).some(ing => ing.type==='inv' && changedInvIds.includes(ing.ref))) {
            let cost = 0;
            (batch.ingredients||[]).forEach(ing => { if (ing.type==='inv') { const inv=(window.inventoryItems||[]).find(i=>i.id===ing.ref); if(inv) cost+=ing.qty*((inv.price||0)/(inv.yield||1)); }});
            batch.cost = cost; updatedBatches++;
        }
    });
    const updatedBatchIds = batchRecipes.filter(b => (b.ingredients||[]).some(ing=>ing.type==='inv'&&changedInvIds.includes(ing.ref))).map(b=>b.id);
    const gpAlerts = [];
    (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived).forEach(menu => {
        if ((menu.ingredients||[]).some(ing=>(ing.type==='inv'&&changedInvIds.includes(ing.ref))||(ing.type==='batch'&&updatedBatchIds.includes(ing.ref)))) {
            let cost = 0;
            (menu.ingredients||[]).forEach(ing => {
                if (ing.type==='inv'){const inv=(window.inventoryItems||[]).find(i=>i.id===ing.ref);if(inv)cost+=ing.qty*((inv.price||0)/(inv.yield||1));}
                else if (ing.type==='batch'){const b=(window.recipes||[]).find(x=>x.id===ing.ref);if(b)cost+=ing.qty*((b.cost||0)/(b.yieldQty||1));}
            });
            menu.cost=cost; menu.gp=menu.price>0?parseFloat(((menu.price-cost)/menu.price*100).toFixed(1)):0;
            if (menu.price>0 && menu.gp<GP_TARGET) gpAlerts.push({name:menu.name,gp:menu.gp,cost:cost.toFixed(2)});
            updatedMenus++;
        }
    });
    if (updatedBatches>0||updatedMenus>0) window.saveToDisk();
    return { updatedBatches, updatedMenus, gpAlerts };
};

// =============================================================================
// SELL PRICE BULK EDITOR
// =============================================================================
window.renderSellPriceEditor = () => {
    const recipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived);
    const stations = [...new Set(recipes.map(r=>r.station||'Kitchen'))].sort();
    if (recipes.length===0) return '<div style="max-width:900px;margin:auto;">' + window._marginsTabBar('sell-price-editor') + '<div class="card" style="text-align:center;padding:40px;"><h3 style="color:var(--text-muted);">No menu recipes yet.</h3><button onclick="window.showView(\'recipes\')" class="btn btn-blue" style="margin-top:10px;">← Back</button></div></div>';
    const sc = {Kitchen:'var(--orange)',Bar:'var(--blue)',Prep:'var(--purple)'};
    const groups = stations.map(station => {
        const sr = recipes.filter(r=>(r.station||'Kitchen')===station);
        const rows = sr.map(r => {
            const cost=Number(r.cost||0), price=Number(r.price||0);
            const gp=price>0?((price-cost)/price*100).toFixed(1):0;
            const gpColor=gp>=GP_TARGET?'var(--green)':gp>0?'var(--red)':'var(--text-muted)';
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:10px 12px;"><strong style="font-size:13px;">' + esc(r.name) + '</strong>' + (r.posAlias?'<br><small style="color:var(--text-muted);">'+esc(r.posAlias)+'</small>':'') + '</td>' +
                '<td style="padding:10px 12px;color:var(--brand-accent);font-size:13px;">$' + cost.toFixed(2) + '</td>' +
                '<td style="padding:10px 8px;"><div style="display:flex;align-items:center;gap:6px;"><span style="color:var(--text-muted);">$</span>' +
                '<input type="number" step="0.50" min="0" id="sp-' + r.id + '" value="' + price.toFixed(2) + '" class="input-box" style="margin:0;padding:6px 8px;width:90px;" data-id="' + r.id + '" data-cost="' + cost.toFixed(4) + '" oninput="window._updateSpGp(this.dataset.id,this.dataset.cost,this.value)"></div></td>' +
                '<td style="padding:10px 12px;"><strong id="gp-' + r.id + '" style="font-size:16px;color:' + gpColor + ';">' + gp + '%</strong></td>' +
            '</tr>';
        }).join('');
        return '<details class="card" style="padding:0;overflow:hidden;margin-bottom:12px;" open>' +
            '<summary style="padding:12px 18px;background:#111;cursor:pointer;font-weight:bold;color:' + (sc[station]||'var(--text-muted)') + ';display:flex;justify-content:space-between;align-items:center;outline:none;border-radius:10px 10px 0 0;">' +
            station + ' <span style="color:var(--text-muted);font-size:12px;font-weight:normal;">(' + sr.length + ')</span><span style="color:var(--blue);font-size:12px;">▼</span></summary>' +
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:#0a0a0c;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
            '<th style="padding:10px 12px;text-align:left;">Recipe</th><th style="padding:10px 12px;text-align:left;">Cost</th><th style="padding:10px 12px;text-align:left;color:var(--green);">Sell Price</th><th style="padding:10px 12px;text-align:left;">GP%</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table></div></details>';
    }).join('');
    return '<div style="max-width:1100px;margin:auto;">' +
        window._marginsTabBar('sell-price-editor') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
        '<div><h2 style="margin:0;">💰 Sell Price Editor</h2><small style="color:var(--text-muted);">Set sell prices for all menu recipes. GP% updates live. Target: ' + GP_TARGET + '%.</small></div>' +
        '<div style="display:flex;gap:8px;"><button onclick="window.saveAllSellPrices()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All</button></div></div>' +
        groups +
        '<div style="position:sticky;bottom:20px;z-index:100;background:var(--card-bg);border:1px solid var(--green);border-radius:12px;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,0.5);margin-top:15px;">' +
        '<span style="color:var(--text-muted);font-size:13px;">' + recipes.length + ' menu recipes</span>' +
        '<button onclick="window.saveAllSellPrices()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All</button></div></div>';
};
window._updateSpGp = (id, cost, priceVal) => {
    const price = parseFloat(priceVal)||0;
    const gp = price>0?((price-cost)/price*100).toFixed(1):0;
    const el = document.getElementById('gp-'+id);
    if (el) { el.innerText=gp+'%'; el.style.color=gp>=GP_TARGET?'var(--green)':gp>0?'var(--red)':'var(--text-muted)'; }
};
window.saveAllSellPrices = () => {
    let count=0;
    (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived).forEach(r => {
        const el=document.getElementById('sp-'+r.id);
        if (el) { r.price=parseFloat(el.value)||0; r.gp=r.price>0?parseFloat(((r.price-r.cost)/r.price*100).toFixed(1)):0; count++; }
    });
    window.saveToDisk(); window.showToast(count+' prices saved!'); window.showView('recipes');
};

// =============================================================================
// RECIPE COSTING REPORT
// =============================================================================
window.openCostingReport = () => {
    const menuRecipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived);
    menuRecipes.forEach(r => {
        let cost=0;
        (r.ingredients||[]).forEach(ing=>{
            if(ing.type==='inv'){const inv=(window.inventoryItems||[]).find(i=>i.id===ing.ref);if(inv)cost+=ing.qty*((inv.price||0)/(inv.yield||1));}
            else if(ing.type==='batch'){const b=(window.recipes||[]).find(x=>x.id===ing.ref);if(b)cost+=ing.qty*((b.cost||0)/(b.yieldQty||1));}
        });
        r.cost=cost; r.gp=r.price>0?parseFloat(((r.price-cost)/r.price*100).toFixed(1)):0;
    });
    const stations=[...new Set(menuRecipes.map(r=>r.station||'Kitchen'))].sort();
    const avgGp=menuRecipes.length>0?(menuRecipes.reduce((s,r)=>s+r.gp,0)/menuRecipes.length).toFixed(1):0;
    const below=menuRecipes.filter(r=>r.gp<GP_TARGET).length;
    const win=window.open('','_blank');
    if(!win) return window.showToast('Pop-up blocked.','error');
    let rows='';
    stations.forEach(st=>{
        const sr=menuRecipes.filter(r=>(r.station||'Kitchen')===st).sort((a,b)=>a.name.localeCompare(b.name));
        rows+='<tr><td colspan="5" style="background:#f3f4f6;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px;padding:8px 12px;color:#555;">'+esc(st)+' ('+sr.length+')</td></tr>';
        sr.forEach(r=>{
            const gc=r.gp>=GP_TARGET?'#16a34a':r.gp>0?'#dc2626':'#888';
            const raw=(r.ingredients||[]).filter(i=>i.type==='raw').length;
            rows+='<tr><td style="padding:9px 12px;">'+esc(r.name)+(r.posAlias?' <span style="color:#888;font-size:11px;">('+esc(r.posAlias)+')</span>':'')+(raw>0?' <span style="color:#f59e0b;font-size:10px;">⚠️ '+raw+' unlinked</span>':'')+'</td>'+
                '<td style="padding:9px 12px;text-align:right;">$'+Number(r.cost||0).toFixed(2)+'</td>'+
                '<td style="padding:9px 12px;text-align:right;">$'+Number(r.price||0).toFixed(2)+'</td>'+
                '<td style="padding:9px 12px;text-align:right;font-weight:bold;color:'+gc+';">'+r.gp+'%</td>'+
                '<td style="padding:9px 12px;text-align:right;"><div style="width:60px;background:#e5e7eb;border-radius:4px;height:6px;display:inline-block;"><div style="width:'+Math.min(100,Math.max(0,r.gp))+'%;background:'+gc+';height:100%;border-radius:4px;"></div></div></td></tr>';
        });
    });
    win.document.write('<!DOCTYPE html><html><head><title>Recipe Costing Report</title><style>body{font-family:sans-serif;font-size:13px;max-width:900px;margin:30px auto;}h1{font-size:22px;margin-bottom:4px;}.meta{color:#888;font-size:12px;margin-bottom:20px;}.stats{display:flex;gap:20px;margin-bottom:25px;}.stat{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;text-align:center;}.stat-val{font-size:24px;font-weight:bold;}.stat-lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;}table{width:100%;border-collapse:collapse;}th{padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#888;border-bottom:2px solid #e5e7eb;background:#f9fafb;}th:nth-child(n+2),td:nth-child(n+2){text-align:right;}tr:nth-child(even)td{background:#fafafa;}@media print{body{margin:15px;max-width:none;}}</style></head><body>');
    win.document.write('<h1>📊 Recipe Costing Report — Bar Wa Izakaya</h1><div class="meta">GP Target: '+GP_TARGET+'% · Generated '+new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})+'</div>');
    win.document.write('<div class="stats"><div class="stat"><div class="stat-val">'+menuRecipes.length+'</div><div class="stat-lbl">Recipes</div></div><div class="stat"><div class="stat-val" style="color:'+(avgGp>=GP_TARGET?'#16a34a':'#dc2626')+';">'+avgGp+'%</div><div class="stat-lbl">Avg GP</div></div><div class="stat"><div class="stat-val" style="color:#dc2626;">'+below+'</div><div class="stat-lbl">Below '+GP_TARGET+'%</div></div><div class="stat"><div class="stat-val" style="color:#16a34a;">'+(menuRecipes.length-below)+'</div><div class="stat-lbl">On Target</div></div></div>');
    win.document.write('<table><thead><tr><th>Recipe</th><th>Cost</th><th>Sell</th><th>GP%</th><th>Bar</th></tr></thead><tbody>'+rows+'</tbody></table>');
    win.document.write('<div style="margin-top:15px;font-size:11px;color:#aaa;">⚠️ = has unlinked ingredients</div>');
    win.document.write('<script>window.onload=()=>{window.print();}<\/script></body></html>');
    win.document.close();
};

// =============================================================================
// RECIPE BULK CATEGORY EDITOR
// =============================================================================
window.renderBulkCategoryEditor = () => {
    const recipes = (window.recipes||[]).filter(r=>!r.archived);
    if (recipes.length===0) return '<div style="max-width:900px;margin:auto;"><div class="card" style="text-align:center;padding:40px;"><h3 style="color:var(--text-muted);">No recipes yet.</h3></div></div>';
    const existingCats = [...new Set(recipes.map(r=>r.category||'').filter(Boolean))].sort();
    const baseCats = ['','Food','Beverage','Cocktails','Mocktails','Starters','Mains','Desserts','Snacks','Sides','Batch Prep','Sauce','Other'];
    const allCats = [...new Set([...baseCats,...existingCats])];
    const rows = recipes.map(r => {
        const opts = allCats.map(c=>'<option value="'+c+'" '+(c===(r.category||'')?'selected':'')+'>'+( c||'-- No Category --')+'</option>').join('');
        return '<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px 12px;font-size:13px;"><strong>'+esc(r.name)+'</strong><br><small style="color:var(--text-muted);">'+(r.station||'Kitchen')+' · '+(r.type||'Menu')+'</small></td><td style="padding:8px;"><select id="bcat-'+r.id+'" class="input-box" style="margin:0;padding:5px 8px;">'+opts+'</select></td></tr>';
    }).join('');
    return '<div style="max-width:900px;margin:auto;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;"><div><h2 style="margin:0;">Bulk Category Editor</h2><small style="color:var(--text-muted);">Assign categories to all recipes at once.</small></div><div style="display:flex;gap:8px;"><button onclick="window.saveAllCategories()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All</button><button onclick="window.showView(\'recipes\')" class="btn btn-outline">← Recipes</button></div></div><div class="card" style="padding:0;overflow:hidden;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:10px 12px;text-align:left;">Recipe</th><th style="padding:10px 12px;text-align:left;color:var(--blue);">Category</th></tr></thead><tbody>'+rows+'</tbody></table></div><div style="position:sticky;bottom:20px;z-index:100;background:var(--card-bg);border:1px solid var(--green);border-radius:12px;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,0.5);margin-top:15px;"><span style="color:var(--text-muted);font-size:13px;">'+recipes.length+' recipes</span><button onclick="window.saveAllCategories()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All</button></div></div>';
};
window.saveAllCategories = () => { let count=0; (window.recipes||[]).filter(r=>!r.archived).forEach(r=>{ const el=document.getElementById('bcat-'+r.id); if(el){r.category=el.value;count++;} }); window.saveToDisk(); window.showToast(count+' categories saved!'); window.showView('recipes'); };

// =============================================================================
// POS ALIAS BULK EDITOR
// =============================================================================
window.renderPosAliasEditor = () => {
    const recipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived);
    if (recipes.length===0) return '<div style="max-width:900px;margin:auto;"><div class="card" style="text-align:center;padding:40px;"><h3 style="color:var(--text-muted);">No menu recipes yet.</h3></div></div>';
    const rows = recipes.map(r =>
        '<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px 12px;font-size:13px;"><strong>'+esc(r.name)+'</strong><br><small style="color:var(--text-muted);">'+(r.station||'Kitchen')+'</small></td><td style="padding:8px;"><input type="text" id="pos-'+r.id+'" class="input-box" value="'+esc(r.posAlias||'')+'" placeholder="Exact Lightspeed name..." style="margin:0;padding:5px 8px;"></td></tr>'
    ).join('');
    return '<div style="max-width:900px;margin:auto;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;"><div><h2 style="margin:0;">POS Alias Editor</h2><small style="color:var(--text-muted);">Set Lightspeed POS names. Must match exactly for EOD depletion.</small></div><div style="display:flex;gap:8px;"><button onclick="window.saveAllPosAliases()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All</button><button onclick="window.showView(\'recipes\')" class="btn btn-outline">← Recipes</button></div></div><div class="card" style="padding:0;overflow:hidden;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:10px 12px;text-align:left;">Recipe</th><th style="padding:10px 12px;text-align:left;color:var(--blue);">Lightspeed POS Alias</th></tr></thead><tbody>'+rows+'</tbody></table></div><div style="position:sticky;bottom:20px;z-index:100;background:var(--card-bg);border:1px solid var(--green);border-radius:12px;padding:15px 20px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 8px 30px rgba(0,0,0,0.5);margin-top:15px;"><span style="color:var(--text-muted);font-size:13px;">'+recipes.length+' menu recipes</span><button onclick="window.saveAllPosAliases()" class="btn btn-green" style="font-size:15px;padding:10px 24px;">💾 Save All</button></div></div>';
};
window.saveAllPosAliases = () => { let count=0; (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived).forEach(r=>{ const el=document.getElementById('pos-'+r.id); if(el){r.posAlias=el.value.trim();count++;} }); window.saveToDisk(); window.showToast(count+' POS aliases saved!'); window.showView('recipes'); };


window.printRecipe = (id) => {
    const r = window.recipes.find(x => x.id === id);
    if (!r) return;
    let ingText = (r.ingredients||[]).map(ing => {
        if (ing.type==='raw') return `<li>${esc(ing.name)}</li>`;
        const inv = ing.type==='inv'?window.inventoryItems.find(i=>i.id===ing.ref):null;
        const batch = ing.type==='batch'?window.recipes.find(x=>x.id===ing.ref):null;
        if (inv) return `<li>${ing.qty} ${esc(inv.useUnit)} — ${esc(inv.name)}</li>`;
        if (batch) return `<li>${ing.qty} ${esc(batch.yieldUnit)} — ${esc(batch.name)}</li>`;
        return `<li>${esc(ing.name)}</li>`;
    }).join('');
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${esc(r.name)}</title><style>
        body{font-family:sans-serif;font-size:13px;color:#222;max-width:700px;margin:30px auto;line-height:1.6;}
        h1{font-size:22px;border-bottom:3px solid #333;padding-bottom:8px;margin-bottom:5px;}
        h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#666;margin:20px 0 8px 0;}
        .meta{font-size:12px;color:#888;margin-bottom:15px;}
        .gp{font-size:26px;font-weight:bold;color:${r.gp>=GP_TARGET?'#16a34a':'#dc2626'};float:right;margin-top:-38px;}
        ul{margin:0;padding-left:20px;}li{margin-bottom:4px;}
        .method{white-space:pre-wrap;background:#f9f9f9;padding:15px;border-radius:6px;}
        .allergens{margin-top:15px;padding:10px;background:#fff3f3;border:1px solid #fca5a5;border-radius:6px;font-size:12px;}
        img{max-width:100%;border-radius:6px;margin-bottom:15px;max-height:200px;object-fit:cover;width:100%;}
        @media print{body{margin:15px;}}
    </style></head><body>
    ${r.photo?`<img src="${r.photo}">`:''}
    <h1>${esc(r.name)}</h1>
    ${r.type==='Menu'&&r.price>0?`<div class="gp">${r.gp||0}% GP</div>`:''}
    <div class="meta">${esc(r.station||'Kitchen')} · ${r.type} · ${r.status||'Active'}${r.type==='Batch'?` · Yields ${r.yieldQty} ${esc(r.yieldUnit)}`:''}</div>
    <h2>Ingredients</h2><ul>${ingText||'<li>No ingredients listed</li>'}</ul>
    <h2>Method</h2><div class="method">${esc(r.method||'No method written.')}</div>
    ${r.allergens&&r.allergens.length>0?`<div class="allergens"><strong>⚠️ Allergens:</strong> ${r.allergens.map(a=>esc(a)).join(', ')}</div>`:''}
    <div style="margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">${window.getCurrentVenue ? window.getCurrentVenue().name : 'Bar Wa Izakaya'} · Hobart Hub · Printed ${new Date().toLocaleDateString('en-AU')}</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
};


window.duplicateRecipe = (id) => {
    const original = window.recipes.find(r => r.id === id);
    if (!original) return window.showToast('Recipe not found.', 'error');
    const newRecipe = JSON.parse(JSON.stringify(original));
    newRecipe.id = window.generateId('rec');
    newRecipe.name = original.name + ' (Copy)';
    newRecipe.photo = '';
    window.recipes.push(newRecipe);
    window.saveToDisk();
    window.showToast('Recipe duplicated!');
    window.editRecipeForm(newRecipe.id);
};

window.editRecipeForm = (id = null) => {
    const cleanId = id ? String(id).trim() : null;
    let r = cleanId ? window.recipes.find(x => x.id === cleanId) : null;
    if (!r) {
        r = { id: window.generateId('rec'), name:'', posAlias:'', type:'Menu', station:'Kitchen', status:'Active',
              price:0, yieldQty:1, yieldUnit:'Portion', method:'', ingredients:[], allergens:[], cost:0, gp:0, photo:'', videoUrl:'' };
    }
    if (!window.tempRecipeId || window.tempRecipeId !== cleanId) {
        window.tempIngs = JSON.parse(JSON.stringify(r.ingredients||[]));
        window.tempRecipeId = cleanId||'new';
    }
    let invOpts = (window.inventoryItems||[]).filter(i=>!i.archived).map(inv=>`<option value="inv_${inv.id}">${esc(inv.name)} (per ${esc(inv.useUnit||'Unit')})</option>`).join('');
    let batchOpts = (window.recipes||[]).filter(b=>b.type==='Batch'&&b.id!==cleanId).map(b=>`<option value="batch_${b.id}">[Batch] ${esc(b.name)} (per ${esc(b.yieldUnit)})</option>`).join('');

    const renderBuilder = () => {
        let totalCost = 0;
        let ingHtml = window.tempIngs.map((ing,tIdx) => {
            let itemCost=0,displayUnit=ing.unit||'',isErr=false;
            if (ing.type==='inv'){const inv=window.inventoryItems.find(i=>i.id===ing.ref);if(inv){itemCost=ing.qty*((inv.price||0)/(inv.yield||1));displayUnit=inv.useUnit;}else{isErr=true;}}
            else if (ing.type==='batch'){const b=window.recipes.find(x=>x.id===ing.ref);if(b){itemCost=ing.qty*((b.cost||0)/(b.yieldQty||1));displayUnit=b.yieldUnit;}else{isErr=true;}}
            totalCost+=itemCost;
            const isRaw=ing.type==='raw';
            return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:9px 0;border-bottom:1px solid var(--border);align-items:center;gap:6px;">
                <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
                    ${isRaw?`<span style="font-size:10px;color:var(--orange);border:1px solid var(--orange);padding:1px 5px;border-radius:8px;flex-shrink:0;">raw</span>`:`<input type="number" step="0.001" class="input-box" value="${ing.qty}" onchange="window.updateIngQty(${tIdx},this.value)" style="width:65px;margin:0;padding:4px;border-color:var(--blue);flex-shrink:0;">`}
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;"><span style="color:var(--text-muted);">${esc(displayUnit)} </span><strong style="color:${isErr?'var(--red)':isRaw?'var(--text-muted)':'var(--text-main)'};">${esc(ing.name)}${isErr?' ⚠️':''}</strong></span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    ${!isRaw&&itemCost>0?`<span style="color:var(--brand-accent);font-size:11px;">$${itemCost.toFixed(3)}</span>`:''}
                    <button onclick="window.rmIng(${tIdx})" style="color:var(--red);border:none;background:none;cursor:pointer;font-size:15px;padding:0;">&times;</button>
                </div>
            </div>`;
        }).join('');
        const isBatch=r.type==='Batch';
        const gp=r.price>0?((r.price-totalCost)/r.price*100).toFixed(1):0;
        const gpColor=gp>=GP_TARGET?'var(--green)':gp>0?'var(--red)':'var(--text-muted)';
        document.getElementById('mainContent').innerHTML = `
        <div style="max-width:880px;margin:auto;padding-bottom:50px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <button onclick="window.tempRecipeId=null;window.showView(\'recipes\')" class="btn btn-outline" style="font-size:12px;">← Back</button>
                <div style="display:flex;gap:8px;">
                    ${cleanId?`<button onclick="window.printRecipe('${r.id}')" class="btn btn-outline" style="font-size:12px;">🖨️ Print</button>`:''}
                    ${cleanId?`<button onclick="window.duplicateRecipe('${r.id}')" class="btn btn-outline" style="font-size:12px;">📋 Duplicate</button>`:''}\n                    ${cleanId?`<button onclick="window.delRecipe('${r.id}')" class="btn btn-red" style="font-size:12px;">🗑️ Delete</button>`:''}
                </div>
            </div>
            <div class="card" style="padding:20px;margin-bottom:15px;">
                <h3 style="margin:0 0 12px 0;">${cleanId?'Edit':'New'} Recipe</h3>
                <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div><label style="font-size:11px;color:var(--text-muted);">Name</label><input type="text" id="r-n" class="input-box" value="${esc(r.name)}" style="margin:0;"></div>
                    <div><label style="font-size:11px;color:var(--text-muted);">Type</label><select id="r-type" class="input-box" style="margin:0;" onchange="window.refreshRB()"><option ${r.type==='Menu'?'selected':''}>Menu</option><option ${r.type==='Batch'?'selected':''}>Batch</option></select></div>
                    <div><label style="font-size:11px;color:var(--text-muted);">Station</label><select id="r-station" class="input-box" style="margin:0;"><option ${(r.station||'Kitchen')==='Kitchen'?'selected':''}>Kitchen</option><option ${r.station==='Bar'?'selected':''}>Bar</option><option ${r.station==='Prep'?'selected':''}>Prep</option></select></div>
                    <div><label style="font-size:11px;color:var(--text-muted);">Status</label><select id="r-status" class="input-box" style="margin:0;"><option ${(r.status||'Active')==='Active'?'selected':''}>Active</option><option ${r.status==="86'd"?'selected':''}>86'd</option><option ${r.status==='Development'?'selected':''}>Development</option></select></div>
                </div>
                <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;">
                    ${!isBatch?`<div><label style="font-size:11px;color:var(--blue);font-weight:bold;">Lightspeed POS Alias</label><input type="text" id="r-pos" class="input-box" value="${esc(r.posAlias||'')}" placeholder="Exact POS name..." style="margin:0;border-color:var(--blue);"></div>`:'<div></div>'}
                    <div style="display:flex;gap:8px;">
                        ${isBatch?`<div style="flex:1;"><label style="font-size:11px;color:var(--brand-accent);">Yield Qty</label><input type="number" step="0.1" id="r-yq" class="input-box" value="${r.yieldQty}" oninput="window.refreshRB()" style="margin:0;border-color:var(--brand-accent);"></div><div style="flex:1;"><label style="font-size:11px;color:var(--brand-accent);">Unit</label><input type="text" id="r-yu" class="input-box" value="${esc(r.yieldUnit)}" oninput="window.refreshRB()" style="margin:0;border-color:var(--brand-accent);"></div>`:`<div style="flex:1;"><label style="font-size:11px;color:var(--text-muted);">Sell Price ($)</label><input type="number" step="0.01" id="r-p" class="input-box" value="${r.price}" oninput="window.refreshRB()" style="margin:0;"></div>`}
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
                <div class="card" style="padding:15px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <h4 style="margin:0;font-size:14px;">Ingredients</h4>
                        <div style="display:flex;gap:5px;">
                            <button onclick="window.scaleRecipe()" class="btn btn-outline" style="padding:8px 12px;font-size:11px;">⚖️ Scale</button>
                            <button onclick="window.openQuickAddIngModal()" class="btn btn-blue" style="padding:8px 12px;font-size:11px;">+ Quick Add</button>
                        </div>
                    </div>
                    <div style="max-height:320px;overflow-y:auto;">${ingHtml||'<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:10px 0;">No ingredients yet.</p>'}</div>
                    <div style="margin-top:10px;display:flex;gap:5px;">
                        <select id="add-sel" class="input-box" style="flex:1;margin:0;font-size:12px;" onchange="window.updateUnitHint()"><option value="">Select ingredient...</option><optgroup label="Live Inventory">${invOpts}</optgroup><optgroup label="Prep Batches">${batchOpts}</optgroup></select>
                        <input type="number" step="0.001" id="add-qty" class="input-box" placeholder="Qty" style="width:65px;margin:0;border-color:var(--blue);">
                        <button onclick="window.addIng()" class="btn btn-green" style="padding:8px 10px;">Add</button>
                    </div>
                    <div id="unit-hint" style="font-size:11px;font-weight:bold;color:var(--blue);margin-top:5px;text-align:right;"></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div class="card" style="padding:15px;text-align:center;border-top:4px solid ${gpColor};">
                        ${isBatch?`<div style="font-size:11px;color:var(--text-muted);">Total Batch Cost</div><div style="font-size:30px;font-weight:bold;color:var(--brand-dark);">$${totalCost.toFixed(2)}</div><div style="font-size:11px;color:var(--purple);">$${(totalCost/(r.yieldQty||1)).toFixed(4)} per ${esc(r.yieldUnit)}</div>`:`<div style="font-size:11px;color:var(--text-muted);">Cost $${totalCost.toFixed(2)} · Sell $${r.price}</div><div style="font-size:30px;font-weight:bold;color:${gpColor};line-height:1.1;">${gp}%</div><div style="font-size:11px;color:var(--text-muted);">GP (Target: ${GP_TARGET}%)</div>`}
                    </div>
                    <div class="card" style="padding:15px;">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px;">📹 Training Video URL</label>
                        <input type="text" id="r-video" class="input-box" value="${esc(r.videoUrl||'')}" placeholder="YouTube or Vimeo URL..." style="margin:0 0 10px 0;">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px;">📸 Recipe Photo</label>
                        ${r.photo?`<img src="${r.photo}" style="width:100%;height:70px;object-fit:cover;border-radius:5px;margin-bottom:6px;">`:''}
                        <input type="file" id="r-photo-file" accept="image/*" style="font-size:11px;color:var(--text-muted);" onchange="window.uploadRecipePhoto('${r.id}',this)">
                    </div>
                </div>
            </div>
            <div class="card" style="padding:15px;margin-bottom:15px;">
                <label style="font-size:11px;color:var(--text-muted);">Method / Prep Notes</label>
                <textarea id="r-m" class="input-box" placeholder="Method, plating notes, chef tips..." style="height:100px;margin-top:4px;">${esc(r.method||'')}</textarea>
            </div>
            <div class="sticky-footer">
                <button onclick="window.subRecipe('${r.id}',${totalCost})" class="btn btn-green" style="flex:2;font-size:15px;">💾 Save Recipe</button>
                <button onclick="window.tempRecipeId=null;window.showView(\'recipes\')" class="btn btn-outline" style="flex:1;">Cancel</button>
            </div>
        </div>`;
        window.updateUnitHint();
    };

    window.refreshRB = () => {
        r.name = document.getElementById('r-n').value;
        r.type = document.getElementById('r-type').value;
        if (document.getElementById('r-m')) r.method = document.getElementById('r-m').value;
        if (document.getElementById('r-pos')) r.posAlias = document.getElementById('r-pos').value;
        if (document.getElementById('r-p')) r.price = parseFloat(document.getElementById('r-p').value)||0;
        if (document.getElementById('r-yq')) { r.yieldQty=parseFloat(document.getElementById('r-yq').value)||1; r.yieldUnit=document.getElementById('r-yu').value; }
        renderBuilder();
    };
    
window._filterIngSearch = (query) => {
    const dropdown = document.getElementById('ing-search-dropdown');
    if (!dropdown) return;
    const q = query.toLowerCase();
    
    const invItems = (window.inventoryItems||[]).filter(i => !i.archived && (!q || i.name.toLowerCase().includes(q)));
    const batchItems = (window.recipes||[]).filter(b => b.type==='Batch' && (!q || b.name.toLowerCase().includes(q)));
    
    if (invItems.length === 0 && batchItems.length === 0) {
        dropdown.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:12px;text-align:center;">No matches</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    let html = '';
    if (invItems.length > 0) {
        html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 12px 4px;font-weight:bold;">Inventory</div>';
        invItems.slice(0, 10).forEach(inv => {
            var safeName = inv.name.replace(/'/g, '');
            html += '<div class="search-dropdown-item" data-val="inv_' + inv.id + '" data-name="' + safeName + '" onclick="window._selectIngFromSearch(this.dataset.val, this.dataset.name)"><span>' + esc(inv.name) + '</span><small style="color:var(--blue);">per ' + (inv.useUnit||'Unit') + '</small></div>';
        });
    }
    if (batchItems.length > 0) {
        html += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 12px 4px;font-weight:bold;">Prep Batches</div>';
        batchItems.slice(0, 5).forEach(b => {
            var safeName = b.name.replace(/'/g, '');
            html += '<div class="search-dropdown-item" data-val="batch_' + b.id + '" data-name="' + safeName + '" onclick="window._selectIngFromSearch(this.dataset.val, this.dataset.name)"><span>[Batch] ' + esc(b.name) + '</span><small style="color:var(--purple);">per ' + (b.yieldUnit||'Unit') + '</small></div>';
        });
    }
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
};

window._selectIngFromSearch = (value, displayName) => {
    document.getElementById('add-sel').value = value;
    document.getElementById('add-search').value = displayName;
    document.getElementById('ing-search-dropdown').style.display = 'none';
    window.updateUnitHint();
    // Focus qty field
    const qtyField = document.getElementById('add-qty');
    if (qtyField) qtyField.focus();
};

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dd = document.getElementById('ing-search-dropdown');
    const input = document.getElementById('add-search');
    if (dd && input && !dd.contains(e.target) && e.target !== input) dd.style.display = 'none';
});

window.updateUnitHint = () => {
        const sel=document.getElementById('add-sel'); const hint=document.getElementById('unit-hint');
        if (!sel||!hint||!sel.value){if(hint)hint.innerText='';return;}
        const parts=sel.value.split('_');
        if (parts[0]==='inv'){const inv=window.inventoryItems.find(i=>i.id===sel.value.replace('inv_',''));if(inv)hint.innerHTML=`Enter qty in: <span style="background:var(--blue);color:white;padding:1px 6px;border-radius:4px;">${esc(inv.useUnit)}</span>`;}
        else {const b=window.recipes.find(x=>x.id===sel.value.replace('batch_',''));if(b)hint.innerHTML=`Enter qty in: <span style="background:var(--purple);color:white;padding:1px 6px;border-radius:4px;">${esc(b.yieldUnit)}</span>`;}
    };
    window.scaleRecipe = () => {
        const mult=parseFloat(prompt("Scale multiplier (e.g. 2=double, 0.5=halve):","2"));
        if (!mult||isNaN(mult)) return;
        window.tempIngs.forEach(ing=>{if(ing.qty)ing.qty=parseFloat((ing.qty*mult).toFixed(3));});
        if (document.getElementById('r-yq')) document.getElementById('r-yq').value=(parseFloat(document.getElementById('r-yq').value)*mult).toFixed(2);
        window.refreshRB(); window.showToast(`Scaled by ${mult}x`);
    };
    window.updateIngQty = (idx,val) => { window.tempIngs[idx].qty=parseFloat(val)||0; window.refreshRB(); };
    window.rmIng = (tIdx) => { window.tempIngs.splice(tIdx,1); window.refreshRB(); };
    window.addIng = () => {
        const qty=parseFloat(document.getElementById('add-qty').value); const selVal=document.getElementById('add-sel').value;
        if (!qty||!selVal) return window.showToast("Select item and enter quantity.","error");
        const parts=selVal.split('_'); const type=parts[0]; const refId=selVal.replace(type+'_','');
        if (type==='inv'){const inv=window.inventoryItems.find(i=>i.id===refId);if(!inv)return;window.tempIngs.push({type:'inv',ref:refId,qty,unit:inv.useUnit||'Unit',name:inv.name});}
        else {const b=window.recipes.find(x=>x.id===refId);if(!b)return;window.tempIngs.push({type:'batch',ref:refId,qty,unit:b.yieldUnit,name:b.name});}
        window.refreshRB();
    };
    window.openQuickAddIngModal = () => {
        const newId=window.generateId('inv');
        const supplierOpts=(window.suppliers||[]).map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
        const allCats=['Food','Beverage','Packaging','Chemicals','Other',...new Set((window.inventoryItems||[]).map(i=>i.category))];
        const catOpts=[...new Set(allCats)].map(c=>`<option value="${c}">`).join('');
        window.openModal("⚡ Quick Add Ingredient",`
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px;">
            <div><label style="font-size:11px;">Name</label><input type="text" id="iv-n" class="input-box" placeholder="e.g. Kombu"></div>
            <div><label style="font-size:11px;">Category</label><input type="text" id="iv-cat" list="iq-cats" class="input-box" value="Food"><datalist id="iq-cats">${catOpts}</datalist></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div><label style="font-size:11px;">Supplier</label><select id="iv-s" class="input-box"><option value="">-- None --</option>${supplierOpts}</select></div>
            <div><label style="font-size:11px;">SKU</label><input type="text" id="iv-sku" class="input-box" placeholder="Optional"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;background:var(--bg-main);padding:10px;border-radius:6px;">
            <div><label style="font-size:11px;">Buy Price ($)</label><input type="number" step="0.01" id="iv-p" class="input-box" value="0"></div>
            <div><label style="font-size:11px;">Buy Unit</label><input type="text" id="iv-buyUnit" class="input-box" value="Unit"></div>
            <div style="display:none;"><input type="checkbox" id="iv-gst"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;border:1px dashed var(--blue);padding:10px;border-radius:6px;">
            <div><label style="font-size:11px;color:var(--blue);font-weight:bold;">Yield</label><input type="number" step="0.01" id="iv-yield" class="input-box" value="1"></div>
            <div><label style="font-size:11px;color:var(--blue);font-weight:bold;">Use Unit</label><input type="text" id="iv-useUnit" class="input-box" value="kg"></div>
        </div>
        <div style="margin-bottom:15px;"><label style="font-size:11px;">Storage Zone</label>${window.buildZoneSelect('','iv-loc')}</div>
        <input type="hidden" id="iv-st" value="0"><input type="hidden" id="iv-parwd" value="0"><input type="hidden" id="iv-parwe" value="0">
        <button onclick="window.subInvItem('${newId}',false,true)" class="btn btn-green" style="width:100%;">Save to Inventory</button>`);
    };
    renderBuilder();
};

window.uploadRecipePhoto = async (recipeId, input) => {
    const file = input.files[0]; if (!file) return;
    if (typeof storage==='undefined') return window.showToast("Firebase Storage not connected.","error");
    window.showToast("Uploading photo...");
    try {
        const ref = storage.ref().child(`recipes/${recipeId}_${Date.now()}`);
        await ref.put(file); const url = await ref.getDownloadURL();
        const recipe = window.recipes.find(r=>r.id===recipeId);
        if (recipe) { recipe.photo=url; window.saveToDisk(); window.showToast("Photo saved!"); window.editRecipeForm(recipeId); }
    } catch(e) { window.showToast("Photo upload failed: "+e.message,"error"); }
};

window.subRecipe = (id, totalCost) => {
    const recipeName = document.getElementById('r-n').value.trim();
    if (!recipeName) return window.showToast('Recipe name is required.', 'error');
    const existingIdx = window.recipes.findIndex(x=>x.id===id);
    const type = document.getElementById('r-type').value;
    const oldRecipe = existingIdx>=0 ? window.recipes[existingIdx] : {};
    const obj = {
        id, name: recipeName,
        posAlias: type!=='Batch'&&document.getElementById('r-pos')?document.getElementById('r-pos').value:'',
        type, station: document.getElementById('r-station').value, status: document.getElementById('r-status').value,
        ingredients: window.tempIngs, cost: totalCost, method: document.getElementById('r-m').value,
        allergens: oldRecipe.allergens||[], photo: oldRecipe.photo||'',
        videoUrl: document.getElementById('r-video')?document.getElementById('r-video').value:(oldRecipe.videoUrl||''),
        archived: false,
        price: type==='Menu'?(parseFloat(document.getElementById('r-p').value)||0):0,
        yieldQty: type==='Batch'?(parseFloat(document.getElementById('r-yq').value)||1):1,
        yieldUnit: type==='Batch'?document.getElementById('r-yu').value:'Portion',
        gp: 0
    };
    if (type==='Menu'&&obj.price>0) obj.gp=parseFloat(((obj.price-totalCost)/obj.price*100).toFixed(1));
    if (existingIdx>=0) window.recipes[existingIdx]=obj; else window.recipes.push(obj);
    window.tempRecipeId=null; window.saveToDisk(); window.showToast("Recipe saved!"); window.showView('recipes');
};

window.delRecipe = (id) => {
    window.confirmAction({
        title: '⚖️ Delete Recipe',
        message: 'Permanently delete this recipe? This cannot be undone.',
        confirmLabel: 'Delete', tier: 'standard',
        onConfirm: () => { window.recipes=window.recipes.filter(x=>x.id!==id); window.tempRecipeId=null; window.saveToDisk(); window.showToast('Recipe deleted.'); window.showView('recipes'); }
    });
};

// =============================================================================

// =============================================================================
// PRICE RISE ALERTS
// Shows items whose price changed in the last invoice run
// =============================================================================
window.renderPriceAlertsView = () => {
    const items = (window.inventoryItems||[]).filter(i => !i.archived && i.history && i.history.length >= 2);
    const alerts = [];

    items.forEach(inv => {
        const hist = inv.history.slice().sort((a,b) => new Date(a.date)-new Date(b.date));
        const latest = hist[hist.length-1];
        const prev = hist[hist.length-2];
        if (latest && prev && latest.price > 0 && prev.price > 0 && latest.price !== prev.price) {
            const changePct = ((latest.price - prev.price) / prev.price * 100);
            alerts.push({
                name: inv.name,
                id: inv.id,
                prevPrice: prev.price,
                newPrice: latest.price,
                changePct,
                date: latest.date,
                supplier: latest.supplier || inv.supplier || 'Unknown'
            });
        }
    });

    alerts.sort((a,b) => Math.abs(b.changePct) - Math.abs(a.changePct));

    // Check affected recipes
    const getAffectedRecipes = (invId) => {
        return (window.recipes||[]).filter(r => r.type==='Menu' && !r.archived &&
            (r.ingredients||[]).some(ing => ing.type==='inv' && ing.ref===invId)
        ).map(r => r.name).slice(0,3);
    };

    if (alerts.length === 0) {
        return '<div style="max-width:900px;margin:auto;">' + window._marginsTabBar('price-alerts') +
            '<div class="card" style="text-align:center;padding:40px;">' +
            '<div style="font-size:48px;margin-bottom:10px;">✅</div>' +
            '<h3 style="color:var(--green);margin:0;">No price changes detected</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Run more invoices through the Invoice Ripper to build price history.</p>' +
        '</div></div>';
    }

    const rises = alerts.filter(a => a.changePct > 0);
    const falls = alerts.filter(a => a.changePct < 0);

    const rows = alerts.map(a => {
        const isRise = a.changePct > 0;
        const color = isRise ? 'var(--red)' : 'var(--green)';
        const affected = getAffectedRecipes(a.id);
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:7px 10px;"><strong style="font-size:13px;">' + esc(a.name) + '</strong><br><small style="color:var(--text-muted);">' + esc(a.supplier) + ' · ' + esc(a.date) + '</small></td>' +
            '<td style="padding:7px 10px;font-size:12px;color:var(--text-muted);">$' + Number(a.prevPrice).toFixed(2) + '</td>' +
            '<td style="padding:7px 10px;font-weight:bold;font-size:12px;">$' + Number(a.newPrice).toFixed(2) + '</td>' +
            '<td style="padding:7px 10px;font-weight:bold;font-size:12px;color:' + color + ';">' + (isRise?'▲':'▼') + ' ' + Math.abs(a.changePct).toFixed(1) + '%</td>' +
            '<td style="padding:7px 10px;font-size:11px;color:var(--text-muted);">' + (affected.length > 0 ? affected.map(n=>esc(n)).join(', ') + (affected.length===3?'...':'') : 'None') + '</td>' +
            '<td style="padding:12px 15px;text-align:right;"><button onclick="window.showView(\'margins\')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Check GP</button></td>' +
        '</tr>';
    }).join('');

    return '<div style="max-width:1100px;margin:auto;">' +
        window._marginsTabBar('price-alerts') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<div><h2 style="margin:0;">🚨 Price Change Alerts</h2>' +
            '<small style="color:var(--text-muted);">Changes detected from invoice history. Check affected recipes for GP impact.</small></div>' +
            '<button onclick="window.showView(\'invoice\')" class="btn btn-outline" style="font-size:12px;">🧾 Run Invoice</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin-bottom:20px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--red);">' +
                '<div style="font-size:22px;font-weight:bold;color:var(--red);">' + rises.length + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);">Price Rises</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);">' +
                '<div style="font-size:22px;font-weight:bold;color:var(--green);">' + falls.length + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);">Price Drops</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:22px;font-weight:bold;color:var(--orange);">' + alerts.length + '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);">Total Changes</div>' +
            '</div>' +
        '</div>' +
        '<div class="card" style="padding:0;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                    '<th style="padding:6px 10px;text-align:left;">Item</th>' +
                    '<th style="padding:6px 10px;text-align:left;">Was</th>' +
                    '<th style="padding:6px 10px;text-align:left;">Now</th>' +
                    '<th style="padding:6px 10px;text-align:left;">Change</th>' +
                    '<th style="padding:6px 10px;text-align:left;">Affects</th>' +
                    '<th style="padding:6px 10px;"></th>' +
                '</tr></thead>' +
                '<tbody>' + rows + '</tbody>' +
            '</table>' +
        '</div>' +
    '</div>';
};

// MARGIN HEALTH VIEW
// =============================================================================
window.renderMarginView = () => {
    const menuRecipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&r.price>0&&(r.status||'Active')==='Active');
    menuRecipes.forEach(recipe => {
        let cost=0;
        (recipe.ingredients||[]).forEach(ing=>{
            if(ing.type==='inv'){const inv=window.inventoryItems.find(i=>i.id===ing.ref);if(inv)cost+=ing.qty*((inv.price||0)/(inv.yield||1));}
            else if(ing.type==='batch'){const b=window.recipes.find(x=>x.id===ing.ref);if(b)cost+=ing.qty*((b.cost||0)/(b.yieldQty||1));}
        });
        recipe.cost=cost; recipe.gp=recipe.price>0?parseFloat(((recipe.price-cost)/recipe.price*100).toFixed(1)):0;
    });
    const sorted=[...menuRecipes].sort((a,b)=>a.gp-b.gp);
    const below=sorted.filter(r=>r.gp<GP_TARGET);
    const above=sorted.filter(r=>r.gp>=GP_TARGET);
    const avgGp=menuRecipes.length>0?(menuRecipes.reduce((s,r)=>s+r.gp,0)/menuRecipes.length).toFixed(1):0;
    const stationColor={'Kitchen':'var(--orange)','Bar':'var(--blue)','Prep':'var(--purple)'};
    const rowHtml=(recipes)=>recipes.map(r=>{
        const gpColor=r.gp>=GP_TARGET?'var(--green)':r.gp>=GP_TARGET-5?'var(--orange)':'var(--red)';
        return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px 15px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe('${r.id}')">${esc(r.name)}</strong> <small style="color:${stationColor[r.station||'Kitchen']};font-size:11px;">${r.station||'Kitchen'}</small></td>
            <td style="padding:12px 15px;font-size:13px;color:var(--brand-accent);">$${Number(r.cost||0).toFixed(2)}</td>
            <td style="padding:12px 15px;font-size:13px;">$${Number(r.price||0).toFixed(2)}</td>
            <td style="padding:12px 15px;min-width:140px;"><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden;"><div style="width:${Math.min(100,Math.max(0,r.gp))}%;background:${gpColor};height:100%;border-radius:4px;"></div></div><strong style="color:${gpColor};font-size:14px;min-width:38px;">${r.gp}%</strong></div></td>
            <td style="padding:12px 15px;text-align:right;"><button onclick="window.editRecipeForm('${r.id}')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Edit</button></td>
        </tr>`;
    }).join('');
    return `
    <div style="max-width:1100px;margin:auto;">
        ${window._marginsTabBar('margins')}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h2 style="margin:0;">📊 Margin Health</h2><small style="color:var(--text-muted);">Target: ${GP_TARGET}% GP · Active menu recipes · Updates live when invoices processed</small></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;margin-bottom:25px;">
            <div class="card" style="text-align:center;border-top:4px solid var(--blue);"><div style="font-size:34px;font-weight:bold;color:var(--blue);">${menuRecipes.length}</div><div style="font-size:12px;color:var(--text-muted);">Active Menu Recipes</div></div>
            <div class="card" style="text-align:center;border-top:4px solid ${avgGp>=GP_TARGET?'var(--green)':'var(--red)'};"><div style="font-size:34px;font-weight:bold;color:${avgGp>=GP_TARGET?'var(--green)':'var(--red)'};">${avgGp}%</div><div style="font-size:12px;color:var(--text-muted);">Average GP</div></div>
            <div class="card" style="text-align:center;border-top:4px solid var(--red);"><div style="font-size:34px;font-weight:bold;color:var(--red);">${below.length}</div><div style="font-size:12px;color:var(--text-muted);">Below ${GP_TARGET}%</div></div>
            <div class="card" style="text-align:center;border-top:4px solid var(--green);"><div style="font-size:34px;font-weight:bold;color:var(--green);">${above.length}</div><div style="font-size:12px;color:var(--text-muted);">At or Above Target</div></div>
        </div>
        ${below.length>0?`<div class="card" style="padding:0;overflow:visible;margin-bottom:20px;border-top:4px solid var(--red);"><div style="padding:15px 20px;background:rgba(239,68,68,0.08);border-bottom:1px solid var(--border);"><h3 style="margin:0;color:var(--red);">⚠️ Below ${GP_TARGET}% (${below.length})</h3></div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#111;font-size:12px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:10px 15px;text-align:left;">Recipe</th><th style="padding:10px 15px;text-align:left;">Cost</th><th style="padding:10px 15px;text-align:left;">Sell</th><th style="padding:10px 15px;text-align:left;">GP%</th><th></th></tr></thead><tbody>${rowHtml(below)}</tbody></table></div></div>`:`<div class="card" style="border-top:4px solid var(--green);text-align:center;padding:20px;margin-bottom:20px;"><p style="color:var(--green);font-weight:bold;font-size:16px;margin:0;">✅ All recipes above ${GP_TARGET}% GP target.</p></div>`}
        <div class="card" style="padding:0;overflow:visible;"><div style="padding:15px 20px;background:rgba(16,185,129,0.08);border-bottom:1px solid var(--border);"><h3 style="margin:0;color:var(--green);">✓ Healthy Margins (${above.length})</h3></div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#111;font-size:12px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:10px 15px;text-align:left;">Recipe</th><th style="padding:10px 15px;text-align:left;">Cost</th><th style="padding:10px 15px;text-align:left;">Sell</th><th style="padding:10px 15px;text-align:left;">GP%</th><th></th></tr></thead><tbody>${rowHtml(above)}</tbody></table></div></div>
    </div>`;
};

// =============================================================================
// BULK HTML IMPORTER
// =============================================================================
window.openBulkHtmlImport = () => {
    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:700px;margin:auto;">
        <h2 style="margin-top:0;">📥 Bulk Recipe HTML Import</h2>
        <div class="card" style="border-top:5px solid var(--purple);">
            <p style="color:var(--text-muted);font-size:14px;margin-top:0;">Upload your Recipe Keeper HTML export. All recipes imported as stubs — ingredients stored as raw text, ready to link to inventory over time.</p>
            <div style="background:var(--bg-main);padding:15px;border-radius:8px;margin-bottom:15px;font-size:13px;color:var(--text-muted);">
                <strong style="color:var(--brand-dark);">What gets imported:</strong><br>
                ✓ Name · ✓ Station (Kitchen/Bar/Prep) · ✓ Type (Menu/Batch) · ✓ Ingredients as text · ✓ Method<br><br>
                <strong style="color:var(--orange);">Duplicate check:</strong> Recipes with matching names are skipped automatically.
            </div>
            <input type="file" id="html-import-file" accept=".html,.htm" style="display:none;" onchange="window.runBulkHtmlImport(event)">
            <button onclick="document.getElementById('html-import-file').click()" class="btn btn-purple" style="width:100%;font-size:16px;padding:14px;">📂 Select Recipe HTML File</button>
            <div id="import-status" style="margin-top:15px;"></div>
        </div>
        <button onclick="window.showView(\'recipes\')" class="btn btn-outline" style="width:100%;margin-top:10px;">Cancel</button>
    </div>`;
};

window.runBulkHtmlImport = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const statusDiv = document.getElementById('import-status');
    statusDiv.innerHTML = `<p style="color:var(--blue);">⏳ Reading file...</p>`;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(e.target.result,'text/html');
            const recipeNodes = doc.querySelectorAll('.recipe-details');
            if (recipeNodes.length===0) { statusDiv.innerHTML=`<p style="color:var(--red);">No recipes found. Make sure this is a Recipe Keeper HTML export.</p>`; return; }
            const existing = new Set((window.recipes||[]).map(r=>r.name.toLowerCase().trim()));
            let imported=0, duplicates=0;
            recipeNodes.forEach(node => {
                const nameEl = node.querySelector('[itemprop="name"]');
                if (!nameEl) return;
                const name = nameEl.textContent.trim();
                if (!name) return;
                if (existing.has(name.toLowerCase())) { duplicates++; return; }
                const course = (node.querySelector('[itemprop="recipeCourse"]')||{}).textContent||'';
                const ingredientsEl = node.querySelector('[itemprop="recipeIngredients"]');
                const directionsEl = node.querySelector('[itemprop="recipeDirections"]');
                const notesEl = node.querySelector('[itemprop="recipeNotes"]');
                const rawIngredients = ingredientsEl ? Array.from(ingredientsEl.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>0) : [];
                const directions = directionsEl ? Array.from(directionsEl.querySelectorAll('p')).map(p=>p.textContent.trim()).filter(t=>t.length>0).join('\n') : '';
                const notes = notesEl ? notesEl.textContent.trim() : '';
                const method = [directions,notes].filter(Boolean).join('\n\n');
                const ingredients = rawIngredients.map(line=>({type:'raw',name:line,qty:0,unit:''}));
                window.recipes.push({
                    id: window.generateId('rec'), name, posAlias:'',
                    type: window._courseToType(course), station: window._courseToStation(course),
                    status:'Active', course: course||'', ingredients, cost:0, gp:0, price:0,
                    yieldQty:1, yieldUnit:'Portion', method, allergens:[], photo:'', videoUrl:'', archived:false
                });
                existing.add(name.toLowerCase());
                imported++;
            });
            window.saveToDisk();
            statusDiv.innerHTML = `<div class="card" style="border-top:4px solid var(--green);text-align:center;padding:20px;">
                <div style="font-size:40px;margin-bottom:10px;">✅</div>
                <h3 style="color:var(--green);margin:0 0 10px 0;">Import Complete!</h3>
                <div style="font-size:14px;color:var(--text-muted);"><strong style="color:var(--green);">${imported}</strong> recipes imported · <strong style="color:var(--orange);">${duplicates}</strong> duplicates skipped</div>
                <div style="margin-top:15px;display:flex;gap:10px;justify-content:center;">
                    <button onclick="window.showView(\'recipes\')" class="btn btn-blue">View Recipes</button>
                    <button onclick="window.showView(\'margins\')" class="btn btn-purple">Check Margins</button>
                </div>
            </div>`;
        } catch(err) { statusDiv.innerHTML=`<p style="color:var(--red);">Parse error: ${err.message}</p>`; }
    };
    reader.readAsText(file);
};

// =============================================================================
// AI SINGLE RECIPE IMPORT
// =============================================================================
window.openAiRecipeImport = () => {
    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:800px;margin:auto;">
        <h2 style="margin-top:0;">✨ AI Recipe Importer</h2>
        <div class="card" style="border-top:5px solid var(--purple);">
            <p style="color:var(--text-muted);font-size:14px;margin-top:0;">Paste a single recipe. AI will parse and match ingredients to your Live Inventory.</p>
            <textarea id="ai-recipe-text" class="input-box" style="height:250px;font-family:monospace;font-size:12px;" placeholder="Paste recipe text here..."></textarea>
            <button onclick="window.runAiRecipeImport()" class="btn btn-purple" style="width:100%;font-size:16px;padding:12px;">Parse & Cost Recipe</button>
            <button onclick="window.showView(\'recipes\')" class="btn btn-outline" style="width:100%;margin-top:10px;">Cancel</button>
            <div id="ai-recipe-status" style="margin-top:15px;text-align:center;"></div>
        </div>
    </div>`;
};

window.runAiRecipeImport = async () => {
    const rawText = document.getElementById('ai-recipe-text').value;
    const statusDiv = document.getElementById('ai-recipe-status');
    if (!rawText.trim()) return window.showToast("Please paste a recipe first.","error");
    statusDiv.innerHTML=`<p style="color:var(--purple);font-weight:bold;">🤖 Analyzing recipe...</p>`;
    const invNames=(window.inventoryItems||[]).map(i=>`${i.id}:${i.name} (per ${i.useUnit})`).join(', ');
    const prompt=`You are a culinary AI for Bar Wa Izakaya. Extract the recipe from this text.
Return ONLY JSON: { "name": "Name", "method": "Method", "yieldQty": 1, "ingredients": [ { "name": "Name", "qty": 1.5, "unit": "kg", "matchedInvId": null } ] }
Match to inventory IDs where possible: [${invNames}]
Recipe: ${rawText}`;
    try {
        const apiKey=window.getApiKey(); if(!apiKey) return;
        const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})});
        const data=await response.json(); if(data.error) throw new Error(data.error.message);
        let rawJson=data.candidates[0].content.parts[0].text.replace(/^```json/g,'').replace(/^```/g,'').replace(/```$/g,'').trim();
        const aiResult=JSON.parse(rawJson);
        window.tempIngs=aiResult.ingredients.map(ing=>{
            if(ing.matchedInvId&&window.inventoryItems.find(x=>x.id===ing.matchedInvId)){const inv=window.inventoryItems.find(x=>x.id===ing.matchedInvId);return{type:'inv',ref:ing.matchedInvId,qty:ing.qty,unit:inv.useUnit||ing.unit,name:inv.name};}
            return {type:'raw',name:`${ing.qty} ${ing.unit} ${ing.name}`,qty:0,unit:''};
        });
        const newObj={id:window.generateId('rec'),name:aiResult.name||'Imported Recipe',posAlias:'',type:'Menu',station:'Kitchen',status:'Active',price:0,yieldQty:aiResult.yieldQty||1,yieldUnit:'Portion',method:aiResult.method||'',ingredients:window.tempIngs,cost:0,gp:0,allergens:[],photo:'',videoUrl:'',archived:false};
        window.recipes.push(newObj); window.editRecipeForm(newObj.id); window.showToast("AI Parsing Complete!");
    } catch(e) { statusDiv.innerHTML=`<p style="color:var(--red);">API Error: ${e.message}</p>`; }
};


// =============================================================================
// AI RAW INGREDIENT BATCH LINKER
// =============================================================================
window.renderAiBatchLinker = () => {
    const rawRecipes = (window.recipes || []).filter(r => !r.archived && (r.ingredients || []).some(i => i.type === 'raw'));
    const totalRaw = rawRecipes.reduce((sum, r) => sum + r.ingredients.filter(i => i.type === 'raw').length, 0);
    return '<div style="max-width:1000px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<div><h2 style="margin:0;">AI Ingredient Linker</h2>' +
            '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Scans unlinked raw ingredients and suggests inventory matches.</p></div>' +
            '<button onclick="window.showView(\'recipes\')" class="btn btn-outline">← Recipes</button>' +
        '</div>' +
        '<div class="card" style="border-top:5px solid var(--purple);text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:42px;font-weight:bold;color:var(--purple);">' + totalRaw + '</div>' +
            '<div style="color:var(--text-muted);font-size:13px;margin-bottom:15px;">' + rawRecipes.length + ' recipes with unlinked ingredients</div>' +
            '<button onclick="window.runAiBatchLink()" class="btn btn-purple" style="font-size:16px;padding:14px 30px;">✨ Run AI Batch Linker</button>' +
        '</div>' +
        '<div id="batch-link-status" style="margin-bottom:15px;"></div>' +
        '<div id="batch-link-results"></div>' +
    '</div>';
};

window.runAiBatchLink = async () => {
    const statusDiv = document.getElementById('batch-link-status');
    const resultsDiv = document.getElementById('batch-link-results');
    statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:12px;color:var(--purple);font-weight:bold;">🤖 Scanning all raw ingredients...</div>';
    resultsDiv.innerHTML = '';
    const rawIngredients = [];
    (window.recipes || []).filter(r => !r.archived).forEach(r => {
        (r.ingredients || []).forEach((ing, idx) => {
            if (ing.type === 'raw') rawIngredients.push({ recipeId: r.id, recipeName: r.name, ingIdx: idx, rawName: ing.name });
        });
    });
    if (rawIngredients.length === 0) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ All ingredients linked!</div>';
        return;
    }
    const invList = (window.inventoryItems||[]).filter(i=>!i.archived).map(i=>i.id+':'+i.name+' ('+( i.useUnit||'unit')+')').join('; ');
    const rawList = rawIngredients.map((r,idx)=>idx+': '+r.rawName+' [in: '+r.recipeName+']').join('\n');
    const prompt = 'Match each raw ingredient to the best inventory ID or null.\nINVENTORY: '+invList+'\nRAW:\n'+rawList+'\nReturn ONLY JSON array: [{"idx":0,"matchId":"id","confidence":"high"},...]. confidence: high/medium/low/none. Only suggest medium+ confidence.';
    try {
        const apiKey = window.getApiKey(); if (!apiKey) return;
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+apiKey, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const aiMatches = JSON.parse(data.candidates[0].content.parts[0].text.replace(/^```json/g,'').replace(/^```/g,'').replace(/```$/g,'').trim());
        window._batchLinkQueue = rawIngredients.map((item,idx) => {
            const match = aiMatches.find(m=>m.idx===idx);
            const inv = match && match.matchId ? (window.inventoryItems||[]).find(i=>i.id===match.matchId) : null;
            return {...item, suggestedInvId:inv?inv.id:null, suggestedInvName:inv?inv.name:null, confidence:match?match.confidence:'none', accepted:false, skipped:false};
        });
        window.renderBatchLinkQueue();
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ Done — '+aiMatches.filter(m=>m.matchId).length+' matches suggested.</div>';
    } catch(e) { statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);">Error: '+e.message+'</div>'; }
};

window.renderBatchLinkQueue = () => {
    const queue = window._batchLinkQueue || [];
    const resultsDiv = document.getElementById('batch-link-results');
    const pending = queue.filter(q => !q.accepted && !q.skipped);
    const accepted = queue.filter(q => q.accepted);
    if (pending.length === 0 && accepted.length === 0) { resultsDiv.innerHTML = ''; return; }
    const cc = {high:'var(--green)',medium:'var(--orange)',low:'var(--text-muted)',none:'var(--border)'};
    const withMatch = pending.filter(q=>q.suggestedInvId);
    const noMatch = pending.filter(q=>!q.suggestedInvId);
    let html = '<div style="margin-bottom:15px;">';
    if (withMatch.length>0) html += '<button onclick="window.acceptAllBatchLinks()" class="btn btn-green" style="margin-right:8px;">✅ Accept All ('+withMatch.length+')</button>';
    if (accepted.length>0) html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple">💾 Commit '+accepted.length+' Links</button>';
    html += '</div>';
    const buildRow = (item) => {
        const qIdx = queue.indexOf(item);
        const invOpts = (window.inventoryItems||[]).filter(x=>!x.archived).map(x=>'<option value="'+x.id+'" '+(x.id===item.suggestedInvId?'selected':'')+'>'+esc(x.name)+' ('+esc(x.useUnit||'unit')+')</option>').join('');
        return '<div class="card" style="border-left:4px solid '+(cc[item.confidence]||'var(--border)')+';padding:15px;margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
            '<div style="flex:1;"><div style="font-size:12px;color:var(--text-muted);">'+esc(item.recipeName)+'</div><strong style="color:var(--orange);">'+esc(item.rawName)+'</strong>' +
            (item.confidence!=='none'?'<span style="font-size:11px;color:'+(cc[item.confidence]||'')+';margin-left:8px;border:1px solid currentColor;padding:1px 6px;border-radius:8px;">'+item.confidence+'</span>':'')+'</div>' +
            '<div style="flex:2;min-width:180px;"><select id="bl-sel-'+qIdx+'" class="input-box" style="margin:0 0 6px 0;"><option value="">-- Skip --</option>'+invOpts+'</select></div>' +
            '<div style="display:flex;gap:6px;">' +
            '<button onclick="window.acceptBatchLink('+qIdx+')" class="btn btn-green" style="font-size:12px;padding:6px 12px;">✓ Link</button>' +
            '<button onclick="window.skipBatchLink('+qIdx+')" class="btn btn-outline" style="font-size:12px;padding:6px 12px;">Skip</button>' +
            '</div></div></div>';
    };
    if (withMatch.length>0) { html += '<h3 style="color:var(--brand-dark);border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:15px;">🔗 Suggested ('+withMatch.length+')</h3>'; withMatch.forEach(i=>{html+=buildRow(i);}); }
    if (noMatch.length>0) { html += '<h3 style="color:var(--text-muted);border-bottom:1px solid var(--border);padding-bottom:8px;margin-top:20px;margin-bottom:15px;">❓ No Match ('+noMatch.length+')</h3>'; noMatch.forEach(i=>{html+=buildRow(i);}); }
    if (accepted.length>0) {
        html += '<h3 style="color:var(--green);border-bottom:1px solid var(--border);padding-bottom:8px;margin-top:20px;margin-bottom:10px;">✅ Ready to Commit ('+accepted.length+')</h3>';
        accepted.forEach(item=>{ const inv=(window.inventoryItems||[]).find(x=>x.id===item.suggestedInvId); html+='<div style="padding:8px 12px;font-size:13px;color:var(--green);background:rgba(16,185,129,0.06);border-radius:6px;margin-bottom:6px;"><strong>'+esc(item.rawName)+'</strong> → <strong>'+(inv?esc(inv.name):esc(item.suggestedInvId))+'</strong> <small style="color:var(--text-muted);">in '+esc(item.recipeName)+'</small></div>'; });
        if (pending.length===0) html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="width:100%;margin-top:15px;font-size:16px;padding:14px;">💾 Commit All '+accepted.length+' Links</button>';
    }
    resultsDiv.innerHTML = html;
};
window.acceptBatchLink = (qIdx) => { const sel=document.getElementById('bl-sel-'+qIdx); const id=sel?sel.value:window._batchLinkQueue[qIdx].suggestedInvId; if(!id) return window.showToast('Select an item first.','error'); const inv=(window.inventoryItems||[]).find(x=>x.id===id); window._batchLinkQueue[qIdx].suggestedInvId=id; window._batchLinkQueue[qIdx].suggestedInvName=inv?inv.name:id; window._batchLinkQueue[qIdx].accepted=true; window.renderBatchLinkQueue(); };
window.skipBatchLink = (qIdx) => { window._batchLinkQueue[qIdx].skipped=true; window.renderBatchLinkQueue(); };
window.acceptAllBatchLinks = () => { (window._batchLinkQueue||[]).forEach(item=>{ if(!item.accepted&&!item.skipped&&item.suggestedInvId) item.accepted=true; }); window.renderBatchLinkQueue(); };
window.commitBatchLinks = () => {
    const accepted=(window._batchLinkQueue||[]).filter(q=>q.accepted&&q.suggestedInvId);
    if(accepted.length===0) return window.showToast('Nothing to commit.','error');
    let count=0;
    accepted.forEach(item=>{ const recipe=window.recipes.find(r=>r.id===item.recipeId); if(!recipe) return; const ing=recipe.ingredients[item.ingIdx]; if(!ing||ing.type!=='raw') return; const inv=window.inventoryItems.find(i=>i.id===item.suggestedInvId); if(!inv) return; recipe.ingredients[item.ingIdx]={type:'inv',ref:inv.id,qty:1,unit:inv.useUnit||'unit',name:inv.name}; count++; });
    window.saveToDisk(); window._batchLinkQueue=null; window.showToast(count+' ingredients linked!'); window.showView('recipes');
};

// =============================================================================
// MENU ENGINEERING MATRIX
// =============================================================================
window.renderMenuEngineeringView = () => {
    const menuRecipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&r.price>0&&(r.status||'Active')==='Active'&&!r.archived);
    menuRecipes.forEach(r => {
        let cost=0;
        (r.ingredients||[]).forEach(ing=>{ if(ing.type==='inv'){const inv=(window.inventoryItems||[]).find(i=>i.id===ing.ref);if(inv)cost+=ing.qty*((inv.price||0)/(inv.yield||1));} else if(ing.type==='batch'){const b=(window.recipes||[]).find(x=>x.id===ing.ref);if(b)cost+=ing.qty*((b.cost||0)/(b.yieldQty||1));}});
        r.cost=cost; r.gp=r.price>0?parseFloat(((r.price-cost)/r.price*100).toFixed(1)):0;
    });
    const avgGp=menuRecipes.length>0?menuRecipes.reduce((s,r)=>s+r.gp,0)/menuRecipes.length:GP_TARGET;
    const avgCovers=menuRecipes.length>0?menuRecipes.reduce((s,r)=>s+(r.coversPerWeek||0),0)/menuRecipes.length:0;
    const classify = r => { const hi=r.gp>=avgGp,hv=(r.coversPerWeek||0)>=avgCovers; return hi&&hv?'star':hi&&!hv?'puzzle':!hi&&hv?'plowhorse':'dog'; };
    const cats = { star:{label:'⭐ Star',color:'var(--green)',bg:'rgba(16,185,129,0.08)',desc:'High GP + high volume. Protect.'}, puzzle:{label:'🧩 Puzzle',color:'var(--blue)',bg:'rgba(59,130,246,0.08)',desc:'High GP, low volume. Promote.'}, plowhorse:{label:'🐴 Plow Horse',color:'var(--orange)',bg:'rgba(245,158,11,0.08)',desc:'High volume, low GP. Reprice.'}, dog:{label:'🐶 Dog',color:'var(--red)',bg:'rgba(239,68,68,0.08)',desc:'Low GP + low volume. Review.'} };
    const sc={Kitchen:'var(--orange)',Bar:'var(--blue)',Prep:'var(--purple)'};
    const nw=menuRecipes.filter(r=>!r.coversPerWeek||r.coversPerWeek===0).length;
    const warnHtml=nw>0?'<div class="card" style="border-left:4px solid var(--orange);padding:12px;margin-bottom:20px;font-size:13px;"><strong style="color:var(--orange);">⚠️ '+nw+' recipes have no covers/week set.</strong> Edit each recipe to add covers, or use the Sell Price Editor.</div>':'';
    const counts={star:0,puzzle:0,plowhorse:0,dog:0};
    menuRecipes.forEach(r=>counts[classify(r)]++);
    const quadHtml=['star','puzzle','plowhorse','dog'].map(key=>{
        const cat=cats[key]; const items=menuRecipes.filter(r=>classify(r)===key);
        const rows=items.map(r=>{
            const gc=r.gp>=GP_TARGET?'var(--green)':r.gp>0?'var(--orange)':'var(--red)';
            return '<tr style="border-bottom:1px solid var(--border);"><td style="padding:10px 12px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.editRecipeForm(this.dataset.id)" data-id="'+r.id+'">'+esc(r.name)+'</strong><br><small style="color:'+(sc[r.station||'Kitchen']||'var(--text-muted)')+';">'+(r.station||'Kitchen')+'</small></td><td style="padding:10px 12px;color:'+gc+';font-weight:bold;">'+r.gp+'%</td><td style="padding:10px 12px;color:var(--brand-accent);">$'+Number(r.price||0).toFixed(2)+'</td><td style="padding:10px 12px;font-weight:bold;">'+(r.coversPerWeek||0)+'/wk</td></tr>';
        }).join('');
        return '<div class="card" style="padding:0;overflow:hidden;border-top:4px solid '+cat.color+';background:'+cat.bg+';">' +
            '<div style="padding:15px 20px;border-bottom:1px solid var(--border);"><h3 style="margin:0;color:'+cat.color+';">'+cat.label+' <span style="font-size:13px;background:'+cat.color+';color:white;padding:2px 8px;border-radius:10px;font-weight:normal;">'+items.length+'</span></h3><p style="margin:4px 0 0 0;font-size:12px;color:var(--text-muted);">'+cat.desc+'</p></div>' +
            (items.length===0?'<p style="padding:15px 20px;color:var(--text-muted);font-size:13px;margin:0;">No items.</p>':'<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;background:rgba(0,0,0,0.2);"><th style="padding:8px 12px;text-align:left;">Recipe</th><th style="padding:8px 12px;">GP%</th><th style="padding:8px 12px;">Sell</th><th style="padding:8px 12px;">Covers</th></tr></thead><tbody>'+rows+'</tbody></table></div>') +
        '</div>';
    }).join('');
    return '<div style="max-width:1100px;margin:auto;">' +
        window._marginsTabBar('menu-engineering') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div><h2 style="margin:0;">🎯 Menu Engineering Matrix</h2><small style="color:var(--text-muted);">Avg GP: '+avgGp.toFixed(1)+'% · Avg Volume: '+avgCovers.toFixed(0)+' covers/wk · '+menuRecipes.length+' active items</small></div>' +
        '</div>' +
        warnHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;margin-bottom:25px;">' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--green);"><div style="font-size:34px;font-weight:bold;color:var(--green);">'+counts.star+'</div><div style="font-size:12px;color:var(--text-muted);">⭐ Stars</div></div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--blue);"><div style="font-size:34px;font-weight:bold;color:var(--blue);">'+counts.puzzle+'</div><div style="font-size:12px;color:var(--text-muted);">🧩 Puzzles</div></div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--orange);"><div style="font-size:34px;font-weight:bold;color:var(--orange);">'+counts.plowhorse+'</div><div style="font-size:12px;color:var(--text-muted);">🐴 Plow Horses</div></div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--red);"><div style="font-size:34px;font-weight:bold;color:var(--red);">'+counts.dog+'</div><div style="font-size:12px;color:var(--text-muted);">🐶 Dogs</div></div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px;">'+quadHtml+'</div></div>';
};

// =============================================================================
// 5. AUTO-ORDER / PREP LIST
// =============================================================================


// =============================================================================
// AI ORDER SUGGESTER
// Smart quantities based on depletion history + PAR + delivery schedule
// =============================================================================
window.openAiOrderSuggester = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    const statusDiv = document.getElementById('ai-order-status');
    const resultsDiv = document.getElementById('ai-order-results');
    if (!statusDiv) return;

    statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:12px;color:var(--purple);font-weight:bold;">🤖 Analysing stock levels and depletion history...</div>';
    resultsDiv.innerHTML = '';

    const isWeekend = [0,5,6].includes(new Date().getDay());
    const today = new Date();
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];

    // Build item context for AI
    const items = (window.inventoryItems||[]).filter(i => !i.archived);
    const belowPar = items.filter(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return i.stock < par;
    });

    // Analyse depletion history per item
    const depHistory = window.depletionLogs || [];
    const getAvgDepletion = (itemId) => {
        const allDepletes = depHistory.flatMap(log =>
            (log.changes||[]).filter(c => c.id === itemId).map(c => Math.abs(c.delta||0))
        );
        return allDepletes.length > 0 ? allDepletes.reduce((a,b)=>a+b,0)/allDepletes.length : null;
    };

    // Build supplier context
    const suppliers = window.suppliers || [];
    const supContext = suppliers.map(s =>
        s.name + ': delivers on ' + (s.deliveryDays||[]).join('/') + ', min spend $' + (s.minSpend||0) + ', cutoff ' + (s.cutoff||'no cutoff')
    ).join(' | ');

    // Build items needing order with depletion context
    const itemContext = belowPar.map(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        const deficit = par - i.stock;
        const avgDep = getAvgDepletion(i.id);
        return `${i.name} (${i.supplier||'unassigned'}): stock=${Number(i.stock).toFixed(1)} ${i.buyUnit}, PAR=${par}, deficit=${deficit.toFixed(1)}, avg daily depletion=${avgDep ? avgDep.toFixed(2) : 'unknown'}`;
    }).join('\n');

    if (belowPar.length === 0) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ All inventory is at or above PAR. Nothing to order right now.</div>';
        return;
    }

    const prompt = `You are a smart ordering assistant for Bar Wa Izakaya, a Japanese izakaya bar in Hobart, Tasmania.

Today is ${today.toLocaleDateString('en-AU', {weekday:'long',day:'numeric',month:'long'})} (${dayName}).

SUPPLIER DELIVERY SCHEDULE:
${supContext || 'No supplier schedule set'}

ITEMS BELOW PAR (need ordering):
${itemContext}

For each item, suggest:
1. How much to order (considering: deficit, avg depletion rate, upcoming deliveries, whether to order extra buffer)
2. Which day to place the order (based on delivery days)
3. A brief reason for your recommendation

Return ONLY a JSON array:
[{
  "itemName": "string",
  "supplier": "string",
  "currentStock": number,
  "suggestedOrder": number,
  "unit": "string",
  "orderDay": "string",
  "urgency": "high|medium|low",
  "reason": "string (max 15 words)"
}]

Only include items that genuinely need ordering. Be practical — don't over-order.`;

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        const suggestions = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g,'').trim());

        window._aiOrderSuggestions = suggestions;
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ AI analysis complete — ' + suggestions.length + ' items reviewed</div>';

        // Group by supplier
        const bySup = {};
        suggestions.forEach(s => {
            if (!bySup[s.supplier]) bySup[s.supplier] = [];
            bySup[s.supplier].push(s);
        });

        const urgencyColor = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--text-muted)' };
        const urgencyLabel = { high: '🔴 Urgent', medium: '🟡 Soon', low: '🟢 Low' };

        const html = Object.entries(bySup).map(([sup, items]) => { window._aoSup = sup;
            const rows = items.map(item =>
                '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:7px 10px;"><strong style="font-size:13px;">' + esc(item.itemName) + '</strong><br>' +
                    '<small style="color:var(--text-muted);">Currently: ' + Number(item.currentStock).toFixed(1) + ' ' + item.unit + '</small></td>' +
                '<td style="padding:7px 10px;font-weight:bold;font-size:14px;color:var(--blue);">' + Number(item.suggestedOrder).toFixed(1) + ' <small style="font-size:12px;color:var(--text-muted);">' + item.unit + '</small></td>' +
                '<td style="padding:10px 12px;font-size:12px;color:var(--text-muted);">' + (item.orderDay||'ASAP') + '</td>' +
                '<td style="padding:10px 12px;"><span style="font-size:11px;color:' + (urgencyColor[item.urgency]||'var(--text-muted)') + ';">' + (urgencyLabel[item.urgency]||'') + '</span></td>' +
                '<td style="padding:10px 12px;font-size:12px;color:var(--text-muted);font-style:italic;">' + esc(item.reason) + '</td>' +
                '</tr>'
            ).join('');

            return '<div class="card" style="border-top:4px solid var(--purple);margin-bottom:12px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">' +
                    '<h3 style="margin:0;font-size:15px;">' + esc(sup) + '</h3>' +
                    '<button onclick="window.generateAiOrderEmail(window._aoSup)" class="btn btn-purple" style="font-size:12px;">✉️ Generate Order Email</button>' +
                '</div>' +
                '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                '<th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;">Suggest Order</th><th style="padding:8px 12px;">Order Day</th><th style="padding:8px 12px;">Urgency</th><th style="padding:8px 12px;">Reason</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '</div>';
        }).join('');

        resultsDiv.innerHTML = html;

    } catch(e) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);">AI Error: ' + e.message + '</div>';
    }
};

window.generateAiOrderEmail = (supName) => {
    const suggestions = (window._aiOrderSuggestions||[]).filter(s=>s.supplier===supName);
    if (suggestions.length === 0) return window.showToast('No suggestions for ' + supName, 'error');

    const lines = suggestions.map(s => '- ' + Number(s.suggestedOrder).toFixed(1) + 'x ' + s.unit + ' of ' + s.itemName).join('\n');
    const text = 'Hi ' + supName + ',\n\nCould I please place an order for the following:\n\n' + lines + '\n\nThanks,\nBar Wa Izakaya';

    // Log the order
    if (!window.orderHistory) window.orderHistory = [];
    window.orderHistory.push({
        date: new Date().toLocaleDateString('en-AU'),
        supplier: supName,
        estSpend: suggestions.reduce((sum,s)=>sum+(Number(s.suggestedOrder)*((window.inventoryItems||[]).find(i=>i.name===s.itemName)?.price||0)),0),
        items: suggestions.map(s=>({ name:s.itemName, qty:s.suggestedOrder, unit:s.unit, price:(window.inventoryItems||[]).find(i=>i.name===s.itemName)?.price||0 })),
        aiGenerated: true
    });
    window.saveToDisk();

    navigator.clipboard.writeText(text).then(() => window.showToast('AI order email copied for ' + supName + '!'));
};

window.renderAiOrderView = () => {
    return '<div style="max-width:900px;margin:auto;">' +
        window._orderTabBar('ai-order') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">✨ AI Order Suggester</h2>' +
            '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Analyses stock levels, depletion history, and delivery schedules to suggest smart order quantities.</p></div>' +
            '<button onclick="window.openAiOrderSuggester()" class="btn btn-purple" style="font-size:16px;padding:12px 24px;">✨ Run AI Analysis</button>' +
        '</div>' +
        '<div id="ai-order-status" style="margin-bottom:15px;"></div>' +
        '<div id="ai-order-results"></div>' +
    '</div>';
};


// =============================================================================
// LIGHTSPEED REPORT IMPORTER
// Handles Sales By, Guests, and Reconciliation CSVs
// =============================================================================
window.renderLightspeedImportView = () => {
    return '<div style="max-width:900px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div>' +
                '<h2 style="margin:0;">📥 Lightspeed Import</h2>' +
                '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Drop your Lightspeed CSV exports here — Sales By, Guests, or Reconciliation. The Hub detects each type automatically.</p>' +
            '</div>' +
            '<button onclick="window.showView(\'invoice\')" class="btn btn-outline" style="font-size:12px;">🧾 Invoice Ripper</button>' +
        '</div>' +

        // Drop zone
        '<div id="ls-dropzone" style="border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:20px;" ' +
            'onclick="document.getElementById(\'ls-file-input\').click()" ' +
            'ondragover="event.preventDefault();this.style.borderColor=\'#3b82f6\';this.style.background=\'rgba(59,130,246,0.05)\';" ' +
            'ondragleave="this.style.borderColor=\'#2a2a35\';this.style.background=\'\';" ' +
            'ondrop="event.preventDefault();this.style.borderColor=\'#2a2a35\';this.style.background=\'\';window.handleLsFiles(event.dataTransfer.files);">' +
            '<div style="font-size:48px;margin-bottom:10px;">📊</div>' +
            '<div style="font-size:16px;font-weight:bold;margin-bottom:5px;">Drop Lightspeed CSV files here</div>' +
            '<div style="font-size:13px;color:var(--text-muted);">Or click to browse · Accepts Sales By, Guests, and Reconciliation reports</div>' +
            '<input type="file" id="ls-file-input" multiple accept=".csv" style="display:none;" onchange="window.handleLsFiles(this.files)">' +
        '</div>' +

        // Date range selector
        '<div class="card" style="padding:15px;margin-bottom:20px;">' +
            '<div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;">' +
                '<div style="font-size:13px;color:var(--text-muted);font-weight:bold;">Import date range:</div>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                    '<input type="radio" name="ls-mode" value="all" checked onchange="window._lsMode=\'all\'"> All dates in file' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                    '<input type="radio" name="ls-mode" value="today" onchange="window._lsMode=\'today\'"> Today only' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                    '<input type="radio" name="ls-mode" value="week" onchange="window._lsMode=\'week\'"> This week' +
                '</label>' +
            '</div>' +
        '</div>' +

        // Results area
        '<div id="ls-results"></div>' +

        // Recent imports log
        '<div style="margin-top:25px;">' +
            '<h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Recent Imports</h3>' +
            ((window.lsImportLog||[]).length === 0 ?
                '<p style="color:var(--text-muted);font-size:13px;">No imports yet.</p>' :
                (window.lsImportLog||[]).slice(-10).reverse().map(log =>
                    '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed var(--border);font-size:13px;">' +
                        '<span>' + esc(log.icon) + ' <strong>' + esc(log.type) + '</strong> — ' + esc(log.summary) + '</span>' +
                        '<span style="color:var(--text-muted);">' + log.time + '</span>' +
                    '</div>'
                ).join('')
            ) +
        '</div>' +
    '</div>';
};

window._lsMode = 'all';

window.handleLsFiles = (files) => {
    if (!files || files.length === 0) return;
    const results = document.getElementById('ls-results');
    results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Processing files...</div>';

    const fileArr = Array.from(files);
    let processed = 0;
    const summaries = [];

    fileArr.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const summary = window.processLsFile(file.name, text);
            summaries.push(summary);
            processed++;
            if (processed === fileArr.length) {
                window.saveToDisk();
                window.showLsResults(summaries);
            }
        };
        reader.readAsText(file);
    });
};

window.processLsFile = (filename, text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return { type: 'Unknown', icon: '❓', status: 'error', message: 'File appears empty' };

    const header = lines[0].toLowerCase();

    if (header.includes('product') && header.includes('quantity') && header.includes('sale amount')) {
        return window.parseLsSalesBy(lines);
    } else if (header.includes('guest count') && header.includes('avg per guest')) {
        return window.parseLsGuests(lines);
    } else if (header.includes('cashup') || header.includes('recorded') && header.includes('counted')) {
        return window.parseLsReconciliation(lines);
    } else {
        return { type: 'Unknown', icon: '❓', status: 'error', message: 'Could not identify report type. Expected Sales By, Guests, or Reconciliation CSV.' };
    }
};

// Parse CSV line handling quoted fields
window.parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += line[i]; }
    }
    result.push(current.trim());
    return result;
};

// ---- SALES BY PARSER ----
window.parseLsSalesBy = (lines) => {
    const rows = lines.slice(1).map(l => window.parseCsvLine(l));
    let totalSales = 0, totalCost = 0, matched = 0, depleted = 0;
    const productSales = [];

    rows.forEach(r => {
        const name = r[2] || '';
        const qty = parseFloat(r[3]) || 0;
        const saleAmt = parseFloat(r[5]) || 0;
        const cost = parseFloat(r[7]) || 0;
        const gpPct = parseFloat(r[8]) || 0;
        if (!name || qty === 0) return;

        totalSales += saleAmt;
        totalCost += cost;
        productSales.push({ name, qty, saleAmt, cost, gpPct });

        // Match to inventory and deplete
        const invMatch = (window.inventoryItems||[]).find(i =>
            !i.archived && (
                i.name.toLowerCase() === name.toLowerCase() ||
                (i.posAlias && i.posAlias.toLowerCase() === name.toLowerCase()) ||
                name.toLowerCase().includes(i.name.toLowerCase().substring(0,6))
            )
        );
        if (invMatch) {
            matched++;
            // Deplete by qty in use units
            const depletion = qty * (invMatch.useToBy || 1);
            invMatch.stock = Math.max(0, (invMatch.stock || 0) - depletion);
            depleted++;
        }
    });

    // Calculate food vs bev split
    const foodKeywords = ['gyoza','chicken','edamame','rice','salad','pork','beef','wagyu','tofu','tempura','katsu','takoyaki','karaage','dumpling','noodle','ramen','curry','soup'];
    const bevKeywords = ['sapporo','beer','wine','sake','whisky','whiskey','cocktail','negroni','spritz','gin','rum','vodka','tequila','spirits','shochu','umeshu','yuzu','soda','juice','tea','coffee'];

    let foodSales = 0, bevSales = 0;
    productSales.forEach(p => {
        const nameLower = p.name.toLowerCase();
        const isBev = bevKeywords.some(k => nameLower.includes(k));
        const isFood = foodKeywords.some(k => nameLower.includes(k));
        if (isBev) bevSales += p.saleAmt;
        else if (isFood) foodSales += p.saleAmt;
    });

    // Store for food/bev split
    const today = new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/');
    if (!window.lsSalesByData) window.lsSalesByData = {};
    window.lsSalesByData[today] = { products: productSales, totalSales, totalCost, foodSales, bevSales };

    if (!window.lsImportLog) window.lsImportLog = [];
    window.lsImportLog.push({ type:'Sales By', icon:'📊', summary: productSales.length + ' products · $' + totalSales.toFixed(0) + ' revenue · ' + depleted + ' inventory items depleted', time: new Date().toLocaleTimeString() });

    return {
        type: 'Sales By',
        icon: '📊',
        status: 'success',
        rows: productSales.length,
        totalSales,
        totalCost,
        foodSales,
        bevSales,
        matched,
        depleted,
        products: productSales.slice(0,10)
    };
};

// ---- GUESTS PARSER ----
window.parseLsGuests = (lines) => {
    const rows = lines.slice(1).map(l => window.parseCsvLine(l));
    let imported = 0;

    rows.forEach(r => {
        const rawDate = r[0] || '';
        const guests = parseInt(r[1]) || 0;
        const total = parseFloat(r[5]) || 0;
        const avgPerGuest = parseFloat(r[6]) || 0;

        if (!rawDate || !guests) return;

        // Convert YYYY-MM-DD to DD/MM/YYYY
        const parts = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) return;
        const dateStr = parts[3] + '/' + parts[2] + '/' + parts[1];

        // Apply mode filter
        if (window._lsMode === 'today') {
            const today = new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/');
            if (dateStr !== today) return;
        } else if (window._lsMode === 'week') {
            const d = new Date(rawDate);
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
            if (d < weekAgo) return;
        }

        // Update or add to salesData
        if (!window.salesData) window.salesData = [];
        const idx = window.salesData.findIndex(s => s.date === dateStr);
        if (idx >= 0) {
            window.salesData[idx].covers = guests;
            window.salesData[idx].avgSpend = avgPerGuest;
            if (!window.salesData[idx].total && total) window.salesData[idx].total = total;
        } else {
            window.salesData.push({ date: dateStr, covers: guests, avgSpend: avgPerGuest, total, eftpos: 0, cash: 0 });
        }
        imported++;
    });

    if (!window.lsImportLog) window.lsImportLog = [];
    window.lsImportLog.push({ type:'Guests', icon:'👥', summary: imported + ' days imported', time: new Date().toLocaleTimeString() });

    return { type:'Guests', icon:'👥', status:'success', imported, rows };
};

// ---- RECONCILIATION PARSER ----
window.parseLsReconciliation = (lines) => {
    const rows = lines.slice(1).map(l => window.parseCsvLine(l));
    let imported = 0;
    const byDate = {};
    const warnings = [];

    rows.forEach(r => {
        const cashupNum = r[0];
        const rawDate = r[1] || '';
        const register = r[3] || '';
        const staffRaw = r[4] || '';
        const counted = parseFloat(r[5]) || 0;
        const recorded = parseFloat(r[6]) || 0;
        const variance = parseFloat(r[7]) || 0;

        // Parse date from "2026-03-16 09:01:21"
        const datePart = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
        if (!datePart) return;
        const ymd = datePart[1];
        const parts = ymd.match(/(\d{4})-(\d{2})-(\d{2})/);
        const dateStr = parts[3] + '/' + parts[2] + '/' + parts[1];

        // Clean staff name — strip leading numbers and punctuation
        const staff = staffRaw.replace(/^[\d\s\.\-_]+/, '').trim();

        // Apply mode filter
        if (window._lsMode === 'today') {
            const today = new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/');
            if (dateStr !== today) return;
        } else if (window._lsMode === 'week') {
            const d = new Date(ymd);
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
            if (d < weekAgo) return;
        }

        // Sum across registers for same date
        if (!byDate[dateStr]) byDate[dateStr] = { recorded: 0, counted: 0, variance: 0, staff, registers: [] };
        byDate[dateStr].recorded += recorded;
        byDate[dateStr].counted += counted;
        byDate[dateStr].variance += variance;
        byDate[dateStr].registers.push(register);

        // Flag large variances
        if (Math.abs(variance) > 200) {
            warnings.push({ date: dateStr, register, variance, staff });
        }
    });

    // Update salesData
    Object.entries(byDate).forEach(([dateStr, data]) => {
        if (!window.salesData) window.salesData = [];
        const idx = window.salesData.findIndex(s => s.date === dateStr);
        const entry = {
            date: dateStr,
            total: data.recorded,
            eftpos: Math.max(0, data.recorded - Math.abs(data.counted < data.recorded ? data.recorded - data.counted : 0)),
            cash: data.counted,
            cashVariance: data.variance,
            staffCashUp: data.staff
        };
        if (idx >= 0) {
            window.salesData[idx] = { ...window.salesData[idx], ...entry };
        } else {
            window.salesData.push(entry);
        }
        imported++;
    });

    if (!window.lsImportLog) window.lsImportLog = [];
    window.lsImportLog.push({ type:'Reconciliation', icon:'💳', summary: imported + ' days · ' + (warnings.length > 0 ? warnings.length + ' variance alerts' : 'no variance issues'), time: new Date().toLocaleTimeString() });

    return { type:'Reconciliation', icon:'💳', status:'success', imported, warnings, byDate };
};

// ---- DISPLAY RESULTS ----
window.showLsResults = (summaries) => {
    const el = document.getElementById('ls-results');
    if (!el) return;

    const html = summaries.map(s => {
        if (s.status === 'error') {
            return '<div class="card" style="border-left:4px solid var(--red);padding:15px;margin-bottom:15px;">' +
                '<div style="font-weight:bold;color:var(--red);">❓ Unknown file type</div>' +
                '<div style="font-size:13px;color:var(--text-muted);margin-top:5px;">' + esc(s.message) + '</div>' +
            '</div>';
        }

        if (s.type === 'Sales By') {
            const foodPct = s.totalSales > 0 ? (s.foodSales/s.totalSales*100).toFixed(1) : 0;
            const bevPct = s.totalSales > 0 ? (s.bevSales/s.totalSales*100).toFixed(1) : 0;
            const topProducts = s.products.slice(0,5).map(p =>
                '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--border);font-size:12px;">' +
                '<span>' + esc(p.name.substring(0,35)) + '</span>' +
                '<span style="color:var(--green);">$' + p.saleAmt.toFixed(0) + ' · ' + p.qty + ' sold</span>' +
                '</div>'
            ).join('');

            return '<div class="card" style="border-left:4px solid var(--green);margin-bottom:15px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
                    '<div><strong style="font-size:16px;">📊 Sales By — Imported</strong><br>' +
                    '<small style="color:var(--text-muted);">' + s.rows + ' products · ' + s.depleted + ' inventory items depleted</small></div>' +
                    '<div style="text-align:right;"><div style="font-size:22px;font-weight:bold;color:var(--green);">$' + s.totalSales.toFixed(0) + '</div><small style="color:var(--text-muted);">Total revenue</small></div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
                    '<div style="background:var(--bg-main);padding:10px;border-radius:8px;text-align:center;">' +
                        '<div style="font-size:11px;color:var(--orange);text-transform:uppercase;">🍱 Food</div>' +
                        '<div style="font-size:20px;font-weight:bold;">$' + s.foodSales.toFixed(0) + '</div>' +
                        '<div style="font-size:11px;color:var(--text-muted);">' + foodPct + '% of sales</div>' +
                    '</div>' +
                    '<div style="background:var(--bg-main);padding:10px;border-radius:8px;text-align:center;">' +
                        '<div style="font-size:11px;color:var(--blue);text-transform:uppercase;">🍶 Beverage</div>' +
                        '<div style="font-size:20px;font-weight:bold;">$' + s.bevSales.toFixed(0) + '</div>' +
                        '<div style="font-size:11px;color:var(--text-muted);">' + bevPct + '% of sales</div>' +
                    '</div>' +
                '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);font-weight:bold;margin-bottom:5px;">TOP SELLERS</div>' +
                topProducts +
            '</div>';
        }

        if (s.type === 'Guests') {
            return '<div class="card" style="border-left:4px solid var(--blue);margin-bottom:15px;">' +
                '<strong style="font-size:16px;">👥 Guests — Imported</strong><br>' +
                '<small style="color:var(--text-muted);">' + s.imported + ' days of covers data added to takings</small>' +
            '</div>';
        }

        if (s.type === 'Reconciliation') {
            const warningHtml = s.warnings.length > 0 ?
                '<div style="margin-top:12px;">' +
                '<div style="font-size:12px;color:var(--red);font-weight:bold;margin-bottom:5px;">⚠️ VARIANCE ALERTS</div>' +
                s.warnings.map(w =>
                    '<div style="font-size:12px;padding:5px 0;border-bottom:1px dashed var(--border);display:flex;justify-content:space-between;">' +
                    '<span>' + esc(w.date) + ' · ' + esc(w.register) + ' · ' + esc(w.staff) + '</span>' +
                    '<span style="color:var(--red);font-weight:bold;">$' + w.variance.toFixed(2) + '</span>' +
                    '</div>'
                ).join('') + '</div>' : '';

            return '<div class="card" style="border-left:4px solid var(--purple);margin-bottom:15px;">' +
                '<strong style="font-size:16px;">💳 Reconciliation — Imported</strong><br>' +
                '<small style="color:var(--text-muted);">' + s.imported + ' days of takings imported from Lightspeed</small>' +
                warningHtml +
            '</div>';
        }

        return '';
    }).join('');

    el.innerHTML = html;
    window.showView('lightspeed-import'); // refresh to update recent imports log
};

window.renderPrepListView = () => {
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    const currentDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

    const ordersNeeded = (window.inventoryItems || []).filter(i => {
        if (i.archived) return false;
        let parTarget = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        return i.stock < parTarget;
    }).reduce((acc, item) => {
        if (!acc[item.supplier]) acc[item.supplier] = { items: [], totalSpend: 0, supObj: window.suppliers.find(s => s.name === item.supplier) };
        let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
        let qtyToOrder = parTarget - item.stock;
        acc[item.supplier].items.push({ ...item, toOrder: qtyToOrder });
        acc[item.supplier].totalSpend += (qtyToOrder * (item.price || 0));
        return acc;
    }, {});

    return `
    <div style="max-width: 900px; margin: auto;">
        ${window._orderTabBar('prep-list')}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0">📝 Order Hub</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Targeting <strong style="color:var(--blue);">${isWeekend ? 'WEEKEND' : 'WEEKDAY'}</strong> PAR levels — items below par grouped by supplier</div>
            </div>
            <button onclick="window.showView(\'inventory\')" class="btn btn-outline">Update Stock Levels</button>
        </div>
        ${Object.keys(ordersNeeded).length === 0 ? '<div class="card"><p style="color:var(--green); font-weight:bold; font-size:18px;">✅ All inventory is at or above PAR. Nothing to order!</p></div>' : ''}
        ${Object.keys(ordersNeeded).map(supName => {
            const data = ordersNeeded[supName];
            const supObj = data.supObj || { minSpend: 0, deliveryDays: null };
            const meetsMin = data.totalSpend >= supObj.minSpend;
            const validDay = !supObj.deliveryDays || supObj.deliveryDays.length === 0 || supObj.deliveryDays.includes(currentDay);
            let warningHtml = '';
            if (!meetsMin) warningHtml += `<span style="color:var(--red); font-size:12px; margin-right:10px;">⚠️ Under Min Spend ($${data.totalSpend.toFixed(2)} / $${supObj.minSpend})</span>`;
            if (!validDay) warningHtml += `<span style="color:var(--orange); font-size:12px;">🚫 No Delivery on ${currentDay}</span>`;
            return `
            <div class="card" style="border-top:4px solid var(--blue); margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h3 style="margin:0;">${supName === 'null' || supName === '' ? 'Unassigned Supplier' : esc(supName)}</h3>
                        <div style="margin-top:5px;">${warningHtml || `<span style="color:var(--green); font-size:12px;">✓ Ready to Order (Est. $${data.totalSpend.toFixed(2)})</span>`}</div>
                    </div>
                    <button onclick="window.copyOrderText('${supName}', ${data.totalSpend})" class="btn btn-outline" style="font-size:11px; padding:6px 12px;">📋 Copy Order Text</button>
                </div>
                <table style="width:100%; font-size:14px; text-align:left; border-collapse:collapse;">
                    <tbody>
                        ${data.items.map(o => `
                        <tr style="border-bottom:1px dashed var(--bg-main);">
                            <td style="padding:7px 0;"><strong style="font-size:13px;">${esc(o.name)}</strong> <small style="color:var(--text-muted);">[${esc(o.sku || 'No SKU')}]</small></td>
                            <td style="padding:7px 0; font-size:12px; color:var(--text-muted);">Stock: ${o.stock} / PAR: ${isWeekend ? o.parWeekend : o.parWeekday}</td>
                            <td style="padding:7px 0; text-align:right; color:var(--brand-accent); font-weight:bold; font-size:14px;">Order: ${o.toOrder.toFixed(1)} <small>${o.buyUnit || 'Unit'}</small></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }).join('')}
    </div>`;
};

window.copyOrderText = (supName, estSpend) => {
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    const items = (window.inventoryItems || []).filter(i => i.supplier === supName && !i.archived && i.stock < (isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0)));
    let text = `Hi ${supName},\n\nCould I please place an order for the following:\n\n`;
    const orderItems = [];
    items.forEach(i => {
        let par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        const qty = (par - i.stock).toFixed(1);
        text += `- ${qty}x ${i.buyUnit || 'Unit'} of ${i.name} ${i.sku ? `[${i.sku}]` : ''}\n`;
        orderItems.push({ name: i.name, sku: i.sku||'', qty, unit: i.buyUnit||'Unit', price: i.price||0 });
    });
    text += `\nThanks,\nBar Wa Izakaya`;
    if (!window.orderHistory) window.orderHistory = [];
    window.orderHistory.push({ date: new Date().toLocaleDateString('en-AU'), supplier: supName, estSpend, items: orderItems });
    window.saveToDisk();
    navigator.clipboard.writeText(text).then(() => window.showToast(`Order copied & logged for ${supName}!`));
};

// =============================================================================
// 6. WASTAGE TRACKER
// =============================================================================

window._buildWasteChart = () => {
    const logs = window.wastageLogs || [];
    const now = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // Find Monday of current week
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    const dow = monday.getDay();
    monday.setDate(monday.getDate() - ((dow + 6) % 7));

    const daily = [0,0,0,0,0,0,0]; // Mon-Sun
    logs.forEach(w => {
        const d = new Date(w.time);
        if (isNaN(d)) return;
        const diff = Math.floor((d - monday) / 86400000);
        if (diff >= 0 && diff < 7) daily[diff] += Number(w.value || 0);
    });

    const maxVal = Math.max(...daily, 1);
    const W = 100, H = 150, pad = 30, barGap = 4;
    const barW = (W - pad - 5) / 7 - barGap;
    const chartH = H - pad - 10;

    const bars = daily.map((v, i) => {
        const x = pad + i * (barW + barGap) + barGap / 2;
        const bH = (v / maxVal) * chartH;
        const y = H - pad - bH;
        const col = v === 0 ? 'rgba(255,255,255,0.08)' : v < 20 ? '#22c55e' : v <= 50 ? '#f59e0b' : '#ef4444';
        const dayIdx = (1 + i) % 7; // Mon=1..Sun=0
        const label = dayNames[dayIdx];
        const isToday = i === ((now.getDay() + 6) % 7);
        return `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(bH, 1)}" rx="2" fill="${col}" opacity="${v === 0 ? 0.3 : 0.85}"/>` +
            (v > 0 ? `<text x="${x + barW/2}" y="${y - 3}" text-anchor="middle" fill="var(--text-muted)" font-size="3.5">$${v.toFixed(0)}</text>` : '') +
            `<text x="${x + barW/2}" y="${H - pad + 9}" text-anchor="middle" fill="${isToday ? '#fff' : 'var(--text-muted)'}" font-size="3.5" font-weight="${isToday ? '700' : '400'}">${label}</text>`;
    }).join('');

    // Y-axis labels
    const yLabels = [0, Math.round(maxVal/2), Math.round(maxVal)].map((v, i) => {
        const y = H - pad - (v / maxVal) * chartH;
        return `<text x="${pad - 2}" y="${y + 1.5}" text-anchor="end" fill="var(--text-muted)" font-size="3.2">$${v}</text>` +
            `<line x1="${pad}" y1="${y}" x2="${W - 2}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="0.3"/>`;
    }).join('');

    const weekTotal = daily.reduce((s, v) => s + v, 0);
    return `<div class="card" style="padding:12px 10px 8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">This Week's Waste</span>
            <span style="font-size:14px;font-weight:700;color:${weekTotal > 200 ? 'var(--red)' : weekTotal > 100 ? 'var(--orange)' : 'var(--green)'};">$${weekTotal.toFixed(2)}</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:150px;">
            ${yLabels}${bars}
        </svg>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:4px;">
            <span style="font-size:10px;color:var(--text-muted);"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#22c55e;margin-right:3px;vertical-align:middle;"></span>&lt;$20</span>
            <span style="font-size:10px;color:var(--text-muted);"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f59e0b;margin-right:3px;vertical-align:middle;"></span>$20-50</span>
            <span style="font-size:10px;color:var(--text-muted);"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ef4444;margin-right:3px;vertical-align:middle;"></span>&gt;$50</span>
        </div>
    </div>`;
};

window.renderWastageView = () => {
    const invOpts = (window.inventoryItems || []).filter(i => !i.archived).map(i =>
        `<option value="${esc(i.id)}">${esc(i.name)} (Buy: ${esc(i.buyUnit)} / Use: ${esc(i.useUnit)})</option>`
    ).join('');
    const logs = window.wastageLogs || [];
    const recentLogs = logs.slice().reverse().slice(0, 50);
    return `
    <div style="max-width: 800px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🗑️ Wastage Tracker</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Log spoilage, breakage, and expired stock to track and reduce waste</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="window.showWastageReport()" class="btn btn-outline" style="font-size:12px;">📊 Wastage Report</button>
            </div>
        </div>
        ${window._buildWasteChart()}
        <div class="card" style="border-top:5px solid var(--orange);">
            <div style="margin-bottom:15px;">
                <label style="font-size:11px; color:var(--text-muted);">Select Live Inventory Item</label>
                <select id="w-item" class="input-box" style="margin:0;"><option value="">-- Choose Item --</option>${invOpts}</select>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px; background:var(--bg-main); padding:15px; border-radius:6px; border:1px solid var(--border);">
                <div>
                    <label style="font-size:11px; color:var(--text-muted);">Quantity Wasted</label>
                    <input type="number" step="0.01" id="w-qty" class="input-box" placeholder="e.g. 1.5" style="margin:0;">
                </div>
                <div style="display:flex; flex-direction:column; justify-content:center;">
                    <label style="font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <input type="radio" name="w-unit-type" id="w-buy" value="buy" checked style="transform:scale(1.2);">
                        Buy Units <small style="color:var(--text-muted); font-weight:normal;">(Bottles, Kegs etc)</small>
                    </label>
                    <label style="font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px; margin-top:10px;">
                        <input type="radio" name="w-unit-type" id="w-use" value="use" style="transform:scale(1.2);">
                        Use Units <small style="color:var(--text-muted); font-weight:normal;">(ml, kg, shots)</small>
                    </label>
                </div>
            </div>
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                <div><label style="font-size:11px; color:var(--text-muted);">Reason</label><input type="text" id="w-rsn" class="input-box" placeholder="Dropped, Expired, Spilled..."></div>
                <div><label style="font-size:11px; color:var(--text-muted);">Staff Name</label><input type="text" id="w-staff" class="input-box" placeholder="Initials"></div>
            </div>
            <button onclick="window.logWastage()" class="btn btn-orange" style="width:100%; margin-top:10px; font-size:14px;">Log Waste & Deduct Stock</button>
        </div>
        ${recentLogs.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🗑️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No wastage logged</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Log spoilage, breakage, or expired stock to track and reduce waste</div></div>' :
        '<h3 style="margin-top:30px; border-bottom:1px solid var(--border); padding-bottom:10px;">Recent Logs</h3>' +
        recentLogs.map(w =>
            `<div class="card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${esc(w.itemName)}</strong> <span style="color:var(--orange); font-size:13px;">(${esc(String(w.logQty))} ${esc(w.unitLog)})</span><br><small style="color:var(--text-muted);">${esc(w.staff)} - ${esc(w.reason)}</small></div>
                <div style="text-align:right;"><strong style="color:var(--red);">$${Number(w.value).toFixed(2)} Lost</strong><br><small style="color:var(--text-muted);">${esc(w.time)}</small></div>
            </div>`
        ).join('')}
    </div>`;
};


// =============================================================================
// WASTAGE REPORT
// =============================================================================
window.showWastageReport = () => {
    const logs = window.wastageLogs || [];
    if (logs.length === 0) return window.showToast('No wastage logged yet.','error');

    // Last 30 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
    const recent = logs.filter(w => new Date(w.time) >= cutoff);
    const totalVal = recent.reduce((s,w) => s + Number(w.value||0), 0);

    // By item
    const byItem = {};
    recent.forEach(w => {
        if (!byItem[w.itemName]) byItem[w.itemName] = { count:0, value:0, category: w.category||'Uncategorised' };
        byItem[w.itemName].count++;
        byItem[w.itemName].value += Number(w.value||0);
    });
    const topItems = Object.entries(byItem).sort((a,b)=>b[1].value-a[1].value).slice(0,10);

    // By category (food vs bev)
    const byReason = {};
    recent.forEach(w => {
        const r = w.reason || 'Unknown';
        if (!byReason[r]) byReason[r] = 0;
        byReason[r] += Number(w.value||0);
    });
    const topReasons = Object.entries(byReason).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const rows = topItems.map(([name, d]) =>
        '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:8px 12px;">' + esc(name) + '</td>' +
        '<td style="padding:8px 12px;text-align:center;">' + d.count + '</td>' +
        '<td style="padding:8px 12px;text-align:right;color:var(--red);font-weight:bold;">$' + d.value.toFixed(2) + '</td>' +
        '<td style="padding:8px 12px;"><div style="background:var(--red);height:6px;border-radius:3px;width:' + Math.min(100,(d.value/totalVal*100)).toFixed(0) + '%;opacity:0.7;"></div></td>' +
        '</tr>'
    ).join('');

    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--red);">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Lost (30 days)</div>' +
            '<div style="font-size:24px;font-weight:bold;color:var(--red);">$' + totalVal.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Incidents (30 days)</div>' +
            '<div style="font-size:24px;font-weight:bold;color:var(--orange);">' + recent.length + '</div>' +
        '</div>' +
    '</div>' +
    '<h4 style="margin:0 0 10px 0;color:var(--text-muted);font-size:12px;text-transform:uppercase;">Top Wasted Items</h4>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">' +
    '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
    '<th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;text-align:center;">Count</th><th style="padding:8px 12px;text-align:right;">Value Lost</th><th style="padding:8px 12px;">Bar</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h4 style="margin:0 0 10px 0;color:var(--text-muted);font-size:12px;text-transform:uppercase;">Top Reasons</h4>' +
    topReasons.map(([r,v]) => '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;"><span>' + esc(r) + '</span><span style="color:var(--red);font-weight:bold;">$' + v.toFixed(2) + '</span></div>').join('');

    window.openModal('🗑️ Wastage Report — Last 30 Days', html);
};

window.logWastage = () => {
    const invId = document.getElementById('w-item').value;
    const qtyInput = parseFloat(document.getElementById('w-qty').value) || 0;
    if (!invId || !qtyInput) return window.showToast("Select item and enter quantity.", "error");
    const invMatch = window.inventoryItems.find(i => i.id === invId);
    if (!invMatch) return;
    const unitType = document.querySelector('input[name="w-unit-type"]:checked').value;
    let deductBuyUnits, dollarVal, displayUnit;
    if (unitType === 'use') {
        deductBuyUnits = qtyInput / (invMatch.yield || 1);
        dollarVal = deductBuyUnits * (invMatch.price || 0);
        displayUnit = invMatch.useUnit;
    } else {
        deductBuyUnits = qtyInput;
        dollarVal = qtyInput * (invMatch.price || 0);
        displayUnit = invMatch.buyUnit;
    }
    invMatch.stock = Math.max(0, (invMatch.stock || 0) - deductBuyUnits);
    window.wastageLogs.push({
        itemName: invMatch.name, logQty: qtyInput, unitLog: displayUnit,
        deductedBuyUnits: deductBuyUnits, value: dollarVal,
        reason: document.getElementById('w-rsn').value,
        staff: document.getElementById('w-staff').value,
        time: new Date().toLocaleString()
    });
    window.saveToDisk();
    const remainStock = invMatch.stock;
    window.showToast(`Logged: ${qtyInput} ${displayUnit} wasted ($${dollarVal.toFixed(2)}). ${invMatch.name} stock now ${remainStock.toFixed(1)} ${invMatch.buyUnit}.`);
    window.showView('wastage');
};

// =============================================================================
// 7. MAP-ON-THE-FLY POS DEPLETION
// =============================================================================

window.pendingMap = { known: [], unknown: [] };

window.openAiDepletion = () => {
    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:800px; margin:auto;">
        <h2 style="margin-top:0;">✨ AI EOD Stock Depletion</h2>
        <div class="card" style="border-top:5px solid var(--purple);">
            <p style="color:var(--text-muted); font-size:14px; margin-top:0;">Paste your end-of-day Product Mix text from Lightspeed. The AI will map sales to recipes and accurately deplete stock using strict yield logic.</p>
            <textarea id="ai-pos-text" class="input-box" style="height:250px; font-family:monospace; font-size:12px;" placeholder="Paste Lightspeed sales text here..."></textarea>
            <button onclick="window.runAiDepletion()" class="btn btn-purple" style="width:100%; font-size:16px; padding:12px; font-weight:bold;">Analyze & Deplete</button>
            <button onclick="window.showView('sales')" class="btn btn-outline" style="width:100%; margin-top:10px;">Cancel</button>
            <div id="ai-depletion-status" style="margin-top:15px; text-align:center;"></div>
        </div>
    </div>`;
};

window.runAiDepletion = async () => {
    const rawText = document.getElementById('ai-pos-text').value;
    const statusDiv = document.getElementById('ai-depletion-status');
    if (!rawText.trim()) return window.showToast("Please paste sales text.", "error");
    const menuItems = (window.recipes || []).filter(r => r.type === 'Menu');
    if (menuItems.length === 0) return statusDiv.innerHTML = `<p style="color:var(--orange);">⚠️ No Menu Recipes built in the Hub yet!</p>`;
    statusDiv.innerHTML = `<p style="color:var(--brand-accent); font-weight:bold;">🤖 AI is translating Lightspeed data...</p>`;
    const prompt = `Extract items and Quantity Sold from this POS table. Return ONLY JSON: { "results": [ { "rawName": "Exact POS Item Name", "qtySold": 42 } ] } Text: ${rawText}`;
    try {
        const apiKey = window.getApiKey(); if (!apiKey) return;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const aiResult = JSON.parse(rawJson);
        window.pendingMap = { known: [], unknown: [] };
        (aiResult.results || []).forEach(res => {
            let matchedRecipeId = window.posMappings[res.rawName];
            if (!matchedRecipeId) {
                let explicitMatch = menuItems.find(r => r.posAlias && r.posAlias.toLowerCase() === res.rawName.toLowerCase());
                if (explicitMatch) matchedRecipeId = explicitMatch.id;
            }
            if (matchedRecipeId && window.recipes.find(r => r.id === matchedRecipeId)) {
                window.pendingMap.known.push({ posName: res.rawName, recipeId: matchedRecipeId, qtySold: res.qtySold });
            } else {
                window.pendingMap.unknown.push({ posName: res.rawName, qtySold: res.qtySold });
            }
        });
        window.renderDepletionConfirmation();
    } catch (e) { statusDiv.innerHTML = `<p style="color:var(--red);">API Error: ${e.message}</p>`; }
};

window.renderDepletionConfirmation = () => {
    let recipeOpts = `<option value="">-- Select Hub Recipe --</option>` + (window.recipes || []).filter(r => r.type === 'Menu').map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    let html = `<div class="card" style="max-width:800px; margin:auto; border-top:5px solid var(--purple); padding-bottom:80px;">
        <h2 style="margin-top:0;">Map & Deplete Stock</h2>`;
    if (window.pendingMap.unknown.length > 0) {
        html += `<div style="background:rgba(245, 158, 11, 0.1); border:1px solid var(--orange); padding:15px; border-radius:8px; margin-bottom:20px;">
            <h4 style="color:var(--orange); margin-top:0; border-bottom:1px solid var(--orange); padding-bottom:5px;">⚠️ Map Unknown Items</h4>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Map these once. The Hub saves them forever.</p>`;
        window.pendingMap.unknown.forEach((u, i) => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border);">
                <div><strong style="color:var(--orange);">${esc(u.posName)}</strong><br><small>Sold: ${u.qtySold}</small></div>
                <select id="map-unknown-${i}" class="input-box" style="width:250px; margin:0; border-color:var(--orange);">${recipeOpts}</select>
            </div>`;
        });
        html += `</div>`;
    }
    if (window.pendingMap.known.length > 0) {
        html += `<h4 style="color:var(--green); border-bottom:1px solid var(--border); padding-bottom:5px; margin-top:20px;">✓ Safely Matched Items</h4>
        <div style="max-height:300px; overflow-y:auto; font-size:13px; background:var(--bg-main); padding:15px; border-radius:8px; border:1px solid var(--border);">`;
        window.pendingMap.known.forEach(k => {
            let rName = window.recipes.find(r => r.id === k.recipeId).name;
            html += `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border);">
                <span><span style="color:var(--text-muted);">${esc(k.posName)}</span> ➔ <strong>${esc(rName)}</strong></span>
                <span style="color:var(--green); font-weight:bold;">${k.qtySold} sold</span>
            </div>`;
        });
        html += `</div>`;
    }
    html += `<div class="sticky-footer">
        <button onclick="window.executeDepletion()" class="btn btn-red" style="flex:2; font-size:16px;">Confirm Math & Deduct Stock</button>
        <button onclick="window.showView('sales')" class="btn btn-outline" style="flex:1;">Cancel</button>
    </div></div>`;
    document.getElementById('mainContent').innerHTML = html;
};

window.executeDepletion = () => {
    window.pendingMap.unknown.forEach((u, i) => {
        let selectedId = document.getElementById(`map-unknown-${i}`).value;
        if (selectedId) {
            if (!window.posMappings) window.posMappings = {};
            window.posMappings[u.posName] = selectedId;
            window.pendingMap.known.push({ posName: u.posName, recipeId: selectedId, qtySold: u.qtySold });
        }
    });
    let deductions = {};
    window.pendingMap.known.forEach(k => {
        const recipe = window.recipes.find(r => r.id === k.recipeId);
        if (recipe) {
            (recipe.ingredients || []).forEach(ing => {
                if (ing.type === 'inv') {
                    deductions[ing.ref] = (deductions[ing.ref] || 0) + (ing.qty * k.qtySold);
                } else if (ing.type === 'batch') {
                    const batch = window.recipes.find(r => r.id === ing.ref);
                    if (batch) {
                        const batchRatio = (ing.qty * k.qtySold) / (batch.yieldQty || 1);
                        (batch.ingredients || []).forEach(bIng => {
                            if (bIng.type === 'inv') deductions[bIng.ref] = (deductions[bIng.ref] || 0) + (bIng.qty * batchRatio);
                        });
                    }
                }
            });
        }
    });
    let deductedCount = 0;
    Object.keys(deductions).forEach(invId => {
        let inv = window.inventoryItems.find(i => i.id === invId);
        if (inv) {
            const useUnitsToDeduct = deductions[invId];
            const buyUnitsToDeduct = useUnitsToDeduct / (inv.yield || 1);
            inv.stock = Math.max(0, (inv.stock || 0) - buyUnitsToDeduct);
            deductedCount++;
        }
    });
    window.saveToDisk();
    window.showToast(`Success! Deducted ${deductedCount} stock lines.`);
    window.showView('inventory');
};

// =============================================================================
// 8. INVOICE RIPPER PRO — PDF TEXT + SCANNED IMAGE VISION
// Handles: text-layer PDFs, image-only scanned PDFs, direct image uploads
// Flow: Upload → AI reads → Review & confirm → Stock+history updated
// =============================================================================

window.pendingInvoiceData = null;

// AI zone prediction from product name
window._guessZoneFromName = (name) => {
    const n = name.toLowerCase();
    if (/beer|lager|ale|cider|wine|sake|spirit|vodka|gin|rum|whisky|whiskey|bourbon|liqueur|champagne|prosecco|seltzer|soft drink|cola|juice|syrup|bitters|vermouth|aperol|campari|tonic|soda|mineral water|energy drink|cocktail/i.test(n)) {
        const z = (window.storageZones||[]).find(x=>x.area==='FOH');
        return { dept:'FOH', zone: z?z.name:'' };
    }
    if (/chicken|beef|pork|lamb|fish|salmon|tuna|prawn|crab|squid|egg|flour|rice|noodle|pasta|oil|butter|cream|milk|cheese|tofu|mushroom|vegetable|onion|garlic|ginger|herb|spice|sauce|miso|soy|dashi|kombu|vinegar|sugar|salt|pepper|wagyu|duck|seafood|produce|frozen|fresh/i.test(n)) {
        const z = (window.storageZones||[]).find(x=>x.area==='BOH');
        return { dept:'BOH', zone: z?z.name:'' };
    }
    if (/bag|box|container|wrap|foil|glove|chemical|cleaner|sanitiser|sanitizer|detergent|paper|napkin|straw|tissue/i.test(n)) {
        return { dept:'BOH', zone:'Dry Store' };
    }
    return { dept:'BOH', zone:'' };
};

window.renderInvoiceView = () => {
    return `
    <div style="max-width: 1300px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🧾 Invoice Ripper Pro</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Upload a supplier invoice — AI extracts line items, matches inventory, flags price changes</div>
            </div>
        </div>

        <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">

            <!-- LEFT: Upload + Results -->
            <div style="flex:1; min-width:350px;">
                <div class="card" style="border-top:5px solid var(--blue); text-align:center; padding:30px; margin-bottom:20px;">
                    <div style="font-size:40px; margin-bottom:10px;">📄</div>
                    <p style="color:var(--text-muted); margin:0 0 15px 0; font-size:13px;">PDF invoice or scanned image from your Brother scanner</p>
                    <input type="file" id="invoice-file" accept="application/pdf,image/*" style="display:none;" onchange="window.handleInvoiceUpload(event)">
                    <button onclick="document.getElementById('invoice-file').click()" class="btn btn-blue" style="font-size:15px; padding:12px 24px; width:100%;">📎 Select Invoice File</button>
                    <p id="invoice-status" style="margin-top:15px; color:var(--brand-accent); font-size:13px; font-weight:bold;"></p>
                </div>
                <div id="invoice-results"></div>
            </div>

            <!-- RIGHT: Preview -->
            <div class="card" id="invoice-preview-container" style="flex:1.5; min-width:400px; display:none; padding:15px; min-height:600px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="font-size:13px; color:var(--text-muted);">Invoice Preview</strong>
                    <button onclick="document.getElementById('invoice-preview-container').style.display='none'" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:18px;">&times;</button>
                </div>
                <div id="invoice-preview-inner" style="width:100%; min-height:550px;"></div>
            </div>
        </div>
    </div>`;
};

// Central upload handler — detects PDF vs image
window.handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('invoice-status');
    const previewContainer = document.getElementById('invoice-preview-container');
    const previewInner = document.getElementById('invoice-preview-inner');
    statusEl.innerHTML = '⏳ Reading file...';

    const fileType = file.type;
    const objectUrl = URL.createObjectURL(file);

    // Show preview
    previewContainer.style.display = 'block';
    if (fileType === 'application/pdf') {
        previewInner.innerHTML = `<iframe src="${objectUrl}" style="width:100%; height:600px; border:none; border-radius:6px;"></iframe>`;
    } else {
        previewInner.innerHTML = `<img src="${objectUrl}" style="max-width:100%; border-radius:6px; border:1px solid var(--border);">`;
    }

    // Determine extraction strategy
    if (fileType === 'application/pdf') {
        statusEl.innerHTML = '📄 Extracting text from PDF...';
        await window._extractPdfAndParse(file);
    } else {
        // Direct image — use Gemini Vision
        statusEl.innerHTML = '📷 Sending scanned image to AI Vision...';
        await window._parseImageInvoice(file);
    }
};

// Strategy A: Text-layer PDF (fast, cheap)
window._extractPdfAndParse = async (file) => {
    const statusEl = document.getElementById('invoice-status');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            let items = textContent.items.map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
            items.sort((a, b) => { if (Math.abs(b.y - a.y) <= 5) return a.x - b.x; return b.y - a.y; });
            items.forEach(item => fullText += item.str.trim() + ' ');
        }

        // If text layer is empty or too short, fall back to Vision
        if (fullText.trim().length < 50) {
            statusEl.innerHTML = '🔍 No text layer found — switching to Vision AI...';
            await window._parsePdfAsImages(file);
            return;
        }

        statusEl.innerHTML = '🤖 AI reading invoice data...';
        await window._parseTextInvoice(fullText);
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--red);">PDF read error: ${err.message}</span>`;
    }
};

// Strategy B: Render PDF pages as images → Vision
window._parsePdfAsImages = async (file) => {
    const statusEl = document.getElementById('invoice-status');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;

        // Render first 3 pages to canvas and encode as base64
        const imageDataArray = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // High res for OCR
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            imageDataArray.push(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
        }

        await window._parseVisionInvoice(imageDataArray);
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--red);">Vision fallback error: ${err.message}</span>`;
    }
};

// Strategy C: Direct image file → Vision
window._parseImageInvoice = async (file) => {
    try {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        await window._parseVisionInvoice([base64]);
    } catch (err) {
        document.getElementById('invoice-status').innerHTML = `<span style="color:var(--red);">Image read error: ${err.message}</span>`;
    }
};

// Gemini Vision API call (for scanned/image invoices)
window._parseVisionInvoice = async (base64ImageArray) => {
    const statusEl = document.getElementById('invoice-status');
    const apiKey = window.getApiKey();
    if (!apiKey) { statusEl.innerHTML = '<span style="color:var(--red);">No API key set.</span>'; return; }

    const parts = [
        {
            text: `You are an invoice data extraction AI. Extract ALL line items from this invoice image.
Return ONLY valid JSON in this exact structure:
{
  "supplier": "Supplier Name",
  "invoiceNumber": "INV-12345",
  "date": "DD/MM/YYYY",
  "items": [
    {
      "itemName": "Full product name",
      "sku": "Product code or empty string",
      "quantity": 1.0,
      "buyUnit": "CTN or each or kg etc",
      "unitPrice": 12.50,
      "totalLinePrice": 12.50,
      "gstFree": false
    }
  ],
  "subtotal": 0.00,
  "gstTotal": 0.00,
  "invoiceTotal": 0.00
}
Be thorough. Extract every product line. Use 0 for missing prices. Use empty string for missing SKUs.`
        },
        ...base64ImageArray.map(b64 => ({
            inline_data: { mime_type: "image/jpeg", data: b64 }
        }))
    ];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        window.pendingInvoiceData = JSON.parse(rawJson);
        statusEl.innerHTML = `<span style="color:var(--green);">✓ AI extracted ${window.pendingInvoiceData.items.length} line items. Review below.</span>`;
        window._renderInvoiceReview();
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--red);">Vision API error: ${err.message}</span>`;
    }
};

// Gemini Text API call (for text-layer PDFs)
window._parseTextInvoice = async (rawText) => {
    const statusEl = document.getElementById('invoice-status');
    const apiKey = window.getApiKey();
    if (!apiKey) { statusEl.innerHTML = '<span style="color:var(--red);">No API key set.</span>'; return; }

    const prompt = `You are an invoice data extraction AI. Extract ALL line items from this invoice text.
Return ONLY valid JSON in this exact structure:
{
  "supplier": "Supplier Name",
  "invoiceNumber": "INV-12345",
  "date": "DD/MM/YYYY",
  "items": [
    {
      "itemName": "Full product name",
      "sku": "Product code or empty string",
      "quantity": 1.0,
      "buyUnit": "CTN or each or kg etc",
      "unitPrice": 12.50,
      "totalLinePrice": 12.50,
      "gstFree": false
    }
  ],
  "subtotal": 0.00,
  "gstTotal": 0.00,
  "invoiceTotal": 0.00
}
Invoice text:
${rawText}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        window.pendingInvoiceData = JSON.parse(rawJson);
        statusEl.innerHTML = `<span style="color:var(--green);">✓ AI extracted ${window.pendingInvoiceData.items.length} line items. Review below.</span>`;
        window._renderInvoiceReview();
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--red);">AI error: ${err.message}</span>`;
    }
};

// Smart fuzzy matching: SKU first, then name similarity
window._findBestMatch = (aiItem) => {
    const inv = window.inventoryItems || [];
    // 0. Check learned matches first
    const learnedMap = window.invoiceMatchMap || {};
    const learnKey = (aiItem.itemName||'').toLowerCase().trim();
    if (learnedMap[learnKey]) {
        const learnedItem = inv.find(i => i.id === learnedMap[learnKey]);
        if (learnedItem) return { item: learnedItem, confidence: 'learned' };
    }
    // 1. Exact SKU match
    if (aiItem.sku) {
        const skuMatch = inv.find(i => i.sku && i.sku.toLowerCase() === aiItem.sku.toLowerCase());
        if (skuMatch) return { item: skuMatch, confidence: 'sku' };
    }
    // 2. Fuzzy name match (word overlap ≥ 70%)
    let bestItem = null, bestScore = 0;
    inv.forEach(item => {
        const words = item.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return;
        let matchCount = words.filter(w => aiItem.itemName.toLowerCase().includes(w)).length;
        const score = matchCount / words.length;
        if (score > bestScore && score >= 0.65) { bestScore = score; bestItem = item; }
    });
    if (bestItem) return { item: bestItem, confidence: bestScore >= 0.9 ? 'high' : 'fuzzy' };
    return null;
};

// Review screen — shows all matched and unmatched items for confirmation
window._renderInvoiceReview = () => {
    const ai = window.pendingInvoiceData;
    if (!ai || !ai.items) return;

    // Run matching for all items
    window._invoiceReviewState = ai.items.map((aiItem, index) => {
        const match = window._findBestMatch(aiItem);
        return {
            index,
            aiItem,
            matchedInvId: match ? match.item.id : null,
            confidence: match ? match.confidence : 'none',
            action: match ? 'update' : 'new',  // 'update', 'new', 'skip'
        };
    });

    window._renderInvoiceReviewUI();
};

window._renderInvoiceReviewUI = () => {
    const ai = window.pendingInvoiceData;
    const state = window._invoiceReviewState;
    const invOpts = `<option value="">-- Map to Existing Item --</option>` +
        (window.inventoryItems || []).filter(i => !i.archived).map(i => `<option value="${i.id}">${esc(i.name)} (${esc(i.buyUnit)})</option>`).join('');

    const autoMatched = state.filter(s => s.matchedInvId && s.action === 'update');
    const unmatched = state.filter(s => !s.matchedInvId || s.action === 'new' || s.action === 'skip');

    let html = `
    <div style="border-top:4px solid var(--blue); padding-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div>
                <h3 style="margin:0; color:var(--brand-dark);">${esc(ai.supplier)} — ${esc(ai.date)}</h3>
                <small style="color:var(--text-muted);">Invoice #${esc(ai.invoiceNumber || 'N/A')} | ${ai.items.length} line items extracted | Total: $${Number(ai.invoiceTotal || 0).toFixed(2)}</small>
            </div>
            <button onclick="window._commitInvoice()" class="btn btn-green" style="font-size:14px; padding:10px 20px;">✓ Commit All & Update Stock</button>
        </div>`;

    // --- AUTO-MATCHED (green) ---
    if (autoMatched.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <h4 style="color:var(--green); margin:0 0 10px 0; border-bottom:1px solid var(--border); padding-bottom:8px;">✓ Auto-Matched (${autoMatched.length} items)</h4>
            <div style="display:flex; flex-direction:column; gap:8px;">`;
        autoMatched.forEach(s => {
            const inv = window.inventoryItems.find(i => i.id === s.matchedInvId);
            const priceChange = inv && inv.price !== s.aiItem.unitPrice && s.aiItem.unitPrice > 0;
            const pctChange = inv && priceChange ? (((s.aiItem.unitPrice - inv.price) / inv.price) * 100).toFixed(1) : null;
            html += `
            <div id="ir-row-${s.index}" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:8px 12px; border-radius:6px; border-left:3px solid var(--green);">
                <div style="flex:2;">
                    <strong style="font-size:13px;">${esc(s.aiItem.itemName)}</strong>
                    <small style="color:var(--text-muted); display:block;">${s.aiItem.sku ? `SKU: ${esc(s.aiItem.sku)} · ` : ''}Qty: ${s.aiItem.quantity} ${esc(s.aiItem.buyUnit || '')}</small>
                </div>
                <div style="flex:1; text-align:center; font-size:12px; color:var(--text-muted);">
                    ➔ <strong style="color:var(--green);">${inv ? esc(inv.name) : '?'}</strong>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${s.confidence === 'learned' ? '🧠 Learned match' : s.confidence === 'sku' ? '🔑 SKU match' : s.confidence === 'high' ? '✓ Name match' : '~ Fuzzy match'}</div>
                </div>
                <div style="flex:1; text-align:right; font-size:13px;">
                    ${priceChange
                        ? (() => {
                            const big = Math.abs(pctChange) >= 10;
                            return `<span style="color:${big?'var(--red)':pctChange>0?'var(--orange)':'var(--green)'}; font-weight:bold;">$${Number(s.aiItem.unitPrice).toFixed(2)} ${big?'🚨':''}<small>(${pctChange>0?'▲':'▼'}${Math.abs(pctChange)}%)</small></span><br><small style="color:var(--text-muted);">was $${Number(inv.price).toFixed(2)}</small>`;
                          })()
                        : `<span style="color:var(--brand-accent);">$${Number(s.aiItem.unitPrice || 0).toFixed(2)}</span>`
                    }
                </div>
                <div style="margin-left:15px;">
                    <button onclick="window._irSetAction(${s.index}, 'skip')" class="btn btn-outline" style="font-size:11px; padding:4px 10px; color:var(--text-muted);">Skip</button>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }

    // --- UNMATCHED / NEEDS REVIEW (orange) ---
    if (unmatched.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <h4 style="color:var(--orange); margin:0 0 10px 0; border-bottom:1px solid var(--border); padding-bottom:8px;">❓ Needs Review (${unmatched.length} items)</h4>
            <div style="display:flex; flex-direction:column; gap:10px;">`;
        unmatched.forEach(s => {
            const isSkipped = s.action === 'skip';
            html += `
            <div id="ir-row-${s.index}" style="background:var(--bg-main); padding:10px 12px; border-radius:6px; border-left:3px solid ${isSkipped ? 'var(--border)' : 'var(--orange)'}; opacity:${isSkipped ? 0.5 : 1};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div style="flex:1; min-width:200px;">
                        <strong style="font-size:13px; color:${isSkipped ? 'var(--text-muted)' : 'var(--orange)'};">${esc(s.aiItem.itemName)}</strong>
                        <small style="color:var(--text-muted); display:block;">${s.aiItem.sku ? `SKU: ${esc(s.aiItem.sku)} · ` : ''}Qty: ${s.aiItem.quantity} ${esc(s.aiItem.buyUnit || '')} · $${Number(s.aiItem.unitPrice || 0).toFixed(2)}</small>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        <select id="ir-map-${s.index}" class="input-box" style="margin:0; width:220px; font-size:12px; padding:7px; border-color:var(--orange);">${invOpts}</select>
                        <button onclick="window._irLinkExisting(${s.index})" class="btn btn-outline" style="font-size:11px; padding:6px 10px;">Link</button>
                        <button onclick="window._irQuickAdd(${s.index})" class="btn btn-blue" style="font-size:11px; padding:6px 10px;">+ New Item</button>
                        <button onclick="window._irSetAction(${s.index}, ${isSkipped ? "'new'" : "'skip'"})" class="btn btn-outline" style="font-size:11px; padding:6px 10px; color:var(--text-muted);">${isSkipped ? 'Undo Skip' : 'Skip'}</button>
                    </div>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }

    html += `
    <div style="background:rgba(16,185,129,0.08); border:1px solid var(--green); padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <div style="font-size:13px; color:var(--text-muted);">Ready to commit: <strong style="color:var(--green);">${autoMatched.length} updates</strong> + <strong style="color:var(--blue);">${unmatched.filter(s => s.action === 'new' && s.matchedInvId).length} new links</strong></div>
        <button onclick="window._commitInvoice()" class="btn btn-green" style="font-size:14px; padding:10px 20px;">✓ Commit All & Update Stock</button>
    </div>
    </div>`;

    document.getElementById('invoice-results').innerHTML = html;
};

// Toggle skip/active on a row
window._irSetAction = (index, action) => {
    window._invoiceReviewState[index].action = action;
    window._renderInvoiceReviewUI();
};

// Link unmatched item to existing inventory
window._irLinkExisting = (index) => {
    const sel = document.getElementById(`ir-map-${index}`);
    if (!sel || !sel.value) return window.showToast("Select an item to link.", "error");
    window._invoiceReviewState[index].matchedInvId = sel.value;
    window._invoiceReviewState[index].action = 'update';
    window._invoiceReviewState[index].confidence = 'manual';
    window._renderInvoiceReviewUI();
};

// Quick-add new inventory item from invoice line
window._irQuickAdd = (index) => {
    const aiItem = window._invoiceReviewState[index].aiItem;
    const newId = window.generateId('inv');
    const supplierName = window.pendingInvoiceData.supplier || '';
    const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
    const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
    const guess = window._guessZoneFromName(aiItem.itemName);
    const isBev = guess.dept === 'FOH';
    const guessedCat = isBev ? 'Beverage' : 'Food';
    const guessedZone = guess.zone || '';
    const html = `
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Name</label><input type="text" id="iq-n" class="input-box" value="${esc(aiItem.itemName)}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iq-cat" list="iq-cat-list" class="input-box" value="${guessedCat}"><datalist id="iq-cat-list">${catOpts}</datalist></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Supplier</label><input type="text" id="iq-sup" class="input-box" value="${esc(supplierName)}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">SKU</label><input type="text" id="iq-sku" class="input-box" value="${esc(aiItem.sku || '')}"></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Department <small style="color:var(--blue);">(AI guess: ${guess.dept})</small></label>
            <select id="iq-dept" class="input-box"><option ${isBev?'selected':''}>FOH</option><option ${!isBev?'selected':''}>BOH</option><option>Office</option></select>
        </div>
        <div><label style="font-size:11px; color:var(--text-muted);">Storage Zone <small style="color:var(--blue);">(AI guess)</small></label>
            ${window.buildZoneSelect(guessedZone, 'iq-loc')}
        </div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px; background:var(--bg-main); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Price ($)</label><input type="number" step="0.01" id="iq-p" class="input-box" value="${Number(aiItem.unitPrice || 0).toFixed(2)}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Unit</label><input type="text" id="iq-buyUnit" class="input-box" value="${esc(aiItem.buyUnit || 'CTN')}"></div>
        <div style="padding-top:20px;"><label style="font-size:13px; cursor:pointer;"><input type="checkbox" id="iq-gst" ${aiItem.gstFree ? 'checked' : ''} style="transform:scale(1.2);"> GST Free</label></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; border:1px dashed var(--blue); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-Units per Buy-Unit)</label><input type="number" step="0.01" id="iq-yield" class="input-box" value="1"></div>
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit</label><input type="text" id="iq-useUnit" class="input-box" value="${isBev ? 'ml' : 'kg'}"></div>
    </div>
    <button onclick="window._irSaveNewItem('${newId}', ${index})" class="btn btn-green" style="width:100%; font-size:15px; padding:12px;">Save & Link to Invoice</button>`;
    window.openModal(`⚡ Quick Add: ${esc(aiItem.itemName)}`, html);
};

window._irSaveNewItem = (newId, index) => {
    const aiItem = window._invoiceReviewState[index].aiItem;
    const supplierName = document.getElementById('iq-sup').value;
    const newItem = {
        id: newId,
        name: document.getElementById('iq-n').value,
        category: document.getElementById('iq-cat').value,
        sku: document.getElementById('iq-sku').value,
        supplier: supplierName,
        price: parseFloat(document.getElementById('iq-p').value) || 0,
        buyUnit: document.getElementById('iq-buyUnit').value,
        gstFree: document.getElementById('iq-gst').checked,
        yield: parseFloat(document.getElementById('iq-yield').value) || 1,
        useUnit: document.getElementById('iq-useUnit').value,
        location: document.getElementById('iq-loc').value,
        department: document.getElementById('iq-dept') ? document.getElementById('iq-dept').value : 'BOH',
        stock: Number(aiItem.quantity) || 0,
        parWeekday: 0, parWeekend: 0, par: 0,
        archived: false,
        history: [{ date: window.pendingInvoiceData.date || new Date().toLocaleDateString('en-AU'), supplier: supplierName, invoiceNo: window.pendingInvoiceData.invoiceNumber||'', qty: aiItem.quantity, price: parseFloat(document.getElementById('iq-p').value)||0, prevPrice: 0 }]
    };
    // Auto-add supplier if not known
    if (supplierName && !window.suppliers.find(s => s.name === supplierName)) {
        window.suppliers.push({ name: supplierName, contact: '', cutoff: '', minSpend: 0, deliveryDays: [] });
    }
    window.inventoryItems.push(newItem);
    window._invoiceReviewState[index].matchedInvId = newId;
    window._invoiceReviewState[index].action = 'update';
    window._invoiceReviewState[index].confidence = 'new';
    window.closeModal();
    window.showToast(`${newItem.name} added to inventory.`);
    window._renderInvoiceReviewUI();
};

// Final commit — apply all approved updates to inventory (date-aware)
window._learnInvoiceMatches = () => {
    const state = window._invoiceReviewState || [];
    if (!window.invoiceMatchMap) window.invoiceMatchMap = {};
    state.forEach(s => {
        if (s.matchedInvId && s.action === 'update') {
            const key = (s.aiItem.itemName||'').toLowerCase().trim();
            if (key) window.invoiceMatchMap[key] = s.matchedInvId;
        }
    });
};

window._commitInvoice = () => {
    const ai = window.pendingInvoiceData;
    const state = window._invoiceReviewState;
    if (!ai || !state) return;

    // Parse invoice date and check if historical (>7 days old)
    const parseInvDate = (str) => {
        if (!str) return null;
        const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (m) return new Date(parseInt(m[3].length===2?'20'+m[3]:m[3]), parseInt(m[2])-1, parseInt(m[1]));
        return new Date(str);
    };
    const invDate = parseInvDate(ai.date);
    const today = new Date();
    const daysDiff = invDate ? Math.round((today - invDate) / (1000*3600*24)) : 0;
    const isHistorical = daysDiff > 7;

    if (isHistorical) {
        window.confirmAction({
            title: '📜 Historical Invoice',
            message: 'This invoice is dated <strong>' + window.esc(ai.date||'unknown') + '</strong> (' + daysDiff + ' days ago).<br><br>' +
                '✓ Price history will be updated<br>✓ Item prices updated<br>✗ Stock levels will NOT change<br><br>' +
                'This prevents inflating stock from old invoices.',
            confirmLabel: 'Process Historical', confirmColor: 'var(--orange)', tier: 'standard',
            onConfirm: () => window._doCommitInvoice(ai, state, true)
        });
        return;
    }

    window._doCommitInvoice(ai, state, false);
};

window._doCommitInvoice = (ai, state, isHistorical) => {
    let updatedCount = 0, skippedCount = 0;
    const changedInvIds = [];

    state.forEach(row => {
        if (row.action === 'skip') { skippedCount++; return; }
        const aiItem = row.aiItem;
        const invId = row.matchedInvId;
        const invIdx = invId ? window.inventoryItems.findIndex(i => i.id === invId) : -1;
        const unitPrice = parseFloat(aiItem.unitPrice) || 0;
        const qty = parseFloat(aiItem.quantity) || 0;
        if (invIdx >= 0) {
            const inv = window.inventoryItems[invIdx];
            const prevPrice = inv.price || 0;
            if (!inv.history) inv.history = [];
            inv.history.push({ date: ai.date||new Date().toLocaleDateString('en-AU'), supplier: ai.supplier||'', invoiceNo: ai.invoiceNumber||'', qty, price: unitPrice, prevPrice });
            if (unitPrice > 0) { inv.price = unitPrice; if (unitPrice !== prevPrice) changedInvIds.push(inv.id); }
            inv.supplier = ai.supplier || inv.supplier;
            if (!isHistorical) inv.stock = (inv.stock||0) + qty;
            updatedCount++;
        } else { skippedCount++; }
    });

    // Cascade recipe costs for changed prices
    const cascadeResult = changedInvIds.length > 0 ? window.cascadeRecipeCosts(changedInvIds) : null;

    window.saveToDisk();

    const histNote = isHistorical ? '<div style="background:rgba(245,158,11,0.1);border:1px solid var(--orange);border-radius:8px;padding:12px;margin-bottom:15px;font-size:13px;color:var(--orange);">📅 Historical invoice — stock levels unchanged. Price history updated.</div>' : '';
    const cascNote = cascadeResult && cascadeResult.updatedMenus > 0 ? '<div style="font-size:12px;color:var(--purple);margin-top:8px;">&#9851; ' + cascadeResult.updatedMenus + ' recipe costs recalculated</div>' : '';

    document.getElementById('invoice-results').innerHTML = '<div style="text-align:center;padding:30px;">' + histNote +
        '<div style="font-size:48px;margin-bottom:10px;">' + (isHistorical?'📋':'✅') + '</div>' +
        '<h3 style="color:var(--green);margin:0 0 10px 0;">' + (isHistorical?'Price History Updated':'Invoice Committed') + '</h3>' +
        '<div style="font-size:14px;color:var(--text-muted);margin-bottom:20px;"><strong style="color:var(--green);">' + updatedCount + '</strong> items · <strong style="color:var(--text-muted);">' + skippedCount + '</strong> skipped' + cascNote + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
            '<button onclick="window.showView(\'invoice\')" class="btn btn-blue">📄 Rip Another</button>' +
            '<button onclick="window.showView(\'inventory\')" class="btn btn-outline">📦 Inventory</button>' +
            (cascadeResult && cascadeResult.gpAlerts && cascadeResult.gpAlerts.length > 0 ? '<button onclick="window.showView(\'margins\')" class="btn btn-outline" style="border-color:var(--purple);color:var(--purple);">📊 Check Margins</button>' : '') +
        '</div></div>';
    document.getElementById('invoice-status').innerHTML = '';
    window.showToast('Invoice processed — ' + updatedCount + ' items updated!');
};

// =============================================================================
// 9. ALLERGENS, RUN SHEETS & MARGIN CHECKER
// =============================================================================



// =============================================================================
// THEORETICAL vs ACTUAL VARIANCE REPORT
// Compare: what SHOULD have been used (POS sales × recipe ingredients)
// vs what WAS used (stock count deltas)
// =============================================================================
window.renderVarianceReport = () => {
    const recipes = (window.recipes||[]).filter(r => r.type === 'Menu' && r.posAlias && !r.archived);
    const salesByData = window.lsSalesByData || {};
    const depLogs = window.depletionLogs || [];
    const items = (window.inventoryItems||[]).filter(i => !i.archived);
    
    if (recipes.length === 0 || Object.keys(salesByData).length === 0) {
        return '<div style="max-width:900px;margin:auto;">' +
            '<h2 style="margin-bottom:20px;">Actual vs Theoretical Variance</h2>' +
            '<div class="card" style="text-align:center;padding:40px;">' +
                '<div style="font-size:48px;margin-bottom:10px;">📊</div>' +
                '<h3 style="color:var(--text-muted);">Not enough data yet</h3>' +
                '<p style="color:var(--text-muted);font-size:13px;">This report needs:</p>' +
                '<div style="text-align:left;max-width:400px;margin:15px auto;font-size:13px;">' +
                    '<div style="padding:8px 0;border-bottom:1px dashed var(--border);color:' + (recipes.length > 0 ? 'var(--green)' : 'var(--red)') + ';">' + (recipes.length > 0 ? '✅' : '❌') + ' Recipes with POS aliases (' + recipes.length + ' set)</div>' +
                    '<div style="padding:8px 0;border-bottom:1px dashed var(--border);color:' + (Object.keys(salesByData).length > 0 ? 'var(--green)' : 'var(--red)') + ';">' + (Object.keys(salesByData).length > 0 ? '✅' : '❌') + ' Lightspeed Sales By data imported</div>' +
                    '<div style="padding:8px 0;color:' + (depLogs.length > 0 ? 'var(--green)' : 'var(--orange)') + ';">' + (depLogs.length > 0 ? '✅' : '⚠️') + ' EOD depletion runs (' + depLogs.length + ' logs)</div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }
    
    // Calculate theoretical usage from sales data
    const theoreticalUsage = {};
    // Get all sales by products
    const allProducts = [];
    Object.values(salesByData).forEach(dateData => {
        if (dateData.products) allProducts.push(...dateData.products);
    });
    
    // Map POS items to recipes, then recipes to ingredients
    recipes.forEach(recipe => {
        const posName = (recipe.posAlias || recipe.name).toLowerCase().trim();
        const matchingSales = allProducts.filter(p => p.name && p.name.toLowerCase().trim() === posName);
        const totalSold = matchingSales.reduce((s, p) => s + (p.qty || 0), 0);
        
        if (totalSold > 0) {
            (recipe.ingredients || []).forEach(ing => {
                if (ing.type === 'inv' && ing.ref) {
                    if (!theoreticalUsage[ing.ref]) theoreticalUsage[ing.ref] = { theoretical: 0, itemName: '' };
                    const inv = items.find(i => i.id === ing.ref);
                    if (inv) {
                        theoreticalUsage[ing.ref].theoretical += (ing.qty || 0) * totalSold / (inv.yield || 1);
                        theoreticalUsage[ing.ref].itemName = inv.name;
                    }
                }
            });
        }
    });
    
    // Calculate actual usage from depletion logs
    const actualUsage = {};
    depLogs.forEach(log => {
        (log.changes || []).forEach(change => {
            if (!actualUsage[change.id]) actualUsage[change.id] = 0;
            actualUsage[change.id] += Math.abs(change.delta || 0);
        });
    });
    
    // Build variance table
    const varianceItems = Object.keys(theoreticalUsage).map(itemId => {
        const inv = items.find(i => i.id === itemId);
        if (!inv) return null;
        const theoretical = theoreticalUsage[itemId].theoretical;
        const actual = actualUsage[itemId] || 0;
        const variance = actual - theoretical;
        const variancePct = theoretical > 0 ? ((variance / theoretical) * 100) : 0;
        const varianceCost = variance * ((inv.price || 0) / (inv.yield || 1));
        return { id: itemId, name: inv.name, unit: inv.buyUnit || 'unit', theoretical, actual, variance, variancePct, varianceCost, category: inv.category || 'Other' };
    }).filter(Boolean).sort((a, b) => Math.abs(b.varianceCost) - Math.abs(a.varianceCost));
    
    const totalVarianceCost = varianceItems.reduce((s, v) => s + v.varianceCost, 0);
    
    const rows = varianceItems.slice(0, 30).map(v => {
        const color = Math.abs(v.variancePct) < 5 ? 'var(--green)' : Math.abs(v.variancePct) < 15 ? 'var(--orange)' : 'var(--red)';
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:7px 10px;"><strong style="font-size:13px;">' + esc(v.name) + '</strong><br><small style="color:var(--text-muted);">' + esc(v.category) + '</small></td>' +
            '<td style="padding:7px 10px;text-align:center;font-size:12px;">' + v.theoretical.toFixed(1) + '</td>' +
            '<td style="padding:7px 10px;text-align:center;font-size:12px;">' + v.actual.toFixed(1) + '</td>' +
            '<td style="padding:7px 10px;text-align:center;font-size:12px;color:' + color + ';font-weight:bold;">' + (v.variance > 0 ? '+' : '') + v.variance.toFixed(1) + ' ' + v.unit + '</td>' +
            '<td style="padding:7px 10px;text-align:center;font-size:12px;color:' + color + ';">' + (v.variancePct > 0 ? '+' : '') + v.variancePct.toFixed(1) + '%</td>' +
            '<td style="padding:7px 10px;text-align:right;font-weight:bold;font-size:12px;color:' + color + ';">$' + Math.abs(v.varianceCost).toFixed(2) + '</td>' +
        '</tr>';
    }).join('');
    
    return '<div style="max-width:1100px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">Actual vs Theoretical Variance</h2>' +
            '<small style="color:var(--text-muted);">Comparing POS sales × recipe ingredients vs actual stock depletion</small></div>' +
            '<button onclick="window.showView(\'sales\')" class="btn btn-outline" style="font-size:12px;">← Takings</button>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:25px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid ' + (totalVarianceCost > 0 ? 'var(--red)' : 'var(--green)') + ';">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Variance Cost</div>' +
                '<div style="font-size:22px;font-weight:bold;color:' + (Math.abs(totalVarianceCost) > 50 ? 'var(--red)' : 'var(--green)') + ';">$' + Math.abs(totalVarianceCost).toFixed(2) + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (totalVarianceCost > 0 ? 'Over-used' : 'Under-used') + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Items Tracked</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--blue);">' + varianceItems.length + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">High Variance Items</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--orange);">' + varianceItems.filter(v => Math.abs(v.variancePct) >= 15).length + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="card" style="padding:0;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                '<th style="padding:10px 12px;text-align:left;">Item</th>' +
                '<th style="padding:10px 12px;text-align:center;">Theoretical</th>' +
                '<th style="padding:10px 12px;text-align:center;">Actual</th>' +
                '<th style="padding:10px 12px;text-align:center;">Variance</th>' +
                '<th style="padding:10px 12px;text-align:center;">%</th>' +
                '<th style="padding:10px 12px;text-align:right;">Cost Impact</th>' +
            '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);">No variance data available.</td></tr>') + '</tbody>' +
            '</table>' +
        '</div>' +
        '<div class="card" style="margin-top:20px;border-left:4px solid var(--blue);padding:12px 18px;">' +
            '<p style="margin:0;font-size:13px;color:var(--text-muted);"><strong>How to read this:</strong> Positive variance means more was used than recipes predicted (possible: over-portioning, theft, unrecorded waste). Negative means less used than expected (possible: under-portioning, count error, unreported 86s).</p>' +
        '</div>' +
    '</div>';
};


window.renderAllergenView = () => {
    return `<div style="max-width: 800px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🧪 Allergen Matrix</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Dietary flags from recipe names or AI scan — GF, VG, DF, NF and more</div>
            </div>
            <button onclick="window.runAiAllergenScan()" class="btn btn-purple">✨ AI Scan Menu</button>
        </div>
        <div id="allergen-status" style="margin-bottom:15px;"></div>
        <table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse:collapse;">
            <tr style="background:#111; text-align:left;">
                <th style="padding:8px 12px;">Menu Item</th>
                <th style="padding:8px 12px;">Dietary Flags</th>
            </tr>
            ${(window.recipes || []).filter(r => r.type === 'Menu' && !r.archived).map(r => {
                let flags = r.allergens && r.allergens.length > 0 ? r.allergens.join(', ') :
                    `${r.name.includes('GF') ? 'GF ' : ''}${r.name.includes('VG') ? 'VG ' : ''}${r.name.includes('DF') ? 'DF ' : ''}`.trim() || '—';
                return `<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 12px;font-size:13px;">${esc(r.name)}</td><td style="padding:7px 12px; color:var(--brand-accent); font-weight:bold;">${esc(flags)}</td></tr>`;
            }).join('')}
        </table>
    </div>`;
};

window.runAiAllergenScan = async () => {
    const statusDiv = document.getElementById('allergen-status');
    const menuRecipes = (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived);
    if (menuRecipes.length === 0) return window.showToast("No menu recipes to scan.", "error");
    statusDiv.innerHTML = `<div class="card" style="border-left:4px solid var(--purple); padding:12px; color:var(--purple); font-weight:bold;">🤖 AI scanning all recipes for allergens...</div>`;
    const recipeData = menuRecipes.map(r => ({
        id: r.id, name: r.name,
        ingredients: (r.ingredients || []).map(ing => {
            if (ing.type === 'inv') { const inv = window.inventoryItems.find(i => i.id === ing.ref); return inv ? inv.name : ing.name; }
            return ing.name;
        })
    }));
    const prompt = `You are an allergen detection AI for a restaurant. For each recipe, identify the following allergens and dietary flags that ARE PRESENT: GF (gluten free), DF (dairy free), VG (vegan), V (vegetarian), NF (nut free), SF (shellfish free), EF (egg free), SPICY, contains: Gluten, Dairy, Eggs, Nuts, Shellfish, Fish, Soy, Sesame.
Return ONLY JSON: { "results": [ { "id": "recipe_id", "allergens": ["GF", "contains: Dairy"] } ] }
Recipes: ${JSON.stringify(recipeData)}`;
    try {
        const apiKey = window.getApiKey(); if (!apiKey) return;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const aiResult = JSON.parse(rawJson);
        (aiResult.results || []).forEach(res => {
            const recipe = window.recipes.find(r => r.id === res.id);
            if (recipe) recipe.allergens = res.allergens;
        });
        window.saveToDisk();
        statusDiv.innerHTML = `<div class="card" style="border-left:4px solid var(--green); padding:12px; color:var(--green); font-weight:bold;">✓ Allergen scan complete. Matrix updated.</div>`;
        window.showView('allergens');
    } catch (e) { statusDiv.innerHTML = `<div class="card" style="border-left:4px solid var(--red); padding:12px; color:var(--red);">AI Error: ${e.message}</div>`; }
};

window.renderSheetGenView = () => {
    return `<div style="max-width: 1100px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">📄 AI Run Sheet Generator</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Paste booking data to generate a smart run sheet for tonight's service</div>
            </div>
            <button onclick="window.print()" class="btn btn-outline" style="background:white; color:black; font-weight:bold;">🖨️ Print Run Sheet</button>
        </div>
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <div class="card no-print" style="flex:1; min-width:300px;">
                <label style="font-size:12px; color:var(--text-muted);">Paste SevenRooms / booking data below</label>
                <textarea id="raw-bookings" class="input-box" style="height:200px; font-size:12px; white-space:pre; margin-top:8px;" placeholder="Paste booking text or CSV from SevenRooms..."></textarea>
                <button onclick="window.generateRunSheet()" class="btn btn-purple" style="width:100%; font-size:16px; margin-top:10px;">✨ Generate Smart Sheet</button>
            </div>
            <div class="card" id="print-section" style="flex:2; background:white; color:black; min-height:600px; min-width:550px; padding:30px;">
                <div id="run-sheet-output"><p style="text-align:center; color:#999; margin-top:100px;">Your generated run sheet will appear here.</p></div>
            </div>
        </div>
    </div>`;
};

window.generateRunSheet = async () => {
    const rawText = document.getElementById('raw-bookings').value;
    const outputDiv = document.getElementById('run-sheet-output');
    if (!rawText.trim()) return window.showToast("Paste booking data first.", "error");
    outputDiv.innerHTML = `<p style="text-align:center; color:#666;">🤖 Generating run sheet...</p>`;
    const prompt = `You are a hospitality operations AI for Bar Wa Izakaya in Hobart. Generate a professional run sheet from this booking data.
Format as clean HTML using only inline styles (white background, black text — this will be printed). 
Include: date/time, pax count, booking name, special requirements, staff notes. Group by time slot. Add a staff checklist section at the end.
Booking data: ${rawText}`;
    try {
        const apiKey = window.getApiKey(); if (!apiKey) return;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        const text = data.candidates[0].content.parts[0].text;
        outputDiv.innerHTML = text.replace(/^```html/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        window.showToast("Run sheet generated!");
    } catch (e) { outputDiv.innerHTML = `<p style="color:red;">Error: ${e.message}</p>`; }
};

window.checkRecipeMargins = () => {
    let alerts = [];
    (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived).forEach(recipe => {
        let currentCost = 0;
        (recipe.ingredients || []).forEach(ing => {
            if (ing.type === 'inv') { let inv = window.inventoryItems.find(i => i.id === ing.ref); if (inv) currentCost += Number(ing.qty) * (Number(inv.price) / Number(inv.yield || 1)); }
            else if (ing.type === 'batch') { let b = window.recipes.find(r => r.id === ing.ref); if (b) currentCost += Number(ing.qty) * (Number(b.cost) / Number(b.yieldQty || 1)); }
        });
        const newGp = recipe.price > 0 ? ((recipe.price - currentCost) / recipe.price * 100).toFixed(1) : 0;
        if (Number(newGp) < GP_TARGET) alerts.push({ name: recipe.name, currentGp: newGp, cost: currentCost.toFixed(2) });
        recipe.cost = currentCost;
        recipe.gp = parseFloat(newGp);
    });
    return alerts;
};
