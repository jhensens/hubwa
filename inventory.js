// --- HOBART HUB: Inventory Module ---
// Zones, Suppliers, Live Inventory, PAR Editor, Stock Count, Price History, Archive

// =============================================================================
// OPS.JS — Bar Wa Izakaya | Hobart Hub
// Phase 1: Editable Zones + Invoice Ripper Pro (PDF + Vision) + Inventory
// =============================================================================

// --- INGREDIENT LINE PARSER ---
// Parses raw ingredient text like "45ml Rien Nashi pear liqueur" into {qty, unit, name}
window._parseIngredientLine = (line) => {
    if (!line || typeof line !== 'string') return { qty: 0, unit: '', name: line || '' };
    line = line.trim();
    const knownUnits = /^(ml|g|kg|l|oz|lb|cup|cups|tsp|tbsp|tablespoon|tablespoons|teaspoon|teaspoons|dash|dashes|pinch|bunch|cloves|medium|large|small|slice|slices|piece|pieces|can|cans|bottle|bottles|sprig|sprigs|sheet|sheets|handful)$/i;
    // Try to match: optional qty (number, fraction, or range) + optional unit + rest is name
    // Pattern: (qty_part)? (unit_part)? (name)
    const m = line.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(.*)/);
    if (!m) return { qty: 0, unit: '', name: line };
    let qtyStr = m[1];
    let rest = (m[2] || '').trim();
    // Parse qty: fraction, range, or plain number
    let qty = 0;
    if (qtyStr.includes('/')) {
        const parts = qtyStr.split('/');
        qty = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else if (/\d\s*-\s*\d/.test(qtyStr)) {
        const rangeParts = qtyStr.split(/\s*-\s*/);
        qty = (parseFloat(rangeParts[0]) + parseFloat(rangeParts[1])) / 2;
    } else {
        qty = parseFloat(qtyStr);
    }
    if (isNaN(qty)) qty = 0;
    // Check if rest starts with a unit (with or without space after qty)
    // Also handle unit attached to number like "45ml"
    let unit = '';
    let name = rest;
    // Try splitting first word as unit
    const unitMatch = rest.match(/^([a-zA-Z]+)\b\s*(.*)/);
    if (unitMatch && knownUnits.test(unitMatch[1])) {
        unit = unitMatch[1];
        name = (unitMatch[2] || '').trim();
    }
    // Round qty to avoid floating point noise
    qty = Math.round(qty * 10000) / 10000;
    return { qty, unit, name: name || line };
};

// --- SECURE API KEY MANAGER ---
window.getApiKey = () => {
    let key = localStorage.getItem('geminiApiKey');
    if (!key) {
        window.openModal('🔑 Gemini API Key', `
            <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">Enter your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--blue);">Google AI Studio</a>. This is stored locally on your device only.</p>
            <input type="password" id="_api-key-input" class="input-box" placeholder="Paste your API key..." style="font-size:14px;padding:10px;margin:0 0 16px;">
            <div style="display:flex;gap:10px;">
                <button onclick="var k=document.getElementById('_api-key-input').value.trim();if(k){localStorage.setItem('geminiApiKey',k);window.closeModal();window.showToast('API key saved.');}else{window.showToast('Key cannot be empty.','error');}" class="btn btn-green" style="flex:1;padding:10px;">Save Key</button>
                <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Cancel</button>
            </div>`);
        return null;
    }
    return key;
};
window.resetApiKey = () => { localStorage.removeItem('geminiApiKey'); window.showToast("API Key cleared."); };

// Auto-fix useUnit for bar items — spirits/liqueurs/wine/sake should use ml, not bottle/each
// Excludes miscategorised items (olive oil, ginger beer, cooking sake, vinegar, mirin)
window._isMiscategorisedBev = (name) => /olive oil|vinegar|ginger beer|cooking sake|mirin/i.test(name || '');
window.fixBevUseUnits = () => {
    const mlSubcats = ['Spirits', 'Liqueurs', 'Sake', 'Wine', 'Fortified Wine', 'Vermouth', 'Gin', 'Vodka', 'Whisky', 'Rum', 'Tequila', 'Mezcal'];
    const wrongUnits = ['each', 'bottle', 'per bottle', 'unit', 'btl', 'l'];
    let fixed = 0;
    (window.inventoryItems || []).forEach(i => {
        if (window._isMiscategorisedBev(i.name)) return;
        if (mlSubcats.some(s => (i.subcategory || '').toLowerCase().includes(s.toLowerCase())) && wrongUnits.includes((i.useUnit || '').toLowerCase())) {
            i.useUnit = 'ml';
            fixed++;
        }
    });
    if (fixed > 0) { window.saveToDisk(); window.showToast(fixed + ' beverage items updated to ml.'); }
    return fixed;
};

// Auto-fix yield for bar items — extract bottle size from name, default 700ml spirits / 750ml wine
// Excludes miscategorised items and handles 1.8L sake bottles
window.fixBevYields = () => {
    const mlSubcats = ['Spirits', 'Liqueurs', 'Sake', 'Wine', 'Fortified Wine', 'Vermouth', 'Gin', 'Vodka', 'Whisky', 'Rum', 'Tequila', 'Mezcal'];
    const wineSubcats = ['Wine', 'Fortified Wine', 'Vermouth'];
    let fixed = 0;
    (window.inventoryItems || []).forEach(i => {
        if (window._isMiscategorisedBev(i.name)) return;
        if (!mlSubcats.some(s => (i.subcategory || '').toLowerCase().includes(s.toLowerCase()))) return;
        const name = i.name || '';
        // Check for ml in name first (e.g., "700ml", "720ml", "360ml")
        const mlMatch = name.match(/(\d{3,4})\s*ml/i);
        // Check for litres (e.g., "1.8L", "5L")
        const lMatch = name.match(/([\d.]+)\s*L\b/);
        if (mlMatch) {
            const newYield = parseInt(mlMatch[1]);
            if (i.yield !== newYield) { i.yield = newYield; fixed++; }
        } else if (lMatch) {
            const newYield = Math.round(parseFloat(lMatch[1]) * 1000);
            if (i.yield !== newYield) { i.yield = newYield; fixed++; }
        } else if (!i.yield || i.yield <= 1) {
            const sub = (i.subcategory || '').toLowerCase();
            const isWine = wineSubcats.some(s => sub.includes(s.toLowerCase()));
            const isSake = sub.includes('sake');
            i.yield = isWine ? 750 : isSake ? 720 : 700;
            fixed++;
        }
    });
    if (fixed > 0) { window.saveToDisk(); window.showToast(fixed + ' beverage yields updated.'); }
    return fixed;
};

// Comprehensive yield/unit fix — ALL categories: food, beverage, other
// Parses volume/weight from item names, fixes useUnit mismatches, handles multi-packs
window.fixAllYields = () => {
    let fixed = 0;
    const log = [];
    // Skip non-product items
    const skipNames = /delivery charge|freight|surcharge|credit note/i;

    (window.inventoryItems || []).forEach(i => {
        const name = i.name || '';
        if (skipNames.test(name)) return;
        let u = (i.useUnit || '').toLowerCase();
        const cat = (i.category || '').toLowerCase();
        let changed = false;

        // ── STEP 0: Standardize malformed useUnit values ──
        const unitMap = { 'gr': 'g', 'gram': 'g', 'gm': 'g', 'b': 'bottle' };
        if (unitMap[u]) { i.useUnit = unitMap[u]; u = unitMap[u]; changed = true; }

        // ── STEP 1: Litres in name → ml (all categories) ──
        // Guard: only fix if yield matches the raw litre number or is default (1)
        if (!changed) {
            const m = name.match(/([\d.]+)\s*(?:l|lt|ltr|litre|liter)s?\b/i);
            if (m) {
                const litres = parseFloat(m[1]);
                const mlYield = Math.round(litres * 1000);
                if (litres > 0 && (i.yield <= litres || i.yield === 1)) {
                    log.push(name + ': yield ' + i.yield + '→' + mlYield + 'ml');
                    i.yield = mlYield; i.useUnit = 'ml'; changed = true;
                }
            }
        }

        // ── STEP 2: Kilograms in name → g ──
        // Guard: only fix if yield matches the raw kg number or is default (1)
        if (!changed) {
            const m = name.match(/([\d.]+)\s*kg\b/i);
            if (m) {
                const kg = parseFloat(m[1]);
                const gYield = Math.round(kg * 1000);
                if (kg > 0 && (i.yield <= kg || i.yield === 1)) {
                    log.push(name + ': yield ' + i.yield + '→' + gYield + 'g');
                    i.yield = gYield; i.useUnit = 'g'; changed = true;
                }
            }
        }

        // ── STEP 3: Millilitres in name → ml (standalone items only) ──
        // Guard: only fix if yield is default (1) — don't overwrite pack counts
        if (!changed) {
            const isMultiPack = /[x×]\s*\d+|\d+\s*(pk|pack)\b|\d+\/\d+\s*ml/i.test(name);
            if (!isMultiPack) {
                const m = name.match(/(\d{2,5})\s*ml\b/i);
                if (m) {
                    const ml = parseInt(m[1]);
                    if (ml > 0 && i.yield <= 1) {
                        log.push(name + ': yield ' + i.yield + '→' + ml + 'ml');
                        i.yield = ml; i.useUnit = 'ml'; changed = true;
                    }
                }
            }
        }

        // ── STEP 4: Grams in name → g ──
        // Guard: only fix if yield is default (1) — don't overwrite portion counts
        if (!changed) {
            const m = name.match(/(\d{2,5})\s*(?:gm?|gram)s?\b/i);
            if (m) {
                const g = parseInt(m[1]);
                if (g > 0 && i.yield <= 1) {
                    log.push(name + ': yield ' + i.yield + '→' + g + 'g');
                    i.yield = g; i.useUnit = 'g'; changed = true;
                }
            }
        }

        // ── STEP 5: Multi-pack beverages → yield = pack count ──
        if (!changed && cat === 'beverage') {
            const xMatch = name.match(/[x×]\s*(\d+)\b/i) || name.match(/(\d+)\s*(?:pk|pack)\b/i);
            const slashMatch = !xMatch ? name.match(/(\d+)\/\d+\s*(?:ml|g)/i) : null;
            const packMatch = xMatch || slashMatch;
            if (packMatch) {
                const count = parseInt(packMatch[1]);
                if (count > 1 && i.yield <= 1) {
                    log.push(name + ': yield ' + i.yield + '→' + count + ' (pack)');
                    i.yield = count; changed = true;
                }
            }
        }

        // ── STEP 6: useUnit is litres but yield is raw litres → convert ──
        if (!changed && ['l', 'lt', 'ltr', 'litre', 'liter'].includes(u) && i.yield > 0 && i.yield < 100) {
            log.push(name + ': ' + i.yield + u + '→' + (i.yield * 1000) + 'ml');
            i.yield = Math.round(i.yield * 1000); i.useUnit = 'ml'; changed = true;
        }

        // ── STEP 7: useUnit is kg → convert (or fix beverages with wrong unit) ──
        if (!changed && u === 'kg' && i.yield > 0 && i.yield < 100) {
            if (cat !== 'beverage') {
                log.push(name + ': ' + i.yield + 'kg→' + (i.yield * 1000) + 'g');
                i.yield = Math.round(i.yield * 1000); i.useUnit = 'g'; changed = true;
            } else {
                log.push(name + ': useUnit kg→each (beverage)');
                i.useUnit = 'each'; changed = true;
            }
        }

        if (changed) fixed++;
    });

    if (fixed > 0) window.saveToDisk();
    console.log('fixAllYields log:', log);
    window.showToast(fixed + ' inventory yields fixed.');
    return { fixed, log };
};
};

// Delete all recipes (backs up to localStorage first)
window.deleteAllRecipes = () => {
    const count = (window.recipes || []).length;
    if (count === 0) return window.showToast('No recipes to delete.', 'error');
    try { localStorage.setItem('_recipesBackup', JSON.stringify(window.recipes)); } catch(e) {}
    window.recipes = [];
    window.saveToDisk();
    window.showToast(count + ' recipes deleted. Backup saved to localStorage.');
    return count;
};

// Unlink all inventory-linked ingredients back to raw
window.unlinkAllIngredients = () => {
    let count = 0;
    (window.recipes || []).forEach(r => {
        (r.ingredients || []).forEach((ing, idx) => {
            if (ing.type === 'inv') {
                r.ingredients[idx] = { type: 'raw', name: ing._rawName || ing.name, qty: 0, unit: '' };
                count++;
            }
        });
    });
    if (count > 0) { window.saveToDisk(); window.showToast(count + ' ingredients unlinked.'); }
    return count;
};

// --- STOCK MOVEMENT AUDIT TRAIL ---
window.logStockMovement = function(itemId, qtyChange, source, opts) {
    opts = opts || {};
    var item = (window.inventoryItems || []).find(function(i) { return i.id === itemId; });
    var before = item ? (item.stock || 0) : 0;
    var after = Math.max(0, before + qtyChange);
    window.stockMovements = window.stockMovements || [];
    window.stockMovements.push({
        id: window.generateId('sm'),
        ts: new Date().toISOString(),
        itemId: itemId,
        itemName: item ? item.name : (opts.itemName || 'Unknown'),
        source: source,
        sourceRef: opts.sourceRef || '',
        qtyChange: qtyChange,
        before: before,
        after: after,
        unit: item ? (item.buyUnit || 'unit') : 'unit',
        staff: opts.staff || '',
        notes: opts.notes || ''
    });
};

// --- RECURSIVE BATCH CASCADE HELPER ---
// Expands batch/sub-recipe ingredients to leaf inventory items (multi-level)
// visited Set prevents circular references (batch A -> batch B -> batch A)
window._cascadeBatchIngredients = function(recipeId, multiplier, deductions, visited, recipes) {
    if (visited.has(recipeId)) return; // circular reference guard
    var recipe = recipes.find(function(rc) { return rc.id === recipeId; });
    if (!recipe) return;
    visited.add(recipeId);
    (recipe.ingredients || []).forEach(function(ing) {
        if (ing.type === 'inv') {
            deductions[ing.ref] = (deductions[ing.ref] || 0) + (ing.qty * multiplier);
        } else if (ing.type === 'batch') {
            var batch = recipes.find(function(rc) { return rc.id === ing.ref; });
            if (batch) {
                var batchMultiplier = (ing.qty * multiplier) / (batch.yieldQty || 1);
                window._cascadeBatchIngredients(batch.id, batchMultiplier, deductions, new Set(visited), recipes);
            }
        }
    });
};

// --- SHARED CASCADE DEPLETION ---
// Unified recipe-cascade deduction used by both CSV and AI depletion paths
window.cascadeSalesDeductions = function(salesItems, source) {
    var recipes = window.recipes || [];
    var inventory = window.inventoryItems || [];
    var mappings = window.posMappings || {};
    var deductions = {}; // { invId: useUnitsToDeduct }
    var matched = [], unmatched = [];

    salesItems.forEach(function(item) {
        var rawName = item.rawName;
        var qtySold = item.qtySold || 0;
        var recipeId = null;
        var directInv = null;

        // 1. Check learned posMappings
        if (mappings[rawName]) recipeId = mappings[rawName];
        // 2. Check recipe posAlias
        if (!recipeId) {
            var r = recipes.find(function(rc) { return rc.posAlias && rc.posAlias.toLowerCase() === rawName.toLowerCase(); });
            if (r) recipeId = r.id;
        }
        // 3. Check recipe name
        if (!recipeId) {
            var r2 = recipes.find(function(rc) { return rc.name && rc.name.toLowerCase() === rawName.toLowerCase(); });
            if (r2) recipeId = r2.id;
        }
        // 4. Direct inventory match (fallback)
        if (!recipeId) {
            directInv = inventory.find(function(i) {
                return !i.archived && (
                    i.name.toLowerCase() === rawName.toLowerCase() ||
                    (i.posAlias && i.posAlias.toLowerCase() === rawName.toLowerCase()) ||
                    rawName.toLowerCase().indexOf(i.name.toLowerCase().substring(0, 6)) !== -1
                );
            });
        }

        if (recipeId) {
            // Cascade through recipe ingredients
            var recipe = recipes.find(function(rc) { return rc.id === recipeId; });
            if (recipe) {
                matched.push({ rawName: rawName, matchType: 'recipe', matchName: recipe.name, qtySold: qtySold });
                // Multi-level cascade: recursively expand all batch sub-recipes
                window._cascadeBatchIngredients(recipeId, qtySold, deductions, new Set(), recipes);
            } else { unmatched.push({ rawName: rawName, qtySold: qtySold }); }
        } else if (directInv) {
            // Direct inventory deduction
            var depletion = qtySold * (directInv.yield ? (1 / directInv.yield) : (directInv.useToBy || 1));
            deductions[directInv.id] = (deductions[directInv.id] || 0) + depletion;
            matched.push({ rawName: rawName, matchType: 'inventory', matchName: directInv.name, qtySold: qtySold });
        } else {
            unmatched.push({ rawName: rawName, qtySold: qtySold });
        }
    });

    // Apply deductions
    var deductedCount = 0;
    Object.keys(deductions).forEach(function(invId) {
        var inv = inventory.find(function(i) { return i.id === invId; });
        if (inv) {
            var useUnits = deductions[invId];
            var buyUnits = useUnits / (inv.yield || 1);
            window.logStockMovement(inv.id, -buyUnits, source, { sourceRef: source === 'csv-depletion' ? 'Lightspeed CSV' : 'AI POS Depletion' });
            inv.stock = Math.max(0, (inv.stock || 0) - buyUnits);
            deductedCount++;
        }
    });

    return { deductions: deductions, matched: matched, unmatched: unmatched, deductedCount: deductedCount };
};

// --- READ-ONLY PREVIEW CASCADE (no stock changes) ---
// Used by confirmation UI to show what WOULD happen before committing
window.previewSalesDeductions = function(salesItems) {
    var recipes = window.recipes || [];
    var inventory = window.inventoryItems || [];
    var mappings = window.posMappings || {};
    var deductions = {};
    var matched = [], unmatched = [];

    salesItems.forEach(function(item) {
        var rawName = item.rawName;
        var qtySold = item.qtySold || 0;
        var recipeId = null;
        var directInv = null;

        if (mappings[rawName]) recipeId = mappings[rawName];
        if (!recipeId) {
            var r = recipes.find(function(rc) { return rc.posAlias && rc.posAlias.toLowerCase() === rawName.toLowerCase(); });
            if (r) recipeId = r.id;
        }
        if (!recipeId) {
            var r2 = recipes.find(function(rc) { return rc.name && rc.name.toLowerCase() === rawName.toLowerCase(); });
            if (r2) recipeId = r2.id;
        }
        if (!recipeId) {
            directInv = inventory.find(function(i) {
                return !i.archived && (
                    i.name.toLowerCase() === rawName.toLowerCase() ||
                    (i.posAlias && i.posAlias.toLowerCase() === rawName.toLowerCase()) ||
                    rawName.toLowerCase().indexOf(i.name.toLowerCase().substring(0, 6)) !== -1
                );
            });
        }

        if (recipeId) {
            var recipe = recipes.find(function(rc) { return rc.id === recipeId; });
            if (recipe) {
                matched.push({ rawName: rawName, matchType: 'recipe', matchName: recipe.name, qtySold: qtySold, recipeId: recipeId });
                window._cascadeBatchIngredients(recipeId, qtySold, deductions, new Set(), recipes);
            } else { unmatched.push({ rawName: rawName, qtySold: qtySold }); }
        } else if (directInv) {
            var depletion = qtySold * (directInv.yield ? (1 / directInv.yield) : (directInv.useToBy || 1));
            deductions[directInv.id] = (deductions[directInv.id] || 0) + depletion;
            matched.push({ rawName: rawName, matchType: 'inventory', matchName: directInv.name, qtySold: qtySold });
        } else {
            unmatched.push({ rawName: rawName, qtySold: qtySold });
        }
    });

    // Build stock change preview WITHOUT modifying stock
    var stockChanges = [];
    Object.keys(deductions).forEach(function(invId) {
        var inv = inventory.find(function(i) { return i.id === invId; });
        if (inv) {
            var useUnits = deductions[invId];
            var buyUnits = useUnits / (inv.yield || 1);
            stockChanges.push({
                id: inv.id,
                name: inv.name,
                before: Math.round((inv.stock || 0) * 100) / 100,
                after: Math.round(Math.max(0, (inv.stock || 0) - buyUnits) * 100) / 100,
                unit: inv.buyUnit || 'unit',
                delta: -Math.round(buyUnits * 100) / 100
            });
        }
    });

    return { deductions: deductions, matched: matched, unmatched: unmatched, stockChanges: stockChanges };
};

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
        { id: 'ai-order', label: '✨ AI Suggester', view: 'ai-order' },
        { id: 'invoice', label: '🧾 Invoice Ripper', view: 'invoice' }
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
            (window.inventoryItems || []).forEach(i => { if (i.stock > 0) window.logStockMovement(i.id, -(i.stock || 0), 'stock-wipe'); i.stock = 0; count++; });
            window.saveToDisk(); window.showView('inventory');
            window.showToast(count + ' items reset to 0 stock.', 'error');
        }
    });
};

window.exportInventoryCSV = () => {
    const items = (window.inventoryItems || []).filter(i => window.invFilters.filter === 'Archived' ? i.archived : !i.archived);
    if (!items.length) return window.showToast('No items to export.', 'error');
    const headers = ['Name','Category','Subcategory','Supplier','SKU','Buy Price','Buy Unit','Yield','Use Unit','Current Stock','PAR Weekday','PAR Weekend','Location'];
    const rows = items.map(i => [
        i.name||'', i.category||'', i.subcategory||'', i.supplier||'', i.sku||'',
        i.price||0, i.buyUnit||'', i.yield||1, i.useUnit||'', i.stock||0,
        i.parWeekday||0, i.parWeekend||0, i.location||''
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'inventory-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    window.showToast(items.length + ' items exported.');
};

window.printStockLevels = function() {
    var items = (window.inventoryItems || []).filter(function(i) { return !i.archived; });
    if (!items.length) return window.showToast('No inventory items to print.', 'error');
    var isWeekend = [0, 5, 6].includes(new Date().getDay());
    // Group by category
    var groups = {};
    items.forEach(function(i) {
        var cat = i.category || 'Other';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(i);
    });
    var html = '';
    Object.keys(groups).sort().forEach(function(cat) {
        html += '<div class="section-title">' + esc(cat) + ' (' + groups[cat].length + ')</div>';
        html += '<table><thead><tr><th>Product</th><th>Supplier</th><th>Stock</th><th>PAR</th><th>Unit</th><th>Status</th></tr></thead><tbody>';
        groups[cat].forEach(function(i) {
            var stock = Math.round((i.stock || 0) * 100) / 100;
            var par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
            var below = stock < par && par > 0;
            html += '<tr><td><strong>' + esc(i.name) + '</strong></td>' +
                '<td>' + esc(i.supplier || '—') + '</td>' +
                '<td class="' + (below ? 'flag-red' : '') + '">' + stock + '</td>' +
                '<td>' + par + '</td>' +
                '<td>' + esc(i.buyUnit || 'unit') + '</td>' +
                '<td class="' + (below ? 'flag-red' : 'flag-green') + '">' + (below ? 'BELOW PAR' : 'OK') + '</td></tr>';
        });
        html += '</tbody></table>';
    });
    var belowCount = items.filter(function(i) {
        var par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        return i.stock < par && par > 0;
    }).length;
    window.printReport('Inventory Stock Levels', html, {
        subtitle: items.length + ' items · ' + belowCount + ' below PAR'
    });
};

window.invFilters = window.invFilters || { search: '', filter: 'Active', groupBy: 'Category' };
window._invSelected = window._invSelected || new Set();
window._invHubTab = window._invHubTab || 'levels';

window.renderInventoryHub = () => {
    const tab = window._invHubTab;
    const tabs = [
        { id: 'levels', label: '📦 Stock Levels' },
        { id: 'stocktake', label: '✅ Stocktake' },
        { id: 'audit', label: '📋 Stock Audit' },
        { id: 'par', label: '📊 PAR Editor' }
    ];
    const tabBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">' +
        tabs.map(t => '<span class="tag-pill ' + (tab === t.id ? 'active' : '') + '" onclick="window._invHubTab=\'' + t.id + '\';window.showView(\'inventory\');">' + t.label + '</span>').join('') +
    '</div>';
    let content = '';
    if (tab === 'levels') content = window.renderInventoryView ? window.renderInventoryView() : '';
    else if (tab === 'stocktake') content = window.renderStocktakeView ? window.renderStocktakeView() : '';
    else if (tab === 'audit') content = window.renderStockAuditView ? window.renderStockAuditView() : '';
    else if (tab === 'par') content = window.renderParEditor ? window.renderParEditor() : '';
    return '<div style="max-width:1100px;margin:auto;">' + tabBar + '</div>' + content;
};

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

    // Performance: show total count, cap render at 200 items
    const totalFiltered = filtered.length;
    const RENDER_CAP = 200;
    if (filtered.length > RENDER_CAP) filtered = filtered.slice(0, RENDER_CAP);

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
            <div><h2 style="margin:0">📦 Live Inventory <span style="font-size:14px; color:var(--text-muted); font-weight:normal;">(${totalFiltered > filtered.length ? filtered.length + ' of ' + totalFiltered : filtered.length} items)</span></h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Track stock levels, pricing, and PAR targets across all zones</div></div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button onclick="window.showView('stock-count')" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--green); color:var(--green);">✅ Quick Count</button>
                <button onclick="window.showView(\'par-editor\')" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--orange); color:var(--orange);">📋 PAR Editor</button>
                <button onclick="window.openStockCountSheet()" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--blue); color:var(--blue);">🖨️ Count Sheet</button>
                <button onclick="window.showView('zones')" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">⚙️ Zones</button>
                <button onclick="window.exportInventoryCSV()" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">📥 Export CSV</button>
                <button onclick="window.printStockLevels()" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">🖨️ Print Stock</button>
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
        var affectedRecipes = (window.recipes || []).filter(r => (r.ingredients || []).some(ing => ing.type === 'inv' && ids.includes(ing.ref)));
        var recipeWarning = affectedRecipes.length > 0 ? '<br><span style="color:var(--orange);">⚠️ ' + affectedRecipes.length + ' recipe(s) reference these items — their ingredients will be unlinked.</span>' : '';
        window.confirmAction({
            title: '🗑️ Bulk Delete',
            message: 'Permanently delete <strong>' + ids.length + ' items</strong>? This cannot be undone.' + recipeWarning,
            confirmLabel: 'Delete ' + ids.length + ' Items',
            tier: 'dangerous',
            onConfirm: () => {
                // Unlink dangling recipe ingredient references
                (window.recipes || []).forEach(r => {
                    (r.ingredients || []).forEach(ing => {
                        if (ing.type === 'inv' && ids.includes(ing.ref)) { ing.type = 'raw'; ing.name = (ing.name || 'Deleted item') + ' (unlinked)'; ing.ref = null; }
                    });
                });
                window.inventoryItems = window.inventoryItems.filter(i => !ids.includes(i.id));
                window._invSelected = new Set(); window.saveToDisk(); window.showToast(ids.length + ' items deleted. Recipe refs unlinked.'); window.showView('inventory');
            }
        });
        return;
    }
    if (action === 'archive') {
        window.confirmAction({
            title: '📦 Bulk Archive',
            message: 'Archive <strong>' + ids.length + ' items</strong>? They will be hidden from the active list but can be restored later.',
            confirmLabel: 'Archive ' + ids.length + ' Items',
            confirmColor: 'var(--orange)',
            tier: 'standard',
            onConfirm: () => {
                ids.forEach(id => { const it = window.inventoryItems.find(i=>i.id===id); if(it) it.archived=true; });
                window._invSelected = new Set(); window.saveToDisk(); window.showToast(ids.length + ' items archived.'); window.showView('inventory');
            }
        });
        return;
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
    window.openModal('📦 Update Stock', `
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;"><strong>${esc(item.name)}</strong> — current: ${item.stock || 0} ${esc(item.buyUnit || 'units')}</p>
        <input type="number" id="_ies-val" class="input-box" value="${item.stock || 0}" step="0.01" min="0" style="font-size:16px;padding:10px;margin:0 0 16px;">
        <div style="display:flex;gap:10px;">
            <button onclick="window._commitInlineStock('${item.id}')" class="btn btn-green" style="flex:1;padding:10px;">Save</button>
            <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Cancel</button>
        </div>`);
};
window._commitInlineStock = (id) => {
    const item = window.inventoryItems.find(i=>i.id===id); if (!item) return;
    const val = document.getElementById('_ies-val'); if (!val) return;
    const n = parseFloat(val.value); if (isNaN(n)) return window.showToast('Invalid number.','error');
    window.logStockMovement(item.id, n - (item.stock || 0), 'manual-adjust', { notes: 'Inline edit' });
    item.stock = n; window.closeModal(); window.saveToDisk(); window.showToast(item.name + ' → ' + n + ' ' + (item.buyUnit||'units')); window.showView('inventory');
};
window._inlineEditPar = (id) => {
    const item = window.inventoryItems.find(i=>i.id===id); if (!item) return;
    const isWe = [0,5,6].includes(new Date().getDay());
    const field = isWe ? 'parWeekend' : 'parWeekday';
    const label = (isWe ? 'Weekend' : 'Weekday') + ' PAR';
    window.openModal('📋 Update ' + label, `
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;"><strong>${esc(item.name)}</strong> — current ${label}: ${item[field] || 0}</p>
        <input type="number" id="_iep-val" class="input-box" value="${item[field] || 0}" step="0.01" min="0" style="font-size:16px;padding:10px;margin:0 0 16px;">
        <div style="display:flex;gap:10px;">
            <button onclick="window._commitInlinePar('${item.id}','${field}')" class="btn btn-green" style="flex:1;padding:10px;">Save</button>
            <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Cancel</button>
        </div>`);
};
window._commitInlinePar = (id, field) => {
    const item = window.inventoryItems.find(i=>i.id===id); if (!item) return;
    const val = document.getElementById('_iep-val'); if (!val) return;
    const n = parseFloat(val.value); if (isNaN(n)) return window.showToast('Invalid number.','error');
    item[field] = n; item.par = n; window.closeModal(); window.saveToDisk(); window.showToast(item.name + ' PAR → ' + n); window.showView('inventory');
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
                <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-Units per Buy-Unit)</label><input type="number" step="0.01" min="0.01" id="iv-yield" class="input-box" value="${e.yield || 1}" style="border-color:var(--blue);"></div>
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
        yield: Math.max(0.01, parseFloat(document.getElementById('iv-yield').value) || 1),
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
            window.logStockMovement(item.id, newVal - (item.stock || 0), 'stocktake', { notes: 'Quick stock count' });
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

