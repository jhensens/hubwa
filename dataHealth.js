// --- HOBART HUB: Data Health Module ---
// Read-only audits: orphan recipe refs, batch cycles, missing _rawName, duplicate suppliers.
// All fixes are opt-in (one-click apply per row).

window.renderDataHealthView = function() {
    var E = window.esc;
    var recipes = window.recipes || [];
    var inv = window.inventoryItems || [];
    var invById = {}; inv.forEach(function(i) { invById[i.id] = i; });
    var recipeById = {}; recipes.forEach(function(r) { recipeById[r.id] = r; });

    // ── Audit 1: Orphan recipe refs (ing.type='inv'/'batch' with missing ref target) ──
    var orphanRefs = [];
    recipes.forEach(function(r) {
        if (r.archived) return;
        (r.ingredients || []).forEach(function(ing, idx) {
            if (ing.type === 'inv' && ing.ref && !invById[ing.ref]) {
                orphanRefs.push({ recipe: r, ingIdx: idx, ing: ing, kind: 'inv' });
            } else if (ing.type === 'batch' && ing.ref && !recipeById[ing.ref]) {
                orphanRefs.push({ recipe: r, ingIdx: idx, ing: ing, kind: 'batch' });
            }
        });
    });

    // ── Audit 2: Batch cycles (A → B → A) ──
    var cycles = [];
    var detectCycle = function(rootId, currentId, path) {
        var r = recipeById[currentId]; if (!r) return;
        var batchIngs = (r.ingredients || []).filter(function(i) { return i.type === 'batch' && i.ref; });
        for (var i = 0; i < batchIngs.length; i++) {
            var nextId = batchIngs[i].ref;
            if (nextId === rootId) {
                cycles.push({ root: recipeById[rootId], chain: path.concat([currentId, rootId]) });
                return;
            }
            if (path.indexOf(nextId) === -1) detectCycle(rootId, nextId, path.concat([currentId]));
        }
    };
    recipes.forEach(function(r) { if (!r.archived && r.type === 'Batch') detectCycle(r.id, r.id, []); });
    // de-dup
    var seenCycle = new Set(); var uniqueCycles = [];
    cycles.forEach(function(c) {
        var key = c.chain.slice().sort().join(',');
        if (!seenCycle.has(key)) { seenCycle.add(key); uniqueCycles.push(c); }
    });

    // ── Audit 3: Linked ingredients missing _rawName ──
    var missingRaw = [];
    recipes.forEach(function(r) {
        if (r.archived) return;
        (r.ingredients || []).forEach(function(ing) {
            if ((ing.type === 'inv' || ing.type === 'batch') && !ing._rawName) {
                missingRaw.push({ recipe: r, ing: ing });
            }
        });
    });

    // ── Audit 4: Duplicate supplier names (case-insensitive) ──
    var supplierGroups = {};
    (window.suppliers || []).forEach(function(s, i) {
        var key = (s.name || '').trim().toLowerCase();
        if (!key) return;
        (supplierGroups[key] = supplierGroups[key] || []).push({ supplier: s, idx: i });
    });
    var dupSuppliers = Object.keys(supplierGroups).filter(function(k) { return supplierGroups[k].length > 1; }).map(function(k) { return supplierGroups[k]; });

    // ── Audit 5: Inventory items with $0 price used in recipes ──
    var zeroPriceUsed = [];
    inv.forEach(function(i) {
        if (i.archived) return;
        if (Number(i.price || 0) !== 0) return;
        var usedBy = recipes.filter(function(r) { return !r.archived && (r.ingredients || []).some(function(ing) { return ing.type === 'inv' && ing.ref === i.id; }); });
        if (usedBy.length > 0) zeroPriceUsed.push({ item: i, usedBy: usedBy });
    });

    var totalIssues = orphanRefs.length + uniqueCycles.length + missingRaw.length + dupSuppliers.length + zeroPriceUsed.length;

    var html = '<div style="max-width:1000px;margin:auto;">' +
        '<h2 style="margin:0 0 4px 0;">🩺 Data Health</h2>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-bottom:18px;">Read-only audits that catch silent corruption. Run anytime — applying fixes is optional.</div>';

    if (totalIssues === 0) {
        html += '<div class="card" style="padding:40px;text-align:center;border-top:3px solid var(--green);">' +
            '<div style="font-size:48px;">✨</div>' +
            '<h3 style="color:var(--green);margin:10px 0 0;">All clean — no data issues found.</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;margin:8px 0 0;">' + recipes.length + ' recipes · ' + inv.length + ' inventory items · ' + (window.suppliers||[]).length + ' suppliers</p></div></div>';
        return html;
    }

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px;">' +
        _hcTile('Orphan refs', orphanRefs.length, 'var(--red)') +
        _hcTile('Batch cycles', uniqueCycles.length, 'var(--red)') +
        _hcTile('Missing _rawName', missingRaw.length, 'var(--orange)') +
        _hcTile('Duplicate suppliers', dupSuppliers.length, 'var(--orange)') +
        _hcTile('$0 in use', zeroPriceUsed.length, 'var(--red)') +
    '</div>';

    // Orphan refs
    if (orphanRefs.length > 0) {
        var rows = orphanRefs.slice(0, 100).map(function(o, i) {
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:6px 8px;font-size:12px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe(\'' + o.recipe.id + '\')">' + E(o.recipe.name) + '</strong></td>' +
                '<td style="padding:6px 8px;font-size:12px;color:var(--text-muted);">' + E(o.ing.name || '?') + ' <code style="font-size:10px;">(' + o.kind + ' ref → ' + E(o.ing.ref) + ')</code></td>' +
                '<td style="padding:6px 8px;text-align:right;"><button onclick="window._dhConvertOrphan(\'' + o.recipe.id + '\',' + o.ingIdx + ')" class="btn btn-outline" style="font-size:10px;padding:2px 8px;color:var(--orange);border-color:var(--orange);">Convert to raw</button></td>' +
            '</tr>';
        }).join('');
        html += _hcSection('🔗 Orphan recipe refs (' + orphanRefs.length + ')', 'These reference inventory/batch IDs that no longer exist. Costing silently returns $0.', rows, 'var(--red)');
    }

    // Cycles
    if (uniqueCycles.length > 0) {
        var rows = uniqueCycles.map(function(c) {
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:6px 8px;font-size:12px;"><strong>' + E(c.root ? c.root.name : '?') + '</strong></td>' +
                '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">' + c.chain.map(function(id) { return recipeById[id] ? recipeById[id].name : id; }).join(' → ') + '</td>' +
            '</tr>';
        }).join('');
        html += _hcSection('♻️ Batch cycles (' + uniqueCycles.length + ')', 'Recipe references form a loop — cost calculation may hang or recurse. Manual edit required.', rows, 'var(--red)');
    }

    // Missing _rawName
    if (missingRaw.length > 0) {
        var sample = missingRaw.slice(0, 30).map(function(m) {
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:6px 8px;font-size:12px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe(\'' + m.recipe.id + '\')">' + E(m.recipe.name) + '</strong></td>' +
                '<td style="padding:6px 8px;font-size:12px;color:var(--text-muted);">' + E(m.ing.name || '?') + '</td>' +
            '</tr>';
        }).join('');
        html += _hcSection('📝 Missing _rawName (' + missingRaw.length + ')', 'Linked ingredients without _rawName lose the original recipe text — auto-reparse won\'t work for these.', sample, 'var(--orange)');
    }

    // Duplicate suppliers
    if (dupSuppliers.length > 0) {
        var rows = dupSuppliers.map(function(group, gi) {
            return group.map(function(s, i) {
                return '<tr style="border-bottom:' + (i === group.length - 1 ? '2px solid var(--border)' : '1px dashed var(--border)') + ';">' +
                    '<td style="padding:6px 8px;font-size:12px;">' + (i === 0 ? '<strong>' + E(s.supplier.name) + '</strong>' : '<span style="color:var(--text-muted);padding-left:14px;">↳ ' + E(s.supplier.name) + '</span>') + '</td>' +
                    '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">' + (inv.filter(function(it) { return (it.supplier||'') === s.supplier.name; }).length) + ' items</td>' +
                '</tr>';
            }).join('');
        }).join('');
        html += _hcSection('🚚 Duplicate suppliers (' + dupSuppliers.length + ' groups)', 'Same supplier name with different casing or whitespace. Use Bulk Supplier Reassign to consolidate.', rows, 'var(--orange)');
    }

    // Zero-price items in use
    if (zeroPriceUsed.length > 0) {
        var rows = zeroPriceUsed.slice(0, 50).map(function(z) {
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:6px 8px;font-size:12px;"><strong>' + E(z.item.name) + '</strong></td>' +
                '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">' + z.usedBy.length + ' recipe' + (z.usedBy.length === 1 ? '' : 's') + ' costing $0 from this ingredient</td>' +
                '<td style="padding:6px 8px;text-align:right;"><button onclick="window.editInvItem(\'' + z.item.id + '\')" class="btn btn-outline" style="font-size:10px;padding:2px 8px;">Set price</button></td>' +
            '</tr>';
        }).join('');
        html += _hcSection('💵 $0 price in use (' + zeroPriceUsed.length + ')', 'Inventory items priced at $0 but referenced by recipes — those recipes silently cost $0.', rows, 'var(--red)');
    }

    html += '</div>';
    return html;
};

function _hcTile(label, count, color) {
    return '<div class="card" style="padding:12px;text-align:center;border-top:3px solid ' + color + ';">' +
        '<div style="font-size:22px;font-weight:700;color:' + color + ';">' + count + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">' + window.esc(label) + '</div></div>';
}

function _hcSection(title, blurb, rows, color) {
    return '<details open class="card" style="padding:0;margin-bottom:14px;border-top:3px solid ' + color + ';overflow:hidden;">' +
        '<summary style="cursor:pointer;padding:10px 14px;font-weight:700;color:' + color + ';">' + title + '</summary>' +
        '<div style="padding:6px 14px 0;font-size:11px;color:var(--text-muted);">' + blurb + '</div>' +
        '<table style="width:100%;border-collapse:collapse;margin-top:8px;">' + '<tbody>' + rows + '</tbody></table>' +
    '</details>';
}

window._dhConvertOrphan = function(recipeId, ingIdx) {
    var r = (window.recipes || []).find(function(x) { return x.id === recipeId; });
    if (!r || !r.ingredients[ingIdx]) return;
    var ing = r.ingredients[ingIdx];
    window.confirmAction({
        title: 'Convert to Raw',
        message: 'Convert orphan ingredient <strong>' + window.esc(ing.name || '?') + '</strong> in <strong>' + window.esc(r.name) + '</strong> to a raw ingredient? Recipe will continue to display the name but cost $0.',
        confirmLabel: 'Convert',
        tier: 'standard',
        onConfirm: function() {
            r.ingredients[ingIdx] = { type: 'raw', name: ing._rawName || ing.name || 'Orphan ingredient', qty: 0, unit: '' };
            if (window._recalcRecipe) window._recalcRecipe(r);
            window.saveToDisk();
            window.showToast('Converted to raw.');
            window.showView('data-health');
        }
    });
};
