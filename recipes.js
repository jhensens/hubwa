// --- HOBART HUB: Recipes Module ---
// Recipe Hub, Recipe Engine, Sell Price Editor, Costing Report, POS Aliases, Bulk Category Editor, Print/Duplicate

// =============================================================================
// 4. RECIPE ENGINE — PHASE 2
// Bulk HTML importer, photo/video, print, scale, station tags, status,
// Margin Health view, 67% GP threshold
// =============================================================================

const GP_TARGET = window.GP_TARGET || 67;

window.recFilters = window.recFilters || { search: '', filter: 'All', station: 'All', status: 'Active' };
// -----------------------------------------------------------------------
// SEARCH REFRESH HELPERS — update list only, no full page re-render
// Fixes the "click per letter" bug in search bars
// -----------------------------------------------------------------------
window._debouncedInvRefresh = window.debounce ? window.debounce(() => window._refreshInvList(), 250) : () => window._refreshInvList();
window._refreshInvList = () => {
    const wrap = document.getElementById('inv-accordion-wrap');
    if (!wrap) { window.showView('inventory'); return; }
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    let filtered = window._filterInvItems ? window._filterInvItems(isWeekend) : [];
    const result = window._buildInvAccordion(filtered, isWeekend);
    // Save cursor position before DOM update
    const searchBox = document.getElementById('inv-search-box');
    const cursorPos = searchBox ? searchBox.selectionStart : 0;
    // Update accordion content only (search bar stays untouched)
    wrap.innerHTML = result.html;
    // Update item count label
    const countLabel = document.getElementById('inv-count-label');
    if (countLabel) {
        const label = result.totalFiltered > result.shownCount
            ? result.shownCount + ' of ' + result.totalFiltered
            : '' + result.totalFiltered;
        countLabel.textContent = '(' + label + ' items)';
    }
    // Restore focus and cursor
    if (searchBox) { searchBox.focus(); searchBox.selectionStart = searchBox.selectionEnd = cursorPos; }
};

window._refreshRecList = () => {
    const container = document.getElementById('rec-list-container');
    if (!container) { window.showView('recipes'); return; }
    let filtered = (window.recipes || []).filter(r => {
        if (window.recFilters.status !== 'All' && (r.status || 'Active') !== window.recFilters.status) return false;
        if (window.recFilters.filter === 'Menu' && r.type !== 'Menu') return false;
        if (window.recFilters.filter === 'Batch' && r.type !== 'Batch') return false;
        if (window.recFilters.filter === 'QtyFix' && !(r.ingredients||[]).some(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed)) return false;
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
    const c = course.toLowerCase().trim();
    // Batched cocktails and cocktail prep are Batch type
    if (c === 'batched cocktails' || c === 'cocktail prep') return 'Batch';
    // Preperation (sic) is Batch type
    if (c === 'preperation' || c === 'preparation') return 'Batch';
    // All other cocktail/bar/mocktail courses are Menu
    return 'Menu';
};
window._courseToStation = (course) => {
    if (!course) return 'Kitchen';
    const c = course.toLowerCase().trim();
    // All cocktail-related courses go to Bar
    if (/cocktail|mocktail|batched/.test(c) || c.startsWith('new cocktails') || c === 'old cocktails') return 'Bar';
    // Prep station
    if (c === 'preperation' || c === 'preparation') return 'Prep';
    // Kitchen: Kitchen, Dessert, Main Dish, Snack, Breakfast, and anything else
    return 'Kitchen';
};

window._recHubTab = window._recHubTab || 'recipes';

window.renderRecipeHub = () => {
    const tab = window._recHubTab;
    const tabs = [
        { id: 'recipes', label: '⚖️ Recipes' },
        { id: 'margins', label: '📊 Margins' },
        { id: 'linker', label: '🔗 Ingredients' },
        { id: 'allergens', label: '🧪 Allergens' },
        { id: 'runsheet', label: '📄 Run Sheet' }
    ];
    const tabBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">' +
        tabs.map(t => '<span class="tag-pill ' + (tab === t.id ? 'active' : '') + '" onclick="window._recHubTab=\'' + t.id + '\';window.showView(\'recipes\');">' + t.label + '</span>').join('') +
    '</div>';
    let content = '';
    if (tab === 'recipes') content = window.renderRecipeView ? window.renderRecipeView() : '';
    else if (tab === 'margins') content = window.renderMarginView ? window.renderMarginView() : '';
    else if (tab === 'linker') content = window.renderAiBatchLinker ? window.renderAiBatchLinker() : '';
    else if (tab === 'allergens') content = window.renderAllergenView ? window.renderAllergenView() : '';
    else if (tab === 'runsheet') content = window.renderSheetGenView ? window.renderSheetGenView() : '';
    return '<div style="max-width:1200px;margin:auto;">' + tabBar + '</div>' + content;
};

window.renderRecipeView = () => {
    // Migrate old "86'd" status to "Off Menu"
    (window.recipes || []).forEach(r => { if (r.status === "86'd") r.status = 'Off Menu'; });
    const stationColor = { 'Kitchen': 'var(--orange)', 'Bar': 'var(--blue)', 'Prep': 'var(--purple)' };
    let filtered = (window.recipes || []).filter(r => {
        if (window.recFilters.status !== 'All' && (r.status || 'Active') !== window.recFilters.status) return false;
        if (window.recFilters.filter === 'Menu' && r.type !== 'Menu') return false;
        if (window.recFilters.filter === 'Batch' && r.type !== 'Batch') return false;
        if (window.recFilters.filter === 'QtyFix' && !(r.ingredients||[]).some(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed)) return false;
        if (window.recFilters.station !== 'All' && (r.station || 'Kitchen') !== window.recFilters.station) return false;
        if (window.recFilters.search) {
            const s = window.recFilters.search.toLowerCase();
            return r.name.toLowerCase().includes(s) || (r.posAlias && r.posAlias.toLowerCase().includes(s));
        }
        return true;
    });
    const qtyFixCount = (window.recipes||[]).filter(r=>!r.archived&&(r.ingredients||[]).some(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed)).length;
    const totalQtyFixIngs = (window.recipes||[]).reduce((s,r)=>s+(r.archived?0:(r.ingredients||[]).filter(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed).length),0);
    const typePills = ['All','Menu','Batch'].map(c => `<div class="tag-pill ${window.recFilters.filter===c?'active':''}" onclick="window.recFilters.filter='${c}';window.showView(\'recipes\')">${c}</div>`).join('') + (qtyFixCount>0?`<div class="tag-pill ${window.recFilters.filter==='QtyFix'?'active':''}" style="border-color:var(--orange);${window.recFilters.filter==='QtyFix'?'background:var(--orange);color:#fff;':'color:var(--orange);'}" onclick="window.recFilters.filter='QtyFix';window.showView(\'recipes\')">🔧 Qty Fix (${qtyFixCount})</div>`:'');
    const stationPills = ['All','Kitchen','Bar','Prep'].map(s => `<div class="tag-pill ${window.recFilters.station===s?'active':''}" onclick="window.recFilters.station='${s}';window.showView(\'recipes\')">${s}</div>`).join('');
    const statusPills = ['Active','Off Menu','Development'].map(s => `<div class="tag-pill ${window.recFilters.status===s?'active':''}" onclick="window.recFilters.status='${s}';window.showView(\'recipes\')">${s}</div>`).join('');
    // Sort logic for table view
    const sort = window._recSort || { col: 'name', dir: 'asc' };
    const sortFn = (a, b) => {
        let va, vb;
        switch (sort.col) {
            case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
            case 'station': va = (a.station||'Kitchen'); vb = (b.station||'Kitchen'); break;
            case 'type': va = a.type; vb = b.type; break;
            case 'cost': va = a.cost||0; vb = b.cost||0; break;
            case 'sell': va = a.price||0; vb = b.price||0; break;
            case 'gp': va = a.gp||0; vb = b.gp||0; break;
            case 'linked': va = (a.ingredients||[]).filter(i=>i.type==='inv'||i.type==='batch').length; vb = (b.ingredients||[]).filter(i=>i.type==='inv'||i.type==='batch').length; break;
            default: va = a.name.toLowerCase(); vb = b.name.toLowerCase();
        }
        if (va < vb) return sort.dir === 'asc' ? -1 : 1;
        if (va > vb) return sort.dir === 'asc' ? 1 : -1;
        return 0;
    };

    const viewMode = window._recViewMode || localStorage.getItem('recViewMode') || 'grid';
    const sortArrow = (col) => sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '';
    const sortClick = (col) => `window._recSort=window._recSort||{col:'name',dir:'asc'};if(window._recSort.col==='${col}')window._recSort.dir=window._recSort.dir==='asc'?'desc':'asc';else{window._recSort.col='${col}';window._recSort.dir='asc';}window.showView('recipes');`;
    const viewToggle = `<div style="display:flex;gap:2px;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
        <button onclick="window._recViewMode='grid';localStorage.setItem('recViewMode','grid');window.showView('recipes');" style="padding:6px 14px;font-size:12px;font-weight:600;border:none;cursor:pointer;color:${viewMode==='grid'?'#fff':'var(--text-muted)'};background:${viewMode==='grid'?'var(--blue)':'var(--card-bg)'};">Grid</button>
        <button onclick="window._recViewMode='table';localStorage.setItem('recViewMode','table');window.showView('recipes');" style="padding:6px 14px;font-size:12px;font-weight:600;border:none;cursor:pointer;color:${viewMode==='table'?'#fff':'var(--text-muted)'};background:${viewMode==='table'?'var(--blue)':'var(--card-bg)'};">Table</button>
    </div>`;

    // Build grid view
    const emptyHtml = '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);grid-column:1/-1;"><div style="font-size:36px;margin-bottom:12px">⚖️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No recipes found</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Try adjusting your filters or create a new recipe.</div></div>';

    const gridHtml = filtered.length === 0 ? emptyHtml : filtered.map(r => {
        const gpColor = r.gp >= GP_TARGET ? 'var(--green)' : r.gp > 0 ? 'var(--red)' : 'var(--text-muted)';
        const station = r.station || 'Kitchen';
        const status = r.status || 'Active';
        const statusColor = status === 'Active' ? 'var(--green)' : status === 'Off Menu' ? 'var(--red)' : 'var(--orange)';
        return `<div class="card" style="border-left:4px solid ${stationColor[station] || 'var(--border)'};cursor:pointer;transition:transform 0.15s;padding:12px;" onclick="window.viewRecipe('${r.id}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            ${r.photo ? `<img src="${r.photo}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;">` : ''}
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                <h4 style="margin:0;font-size:14px;flex:1;padding-right:6px;line-height:1.3;">${esc(r.name)}</h4>
                <span style="font-size:10px;color:${statusColor};border:1px solid ${statusColor};padding:2px 5px;border-radius:8px;white-space:nowrap;">${status}</span>
            </div>
            <div style="display:flex;gap:5px;margin-bottom:8px;flex-wrap:wrap;">
                <span style="font-size:11px;color:${stationColor[station]};border:1px solid ${stationColor[station]};padding:2px 7px;border-radius:8px;">${station}</span>
                <span style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);padding:2px 7px;border-radius:8px;">${r.type}</span>
            </div>
            <div style="display:flex;justify-content:space-between;background:var(--bg-main);padding:6px 8px;border-radius:5px;font-size:11px;border:1px solid var(--border);">
                <div style="color:var(--text-muted);">Cost:<strong style="color:var(--brand-accent);"> $${Number(r.cost || 0).toFixed(2)}</strong><br>${r.type === 'Menu' ? `Sell: $${Number(r.price || 0).toFixed(2)}` : `Yield: ${r.yieldQty} ${esc(r.yieldUnit)}`}</div>
                ${r.type === 'Menu' && r.price > 0 ? `<div style="font-size:20px;font-weight:bold;color:${gpColor};align-self:center;">${r.gp || 0}%</div>` : ''}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">📋 ${(r.ingredients || []).filter(i => i.type === 'inv' || i.type === 'batch').length} linked · ${(r.ingredients || []).filter(i => i.type === 'raw').length} raw${(()=>{const qf=(r.ingredients||[]).filter(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed).length;return qf?` · <span style="color:var(--orange);font-weight:bold;">🔧 ${qf} qty fix</span>`:''})()}</div>
        </div>`;
    }).join('');

    // Build table view
    const sortedForTable = [...filtered].sort(sortFn);
    const tableRows = sortedForTable.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">No recipes found</td></tr>` : sortedForTable.map(r => {
        const station = r.station || 'Kitchen';
        const status = r.status || 'Active';
        const statusColor = status === 'Active' ? 'var(--green)' : status === 'Off Menu' ? 'var(--red)' : 'var(--orange)';
        const gpColor = r.gp >= GP_TARGET ? 'var(--green)' : r.gp > 0 ? 'var(--red)' : 'var(--text-muted)';
        const linked = (r.ingredients || []).filter(i => i.type === 'inv' || i.type === 'batch').length;
        const raw = (r.ingredients || []).filter(i => i.type === 'raw').length;
        const total = linked + raw;
        const linkPct = total > 0 ? Math.round((linked / total) * 100) : 0;
        const linkColor = linkPct === 100 ? 'var(--green)' : linkPct > 50 ? 'var(--orange)' : 'var(--red)';
        const qfCount = (r.ingredients||[]).filter(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed).length;
        return `<tr style="border-bottom:1px solid var(--border);cursor:pointer;" onclick="window.viewRecipe('${r.id}')" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background=''">
            <td style="padding:10px 12px;"><strong style="font-size:13px;">${esc(r.name)}</strong>${r.posAlias ? `<br><small style="color:var(--text-muted);">${esc(r.posAlias)}</small>` : ''}</td>
            <td style="padding:10px 8px;"><span style="font-size:11px;color:${stationColor[station]};border:1px solid ${stationColor[station]};padding:2px 7px;border-radius:8px;">${station}</span></td>
            <td style="padding:10px 8px;"><span style="font-size:11px;color:var(--text-muted);border:1px solid var(--border);padding:2px 7px;border-radius:8px;">${r.type}</span></td>
            <td style="padding:10px 8px;font-weight:bold;color:var(--brand-accent);font-size:13px;">$${Number(r.cost || 0).toFixed(2)}</td>
            <td style="padding:10px 8px;font-size:13px;">${r.type === 'Menu' ? '$' + Number(r.price || 0).toFixed(2) : '<span style="color:var(--text-muted);font-size:11px;">' + (r.yieldQty || '') + ' ' + esc(r.yieldUnit || '') + '</span>'}</td>
            <td style="padding:10px 8px;font-weight:bold;font-size:14px;color:${gpColor};">${r.type === 'Menu' && r.price > 0 ? (r.gp || 0) + '%' : '—'}</td>
            <td style="padding:10px 8px;font-size:12px;"><span style="color:${linkColor};">${linked}/${total}</span><div style="width:50px;height:4px;background:var(--border);border-radius:2px;margin-top:3px;"><div style="width:${linkPct}%;height:100%;background:${linkColor};border-radius:2px;"></div></div>${qfCount>0?`<div style="font-size:10px;color:var(--orange);font-weight:bold;margin-top:2px;">🔧 fix ${qfCount}</div>`:''}</td>
            <td style="padding:10px 8px;"><span style="font-size:11px;font-weight:bold;color:${statusColor};">${status}</span></td>
            <td style="padding:10px 8px;white-space:nowrap;" onclick="event.stopPropagation();">
                <button onclick="window.editRecipeForm('${r.id}')" class="btn btn-outline" style="font-size:11px;padding:4px 8px;" title="Edit">✏️</button>
                <button onclick="window.duplicateRecipe('${r.id}')" class="btn btn-outline" style="font-size:11px;padding:4px 8px;" title="Duplicate">📋</button>
                <button onclick="var rc=window.recipes.find(x=>x.id==='${r.id}');if(rc){rc.status=rc.status==='Off Menu'?'Active':'Off Menu';window.saveToDisk();window.showView('recipes');}" class="btn btn-outline" style="font-size:11px;padding:4px 8px;${status === 'Off Menu' ? 'border-color:var(--green);color:var(--green);' : 'border-color:var(--red);color:var(--red);'}" title="${status === 'Off Menu' ? 'Put back on menu' : 'Take off menu'}">${status === 'Off Menu' ? '✅' : '🚫'}</button>
            </td>
        </tr>`;
    }).join('');

    const tableHtml = `<div class="card" style="padding:0;overflow:hidden;">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">
                <th style="padding:10px 12px;text-align:left;cursor:pointer;" onclick="${sortClick('name')}">Name${sortArrow('name')}</th>
                <th style="padding:10px 8px;text-align:left;cursor:pointer;" onclick="${sortClick('station')}">Station${sortArrow('station')}</th>
                <th style="padding:10px 8px;text-align:left;cursor:pointer;" onclick="${sortClick('type')}">Type${sortArrow('type')}</th>
                <th style="padding:10px 8px;text-align:left;cursor:pointer;" onclick="${sortClick('cost')}">Cost${sortArrow('cost')}</th>
                <th style="padding:10px 8px;text-align:left;cursor:pointer;" onclick="${sortClick('sell')}">Sell/Yield${sortArrow('sell')}</th>
                <th style="padding:10px 8px;text-align:left;cursor:pointer;" onclick="${sortClick('gp')}">GP%${sortArrow('gp')}</th>
                <th style="padding:10px 8px;text-align:left;cursor:pointer;" onclick="${sortClick('linked')}">Linked${sortArrow('linked')}</th>
                <th style="padding:10px 8px;text-align:left;">Status</th>
                <th style="padding:10px 8px;text-align:right;">Actions</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
        </table>
        </div>
    </div>`;

    return `
    <div style="max-width:1200px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <div><h2 style="margin:0">⚖️ Recipe Engine <span style="font-size:14px;color:var(--text-muted);font-weight:normal;">(${filtered.length} shown)</span></h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Create and manage recipes to track food costs and GP%</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${viewToggle}
                <button onclick="window.showView('sell-price-editor')" class="btn btn-outline" style="border-color:var(--green);color:var(--green);font-size:12px;">💰 Sell Prices</button>
                <button onclick="window.showView('bulk-category-editor')" class="btn btn-outline" style="border-color:var(--blue);color:var(--blue);font-size:12px;">🏷️ Categories</button>
                <button onclick="window.showView('pos-alias-editor')" class="btn btn-outline" style="border-color:var(--orange);color:var(--orange);font-size:12px;">🔗 POS Aliases</button>
                <button onclick="window._recalcAllWithToast()" class="btn btn-outline" style="border-color:var(--green);color:var(--green);font-size:12px;" title="Recalculate all recipe costs from current inventory prices and yields">🔄 Recalc Costs</button>
                <button onclick="window.openCostingReport()" class="btn btn-outline" style="border-color:var(--purple);color:var(--purple);font-size:12px;">📊 Costing Report</button>
                <button onclick="window.exportRecipeBook()" class="btn btn-outline" style="font-size:12px;">📖 Recipe Book</button>
                <button onclick="window.showView('batch-linker')" class="btn btn-outline" style="font-size:12px;">🔗 Link Ingredients</button>
                ${qtyFixCount>0?`<button onclick="window.showView('batch-qty-fix')" class="btn btn-outline" style="border-color:var(--orange);color:var(--orange);font-size:12px;">🔧 Batch Qty Fix (${totalQtyFixIngs})</button>`:''}
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
        ${viewMode === 'table' ? tableHtml : `<div id="rec-list-container" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px;">${gridHtml}</div>`}
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
        const name = inv?E(inv.recipeName||inv.name):batch?E(batch.name):E(ing.name||'Unknown');
        const qty = ing.qty||'';
        const unit = inv?(inv.useUnit||''):batch?(batch.yieldUnit||''):'';
        const cost = (inv||batch)?window._ingCost(ing).toFixed(2):'—';
        const source = ing.type==='inv'?'Inventory':ing.type==='batch'?'Batch':'<span style="color:var(--orange);">Unlinked</span>';
        const needsQtyFix = ing.type==='inv'&&ing.qty===1&&ing._rawName&&!ing._qtyConfirmed;
        const qtyConfirmed = ing.type==='inv'&&ing.qty===1&&ing._rawName&&ing._qtyConfirmed;
        return `<tr style="border-bottom:1px solid var(--border);${needsQtyFix?'background:rgba(255,165,0,0.08);':''}"><td style="padding:8px 12px;font-size:13px;">${name}${needsQtyFix?`<div style="font-size:10px;color:var(--orange);margin-top:2px;">raw: ${E(ing._rawName)}</div>`:''}</td><td style="padding:8px 12px;font-size:13px;text-align:center;${needsQtyFix?'color:var(--orange);font-weight:bold;':''}">${qty}${needsQtyFix?' ⚠️':''}${qtyConfirmed?' <span style="color:var(--green);font-size:10px;" title="Confirmed correct">✓</span>':''}</td><td style="padding:8px 12px;font-size:13px;text-align:center;">${E(unit)}</td><td style="padding:8px 12px;font-size:13px;text-align:right;">$${cost}</td><td style="padding:8px 12px;font-size:11px;color:var(--text-muted);">${source}</td></tr>`;
    }).join('');
    const qtyFixIngs = (r.ingredients||[]).filter(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed);

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
    const _isYouTube = (u) => u && (u.toLowerCase().includes('youtube.com') || u.toLowerCase().includes('youtu.be'));
    const _embedUrl = (u) => window.safeUrl(u.replace('watch?v=','embed/').replace('youtu.be/','youtube.com/embed/'));
    if (r.photo && r.videoUrl && _isYouTube(r.videoUrl)) {
        mediaHtml = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;"><img src="${r.photo}" style="width:100%;max-height:250px;object-fit:cover;border-radius:8px;"><div style="position:relative;padding-bottom:56.25%;height:0;border-radius:8px;overflow:hidden;"><iframe src="${_embedUrl(r.videoUrl)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div></div>`;
    } else if (r.photo && r.videoUrl) {
        mediaHtml = `<div style="margin-bottom:20px;"><img src="${r.photo}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:8px;"><a href="${window.safeUrl(r.videoUrl)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:13px;">🎥 Watch video ↗</a></div>`;
    } else if (r.photo) {
        mediaHtml = `<img src="${r.photo}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:20px;">`;
    } else if (r.videoUrl && _isYouTube(r.videoUrl)) {
        mediaHtml = `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:8px;overflow:hidden;margin-bottom:20px;"><iframe src="${_embedUrl(r.videoUrl)}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allowfullscreen></iframe></div>`;
    } else if (r.videoUrl) {
        mediaHtml = `<div style="margin-bottom:20px;"><a href="${window.safeUrl(r.videoUrl)}" target="_blank" rel="noopener" style="color:var(--blue);font-size:13px;">🎥 Watch video ↗</a></div>`;
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
                ${r.createdAt||r.modifiedAt?`<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${r.createdAt?'Created: '+new Date(r.createdAt).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}):''}${r.createdAt&&r.modifiedAt?' · ':''}${r.modifiedAt?'Edited: '+new Date(r.modifiedAt).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})+'':''}</div>`:''}
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
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h3 style="margin:0;color:var(--brand-accent);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Ingredients</h3>
                ${qtyFixIngs.length>0?`<button onclick="window.openQtyFixModal('${r.id}')" class="btn btn-outline" style="font-size:11px;border-color:var(--orange);color:var(--orange);padding:4px 10px;">🔧 Fix Quantities (${qtyFixIngs.length})</button>`:''}
            </div>
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
            batch.cost = window._recipeCost(batch); updatedBatches++;
        }
    });
    const updatedBatchIds = batchRecipes.filter(b => (b.ingredients||[]).some(ing=>ing.type==='inv'&&changedInvIds.includes(ing.ref))).map(b=>b.id);
    const gpAlerts = [];
    (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived).forEach(menu => {
        if ((menu.ingredients||[]).some(ing=>(ing.type==='inv'&&changedInvIds.includes(ing.ref))||(ing.type==='batch'&&updatedBatchIds.includes(ing.ref)))) {
            window._recalcRecipe(menu);
            if (menu.price>0 && menu.gp<GP_TARGET) gpAlerts.push({name:menu.name,gp:menu.gp,cost:menu.cost.toFixed(2)});
            updatedMenus++;
        }
    });
    if (updatedBatches>0||updatedMenus>0) window.saveToDisk();
    return { updatedBatches, updatedMenus, gpAlerts };
};

// Recalculate costs for ALL recipes (batches first, then menus)
window.recalcAllCosts = () => {
    let count = 0;
    (window.recipes||[]).filter(r => r.type === 'Batch').forEach(r => {
        r.cost = window._recipeCost(r);
        count++;
    });
    (window.recipes||[]).filter(r => r.type === 'Menu').forEach(r => {
        window._recalcRecipe(r);
        count++;
    });
    window.saveToDisk();
    return count;
};

// UI wrapper for recalcAllCosts — shows toast and refreshes view
window._recalcAllWithToast = () => {
    const count = window.recalcAllCosts();
    window.showToast('✅ ' + count + ' recipe costs recalculated from current inventory.');
    window.showView('recipes');
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
    const _vName = window._getVenueName();
    win.document.write('<h1>📊 Recipe Costing Report — '+_vName+'</h1><div class="meta">GP Target: '+GP_TARGET+'% · Generated '+new Date().toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})+'</div>');
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
        if (inv) return `<li>${ing.qty} ${esc(inv.useUnit)} — ${esc(inv.recipeName||inv.name)}</li>`;
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
    <div style="margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">${window._getVenueName()} · Hobart Hub · Printed ${new Date().toLocaleDateString('en-AU')}</div>
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
              price:0, yieldQty:1, yieldUnit:'Portion', method:'', ingredients:[], allergens:[], cost:0, gp:0, photo:'', videoUrl:'',
              createdAt: new Date().toISOString(), modifiedAt: null };
    }
    if (!window.tempRecipeId || window.tempRecipeId !== cleanId) {
        window.tempIngs = JSON.parse(JSON.stringify(r.ingredients||[]));
        window.tempRecipeId = cleanId||'new';
    }
    let invOpts = (window.inventoryItems||[]).filter(i=>!i.archived).map(inv=>`<option value="inv_${inv.id}">${esc(inv.recipeName||inv.name)} (per ${esc(inv.useUnit||'Unit')})</option>`).join('');
    let batchOpts = (window.recipes||[]).filter(b=>b.type==='Batch'&&b.id!==cleanId).map(b=>`<option value="batch_${b.id}">[Batch] ${esc(b.name)} (per ${esc(b.yieldUnit)})</option>`).join('');

    const renderBuilder = () => {
        let totalCost = 0;
        let ingHtml = window.tempIngs.map((ing,tIdx) => {
            let itemCost=0,displayUnit=ing.unit||'',isErr=false;
            if (ing.type==='inv'){const inv=window.inventoryItems.find(i=>i.id===ing.ref);if(inv){itemCost=ing.qty*((inv.price||0)/(inv.yield||1));displayUnit=inv.useUnit;ing._displayName=inv.recipeName||inv.name;}else{isErr=true;}}
            else if (ing.type==='batch'){const b=window.recipes.find(x=>x.id===ing.ref);if(b){itemCost=ing.qty*((b.cost||0)/(b.yieldQty||1));displayUnit=b.yieldUnit;}else{isErr=true;}}
            totalCost+=itemCost;
            const isRaw=ing.type==='raw';
            return `<div style="display:flex;justify-content:space-between;font-size:13px;padding:9px 0;border-bottom:1px solid var(--border);align-items:center;gap:6px;">
                <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
                    ${isRaw?`<span style="font-size:10px;color:var(--orange);border:1px solid var(--orange);padding:1px 5px;border-radius:8px;flex-shrink:0;cursor:pointer;" onclick="window._openManualLinkModal(${tIdx})" title="Click to link to inventory">raw</span>`:`<input type="number" step="0.001" class="input-box" value="${ing.qty}" onchange="window.updateIngQty(${tIdx},this.value)" style="width:65px;margin:0;padding:4px;border-color:var(--blue);flex-shrink:0;">`}
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;"><span style="color:var(--text-muted);">${esc(displayUnit)} </span><strong style="color:${isErr?'var(--red)':isRaw?'var(--text-muted)':'var(--text-main)'};">${esc(ing._displayName||ing.name)}${isErr?' ⚠️':''}</strong></span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    ${isRaw?`<button onclick="window._openManualLinkModal(${tIdx})" class="btn btn-outline" style="font-size:10px;padding:2px 6px;border-color:var(--blue);color:var(--blue);" title="Link to inventory item">🔗</button>`:''}
                    ${!isRaw&&itemCost>0?`<span style="color:var(--brand-accent);font-size:11px;">$${itemCost.toFixed(3)}</span>`:''}
                    <span style="display:flex;flex-direction:column;gap:0;">
                        <button onclick="window.moveIngUp(${tIdx})" style="border:none;background:none;cursor:pointer;font-size:9px;padding:0;line-height:1;color:var(--text-muted);${tIdx===0?'opacity:0.25;pointer-events:none;':''}" title="Move up">▲</button>
                        <button onclick="window.moveIngDown(${tIdx})" style="border:none;background:none;cursor:pointer;font-size:9px;padding:0;line-height:1;color:var(--text-muted);${tIdx===window.tempIngs.length-1?'opacity:0.25;pointer-events:none;':''}" title="Move down">▼</button>
                    </span>
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
                    <div><label style="font-size:11px;color:var(--text-muted);">Status</label><select id="r-status" class="input-box" style="margin:0;"><option ${(r.status||'Active')==='Active'?'selected':''}>Active</option><option ${r.status==='Off Menu'?'selected':''}>Off Menu</option><option ${r.status==='Development'?'selected':''}>Development</option></select></div>
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
    
    const invItems = (window.inventoryItems||[]).filter(i => !i.archived && (!q || (i.recipeName||i.name).toLowerCase().includes(q) || i.name.toLowerCase().includes(q)));
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
            var safeName = (inv.recipeName||inv.name).replace(/'/g, '');
            html += '<div class="search-dropdown-item" data-val="inv_' + inv.id + '" data-name="' + safeName + '" onclick="window._selectIngFromSearch(this.dataset.val, this.dataset.name)"><span>' + esc(inv.recipeName||inv.name) + '</span><small style="color:var(--blue);">per ' + (inv.useUnit||'Unit') + '</small></div>';
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
        window.openModal('📏 Scale Recipe', `
            <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">Multiply all ingredient quantities. Use 2 to double, 0.5 to halve.</p>
            <input type="number" id="_scale-val" class="input-box" value="2" step="0.1" min="0.1" style="font-size:16px;padding:10px;margin:0 0 16px;">
            <div style="display:flex;gap:10px;">
                <button onclick="window._applyScale()" class="btn btn-green" style="flex:1;padding:10px;">Scale</button>
                <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Cancel</button>
            </div>`);
    };
    window._applyScale = () => {
        const mult=parseFloat(document.getElementById('_scale-val').value);
        if (!mult||isNaN(mult)) return window.showToast('Invalid multiplier.','error');
        window.tempIngs.forEach(ing=>{if(ing.qty)ing.qty=parseFloat((ing.qty*mult).toFixed(3));});
        if (document.getElementById('r-yq')) document.getElementById('r-yq').value=(parseFloat(document.getElementById('r-yq').value)*mult).toFixed(2);
        window.closeModal(); window.refreshRB(); window.showToast('Scaled by ' + mult + 'x');
    };
    window.updateIngQty = (idx,val) => { window.tempIngs[idx].qty=parseFloat(val)||0; window.refreshRB(); };
    window.rmIng = (tIdx) => { window.tempIngs.splice(tIdx,1); window.refreshRB(); };
    window.moveIngUp = (idx) => { if(idx<=0)return; const a=window.tempIngs; [a[idx-1],a[idx]]=[a[idx],a[idx-1]]; window.refreshRB(); };
    window.moveIngDown = (idx) => { const a=window.tempIngs; if(idx>=a.length-1)return; [a[idx],a[idx+1]]=[a[idx+1],a[idx]]; window.refreshRB(); };
    window.addIng = () => {
        const qty=parseFloat(document.getElementById('add-qty').value); const selVal=document.getElementById('add-sel').value;
        if (!qty||!selVal) return window.showToast("Select item and enter quantity.","error");
        const parts=selVal.split('_'); const type=parts[0]; const refId=selVal.replace(type+'_','');
        // Duplicate detection
        const existing = window.tempIngs.find(i => i.type===type && i.ref===refId);
        if (existing) {
            const displayName = type==='inv' ? (window.inventoryItems.find(i=>i.id===refId)||{}).recipeName||existing.name : existing.name;
            window.confirmAction({
                title: '⚠️ Duplicate Ingredient',
                message: `"${displayName}" is already in this recipe (qty: ${existing.qty}). What would you like to do?`,
                confirmLabel: 'Update Existing Qty', confirmColor: 'var(--blue)', tier: 'standard',
                onConfirm: () => { existing.qty += qty; window.closeModal(); window.refreshRB(); window.showToast('Updated qty to ' + existing.qty); },
                cancelLabel: 'Add Anyway',
                onCancel: () => { window._addIngDirect(type, refId, qty); window.closeModal(); }
            });
            return;
        }
        window._addIngDirect(type, refId, qty);
    };
    window._addIngDirect = (type, refId, qty) => {
        if (type==='inv'){const inv=window.inventoryItems.find(i=>i.id===refId);if(!inv)return;window.tempIngs.push({type:'inv',ref:refId,qty,unit:inv.useUnit||'Unit',name:inv.recipeName||inv.name});}
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
            <div><label style="font-size:11px;color:var(--blue);font-weight:bold;">Yield</label><input type="number" step="0.01" min="0.01" id="iv-yield" class="input-box" value="1"></div>
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
        gp: 0,
        createdAt: oldRecipe.createdAt || new Date().toISOString(),
        modifiedAt: new Date().toISOString()
    };
    if (type==='Menu'&&obj.price>0) obj.gp=parseFloat(((obj.price-totalCost)/obj.price*100).toFixed(1));
    if (existingIdx>=0) window.recipes[existingIdx]=obj; else window.recipes.push(obj);
    window.tempRecipeId=null; window.saveToDisk(); window.showToast("Recipe saved!"); window.showView('recipes');
};

window.openQtyFixModal = (recipeId) => {
    const r = window.recipes.find(x=>x.id===recipeId);
    if (!r) return;
    const fixIngs = (r.ingredients||[]).map((ing,idx)=>({...ing,idx})).filter(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed);
    if (!fixIngs.length) return window.showToast('No quantities to fix!');
    const rows = fixIngs.map(ing => {
        const inv = window.inventoryItems.find(i=>i.id===ing.ref);
        const displayName = inv?(inv.recipeName||inv.name):ing.name;
        const unit = inv?(inv.useUnit||''):'';
        const invPrice = inv?(inv.price||0):0;
        const invYield = inv?(inv.yield||1):1;
        const unitCost = invPrice/invYield;
        return `<div style="display:grid;grid-template-columns:1fr 80px auto;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
            <div>
                <div style="font-size:13px;font-weight:600;">${esc(displayName)}</div>
                <div style="font-size:11px;color:var(--text-muted);">raw: "${esc(ing._rawName)}"</div>
                <div style="font-size:11px;color:var(--blue);">Unit: ${esc(unit)}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <input type="number" step="0.001" min="0" class="input-box qtyfix-input" data-idx="${ing.idx}" data-inv-price="${invPrice}" data-inv-yield="${invYield}" value="1" style="margin:0;padding:6px;text-align:center;border-color:var(--orange);font-weight:bold;" oninput="window._qtyFixCostPreview(this)">
                <span class="qf-cost" style="font-size:10px;color:var(--brand-accent);">$${unitCost.toFixed(3)}</span>
            </div>
            <button onclick="window._confirmQty('${recipeId}',${ing.idx})" class="btn btn-outline" style="font-size:10px;padding:4px 8px;border-color:var(--green);color:var(--green);white-space:nowrap;" title="Confirm qty=1 is correct">✓ OK</button>
        </div>`;
    }).join('');
    window.openModal('🔧 Fix Ingredient Quantities', `
        <p style="margin:0 0 10px;font-size:13px;color:var(--text-muted);">Recipe: <strong>${esc(r.name)}</strong><br>These ${fixIngs.length} ingredients defaulted to qty=1 during AI import. Enter the correct quantities.</p>
        <div style="max-height:400px;overflow-y:auto;">${rows}</div>
        <div style="display:flex;gap:10px;margin-top:15px;">
            <button onclick="window._saveQtyFixes('${recipeId}')" class="btn btn-green" style="flex:1;padding:10px;">Save All</button>
            <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Cancel</button>
        </div>`);
};
window._saveQtyFixes = (recipeId) => {
    const r = window.recipes.find(x=>x.id===recipeId);
    if (!r) return;
    let changed = 0;
    document.querySelectorAll('.qtyfix-input').forEach(input => {
        const idx = parseInt(input.dataset.idx);
        const newQty = parseFloat(input.value);
        if (!isNaN(newQty) && newQty > 0 && r.ingredients[idx]) {
            r.ingredients[idx].qty = newQty;
            changed++;
        }
    });
    // Recalculate recipe cost
    let cost = 0;
    (r.ingredients||[]).forEach(ing => {
        if (ing.type==='inv'){const inv=(window.inventoryItems||[]).find(i=>i.id===ing.ref);if(inv)cost+=ing.qty*((inv.price||0)/(inv.yield||1));}
        else if (ing.type==='batch'){const b=(window.recipes||[]).find(x=>x.id===ing.ref);if(b)cost+=ing.qty*((b.cost||0)/(b.yieldQty||1));}
    });
    r.cost = cost;
    if (r.type==='Menu'&&r.price>0) r.gp=parseFloat(((r.price-cost)/r.price*100).toFixed(1));
    window.saveToDisk();
    window.closeModal();
    window.showToast(`${changed} quantities updated!`);
    window.viewRecipe(recipeId);
};

// =============================================================================
// BATCH QTY FIX VIEW — Cross-recipe bulk quantity review
// =============================================================================
window._batchQtyFixPage = 0;
window.renderBatchQtyFixView = () => {
    const PAGE_SIZE = 25;
    const allFixes = [];
    (window.recipes||[]).filter(r=>!r.archived).forEach(r => {
        (r.ingredients||[]).forEach((ing,idx) => {
            if (ing.type==='inv'&&ing.qty===1&&ing._rawName&&!ing._qtyConfirmed) {
                const inv = (window.inventoryItems||[]).find(i=>i.id===ing.ref);
                allFixes.push({ recipeId:r.id, recipeName:r.name, ingIdx:idx, ing, inv });
            }
        });
    });
    const total = allFixes.length;
    const maxPage = Math.max(0, Math.ceil(total/PAGE_SIZE)-1);
    if (window._batchQtyFixPage > maxPage) window._batchQtyFixPage = maxPage;
    const page = window._batchQtyFixPage;
    const pageItems = allFixes.slice(page*PAGE_SIZE, (page+1)*PAGE_SIZE);

    let rowsHtml = pageItems.length===0
        ? '<div style="text-align:center;padding:40px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:10px;">✅</div><div style="font-size:15px;font-weight:600;color:var(--green);">All quantities fixed!</div><div style="font-size:13px;margin-top:6px;">No more ingredients need attention.</div></div>'
        : pageItems.map((item,i) => {
            const displayName = item.inv?(item.inv.recipeName||item.inv.name):item.ing.name;
            const unit = item.inv?(item.inv.useUnit||''):'';
            const tabIdx = i+1;
            return `<div style="display:grid;grid-template-columns:1.5fr 1fr 80px auto;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);${i%2===0?'background:rgba(255,255,255,0.01);':''}">
                <div>
                    <div style="font-size:12px;font-weight:600;">${esc(displayName)}</div>
                    <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">raw: "${esc(item.ing._rawName)}"</div>
                </div>
                <div>
                    <div style="font-size:11px;color:var(--blue);cursor:pointer;" onclick="window.viewRecipe('${item.recipeId}')">${esc(item.recipeName)}</div>
                    <div style="font-size:10px;color:var(--text-muted);">Unit: ${esc(unit)}</div>
                </div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                    <input type="number" step="0.001" min="0" class="input-box bqf-input" tabindex="${tabIdx}" data-recipe-id="${item.recipeId}" data-ing-idx="${item.ingIdx}" data-inv-price="${item.inv?(item.inv.price||0):0}" data-inv-yield="${item.inv?(item.inv.yield||1):1}" value="1" style="margin:0;padding:6px;text-align:center;border-color:var(--orange);font-weight:bold;" oninput="window._bqfCostPreview(this)">
                    <span class="bqf-cost" style="font-size:10px;color:var(--brand-accent);">$${item.inv?((item.inv.price||0)/(item.inv.yield||1)).toFixed(3):'0.000'}</span>
                </div>
                <button onclick="window._confirmQty('${item.recipeId}',${item.ingIdx});window.showView('batch-qty-fix');" class="btn btn-outline" style="font-size:10px;padding:4px 8px;border-color:var(--green);color:var(--green);white-space:nowrap;" title="Confirm qty=1 is correct">✓ OK</button>
            </div>`;
        }).join('');

    const pageInfo = total > 0 ? `Page ${page+1} of ${maxPage+1} · Showing ${pageItems.length} of ${total} remaining` : '';
    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <div>
                <button onclick="window._batchQtyFixPage=0;window.showView('recipes')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;margin-bottom:6px;">← Back to Recipes</button>
                <h2 style="margin:0;">🔧 Batch Qty Fix</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:4px;">${total} ingredients need quantity review across ${(window.recipes||[]).filter(r=>!r.archived&&(r.ingredients||[]).some(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed)).length} recipes</div>
            </div>
            <div style="display:flex;gap:8px;">
                ${total>0?`<button onclick="window._autoReparse()" class="btn btn-outline" style="font-size:12px;padding:8px 14px;border-color:var(--purple);color:var(--purple);" title="Run improved parser on all _rawName values to auto-fix quantities">🤖 Auto-Parse</button>`:''}
                ${total>0?`<button onclick="window._saveBatchQtyFixes()" class="btn btn-green" style="font-size:13px;padding:8px 20px;">Save Page</button>`:''}
            </div>
        </div>
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="display:grid;grid-template-columns:1.5fr 1fr 80px auto;gap:8px;padding:10px 12px;background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">
                <div>Ingredient</div><div>Recipe / Unit</div><div style="text-align:center;">Qty</div><div>Action</div>
            </div>
            ${rowsHtml}
        </div>
        ${total>PAGE_SIZE?`<div style="display:flex;justify-content:center;gap:10px;margin-top:15px;align-items:center;">
            <button onclick="window._batchQtyFixPage=Math.max(0,window._batchQtyFixPage-1);window.showView('batch-qty-fix')" class="btn btn-outline" style="font-size:12px;" ${page===0?'disabled':''}>← Previous</button>
            <span style="font-size:12px;color:var(--text-muted);">${pageInfo}</span>
            <button onclick="window._batchQtyFixPage=Math.min(${maxPage},window._batchQtyFixPage+1);window.showView('batch-qty-fix')" class="btn btn-outline" style="font-size:12px;" ${page>=maxPage?'disabled':''}>Next →</button>
        </div>`:`<div style="text-align:center;margin-top:10px;font-size:12px;color:var(--text-muted);">${pageInfo}</div>`}
    </div>`;
};
window._saveBatchQtyFixes = () => {
    let changed = 0;
    document.querySelectorAll('.bqf-input').forEach(input => {
        const recipeId = input.dataset.recipeId;
        const ingIdx = parseInt(input.dataset.ingIdx);
        const newQty = parseFloat(input.value);
        if (isNaN(newQty) || newQty <= 0) return;
        const r = window.recipes.find(x=>x.id===recipeId);
        if (!r || !r.ingredients[ingIdx]) return;
        if (newQty !== 1) {
            r.ingredients[ingIdx].qty = newQty;
            changed++;
        }
    });
    if (changed > 0) { window.recalcAllCosts(); }
    window.saveToDisk();
    window.showToast(changed + ' quantities updated!');
    window.showView('batch-qty-fix');
};

// =============================================================================
// COST IMPACT PREVIEW — Live cost display as qty changes
// =============================================================================
window._bqfCostPreview = (input) => {
    const qty = parseFloat(input.value) || 0;
    const price = parseFloat(input.dataset.invPrice) || 0;
    const yld = parseFloat(input.dataset.invYield) || 1;
    const cost = qty * (price / yld);
    const costEl = input.parentElement.querySelector('.bqf-cost');
    if (costEl) costEl.textContent = '$' + cost.toFixed(3);
};
window._qtyFixCostPreview = (input) => {
    const qty = parseFloat(input.value) || 0;
    const price = parseFloat(input.dataset.invPrice) || 0;
    const yld = parseFloat(input.dataset.invYield) || 1;
    const cost = qty * (price / yld);
    const costEl = input.parentElement.querySelector('.qf-cost');
    if (costEl) costEl.textContent = '$' + cost.toFixed(3);
};

// =============================================================================
// AUTO RE-PARSE — Run improved parser on all _rawName ingredients
// =============================================================================
window._autoReparse = () => {
    const changes = [];
    let skipped = 0;
    (window.recipes||[]).filter(r=>!r.archived).forEach(r => {
        (r.ingredients||[]).forEach(ing => {
            if (ing.type!=='inv' || ing.qty!==1 || !ing._rawName || ing._qtyConfirmed) return;
            const parsed = window._parseIngredientLine(ing._rawName);
            if (parsed.qty && parsed.qty !== 1) {
                changes.push({ recipe: r.name, recipeId: r.id, rawName: ing._rawName, newQty: parsed.qty, newUnit: parsed.unit || '', ing });
            } else {
                skipped++;
            }
        });
    });
    if (changes.length === 0) {
        window.showToast(`🤖 No quantities could be auto-fixed. ${skipped} still need manual review.`);
        return;
    }
    const rows = changes.slice(0, 30).map(c =>
        `<tr style="border-bottom:1px solid var(--border);font-size:12px;">
            <td style="padding:6px 8px;color:var(--blue);">${esc(c.recipe)}</td>
            <td style="padding:6px 8px;color:var(--text-muted);">${esc(c.rawName)}</td>
            <td style="padding:6px 8px;text-align:center;">1</td>
            <td style="padding:6px 8px;text-align:center;font-weight:bold;color:var(--green);">${c.newQty}${c.newUnit?' '+esc(c.newUnit):''}</td>
        </tr>`
    ).join('');
    window.openModal('🤖 Auto-Parse Preview', `
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 10px;">Found <strong style="color:var(--green);">${changes.length}</strong> quantities that can be fixed. ${skipped} still need manual review.${changes.length>30?'<br>Showing first 30:':''}</p>
        <div style="max-height:350px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr style="font-size:10px;color:var(--text-muted);text-transform:uppercase;border-bottom:2px solid var(--border);">
                    <th style="padding:6px 8px;text-align:left;">Recipe</th><th style="padding:6px 8px;text-align:left;">Raw Text</th><th style="padding:6px 8px;text-align:center;">Old</th><th style="padding:6px 8px;text-align:center;">New</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div style="display:flex;gap:10px;margin-top:15px;">
            <button onclick="window._applyAutoReparse()" class="btn btn-green" style="flex:1;padding:10px;">✅ Apply All ${changes.length} Changes</button>
            <button onclick="window.closeModal()" class="btn btn-outline" style="flex:1;padding:10px;">Cancel</button>
        </div>
    `);
    // Store changes for apply
    window._pendingReparse = changes;
};

window._applyAutoReparse = () => {
    const changes = window._pendingReparse || [];
    changes.forEach(c => {
        c.ing.qty = c.newQty;
        if (c.newUnit) c.ing.unit = c.newUnit;
    });
    window.recalcAllCosts();
    window.saveToDisk();
    window._pendingReparse = null;
    window.closeModal();
    window.showToast(`🤖 ${changes.length} quantities updated!`);
    window.showView('batch-qty-fix');
};

window._confirmQty = (recipeId, ingIdx) => {
    const r = window.recipes.find(x=>x.id===recipeId);
    if (!r || !r.ingredients[ingIdx]) return;
    r.ingredients[ingIdx]._qtyConfirmed = true;
    window.saveToDisk();
    window.showToast('Qty confirmed as correct.');
    // Re-render the modal with updated list (will exclude confirmed item)
    const remaining = (r.ingredients||[]).filter(i=>i.type==='inv'&&i.qty===1&&i._rawName&&!i._qtyConfirmed);
    if (remaining.length > 0) { window.openQtyFixModal(recipeId); }
    else { window.closeModal(); window.viewRecipe(recipeId); }
};

// =============================================================================
// MANUAL INGREDIENT LINKING — Link raw ingredient to inventory from recipe editor
// =============================================================================
window._openManualLinkModal = (tIdx) => {
    const ing = window.tempIngs[tIdx];
    if (!ing || ing.type !== 'raw') return;
    const parsed = window._parseIngredientLine(ing.name);
    const ingNameLC = (parsed.name||ing.name).toLowerCase();
    const invItems = (window.inventoryItems||[]).filter(i=>!i.archived).sort((a,b)=>(a.recipeName||a.name).localeCompare(b.recipeName||b.name));
    const batchItems = (window.recipes||[]).filter(r=>r.type==='Batch'&&!r.archived).sort((a,b)=>a.name.localeCompare(b.name));
    const searchId = 'ml-search-' + tIdx;
    const selectId = 'ml-select-' + tIdx;
    const qtyId = 'ml-qty-' + tIdx;
    const unitId = 'ml-unit-' + tIdx;

    // Build options with both inventory and batch recipes
    let opts = '';
    if (batchItems.length > 0) {
        opts += `<optgroup label="🍳 Prep Batches (in-house)">`;
        opts += batchItems.map(b => {
            const nameLC = b.name.toLowerCase();
            const isMatch = nameLC.includes(ingNameLC) || ingNameLC.includes(nameLC);
            const costPerUnit = b.yieldQty > 0 ? (b.cost / b.yieldQty) : 0;
            return `<option value="batch_${b.id}" ${isMatch?'selected':''}>[Batch] ${esc(b.name)} (per ${esc(b.yieldUnit||'Unit')}) — $${costPerUnit.toFixed(2)}/unit</option>`;
        }).join('');
        opts += `</optgroup>`;
    }
    // Group inventory by category
    const invCats = [...new Set(invItems.map(i=>i.category||'Other'))].sort();
    let firstMatch = '';
    invCats.forEach(cat => {
        const catItems = invItems.filter(i=>(i.category||'Other')===cat);
        opts += `<optgroup label="📦 ${esc(cat)}">`;
        opts += catItems.map(inv => {
            const displayName = inv.recipeName||inv.name;
            const nameLC = displayName.toLowerCase();
            const isMatch = nameLC.includes(ingNameLC) || ingNameLC.includes(nameLC);
            if (isMatch && !firstMatch) firstMatch = 'inv_' + inv.id;
            return `<option value="inv_${inv.id}" ${isMatch&&!firstMatch?'selected':''}>${esc(displayName)} (per ${esc(inv.useUnit||'Unit')}) — $${(inv.price||0).toFixed(2)}</option>`;
        }).join('');
        opts += `</optgroup>`;
    });

    window.openModal('🔗 Link Ingredient', `
        <div style="margin-bottom:12px;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">Original text:</div>
            <div style="font-size:13px;font-weight:600;color:var(--orange);padding:8px 12px;background:rgba(245,158,11,0.08);border-radius:6px;">${esc(ing.name)}</div>
            ${parsed.qty!==1||parsed.unit?`<div style="font-size:11px;color:var(--blue);margin-top:4px;">Parsed: qty=${parsed.qty}, unit="${parsed.unit}", name="${esc(parsed.name)}"</div>`:''}
        </div>
        <div style="margin-bottom:10px;">
            <label style="font-size:11px;color:var(--text-muted);">Search inventory & batch recipes</label>
            <input type="text" id="${searchId}" class="input-box" placeholder="Type to filter..." style="margin:0 0 6px 0;" oninput="window._filterManualLinkList('${selectId}',this.value)">
            <select id="${selectId}" class="input-box" size="8" style="margin:0;font-size:12px;height:auto;" onchange="window._updateManualLinkUnit('${selectId}','${unitId}')">${opts}</select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
            <div>
                <label style="font-size:11px;color:var(--text-muted);">Quantity</label>
                <input type="number" step="0.001" id="${qtyId}" class="input-box" value="${parsed.qty||1}" style="margin:0;border-color:var(--blue);font-weight:bold;">
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-muted);">Unit</label>
                <input type="text" id="${unitId}" class="input-box" value="${esc(parsed.unit||'')}" style="margin:0;" readonly>
            </div>
        </div>
        <div style="display:flex;gap:10px;">
            <button onclick="window._commitManualLink(${tIdx},'${selectId}','${qtyId}')" class="btn btn-green" style="flex:1;padding:10px;">🔗 Link</button>
            <button onclick="window.closeModal()" class="btn btn-outline" style="flex:1;padding:10px;">Cancel</button>
        </div>
    `);
    // Auto-update unit for initial selection
    setTimeout(() => window._updateManualLinkUnit(selectId, unitId), 50);
};

window._filterManualLinkList = (selectId, query) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const q = query.toLowerCase();
    const invItems = (window.inventoryItems||[]).filter(i=>!i.archived);
    const batchItems = (window.recipes||[]).filter(r=>r.type==='Batch'&&!r.archived);
    const filteredInv = q ? invItems.filter(inv => ((inv.recipeName||inv.name).toLowerCase().includes(q) || inv.name.toLowerCase().includes(q))) : invItems;
    const filteredBatch = q ? batchItems.filter(b => b.name.toLowerCase().includes(q)) : batchItems;
    let html = '';
    if (filteredBatch.length > 0) {
        html += `<optgroup label="🍳 Prep Batches (in-house)">`;
        html += filteredBatch.sort((a,b)=>a.name.localeCompare(b.name))
            .map(b => { const cpu = b.yieldQty>0?(b.cost/b.yieldQty):0; return `<option value="batch_${b.id}">[Batch] ${esc(b.name)} (per ${esc(b.yieldUnit||'Unit')}) — $${cpu.toFixed(2)}/unit</option>`; }).join('');
        html += `</optgroup>`;
    }
    const cats = [...new Set(filteredInv.map(i=>i.category||'Other'))].sort();
    cats.forEach(cat => {
        const catItems = filteredInv.filter(i=>(i.category||'Other')===cat).sort((a,b)=>(a.recipeName||a.name).localeCompare(b.recipeName||b.name));
        html += `<optgroup label="📦 ${esc(cat)}">`;
        html += catItems.map(inv => `<option value="inv_${inv.id}">${esc(inv.recipeName||inv.name)} (per ${esc(inv.useUnit||'Unit')}) — $${(inv.price||0).toFixed(2)}</option>`).join('');
        html += `</optgroup>`;
    });
    sel.innerHTML = html;
};

window._updateManualLinkUnit = (selectId, unitId) => {
    const sel = document.getElementById(selectId);
    const unitEl = document.getElementById(unitId);
    if (!sel || !unitEl || !sel.value) return;
    const val = sel.value;
    if (val.startsWith('batch_')) {
        const b = (window.recipes||[]).find(r=>r.id===val.replace('batch_',''));
        if (b) unitEl.value = b.yieldUnit || 'Unit';
    } else if (val.startsWith('inv_')) {
        const inv = (window.inventoryItems||[]).find(i=>i.id===val.replace('inv_',''));
        if (inv) unitEl.value = inv.useUnit || 'Unit';
    }
};

window._commitManualLink = (tIdx, selectId, qtyId) => {
    const sel = document.getElementById(selectId);
    const qtyEl = document.getElementById(qtyId);
    if (!sel || !sel.value) return window.showToast('Select an item to link.', 'error');
    const qty = parseFloat(qtyEl.value) || 1;
    const oldName = window.tempIngs[tIdx].name;
    const val = sel.value;

    if (val.startsWith('batch_')) {
        const batchId = val.replace('batch_','');
        const b = (window.recipes||[]).find(r=>r.id===batchId);
        if (!b) return window.showToast('Batch recipe not found.', 'error');
        window.tempIngs[tIdx] = {
            type: 'batch', ref: batchId, qty: qty,
            unit: b.yieldUnit || 'unit',
            name: b.name,
            _rawName: oldName
        };
        window.closeModal();
        window.showToast(`✅ Linked to batch: ${b.name}`);
    } else {
        const invId = val.replace('inv_','');
        const inv = (window.inventoryItems||[]).find(i=>i.id===invId);
        if (!inv) return window.showToast('Item not found.', 'error');
        window.tempIngs[tIdx] = {
            type: 'inv', ref: invId, qty: qty,
            unit: inv.useUnit || 'unit',
            name: inv.recipeName || inv.name,
            _rawName: oldName
        };
        window.closeModal();
        window.showToast(`✅ Linked to ${inv.recipeName||inv.name}`);
    }
    window.refreshRB();
};

window.delRecipe = (id) => {
    window.confirmAction({
        title: '⚖️ Delete Recipe',
        message: 'Permanently delete this recipe? This cannot be undone.',
        confirmLabel: 'Delete', tier: 'standard',
        onConfirm: () => { window.recipes=window.recipes.filter(x=>x.id!==id); window.tempRecipeId=null; window.saveToDisk(); window.showToast('Recipe deleted.'); window.showView('recipes'); }
    });
};

