// --- HOBART HUB: Inventory Module ---
// Zones, Suppliers, Live Inventory, PAR Editor, Stock Count, Price History, Archive

// =============================================================================
// OPS.JS — Bar Wa Izakaya | Hobart Hub
// Phase 1: Editable Zones + Invoice Ripper Pro (PDF + Vision) + Inventory
// =============================================================================

// --- INGREDIENT LINE PARSER ---
// Parses raw ingredient text like "45ml Rien Nashi pear liqueur" into {qty, unit, name}
// Enhanced: handles unicode fractions, word numbers, descriptive quantities, prefix stripping
window._parseIngredientLine = (line) => {
    if (!line || typeof line !== 'string') return { qty: 0, unit: '', name: line || '' };
    const originalLine = line.trim();
    line = originalLine;

    const knownUnits = /^(ml|g|kg|l|oz|lb|cup|cups|tsp|tbsp|tablespoon|tablespoons|teaspoon|teaspoons|dash|dashes|pinch|pinches|bunch|bunches|clove|cloves|medium|large|small|slice|slices|piece|pieces|can|cans|bottle|bottles|sprig|sprigs|sheet|sheets|handful|head|heads|stalk|stalks|rasher|rashers|fillet|fillets|knob|drop|drops|splash|leaves|leaf|whole|tin|tins|pack|packs|punnet|punnets|wedge|wedges)$/i;

    const unicodeFracs = {'\u00BD':0.5, '\u2153':0.3333, '\u00BC':0.25, '\u2154':0.6667, '\u00BE':0.75, '\u215B':0.125, '\u2155':0.2, '\u2156':0.4, '\u2157':0.6, '\u2158':0.8, '\u2159':0.1667, '\u215A':0.8333};
    const wordNums = {a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,half:0.5};
    const prefixes = ['approximately','approx','about','roughly','around','generous','heaped','level','scant'];

    // Phase 0: Strip parentheticals — "2 eggs (separated)" → "2 eggs"
    line = line.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

    // Phase 1: Descriptive zero-qty — "to taste", "as needed", "for garnish", "for serving"
    const lower = line.toLowerCase();
    if (/^(to taste|as needed|as required|for garnish|for serving|for decoration|optional)$/i.test(lower) ||
        /^(salt and pepper|salt & pepper|salt, pepper|seasoning)$/i.test(lower)) {
        return { qty: 0, unit: '', name: originalLine };
    }

    // Phase 2: Strip prefixes — "approx 2 cups sugar" → "2 cups sugar"
    for (const pfx of prefixes) {
        if (lower.startsWith(pfx + ' ') || lower.startsWith(pfx + '.')) {
            line = line.substring(pfx.length).trim();
            if (line.startsWith('.')) line = line.substring(1).trim();
            break;
        }
    }

    // Phase 3: Unicode fractions — "½ cup flour", "1½ cups"
    let qty = 0, rest = '';
    const firstChar = line.charAt(0);
    if (unicodeFracs[firstChar] !== undefined) {
        qty = unicodeFracs[firstChar];
        rest = line.substring(1).trim();
    } else {
        // Mixed: "1½" — digit(s) followed by unicode fraction
        const mixedMatch = line.match(/^(\d+)([½⅓¼⅔¾⅛⅕⅖⅗⅘⅙⅚])\s*(.*)/);
        if (mixedMatch) {
            qty = parseInt(mixedMatch[1]) + (unicodeFracs[mixedMatch[2]] || 0);
            rest = (mixedMatch[3] || '').trim();
        }
    }

    // Phase 4: Word numbers — "a pinch of salt", "one clove garlic", "two eggs"
    if (qty === 0 && !rest) {
        const firstWord = line.split(/\s+/)[0].toLowerCase();
        if (wordNums[firstWord] !== undefined) {
            qty = wordNums[firstWord];
            rest = line.substring(firstWord.length).trim();
        }
    }

    // Phase 5: Existing digit regex (original logic, unchanged)
    if (qty === 0 && !rest) {
        const m = line.match(/^(\d+\/\d+|\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(.*)/);
        if (!m) return { qty: 0, unit: '', name: originalLine };
        const qtyStr = m[1];
        rest = (m[2] || '').trim();
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
    }

    // Phase 6: Unit matching — first word of rest against known units
    let unit = '';
    let name = rest;
    const unitMatch = rest.match(/^([a-zA-Z]+)\b\s*(.*)/);
    if (unitMatch && knownUnits.test(unitMatch[1])) {
        unit = unitMatch[1];
        name = (unitMatch[2] || '').trim();
        // Strip leading "of" — "a pinch of salt" → name = "salt"
        if (name.match(/^of\s+/i)) name = name.replace(/^of\s+/i, '');
    }

    // Round qty to avoid floating point noise
    qty = Math.round(qty * 10000) / 10000;
    return { qty, unit, name: name || originalLine };
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

    // Also fix buyUnit=kg with useUnit=g and yield=1 → yield=1000
    (window.inventoryItems || []).forEach(i => {
        const bu = (i.buyUnit || '').toLowerCase();
        const uu = (i.useUnit || '').toLowerCase();
        if (bu === 'kg' && uu === 'g' && i.yield === 1) {
            log.push((i.name||'?') + ': buyUnit=kg, useUnit=g, yield 1→1000');
            i.yield = 1000; fixed++;
        }
        if (bu === '100g' && i.yield <= 1) {
            log.push((i.name||'?') + ': buyUnit=100g, yield→100, useUnit→g');
            i.yield = 100; i.useUnit = 'g'; fixed++;
        }
        // Fix case/N spirits — price is per case, yield should be bottles × ml
        const cm = (i.name||'').match(/case\s*\/\s*(\d+)/i);
        if (cm) {
            const packSize = parseInt(cm[1]);
            const mlMatch = (i.name||'').match(/(\d{3,4})\s*ml/i);
            if (mlMatch && packSize > 1 && i.yield === parseInt(mlMatch[1])) {
                const newYield = parseInt(mlMatch[1]) * packSize;
                log.push((i.name||'?') + ': case/' + packSize + ' yield ' + i.yield + '→' + newYield + 'ml');
                i.yield = newYield; fixed++;
            }
        }
    });

    if (fixed > 0) {
        window.saveToDisk();
        // Auto-recalculate all recipe costs after yield changes
        if (window.recalcAllCosts) {
            const rc = window.recalcAllCosts();
            window.showToast(fixed + ' yields fixed, ' + rc + ' recipe costs updated.');
        } else {
            window.showToast(fixed + ' inventory yields fixed.');
        }
    } else {
        window.showToast('All yields look correct — nothing to fix.');
    }
    // Debug log removed for production
    return { fixed, log };
};

// ── Common ingredient yield suggestions (yield in grams/ml/each per typical buy unit) ──
const _yieldHints = [
    { pattern: /chive/i, yield: 20, unit: 'g', hint: '~20g per bunch' },
    { pattern: /lime/i, yield: 40, unit: 'ml', hint: '~40ml juice per lime' },
    { pattern: /lemon/i, yield: 50, unit: 'ml', hint: '~50ml juice per lemon' },
    { pattern: /orange/i, yield: 80, unit: 'ml', hint: '~80ml juice per orange' },
    { pattern: /cucumber/i, yield: 375, unit: 'g', hint: '~375g per cucumber' },
    { pattern: /spring roll pastry|rice paper/i, yield: 25, unit: 'each', hint: '~25 sheets per pack' },
    { pattern: /black garlic/i, yield: 50, unit: 'g', hint: '~50g per bulb' },
    { pattern: /garlic\b(?!.*black)/i, yield: 60, unit: 'g', hint: '~60g per bulb' },
    { pattern: /ginger\b/i, yield: 250, unit: 'g', hint: '~250g per piece' },
    { pattern: /galangal/i, yield: 200, unit: 'g', hint: '~200g per piece' },
    { pattern: /lemongrass/i, yield: 30, unit: 'g', hint: '~30g per stalk' },
    { pattern: /kaffir.*lime.*lea|lime.*lea/i, yield: 5, unit: 'g', hint: '~5g per bunch (10-12 leaves)' },
    { pattern: /coriander|cilantro/i, yield: 30, unit: 'g', hint: '~30g per bunch' },
    { pattern: /mint\b/i, yield: 25, unit: 'g', hint: '~25g per bunch' },
    { pattern: /basil\b/i, yield: 25, unit: 'g', hint: '~25g per bunch' },
    { pattern: /parsley/i, yield: 30, unit: 'g', hint: '~30g per bunch' },
    { pattern: /shallot|spring onion|scallion/i, yield: 100, unit: 'g', hint: '~100g per bunch' },
    { pattern: /avocado/i, yield: 170, unit: 'g', hint: '~170g flesh per avocado' },
    { pattern: /carrot/i, yield: 180, unit: 'g', hint: '~180g per carrot' },
    { pattern: /onion\b(?!.*spring)/i, yield: 200, unit: 'g', hint: '~200g per onion' },
    { pattern: /capsicum|bell pepper/i, yield: 200, unit: 'g', hint: '~200g per capsicum' },
    { pattern: /chilli|chili\b/i, yield: 15, unit: 'g', hint: '~15g per chilli' },
    { pattern: /egg\b|eggs\b/i, yield: 12, unit: 'each', hint: '12 per dozen' },
    { pattern: /nori\b/i, yield: 10, unit: 'each', hint: '~10 sheets per pack' },
    { pattern: /wonton\b/i, yield: 30, unit: 'each', hint: '~30 wrappers per pack' },
    { pattern: /dumpling\b.*wrapper|gyoza\b.*wrapper/i, yield: 30, unit: 'each', hint: '~30 wrappers per pack' },
];

window._getYieldHint = (name) => {
    for (const h of _yieldHints) {
        if (h.pattern.test(name)) return h;
    }
    return null;
};

// ── Yield Health Check — finds items needing manual yield entry ──
window.showYieldProblems = () => {
    const problems = [];
    const seen = new Set();

    // Method 1: Items used in recipes with suspicious cost
    (window.recipes || []).forEach(r => {
        (r.ingredients || []).forEach(ing => {
            if (ing.type !== 'inv' || seen.has(ing.ref)) return;
            const inv = (window.inventoryItems || []).find(i => i.id === ing.ref);
            if (!inv) return;
            const cost = ing.qty * ((inv.price || 0) / (inv.yield || 1));
            if (inv.yield <= 6 && ing.qty > 5 && cost > 15) {
                seen.add(ing.ref);
                problems.push(inv);
            }
        });
    });

    // Method 2: Items with yield=1 that have a yield hint (likely produce/herbs)
    (window.inventoryItems || []).forEach(inv => {
        if (seen.has(inv.id) || inv.archived) return;
        if (inv.yield > 1) return;
        const hint = window._getYieldHint(inv.name || '');
        if (hint) {
            seen.add(inv.id);
            problems.push(inv);
        }
    });

    if (problems.length === 0) {
        window.showToast('No yield problems found!', 'success');
        return;
    }
    // Build a modal showing the problem items with inline edit
    const rows = problems.sort((a, b) => a.name.localeCompare(b.name)).map(inv => {
        const hint = window._getYieldHint(inv.name || '');
        const suggestedYield = hint ? hint.yield : '';
        const suggestedUnit = hint ? hint.unit : (inv.useUnit || 'g');
        const hintText = hint ? hint.hint : '';
        return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px;font-size:13px;"><strong>${window.esc(inv.name)}</strong><br>
                <small style="color:var(--text-muted);">$${Number(inv.price||0).toFixed(2)} / ${window.esc(inv.buyUnit||'unit')}</small>
                ${hintText ? '<br><small style="color:var(--blue);">💡 ' + window.esc(hintText) + '</small>' : ''}</td>
            <td style="padding:8px;text-align:center;font-size:12px;color:var(--red);font-weight:bold;">${inv.yield} ${window.esc(inv.useUnit||'?')}</td>
            <td style="padding:8px;text-align:center;">
                <input type="number" step="1" class="input-box" value="${suggestedYield}" placeholder="e.g. 1000" style="width:80px;margin:0;padding:4px;font-size:12px;" id="yfix-${inv.id}">
            </td>
            <td style="padding:8px;text-align:center;">
                <select class="input-box" style="width:70px;margin:0;padding:4px;font-size:12px;" id="yufix-${inv.id}">
                    <option value="g" ${suggestedUnit==='g'?'selected':''}>g</option>
                    <option value="ml" ${suggestedUnit==='ml'?'selected':''}>ml</option>
                    <option value="each" ${suggestedUnit==='each'?'selected':''}>each</option>
                </select>
            </td>
        </tr>`;
    }).join('');

    const html = `<div style="max-height:70vh;overflow-y:auto;">
        <p style="color:var(--text-muted);font-size:13px;margin:0 0 12px;">These items are priced "per unit" but recipes use them by weight/volume. Set the yield to how many grams/ml are in one buy unit. <span style="color:var(--blue);">💡 Suggested values are pre-filled where possible — adjust for your actual suppliers.</span></p>
        <table style="width:100%;border-collapse:collapse;">
            <thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;border-bottom:2px solid var(--border);">
                <th style="padding:6px 8px;text-align:left;">Item</th>
                <th style="padding:6px 8px;text-align:center;">Current</th>
                <th style="padding:6px 8px;text-align:center;">New Yield</th>
                <th style="padding:6px 8px;text-align:center;">Unit</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;

    window.confirmAction({
        title: '🔧 Yield Problems (' + problems.length + ' items)',
        message: html,
        confirmLabel: '💾 Save & Recalculate',
        tier: 'standard',
        onConfirm: () => {
            let count = 0;
            problems.forEach(inv => {
                const yEl = document.getElementById('yfix-' + inv.id);
                const uEl = document.getElementById('yufix-' + inv.id);
                const newYield = yEl ? parseFloat(yEl.value) : 0;
                const newUnit = uEl ? uEl.value : inv.useUnit;
                if (newYield > 0) {
                    inv.yield = newYield;
                    inv.useUnit = newUnit;
                    count++;
                }
            });
            if (count > 0) {
                if (window.recalcAllCosts) window.recalcAllCosts();
                else window.saveToDisk();
                window.showToast(count + ' yields updated, costs recalculated.');
            } else {
                window.showToast('No changes made.', 'info');
            }
            window.showView('inventory');
        }
    });
};

// ── Smart Yield Wizard — subcategory-grouped + hint-based bulk yield setup ──
// Catches items with yield=1 that silently break recipe costing. Groups by subcategory,
// applies subcategory defaults where no name-hint matches, allows per-row/per-group/all accept.
window._subcatYieldDefaults = {
    // food
    'Proteins': { yield: 1000, unit: 'g' },
    'Protein': { yield: 1000, unit: 'g' },
    'Seafood': { yield: 1000, unit: 'g' },
    'Meat': { yield: 1000, unit: 'g' },
    'Poultry': { yield: 1000, unit: 'g' },
    'Produce': { yield: 1000, unit: 'g' },
    'Vegetables': { yield: 1000, unit: 'g' },
    'Fruit': { yield: 1000, unit: 'g' },
    'Herbs': { yield: 100, unit: 'g' },
    'Dairy': { yield: 1000, unit: 'g' },
    'Sauces': { yield: 1000, unit: 'ml' },
    'Condiments': { yield: 1000, unit: 'ml' },
    'Oils': { yield: 1000, unit: 'ml' },
    'Pantry': { yield: 1000, unit: 'g' },
    'Dry Goods': { yield: 1000, unit: 'g' },
    'Spices': { yield: 100, unit: 'g' },
    // beverage already handled by fixBevYields — included for completeness if user runs both
    'Spirits': { yield: 700, unit: 'ml' },
    'Wine': { yield: 750, unit: 'ml' },
    'Liqueurs': { yield: 700, unit: 'ml' },
    'Sake': { yield: 720, unit: 'ml' }
};

window.renderYieldWizard = () => {
    const E = window.esc;
    // Find candidates: yield<=1 AND used in a recipe (so wrong yield actively breaks costing)
    const usedIds = new Set();
    (window.recipes || []).forEach(r => {
        (r.ingredients || []).forEach(ing => { if (ing.type === 'inv' && ing.ref) usedIds.add(ing.ref); });
    });
    const candidates = (window.inventoryItems || []).filter(inv => {
        if (inv.archived) return false;
        if ((inv.yield || 1) > 1) return false;
        return usedIds.has(inv.id);
    });

    if (candidates.length === 0) {
        window.showToast('🎉 No items with yield=1 in use — costing is clean.', 'success');
        return;
    }

    // Group by subcategory (fallback to category)
    const groups = {};
    candidates.forEach(inv => {
        const key = (inv.subcategory && inv.subcategory.trim()) || (inv.category || 'Uncategorised');
        (groups[key] = groups[key] || []).push(inv);
    });
    const groupNames = Object.keys(groups).sort();

    // Per-item suggestion: name hint > subcat default > category default > leave blank
    const suggest = (inv, groupKey) => {
        const hint = window._getYieldHint(inv.name || '');
        if (hint) return { yield: hint.yield, unit: hint.unit, source: 'name-hint', hint: hint.hint };
        const sd = window._subcatYieldDefaults[groupKey];
        if (sd) return { yield: sd.yield, unit: sd.unit, source: 'subcat-default', hint: 'Typical ' + groupKey };
        return { yield: '', unit: inv.useUnit || 'g', source: 'manual', hint: '' };
    };

    const groupBlock = (groupKey) => {
        const items = groups[groupKey];
        const rows = items.map(inv => {
            const s = suggest(inv, groupKey);
            const sourceTag = s.source === 'name-hint' ? '<span style="font-size:9px;color:var(--blue);">💡 from name</span>'
                : s.source === 'subcat-default' ? '<span style="font-size:9px;color:var(--purple);">📦 group default</span>'
                : '<span style="font-size:9px;color:var(--text-muted);">manual</span>';
            return `<tr style="border-bottom:1px solid var(--border);" data-yw-row="${inv.id}">
                <td style="padding:6px 8px;font-size:12px;">
                    <input type="checkbox" class="yw-pick" data-yw-id="${inv.id}" checked style="margin-right:6px;">
                    <strong>${E(inv.name)}</strong>
                    ${s.hint ? '<div style="font-size:10px;color:var(--text-muted);margin-left:22px;">'+E(s.hint)+'</div>' : ''}
                </td>
                <td style="padding:6px 8px;text-align:center;font-size:11px;color:var(--red);">${inv.yield||1} ${E(inv.useUnit||'?')}</td>
                <td style="padding:6px 8px;text-align:center;">
                    <input type="number" step="1" min="0" class="input-box yw-y" data-yw-id="${inv.id}" value="${s.yield}" style="width:80px;margin:0;padding:4px;font-size:12px;">
                </td>
                <td style="padding:6px 8px;text-align:center;">
                    <select class="input-box yw-u" data-yw-id="${inv.id}" style="width:72px;margin:0;padding:4px;font-size:12px;">
                        <option value="g" ${s.unit==='g'?'selected':''}>g</option>
                        <option value="ml" ${s.unit==='ml'?'selected':''}>ml</option>
                        <option value="each" ${s.unit==='each'?'selected':''}>each</option>
                    </select>
                </td>
                <td style="padding:6px 8px;text-align:center;">${sourceTag}</td>
            </tr>`;
        }).join('');
        return `<details open style="border:1px solid var(--border);border-radius:8px;margin-bottom:10px;padding:8px 12px;">
            <summary style="cursor:pointer;font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
                <span>${E(groupKey)} <span style="color:var(--text-muted);font-weight:normal;font-size:11px;">(${items.length})</span></span>
                <span>
                    <button onclick="event.stopPropagation();window._yieldWizardToggleGroup('${E(groupKey).replace(/'/g,"\\'")}', true)" class="btn btn-outline" style="font-size:10px;padding:2px 8px;">Select all</button>
                    <button onclick="event.stopPropagation();window._yieldWizardToggleGroup('${E(groupKey).replace(/'/g,"\\'")}', false)" class="btn btn-outline" style="font-size:10px;padding:2px 8px;">None</button>
                </span>
            </summary>
            <table style="width:100%;border-collapse:collapse;margin-top:8px;">
                <thead><tr style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">
                    <th style="text-align:left;padding:4px 8px;">Item</th>
                    <th style="text-align:center;padding:4px 8px;">Current</th>
                    <th style="text-align:center;padding:4px 8px;">New Yield</th>
                    <th style="text-align:center;padding:4px 8px;">Unit</th>
                    <th style="text-align:center;padding:4px 8px;">Source</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </details>`;
    };

    // Stash candidates so toggle/apply helpers can find them
    window._yieldWizardGroups = groups;

    const html = `<div style="max-height:72vh;overflow-y:auto;">
        <p style="color:var(--text-muted);font-size:13px;margin:0 0 12px;">
            <strong>${candidates.length} items</strong> are used in recipes but have <code>yield=1</code> — this silently inflates recipe costs.
            Suggestions come from name patterns first (💡), then subcategory defaults (📦). Adjust as needed, untick rows to skip, then apply.
        </p>
        <div style="display:flex;gap:8px;margin-bottom:10px;">
            <button onclick="window._yieldWizardToggleAll(true)" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Select all</button>
            <button onclick="window._yieldWizardToggleAll(false)" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Select none</button>
        </div>
        ${groupNames.map(groupBlock).join('')}
    </div>`;

    window.confirmAction({
        title: '🧪 Smart Yield Wizard',
        message: html,
        confirmLabel: '💾 Apply & Recalculate',
        tier: 'standard',
        onConfirm: () => window._commitYieldWizard()
    });
};

window._yieldWizardToggleGroup = (groupKey, on) => {
    const items = (window._yieldWizardGroups || {})[groupKey] || [];
    items.forEach(inv => {
        const cb = document.querySelector('.yw-pick[data-yw-id="' + inv.id + '"]');
        if (cb) cb.checked = !!on;
    });
};
window._yieldWizardToggleAll = (on) => {
    document.querySelectorAll('.yw-pick').forEach(cb => { cb.checked = !!on; });
};
window._commitYieldWizard = () => {
    let applied = 0;
    document.querySelectorAll('.yw-pick').forEach(cb => {
        if (!cb.checked) return;
        const id = cb.getAttribute('data-yw-id');
        const inv = (window.inventoryItems || []).find(i => i.id === id);
        if (!inv) return;
        const yEl = document.querySelector('.yw-y[data-yw-id="' + id + '"]');
        const uEl = document.querySelector('.yw-u[data-yw-id="' + id + '"]');
        const newY = yEl ? parseFloat(yEl.value) : 0;
        const newU = uEl ? uEl.value : inv.useUnit;
        if (newY > 0) {
            inv.yield = newY;
            inv.useUnit = newU;
            applied++;
        }
    });
    if (applied > 0) {
        if (typeof window.recalcAllCosts === 'function') {
            const rc = window.recalcAllCosts();
            window.showToast('✅ ' + applied + ' yields set, ' + rc + ' recipe costs recalculated.', 'success');
        } else {
            window.saveToDisk();
            window.showToast('✅ ' + applied + ' yields set.', 'success');
        }
    } else {
        window.showToast('No yields applied (blank or 0).', 'info');
    }
    window._yieldWizardGroups = null;
    window.showView('inventory');
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
                r.ingredients[idx] = { type: 'raw', name: ing._rawName || ing.name, qty: ing.qty || 0, unit: ing.unit || '', _rawName: ing._rawName || ing.name };
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
            var depletion = qtySold * (1 / (directInv.yield || 1));
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
            var depletion = qtySold * (1 / (directInv.yield || 1));
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
        { id: 'prep-gen', label: '🍳 Prep List', view: 'prep-gen' },
        { id: 'order-drafts', label: '📦 Drafts' + ((window.orderDrafts||[]).filter(d=>d.status==='pending').length > 0 ? ' (' + (window.orderDrafts||[]).filter(d=>d.status==='pending').length + ')' : ''), view: 'order-drafts' },
        { id: 'ai-order', label: '✨ AI Suggester', view: 'ai-order' },
        { id: 'invoice', label: '🧾 Invoice Ripper', view: 'invoice' },
        { id: 'delivery-check', label: '📋 Receiving', view: 'delivery-check' },
        { id: 'order-history', label: '📦 History', view: 'order-history' }
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
    if (i !== null && !window.storageZones?.[i]) return;
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
    if (!window.storageZones?.[i]) return;
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
    if (i !== null && !window.suppliers?.[i]) return;
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

// =============================================================================
// CSV IMPORT — round-trips with exportInventoryCSV column order
// Match strategy: SKU first (if both rows have it), then case-insensitive name.
// Dry-run preview before commit; cascades recipe costs on price changes.
// =============================================================================
window.importInventoryCSV = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                window._previewInventoryImport(ev.target.result, file.name);
            } catch (err) {
                console.error('CSV parse failed:', err);
                window.showToast('CSV parse failed: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};

// Parse a single CSV line respecting quoted values and escaped quotes ("")
window._parseCsvLine = function(line) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { cur += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { out.push(cur); cur = ''; }
            else { cur += ch; }
        }
    }
    out.push(cur);
    return out;
};

window._previewInventoryImport = function(csvText, fileName) {
    // Strip BOM if present, normalize line endings
    const text = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) {
        return window.showToast('CSV is empty or missing data rows.', 'error');
    }
    const headerCells = window._parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    // Map header → column index, accepting both export labels and friendly aliases
    const colMap = {};
    const headerAliases = {
        name: ['name','product','item'],
        category: ['category','cat'],
        subcategory: ['subcategory','sub','subcat'],
        supplier: ['supplier','vendor'],
        sku: ['sku','code'],
        price: ['buy price','price','cost'],
        buyUnit: ['buy unit','buyunit','order unit'],
        yield: ['yield','yld'],
        useUnit: ['use unit','useunit','unit'],
        stock: ['current stock','stock','qty','quantity'],
        parWeekday: ['par weekday','par wd','parwd','parweekday'],
        parWeekend: ['par weekend','par we','parwe','parweekend'],
        location: ['location','loc']
    };
    Object.keys(headerAliases).forEach(field => {
        for (let i = 0; i < headerCells.length; i++) {
            if (headerAliases[field].includes(headerCells[i])) { colMap[field] = i; return; }
        }
    });
    if (colMap.name === undefined) {
        return window.showToast('CSV must have a "Name" column.', 'error');
    }
    const existing = window.inventoryItems || [];
    // Build lookup indexes for matching
    const bySku = {}; const byName = {};
    existing.forEach(it => {
        if (it.sku) bySku[String(it.sku).trim().toLowerCase()] = it;
        if (it.name) byName[String(it.name).trim().toLowerCase()] = it;
    });
    const newItems = []; const updatedItems = []; const errors = [];
    for (let r = 1; r < lines.length; r++) {
        const cells = window._parseCsvLine(lines[r]);
        const get = field => colMap[field] !== undefined ? (cells[colMap[field]] || '').trim() : '';
        const name = get('name');
        if (!name) { errors.push({ row: r + 1, reason: 'missing name' }); continue; }
        const sku = get('sku');
        const parsedNum = field => {
            const v = get(field);
            const n = parseFloat(v);
            return isNaN(n) ? null : n;
        };
        const incoming = {
            name: name,
            category: get('category'),
            subcategory: get('subcategory'),
            supplier: get('supplier'),
            sku: sku,
            price: parsedNum('price'),
            buyUnit: get('buyUnit'),
            yield: parsedNum('yield'),
            useUnit: get('useUnit'),
            stock: parsedNum('stock'),
            parWeekday: parsedNum('parWeekday'),
            parWeekend: parsedNum('parWeekend'),
            location: get('location')
        };
        // Match: SKU first, then name (case-insensitive)
        let match = null;
        if (sku) match = bySku[sku.toLowerCase()];
        if (!match) match = byName[name.toLowerCase()];
        if (match) {
            // Compute diff — only fields actually present in CSV row
            const diffs = [];
            ['name','category','subcategory','supplier','sku','price','buyUnit','yield','useUnit','stock','parWeekday','parWeekend','location'].forEach(field => {
                const newVal = incoming[field];
                if (newVal === '' || newVal === null || newVal === undefined) return;
                const oldVal = match[field];
                if (String(oldVal || '') !== String(newVal || '')) {
                    diffs.push({ field: field, from: oldVal, to: newVal });
                }
            });
            if (diffs.length > 0) updatedItems.push({ existing: match, incoming: incoming, diffs: diffs });
        } else {
            newItems.push(incoming);
        }
    }
    // Stash for the commit step
    window._csvImportPending = { newItems: newItems, updatedItems: updatedItems, fileName: fileName };
    // Build preview HTML
    const fmtVal = v => v === null || v === undefined || v === '' ? '<em style="color:var(--text-muted);">—</em>' : esc(String(v));
    let html = '<div style="max-height:60vh;overflow-y:auto;padding-right:6px;">';
    html += '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;font-size:13px;">' +
        '<div style="background:rgba(16,185,129,0.1);border-left:3px solid var(--green);padding:8px 12px;border-radius:6px;"><strong>' + newItems.length + '</strong> new</div>' +
        '<div style="background:rgba(59,130,246,0.1);border-left:3px solid var(--blue);padding:8px 12px;border-radius:6px;"><strong>' + updatedItems.length + '</strong> updated</div>' +
        (errors.length > 0 ? '<div style="background:rgba(239,68,68,0.1);border-left:3px solid var(--red);padding:8px 12px;border-radius:6px;"><strong>' + errors.length + '</strong> skipped</div>' : '') +
        '</div>';
    if (newItems.length > 0) {
        html += '<details open style="margin-bottom:12px;"><summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--green);margin-bottom:6px;">➕ ' + newItems.length + ' new items</summary>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
        html += '<thead><tr style="background:var(--bg-main);"><th style="text-align:left;padding:5px 8px;">Name</th><th style="text-align:left;padding:5px 8px;">Category</th><th style="text-align:left;padding:5px 8px;">Supplier</th><th style="text-align:right;padding:5px 8px;">Price</th></tr></thead><tbody>';
        newItems.slice(0, 50).forEach(it => {
            html += '<tr style="border-bottom:1px solid var(--border);"><td style="padding:4px 8px;">' + esc(it.name) + '</td><td style="padding:4px 8px;color:var(--text-muted);">' + esc(it.category || '—') + '</td><td style="padding:4px 8px;color:var(--text-muted);">' + esc(it.supplier || '—') + '</td><td style="padding:4px 8px;text-align:right;">$' + (it.price || 0) + '</td></tr>';
        });
        if (newItems.length > 50) html += '<tr><td colspan="4" style="padding:6px;text-align:center;color:var(--text-muted);font-style:italic;">…and ' + (newItems.length - 50) + ' more</td></tr>';
        html += '</tbody></table></details>';
    }
    if (updatedItems.length > 0) {
        html += '<details style="margin-bottom:12px;"><summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--blue);margin-bottom:6px;">✏️ ' + updatedItems.length + ' items will be updated</summary>';
        updatedItems.slice(0, 50).forEach(u => {
            html += '<div style="padding:8px 10px;margin-bottom:6px;background:var(--bg-main);border-left:3px solid var(--blue);border-radius:4px;">';
            html += '<strong style="font-size:12px;">' + esc(u.existing.name) + '</strong>';
            html += '<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">';
            u.diffs.forEach(d => {
                html += '<span style="display:inline-block;margin-right:10px;"><code>' + esc(d.field) + '</code>: ' + fmtVal(d.from) + ' → <strong style="color:var(--green);">' + fmtVal(d.to) + '</strong></span>';
            });
            html += '</div></div>';
        });
        if (updatedItems.length > 50) html += '<div style="padding:6px;text-align:center;color:var(--text-muted);font-style:italic;font-size:12px;">…and ' + (updatedItems.length - 50) + ' more</div>';
        html += '</details>';
    }
    if (errors.length > 0) {
        html += '<details style="margin-bottom:12px;"><summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--red);margin-bottom:6px;">⚠️ ' + errors.length + ' skipped</summary>';
        errors.slice(0, 20).forEach(er => {
            html += '<div style="font-size:11px;color:var(--text-muted);padding:2px 8px;">Row ' + er.row + ': ' + esc(er.reason) + '</div>';
        });
        html += '</details>';
    }
    // ── Recipe-cost impact preview ── projects new costs against GP_TARGET (67%)
    const _gpTgt = window.GP_TARGET || 67;
    const _projected = {};
    updatedItems.forEach(u => {
        const ex = u.existing;
        const newP = u.diffs.find(d => d.field === 'price'); const newY = u.diffs.find(d => d.field === 'yield');
        if (!newP && !newY) return;
        _projected[ex.id] = { price: newP ? Number(newP.to) : Number(ex.price||0), yield: newY ? Number(newY.to) : Number(ex.yield||1) };
    });
    const _projIds = Object.keys(_projected);
    if (_projIds.length > 0) {
        const _impactedRecipes = [];
        (window.recipes||[]).forEach(r => {
            if (r.archived || !r.ingredients || !r.ingredients.length) return;
            let touches = false;
            let newCost = 0;
            r.ingredients.forEach(ing => {
                if (ing.type === 'inv' && _projected[ing.ref]) {
                    touches = true;
                    const p = _projected[ing.ref];
                    newCost += Number(ing.qty || 0) * ((p.price||0) / (p.yield||1));
                } else {
                    newCost += window._ingCost ? window._ingCost(ing) : 0;
                }
            });
            if (!touches) return;
            const oldCost = Number(r.cost || 0);
            const newGp = r.price > 0 ? ((r.price - newCost) / r.price * 100) : 0;
            const oldGp = Number(r.gp || 0);
            _impactedRecipes.push({ r, oldCost, newCost, oldGp, newGp });
        });
        const _drops = _impactedRecipes.filter(x => x.newGp < _gpTgt);
        if (_impactedRecipes.length > 0) {
            const dropColor = _drops.length > 0 ? 'var(--red)' : 'var(--green)';
            html += '<details ' + (_drops.length > 0 ? 'open' : '') + ' style="margin-bottom:12px;border:1px solid '+dropColor+';border-radius:6px;padding:8px 12px;background:rgba(239,68,68,'+(_drops.length>0?'0.05':'0')+');">' +
                '<summary style="cursor:pointer;font-weight:600;font-size:13px;color:'+dropColor+';">' +
                (_drops.length > 0 ? '⚠️ ' : '✅ ') +
                _impactedRecipes.length + ' recipes affected · ' +
                _drops.length + ' will drop below ' + _gpTgt + '% GP</summary>';
            _impactedRecipes.sort((a,b) => a.newGp - b.newGp).slice(0, 30).forEach(x => {
                const dir = x.newCost > x.oldCost ? '↑' : x.newCost < x.oldCost ? '↓' : '·';
                const gpBadge = x.newGp < _gpTgt ? '<span style="color:var(--red);font-weight:600;">'+x.newGp.toFixed(1)+'%</span>' : '<span style="color:var(--green);">'+x.newGp.toFixed(1)+'%</span>';
                html += '<div style="font-size:11px;padding:3px 0;border-bottom:1px dashed var(--border);">' +
                    '<strong>' + esc(x.r.name) + '</strong> &nbsp; cost $' + x.oldCost.toFixed(2) + ' '+dir+' $' + x.newCost.toFixed(2) +
                    ' &nbsp; GP ' + x.oldGp.toFixed(1) + '% → ' + gpBadge + '</div>';
            });
            if (_impactedRecipes.length > 30) html += '<div style="font-size:11px;color:var(--text-muted);font-style:italic;padding:4px;">…and ' + (_impactedRecipes.length - 30) + ' more</div>';
            html += '</details>';
        }
    }
    html += '</div>';
    html += '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">';
    html += '<button onclick="window.closeModal()" class="btn btn-outline">Cancel</button>';
    if (newItems.length > 0 || updatedItems.length > 0) {
        html += '<button onclick="window._commitInventoryImport()" class="btn btn-blue">✅ Apply ' + (newItems.length + updatedItems.length) + ' changes</button>';
    }
    html += '</div>';
    window.openModal('📥 Import Preview — ' + esc(fileName), html);
};

// =============================================================================
// BULK SUPPLIER REASSIGN — move all items from one supplier to another
// Useful when a supplier renames or items migrate to a new vendor
// =============================================================================
window.openBulkSupplierReassign = function() {
    const items = (window.inventoryItems || []).filter(i => !i.archived);
    const suppliers = Array.from(new Set(items.map(i => i.supplier).filter(s => s && s.trim()))).sort();
    if (suppliers.length === 0) {
        return window.showToast('No suppliers to reassign.', 'error');
    }
    const fromOpts = suppliers.map(s => '<option value="' + esc(s) + '">' + esc(s) + ' (' + items.filter(i => i.supplier === s).length + ')</option>').join('');
    const toOpts = '<option value="">— select target supplier —</option>' +
        suppliers.map(s => '<option value="' + esc(s) + '">' + esc(s) + '</option>').join('') +
        '<option value="__NEW__">+ Type a new supplier name…</option>';
    const html =
        '<div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">' +
            'Move all inventory items from one supplier to another. Useful when a supplier name changes or items migrate to a new vendor.' +
        '</div>' +
        '<label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">FROM SUPPLIER</label>' +
        '<select id="bsr-from" class="input-box" onchange="window._bsrPreview()" style="margin-bottom:14px;">' + fromOpts + '</select>' +
        '<label style="display:block;font-size:12px;color:var(--text-muted);margin-bottom:4px;">TO SUPPLIER</label>' +
        '<select id="bsr-to" class="input-box" onchange="window._bsrToggleNew()" style="margin-bottom:8px;">' + toOpts + '</select>' +
        '<input type="text" id="bsr-to-new" class="input-box" placeholder="New supplier name" style="margin-bottom:14px;display:none;">' +
        '<div id="bsr-preview" style="background:var(--bg-main);border-radius:6px;padding:10px;font-size:12px;max-height:200px;overflow-y:auto;margin-bottom:14px;"></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:12px;">' +
            '<button onclick="window.closeModal()" class="btn btn-outline">Cancel</button>' +
            '<button onclick="window._commitBulkSupplierReassign()" class="btn btn-blue">🔄 Reassign</button>' +
        '</div>';
    window.openModal('🔄 Bulk Supplier Reassign', html);
    setTimeout(() => window._bsrPreview(), 0);
};

window._bsrToggleNew = function() {
    const sel = document.getElementById('bsr-to');
    const newInput = document.getElementById('bsr-to-new');
    if (sel.value === '__NEW__') {
        newInput.style.display = 'block';
        newInput.focus();
    } else {
        newInput.style.display = 'none';
    }
};

window._bsrPreview = function() {
    const fromEl = document.getElementById('bsr-from');
    const previewEl = document.getElementById('bsr-preview');
    if (!fromEl || !previewEl) return;
    const from = fromEl.value;
    const matches = (window.inventoryItems || []).filter(i => !i.archived && i.supplier === from);
    if (matches.length === 0) {
        previewEl.innerHTML = '<em style="color:var(--text-muted);">No items.</em>';
        return;
    }
    let html = '<strong style="font-size:12px;">' + matches.length + ' items will be reassigned:</strong><ul style="margin:6px 0 0;padding-left:18px;">';
    matches.slice(0, 30).forEach(i => {
        html += '<li>' + esc(i.name) + ' <span style="color:var(--text-muted);">(' + esc(i.category || '—') + ')</span></li>';
    });
    if (matches.length > 30) html += '<li style="color:var(--text-muted);font-style:italic;">…and ' + (matches.length - 30) + ' more</li>';
    html += '</ul>';
    previewEl.innerHTML = html;
};

window._commitBulkSupplierReassign = function() {
    const from = document.getElementById('bsr-from').value;
    const toSel = document.getElementById('bsr-to').value;
    const to = toSel === '__NEW__' ? document.getElementById('bsr-to-new').value.trim() : toSel;
    if (!from) return window.showToast('Select a FROM supplier.', 'error');
    if (!to) return window.showToast('Select or enter a TO supplier.', 'error');
    if (from === to) return window.showToast('FROM and TO are the same.', 'error');
    const matches = (window.inventoryItems || []).filter(i => !i.archived && i.supplier === from);
    if (matches.length === 0) return window.showToast('No items to reassign.', 'error');
    matches.forEach(i => { i.supplier = to; });
    window.saveToDisk();
    if (typeof window.logAudit === 'function') {
        window.logAudit('inventoryItems', 'bulk-supplier-reassign', from + '→' + to, matches.length + ' items reassigned');
    }
    window.closeModal();
    window.showToast('✅ Reassigned ' + matches.length + ' items to ' + to);
    window.showView('inventory');
};

window._commitInventoryImport = function() {
    const pending = window._csvImportPending;
    if (!pending) return window.showToast('Nothing to import.', 'error');
    const inv = window.inventoryItems = window.inventoryItems || [];
    const changedPriceIds = [];
    let addedCount = 0, updatedCount = 0;
    pending.newItems.forEach(it => {
        const id = window.generateId('inv');
        inv.push({
            id: id,
            name: it.name,
            recipeName: '',
            category: it.category || '',
            subcategory: it.subcategory || '',
            supplier: it.supplier || '',
            sku: it.sku || '',
            price: it.price || 0,
            buyUnit: it.buyUnit || '',
            yield: it.yield || 1,
            useUnit: it.useUnit || '',
            stock: it.stock || 0,
            parWeekday: it.parWeekday || 0,
            parWeekend: it.parWeekend || 0,
            par: it.parWeekday || 0,
            location: it.location || '',
            archived: false,
            history: []
        });
        addedCount++;
    });
    pending.updatedItems.forEach(u => {
        const target = u.existing;
        const oldPrice = target.price;
        u.diffs.forEach(d => {
            target[d.field] = d.to;
        });
        if (oldPrice !== target.price) changedPriceIds.push(target.id);
        updatedCount++;
    });
    window.saveToDisk();
    if (changedPriceIds.length > 0 && typeof window.cascadeRecipeCosts === 'function') {
        window.cascadeRecipeCosts(changedPriceIds);
    }
    if (typeof window.logAudit === 'function') {
        window.logAudit('inventoryItems', 'csv-import', pending.fileName || 'csv', addedCount + ' added · ' + updatedCount + ' updated' + (changedPriceIds.length ? ' · ' + changedPriceIds.length + ' price cascades' : ''));
    }
    window._csvImportPending = null;
    window.closeModal();
    window.showToast('✅ Imported ' + addedCount + ' new, ' + updatedCount + ' updated.');
    window.showView('inventory');
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

// Builds the accordion HTML for the filtered/grouped inventory list
window._buildInvAccordion = (filtered, isWeekend) => {
    const esc = window.esc || (s => s);
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
            <div style="overflow-x:auto; overflow-y:visible;">
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

    return { html: accordionHtml + bulkBar, totalFiltered, shownCount: Math.min(totalFiltered, RENDER_CAP) };
};

// Filters inventory items based on current invFilters state
window._filterInvItems = (isWeekend) => {
    let items = (window.inventoryItems || []).filter(item => {
        let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
        if (window.invFilters.filter === 'Active' && item.archived) return false;
        if (window.invFilters.filter === 'Archived' && !item.archived) return false;
        if (window.invFilters.filter === 'Below PAR' && (item.stock >= parTarget || item.archived)) return false;
        if (window.invFilters.filter === 'Unlinked') {
            if (item.archived) return false;
            window._invUsedIdsCache = window._invUsedIdsCache || (() => { const s = new Set(); (window.recipes||[]).forEach(r => (r.ingredients||[]).forEach(ing => { if (ing.type==='inv' && ing.ref) s.add(ing.ref); })); return s; })();
            if (window._invUsedIdsCache.has(item.id)) return false;
        }
        if (!['Active','Archived','Below PAR','Unlinked'].includes(window.invFilters.filter) && item.category !== window.invFilters.filter) return false;
        if (window.invFilters.search) {
            const s = window.invFilters.search.toLowerCase();
            return (item.name && item.name.toLowerCase().includes(s)) ||
                   (item.sku && item.sku.toLowerCase().includes(s)) ||
                   (item.supplier && item.supplier.toLowerCase().includes(s));
        }
        return true;
    });
    // Apply sort
    const sort = window.invFilters.sort || 'name-az';
    if (sort === 'name-az') items.sort((a,b) => (a.name||'').localeCompare(b.name||''));
    else if (sort === 'name-za') items.sort((a,b) => (b.name||'').localeCompare(a.name||''));
    else if (sort === 'price-high') items.sort((a,b) => (b.price||0) - (a.price||0));
    else if (sort === 'price-low') items.sort((a,b) => (a.price||0) - (b.price||0));
    else if (sort === 'stock-low') items.sort((a,b) => (a.stock||0) - (b.stock||0));
    else if (sort === 'supplier') items.sort((a,b) => (a.supplier||'').localeCompare(b.supplier||''));
    else if (sort === 'category') items.sort((a,b) => (a.category||'').localeCompare(b.category||''));
    else if (sort === 'recipe-count') items.sort((a,b) => window._getRecipesUsingItem(b.id).length - window._getRecipesUsingItem(a.id).length);
    return items;
};

window.renderInventoryView = () => {
    let isWeekend = [0, 5, 6].includes(new Date().getDay());
    window._invUsedIdsCache = null; // invalidate per render
    let filtered = window._filterInvItems(isWeekend);

    const cats = [...new Set((window.inventoryItems || []).filter(i => !i.archived).map(i => i.category || 'Other'))];
    const belowParCount = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return i.stock < par;
    }).length;
    // Unlinked count — items not referenced by any recipe ingredient
    const _usedIds = new Set();
    (window.recipes||[]).forEach(r => (r.ingredients||[]).forEach(ing => { if (ing.type==='inv' && ing.ref) _usedIds.add(ing.ref); }));
    const unlinkedCount = (window.inventoryItems||[]).filter(i => !i.archived && !_usedIds.has(i.id)).length;
    const belowBadge = belowParCount > 0 ? ' <span style="background:var(--red);color:white;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:3px;">' + belowParCount + '</span>' : '';
    const unlinkedBadge = unlinkedCount > 0 ? ' <span style="background:var(--orange);color:white;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:3px;">' + unlinkedCount + '</span>' : '';
    const pillsHtml = ['Active', 'Below PAR', 'Unlinked', ...cats, 'Archived'].map(c =>
        '<div class="tag-pill ' + (window.invFilters.filter===c?'active':'') + '" onclick="window.invFilters.filter=\'' + c + '\'; window.showView(\'inventory\')">' +
        (c==='Below PAR' ? '🚨 Below PAR' + belowBadge : c==='Unlinked' ? '🔗 Unlinked' + unlinkedBadge : c) + '</div>'
    ).join('');

    const result = window._buildInvAccordion(filtered, isWeekend);
    const countLabel = result.totalFiltered > result.shownCount
        ? result.shownCount + ' of ' + result.totalFiltered
        : '' + result.totalFiltered;

    return `
    <div style="max-width:1100px; margin:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
            <div><h2 style="margin:0">📦 Live Inventory <span id="inv-count-label" style="font-size:14px; color:var(--text-muted); font-weight:normal;">(${countLabel} items)</span></h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Track stock levels, pricing, and PAR targets across all zones</div></div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button onclick="window.showView('stock-count')" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--green); color:var(--green);">✅ Quick Count</button>
                <button onclick="window.showView(\'par-editor\')" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--orange); color:var(--orange);">📋 PAR Editor</button>
                <button onclick="window.openStockCountSheet()" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--blue); color:var(--blue);">🖨️ Count Sheet</button>
                <button onclick="window.showView('zones')" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">⚙️ Zones</button>
                <button onclick="window.exportInventoryCSV()" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">📥 Export CSV</button>
                <button onclick="window.importInventoryCSV()" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">📤 Import CSV</button>
                <button onclick="window.openBulkSupplierReassign()" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">🔄 Bulk Supplier</button>
                <button onclick="window.printStockLevels()" class="btn btn-outline" style="font-size:12px; padding:8px 14px;">🖨️ Print Stock</button>
                <button onclick="window.fixAllYields()" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--purple); color:var(--purple);" title="Auto-fix yields from item names and recalculate recipe costs">🔧 Fix Yields</button>
                <button onclick="window.showYieldProblems()" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--orange); color:var(--orange);" title="Find items with wrong yields causing inflated recipe costs">⚠️ Yield Issues</button>
                <button onclick="window.renderYieldWizard()" class="btn btn-outline" style="font-size:12px; padding:8px 14px; border-color:var(--blue); color:var(--blue);" title="Subcategory-grouped wizard — assign yields to all yield=1 items used in recipes">🧪 Yield Wizard</button>
                <button onclick="window.resetAllStock()" class="btn btn-outline" style="color:var(--red); border-color:var(--red); font-size:12px;">⚠️ Wipe Stock</button>
                <button onclick="window.editInvItem()" class="btn btn-blue">+ Add Product</button>
            </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">
            <input type="text" class="search-bar" id="inv-search-box" placeholder="🔍 Search items or SKU..." value="${window.invFilters.search}" oninput="window.invFilters.search=this.value; window._debouncedInvRefresh()" style="flex:1;margin-bottom:0;">
            <select class="input-box" style="margin:0;width:auto;font-size:12px;padding:8px 10px;" onchange="window.invFilters.sort=this.value;window.showView('inventory')">
                <option value="name-az" ${(window.invFilters.sort||'name-az')==='name-az'?'selected':''}>Name A→Z</option>
                <option value="name-za" ${window.invFilters.sort==='name-za'?'selected':''}>Name Z→A</option>
                <option value="price-high" ${window.invFilters.sort==='price-high'?'selected':''}>Price High→Low</option>
                <option value="price-low" ${window.invFilters.sort==='price-low'?'selected':''}>Price Low→High</option>
                <option value="stock-low" ${window.invFilters.sort==='stock-low'?'selected':''}>Stock Low→High</option>
                <option value="supplier" ${window.invFilters.sort==='supplier'?'selected':''}>Supplier</option>
                <option value="category" ${window.invFilters.sort==='category'?'selected':''}>Category</option>
                <option value="recipe-count" ${window.invFilters.sort==='recipe-count'?'selected':''}>Most Used in Recipes</option>
            </select>
        </div>
        <div style="margin-bottom:15px;">${pillsHtml}</div>
        <div style="display:flex; gap:10px; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:15px; flex-wrap:wrap;">
            <span style="font-size:12px; color:var(--text-muted); align-self:center;">Group By:</span>
            <button onclick="window.invFilters.groupBy='Category'; window.showView(\'inventory\')" class="btn ${window.invFilters.groupBy==='Category'?'btn-dark':'btn-outline'}" style="padding:6px 15px; font-size:12px;">Category</button>
            <button onclick="window.invFilters.groupBy='Zone'; window.showView(\'inventory\')" class="btn ${window.invFilters.groupBy==='Zone'?'btn-dark':'btn-outline'}" style="padding:6px 15px; font-size:12px;">Zone</button>
        </div>
        <div id="inv-accordion-wrap">${result.html}</div>
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
                        if (ing.type === 'inv' && ids.includes(ing.ref)) {
                            // Preserve _rawName for re-parsing if it was set; otherwise capture the frozen display name as raw fallback
                            var preservedRaw = ing._rawName || ing.name || 'Deleted item';
                            ing.type = 'raw';
                            ing.name = (ing.name || 'Deleted item') + ' (unlinked)';
                            ing.ref = null;
                            ing._rawName = preservedRaw;
                        }
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

// =============================================================================
// WHERE USED — Show which recipes reference an inventory item
// =============================================================================
window._getRecipesUsingItem = (invId) => {
    return (window.recipes||[]).filter(r => !r.archived && (r.ingredients||[]).some(ing => ing.type==='inv' && ing.ref===invId));
};

// Find recipes that *mention* this inv item by name in a raw ingredient — but aren't linked
window._getRecipesMentioningItem = (invId) => {
    const inv = (window.inventoryItems||[]).find(i => i.id === invId);
    if (!inv) return [];
    const _norm = s => (s||'').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const candidates = [];
    if (inv.recipeName) candidates.push(_norm(inv.recipeName));
    if (inv.name) candidates.push(_norm(inv.name));
    // Also accept the last word as a loose hint when name is multi-word
    const dedup = Array.from(new Set(candidates));
    if (dedup.length === 0) return [];
    const hits = [];
    (window.recipes||[]).filter(r => !r.archived).forEach(r => {
        (r.ingredients||[]).forEach((ing, idx) => {
            if (ing.type !== 'raw') return;
            const source = ing._rawName || ing.name || '';
            const parsed = window._parseIngredientLine(source);
            const parsedNorm = _norm(parsed.name || source);
            if (!parsedNorm) return;
            // Match if parsedNorm equals any candidate, or candidate is contained as a whole-word substring
            const matchFound = dedup.some(c => parsedNorm === c || parsedNorm.split(' ').includes(c) || c.split(' ').every(tok => parsedNorm.split(' ').includes(tok)));
            if (matchFound) hits.push({ recipe: r, ingIdx: idx, source });
        });
    });
    return hits;
};

window._renderWhereUsed = (invId) => {
    const recipes = window._getRecipesUsingItem(invId);
    const mentions = window._getRecipesMentioningItem(invId);
    let html = '';

    if (recipes.length === 0) {
        html += `<div style="background:rgba(245,158,11,0.08);border:1px solid var(--orange);border-radius:8px;padding:12px 15px;margin-bottom:10px;">
            <span style="font-size:12px;color:var(--orange);font-weight:600;">⚠️ Not used in any recipe</span>
            <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">This item isn't linked to any recipes yet.</span>
        </div>`;
    } else {
        const rows = recipes.map(r => {
            const ing = (r.ingredients||[]).find(i => i.type==='inv' && i.ref===invId);
            const qty = ing ? ing.qty : '?';
            const typeColor = r.type==='Batch'?'var(--purple)':'var(--green)';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">
                <span style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe('${r.id}')">${window.esc(r.name)}</span>
                <div style="display:flex;gap:10px;align-items:center;">
                    <span style="color:var(--text-muted);">qty: ${qty}</span>
                    <span style="font-size:10px;color:${typeColor};border:1px solid ${typeColor};padding:1px 6px;border-radius:8px;">${r.type}</span>
                </div>
            </div>`;
        }).join('');
        html += `<details style="margin-bottom:10px;" open>
            <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--blue);padding:8px 0;">📋 Used in ${recipes.length} recipe${recipes.length!==1?'s':''}</summary>
            <div class="card" style="padding:12px;margin-top:6px;">${rows}</div>
        </details>`;
    }

    // ── Reverse linker: raw ingredients mentioning this item by name but not linked ──
    if (mentions.length > 0) {
        const sampleRows = mentions.slice(0, 8).map(m =>
            `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed var(--border);font-size:12px;">
                <div><span style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe('${m.recipe.id}')">${window.esc(m.recipe.name)}</span>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">raw: "${window.esc(m.source)}"</div></div>
            </div>`
        ).join('');
        const moreLabel = mentions.length > 8 ? `<div style="font-size:11px;color:var(--text-muted);padding:4px 0;font-style:italic;">…and ${mentions.length - 8} more</div>` : '';
        html += `<details style="margin-bottom:15px;" open>
            <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--orange);padding:8px 0;">🔗 Mentioned by name but not linked (${mentions.length})</summary>
            <div class="card" style="padding:12px;margin-top:6px;border-left:3px solid var(--orange);">
                <p style="font-size:11px;color:var(--text-muted);margin:0 0 8px;">These recipes have raw ingredients that match this item's name. One click links them all.</p>
                ${sampleRows}${moreLabel}
                <button onclick="window._bulkLinkMentions('${invId}')" class="btn btn-outline" style="font-size:12px;padding:6px 12px;border-color:var(--green);color:var(--green);margin-top:8px;">⚡ Link all ${mentions.length}</button>
            </div>
        </details>`;
    }
    return html;
};

window._bulkLinkMentions = (invId) => {
    const inv = (window.inventoryItems||[]).find(i => i.id === invId);
    if (!inv) return window.showToast('Inventory item not found.', 'error');
    const mentions = window._getRecipesMentioningItem(invId);
    if (mentions.length === 0) return window.showToast('Nothing to link.', 'info');
    window.confirmAction({
        title: '⚡ Bulk Link by Name',
        message: `Link <strong>${mentions.length}</strong> raw ingredient${mentions.length!==1?'s':''} across <strong>${new Set(mentions.map(m=>m.recipe.id)).size}</strong> recipes to <strong>${window.esc(inv.recipeName||inv.name)}</strong>?<br><small style="color:var(--text-muted);">Quantities will be parsed from the raw text where possible.</small>`,
        confirmLabel: `Link ${mentions.length}`,
        tier: 'standard',
        onConfirm: () => {
            let count = 0;
            mentions.forEach(m => {
                const r = m.recipe;
                const ing = r.ingredients && r.ingredients[m.ingIdx];
                if (!ing || ing.type !== 'raw') return;
                const sourceText = ing._rawName || ing.name || '';
                const parsed = window._parseIngredientLine(sourceText);
                const qty = (ing.qty && ing.qty !== 1) ? ing.qty : (parsed.qty || 1);
                const unit = ing.unit || parsed.unit || inv.useUnit || 'unit';
                r.ingredients[m.ingIdx] = {
                    type: 'inv',
                    ref: inv.id,
                    qty: qty,
                    unit: unit,
                    name: inv.recipeName || inv.name,
                    _rawName: sourceText
                };
                count++;
            });
            if (typeof window.recalcAllCosts === 'function') window.recalcAllCosts();
            else window.saveToDisk();
            window.showToast(`⚡ Linked ${count} ingredient${count!==1?'s':''} to ${inv.recipeName||inv.name}`, 'success');
            window.editInvItem(invId);
        }
    });
};

window.editInvItem = (id = null) => {
    const cleanId = id ? String(id).trim() : null;
    let found = cleanId ? window.inventoryItems.find(i => i.id === cleanId) : null;
    let e = found || {
        id: cleanId || window.generateId('inv'), name:'', recipeName:'', category:'Food', supplier:'', price:0, sku:'',
        location:'', gstFree:false, buyUnit:'Unit', yield:1, useUnit:'Unit',
        stock:0, parWeekday:0, parWeekend:0, archived: false, history:[]
    };
    // Item not found is handled gracefully — form renders with defaults
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
        <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; gap:10px; margin-bottom:10px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Product Name</label><input type="text" id="iv-n" class="input-box" value="${esc(e.name)}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iv-cat" list="cat-list" class="input-box" value="${esc(e.category)}"><datalist id="cat-list">${catOpts}</datalist></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Sub-category</label><input type="text" id="iv-subcat" list="subcat-list" class="input-box" value="${esc(e.subcategory || '')}" placeholder="e.g. Proteins, Spirits..."><datalist id="subcat-list">${(() => { const subs = new Set(); (window.inventoryItems||[]).forEach(i => { if (i.subcategory) subs.add(i.subcategory); }); return [...subs].map(s => '<option value="'+esc(s)+'">').join(''); })()}</datalist></div>
        </div>
        <div style="margin-bottom:15px;">
            <label style="font-size:11px; color:var(--green);">Recipe Display Name <span style="color:var(--text-muted);font-weight:normal;">(optional — friendly name shown in recipes instead of full product name)</span></label>
            <input type="text" id="iv-recipeName" class="input-box" value="${esc(e.recipeName || '')}" placeholder="e.g. Brown Onion, Soy Sauce, Chicken Thigh..." style="border-color:var(--green);">
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
        ${id ? window._renderWhereUsed(e.id) : ''}
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
    // ── Zero-price guard: warn if saving $0 for an item used in recipes ──
    if (price === 0 && existingIdx >= 0 && !window._zeroPriceConfirmed) {
        const usedBy = (window.recipes || []).filter(r => !r.archived && (r.ingredients||[]).some(ing => ing.type==='inv' && ing.ref === id));
        if (usedBy.length > 0) {
            const sample = usedBy.slice(0, 5).map(r => '• ' + window.esc(r.name)).join('<br>');
            const moreNote = usedBy.length > 5 ? '<br><em style="color:var(--text-muted);">…and ' + (usedBy.length - 5) + ' more</em>' : '';
            window.confirmAction({
                title: '⚠️ Zero Price Will Break Costing',
                message: '<strong>' + window.esc(nameVal) + '</strong> is used in <strong>' + usedBy.length + ' recipe' + (usedBy.length!==1?'s':'') + '</strong>. Saving with $0 price means those recipes will cost $0 from this ingredient.<br><br>' + sample + moreNote + '<br><br>Save anyway?',
                confirmLabel: 'Save with $0',
                tier: 'dangerous',
                onConfirm: () => {
                    window._zeroPriceConfirmed = true;
                    try { window.subInvItem(id, addAnother, isModal); }
                    finally { window._zeroPriceConfirmed = false; }
                }
            });
            return;
        }
    }
    let obj = {
        id: id,
        name: nameVal,
        recipeName: (document.getElementById('iv-recipeName') ? document.getElementById('iv-recipeName').value.trim() : '') || '',
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
        // Legacy `par` field — keep mirroring weekday for back-compat with code that
        // still reads `par` directly, but if a legacy item only had `par` set and the
        // user is editing without changing it, preserve the existing value as a floor
        // so we never silently zero out a meaningful legacy PAR.
        par: (parseFloat(document.getElementById('iv-parwd').value) || 0) || (existingIdx >= 0 ? (window.inventoryItems[existingIdx].par || 0) : 0),
        yield: Math.max(0.01, parseFloat(document.getElementById('iv-yield').value) || 1),
        useUnit: document.getElementById('iv-useUnit').value,
        buyUnit: document.getElementById('iv-buyUnit').value,
        archived: existingIdx >= 0 ? window.inventoryItems[existingIdx].archived : false,
        history: existingIdx >= 0 ? window.inventoryItems[existingIdx].history : []
    };
    // Detect price/yield changes for recipe cost cascade
    const oldItem = existingIdx >= 0 ? window.inventoryItems[existingIdx] : null;
    const priceChanged = oldItem && (oldItem.price !== obj.price || oldItem.yield !== obj.yield);
    if (existingIdx >= 0) { window.inventoryItems[existingIdx] = obj; } else { window.inventoryItems.push(obj); }
    window.saveToDisk();
    // Cascade recipe costs if price or yield changed
    if (priceChanged && typeof window.cascadeRecipeCosts === 'function') {
        window.cascadeRecipeCosts([id]);
    }
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
    win.document.write('<h1>📦 Stock Count Sheet — ' + window._getVenueName() + '</h1>');
    win.document.write('<div class="meta"><span>Grouped by: '+( groupBy==='zone'?'Zone':'Category')+'</span><span>Date: _____________ &nbsp;&nbsp; Staff: _____________</span></div>');
    win.document.write('<table><thead><tr><th>Item</th><th>Unit</th><th>PAR</th><th style="text-align:right;">Count</th></tr></thead><tbody>'+tableHtml+'</tbody></table>');
    win.document.write('<div style="margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px;">'+items.length+' items · ' + window._getVenueName() + ' · Hobart Hub</div>');
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
    const venueName = window._getVenueName();
    
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
    if (!item) return window.showToast('Item not found.', 'error');
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
    // Price trend analysis
    let trendHtml = '';
    if (history.length >= 3) {
        const prices = history.map(h => Number(h.price));
        const recent = prices.slice(-Math.min(5, Math.floor(prices.length/2)));
        const older = prices.slice(0, -recent.length);
        if (older.length > 0) {
            const recentAvg = recent.reduce((s,p)=>s+p,0)/recent.length;
            const olderAvg = older.reduce((s,p)=>s+p,0)/older.length;
            const trendPct = ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1);
            const isUp = trendPct > 0;
            const trendColor = isUp ? 'var(--red)' : 'var(--green)';
            // Mini sparkline SVG
            const minP = Math.min(...prices), maxP = Math.max(...prices);
            const range = maxP - minP || 1;
            const svgW = 200, svgH = 40;
            const points = prices.map((p,i) => `${(i/(prices.length-1))*svgW},${svgH - ((p-minP)/range)*svgH}`).join(' ');
            const sparkline = `<svg width="${svgW}" height="${svgH}" style="display:block;margin:0 auto;"><polyline points="${points}" fill="none" stroke="${trendColor}" stroke-width="2"/></svg>`;
            // Alert if latest price >10% above average
            const latestPrice = prices[prices.length-1];
            const allAvg = prices.reduce((s,p)=>s+p,0)/prices.length;
            const alertPct = ((latestPrice - allAvg) / allAvg * 100).toFixed(1);
            const alert = alertPct > 10 ? `<div style="background:rgba(239,68,68,0.1);border:1px solid var(--red);border-radius:6px;padding:8px 12px;margin-top:8px;font-size:12px;color:var(--red);font-weight:600;">🚨 Current price is ${alertPct}% above average ($${allAvg.toFixed(2)})</div>` : '';
            trendHtml = `<div class="card" style="padding:15px;margin-bottom:12px;border-top:3px solid ${trendColor};">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;font-weight:600;">Price Trend</span>
                    <span style="font-size:16px;font-weight:bold;color:${trendColor};">${isUp?'📈':'📉'} ${isUp?'+':''}${trendPct}%</span>
                </div>
                ${sparkline}
                <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:4px;">
                    <span>$${minP.toFixed(2)} low</span><span>$${maxP.toFixed(2)} high</span>
                </div>
                ${alert}
            </div>`;
        }
    }
    window.openModal(`📈 Price Trend: ${esc(item.name)}`, `${trendHtml}<div style="max-height:350px; overflow-y:auto;">${historyHtml}</div><button onclick="window.closeModal()" class="btn btn-dark" style="width:100%; margin-top:20px;">Close</button>`);
};

