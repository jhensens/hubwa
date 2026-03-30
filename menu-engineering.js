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
                const ingredients = rawIngredients.map(line=>{const p=window._parseIngredientLine(line);return{type:'raw',name:p.name||line,qty:p.qty,unit:p.unit};});
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
        let rawJson=data.candidates[0].content.parts[0].text.replace(/^```json/g,'').replace(/^```/g,'').replace(/```$/g,'').trim();
        const aiResult=JSON.parse(rawJson);
        window.tempIngs=aiResult.ingredients.map(ing=>{
            if(ing.matchedInvId&&window.inventoryItems.find(x=>x.id===ing.matchedInvId)){const inv=window.inventoryItems.find(x=>x.id===ing.matchedInvId);return{type:'inv',ref:ing.matchedInvId,qty:ing.qty,unit:inv.useUnit||ing.unit,name:inv.name};}
            return {type:'raw',name:ing.name,qty:ing.qty||0,unit:ing.unit||''};
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
            '<button onclick="window.runAiBatchLink()" class="btn btn-purple" style="font-size:16px;padding:14px 30px;">✨ Run AI Batch Linker</button>' +
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
    console.log('[AI Batch Linker] v20260329e — batched mode');
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
    if (skippedNoise) console.log('[AI Batch Linker] Skipped ' + skippedNoise + ' noise ingredients (method steps, glass types, etc.)');
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
            console.log('[Batch ' + (b+1) + '] got ' + batchMatches.length + ' matches');
            batchMatches.forEach(m => { allMatches.push({ ...m, idx: m.idx + globalOffset }); });
            processedBatches++;
        } catch (batchErr) {
            console.error('[Batch ' + (b+1) + '] failed:', batchErr.message);
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

    // Summary + action buttons (always shown)
    let html = '<div class="card" style="padding:15px;margin-bottom:15px;border-top:3px solid var(--purple);">';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">';
    if (withMatch.length>0) html += '<button onclick="window.acceptAllBatchLinks()" class="btn btn-green" style="font-size:15px;padding:12px 24px;">✅ Accept All ' + withMatch.length + ' Matches</button>';
    if (accepted.length>0) html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="font-size:15px;padding:12px 24px;">💾 Commit ' + accepted.length + ' Links</button>';
    html += '</div>';
    html += '<div style="font-size:13px;color:var(--text-muted);">🔗 ' + withMatch.length + ' suggested · ❓ ' + noMatch.length + ' no match · ✅ ' + accepted.length + ' accepted</div>';
    html += '</div>';

    // Paginated display — only render 50 items at a time to prevent freezing
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
        // Pagination controls
        if (totalPages > 1) {
            html += '<div style="display:flex;justify-content:center;gap:10px;margin:20px 0;">';
            if (page > 0) html += '<button onclick="window._batchLinkPage=' + (page-1) + ';window.renderBatchLinkQueue()" class="btn btn-outline" style="padding:8px 16px;">← Prev</button>';
            html += '<span style="padding:8px 16px;color:var(--text-muted);">Page ' + (page+1) + ' of ' + totalPages + '</span>';
            if (page < totalPages - 1) html += '<button onclick="window._batchLinkPage=' + (page+1) + ';window.renderBatchLinkQueue()" class="btn btn-outline" style="padding:8px 16px;">Next →</button>';
            html += '</div>';
        }
    }

    // Show accepted count summary (not individual items — too many)
    if (accepted.length > 0 && pending.length === 0) {
        html += '<button onclick="window.commitBatchLinks()" class="btn btn-purple" style="width:100%;margin-top:15px;font-size:16px;padding:14px;">💾 Commit All ' + accepted.length + ' Links</button>';
    }
    resultsDiv.innerHTML = html;
};
window._saveBatchQueue = () => { try { localStorage.setItem('_batchLinkQueue', JSON.stringify(window._batchLinkQueue)); } catch(e) {} };
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
        if(!origQty){ const parsed=window._parseIngredientLine(ing.name); origQty=parsed.qty||1; origUnit=origUnit||parsed.unit; }
        recipe.ingredients[item.ingIdx]={type:'inv',ref:inv.id,qty:origQty,unit:origUnit||inv.useUnit||'unit',name:inv.name,_rawName:ing.name};
        count++;
    });
    window.recalcAllCosts(); window._batchLinkQueue=null; try { localStorage.removeItem('_batchLinkQueue'); } catch(e) {} window.showToast(count+' ingredients linked!'); window.showView('recipes');
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
        '<button onclick="window.getMenuAiAdvice()" class="btn btn-purple" style="padding:10px 18px;font-size:13px;">🤖 AI Menu Advisor</button>' +
        '</div>' +
        '<div id="ai-menu-advice"></div>' +
        warnHtml +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;margin-bottom:25px;">' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--green);"><div style="font-size:34px;font-weight:bold;color:var(--green);">'+counts.star+'</div><div style="font-size:12px;color:var(--text-muted);">⭐ Stars</div></div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--blue);"><div style="font-size:34px;font-weight:bold;color:var(--blue);">'+counts.puzzle+'</div><div style="font-size:12px;color:var(--text-muted);">🧩 Puzzles</div></div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--orange);"><div style="font-size:34px;font-weight:bold;color:var(--orange);">'+counts.plowhorse+'</div><div style="font-size:12px;color:var(--text-muted);">🐴 Plow Horses</div></div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--red);"><div style="font-size:34px;font-weight:bold;color:var(--red);">'+counts.dog+'</div><div style="font-size:12px;color:var(--text-muted);">🐶 Dogs</div></div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(450px,1fr));gap:20px;">'+quadHtml+'</div></div>';
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
    const GP_TARGET = window.GP_TARGET || 70;

    // Recalculate costs
    menuRecipes.forEach(r => {
        let cost = 0;
        (r.ingredients||[]).forEach(ing => {
            if (ing.type === 'inv') { const inv = (window.inventoryItems||[]).find(i=>i.id===ing.ref); if (inv) cost += ing.qty * ((inv.price||0)/(inv.yield||1)); }
            else if (ing.type === 'batch') { const b = (window.recipes||[]).find(x=>x.id===ing.ref); if (b) cost += ing.qty * ((b.cost||0)/(b.yieldQty||1)); }
        });
        r.cost = cost; r.gp = r.price > 0 ? parseFloat(((r.price - cost) / r.price * 100).toFixed(1)) : 0;
    });

    const avgGp = menuRecipes.length > 0 ? menuRecipes.reduce((s,r) => s + r.gp, 0) / menuRecipes.length : 0;
    const avgCovers = menuRecipes.length > 0 ? menuRecipes.reduce((s,r) => s + (r.coversPerWeek||0), 0) / menuRecipes.length : 0;
    const classify = r => { const hi = r.gp >= avgGp, hv = (r.coversPerWeek||0) >= avgCovers; return hi && hv ? 'Star' : hi && !hv ? 'Puzzle' : !hi && hv ? 'Plowhorse' : 'Dog'; };

    const itemData = menuRecipes.map(r => `${r.name}: sell $${Number(r.price).toFixed(2)}, cost $${Number(r.cost).toFixed(2)}, GP ${r.gp}%, ${r.coversPerWeek||0} covers/wk, station: ${r.station||'Kitchen'}, category: ${classify(r)}`).join('\n');

    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

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

