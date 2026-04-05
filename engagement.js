// --- HOBART HUB: Engagement Module ---
// Roster management, noticeboard, announcements, badges, staff hub config, feedback trends




// --- 12. ROSTERS ---
window._rosterTab = window._rosterTab || 'tanda';

window._renderTandaRoster = (tabPills) => {
    const E = window.esc;
    const td = window._tandaData;
    if (!td || !td.weeklyRoster) {
        const noConn = !window.getTandaToken || !window.getTandaToken();
        return '<div style="max-width:900px;margin:auto;"><div style="margin-bottom:12px;">' + tabPills + '</div>' +
            '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">⏱️</div>' +
            '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">' + (noConn ? 'Tanda Not Connected' : 'Loading Roster...') + '</div>' +
            '<div style="font-size:13px;max-width:320px;margin:0 auto 16px;line-height:1.5;">' + (noConn ? 'Connect Tanda in Settings to see your live weekly roster here.' : 'Tanda data is loading. Try refreshing.') + '</div>' +
            (noConn ? '<button onclick="window.openTandaSettings()" class="btn btn-purple">⏱️ Connect Tanda</button>' : '<button onclick="window.loadTandaData()" class="btn btn-outline">🔄 Refresh</button>') +
            '</div></div>';
    }

    const days = Object.keys(td.weeklyRoster).sort();
    const todayStr = td.date;
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    // Collect unique staff across the week, grouped by department
    const allStaff = new Map();
    days.forEach(d => {
        (td.weeklyRoster[d] || []).forEach(s => {
            if (!allStaff.has(s.name)) allStaff.set(s.name, { shifts: {}, dept: s.dept || 'Other' });
            allStaff.get(s.name).shifts[d] = s;
            if (s.dept && allStaff.get(s.name).dept === 'Other') allStaff.get(s.name).dept = s.dept;
        });
    });
    const staffNames = [...allStaff.keys()].sort();
    // Group by department
    const deptGroups = {};
    staffNames.forEach(name => {
        const dept = allStaff.get(name).dept || 'Other';
        if (!deptGroups[dept]) deptGroups[dept] = [];
        deptGroups[dept].push(name);
    });
    const deptOrder = Object.keys(deptGroups).sort((a, b) => a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b));

    // Weekly totals
    let weekHours = 0, weekCost = 0;
    days.forEach(d => {
        const actual = td.weeklyActual && td.weeklyActual[d];
        if (actual) { weekHours += actual.hours; weekCost += actual.cost; }
        else { (td.weeklyRoster[d] || []).forEach(s => { weekHours += Number(s.hours) || 0; }); }
    });

    let html = '<div style="max-width:1100px;margin:auto;">';
    html += '<div style="margin-bottom:12px;">' + tabPills + '</div>';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">';
    html += '<div><h2 style="margin:0;">⏱️ Live Roster</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Week of ' + days[0] + ' to ' + days[6] + ' · ' + staffNames.length + ' staff · ' + weekHours.toFixed(0) + 'h' + (weekCost > 0 ? ' · $' + weekCost.toFixed(0) : '') + '</div></div>';
    html += '<div style="display:flex;gap:8px;"><button onclick="window.showLoadingOverlay(\'Refreshing Tanda...\');window.loadTandaData().then(()=>window.hideLoadingOverlay())" class="btn btn-outline" style="font-size:12px;">🔄 Refresh</button></div>';
    html += '</div>';

    // Leave & unavailability alerts
    if ((td.upcomingLeave || []).length > 0 || (td.unavailability || []).length > 0) {
        html += '<div class="card" style="padding:12px;margin-bottom:12px;border-left:4px solid var(--orange);">';
        (td.upcomingLeave || []).slice(0, 4).forEach(function(l) { html += '<div style="font-size:12px;color:var(--orange);margin-bottom:3px;">🏖️ ' + E(l.name) + ' — ' + E(l.type) + ' (' + l.from + ' to ' + l.to + ') <span style="color:var(--text-muted);">' + E(l.status) + '</span></div>'; });
        (td.unavailability || []).slice(0, 4).forEach(function(u) { html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:3px;">🚫 ' + E(u.name) + ' unavailable ' + u.from + ' to ' + u.to + (u.reason ? ' — ' + E(u.reason) : '') + '</div>'; });
        html += '</div>';
    }

    // Weekly grid table
    html += '<div class="card" style="padding:0;overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px;">';
    html += '<thead><tr style="background:#0a0a0c;"><th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:11px;width:120px;border-bottom:1px solid var(--border);">STAFF</th>';
    days.forEach(function(d, i) {
        var isToday = d === todayStr;
        var bg = isToday ? 'background:rgba(139,92,246,0.15);' : '';
        var dayCount = (td.weeklyRoster[d] || []).length;
        html += '<th style="padding:8px 6px;text-align:center;font-size:11px;color:' + (isToday ? 'var(--purple)' : 'var(--text-muted)') + ';border-bottom:1px solid var(--border);' + bg + '">' + dayNames[i] + '<br><span style="font-size:10px;font-weight:normal;">' + d.slice(5) + '</span><br><span style="font-size:10px;font-weight:normal;color:var(--text-muted);">' + dayCount + ' staff</span></th>';
    });
    html += '</tr></thead><tbody>';

    var deptColors = { 'FOH': 'var(--blue)', 'BOH': 'var(--orange)', 'Kitchen': 'var(--orange)', 'Kitchen Hand': 'var(--orange)', 'Bar': 'var(--purple)', 'Management': 'var(--green)' };
    deptOrder.forEach(function(dept) {
        var deptColor = deptColors[dept] || 'var(--text-muted)';
        // Department header row
        html += '<tr><td colspan="' + (days.length + 1) + '" style="padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:' + deptColor + ';background:rgba(255,255,255,0.03);border-bottom:2px solid ' + deptColor + ';">' + E(dept) + ' <span style="font-weight:normal;font-size:11px;color:var(--text-muted);">(' + deptGroups[dept].length + ')</span></td></tr>';
        deptGroups[dept].forEach(function(name) {
            var staffData = allStaff.get(name);
            var shifts = staffData.shifts;
            html += '<tr style="border-bottom:1px solid var(--border);">';
            html += '<td style="padding:6px 10px;font-weight:600;white-space:nowrap;">' + E(name) + '</td>';
            days.forEach(function(d) {
                var isToday = d === todayStr;
                var bg = isToday ? 'background:rgba(139,92,246,0.08);' : '';
                var s = shifts[d];
                if (s) {
                    html += '<td style="padding:4px 6px;text-align:center;' + bg + '"><div style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:4px;padding:3px 4px;font-size:11px;"><div style="font-weight:600;">' + s.start + '-' + s.finish + '</div><div style="font-size:10px;color:var(--text-muted);">' + s.hours + 'h</div></div></td>';
                } else {
                    html += '<td style="padding:4px 6px;text-align:center;' + bg + '"><span style="color:var(--border);">—</span></td>';
                }
            });
            html += '</tr>';
        });
    });

    html += '</tbody></table></div>';

    // Clocked in now
    if ((td.clockedIn || []).length > 0) {
        html += '<div class="card" style="padding:14px;margin-top:12px;border-left:4px solid var(--green);">';
        html += '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:8px;">🟢 Currently On Floor (' + td.clockedIn.length + ')</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        td.clockedIn.forEach(function(c) { html += '<span style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:20px;font-size:12px;">' + E(c.name) + (c.since ? ' <span style="color:var(--text-muted);font-size:10px;">since ' + c.since + '</span>' : '') + '</span>'; });
        html += '</div></div>';
    }

    html += '</div>';
    return html;
};

window.renderRosterView = () => {
    const tab = window._rosterTab || 'tanda';
    const tabPills = ['tanda', 'uploads'].map(t => {
        const labels = { tanda: '⏱️ Tanda Live Roster', uploads: '📄 Uploaded Rosters' };
        return '<span class="tag-pill ' + (tab === t ? 'active' : '') + '" onclick="window._rosterTab=\'' + t + '\';window.showView(\'rosters\');">' + labels[t] + '</span>';
    }).join('');

    if (tab === 'tanda') return window._renderTandaRoster(tabPills);

    return `<div style="max-width: 900px; margin: auto;"><div style="margin-bottom:12px;">${tabPills}</div><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px"><div><h2 style="margin:0">📄 Uploaded Rosters</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Upload weekly roster PDFs or images for staff to view</div></div><label class="btn btn-blue" style="cursor:pointer;">+ Upload Roster PDF/Image<input type="file" id="roster-upload" accept="application/pdf,image/*" style="display:none;" onchange="window.handleRosterUpload(event)"></label></div>${(window.shiftRosters || []).length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🗓️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No rosters uploaded</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Upload your weekly roster PDF or image for staff to view here</div></div>' : window.shiftRosters.slice().reverse().map((r, i) => {
        let actualIndex = window.shiftRosters.length - 1 - i;
        let displayHtml = '';
        if (r.data) {
            if (r.data.includes('.jpg') || r.data.includes('.png') || r.data.includes('.jpeg') || r.data.includes('image')) { displayHtml = `<img src="${window.safeUrl(r.data)}" style="max-width:100%; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);">`; }
            else { displayHtml = `<iframe src="${window.safeUrl(r.data)}" style="width:100%; height:600px; border:none; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);"></iframe>`; }
        }
        return `<div class="card" style="margin-bottom:14px; border-top: 4px solid var(--blue); padding:18px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><div><strong style="font-size:22px; color:var(--brand-dark);">${esc(r.name)}</strong><br><small style="color:var(--text-muted); margin-top:5px; display:block;">Uploaded: ${r.date}</small></div><div style="display:flex; gap:10px;">${r.data ? `<a href="${r.data}" target="_blank" download="${esc(r.name)}" class="btn btn-outline" style="text-decoration:none;">Download / Fullscreen</a>` : ''}<button onclick="window.deleteRoster(${actualIndex})" class="btn btn-red">Delete</button></div></div>${displayHtml}</div>`;
    }).join('')}</div>`;
};
window.handleRosterUpload = async (e) => {
    if(!e.target.files.length) return;
    const file = e.target.files[0];
    const defaultName = file.name.split('.')[0];
    window._pendingRosterFile = file;
    window.openModal('🗓️ Name This Roster', `
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">Give this roster week a name (e.g. "Week 12 March")</p>
        <input type="text" id="_roster-name" class="input-box" value="${window.escAttr(defaultName)}" style="font-size:14px;padding:10px;margin:0 0 16px;">
        <div style="display:flex;gap:10px;">
            <button onclick="window._commitRosterUpload()" class="btn btn-green" style="flex:1;padding:10px;">Upload</button>
            <button onclick="window.closeModal();window._pendingRosterFile=null;" class="btn" style="flex:1;padding:10px;">Cancel</button>
        </div>`);
};
window._commitRosterUpload = async () => {
    const weekName = document.getElementById('_roster-name').value.trim();
    if (!weekName) return window.showToast('Name is required.', 'error');
    const file = window._pendingRosterFile; if (!file) return;
    window._pendingRosterFile = null;
    window.closeModal();
    window.showToast("Uploading roster, please wait... ⏳");
    try {
        const fileRef = storage.ref().child('rosters/' + Date.now() + '_' + file.name); await fileRef.put(file); const downloadURL = await fileRef.getDownloadURL();
        window.shiftRosters.push({ name: weekName, date: new Date().toLocaleDateString(), data: downloadURL }); window.saveToDisk(); window.showView('rosters'); window.showToast("Roster uploaded!");
    } catch(err) { window.showToast("Upload failed.", "error"); }
};
window.deleteRoster = (i) => { window.confirmAction({ title:'🗓️ Delete Roster', message:'Delete this roster?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.shiftRosters.splice(i,1); window.saveToDisk(); window.showView('rosters'); } }); };

// =============================================================================
// NOTICEBOARD / ANNOUNCEMENTS
// =============================================================================
window.renderNoticeboardView = () => {
    const E = window.esc;
    const now = new Date();
    const all = (window.announcements || []).slice().sort((a, b) => {
        const pa = {urgent:0,warning:1,info:2}; return (pa[a.priority]||2) - (pa[b.priority]||2) || new Date(b.date) - new Date(a.date);
    });
    const active = all.filter(a => !a.expiry || new Date(a.expiry) >= now);
    const expired = all.filter(a => a.expiry && new Date(a.expiry) < now);

    const priorityStyle = { urgent:'background:rgba(239,68,68,0.1);border-left:4px solid var(--red);', warning:'background:rgba(245,158,11,0.1);border-left:4px solid var(--orange);', info:'background:rgba(59,130,246,0.06);border-left:4px solid var(--blue);' };
    const priorityLabel = { urgent:'🔴 Urgent', warning:'🟠 Important', info:'🔵 Info' };

    const renderCard = (a, idx) => {
        const ackCount = (a.acknowledged || []).length;
        const staffCount = (window.staffDirectory || []).filter(s => s.status !== 'Inactive').length || 1;
        return `<div class="card" style="margin-bottom:12px;padding:16px;${priorityStyle[a.priority]||priorityStyle.info}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.08);font-weight:600;">${priorityLabel[a.priority]||'Info'}</span>
                        <span style="font-size:11px;color:var(--text-muted);">${E(a.date || '')}</span>
                        ${a.expiry ? '<span style="font-size:11px;color:var(--text-muted);">Expires: '+E(a.expiry)+'</span>' : ''}
                    </div>
                    <h3 style="margin:0 0 6px;font-size:16px;">${E(a.title)}</h3>
                    <p style="margin:0;font-size:14px;color:var(--text-muted);line-height:1.6;white-space:pre-wrap;">${E(a.body || '')}</p>
                    <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">Posted by ${E(a.author||'Manager')} · ${ackCount}/${staffCount} acknowledged</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button onclick="window.acknowledgeAnnouncement('${E(a.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px 10px;">✅ Ack</button>
                    <button onclick="window.editAnnouncement('${E(a.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px 10px;">✏️</button>
                    <button onclick="window.deleteAnnouncement('${E(a.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px 10px;color:var(--red);">✕</button>
                </div>
            </div>
        </div>`;
    };

    const activeHtml = active.length > 0 ? active.map(renderCard).join('') : '<div style="text-align:center;padding:48px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">📢</div><p style="font-size:15px;font-weight:600;color:var(--text-main);">No active announcements</p><p style="font-size:13px;">Post a notice for your team — menu changes, reminders, important updates.</p></div>';

    const expiredHtml = expired.length > 0 ? '<details style="margin-top:20px;"><summary style="cursor:pointer;color:var(--text-muted);font-size:13px;font-weight:600;">Expired Notices (' + expired.length + ')</summary><div style="margin-top:10px;">' + expired.map(renderCard).join('') + '</div></details>' : '';

    return `<div style="max-width:800px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div>
                <h2 style="margin:0;">📢 Noticeboard</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Team announcements, updates & reminders</div>
            </div>
            <button onclick="window.newAnnouncementForm()" class="btn btn-purple" style="padding:10px 20px;">+ Post Notice</button>
        </div>
        ${activeHtml}${expiredHtml}
    </div>`;
};

window.newAnnouncementForm = () => {
    const html = `
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Title</label>
            <input type="text" id="ann-title" class="input-box" placeholder="e.g. New cocktail menu launching Friday" style="margin:0;">
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Message</label>
            <textarea id="ann-body" class="input-box" placeholder="Details for the team..." style="margin:0;height:100px;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div>
                <label style="font-size:11px;color:var(--text-muted);">Priority</label>
                <select id="ann-priority" class="input-box" style="margin:0;">
                    <option value="info">🔵 Info</option>
                    <option value="warning">🟠 Important</option>
                    <option value="urgent">🔴 Urgent</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-muted);">Expires (optional)</label>
                <input type="date" id="ann-expiry" class="input-box" style="margin:0;">
            </div>
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Posted By</label>
            <input type="text" id="ann-author" class="input-box" placeholder="Your name" style="margin:0;">
        </div>
        <button onclick="window.saveAnnouncement()" class="btn btn-green" style="width:100%;padding:12px;">Post Notice</button>`;
    window.openModal('📢 New Announcement', html);
};

window.saveAnnouncement = (editId) => {
    const title = document.getElementById('ann-title').value.trim();
    const body = document.getElementById('ann-body').value.trim();
    const priority = document.getElementById('ann-priority').value;
    const expiry = document.getElementById('ann-expiry').value;
    const author = document.getElementById('ann-author').value.trim();
    if (!title) return window.showToast('Title is required.', 'error');
    if (!window.announcements) window.announcements = [];

    if (editId) {
        const existing = window.announcements.find(a => a.id === editId);
        if (existing) { existing.title = title; existing.body = body; existing.priority = priority; existing.expiry = expiry; existing.author = author || existing.author; }
    } else {
        window.announcements.unshift({
            id: window.generateId('ann'),
            title, body, priority, expiry, author: author || 'Manager',
            date: new Date().toLocaleDateString('en-AU'),
            acknowledged: []
        });
    }
    window.logAudit('announcements', editId ? 'edit' : 'create', editId || '', title);
    window.saveToDisk(); window.closeModal(); window.showView('noticeboard');
    window.showToast(editId ? 'Notice updated.' : 'Notice posted!');
};

window.editAnnouncement = (id) => {
    const a = (window.announcements || []).find(x => x.id === id);
    if (!a) return;
    window.newAnnouncementForm();
    setTimeout(() => {
        document.getElementById('ann-title').value = a.title || '';
        document.getElementById('ann-body').value = a.body || '';
        document.getElementById('ann-priority').value = a.priority || 'info';
        document.getElementById('ann-expiry').value = a.expiry || '';
        document.getElementById('ann-author').value = a.author || '';
        const btn = document.querySelector('#global-modal-content button.btn-green');
        if (btn) { btn.textContent = 'Update Notice'; btn.setAttribute('onclick', "window.saveAnnouncement('" + window.escAttr(id) + "')"); }
    }, 50);
};

window.acknowledgeAnnouncement = (id) => {
    const a = (window.announcements || []).find(x => x.id === id);
    if (!a) return;
    if (!a.acknowledged) a.acknowledged = [];
    const name = prompt('Your name:');
    if (!name) return;
    if (!a.acknowledged.includes(name)) {
        a.acknowledged.push(name);
        window.saveToDisk(); window.showView('noticeboard');
        window.showToast('Acknowledged!');
    } else {
        window.showToast('Already acknowledged.', 'error');
    }
};

window.deleteAnnouncement = (id) => {
    window.confirmAction({ title:'📢 Delete Notice', message:'Remove this announcement?', confirmLabel:'Delete', tier:'standard', onConfirm:() => {
        window.announcements = (window.announcements || []).filter(a => a.id !== id);
        window.logAudit('announcements', 'delete', id, '');
        window.saveToDisk(); window.showView('noticeboard');
    }});
};

// =============================================================================
// KUDOS / RECOGNITION BOARD
// =============================================================================
window.renderKudosCard = () => {
    const E = window.esc;
    const recent = (window.kudos || []).slice(0, 5);
    if (recent.length === 0) return '';
    const items = recent.map(k => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span style="color:var(--purple);font-weight:600;">${E(k.to)}</span> <span style="color:var(--text-muted);">— "${E(k.message)}"</span>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">From ${E(k.from)} · ${E(k.date||'')}</div>
    </div>`).join('');
    return `<div class="card" style="border-top:3px solid var(--purple);padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3 style="margin:0;font-size:15px;">⭐ Team Kudos</h3>
            <button onclick="window.giveKudosForm()" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">+ Give Kudos</button>
        </div>
        ${items}
    </div>`;
};

window.giveKudosForm = () => {
    const staffOpts = (window.staffDirectory || []).filter(s => s.status !== 'Inactive').map(s =>
        '<option value="' + window.escAttr(s.name) + '">' + window.esc(s.name) + '</option>'
    ).join('');
    const html = `
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Who deserves a shout-out?</label>
            <select id="kudos-to" class="input-box" style="margin:0;">
                <option value="">Select team member...</option>
                ${staffOpts}
            </select>
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">What did they do?</label>
            <input type="text" id="kudos-msg" class="input-box" placeholder="e.g. Stayed late to help with deep clean" style="margin:0;">
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Your Name</label>
            <input type="text" id="kudos-from" class="input-box" placeholder="Your name" style="margin:0;">
        </div>
        <button onclick="window.saveKudos()" class="btn btn-purple" style="width:100%;padding:12px;">⭐ Send Kudos</button>`;
    window.openModal('⭐ Give Kudos', html);
};

window.saveKudos = () => {
    const to = document.getElementById('kudos-to').value;
    const msg = document.getElementById('kudos-msg').value.trim();
    const from = document.getElementById('kudos-from').value.trim();
    if (!to || !msg || !from) return window.showToast('All fields required.', 'error');
    if (!window.kudos) window.kudos = [];
    window.kudos.unshift({ id: window.generateId('kud'), to, from, message: msg, date: new Date().toLocaleDateString('en-AU') });
    if (window.kudos.length > 100) window.kudos = window.kudos.slice(0, 100);
    window.saveToDisk(); window.closeModal(); window.showView('dashboard');
    window.showToast('Kudos sent to ' + to + '!');
};

// =============================================================================
// AUDIT LOG VIEW
// =============================================================================
window.renderAuditLogView = () => {
    const E = window.esc;
    const logs = (window.auditLog || []).slice(0, 200);
    if (logs.length === 0) {
        return '<div style="max-width:800px;margin:auto;"><h2 style="margin:0 0 16px;">📋 Audit Trail</h2><div class="card" style="text-align:center;padding:48px;"><div style="font-size:36px;margin-bottom:12px;">📋</div><p style="color:var(--text-muted);">No audit entries yet. Changes will be logged automatically.</p></div></div>';
    }
    const actionColors = { create:'var(--green)', edit:'var(--blue)', delete:'var(--red)' };
    const rows = logs.map(l => {
        const d = l.timestamp ? new Date(l.timestamp) : null;
        const timeStr = d ? d.toLocaleDateString('en-AU') + ' ' + d.toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'}) : '';
        return `<tr style="border-bottom:1px solid var(--border);font-size:13px;">
            <td style="padding:8px 10px;white-space:nowrap;color:var(--text-muted);">${E(timeStr)}</td>
            <td style="padding:8px 10px;"><span style="color:${actionColors[l.action]||'var(--text-main)'};font-weight:600;text-transform:uppercase;font-size:11px;">${E(l.action||'')}</span></td>
            <td style="padding:8px 10px;">${E(l.collection||'')}</td>
            <td style="padding:8px 10px;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;">${E(l.details||'')}</td>
        </tr>`;
    }).join('');
    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div><h2 style="margin:0;">📋 Audit Trail</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">All changes tracked automatically</div></div>
            <span style="font-size:13px;color:var(--text-muted);">${logs.length} entries</span>
        </div>
        <div style="overflow-x:auto;"><table style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;">
            <thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);text-transform:uppercase;">
                <th style="padding:10px;">Time</th><th style="padding:10px;">Action</th><th style="padding:10px;">Area</th><th style="padding:10px;">Details</th>
            </tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
};

// =============================================================================
// ENHANCED HANDOVER PRE-POPULATION
// =============================================================================
window._generateHandoverPrefill = () => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const isWeekend = [0,5,6].includes(now.getDay());
    const sections = (window.handoverTemplateConfig || {}).sections || [];
    const prefills = {};

    sections.forEach(sec => {
        const lower = sec.toLowerCase();

        if (lower.includes('off menu')) {
            const itemsOff = (window.inventoryItems || []).filter(i => !i.archived && (i.stock <= 0)).map(i => i.name);
            const recipesOff = (window.recipes || []).filter(r => r.status === 'Off Menu' && !r.archived).map(r => r.name);
            const allOff = [...new Set([...itemsOff, ...recipesOff])];
            prefills[sec] = allOff.length > 0 ? allOff.join(', ') : 'Nothing off menu';
        }

        if (lower.includes('stock')) {
            const belowPar = (window.inventoryItems || []).filter(i => {
                if (i.archived) return false;
                const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
                return par > 0 && i.stock < par;
            }).slice(0, 10).map(i => {
                const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
                return i.name + ' (' + Number(i.stock || 0).toFixed(1) + '/' + par + ')';
            });
            prefills[sec] = belowPar.length > 0 ? 'Below PAR: ' + belowPar.join(', ') : 'All stock at or above PAR levels.';
        }

        if (lower.includes('issue') || lower.includes('follow')) {
            const parts = [];
            // Open maintenance tickets
            const openTickets = (window.defectLogs || []).filter(d => d.status !== 'Resolved');
            if (openTickets.length > 0) parts.push('Open maintenance: ' + openTickets.map(d => d.item || d.description || 'Ticket').join(', '));
            // Today's incidents
            const todayIncidents = (window.incidentLogs || []).filter(i => i.time && i.time.includes(todayStr));
            if (todayIncidents.length > 0) parts.push('Incidents today: ' + todayIncidents.length);
            // Temp breaches
            const breaches = (window.tempLogs || []).filter(t => t.time && t.time.includes(todayStr) && parseFloat(t.value) > 5);
            if (breaches.length > 0) parts.push('Temp breaches: ' + breaches.map(t => (t.unit || 'Unit') + ' ' + t.value + '°C').join(', '));
            // Compliance temp completion
            const fridgeCount = (window.fridgeUnits || []).length;
            if (fridgeCount > 0) {
                const todayTemps = (window.tempLogs || []).filter(t => t.time && t.time.includes(todayStr));
                const unitsLogged = new Set(todayTemps.map(t => t.unit)).size;
                parts.push('Temps: ' + unitsLogged + '/' + fridgeCount + ' units logged' + (unitsLogged >= fridgeCount ? ' ✓' : ''));
            }
            prefills[sec] = parts.length > 0 ? parts.join('\n') : '';
        }

        if (lower.includes('service summary')) {
            const parts = [];
            const todaySales = (window.salesData || []).find(s => s.date === now.toLocaleDateString('en-AU'));
            if (todaySales) {
                parts.push('Revenue: $' + Number(todaySales.total || 0).toLocaleString());
                if (todaySales.covers) parts.push('Covers: ' + todaySales.covers);
            }
            // Today's wastage
            const todayWaste = (window.wastageLogs || []).filter(w => w.time && w.time.includes(todayStr));
            const wasteTotal = todayWaste.reduce((s, w) => s + Number(w.value || 0), 0);
            if (wasteTotal > 0) parts.push('Wastage: $' + wasteTotal.toFixed(2));
            // Top sellers from latest depletion run
            const latestDep = (window.depletionLogs || []).filter(d => !d.reversed && d.itemsSold && d.itemsSold.length > 0).slice(-1)[0];
            if (latestDep && latestDep.itemsSold.length > 0) {
                const topSellers = latestDep.itemsSold.slice().sort((a, b) => b.qtySold - a.qtySold).slice(0, 5);
                parts.push('Top sellers: ' + topSellers.map(s => s.recipeName + ' (' + s.qtySold + ')').join(', '));
            }
            // Tanda roster info
            if (window._tandaData) {
                const td = window._tandaData;
                parts.push('Roster: ' + (td.staffCount || '?') + ' staff, ' + (td.rosteredHours || '?') + 'h, est wages $' + (td.estimatedWageCost || '?'));
            }
            prefills[sec] = parts.length > 0 ? parts.join(' · ') : '';
        }

        if (lower.includes('opening') || lower.includes('tomorrow')) {
            // Check for upcoming tasks due
            const overdue = (window.rotationalTasks || []).filter(t => {
                if (t.dueDateMode === 'specific' && t.specificDueDate) return new Date(t.specificDueDate) <= new Date(now.getTime() + 86400000);
                return false;
            }).map(t => t.name);
            if (overdue.length > 0) prefills[sec] = 'Tasks due: ' + overdue.join(', ');
            // Supplier deliveries tomorrow
            const tomorrow = new Date(now.getTime() + 86400000);
            const tomorrowDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][tomorrow.getDay()];
            const deliveringTomorrow = (window.suppliers || []).filter(s => s.deliveryDays && s.deliveryDays.includes(tomorrowDay));
            if (deliveringTomorrow.length > 0) {
                const deliveryLine = 'Deliveries tomorrow (' + tomorrowDay + '): ' + deliveringTomorrow.map(s => s.name + (s.cutoff ? ' (cutoff ' + s.cutoff + ')' : '')).join(', ');
                prefills[sec] = prefills[sec] ? prefills[sec] + '\n' + deliveryLine : deliveryLine;
            }
            // Order cutoffs today — items below PAR whose supplier delivers tomorrow
            const urgentOrders = [];
            (window.inventoryItems || []).filter(i => !i.archived).forEach(i => {
                const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
                if (par > 0 && (i.stock||0) < par && i.supplier) {
                    const sup = (window.suppliers || []).find(s => s.name === i.supplier);
                    if (sup && sup.cutoff && sup.deliveryDays && sup.deliveryDays.includes(tomorrowDay)) {
                        urgentOrders.push((i.recipeName||i.name) + ' (' + sup.name + ', cutoff ' + sup.cutoff + ')');
                    }
                }
            });
            if (urgentOrders.length > 0) {
                const cutoffLine = 'Order cutoffs today: ' + urgentOrders.slice(0, 8).join(', ');
                prefills[sec] = prefills[sec] ? prefills[sec] + '\n' + cutoffLine : cutoffLine;
            }
        }
    });
    return prefills;
};

// =============================================================================
// AI MORNING BRIEFING
// =============================================================================
window._renderBriefingCard = (briefing) => {
    const E = window.esc;
    const htmlText = E(briefing.text || '').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `<div class="card" style="border-top:3px solid var(--purple);padding:20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:700;">🌅 Today's Briefing</div>
            <div style="display:flex;gap:6px;">
                <button onclick="window.generateMorningBriefing()" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">🔄 Refresh</button>
                <button onclick="document.getElementById('ai-briefing-container').innerHTML=''" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Dismiss</button>
            </div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:10px;">Generated ${E(briefing.time || '')}</div>
    </div>`;
};

window._collectBriefingContext = () => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isWeekend = [0,5,6].includes(now.getDay());
    const dayName = now.toLocaleDateString('en-AU',{weekday:'long'});
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Yesterday's sales
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const ySales = (window.salesData||[]).find(s => s.date === fmtDate(yesterday));
    const yRev = ySales ? Number(ySales.total||0) : null;
    const yCovers = ySales ? Number(ySales.covers||0) : null;

    // Last week same day
    const lwDate = new Date(now); lwDate.setDate(lwDate.getDate() - 7);
    const lwSales = (window.salesData||[]).find(s => s.date === fmtDate(lwDate));
    const lwRev = lwSales ? Number(lwSales.total||0) : null;

    // Stock health
    const activeItems = (window.inventoryItems||[]).filter(i => !i.archived);
    const lowStock = activeItems.filter(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    }).slice(0,10);
    const zeroStock = activeItems.filter(i => (i.stock||0) <= 0);

    // Overdue tasks
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific' && t.specificDueDate) return new Date(t.specificDueDate) <= now;
        if (t.lastLogIso) { const days = (now - new Date(t.lastLogIso))/86400000; const freq = {Weekly:7,Fortnightly:14,Monthly:30,Quarterly:90}; return days >= (freq[t.freq]||7); }
        return false;
    });

    // Expiring docs
    const expiringDocs = (window.digitalSafe||[]).filter(d => {
        if (!d.expiry) return false; const dl = (new Date(d.expiry)-now)/86400000; return dl <= 14;
    });

    // Open maintenance
    const openTickets = (window.defectLogs||[]).filter(d => d.status !== 'Resolved');

    // Today's roster from Tanda
    const tandaInfo = window._tandaData ? `Rostered: ${window._tandaData.staffCount} staff, ${window._tandaData.rosteredHours}h, est wages $${window._tandaData.estimatedWageCost}` : 'No Tanda data';

    // Suppliers delivering today
    const todayDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()];
    const deliveringToday = (window.suppliers||[]).filter(s => s.deliveryDays && s.deliveryDays.includes(todayDay));

    // Recent wastage
    const recentWaste = (window.wastageLogs||[]).filter(w => {
        if (!w.time) return false;
        const d = new Date(w.time); return (now - d) < 86400000*2;
    });
    const wasteTotal = recentWaste.reduce((s,w) => s + Number(w.value||0), 0);

    // Latest handover
    const lastHandover = (window.handoverLogs||[]).slice(-1)[0];
    const handoverSummary = lastHandover ? `Last handover (${lastHandover.date||'?'} ${lastHandover.shift||''}): ${(lastHandover.debrief||lastHandover.notes||'').substring(0,150)}` : 'No recent handover';

    // Upcoming leave from Tanda
    const leaveInfo = window._tandaLeave ? window._tandaLeave.slice(0,3).map(l => `${l.name}: ${l.type} (${l.startDate})`).join('; ') : '';

    return { venue, dayName, isWeekend, yRev, yCovers, lwRev, lowStock, zeroStock, overdueTasks, expiringDocs, openTickets, tandaInfo, deliveringToday, wasteTotal, handoverSummary, leaveInfo };
};

window.generateMorningBriefing = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    const container = document.getElementById('ai-briefing-container');
    if (container) container.innerHTML = '<div class="card" style="border-top:3px solid var(--purple);padding:20px;margin-bottom:16px;"><div style="display:flex;align-items:center;gap:10px;"><div class="loading-spinner" style="width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="color:var(--purple);font-weight:600;">Generating your morning briefing...</span></div></div>';

    const ctx = window._collectBriefingContext();

    const prompt = `You are the AI assistant for ${ctx.venue}, a hospitality venue in Hobart, Tasmania. Write a concise, actionable morning briefing for the manager opening today (${ctx.dayName}, ${ctx.isWeekend ? 'weekend' : 'weekday'}).

DATA:
- Yesterday's revenue: ${ctx.yRev !== null ? '$'+ctx.yRev.toLocaleString() : 'Not recorded'}
- Yesterday's covers: ${ctx.yCovers || 'Not recorded'}
- Same day last week revenue: ${ctx.lwRev !== null ? '$'+ctx.lwRev.toLocaleString() : 'Not recorded'}
- Items at zero stock: ${ctx.zeroStock.length > 0 ? ctx.zeroStock.map(i=>i.name).join(', ') : 'None'}
- Items below PAR (${ctx.lowStock.length}): ${ctx.lowStock.map(i=>i.name+' ('+Number(i.stock).toFixed(1)+')').join(', ') || 'All good'}
- Overdue tasks (${ctx.overdueTasks.length}): ${ctx.overdueTasks.map(t=>t.name).join(', ') || 'None'}
- Expiring documents (${ctx.expiringDocs.length}): ${ctx.expiringDocs.map(d=>d.name).join(', ') || 'None'}
- Open maintenance tickets (${ctx.openTickets.length}): ${ctx.openTickets.map(d=>d.item||d.description||'Ticket').join(', ') || 'None'}
- Roster: ${ctx.tandaInfo}
- Suppliers delivering today: ${ctx.deliveringToday.map(s=>s.name + ' (cutoff '+s.cutoff+')').join(', ') || 'None'}
- Recent wastage (48h): $${ctx.wasteTotal.toFixed(2)}
- ${ctx.handoverSummary}
${ctx.leaveInfo ? '- Upcoming leave: ' + ctx.leaveInfo : ''}

INSTRUCTIONS:
1. Start with a one-line greeting based on time of day and day of week
2. Give 3-5 bullet points covering the most important things to focus on today
3. Flag any urgent items (zero stock, overdue tasks, expired docs, maintenance)
4. If revenue data exists, compare yesterday vs last week and note the trend
5. Mention supplier cutoff times if deliveries are today
6. Keep it under 200 words, punchy and practical
7. End with a motivational one-liner for the day ahead`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate briefing.';

        const briefing = {
            id: window.generateId('brief'),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'}),
            text: text,
            venue: window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'
        };

        if (!window.dailyBriefings) window.dailyBriefings = [];
        // Replace today's existing briefing or add new
        window.dailyBriefings = window.dailyBriefings.filter(b => b.date !== briefing.date);
        window.dailyBriefings.unshift(briefing);
        if (window.dailyBriefings.length > 14) window.dailyBriefings = window.dailyBriefings.slice(0, 14);
        window.saveToDisk();

        if (container) container.innerHTML = window._renderBriefingCard(briefing);
    } catch (err) {
        if (container) container.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);margin-bottom:16px;">Briefing failed: ' + window.esc(err.message) + '</div>';
    }
};

// =============================================================================
// END-OF-DAY SUMMARY
// =============================================================================
window.generateEodSummary = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    window.showLoadingOverlay('Compiling end-of-day summary...');

    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isWeekend = [0,5,6].includes(now.getDay());
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Today's data
    const todaySales = (window.salesData||[]).find(s => s.date === fmtDate(now));
    const todayRev = todaySales ? Number(todaySales.total||0) : 0;
    const todayCovers = todaySales ? Number(todaySales.covers||0) : 0;
    const todayWages = todaySales ? Number(todaySales.wages||0) : 0;
    const laborPct = todayRev > 0 ? ((todayWages/todayRev)*100).toFixed(1) : '—';

    // Wastage
    const todayWaste = (window.wastageLogs||[]).filter(w => w.time && w.time.includes(todayStr));
    const wasteTotal = todayWaste.reduce((s,w) => s + Number(w.value||0), 0);

    // Compliance
    const todayTemps = (window.tempLogs||[]).filter(t => t.time && t.time.includes(todayStr));
    const breaches = todayTemps.filter(t => parseFloat(t.value) > 5);

    // Incidents
    const todayIncidents = (window.incidentLogs||[]).filter(i => i.time && i.time.includes(todayStr));

    // Stock status
    const lowStock = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    });
    const zeroItems = (window.inventoryItems||[]).filter(i => !i.archived && (i.stock||0) <= 0);

    // Tanda actuals
    const tandaInfo = window._tandaData || {};

    // Last week comparison
    const lwDate = new Date(now); lwDate.setDate(lwDate.getDate() - 7);
    const lwSales = (window.salesData||[]).find(s => s.date === fmtDate(lwDate));
    const lwRev = lwSales ? Number(lwSales.total||0) : 0;
    const revDelta = lwRev > 0 && todayRev > 0 ? ((todayRev - lwRev)/lwRev*100).toFixed(1) : null;

    const context = `Venue: ${venue}
Date: ${fmtDate(now)} (${now.toLocaleDateString('en-AU',{weekday:'long'})})
Revenue: $${todayRev.toLocaleString()} ${revDelta ? '('+( Number(revDelta)>=0?'+':'')+revDelta+'% vs last week)' : ''}
Covers: ${todayCovers || 'Not recorded'}
Labor cost: $${todayWages.toLocaleString()} (${laborPct}%)
${tandaInfo.actualHours ? 'Actual hours: '+tandaInfo.actualHours+'h ('+tandaInfo.actualStaffCount+' staff)' : ''}
Wastage: $${wasteTotal.toFixed(2)} (${todayWaste.length} items)
Temp logs: ${todayTemps.length} recorded, ${breaches.length} breaches
Incidents: ${todayIncidents.length}
Stock: ${lowStock.length} below PAR, ${zeroItems.length} at zero
Off menu items: ${zeroItems.slice(0,5).map(i=>i.name).join(', ') || 'None'}`;

    const prompt = `You are writing a concise end-of-day summary for ${venue}.

DATA:
${context}

Write a structured EOD summary with these sections:
1. 📊 Revenue & Performance (compare to last week if data available)
2. 👥 Labor (hours, cost, percentage)
3. 📦 Stock Status (items at zero, below PAR count)
4. ⚠️ Issues (breaches, incidents, wastage)
5. ✅ Action Items for Tomorrow (3-5 bullet points based on the data)

Keep it factual, concise, under 250 words. Use numbers throughout. This will be shared with the ownership team.`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate summary.';
        window.hideLoadingOverlay();

        const htmlText = window.esc(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const modalHtml = `
            <div style="max-height:60vh;overflow-y:auto;margin-bottom:16px;">
                <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="window._copyEodSummary()" class="btn btn-green" style="flex:1;padding:10px;">📋 Copy to Clipboard</button>
                <button onclick="window._saveEodToHandover()" class="btn btn-purple" style="flex:1;padding:10px;">📝 Save as Handover</button>
                <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Close</button>
            </div>`;
        window._lastEodText = text;
        window.openModal('📊 End-of-Day Summary — ' + fmtDate(now), modalHtml);
    } catch (err) {
        window.hideLoadingOverlay();
        window.showToast('EOD summary failed: ' + err.message, 'error');
    }
};

window._copyEodSummary = () => {
    if (window._lastEodText) {
        navigator.clipboard.writeText(window._lastEodText).then(() => {
            window.showToast('Summary copied to clipboard!');
        }).catch(() => {
            // Fallback for iPad
            const ta = document.createElement('textarea');
            ta.value = window._lastEodText;
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); ta.remove();
            window.showToast('Summary copied!');
        });
    }
};

window._saveEodToHandover = () => {
    const now = new Date();
    if (!window._lastEodText) return;
    window.handoverLogs.push({
        date: now.toLocaleDateString('en-AU'),
        shift: 'PM Shift',
        manager: 'AI Summary',
        debrief: window._lastEodText,
        closeTime: String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0'),
        notes: 'Auto-generated EOD summary'
    });
    window.saveToDisk();
    window.closeModal();
    window.showToast('EOD summary saved to handover log!');
};

// =============================================================================
// ANOMALY DETECTION ENGINE
// =============================================================================
window.runAnomalyDetection = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    window.showLoadingOverlay('Scanning for anomalies...');

    const now = new Date();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Collect 14 days of sales
    const salesHistory = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const s = (window.salesData||[]).find(x => x.date === fmtDate(d));
        salesHistory.push({
            date: fmtDate(d),
            day: d.toLocaleDateString('en-AU',{weekday:'short'}),
            revenue: s ? Number(s.total||0) : null,
            covers: s ? Number(s.covers||0) : null,
            wages: s ? Number(s.wages||0) : null,
            laborPct: s && Number(s.total||0) > 0 ? ((Number(s.wages||0)/Number(s.total||0))*100).toFixed(1)+'%' : null
        });
    }

    // Wastage by day (last 14 days)
    const wasteByDay = {};
    (window.wastageLogs||[]).forEach(w => {
        if (!w.time) return;
        const d = new Date(w.time);
        if ((now - d) > 86400000*14) return;
        const key = d.toLocaleDateString('en-AU');
        wasteByDay[key] = (wasteByDay[key]||0) + Number(w.value||0);
    });

    // Stock movement patterns
    const bigMovements = (window.stockMovements||[]).slice(0,50).map(m => `${m.item||'?'}: ${m.source||'?'} (${Number(m.delta||0).toFixed(1)}) on ${m.date||'?'}`);

    // Temperature anomalies
    const tempData = (window.tempLogs||[]).slice(-50).map(t => `${t.unit||'Unit'}: ${t.value}°C at ${t.time||'?'}`);
    const breachCount = (window.tempLogs||[]).filter(t => {
        if (!t.time) return false;
        const d = new Date(t.time); return (now - d) < 86400000*7 && parseFloat(t.value) > 5;
    }).length;

    // Depletion patterns
    const recentDepletions = (window.depletionLogs||[]).slice(0,10).map(d => `${d.date||'?'}: ${(d.changes||[]).length} items depleted, source: ${d.source||'?'}`);

    const prompt = `You are an operations analyst for ${venue}. Analyse the following 14 days of data and identify anomalies, unusual patterns, or concerns.

SALES DATA (last 14 days, newest first):
${salesHistory.map(s => `${s.date} (${s.day}): ${s.revenue !== null ? '$'+s.revenue : 'NO DATA'} rev, ${s.covers||'?'} covers, ${s.wages !== null ? '$'+s.wages : '?'} wages ${s.laborPct ? '('+s.laborPct+' labor)' : ''}`).join('\n')}

WASTAGE BY DAY:
${Object.entries(wasteByDay).map(([k,v]) => `${k}: $${v.toFixed(2)}`).join('\n') || 'No wastage data'}

TEMPERATURE BREACHES (7 days): ${breachCount}

RECENT STOCK MOVEMENTS:
${bigMovements.slice(0,10).join('\n') || 'None'}

INSTRUCTIONS:
1. Identify 3-5 specific anomalies or patterns
2. For each, explain what you found and why it matters
3. Rate each as 🔴 Critical, 🟠 Warning, or 🔵 Info
4. Suggest a specific action for each
5. Look for: revenue drops, labor cost spikes, wastage patterns, missing data days, temperature issues, unusual stock movements
6. Be specific with numbers and dates
7. Keep under 300 words total`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No anomalies detected.';
        window.hideLoadingOverlay();

        const htmlText = window.esc(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        window.openModal('🔍 Anomaly Detection Report', `
            <div style="max-height:60vh;overflow-y:auto;margin-bottom:16px;">
                <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="navigator.clipboard.writeText(window._lastAnomalyText||'');window.showToast('Copied!')" class="btn btn-outline" style="flex:1;padding:10px;">📋 Copy</button>
                <button onclick="window.closeModal()" class="btn btn-purple" style="flex:1;padding:10px;">Close</button>
            </div>`);
        window._lastAnomalyText = text;
    } catch (err) {
        window.hideLoadingOverlay();
        window.showToast('Anomaly scan failed: ' + err.message, 'error');
    }
};

// =============================================================================
// ASK HUB — NATURAL LANGUAGE QUERY INTERFACE
// =============================================================================
window.renderAskHubView = () => {
    const history = window._askHubHistory || [];
    const historyHtml = history.length > 0 ? history.map(h => `
        <div style="margin-bottom:16px;">
            <div style="padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:10px 10px 10px 2px;margin-bottom:6px;font-size:13px;color:var(--purple);font-weight:500;">💬 ${window.esc(h.q)}</div>
            <div style="padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px 10px 2px 10px;font-size:13px;line-height:1.7;color:var(--text-main);">${window.esc(h.a).replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
        </div>`).join('') : '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:48px;margin-bottom:12px;">🤖</div><h3 style="color:var(--text-main);margin:0 0 8px;">Ask Hub Anything</h3><p style="font-size:13px;max-width:400px;margin:0 auto;line-height:1.6;">Ask questions about your business in plain English. Hub will search your data and respond with specific answers.</p><div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">' +
        ['What was our busiest day this week?','Which items have the lowest margin?','How much wastage this week?','Who is rostered tomorrow?','What stock needs ordering?','Any compliance issues?'].map(q =>
            '<button onclick="document.getElementById(\'ask-hub-input\').value=\'' + window.escAttr(q) + '\';window.askHub();" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">' + q + '</button>'
        ).join('') + '</div></div>';

    return `<div style="max-width:700px;margin:auto;">
        <div style="margin-bottom:16px;">
            <h2 style="margin:0;">🤖 Ask Hub</h2>
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Ask questions about your venue data in plain English</div>
        </div>
        <div id="ask-hub-history" style="margin-bottom:16px;max-height:55vh;overflow-y:auto;">${historyHtml}</div>
        <div style="display:flex;gap:8px;position:sticky;bottom:0;background:var(--bg-main);padding:10px 0;">
            <input type="text" id="ask-hub-input" class="input-box" placeholder="Ask a question... e.g. What items are below par?" style="margin:0;flex:1;font-size:14px;padding:12px 16px;" onkeydown="if(event.key==='Enter')window.askHub()">
            <button onclick="window.askHub()" class="btn btn-purple" style="padding:12px 20px;white-space:nowrap;">Ask ✨</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
            <button onclick="window.runAnomalyDetection()" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">🔍 Run Anomaly Scan</button>
            <button onclick="window._askHubHistory=[];window.showView('ask-hub');" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">🗑️ Clear History</button>
        </div>
    </div>`;
};

window._askHubHistory = [];

window.askHub = async () => {
    const input = document.getElementById('ask-hub-input');
    if (!input) return;
    const question = input.value.trim();
    if (!question) return;

    const apiKey = window.getApiKey();
    if (!apiKey) return;

    input.value = '';
    input.disabled = true;

    // Add loading state to history
    const historyDiv = document.getElementById('ask-hub-history');
    if (historyDiv) {
        historyDiv.innerHTML += `<div style="margin-bottom:16px;">
            <div style="padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:10px 10px 10px 2px;margin-bottom:6px;font-size:13px;color:var(--purple);font-weight:500;">💬 ${window.esc(question)}</div>
            <div id="ask-hub-loading" style="padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:8px;"><div class="loading-spinner" style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div> Thinking...</div>
        </div>`;
        historyDiv.scrollTop = historyDiv.scrollHeight;
    }

    // Build data snapshot for context
    const now = new Date();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isWeekend = [0,5,6].includes(now.getDay());
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Sales (last 7 days)
    const salesSnap = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const s = (window.salesData||[]).find(x => x.date === fmtDate(d));
        if (s) salesSnap.push(`${fmtDate(d)} (${d.toLocaleDateString('en-AU',{weekday:'short'})}): $${Number(s.total||0)} rev, ${s.covers||0} covers, $${Number(s.wages||0)} wages`);
    }

    // Stock below PAR
    const lowStock = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    }).map(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return `${i.name}: stock ${Number(i.stock||0).toFixed(1)}/${par} (${i.supplier||'no supplier'})`;
    });

    // Recipe margins
    const recipeSnap = (window.recipes||[]).filter(r => r.type==='Menu' && !r.archived && r.price > 0).map(r => `${r.name}: sell $${Number(r.price).toFixed(2)}, cost $${Number(r.cost||0).toFixed(2)}, GP ${r.gp||0}%, ${r.coversPerWeek||0}/wk`);

    // Staff
    const staffSnap = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive').map(s => `${s.name} (${s.role||'Staff'})`);

    // Wastage recent
    const recentWaste = (window.wastageLogs||[]).filter(w => {
        if (!w.time) return false; return (now - new Date(w.time)) < 86400000*7;
    }).map(w => `${w.item||'?'}: $${Number(w.value||0).toFixed(2)} (${w.reason||'no reason'})`);

    // Tasks
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific' && t.specificDueDate) return new Date(t.specificDueDate) <= now;
        if (t.lastLogIso) { const days = (now - new Date(t.lastLogIso))/86400000; return days >= ({Weekly:7,Fortnightly:14,Monthly:30,Quarterly:90}[t.freq]||7); }
        return false;
    }).map(t => t.name);

    // Tanda
    const tandaSnap = window._tandaData ? `Rostered: ${window._tandaData.staffCount} staff, ${window._tandaData.rosteredHours}h, $${window._tandaData.estimatedWageCost} wages` : '';

    const prompt = `You are an AI assistant for ${venue} hospitality venue. Answer the following question using ONLY the data provided below. Be specific with numbers and dates. If the data doesn't contain enough info to answer, say so.

QUESTION: "${question}"

VENUE DATA SNAPSHOT:
Sales (last 7 days): ${salesSnap.join(' | ') || 'No sales data'}
Stock below PAR (${lowStock.length}): ${lowStock.slice(0,15).join(' | ') || 'All OK'}
Recipe margins: ${recipeSnap.slice(0,15).join(' | ') || 'No recipes'}
Active staff: ${staffSnap.join(', ') || 'No staff data'}
Recent wastage: ${recentWaste.slice(0,10).join(' | ') || 'None'}
Overdue tasks: ${overdueTasks.join(', ') || 'None'}
Open maintenance: ${(window.defectLogs||[]).filter(d=>d.status!=='Resolved').map(d=>d.item||d.description).join(', ') || 'None'}
Roster: ${tandaSnap || 'No Tanda data'}
Today: ${now.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} (${isWeekend?'Weekend':'Weekday'})

INSTRUCTIONS: Answer concisely in 2-5 sentences. Use specific numbers. Format key figures in bold with **.`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I couldn\'t process that question.';

        window._askHubHistory.push({ q: question, a: answer });
        if (window._askHubHistory.length > 20) window._askHubHistory = window._askHubHistory.slice(-20);

        input.disabled = false;
        window.showView('ask-hub');
        // Scroll to bottom
        setTimeout(() => {
            const hd = document.getElementById('ask-hub-history');
            if (hd) hd.scrollTop = hd.scrollHeight;
            const inp = document.getElementById('ask-hub-input');
            if (inp) inp.focus();
        }, 100);
    } catch (err) {
        input.disabled = false;
        const loadEl = document.getElementById('ask-hub-loading');
        if (loadEl) loadEl.innerHTML = '<span style="color:var(--red);">Error: ' + window.esc(err.message) + '</span>';
    }
};

// =============================================================================
// MY HUB — STAFF SELF-SERVICE PORTAL
// =============================================================================
window.renderMyHubView = () => {
    const E = window.esc;
    const staff = window._activeStaffMember;
    if (!staff) return '<div class="card" style="text-align:center;padding:48px;"><h3>👤 Staff Hub</h3><p style="color:var(--text-muted);">No active staff session. <button onclick="window.showStaffPinEntry()" class="btn btn-purple" style="padding:8px 16px;">Enter PIN</button></p></div>';

    // Run achievement calculation
    window._calculateAchievements(staff);

    // Determine visible cards
    const role = staff.role || 'FOH';
    const config = (window.staffHubConfig||{}).roles || {};
    const roleConfig = config[role] || {};
    const visibleCards = (staff.profileConfig||{}).visibleCards || roleConfig.visibleCards || (window.staffHubConfig||{}).defaultCards || ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'];
    const quickActions = roleConfig.quickActions || (window.staffHubConfig||{}).defaultActions || ['log-temps','wastage','maintenance','incident','sops'];

    // Birthday check
    const today = new Date();
    const bdayMsg = staff.birthday ? (() => {
        const bd = new Date(staff.birthday); const isBday = bd.getDate() === today.getDate() && bd.getMonth() === today.getMonth();
        return isBday ? '<div style="text-align:center;padding:12px;background:rgba(139,92,246,0.1);border-radius:10px;margin-bottom:14px;font-size:14px;">🎂 Happy Birthday, ' + E(staff.name.split(' ')[0]) + '! 🎉</div>' : '';
    })() : '';

    let html = '<div style="max-width:800px;margin:auto;">';
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">';
    html += '<div>';
    html += '<h2 style="margin:0;">👤 ' + E(staff.name) + '</h2>';
    html += '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">' + E(role) + ' · ' + E(staff.status||'Active') + '</div>';
    html += '</div>';
    html += '<button onclick="window.lockStaffHub()" class="btn btn-outline" style="padding:8px 16px;font-size:12px;">🔒 Lock</button>';
    html += '</div>';
    html += bdayMsg;

    // Custom fields display
    const cf = staff.customFields || {};
    if (Object.keys(cf).length > 0) {
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">';
        Object.entries(cf).forEach(([k,v]) => { html += '<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(139,92,246,0.1);color:var(--purple);border:1px solid rgba(139,92,246,0.2);">' + E(k) + ': ' + E(v) + '</span>'; });
        html += '</div>';
    }

    // Render each visible card
    if (visibleCards.includes('shifts')) html += window._renderMyShiftsCard(staff);
    if (visibleCards.includes('actions')) html += window._renderStaffActionsCard(quickActions);
    if (visibleCards.includes('announcements')) html += window._renderStaffAnnouncementsCard(staff);
    if (visibleCards.includes('qualifications')) html += window._renderMyQualificationsCard(staff);
    if (visibleCards.includes('achievements')) html += window._renderMyAchievementsCard(staff);
    if (visibleCards.includes('kudos')) html += window._renderMyKudosCard(staff);
    if (visibleCards.includes('feedback')) html += window._renderShiftFeedbackCard(staff);
    if (visibleCards.includes('leaderboard')) html += window._renderLeaderboardCard();

    html += '</div>';
    return html;
};

// --- MY SHIFTS CARD ---
window._renderMyShiftsCard = (staff) => {
    const E = window.esc;
    const td = window._tandaData;
    if (!td || !td.weeklyRoster) {
        return '<div class="card" style="padding:16px;border-top:3px solid var(--blue);margin-bottom:14px;"><div style="font-size:13px;font-weight:700;">🗓️ My Shifts</div><p style="font-size:13px;color:var(--text-muted);margin:8px 0 0;">No roster data available. Connect Tanda in Settings.</p></div>';
    }
    const staffName = (staff.name || '').toLowerCase().trim();
    const todayStr = new Date().toISOString().split('T')[0];
    let shiftsHtml = '';
    const weekDays = Object.keys(td.weeklyRoster || {}).sort();
    let foundShifts = 0;
    weekDays.forEach(date => {
        const dayShifts = (td.weeklyRoster[date] || []).filter(s => (s.name || '').toLowerCase().trim() === staffName);
        dayShifts.forEach(s => {
            foundShifts++;
            const isToday = date === todayStr;
            const d = new Date(date);
            const dayLabel = d.toLocaleDateString('en-AU', {weekday:'short', day:'numeric', month:'short'});
            shiftsHtml += '<div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;' + (isToday?'background:rgba(139,92,246,0.08);border-left:3px solid var(--purple);':'') + '">';
            shiftsHtml += '<div><strong style="font-size:13px;">' + (isToday?'⭐ TODAY':'') + ' ' + dayLabel + '</strong>';
            shiftsHtml += '<div style="font-size:12px;color:var(--text-muted);">' + E(s.department || '') + '</div></div>';
            shiftsHtml += '<div style="text-align:right;font-size:13px;">' + E(s.start || '') + ' — ' + E(s.finish || '') + '<div style="font-size:11px;color:var(--text-muted);">' + (s.hours || '?') + 'h</div></div>';
            shiftsHtml += '</div>';
        });
    });
    // Clocked in status
    let clockedInHtml = '';
    if (td.clockedIn) {
        const ci = td.clockedIn.find(c => (c.name||'').toLowerCase().trim() === staffName);
        if (ci) clockedInHtml = '<div style="padding:8px 12px;background:rgba(16,185,129,0.1);border-radius:6px;font-size:12px;color:var(--green);font-weight:600;margin-top:8px;">✅ Clocked in since ' + E(ci.since || '?') + '</div>';
    }
    return '<div class="card" style="padding:0;overflow:hidden;border-top:3px solid var(--blue);margin-bottom:14px;"><div style="padding:14px 16px;border-bottom:1px solid var(--border);"><div style="font-size:13px;font-weight:700;">🗓️ My Shifts This Week</div></div>' +
        (foundShifts > 0 ? shiftsHtml : '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No shifts rostered this week.</div>') +
        clockedInHtml + '</div>';
};

// --- STAFF QUICK ACTIONS ---
window._renderStaffActionsCard = (actions) => {
    const actionMap = {
        'log-temps': {label:'Log Temps', icon:'🌡️', view:'compliance', color:'var(--blue)'},
        'wastage': {label:'Log Wastage', icon:'🗑️', view:'wastage', color:'var(--orange)'},
        'maintenance': {label:'Report Issue', icon:'🛠️', view:'maintenance', color:'var(--red)'},
        'incident': {label:'Incident', icon:'⚠️', view:'incidents', color:'var(--red)'},
        'sops': {label:'View SOPs', icon:'📚', view:'knowledge', color:'var(--purple)'}
    };
    let html = '<div class="card" style="padding:16px;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">⚡ Quick Actions</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">';
    (actions || []).forEach(key => {
        const a = actionMap[key]; if (!a) return;
        html += '<button onclick="window.showView(\'' + a.view + '\')" style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg-main);border:1px solid var(--border);border-radius:8px;color:' + a.color + ';cursor:pointer;font-size:12px;font-weight:600;min-height:48px;" onmouseover="this.style.borderColor=\'' + a.color + '\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
        html += '<span style="font-size:18px;">' + a.icon + '</span>' + a.label + '</button>';
    });
    html += '</div></div>';
    return html;
};

// --- STAFF ANNOUNCEMENTS CARD ---
window._renderStaffAnnouncementsCard = (staff) => {
    const E = window.esc;
    const now = new Date();
    const active = (window.announcements || []).filter(a => !a.expiry || new Date(a.expiry) >= now).slice(0, 5);
    if (active.length === 0) return '';
    const prioColors = {urgent:'var(--red)',warning:'var(--orange)',info:'var(--blue)'};
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--blue);margin-bottom:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">📢 Announcements</div>';
    active.forEach(a => {
        const isAcked = (a.acknowledged||[]).includes(staff.name);
        html += '<div style="padding:8px 0;border-bottom:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="display:flex;gap:8px;align-items:center;flex:1;"><span style="width:8px;height:8px;border-radius:50%;background:' + (prioColors[a.priority]||'var(--blue)') + ';flex-shrink:0;"></span>';
        html += '<div><div style="font-size:13px;font-weight:500;">' + E(a.title) + '</div>';
        if (a.body) html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + E(a.body.substring(0,80)) + '</div>';
        html += '</div></div>';
        html += isAcked ? '<span style="font-size:11px;color:var(--green);">✅</span>' : '<button onclick="window._staffAckAnnouncement(\'' + window.escAttr(a.id) + '\')" class="btn btn-outline" style="font-size:10px;padding:3px 8px;flex-shrink:0;">Ack</button>';
        html += '</div>';
    });
    html += '</div>';
    return html;
};

window._staffAckAnnouncement = (id) => {
    const a = (window.announcements || []).find(x => x.id === id);
    const staff = window._activeStaffMember;
    if (!a || !staff) return;
    if (!a.acknowledged) a.acknowledged = [];
    if (!a.acknowledged.includes(staff.name)) { a.acknowledged.push(staff.name); window.saveToDisk(); window.showView('my-hub'); window.showToast('Acknowledged!'); }
};

// --- MY QUALIFICATIONS CARD ---
window._renderMyQualificationsCard = (staff) => {
    const E = window.esc;
    const now = new Date();
    const quals = staff.qualifications || {};
    const types = window.qualificationTypes || [];
    if (types.length === 0) return '';
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--green);margin-bottom:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">🎓 My Qualifications</div>';
    types.forEach(qt => {
        const q = quals[qt.id];
        let status = 'missing', statusColor = 'var(--text-muted)', statusText = 'Not provided', icon = '⬜';
        if (q) {
            if (qt.expiryRequired && q.expiry) {
                const daysLeft = (new Date(q.expiry) - now) / 86400000;
                if (daysLeft < 0) { status='expired'; statusColor='var(--red)'; statusText='EXPIRED'; icon='🔴'; }
                else if (daysLeft <= 30) { status='expiring'; statusColor='var(--orange)'; statusText='Expires in '+Math.ceil(daysLeft)+'d'; icon='🟠'; }
                else if (daysLeft <= 90) { status='soon'; statusColor='var(--orange)'; statusText='Expires in '+Math.ceil(daysLeft)+'d'; icon='🟡'; }
                else { status='current'; statusColor='var(--green)'; statusText='Valid until '+q.expiry; icon='🟢'; }
            } else if (q.verified) { status='verified'; statusColor='var(--green)'; statusText='Verified'; icon='🟢'; }
            else { status='pending'; statusColor='var(--orange)'; statusText='Pending'; icon='🟡'; }
        }
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);">';
        html += '<span style="font-size:13px;">' + icon + ' ' + E(qt.name) + '</span>';
        html += '<span style="font-size:12px;color:' + statusColor + ';font-weight:600;">' + statusText + '</span>';
        html += '</div>';
    });
    html += '</div>';
    return html;
};

// --- MY KUDOS CARD ---
window._renderMyKudosCard = (staff) => {
    const E = window.esc;
    const received = (window.kudos || []).filter(k => (k.to||'').toLowerCase().trim() === (staff.name||'').toLowerCase().trim()).slice(0, 5);
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--purple);margin-bottom:14px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    html += '<div style="font-size:13px;font-weight:700;">⭐ My Kudos (' + received.length + ')</div>';
    html += '<button onclick="window.giveKudosForm()" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">+ Give Kudos</button>';
    html += '</div>';
    if (received.length === 0) { html += '<p style="font-size:13px;color:var(--text-muted);">No kudos received yet. Keep up the great work!</p>'; }
    else { received.forEach(k => {
        html += '<div style="padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;">"' + E(k.message) + '" <span style="color:var(--text-muted);">— from ' + E(k.from) + ' · ' + E(k.date||'') + '</span></div>';
    }); }
    html += '</div>';
    return html;
};

// =============================================================================
// ACHIEVEMENT / AWARDS ENGINE
// =============================================================================
window._seedDefaultBadges = () => {
    if ((window.badgeDefinitions||[]).length > 0) return;
    window.badgeDefinitions = [
        { id:'temp-champion', name:'Temp Champion', icon:'🌡️', description:'Logging temperatures consistently', type:'auto', category:'Compliance', metric:'tempLogs', tiers:{bronze:{threshold:10},silver:{threshold:50},gold:{threshold:100}}, active:true },
        { id:'waste-warrior', name:'Waste Warrior', icon:'♻️', description:'Tracking wastage diligently', type:'auto', category:'Compliance', metric:'wastageLogs', tiers:{bronze:{threshold:5},silver:{threshold:25},gold:{threshold:50}}, active:true },
        { id:'kudos-collector', name:'Kudos Collector', icon:'⭐', description:'Recognised by peers', type:'auto', category:'Culture', metric:'kudosReceived', tiers:{bronze:{threshold:5},silver:{threshold:15},gold:{threshold:30}}, active:true },
        { id:'handover-hero', name:'Handover Hero', icon:'📝', description:'Consistent shift handovers', type:'auto', category:'Operations', metric:'handoverLogs', tiers:{bronze:{threshold:5},silver:{threshold:15},gold:{threshold:30}}, active:true },
        { id:'eagle-eye', name:'Eagle Eye', icon:'🛠️', description:'Spotting maintenance issues', type:'auto', category:'Venue', metric:'defectLogs', tiers:{bronze:{threshold:3},silver:{threshold:10},gold:{threshold:25}}, active:true },
        { id:'safety-first', name:'Safety First', icon:'⚠️', description:'Reporting incidents promptly', type:'auto', category:'Safety', metric:'incidentLogs', tiers:{bronze:{threshold:3},silver:{threshold:10},gold:{threshold:20}}, active:true },
        { id:'checklist-pro', name:'Checklist Pro', icon:'✅', description:'Completing compliance checks', type:'auto', category:'Compliance', metric:'complianceLogs', tiers:{bronze:{threshold:10},silver:{threshold:30},gold:{threshold:60}}, active:true }
    ];
    window.saveToDisk();
};

window._countMetricForStaff = (metric, staffName) => {
    const name = (staffName||'').toLowerCase().trim();
    const matchName = (field) => (field||'').toLowerCase().trim() === name;
    switch(metric) {
        case 'tempLogs': return (window.tempLogs||[]).filter(t => matchName(t.staff)).length;
        case 'wastageLogs': return (window.wastageLogs||[]).filter(w => matchName(w.staff)).length;
        case 'kudosReceived': return (window.kudos||[]).filter(k => matchName(k.to)).length;
        case 'handoverLogs': return (window.handoverLogs||[]).filter(h => matchName(h.manager)).length;
        case 'defectLogs': return (window.defectLogs||[]).filter(d => matchName(d.reportedBy || d.staff)).length;
        case 'incidentLogs': return (window.incidentLogs||[]).filter(i => matchName(i.staff || i.reportedBy)).length;
        case 'complianceLogs': return (window.complianceLogs||[]).filter(c => matchName(c.staff)).length;
        default: return 0;
    }
};

window._calculateAchievements = (staff) => {
    window._seedDefaultBadges();
    if (!staff.achievements) staff.achievements = [];
    const badges = (window.badgeDefinitions||[]).filter(b => b.active && b.type === 'auto');
    let newlyEarned = [];
    badges.forEach(badge => {
        const count = window._countMetricForStaff(badge.metric, staff.name);
        const tiers = badge.tiers || {};
        let earnedTier = null;
        if (tiers.gold && count >= tiers.gold.threshold) earnedTier = 'gold';
        else if (tiers.silver && count >= tiers.silver.threshold) earnedTier = 'silver';
        else if (tiers.bronze && count >= tiers.bronze.threshold) earnedTier = 'bronze';
        if (earnedTier) {
            const existing = staff.achievements.find(a => a.badgeId === badge.id);
            if (!existing) {
                staff.achievements.push({ badgeId: badge.id, tier: earnedTier, earnedDate: new Date().toISOString().split('T')[0] });
                newlyEarned.push(badge.icon + ' ' + badge.name + ' (' + earnedTier + ')');
            } else if (['bronze','silver','gold'].indexOf(earnedTier) > ['bronze','silver','gold'].indexOf(existing.tier)) {
                existing.tier = earnedTier; existing.earnedDate = new Date().toISOString().split('T')[0];
                newlyEarned.push(badge.icon + ' ' + badge.name + ' upgraded to ' + earnedTier + '!');
            }
        }
    });
    if (newlyEarned.length > 0) {
        // Update the staff record in directory
        const idx = (window.staffDirectory||[]).findIndex(s => s.name === staff.name);
        if (idx >= 0) { window.staffDirectory[idx].achievements = staff.achievements; window.saveToDisk(); }
        newlyEarned.forEach(msg => window.showToast('🏆 Badge earned: ' + msg));
    }
};

// --- MY ACHIEVEMENTS CARD ---
window._renderMyAchievementsCard = (staff) => {
    const E = window.esc;
    const achievements = staff.achievements || [];
    const allBadges = window.badgeDefinitions || [];
    const tierColors = {bronze:'#CD7F32',silver:'#C0C0C0',gold:'#FFD700',awarded:'var(--purple)'};
    let html = '<div class="card" style="padding:16px;border-top:3px solid #FFD700;margin-bottom:14px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:12px;">🏆 Achievements (' + achievements.length + ')</div>';
    if (achievements.length === 0) {
        html += '<p style="font-size:13px;color:var(--text-muted);">No badges earned yet. Complete tasks to unlock achievements!</p>';
    } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;">';
        achievements.forEach(a => {
            const badge = allBadges.find(b => b.id === a.badgeId) || {name:a.badgeId, icon:'🏅', description:''};
            const tierColor = tierColors[a.tier] || tierColors.bronze;
            html += '<div style="text-align:center;padding:12px 8px;background:var(--bg-main);border-radius:10px;border:2px solid ' + tierColor + ';">';
            html += '<div style="font-size:28px;">' + badge.icon + '</div>';
            html += '<div style="font-size:11px;font-weight:600;margin-top:4px;">' + E(badge.name) + '</div>';
            html += '<div style="font-size:10px;color:' + tierColor + ';text-transform:uppercase;font-weight:700;">' + E(a.tier) + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }
    // Show progress on unearned badges
    const unearnedBadges = allBadges.filter(b => b.active && b.type === 'auto' && !achievements.find(a => a.badgeId === b.id));
    if (unearnedBadges.length > 0) {
        html += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Next to earn:</div>';
        unearnedBadges.slice(0, 3).forEach(badge => {
            const count = window._countMetricForStaff(badge.metric, staff.name);
            const target = badge.tiers.bronze ? badge.tiers.bronze.threshold : 10;
            const pct = Math.min(100, Math.round((count / target) * 100));
            html += '<div style="margin-bottom:6px;"><div style="font-size:12px;display:flex;justify-content:space-between;">';
            html += '<span>' + badge.icon + ' ' + E(badge.name) + '</span>';
            html += '<span style="color:var(--text-muted);">' + count + '/' + target + '</span></div>';
            html += '<div style="background:var(--bg-main);border-radius:4px;height:4px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--purple);border-radius:4px;"></div></div></div>';
        });
        html += '</div>';
    }
    html += '</div>';
    return html;
};

// =============================================================================
// SHIFT FEEDBACK
// =============================================================================
window._renderShiftFeedbackCard = (staff) => {
    const E = window.esc;
    const today = new Date().toISOString().split('T')[0];
    const todayFeedback = (staff.shiftFeedback || []).find(f => f.date === today);
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--orange);margin-bottom:14px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">😊 Shift Feedback</div>';
    if (todayFeedback) {
        const emojis = ['😣','😕','😐','🙂','😄'];
        html += '<div style="text-align:center;padding:12px;"><div style="font-size:36px;">' + (emojis[todayFeedback.rating-1]||'😐') + '</div>';
        html += '<div style="font-size:13px;color:var(--text-muted);margin-top:6px;">You rated today\'s shift ' + todayFeedback.rating + '/5</div>';
        if (todayFeedback.tags && todayFeedback.tags.length > 0) html += '<div style="margin-top:6px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">' + todayFeedback.tags.map(t => '<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(139,92,246,0.1);color:var(--purple);">' + E(t) + '</span>').join('') + '</div>';
        html += '<div style="font-size:11px;color:var(--green);margin-top:8px;">✅ Feedback submitted — thanks!</div></div>';
    } else {
        html += '<div style="text-align:center;"><p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">How was your shift today?</p>';
        html += '<div id="mood-btns" style="display:flex;justify-content:center;gap:12px;margin-bottom:12px;">';
        ['😣','😕','😐','🙂','😄'].forEach((emoji, i) => {
            html += '<button onclick="window._selectMood(' + (i+1) + ')" style="font-size:32px;padding:8px;background:var(--bg-main);border:2px solid var(--border);border-radius:12px;cursor:pointer;min-width:52px;min-height:52px;transition:all 0.15s;" onmouseover="this.style.borderColor=\'var(--purple)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + emoji + '</button>';
        });
        html += '</div>';
        html += '<div id="mood-tags" style="display:none;margin-bottom:12px;">';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">What describes your shift? (optional)</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">';
        (window.shiftFeedbackTags || []).forEach(tag => {
            html += '<button onclick="this.classList.toggle(\'tag-selected\');this.style.background=this.classList.contains(\'tag-selected\')?\'var(--purple)\':\'var(--bg-main)\';this.style.color=this.classList.contains(\'tag-selected\')?\'#fff\':\'var(--text-muted)\';" class="mood-tag" data-tag="' + window.escAttr(tag) + '" style="font-size:11px;padding:5px 12px;border-radius:20px;background:var(--bg-main);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;">' + E(tag) + '</button>';
        });
        html += '</div></div>';
        html += '<div id="mood-note" style="display:none;margin-bottom:12px;"><input type="text" id="mood-note-input" class="input-box" placeholder="Any notes? (optional)" style="margin:0;font-size:13px;"></div>';
        html += '<button id="mood-submit" onclick="window._submitShiftFeedback()" style="display:none;" class="btn btn-purple" style="padding:10px 20px;">Submit Feedback</button>';
        html += '</div>';
    }
    html += '</div>';
    return html;
};

window._selectedMood = 0;
window._selectMood = (rating) => {
    window._selectedMood = rating;
    const tagsEl = document.getElementById('mood-tags');
    const noteEl = document.getElementById('mood-note');
    const submitBtn = document.getElementById('mood-submit');
    if (tagsEl) tagsEl.style.display = 'block';
    if (noteEl) noteEl.style.display = 'block';
    if (submitBtn) { submitBtn.style.display = 'inline-block'; }
    // Highlight selected mood
    const btns = document.querySelectorAll('#mood-btns button');
    btns.forEach((btn, i) => {
        btn.style.borderColor = (i + 1) === rating ? 'var(--purple)' : 'var(--border)';
        btn.style.background = (i + 1) === rating ? 'rgba(139,92,246,0.15)' : 'var(--bg-main)';
    });
};

window._submitShiftFeedback = () => {
    const staff = window._activeStaffMember;
    if (!staff || !window._selectedMood) return;
    const today = new Date().toISOString().split('T')[0];
    const selectedTags = Array.from(document.querySelectorAll('.mood-tag.tag-selected')).map(el => el.dataset.tag);
    const noteInput = document.getElementById('mood-note-input');
    const note = noteInput ? noteInput.value.trim() : '';
    if (!staff.shiftFeedback) staff.shiftFeedback = [];
    staff.shiftFeedback.push({ date: today, rating: window._selectedMood, tags: selectedTags, note: note });
    if (staff.shiftFeedback.length > 90) staff.shiftFeedback = staff.shiftFeedback.slice(-90);
    // Update in staffDirectory
    const idx = (window.staffDirectory||[]).findIndex(s => s.name === staff.name);
    if (idx >= 0) { window.staffDirectory[idx].shiftFeedback = staff.shiftFeedback; window.saveToDisk(); }
    window._selectedMood = 0;
    window.showView('my-hub');
    window.showToast('Thanks for the feedback!');
};

// =============================================================================
// TEAM LEADERBOARD
// =============================================================================
window._renderLeaderboardCard = () => {
    const E = window.esc;
    const activeStaff = (window.staffDirectory || []).filter(s => s.status !== 'Inactive');
    const scores = activeStaff.map(s => ({
        name: s.name, role: s.role || 'Staff',
        badges: (s.achievements || []).length,
        kudos: (window.kudos||[]).filter(k => (k.to||'').toLowerCase().trim() === (s.name||'').toLowerCase().trim()).length
    })).filter(s => s.badges > 0 || s.kudos > 0).sort((a, b) => (b.badges + b.kudos) - (a.badges + a.kudos));
    if (scores.length === 0) return '';
    const medals = ['🥇','🥈','🥉'];
    let html = '<div class="card" style="padding:16px;border-top:3px solid #FFD700;margin-bottom:14px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">🏅 Team Leaderboard</div>';
    scores.slice(0, 8).forEach((s, i) => {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);">';
        html += '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:16px;width:24px;text-align:center;">' + (medals[i]||'') + '</span>';
        html += '<div><span style="font-size:13px;font-weight:600;">' + E(s.name) + '</span>';
        html += '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">' + E(s.role) + '</span></div></div>';
        html += '<div style="display:flex;gap:10px;font-size:12px;"><span>🏆 ' + s.badges + '</span><span>⭐ ' + s.kudos + '</span></div>';
        html += '</div>';
    });
    html += '</div>';
    return html;
};

// =============================================================================
// BADGE MANAGEMENT (Manager View)
// =============================================================================
window.renderBadgeManagementView = () => {
    window._seedDefaultBadges();
    const E = window.esc;
    const badges = window.badgeDefinitions || [];
    let html = '<div style="max-width:900px;margin:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div><h2 style="margin:0;">🏆 Badge Management</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Create, edit and award badges to your team</div></div>';
    html += '<div style="display:flex;gap:8px;"><button onclick="window._newBadgeForm(\'auto\')" class="btn btn-purple" style="padding:8px 16px;">+ Auto Badge</button>';
    html += '<button onclick="window._newBadgeForm(\'manual\')" class="btn btn-blue" style="padding:8px 16px;">+ Manual Badge</button></div>';
    html += '</div>';

    badges.forEach((b, i) => {
        const tierColors = {bronze:'#CD7F32',silver:'#C0C0C0',gold:'#FFD700'};
        html += '<div class="card" style="padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;opacity:' + (b.active?'1':'0.5') + ';">';
        html += '<div style="display:flex;gap:12px;align-items:center;flex:1;">';
        html += '<div style="font-size:32px;">' + b.icon + '</div>';
        html += '<div><div style="font-size:14px;font-weight:600;">' + E(b.name) + ' <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:' + (b.type==='auto'?'rgba(16,185,129,0.1)':'rgba(59,130,246,0.1)') + ';color:' + (b.type==='auto'?'var(--green)':'var(--blue)') + ';">' + b.type + '</span></div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">' + E(b.description) + '</div>';
        if (b.type === 'auto' && b.tiers) {
            html += '<div style="display:flex;gap:8px;margin-top:4px;">';
            ['bronze','silver','gold'].forEach(t => {
                if (b.tiers[t]) html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--bg-main);border:1px solid ' + tierColors[t] + ';color:' + tierColors[t] + ';">' + t + ': ' + b.tiers[t].threshold + '</span>';
            });
            html += '</div>';
        }
        html += '</div></div>';
        html += '<div style="display:flex;gap:6px;flex-shrink:0;">';
        if (b.type === 'manual') html += '<button onclick="window._awardBadgeForm(\'' + window.escAttr(b.id) + '\')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">🎁 Award</button>';
        html += '<button onclick="window._editBadgeForm(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">✏️</button>';
        html += '<button onclick="window._toggleBadge(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">' + (b.active?'⏸️':'▶️') + '</button>';
        html += '<button onclick="window._deleteBadge(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;color:var(--red);">✕</button>';
        html += '</div></div>';
    });
    html += '</div>';
    return html;
};

window._newBadgeForm = (type) => {
    const html = `
        <div style="display:grid;grid-template-columns:auto 1fr;gap:10px;margin-bottom:12px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Icon</label><input type="text" id="badge-icon" class="input-box" value="🏅" style="margin:0;width:60px;font-size:24px;text-align:center;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Name</label><input type="text" id="badge-name" class="input-box" placeholder="e.g. Cocktail Master" style="margin:0;"></div>
        </div>
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Description</label><input type="text" id="badge-desc" class="input-box" placeholder="What this badge represents" style="margin:0;"></div>
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Category</label><input type="text" id="badge-cat" class="input-box" placeholder="e.g. Service, Compliance, Culture" style="margin:0;"></div>
        ${type === 'auto' ? `
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Metric</label>
        <select id="badge-metric" class="input-box" style="margin:0;">
            <option value="tempLogs">Temp Logs</option><option value="wastageLogs">Wastage Logs</option>
            <option value="kudosReceived">Kudos Received</option><option value="handoverLogs">Handover Logs</option>
            <option value="defectLogs">Maintenance Reports</option><option value="incidentLogs">Incident Reports</option>
            <option value="complianceLogs">Compliance Logs</option>
        </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Bronze</label><input type="number" id="badge-bronze" class="input-box" value="5" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Silver</label><input type="number" id="badge-silver" class="input-box" value="15" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Gold</label><input type="number" id="badge-gold" class="input-box" value="30" style="margin:0;"></div>
        </div>` : ''}
        <button onclick="window._saveBadge('${type}')" class="btn btn-green" style="width:100%;padding:12px;">Save Badge</button>`;
    window.openModal('🏆 New ' + (type==='auto'?'Auto':'Manual') + ' Badge', html);
};

window._saveBadge = (type, editIdx) => {
    const name = document.getElementById('badge-name').value.trim();
    const icon = document.getElementById('badge-icon').value.trim() || '🏅';
    const desc = document.getElementById('badge-desc').value.trim();
    const cat = document.getElementById('badge-cat').value.trim();
    if (!name) return window.showToast('Name required.', 'error');
    const badge = {
        id: editIdx !== undefined ? (window.badgeDefinitions[editIdx]||{}).id : window.generateId('badge'),
        name, icon, description: desc, category: cat, type, active: true
    };
    if (type === 'auto') {
        badge.metric = document.getElementById('badge-metric').value;
        badge.tiers = {
            bronze: { threshold: parseInt(document.getElementById('badge-bronze').value) || 5 },
            silver: { threshold: parseInt(document.getElementById('badge-silver').value) || 15 },
            gold: { threshold: parseInt(document.getElementById('badge-gold').value) || 30 }
        };
    }
    if (!window.badgeDefinitions) window.badgeDefinitions = [];
    if (editIdx !== undefined) window.badgeDefinitions[editIdx] = badge;
    else window.badgeDefinitions.push(badge);
    window.logAudit('badges', editIdx !== undefined ? 'edit' : 'create', badge.id, name);
    window.saveToDisk(); window.closeModal(); window.showView('badge-management');
    window.showToast('Badge saved!');
};

window._editBadgeForm = (idx) => {
    const b = (window.badgeDefinitions||[])[idx]; if (!b) return;
    window._newBadgeForm(b.type);
    setTimeout(() => {
        document.getElementById('badge-icon').value = b.icon || '🏅';
        document.getElementById('badge-name').value = b.name || '';
        document.getElementById('badge-desc').value = b.description || '';
        document.getElementById('badge-cat').value = b.category || '';
        if (b.type === 'auto' && b.tiers) {
            const metricEl = document.getElementById('badge-metric'); if (metricEl) metricEl.value = b.metric || 'tempLogs';
            const bronzeEl = document.getElementById('badge-bronze'); if (bronzeEl) bronzeEl.value = (b.tiers.bronze||{}).threshold || 5;
            const silverEl = document.getElementById('badge-silver'); if (silverEl) silverEl.value = (b.tiers.silver||{}).threshold || 15;
            const goldEl = document.getElementById('badge-gold'); if (goldEl) goldEl.value = (b.tiers.gold||{}).threshold || 30;
        }
        const btn = document.querySelector('#global-modal-content button.btn-green');
        if (btn) { btn.textContent = 'Update Badge'; btn.setAttribute('onclick', "window._saveBadge('" + b.type + "'," + idx + ")"); }
    }, 50);
};

window._toggleBadge = (idx) => { if (window.badgeDefinitions[idx]) { window.badgeDefinitions[idx].active = !window.badgeDefinitions[idx].active; window.saveToDisk(); window.showView('badge-management'); } };
window._deleteBadge = (idx) => { window.confirmAction({ title:'🏆 Delete Badge', message:'Remove this badge definition?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.badgeDefinitions.splice(idx,1); window.saveToDisk(); window.showView('badge-management'); }}); };

window._awardBadgeForm = (badgeId) => {
    const badge = (window.badgeDefinitions||[]).find(b => b.id === badgeId); if (!badge) return;
    const staffOpts = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive').map(s => '<option value="' + window.escAttr(s.name) + '">' + window.esc(s.name) + '</option>').join('');
    const html = `<div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Award ${window.esc(badge.icon)} ${window.esc(badge.name)} to:</label>
        <select id="award-to" class="input-box" style="margin:0;"><option value="">Select staff...</option>${staffOpts}</select></div>
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Citation (optional)</label>
        <input type="text" id="award-citation" class="input-box" placeholder="Why they earned this badge" style="margin:0;"></div>
        <button onclick="window._submitAward('${window.escAttr(badgeId)}')" class="btn btn-purple" style="width:100%;padding:12px;">🎁 Award Badge</button>`;
    window.openModal('🎁 Award Badge', html);
};

window._submitAward = (badgeId) => {
    const to = document.getElementById('award-to').value;
    const citation = document.getElementById('award-citation').value.trim();
    if (!to) return window.showToast('Select a staff member.', 'error');
    const staff = (window.staffDirectory||[]).find(s => s.name === to);
    if (!staff) return;
    if (!staff.achievements) staff.achievements = [];
    staff.achievements.push({ badgeId, tier: 'awarded', earnedDate: new Date().toISOString().split('T')[0], citation });
    window.logAudit('badges', 'award', badgeId, 'Awarded to ' + to);
    window.saveToDisk(); window.closeModal(); window.showView('badge-management');
    window.showToast('Badge awarded to ' + to + '!');
};

// =============================================================================
// STAFF HUB CONFIG VIEW (Manager)
// =============================================================================
window.renderStaffHubConfigView = () => {
    const E = window.esc;
    const config = window.staffHubConfig || {};
    const roles = Object.keys(config.roles || {});
    const allCards = ['shifts','qualifications','announcements','kudos','achievements','feedback','actions','leaderboard'];
    const allActions = ['log-temps','wastage','maintenance','incident','sops'];
    const allViews = ['dashboard','inventory','compliance','wastage','prep-list','noticeboard','rosters','tasks','maintenance','incidents','knowledge','zones','handover','orientation','safe','recipes','sales','suppliers'];
    const cardLabels = {shifts:'My Shifts',qualifications:'Qualifications',announcements:'Announcements',kudos:'Kudos',achievements:'Achievements',feedback:'Shift Feedback',actions:'Quick Actions',leaderboard:'Leaderboard'};
    const actionLabels = {'log-temps':'Log Temps',wastage:'Log Wastage',maintenance:'Report Issue',incident:'Incidents',sops:'View SOPs'};
    const viewLabels = {dashboard:'Dashboard',inventory:'Inventory',compliance:'Compliance',wastage:'Wastage',
        'prep-list':'Order Hub',noticeboard:'Noticeboard',rosters:'Roster',tasks:'Tasks',maintenance:'Maintenance',
        incidents:'Incidents',knowledge:'Knowledge Base',zones:'Zones',handover:'Handover',orientation:'Staff Mgmt',
        safe:'Digital Safe',recipes:'Recipes',sales:'Financials',suppliers:'Suppliers'};

    let html = '<div style="max-width:900px;margin:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div><h2 style="margin:0;">⚙️ Staff Hub Configuration</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Configure what each role sees in My Hub</div></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="window.showView(\'badge-management\')" class="btn btn-outline" style="padding:8px 16px;">🏆 Badges</button>';
    html += '<button onclick="window._editFeedbackTags()" class="btn btn-outline" style="padding:8px 16px;">😊 Feedback Tags</button>';
    html += '</div></div>';

    roles.forEach(role => {
        const rc = (config.roles||{})[role] || {};
        const vc = rc.visibleCards || [];
        const qa = rc.quickActions || [];
        html += '<div class="card" style="padding:16px;margin-bottom:12px;">';
        html += '<h3 style="margin:0 0 10px;font-size:15px;">' + E(role) + '</h3>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Visible Cards:</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
        allCards.forEach(card => {
            const isOn = vc.includes(card);
            html += '<button onclick="window._toggleRoleCard(\'' + window.escAttr(role) + '\',\'' + card + '\')" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid ' + (isOn?'var(--purple)':'var(--border)') + ';background:' + (isOn?'rgba(139,92,246,0.15)':'var(--bg-main)') + ';color:' + (isOn?'var(--purple)':'var(--text-muted)') + ';cursor:pointer;">' + (cardLabels[card]||card) + '</button>';
        });
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Quick Actions:</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        allActions.forEach(action => {
            const isOn = qa.includes(action);
            html += '<button onclick="window._toggleRoleAction(\'' + window.escAttr(role) + '\',\'' + action + '\')" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid ' + (isOn?'var(--blue)':'var(--border)') + ';background:' + (isOn?'rgba(59,130,246,0.15)':'var(--bg-main)') + ';color:' + (isOn?'var(--blue)':'var(--text-muted)') + ';cursor:pointer;">' + (actionLabels[action]||action) + '</button>';
        });
        html += '</div>';
        // Allowed Views section
        const av = rc.allowedViews || [];
        const isFullAccess = av.includes('*');
        html += '<div style="font-size:11px;color:var(--text-muted);margin:12px 0 8px;border-top:1px solid var(--border);padding-top:12px;">Allowed Views' + (isFullAccess ? ' <span style="color:var(--green);">(Full Access)</span>' : '') + ':</div>';
        if (role === 'Manager') {
            html += '<div style="font-size:12px;color:var(--green);padding:6px 0;">Manager has full access to all views.</div>';
        } else {
            html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
            allViews.forEach(view => {
                const isOn = av.includes(view);
                html += '<button onclick="window._toggleRoleView(\'' + window.escAttr(role) + '\',\'' + view + '\')" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid ' + (isOn?'var(--green)':'var(--border)') + ';background:' + (isOn?'rgba(16,185,129,0.15)':'var(--bg-main)') + ';color:' + (isOn?'var(--green)':'var(--text-muted)') + ';cursor:pointer;">' + (viewLabels[view]||view) + '</button>';
            });
            html += '</div>';
        }
        html += '</div>';
    });
    html += '</div>';
    return html;
};

window._toggleRoleView = (role, view) => {
    const config = window.staffHubConfig || {};
    if (!config.roles) config.roles = {};
    if (!config.roles[role]) config.roles[role] = { visibleCards: [...(config.defaultCards||[])], quickActions: [...(config.defaultActions||[])], allowedViews: [...(config.defaultViews||[])] };
    if (!config.roles[role].allowedViews) config.roles[role].allowedViews = [...(config.defaultViews||[])];
    const av = config.roles[role].allowedViews;
    const idx = av.indexOf(view);
    if (idx >= 0) av.splice(idx, 1); else av.push(view);
    window.staffHubConfig = config;
    window.saveToDisk(); window.showView('staff-hub-config');
};

window._toggleRoleCard = (role, card) => {
    const config = window.staffHubConfig || {};
    if (!config.roles) config.roles = {};
    if (!config.roles[role]) config.roles[role] = { visibleCards: [...(window.staffHubConfig.defaultCards||[])], quickActions: [...(window.staffHubConfig.defaultActions||[])] };
    const vc = config.roles[role].visibleCards;
    const idx = vc.indexOf(card);
    if (idx >= 0) vc.splice(idx, 1); else vc.push(card);
    window.staffHubConfig = config;
    window.saveToDisk(); window.showView('staff-hub-config');
};

window._toggleRoleAction = (role, action) => {
    const config = window.staffHubConfig || {};
    if (!config.roles) config.roles = {};
    if (!config.roles[role]) config.roles[role] = { visibleCards: [...(window.staffHubConfig.defaultCards||[])], quickActions: [...(window.staffHubConfig.defaultActions||[])] };
    const qa = config.roles[role].quickActions;
    const idx = qa.indexOf(action);
    if (idx >= 0) qa.splice(idx, 1); else qa.push(action);
    window.staffHubConfig = config;
    window.saveToDisk(); window.showView('staff-hub-config');
};

window._editFeedbackTags = () => {
    const tags = (window.shiftFeedbackTags || []).join('\n');
    const html = `<div style="margin-bottom:12px;">
        <label style="font-size:11px;color:var(--text-muted);">One tag per line</label>
        <textarea id="fb-tags" class="input-box" style="height:150px;margin:0;">${window.esc(tags)}</textarea>
    </div>
    <button onclick="window._saveFeedbackTags()" class="btn btn-green" style="width:100%;padding:12px;">Save Tags</button>`;
    window.openModal('😊 Edit Feedback Tags', html);
};

window._saveFeedbackTags = () => {
    const text = document.getElementById('fb-tags').value;
    window.shiftFeedbackTags = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    window.saveToDisk(); window.closeModal(); window.showView('staff-hub-config');
    window.showToast('Feedback tags updated!');
};

// =============================================================================
// SHIFT FEEDBACK TRENDS (Manager Dashboard Card)
// =============================================================================
window._renderFeedbackTrendsCard = () => {
    const now = new Date();
    const allFeedback = [];
    (window.staffDirectory || []).forEach(s => {
        (s.shiftFeedback || []).forEach(f => { allFeedback.push({ ...f, staff: s.name }); });
    });
    if (allFeedback.length === 0) return '';

    const last7 = allFeedback.filter(f => { const d = new Date(f.date); return (now - d) < 86400000*7; });
    const last30 = allFeedback.filter(f => { const d = new Date(f.date); return (now - d) < 86400000*30; });
    const avg7 = last7.length > 0 ? (last7.reduce((s,f)=>s+f.rating,0)/last7.length).toFixed(1) : '—';
    const avg30 = last30.length > 0 ? (last30.reduce((s,f)=>s+f.rating,0)/last30.length).toFixed(1) : '—';
    const trend = last7.length > 0 && last30.length > 0 ? (parseFloat(avg7) >= parseFloat(avg30) ? '📈' : '📉') : '';

    // Most common tags
    const tagCounts = {};
    last7.forEach(f => (f.tags||[]).forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));
    const topTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);

    let html = '<div class="card" style="padding:16px;margin-bottom:14px;border-top:3px solid var(--orange);">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">😊 Team Mood ' + trend + '</div>';
    html += '<div style="display:flex;gap:20px;margin-bottom:8px;">';
    html += '<div><span style="font-size:22px;font-weight:800;">' + avg7 + '</span><span style="font-size:11px;color:var(--text-muted);"> /5 (7d)</span></div>';
    html += '<div><span style="font-size:22px;font-weight:800;">' + avg30 + '</span><span style="font-size:11px;color:var(--text-muted);"> /5 (30d)</span></div>';
    html += '<div><span style="font-size:22px;font-weight:800;">' + last7.length + '</span><span style="font-size:11px;color:var(--text-muted);"> responses</span></div>';
    html += '</div>';
    if (topTags.length > 0) {
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
        topTags.forEach(([tag,count]) => { html += '<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(245,158,11,0.1);color:var(--orange);">' + window.esc(tag) + ' (' + count + ')</span>'; });
        html += '</div>';
    }
    html += '</div>';
    return html;
};
