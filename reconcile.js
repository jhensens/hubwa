// --- HOBART HUB: Recipe Reconcile from Source ---
// Compare current recipes against an uploaded Recipe Keeper HTML export.
// Surface drift: wrong qty/unit, phantom ingredients, wrong-link suspects, unlinked candidates.
// Apply fixes per-row, per-recipe, or in bulk by issue type — never overwriting refs/confirmations/prices.

window._reconcileState = window._reconcileState || null;

// =============================================================================
// PARSE source HTML → array of { name, course, ingredients: [{text, parsed:{qty,unit,name}}] }
// =============================================================================
window._parseRecipeKeeperHtml = function(htmlText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const nodes = doc.querySelectorAll('.recipe-details');
    const recipes = [];
    nodes.forEach(node => {
        const nameEl = node.querySelector('[itemprop="name"]');
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        if (!name) return;
        const course = (node.querySelector('[itemprop="recipeCourse"]') || {}).textContent || '';
        const ingredientsEl = node.querySelector('[itemprop="recipeIngredients"]');
        const raw = ingredientsEl
            ? Array.from(ingredientsEl.querySelectorAll('p')).map(p => p.textContent.trim())
            : [];
        // Keep empty entries to preserve position; we'll handle them later
        const ingredients = raw.map(t => {
            if (!t) return { text: '', parsed: { qty: 0, unit: '', name: '' }, isEmpty: true };
            const p = window._parseIngredientLine ? window._parseIngredientLine(t) : { qty: 0, unit: '', name: t };
            return { text: t, parsed: p };
        });
        recipes.push({ name, course, ingredients });
    });
    return recipes;
};

// =============================================================================
// MATCH source recipe to Hub recipe (by exact name then case-insensitive)
// =============================================================================
window._matchHubRecipe = function(sourceName) {
    const recipes = (window.recipes || []).filter(r => !r.archived);
    let r = recipes.find(x => x.name === sourceName);
    if (!r) r = recipes.find(x => x.name.toLowerCase().trim() === sourceName.toLowerCase().trim());
    return r || null;
};

// =============================================================================
// CLASSIFY drift for a single ingredient pair
// =============================================================================
window._classifyDrift = function(src, hub, hubIdx, allInv) {
    // src: { text, parsed: {qty, unit, name}, isEmpty }
    // hub: ingredient object from recipe.ingredients[hubIdx]
    // Returns { kind, severity, reason, proposed: {qty?, unit?, drop?, addLink?} }
    const issues = [];
    if (!hub) {
        if (!src.isEmpty && src.parsed.name && src.parsed.qty > 0) {
            issues.push({ kind: 'missing-in-hub', severity: 'med', reason: 'Source has this ingredient; Hub does not.', proposed: { addRaw: src } });
        }
        return issues;
    }
    if (src.isEmpty) {
        // Source line is empty/separator. Check if Hub has something at this position
        const text = (hub.name || '') + ' ' + (hub._rawName || '');
        if (/(stir|shake|garnish|martini glass|serve|combine|add to|skewer|topped|method)/i.test(text)) {
            issues.push({ kind: 'phantom', severity: 'high', reason: 'Hub has an instruction-like ingredient where source has a separator.', proposed: { drop: true } });
        }
        return issues;
    }
    // Normalise comparisons
    const srcQty = Number(src.parsed.qty || 0);
    const srcUnit = (src.parsed.unit || '').toLowerCase();
    const hubQty = Number(hub.qty || 0);
    const hubUnit = (hub.unit || '').toLowerCase();

    // Treat near-equal qty as no drift (small floating-point + small intentional differences within ~5%)
    const qtyClose = (a, b) => {
        if (a === 0 && b === 0) return true;
        if (a === 0 || b === 0) return false;
        const ratio = Math.max(a, b) / Math.min(a, b);
        return ratio < 1.05;
    };

    // Detect "unit was converted" — e.g. 5 cups → 1L should round-trip
    const _cupsToMl = c => c * 240; // approximate
    const _tspToMl = t => t * 5;
    const _tbspToMl = t => t * 15;
    const possibleConverted = () => {
        // If src is cups/tbsp/tsp and hub is ml/g/l, compare converted
        if (['cup', 'cups'].includes(srcUnit) && ['ml', 'l'].includes(hubUnit)) {
            const expectedMl = _cupsToMl(srcQty);
            const actualMl = hubUnit === 'l' ? hubQty * 1000 : hubQty;
            return Math.abs(expectedMl - actualMl) / expectedMl < 0.15 ? null : { expectedMl, actualMl };
        }
        if (['tsp', 'teaspoon'].includes(srcUnit) && ['ml', 'g'].includes(hubUnit)) {
            const expectedMl = _tspToMl(srcQty);
            return Math.abs(expectedMl - hubQty) / expectedMl < 0.2 ? null : { expectedMl, actualMl: hubQty };
        }
        if (['tbsp', 'tablespoon'].includes(srcUnit) && ['ml', 'g'].includes(hubUnit)) {
            const expectedMl = _tbspToMl(srcQty);
            return Math.abs(expectedMl - hubQty) / expectedMl < 0.2 ? null : { expectedMl, actualMl: hubQty };
        }
        return undefined;
    };
    const convResult = possibleConverted();

    // For LINKED ingredients (inv/batch), inventory's useUnit governs costing.
    // Unit mismatch detection ONLY flags when there's an obvious problem (e.g., "bottle" on a liquid in ml inventory).
    if (hub.type === 'inv') {
        const inv = (allInv || window.inventoryItems || []).find(i => i.id === hub.ref);
        if (inv) {
            const useUnit = (inv.useUnit || '').toLowerCase();
            // If qty units differ from inv useUnit and the source unit is volumetric/weight (parseable), suggest conversion
            const volumeUnits = ['cup', 'cups', 'tsp', 'tbsp', 'tablespoon', 'teaspoon'];
            const isPiece = ['each', 'pcs', 'pc', 'piece', 'pieces', 'bottle', 'tin', 'can', 'pkt', 'pack'].includes(hubUnit);
            const srcIsBulk = ['ml', 'g', 'kg', 'l'].includes(srcUnit);
            if (srcIsBulk && hubUnit !== srcUnit) {
                // Source explicit volume/weight, Hub has different — propose direct overwrite
                let proposedQty = srcQty;
                let proposedUnit = srcUnit;
                if (srcUnit === 'kg' && useUnit === 'g') { proposedQty = srcQty * 1000; proposedUnit = 'g'; }
                else if (srcUnit === 'l' && useUnit === 'ml') { proposedQty = srcQty * 1000; proposedUnit = 'ml'; }
                if (!qtyClose(hubQty, proposedQty) || hubUnit !== proposedUnit) {
                    issues.push({ kind: 'qty-or-unit-drift', severity: 'high', reason: 'Source: ' + src.text + ' · Hub: ' + hubQty + ' ' + hubUnit, proposed: { qty: proposedQty, unit: proposedUnit } });
                }
            } else if (volumeUnits.includes(srcUnit) && convResult) {
                // cup/tsp/tbsp → ml conversion suggestion
                let proposedQty = convResult.expectedMl;
                let proposedUnit = useUnit === 'g' ? 'g' : 'ml';
                issues.push({ kind: 'qty-or-unit-drift', severity: 'med', reason: 'Source: ' + src.text + ' · Hub: ' + hubQty + ' ' + hubUnit + ' · Suggested: ' + proposedQty + proposedUnit + ' (converted)', proposed: { qty: proposedQty, unit: proposedUnit } });
            } else if (isPiece && srcIsBulk) {
                issues.push({ kind: 'qty-or-unit-drift', severity: 'high', reason: 'Hub uses piece unit (' + hubUnit + ') but source is bulk (' + srcUnit + ').', proposed: { qty: srcQty, unit: srcUnit } });
            } else if (qtyClose(hubQty, srcQty) && hubUnit === srcUnit) {
                // perfect
            } else if (srcUnit && hubUnit && srcUnit !== hubUnit && srcQty > 0 && hubQty > 0) {
                // Generic unit mismatch
                issues.push({ kind: 'unit-mismatch', severity: 'med', reason: 'Source unit "' + srcUnit + '" vs Hub unit "' + hubUnit + '"', proposed: { unit: srcUnit, qty: srcQty } });
            } else if (!qtyClose(hubQty, srcQty) && srcQty > 0 && hubQty > 0) {
                issues.push({ kind: 'qty-drift', severity: 'high', reason: 'Source qty ' + srcQty + ' vs Hub qty ' + hubQty, proposed: { qty: srcQty } });
            }

            // Wrong-link suspect: source name has no token in common with inv name/recipeName
            const _tok = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length >= 3);
            const srcTokens = new Set(_tok(src.parsed.name || src.text));
            const invTokens = new Set([..._tok(inv.name), ..._tok(inv.recipeName || '')]);
            let overlap = 0;
            srcTokens.forEach(t => { if (invTokens.has(t)) overlap++; });
            if (srcTokens.size > 0 && overlap === 0) {
                issues.push({ kind: 'wrong-link-suspect', severity: 'high', reason: 'Linked to "' + (inv.recipeName || inv.name) + '" but source says "' + src.text + '". No shared words.', proposed: { unlink: true } });
            }
        }
    } else if (hub.type === 'batch') {
        // Batch handling — only flag obvious qty drift
        if (srcQty > 0 && hubQty > 0 && !qtyClose(hubQty, srcQty)) {
            // Different units may legitimately differ for batch yield-based ingredients; flag medium severity only
            issues.push({ kind: 'qty-drift', severity: 'med', reason: 'Batch qty differs: source ' + srcQty + ' ' + srcUnit + ' · hub ' + hubQty + ' ' + hubUnit, proposed: { qty: srcQty, unit: srcUnit || hubUnit } });
        }
    } else if (hub.type === 'raw') {
        // Raw — check if name now resembles an inventory item exactly
        const _norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        const srcNorm = _norm(src.parsed.name);
        if (srcNorm) {
            const candidates = (allInv || window.inventoryItems || []).filter(i => !i.archived).filter(i => {
                const n1 = _norm(i.name); const n2 = _norm(i.recipeName || '');
                return n1 === srcNorm || n2 === srcNorm;
            });
            if (candidates.length === 1) {
                issues.push({ kind: 'unlinked-could-link', severity: 'med', reason: 'Source name matches exactly one inventory item: ' + (candidates[0].recipeName || candidates[0].name), proposed: { linkInvId: candidates[0].id, qty: srcQty || hubQty, unit: srcUnit || candidates[0].useUnit } });
            }
        }
        // Also: qty drift on raw items
        if (srcQty > 0 && hubQty > 0 && !qtyClose(hubQty, srcQty)) {
            issues.push({ kind: 'qty-drift', severity: 'low', reason: 'Source qty ' + srcQty + ' vs Hub qty ' + hubQty + ' (raw ingredient)', proposed: { qty: srcQty, unit: srcUnit || hubUnit } });
        }
    }
    return issues;
};

// =============================================================================
// BUILD reconcile report from parsed source + Hub state
// =============================================================================
window._buildReconcileReport = function(sourceRecipes) {
    const hubRecipes = (window.recipes || []).filter(r => !r.archived);
    const inv = window.inventoryItems || [];
    const report = { matched: [], sourceOnly: [], hubOnly: [] };
    const matchedHubIds = new Set();

    sourceRecipes.forEach(src => {
        const hub = window._matchHubRecipe(src.name);
        if (!hub) { report.sourceOnly.push(src); return; }
        matchedHubIds.add(hub.id);
        // Filter empty separators out of source for pairing (the original importer dropped them)
        const srcNonEmpty = src.ingredients.filter(i => !i.isEmpty);
        const hubIngs = hub.ingredients || [];
        // Token-overlap helper for name similarity
        const _tok = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t.length >= 3);
        const _sim = (a, b) => {
            const at = new Set(_tok(a)); const bt = new Set(_tok(b));
            if (at.size === 0 || bt.size === 0) return 0;
            let overlap = 0; at.forEach(t => { if (bt.has(t)) overlap++; });
            return overlap / Math.max(at.size, bt.size);
        };
        // Greedy pairing: for each source non-empty, find best hub match in a sliding window of ±2 around expected position
        const usedHubIdxs = new Set();
        const pairs = [];
        srcNonEmpty.forEach((s, expectedPos) => {
            const srcName = s.parsed.name || s.text;
            const srcTokens = _tok(srcName);
            let bestIdx = -1; let bestScore = 0;
            // Window: try expected first, then ±1, ±2
            const candidates = [expectedPos, expectedPos - 1, expectedPos + 1, expectedPos - 2, expectedPos + 2];
            for (const ci of candidates) {
                if (ci < 0 || ci >= hubIngs.length) continue;
                if (usedHubIdxs.has(ci)) continue;
                const h = hubIngs[ci];
                const hubText = (h.name || '') + ' ' + (h._rawName || '');
                const sc = _sim(srcName, hubText);
                if (sc > bestScore || (sc === bestScore && ci === expectedPos)) { bestScore = sc; bestIdx = ci; }
            }
            // If no good match in window, fall back to ANY unused Hub ingredient with name similarity ≥ 0.5
            if (bestScore < 0.3) {
                for (let ci = 0; ci < hubIngs.length; ci++) {
                    if (usedHubIdxs.has(ci)) continue;
                    const h = hubIngs[ci];
                    const hubText = (h.name || '') + ' ' + (h._rawName || '');
                    const sc = _sim(srcName, hubText);
                    if (sc > bestScore) { bestScore = sc; bestIdx = ci; }
                }
            }
            const matchedHub = bestIdx >= 0 && bestScore >= 0.2 ? hubIngs[bestIdx] : null;
            if (matchedHub) usedHubIdxs.add(bestIdx);
            const issues = window._classifyDrift(s, matchedHub, bestIdx, inv);
            if (!matchedHub) {
                issues.push({ kind: 'missing-in-hub', severity: 'med', reason: 'Source ingredient has no matching Hub ingredient: "' + s.text + '"', proposed: { addRaw: s } });
            }
            pairs.push({ idx: bestIdx >= 0 ? bestIdx : -1, sourceIdx: expectedPos, source: s, hub: matchedHub, hubIdx: bestIdx, issues });
        });
        // Now scan Hub ingredients that weren't paired — phantoms / extras
        hubIngs.forEach((h, hi) => {
            if (usedHubIdxs.has(hi)) return;
            // Source had an empty separator at roughly this position?
            const text = (h.name || '') + ' ' + (h._rawName || '');
            const isPhantom = /(stir|shake|garnish|martini glass|serve|combine|topped|skewer|method|add the|add to|build|strain)/i.test(text);
            pairs.push({
                idx: hi,
                hubIdx: hi,
                sourceIdx: -1,
                source: null,
                hub: h,
                issues: [{
                    kind: isPhantom ? 'phantom' : 'extra-in-hub',
                    severity: isPhantom ? 'high' : 'low',
                    reason: isPhantom ? 'Looks like instruction text imported as ingredient (no matching source line).' : 'Hub has an ingredient not present in source — possible manual addition.',
                    proposed: isPhantom ? { drop: true } : {}
                }]
            });
        });
        // Sort pairs by hubIdx for readability
        pairs.sort((a, b) => {
            const ai = a.hubIdx === undefined || a.hubIdx < 0 ? (a.sourceIdx ?? 9999) : a.hubIdx;
            const bi = b.hubIdx === undefined || b.hubIdx < 0 ? (b.sourceIdx ?? 9999) : b.hubIdx;
            return ai - bi;
        });
        const totalIssues = pairs.reduce((sum, p) => sum + p.issues.length, 0);
        report.matched.push({ hubId: hub.id, hubName: hub.name, sourceName: src.name, pairs, totalIssues });
    });

    hubRecipes.forEach(r => {
        if (!matchedHubIds.has(r.id)) report.hubOnly.push({ id: r.id, name: r.name });
    });

    return report;
};

// =============================================================================
// VIEW
// =============================================================================
window._reconcilePage = 0;
window._reconcileFilter = 'all'; // all | high | drift-only

window.renderReconcileView = function() {
    const state = window._reconcileState;
    const E = window.esc;

    if (!state) {
        return '<div style="max-width:900px;margin:auto;">' +
            '<h2 style="margin:0 0 4px;">🔄 Reconcile from Source</h2>' +
            '<p style="font-size:13px;color:var(--text-muted);margin:0 0 16px;">Upload your <strong>Recipe Keeper</strong> HTML export. The tool will compare every recipe against the Hub and let you review &amp; accept fixes per row. Your links, confirmed quantities, prices, allergens &amp; methods are <strong>never touched</strong> automatically.</p>' +
            '<div class="card" style="padding:24px;border-top:4px solid var(--purple);text-align:center;">' +
                '<input type="file" id="reconcile-file" accept=".html,.htm" style="display:none;" onchange="window._reconcileLoadFile(event)">' +
                '<button onclick="document.getElementById(\'reconcile-file\').click()" class="btn btn-purple" style="font-size:16px;padding:14px 32px;">📂 Select Recipe Keeper HTML</button>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:10px;">Parsing happens entirely in your browser. Nothing is sent anywhere.</div>' +
                '<div id="reconcile-status" style="margin-top:12px;font-size:12px;"></div>' +
            '</div>' +
            '<div class="card" style="padding:14px;margin-top:14px;border-left:3px solid var(--green);">' +
                '<strong style="font-size:13px;color:var(--green);">Safety net</strong>' +
                '<ul style="font-size:12px;color:var(--text-muted);margin:8px 0 0 18px;line-height:1.6;">' +
                    '<li>Before any change is committed, the entire current state is auto-backed up to <code>_preReconcileBackup</code> in localStorage.</li>' +
                    '<li>Inventory links (<code>ing.ref</code>), confirmed quantities (<code>_qtyConfirmed</code>), recipe prices, allergens &amp; methods are preserved.</li>' +
                    '<li>You review each proposed change and click Accept. Nothing applies until you commit.</li>' +
                '</ul>' +
            '</div>' +
        '</div>';
    }

    const report = state.report;
    const filter = window._reconcileFilter;
    const visible = report.matched.filter(m => {
        if (filter === 'all') return m.totalIssues > 0;
        if (filter === 'high') return m.pairs.some(p => p.issues.some(i => i.severity === 'high'));
        if (filter === 'drift-only') return m.pairs.some(p => p.issues.some(i => ['qty-drift','qty-or-unit-drift','unit-mismatch'].includes(i.kind)));
        return true;
    });
    const PAGE_SIZE = 10;
    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const page = Math.min(window._reconcilePage, totalPages - 1);
    const pageItems = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Aggregate counts for header
    const totalIssues = report.matched.reduce((s, m) => s + m.totalIssues, 0);
    const recipesWithIssues = report.matched.filter(m => m.totalIssues > 0).length;
    const highSev = report.matched.reduce((s, m) => s + m.pairs.reduce((a, p) => a + p.issues.filter(i => i.severity === 'high').length, 0), 0);
    const linkSugg = report.matched.reduce((s, m) => s + m.pairs.reduce((a, p) => a + p.issues.filter(i => i.kind === 'unlinked-could-link').length, 0), 0);
    const wrongLink = report.matched.reduce((s, m) => s + m.pairs.reduce((a, p) => a + p.issues.filter(i => i.kind === 'wrong-link-suspect').length, 0), 0);
    const phantoms = report.matched.reduce((s, m) => s + m.pairs.reduce((a, p) => a + p.issues.filter(i => i.kind === 'phantom').length, 0), 0);

    let html = '<div style="max-width:1100px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">🔄 Reconcile from Source</h2>' +
            '<div style="font-size:12px;color:var(--text-muted);">' + report.matched.length + ' recipes matched · ' + report.sourceOnly.length + ' source-only · ' + report.hubOnly.length + ' Hub-only · <strong>' + recipesWithIssues + '</strong> recipes need review · <strong>' + totalIssues + '</strong> total issues</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<button onclick="window._reconcileBackupNow()" class="btn btn-outline" style="font-size:12px;border-color:var(--green);color:var(--green);">💾 Backup Snapshot</button>' +
                '<button onclick="window._reconcileReset()" class="btn btn-outline" style="font-size:12px;color:var(--red);border-color:var(--red);">✕ Discard &amp; Start Over</button>' +
            '</div>' +
        '</div>';

    // KPI tiles
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">' +
        _rcTile('Recipes to review', recipesWithIssues, 'var(--blue)') +
        _rcTile('High-severity', highSev, 'var(--red)') +
        _rcTile('Wrong-link suspects', wrongLink, 'var(--orange)') +
        _rcTile('Unlinked → link', linkSugg, 'var(--green)') +
        _rcTile('Phantom rows', phantoms, 'var(--red)') +
    '</div>';

    // Filter chips
    html += '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;">' +
        '<span style="font-size:11px;color:var(--text-muted);">Filter:</span>' +
        _rcChip('all', 'All issues', recipesWithIssues) +
        _rcChip('high', 'High severity only', report.matched.filter(m => m.pairs.some(p => p.issues.some(i => i.severity === 'high'))).length) +
        _rcChip('drift-only', 'Qty/unit drift only', report.matched.filter(m => m.pairs.some(p => p.issues.some(i => ['qty-drift','qty-or-unit-drift','unit-mismatch'].includes(i.kind)))).length) +
    '</div>';

    // Recipe cards
    pageItems.forEach(m => {
        html += _renderRecipeReconcileCard(m);
    });

    // Pagination
    if (totalPages > 1) {
        html += '<div style="display:flex;justify-content:center;gap:10px;margin:16px 0;align-items:center;">' +
            (page > 0 ? '<button onclick="window._reconcilePage=' + (page-1) + ';window.showView(\'reconcile\')" class="btn btn-outline" style="font-size:12px;">← Prev</button>' : '') +
            '<span style="font-size:12px;color:var(--text-muted);">Page ' + (page+1) + ' / ' + totalPages + '</span>' +
            (page < totalPages - 1 ? '<button onclick="window._reconcilePage=' + (page+1) + ';window.showView(\'reconcile\')" class="btn btn-outline" style="font-size:12px;">Next →</button>' : '') +
        '</div>';
    }

    // Source-only recipes (to import as new)
    if (report.sourceOnly.length > 0) {
        html += '<details class="card" style="margin-top:16px;padding:0;border-top:3px solid var(--purple);">' +
            '<summary style="cursor:pointer;padding:12px 16px;font-weight:600;color:var(--purple);">📥 Recipes in source not in Hub (' + report.sourceOnly.length + ')</summary>' +
            '<div style="padding:12px 16px;font-size:12px;color:var(--text-muted);">' +
                'These exist in your Recipe Keeper export but not in the Hub. ' +
                '<button onclick="window._reconcileImportMissing()" class="btn btn-purple" style="font-size:11px;padding:4px 12px;margin-left:8px;">Import all ' + report.sourceOnly.length + ' as new</button>' +
                '<div style="max-height:200px;overflow-y:auto;margin-top:10px;">' +
                    report.sourceOnly.slice(0, 100).map(s => '<div style="font-size:12px;padding:3px 0;border-bottom:1px dashed var(--border);">• ' + E(s.name) + '</div>').join('') +
                '</div>' +
            '</div>' +
        '</details>';
    }
    html += '</div>';
    return html;
};

function _rcTile(label, count, color) {
    return '<div class="card" style="padding:12px;text-align:center;border-top:3px solid ' + color + ';">' +
        '<div style="font-size:22px;font-weight:700;color:' + color + ';">' + count + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">' + window.esc(label) + '</div></div>';
}

function _rcChip(key, label, count) {
    const active = window._reconcileFilter === key;
    return '<span onclick="window._reconcileFilter=\'' + key + '\';window._reconcilePage=0;window.showView(\'reconcile\')" class="tag-pill ' + (active ? 'active' : '') + '" style="cursor:pointer;">' + window.esc(label) + ' <span style="opacity:0.6;">(' + count + ')</span></span>';
}

function _renderRecipeReconcileCard(m) {
    const E = window.esc;
    const sevColor = { high: 'var(--red)', med: 'var(--orange)', low: 'var(--text-muted)' };
    const rows = m.pairs.filter(p => p.issues.length > 0).map(p => {
        const srcText = p.source ? (p.source.isEmpty ? '<em style="color:var(--text-muted);">(empty / separator)</em>' : E(p.source.text)) : '<em style="color:var(--text-muted);">— no source row —</em>';
        const hubText = p.hub
            ? (p.hub.type === 'inv' ? '🔗 ' : p.hub.type === 'batch' ? '📦 ' : '◯ ') + E(p.hub.name || '?') + ' · ' + E(String(p.hub.qty || 0)) + ' ' + E(p.hub.unit || '')
            : '<em style="color:var(--text-muted);">— no hub row —</em>';
        const issueRows = p.issues.map((iss, ii) => {
            const decisionKey = m.hubId + '|' + p.idx + '|' + ii;
            const decided = window._reconcileDecisions && window._reconcileDecisions[decisionKey];
            const propLabel = _proposedActionLabel(iss);
            const decisionBtns = '<button onclick="window._rcAccept(\'' + decisionKey + '\')" class="btn btn-outline" style="font-size:10px;padding:3px 8px;color:var(--green);border-color:var(--green);' + (decided==='accept'?'background:var(--green);color:#fff;':'') + '">✓ Accept</button>' +
                '<button onclick="window._rcSkip(\'' + decisionKey + '\')" class="btn btn-outline" style="font-size:10px;padding:3px 8px;color:var(--text-muted);border-color:var(--text-muted);margin-left:4px;' + (decided==='skip'?'background:var(--text-muted);color:#fff;':'') + '">Skip</button>';
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--border);">' +
                '<div style="flex:1;font-size:11px;"><strong style="color:' + (sevColor[iss.severity] || 'var(--text-muted)') + ';">' + iss.kind + '</strong> · ' + E(iss.reason) + (propLabel ? '<br><span style="color:var(--green);">→ ' + propLabel + '</span>' : '') + '</div>' +
                '<div>' + decisionBtns + '</div>' +
            '</div>';
        }).join('');
        return '<div style="padding:8px;border-bottom:1px solid var(--border);">' +
            '<div style="display:flex;gap:8px;font-size:12px;margin-bottom:4px;">' +
                '<div style="flex:1;"><strong style="color:var(--blue);font-size:10px;text-transform:uppercase;">Source</strong><br>' + srcText + '</div>' +
                '<div style="flex:1;"><strong style="color:var(--green);font-size:10px;text-transform:uppercase;">Hub</strong><br>' + hubText + '</div>' +
            '</div>' +
            issueRows +
        '</div>';
    }).join('');

    return '<div class="card" style="padding:0;margin-bottom:14px;overflow:hidden;border-left:3px solid ' + (m.pairs.some(p => p.issues.some(i => i.severity === 'high')) ? 'var(--red)' : 'var(--orange)') + ';">' +
        '<div style="padding:12px 16px;background:#111;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
            '<div><strong style="font-size:14px;cursor:pointer;color:var(--blue);" onclick="window.viewRecipe(\'' + m.hubId + '\')">' + E(m.hubName) + '</strong>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + m.totalIssues + ' issue' + (m.totalIssues !== 1 ? 's' : '') + ' · ' + m.pairs.length + ' ingredient pairs</div></div>' +
            '<div style="display:flex;gap:6px;">' +
                '<button onclick="window._rcAcceptAllForRecipe(\'' + m.hubId + '\')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;color:var(--green);border-color:var(--green);">✓ Accept All in This Recipe</button>' +
                '<button onclick="window._rcSkipAllForRecipe(\'' + m.hubId + '\')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;color:var(--text-muted);">Skip All</button>' +
                '<button onclick="window._rcCommitRecipe(\'' + m.hubId + '\')" class="btn btn-green" style="font-size:11px;padding:4px 10px;">💾 Apply Accepted</button>' +
            '</div>' +
        '</div>' +
        rows +
    '</div>';
}

function _proposedActionLabel(iss) {
    const p = iss.proposed || {};
    if (p.drop) return 'Remove this row';
    if (p.unlink) return 'Unlink (suspected wrong match — review)';
    if (p.linkInvId) return 'Link to inventory item · qty ' + (p.qty || 1) + ' ' + (p.unit || '');
    if (p.addRaw) return 'Add as new raw ingredient';
    if (p.qty !== undefined || p.unit !== undefined) {
        const parts = [];
        if (p.qty !== undefined) parts.push('qty → ' + p.qty);
        if (p.unit !== undefined) parts.push('unit → ' + p.unit);
        return 'Update: ' + parts.join(', ');
    }
    return '';
}

// =============================================================================
// DECISIONS + COMMIT
// =============================================================================
window._reconcileDecisions = window._reconcileDecisions || {};

window._rcAccept = (key) => { window._reconcileDecisions[key] = 'accept'; window.showView('reconcile'); };
window._rcSkip = (key) => { window._reconcileDecisions[key] = 'skip'; window.showView('reconcile'); };

window._rcAcceptAllForRecipe = (hubId) => {
    const m = window._reconcileState.report.matched.find(x => x.hubId === hubId);
    if (!m) return;
    m.pairs.forEach(p => p.issues.forEach((iss, ii) => {
        window._reconcileDecisions[hubId + '|' + p.idx + '|' + ii] = 'accept';
    }));
    window.showView('reconcile');
};
window._rcSkipAllForRecipe = (hubId) => {
    const m = window._reconcileState.report.matched.find(x => x.hubId === hubId);
    if (!m) return;
    m.pairs.forEach(p => p.issues.forEach((iss, ii) => {
        window._reconcileDecisions[hubId + '|' + p.idx + '|' + ii] = 'skip';
    }));
    window.showView('reconcile');
};

window._rcCommitRecipe = (hubId) => {
    const m = window._reconcileState.report.matched.find(x => x.hubId === hubId);
    if (!m) return window.showToast('Recipe not found.', 'error');
    const recipe = (window.recipes || []).find(x => x.id === hubId);
    if (!recipe) return window.showToast('Hub recipe not found.', 'error');
    // Backup before mutate
    window._reconcileBackupNow();
    let changes = 0;
    const dropIdxs = [];
    const adds = [];
    m.pairs.forEach(p => {
        p.issues.forEach((iss, ii) => {
            const dec = window._reconcileDecisions[hubId + '|' + p.idx + '|' + ii];
            if (dec !== 'accept') return;
            const prop = iss.proposed || {};
            // Resolve the LIVE hub ingredient via hubIdx (not the snapshot reference)
            const hubIdx = p.hubIdx;
            const liveHub = (hubIdx !== undefined && hubIdx >= 0) ? recipe.ingredients[hubIdx] : null;

            if (prop.drop && liveHub) {
                dropIdxs.push(hubIdx); changes++;
                return;
            }
            if (prop.unlink && liveHub) {
                const oldName = liveHub._rawName || liveHub.name || '';
                liveHub.type = 'raw'; liveHub.ref = null;
                liveHub.name = oldName + ' (unlinked – source mismatch)';
                liveHub._rawName = oldName;
                changes++;
                return;
            }
            if (prop.linkInvId && liveHub && liveHub.type === 'raw') {
                const inv = (window.inventoryItems || []).find(i => i.id === prop.linkInvId);
                if (inv) {
                    const sourceText = liveHub._rawName || liveHub.name || '';
                    liveHub.type = 'inv'; liveHub.ref = inv.id;
                    liveHub.name = inv.recipeName || inv.name;
                    liveHub.qty = prop.qty || liveHub.qty || 1;
                    liveHub.unit = prop.unit || inv.useUnit || liveHub.unit || 'unit';
                    liveHub._rawName = sourceText;
                    changes++;
                }
                return;
            }
            if (prop.addRaw && !liveHub) {
                const s = prop.addRaw;
                adds.push({ type: 'raw', name: s.parsed.name || s.text, qty: s.parsed.qty || 0, unit: s.parsed.unit || '', _rawName: s.text });
                changes++;
                return;
            }
            if ((prop.qty !== undefined || prop.unit !== undefined) && liveHub) {
                if (prop.qty !== undefined) liveHub.qty = prop.qty;
                if (prop.unit !== undefined) liveHub.unit = prop.unit;
                // DO NOT touch _qtyConfirmed — user's explicit confirmation overrides
                changes++;
                return;
            }
        });
    });
    dropIdxs.sort((a, b) => b - a).forEach(i => { recipe.ingredients.splice(i, 1); });
    adds.forEach(a => recipe.ingredients.push(a));
    // Recalc + save
    if (typeof window.recalcAllCosts === 'function') window.recalcAllCosts();
    else window.saveToDisk();
    // Audit
    if (typeof window.logAudit === 'function') window.logAudit('recipes', 'reconcile-commit', recipe.id, changes + ' changes applied from source reconcile');
    window.showToast('✅ ' + changes + ' changes applied to ' + recipe.name, 'success');
    // Re-run report against fresh state for visual confirmation
    window._reconcileState.report = window._buildReconcileReport(window._reconcileState.parsed);
    window.showView('reconcile');
};

// =============================================================================
// BACKUP + LIFECYCLE
// =============================================================================
window._reconcileBackupNow = () => {
    try {
        const payload = Object.fromEntries((window.saveKeys || []).map(k => [k, window[k]]));
        const json = JSON.stringify(payload);
        localStorage.setItem('_preReconcileBackup', json);
        localStorage.setItem('_preReconcileBackupTs', new Date().toISOString());
        // Trigger a downloadable file too
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'HobartHub_PreReconcile_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        window.showToast('💾 Backup saved (localStorage + download).', 'success');
    } catch(e) { console.error('Backup failed', e); window.showToast('Backup failed: ' + e.message, 'error'); }
};

window._reconcileReset = () => {
    window.confirmAction({
        title: 'Discard reconcile session?',
        message: 'This clears the parsed source and all pending accept/skip decisions. Your data is not affected.',
        confirmLabel: 'Discard',
        tier: 'standard',
        onConfirm: () => {
            window._reconcileState = null;
            window._reconcileDecisions = {};
            window._reconcilePage = 0;
            window.showView('reconcile');
        }
    });
};

window._reconcileLoadFile = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const statusEl = document.getElementById('reconcile-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--blue);">⏳ Parsing…</span>';
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = window._parseRecipeKeeperHtml(e.target.result);
            if (parsed.length === 0) {
                if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);">No recipes found. Is this a Recipe Keeper HTML export?</span>';
                return;
            }
            const report = window._buildReconcileReport(parsed);
            window._reconcileState = { parsed, report, fileName: file.name, loadedAt: new Date().toISOString() };
            window._reconcileDecisions = {};
            window._reconcilePage = 0;
            window.showView('reconcile');
        } catch(err) {
            console.error(err);
            if (statusEl) statusEl.innerHTML = '<span style="color:var(--red);">Parse error: ' + window.esc(err.message) + '</span>';
        }
    };
    reader.readAsText(file);
};

window._reconcileImportMissing = () => {
    const state = window._reconcileState;
    if (!state || !state.report.sourceOnly.length) return;
    window.confirmAction({
        title: 'Import ' + state.report.sourceOnly.length + ' new recipes?',
        message: 'These recipes exist in the source export but not in the Hub. They\'ll be imported as new recipes with raw ingredients (you can link them after).',
        confirmLabel: 'Import ' + state.report.sourceOnly.length,
        tier: 'standard',
        onConfirm: () => {
            window._reconcileBackupNow();
            let count = 0;
            state.report.sourceOnly.forEach(src => {
                const ings = src.ingredients.filter(i => !i.isEmpty).map(i => ({
                    type: 'raw',
                    name: i.parsed.name || i.text,
                    qty: i.parsed.qty || 0,
                    unit: i.parsed.unit || '',
                    _rawName: i.text
                }));
                window.recipes.push({
                    id: window.generateId('rec'),
                    name: src.name,
                    posAlias: '',
                    type: window._courseToType ? window._courseToType(src.course) : 'Menu',
                    station: window._courseToStation ? window._courseToStation(src.course) : 'Kitchen',
                    status: 'Development', course: src.course || '',
                    ingredients: ings, cost: 0, gp: 0, price: 0,
                    yieldQty: 1, yieldUnit: 'Portion',
                    method: '', allergens: [], photo: '', videoUrl: '', archived: false,
                    createdAt: new Date().toISOString(), modifiedAt: new Date().toISOString()
                });
                count++;
            });
            window.saveToDisk();
            window.showToast('📥 Imported ' + count + ' recipes (status: Development).', 'success');
            // Re-run report
            state.report = window._buildReconcileReport(state.parsed);
            window.showView('reconcile');
        }
    });
};
