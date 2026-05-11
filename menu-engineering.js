// --- HOBART HUB: Menu Engineering Module ---
// Price Alerts, Margins, Bulk HTML Import, AI Recipe Import, Batch Linker, Menu Engineering Matrix, AI Menu Advisor

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
    menuRecipes.forEach(recipe => window._recalcRecipe(recipe));
    const sorted=[...menuRecipes].sort((a,b)=>a.gp-b.gp);
    const below=sorted.filter(r=>r.gp<GP_TARGET);
    const above=sorted.filter(r=>r.gp>=GP_TARGET);
    const avgGp=menuRecipes.length>0?(menuRecipes.reduce((s,r)=>s+r.gp,0)/menuRecipes.length).toFixed(1):0;
    const stationColor={'Kitchen':'var(--orange)','Bar':'var(--blue)','Prep':'var(--purple)'};
    const _roundUp = v => Math.ceil(v * 2) / 2; // round to nearest $0.50
    const rowHtml=(recipes)=>recipes.map(r=>{
        const gpColor=r.gp>=GP_TARGET?'var(--green)':r.gp>=GP_TARGET-5?'var(--orange)':'var(--red)';
        // Suggested price for GP_TARGET: cost / (1 - GP_TARGET/100), rounded up to $0.50
        const _suggested = (Number(r.cost||0) > 0 && r.gp < GP_TARGET) ? _roundUp(Number(r.cost) / (1 - GP_TARGET/100)) : null;
        const suggestCell = (_suggested && _suggested > Number(r.price||0))
            ? `<button onclick="window._applySuggestedPrice('${r.id}', ${_suggested})" class="btn btn-outline" style="font-size:11px;padding:4px 10px;border-color:var(--green);color:var(--green);" title="Set price to $${_suggested.toFixed(2)} (${GP_TARGET}% GP)">→ $${_suggested.toFixed(2)}</button>`
            : '<span style="font-size:11px;color:var(--text-muted);">—</span>';
        return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:12px 15px;"><strong style="cursor:pointer;color:var(--blue);" onclick="window.viewRecipe('${r.id}')">${esc(r.name)}</strong> <small style="color:${stationColor[r.station||'Kitchen']};font-size:11px;">${r.station||'Kitchen'}</small></td>
            <td style="padding:12px 15px;font-size:13px;color:var(--brand-accent);">$${Number(r.cost||0).toFixed(2)}</td>
            <td style="padding:12px 15px;font-size:13px;">$${Number(r.price||0).toFixed(2)}</td>
            <td style="padding:12px 15px;min-width:140px;"><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;background:var(--border);border-radius:4px;height:8px;overflow:hidden;"><div style="width:${Math.min(100,Math.max(0,r.gp))}%;background:${gpColor};height:100%;border-radius:4px;"></div></div><strong style="color:${gpColor};font-size:14px;min-width:38px;">${r.gp}%</strong></div></td>
            <td style="padding:12px 15px;text-align:center;">${suggestCell}</td>
            <td style="padding:12px 15px;text-align:right;"><button onclick="window.editRecipeForm('${r.id}')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Edit</button></td>
        </tr>`;
    }).join('');
    if (!window._applySuggestedPrice) {
        window._applySuggestedPrice = (rid, newPrice) => {
            const r = (window.recipes||[]).find(x => x.id === rid);
            if (!r) return;
            window.confirmAction({
                title: '💰 Apply Suggested Price',
                message: 'Set <strong>' + window.esc(r.name) + '</strong> price to <strong>$' + Number(newPrice).toFixed(2) + '</strong>?<br><small style="color:var(--text-muted);">Current: $' + Number(r.price||0).toFixed(2) + ' · Target: ' + GP_TARGET + '% GP</small>',
                confirmLabel: 'Apply $' + Number(newPrice).toFixed(2),
                tier: 'standard',
                onConfirm: () => {
                    r.price = Number(newPrice);
                    if (window._recalcRecipe) window._recalcRecipe(r);
                    r.modifiedAt = new Date().toISOString();
                    window.saveToDisk();
                    window.showToast('✅ ' + r.name + ' → $' + Number(newPrice).toFixed(2) + ' (GP ' + r.gp + '%)', 'success');
                    window.showView('margins');
                }
            });
        };
    }
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
        ${below.length>0?`<div class="card" style="padding:0;overflow:visible;margin-bottom:20px;border-top:4px solid var(--red);"><div style="padding:15px 20px;background:rgba(239,68,68,0.08);border-bottom:1px solid var(--border);"><h3 style="margin:0;color:var(--red);">⚠️ Below ${GP_TARGET}% (${below.length})</h3></div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#111;font-size:12px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:10px 15px;text-align:left;">Recipe</th><th style="padding:10px 15px;text-align:left;">Cost</th><th style="padding:10px 15px;text-align:left;">Sell</th><th style="padding:10px 15px;text-align:left;">GP%</th><th style="padding:10px 15px;text-align:center;">Suggest</th><th></th></tr></thead><tbody>${rowHtml(below)}</tbody></table></div></div>`:`<div class="card" style="border-top:4px solid var(--green);text-align:center;padding:20px;margin-bottom:20px;"><p style="color:var(--green);font-weight:bold;font-size:16px;margin:0;">✅ All recipes above ${GP_TARGET}% GP target.</p></div>`}
        <div class="card" style="padding:0;overflow:visible;"><div style="padding:15px 20px;background:rgba(16,185,129,0.08);border-bottom:1px solid var(--border);"><h3 style="margin:0;color:var(--green);">✓ Healthy Margins (${above.length})</h3></div><div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#111;font-size:12px;color:var(--text-muted);text-transform:uppercase;"><th style="padding:10px 15px;text-align:left;">Recipe</th><th style="padding:10px 15px;text-align:left;">Cost</th><th style="padding:10px 15px;text-align:left;">Sell</th><th style="padding:10px 15px;text-align:left;">GP%</th><th style="padding:10px 15px;text-align:center;">Suggest</th><th></th></tr></thead><tbody>${rowHtml(above)}</tbody></table></div></div>
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
            const stationCounts = {};
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
                const ingredients = rawIngredients.map(line=>{const p=window._parseIngredientLine(line);return{type:'raw',name:p.name||line,qty:p.qty,unit:p.unit,_rawName:line};});
                window.recipes.push({
                    id: window.generateId('rec'), name, posAlias:'',
                    type: window._courseToType(course), station: window._courseToStation(course),
                    status:'Active', course: course||'', ingredients, cost:0, gp:0, price:0,
                    yieldQty:1, yieldUnit:'Portion', method, allergens:[], photo:'', videoUrl:'', archived:false
                });
                existing.add(name.toLowerCase());
                const _st = window._courseToStation(course);
                stationCounts[_st] = (stationCounts[_st] || 0) + 1;
                imported++;
            });
            window.saveToDisk();
            statusDiv.innerHTML = `<div class="card" style="border-top:4px solid var(--green);text-align:center;padding:20px;">
                <div style="font-size:40px;margin-bottom:10px;">✅</div>
                <h3 style="color:var(--green);margin:0 0 10px 0;">Import Complete!</h3>
                <div style="font-size:14px;color:var(--text-muted);"><strong style="color:var(--green);">${imported}</strong> recipes imported · <strong style="color:var(--orange);">${duplicates}</strong> duplicates skipped</div>
                <div style="font-size:13px;color:var(--text-muted);margin-top:6px;">${Object.entries(stationCounts).map(([k,v])=>k+': '+v).join(', ')}</div>
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
    window.showLoadingOverlay('🤖 AI is analyzing your recipe...');
    const invNames=(window.inventoryItems||[]).map(i=>`${i.id}:${i.name} (per ${i.useUnit})`).join(', ');
    const prompt=`You are a culinary AI for Bar Wa Izakaya. Extract the recipe from this text.
Return ONLY JSON: { "name": "Name", "method": "Method", "yieldQty": 1, "ingredients": [ { "name": "Name", "qty": 1.5, "unit": "kg", "matchedInvId": null } ] }
Match to inventory IDs where possible: [${invNames}]
Recipe: ${rawText}`;
    try {
        const apiKey=window.getApiKey(); if(!apiKey) { window.hideLoadingOverlay(); return; }
        const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json"}})});
        const data=await response.json(); if(data.error) throw new Error(data.error.message);
        if(!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
        let rawJson=data.candidates[0].content.parts[0].text.replace(/^```json/g,'').replace(/^```/g,'').replace(/```$/g,'').trim();
        const aiResult=JSON.parse(rawJson);
        window.tempIngs=aiResult.ingredients.map(ing=>{
            if(ing.matchedInvId&&window.inventoryItems.find(x=>x.id===ing.matchedInvId)){const inv=window.inventoryItems.find(x=>x.id===ing.matchedInvId);return{type:'inv',ref:ing.matchedInvId,qty:ing.qty,unit:inv.useUnit||ing.unit,name:inv.recipeName||inv.name};}
            return {type:'raw',name:ing.name,qty:ing.qty||0,unit:ing.unit||'',_rawName:ing.name};
        });
        const newObj={id:window.generateId('rec'),name:aiResult.name||'Imported Recipe',posAlias:'',type:'Menu',station:'Kitchen',status:'Active',price:0,yieldQty:aiResult.yieldQty||1,yieldUnit:'Portion',method:aiResult.method||'',ingredients:window.tempIngs,cost:0,gp:0,allergens:[],photo:'',videoUrl:'',archived:false};
        window.recipes.push(newObj); window.editRecipeForm(newObj.id); window.showToast("AI Parsing Complete!");
        window.hideLoadingOverlay();
    } catch(e) { window.hideLoadingOverlay(); statusDiv.innerHTML=`<p style="color:var(--red);">API Error: ${e.message}</p>`; }
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
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
                '<button onclick="window.showView(\'reconcile\')" class="btn btn-outline" style="font-size:14px;padding:12px 22px;border-color:var(--orange);color:var(--orange);" title="Diff every recipe against your Recipe Keeper HTML export and fix qty/unit/link drift">🔄 Reconcile from Source</button>' +
                '<button onclick="window.runAutoLinkUnambiguous()" class="btn btn-outline" style="font-size:14px;padding:12px 22px;border-color:var(--green);color:var(--green);" title="Scan & link raw ingredients that parse to a single unambiguous inventory match — no AI needed">⚡ Auto-Link Unambiguous</button>' +
                '<button onclick="window.runAiBatchLink()" class="btn btn-purple" style="font-size:16px;padding:14px 30px;">✨ Run AI Batch Linker</button>' +
            '</div>' +
        '</div>' +
        '<div id="batch-link-status" style="margin-bottom:15px;"></div>' +
        '<div id="batch-link-results"></div>' +
    '</div>';
};
// Auto-restore saved batch results when navigating to this view
window.restoreBatchLinkIfSaved = () => {
    if (!window._batchLinkQueue) {
        try { const saved = localStorage.getItem('_batchLinkQueue'); if (saved) { window._batchLinkQueue = JSON.parse(saved); } } catch(e) {}
    }
    if (window._batchLinkQueue && window._batchLinkQueue.length > 0) {
        const statusDiv = document.getElementById('batch-link-status');
        const matches = window._batchLinkQueue.filter(q => q.suggestedInvId);
        if (statusDiv) statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ Restored — ' + matches.length + ' matches from previous run.</div>';
        window._batchLinkPage = 0;
        window.renderBatchLinkQueue();
    }
};
// Trigger restore after DOM renders
const _origRenderBatchLinker = window.renderAiBatchLinker;
window.renderAiBatchLinker = () => {
    const html = _origRenderBatchLinker();
    setTimeout(() => window.restoreBatchLinkIfSaved(), 100);
    return html;
};

// Helper: safely parse JSON from AI, recovering partial matches if truncated
window._safeParseAiJson = (text) => {
    const clean = text.replace(/^```json\s*/g, '').replace(/```\s*$/g, '').trim();
    // Try full parse first
    try { const r = JSON.parse(clean); return Array.isArray(r) ? r : []; } catch(e) {}
    // Truncated? Try to close the array
    try { const r = JSON.parse(clean.replace(/,\s*$/, '') + ']'); return Array.isArray(r) ? r : []; } catch(e) {}
    // Last resort: extract individual objects with regex
    const objs = [];
    const re = /\{\s*"idx"\s*:\s*(\d+)\s*,\s*"matchId"\s*:\s*"([^"]*)"\s*,\s*"confidence"\s*:\s*"([^"]*)"\s*\}/g;
    let m;
    while ((m = re.exec(clean)) !== null) {
        objs.push({ idx: parseInt(m[1]), matchId: m[2], confidence: m[3] });
    }
    return objs;
};

window.runAiBatchLink = async () => {
    // AI Batch Linker v20260329e — batched mode
    const statusDiv = document.getElementById('batch-link-status');
    const resultsDiv = document.getElementById('batch-link-results');
    statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:12px;color:var(--purple);font-weight:bold;">🤖 Scanning all raw ingredients (v2-batched)...</div>';
    resultsDiv.innerHTML = '';
    // Noise patterns — method steps, glass types, garnish notes, group headers etc.
    const _noiseRe = /^(style |glass |garnish |step\d|group\d|no garnish|mix all|for the |for \d|for shell|for curd|soak all|bring to|combine |once |put |whisk all|\. |add |% blend|\(ask |others -|or$|and$|marinade$|topping$|sauce$)/i;
    const rawIngredients = [];
    let skippedNoise = 0;
    (window.recipes || []).filter(r => !r.archived).forEach(r => {
        (r.ingredients || []).forEach((ing, idx) => {
            if (ing.type !== 'raw') return;
            const n = (ing.name || '').trim();
            if (n.length < 3 || n.length > 80 || _noiseRe.test(n)) { skippedNoise++; return; }
            rawIngredients.push({ recipeId: r.id, recipeName: r.name, ingIdx: idx, rawName: ing.name });
        });
    });
    // Noise items filtered silently (method steps, glass types, etc.)
    if (rawIngredients.length === 0) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ All ingredients linked!</div>';
        return;
    }
    const apiKey = window.getApiKey(); if (!apiKey) return;
    const invItems = (window.inventoryItems||[]).filter(i=>!i.archived);
    const invList = invItems.map(i=>i.id+':'+i.name).join('; ');

    // Batches of 25 for accuracy, 10 in parallel for speed
    const BATCH_SIZE = 25;
    const PARALLEL = 10;
    const batches = [];
    for (let i = 0; i < rawIngredients.length; i += BATCH_SIZE) {
        batches.push(rawIngredients.slice(i, i + BATCH_SIZE));
    }

    window.showLoadingOverlay('🤖 AI matching: 0/' + batches.length);
    const allMatches = [];
    let totalErrors = 0;
    let processedBatches = 0;

    // Process a single batch and return results
    const processBatch = async (b) => {
        const batch = batches[b];
        const globalOffset = b * BATCH_SIZE;
        const rawList = batch.map((r, idx) => idx + ':' + r.rawName).join('\n');
        const prompt = `You are matching recipe ingredients to inventory items for a Japanese izakaya restaurant.

RULES:
- Match each ITEM to the single best inventory ID. Only return medium or high confidence matches.
- Ingredient names may be abbreviated or use aliases. Common equivalences:
  tobanjan = tobandjan = doubanjiang (chilli bean paste)
  gochujang = gochijang = korean chilli paste
  shikuwasa = shikwasa (citrus juice)
  gomme = gomme syrup = sugar syrup
  cask sake = cooking sake
  layu = chilli oil
  ponzu = ponzu sauce
- Match partial names: "aperol" matches "Aperol Aperitivo 700ml", "campari" matches "Campari 700ml"
- Ignore quantity/unit prefixes in ingredient names (e.g. "45ml" or "2 cups")
- Skip method instructions, glass types, or garnish notes — return nothing for those

INV: ${invList}

ITEMS:
${rawList}

Return JSON array: [{"idx":0,"matchId":"inv-id","confidence":"high"}]`;
        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096 } })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            const rawText = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '[]';
            const batchMatches = window._safeParseAiJson(rawText);
            // Batch match count tracked internally
            batchMatches.forEach(m => { allMatches.push({ ...m, idx: m.idx + globalOffset }); });
            processedBatches++;
        } catch (batchErr) {
            // Batch error tracked in totalErrors count
            totalErrors++;
        }
    };

    // Run batches in parallel groups
    for (let b = 0; b < batches.length; b += PARALLEL) {
        const pct = Math.round((b / batches.length) * 100);
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:12px;color:var(--purple);font-weight:bold;">🤖 Batches ' + (b+1) + '-' + Math.min(b+PARALLEL, batches.length) + '/' + batches.length + ' (' + pct + '%) — ' + allMatches.length + ' matches so far' + (totalErrors > 0 ? ' — ' + totalErrors + ' errors' : '') + '</div>';
        window.showLoadingOverlay('🤖 ' + pct + '% — ' + allMatches.length + ' matches');

        // Fire PARALLEL batches simultaneously
        const group = [];
        for (let p = 0; p < PARALLEL && (b + p) < batches.length; p++) {
            group.push(processBatch(b + p));
        }
        await Promise.all(group);

        // Brief delay between groups to be polite to the API
        if (b + PARALLEL < batches.length) await new Promise(r => setTimeout(r, 500));
    }

    // Build the review queue from all accumulated matches
    window._batchLinkQueue = rawIngredients.map((item, idx) => {
        const match = allMatches.find(m => m.idx === idx);
        const inv = match && match.matchId ? invItems.find(i => i.id === match.matchId) : null;
        return { ...item, suggestedInvId: inv ? inv.id : null, suggestedInvName: inv ? inv.name : null, confidence: match ? match.confidence : 'none', accepted: false, skipped: false };
    });
    // Persist to localStorage so results survive page refresh
    try { localStorage.setItem('_batchLinkQueue', JSON.stringify(window._batchLinkQueue)); } catch(e) {}
    window.renderBatchLinkQueue();
    const matchCount = allMatches.filter(m => m.matchId).length;
    const errMsg = totalErrors > 0 ? ' (' + totalErrors + ' batch' + (totalErrors > 1 ? 'es' : '') + ' failed)' : '';
    statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ Done — ' + matchCount + ' matches from ' + processedBatches + '/' + batches.length + ' batches.' + errMsg + '</div>';
    window.hideLoadingOverlay();
};

window._batchLinkPage = 0;
window.renderBatchLinkQueue = () => {
    // Restore from localStorage if not in memory
    if (!window._batchLinkQueue) {
        try { const saved = localStorage.getItem('_batchLinkQueue'); if (saved) window._batchLinkQueue = JSON.parse(saved); } catch(e) {}
    }
    const queue = window._batchLinkQueue || [];
    const resultsDiv = document.getElementById('batch-link-results');
    if (!resultsDiv) return;
    const pending = queue.filter(q => !q.accepted && !q.skipped);
    const accepted = queue.filter(q => q.accepted);
    if (pending.length === 0 && accepted.length === 0) { resultsDiv.innerHTML = ''; return; }
    const cc = {high:'var(--green)',medium:'var(--orange)',low:'var(--text-muted)',none:'var(--border)'};
    const withMatch = pending.filter(q=>q.suggestedInvId);
    const noMatch = pending.filter(q=>!q.suggestedInvId);

    // Grouped vs flat view toggle
    const groupMode = window._batchLinkGroupMode !== false; // default: grouped on

    // Summary + action buttons (always shown)
    let html = '<div class="card" style="padding:15px;margin-bottom:15px;border-top:3px solid var(--purple);">';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">';
    if (withMatch.length>0) html += '<button onclick="window.acceptAllBatchLinks()" class="btn btn-green" style="font-size:15px;padding:12px 24px;">✅ Accept All ' + withMatch.length + ' Matches</button>';
    if (accepted.length>0) html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="font-size:15px;padding:12px 24px;">💾 Commit ' + accepted.length + ' Links</button>';
    html += '<div style="margin-left:auto;display:flex;gap:4px;background:var(--bg-main);border-radius:6px;padding:3px;">' +
        '<button onclick="window._batchLinkGroupMode=true;window.renderBatchLinkQueue()" style="padding:6px 12px;font-size:12px;font-weight:600;border:none;cursor:pointer;border-radius:4px;color:' + (groupMode?'#fff':'var(--text-muted)') + ';background:' + (groupMode?'var(--purple)':'transparent') + ';">📦 Grouped</button>' +
        '<button onclick="window._batchLinkGroupMode=false;window.renderBatchLinkQueue()" style="padding:6px 12px;font-size:12px;font-weight:600;border:none;cursor:pointer;border-radius:4px;color:' + (!groupMode?'#fff':'var(--text-muted)') + ';background:' + (!groupMode?'var(--purple)':'transparent') + ';">📜 All Items</button>' +
    '</div>';
    html += '</div>';
    html += '<div style="font-size:13px;color:var(--text-muted);">🔗 ' + withMatch.length + ' suggested · ❓ ' + noMatch.length + ' no match · ✅ ' + accepted.length + ' accepted</div>';
    html += '</div>';

    if (groupMode) {
        // ── Group pending items by suggestedInvId ──
        const groups = new Map(); // key: invId or 'NONE', val: [{queue items}]
        pending.forEach(item => {
            const key = item.suggestedInvId || 'NONE';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        });
        const groupKeys = Array.from(groups.keys());
        // Sort: suggested groups first (by group size desc), then NONE last
        groupKeys.sort((a, b) => {
            if (a === 'NONE') return 1;
            if (b === 'NONE') return -1;
            return groups.get(b).length - groups.get(a).length;
        });
        const totalGroups = groupKeys.length;
        if (totalGroups > 0) {
            html += '<h3 style="color:var(--brand-dark);border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:15px;">Grouped by Target (' + totalGroups + ' groups, ' + pending.length + ' raw ingredients)</h3>';
            groupKeys.forEach(key => {
                const groupItems = groups.get(key);
                const isUnmatched = key === 'NONE';
                const inv = !isUnmatched ? (window.inventoryItems||[]).find(x => x.id === key) : null;
                const groupConf = !isUnmatched ? (groupItems[0].confidence || 'none') : 'none';
                const borderCol = isUnmatched ? 'var(--border)' : (cc[groupConf] || 'var(--border)');
                const targetName = inv ? (inv.recipeName || inv.name) : '— No suggestion —';
                const targetUnit = inv ? (inv.useUnit || 'unit') : '';

                // Sample raw names (up to 3)
                const samples = groupItems.slice(0, 3).map(g => '<code style="font-size:11px;color:var(--orange);">' + esc(g.rawName) + '</code>').join(', ');
                const moreCount = groupItems.length - 3;
                const moreLabel = moreCount > 0 ? ' <span style="color:var(--text-muted);font-size:11px;">+' + moreCount + ' more</span>' : '';
                const recipeSet = new Set(groupItems.map(g => g.recipeName));
                const recipeNote = recipeSet.size > 1 ? ' · across <strong>' + recipeSet.size + '</strong> recipes' : ' · in <strong>' + Array.from(recipeSet)[0] + '</strong>';

                // Inv dropdown for overriding
                const invOpts = (window.inventoryItems||[]).filter(x=>!x.archived).map(x=>'<option value="'+x.id+'" '+(x.id===key?'selected':'')+'>'+esc(x.name)+' ('+esc(x.useUnit||'unit')+')</option>').join('');

                html += '<div class="card" style="border-left:4px solid ' + borderCol + ';padding:15px;margin-bottom:10px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
                        '<div style="flex:1;min-width:240px;">' +
                            '<div style="font-size:11px;color:var(--text-muted);">Suggested target' +
                                (isUnmatched ? '' : '<span style="font-size:10px;color:' + (cc[groupConf]||'') + ';margin-left:6px;border:1px solid currentColor;padding:1px 6px;border-radius:8px;">' + groupConf + '</span>') +
                            '</div>' +
                            '<strong style="font-size:14px;color:' + (isUnmatched ? 'var(--text-muted)' : 'var(--green)') + ';">' + esc(targetName) + (targetUnit ? ' <span style="color:var(--text-muted);font-weight:normal;font-size:12px;">(' + esc(targetUnit) + ')</span>' : '') + '</strong>' +
                            '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;"><strong>' + groupItems.length + '</strong> raw ingredient' + (groupItems.length !== 1 ? 's' : '') + recipeNote + '</div>' +
                            '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">e.g. ' + samples + moreLabel + '</div>' +
                        '</div>' +
                        '<div style="flex:1;min-width:200px;">' +
                            '<label style="font-size:10px;color:var(--text-muted);">Override target:</label>' +
                            '<select id="bl-grp-sel-' + esc(key) + '" class="input-box" style="margin:2px 0;font-size:12px;"><option value="">-- choose --</option>' + invOpts + '</select>' +
                        '</div>' +
                        '<div style="display:flex;flex-direction:column;gap:6px;">' +
                            (isUnmatched
                                ? '<button onclick="window._batchGroupOverride(\'NONE\')" class="btn btn-green" style="font-size:12px;padding:6px 14px;">✓ Link ' + groupItems.length + ' with override</button>'
                                : '<button onclick="window._batchGroupAccept(\'' + esc(key) + '\')" class="btn btn-green" style="font-size:12px;padding:6px 14px;">✓ Link all ' + groupItems.length + '</button>') +
                            '<button onclick="window._batchGroupSkip(\'' + esc(key) + '\')" class="btn btn-outline" style="font-size:12px;padding:6px 14px;">Skip group</button>' +
                            (!isUnmatched ? '<button onclick="window._batchGroupExpand(\'' + esc(key) + '\')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;color:var(--text-muted);">Show all ' + groupItems.length + ' &raquo;</button>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
        }
    } else {
        // ── Flat view (legacy) ──
        const PAGE_SIZE = 50;
        const allPending = [...withMatch, ...noMatch];
        const totalPages = Math.ceil(allPending.length / PAGE_SIZE);
        const page = Math.min(window._batchLinkPage || 0, totalPages - 1);
        const pageItems = allPending.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        if (allPending.length > 0) {
            html += '<h3 style="color:var(--brand-dark);border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:15px;">Review Items (' + (page * PAGE_SIZE + 1) + '–' + Math.min((page + 1) * PAGE_SIZE, allPending.length) + ' of ' + allPending.length + ')</h3>';
            pageItems.forEach(item => {
                const qIdx = queue.indexOf(item);
                const hasSuggestion = !!item.suggestedInvId;
                const invOpts = (window.inventoryItems||[]).filter(x=>!x.archived).map(x=>'<option value="'+x.id+'" '+(x.id===item.suggestedInvId?'selected':'')+'>'+esc(x.name)+' ('+esc(x.useUnit||'unit')+')</option>').join('');
                html += '<div class="card" style="border-left:4px solid '+(hasSuggestion ? (cc[item.confidence]||'var(--border)') : 'var(--border)')+';padding:15px;margin-bottom:10px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
                    '<div style="flex:1;"><div style="font-size:12px;color:var(--text-muted);">'+esc(item.recipeName)+'</div><strong style="color:var(--orange);">'+esc(item.rawName)+'</strong>' +
                    (item.confidence!=='none'&&hasSuggestion?'<span style="font-size:11px;color:'+(cc[item.confidence]||'')+';margin-left:8px;border:1px solid currentColor;padding:1px 6px;border-radius:8px;">'+item.confidence+'</span>':'')+'</div>' +
                    '<div style="flex:2;min-width:180px;"><select id="bl-sel-'+qIdx+'" class="input-box" style="margin:0 0 6px 0;"><option value="">-- Skip --</option>'+invOpts+'</select></div>' +
                    '<div style="display:flex;gap:6px;">' +
                    '<button onclick="window.acceptBatchLink('+qIdx+')" class="btn btn-green" style="font-size:12px;padding:6px 12px;">✓ Link</button>' +
                    '<button onclick="window.skipBatchLink('+qIdx+')" class="btn btn-outline" style="font-size:12px;padding:6px 12px;">Skip</button>' +
                    '</div></div></div>';
            });
            if (totalPages > 1) {
                html += '<div style="display:flex;justify-content:center;gap:10px;margin:20px 0;">';
                if (page > 0) html += '<button onclick="window._batchLinkPage=' + (page-1) + ';window.renderBatchLinkQueue()" class="btn btn-outline" style="padding:8px 16px;">← Prev</button>';
                html += '<span style="padding:8px 16px;color:var(--text-muted);">Page ' + (page+1) + ' of ' + totalPages + '</span>';
                if (page < totalPages - 1) html += '<button onclick="window._batchLinkPage=' + (page+1) + ';window.renderBatchLinkQueue()" class="btn btn-outline" style="padding:8px 16px;">Next →</button>';
                html += '</div>';
            }
        }
    }

    // Show accepted count summary (not individual items — too many)
    if (accepted.length > 0 && pending.length === 0) {
        html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="width:100%;margin-top:15px;font-size:16px;padding:14px;">💾 Commit All ' + accepted.length + ' Links</button>';
    }
    resultsDiv.innerHTML = html;
};
// =============================================================================
// AUTO-LINK UNAMBIGUOUS — scan raw ingredients, link where parsed name has
// exactly one inventory match. No AI needed; instant.
// =============================================================================
window.runAutoLinkUnambiguous = () => {
    const E = window.esc;
    const inv = (window.inventoryItems || []).filter(i => !i.archived);
    // Build a name index: normalised "kikkoman soy sauce" / "soy sauce" → [invItems]
    const _norm = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const nameIdx = {};
    inv.forEach(i => {
        const candidates = new Set();
        if (i.name) candidates.add(_norm(i.name));
        if (i.recipeName) candidates.add(_norm(i.recipeName));
        candidates.forEach(c => {
            if (!c) return;
            (nameIdx[c] = nameIdx[c] || []).push(i);
        });
    });

    const proposals = []; // { recipeId, recipeName, ingIdx, ing, inv }
    const noise = /^(step\s*\d|add\s|mix\s|combine\s|garnish|optional|to taste|as needed|for serving|salt and pepper)$/i;

    (window.recipes || []).filter(r => !r.archived).forEach(r => {
        (r.ingredients || []).forEach((ing, idx) => {
            if (ing.type !== 'raw') return;
            const sourceText = ing._rawName || ing.name || '';
            if (!sourceText.trim() || noise.test(sourceText.trim())) return;
            const parsed = window._parseIngredientLine(sourceText);
            const parsedNorm = _norm(parsed.name || sourceText);
            if (!parsedNorm) return;
            const matches = nameIdx[parsedNorm];
            if (!matches || matches.length !== 1) return; // need exactly one unambiguous match
            proposals.push({ recipeId: r.id, recipeName: r.name, ingIdx: idx, ing, inv: matches[0], parsedQty: parsed.qty, parsedUnit: parsed.unit });
        });
    });

    if (proposals.length === 0) {
        return window.showToast('No unambiguous matches found. Try the AI Batch Linker for ambiguous ones.', 'info');
    }

    // Group by inventory item for the preview modal
    const groups = {};
    proposals.forEach(p => {
        const key = p.inv.id;
        if (!groups[key]) groups[key] = { inv: p.inv, items: [] };
        groups[key].items.push(p);
    });
    const groupRows = Object.values(groups).sort((a,b) => b.items.length - a.items.length).slice(0, 30).map(g => {
        const sampleRecipes = Array.from(new Set(g.items.map(it => it.recipeName))).slice(0, 3).map(n => E(n)).join(', ');
        const moreRecs = g.items.length - 3 > 0 ? ' +' + (g.items.length - 3) + ' more' : '';
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:5px 8px;font-size:12px;"><strong>' + E(g.inv.recipeName || g.inv.name) + '</strong></td>' +
            '<td style="padding:5px 8px;text-align:center;font-size:12px;font-weight:600;">' + g.items.length + '</td>' +
            '<td style="padding:5px 8px;font-size:11px;color:var(--text-muted);">' + sampleRecipes + moreRecs + '</td>' +
        '</tr>';
    }).join('');
    const totalGroups = Object.keys(groups).length;

    const previewHtml =
        '<p style="margin:0 0 12px;font-size:13px;">Found <strong style="color:var(--green);">' + proposals.length + '</strong> raw ingredients with a single unambiguous inventory match across <strong>' + totalGroups + '</strong> inventory items. No AI required — these are exact-name parses.</p>' +
        '<div style="max-height:50vh;overflow-y:auto;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="font-size:10px;color:var(--text-muted);text-transform:uppercase;background:rgba(0,0,0,0.2);">' +
                    '<th style="text-align:left;padding:6px 8px;">Inventory Item</th>' +
                    '<th style="text-align:center;padding:6px 8px;">Occurrences</th>' +
                    '<th style="text-align:left;padding:6px 8px;">Sample Recipes</th>' +
                '</tr></thead><tbody>' + groupRows + '</tbody>' +
            '</table>' +
            (totalGroups > 30 ? '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">…and ' + (totalGroups - 30) + ' more inventory items</div>' : '') +
        '</div>';

    // Stash proposals for commit
    window._autoLinkProposals = proposals;
    window.confirmAction({
        title: '⚡ Auto-Link Unambiguous',
        message: previewHtml,
        confirmLabel: 'Link ' + proposals.length + ' Ingredients',
        tier: 'standard',
        onConfirm: window._commitAutoLinkUnambiguous
    });
};

window._commitAutoLinkUnambiguous = () => {
    const proposals = window._autoLinkProposals || [];
    let count = 0;
    proposals.forEach(p => {
        const r = (window.recipes || []).find(x => x.id === p.recipeId);
        if (!r) return;
        const ing = r.ingredients && r.ingredients[p.ingIdx];
        if (!ing || ing.type !== 'raw') return;
        const sourceText = ing._rawName || ing.name || '';
        const qty = (ing.qty && ing.qty !== 1) ? ing.qty : (p.parsedQty || 1);
        const unit = ing.unit || p.parsedUnit || p.inv.useUnit || 'unit';
        r.ingredients[p.ingIdx] = {
            type: 'inv',
            ref: p.inv.id,
            qty: qty,
            unit: unit,
            name: p.inv.recipeName || p.inv.name,
            _rawName: sourceText
        };
        count++;
    });
    if (typeof window.recalcAllCosts === 'function') window.recalcAllCosts();
    else window.saveToDisk();
    window._autoLinkProposals = null;
    window.showToast('⚡ Auto-linked ' + count + ' ingredients across ' + new Set(proposals.map(p => p.recipeId)).size + ' recipes.', 'success');
    window.showView('batch-linker');
};

window._saveBatchQueue = () => { try { localStorage.setItem('_batchLinkQueue', JSON.stringify(window._batchLinkQueue)); } catch(e) {} };
// Group helpers (suggested-target grouping in Batch Linker)
window._batchGroupAccept = (invId) => {
    (window._batchLinkQueue || []).forEach(item => {
        if (item.accepted || item.skipped) return;
        if (item.suggestedInvId === invId) item.accepted = true;
    });
    window._saveBatchQueue();
    window.renderBatchLinkQueue();
};
window._batchGroupSkip = (invId) => {
    const key = invId === 'NONE' ? null : invId;
    (window._batchLinkQueue || []).forEach(item => {
        if (item.accepted || item.skipped) return;
        if ((item.suggestedInvId || null) === key) item.skipped = true;
    });
    window._saveBatchQueue();
    window.renderBatchLinkQueue();
};
window._batchGroupOverride = (invId) => {
    // Read the dropdown for this group, apply that target to all items in the group, accept them.
    const sel = document.getElementById('bl-grp-sel-' + invId);
    if (!sel || !sel.value) return window.showToast('Pick a target from the dropdown first.', 'error');
    const newId = sel.value;
    const inv = (window.inventoryItems || []).find(i => i.id === newId);
    if (!inv) return window.showToast('Invalid target.', 'error');
    const key = invId === 'NONE' ? null : invId;
    let count = 0;
    (window._batchLinkQueue || []).forEach(item => {
        if (item.accepted || item.skipped) return;
        if ((item.suggestedInvId || null) === key) {
            item.suggestedInvId = newId;
            item.suggestedInvName = inv.name;
            item.accepted = true;
            count++;
        }
    });
    window._saveBatchQueue();
    window.renderBatchLinkQueue();
    window.showToast('✓ Linked ' + count + ' to ' + (inv.recipeName || inv.name), 'success');
};
window._batchGroupExpand = (invId) => {
    // Flip to flat view, scroll user to relevant items (best-effort)
    window._batchLinkGroupMode = false;
    window.renderBatchLinkQueue();
    window.showToast('Switched to "All Items" view to edit group individually.', 'info');
};
window.acceptBatchLink = (qIdx) => { const sel=document.getElementById('bl-sel-'+qIdx); const id=sel?sel.value:window._batchLinkQueue[qIdx].suggestedInvId; if(!id) return window.showToast('Select an item first.','error'); const inv=(window.inventoryItems||[]).find(x=>x.id===id); window._batchLinkQueue[qIdx].suggestedInvId=id; window._batchLinkQueue[qIdx].suggestedInvName=inv?inv.name:id; window._batchLinkQueue[qIdx].accepted=true; window._saveBatchQueue(); window.renderBatchLinkQueue(); };
window.skipBatchLink = (qIdx) => { window._batchLinkQueue[qIdx].skipped=true; window._saveBatchQueue(); window.renderBatchLinkQueue(); };
window.acceptAllBatchLinks = () => { (window._batchLinkQueue||[]).forEach(item=>{ if(!item.accepted&&!item.skipped&&item.suggestedInvId) item.accepted=true; }); window._saveBatchQueue(); window.renderBatchLinkQueue(); };
window.commitBatchLinks = () => {
    const accepted=(window._batchLinkQueue||[]).filter(q=>q.accepted&&q.suggestedInvId);
    if(accepted.length===0) return window.showToast('Nothing to commit.','error');
    let count=0;
    accepted.forEach(item=>{
        const recipe=window.recipes.find(r=>r.id===item.recipeId); if(!recipe) return;
        const ing=recipe.ingredients[item.ingIdx]; if(!ing||ing.type!=='raw') return;
        const inv=window.inventoryItems.find(i=>i.id===item.suggestedInvId); if(!inv) return;
        let origQty=ing.qty; let origUnit=ing.unit||'';
        // Always re-parse _rawName with improved parser for better qty extraction
        const parsed=window._parseIngredientLine(ing.name);
        if(!origQty || origQty===1){ origQty=parsed.qty||1; }
        if(!origUnit){ origUnit=parsed.unit||''; }
        recipe.ingredients[item.ingIdx]={type:'inv',ref:inv.id,qty:origQty,unit:origUnit||inv.useUnit||'unit',name:inv.recipeName||inv.name,_rawName:ing.name};
        count++;
    });
    window.recalcAllCosts(); window._batchLinkQueue=null; try { localStorage.removeItem('_batchLinkQueue'); } catch(e) {} window.showToast(count+' ingredients linked!'); window.showView('recipes');
};

// =============================================================================
// MENU ENGINEERING MATRIX
// =============================================================================

// Aggregate sales volumes from depletion logs (non-reversed) into weekly averages
// 8-week per-recipe sales volume — returns array of weekly counts (oldest → newest)
window._calcRecipeWeeklyHistory = (recipeName, weeks) => {
    weeks = weeks || 8;
    if (!recipeName) return new Array(weeks).fill(0);
    const target = recipeName.toLowerCase().trim();
    const now = Date.now();
    const buckets = new Array(weeks).fill(0);
    (window.depletionLogs || []).filter(d => !d.reversed && d.itemsSold).forEach(d => {
        let ts = null;
        if (d.ts) ts = new Date(d.ts).getTime();
        else if (d.date) {
            const m = d.date.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (m) ts = new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3])).getTime();
            else { const p = d.date.split('/'); if (p.length === 3) ts = new Date(p[2], p[1]-1, p[0]).getTime(); }
        }
        if (!ts) return;
        const weeksAgo = Math.floor((now - ts) / (7 * 86400000));
        if (weeksAgo < 0 || weeksAgo >= weeks) return;
        (d.itemsSold || []).forEach(item => {
            if ((item.recipeName || '').toLowerCase().trim() === target) {
                buckets[weeks - 1 - weeksAgo] += (item.qtySold || 0);
            }
        });
    });
    return buckets;
};

// Render a tiny SVG sparkline from a series
window._sparkline = (values, opts) => {
    opts = opts || {};
    const w = opts.width || 80; const h = opts.height || 20;
    const color = opts.color || 'var(--blue)';
    if (!values || values.length === 0) return '<span style="font-size:10px;color:var(--text-muted);">—</span>';
    const max = Math.max(1, ...values);
    const step = w / Math.max(1, values.length - 1);
    const points = values.map((v, i) => (i * step).toFixed(1) + ',' + (h - (v / max) * (h - 2) - 1).toFixed(1)).join(' ');
    return '<svg width="' + w + '" height="' + h + '" style="vertical-align:middle;display:inline-block;">' +
        '<polyline fill="none" stroke="' + color + '" stroke-width="1.5" points="' + points + '"/>' +
        '<circle cx="' + ((values.length - 1) * step).toFixed(1) + '" cy="' + (h - (values[values.length-1] / max) * (h - 2) - 1).toFixed(1) + '" r="2" fill="' + color + '"/>' +
    '</svg>';
};

window._calcPosCovers = () => {
    const logs = (window.depletionLogs||[]).filter(d => !d.reversed && d.itemsSold && d.itemsSold.length > 0);
    if (logs.length === 0) return {};
    // Find date range to calculate weeks
    const dates = logs.map(d => {
        if (d.ts) return new Date(d.ts);
        if (d.date) { const p = d.date.split('/'); return new Date(p[2], p[1]-1, p[0]); }
        return null;
    }).filter(Boolean).sort((a,b) => a-b);
    const firstDate = dates[0], lastDate = dates[dates.length-1];
    const weeks = Math.max(1, (lastDate - firstDate) / (7*24*60*60*1000));
    // Aggregate total qty per recipe name
    const totals = {};
    logs.forEach(d => {
        (d.itemsSold||[]).forEach(item => {
            const key = (item.recipeName||'').toLowerCase().trim();
            if (!key) return;
            totals[key] = (totals[key]||0) + (item.qtySold||0);
        });
    });
    // Convert to weekly average
    const weekly = {};
    Object.keys(totals).forEach(k => { weekly[k] = Math.round(totals[k] / weeks * 10) / 10; });
    return weekly;
};

// Sync POS covers into recipe.coversPerWeek — matches by name/posAlias
window._syncPosCovers = () => {
    const posCovers = window._calcPosCovers();
    if (Object.keys(posCovers).length === 0) { window.showToast('No depletion data found. Run POS depletion first.', 'error'); return 0; }
    let synced = 0;
    (window.recipes||[]).forEach(r => {
        if (r.type !== 'Menu' || r.archived) return;
        const nameKey = (r.name||'').toLowerCase().trim();
        const aliasKey = (r.posAlias||'').toLowerCase().trim();
        const covers = posCovers[nameKey] || posCovers[aliasKey] || 0;
        if (covers > 0) { r.coversPerWeek = covers; synced++; }
    });
    if (synced > 0) window.saveToDisk();
    return synced;
};

window.renderMenuEngineeringView = () => {
    const E = window.esc;
    const GP_TARGET = window.GP_TARGET || 67;
    const menuRecipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&r.price>0&&(r.status||'Active')==='Active'&&!r.archived);

    // Recalculate costs
    menuRecipes.forEach(r => window._recalcRecipe(r));

    const avgGp=menuRecipes.length>0?menuRecipes.reduce((s,r)=>s+r.gp,0)/menuRecipes.length:GP_TARGET;
    const avgCovers=menuRecipes.length>0?menuRecipes.reduce((s,r)=>s+(r.coversPerWeek||0),0)/menuRecipes.length:0;
    const classify = r => { const hi=r.gp>=avgGp,hv=(r.coversPerWeek||0)>=avgCovers; return hi&&hv?'star':hi&&!hv?'puzzle':!hi&&hv?'plowhorse':'dog'; };

    const cats = {
        star:{label:'⭐ Stars',color:'#10b981',css:'var(--green)',bg:'rgba(16,185,129,0.08)',desc:'High GP + high volume. Protect these items.',action:'Keep prominent on menu. Don\'t change pricing.'},
        puzzle:{label:'🧩 Puzzles',color:'#3b82f6',css:'var(--blue)',bg:'rgba(59,130,246,0.08)',desc:'High GP, low volume. Hidden gems.',action:'Promote: feature on specials, train staff to upsell.'},
        plowhorse:{label:'🐴 Plow Horses',color:'#f59e0b',css:'var(--orange)',bg:'rgba(245,158,11,0.08)',desc:'High volume, low GP. Popular but expensive.',action:'Reprice: increase sell price or reduce portion/ingredients.'},
        dog:{label:'🐶 Dogs',color:'#ef4444',css:'var(--red)',bg:'rgba(239,68,68,0.08)',desc:'Low GP + low volume. Underperformers.',action:'Review: consider removing, replacing, or complete rework.'}
    };
    const sc={Kitchen:'var(--orange)',Bar:'var(--blue)',Prep:'var(--purple)'};

    // Classify and calculate contribution margin
    const classified = menuRecipes.map(r => {
        const cat = classify(r);
        const margin = r.price - (r.cost||0);
        const weeklyProfit = margin * (r.coversPerWeek||0);
        const weeklyRevenue = r.price * (r.coversPerWeek||0);
        return { ...r, _cat: cat, _margin: margin, _weeklyProfit: weeklyProfit, _weeklyRevenue: weeklyRevenue };
    });

    const counts={star:0,puzzle:0,plowhorse:0,dog:0};
    classified.forEach(r=>counts[r._cat]++);

    // Revenue/profit by quadrant
    const quadStats={star:{rev:0,profit:0},puzzle:{rev:0,profit:0},plowhorse:{rev:0,profit:0},dog:{rev:0,profit:0}};
    classified.forEach(r=>{ quadStats[r._cat].rev+=r._weeklyRevenue; quadStats[r._cat].profit+=r._weeklyProfit; });
    const totalWeeklyProfit = classified.reduce((s,r)=>s+r._weeklyProfit,0);
    const totalWeeklyRevenue = classified.reduce((s,r)=>s+r._weeklyRevenue,0);

    // Check for POS data availability
    const posCovers = window._calcPosCovers();
    const hasPosData = Object.keys(posCovers).length > 0;
    const nw = menuRecipes.filter(r=>!r.coversPerWeek||r.coversPerWeek===0).length;

    // Data source banner
    let dataBanner = '';
    if (nw > 0 && hasPosData) {
        dataBanner = '<div class="card" style="border-left:4px solid var(--blue);padding:12px;margin-bottom:20px;font-size:13px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
            '<div><strong style="color:var(--blue);">📡 POS data available!</strong> '+nw+' recipes still have no covers/week. Sync from depletion history to auto-fill.</div>' +
            '<button onclick="window._syncAndRefreshMatrix()" class="btn btn-blue" style="font-size:12px;padding:6px 14px;">Sync from POS</button></div>';
    } else if (nw > 0) {
        dataBanner = '<div class="card" style="border-left:4px solid var(--orange);padding:12px;margin-bottom:20px;font-size:13px;">' +
            '<strong style="color:var(--orange);">⚠️ '+nw+' recipes have no covers/week.</strong> Run POS depletion to generate sales data, or set covers manually in the Sell Price Editor.</div>';
    }

    // --- SVG SCATTER PLOT ---
    const plotW=580, plotH=340, pad={t:25,r:25,b:45,l:55};
    const chartW=plotW-pad.l-pad.r, chartH=plotH-pad.t-pad.b;
    const _gps = classified.map(r=>r.gp);
    const _gpsPos = _gps.filter(g=>g>0);
    const maxCovers = Math.max(10, ...classified.map(r=>r.coversPerWeek||0)) * 1.15;
    const maxGp = Math.min(100, Math.max(GP_TARGET+15, ...(_gps.length?_gps:[GP_TARGET])) * 1.1);
    const minGp = Math.max(0, (_gpsPos.length ? Math.min(avgGp-20, ..._gpsPos) : avgGp-20) - 5);
    const gpRange = maxGp - minGp;
    const xScale = v => pad.l + (v / maxCovers) * chartW;
    const yScale = v => pad.t + chartH - ((v - minGp) / gpRange) * chartH;

    const avgX = xScale(avgCovers), avgY = yScale(avgGp);

    let dots = '';
    classified.forEach(r => {
        const cx = xScale(r.coversPerWeek||0), cy = yScale(r.gp);
        const col = cats[r._cat].color;
        const radius = Math.max(5, Math.min(14, 4 + (r._weeklyProfit / Math.max(1, totalWeeklyProfit)) * 80));
        dots += '<circle cx="'+cx+'" cy="'+cy+'" r="'+radius+'" fill="'+col+'" fill-opacity="0.7" stroke="'+col+'" stroke-width="1.5" style="cursor:pointer;" ' +
            'onmouseover="this.setAttribute(\'r\','+(radius+3)+');document.getElementById(\'me-tip\').innerHTML=\''+E(r.name)+' — GP '+r.gp+'%, '+((r.coversPerWeek||0))+'/wk, $'+r._margin.toFixed(2)+' margin\'" ' +
            'onmouseout="this.setAttribute(\'r\','+radius+');document.getElementById(\'me-tip\').innerHTML=\'Hover a dot for details\'" ' +
            'onclick="window.editRecipeForm(\''+r.id+'\')" />';
    });

    // Grid lines
    let gridLines = '';
    for (let g = Math.ceil(minGp/10)*10; g <= maxGp; g += 10) {
        const y = yScale(g);
        gridLines += '<line x1="'+pad.l+'" y1="'+y+'" x2="'+(plotW-pad.r)+'" y2="'+y+'" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
        gridLines += '<text x="'+(pad.l-8)+'" y="'+(y+4)+'" text-anchor="end" fill="rgba(255,255,255,0.4)" font-size="10">'+g+'%</text>';
    }
    const xSteps = Math.max(1, Math.round(maxCovers / 5));
    for (let c = 0; c <= maxCovers; c += xSteps) {
        const x = xScale(c);
        gridLines += '<line x1="'+x+'" y1="'+pad.t+'" x2="'+x+'" y2="'+(plotH-pad.b)+'" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>';
        gridLines += '<text x="'+x+'" y="'+(plotH-pad.b+16)+'" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="10">'+Math.round(c)+'</text>';
    }

    // Quadrant labels
    const qLabels = '<text x="'+(pad.l+8)+'" y="'+(pad.t+14)+'" fill="rgba(59,130,246,0.3)" font-size="11" font-weight="bold">PUZZLES</text>' +
        '<text x="'+(plotW-pad.r-8)+'" y="'+(pad.t+14)+'" text-anchor="end" fill="rgba(16,185,129,0.3)" font-size="11" font-weight="bold">STARS</text>' +
        '<text x="'+(pad.l+8)+'" y="'+(plotH-pad.b-8)+'" fill="rgba(239,68,68,0.3)" font-size="11" font-weight="bold">DOGS</text>' +
        '<text x="'+(plotW-pad.r-8)+'" y="'+(plotH-pad.b-8)+'" text-anchor="end" fill="rgba(245,158,11,0.3)" font-size="11" font-weight="bold">PLOW HORSES</text>';

    const scatterSvg = '<svg viewBox="0 0 '+plotW+' '+plotH+'" style="width:100%;height:auto;">' +
        // Background
        '<rect x="'+pad.l+'" y="'+pad.t+'" width="'+chartW+'" height="'+chartH+'" fill="rgba(0,0,0,0.15)" rx="4"/>' +
        gridLines + qLabels +
        // Average crosshairs
        '<line x1="'+avgX+'" y1="'+pad.t+'" x2="'+avgX+'" y2="'+(plotH-pad.b)+'" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,4"/>' +
        '<line x1="'+pad.l+'" y1="'+avgY+'" x2="'+(plotW-pad.r)+'" y2="'+avgY+'" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4,4"/>' +
        // GP target line
        (GP_TARGET >= minGp && GP_TARGET <= maxGp ?
            '<line x1="'+pad.l+'" y1="'+yScale(GP_TARGET)+'" x2="'+(plotW-pad.r)+'" y2="'+yScale(GP_TARGET)+'" stroke="rgba(16,185,129,0.4)" stroke-width="1.5" stroke-dasharray="6,3"/>' +
            '<text x="'+(plotW-pad.r-4)+'" y="'+(yScale(GP_TARGET)-5)+'" text-anchor="end" fill="rgba(16,185,129,0.5)" font-size="9">'+GP_TARGET+'% target</text>' : '') +
        // Dots
        dots +
        // Axis labels
        '<text x="'+(plotW/2)+'" y="'+(plotH-4)+'" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11">Covers / Week</text>' +
        '<text x="14" y="'+(plotH/2)+'" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="11" transform="rotate(-90,14,'+(plotH/2)+')">GP %</text>' +
        '</svg>';

    // --- QUADRANT CARDS ---
    const quadHtml = ['star','puzzle','plowhorse','dog'].map(key => {
        const cat = cats[key];
        const items = classified.filter(r=>r._cat===key).sort((a,b)=>b._weeklyProfit-a._weeklyProfit);
        const qProfit = quadStats[key].profit;
        const profitPct = totalWeeklyProfit > 0 ? (qProfit / totalWeeklyProfit * 100).toFixed(0) : 0;

        const rows = items.map(r => {
            const gc = r.gp>=GP_TARGET?'var(--green)':r.gp>0?'var(--orange)':'var(--red)';
            const suggestedPrice = r.gp < GP_TARGET && r.cost > 0 ? (r.cost / (1 - GP_TARGET/100)).toFixed(2) : null;
            const fixBtn = suggestedPrice ? ' <button onclick="window._quickFixPrice(\''+r.id+'\','+suggestedPrice+')" class="btn btn-outline" style="font-size:10px;padding:2px 6px;color:var(--green);border-color:var(--green);" title="Set to $'+suggestedPrice+' for '+GP_TARGET+'% GP">Fix</button>' : '';
            return '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:8px 10px;"><strong style="cursor:pointer;color:var(--blue);font-size:13px;" onclick="window.editRecipeForm(\''+r.id+'\')">'+E(r.name)+'</strong><br><small style="color:'+(sc[r.station||'Kitchen']||'var(--text-muted)')+';">'+(r.station||'Kitchen')+'</small></td>' +
                '<td style="padding:8px 10px;color:'+gc+';font-weight:bold;font-size:13px;">'+r.gp+'%'+fixBtn+'</td>' +
                '<td style="padding:8px 10px;font-size:12px;">$'+Number(r.price||0).toFixed(2)+'<br><small style="color:var(--text-muted);">cost $'+Number(r.cost||0).toFixed(2)+'</small></td>' +
                '<td style="padding:8px 10px;font-weight:bold;font-size:13px;">'+(r.coversPerWeek||0)+'<br>'+window._sparkline(window._calcRecipeWeeklyHistory(r.name, 8),{color:cat.css,width:70,height:18})+'</td>' +
                '<td style="padding:8px 10px;text-align:right;font-size:12px;"><strong style="color:'+(r._weeklyProfit>=0?'var(--green)':'var(--red)')+';">$'+r._weeklyProfit.toFixed(0)+'</strong><br><small style="color:var(--text-muted);">/wk</small></td>' +
            '</tr>';
        }).join('');

        return '<div class="card" style="padding:0;overflow:hidden;border-top:4px solid '+cat.css+';">' +
            '<div style="padding:12px 16px;background:'+cat.bg+';border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
                '<div><h3 style="margin:0;color:'+cat.css+';font-size:15px;">'+cat.label+' <span style="font-size:12px;background:'+cat.css+';color:white;padding:1px 7px;border-radius:10px;font-weight:normal;">'+items.length+'</span></h3>' +
                '<p style="margin:3px 0 0;font-size:11px;color:var(--text-muted);">'+cat.action+'</p></div>' +
                '<div style="text-align:right;"><div style="font-size:16px;font-weight:bold;color:'+cat.css+';">$'+qProfit.toFixed(0)+'<small style="font-size:10px;font-weight:normal;">/wk</small></div>' +
                '<div style="font-size:10px;color:var(--text-muted);">'+profitPct+'% of profit</div></div>' +
            '</div>' +
            (items.length===0?'<p style="padding:15px;color:var(--text-muted);font-size:13px;margin:0;">No items.</p>' :
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="font-size:10px;color:var(--text-muted);text-transform:uppercase;background:rgba(0,0,0,0.2);">' +
                '<th style="padding:6px 10px;text-align:left;">Recipe</th><th style="padding:6px 10px;">GP%</th><th style="padding:6px 10px;">Price</th><th style="padding:6px 10px;">Covers</th><th style="padding:6px 10px;text-align:right;">Profit</th></tr></thead>' +
                '<tbody>'+rows+'</tbody></table></div>') +
        '</div>';
    }).join('');

    // --- ASSEMBLE ---
    return '<div style="max-width:1100px;margin:auto;">' +
        window._marginsTabBar('menu-engineering') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">🎯 Menu Engineering Matrix</h2>' +
            '<small style="color:var(--text-muted);">Avg GP: '+avgGp.toFixed(1)+'% · Avg Volume: '+avgCovers.toFixed(0)+'/wk · '+menuRecipes.length+' active items</small></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                (hasPosData ? '<button onclick="window._syncAndRefreshMatrix()" class="btn btn-outline" style="font-size:12px;padding:6px 12px;">📡 Sync POS</button>' : '') +
                '<button onclick="window.getMenuAiAdvice()" class="btn btn-purple" style="padding:8px 16px;font-size:12px;">🤖 AI Advisor</button>' +
            '</div>' +
        '</div>' +
        '<div id="ai-menu-advice"></div>' +
        dataBanner +

        // KPI row
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px;">' +
            '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--green);"><div style="font-size:28px;font-weight:bold;color:var(--green);">'+counts.star+'</div><div style="font-size:11px;color:var(--text-muted);">Stars</div></div>' +
            '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--blue);"><div style="font-size:28px;font-weight:bold;color:var(--blue);">'+counts.puzzle+'</div><div style="font-size:11px;color:var(--text-muted);">Puzzles</div></div>' +
            '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--orange);"><div style="font-size:28px;font-weight:bold;color:var(--orange);">'+counts.plowhorse+'</div><div style="font-size:11px;color:var(--text-muted);">Plow Horses</div></div>' +
            '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--red);"><div style="font-size:28px;font-weight:bold;color:var(--red);">'+counts.dog+'</div><div style="font-size:11px;color:var(--text-muted);">Dogs</div></div>' +
            '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--brand-accent);"><div style="font-size:22px;font-weight:bold;color:var(--brand-accent);">$'+totalWeeklyProfit.toFixed(0)+'</div><div style="font-size:11px;color:var(--text-muted);">Profit/wk</div></div>' +
            '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--text-muted);"><div style="font-size:22px;font-weight:bold;">$'+totalWeeklyRevenue.toFixed(0)+'</div><div style="font-size:11px;color:var(--text-muted);">Revenue/wk</div></div>' +
        '</div>' +

        // Scatter plot
        '<div class="card" style="padding:16px;margin-bottom:20px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
                '<h3 style="margin:0;font-size:14px;">Quadrant Map</h3>' +
                '<div style="display:flex;gap:12px;font-size:11px;">' +
                    '<span style="color:#10b981;">● Stars</span><span style="color:#3b82f6;">● Puzzles</span>' +
                    '<span style="color:#f59e0b;">● Plow Horses</span><span style="color:#ef4444;">● Dogs</span>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:center;">'+scatterSvg+'</div>' +
            '<div id="me-tip" style="text-align:center;font-size:12px;color:var(--text-muted);margin-top:8px;min-height:18px;">Hover a dot for details</div>' +
        '</div>' +

        // Quadrant cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(450px,100%),1fr));gap:16px;">' + quadHtml + '</div>' +
    '</div>';
};

// Sync POS data and refresh the matrix view
window._syncAndRefreshMatrix = () => {
    const synced = window._syncPosCovers();
    if (synced > 0) {
        window.showToast(synced + ' recipes synced with POS data.');
        window.showView('menu-engineering');
    }
};

// =============================================================================
// AI MENU ENGINEERING ADVISOR
// =============================================================================
window.getMenuAiAdvice = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    const container = document.getElementById('ai-menu-advice');
    if (!container) return;
    container.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:16px;"><div style="display:flex;align-items:center;gap:10px;"><div class="loading-spinner" style="width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="color:var(--purple);font-weight:600;">Analysing your menu...</span></div></div>';

    const menuRecipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&r.price>0&&(r.status||'Active')==='Active'&&!r.archived);
    const GP_TARGET = window.GP_TARGET || 67;

    // Recalculate costs
    menuRecipes.forEach(r => window._recalcRecipe(r));

    const avgGp = menuRecipes.length > 0 ? menuRecipes.reduce((s,r) => s + r.gp, 0) / menuRecipes.length : 0;
    const avgCovers = menuRecipes.length > 0 ? menuRecipes.reduce((s,r) => s + (r.coversPerWeek||0), 0) / menuRecipes.length : 0;
    const classify = r => { const hi = r.gp >= avgGp, hv = (r.coversPerWeek||0) >= avgCovers; return hi && hv ? 'Star' : hi && !hv ? 'Puzzle' : !hi && hv ? 'Plowhorse' : 'Dog'; };

    const itemData = menuRecipes.map(r => `${r.name}: sell $${Number(r.price).toFixed(2)}, cost $${Number(r.cost).toFixed(2)}, GP ${r.gp}%, ${r.coversPerWeek||0} covers/wk, station: ${r.station||'Kitchen'}, category: ${classify(r)}`).join('\n');

    const venue = window._getVenueName();

    const prompt = `You are a hospitality menu engineering consultant analysing the menu for ${venue}, an Asian restaurant.

Here is the menu data with categories (Star = high GP + high volume, Puzzle = high GP + low volume, Plowhorse = high volume + low GP, Dog = low GP + low volume):

${itemData}

Average GP: ${avgGp.toFixed(1)}% | Average covers/wk: ${avgCovers.toFixed(0)} | GP target: ${GP_TARGET}%

Give 5-7 specific, actionable recommendations. For each:
- Name the exact dish
- State the category it's in
- Give a concrete action (price change with exact amount, repositioning strategy, removal consideration, or promotional idea)
- Explain why briefly

Format as numbered list. Be direct and specific with dollar amounts. Focus on moves that improve total profit without alienating customers.`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';

        // Convert markdown-ish text to simple HTML
        const htmlText = window.esc(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        container.innerHTML = `<div class="card" style="border-top:3px solid var(--purple);padding:20px;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <h3 style="margin:0;font-size:16px;">🤖 AI Menu Recommendations</h3>
                <button onclick="document.getElementById('ai-menu-advice').innerHTML=''" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Dismiss</button>
            </div>
            <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
        </div>`;
    } catch (err) {
        container.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);">AI analysis failed: ' + window.esc(err.message) + '</div>';
    }
};

