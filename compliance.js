// --- HOBART HUB: Compliance Module ---
// Rotational tasks, shift checklists, temperature logging, compliance, maintenance, assets, contractors

// --- 3. ROTATIONAL TASKS ---
window._taskZoneFilter = window._taskZoneFilter || 'all';
window.renderTaskView = function() {
    const zones = window.taskZones || [];
    const tasks = window.rotationalTasks || [];
    const activeZone = window._taskZoneFilter || 'all';
    const zonePills = [
        '<span class="tag-pill ' + (activeZone==='all'?'active':'') + '" onclick="window._taskZoneFilter=\'all\';window.showView(\'tasks\');">All (' + tasks.length + ')</span>'
    ].concat(zones.map(function(z) {
        var count = tasks.filter(function(t) { return t.zone === z; }).length;
        return '<span class="tag-pill ' + (activeZone===z?'active':'') + '" onclick="window._taskZoneFilter=\'' + z.replace(/'/g,"\\'") + '\';window.showView(\'tasks\');">' + esc(z) + ' (' + count + ')</span>';
    })).join('');
    var unzonedCount = tasks.filter(function(t) { return !t.zone; }).length;
    var unzonedPill = unzonedCount > 0 ? '<span class="tag-pill ' + (activeZone==='unzoned'?'active':'') + '" onclick="window._taskZoneFilter=\'unzoned\';window.showView(\'tasks\');">Unassigned (' + unzonedCount + ')</span>' : '';

    return '<div style="max-width: 900px; margin: auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">' +
            '<div>' +
                '<h2 style="margin:0">🔄 Rotational Tasks</h2>' +
                '<div style="color:var(--text-muted);font-size:13px;margin-top:2px">Recurring tasks like deep cleans, filter changes, and stocktakes</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
                '<button onclick="window.renderTaskList()" class="btn btn-dark">Active Tasks</button>' +
                '<button onclick="window.renderTaskHistory()" class="btn btn-outline">Audit History</button>' +
                '<button onclick="window.editTaskZones()" class="btn btn-outline" title="Edit Zones">⚙️ Zones</button>' +
                '<button onclick="window.addTaskForm()" class="btn btn-blue">+ Add Task</button>' +
            '</div>' +
        '</div>' +
        '<div style="margin-bottom:16px;display:flex;flex-wrap:wrap;gap:6px;">' + zonePills + unzonedPill + '</div>' +
        '<div id="taskSubContent">' + window.renderTaskListTemplate() + '</div>' +
    '</div>';
};

window.renderTaskListTemplate = function() {
    const freqMap = { 'Weekly': 7, 'Fortnightly': 14, 'Monthly': 30, 'Quarterly': 90 };
    const allTasks = window.rotationalTasks || [];
    if (allTasks.length === 0) return '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🔄</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No rotational tasks</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add recurring tasks like deep cleans, filter changes, or stocktakes</div><button onclick="window.seedRotationalTasks()" class="btn btn-blue" style="margin-top:15px;">🏮 Load BWI Defaults</button></div>';

    const zoneFilter = window._taskZoneFilter || 'all';
    const tasks = allTasks.map(function(t, i) { return Object.assign({}, t, { _origIdx: i }); }).filter(function(t) {
        if (zoneFilter === 'all') return true;
        if (zoneFilter === 'unzoned') return !t.zone;
        return t.zone === zoneFilter;
    });
    if (tasks.length === 0) return '<div style="text-align:center;padding:32px 20px;color:var(--text-muted)"><div style="font-size:28px;margin-bottom:8px">📭</div><div style="font-size:14px;">No tasks in this zone.</div></div>';

    return '<div id="activeTasks">' + tasks.map((t) => { var i = t._origIdx;
        // Determine due status — supports both recurring freq and specific due date
        let isDue = true, daysLeftText = 'DUE NOW', nextDueStr = '';

        if (t.dueDateMode === 'specific' && t.specificDueDate) {
            const dueDate = new Date(t.specificDueDate);
            const today = new Date(); today.setHours(0,0,0,0);
            const daysUntil = Math.round((dueDate - today) / (1000*3600*24));
            isDue = daysUntil <= 0;
            daysLeftText = isDue ? (daysUntil < 0 ? Math.abs(daysUntil) + (Math.abs(daysUntil)===1?' day':' days') + ' overdue' : 'DUE TODAY') : 'Due in ' + daysUntil + (daysUntil===1?' day':' days');
            nextDueStr = 'Due: ' + dueDate.toLocaleDateString('en-AU', {day:'numeric',month:'short',year:'numeric'});
        } else if (t.lastLogIso) {
            const daysSince = (new Date() - new Date(t.lastLogIso)) / (1000*3600*24);
            const interval = freqMap[t.freq] || 7;
            isDue = daysSince >= interval;
            { const dl = Math.ceil(interval - daysSince); if (!isDue) daysLeftText = 'Due in ' + dl + (dl===1?' day':' days'); }
            nextDueStr = t.freq + ' | Last: ' + (t.lastDate || 'Never');
        } else if (t.anchorDate) {
            // Has anchor date but never done — check if anchor + interval has passed
            const anchorD = new Date(t.anchorDate);
            const today2 = new Date(); today2.setHours(0,0,0,0);
            const interval = freqMap[t.freq] || 7;
            if (anchorD > today2) {
                isDue = false;
                const daysUntilAnchor = Math.round((anchorD - today2) / (1000*3600*24));
                daysLeftText = 'Due in ' + daysUntilAnchor + (daysUntilAnchor===1?' day':' days');
            } else {
                const daysSinceAnchor = (today2 - anchorD) / 86400000;
                const intervalsPassed = Math.floor(daysSinceAnchor / interval);
                const nextDueDate = new Date(anchorD.getTime() + intervalsPassed * interval * 86400000);
                const daysUntilNext = Math.round((nextDueDate - today2) / 86400000);
                isDue = daysUntilNext <= 0;
                daysLeftText = isDue ? 'DUE NOW' : 'Due in ' + daysUntilNext + (daysUntilNext===1?' day':' days');
            }
            nextDueStr = t.freq + ' | First due: ' + anchorD.toLocaleDateString('en-AU', {day:'numeric',month:'short'});
        } else {
            nextDueStr = (t.dueDateMode === 'specific' ? 'Due: ' + (t.specificDueDate || 'Not set') : (t.freq || 'Weekly')) + ' | Never done';
        }

        const borderColor = isDue ? 'var(--red)' : (daysLeftText.match(/Due in [12] day/) ? 'var(--orange)' : 'var(--green)');
        return '<div class="card" style="border-left:3px solid ' + borderColor + ';padding:12px;margin-bottom:8px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
                '<div style="flex:1;">' +
                    '<strong style="font-size:14px;">' + esc(t.name) + '</strong>' +
                    (t.zone ? ' <span style="font-size:10px;background:var(--bg-main);color:var(--brand-accent);padding:2px 7px;border-radius:10px;margin-left:6px;font-weight:600;border:1px solid var(--border);">' + esc(t.zone) + '</span>' : '') +
                    (t.notes ? '<br><small style="color:var(--text-muted);font-size:12px;">' + esc(t.notes) + '</small>' : '') +
                    '<br><small style="color:var(--text-muted);">' + nextDueStr + '</small>' +
                    '<br><strong style="font-size:12px;display:inline-block;margin-top:4px;color:' + (isDue?'var(--red)':'var(--green)') + ';">' + daysLeftText + '</strong>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                    '<input type="text" id="staff-' + i + '" placeholder="Staff Initials" class="input-box" style="width:110px;margin:0;">' +
                    '<button onclick="window.logTaskCompletion(' + i + ')" class="btn btn-green">Log Done</button>' +
                    '<button onclick="window.editTaskForm(' + i + ')" class="btn btn-outline" style="font-size:12px;padding:6px 10px;">✏️ Edit</button>' +
                    '<button onclick="window.delTask(' + i + ')" style="color:var(--red);background:none;border:none;cursor:pointer;font-size:18px;">&times;</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('') + '</div>';
};

window.renderTaskList = () => { document.getElementById('taskSubContent').innerHTML = window.renderTaskListTemplate(); };
window.renderTaskHistory = () => {
    const zoneFilter = window._taskZoneFilter || 'all';
    const allHistory = (window.taskHistory||[]).slice().reverse();
    const filtered = zoneFilter === 'all' ? allHistory :
        zoneFilter === 'unzoned' ? allHistory.filter(function(h) { return !h.zone; }) :
        allHistory.filter(function(h) { return h.zone === zoneFilter; });
    const rows = filtered.map(h =>
        '<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:12px 15px;font-size:13px;color:var(--text-muted);">' + esc(h.date) + '</td><td style="padding:12px 15px;">' + esc(h.name) + '</td><td style="padding:12px 15px;">' + (h.zone ? '<span style="font-size:10px;background:var(--bg-main);color:var(--brand-accent);padding:2px 6px;border-radius:10px;border:1px solid var(--border);">' + esc(h.zone) + '</span>' : '<span style="color:var(--text-muted);font-size:11px;">—</span>') + '</td><td style="padding:12px 15px;"><strong>' + esc(h.staff) + '</strong></td></tr>'
    ).join('');
    document.getElementById('taskSubContent').innerHTML = '<table style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;">' +
        '<thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
        '<th style="padding:12px 15px;">Date</th><th style="padding:12px 15px;">Task</th><th style="padding:12px 15px;">Zone</th><th style="padding:12px 15px;">Staff</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="4" style="padding:15px;color:var(--text-muted);text-align:center;">No history yet.</td></tr>') + '</tbody></table>';
};

window.addTaskForm = (editIdx) => {
    const t = editIdx !== undefined ? window.rotationalTasks[editIdx] : { name:'', freq:'Weekly', dueDateMode:'recurring', specificDueDate:'', notes:'', zone:'' };
    const isEdit = editIdx !== undefined;
    const today = new Date().toISOString().split('T')[0];
    const zones = window.taskZones || [];
    const zoneOpts = '<option value="">(No Zone)</option>' + zones.map(z => '<option value="' + esc(z) + '" ' + (t.zone===z?'selected':'') + '>' + esc(z) + '</option>').join('');
    const html = '<label style="font-size:11px;color:var(--text-muted);">Task Name</label>' +
        '<input type="text" id="t-n" class="input-box" value="' + esc(t.name||'') + '" placeholder="e.g. Grease Trap Clean">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
            '<div><label style="font-size:11px;color:var(--text-muted);">Zone</label><select id="t-zone" class="input-box">' + zoneOpts + '</select></div>' +
            '<div><label style="font-size:11px;color:var(--text-muted);">Notes (optional)</label><input type="text" id="t-notes" class="input-box" value="' + esc(t.notes||'') + '" placeholder="e.g. Check gasket seal"></div>' +
        '</div>' +
        '<label style="font-size:11px;color:var(--text-muted);">Schedule Type</label>' +
        '<select id="t-mode" class="input-box" onchange="document.getElementById(\'t-recurring\').style.display=this.value===\'recurring\'?\'block\':\'none\';document.getElementById(\'t-specific\').style.display=this.value===\'specific\'?\'block\':\'none\'">' +
            '<option value="recurring" ' + ((t.dueDateMode||'recurring')==='recurring'?'selected':'') + '>Recurring (Weekly/Monthly etc)</option>' +
            '<option value="specific" ' + (t.dueDateMode==='specific'?'selected':'') + '>Specific Due Date</option>' +
        '</select>' +
        '<div id="t-recurring" style="display:' + ((t.dueDateMode||'recurring')==='recurring'?'block':'none') + ';">' +
            '<label style="font-size:11px;color:var(--text-muted);">Frequency</label>' +
            '<select id="t-f" class="input-box">' +
                ['Weekly','Fortnightly','Monthly','Quarterly'].map(f => '<option ' + (t.freq===f?'selected':'') + '>' + f + '</option>').join('') +
            '</select>' +
            '<label style="font-size:11px;color:var(--text-muted);">First Due Date (when should this first be done?)</label>' +
            '<input type="date" id="t-anchor" class="input-box" value="' + (t.anchorDate || '') + '" placeholder="Leave blank for immediately">' +
            '<p style="font-size:11px;color:var(--text-muted);margin:0;">After completion, next due = completion date + frequency interval.</p>' +
        '</div>' +
        '<div id="t-specific" style="display:' + (t.dueDateMode==='specific'?'block':'none') + ';">' +
            '<label style="font-size:11px;color:var(--text-muted);">Due Date</label>' +
            '<input type="date" id="t-date" class="input-box" value="' + (t.specificDueDate||today) + '">' +
        '</div>' +
        '<button onclick="window.subTask(' + (isEdit?editIdx:'undefined') + ')" class="btn btn-green" style="width:100%;margin-top:5px;">' + (isEdit?'Save Changes':'Add Task') + '</button>';
    window.openModal(isEdit ? '✏️ Edit Task' : '🔄 New Task', html);
};

window.editTaskForm = (i) => { window.addTaskForm(i); };

window.subTask = (editIdx) => {
    const name = document.getElementById('t-n').value.trim();
    if (!name) return window.showToast('Task name required.', 'error');
    const mode = document.getElementById('t-mode').value;
    const freq = mode === 'recurring' ? document.getElementById('t-f').value : 'Once';
    const specificDueDate = mode === 'specific' ? document.getElementById('t-date').value : '';
    const notes = document.getElementById('t-notes').value.trim();
    const zone = document.getElementById('t-zone') ? document.getElementById('t-zone').value : '';
    const anchorDate = mode === 'recurring' && document.getElementById('t-anchor') ? document.getElementById('t-anchor').value : '';
    const obj = { name, freq, dueDateMode: mode, specificDueDate, notes, zone, anchorDate, lastLogIso: null, lastDate: 'Never' };
    if (editIdx !== undefined && editIdx !== 'undefined') {
        // Preserve completion history when editing
        obj.lastLogIso = window.rotationalTasks[editIdx].lastLogIso;
        obj.lastDate = window.rotationalTasks[editIdx].lastDate;
        if (!obj.anchorDate) obj.anchorDate = window.rotationalTasks[editIdx].anchorDate;
        if (!obj.zone && window.rotationalTasks[editIdx].zone) obj.zone = window.rotationalTasks[editIdx].zone;
        window.rotationalTasks[editIdx] = obj;
        window.showToast('Task updated!');
    } else {
        window.rotationalTasks.push(obj);
        window.showToast('Task created!');
    }
    window.saveToDisk(); window.closeModal(); window.showView('tasks');
};

window.logTaskCompletion = (i) => {
    const s = document.getElementById('staff-' + i).value;
    if (!s) return window.showToast('Enter staff initials.', 'error');
    const today = new Date().toISOString().split('T')[0];
    window._taskLogStaff = s;
    const html = '<p style="font-size:13px;color:var(--text-muted);margin-top:0;">Logging: <strong>' + esc(window.rotationalTasks[i].name) + '</strong></p>' +
        '<label style="font-size:11px;color:var(--text-muted);">Completion Date</label>' +
        '<div style="display:flex;gap:8px;margin-bottom:15px;">' +
            '<button onclick="window._confirmTaskLog(' + i + ',window._taskLogStaff,\'today\')" class="btn btn-green" style="flex:1;">✓ Today</button>' +
            '<button onclick="document.getElementById(\'t-custom-date\').style.display=\'block\'" class="btn btn-outline" style="flex:1;">📅 Pick Date</button>' +
        '</div>' +
        '<div id="t-custom-date" style="display:none;">' +
            '<input type="date" id="t-log-date" class="input-box" value="' + today + '">' +
            '<button onclick="window._confirmTaskLog(' + i + ',window._taskLogStaff,\'custom\')" class="btn btn-green" style="width:100%;">Confirm Date</button>' +
        '</div>';
    window.openModal('✓ Log Task Completion', html);
};

window._confirmTaskLog = (i, staff, mode) => {
    let logDate;
    if (mode === 'custom') {
        const d = document.getElementById('t-log-date').value;
        if (!d) return window.showToast('Select a date.', 'error');
        logDate = new Date(d);
    } else {
        logDate = new Date();
    }
    const dateStr = logDate.toLocaleDateString('en-AU');
    window.taskHistory.push({ name: window.rotationalTasks[i].name, staff, date: dateStr, zone: window.rotationalTasks[i].zone || '' });
    window.rotationalTasks[i].lastLogIso = logDate.toISOString();
    window.rotationalTasks[i].lastDate = dateStr;
    // If specific due date mode — clear the due date after completion (task done)
    if (window.rotationalTasks[i].dueDateMode === 'specific') {
        window.rotationalTasks[i].specificDueDate = '';
    }
    window.saveToDisk(); window.closeModal(); window.showView('tasks'); window.showToast('Task logged!');
};

window.delTask = (i) => { window.confirmAction({ title:'🔄 Delete Task', message:'Delete this rotational task?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.rotationalTasks.splice(i,1); window.saveToDisk(); window.showView('tasks'); } }); };

// --- 4. COMPLIANCE ---

// =============================================================================
// SHIFT CHECKLISTS — Opening / Pre-Service / Closing
// =============================================================================
window.renderShiftChecklists = () => {
    const hour = new Date().getHours();
    const shiftType = hour < 14 ? 'opening' : hour < 20 ? 'preservice' : 'closing';
    const shiftLabel = { opening:'Opening', preservice:'Pre-Service', closing:'Closing' }[shiftType];
    const shiftColor = { opening:'var(--blue)', preservice:'var(--orange)', closing:'var(--purple)' }[shiftType];

    const defaultLists = {
        opening: [
            'Check & sign fridge/freezer temps',
            'Check all equipment is operational',
            'Check bar stock levels against PAR',
            'Float count and till setup',
            'Check reservations and covers for service',
            'Brief FOH team on specials and off-menu items',
            'Check cleanliness of all areas',
            'Check toilets and restock supplies'
        ],
        preservice: [
            'Final mise en place check',
            'Candles and music levels set',
            'POS system tested and ready',
            'Staff briefed on allergens for tonight',
            'Ice bins filled',
            'Fridges and speed rails stocked',
            'Garnishes prepped',
            'Communication with kitchen confirmed'
        ],
        closing: [
            'All food stored correctly — FIFO checked',
            'Fridge and freezer temps logged',
            'Bar cleaned down and restocked',
            'Till counted and reconciled with takings',
            'Wastage logged',
            'All equipment turned off / secured',
            'Doors and windows locked',
            'Handover notes completed'
        ]
    };

    const allLists = window.shiftChecklistItems || defaultLists;
    if (!window.shiftChecklistItems) window.shiftChecklistItems = defaultLists;

    const activeList = allLists[shiftType] || [];
    const stateKey = 'shiftCheck_' + new Date().toLocaleDateString() + '_' + shiftType;
    window._scStateKey = stateKey;
    window._scType = shiftType;
    window._scLabel = shiftLabel;
    const saved = JSON.parse(localStorage.getItem(stateKey) || '[]');

    const items = activeList.map((item, i) => {
        const checked = saved.includes(i);
        return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--border);">' +
            '<input type="checkbox" id="sc-' + i + '" ' + (checked?'checked':'') + ' onchange="window.saveShiftCheckItem(' + i + ',window._scStateKey)" style="transform:scale(1.3);flex-shrink:0;">' +
            '<label for="sc-' + i + '" style="cursor:pointer;font-size:13px;' + (checked?'text-decoration:line-through;color:var(--text-muted);':'') + '">' + esc(item) + '</label>' +
        '</div>';
    }).join('');

    const doneCount = saved.length;
    const pct = activeList.length > 0 ? Math.round(doneCount/activeList.length*100) : 0;

    return '<div class="card" style="border-top:5px solid ' + shiftColor + ';margin-top:30px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
            '<h3 style="margin:0;color:' + shiftColor + ';">' + shiftLabel + ' Checklist</h3>' +
            '<div style="text-align:right;">' +
                '<div style="font-size:16px;font-weight:bold;color:' + (pct===100?'var(--green)':shiftColor) + ';">' + pct + '%</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + doneCount + ' / ' + activeList.length + ' done</div>' +
            '</div>' +
        '</div>' +
        '<div style="background:var(--bg-main);border-radius:6px;height:6px;margin-bottom:15px;">' +
            '<div style="background:' + (pct===100?'var(--green)':shiftColor) + ';height:100%;border-radius:6px;width:' + pct + '%;transition:width 0.3s;"></div>' +
        '</div>' +
        items +
        '<div style="margin-top:15px;display:flex;gap:8px;">' +
            '<input type="text" id="sc-staff" class="input-box" placeholder="Staff initial to sign off..." style="margin:0;flex:1;">' +
            '<button onclick="window.signOffShiftCheck(window._scType,window._scLabel,window._scStateKey)" class="btn btn-dark" style="flex-shrink:0;">Sign Off</button>' +
        '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;">' +
            '<button onclick="window.showView(\'compliance\')" class="btn btn-outline" style="font-size:11px;flex:1;">↻ Refresh</button>' +
            '<button onclick="window.editShiftChecklist(window._scType)" class="btn btn-outline" style="font-size:11px;flex:1;">⚙️ Edit List</button>' +
        '</div>' +
    '</div>';
};

window.saveShiftCheckItem = (i, key) => {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = saved.indexOf(i);
    if (idx >= 0) saved.splice(idx,1); else saved.push(i);
    localStorage.setItem(key, JSON.stringify(saved));
};

window.signOffShiftCheck = (type, label, stateKey) => {
    const staff = document.getElementById('sc-staff') ? document.getElementById('sc-staff').value.trim() : '';
    if (!staff) return window.showToast('Enter staff initial to sign off.','error');
    const saved = JSON.parse(localStorage.getItem(stateKey) || '[]');
    const total = (window.shiftChecklistItems || {})[type] ? window.shiftChecklistItems[type].length : 0;
    window.complianceLogs.push({ type: label + ' Checklist', staff, time: new Date().toLocaleString(), pct: total > 0 ? Math.round(saved.length/total*100) : 0 });
    window.saveToDisk();
    window.showToast(label + ' checklist signed off!');
    window.showView('compliance');
};

window.editShiftChecklist = (type) => {
    if (!window.shiftChecklistItems) window.shiftChecklistItems = {};
    const items = window.shiftChecklistItems[type] || [];
    const label = { opening:'Opening', preservice:'Pre-Service', closing:'Closing' }[type];
    const rows = items.map((item, i) =>
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border);">' +
        '<span style="font-size:13px;flex:1;">' + esc(item) + '</span>' +
        '<button onclick="window.removeShiftItem(window._scType,' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button>' +
        '</div>'
    ).join('');
    const html = '<div style="max-height:40vh;overflow-y:auto;margin-bottom:15px;">' + (rows||'<p style="color:var(--text-muted);font-size:13px;">No items yet.</p>') + '</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<input type="text" id="sc-new-item" class="input-box" placeholder="New checklist item..." style="margin:0;flex:1;">' +
        '<button onclick="window.addShiftItem(window._scType)" class="btn btn-green">Add</button>' +
        '</div>';
    window.openModal('⚙️ Edit ' + label + ' Checklist', html);
};

window.addShiftItem = (type) => {
    const val = document.getElementById('sc-new-item').value.trim();
    if (!val) return;
    if (!window.shiftChecklistItems) window.shiftChecklistItems = {};
    if (!window.shiftChecklistItems[type]) window.shiftChecklistItems[type] = [];
    window.shiftChecklistItems[type].push(val);
    window.saveToDisk(); window.editShiftChecklist(type);
};

window.removeShiftItem = (type, i) => {
    window.shiftChecklistItems[type].splice(i,1);
    window.saveToDisk(); window.editShiftChecklist(type);
};

window._complianceTab = window._complianceTab || 'temps';
window.exportTempLogCSV = () => {
    const logs = window.tempLogs || [];
    if (!logs.length) return window.showToast('No temperature logs to export.', 'error');
    const headers = ['Date/Time','Unit','Temperature (°C)','Staff','Corrective Action','Status'];
    const rows = logs.map(t => [
        t.time||'', t.unit||'', t.value||'', t.staff||'', t.action||'',
        (Number(t.value) > 5 || Number(t.value) < -25) ? 'FAIL' : 'PASS'
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'temp-logs-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    window.showToast(logs.length + ' temp logs exported.');
};

window.printTempLog = function() {
    var logs = (window.tempLogs || []).slice(-30).reverse();
    if (!logs.length) return window.showToast('No temperature logs to print.', 'error');
    var html = '<table><thead><tr><th>Date/Time</th><th>Staff</th><th>Unit</th><th>Temp (°C)</th><th>Status</th><th>Corrective Action</th></tr></thead><tbody>';
    logs.forEach(function(t) {
        var temp = Number(t.value || 0);
        var fail = temp > 5 || temp < -25;
        html += '<tr>' +
            '<td>' + esc(t.time || '') + '</td>' +
            '<td>' + esc(t.staff || '') + '</td>' +
            '<td>' + esc(t.unit || '') + '</td>' +
            '<td class="' + (fail ? 'flag-red' : 'flag-green') + '">' + temp + '°C</td>' +
            '<td class="' + (fail ? 'flag-red' : 'flag-green') + '">' + (fail ? 'FAIL' : 'PASS') + '</td>' +
            '<td>' + esc(t.action || '—') + '</td></tr>';
    });
    html += '</tbody></table>';
    window.printReport('Temperature Log', html, { landscape: true, subtitle: 'Last 30 entries' });
};

window.renderComplianceView = function() {
    const E = window.esc;
    const tab = window._complianceTab || 'temps';
    const tabPills = ['temps','shift','custom','haccp'].map(t => {
        const labels = { temps:'🌡️ Temperatures', shift:'✅ Shift Checklist', custom:'📋 Custom Checklists', haccp:'📋 HACCP History' };
        return `<span class="tag-pill ${tab===t?'active':''}" onclick="window._complianceTab='${t}';window.showView('compliance');">${labels[t]}</span>`;
    }).join('');

    let content = '';

    if (tab === 'temps') {
        const recentTemps = (window.tempLogs || []).slice(-8).reverse();
        content = `<div class="card" style="border-top:5px solid var(--blue);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;">Fridge/Freezer Temp Log</h3>
                <div style="display:flex;gap:6px;">
                    <button onclick="window.exportTempLogCSV()" class="btn btn-outline" style="padding:6px 12px;font-size:11px;">📥 Export CSV</button>
                    <button onclick="window.printTempLog()" class="btn btn-outline" style="padding:6px 12px;font-size:11px;">🖨️ Print</button>
                    <button onclick="window.editFridges()" class="btn btn-outline" style="padding:6px 12px;font-size:11px;">⚙️ Setup Units</button>
                </div>
            </div>
            ${(window.fridgeUnits||[]).length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-muted);"><div style="font-size:28px;margin-bottom:8px;">🌡️</div><div style="font-size:13px;">No fridge units configured.</div><button onclick="window.seedFridgeUnits()" class="btn btn-blue" style="margin-top:10px;">🏮 Load BWI Defaults</button></div>' : `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:15px;">
                ${(window.fridgeUnits||[]).map((f,i) => `<div style="background:var(--bg-main);padding:10px;border-radius:6px;border:1px solid var(--border);">
                    <strong style="font-size:12px;display:block;margin-bottom:8px;color:var(--brand-dark);">${E(f)}</strong>
                    <input type="number" step="0.1" id="t-val-${i}" oninput="window.checkT(${i})" class="input-box" placeholder="Temp °C" style="margin:0;width:100%;">
                    <div id="t-warn-${i}" style="display:none;margin-top:10px;">
                        <small style="color:var(--red);font-weight:bold;display:block;margin-bottom:4px;">⚠️ High Temp Alert</small>
                        <input type="text" id="t-action-${i}" class="input-box" placeholder="Corrective Action" style="margin:0;border-color:var(--red);font-size:12px;padding:6px;">
                    </div>
                </div>`).join('')}
            </div>
            <div style="display:flex;gap:10px;border-top:1px solid var(--border);padding-top:20px;">
                <input type="text" id="t-staff" class="input-box" placeholder="Staff Name Signing Off" style="flex:1;margin:0;">
                <button onclick="window.logAllTemps()" class="btn btn-blue" style="width:200px;">Log All Temps</button>
            </div>`}
            ${recentTemps.length > 0 ? `<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:15px;">
                <h4 style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);text-transform:uppercase;">Recent Logs</h4>
                <table style="width:100%;font-size:13px;text-align:left;border-collapse:collapse;"><tbody>
                    ${recentTemps.map(t => `<tr style="border-bottom:1px dashed var(--border);"><td style="padding:5px 0;font-size:12px;">${E(t.unit)}</td><td style="color:${t.value>5?'var(--red)':'var(--green)'};font-weight:bold;">${t.value}°C</td><td style="color:var(--text-muted);">${E(t.staff)}</td><td>${t.action?`<span style="color:var(--red);font-size:11px;">Action: ${E(t.action)}</span><br>`:''}<span style="color:var(--text-muted);font-size:11px;">${t.time}</span></td></tr>`).join('')}
                </tbody></table>
                <button onclick="window.showTempHistory()" class="btn btn-outline" style="width:100%;margin-top:12px;font-size:12px;">📋 View Full History</button>
            </div>` : ''}
        </div>`;
    }

    if (tab === 'shift') {
        content = window.renderShiftChecklists();
    }

    if (tab === 'haccp') {
        content = window.renderHACCPHistory ? window.renderHACCPHistory() : '<p style="color:var(--text-muted);">HACCP History not available.</p>';
    }

    if (tab === 'custom') {
        const checklists = window.masterChecklists || {};
        const keys = Object.keys(checklists);
        content = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:15px;">
            <button onclick="window.renderChecklistHistory()" class="btn btn-outline" style="font-size:12px;">📋 History</button>
            <button onclick="window.editChecklists()" class="btn btn-outline" style="font-size:12px;">⚙️ Edit Lists</button>
        </div>` + (keys.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">📋</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No custom checklists yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5;">Create audit checklists for weekly deep cleans, monthly inspections, or any recurring checks your venue needs.</div><button onclick="window.seedMasterChecklists()" class="btn btn-blue" style="margin-top:15px;">🏮 Load BWI Defaults</button></div>' :
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:20px;">
            ${keys.map(l => `<div class="card" style="padding:14px;"><h4 style="margin:0 0 15px 0;color:var(--brand-accent);">${E(l)}</h4>${(checklists[l]||[]).map(item => `<div style="font-size:13px;margin:8px 0;"><label style="cursor:pointer;display:flex;gap:10px;align-items:center;"><input type="checkbox" style="transform:scale(1.2);"> <span>${E(item)}</span></label></div>`).join('')}<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:15px;display:flex;gap:10px;"><input type="text" id="s-${l.replace(/\s/g,'')}" class="input-box" placeholder="Staff Initial" style="margin:0;"><button onclick="window.signCheck('${l}')" class="btn btn-dark">Sign Off</button></div></div>`).join('')}
        </div>`);
    }

    // --- Manager Overview Widget ---
    const _today = new Date().toLocaleDateString();
    const _freqMap = { 'Weekly': 7, 'Fortnightly': 14, 'Monthly': 30, 'Quarterly': 90 };
    const _allTasks = window.rotationalTasks || [];
    let _overdue = 0, _dueToday = 0;
    _allTasks.forEach(t => {
        if (!t.lastDone) { _overdue++; return; }
        const interval = _freqMap[t.freq] || 7;
        const days = Math.floor((Date.now() - new Date(t.lastDone).getTime()) / 86400000);
        if (days > interval) _overdue++;
        else if (days >= interval) _dueToday++;
    });
    const _todayTemps = (window.tempLogs || []).filter(t => t.time && t.time.startsWith(_today));
    const _tempsDone = _todayTemps.length > 0;
    const _lastSignOff = (window.complianceLogs || []).slice(-1)[0];
    const _lastSignText = _lastSignOff ? `${E(_lastSignOff.staff || '?')} — ${E(_lastSignOff.time || '')}` : 'None';

    const overviewWidget = `<div class="card" style="padding:14px 18px;margin-bottom:18px;border-top:4px solid var(--blue);display:flex;flex-wrap:wrap;gap:18px;align-items:center;">
        <div style="font-size:13px;font-weight:700;color:var(--text-muted);margin-right:auto;">📊 Overview</div>
        <div style="text-align:center;min-width:80px;">
            <div style="font-size:22px;font-weight:800;color:${_overdue>0?'var(--red)':'var(--green)'};">${_overdue}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Overdue</div>
        </div>
        <div style="text-align:center;min-width:80px;">
            <div style="font-size:22px;font-weight:800;color:${_dueToday>0?'var(--orange)':'var(--green)'};">${_dueToday}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Due Today</div>
        </div>
        <div style="text-align:center;min-width:80px;">
            <div style="font-size:22px;font-weight:800;color:${_tempsDone?'var(--green)':'var(--red)'};">${_tempsDone?'✅':'❌'}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Temps Today</div>
        </div>
        <div style="text-align:center;min-width:120px;">
            <div style="font-size:12px;font-weight:600;color:var(--text-main);white-space:nowrap;">${_lastSignText}</div>
            <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Last Sign-off</div>
        </div>
    </div>`;

    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">Compliance</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Temperature logs, shift checklists, and custom audits</div>
            </div>
        </div>
        ${overviewWidget}
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabPills}</div>
        ${content}
    </div>`;
}

window.showTempHistory = () => {
    const logs = (window.tempLogs || []).slice().reverse();
    if (!logs.length) return window.showToast('No temperature logs yet.', 'error');
    const units = [...new Set(logs.map(t => t.unit))].sort();
    const filterUnit = window._tempHistFilter || '';
    const filtered = filterUnit ? logs.filter(t => t.unit === filterUnit) : logs;
    const unitOpts = '<option value="">All Units</option>' + units.map(u => '<option value="' + esc(u) + '"' + (filterUnit === u ? ' selected' : '') + '>' + esc(u) + '</option>').join('');
    const rows = filtered.slice(0, 100).map(t => {
        const temp = Number(t.value || 0);
        const fail = temp > 5 || temp < -25;
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">' + esc(t.time || '') + '</td>' +
            '<td style="padding:6px 8px;font-size:13px;">' + esc(t.unit || '') + '</td>' +
            '<td style="padding:6px 8px;font-weight:bold;color:' + (fail ? 'var(--red)' : 'var(--green)') + ';">' + temp + '°C</td>' +
            '<td style="padding:6px 8px;font-size:12px;color:' + (fail ? 'var(--red)' : 'var(--green)') + ';">' + (fail ? 'FAIL' : 'PASS') + '</td>' +
            '<td style="padding:6px 8px;font-size:12px;">' + esc(t.staff || '') + '</td>' +
            '<td style="padding:6px 8px;font-size:11px;color:var(--red);">' + (t.action ? esc(t.action) : '') + '</td>' +
        '</tr>';
    }).join('');
    const html = '<div style="margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
        '<select class="input-box" style="margin:0;flex:1;" onchange="window._tempHistFilter=this.value;window.showTempHistory()">' + unitOpts + '</select>' +
        '<button onclick="window.exportTempLogCSV()" class="btn btn-outline" style="font-size:12px;">📥 Export CSV</button>' +
        '<button onclick="window.printTempLog()" class="btn btn-outline" style="font-size:12px;">🖨️ Print</button>' +
        '<span style="font-size:12px;color:var(--text-muted);">' + filtered.length + ' logs</span>' +
    '</div>' +
    '<div style="max-height:55vh;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;position:sticky;top:0;">' +
    '<th style="padding:8px;text-align:left;">Date/Time</th><th style="padding:8px;text-align:left;">Unit</th><th style="padding:8px;text-align:left;">Temp</th><th style="padding:8px;text-align:left;">Status</th><th style="padding:8px;text-align:left;">Staff</th><th style="padding:8px;text-align:left;">Action</th>' +
    '</tr></thead><tbody>' + (rows || '<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--text-muted);">No logs yet.</td></tr>') + '</tbody></table></div>';
    window.openModal('🌡️ Temperature Log History (' + filtered.length + ' entries)', html);
};

window.checkT = (i) => {
    const val = parseFloat(document.getElementById(`t-val-${i}`).value);
    const warnEl = document.getElementById(`t-warn-${i}`);
    if (!warnEl || isNaN(val)) return;
    const unitName = ((window.fridgeUnits||[])[i] || '').toLowerCase();
    const isFreezer = unitName.includes('freezer') || unitName.includes('freeze');
    let warning = '';
    if (isFreezer) {
        // Freezer: should be -18°C or below
        if (val > -15) warning = `⚠️ ${val}°C — Freezer should be -18°C or below! Corrective action required.`;
    } else {
        // Fridge: 0-5°C
        if (val > 5) warning = `⚠️ ${val}°C — Above 5°C! Check fridge and take corrective action.`;
        else if (val < 0) warning = `⚠️ ${val}°C — Below 0°C! Risk of freezing damage.`;
    }
    // Extreme bounds
    if (val < -30 || val > 300) warning = `⚠️ ${val}°C seems unusual (-30 to 300 range expected).`;
    warnEl.style.display = warning ? 'block' : 'none';
    if (warning) warnEl.innerHTML = '<span style="color:var(--red);font-weight:bold;">' + warning + '</span>';
};
window.logAllTemps = () => { 
    const staff = document.getElementById('t-staff').value;
    if(!staff) return window.showToast("Please enter your name.", "error"); 
    let logsToAdd = []; const timeNow = new Date().toLocaleString();
    for(let i = 0; i < (window.fridgeUnits || []).length; i++) {
        const valStr = document.getElementById(`t-val-${i}`).value;
        if(!valStr) continue; 
        const val = parseFloat(valStr); let action = "";
        if(val > 5) { action = document.getElementById(`t-action-${i}`).value; if(!action) return window.showToast(`High temp requires Action!`, "error"); }
        logsToAdd.push({ unit: window.fridgeUnits[i], value: val, staff: staff, action: action, time: timeNow });
    }
    if(logsToAdd.length === 0) return window.showToast("Enter at least one temp.", "error");
    window.tempLogs.push(...logsToAdd); window.saveToDisk(); window.showToast("Temps Logged!"); window.showView('compliance'); 
};
window.signCheck = (l) => {
    const staffEl = document.getElementById('s-' + l.replace(/\s/g,''));
    if (!staffEl || !staffEl.value) return window.showToast('Please sign name', 'error');
    window.complianceLogs.push({ type: l, staff: staffEl.value, time: new Date().toLocaleString() });
    window.saveToDisk(); window.showToast(l + ' Signed Off'); window.showView('compliance');
};

window.renderChecklistHistory = () => {
    const logs = (window.complianceLogs || []).slice().reverse();
    const types = [...new Set((window.complianceLogs||[]).map(l=>l.type))].sort();
    const filterType = window._checkHistFilter || '';
    const filtered = filterType ? logs.filter(l=>l.type===filterType) : logs;
    const typeOpts = '<option value="">All Checklists</option>' + types.map(t=>'<option value="'+esc(t)+'" '+(filterType===t?'selected':'')+'>'+esc(t)+'</option>').join('');
    const rows = filtered.map(l =>
        '<tr style="border-bottom:1px solid var(--border);">'+
        '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">'+l.time+'</td>'+
        '<td style="padding:6px 8px;font-weight:bold;font-size:13px;">'+esc(l.type)+'</td>'+
        '<td style="padding:6px 8px;font-size:13px;">'+esc(l.staff)+'</td>'+
        '</tr>'
    ).join('');
    const html = '<div style="margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
        '<select class="input-box" style="margin:0;flex:1;" onchange="window._checkHistFilter=this.value;window.renderChecklistHistory()">'+typeOpts+'</select>' +
        '<button onclick="window.exportChecklistHistory()" class="btn btn-outline" style="font-size:12px;">📊 Export CSV</button>' +
        '<span style="font-size:12px;color:var(--text-muted);">'+filtered.length+' sign-offs</span>' +
        '</div>' +
        '<div style="max-height:55vh;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;position:sticky;top:0;">' +
        '<th style="padding:10px;text-align:left;">Time</th><th style="padding:10px;text-align:left;">Checklist</th><th style="padding:10px;text-align:left;">Staff</th>' +
        '</tr></thead><tbody>'+(rows||'<tr><td colspan="3" style="padding:20px;text-align:center;color:var(--text-muted);">No sign-offs yet.</td></tr>')+'</tbody></table></div>';
    window.openModal('📋 Checklist Sign-Off History ('+logs.length+' total)', html);
};

window.exportChecklistHistory = () => {
    const logs = (window.complianceLogs||[]).slice().reverse();
    const rows = logs.map(l => ['"'+l.time+'"','"'+l.type+'"','"'+l.staff+'"'].join(','));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('Time,Checklist,Staff\n' + rows.join('\n'));
    a.download = 'ChecklistHistory_BWI_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    window.showToast('Checklist history exported!');
};

window.editFridges = () => { 
    let html = `<div style="margin-bottom:20px;">${(window.fridgeUnits || []).map((f, i) => `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); align-items:center;"><span style="font-size:14px;">${esc(f)}</span> <button onclick="window.delFridge(${i})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:18px;">&times;</button></div>`).join('')}</div><div style="display:flex; gap:10px;"><input type="text" id="new-fridge" class="input-box" placeholder="New Unit Name" style="margin:0;"><button onclick="window.addFridge()" class="btn btn-green">Add Unit</button></div>`;
    window.openModal("⚙️ Setup Fridges/Freezers", html);
};
window.addFridge = () => { const v = document.getElementById('new-fridge').value; if(v) { window.fridgeUnits.push(v); window.saveToDisk(); window.editFridges(); } };
window.delFridge = (i) => { window.fridgeUnits.splice(i,1); window.saveToDisk(); window.editFridges(); };

window.editChecklists = () => {
    let html = `<div style="display:flex; gap:10px; margin-bottom:20px;"><input type="text" id="new-cat" class="input-box" placeholder="New Category (e.g. Weekly Deep Clean)" style="margin:0;"><button onclick="window.addChecklistCat()" class="btn btn-blue">Add Category</button></div><div style="max-height:60vh; overflow-y:auto; padding-right:10px;">`;
    Object.keys(window.masterChecklists || {}).forEach(cat => { html += `<div style="background:var(--bg-main); padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid var(--border);"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><h4 style="margin:0; color:var(--brand-accent);">${esc(cat)}</h4><button onclick="window.delChecklistCat('${escAttr(cat)}')" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:11px; text-decoration:underline;">Delete Category</button></div>${(window.masterChecklists[cat] || []).map((item, idx) => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border);"><span style="font-size:13px;">${esc(item)}</span><button onclick="window.delChecklistItem('${escAttr(cat)}', ${idx})" style="color:var(--red); background:none; border:none; cursor:pointer;">&times;</button></div>`).join('')}<div style="display:flex; gap:10px; margin-top:15px;"><input type="text" id="add-item-${cat.replace(/\s/g,'')}" class="input-box" placeholder="New task..." style="margin:0; font-size:12px; padding:6px;"><button onclick="window.addChecklistItem('${escAttr(cat)}')" class="btn btn-green" style="padding:6px 12px; font-size:11px;">Add Task</button></div></div>`; });
    html += `</div>`;
    window.openModal("⚙️ Edit Checklists", html);
};
window.addChecklistCat = () => { const v = document.getElementById('new-cat').value; if(v && !window.masterChecklists[v]) { window.masterChecklists[v] = []; window.saveToDisk(); window.editChecklists(); } };
window.delChecklistCat = (cat) => { window.confirmAction({ title:'Delete Checklist Category', message:'Delete the entire <strong>' + window.esc(cat) + '</strong> category? All items in it will be lost.', confirmLabel:'Delete Category', tier:'dangerous', onConfirm:() => { delete window.masterChecklists[cat]; window.saveToDisk(); window.editChecklists(); window.showView('compliance'); } }); };
window.addChecklistItem = (cat) => { const v = document.getElementById(`add-item-${cat.replace(/\s/g,'')}`).value; if(v) { window.masterChecklists[cat].push(v); window.saveToDisk(); window.editChecklists(); window.showView('compliance'); } };
window.delChecklistItem = (cat, idx) => { window.masterChecklists[cat].splice(idx, 1); window.saveToDisk(); window.editChecklists(); window.showView('compliance'); };

// --- 5. MAINTENANCE & ASSETS ---
window._maintTab = window._maintTab || 'fixit';
window.renderMaintenanceView = function(activeTab) {
    if (activeTab) window._maintTab = activeTab;
    const tab = window._maintTab || 'fixit';
    const E = window.esc;
    let content = '', actionBtn = '';

    if (tab === 'fixit') { content = window.renderFixItBoard(); actionBtn = `<button onclick="window.openFixItForm()" class="btn btn-orange">🔧 Report Issue</button>`; }
    else if (tab === 'assets') { content = window.renderAssetRegister(); actionBtn = `<button onclick="window.editEq()" class="btn btn-blue">+ Add Asset</button>`; }
    else if (tab === 'contractors') { content = window.renderContractorBoard(); actionBtn = `<button onclick="window.showContractorForm()" class="btn btn-green">+ Sign In Contractor</button>`; }
    else if (tab === 'calendar') { content = window.renderServiceCalendar(); }

    const tabs = ['fixit','assets','contractors','calendar'].map(t => {
        const labels = { fixit:'🛠️ Tickets', assets:'⚙️ Assets', contractors:'📋 Contractors', calendar:'📅 Service' };
        return `<span class="tag-pill ${tab===t?'active':''}" onclick="window._maintTab='${t}';document.getElementById('mainContent').innerHTML=window.renderMaintenanceView();">${labels[t]}</span>`;
    }).join('');

    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">Maintenance & Assets</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Fix-it tickets, equipment register, and contractor log</div>
            </div>
            <div style="display:flex;gap:8px;">${actionBtn}</div>
        </div>
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabs}</div>
        <div id="maint-content">${content}</div>
    </div>`;
}

window.openFixItForm = () => {
    const E = window.esc;
    const tradies = (window.phoneBook || []).filter(c => c.category === 'Tradie' || c.category === 'Tradie / Maintenance');
    const tradieOptions = `<option value="">Leave Unassigned (Internal Fix)</option>` + tradies.map(t => `<option value="${E(t.name)}">${E(t.name)} - ${E(t.phone)}</option>`).join('');
    const html = `
        <input type="text" id="def-item" class="input-box" placeholder="Item (e.g. Table 12 / Coolroom Fan)">
        <textarea id="def-desc" class="input-box" placeholder="What is exactly wrong with it?" style="height:80px;"></textarea>
        <select id="def-tradie" class="input-box">${tradieOptions}</select>
        <label style="display:flex;align-items:center;color:var(--red);font-weight:bold;background:rgba(239,68,68,0.1);padding:10px 15px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);cursor:pointer;margin-bottom:20px;">
            <input type="checkbox" id="def-urgent" style="margin-right:8px;transform:scale(1.2);"> URGENT
        </label>
        <button onclick="window.submitDefect()" class="btn btn-orange" style="width:100%;font-size:14px;">Submit Ticket</button>`;
    window.openModal('🔧 Report Maintenance Issue', html);
};

window.renderFixItBoard = () => {
    const E = window.esc;
    const openTickets = (window.defectLogs || []).filter(d => d.status === 'Open');
    const closedTickets = (window.defectLogs || []).filter(d => d.status === 'Resolved');

    if (openTickets.length === 0 && closedTickets.length === 0) {
        return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">🛠️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No open tickets</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5;">Report your first maintenance issue with the button above. Tickets stay here until resolved.</div></div>`;
    }

    return `<h3 style="margin-bottom:15px;border-bottom:1px solid var(--border);padding-bottom:5px;">Open Tickets (${openTickets.length})</h3>
    ${openTickets.length === 0 ? '<div class="card"><p style="color:var(--green);font-weight:bold;margin:0;">No open issues! Venue is looking good.</p></div>' : openTickets.map((d) => `
        <div class="card" style="border-left:4px solid ${d.urgent?'var(--red)':'var(--orange)'};padding:14px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;"><strong style="font-size:14px;">${E(d.item)} ${d.urgent?'<span style="color:var(--red);font-size:12px;margin-left:10px;border:1px solid var(--red);padding:2px 6px;border-radius:4px;">URGENT</span>':''}</strong><small style="color:var(--text-muted);">Reported: ${d.date}</small></div>
            <p style="margin:6px 0;color:var(--text-main);font-size:13px;background:var(--bg-main);padding:8px;border-radius:5px;">${E(d.desc)}</p>
            ${d.tradie?`<div style="font-size:13px;margin-bottom:15px;color:var(--blue);font-weight:bold;">🛠️ Assigned to: ${E(d.tradie)}</div>`:'<div style="margin-bottom:15px;"></div>'}
            <div style="display:flex;justify-content:flex-end;align-items:center;border-top:1px dashed var(--border);padding-top:10px;flex-wrap:wrap;gap:8px;"><input type="number" step="0.01" id="def-cost-${d.originalIndex}" class="input-box" placeholder="Repair Cost ($)" style="width:140px;display:inline;margin:0;"><button onclick="window.resolveDefect(${d.originalIndex})" class="btn btn-green">Mark Resolved</button></div>
        </div>`).join('')}

    ${closedTickets.length > 0 ? `<h3 style="margin-top:20px;margin-bottom:10px;color:var(--text-muted);font-size:12px;text-transform:uppercase;">Recently Resolved</h3>
    ${closedTickets.slice(-5).reverse().map(d => `<div style="background:var(--bg-main);padding:10px;border-radius:6px;margin-bottom:6px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="color:var(--green);">✓ ${E(d.item)}</strong> - <span style="font-size:13px;color:var(--text-muted);">${E(d.desc)}</span></div>${d.cost>0?`<strong style="color:var(--red);font-size:14px;">$${d.cost.toFixed(2)}</strong>`:''}</div>`).join('')}` : ''}`;
};
window.submitDefect = () => { const item = document.getElementById('def-item').value; const desc = document.getElementById('def-desc').value; if(!item || !desc) return window.showToast("Item and Description required.", "error"); window.defectLogs.push({ originalIndex: window.defectLogs.length, item, desc, tradie: document.getElementById('def-tradie').value, urgent: document.getElementById('def-urgent').checked, status: 'Open', date: new Date().toLocaleDateString() }); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit'); window.showToast("Ticket Submitted!"); };
window.resolveDefect = (index) => { const costInput = document.getElementById(`def-cost-${index}`).value; window.defectLogs[index].status = 'Resolved'; window.defectLogs[index].cost = costInput ? parseFloat(costInput) : 0; window.defectLogs[index].resolvedDate = new Date().toLocaleDateString(); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit'); window.showToast("Ticket Resolved!"); };

window.renderAssetRegister = () => { return (window.equipmentData || []).length === 0 ? '<p style="color:var(--text-muted);">No assets tracked yet.</p>' : window.equipmentData.map((e, idx) => `<div class="card" style="border-left:3px solid var(--blue); padding:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="font-size:14px;">${esc(e.name)}</strong> <span style="color:var(--text-muted); font-size:13px; margin-left:10px;">[Code: ${esc(e.code)}]</span><br><small style="color:var(--brand-accent); display:block; margin-top:5px;">Service Interval: ${e.interval} months | Last Service: <strong style="color:white;">${e.lastService}</strong></small></div><div style="display:flex; gap:10px;"><button onclick="window.editEq(${idx})" class="btn btn-outline">Edit</button><button onclick="window.logEq(${idx})" class="btn btn-green">Log Service Today</button><button onclick="window.delEq(${idx})" style="background:none; color:var(--red); border:none; cursor:pointer; font-size:18px;">&times;</button></div></div></div>`).join(''); };

window.editEq = (i = null) => { 
    let e = i !== null ? window.equipmentData[i] : {name: '', code: '', interval: 6, lastService: new Date().toISOString().split('T')[0]}; 
    let html = `
        <label style="font-size:11px; color:var(--text-muted);">Equipment Name</label><input type="text" id="eq-n" class="input-box" value="${esc(e.name)}">
        <label style="font-size:11px; color:var(--text-muted);">Asset/Serial Code</label><input type="text" id="eq-c" class="input-box" value="${esc(e.code)}">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Interval (Months)</label><input type="number" id="eq-i" class="input-box" value="${e.interval}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Last Service Date</label><input type="date" id="eq-d" class="input-box" value="${e.lastService}"></div>
        </div>
        <button onclick="window.subEq(${i})" class="btn btn-blue" style="width:100%;">Save Asset</button>
    `;
    window.openModal(i !== null ? "⚙️ Edit Asset" : "⚙️ New Asset", html);
};
window.subEq = (i) => { let obj = { name: document.getElementById('eq-n').value, code: document.getElementById('eq-c').value, interval: document.getElementById('eq-i').value || 6, lastService: document.getElementById('eq-d').value || new Date().toISOString().split('T')[0] }; if (i !== null) window.equipmentData[i] = obj; else window.equipmentData.push(obj); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); window.showToast("Asset Saved!"); };
window.logEq = (i) => { window.equipmentData[i].lastService = new Date().toISOString().split('T')[0]; window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); window.showToast("Service Logged!"); };
window.delEq = (i) => { window.confirmAction({ title:'🛠️ Remove Asset', message:'Remove this asset from tracking?', confirmLabel:'Remove', tier:'standard', onConfirm:() => { window.equipmentData.splice(i,1); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); } }); };

window.renderContractorBoard = () => {
    const active = (window.contractorLogs || []).map((c, i) => ({...c, originalIndex: i})).filter(c => !c.timeOut);
    const history = (window.contractorLogs || []).map((c, i) => ({...c, originalIndex: i})).filter(c => c.timeOut).slice(-10).reverse();
    return `<h3 style="margin-bottom:15px; color:var(--brand-dark); border-bottom:1px solid var(--border); padding-bottom:5px;">🟢 Currently On-Site</h3>${active.length === 0 ? '<div class="card"><p style="color:var(--green); margin:0; font-weight:bold;">No contractors currently signed in.</p></div>' : active.map(c => `<div class="card" style="border-left:3px solid var(--green); padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="font-size:14px;">${esc(c.name)}</strong> <span style="color:var(--text-muted);">(${esc(c.company)})</span><br><small style="color:var(--brand-accent); display:block; margin-top:5px;">Reason: ${esc(c.reason)} | <strong>In:</strong> ${c.timeIn}</small></div><button onclick="window.signOutContractor(${c.originalIndex})" class="btn btn-red" style="font-size:12px;">Sign Out</button></div>`).join('')}<h3 style="margin-top:20px; margin-bottom:10px; color:var(--brand-dark); border-bottom:1px solid var(--border); padding-bottom:5px;">📋 Recent Visits</h3><table style="width:100%; background:var(--card-bg); border-radius:8px; overflow:hidden; border-collapse:collapse;"><thead><tr style="text-align:left; background:#111; border-bottom:1px solid var(--border);"><th style="padding:8px 12px;">Date</th><th style="padding:8px 12px;">Contractor</th><th style="padding:8px 12px;">Reason</th><th style="padding:8px 12px;">Time</th></tr></thead><tbody>${history.length === 0 ? '<tr><td colspan="4" style="padding:15px; color:var(--text-muted); text-align:center;">No recent logs.</td></tr>' : history.map(c => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:7px 10px; font-size:12px; color:var(--text-muted);">${c.date}</td><td style="padding:7px 12px;"><strong style="font-size:13px;">${esc(c.name)}</strong><br><small style="color:var(--text-muted);">${esc(c.company)}</small></td><td style="padding:7px 10px; font-size:12px; color:var(--brand-accent);">${esc(c.reason)}</td><td style="padding:7px 10px; font-size:12px;">In: <strong>${c.timeIn}</strong><br>Out: <strong>${c.timeOut}</strong></td></tr>`).join('')}</tbody></table>`;
}
window.showContractorForm = () => { 
    let html = `<input type="text" id="con-name" class="input-box" placeholder="Contractor Name (e.g., John Smith)" required><input type="text" id="con-company" class="input-box" placeholder="Company (e.g., Bob's Plumbing)" required><input type="text" id="con-reason" class="input-box" placeholder="Reason for visit (e.g., Fix grease trap)" style="margin-bottom:20px;" required><button onclick="window.submitContractor()" class="btn btn-green" style="width:100%;">Sign In</button>`;
    window.openModal("📋 Contractor Sign-In", html); 
}
window.submitContractor = () => { const name = document.getElementById('con-name').value; const company = document.getElementById('con-company').value; const reason = document.getElementById('con-reason').value; if(!name || !company) return window.showToast("Required details missing.", "error"); const now = new Date(); window.contractorLogs.push({ date: now.toLocaleDateString(), timeIn: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), timeOut: null, name, company, reason }); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors'); window.showToast("Contractor Signed In!"); }
window.signOutContractor = (index) => { window.contractorLogs[index].timeOut = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors'); window.showToast("Contractor Signed Out!"); }


// =============================================================================
// TASK ZONE EDITOR — Manage customisable zone categories
// =============================================================================
window.editTaskZones = () => {
    const zones = window.taskZones || [];
    const tasks = window.rotationalTasks || [];
    const rows = zones.map((z, i) => {
        const count = tasks.filter(t => t.zone === z).length;
        return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">' +
            '<input type="text" class="input-box zone-edit-input" data-idx="' + i + '" value="' + esc(z) + '" style="flex:1;margin:0;">' +
            '<span style="color:var(--text-muted);font-size:12px;white-space:nowrap;">' + count + ' task' + (count!==1?'s':'') + '</span>' +
            '<button onclick="window._delTaskZone(' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:18px;padding:0 4px;" title="Remove zone">&times;</button>' +
        '</div>';
    }).join('');
    const html = '<div id="zone-list">' + rows + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<input type="text" id="new-zone-name" class="input-box" placeholder="New zone name..." style="flex:1;margin:0;">' +
            '<button onclick="window._addTaskZone()" class="btn btn-blue">+ Add</button>' +
        '</div>' +
        '<button onclick="window._saveTaskZones()" class="btn btn-green" style="width:100%;margin-top:15px;">Save Zones</button>';
    window.openModal('⚙️ Edit Task Zones', html);
};

window._addTaskZone = () => {
    const input = document.getElementById('new-zone-name');
    const name = input.value.trim();
    if (!name) return window.showToast('Enter a zone name.', 'error');
    if ((window.taskZones||[]).includes(name)) return window.showToast('Zone already exists.', 'error');
    window.taskZones.push(name);
    window.saveToDisk();
    window.editTaskZones(); // re-render modal
};

window._delTaskZone = (idx) => {
    const zone = window.taskZones[idx];
    const affected = (window.rotationalTasks||[]).filter(t => t.zone === zone).length;
    if (affected > 0) {
        return window.confirmAction({ title: 'Remove Zone', message: '<strong>' + esc(zone) + '</strong> is assigned to ' + affected + ' task' + (affected!==1?'s':'') + '. Those tasks will become unassigned. Continue?', confirmLabel: 'Remove', tier: 'standard',
            onConfirm: () => {
                window.rotationalTasks.forEach(t => { if (t.zone === zone) t.zone = ''; });
                window.taskZones.splice(idx, 1);
                window.saveToDisk();
                window.editTaskZones();
            }
        });
    }
    window.taskZones.splice(idx, 1);
    window.saveToDisk();
    window.editTaskZones();
};

window._saveTaskZones = () => {
    const inputs = document.querySelectorAll('.zone-edit-input');
    const oldZones = [...(window.taskZones || [])];
    const newZones = [];
    inputs.forEach((inp, i) => {
        const val = inp.value.trim();
        if (val) {
            newZones.push(val);
            // Rename zone on tasks if changed
            if (oldZones[i] && oldZones[i] !== val) {
                (window.rotationalTasks||[]).forEach(t => { if (t.zone === oldZones[i]) t.zone = val; });
            }
        }
    });
    window.taskZones = newZones;
    window.saveToDisk();
    window.closeModal();
    window.showView('tasks');
    window.showToast('Zones saved!');
};

// =============================================================================
// BWI DATA SEEDERS — One-click defaults for Bar Wa Izakaya
// Each function checks if data is empty before populating (never overwrites)
// =============================================================================

window.seedRotationalTasks = () => {
    if ((window.rotationalTasks||[]).length > 0) {
        return window.confirmAction({ title:'🔄 Seed Tasks', message:'You already have ' + window.rotationalTasks.length + ' tasks. <strong>Replace</strong> them with BWI defaults?', confirmLabel:'Replace All', tier:'dangerous',
            onConfirm:() => { window.rotationalTasks = []; window._doSeedTasks(); }
        });
    }
    window._doSeedTasks();
};

window._doSeedTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    const tasks = [
        { name: 'Beer Line Clean', freq: 'Weekly', zone: 'Bar', notes: 'Flush all beer lines with cleaning solution. Rinse thoroughly before reconnecting kegs.' },
        { name: 'Grease Trap Flush', freq: 'Weekly', zone: 'BOH', notes: 'Flush grease trap, scrape solids, run hot water through. Log any blockage issues.' },
        { name: 'Exhaust Filter Deep Clean', freq: 'Weekly', zone: 'BOH', notes: 'Remove kitchen exhaust filters, soak in degreaser, scrub and replace.' },
        { name: 'Bar Mat & Floor Mat Deep Clean', freq: 'Weekly', zone: 'Bar', notes: 'Remove all bar mats and floor mats. Soak, scrub, and sanitise.' },
        { name: 'Glasswasher Descale & Clean', freq: 'Weekly', zone: 'Bar', notes: 'Run descale cycle, clean filters, wipe interior and check rinse aid levels.' },
        { name: 'Ice Machine Clean & Sanitise', freq: 'Weekly', zone: 'Bar', notes: 'Empty ice, run cleaning cycle, sanitise interior, wipe exterior.' },
        { name: 'FOH Deep Clean (Floors/Walls/Windows)', freq: 'Weekly', zone: 'FOH', notes: 'Mop all floors with degreaser, wipe walls and skirting, clean windows and glass.' },
        { name: 'Staff Fridge Cleanout', freq: 'Weekly', zone: 'BOH', notes: 'Remove expired items, wipe shelves, check for unmarked containers.' },
        { name: 'Cool Room Shelf Deep Clean', freq: 'Fortnightly', zone: 'BOH', notes: 'Remove all stock, wipe down shelves with sanitiser, check for expired/damaged items. FIFO all stock back.' },
        { name: 'POS Paper Rolls & Printer Check', freq: 'Fortnightly', zone: 'FOH', notes: 'Check all receipt printers, replace low paper rolls, test kitchen/bar printers.' },
        { name: 'Fire Extinguisher Visual Check', freq: 'Fortnightly', zone: 'All Areas', notes: 'Check pressure gauges, signage visible, no obstructions, pins intact.' },
        { name: 'Full Stocktake', freq: 'Monthly', zone: 'All Areas', notes: 'Count all inventory items against system. Use Hub stocktake module.' },
        { name: 'Pest Control Inspection', freq: 'Monthly', zone: 'All Areas', notes: 'Walk-through of all areas checking for pest evidence. Log any findings.' },
        { name: 'First Aid Kit Audit', freq: 'Monthly', zone: 'All Areas', notes: 'Check all first aid kits are stocked. Replace expired items. Note anything needed.' },
        { name: 'Staff Meeting / Training Session', freq: 'Monthly', zone: 'Office', notes: 'Team meeting — review performance, training topics, upcoming events.' },
        { name: 'Hood Filter Professional Service', freq: 'Quarterly', zone: 'BOH', notes: 'Coordinate with contractor for professional exhaust hood clean and certification.' },
        { name: 'Fire Equipment Service Check', freq: 'Quarterly', zone: 'Maintenance', notes: 'Extinguishers, blankets, exit signs, emergency lighting — full check with contractor if due.' }
    ];
    window.rotationalTasks = tasks.map(t => ({
        name: t.name, freq: t.freq, notes: t.notes, zone: t.zone,
        dueDateMode: 'recurring', specificDueDate: '', anchorDate: today,
        lastLogIso: null, lastDate: 'Never'
    }));
    window.saveToDisk();
    window.showToast(tasks.length + ' BWI tasks loaded!');
    window.showView('tasks');
};

window.seedShiftChecklists = () => {
    const current = window.shiftChecklistItems;
    const hasCustom = current && (
        (current.opening && current.opening.length > 0) ||
        (current.preservice && current.preservice.length > 0) ||
        (current.closing && current.closing.length > 0)
    );
    if (hasCustom) {
        return window.confirmAction({ title:'✅ Seed Checklists', message:'You already have shift checklists. <strong>Replace</strong> them with BWI defaults?', confirmLabel:'Replace All', tier:'dangerous',
            onConfirm:() => { window._doSeedChecklists(); }
        });
    }
    window._doSeedChecklists();
};

window._doSeedChecklists = () => {
    window.shiftChecklistItems = {
        opening: [
            'Log all fridge/freezer temps in Hub',
            'Float count & till setup',
            'POS + EFTPOS terminals tested',
            'Check reservations & covers for service',
            'Review prep list & confirm specials',
            'Brief team on 86\'d items & allergens',
            'Stock check bar essentials against PAR',
            'Inspect & restock toilets',
            'Turn on music / lighting / signage',
            'Check outdoor area setup',
            'Confirm deliveries due today',
            'Unlock all entry points'
        ],
        preservice: [
            'Final mise en place check — all stations',
            'Ice wells & ice bins full',
            'Garnish station stocked & fresh',
            'Speed rail & back bar set to PAR',
            'All menus correct & clean',
            'Floor sweep & spot mop',
            'Candles & table settings done',
            'Water jugs & chopstick holders filled',
            'Kitchen pass clear — communication test',
            'Staff appearance check'
        ],
        closing: [
            'All food wrapped, labelled & FIFO stored',
            'Closing fridge/freezer temp log in Hub',
            'Bar cleaned & restocked to PAR',
            'All tills counted & reconciled',
            'Wastage logged in Hub',
            'Kitchen equipment off & secured',
            'Floors mopped & drains cleared',
            'Bins emptied & replaced',
            'All doors/windows locked & alarmed',
            'Handover notes written in Hub',
            'Gas turned off (kitchen)',
            'Final walk-through complete'
        ]
    };
    window.saveToDisk();
    window.showToast('BWI shift checklists loaded! (Opening: 12, Pre-Service: 10, Closing: 12)');
    window._complianceTab = 'shift';
    window.showView('compliance');
};

window.seedFridgeUnits = () => {
    const current = window.fridgeUnits || [];
    if (current.length > 3 || (current.length > 0 && current[0] !== 'Walk-in Coolroom')) {
        return window.confirmAction({ title:'🌡️ Seed Fridge Units', message:'You have custom fridge units. <strong>Replace</strong> them with BWI defaults?', confirmLabel:'Replace All', tier:'dangerous',
            onConfirm:() => { window._doSeedFridges(); }
        });
    }
    window._doSeedFridges();
};

window._doSeedFridges = () => {
    window.fridgeUnits = [
        'Walk-in Coolroom',
        'Walk-in Freezer',
        'Kitchen Line Fridge',
        'Kitchen Prep Fridge',
        'Bar Under-counter 1',
        'Bar Under-counter 2',
        'Bar Display Fridge',
        'Dessert Reach-in'
    ];
    window.saveToDisk();
    window.showToast('8 BWI fridge units loaded!');
    window._complianceTab = 'temps';
    window.showView('compliance');
};

window.seedMasterChecklists = () => {
    const keys = Object.keys(window.masterChecklists || {});
    const isDefault = keys.length <= 2 && keys.includes('Opening Duties');
    if (keys.length > 0 && !isDefault) {
        return window.confirmAction({ title:'📋 Seed Checklists', message:'You have ' + keys.length + ' custom checklists. <strong>Replace</strong> them with BWI defaults?', confirmLabel:'Replace All', tier:'dangerous',
            onConfirm:() => { window._doSeedMasterChecklists(); }
        });
    }
    window._doSeedMasterChecklists();
};

window._doSeedMasterChecklists = () => {
    window.masterChecklists = {
        'Weekly Deep Clean — Kitchen': [
            'Exhaust hood & filters degreased',
            'Behind all equipment pulled out & cleaned',
            'Cool room shelves & floor scrubbed',
            'Grease traps flushed & scraped',
            'Under benches & sinks wiped',
            'Oven interior deep clean',
            'Dry stores shelving wiped & organised',
            'Dishwasher & glasswasher interior cleaned'
        ],
        'Weekly Deep Clean — Bar': [
            'Speed rail & well drains flushed',
            'Ice machine interior sanitised',
            'Beer tap lines & drip trays cleaned',
            'Under-counter fridges wiped out',
            'Back bar shelving dusted & organised',
            'Glass polishing check — no water marks',
            'Garnish station containers deep cleaned',
            'Bar mats & floor mats soaked & scrubbed'
        ],
        'Weekly Deep Clean — FOH': [
            'All table bases & legs wiped',
            'Window sills & ledges dusted',
            'Bathroom deep clean (tiles, mirrors, fixtures)',
            'Entry area & signage cleaned',
            'Menu holders / stands wiped',
            'Skirting boards & corners swept',
            'Air conditioning filters / vents dusted'
        ],
        'Monthly Safety Walk': [
            'Fire extinguishers checked (pressure, pin, signage)',
            'Exit signs illuminated & visible',
            'First aid kit fully stocked',
            'Slip hazards assessed & addressed',
            'Chemical storage secure & labelled (SDS available)',
            'Emergency procedures posted & legible'
        ]
    };
    window.saveToDisk();
    window.showToast('4 BWI checklists loaded!');
    window._complianceTab = 'custom';
    window.showView('compliance');
};

