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
        `<option value="${z.name}" ${z.name === selectedZoneName ? 'selected' : ''}>${z.name}</option>`
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
            <td style="padding:12px 15px;"><strong>${z.name}</strong></td>
            <td style="padding:12px 15px;">
                <select onchange="window.storageZones[${i}].area = this.value; window.saveToDisk(); window.showView('zones');" class="input-box" style="margin:0; padding:6px; width:120px;">
                    <option ${z.area==='BOH'?'selected':''}>BOH</option>
                    <option ${z.area==='FOH'?'selected':''}>FOH</option>
                    <option ${z.area==='Other'?'selected':''}>Other</option>
                </select>
            </td>
            <td style="padding:12px 15px; text-align:right;">
                <button onclick="window.editZoneForm(${i})" class="btn btn-outline" style="font-size:11px; padding:5px 10px; margin-right:5px;">Rename</button>
                <button onclick="window.deleteZone(${i})" class="btn btn-red" style="font-size:11px; padding:5px 10px;">Delete</button>
            </td>
        </tr>
    `).join('');

    return `
    <div style="max-width: 700px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0;">Storage Zones</h2>
                <p style="margin:5px 0 0 0; color:var(--text-muted); font-size:13px;">These zones appear in Inventory, Invoice Ripper, and Recipe Quick-Add.</p>
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
                    ${zonesHtml.length ? zonesHtml : '<tr><td colspan="3" style="padding:20px; text-align:center; color:var(--text-muted);">No zones yet. Add one above.</td></tr>'}
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
        <input type="text" id="zone-name" class="input-box" value="${z.name}" placeholder="e.g. Beer Fridge, Freezer 2">
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
    if (confirm(`Delete zone "${z.name}"? Items using this zone will show as Unassigned.`)) {
        window.storageZones.splice(i, 1);
        window.saveToDisk();
        window.showView('zones');
        window.showToast("Zone deleted.");
    }
};

// Zones view is registered in core.js router — no patch needed here

// =============================================================================
// 2. SUPPLIER MANAGEMENT
// =============================================================================

window.renderSupplierView = () => {
    return `
    <div style="max-width: 1000px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 style="margin:0;">Supplier Management</h2>
            <button onclick="window.editSupplierForm()" class="btn btn-blue">+ Add Supplier</button>
        </div>
        <table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse:collapse; overflow:hidden;">
            <thead>
                <tr style="text-align:left; border-bottom:1px solid var(--border); background:#111; font-size:13px;">
                    <th style="padding:15px;">Supplier Name</th>
                    <th style="padding:15px;">Contact Info</th>
                    <th style="padding:15px;">Logistics</th>
                    <th style="text-align:right; padding:15px;">Action</th>
                </tr>
            </thead>
            <tbody>
                ${(window.suppliers||[]).length === 0
                    ? '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">No suppliers added yet.</td></tr>'
                    : (window.suppliers||[]).map((s, i) => `
                    <tr style="border-bottom:1px solid var(--bg-main);">
                        <td style="padding:15px;"><strong>${s.name}</strong></td>
                        <td style="padding:15px; font-size:13px;">${s.contact || 'N/A'}</td>
                        <td style="padding:15px; font-size:13px; color:var(--brand-accent);">
                            Min Spend: <strong>$${s.minSpend || 0}</strong><br>
                            Cutoff: ${s.cutoff || 'N/A'}<br>
                            Days: ${s.deliveryDays && s.deliveryDays.length > 0 ? s.deliveryDays.join(', ') : 'All'}
                        </td>
                        <td style="text-align:right; padding:15px;">
                            <button onclick="window.editSupplierForm(${i})" class="btn btn-outline" style="font-size:11px; padding:5px 10px;">Edit</button>
                            <button onclick="window.delSupplier(${i})" class="btn btn-red" style="font-size:11px; padding:5px 10px; margin-left:5px;">X</button>
                        </td>
                    </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
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
        <input type="text" id="sup-n" class="input-box" value="${s.name}" placeholder="e.g. Moco Food Services">
        <label style="font-size:12px; color:var(--text-muted);">Contact (Email/Phone)</label>
        <input type="text" id="sup-c" class="input-box" value="${s.contact}" placeholder="orders@...">
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
        name: document.getElementById('sup-n').value,
        contact: document.getElementById('sup-c').value,
        cutoff: document.getElementById('sup-cut').value,
        minSpend: parseFloat(document.getElementById('sup-min').value) || 0,
        deliveryDays: selectedDays
    };
    if (!obj.name) return window.showToast("Supplier Name is required.", "error");
    if (i !== null && i !== undefined) window.suppliers[i] = obj; else window.suppliers.push(obj);
    window.saveToDisk(); window.showView('suppliers');
};
window.delSupplier = (i) => {
    if (confirm("Delete Supplier?")) { window.suppliers.splice(i, 1); window.saveToDisk(); window.showView('suppliers'); }
};

// =============================================================================
// 3. LIVE INVENTORY
// =============================================================================

window.resetAllStock = () => {
    let pin = localStorage.getItem('venuePin');
    if (pin) {
        let attempt = prompt("⚠️ DANGER: Enter Manager PIN to wipe ALL stock levels to 0.");
        if (attempt !== pin) return window.showToast("Incorrect PIN.", "error");
    } else {
        if (!confirm("⚠️ DANGER: Wipe all stock levels to 0? (No Master PIN is set!)")) return;
    }
    if (!confirm("Are you absolutely sure? This keeps all items but resets stock to ZERO. Cannot be undone.")) return;
    let count = 0;
    (window.inventoryItems || []).forEach(i => { i.stock = 0; count++; });
    window.saveToDisk();
    window.showView('inventory');
    window.showToast(`${count} items reset to 0 stock.`, "error");
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
                <td style="padding:10px 8px; width:36px; text-align:center;">
                    <input type="checkbox" ${isSelected?'checked':''} onchange="window._invToggleSelect('${item.id}', this.checked)" style="transform:scale(1.2); cursor:pointer;">
                </td>
                <td style="padding:12px 10px;">
                    <strong style="cursor:pointer;" onclick="window.editInvItem(this.getAttribute('data-id'))" data-id="${item.id}">${item.name}</strong>
                    <br><small style="color:var(--text-muted);">${item.sku || 'No SKU'} | ${item.supplier || 'No Supplier'}</small>
                </td>
                <td style="padding:12px 10px;">
                    <strong style="color:var(--brand-accent);">$${price.toFixed(2)}</strong> / ${item.buyUnit || 'Unit'}<br>
                    <small style="color:var(--blue); font-weight:bold;">Yields ${yieldVal} ${item.useUnit || 'Unit'}</small><br>
                    <small style="color:var(--text-muted);">$${(price/yieldVal).toFixed(4)} per ${item.useUnit || 'Unit'}</small>
                </td>
                <td style="padding:12px 10px; font-size:13px; color:var(--text-muted);">${item.location || 'Unassigned'}</td>
                <td style="padding:12px 10px;">
                    <span style="color:${stock<parTarget?'var(--red)':'var(--green)'}; font-weight:bold; font-size:16px; cursor:pointer;" title="Click to edit stock" onclick="window._inlineEditStock('${item.id}')">${stock.toFixed(2)}</span>
                    <small style="color:var(--text-muted);"> / </small>
                    <span style="color:var(--text-muted); font-size:12px; cursor:pointer;" title="Click to edit PAR" onclick="window._inlineEditPar('${item.id}')">${parTarget} PAR</span>
                </td>
                <td style="text-align:right; padding:12px 10px; white-space:nowrap;">
                    <button onclick="window.viewPriceTrend(this.getAttribute('data-id'))" data-id="${item.id}" class="btn btn-outline" style="font-size:11px; padding:4px 8px; border-color:var(--purple); color:var(--purple); margin-right:4px;">📈</button>
                    <button onclick="window.editInvItem(this.getAttribute('data-id'))" data-id="${item.id}" class="btn btn-outline" style="font-size:11px; padding:4px 8px;">Edit</button>
                </td>
            </tr>`;
        }).join('');

        const grpSel = grouped[groupName].filter(i => window._invSelected.has(i.id)).length;
        const allChk = grpSel === grouped[groupName].length && grouped[groupName].length > 0 ? 'checked' : '';
        return `
        <details class="card" style="padding:0; overflow:visible; margin-bottom:10px;" open>
            <summary style="padding:12px 15px; background:#111; cursor:pointer; font-weight:bold; color:var(--brand-dark); display:flex; justify-content:space-between; align-items:center; outline:none; border-bottom:1px solid var(--border); border-radius:10px 10px 0 0;">
                <span style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" ${allChk} onclick="event.stopPropagation(); window._invSelectGroup('${groupName}', this.checked)" style="transform:scale(1.2);">
                    ${groupName} <span style="color:var(--text-muted); font-size:12px; font-weight:normal;">(${grouped[groupName].length} items)</span>
                </span>
                <span style="color:var(--blue); font-size:12px;">▼</span>
            </summary>
            <div style="overflow-x:auto; overflow-y:visible;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr style="background:#0a0a0c; font-size:11px; color:var(--text-muted); text-transform:uppercase;">
                        <th style="padding:8px; width:36px;"></th>
                        <th style="padding:8px 10px; text-align:left;">Product</th>
                        <th style="padding:8px 10px; text-align:left;">Pricing</th>
                        <th style="padding:8px 10px; text-align:left;">Zone</th>
                        <th style="padding:8px 10px; text-align:left;">Stock / PAR</th>
                        <th style="padding:8px 10px;"></th>
                    </tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
            </div>
        </details>`;
    }).join('');

    if (Object.keys(grouped).length === 0) {
        accordionHtml = '<div class="card" style="text-align:center; padding:30px; color:var(--text-muted);">No products found matching filters.</div>';
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
            <button onclick="window._invSelected=new Set(); window.showView('inventory')" class="btn btn-outline" style="font-size:12px; padding:6px 12px; color:var(--text-muted);">✕ Clear</button>
        </div>
    </div>` : '';

    return `
    <div style="max-width:1300px; margin:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0;">Live Inventory <span style="font-size:14px; color:var(--text-muted); font-weight:normal;">(${filtered.length} items)</span></h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button onclick="window.showView('zones')" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">⚙️ Zones</button>
                <button onclick="window.resetAllStock()" class="btn btn-outline" style="color:var(--red); border-color:var(--red); font-size:12px;">⚠️ Wipe Stock</button>
                <button onclick="window.editInvItem()" class="btn btn-blue">+ Add Product</button>
            </div>
        </div>
        <input type="text" class="search-bar" placeholder="🔍 Search items or SKU..." value="${window.invFilters.search}" oninput="window.invFilters.search=this.value; window.showView('inventory')">
        <div style="margin-bottom:15px;">${pillsHtml}</div>
        <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:15px; flex-wrap:wrap;">
            <span style="font-size:12px; color:var(--text-muted); align-self:center;">Group By:</span>
            <button onclick="window.invFilters.groupBy='Category'; window.showView('inventory')" class="btn ${window.invFilters.groupBy==='Category'?'btn-dark':'btn-outline'}" style="padding:6px 15px; font-size:12px;">Category</button>
            <button onclick="window.invFilters.groupBy='Zone'; window.showView('inventory')" class="btn ${window.invFilters.groupBy==='Zone'?'btn-dark':'btn-outline'}" style="padding:6px 15px; font-size:12px;">Zone</button>
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
        if (!confirm('Permanently delete ' + ids.length + ' items? This cannot be undone.')) return;
        window.inventoryItems = window.inventoryItems.filter(i => !ids.includes(i.id));
        window._invSelected = new Set(); window.saveToDisk(); window.showToast(ids.length + ' items deleted.'); window.showView('inventory'); return;
    }
    if (action === 'archive') {
        ids.forEach(id => { const it = window.inventoryItems.find(i=>i.id===id); if(it) it.archived=true; });
        window._invSelected = new Set(); window.saveToDisk(); window.showToast(ids.length + ' items archived.'); window.showView('inventory'); return;
    }
    const opts = action === 'zone'
        ? '<option value="">Unassigned</option>' + (window.storageZones||[]).map(z=>'<option value="'+z.name+'">'+z.name+'</option>').join('')
        : action === 'supplier'
        ? '<option value="">-- None --</option>' + (window.suppliers||[]).map(s=>'<option value="'+s.name+'">'+s.name+'</option>').join('')
        : ['Food','Beverage','Packaging','Chemicals','Other',...new Set((window.inventoryItems||[]).map(i=>i.category))].map(c=>'<option>'+c+'</option>').join('');
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
        `<option value="${s.name}" ${e.supplier === s.name ? 'selected' : ''}>${s.name}</option>`
    ).join('');
    const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
    const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
    let pWd = e.parWeekday !== undefined ? e.parWeekday : (e.par || 0);
    let pWe = e.parWeekend !== undefined ? e.parWeekend : (e.par || 0);

    let html = `
    <div class="card" style="max-width:700px; margin:auto; padding-bottom: 80px;">
        <h2 style="margin-top:0;">${id ? 'Edit Product' : 'New Product'}</h2>
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:15px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Product Name</label><input type="text" id="iv-n" class="input-box" value="${e.name}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iv-cat" list="cat-list" class="input-box" value="${e.category}"><datalist id="cat-list">${catOpts}</datalist></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Supplier</label><select id="iv-s" class="input-box"><option value="">-- None --</option>${supplierOpts}</select></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Supplier SKU / Order Code</label><input type="text" id="iv-sku" class="input-box" value="${e.sku || ''}"></div>
        </div>
        <div style="background:var(--bg-main); padding:15px; border-radius:8px; border:1px solid var(--border); margin-bottom:15px;">
            <h4 style="margin:0 0 10px 0; color:var(--brand-accent);">Commercial Math & Yield</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px;">
                <div><label style="font-size:11px; color:var(--text-muted);">Buy Price ($)</label><input type="number" step="0.01" id="iv-p" class="input-box" value="${e.price}"></div>
                <div><label style="font-size:11px; color:var(--text-muted);">Buy Unit (e.g. Box, Keg)</label><input type="text" id="iv-buyUnit" class="input-box" value="${e.buyUnit}"></div>
                <div style="padding-top:20px;"><label style="font-size:13px; cursor:pointer;"><input type="checkbox" id="iv-gst" ${e.gstFree ? 'checked' : ''} style="transform:scale(1.2);"> GST Free</label></div>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; padding-top:10px; border-top:1px dashed var(--border);">
                <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-Units per Buy-Unit)</label><input type="number" step="0.01" id="iv-yield" class="input-box" value="${e.yield}" style="border-color:var(--blue);"></div>
                <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit (e.g. kg, ml, portion)</label><input type="text" id="iv-useUnit" class="input-box" value="${e.useUnit}" style="border-color:var(--blue);"></div>
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
    let existingIdx = window.inventoryItems.findIndex(i => i.id === id);
    const price = parseFloat(document.getElementById('iv-p').value) || 0;
    let obj = {
        id: id,
        name: document.getElementById('iv-n').value,
        category: document.getElementById('iv-cat').value,
        sku: document.getElementById('iv-sku').value,
        supplier: document.getElementById('iv-s').value,
        price: price,
        location: document.getElementById('iv-loc').value,
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
                    <td style="padding:10px;">${h.date}</td>
                    <td style="padding:10px;">${h.supplier}</td>
                    <td style="padding:10px;">${h.qty}</td>
                    <td style="padding:10px; font-weight:bold; color:var(--brand-accent);">$${Number(h.price).toFixed(2)}</td>
                    <td style="padding:10px;">${changeHtml}</td>
                </tr>`;
            }).join('')}
        </table>`;
    window.openModal(`📈 Price Trend: ${item.name}`, `<div style="max-height:400px; overflow-y:auto;">${historyHtml}</div><button onclick="window.closeModal()" class="btn btn-dark" style="width:100%; margin-top:20px;">Close</button>`);
};

// =============================================================================
// 4. RECIPE ENGINE — PHASE 2
// Bulk HTML importer, photo/video, print, scale, station tags, status,
// Margin Health view, 67% GP threshold
// =============================================================================

const GP_TARGET = 67;

window.recFilters = window.recFilters || { search: '', filter: 'All', station: 'All', status: 'Active' };
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
    const typePills = ['All','Menu','Batch'].map(c => `<div class="tag-pill ${window.recFilters.filter===c?'active':''}" onclick="window.recFilters.filter='${c}';window.showView('recipes')">${c}</div>`).join('');
    const stationPills = ['All','Kitchen','Bar','Prep'].map(s => `<div class="tag-pill ${window.recFilters.station===s?'active':''}" onclick="window.recFilters.station='${s}';window.showView('recipes')">${s}</div>`).join('');
    const statusPills = ['Active',"86'd",'Development'].map(s => `<div class="tag-pill ${window.recFilters.status===s?'active':''}" onclick="window.recFilters.status='${s}';window.showView('recipes')">${s}</div>`).join('');
    return `
    <div style="max-width:1200px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <h2 style="margin:0;">Recipe Engine <span style="font-size:14px;color:var(--text-muted);font-weight:normal;">(${filtered.length} shown)</span></h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="window.exportRecipeBook()" class="btn btn-outline" style="border-color:var(--green);color:var(--green);font-size:12px;">📖 Recipe Book</button>
                <button onclick="window.showView('batch-linker')" class="btn btn-outline" style="border-color:var(--orange);color:var(--orange);font-size:12px;">🔗 Link Ingredients</button>
                <button onclick="window.openBulkHtmlImport()" class="btn btn-purple">📥 Bulk Import</button>
                <button onclick="window.openAiRecipeImport()" class="btn btn-outline" style="font-size:12px;">✨ AI Import</button>
            </div>
        </div>
        <input type="text" class="search-bar" placeholder="🔍 Search recipes or POS alias..." value="${window.recFilters.search}" oninput="window.recFilters.search=this.value;window.showView('recipes')">
        <div style="display:flex;gap:20px;margin-bottom:15px;flex-wrap:wrap;">
            <div><small style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</small><div style="margin-top:5px;">${typePills}</div></div>
            <div><small style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Station</small><div style="margin-top:5px;">${stationPills}</div></div>
            <div><small style="color:var(--text-muted);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Status</small><div style="margin-top:5px;">${statusPills}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:15px;">
            ${filtered.length===0?'<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);grid-column:1/-1;">No recipes found.</div>':filtered.map(r=>{
                const gpColor=r.gp>=GP_TARGET?'var(--green)':r.gp>0?'var(--red)':'var(--text-muted)';
                const station=r.station||'Kitchen';
                const status=r.status||'Active';
                const statusColor=status==='Active'?'var(--green)':status==="86'd"?'var(--red)':'var(--orange)';
                return `<div class="card" style="border-top:4px solid ${stationColor[station]||'var(--border)'};cursor:pointer;transition:transform 0.15s;padding:15px;" onclick="window.viewRecipe('${r.id}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    ${r.photo?`<img src="${r.photo}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;">`:''}
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                        <h4 style="margin:0;font-size:14px;flex:1;padding-right:6px;line-height:1.3;">${r.name}</h4>
                        <span style="font-size:10px;color:${statusColor};border:1px solid ${statusColor};padding:2px 5px;border-radius:8px;white-space:nowrap;">${status}</span>
                    </div>
                    <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
                        <span style="font-size:11px;color:${stationColor[station]};border:1px solid ${stationColor[station]};padding:2px 7px;border-radius:8px;">${station}</span>
                        <span style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);padding:2px 7px;border-radius:8px;">${r.type}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;background:var(--bg-main);padding:8px 10px;border-radius:6px;font-size:12px;border:1px solid var(--border);">
                        <div style="color:var(--text-muted);">Cost:<strong style="color:var(--brand-accent);"> $${Number(r.cost||0).toFixed(2)}</strong><br>${r.type==='Menu'?`Sell: $${Number(r.price||0).toFixed(2)}`:`Yield: ${r.yieldQty} ${r.yieldUnit}`}</div>
                        ${r.type==='Menu'&&r.price>0?`<div style="font-size:20px;font-weight:bold;color:${gpColor};align-self:center;">${r.gp||0}%</div>`:''}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">📋 ${(r.ingredients||[]).filter(i=>i.type==='inv'||i.type==='batch').length} linked · ${(r.ingredients||[]).filter(i=>i.type==='raw').length} raw</div>
                </div>`;
            }).join('')}
        </div>
    </div>`;
};

window.viewRecipe = (id) => {
    const r = window.recipes.find(x => x.id === id);
    if (!r) return;
    const stationColor = {'Kitchen':'var(--orange)','Bar':'var(--blue)','Prep':'var(--purple)'};
    const station = r.station||'Kitchen';
    const gpColor = r.gp>=GP_TARGET?'var(--green)':r.gp>0?'var(--red)':'var(--text-muted)';
    let ingListHtml = (r.ingredients||[]).map(ing => {
        if (ing.type==='raw') return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;color:var(--text-muted);">• ${ing.name}</div>`;
        const inv = ing.type==='inv'?window.inventoryItems.find(i=>i.id===ing.ref):null;
        const batch = ing.type==='batch'?window.recipes.find(x=>x.id===ing.ref):null;
        const label = inv?`${ing.qty} ${inv.useUnit} ${inv.name}`:batch?`${ing.qty} ${batch.yieldUnit} ${batch.name}`:`${ing.name}`;
        const cost = inv?(ing.qty*((inv.price||0)/(inv.yield||1))).toFixed(2):batch?(ing.qty*((batch.cost||0)/(batch.yieldQty||1))).toFixed(2):null;
        return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-size:14px;"><span>• ${label}</span>${cost?`<span style="color:var(--brand-accent);font-size:12px;">$${cost}</span>`:''}</div>`;
    }).join('');
    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
            <button onclick="window.showView(\'recipes\')" class="btn btn-outline" style="font-size:12px;">← Back</button>
            <div style="display:flex;gap:8px;">
                <button onclick="window.printRecipe('${r.id}')" class="btn btn-outline" style="font-size:12px;">🖨️ Print</button>
                <button onclick="window.editRecipeForm('${r.id}')" class="btn btn-blue" style="font-size:12px;">✏️ Edit</button>
            </div>
        </div>
        <div class="card" style="border-top:5px solid ${stationColor[station]};padding:30px;">
            ${r.photo?`<img src="${r.photo}" style="width:100%;max-height:280px;object-fit:cover;border-radius:8px;margin-bottom:20px;">`:''}
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:15px;margin-bottom:20px;">
                <div>
                    <h2 style="margin:0 0 8px 0;">${r.name}</h2>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <span style="font-size:12px;color:${stationColor[station]};border:1px solid ${stationColor[station]};padding:3px 10px;border-radius:12px;">${station}</span>
                        <span style="font-size:12px;color:var(--text-muted);border:1px solid var(--border);padding:3px 10px;border-radius:12px;">${r.type}</span>
                        <span style="font-size:12px;color:var(--text-muted);border:1px solid var(--border);padding:3px 10px;border-radius:12px;">${r.status||'Active'}</span>
                    </div>
                </div>
                <div style="text-align:right;">
                    ${r.type==='Menu'&&r.price>0?`<div style="font-size:36px;font-weight:bold;color:${gpColor};line-height:1;">${r.gp||0}% GP</div><div style="font-size:12px;color:var(--text-muted);">Cost $${Number(r.cost||0).toFixed(2)} · Sell $${Number(r.price||0).toFixed(2)}</div>`:''}
                    ${r.type==='Batch'?`<div style="font-size:18px;font-weight:bold;color:var(--purple);">Yields ${r.yieldQty} ${r.yieldUnit}</div><div style="font-size:12px;color:var(--text-muted);">Cost $${Number(r.cost||0).toFixed(2)}</div>`:''}
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 2fr;gap:30px;">
                <div>
                    <h3 style="margin:0 0 10px 0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Ingredients</h3>
                    ${ingListHtml||'<p style="color:var(--text-muted);font-size:13px;">No ingredients yet.</p>'}
                </div>
                <div>
                    <h3 style="margin:0 0 10px 0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Method</h3>
                    <div style="font-size:14px;line-height:1.8;white-space:pre-wrap;">${r.method||'<span style="color:var(--text-muted);">No method written yet.</span>'}</div>
                </div>
            </div>
            ${r.videoUrl?`<div style="margin-top:25px;border-top:1px solid var(--border);padding-top:20px;"><h3 style="margin:0 0 10px 0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">📹 Training Video</h3><div style="position:relative;padding-bottom:56.25%;height:0;border-radius:8px;overflow:hidden;"><iframe src="${r.videoUrl.replace('watch?v=','embed/').replace('youtu.be/','youtube.com/embed/')}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div></div>`:''}
            ${r.allergens&&r.allergens.length>0?`<div style="margin-top:15px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);padding:12px 15px;border-radius:8px;"><strong style="font-size:12px;color:var(--red);">⚠️ Allergens:</strong> <span style="font-size:13px;color:var(--red);">${r.allergens.join(', ')}</span></div>`:''}
        </div>
    </div>`;
};

window.printRecipe = (id) => {
    const r = window.recipes.find(x => x.id === id);
    if (!r) return;
    let ingText = (r.ingredients||[]).map(ing => {
        if (ing.type==='raw') return `<li>${ing.name}</li>`;
        const inv = ing.type==='inv'?window.inventoryItems.find(i=>i.id===ing.ref):null;
        const batch = ing.type==='batch'?window.recipes.find(x=>x.id===ing.ref):null;
        if (inv) return `<li>${ing.qty} ${inv.useUnit} — ${inv.name}</li>`;
        if (batch) return `<li>${ing.qty} ${batch.yieldUnit} — ${batch.name}</li>`;
        return `<li>${ing.name}</li>`;
    }).join('');
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${r.name}</title><style>
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
    <h1>${r.name}</h1>
    ${r.type==='Menu'&&r.price>0?`<div class="gp">${r.gp||0}% GP</div>`:''}
    <div class="meta">${r.station||'Kitchen'} · ${r.type} · ${r.status||'Active'}${r.type==='Batch'?` · Yields ${r.yieldQty} ${r.yieldUnit}`:''}</div>
    <h2>Ingredients</h2><ul>${ingText||'<li>No ingredients listed</li>'}</ul>
    <h2>Method</h2><div class="method">${r.method||'No method written.'}</div>
    ${r.allergens&&r.allergens.length>0?`<div class="allergens"><strong>⚠️ Allergens:</strong> ${r.allergens.join(', ')}</div>`:''}
    <div style="margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">Bar Wa Izakaya · Hobart Hub · Printed ${new Date().toLocaleDateString('en-AU')}</div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
};

window.exportRecipeBook = () => {
    const stations = ['Kitchen', 'Bar', 'Prep'];
    const activeRecipes = (window.recipes || []).filter(r => !r.archived && (r.status || 'Active') === 'Active');

    if (activeRecipes.length === 0) return window.showToast('No active recipes to export.', 'error');

    const buildIngList = (r) => {
        return (r.ingredients || []).map(ing => {
            if (ing.type === 'raw') return '<li style="color:#666;">' + ing.name + ' <em style="color:#aaa;">(unlinked)</em></li>';
            const inv = ing.type === 'inv' ? (window.inventoryItems || []).find(i => i.id === ing.ref) : null;
            const batch = ing.type === 'batch' ? (window.recipes || []).find(x => x.id === ing.ref) : null;
            if (inv) {
                const cost = (ing.qty * ((inv.price || 0) / (inv.yield || 1))).toFixed(2);
                return '<li>' + ing.qty + ' ' + (inv.useUnit || '') + ' <strong>' + inv.name + '</strong> <span style="color:#888;font-size:11px;">($' + cost + ')</span></li>';
            }
            if (batch) return '<li>' + ing.qty + ' ' + (batch.yieldUnit || '') + ' <strong>' + batch.name + '</strong> <em style="color:#888;font-size:11px;">(batch)</em></li>';
            return '<li>' + ing.name + '</li>';
        }).join('');
    };

    const stationColor = { 'Kitchen': '#f59e0b', 'Bar': '#3b82f6', 'Prep': '#8b5cf6' };
    const stationLabel = { 'Kitchen': '👨‍🍳 Kitchen', 'Bar': '🍹 Bar', 'Prep': '⚙️ Prep' };

    // Index page: build table of contents grouped by station
    let indexHtml = '<div style="page-break-after:always;">' +
        '<div style="border-bottom:4px solid #111;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:flex-end;">' +
            '<div><h1 style="margin:0;font-size:32px;letter-spacing:2px;">BAR WA IZAKAYA</h1>' +
            '<p style="margin:5px 0 0 0;color:#666;font-size:14px;letter-spacing:1px;text-transform:uppercase;">Recipe Book · Active Menu</p></div>' +
            '<p style="margin:0;color:#aaa;font-size:12px;">Printed ' + new Date().toLocaleDateString('en-AU', {day:'numeric',month:'long',year:'numeric'}) + '</p>' +
        '</div>' +
        '<h2 style="font-size:16px;text-transform:uppercase;letter-spacing:2px;color:#444;margin:0 0 20px 0;">Table of Contents</h2>';

    let pageNum = 2; // page 1 = index
    stations.forEach(station => {
        const stRecipes = activeRecipes.filter(r => (r.station || 'Kitchen') === station);
        if (stRecipes.length === 0) return;
        indexHtml += '<div style="margin-bottom:25px;">' +
            '<h3 style="margin:0 0 10px 0;color:' + stationColor[station] + ';font-size:13px;text-transform:uppercase;letter-spacing:2px;border-left:4px solid ' + stationColor[station] + ';padding-left:10px;">' + stationLabel[station] + '</h3>' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;">';
        stRecipes.forEach(r => {
            const gpText = r.type === 'Menu' && r.price > 0 ? r.gp + '% GP' : r.type === 'Batch' ? 'Yields ' + r.yieldQty + ' ' + r.yieldUnit : '';
            indexHtml += '<tr style="border-bottom:1px solid #eee;">' +
                '<td style="padding:7px 10px 7px 0;"><strong>' + r.name + '</strong>' + (r.posAlias ? ' <span style="color:#aaa;font-size:11px;">(' + r.posAlias + ')</span>' : '') + '</td>' +
                '<td style="padding:7px;color:#888;font-size:12px;">' + (r.category || '') + '</td>' +
                '<td style="padding:7px;color:' + (r.gp >= GP_TARGET ? '#16a34a' : r.gp > 0 ? '#dc2626' : '#888') + ';font-size:12px;text-align:right;">' + gpText + '</td>' +
                '<td style="padding:7px 0 7px 10px;color:#aaa;font-size:11px;text-align:right;">p.' + pageNum + '</td>' +
            '</tr>';
            pageNum++;
        });
        indexHtml += '</table></div>';
    });

    indexHtml += '<div style="margin-top:30px;padding-top:15px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center;">' +
        activeRecipes.length + ' active recipes · ' + activeRecipes.filter(r => (r.ingredients||[]).some(i=>i.type==='raw')).length + ' with unlinked ingredients · GP Target: ' + GP_TARGET + '%' +
    '</div></div>';

    // Recipe pages: one per recipe, grouped by station
    let recipePagesHtml = '';
    stations.forEach(station => {
        const stRecipes = activeRecipes.filter(r => (r.station || 'Kitchen') === station);
        stRecipes.forEach((r, idx) => {
            const isLast = station === stations[stations.length - 1] || idx < stRecipes.length - 1;
            const gpColor = r.gp >= GP_TARGET ? '#16a34a' : r.gp > 0 ? '#dc2626' : '#888';
            const ingList = buildIngList(r);
            const rawCount = (r.ingredients || []).filter(i => i.type === 'raw').length;
            const linkedCount = (r.ingredients || []).filter(i => i.type === 'inv' || i.type === 'batch').length;

            recipePagesHtml += '<div style="page-break-after:always;">' +
                // Station colour bar header
                '<div style="background:' + stationColor[station] + ';color:white;padding:12px 20px;margin:-30px -30px 20px -30px;display:flex;justify-content:space-between;align-items:center;">' +
                    '<span style="font-size:11px;text-transform:uppercase;letter-spacing:2px;opacity:0.9;">' + stationLabel[station] + '</span>' +
                    '<span style="font-size:11px;opacity:0.8;">Bar Wa Izakaya</span>' +
                '</div>' +
                // Photo if exists
                (r.photo ? '<img src="' + r.photo + '" style="width:100%;max-height:180px;object-fit:cover;border-radius:6px;margin-bottom:15px;">' : '') +
                // Title + GP badge
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                    '<div>' +
                        '<h1 style="margin:0;font-size:24px;">' + r.name + '</h1>' +
                        (r.posAlias ? '<p style="margin:4px 0 0 0;font-size:11px;color:#888;">POS: ' + r.posAlias + '</p>' : '') +
                    '</div>' +
                    (r.type === 'Menu' && r.price > 0 ?
                        '<div style="text-align:right;"><div style="font-size:28px;font-weight:bold;color:' + gpColor + ';">' + r.gp + '%</div>' +
                        '<div style="font-size:11px;color:#888;">GP · Cost $' + Number(r.cost||0).toFixed(2) + ' · Sell $' + Number(r.price||0).toFixed(2) + '</div></div>' :
                        r.type === 'Batch' ? '<div style="font-size:16px;font-weight:bold;color:#8b5cf6;">Yields ' + r.yieldQty + ' ' + r.yieldUnit + '</div>' : '') +
                '</div>' +
                // Meta row
                '<div style="display:flex;gap:8px;margin-bottom:15px;flex-wrap:wrap;">' +
                    '<span style="font-size:11px;background:' + stationColor[station] + '22;color:' + stationColor[station] + ';padding:3px 10px;border-radius:10px;border:1px solid ' + stationColor[station] + '44;">' + station + '</span>' +
                    '<span style="font-size:11px;background:#f3f4f6;color:#666;padding:3px 10px;border-radius:10px;">' + r.type + '</span>' +
                    (r.allergens && r.allergens.length > 0 ? '<span style="font-size:11px;background:#fff3f3;color:#dc2626;padding:3px 10px;border-radius:10px;border:1px solid #fca5a5;">⚠️ ' + r.allergens.join(', ') + '</span>' : '') +
                '</div>' +
                // Two column: ingredients + method
                '<div style="display:grid;grid-template-columns:1fr 1.6fr;gap:25px;">' +
                    '<div>' +
                        '<h2 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin:0 0 8px 0;border-bottom:2px solid #eee;padding-bottom:5px;">Ingredients</h2>' +
                        '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;">' + (ingList || '<li style="color:#aaa;">No ingredients listed</li>') + '</ul>' +
                        (rawCount > 0 ? '<p style="font-size:10px;color:#f59e0b;margin:8px 0 0 0;">⚠️ ' + rawCount + ' unlinked ingredient' + (rawCount !== 1 ? 's' : '') + '</p>' : '') +
                    '</div>' +
                    '<div>' +
                        '<h2 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin:0 0 8px 0;border-bottom:2px solid #eee;padding-bottom:5px;">Method</h2>' +
                        '<div style="font-size:13px;line-height:1.8;white-space:pre-wrap;color:#333;">' + (r.method || '<span style="color:#aaa;">No method written.</span>') + '</div>' +
                    '</div>' +
                '</div>' +
                // Footer
                '<div style="margin-top:20px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#bbb;display:flex;justify-content:space-between;">' +
                    '<span>Bar Wa Izakaya · Hobart Hub</span>' +
                    '<span>' + linkedCount + ' linked · ' + rawCount + ' raw · Last modified: ' + (r.lastModified || 'N/A') + '</span>' +
                '</div>' +
            '</div>';
        });
    });

    const fullHtml = '<!DOCTYPE html><html><head><title>BWI Recipe Book</title><style>' +
        'body{font-family:Georgia,serif;font-size:13px;color:#222;max-width:780px;margin:30px auto;line-height:1.6;padding:30px;}' +
        'h1,h2,h3{font-family:"Helvetica Neue",Arial,sans-serif;}' +
        'ul{margin:0;padding-left:20px;}li{margin-bottom:3px;}' +
        '@media print{' +
            'body{margin:0;padding:20px;max-width:none;}' +
            '@page{margin:15mm;size:A4;}' +
        '}' +
    '</style></head><body>' +
        indexHtml + recipePagesHtml +
        '<script>window.onload=()=>{window.print();}<\/script>' +
    '</body></html>';

    const win = window.open('', '_blank');
    if (!win) return window.showToast('Pop-up blocked. Allow pop-ups for this site.', 'error');
    win.document.write(fullHtml);
    win.document.close();
    window.showToast('Recipe book opened — ' + activeRecipes.length + ' recipes!');
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
    let invOpts = (window.inventoryItems||[]).filter(i=>!i.archived).map(inv=>`<option value="inv_${inv.id}">${inv.name} (per ${inv.useUnit||'Unit'})</option>`).join('');
    let batchOpts = (window.recipes||[]).filter(b=>b.type==='Batch'&&b.id!==cleanId).map(b=>`<option value="batch_${b.id}">[Batch] ${b.name} (per ${b.yieldUnit})</option>`).join('');

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
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;"><span style="color:var(--text-muted);">${displayUnit} </span><strong style="color:${isErr?'var(--red)':isRaw?'var(--text-muted)':'var(--text-main)'};">${ing.name}${isErr?' ⚠️':''}</strong></span>
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
        <div style="max-width:880px;margin:auto;padding-bottom:80px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <button onclick="window.tempRecipeId=null;window.showView('recipes')" class="btn btn-outline" style="font-size:12px;">← Back</button>
                <div style="display:flex;gap:8px;">
                    ${cleanId?`<button onclick="window.printRecipe('${r.id}')" class="btn btn-outline" style="font-size:12px;">🖨️ Print</button>`:''}
                    ${cleanId?`<button onclick="window.delRecipe('${r.id}')" class="btn btn-red" style="font-size:12px;">🗑️ Delete</button>`:''}
                </div>
            </div>
            <div class="card" style="padding:20px;margin-bottom:15px;">
                <h3 style="margin:0 0 12px 0;">${cleanId?'Edit':'New'} Recipe</h3>
                <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div><label style="font-size:11px;color:var(--text-muted);">Name</label><input type="text" id="r-n" class="input-box" value="${r.name}" style="margin:0;"></div>
                    <div><label style="font-size:11px;color:var(--text-muted);">Type</label><select id="r-type" class="input-box" style="margin:0;" onchange="window.refreshRB()"><option ${r.type==='Menu'?'selected':''}>Menu</option><option ${r.type==='Batch'?'selected':''}>Batch</option></select></div>
                    <div><label style="font-size:11px;color:var(--text-muted);">Station</label><select id="r-station" class="input-box" style="margin:0;"><option ${(r.station||'Kitchen')==='Kitchen'?'selected':''}>Kitchen</option><option ${r.station==='Bar'?'selected':''}>Bar</option><option ${r.station==='Prep'?'selected':''}>Prep</option></select></div>
                    <div><label style="font-size:11px;color:var(--text-muted);">Status</label><select id="r-status" class="input-box" style="margin:0;"><option ${(r.status||'Active')==='Active'?'selected':''}>Active</option><option ${r.status==="86'd"?'selected':''}>86'd</option><option ${r.status==='Development'?'selected':''}>Development</option></select></div>
                </div>
                <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;">
                    ${!isBatch?`<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;"><div><label style="font-size:11px;color:var(--blue);font-weight:bold;">Lightspeed POS Alias</label><input type="text" id="r-pos" class="input-box" value="${r.posAlias||''}" placeholder="Exact POS name..." style="margin:0;border-color:var(--blue);"></div><div><label style="font-size:11px;color:var(--text-muted);">Covers/Week (Popularity)</label><input type="number" step="1" id="r-covers" class="input-box" value="${r.coversPerWeek||0}" style="margin:0;"></div></div>`:'<div></div>'}
                    <div style="display:flex;gap:8px;">
                        ${isBatch?`<div style="flex:1;"><label style="font-size:11px;color:var(--brand-accent);">Yield Qty</label><input type="number" step="0.1" id="r-yq" class="input-box" value="${r.yieldQty}" oninput="window.refreshRB()" style="margin:0;border-color:var(--brand-accent);"></div><div style="flex:1;"><label style="font-size:11px;color:var(--brand-accent);">Unit</label><input type="text" id="r-yu" class="input-box" value="${r.yieldUnit}" oninput="window.refreshRB()" style="margin:0;border-color:var(--brand-accent);"></div>`:`<div style="flex:1;"><label style="font-size:11px;color:var(--text-muted);">Sell Price ($)</label><input type="number" step="0.01" id="r-p" class="input-box" value="${r.price}" oninput="window.refreshRB()" style="margin:0;"></div>`}
                    </div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
                <div class="card" style="padding:15px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <h4 style="margin:0;font-size:14px;">Ingredients</h4>
                        <div style="display:flex;gap:5px;">
                            <button onclick="window.scaleRecipe()" class="btn btn-outline" style="padding:3px 8px;font-size:11px;">⚖️ Scale</button>
                            <button onclick="window.openQuickAddIngModal()" class="btn btn-blue" style="padding:3px 8px;font-size:11px;">+ Quick Add</button>
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
                <div style="display:flex;flex-direction:column;gap:15px;">
                    <div class="card" style="padding:15px;text-align:center;border-top:4px solid ${gpColor};">
                        ${isBatch?`<div style="font-size:11px;color:var(--text-muted);">Total Batch Cost</div><div style="font-size:30px;font-weight:bold;color:var(--brand-dark);">$${totalCost.toFixed(2)}</div><div style="font-size:11px;color:var(--purple);">$${(totalCost/(r.yieldQty||1)).toFixed(4)} per ${r.yieldUnit}</div>`:`<div style="font-size:11px;color:var(--text-muted);">Cost $${totalCost.toFixed(2)} · Sell $${r.price}</div><div style="font-size:40px;font-weight:bold;color:${gpColor};line-height:1.1;">${gp}%</div><div style="font-size:11px;color:var(--text-muted);">GP (Target: ${GP_TARGET}%)</div>`}
                    </div>
                    <div class="card" style="padding:15px;">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px;">📹 Training Video URL</label>
                        <input type="text" id="r-video" class="input-box" value="${r.videoUrl||''}" placeholder="YouTube or Vimeo URL..." style="margin:0 0 10px 0;">
                        <label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:5px;">📸 Recipe Photo</label>
                        ${r.photo?`<img src="${r.photo}" style="width:100%;height:70px;object-fit:cover;border-radius:5px;margin-bottom:6px;">`:''}
                        <input type="file" id="r-photo-file" accept="image/*" style="font-size:11px;color:var(--text-muted);" onchange="window.uploadRecipePhoto('${r.id}',this)">
                    </div>
                </div>
            </div>
            <div class="card" style="padding:15px;margin-bottom:15px;">
                <label style="font-size:11px;color:var(--text-muted);">Method / Prep Notes</label>
                <textarea id="r-m" class="input-box" placeholder="Method, plating notes, chef tips..." style="height:140px;margin-top:5px;">${r.method||''}</textarea>
            </div>
            <div class="sticky-footer">
                <button onclick="window.subRecipe('${r.id}',${totalCost})" class="btn btn-green" style="flex:2;font-size:15px;">💾 Save Recipe</button>
                <button onclick="window.tempRecipeId=null;window.showView('recipes')" class="btn btn-outline" style="flex:1;">Cancel</button>
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
    window.updateUnitHint = () => {
        const sel=document.getElementById('add-sel'); const hint=document.getElementById('unit-hint');
        if (!sel||!hint||!sel.value){if(hint)hint.innerText='';return;}
        const parts=sel.value.split('_');
        if (parts[0]==='inv'){const inv=window.inventoryItems.find(i=>i.id===sel.value.replace('inv_',''));if(inv)hint.innerHTML=`Enter qty in: <span style="background:var(--blue);color:white;padding:1px 6px;border-radius:4px;">${inv.useUnit}</span>`;}
        else {const b=window.recipes.find(x=>x.id===sel.value.replace('batch_',''));if(b)hint.innerHTML=`Enter qty in: <span style="background:var(--purple);color:white;padding:1px 6px;border-radius:4px;">${b.yieldUnit}</span>`;}
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
        const supplierOpts=(window.suppliers||[]).map(s=>`<option value="${s.name}">${s.name}</option>`).join('');
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
    const existingIdx = window.recipes.findIndex(x=>x.id===id);
    const type = document.getElementById('r-type').value;
    const oldRecipe = existingIdx>=0 ? window.recipes[existingIdx] : {};
    const obj = {
        id, name: document.getElementById('r-n').value,
        posAlias: type!=='Batch'&&document.getElementById('r-pos')?document.getElementById('r-pos').value:'',
        coversPerWeek: type!=='Batch'&&document.getElementById('r-covers')?parseInt(document.getElementById('r-covers').value)||0:(existingIdx>=0?window.recipes[existingIdx].coversPerWeek||0:0),
        type, station: document.getElementById('r-station').value, status: document.getElementById('r-status').value,
        ingredients: window.tempIngs, cost: totalCost, method: document.getElementById('r-m').value,
        allergens: oldRecipe.allergens||[], photo: oldRecipe.photo||'',
        videoUrl: document.getElementById('r-video')?document.getElementById('r-video').value:(oldRecipe.videoUrl||''),
        archived: false,
        coversPerWeek: existingIdx >= 0 ? (window.recipes[existingIdx].coversPerWeek || 0) : 0,
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
    if (confirm("Permanently delete this recipe?")) {
        window.recipes=window.recipes.filter(x=>x.id!==id);
        window.tempRecipeId=null; window.saveToDisk(); window.showToast("Recipe deleted."); window.showView('recipes');
    }
};

// =============================================================================
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
            <td style="padding:12px 15px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe('${r.id}')">${r.name}</strong> <small style="color:${stationColor[r.station||'Kitchen']};font-size:11px;">${r.station||'Kitchen'}</small></td>
            <td style="padding:12px 15px;font-size:13px;color:var(--brand-accent);">$${Number(r.cost||0).toFixed(2)}</td>
            <td style="padding:12px 15px;font-size:13px;">$${Number(r.price||0).toFixed(2)}</td>
            <td style="padding:12px 15px;min-width:140px;"><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden;"><div style="width:${Math.min(100,Math.max(0,r.gp))}%;background:${gpColor};height:100%;border-radius:4px;"></div></div><strong style="color:${gpColor};font-size:14px;min-width:38px;">${r.gp}%</strong></div></td>
            <td style="padding:12px 15px;text-align:right;"><button onclick="window.editRecipeForm('${r.id}')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Edit</button></td>
        </tr>`;
    }).join('');
    return `
    <div style="max-width:1100px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <div><h2 style="margin:0;">Margin Health</h2><small style="color:var(--text-muted);">Target: ${GP_TARGET}% GP · Active menu recipes · Updates live when invoices processed</small></div>
            <button onclick="window.showView(\'recipes\')" class="btn btn-outline">← Recipes</button>
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
// AI RAW INGREDIENT BATCH LINKER
// Scans all recipes with raw ingredients, uses Gemini to suggest inventory matches
// User confirms/skips each suggestion in bulk
// =============================================================================

window.renderAiBatchLinker = () => {
    const rawRecipes = (window.recipes || []).filter(r => !r.archived && (r.ingredients || []).some(i => i.type === 'raw'));
    const totalRaw = rawRecipes.reduce((sum, r) => sum + r.ingredients.filter(i => i.type === 'raw').length, 0);

    return '<div style="max-width:1000px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<div><h2 style="margin:0;">AI Raw Ingredient Linker</h2>' +
            '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Scans all unlinked (raw) ingredients and suggests matches from Live Inventory. Confirm or skip each one.</p></div>' +
            '<button onclick="window.showView(\'recipes\')" class="btn btn-outline">← Recipes</button>' +
        '</div>' +
        '<div class="card" style="border-top:5px solid var(--purple);text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:42px;font-weight:bold;color:var(--purple);">' + totalRaw + '</div>' +
            '<div style="color:var(--text-muted);font-size:13px;margin-bottom:15px;">unlinked ingredients across ' + rawRecipes.length + ' recipes</div>' +
            '<button onclick="window.runAiBatchLink()" class="btn btn-purple" style="font-size:16px;padding:14px 30px;">✨ Run AI Batch Linker</button>' +
        '</div>' +
        '<div id="batch-link-status" style="margin-bottom:15px;"></div>' +
        '<div id="batch-link-results"></div>' +
    '</div>';
};

window.runAiBatchLink = async () => {
    const statusDiv = document.getElementById('batch-link-status');
    const resultsDiv = document.getElementById('batch-link-results');
    statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:12px;color:var(--purple);font-weight:bold;">🤖 AI is scanning all raw ingredients... this may take a moment.</div>';
    resultsDiv.innerHTML = '';

    const rawIngredients = [];
    (window.recipes || []).filter(r => !r.archived).forEach(r => {
        (r.ingredients || []).forEach((ing, idx) => {
            if (ing.type === 'raw') {
                rawIngredients.push({ recipeId: r.id, recipeName: r.name, ingIdx: idx, rawName: ing.name });
            }
        });
    });

    if (rawIngredients.length === 0) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ No raw ingredients found. All linked!</div>';
        return;
    }

    const invList = (window.inventoryItems || []).filter(i => !i.archived).map(i => i.id + ':' + i.name + ' (' + (i.useUnit||'unit') + ')').join('; ');
    const rawList = rawIngredients.map((r, idx) => idx + ': ' + r.rawName + ' [in: ' + r.recipeName + ']').join('\n');

    const prompt = 'You are a culinary AI for Bar Wa Izakaya. Match each raw ingredient to the best inventory item ID from the list, or null if no match.\n' +
        'INVENTORY: ' + invList + '\n' +
        'RAW INGREDIENTS (index: name [recipe]):\n' + rawList + '\n' +
        'Return ONLY JSON array: [{"idx":0,"matchId":"inv_abc123","confidence":"high"},{"idx":1,"matchId":null,"confidence":"none"},...]\n' +
        'confidence: "high" (clear match), "medium" (probable), "low" (possible), "none" (no match).\n' +
        'Only suggest matches where you are at least medium confidence.';

    try {
        const apiKey = window.getApiKey(); if (!apiKey) return;
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g,'').replace(/^```/g,'').replace(/```$/g,'').trim();
        const aiMatches = JSON.parse(rawJson);

        // Store pending matches globally for confirm actions
        window._batchLinkQueue = rawIngredients.map((item, idx) => {
            const match = aiMatches.find(m => m.idx === idx);
            const invMatch = match && match.matchId ? (window.inventoryItems || []).find(i => i.id === match.matchId) : null;
            return { ...item, suggestedInvId: invMatch ? invMatch.id : null, suggestedInvName: invMatch ? invMatch.name : null, confidence: match ? match.confidence : 'none', accepted: false, skipped: false };
        });

        window.renderBatchLinkQueue();
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ AI scan complete — ' + aiMatches.filter(m => m.matchId).length + ' matches suggested. Review below.</div>';

    } catch(e) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);">AI Error: ' + e.message + '</div>';
    }
};

window.renderBatchLinkQueue = () => {
    const queue = window._batchLinkQueue || [];
    const resultsDiv = document.getElementById('batch-link-results');
    const pending = queue.filter(q => !q.accepted && !q.skipped);
    const accepted = queue.filter(q => q.accepted);

    if (pending.length === 0 && accepted.length === 0) {
        resultsDiv.innerHTML = '<div class="card"><p style="color:var(--text-muted);margin:0;">No suggestions to review.</p></div>';
        return;
    }

    const acceptAllBtn = pending.filter(q => q.suggestedInvId).length > 0 ?
        '<button onclick="window.acceptAllBatchLinks()" class="btn btn-green" style="margin-bottom:15px;">✅ Accept All Suggestions (' + pending.filter(q => q.suggestedInvId).length + ')</button>' : '';

    const commitBtn = accepted.length > 0 ?
        '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="margin-bottom:15px;margin-left:10px;">💾 Commit ' + accepted.length + ' Links to Recipes</button>' : '';

    let html = '<div style="margin-bottom:15px;">' + acceptAllBtn + commitBtn + '</div>';

    // Pending suggestions
    const withMatch = pending.filter(q => q.suggestedInvId);
    const noMatch = pending.filter(q => !q.suggestedInvId);

    if (withMatch.length > 0) {
        html += '<h3 style="color:var(--brand-dark);border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:15px;">🔗 Suggested Matches (' + withMatch.length + ')</h3>';
        withMatch.forEach((item, i) => {
            const qIdx = queue.indexOf(item);
            const confColor = item.confidence === 'high' ? 'var(--green)' : item.confidence === 'medium' ? 'var(--orange)' : 'var(--text-muted)';
            const inv = (window.inventoryItems || []).find(x => x.id === item.suggestedInvId);
            const invOpts = (window.inventoryItems || []).filter(x => !x.archived).map(x =>
                '<option value="' + x.id + '" ' + (x.id === item.suggestedInvId ? 'selected' : '') + '>' + x.name + ' (' + (x.useUnit||'unit') + ')</option>'
            ).join('');
            html += '<div class="card" style="border-left:4px solid ' + confColor + ';padding:15px;margin-bottom:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
                    '<div style="flex:1;min-width:200px;">' +
                        '<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">' + item.recipeName + '</div>' +
                        '<strong style="font-size:14px;color:var(--orange);">RAW: ' + item.rawName + '</strong>' +
                    '</div>' +
                    '<div style="font-size:20px;color:var(--text-muted);">→</div>' +
                    '<div style="flex:2;min-width:200px;">' +
                        '<select id="bl-sel-' + qIdx + '" class="input-box" style="margin:0 0 6px 0;">' +
                            '<option value="">-- Skip (no match) --</option>' + invOpts +
                        '</select>' +
                        '<div style="display:flex;gap:6px;">' +
                            '<span style="font-size:11px;color:' + confColor + ';border:1px solid ' + confColor + ';padding:2px 6px;border-radius:8px;">' + item.confidence + ' confidence</span>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:6px;flex-shrink:0;">' +
                        '<button onclick="window.acceptBatchLink(' + qIdx + ')" class="btn btn-green" style="font-size:12px;padding:6px 12px;">✓ Link</button>' +
                        '<button onclick="window.skipBatchLink(' + qIdx + ')" class="btn btn-outline" style="font-size:12px;padding:6px 12px;">Skip</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        });
    }

    if (noMatch.length > 0) {
        html += '<h3 style="color:var(--text-muted);border-bottom:1px solid var(--border);padding-bottom:8px;margin-top:20px;margin-bottom:15px;">❓ No Match Found (' + noMatch.length + ')</h3>';
        noMatch.forEach((item) => {
            const qIdx = queue.indexOf(item);
            const invOpts = (window.inventoryItems || []).filter(x => !x.archived).map(x =>
                '<option value="' + x.id + '">' + x.name + ' (' + (x.useUnit||'unit') + ')</option>'
            ).join('');
            html += '<div class="card" style="border-left:4px solid var(--border);padding:15px;margin-bottom:10px;opacity:0.8;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
                    '<div style="flex:1;"><div style="font-size:12px;color:var(--text-muted);">' + item.recipeName + '</div>' +
                    '<strong style="color:var(--orange);">RAW: ' + item.rawName + '</strong></div>' +
                    '<div style="flex:2;min-width:200px;">' +
                        '<select id="bl-sel-' + qIdx + '" class="input-box" style="margin:0;">' +
                            '<option value="">-- Skip (no match) --</option>' + invOpts +
                        '</select>' +
                    '</div>' +
                    '<div style="display:flex;gap:6px;">' +
                        '<button onclick="window.acceptBatchLink(' + qIdx + ')" class="btn btn-blue" style="font-size:12px;padding:6px 12px;">Link</button>' +
                        '<button onclick="window.skipBatchLink(' + qIdx + ')" class="btn btn-outline" style="font-size:12px;padding:6px 12px;">Skip</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        });
    }

    if (accepted.length > 0) {
        html += '<h3 style="color:var(--green);border-bottom:1px solid var(--border);padding-bottom:8px;margin-top:20px;margin-bottom:10px;">✅ Ready to Commit (' + accepted.length + ')</h3>';
        accepted.forEach(item => {
            const inv = (window.inventoryItems || []).find(x => x.id === item.suggestedInvId);
            html += '<div style="padding:8px 12px;font-size:13px;color:var(--green);background:rgba(16,185,129,0.06);border-radius:6px;margin-bottom:6px;">' +
                '<strong>' + item.rawName + '</strong> → <strong>' + (inv ? inv.name : item.suggestedInvId) + '</strong> <small style="color:var(--text-muted);">in ' + item.recipeName + '</small>' +
            '</div>';
        });
        if (pending.length === 0) {
            html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="width:100%;margin-top:15px;font-size:16px;padding:14px;">💾 Commit All ' + accepted.length + ' Links to Recipes</button>';
        }
    }

    resultsDiv.innerHTML = html;
};

window.acceptBatchLink = (qIdx) => {
    const sel = document.getElementById('bl-sel-' + qIdx);
    const selectedId = sel ? sel.value : window._batchLinkQueue[qIdx].suggestedInvId;
    if (!selectedId) return window.showToast('Select an inventory item first.', 'error');
    const inv = (window.inventoryItems || []).find(x => x.id === selectedId);
    window._batchLinkQueue[qIdx].suggestedInvId = selectedId;
    window._batchLinkQueue[qIdx].suggestedInvName = inv ? inv.name : selectedId;
    window._batchLinkQueue[qIdx].accepted = true;
    window.renderBatchLinkQueue();
};

window.skipBatchLink = (qIdx) => {
    window._batchLinkQueue[qIdx].skipped = true;
    window.renderBatchLinkQueue();
};

window.acceptAllBatchLinks = () => {
    (window._batchLinkQueue || []).forEach((item, qIdx) => {
        if (!item.accepted && !item.skipped && item.suggestedInvId) {
            item.accepted = true;
        }
    });
    window.renderBatchLinkQueue();
};

window.commitBatchLinks = () => {
    const accepted = (window._batchLinkQueue || []).filter(q => q.accepted && q.suggestedInvId);
    if (accepted.length === 0) return window.showToast('Nothing to commit.', 'error');
    let linkedCount = 0;
    accepted.forEach(item => {
        const recipe = window.recipes.find(r => r.id === item.recipeId);
        if (!recipe) return;
        const ing = recipe.ingredients[item.ingIdx];
        if (!ing || ing.type !== 'raw') return;
        const inv = window.inventoryItems.find(i => i.id === item.suggestedInvId);
        if (!inv) return;
        recipe.ingredients[item.ingIdx] = { type: 'inv', ref: inv.id, qty: 1, unit: inv.useUnit || 'unit', name: inv.name };
        linkedCount++;
    });
    window.saveToDisk();
    window._batchLinkQueue = null;
    window.showToast(linkedCount + ' ingredients linked to inventory!');
    window.showView('recipes');
};

// =============================================================================
// MENU ENGINEERING MATRIX
// Star (high GP, high volume), Plow Horse (low GP, high volume),
// Puzzle (high GP, low volume), Dog (low GP, low volume)
// Uses coversPerWeek field on each recipe
// =============================================================================

window.renderMenuEngineeringView = () => {
    const menuRecipes = (window.recipes || []).filter(r => r.type === 'Menu' && r.price > 0 && (r.status || 'Active') === 'Active' && !r.archived);

    // Recalculate costs/GP live
    menuRecipes.forEach(r => {
        let cost = 0;
        (r.ingredients || []).forEach(ing => {
            if (ing.type === 'inv') { const inv = window.inventoryItems.find(i => i.id === ing.ref); if (inv) cost += ing.qty * ((inv.price||0) / (inv.yield||1)); }
            else if (ing.type === 'batch') { const b = window.recipes.find(x => x.id === ing.ref); if (b) cost += ing.qty * ((b.cost||0) / (b.yieldQty||1)); }
        });
        r.cost = cost;
        r.gp = r.price > 0 ? parseFloat(((r.price - cost) / r.price * 100).toFixed(1)) : 0;
    });

    const avgGp = menuRecipes.length > 0 ? menuRecipes.reduce((s, r) => s + r.gp, 0) / menuRecipes.length : GP_TARGET;
    const avgCovers = menuRecipes.length > 0 ? menuRecipes.reduce((s, r) => s + (r.coversPerWeek || 0), 0) / menuRecipes.length : 0;

    const classify = (r) => {
        const highGp = r.gp >= avgGp;
        const highVol = (r.coversPerWeek || 0) >= avgCovers;
        if (highGp && highVol) return 'star';
        if (highGp && !highVol) return 'puzzle';
        if (!highGp && highVol) return 'plowhorse';
        return 'dog';
    };

    const categories = {
        star:      { label: '⭐ Star',       color: 'var(--green)',  bg: 'rgba(16,185,129,0.08)',  desc: 'High margin + high volume. Protect these.' },
        puzzle:    { label: '🧩 Puzzle',     color: 'var(--blue)',   bg: 'rgba(59,130,246,0.08)',  desc: 'High margin but low volume. Promote harder.' },
        plowhorse: { label: '🐴 Plow Horse', color: 'var(--orange)', bg: 'rgba(245,158,11,0.08)',  desc: 'High volume but low margin. Reprice or reformulate.' },
        dog:       { label: '🐶 Dog',        color: 'var(--red)',    bg: 'rgba(239,68,68,0.08)',   desc: 'Low margin + low volume. Review or remove.' }
    };

    const stationColor = { 'Kitchen': 'var(--orange)', 'Bar': 'var(--blue)', 'Prep': 'var(--purple)' };

    const noCoverCount = menuRecipes.filter(r => !r.coversPerWeek || r.coversPerWeek === 0).length;
    const noCoverWarning = noCoverCount > 0 ?
        '<div class="card" style="border-left:4px solid var(--orange);padding:12px;margin-bottom:20px;font-size:13px;">' +
            '<strong style="color:var(--orange);">⚠️ ' + noCoverCount + ' recipes have no covers/week set.</strong> ' +
            'These will show as low-volume. <a onclick="window.showView(\'recipes\')" style="color:var(--blue);cursor:pointer;text-decoration:underline;">Update via Recipe Editor</a>.' +
        '</div>' : '';

    // Build quadrant cards
    const quadrantHtml = ['star','puzzle','plowhorse','dog'].map(key => {
        const cat = categories[key];
        const items = menuRecipes.filter(r => classify(r) === key);
        const rows = items.map(r => {
            const gpColor = r.gp >= GP_TARGET ? 'var(--green)' : r.gp > 0 ? 'var(--orange)' : 'var(--red)';
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:10px 12px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.editRecipeForm(this.dataset.id)" data-id="' + r.id + '">' + r.name + '</strong>' +
                    '<br><small style="color:' + (stationColor[r.station||'Kitchen']||'var(--text-muted)') + ';">' + (r.station||'Kitchen') + '</small></td>' +
                '<td style="padding:10px 12px;color:' + gpColor + ';font-weight:bold;">' + r.gp + '%</td>' +
                '<td style="padding:10px 12px;color:var(--brand-accent);">$' + Number(r.price||0).toFixed(2) + '</td>' +
                '<td style="padding:10px 12px;font-weight:bold;">' + (r.coversPerWeek||0) + '/wk</td>' +
            '</tr>';
        }).join('');
        return '<div class="card" style="padding:0;overflow:hidden;border-top:4px solid ' + cat.color + ';background:' + cat.bg + ';">' +
            '<div style="padding:15px 20px;border-bottom:1px solid var(--border);">' +
                '<h3 style="margin:0;color:' + cat.color + ';">' + cat.label + ' <span style="font-size:13px;background:' + cat.color + ';color:white;padding:2px 8px;border-radius:10px;font-weight:normal;">' + items.length + '</span></h3>' +
                '<p style="margin:4px 0 0 0;font-size:12px;color:var(--text-muted);">' + cat.desc + '</p>' +
            '</div>' +
            (items.length === 0 ?
                '<p style="padding:15px 20px;color:var(--text-muted);font-size:13px;margin:0;">No items in this category.</p>' :
                '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;background:rgba(0,0,0,0.2);">' +
                    '<th style="padding:8px 12px;text-align:left;">Recipe</th><th style="padding:8px 12px;text-align:left;">GP%</th><th style="padding:8px 12px;text-align:left;">Sell</th><th style="padding:8px 12px;text-align:left;">Volume</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table></div>') +
        '</div>';
    }).join('');

    // Summary stats
    const star = menuRecipes.filter(r => classify(r) === 'star').length;
    const puzzle = menuRecipes.filter(r => classify(r) === 'puzzle').length;
    const ph = menuRecipes.filter(r => classify(r) === 'plowhorse').length;
    const dog = menuRecipes.filter(r => classify(r) === 'dog').length;

    return '<div style="max-width:1100px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<div><h2 style="margin:0;">Menu Engineering Matrix</h2>' +
            '<small style="color:var(--text-muted);">Avg GP: ' + avgGp.toFixed(1) + '% · Avg Volume: ' + avgCovers.toFixed(0) + ' covers/wk · ' + menuRecipes.length + ' active menu items</small></div>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="window.showView(\'margins\')" class="btn btn-outline" style="font-size:12px;">📊 Margin Health</button>' +
                '<button onclick="window.showView(\'recipes\')" class="btn btn-outline" style="font-size:12px;">← Recipes</button>' +
            '</div>' +
        '</div>' +
        noCoverWarning +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:25px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);"><div style="font-size:34px;font-weight:bold;color:var(--green);">' + star + '</div><div style="font-size:12px;color:var(--text-muted);">⭐ Stars</div></div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);"><div style="font-size:34px;font-weight:bold;color:var(--blue);">' + puzzle + '</div><div style="font-size:12px;color:var(--text-muted);">🧩 Puzzles</div></div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);"><div style="font-size:34px;font-weight:bold;color:var(--orange);">' + ph + '</div><div style="font-size:12px;color:var(--text-muted);">🐴 Plow Horses</div></div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--red);"><div style="font-size:34px;font-weight:bold;color:var(--red);">' + dog + '</div><div style="font-size:12px;color:var(--text-muted);">🐶 Dogs</div></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px;">' +
            quadrantHtml +
        '</div>' +
    '</div>';
};

// Add batch-linker nav view to router (handled in core.js)
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
// 5. AUTO-ORDER / PREP LIST
// =============================================================================

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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0;">Auto-Order List</h2>
                <small style="color:var(--brand-accent);">Targeting <strong style="color:var(--blue);">${isWeekend ? 'WEEKEND' : 'WEEKDAY'}</strong> PAR levels today.</small>
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
            <div class="card" style="border-top:5px solid var(--blue); margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h3 style="margin:0;">${supName === 'null' || supName === '' ? 'Unassigned Supplier' : supName}</h3>
                        <div style="margin-top:5px;">${warningHtml || `<span style="color:var(--green); font-size:12px;">✓ Ready to Order (Est. $${data.totalSpend.toFixed(2)})</span>`}</div>
                    </div>
                    <button onclick="window.copyOrderText('${supName}', ${data.totalSpend})" class="btn btn-outline" style="font-size:11px; padding:6px 12px;">📋 Copy Order Text</button>
                </div>
                <table style="width:100%; font-size:14px; text-align:left; border-collapse:collapse;">
                    <tbody>
                        ${data.items.map(o => `
                        <tr style="border-bottom:1px dashed var(--bg-main);">
                            <td style="padding:10px 0;"><strong>${o.name}</strong> <small style="color:var(--text-muted);">[${o.sku || 'No SKU'}]</small></td>
                            <td style="padding:10px 0; color:var(--text-muted);">Stock: ${o.stock} / PAR: ${isWeekend ? o.parWeekend : o.parWeekday}</td>
                            <td style="padding:10px 0; text-align:right; color:var(--brand-accent); font-weight:bold; font-size:16px;">Order: ${o.toOrder.toFixed(1)} <small>${o.buyUnit || 'Unit'}</small></td>
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
    items.forEach(i => { let par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0); text += `- ${(par - i.stock).toFixed(1)}x ${i.buyUnit || 'Unit'} of ${i.name} ${i.sku ? `[${i.sku}]` : ''}\n`; });
    text += `\nThanks,\nBar Wa Izakaya`;
    navigator.clipboard.writeText(text).then(() => window.showToast(`Order copied for ${supName}!`));
};

// =============================================================================
// 6. WASTAGE TRACKER
// =============================================================================

window.renderWastageView = () => {
    const invOpts = (window.inventoryItems || []).filter(i => !i.archived).map(i =>
        `<option value="${i.id}">${i.name} (Buy: ${i.buyUnit} / Use: ${i.useUnit})</option>`
    ).join('');
    return `
    <div style="max-width: 800px; margin: auto;">
        <h2 style="margin-top:0;">Wastage Tracker</h2>
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
            <button onclick="window.logWastage()" class="btn btn-orange" style="width:100%; margin-top:10px; font-size:16px;">Log Waste & Deduct Stock</button>
        </div>
        <h3 style="margin-top:30px; border-bottom:1px solid var(--border); padding-bottom:10px;">Recent Logs</h3>
        ${(window.wastageLogs || []).slice().reverse().map(w =>
            `<div class="card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${w.itemName}</strong> <span style="color:var(--orange); font-size:13px;">(${w.logQty} ${w.unitLog})</span><br><small style="color:var(--text-muted);">${w.staff} - ${w.reason}</small></div>
                <div style="text-align:right;"><strong style="color:var(--red);">$${Number(w.value).toFixed(2)} Lost</strong><br><small style="color:var(--text-muted);">${w.time}</small></div>
            </div>`
        ).join('')}
    </div>`;
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
    window.saveToDisk(); window.showToast("Wastage Logged & Stock Deducted!"); window.showView('wastage');
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
    const recipeNames = (window.recipes || []).filter(r => r.type === 'Menu').map(r => r.posAlias || r.name).join(', ');
    const prompt = `You are processing a Lightspeed POS end-of-day Product Mix report for Bar Wa Izakaya.
Extract ONLY sellable menu items and their quantities sold. 

RULES:
- Skip modifiers, add-ons, and sub-items (lines indented or prefixed with "--", "Add", "Extra", "No ", "Sub")
- Skip category headers, totals, voids, refunds, and zero-quantity lines
- Combine duplicate item names (sum their quantities)
- Use the exact item name as it appears in the POS report
- Known menu items for context: ${recipeNames}

Return ONLY valid JSON, no other text: { "results": [ { "rawName": "Exact POS Item Name", "qtySold": 42 } ] }

POS Report:
${rawText}`;
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
    let recipeOpts = `<option value="">-- Select Hub Recipe --</option>` + (window.recipes || []).filter(r => r.type === 'Menu').map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    let html = `<div class="card" style="max-width:800px; margin:auto; border-top:5px solid var(--purple); padding-bottom:80px;">
        <h2 style="margin-top:0;">Map & Deplete Stock</h2>`;
    if (window.pendingMap.unknown.length > 0) {
        html += `<div style="background:rgba(245, 158, 11, 0.1); border:1px solid var(--orange); padding:15px; border-radius:8px; margin-bottom:20px;">
            <h4 style="color:var(--orange); margin-top:0; border-bottom:1px solid var(--orange); padding-bottom:5px;">⚠️ Map Unknown Items</h4>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Map these once. The Hub saves them forever.</p>`;
        window.pendingMap.unknown.forEach((u, i) => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border);">
                <div><strong style="color:var(--orange);">${u.posName}</strong><br><small>Sold: ${u.qtySold}</small></div>
                <select id="map-unknown-${i}" class="input-box" style="width:250px; margin:0; border-color:var(--orange);">${recipeOpts}</select>
            </div>`;
        });
        html += `</div>`;
    }
    if (window.pendingMap.known.length > 0) {
        // Check for raw ingredient warnings
        const rawWarnings = [];
        window.pendingMap.known.forEach(k => {
            const recipe = window.recipes.find(r => r.id === k.recipeId);
            if (recipe) {
                const rawCount = (recipe.ingredients || []).filter(i => i.type === 'raw').length;
                if (rawCount > 0) rawWarnings.push({ name: recipe.name, rawCount });
            }
        });
        if (rawWarnings.length > 0) {
            html += `<div style="background:rgba(245,158,11,0.1); border:1px solid var(--orange); padding:12px 15px; border-radius:8px; margin-bottom:15px; font-size:13px;">
                <strong style="color:var(--orange);">⚠️ Partial depletion warning</strong> — ${rawWarnings.length} matched recipe${rawWarnings.length !== 1 ? 's have' : ' has'} unlinked ingredients that won't be deducted:
                <ul style="margin:6px 0 0 0; padding-left:18px; color:var(--text-muted);">
                    ${rawWarnings.map(w => `<li>${w.name} (${w.rawCount} unlinked)</li>`).join('')}
                </ul>
                <a onclick="window.showView('batch-linker')" style="color:var(--blue); cursor:pointer; text-decoration:underline; font-size:12px;">Run AI Ingredient Linker to fix this →</a>
            </div>`;
        }
        html += `<h4 style="color:var(--green); border-bottom:1px solid var(--border); padding-bottom:5px; margin-top:20px;">✓ Safely Matched Items</h4>
        <div style="max-height:300px; overflow-y:auto; font-size:13px; background:var(--bg-main); padding:15px; border-radius:8px; border:1px solid var(--border);">`;
        window.pendingMap.known.forEach(k => {
            const recipe = window.recipes.find(r => r.id === k.recipeId);
            const rName = recipe ? recipe.name : k.recipeId;
            const rawCount = recipe ? (recipe.ingredients || []).filter(i => i.type === 'raw').length : 0;
            html += `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border);">
                <span><span style="color:var(--text-muted);">${k.posName}</span> ➔ <strong>${rName}</strong>${rawCount > 0 ? ` <span style="color:var(--orange); font-size:11px;">(${rawCount} unlinked)</span>` : ''}</span>
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
    // Commit any newly mapped unknown items
    window.pendingMap.unknown.forEach((u, i) => {
        let selectedId = document.getElementById(`map-unknown-${i}`).value;
        if (selectedId) {
            if (!window.posMappings) window.posMappings = {};
            window.posMappings[u.posName] = selectedId;
            window.pendingMap.known.push({ posName: u.posName, recipeId: selectedId, qtySold: u.qtySold });
        }
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-AU');
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Build stock deductions
    let deductions = {};
    const logLines = [];

    window.pendingMap.known.forEach(k => {
        const recipe = window.recipes.find(r => r.id === k.recipeId);
        if (!recipe) return;

        // Increment coversPerWeek — rolling 7-day window using depletionLogs
        recipe.coversPerWeek = (recipe.coversPerWeek || 0) + k.qtySold;

        const rawCount = (recipe.ingredients || []).filter(i => i.type === 'raw').length;
        logLines.push({ posName: k.posName, recipeName: recipe.name, qtySold: k.qtySold, rawSkipped: rawCount });

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
    });

    // Apply deductions to inventory
    let deductedCount = 0;
    const stockChanges = [];
    Object.keys(deductions).forEach(invId => {
        let inv = window.inventoryItems.find(i => i.id === invId);
        if (inv) {
            const useUnitsToDeduct = deductions[invId];
            const buyUnitsToDeduct = useUnitsToDeduct / (inv.yield || 1);
            const before = inv.stock || 0;
            inv.stock = Math.max(0, before - buyUnitsToDeduct);
            stockChanges.push({ name: inv.name, before: before.toFixed(2), after: inv.stock.toFixed(2), unit: inv.buyUnit || 'unit' });
            deductedCount++;
        }
    });

    // Write depletion log entry
    if (!window.depletionLogs) window.depletionLogs = [];
    window.depletionLogs.push({
        date: dateStr,
        time: timeStr,
        itemsSold: logLines,
        stockChanges: stockChanges,
        totalLines: deductedCount,
        skippedUnmapped: window.pendingMap.unknown.filter((u, i) => !document.getElementById(`map-unknown-${i}`) || !document.getElementById(`map-unknown-${i}`).value).length
    });

    window.saveToDisk();
    window.showToast(`EOD complete — ${deductedCount} stock lines deducted across ${logLines.length} recipes.`);

    // Show summary instead of jumping straight to inventory
    window.renderDepletionSummary(logLines, stockChanges, deductedCount);
};

window.renderDepletionSummary = (logLines, stockChanges, deductedCount) => {
    const html = `<div class="card" style="max-width:800px; margin:auto; border-top:5px solid var(--green);">
        <div style="text-align:center; padding:20px 0 10px 0;">
            <div style="font-size:48px; margin-bottom:8px;">✅</div>
            <h2 style="margin:0; color:var(--green);">EOD Depletion Complete</h2>
            <p style="color:var(--text-muted); font-size:13px; margin:5px 0 0 0;">${deductedCount} stock lines updated · ${logLines.length} recipes matched</p>
        </div>

        <h4 style="color:var(--brand-accent); border-bottom:1px solid var(--border); padding-bottom:5px; margin-top:20px;">Recipes Depleted</h4>
        <div style="max-height:220px; overflow-y:auto; font-size:13px; background:var(--bg-main); padding:15px; border-radius:8px; margin-bottom:15px;">
            ${logLines.map(l => `<div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px dashed var(--border);">
                <span><strong>${l.recipeName}</strong>${l.rawSkipped > 0 ? ` <span style="color:var(--orange); font-size:11px;">⚠️ ${l.rawSkipped} unlinked</span>` : ''}</span>
                <span style="color:var(--green); font-weight:bold;">${l.qtySold} sold</span>
            </div>`).join('')}
        </div>

        <h4 style="color:var(--brand-accent); border-bottom:1px solid var(--border); padding-bottom:5px;">Stock Changes</h4>
        <div style="max-height:220px; overflow-y:auto; font-size:12px; background:var(--bg-main); padding:15px; border-radius:8px; margin-bottom:20px;">
            ${stockChanges.map(s => `<div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px dashed var(--border);">
                <span style="color:var(--text-muted);">${s.name}</span>
                <span><strong style="color:var(--red);">${s.before}</strong> → <strong style="color:var(--brand-dark);">${s.after}</strong> <small style="color:var(--text-muted);">${s.unit}</small></span>
            </div>`).join('')}
        </div>

        <div style="display:flex; gap:10px;">
            <button onclick="window.showView('inventory')" class="btn btn-blue" style="flex:1;">📦 View Inventory</button>
            <button onclick="window.showView('sales')" class="btn btn-outline" style="flex:1;">← Back to Sales</button>
        </div>
    </div>`;
    document.getElementById('mainContent').innerHTML = html;
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <h2 style="margin:0;">Invoice Ripper Pro</h2>
            <div style="font-size:12px; color:var(--text-muted);">Supports PDF (text or scanned) and image files</div>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin:0 0 20px 0;">Upload a supplier invoice. AI will extract all line items, match to inventory, flag price changes, and update stock — after you confirm.</p>

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
        (window.inventoryItems || []).filter(i => !i.archived).map(i => `<option value="${i.id}">${i.name} (${i.buyUnit})</option>`).join('');

    const autoMatched = state.filter(s => s.matchedInvId && s.action === 'update');
    const unmatched = state.filter(s => !s.matchedInvId || s.action === 'new' || s.action === 'skip');

    let html = `
    <div style="border-top:4px solid var(--blue); padding-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div>
                <h3 style="margin:0; color:var(--brand-dark);">${ai.supplier} — ${ai.date}</h3>
                <small style="color:var(--text-muted);">Invoice #${ai.invoiceNumber || 'N/A'} | ${ai.items.length} line items extracted | Total: $${Number(ai.invoiceTotal || 0).toFixed(2)}</small>
            </div>
            <button onclick="window._commitInvoice()" class="btn btn-green" style="font-size:15px; padding:12px 24px;">✓ Commit All & Update Stock</button>
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
            <div id="ir-row-${s.index}" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:12px 15px; border-radius:8px; border-left:4px solid var(--green);">
                <div style="flex:2;">
                    <strong style="font-size:13px;">${s.aiItem.itemName}</strong>
                    <small style="color:var(--text-muted); display:block;">${s.aiItem.sku ? `SKU: ${s.aiItem.sku} · ` : ''}Qty: ${s.aiItem.quantity} ${s.aiItem.buyUnit || ''}</small>
                </div>
                <div style="flex:1; text-align:center; font-size:12px; color:var(--text-muted);">
                    ➔ <strong style="color:var(--green);">${inv ? inv.name : '?'}</strong>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${s.confidence === 'sku' ? '🔑 SKU match' : s.confidence === 'high' ? '✓ Name match' : '~ Fuzzy match'}</div>
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
            <div id="ir-row-${s.index}" style="background:var(--bg-main); padding:15px; border-radius:8px; border-left:4px solid ${isSkipped ? 'var(--border)' : 'var(--orange)'}; opacity:${isSkipped ? 0.5 : 1};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div style="flex:1; min-width:200px;">
                        <strong style="font-size:13px; color:${isSkipped ? 'var(--text-muted)' : 'var(--orange)'};">${s.aiItem.itemName}</strong>
                        <small style="color:var(--text-muted); display:block;">${s.aiItem.sku ? `SKU: ${s.aiItem.sku} · ` : ''}Qty: ${s.aiItem.quantity} ${s.aiItem.buyUnit || ''} · $${Number(s.aiItem.unitPrice || 0).toFixed(2)}</small>
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
        <button onclick="window._commitInvoice()" class="btn btn-green" style="font-size:15px; padding:12px 28px;">✓ Commit All & Update Stock</button>
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
        <div><label style="font-size:11px; color:var(--text-muted);">Name</label><input type="text" id="iq-n" class="input-box" value="${aiItem.itemName.replace(/"/g, '&quot;')}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iq-cat" list="iq-cat-list" class="input-box" value="${guessedCat}"><datalist id="iq-cat-list">${catOpts}</datalist></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Supplier</label><input type="text" id="iq-sup" class="input-box" value="${supplierName}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">SKU</label><input type="text" id="iq-sku" class="input-box" value="${aiItem.sku || ''}"></div>
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
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Unit</label><input type="text" id="iq-buyUnit" class="input-box" value="${aiItem.buyUnit || 'CTN'}"></div>
        <div style="padding-top:20px;"><label style="font-size:13px; cursor:pointer;"><input type="checkbox" id="iq-gst" ${aiItem.gstFree ? 'checked' : ''} style="transform:scale(1.2);"> GST Free</label></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; border:1px dashed var(--blue); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-Units per Buy-Unit)</label><input type="number" step="0.01" id="iq-yield" class="input-box" value="1"></div>
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit</label><input type="text" id="iq-useUnit" class="input-box" value="${isBev ? 'ml' : 'kg'}"></div>
    </div>
    <button onclick="window._irSaveNewItem('${newId}', ${index})" class="btn btn-green" style="width:100%; font-size:15px; padding:12px;">Save & Link to Invoice</button>`;
    window.openModal(`⚡ Quick Add: ${aiItem.itemName}`, html);
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

// Final commit — apply all approved updates to inventory
window._commitInvoice = () => {
    const ai = window.pendingInvoiceData;
    const state = window._invoiceReviewState;
    if (!ai || !state) return;

    let updatedCount = 0, addedCount = 0, skippedCount = 0;

    state.forEach(s => {
        if (s.action === 'skip') { skippedCount++; return; }
        if (!s.matchedInvId) { skippedCount++; return; }

        const inv = window.inventoryItems.find(i => i.id === s.matchedInvId);
        if (!inv) return;

        const newPrice = s.aiItem.unitPrice || s.aiItem.totalLinePrice || 0;
        const oldPrice = inv.price;

        // Update stock
        inv.stock = (Number(inv.stock) || 0) + Number(s.aiItem.quantity || 0);

        // Update price if provided
        if (newPrice > 0) inv.price = newPrice;

        // Update SKU if provided and missing
        if (s.aiItem.sku && !inv.sku) inv.sku = s.aiItem.sku;

        // Append to price history
        if (!inv.history) inv.history = [];
        inv.history.push({
            date: ai.date || new Date().toLocaleDateString('en-AU'),
            supplier: ai.supplier || '',
            invoiceNo: ai.invoiceNumber || '',
            qty: s.aiItem.quantity,
            price: newPrice,
            prevPrice: oldPrice
        });
        // Cap history at 50 entries
        if (inv.history.length > 50) inv.history = inv.history.slice(-50);

        if (s.confidence === 'new') addedCount++; else updatedCount++;
    });

    window.saveToDisk();

    const resultsDiv = document.getElementById('invoice-results');
    resultsDiv.innerHTML = `
    <div class="card" style="border-top:5px solid var(--green); text-align:center; padding:30px;">
        <div style="font-size:48px; margin-bottom:15px;">✅</div>
        <h3 style="color:var(--green); margin:0 0 10px 0;">Invoice Committed!</h3>
        <div style="font-size:14px; color:var(--text-muted); margin-bottom:20px;">
            <strong style="color:var(--green);">${updatedCount}</strong> items updated · 
            <strong style="color:var(--blue);">${addedCount}</strong> new items added · 
            <strong style="color:var(--text-muted);">${skippedCount}</strong> skipped
        </div>
        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button onclick="window.showView('invoice')" class="btn btn-blue">📄 Rip Another Invoice</button>
            <button onclick="window.showView(\'inventory\')" class="btn btn-outline">📦 View Inventory</button>
        </div>
    </div>`;
    document.getElementById('invoice-status').innerHTML = '';
    window.showToast(`Invoice committed — ${updatedCount + addedCount} stock lines updated!`);
};

// =============================================================================
// 9. ALLERGENS, RUN SHEETS & MARGIN CHECKER
// =============================================================================

window.renderAllergenView = () => {
    return `<div style="max-width: 800px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 style="margin:0;">Allergen Matrix</h2>
            <button onclick="window.runAiAllergenScan()" class="btn btn-purple">✨ AI Scan Menu</button>
        </div>
        <div id="allergen-status" style="margin-bottom:15px;"></div>
        <p style="color:var(--text-muted);">Displays flags found in Recipe names (GF, VG) or detected by the AI Scan.</p>
        <table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse:collapse;">
            <tr style="background:#111; text-align:left;">
                <th style="padding:15px;">Menu Item</th>
                <th style="padding:15px;">Dietary Flags</th>
            </tr>
            ${(window.recipes || []).filter(r => r.type === 'Menu' && !r.archived).map(r => {
                let flags = r.allergens && r.allergens.length > 0 ? r.allergens.join(', ') :
                    `${r.name.includes('GF') ? 'GF ' : ''}${r.name.includes('VG') ? 'VG ' : ''}${r.name.includes('DF') ? 'DF ' : ''}`.trim() || '—';
                return `<tr style="border-bottom:1px solid var(--border);"><td style="padding:15px;">${r.name}</td><td style="padding:15px; color:var(--brand-accent); font-weight:bold;">${flags}</td></tr>`;
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
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 style="margin:0;">AI Run Sheet Generator</h2>
            <button onclick="window.print()" class="btn btn-outline" style="background:white; color:black; font-weight:bold;">🖨️ Print Run Sheet</button>
        </div>
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <div class="card no-print" style="flex:1; min-width:300px;">
                <label style="font-size:12px; color:var(--text-muted);">Paste SevenRooms / booking data below</label>
                <textarea id="raw-bookings" class="input-box" style="height:300px; font-size:12px; white-space:pre; margin-top:8px;" placeholder="Paste booking text or CSV from SevenRooms..."></textarea>
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
