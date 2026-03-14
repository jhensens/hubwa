// --- SECURE API KEY MANAGER ---
window.getApiKey = () => { let key = localStorage.getItem('geminiApiKey'); if (!key) { key = prompt("Enter Gemini API Key:"); if (key) localStorage.setItem('geminiApiKey', key.trim()); } return key; };
window.resetApiKey = () => { localStorage.removeItem('geminiApiKey'); window.showToast("API Key cleared."); };

// --- 1. SUPPLIER MANAGEMENT ---
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
                ${(window.suppliers||[]).length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">No suppliers added yet.</td></tr>' : (window.suppliers||[]).map((s, i) => `
                <tr style="border-bottom:1px solid var(--bg-main);">
                    <td style="padding:15px;"><strong>${s.name}</strong></td>
                    <td style="padding:15px; font-size:13px;">${s.contact || 'N/A'}</td>
                    <td style="padding:15px; font-size:13px; color:var(--brand-accent);">
                        Min Spend: <strong>$${s.minSpend || 0}</strong><br>
                        Cutoff: ${s.cutoff || 'N/A'}<br>
                        Days: ${s.deliveryDays ? s.deliveryDays.join(', ') : 'All'}
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
    let s = i !== null ? window.suppliers[i] : {name:'', contact:'', cutoff:'', minSpend: 0, deliveryDays: []};
    let daysHtml = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<label style="margin-right:10px; font-size:13px;"><input type="checkbox" id="sup-day-${d}" ${s.deliveryDays && s.deliveryDays.includes(d) ? 'checked' : ''}> ${d}</label>`).join('');
    
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
    if (i !== null) window.suppliers[i] = obj; else window.suppliers.push(obj);
    window.saveToDisk(); window.showView('suppliers');
};
window.delSupplier = (i) => { if(confirm("Delete Supplier?")) { window.suppliers.splice(i,1); window.saveToDisk(); window.showView('suppliers'); } };
// --- DANGER ZONE: WIPE ALL STOCK ---
window.resetAllStock = () => {
    let pin = localStorage.getItem('venuePin');
    if (pin) {
        let attempt = prompt("⚠️ DANGER: Enter Manager PIN to wipe ALL stock levels to 0.");
        if (attempt !== pin) return window.showToast("Incorrect PIN.", "error");
    } else {
        if(!confirm("⚠️ DANGER: Wipe all stock levels to 0? (No Master PIN is currently set!)")) return;
    }
    
    if(!confirm("Are you absolutely sure? This will keep all your items, prices, and history, but reset current stock to ZERO. This cannot be undone.")) return;
    
    let wipeCount = 0;
    (window.inventoryItems || []).forEach(i => { i.stock = 0; wipeCount++; });
    window.saveToDisk();
    window.showView('inventory');
    window.showToast(`Success: ${wipeCount} items reset to 0 stock.`, "error");
};
window.renderInventoryView = () => {
    let filtered = (window.inventoryItems || []).filter(item => {
        if (window.invFilters.filter === 'Active' && item.archived) return false;
        if (window.invFilters.filter === 'Archived' && !item.archived) return false;
        if (window.invFilters.filter !== 'Active' && window.invFilters.filter !== 'Archived' && item.category !== window.invFilters.filter) return false;
        if (window.invFilters.search) {
            const s = window.invFilters.search.toLowerCase();
            return item.name.toLowerCase().includes(s) || (item.sku && item.sku.toLowerCase().includes(s));
        }
        return true;
    });
// --- 2. LIVE INVENTORY (COMMERCIAL OVERHAUL) ---
window.invFilters = window.invFilters || { search: '', filter: 'Active' };

    const cats = [...new Set((window.inventoryItems || []).filter(i => !i.archived).map(i => i.category || 'Other'))];
    const pillsHtml = ['Active', ...cats, 'Archived'].map(c => `<div class="tag-pill ${window.invFilters.filter === c ? 'active' : ''}" onclick="window.invFilters.filter='${c}'; window.showView('inventory')">${c}</div>`).join('');

    return `
    <div style="max-width: 1200px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">Live Inventory</h2>
            <button onclick="window.editInvItem()" class="btn btn-blue">+ Add Product</button>
        </div>
        
        <input type="text" class="search-bar" placeholder="🔍 Search items or SKU..." value="${window.invFilters.search}" oninput="window.invFilters.search=this.value; window.showView('inventory')" autofocus>
        <div style="margin-bottom: 20px;">${pillsHtml}</div>
        
        <table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse: collapse; overflow:hidden;">
            <thead>
                <tr style="text-align:left; border-bottom:1px solid var(--border); background:#111; font-size:13px;">
                    <th style="padding:15px;">Item Details</th>
                    <th style="padding:15px;">Commercial Math</th>
                    <th style="padding:15px;">Storage Zone</th>
                    <th style="padding:15px;">Stock Level</th>
                    <th style="text-align:right; padding:15px;">Action</th>
                </tr>
            </thead>
            <tbody>
            ${filtered.length === 0 ? '<tr><td colspan=\"5\" style=\"text-align:center; padding:30px; color:var(--text-muted);\">No products found.</td></tr>' : filtered.map(item => {
                let price = Number(item.price) || 0; let stock = Number(item.stock) || 0; let yieldVal = Number(item.yield) || 1;
                let isWeekend = [0, 5, 6].includes(new Date().getDay());
                let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
                return `
                <tr style="border-bottom:1px solid var(--bg-main); opacity: ${item.archived ? '0.5' : '1'};">
                    <td style="padding:15px;"><strong>${item.name}</strong><br><small style="color:var(--text-muted);">${item.sku || 'No SKU'} | ${item.supplier || 'No Sup'}</small></td>
                    <td style="padding:15px;">
                        <strong style="color:var(--brand-accent);">$${price.toFixed(2)}</strong> / ${item.buyUnit || 'Unit'}<br>
                        <small style="color:var(--blue); font-weight:bold;">Yields ${yieldVal} ${item.useUnit || 'Unit'}</small><br>
                        <small style="color:var(--text-muted);">$${(price / yieldVal).toFixed(4)} per ${item.useUnit || 'Unit'}</small>
                    </td>
                    <td style="padding:15px; font-size:13px; color:var(--text-muted);">${item.location || 'Unassigned'}</td>
                    <td style="padding:15px;"><span style="color:${stock < parTarget ? 'var(--red)' : 'var(--green)'}; font-weight:bold; font-size:16px;">${stock.toFixed(2)}</span> <small>/ ${parTarget} PAR</small></td>
                    <td style="text-align:right; padding:15px;">
                        <button onclick="window.viewPriceTrend('${item.id}')" class="btn btn-outline" style="font-size:11px; padding:5px 10px; border-color:var(--purple); color:var(--purple); margin-right:5px;">📈 History</button>
                        <button onclick="window.editInvItem('${item.id}')" class="btn btn-outline" style="font-size:11px; padding:5px 10px;">Edit</button>
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
};

window.editInvItem = (id = null) => {
    let e = id ? window.inventoryItems.find(i => i.id === id) : { id: window.generateId('inv'), name:'', category:'Food', supplier:'', price:0, sku:'', location:'', gstFree:false, buyUnit:'Unit', yield:1, useUnit:'Unit', stock:0, parWeekday:0, parWeekend:0, archived: false, history:[] };
    let supplierOpts = (window.suppliers || []).map(s => `<option value="${s.name}" ${e.supplier === s.name ? 'selected' : ''}>${s.name}</option>`).join('');
    const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
    const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
    
    // Backwards compatibility for old 'par' data
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

        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Current Stock (Buy Units)</label><input type="number" step="0.1" id="iv-st" class="input-box" value="${e.stock}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Weekday PAR</label><input type="number" step="0.1" id="iv-parwd" class="input-box" value="${pWd}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Weekend PAR</label><input type="number" step="0.1" id="iv-parwe" class="input-box" value="${pWe}"></div>
            <div>
                <label style="font-size:11px; color:var(--text-muted);">Zone / Location</label>
                <select id="iv-loc" class="input-box">
                    <option value="">Unassigned</option>
                    <optgroup label="BOH (Kitchen)"><option ${e.location==='Walk-in Coolroom'?'selected':''}>Walk-in Coolroom</option><option ${e.location==='Pass Under-bench'?'selected':''}>Pass Under-bench</option><option ${e.location==='Dry Store'?'selected':''}>Dry Store</option></optgroup>
                    <optgroup label="FOH (Bar)"><option ${e.location==='Main Bar Fridge'?'selected':''}>Main Bar Fridge</option><option ${e.location==='Speed Rail'?'selected':''}>Speed Rail</option><option ${e.location==='Cocktail Station'?'selected':''}>Cocktail Station</option></optgroup>
                </select>
            </div>
        </div>

        <div class="sticky-footer">
            <button onclick="window.subInvItem('${e.id}', true)" class="btn btn-blue" style="flex:1;">Save & Add Another</button>
            <button onclick="window.subInvItem('${e.id}', false)" class="btn btn-green" style="flex:1;">Save & Close</button>
            ${id ? `<button onclick="window.archiveInv('${e.id}')" class="btn btn-orange" style="flex:0.5;">${e.archived ? 'Restore' : 'Archive'}</button>` : ''}
            <button onclick="window.showView('inventory')" class="btn btn-outline" style="flex:0.5;">Cancel</button>
        </div>
    </div>`;
    document.getElementById('mainContent').innerHTML = html;
};

window.subInvItem = (id, addAnother, isModal = false) => {
    let existingIdx = window.inventoryItems.findIndex(i => i.id === id);
    const price = parseFloat(document.getElementById('iv-p').value) || 0;
    
    let obj = {
        id: id, name: document.getElementById('iv-n').value, category: document.getElementById('iv-cat').value, sku: document.getElementById('iv-sku').value, supplier: document.getElementById('iv-s').value,
        price: price, location: document.getElementById('iv-loc').value, gstFree: document.getElementById('iv-gst').checked,
        stock: parseFloat(document.getElementById('iv-st').value) || 0, 
        parWeekday: parseFloat(document.getElementById('iv-parwd').value) || 0,
        parWeekend: parseFloat(document.getElementById('iv-parwe').value) || 0,
        par: parseFloat(document.getElementById('iv-parwd').value) || 0, // Legacy support
        yield: parseFloat(document.getElementById('iv-yield').value) || 1, useUnit: document.getElementById('iv-useUnit').value, buyUnit: document.getElementById('iv-buyUnit').value,
        archived: existingIdx >= 0 ? window.inventoryItems[existingIdx].archived : false,
        history: existingIdx >= 0 ? window.inventoryItems[existingIdx].history : []
    };
    
    if (existingIdx >= 0) { window.inventoryItems[existingIdx] = obj; } else { window.inventoryItems.push(obj); }
    window.saveToDisk();
    window.showToast(`${obj.name} saved successfully.`);
    
    if(isModal) {
        window.closeModal();
        if(window.tempRecipeId) window.editRecipeForm(window.tempRecipeId === 'new' ? null : window.tempRecipeId); // Refresh recipe builder
        return;
    }

    if (addAnother) { window.editInvItem(); } else { window.showView('inventory'); }
};

window.archiveInv = (id) => {
    let item = window.inventoryItems.find(i => i.id === id);
    if(item) { item.archived = !item.archived; window.saveToDisk(); window.showToast(item.archived ? 'Item Archived' : 'Item Restored'); window.showView('inventory'); }
};

window.viewPriceTrend = (id) => {
    const item = window.inventoryItems.find(i => i.id === id);
    if(!item) return;
    const history = item.history || [];
    let historyHtml = history.length === 0 ? '<p style="padding:20px; color:var(--text-muted);">No history found.</p>' : 
        `<table style="width:100%; border-collapse:collapse;">
            <tr style="text-align:left; color:var(--text-muted); font-size:11px; border-bottom:1px solid var(--border);"><th style="padding:10px;">Date</th><th style="padding:10px;">Supplier</th><th style="padding:10px;">Qty</th><th style="padding:10px;">Price</th></tr>
            ${history.slice().reverse().map(h => `<tr style="border-bottom:1px solid var(--border); font-size:12px;"><td style="padding:10px;">${h.date}</td><td style="padding:10px;">${h.supplier}</td><td style="padding:10px;">${h.qty}</td><td style="padding:10px; font-weight:bold; color:var(--brand-accent);">$${Number(h.price).toFixed(2)}</td></tr>`).join('')}
        </table>`;
    window.openModal(`📈 Trend: ${item.name}`, `<div style="max-height:400px; overflow-y:auto;">${historyHtml}</div><button onclick="window.closeModal()" class="btn btn-dark" style="width:100%; margin-top:20px;">Close</button>`);
};

// --- 3. RECIPES (YIELD-FIRST BUILDER & NESTED BATCHES) ---
window.recFilters = window.recFilters || { search: '', filter: 'Menu' };
window.tempIngs = [];
window.tempRecipeId = null;

window.renderRecipeView = () => {
    let filtered = (window.recipes || []).filter(r => {
        if (window.recFilters.filter === 'Menu' && r.type !== 'Menu') return false;
        if (window.recFilters.filter === 'Batch' && r.type !== 'Batch') return false;
        if (window.recFilters.search) {
            const s = window.recFilters.search.toLowerCase();
            return r.name.toLowerCase().includes(s) || (r.posAlias && r.posAlias.toLowerCase().includes(s));
        }
        return true;
    });

    const pillsHtml = ['Menu', 'Batch'].map(c => `<div class="tag-pill ${window.recFilters.filter === c ? 'active' : ''}" onclick="window.recFilters.filter='${c}'; window.showView('recipes')">${c} Recipes</div>`).join('');

    return `
    <div style="max-width: 1000px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">Recipe Engine</h2>
            <div>
                <button onclick="window.openAiRecipeImport()" class="btn btn-purple" style="margin-right:10px;">✨ AI Import</button>
                <button onclick="window.editRecipeForm()" class="btn btn-blue">+ New Recipe</button>
            </div>
        </div>
        
        <input type="text" class="search-bar" placeholder="🔍 Search recipes or POS names..." value="${window.recFilters.search}" oninput="window.recFilters.search=this.value; window.showView('recipes')" autofocus>
        <div style="margin-bottom: 20px;">${pillsHtml}</div>
        
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:20px;">
            ${filtered.length === 0 ? '<p style="color:var(--text-muted);">No recipes found.</p>' : filtered.map(r => `
                <div class="card" style="border-top:5px solid ${r.type === 'Menu' ? 'var(--brand-dark)' : 'var(--purple)'}; cursor:pointer; transition:transform 0.2s;" onclick="window.editRecipeForm('${r.id}')" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    <div style="display:flex; justify-content:space-between;">
                        <div><h4 style="margin:0;">${r.name}</h4>${r.type === 'Menu' && r.posAlias ? `<small style="color:var(--blue); font-size:11px; font-weight:bold;">[POS: ${r.posAlias}]</small>` : ''}</div>
                    </div>
                    <div style="font-size:13px; margin:10px 0; color:var(--text-muted);">📋 ${(r.ingredients||[]).length} Ingredients linked</div>
                    <div style="display:flex; justify-content:space-between; background:var(--bg-main); padding:10px; border-radius:6px; font-size:13px; border:1px solid var(--border);">
                        <div>Cost: <strong style="color:var(--brand-accent);">$${Number(r.cost||0).toFixed(2)}</strong><br>${r.type === 'Menu' ? `Sell: $${Number(r.price||0).toFixed(2)}` : `Yield: <strong>${r.yieldQty} ${r.yieldUnit}</strong>`}</div>
                        ${r.type === 'Menu' ? `<div style="text-align:right; font-size:18px; color:${r.gp >= 70 ? 'var(--green)' : 'var(--red)'}; font-weight:bold;">${r.gp}% GP</div>` : ''}
                    </div>
                </div>`).join('')}
        </div>
    </div>`;
}

window.editRecipeForm = (id = null) => {
    let r = id ? window.recipes.find(x => x.id === id) : { id: window.generateId('rec'), name:'', posAlias:'', type: window.recFilters.filter, price:0, yieldQty:1, yieldUnit:'Portion', method:'', ingredients:[], allergens:[] };
    if (!window.tempRecipeId || window.tempRecipeId !== id) { window.tempIngs = JSON.parse(JSON.stringify(r.ingredients || [])); window.tempRecipeId = id || 'new'; }

    let invOpts = (window.inventoryItems||[]).filter(i => !i.archived).map(inv => `<option value="inv_${inv.id}">${inv.name} (per ${inv.useUnit || 'Unit'})</option>`).join('');
    // Allow selecting batches inside batches! Just don't let them select themselves.
    let batchOpts = (window.recipes||[]).filter(b => b.type === 'Batch' && b.id !== id).map(b => `<option value="batch_${b.id}">[Batch] ${b.name} (per ${b.yieldUnit})</option>`).join('');

    const renderBuilder = () => {
        let totalCost = 0;
        let ingHtml = window.tempIngs.map((ing, tIdx) => {
            let itemCost = 0; let displayUnit = ing.unit; let isErr = false;
            
            if(ing.type==='inv') { 
                let inv = window.inventoryItems.find(i=>i.id===ing.ref); 
                if(inv) { itemCost = ing.qty * ((inv.price||0)/(inv.yield||1)); displayUnit = inv.useUnit; } else { isErr = true; } 
            }
            if(ing.type==='batch') { 
                let b = window.recipes.find(x=>x.id===ing.ref); 
                if(b) { itemCost = ing.qty * ((b.cost||0)/(b.yieldQty||1)); displayUnit = b.yieldUnit; } else { isErr = true; } 
            }
            
            totalCost += itemCost;
            return `<div style="display:flex; justify-content:space-between; font-size:13px; padding:12px 0; border-bottom:1px solid var(--border); align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="number" step="0.001" class="input-box" value="${ing.qty}" onchange="window.updateIngQty(${tIdx}, this.value)" style="width:80px; margin:0; padding:6px; border-color:var(--blue);"> 
                    <span><span style="color:var(--text-muted); font-size:11px; margin-right:5px;">${displayUnit}</span><strong style="color:${isErr?'var(--red)':'var(--text-main)'};">${ing.name} ${isErr?'(Missing!)':''}</strong></span>
                </div>
                <div><span style="margin-right:15px; font-weight:bold; color:var(--brand-accent);">$${itemCost.toFixed(2)}</span> <button onclick="window.rmIng(${tIdx})" style="color:var(--red); border:none; background:none; cursor:pointer; font-weight:bold; font-size:18px;">&times;</button></div>
            </div>`;
        }).join('');

        let isBatch = r.type === 'Batch';
        let gp = r.price > 0 ? ((r.price - totalCost) / r.price * 100).toFixed(1) : 0;

        document.getElementById('mainContent').innerHTML = `
        <div class="card" style="max-width:800px; margin:auto; padding-bottom:80px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="margin-top:0;">${id ? 'Edit' : 'New'} Recipe</h2>
                ${id ? `<button onclick="window.delRecipe('${r.id}')" class="btn btn-red" style="padding:5px 10px; font-size:11px;">🗑️ Delete Recipe</button>`:''}
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:15px; align-items:flex-end;">
                <div style="flex:2;"><label style="font-size:11px; color:var(--text-muted);">Hub Display Name</label><input type="text" id="r-n" class="input-box" value="${r.name}" style="margin:0;"></div>
                ${!isBatch ? `<div style="flex:2;"><label style="font-size:11px; color:var(--blue); font-weight:bold;">Lightspeed POS Name (Alias)</label><input type="text" id="r-pos" class="input-box" value="${r.posAlias || ''}" placeholder="Exact POS name..." style="margin:0; border-color:var(--blue);"></div>` : ''}
                <div style="flex:1;"><label style="font-size:11px; color:var(--text-muted);">Type</label><select id="r-type" class="input-box" style="margin:0;" onchange="window.refreshRB()"><option ${r.type==='Menu'?'selected':''}>Menu</option><option ${r.type==='Batch'?'selected':''}>Batch</option></select></div>
            </div>
            
            <div style="background:var(--bg-main); padding:20px; border-radius:8px; margin-bottom:15px; border: 1px solid var(--border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                    <h3 style="margin:0; color:var(--brand-dark);">Ingredients</h3>
                    <div>
                        <button onclick="window.scaleRecipe()" class="btn btn-outline" style="padding:6px 12px; font-size:11px; margin-right:5px;">⚖️ Scale Multiplier</button>
                        <button onclick="window.openQuickAddIngModal()" class="btn btn-blue" style="padding:6px 12px; font-size:11px;">+ Quick Add New Inventory</button>
                    </div>
                </div>
                ${ingHtml || '<p style="font-size:13px; color:var(--text-muted); text-align:center; padding:10px;">No ingredients linked yet.</p>'}
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <select id="add-sel" class="input-box" style="flex:2; margin:0;" onchange="window.updateUnitHint()"><option value="">Search & Select Ingredient...</option><optgroup label="Live Inventory">${invOpts}</optgroup><optgroup label="Prep Batches">${batchOpts}</optgroup></select>
                    <input type="number" step="0.001" id="add-qty" class="input-box" placeholder="Qty" style="width:100px; margin:0; border-color:var(--blue);">
                    <button onclick="window.addIng()" class="btn btn-green" style="width:80px;">Add</button>
                </div>
                <div id="unit-hint" style="font-size:12px; font-weight:bold; color:var(--blue); margin-top:8px; text-align:right;">Select an ingredient to see required Use Unit.</div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:15px; padding:15px; border-radius:8px; background:var(--card-bg); border:1px dashed var(--border);">
                ${isBatch ? `
                    <div style="display:flex; gap:10px;">
                        <div style="flex:1;"><label style="font-size:11px; color:var(--brand-accent); font-weight:bold;">Batch Yield Qty</label><input type="number" step="0.1" id="r-yq" class="input-box" value="${r.yieldQty}" oninput="window.refreshRB()" style="border-color:var(--brand-accent);"></div>
                        <div style="flex:1;"><label style="font-size:11px; color:var(--brand-accent); font-weight:bold;">Yield Unit (e.g. L, kg)</label><input type="text" id="r-yu" class="input-box" value="${r.yieldUnit}" oninput="window.refreshRB()" style="border-color:var(--brand-accent);"></div>
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; justify-content:center;">
                        <div style="font-size:12px; color:var(--text-muted);">Total Cost</div>
                        <div style="font-size:24px; font-weight:bold; color:var(--brand-dark);">$${totalCost.toFixed(2)}</div>
                        <div style="font-size:12px; color:var(--purple);">($${(totalCost/(r.yieldQty||1)).toFixed(4)} per ${r.yieldUnit})</div>
                    </div>
                ` : `
                    <div><label style="font-size:11px; color:var(--text-muted);">Sell Price ($)</label><input type="number" step="0.01" id="r-p" class="input-box" value="${r.price}" oninput="window.refreshRB()"></div>
                    <div style="text-align:right; display:flex; flex-direction:column; justify-content:center;">
                        <div style="font-size:12px; color:var(--text-muted);">Cost: $${totalCost.toFixed(2)}</div>
                        <div style="font-size:28px; font-weight:bold; color:${gp >= 70 ? 'var(--green)' : 'var(--red)'};">${gp}% GP</div>
                    </div>
                `}
            </div>
            
            <label style="font-size:11px; color:var(--text-muted);">Prep Method & Notes</label>
            <textarea id="r-m" class="input-box" placeholder="Method details..." style="height:120px;">${r.method || ''}</textarea>
            
            <div class="sticky-footer">
                <button onclick="window.subRecipe('${r.id}', ${totalCost})" class="btn btn-green" style="flex:2;">Save Recipe & Costing</button>
                <button onclick="window.tempRecipeId = null; window.showView('recipes')" class="btn btn-outline" style="flex:1;">Cancel</button>
            </div>
        </div>`;
        window.updateUnitHint();
    };

    window.refreshRB = () => { 
        r.name = document.getElementById('r-n').value; 
        if (document.getElementById('r-pos')) r.posAlias = document.getElementById('r-pos').value;
        r.type = document.getElementById('r-type').value;
        r.method = document.getElementById('r-m').value;
        if(document.getElementById('r-p')) r.price = parseFloat(document.getElementById('r-p').value)||0;
        if(document.getElementById('r-yq')) { r.yieldQty = parseFloat(document.getElementById('r-yq').value)||1; r.yieldUnit = document.getElementById('r-yu').value; }
        renderBuilder(); 
    };

    window.updateUnitHint = () => {
        const sel = document.getElementById('add-sel');
        const hint = document.getElementById('unit-hint');
        if(!sel || !hint || !sel.value) { if(hint) hint.innerText = "Select an ingredient..."; return; }
        const parts = sel.value.split('_');
        if(parts[0] === 'inv') {
            let inv = window.inventoryItems.find(i=>i.id === sel.value.replace('inv_',''));
            if(inv) hint.innerHTML = `⚠️ YOU MUST ENTER QUANTITY IN: <span style="background:var(--blue); color:white; padding:2px 6px; border-radius:4px; font-size:14px;">${inv.useUnit}</span> <small style="color:var(--text-muted);">(Buy Unit: ${inv.buyUnit} yields ${inv.yield} ${inv.useUnit})</small>`;
        } else {
            let b = window.recipes.find(x=>x.id === sel.value.replace('batch_',''));
            if(b) hint.innerHTML = `⚠️ YOU MUST ENTER QUANTITY IN: <span style="background:var(--purple); color:white; padding:2px 6px; border-radius:4px; font-size:14px;">${b.yieldUnit}</span>`;
        }
    };

    window.scaleRecipe = () => {
        let mult = parseFloat(prompt("Enter scale multiplier (e.g. 2 to double the recipe, 0.5 to halve it):", "2"));
        if (!mult || isNaN(mult)) return;
        window.tempIngs.forEach(ing => ing.qty = parseFloat((ing.qty * mult).toFixed(3)));
        if (document.getElementById('r-yq')) { document.getElementById('r-yq').value = (parseFloat(document.getElementById('r-yq').value) * mult).toFixed(2); }
        window.refreshRB();
        window.showToast(`Recipe scaled by ${mult}x`);
    };

    window.updateIngQty = (idx, val) => { window.tempIngs[idx].qty = parseFloat(val) || 0; window.refreshRB(); };

    window.addIng = () => {
        let qty = parseFloat(document.getElementById('add-qty').value);
        let selVal = document.getElementById('add-sel').value;
        if(!qty || !selVal) return window.showToast("Select item and enter quantity.", "error");
        let parts = selVal.split('_'); let type = parts[0]; let refId = selVal.replace(type+'_','');
        
        if(type === 'inv') {
            let inv = window.inventoryItems.find(i=>i.id===refId);
            window.tempIngs.push({type:'inv', ref:refId, qty:qty, unit:inv.useUnit||'Unit', name:inv.name});
        } else {
            let b = window.recipes.find(x=>x.id===refId);
            window.tempIngs.push({type:'batch', ref:refId, qty:qty, unit:b.yieldUnit, name:b.name});
        }
        window.refreshRB();
    };

    window.rmIng = (tIdx) => { window.tempIngs.splice(tIdx,1); window.refreshRB(); };
    
    // Quick Add Ingredient Modal using the new Zero Context Switch system
    window.openQuickAddIngModal = () => {
        const id = window.generateId('inv');
        const supplierOpts = (window.suppliers || []).map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
        const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
        
        let html = `
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:10px;">
            <div><label style="font-size:11px;">Name</label><input type="text" id="iv-n" class="input-box" placeholder="e.g. Kombu"></div>
            <div><label style="font-size:11px;">Category</label><input type="text" id="iv-cat" list="cat-list" class="input-box" value="Food"><datalist id="cat-list">${catOpts}</datalist></div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px; background:var(--bg-main); padding:10px; border-radius:6px;">
            <div><label style="font-size:11px;">Buy Price ($)</label><input type="number" step="0.01" id="iv-p" class="input-box" value="0"></div>
            <div><label style="font-size:11px;">Buy Unit</label><input type="text" id="iv-buyUnit" class="input-box" value="Unit"></div>
            <div style="display:none;"><input type="checkbox" id="iv-gst"></div> </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; border:1px dashed var(--blue); padding:10px; border-radius:6px;">
            <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-units in buy-unit)</label><input type="number" step="0.01" id="iv-yield" class="input-box" value="1"></div>
            <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit</label><input type="text" id="iv-useUnit" class="input-box" value="kg"></div>
        </div>
        
        <input type="hidden" id="iv-s" value=""><input type="hidden" id="iv-sku" value=""><input type="hidden" id="iv-st" value="0"><input type="hidden" id="iv-parwd" value="0"><input type="hidden" id="iv-parwe" value="0"><input type="hidden" id="iv-loc" value="">
        
        <button onclick="window.subInvItem('${id}', false, true)" class="btn btn-green" style="width:100%;">Save to Live Inventory</button>
        `;
        window.openModal("⚡ Quick Add Ingredient", html);
    };

    renderBuilder();
};

window.subRecipe = (id, totalCost) => {
    let existingIdx = window.recipes.findIndex(x => x.id === id);
    let type = document.getElementById('r-type').value;
    let oldAllergens = existingIdx >= 0 && window.recipes[existingIdx].allergens ? window.recipes[existingIdx].allergens : [];
    let obj = {
        id: id, name: document.getElementById('r-n').value,
        posAlias: type === 'Menu' && document.getElementById('r-pos') ? document.getElementById('r-pos').value : '',
        type: type, ingredients: window.tempIngs, cost: totalCost,
        method: document.getElementById('r-m').value, allergens: oldAllergens, archived: false,
        price: type === 'Menu' ? (parseFloat(document.getElementById('r-p').value)||0) : 0,
        yieldQty: type === 'Batch' ? (parseFloat(document.getElementById('r-yq').value)||1) : 1,
        yieldUnit: type === 'Batch' ? document.getElementById('r-yu').value : 'Portion',
        gp: 0
    };
    if(type === 'Menu' && obj.price > 0) obj.gp = parseFloat(((obj.price - totalCost) / obj.price * 100).toFixed(1));

    if (existingIdx >= 0) window.recipes[existingIdx] = obj; else window.recipes.push(obj);
    window.tempRecipeId = null; window.saveToDisk(); window.showToast("Recipe Costing Saved!"); window.showView('recipes');
};
window.delRecipe = (id) => { if(confirm("Permanently delete Recipe?")) { window.recipes = window.recipes.filter(x => x.id !== id); window.tempRecipeId = null; window.saveToDisk(); window.showToast("Recipe Deleted"); window.showView('recipes'); } };

window.openAiRecipeImport = () => {
    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:800px; margin:auto;">
        <h2 style="margin-top:0;">✨ AI Recipe Importer</h2>
        <div class="card" style="border-top:5px solid var(--purple);">
            <p style="color:var(--text-muted); font-size:14px; margin-top:0;">Paste recipe text from Recipe Keeper, websites, or emails. The AI will parse it and match ingredients to your Live Inventory.</p>
            <textarea id="ai-recipe-text" class="input-box" style="height:250px; font-family:monospace; font-size:12px;" placeholder="Paste recipe text here..."></textarea>
            <button onclick="window.runAiRecipeImport()" class="btn btn-purple" style="width:100%; font-size:16px; padding:12px;">Parse & Cost Recipe</button>
            <button onclick="window.showView('recipes')" class="btn btn-outline" style="width:100%; margin-top:10px;">Cancel</button>
            <div id="ai-recipe-status" style="margin-top:15px; text-align:center;"></div>
        </div>
    </div>`;
};
window.runAiRecipeImport = async () => { 
    const rawText = document.getElementById('ai-recipe-text').value;
    const statusDiv = document.getElementById('ai-recipe-status');
    if (!rawText.trim()) return window.showToast("Please paste a recipe first.", "error");
    statusDiv.innerHTML = `<p style="color:var(--purple); font-weight:bold;">🤖 Analyzing recipe and cross-referencing live inventory...</p>`;
    const invNames = (window.inventoryItems||[]).map(i => `${i.id}:${i.name} (per ${i.useUnit})`).join(', ');
    const prompt = `You are a culinary AI for Bar Wa Izakaya. Extract the recipe from the provided text.
    Return ONLY a JSON object exactly matching this structure:
    { "name": "Recipe Name", "method": "Write the method clearly.", "yieldQty": 1, "ingredients": [ { "name": "Parsed Name", "qty": 1.5, "unit": "kg", "matchedInvId": null } ] }
    Rules: 1. Match ingredient to these existing inventory IDs: [${invNames}]. 2. If strong match, set "matchedInvId" to the string ID. If no match, set null. 3. Convert units to standard metric if possible.
    Recipe Text: ${rawText}`;
    try {
        const apiKey = window.getApiKey(); if (!apiKey) return; 
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const aiResult = JSON.parse(rawJson);
        window.tempIngs = aiResult.ingredients.map(ing => {
            if (ing.matchedInvId !== null && window.inventoryItems.find(x => x.id === ing.matchedInvId)) {
                let inv = window.inventoryItems.find(x => x.id === ing.matchedInvId);
                return { type: 'inv', ref: ing.matchedInvId, qty: ing.qty, unit: inv.useUnit || ing.unit, name: inv.name };
            } else { return { type: 'unmatched', name: `${ing.qty} ${ing.unit} ${ing.name}`}; }
        });
        let unmatched = window.tempIngs.filter(i => i.type === 'unmatched'); window.tempIngs = window.tempIngs.filter(i => i.type !== 'unmatched');
        let extraNotes = unmatched.length > 0 ? `\n\n--- ⚠️ MISSING INGREDIENTS (Add to Live Inventory first) ---\n` + unmatched.map(u => u.name).join('\n') : '';
        let newObj = { id: window.generateId('rec'), name: aiResult.name || 'Imported Recipe', posAlias: '', type: 'Menu', price: 0, yieldQty: aiResult.yieldQty || 1, yieldUnit: 'Portion', method: (aiResult.method || '') + extraNotes, ingredients: window.tempIngs, cost: 0, gp: 0, allergens: [], archived: false };
        window.recipes.push(newObj); window.editRecipeForm(newObj.id); window.showToast("AI Parsing Complete!");
    } catch (e) { statusDiv.innerHTML = `<p style="color:var(--red);">API Error: ${e.message}</p>`; }
};

// --- 4. AUTO-ORDER / PREP LIST (DYNAMIC DAYS & MIN SPENDS) ---
window.renderPrepListView = () => {
    const isWeekend = [0, 5, 6].includes(new Date().getDay()); // Fri, Sat, Sun
    const currentDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

    const ordersNeeded = (window.inventoryItems||[]).filter(i => {
        if(i.archived) return false;
        let parTarget = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        return i.stock < parTarget;
    }).reduce((acc, item) => {
        if (!acc[item.supplier]) acc[item.supplier] = { items: [], totalSpend: 0, supObj: window.suppliers.find(s => s.name === item.supplier) };
        let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
        let qtyToOrder = parTarget - item.stock;
        acc[item.supplier].items.push({...item, toOrder: qtyToOrder});
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
            <button onclick="window.showView('inventory')" class="btn btn-outline">Update Stock Levels</button>
        </div>
        ${Object.keys(ordersNeeded).length === 0 ? '<div class="card"><p style="color:var(--green); font-weight:bold; font-size:18px;">✅ All inventory is at or above PAR. Nothing to order!</p></div>' : ''}
        ${Object.keys(ordersNeeded).map(supName => {
            const data = ordersNeeded[supName];
            const supObj = data.supObj || {minSpend: 0, deliveryDays: null};
            const meetsMin = data.totalSpend >= supObj.minSpend;
            const validDay = !supObj.deliveryDays || supObj.deliveryDays.length === 0 || supObj.deliveryDays.includes(currentDay);
            
            let warningHtml = '';
            if(!meetsMin) warningHtml += `<span style="color:var(--red); font-size:12px; margin-right:10px;">⚠️ Under Min Spend ($${data.totalSpend.toFixed(2)} / $${supObj.minSpend})</span>`;
            if(!validDay) warningHtml += `<span style="color:var(--orange); font-size:12px;">🚫 No Delivery on ${currentDay}</span>`;

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
                                <td style="padding:10px 0; text-align:right; color:var(--brand-accent); font-weight:bold; font-size:16px;">Order: ${o.toOrder.toFixed(1)} <small>${o.buyUnit||'Unit'}</small></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }).join('')}
    </div>`;
};

window.copyOrderText = (supName, estSpend) => {
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    const items = (window.inventoryItems||[]).filter(i => i.supplier === supName && !i.archived && i.stock < (isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0)));
    let text = `Hi ${supName},\n\nCould I please place an order for the following:\n\n`;
    items.forEach(i => { let par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0); text += `- ${par - i.stock}x ${i.buyUnit || 'Unit'} of ${i.name} ${i.sku ? `[${i.sku}]` : ''}\n`; });
    text += `\nThanks,\nBar Wa Izakaya`;
    navigator.clipboard.writeText(text).then(() => window.showToast(`Order copied for ${supName}!`));
};

// --- 5. CASUAL-PROOF WASTAGE TRACKER ---
window.renderWastageView = () => { 
    const invOpts = (window.inventoryItems||[]).filter(i=>!i.archived).map(i => `<option value="${i.id}">${i.name} (Buy: ${i.buyUnit} / Use: ${i.useUnit})</option>`).join('');
    return `
    <div style="max-width: 800px; margin: auto;">
        <h2 style="margin-top:0;">Wastage Tracker</h2>
        <div class="card" style="border-top:5px solid var(--orange);">
            <div style="margin-bottom:15px;">
                <label style="font-size:11px; color:var(--text-muted);">Select Live Inventory Item</label>
                <select id="w-item" class="input-box" style="margin:0;">
                    <option value="">-- Choose Item --</option>
                    ${invOpts}
                </select>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px; background:var(--bg-main); padding:15px; border-radius:6px; border:1px solid var(--border);">
                <div>
                    <label style="font-size:11px; color:var(--text-muted);">Quantity Wasted</label>
                    <input type="number" step="0.01" id="w-qty" class="input-box" placeholder="e.g. 1.5" style="margin:0;">
                </div>
                <div style="display:flex; flex-direction:column; justify-content:center;">
                    <label style="font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <input type="radio" name="w-unit-type" id="w-buy" value="buy" checked style="transform:scale(1.2);"> 
                        Counted in Buy Units <small style="color:var(--text-muted); font-weight:normal;">(e.g. Bottles, Kegs)</small>
                    </label>
                    <label style="font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px; margin-top:10px;">
                        <input type="radio" name="w-unit-type" id="w-use" value="use" style="transform:scale(1.2);"> 
                        Counted in Use Units <small style="color:var(--text-muted); font-weight:normal;">(e.g. ml, kg, shots)</small>
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
        ${(window.wastageLogs||[]).slice().reverse().map(w => `<div class="card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${w.itemName}</strong> <span style="color:var(--orange); font-size:13px;">(${w.logQty} ${w.unitLog})</span><br><small style="color:var(--text-muted);">${w.staff} - ${w.reason}</small></div><div style="text-align:right;"><strong style="color:var(--red);">$${Number(w.value).toFixed(2)} Lost</strong><br><small style="color:var(--text-muted);">${w.time}</small></div></div>`).join('')}
    </div>`; 
};

window.logWastage = () => { 
    const invId = document.getElementById('w-item').value; 
    const qtyInput = parseFloat(document.getElementById('w-qty').value) || 0;
    const isUseUnit = document.getElementById('w-use').checked;
    
    if (!invId || !qtyInput) return window.showToast("Item and Quantity required.", "error");
    
    let invMatch = window.inventoryItems.find(i => i.id === invId);
    if (!invMatch) return;

    let deductBuyUnits = 0;
    let dollarVal = 0;
    let displayUnit = "";

    if (isUseUnit) {
        // They counted in ml/kg
        deductBuyUnits = qtyInput / (invMatch.yield || 1);
        dollarVal = deductBuyUnits * (invMatch.price || 0);
        displayUnit = invMatch.useUnit;
    } else {
        // They counted in Bottles/Kegs
        deductBuyUnits = qtyInput;
        dollarVal = qtyInput * (invMatch.price || 0);
        displayUnit = invMatch.buyUnit;
    }

    invMatch.stock = Math.max(0, (invMatch.stock || 0) - deductBuyUnits);
    
    window.wastageLogs.push({ 
        itemName: invMatch.name, 
        logQty: qtyInput, 
        unitLog: displayUnit,
        deductedBuyUnits: deductBuyUnits,
        value: dollarVal, 
        reason: document.getElementById('w-rsn').value, 
        staff: document.getElementById('w-staff').value, 
        time: new Date().toLocaleString() 
    }); 
    
    window.saveToDisk(); window.showToast("Wastage Logged & Stock Deducted!"); window.showView('wastage'); 
};

// --- 6. MAP-ON-THE-FLY POS DEPLETION ---
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

    const menuItems = (window.recipes||[]).filter(r => r.type === 'Menu');
    if (menuItems.length === 0) return statusDiv.innerHTML = `<p style="color:var(--orange);">⚠️ No Menu Recipes built in the Hub yet!</p>`;

    statusDiv.innerHTML = `<p style="color:var(--brand-accent); font-weight:bold;">🤖 AI is translating Lightspeed data...</p>`;

    const prompt = `Extract items and Quantity Sold from this POS table. 
    Return ONLY JSON: { "results": [ { "rawName": "Exact POS Item Name", "qtySold": 42 } ] }
    Text: ${rawText}`;

    try {
        const apiKey = window.getApiKey(); if(!apiKey) return;
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
    let recipeOpts = `<option value="">-- Select Hub Recipe --</option>` + (window.recipes||[]).filter(r => r.type === 'Menu').map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    
    let html = `<div class="card" style="max-width:800px; margin:auto; border-top:5px solid var(--purple); padding-bottom:80px;">
        <h2 style="margin-top:0;">Map & Deplete Stock</h2>`;

    if (window.pendingMap.unknown.length > 0) {
        html += `<div style="background:rgba(245, 158, 11, 0.1); border:1px solid var(--orange); padding:15px; border-radius:8px; margin-bottom:20px;">
            <h4 style="color:var(--orange); margin-top:0; border-bottom:1px solid var(--orange); padding-bottom:5px;">⚠️ Map Unknown Items</h4>
            <p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Map these once. The Hub will save them to its memory bank forever.</p>`;
        window.pendingMap.unknown.forEach((u, i) => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:10px; border-radius:6px; margin-bottom:10px; border:1px solid var(--border);">
                <div><strong style="color:var(--orange);">${u.posName}</strong><br><small>Sold: ${u.qtySold}</small></div>
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
                <span><span style="color:var(--text-muted);">${k.posName}</span> ➔ <strong>${rName}</strong></span>
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
            if(!window.posMappings) window.posMappings = {};
            window.posMappings[u.posName] = selectedId;
            window.pendingMap.known.push({ posName: u.posName, recipeId: selectedId, qtySold: u.qtySold });
        }
    });

    let deductions = {}; 
    
    window.pendingMap.known.forEach(k => {
        const recipe = window.recipes.find(r => r.id === k.recipeId);
        if (recipe) {
            (recipe.ingredients||[]).forEach(ing => {
                if (ing.type === 'inv') {
                    deductions[ing.ref] = (deductions[ing.ref] || 0) + (ing.qty * k.qtySold);
                } else if (ing.type === 'batch') {
                    const batch = window.recipes.find(r => r.id === ing.ref);
                    if (batch) {
                        const batchRatio = (ing.qty * k.qtySold) / (batch.yieldQty || 1);
                        (batch.ingredients||[]).forEach(bIng => {
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

// --- 7. INVOICE RIPPER PRO (WITH MAP-ON-THE-FLY) ---

window.renderInvoiceView = () => { 
    return `
    <div style="max-width: 1200px; margin: auto;">
        <h2 style="margin-top:0;">Invoice Ripper Pro</h2>
        <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">
            <div style="flex:1; min-width:350px;">
                <p style="color:var(--text-muted);">Scanned items will update prices AND add to current stock.</p>
                <div class="card" style="margin-bottom: 20px; text-align:center; padding:30px;">
                    <input type="file" id="invoice-pdf" accept="application/pdf" style="display:none;" onchange="window.readPdfInvoice(event)">
                    <button onclick="document.getElementById('invoice-pdf').click()" class="btn btn-blue" style="font-size:16px; padding:12px 24px;">📄 Select PDF Invoice</button>
                    <p id="pdf-status" style="margin-top:15px; color:var(--brand-accent); font-size:13px;">Waiting for file...</p>
                </div>
                <div id="invoice-results"></div>
            </div>
            <div class="card no-print" id="pdf-preview-container" style="flex:1.5; min-width:400px; display:none; padding:0; height:800px; overflow:hidden; border:2px solid var(--border);">
                <iframe id="pdf-preview-frame" style="width:100%; height:100%; border:none;"></iframe>
            </div>
        </div>
        <textarea id="invoice-text" style="display:none;"></textarea>
    </div>`; 
};

window.readPdfInvoice = async (e) => {
    const file = e.target.files[0]; if(!file) return;
    document.getElementById('pdf-preview-frame').src = URL.createObjectURL(file);
    document.getElementById('pdf-preview-container').style.display = 'block';
    document.getElementById('pdf-status').innerText = "Reading PDF...";
    const fileReader = new FileReader();
    fileReader.onload = async function() {
        try {
            const typedarray = new Uint8Array(this.result); const pdf = await pdfjsLib.getDocument(typedarray).promise; let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i); const textContent = await page.getTextContent();
                let items = textContent.items.map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
                items.sort((a, b) => { if (Math.abs(b.y - a.y) <= 5) return a.x - b.x; return b.y - a.y; });
                items.forEach(item => fullText += item.str.trim() + " ");
            }
            document.getElementById('invoice-text').value = fullText; window.parseInvoice(); 
        } catch (err) { document.getElementById('pdf-status').innerText = "Read Error."; }
    };
    fileReader.readAsArrayBuffer(file);
};

window.parseInvoice = async () => {
    const rawText = document.getElementById('invoice-text').value; if (!rawText) return;
    document.getElementById('invoice-results').innerHTML = `<p style="color:var(--brand-accent);">🤖 AI extracting data...</p>`;
    const prompt = `Extract line items. Return ONLY JSON: { "supplier": "Name", "date": "DD/MM/YYYY", "items": [{ "itemName": "Name", "sku": "Code", "totalLinePrice": 0.00, "quantity": 0.00, "unitPrice": 0.00 }] } Text: ${rawText}`;
    try {
        const apiKey = window.getApiKey(); if (!apiKey) return; 
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }) });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        
        window.pendingInvoiceData = JSON.parse(data.candidates[0].content.parts[0].text);
        window.processAIInvoiceResults();
    } catch (error) { document.getElementById('invoice-results').innerHTML = `<p style="color:var(--red);">AI Error: ${error.message}</p>`; }
};

window.processAIInvoiceResults = () => {
    const aiResult = window.pendingInvoiceData;
    let updatedCount = 0;
    
    const invOpts = `<option value="">-- Map to Hub Item --</option>` + (window.inventoryItems||[]).filter(inv => !inv.archived).map(inv => `<option value="${inv.id}">${inv.name} (${inv.buyUnit})</option>`).join('');

    let resultsHtml = `<div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:5px;"><h3 style="color:var(--brand-accent); margin:0;">AI Results</h3><small>${aiResult.supplier} | ${aiResult.date}</small></div><div style="max-height:600px; overflow-y:auto; padding-right:10px;">`;
    
    (aiResult.items||[]).forEach((aiItem, index) => {
        let bestMatch = (window.inventoryItems||[]).find(item => (item.sku && aiItem.sku && item.sku === aiItem.sku)) || null;
        if (!bestMatch) { (window.inventoryItems||[]).forEach(item => { const words = item.name.toLowerCase().split(/\s+/).filter(w => w.length > 2); let matchCount = 0; words.forEach(w => { if(aiItem.itemName.toLowerCase().includes(w)) matchCount++; }); if (matchCount/words.length >= 0.75) bestMatch = item; }); }
        
        const newPrice = aiItem.unitPrice || aiItem.totalLinePrice || 0;

        if (bestMatch) {
            const oldPrice = bestMatch.price; bestMatch.price = newPrice;
            if (aiItem.sku) bestMatch.sku = aiItem.sku; bestMatch.stock = (Number(bestMatch.stock) || 0) + Number(aiItem.quantity);
            if (!bestMatch.history) bestMatch.history = []; bestMatch.history.push({ date: aiResult.date, price: newPrice, supplier: aiResult.supplier, qty: aiItem.quantity });
            if (bestMatch.history.length > 10) bestMatch.history.shift();
            resultsHtml += `<div class="card" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--green);"><div style="font-size:13px; color:var(--green); font-weight:bold;">✓ ${bestMatch.name} (+${aiItem.quantity} In-Stock)</div><div style="font-size:11px; color:var(--text-muted); margin-top:5px;">$${oldPrice.toFixed(2)} ➔ <strong>$${newPrice.toFixed(2)}</strong></div></div>`;
            updatedCount++;
        } else {
            resultsHtml += `
            <div class="card" id="unmatched-inv-${index}" style="padding:15px; margin-bottom:10px; border-left:4px solid var(--orange);">
                <div style="font-size:13px; color:var(--orange); font-weight:bold; margin-bottom:10px;">❓ Unmatched: ${aiItem.itemName} <br><small style="color:var(--text-muted); font-weight:normal;">Qty: ${aiItem.quantity} | Price: $${newPrice.toFixed(2)}</small></div>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <select id="map-inv-${index}" class="input-box" style="margin:0; flex:1; min-width:140px; font-size:11px; padding:6px;">${invOpts}</select>
                    <button onclick="window.linkInvoiceItem(${index})" class="btn btn-outline" style="font-size:11px; padding:6px 12px;">Link</button>
                    <button onclick="window.quickAddFromInvoice(${index})" class="btn btn-blue" style="font-size:11px; padding:6px 12px;">+ Add New</button>
                </div>
            </div>`;
        }
    });
    if (updatedCount > 0) { window.saveToDisk(); window.showToast(`${updatedCount} items auto-stocked.`); }
    document.getElementById('invoice-results').innerHTML = resultsHtml + `</div>`;
};

window.linkInvoiceItem = (index) => {
    const selectedId = document.getElementById(`map-inv-${index}`).value;
    if (!selectedId) return window.showToast("Select a Hub item to link.", "error");
    
    const aiItem = window.pendingInvoiceData.items[index];
    const inv = window.inventoryItems.find(x => x.id === selectedId);
    if (!inv) return;

    const newPrice = aiItem.unitPrice || aiItem.totalLinePrice || 0;
    inv.stock = (Number(inv.stock) || 0) + Number(aiItem.quantity);
    inv.price = newPrice;
    if (aiItem.sku) inv.sku = aiItem.sku; 
    
    if (!inv.history) inv.history = [];
    inv.history.push({ date: window.pendingInvoiceData.date, price: newPrice, supplier: window.pendingInvoiceData.supplier, qty: aiItem.quantity });
    window.saveToDisk();
    
    const card = document.getElementById(`unmatched-inv-${index}`);
    card.style.borderLeft = "4px solid var(--green)";
    card.innerHTML = `<div style="font-size:13px; color:var(--green); font-weight:bold;">✓ Linked to ${inv.name} (+${aiItem.quantity} In-Stock)</div><div style="font-size:11px; color:var(--text-muted); margin-top:5px;">Price updated to <strong>$${newPrice.toFixed(2)}</strong></div>`;
    window.showToast("Item linked & stock updated!");
};

window.quickAddFromInvoice = (index) => {
    const aiItem = window.pendingInvoiceData.items[index];
    const newPrice = aiItem.unitPrice || aiItem.totalLinePrice || 0;
    
    const id = window.generateId('inv');
    const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
    const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
    
    let html = `
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Name</label><input type="text" id="iv-n" class="input-box" value="${aiItem.itemName.replace(/"/g, '&quot;')}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iv-cat" list="cat-list" class="input-box" value="Food"><datalist id="cat-list">${catOpts}</datalist></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px; background:var(--bg-main); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Price ($)</label><input type="number" step="0.01" id="iv-p" class="input-box" value="${newPrice}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Unit</label><input type="text" id="iv-buyUnit" class="input-box" value="CTN"></div>
        <div style="display:none;"><input type="checkbox" id="iv-gst"></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; border:1px dashed var(--blue); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-units inside)</label><input type="number" step="0.01" id="iv-yield" class="input-box" value="1"></div>
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit</label><input type="text" id="iv-useUnit" class="input-box" value="kg"></div>
    </div>
    
    <button onclick="window.saveNewInvoiceItem('${id}', ${index})" class="btn btn-green" style="width:100%; font-size:15px;">Save & Add Stock (+${aiItem.quantity})</button>
    `;
    window.openModal("⚡ Quick Add New Product", html);
};

window.saveNewInvoiceItem = (id, index) => {
    const aiItem = window.pendingInvoiceData.items[index];
    const supplierName = window.pendingInvoiceData.supplier;
    
    let obj = {
        id: id, name: document.getElementById('iv-n').value, category: document.getElementById('iv-cat').value, sku: aiItem.sku || '', supplier: supplierName,
        price: parseFloat(document.getElementById('iv-p').value) || 0, location: '', gstFree: false,
        stock: Number(aiItem.quantity) || 0, parWeekday: 0, parWeekend: 0,
        yield: parseFloat(document.getElementById('iv-yield').value) || 1, useUnit: document.getElementById('iv-useUnit').value, buyUnit: document.getElementById('iv-buyUnit').value,
        archived: false, history: [{ date: window.pendingInvoiceData.date, price: parseFloat(document.getElementById('iv-p').value) || 0, supplier: supplierName, qty: aiItem.quantity }]
    };
    
    if (supplierName && !window.suppliers.find(s => s.name === supplierName)) { window.suppliers.push({ name: supplierName, contact: '', cutoff: '', minSpend: 0, deliveryDays: [] }); }

    window.inventoryItems.push(obj);
    window.saveToDisk();
    window.closeModal();
    
    const card = document.getElementById(`unmatched-inv-${index}`);
    card.style.borderLeft = "4px solid var(--green)";
    card.innerHTML = `<div style="font-size:13px; color:var(--green); font-weight:bold;">✓ Saved as New: ${obj.name} (+${aiItem.quantity} In-Stock)</div>`;
    window.showToast(`${obj.name} added to Live Inventory!`);
};

// --- 8. ALLERGENS, RUN SHEETS & ALERTS ---
window.renderAllergenView = () => { 
    return `<div style="max-width: 800px; margin: auto;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2 style="margin:0;">Allergen Matrix</h2><button onclick="window.runAiAllergenScan()" class="btn btn-purple">✨ AI Scan Menu</button></div><div id="allergen-status" style="margin-bottom:15px;"></div><p style="color:var(--text-muted);">Displays flags found in Recipe names (GF, VG) or detected by the AI Scan.</p><table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse:collapse;"><tr style="background:#111; text-align:left;"><th style=\"padding:15px;\">Menu Item</th><th style=\"padding:15px;\">Dietary Flags</th></tr>${(window.recipes||[]).filter(r=>r.type==='Menu' && !r.archived).map(r=> { let flags = r.allergens && r.allergens.length > 0 ? r.allergens.join(', ') : `${r.name.includes('GF')?'GF ':''}${r.name.includes('VG')?'VG ':''}${r.name.includes('DF')?'DF ':''}`; return `<tr style="border-bottom:1px solid var(--border);"><td style="padding:15px;">${r.name}</td><td style="padding:15px; color:var(--brand-accent); font-weight:bold;">${flags}</td></tr>`; }).join('')}</table></div>`; 
};
window.runAiAllergenScan = async () => { /* Kept lightweight for now */ };

window.renderSheetGenView = () => { 
    return `<div style="max-width: 1100px; margin: auto;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2 style="margin:0;">AI Run Sheet Generator</h2><button onclick="window.print()" class="btn btn-outline" style="background:white; color:black; font-weight:bold;">🖨️ Print Run Sheet</button></div><div style="display:flex; gap:20px; flex-wrap:wrap;"><div class="card no-print" style="flex:1; min-width:300px;"><textarea id="raw-bookings" class="input-box" style="height:300px; font-size:12px; white-space:pre;" placeholder="Paste SevenRooms data..."></textarea><button onclick="window.generateRunSheet()" class="btn btn-purple" style="width:100%; font-size:16px;">✨ Generate Smart Sheet</button></div><div class="card" id="print-section" style="flex:2; background:white; color:black; min-height:600px; min-width:550px; padding:30px;"><div id="run-sheet-output"><p style="text-align:center; color:#999; margin-top:100px;">Sheet output...</p></div></div></div></div>`; 
};
window.generateRunSheet = async () => { /* Kept lightweight for now */ };

window.checkRecipeMargins = () => {
    let alerts = [];
    (window.recipes||[]).filter(r => r.type === 'Menu' && !r.archived).forEach(recipe => {
        let currentCost = 0;
        (recipe.ingredients||[]).forEach(ing => {
            if (ing.type === 'inv') { let inv = window.inventoryItems.find(i=>i.id===ing.ref); if(inv) currentCost += Number(ing.qty) * (Number(inv.price) / Number(inv.yield || 1)); }
            else if (ing.type === 'batch') { let b = window.recipes.find(r=>r.id===ing.ref); if(b) currentCost += Number(ing.qty) * (Number(b.cost) / Number(b.yieldQty || 1)); }
        });
        const newGp = recipe.price > 0 ? ((recipe.price - currentCost) / recipe.price * 100).toFixed(1) : 0;
        if (Number(newGp) < 70) alerts.push({ name: recipe.name, currentGp: newGp, cost: currentCost.toFixed(2) });
        recipe.cost = currentCost; recipe.gp = parseFloat(newGp);
    });
    return alerts;
};
