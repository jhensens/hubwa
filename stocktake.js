// --- HOBART HUB: Stocktake Module ---
// Allergens, Run Sheets, Variance Report, Stock Audit, Full Stocktake Workflow

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
            '<p style="margin:0;font-size:13px;color:var(--text-muted);"><strong>How to read this:</strong> Positive variance means more was used than recipes predicted (possible: over-portioning, theft, unrecorded waste). Negative means less used than expected (possible: under-portioning, count error, unreported off-menu items).</p>' +
        '</div>' +
    '</div>';
};


window.renderAllergenView = () => {
    const allergenCols = [
        { key: 'gluten', label: 'Gluten', short: 'GL' },
        { key: 'dairy', label: 'Dairy', short: 'DA' },
        { key: 'eggs', label: 'Eggs', short: 'EG' },
        { key: 'nuts', label: 'Nuts', short: 'NU' },
        { key: 'shellfish', label: 'Shell\u00ADfish', short: 'SH' },
        { key: 'fish', label: 'Fish', short: 'FI' },
        { key: 'soy', label: 'Soy', short: 'SO' },
        { key: 'sesame', label: 'Sesame', short: 'SE' }
    ];
    const dietaryCols = [
        { key: 'GF', label: 'GF' }, { key: 'DF', label: 'DF' },
        { key: 'VG', label: 'VG' }, { key: 'V', label: 'V' }, { key: 'NF', label: 'NF' }
    ];

    const menuRecipes = (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived)
        .sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));

    const _parseAllergens = (r) => {
        const flags = (r.allergens || []).join(' ').toLowerCase();
        const nameLc = r.name.toLowerCase();
        const contains = {};
        const dietary = {};
        allergenCols.forEach(c => {
            contains[c.key] = flags.includes(c.key) || flags.includes('contains: ' + c.label.toLowerCase().replace('\u00AD',''));
        });
        dietaryCols.forEach(c => {
            dietary[c.key] = flags.includes(c.key.toLowerCase()) || r.name.includes(c.key);
        });
        // Special: if "GF" in flags, gluten = false (free of it)
        if (dietary.GF) contains.gluten = false;
        if (dietary.DF) contains.dairy = false;
        if (dietary.NF) contains.nuts = false;
        return { contains, dietary };
    };

    let prevCat = '';
    const rows = menuRecipes.map(r => {
        const { contains, dietary } = _parseAllergens(r);
        const scanned = r.allergens && r.allergens.length > 0;
        let catRow = '';
        const cat = r.category || 'Uncategorised';
        if (cat !== prevCat) {
            prevCat = cat;
            catRow = `<tr class="allergen-cat-row"><td colspan="${allergenCols.length + dietaryCols.length + 1}" style="padding:8px 10px;font-weight:700;font-size:13px;background:var(--bg);color:var(--text-muted);border-top:2px solid var(--border);">${esc(cat)}</td></tr>`;
        }
        const allergenCells = allergenCols.map(c =>
            `<td style="text-align:center;padding:5px 3px;font-size:16px;" title="${c.label}">${contains[c.key] ? '⚠️' : scanned ? '✓' : '—'}</td>`
        ).join('');
        const dietaryCells = dietaryCols.map(c =>
            `<td style="text-align:center;padding:5px 3px;font-size:12px;font-weight:700;color:${dietary[c.key] ? 'var(--green)' : 'var(--text-muted)'};">${dietary[c.key] ? c.key : ''}</td>`
        ).join('');
        return catRow + `<tr style="border-bottom:1px solid var(--border);">` +
            `<td style="padding:5px 8px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px;" title="${esc(r.name)}">${esc(r.name)}</td>` +
            allergenCells + dietaryCells + `</tr>`;
    }).join('');

    const scannedCount = menuRecipes.filter(r => r.allergens && r.allergens.length > 0).length;

    return `<div style="max-width:1100px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🧪 Allergen Matrix</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">${scannedCount}/${menuRecipes.length} recipes scanned &nbsp;|&nbsp; ⚠️ = contains &nbsp; ✓ = free &nbsp; — = not scanned</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="window._printAllergenMatrix()" class="btn btn-outline">🖨️ Print Matrix</button>
                <button onclick="window.runAiAllergenScan()" class="btn btn-purple">✨ AI Scan Menu</button>
            </div>
        </div>
        <div id="allergen-status" style="margin-bottom:15px;"></div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
            <table id="allergen-matrix-table" style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;min-width:700px;">
                <thead><tr style="background:#111;text-align:center;">
                    <th style="padding:8px 10px;text-align:left;min-width:140px;font-size:13px;">Recipe</th>
                    ${allergenCols.map(c => `<th style="padding:6px 3px;font-size:11px;writing-mode:vertical-lr;text-orientation:mixed;min-width:36px;" title="${c.label}">${c.short}</th>`).join('')}
                    <th style="padding:6px 2px;border-left:2px solid var(--border);font-size:10px;color:var(--text-muted);">|</th>
                    ${dietaryCols.map(c => `<th style="padding:6px 3px;font-size:11px;color:var(--green);min-width:30px;" title="${c.label}">${c.key}</th>`).join('')}
                </tr></thead>
                <tbody>${rows || '<tr><td colspan="' + (allergenCols.length + dietaryCols.length + 1) + '" style="padding:30px;text-align:center;color:var(--text-muted);">No menu recipes found. Add recipes first.</td></tr>'}</tbody>
            </table>
        </div>
        <div class="card" style="margin-top:16px;border-left:4px solid var(--blue);padding:12px 16px;">
            <p style="margin:0;font-size:12px;color:var(--text-muted);line-height:1.5;"><strong>Legend:</strong> GL=Gluten DA=Dairy EG=Eggs NU=Nuts SH=Shellfish FI=Fish SO=Soy SE=Sesame &nbsp;|&nbsp; GF=Gluten Free DF=Dairy Free VG=Vegan V=Vegetarian NF=Nut Free<br><strong>Tip:</strong> Run <em>AI Scan Menu</em> to auto-detect allergens from recipe ingredients. Print for front-of-house reference.</p>
        </div>
    </div>`;
};

window._printAllergenMatrix = () => {
    const table = document.getElementById('allergen-matrix-table');
    if (!table) return window.showToast('No matrix to print', 'error');
    const venue = window._getVenueName();
    const date = new Date().toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Allergen Matrix — ${venue}</title>
        <style>
            body { font-family: -apple-system, sans-serif; padding: 20px; color: #111; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            .meta { font-size: 12px; color: #666; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ccc; padding: 4px 6px; }
            th { background: #f5f5f5; font-size: 10px; }
            td:first-child { text-align: left; font-weight: 500; }
            td:not(:first-child) { text-align: center; }
            .allergen-cat-row td { background: #eee; font-weight: 700; font-size: 11px; }
            @media print { body { padding: 0; } }
        </style></head><body>
        <h1>Allergen Matrix — ${venue}</h1>
        <div class="meta">Printed ${date} &nbsp;|&nbsp; ⚠️ = contains &nbsp; ✓ = free &nbsp; — = not scanned</div>
        ${table.outerHTML}
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
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
Recipes: ${JSON.stringify(recipeData).replace(/[<>]/g, '')}`;
    window.showLoadingOverlay('🤖 AI scanning allergens across all recipes...');
    try {
        const apiKey = window.getApiKey(); if (!apiKey) { window.hideLoadingOverlay(); return; }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const aiResult = JSON.parse(rawJson);
        (aiResult.results || []).forEach(res => {
            const recipe = window.recipes.find(r => r.id === res.id);
            if (recipe) recipe.allergens = res.allergens;
        });
        window.saveToDisk();
        window.hideLoadingOverlay();
        statusDiv.innerHTML = `<div class="card" style="border-left:4px solid var(--green); padding:12px; color:var(--green); font-weight:bold;">✓ Allergen scan complete. Matrix updated.</div>`;
        window.showView('allergens');
    } catch (e) { window.hideLoadingOverlay(); statusDiv.innerHTML = `<div class="card" style="border-left:4px solid var(--red); padding:12px; color:var(--red);">AI Error: ${e.message}</div>`; }
};

// =============================================================================
// SEVENROOMS BOOKING PARSER
// Parses pasted CSV/TSV booking data into structured bookings.
// Falls back to free-text mode if no recognisable CSV format detected.
// =============================================================================

// Column header alias map — fuzzy matched (lowercased, punctuation stripped)
window._srColumnAliases = {
    time: ['time', 'reservationtime', 'starttime', 'bookingtime', 'arrival', 'arrivaltime'],
    party_size: ['partysize', 'guests', 'covercount', 'pax', 'covers', 'size', 'people', 'guestcount'],
    guest_name: ['guestname', 'reservationname', 'clientname', 'name', 'bookingname', 'customer'],
    dietary: ['dietaryrestrictions', 'dietary', 'allergies', 'allergy', 'restrictions', 'dietaryneeds'],
    notes: ['notes', 'reservationnotes', 'specialrequests', 'request', 'comments', 'guestnotes'],
    vip: ['vip', 'clienttype', 'tags', 'guesttags', 'vipstatus'],
    occasion: ['specialoccasion', 'occasion', 'celebration'],
    table: ['table', 'tablenumber', 'seating', 'tablename'],
    date: ['date', 'reservationdate', 'bookingdate']
};

// Allergen keyword detection (used for both dietary parsing and recipe matching)
window._srAllergenKeywords = {
    'gluten': { aliases: ['gluten', 'gf', 'celiac', 'coeliac', 'wheat'], type: 'avoid', label: 'Gluten Free' },
    'dairy': { aliases: ['dairy', 'lactose', 'milk', 'df', 'lactose intolerant'], type: 'avoid', label: 'Dairy Free' },
    'nuts': { aliases: ['nut', 'nuts', 'peanut', 'tree nut', 'almond', 'cashew'], type: 'avoid', label: 'Nut Allergy' },
    'shellfish': { aliases: ['shellfish', 'crustacean', 'prawn', 'shrimp', 'crab', 'lobster'], type: 'avoid', label: 'Shellfish Allergy' },
    'fish': { aliases: ['fish', 'seafood', 'pescatarian'], type: 'avoid', label: 'Fish Allergy' },
    'soy': { aliases: ['soy', 'soya', 'soybean'], type: 'avoid', label: 'Soy Allergy' },
    'sesame': { aliases: ['sesame', 'tahini'], type: 'avoid', label: 'Sesame Allergy' },
    'eggs': { aliases: ['egg', 'eggs'], type: 'avoid', label: 'Egg Allergy' },
    'vegan': { aliases: ['vegan', 'vg', 'plant based', 'plant-based'], type: 'preference', label: 'Vegan' },
    'vegetarian': { aliases: ['vegetarian', 'veggie'], type: 'preference', label: 'Vegetarian' }
};

// Normalise a column header to a canonical key, or null if unknown
window._srMatchColumn = (header) => {
    const norm = String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [key, aliases] of Object.entries(window._srColumnAliases)) {
        if (aliases.includes(norm)) return key;
    }
    return null;
};

// Parse a single CSV/TSV line respecting quoted fields
window._srParseLine = (line, delim) => {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && (i === 0 || line[i-1] !== '\\')) { inQuotes = !inQuotes; continue; }
        if (c === delim && !inQuotes) { out.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    out.push(cur.trim());
    return out;
};

// Main parser — returns { format, bookings, totalCovers, byTime, date }
window._parseBookings = (text) => {
    if (!text || !text.trim()) return { format: 'empty', bookings: [], totalCovers: 0, byTime: {}, date: null };

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return { format: 'text', bookings: [], totalCovers: 0, byTime: {}, date: null };

    // Detect delimiter (comma vs tab)
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const delim = tabCount > commaCount ? '\t' : ',';

    // Need ≥3 delimiters in header to consider it CSV
    if ((delim === ',' ? commaCount : tabCount) < 2) {
        return { format: 'text', bookings: [], totalCovers: 0, byTime: {}, date: null };
    }

    // Parse header row and map columns
    const headers = window._srParseLine(firstLine, delim);
    const colMap = {};
    let recognisedCount = 0;
    headers.forEach((h, i) => {
        const key = window._srMatchColumn(h);
        if (key) { colMap[key] = i; recognisedCount++; }
    });

    // Need at least party_size + (time OR guest_name) to be useful CSV
    if (recognisedCount < 2 || colMap.party_size === undefined) {
        return { format: 'text', bookings: [], totalCovers: 0, byTime: {}, date: null };
    }

    // Parse data rows
    const bookings = [];
    let totalCovers = 0;
    let detectedDate = null;
    for (let li = 1; li < lines.length; li++) {
        const cells = window._srParseLine(lines[li], delim);
        if (cells.length < 2) continue;
        const get = (k) => colMap[k] !== undefined ? (cells[colMap[k]] || '') : '';
        const partySize = parseInt(get('party_size')) || 0;
        if (partySize === 0) continue; // skip rows with no covers
        const booking = {
            time: get('time'),
            partySize,
            guestName: get('guest_name'),
            dietary: get('dietary'),
            notes: get('notes'),
            vip: get('vip'),
            occasion: get('occasion'),
            table: get('table'),
            date: get('date')
        };
        bookings.push(booking);
        totalCovers += partySize;
        if (booking.date && !detectedDate) detectedDate = booking.date;
    }

    if (bookings.length === 0) return { format: 'text', bookings: [], totalCovers: 0, byTime: {}, date: null };

    // Group by time
    const byTime = {};
    bookings.forEach(b => {
        const t = b.time || 'Unknown';
        if (!byTime[t]) byTime[t] = [];
        byTime[t].push(b);
    });

    return { format: 'csv', bookings, totalCovers, byTime, date: detectedDate };
};

// Build allergen briefing from parsed bookings — cross-references against recipe.allergens
window._buildAllergenBriefing = (bookings) => {
    if (!bookings || bookings.length === 0) return null;
    const detected = {}; // { gluten: { count, guests: [], recipes: [] } }
    bookings.forEach(b => {
        const txt = ((b.dietary || '') + ' ' + (b.notes || '')).toLowerCase();
        if (!txt.trim()) return;
        for (const [key, def] of Object.entries(window._srAllergenKeywords)) {
            if (def.aliases.some(a => txt.includes(a))) {
                if (!detected[key]) detected[key] = { count: 0, guests: [], def };
                detected[key].count += b.partySize;
                if (b.guestName) detected[key].guests.push(b.guestName + (b.time ? ' ('+b.time+')' : ''));
            }
        }
    });

    if (Object.keys(detected).length === 0) return null;

    // Cross-reference with recipes
    const menuRecipes = (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived);
    Object.keys(detected).forEach(key => {
        const matches = [];
        menuRecipes.forEach(r => {
            const flags = (r.allergens || []).join(' ').toLowerCase();
            const recipeName = r.name.toLowerCase();
            const def = detected[key].def;
            if (def.type === 'avoid') {
                // Recipe contains this allergen?
                if (flags.includes(key) || flags.includes('contains: '+key) || def.aliases.some(a => recipeName.includes(a))) {
                    matches.push(r.name);
                }
            } else if (def.type === 'preference' && key === 'vegan') {
                if (flags.includes('vg') || flags.includes('vegan')) matches.push(r.name);
            } else if (def.type === 'preference' && key === 'vegetarian') {
                if (flags.includes('vegetarian') || flags.includes('vg') || flags.includes(' v ') || r.name.includes('(V)')) matches.push(r.name);
            }
        });
        detected[key].recipes = matches.slice(0, 8); // cap at 8 to keep readable
    });

    return detected;
};

// =============================================================================
// RUN SHEET VIEW
// =============================================================================
window.renderSheetGenView = () => {
    return `<div style="max-width: 1100px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">📄 AI Run Sheet Generator</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Paste SevenRooms data to auto-extract covers, allergens & VIPs — then generate a smart run sheet</div>
            </div>
            <button onclick="window.print()" class="btn btn-outline" style="background:white; color:black; font-weight:bold;">🖨️ Print Run Sheet</button>
        </div>
        <div style="display:flex; gap:20px; flex-wrap:wrap;">
            <div class="card no-print" style="flex:1; min-width:300px;">
                <label style="font-size:12px; color:var(--text-muted);">Paste SevenRooms / booking data below</label>
                <textarea id="raw-bookings" class="input-box" style="height:200px; font-size:12px; white-space:pre; margin-top:8px;" placeholder="Paste booking CSV from SevenRooms (with headers like Time, Party Size, Guest Name, Dietary Restrictions, Tags)..." oninput="window._previewBookings()"></textarea>
                <div id="bookings-preview" style="margin-top:10px;"></div>
                <button onclick="window.generateRunSheet()" class="btn btn-purple" style="width:100%; font-size:16px; margin-top:10px;">✨ Generate Smart Sheet</button>
            </div>
            <div class="card" id="print-section" style="flex:2; background:white; color:black; min-height:600px; min-width:550px; padding:30px;">
                <div id="run-sheet-output"><p style="text-align:center; color:#999; margin-top:100px;">Your generated run sheet will appear here.</p></div>
            </div>
        </div>
    </div>`;
};

// Live preview as user types/pastes
window._previewBookings = () => {
    const raw = document.getElementById('raw-bookings').value;
    const previewDiv = document.getElementById('bookings-preview');
    if (!raw.trim()) { previewDiv.innerHTML = ''; return; }

    const parsed = window._parseBookings(raw);
    if (parsed.format !== 'csv') {
        previewDiv.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:8px;background:var(--bg-main);border-radius:6px;">📝 Free-text mode — AI will interpret this. (Paste a SevenRooms CSV with headers for structured extraction.)</div>';
        return;
    }

    const briefing = window._buildAllergenBriefing(parsed.bookings);
    const vips = parsed.bookings.filter(b => b.vip && b.vip.toLowerCase().includes('vip'));
    const occasions = parsed.bookings.filter(b => b.occasion && b.occasion.trim());

    let html = '<div style="background:var(--bg-main);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:12px;">';
    html += '<div style="font-weight:600;color:var(--green);margin-bottom:6px;">✓ Parsed ' + parsed.bookings.length + ' bookings · <strong>' + parsed.totalCovers + ' covers</strong></div>';
    html += '<div style="color:var(--text-muted);font-size:11px;margin-bottom:8px;">Time spread: ' + Object.keys(parsed.byTime).filter(t => t !== 'Unknown').sort().slice(0, 4).join(', ') + (Object.keys(parsed.byTime).length > 4 ? '...' : '') + '</div>';

    if (vips.length > 0) {
        html += '<div style="margin-top:6px;color:var(--purple);"><strong>🌟 ' + vips.length + ' VIP' + (vips.length>1?'s':'') + ':</strong> ' + vips.slice(0,3).map(v => esc(v.guestName||'Unnamed')).join(', ') + (vips.length>3 ? ' +'+(vips.length-3)+' more' : '') + '</div>';
    }
    if (occasions.length > 0) {
        html += '<div style="margin-top:6px;color:var(--orange);"><strong>🎉 ' + occasions.length + ' special occasion' + (occasions.length>1?'s':'') + ':</strong> ' + occasions.slice(0,3).map(o => esc((o.occasion||'')+' — '+(o.guestName||''))).join('; ') + '</div>';
    }
    if (briefing) {
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);"><strong style="color:var(--red);">⚠️ Dietary alerts:</strong>';
        Object.entries(briefing).forEach(([key, info]) => {
            html += '<div style="margin-top:4px;font-size:11px;">• <strong>' + esc(info.def.label) + '</strong> ×' + info.count + (info.recipes.length > 0 ? ' <span style="color:var(--text-muted);">— affects: ' + info.recipes.slice(0,3).map(esc).join(', ') + (info.recipes.length>3?' +'+(info.recipes.length-3):'') + '</span>' : '') + '</div>';
        });
        html += '</div>';
    }
    html += '</div>';
    previewDiv.innerHTML = html;
};

window.generateRunSheet = async () => {
    const rawText = document.getElementById('raw-bookings').value;
    const outputDiv = document.getElementById('run-sheet-output');
    if (!rawText.trim()) return window.showToast("Paste booking data first.", "error");

    const parsed = window._parseBookings(rawText);
    const isStructured = parsed.format === 'csv';

    outputDiv.innerHTML = `<p style="text-align:center; color:#666;">🤖 Generating run sheet...</p>`;
    window.showLoadingOverlay('🤖 Generating run sheet...');

    // Auto-log booked covers if structured + we can determine the date
    if (isStructured && parsed.totalCovers > 0) {
        const targetDate = parsed.date || window._isoDate();
        if (window._autoLogBookedCovers) window._autoLogBookedCovers(targetDate, parsed.totalCovers, parsed.bookings.length);
    }

    // Build the AI prompt — structured if possible, free-text otherwise
    let prompt;
    if (isStructured) {
        const briefing = window._buildAllergenBriefing(parsed.bookings);
        const briefingSummary = briefing ? Object.entries(briefing).map(([k,v]) => `${v.def.label}: ${v.count}pax (avoid: ${v.recipes.slice(0,3).join(', ')||'n/a'})`).join('; ') : 'none';
        const vips = parsed.bookings.filter(b => b.vip && b.vip.toLowerCase().includes('vip'));
        const occasions = parsed.bookings.filter(b => b.occasion && b.occasion.trim());

        prompt = `You are a hospitality operations AI for ${window._getVenueName()} in Hobart. Generate a professional run sheet.
Format as clean HTML using only inline styles (white background, black text — for printing).

Structure:
1. Header: venue name, date, total covers (${parsed.totalCovers}), # bookings (${parsed.bookings.length})
2. ${vips.length > 0 || occasions.length > 0 ? 'A "🌟 SPECIAL ATTENTION TONIGHT" callout box at the top listing VIPs and special occasions in red/bold' : ''}
3. ${briefing ? 'A "⚠️ DIETARY HEADS-UP" callout box listing allergens with counts and affected dishes to avoid: ' + briefingSummary : ''}
4. Bookings grouped by time slot with: time, party name, pax, table, dietary, notes
5. End with a staff prep checklist (5-8 actionable items based on the bookings — e.g. set up extra GF station if GF guests, prep birthday plate, etc.)

Booking data (JSON):
${JSON.stringify(parsed.bookings, null, 2)}`;
    } else {
        prompt = `You are a hospitality operations AI for ${window._getVenueName()} in Hobart. Generate a professional run sheet from this booking data.
Format as clean HTML using only inline styles (white background, black text — this will be printed).
Include: date/time, pax count, booking name, special requirements, staff notes. Group by time slot. Add a staff checklist section at the end.
Booking data: ${rawText}`;
    }

    try {
        const apiKey = window.getApiKey(); if (!apiKey) { window.hideLoadingOverlay(); return; }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
        const text = data.candidates[0].content.parts[0].text;
        outputDiv.innerHTML = text.replace(/^```html/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        window.hideLoadingOverlay();
        window.showToast(isStructured ? `Run sheet generated · ${parsed.totalCovers} covers` : "Run sheet generated!");
    } catch (e) { window.hideLoadingOverlay(); outputDiv.innerHTML = `<p style="color:red;">Error: ${e.message}</p>`; }
};

window.checkRecipeMargins = () => {
    let alerts = [];
    let changed = false;
    (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived).forEach(recipe => {
        const prevCost = recipe.cost;
        window._recalcRecipe(recipe);
        if (recipe.cost !== prevCost) changed = true;
        if (recipe.price > 0 && recipe.gp < GP_TARGET) alerts.push({ name: recipe.name, currentGp: recipe.gp, cost: recipe.cost.toFixed(2) });
    });
    if (changed) window.saveToDisk();
    return alerts;
};

// =============================================================================
// STOCK AUDIT TRAIL VIEW
// =============================================================================
window._auditPage = 0;
window._auditFilters = { source: 'all', search: '', from: '', to: '' };

window.renderStockAuditView = function() {
    var f = window._auditFilters;
    var now = new Date();
    if (!f.from) { var d = new Date(now); d.setDate(d.getDate() - 7); f.from = d.toISOString().split('T')[0]; }
    if (!f.to) f.to = now.toISOString().split('T')[0];
    var moves = (window.stockMovements || []).slice().reverse();
    // Apply filters
    var fromDate = new Date(f.from + 'T00:00:00');
    var toDate = new Date(f.to + 'T23:59:59');
    moves = moves.filter(function(m) {
        var t = new Date(m.ts);
        if (t < fromDate || t > toDate) return false;
        if (f.source !== 'all' && m.source !== f.source) return false;
        if (f.search && m.itemName.toLowerCase().indexOf(f.search.toLowerCase()) === -1) return false;
        return true;
    });
    // Summary
    var totalIn = 0, totalOut = 0, totalMoves = moves.length;
    moves.forEach(function(m) {
        var item = (window.inventoryItems || []).find(function(i) { return i.id === m.itemId; });
        var price = item ? (item.price || 0) : 0;
        if (m.qtyChange > 0) totalIn += m.qtyChange * price;
        else totalOut += Math.abs(m.qtyChange) * price;
    });
    // Paginate
    var perPage = 50;
    var page = window._auditPage || 0;
    var pageItems = moves.slice(0, (page + 1) * perPage);
    var hasMore = moves.length > pageItems.length;

    var sourceOpts = ['all','invoice','csv-depletion','ai-depletion','waste','manual-adjust','stocktake','stock-wipe'];
    var sourceLabels = { all:'All Sources', invoice:'Invoice', 'csv-depletion':'CSV Depletion', 'ai-depletion':'AI Depletion', waste:'Wastage', 'manual-adjust':'Manual Adjust', stocktake:'Stocktake', 'stock-wipe':'Stock Wipe' };

    var html = '<div style="max-width:1200px;margin:0 auto;">';
    html += '<h2 style="margin:0 0 4px;">📋 Stock Movement Audit</h2><p style="color:var(--text-muted);margin:0 0 20px;">Full traceability of every stock change</p>';
    // Filters
    html += '<div class="card" style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;padding:12px 16px;">';
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;">From</label><input type="date" class="input-box" value="' + f.from + '" onchange="window._auditFilters.from=this.value;window._auditPage=0;window.showView(\'stock-audit\')" style="margin:0;padding:6px 10px;"></div>';
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;">To</label><input type="date" class="input-box" value="' + f.to + '" onchange="window._auditFilters.to=this.value;window._auditPage=0;window.showView(\'stock-audit\')" style="margin:0;padding:6px 10px;"></div>';
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;">Source</label><select class="input-box" onchange="window._auditFilters.source=this.value;window._auditPage=0;window.showView(\'stock-audit\')" style="margin:0;padding:6px 10px;">';
    sourceOpts.forEach(function(s) { html += '<option value="' + s + '"' + (f.source === s ? ' selected' : '') + '>' + sourceLabels[s] + '</option>'; });
    html += '</select></div>';
    html += '<div style="flex:1;min-width:150px;"><label style="font-size:11px;color:var(--text-muted);display:block;">Search Item</label><input type="text" class="input-box" placeholder="Search..." value="' + (f.search || '') + '" oninput="window._auditFilters.search=this.value;window._auditPage=0;window.showView(\'stock-audit\')" style="margin:0;padding:6px 10px;"></div>';
    html += '</div>';
    // Summary cards
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:16px 0;">';
    html += '<div class="card" style="text-align:center;padding:14px;"><div style="font-size:24px;font-weight:700;">' + totalMoves + '</div><div style="color:var(--text-muted);font-size:12px;">Movements</div></div>';
    html += '<div class="card" style="text-align:center;padding:14px;"><div style="font-size:24px;font-weight:700;color:var(--green);">$' + totalIn.toFixed(0) + '</div><div style="color:var(--text-muted);font-size:12px;">Stock In Value</div></div>';
    html += '<div class="card" style="text-align:center;padding:14px;"><div style="font-size:24px;font-weight:700;color:var(--red);">$' + totalOut.toFixed(0) + '</div><div style="color:var(--text-muted);font-size:12px;">Stock Out Value</div></div>';
    html += '<div class="card" style="text-align:center;padding:14px;"><div style="font-size:24px;font-weight:700;">$' + (totalIn - totalOut).toFixed(0) + '</div><div style="color:var(--text-muted);font-size:12px;">Net Change</div></div>';
    html += '</div>';
    // Table
    if (pageItems.length === 0) {
        html += '<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">No stock movements found for this period.</div>';
    } else {
        html += '<div class="card" style="overflow-x:auto;padding:0;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
        html += '<thead><tr style="border-bottom:2px solid var(--border);text-align:left;"><th style="padding:10px 12px;">Time</th><th style="padding:10px 8px;">Item</th><th style="padding:10px 8px;">Source</th><th style="padding:10px 8px;text-align:right;">Change</th><th style="padding:10px 8px;text-align:right;">Before</th><th style="padding:10px 8px;text-align:right;">After</th><th style="padding:10px 8px;">Notes</th></tr></thead><tbody>';
        pageItems.forEach(function(m) {
            var isIn = m.qtyChange > 0;
            var rowBg = isIn ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)';
            var changeColor = isIn ? 'var(--green)' : 'var(--red)';
            var sign = isIn ? '+' : '';
            var timeStr = new Date(m.ts).toLocaleString('en-AU', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
            var srcBadge = sourceLabels[m.source] || m.source;
            html += '<tr style="border-bottom:1px solid var(--border);background:' + rowBg + ';">';
            html += '<td style="padding:8px 12px;white-space:nowrap;">' + timeStr + '</td>';
            html += '<td style="padding:8px;font-weight:500;">' + (m.itemName || '') + '</td>';
            html += '<td style="padding:8px;"><span style="background:var(--bg-main);padding:2px 8px;border-radius:8px;font-size:11px;">' + srcBadge + '</span></td>';
            html += '<td style="padding:8px;text-align:right;font-weight:600;color:' + changeColor + ';">' + sign + (m.qtyChange || 0).toFixed(2) + ' ' + (m.unit || '') + '</td>';
            html += '<td style="padding:8px;text-align:right;color:var(--text-muted);">' + (m.before || 0).toFixed(2) + '</td>';
            html += '<td style="padding:8px;text-align:right;">' + (m.after || 0).toFixed(2) + '</td>';
            html += '<td style="padding:8px;color:var(--text-muted);font-size:12px;max-width:150px;overflow:hidden;text-overflow:ellipsis;">' + (m.sourceRef || m.notes || '') + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        if (hasMore) {
            html += '<div style="text-align:center;margin:16px 0;"><button class="btn" onclick="window._auditPage++;window.showView(\'stock-audit\')" style="padding:10px 24px;">Load More (' + (moves.length - pageItems.length) + ' remaining)</button></div>';
        }
    }
    html += '</div>';
    return html;
};

// =============================================================================
// STOCKTAKE WORKFLOW
// =============================================================================
window._activeStocktake = null;
window._stocktakeTab = 'start';
window._stocktakeZone = 'all';
window._stocktakeSearch = '';

// Restore active stocktake on load
(function() {
    var orig = window._hubInitCallbacks || [];
    orig.push(function() {
        var takes = window.stocktakes || [];
        for (var i = takes.length - 1; i >= 0; i--) {
            if (takes[i].status === 'in-progress') { window._activeStocktake = takes[i]; window._stocktakeTab = 'count'; break; }
        }
    });
    window._hubInitCallbacks = orig;
})();

window.renderStocktakeView = function() {
    var tab = window._stocktakeTab || 'start';
    if (window._activeStocktake && window._activeStocktake.status === 'in-progress') tab = 'count';
    var html = '<div style="max-width:1200px;margin:0 auto;">';
    html += '<h2 style="margin:0 0 4px;">📊 Stocktake</h2><p style="color:var(--text-muted);margin:0 0 16px;">Physical stock count, variance analysis, and inventory reconciliation</p>';
    // Tab bar
    var tabs = [{ id:'start', label:'Start New' }, { id:'count', label:'Active Count' }, { id:'history', label:'History' }];
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">';
    tabs.forEach(function(t) {
        var isActive = tab === t.id;
        var disabled = t.id === 'count' && !window._activeStocktake;
        html += '<button class="btn" onclick="window._stocktakeTab=\'' + t.id + '\';window.showView(\'stocktake\')" style="padding:8px 18px;border-radius:20px;font-size:13px;font-weight:' + (isActive ? '600' : '400') + ';background:' + (isActive ? 'var(--purple)' : 'var(--bg-main)') + ';color:' + (isActive ? '#fff' : 'var(--text-muted)') + ';border:1px solid ' + (isActive ? 'var(--purple)' : 'var(--border)') + ';' + (disabled ? 'opacity:0.4;pointer-events:none;' : '') + '">' + t.label + '</button>';
    });
    html += '</div>';

    if (tab === 'start') html += window._renderStocktakeStart();
    else if (tab === 'count') html += window._renderStocktakeCount();
    else if (tab === 'history') html += window._renderStocktakeHistory();
    html += '</div>';
    return html;
};

window._renderStocktakeStart = function() {
    if (window._activeStocktake) {
        return '<div class="card" style="text-align:center;padding:30px;"><p style="font-size:16px;">A stocktake is already in progress.</p><button class="btn" onclick="window._stocktakeTab=\'count\';window.showView(\'stocktake\')" style="margin-top:12px;padding:10px 24px;">Go to Active Count</button></div>';
    }
    var activeItems = (window.inventoryItems || []).filter(function(i) { return !i.archived; });
    var html = '<div class="card" style="text-align:center;padding:40px;">';
    html += '<div style="font-size:48px;margin-bottom:12px;">📋</div>';
    html += '<h3 style="margin:0 0 8px;">Start a New Stocktake</h3>';
    html += '<p style="color:var(--text-muted);margin:0 0 20px;">This will snapshot ' + activeItems.length + ' active inventory items at their current theoretical stock levels. You can then enter physical counts and compare.</p>';
    html += '<div style="max-width:300px;margin:0 auto 20px;"><label style="font-size:12px;color:var(--text-muted);display:block;text-align:left;margin-bottom:4px;">Staff Member</label><input type="text" id="st-staff" class="input-box" placeholder="Who is counting?" style="margin:0;"></div>';
    html += '<button class="btn" onclick="window.startStocktake()" style="padding:12px 32px;font-size:15px;background:var(--purple);color:#fff;">Start Stocktake</button>';
    html += '</div>';
    return html;
};

window.startStocktake = function() {
    var staff = (document.getElementById('st-staff') ? document.getElementById('st-staff').value : '').trim();
    if (!staff) return window.showToast('Enter staff name.', 'error');
    var items = (window.inventoryItems || []).filter(function(i) { return !i.archived; });
    var snapshot = {};
    items.forEach(function(i) {
        snapshot[i.id] = { name: i.name, stock: i.stock || 0, price: i.price || 0, location: i.location || '', category: i.category || '', buyUnit: i.buyUnit || 'unit' };
    });
    var st = {
        id: window.generateId('st'),
        startedAt: new Date().toISOString(),
        completedAt: null,
        status: 'in-progress',
        staff: staff,
        theoreticalSnapshot: snapshot,
        counts: {},
        variances: {},
        summary: {}
    };
    window._activeStocktake = st;
    window.stocktakes = window.stocktakes || [];
    window.stocktakes.push(st);
    window._stocktakeTab = 'count';
    window.saveToDisk();
    window.showView('stocktake');
};

window._renderStocktakeCount = function() {
    var st = window._activeStocktake;
    if (!st) return '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">No active stocktake. Start a new one.</div>';
    var snapshot = st.theoreticalSnapshot || {};
    var counts = st.counts || {};
    var ids = Object.keys(snapshot);
    // Zone tabs
    var zones = ['all'];
    var zoneSet = {};
    ids.forEach(function(id) { var z = snapshot[id].location || 'Unassigned'; if (!zoneSet[z]) { zoneSet[z] = true; zones.push(z); } });
    var activeZone = window._stocktakeZone || 'all';
    // Filter by zone
    var filtered = ids;
    if (activeZone !== 'all') filtered = ids.filter(function(id) { return (snapshot[id].location || 'Unassigned') === activeZone; });
    // Filter by search
    var search = (window._stocktakeSearch || '').toLowerCase();
    if (search) filtered = filtered.filter(function(id) { return snapshot[id].name.toLowerCase().indexOf(search) !== -1; });
    // Sort by name
    filtered.sort(function(a, b) { return snapshot[a].name.localeCompare(snapshot[b].name); });
    // Progress
    var counted = Object.keys(counts).length;
    var total = ids.length;
    var pct = total > 0 ? Math.round(counted / total * 100) : 0;

    var html = '';
    // Progress bar
    html += '<div class="card" style="padding:12px 16px;margin-bottom:16px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-weight:600;">' + counted + ' / ' + total + ' items counted</span><span style="color:var(--text-muted);font-size:13px;">Started by ' + st.staff + '</span></div>';
    html += '<div style="height:8px;background:var(--bg-main);border-radius:4px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--purple);border-radius:4px;transition:width 0.3s;"></div></div>';
    html += '</div>';
    // Zone tabs
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
    zones.forEach(function(z) {
        var isActive = activeZone === z;
        var label = z === 'all' ? 'All Zones' : z;
        html += '<button class="btn" onclick="window._stocktakeZone=\'' + (window.escAttr ? window.escAttr(z) : z.replace(/'/g, "&#39;")) + '\';window.showView(\'stocktake\')" style="padding:6px 14px;border-radius:16px;font-size:12px;background:' + (isActive ? 'var(--purple)' : 'var(--bg-main)') + ';color:' + (isActive ? '#fff' : 'var(--text-muted)') + ';border:1px solid ' + (isActive ? 'var(--purple)' : 'var(--border)') + ';">' + label + '</button>';
    });
    html += '</div>';
    // Search
    html += '<input type="text" class="input-box" placeholder="Search items..." value="' + (window._stocktakeSearch || '') + '" oninput="window._stocktakeSearch=this.value;window.showView(\'stocktake\')" style="margin:0 0 12px;padding:8px 14px;">';
    // Item list
    html += '<div class="card" style="padding:0;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:2px solid var(--border);"><th style="padding:10px 12px;text-align:left;">Item</th><th style="padding:10px 8px;text-align:left;">Zone</th><th style="padding:10px 8px;text-align:right;">Theoretical</th><th style="padding:10px 8px;text-align:center;min-width:120px;">Actual Count</th><th style="padding:10px 8px;text-align:right;">Variance</th></tr></thead><tbody>';
    filtered.forEach(function(id) {
        var s = snapshot[id];
        var c = counts[id];
        var hasCounted = c !== undefined && c !== null;
        var countVal = hasCounted ? c.counted : '';
        var variance = hasCounted ? (c.counted - s.stock) : null;
        var varColor = variance === null ? 'var(--text-muted)' : variance > 0 ? 'var(--green)' : variance < 0 ? 'var(--red)' : 'var(--text-muted)';
        var varStr = variance === null ? '-' : (variance > 0 ? '+' : '') + variance.toFixed(2);
        html += '<tr style="border-bottom:1px solid var(--border);">';
        html += '<td style="padding:8px 12px;font-weight:500;">' + s.name + '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">' + s.buyUnit + '</span></td>';
        html += '<td style="padding:8px;font-size:12px;color:var(--text-muted);">' + (s.location || 'Unassigned') + '</td>';
        html += '<td style="padding:8px;text-align:right;color:var(--text-muted);">' + (s.stock || 0).toFixed(2) + '</td>';
        html += '<td style="padding:6px 8px;text-align:center;"><input type="number" step="0.01" min="0" class="input-box" value="' + countVal + '" placeholder="—" onchange="window._saveStocktakeCount(\'' + id + '\',this.value)" style="margin:0;padding:8px;text-align:center;width:100px;font-size:14px;font-weight:600;"></td>';
        html += '<td style="padding:8px;text-align:right;font-weight:500;color:' + varColor + ';">' + varStr + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    // Actions
    html += '<div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;">';
    html += '<button class="btn" onclick="window._stocktakeTab=\'variance\';window._reviewStocktakeVariances()" style="padding:10px 24px;background:var(--purple);color:#fff;"' + (counted === 0 ? ' disabled style="opacity:0.4;pointer-events:none;"' : '') + '>Review Variances</button>';
    html += '<button class="btn" onclick="window._discardStocktake()" style="padding:10px 24px;background:var(--bg-main);color:var(--red);border:1px solid var(--red);">Discard Stocktake</button>';
    html += '</div>';
    return html;
};

// Debounced auto-save for count entries
window._stCountSaveTimer = null;
window._saveStocktakeCount = function(invId, val) {
    if (!window._activeStocktake) return;
    if (val === '' || val === null || val === undefined) {
        delete window._activeStocktake.counts[invId];
    } else {
        window._activeStocktake.counts[invId] = { counted: parseFloat(val) || 0, notes: '' };
    }
    // Debounce save
    clearTimeout(window._stCountSaveTimer);
    window._stCountSaveTimer = setTimeout(function() { window.saveToDisk(); }, 3000);
};

window._discardStocktake = function() {
    window.confirmAction({
        title: 'Discard Stocktake?',
        message: 'All count data will be lost. This cannot be undone.',
        confirmLabel: 'Discard',
        confirmColor: 'var(--red)',
        tier: 'standard',
        onConfirm: function() {
            var idx = (window.stocktakes || []).findIndex(function(s) { return s.id === window._activeStocktake.id; });
            if (idx !== -1) window.stocktakes.splice(idx, 1);
            window._activeStocktake = null;
            window._stocktakeTab = 'start';
            window.saveToDisk();
            window.showView('stocktake');
            window.showToast('Stocktake discarded.');
        }
    });
};

window._reviewStocktakeVariances = function() {
    var st = window._activeStocktake;
    if (!st) return;
    // Compute variances
    var snapshot = st.theoreticalSnapshot || {};
    var counts = st.counts || {};
    var variances = {};
    var totalVar = 0, posCount = 0, negCount = 0, countedCount = 0;
    Object.keys(snapshot).forEach(function(id) {
        var s = snapshot[id];
        var c = counts[id];
        if (c !== undefined && c !== null) {
            var delta = c.counted - s.stock;
            var dollarVar = delta * (s.price || 0);
            variances[id] = { theoretical: s.stock, actual: c.counted, delta: delta, dollarVariance: dollarVar, name: s.name, location: s.location, buyUnit: s.buyUnit };
            totalVar += dollarVar;
            if (delta > 0.01) posCount++;
            else if (delta < -0.01) negCount++;
            countedCount++;
        }
    });
    st.variances = variances;
    st.summary = { totalItems: Object.keys(snapshot).length, countedItems: countedCount, totalDollarVariance: totalVar, positiveVarianceItems: posCount, negativeVarianceItems: negCount };
    window._stocktakeVarianceFilter = 'all';
    // Show variance modal
    window.openModal('📊 Variance Report', window._buildVarianceHtml(st));
};

window._stocktakeVarianceFilter = 'all';

window._buildVarianceHtml = function(st) {
    var variances = st.variances || {};
    var summary = st.summary || {};
    var filter = window._stocktakeVarianceFilter || 'all';
    var ids = Object.keys(variances);
    // Sort by absolute dollar variance
    ids.sort(function(a, b) { return Math.abs(variances[b].dollarVariance) - Math.abs(variances[a].dollarVariance); });
    // Filter
    if (filter === 'over') ids = ids.filter(function(id) { return variances[id].delta > 0.01; });
    else if (filter === 'under') ids = ids.filter(function(id) { return variances[id].delta < -0.01; });
    else if (filter === 'significant') ids = ids.filter(function(id) { return Math.abs(variances[id].dollarVariance) > 5; });

    var totalVar = summary.totalDollarVariance || 0;
    var varColor = totalVar >= 0 ? 'var(--green)' : 'var(--red)';
    var html = '<div style="margin-bottom:16px;">';
    // Summary banner
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px;">';
    html += '<div style="text-align:center;padding:12px;background:var(--bg-main);border-radius:8px;"><div style="font-size:20px;font-weight:700;color:' + varColor + ';">$' + totalVar.toFixed(2) + '</div><div style="font-size:11px;color:var(--text-muted);">Total $ Variance</div></div>';
    html += '<div style="text-align:center;padding:12px;background:var(--bg-main);border-radius:8px;"><div style="font-size:20px;font-weight:700;">' + (summary.countedItems || 0) + '/' + (summary.totalItems || 0) + '</div><div style="font-size:11px;color:var(--text-muted);">Items Counted</div></div>';
    html += '<div style="text-align:center;padding:12px;background:var(--bg-main);border-radius:8px;"><div style="font-size:20px;font-weight:700;color:var(--green);">' + (summary.positiveVarianceItems || 0) + '</div><div style="font-size:11px;color:var(--text-muted);">Over</div></div>';
    html += '<div style="text-align:center;padding:12px;background:var(--bg-main);border-radius:8px;"><div style="font-size:20px;font-weight:700;color:var(--red);">' + (summary.negativeVarianceItems || 0) + '</div><div style="font-size:11px;color:var(--text-muted);">Under</div></div>';
    html += '</div>';
    // Filter pills
    var filters = [['all','All'],['over','Over'],['under','Under'],['significant','Significant (>$5)']];
    html += '<div style="display:flex;gap:6px;margin-bottom:12px;">';
    filters.forEach(function(f) {
        var isActive = filter === f[0];
        html += '<button class="btn" onclick="window._stocktakeVarianceFilter=\'' + f[0] + '\';document.getElementById(\'global-modal-content\').querySelector(\'.st-variance-body\').innerHTML=window._buildVarianceTableHtml(window._activeStocktake)" style="padding:5px 12px;border-radius:14px;font-size:11px;background:' + (isActive ? 'var(--purple)' : 'var(--bg-main)') + ';color:' + (isActive ? '#fff' : 'var(--text-muted)') + ';border:1px solid ' + (isActive ? 'var(--purple)' : 'var(--border)') + ';">' + f[1] + '</button>';
    });
    html += '</div>';
    // Table
    html += '<div class="st-variance-body">' + window._buildVarianceTableHtml(st) + '</div>';
    // Actions
    html += '<div style="display:flex;gap:10px;margin-top:16px;">';
    html += '<button class="btn" onclick="window._applyStocktakeCounts()" style="padding:10px 20px;background:var(--green);color:#fff;">Apply Counts</button>';
    html += '<button class="btn" onclick="window.closeModal();window._stocktakeTab=\'count\';window.showView(\'stocktake\')" style="padding:10px 20px;">Back to Count</button>';
    html += '</div></div>';
    return html;
};

window._buildVarianceTableHtml = function(st) {
    var variances = st.variances || {};
    var filter = window._stocktakeVarianceFilter || 'all';
    var ids = Object.keys(variances);
    ids.sort(function(a, b) { return Math.abs(variances[b].dollarVariance) - Math.abs(variances[a].dollarVariance); });
    if (filter === 'over') ids = ids.filter(function(id) { return variances[id].delta > 0.01; });
    else if (filter === 'under') ids = ids.filter(function(id) { return variances[id].delta < -0.01; });
    else if (filter === 'significant') ids = ids.filter(function(id) { return Math.abs(variances[id].dollarVariance) > 5; });

    if (ids.length === 0) return '<div style="text-align:center;padding:20px;color:var(--text-muted);">No items match this filter.</div>';
    var html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12px;">';
    html += '<thead><tr style="border-bottom:2px solid var(--border);"><th style="padding:8px;text-align:left;">Item</th><th style="padding:8px;">Zone</th><th style="padding:8px;text-align:right;">Theoretical</th><th style="padding:8px;text-align:right;">Actual</th><th style="padding:8px;text-align:right;">+/-</th><th style="padding:8px;text-align:right;">$ Var</th></tr></thead><tbody>';
    ids.forEach(function(id) {
        var v = variances[id];
        var dColor = v.delta > 0.01 ? 'var(--green)' : v.delta < -0.01 ? 'var(--red)' : 'var(--text-muted)';
        html += '<tr style="border-bottom:1px solid var(--border);">';
        html += '<td style="padding:6px 8px;font-weight:500;">' + v.name + '</td>';
        html += '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">' + (v.location || '') + '</td>';
        html += '<td style="padding:6px 8px;text-align:right;color:var(--text-muted);">' + v.theoretical.toFixed(2) + '</td>';
        html += '<td style="padding:6px 8px;text-align:right;">' + v.actual.toFixed(2) + '</td>';
        html += '<td style="padding:6px 8px;text-align:right;font-weight:600;color:' + dColor + ';">' + (v.delta > 0 ? '+' : '') + v.delta.toFixed(2) + '</td>';
        html += '<td style="padding:6px 8px;text-align:right;font-weight:600;color:' + dColor + ';">$' + v.dollarVariance.toFixed(2) + '</td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
};

window._applyStocktakeCounts = function() {
    window.confirmAction({
        title: 'Apply Stocktake Counts?',
        message: 'This will overwrite current stock levels with your counted values. All changes will be logged in the audit trail.',
        confirmLabel: 'Apply Counts',
        confirmColor: 'var(--green)',
        tier: 'dangerous',
        onConfirm: function() {
            window.closeModal();
            var st = window._activeStocktake;
            if (!st) return;
            var counts = st.counts || {};
            var snapshot = st.theoreticalSnapshot || {};
            var updated = 0;
            Object.keys(counts).forEach(function(invId) {
                var inv = (window.inventoryItems || []).find(function(i) { return i.id === invId; });
                if (!inv) return;
                var counted = counts[invId].counted;
                var delta = counted - (inv.stock || 0);
                if (Math.abs(delta) > 0.001) {
                    window.logStockMovement(inv.id, delta, 'stocktake', { sourceRef: st.id, staff: st.staff });
                    inv.stock = counted;
                    updated++;
                }
            });
            st.status = 'completed';
            st.completedAt = new Date().toISOString();
            window._activeStocktake = null;
            window._stocktakeTab = 'history';
            window.saveToDisk();
            // Recalculate all recipe costs after stock levels change
            if (typeof window.recalcAllCosts === 'function') { window.recalcAllCosts(); }
            window.showView('stocktake');
            window.showToast(updated + ' stock levels updated from stocktake.');
        }
    });
};

window._renderStocktakeHistory = function() {
    var takes = (window.stocktakes || []).filter(function(s) { return s.status === 'completed'; }).reverse();
    if (takes.length === 0) return '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">No completed stocktakes yet.</div>';
    var html = '<div class="card" style="padding:0;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
    html += '<thead><tr style="border-bottom:2px solid var(--border);"><th style="padding:10px 12px;text-align:left;">Date</th><th style="padding:10px 8px;">Staff</th><th style="padding:10px 8px;text-align:right;">Items Counted</th><th style="padding:10px 8px;text-align:right;">$ Variance</th><th style="padding:10px 8px;"></th></tr></thead><tbody>';
    takes.forEach(function(st) {
        var sum = st.summary || {};
        var totalVar = sum.totalDollarVariance || 0;
        var varColor = totalVar >= 0 ? 'var(--green)' : 'var(--red)';
        var dateStr = new Date(st.completedAt).toLocaleDateString('en-AU', { day:'2-digit', month:'short', year:'numeric' });
        html += '<tr style="border-bottom:1px solid var(--border);">';
        html += '<td style="padding:8px 12px;">' + dateStr + '</td>';
        html += '<td style="padding:8px;">' + (st.staff || '') + '</td>';
        html += '<td style="padding:8px;text-align:right;">' + (sum.countedItems || 0) + '/' + (sum.totalItems || 0) + '</td>';
        html += '<td style="padding:8px;text-align:right;font-weight:600;color:' + varColor + ';">$' + totalVar.toFixed(2) + '</td>';
        html += '<td style="padding:8px;text-align:right;"><button class="btn" onclick="window._viewHistoricStocktake(\'' + st.id + '\')" style="padding:5px 12px;font-size:12px;">View</button> <button class="btn btn-outline" onclick="window.printStocktakeReport(\'' + st.id + '\')" style="padding:5px 12px;font-size:12px;">Print</button></td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
};

window._viewHistoricStocktake = function(stId) {
    var st = (window.stocktakes || []).find(function(s) { return s.id === stId; });
    if (!st) return;
    window.openModal('📊 Stocktake — ' + new Date(st.completedAt).toLocaleDateString('en-AU'), window._buildVarianceHtml(st).replace('window._applyStocktakeCounts()', '').replace('>Apply Counts<', ' style="display:none"><'));
};

window.printStocktakeReport = function(stId) {
    var st = (window.stocktakes || []).find(function(s) { return s.id === stId; });
    if (!st) return window.showToast('Stocktake not found.', 'error');
    var variances = st.variances || {};
    var summary = st.summary || {};
    var ids = Object.keys(variances);
    ids.sort(function(a, b) { return Math.abs(variances[b].dollarVariance) - Math.abs(variances[a].dollarVariance); });

    var html = '<div style="display:flex;gap:30px;margin-bottom:20px;font-size:13px;">' +
        '<div><strong>Total Variance:</strong> $' + (summary.totalDollarVariance || 0).toFixed(2) + '</div>' +
        '<div><strong>Items:</strong> ' + (summary.countedItems || 0) + '/' + (summary.totalItems || 0) + ' counted</div>' +
        '<div><strong>Over:</strong> ' + (summary.positiveVarianceItems || 0) + '</div>' +
        '<div><strong>Under:</strong> ' + (summary.negativeVarianceItems || 0) + '</div>' +
    '</div>';
    html += '<table><thead><tr><th>Product</th><th>Expected</th><th>Counted</th><th>Variance</th><th>$ Impact</th></tr></thead><tbody>';
    ids.forEach(function(id) {
        var v = variances[id];
        var dollarVar = (v.dollarVariance || 0).toFixed(2);
        var isNeg = v.delta < -0.01;
        html += '<tr>' +
            '<td>' + esc(v.name || id) + '</td>' +
            '<td>' + (v.expected || 0) + ' ' + esc(v.unit || '') + '</td>' +
            '<td>' + (v.counted || 0) + '</td>' +
            '<td class="' + (isNeg ? 'flag-red' : v.delta > 0.01 ? 'flag-green' : '') + '">' + (v.delta > 0 ? '+' : '') + (v.delta || 0).toFixed(2) + '</td>' +
            '<td class="' + (v.dollarVariance < 0 ? 'flag-red' : '') + '">$' + dollarVar + '</td></tr>';
    });
    html += '</tbody></table>';
    var dateStr = new Date(st.completedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    window.printReport('Stocktake Report', html, { subtitle: dateStr + ' · ' + (st.staff || 'Unknown') });
};
