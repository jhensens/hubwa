// --- HOBART HUB: Staff Module ---
// Staff hub, qualifications, orientation, staff directory, phonebook, incidents

// --- 2. STAFF HUB (Directory + Onboarding + Phonebook) ---
window._staffHubTab = window._staffHubTab || 'directory';

window.renderStaffHubView = function() {
    const tab = window._staffHubTab;
    const tabs = [
        { id: 'directory', label: '👥 Directory' },
        { id: 'onboarding', label: '🤝 Onboarding' },
        { id: 'qualifications', label: '🎓 Qualifications' },
        { id: 'phonebook', label: '📞 Phonebook' }
    ];
    const tabBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">' +
        tabs.map(t => `<span class="tag-pill ${tab===t.id?'active':''}" onclick="window._staffHubTab='${t.id}';window.showView('orientation');">${t.label}</span>`).join('') +
    '</div>';

    let content = '';
    if (tab === 'directory') content = window.renderStaffDirectoryView ? window.renderStaffDirectoryView() : '';
    else if (tab === 'onboarding') content = window.renderOrientationView ? window.renderOrientationView() : '';
    else if (tab === 'qualifications') content = window.renderQualificationsView ? window.renderQualificationsView() : '';
    else if (tab === 'phonebook') content = window.renderPhoneBookView ? window.renderPhoneBookView() : '';

    return `<div style="max-width:1100px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">👥 Staff Hub</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Team directory, onboarding, qualifications, and contacts</div>
            </div>
        </div>
        ${tabBar}
        ${content}
    </div>`;
};

// --- QUALIFICATIONS MATRIX VIEW ---
window.renderQualificationsView = function() {
    const staff = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive');
    const quals = window.qualificationTypes || [];
    const now = new Date();

    const getStatus = (q, qt) => {
        if (!q) return { cls: 'qual-none', label: 'Not Set' };
        if (!qt.expiryRequired) return q.verified ? { cls: 'qual-valid', label: 'Verified' } : { cls: 'qual-expiring', label: 'Pending' };
        if (!q.expiry) return { cls: 'qual-none', label: 'No Date' };
        const days = (new Date(q.expiry) - now) / 86400000;
        if (days < 0) return { cls: 'qual-expired', label: 'Expired' };
        if (days <= 30) return { cls: 'qual-expiring', label: Math.ceil(days) + 'd left' };
        return { cls: 'qual-valid', label: q.expiry };
    };

    if (staff.length === 0) {
        return '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);">' +
            '<div style="font-size:36px;margin-bottom:12px;">🎓</div>' +
            '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No active staff</div>' +
            '<div style="font-size:13px;">Add staff in the Directory tab first.</div></div>';
    }

    // Summary stats
    let totalExpired = 0, totalExpiring = 0, totalOk = 0;
    staff.forEach(s => {
        quals.forEach(qt => {
            const q = (s.qualifications||{})[qt.id];
            const st = getStatus(q, qt);
            if (st.cls === 'qual-expired') totalExpired++;
            else if (st.cls === 'qual-expiring') totalExpiring++;
            else if (st.cls === 'qual-valid') totalOk++;
        });
    });

    const summary = '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<div class="card" style="flex:1;min-width:120px;padding:12px;text-align:center;border-left:3px solid var(--green);"><div style="font-size:24px;font-weight:700;color:var(--green);">' + totalOk + '</div><div style="font-size:11px;color:var(--text-muted);">Valid</div></div>' +
        '<div class="card" style="flex:1;min-width:120px;padding:12px;text-align:center;border-left:3px solid var(--orange);"><div style="font-size:24px;font-weight:700;color:var(--orange);">' + totalExpiring + '</div><div style="font-size:11px;color:var(--text-muted);">Expiring Soon</div></div>' +
        '<div class="card" style="flex:1;min-width:120px;padding:12px;text-align:center;border-left:3px solid var(--red);"><div style="font-size:24px;font-weight:700;color:var(--red);">' + totalExpired + '</div><div style="font-size:11px;color:var(--text-muted);">Expired</div></div>' +
    '</div>';

    // Matrix table
    const thead = '<th style="padding:8px 12px;text-align:left;">Staff</th>' +
        quals.map(qt => '<th style="padding:8px 12px;text-align:center;font-size:11px;">' + esc(qt.name) + '</th>').join('') +
        '<th style="padding:8px 12px;"></th>';

    const tbody = staff.map((s, i) => {
        const cells = quals.map(qt => {
            const q = (s.qualifications||{})[qt.id];
            const st = getStatus(q, qt);
            return '<td style="padding:8px 12px;text-align:center;"><span class="' + st.cls + '">' + st.label + '</span></td>';
        }).join('');
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:8px 12px;"><strong style="font-size:13px;">' + esc(s.name) + '</strong><br><small style="color:var(--text-muted);">' + esc(s.role||'') + '</small></td>' +
            cells +
            '<td style="padding:8px 12px;text-align:right;"><button onclick="window.editStaffForm(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">✏️ Edit</button></td>' +
        '</tr>';
    }).join('');

    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
        '<div style="font-size:14px;font-weight:600;">Qualification Status Matrix</div>' +
        '<button onclick="window.editQualTypes()" class="btn btn-outline" style="font-size:12px;">⚙️ Edit Qualification Types</button>' +
    '</div>' +
    summary +
    '<div class="card" style="overflow-x:auto;padding:0;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' + thead + '</tr></thead>' +
        '<tbody>' + tbody + '</tbody>' +
        '</table>' +
    '</div>';
};

// --- EDIT QUALIFICATION TYPES ---
window.editQualTypes = () => {
    const quals = window.qualificationTypes || [];
    const rows = quals.map((qt, i) =>
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:var(--bg-main);border-radius:6px;">' +
            '<input type="text" id="qt-name-' + i + '" class="input-box" value="' + esc(qt.name) + '" style="flex:2;margin:0;font-size:13px;">' +
            '<label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;white-space:nowrap;"><input type="checkbox" id="qt-exp-' + i + '" ' + (qt.expiryRequired?'checked':'') + '> Expiry Date</label>' +
            '<button onclick="window.delQualType(' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button>' +
        '</div>'
    ).join('');

    const html = rows +
        '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<input type="text" id="qt-new-name" class="input-box" placeholder="New qualification name..." style="flex:2;margin:0;">' +
            '<label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;white-space:nowrap;"><input type="checkbox" id="qt-new-exp" checked> Expiry Date</label>' +
            '<button onclick="window.addQualType()" class="btn btn-blue" style="padding:6px 14px;">+ Add</button>' +
        '</div>' +
        '<button onclick="window.saveQualTypes()" class="btn btn-green" style="width:100%;margin-top:15px;">Save Qualification Types</button>';
    window.openModal('⚙️ Edit Qualification Types', html);
};

window.addQualType = () => {
    const name = document.getElementById('qt-new-name').value.trim();
    if (!name) return window.showToast('Name required.','error');
    const exp = document.getElementById('qt-new-exp').checked;
    const id = 'q_' + Date.now();
    window.qualificationTypes.push({ id: id, name: name, expiryRequired: exp });
    window.saveToDisk();
    window.editQualTypes(); // Refresh the modal
};

window.delQualType = (i) => {
    window.qualificationTypes.splice(i, 1);
    window.saveToDisk();
    window.editQualTypes();
};

window.saveQualTypes = () => {
    const quals = window.qualificationTypes || [];
    quals.forEach((qt, i) => {
        const nameEl = document.getElementById('qt-name-' + i);
        const expEl = document.getElementById('qt-exp-' + i);
        if (nameEl) qt.name = nameEl.value.trim() || qt.name;
        if (expEl) qt.expiryRequired = expEl.checked;
    });
    window.saveToDisk();
    window.closeModal();
    window.showView('orientation');
    window.showToast('Qualification types saved!');
};

window.renderOrientationView = function(showCompleted = false) {
    const filtered = (window.orientationLogs || []).map((o, i) => ({...o, originalIndex: i})).filter(o => (o.status === 'Completed') === showCompleted);
    return `<div style="max-width: 900px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🤝 Staff Onboarding</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Track new hire training progress, certifications, and acknowledgments</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="window.showView('orientation')" class="btn ${!showCompleted ? 'btn-dark' : 'btn-outline'}">Active Training</button>
                <button onclick="window.renderCompletedOrientations()" class="btn ${showCompleted ? 'btn-dark' : 'btn-outline'}">Fully Trained</button>
                <button onclick="window.editOnbTemplates()" class="btn btn-outline">⚙️ Templates</button>
                <button onclick="window.addOrientationForm()" class="btn btn-blue">+ New Hire</button>
            </div>
        </div>
        <div id="orientationContent">${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🤝</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No staff in this view</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add a new hire to start tracking their onboarding progress</div></div>' : filtered.map(o => {
        const template = window.onboardingTemplates[o.role] || window.onboardingTemplates['FOH (Front of House)'];
        let totalTasks = 0; let completedTasks = 0;
        let phasesHtml = Object.keys(template).map(phase => {
            let phaseTasksHtml = template[phase].map(t => {
                totalTasks++; if (o.tasks && o.tasks[t.id]) completedTasks++;
                let isDone = o.tasks && o.tasks[t.id];
                let actionHtml = (t.isUpload && !isDone && o.status !== 'Completed') ? `<input type="file" id="up-${o.originalIndex}-${t.id}" accept="application/pdf,image/*" style="display:none;" onchange="window.handleStaffUpload(${o.originalIndex}, '${t.id}', '${t.cat}', this)"><button onclick="document.getElementById('up-${o.originalIndex}-${t.id}').click()" class="btn btn-blue" style="font-size:10px; padding:3px 8px; margin-left:10px;">Upload File</button>` : '';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);"><label style="font-size:13px; display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" style="transform: scale(1.2);" ${isDone ? 'checked' : ''} ${o.status === 'Completed' || t.isUpload ? 'disabled' : `onchange="window.toggleOrientationTask(${o.originalIndex}, '${t.id}', this.checked)"`}><span style="${isDone ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${esc(t.label)}</span></label>${actionHtml}</div>`;
            }).join('');
            return `<div style="margin-bottom:15px;"><h5 style="margin:0 0 5px 0; color:var(--brand-accent); border-bottom:1px solid var(--border); padding-bottom:5px;">${esc(phase)}</h5>${phaseTasksHtml}</div>`;
        }).join('');
        const pct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        return `<div class="card" style="border-left:6px solid ${pct === 100 ? 'var(--green)' : 'var(--purple)'}; margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;"><div><h3 style="margin:0;">${esc(o.name)}</h3><span class="tag-pill" style="margin-top:5px;">${esc(o.role)}</span><small style="color:var(--text-muted); display:block; margin-top:5px;">Started: ${o.startDate}</small></div><div style="text-align:right;"><strong style="color:${pct === 100 ? 'var(--green)' : 'var(--purple)'}; font-size:24px;">${pct}%</strong>${o.status !== 'Completed' ? `<br><button onclick="window.deleteOrientation(${o.originalIndex})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:11px; margin-top:5px; padding:0; text-decoration:underline;">Remove Staff</button>` : ''}</div></div>${phasesHtml}<div style="margin-top:20px; background:var(--bg-main); padding:15px; border-radius:6px; border:1px solid var(--border);"><h5 style="margin:0 0 10px 0; color:var(--brand-dark);">Staff Acknowledgment</h5><p style="font-size:12px; margin:0 0 10px 0; color:var(--text-muted);">I confirm I have read the venue Handbooks, SOPs, and completed the training checklist above.</p>${o.signature ? `<div style="color:var(--green); font-family:monospace; font-size:14px; padding:10px; border:1px dashed var(--green); background:rgba(16, 185, 129, 0.1);">Signed: ${esc(o.signature)} <br><small>${esc(o.signDate)}</small></div>` : `<div style="display:flex; gap:10px;"><input type="text" id="sig-${o.originalIndex}" class="input-box" placeholder="Type name to sign..." style="margin:0; flex:1;"><button onclick="window.signOrientation(${o.originalIndex})" class="btn btn-dark">Sign</button></div>`}</div>${pct === 100 && o.signature && o.status !== 'Completed' ? `<button onclick="window.completeOrientation(${o.originalIndex})" class="btn btn-green" style="width:100%; margin-top:20px; font-size:16px;">Approve & Mark as Fully Trained</button>` : ''}</div>`; 
    }).join('')}</div></div>`;
}

window.renderCompletedOrientations = () => { document.getElementById('mainContent').innerHTML = window.renderOrientationView(true); };

window.editOnbTemplates = () => {
    let html = ``;
    Object.keys(window.onboardingTemplates).forEach(role => {
        html += `<div style="margin-bottom:20px;"><h3 style="color:var(--brand-dark); border-bottom:2px solid var(--border); padding-bottom:5px;">${esc(role)}</h3>`;
        Object.keys(window.onboardingTemplates[role]).forEach(phase => {
            html += `<h5 style="margin-top:15px; color:var(--brand-accent);">${esc(phase)}</h5>`;
            window.onboardingTemplates[role][phase].forEach((task, tIdx) => { html += `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--bg-main); font-size:13px;"><span>${esc(task.label)} ${task.isUpload ? '<span style="color:var(--blue); font-size:10px; border:1px solid var(--blue); padding:2px 4px; border-radius:4px; margin-left:5px;">Upload Required</span>' : ''}</span><button onclick="window.delOnbTask('${escAttr(role)}', '${escAttr(phase)}', ${tIdx})" style="color:var(--red); background:none; border:none; cursor:pointer; font-weight:bold;">&times;</button></div>`; });
            html += `<div style="display:flex; gap:10px; margin-top:10px;"><input type="text" id="nt-${role.replace(/\s/g,'')}-${phase.replace(/\s/g,'')}" class="input-box" placeholder="Add new task..." style="flex:1; margin:0;"><button onclick="window.addOnbTask('${escAttr(role)}', '${escAttr(phase)}')" class="btn btn-green">Add Task</button></div>`;
        });
        html += `</div>`;
    });
    window.openModal("⚙️ Edit Training Templates", html + `<button onclick="window.closeModal(); window.showView('orientation')" class="btn btn-blue" style="width:100%; margin-top:15px;">Done</button>`);
};
window.addOnbTask = (role, phase) => { const val = document.getElementById(`nt-${role.replace(/\s/g,'')}-${phase.replace(/\s/g,'')}`).value; if(val) { window.onboardingTemplates[role][phase].push({id: 't_' + Date.now(), label: val}); window.saveToDisk(); window.editOnbTemplates(); } };
window.delOnbTask = (role, phase, idx) => { window.confirmAction({ title:'Delete Training Task', message:'Remove this task from the template?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.onboardingTemplates[role][phase].splice(idx, 1); window.saveToDisk(); window.editOnbTemplates(); } }); };

window.addOrientationForm = () => { 
    let html = `<input type="text" id="o-name" class="input-box" placeholder="Staff Name" style="margin-bottom:15px;"><label style="font-size:11px; color:var(--text-muted);">Role / Department</label><select id="o-role" class="input-box" style="margin-bottom:15px;"><option>FOH (Front of House)</option><option>BOH (Back of House)</option></select><label style="font-size:11px; color:var(--text-muted);">Start Date</label><input type="date" id="o-date" value="${new Date().toISOString().split('T')[0]}" class="input-box" style="margin-bottom:20px;"><button onclick="window.submitOrientation()" class="btn btn-green" style="width:100%;">Create Training Profile</button>`;
    window.openModal("👋 Start New Hire Orientation", html); 
};
window.submitOrientation = () => { const name = document.getElementById('o-name').value; const role = document.getElementById('o-role').value; if(!name) return window.showToast("Staff Name is required.", "error"); window.orientationLogs.push({ name, role, startDate: document.getElementById('o-date').value, status: 'Active', tasks: {}, signature: null, signDate: null }); window.saveToDisk(); window.closeModal(); window.showView('orientation'); window.showToast("Profile Created!"); };
window.toggleOrientationTask = (index, taskId, isChecked) => { if(!window.orientationLogs[index].tasks) window.orientationLogs[index].tasks = {}; window.orientationLogs[index].tasks[taskId] = isChecked; window.saveToDisk(); window.showView('orientation'); };
window.handleStaffUpload = async (index, taskId, category, inputElem) => {
    if (!inputElem.files.length) return;
    const file = inputElem.files[0]; const btn = inputElem.nextElementSibling; const originalText = btn.innerText; btn.innerText = "Uploading... ⏳"; btn.disabled = true;
    try {
        const fileRef = storage.ref().child(`staff_onboarding/${Date.now()}_${file.name}`);
        await fileRef.put(file);
        const downloadURL = await fileRef.getDownloadURL();
        window.digitalSafe.push({ name: `${window.orientationLogs[index].name} - Document`, category: category, expiry: '', type: file.type.includes('pdf') ? 'pdf' : 'image', data: downloadURL });
        if(!window.orientationLogs[index].tasks) window.orientationLogs[index].tasks = {};
        window.orientationLogs[index].tasks[taskId] = true; window.saveToDisk(); window.showView('orientation'); window.showToast("Document Uploaded & Saved to Safe!");
    } catch (error) { window.showToast("Upload failed.", "error"); btn.innerText = originalText; btn.disabled = false; }
};
window.signOrientation = (index) => { const sigName = document.getElementById(`sig-${index}`).value; if(!sigName) return window.showToast("Please type your name.", "error"); window.orientationLogs[index].signature = sigName; window.orientationLogs[index].signDate = window._isoNow(); window.saveToDisk(); window.showView('orientation'); };
window.completeOrientation = (index) => { window.orientationLogs[index].status = 'Completed'; window.saveToDisk(); window.showView('orientation'); window.showToast("Staff Fully Trained!"); };
window.deleteOrientation = (index) => { window.confirmAction({ title:'Remove Training Record', message:'Remove this staff member\'s training record? This cannot be undone.', confirmLabel:'Remove', tier:'standard', onConfirm:() => { window.orientationLogs.splice(index, 1); window.saveToDisk(); window.showView('orientation'); } }); };


// --- COMBINED: Staff Directory, Incidents & Weekly Summary (from later in mgmt.js) ---

// =============================================================================
// STAFF DIRECTORY
// =============================================================================
window.renderStaffDirectoryView = () => {
    const staff = window.staffDirectory || [];
    return '<div style="max-width:900px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">' +
            '<div><h2 style="margin:0">👥 Staff Directory</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Team contact details, roles, and emergency info</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            (window.getTandaToken && window.getTandaToken() ? '<button onclick="window.showLoadingOverlay(\'Syncing from Tanda...\');window.loadTandaData().then(()=>{window.hideLoadingOverlay();window.syncTandaStaff();})" class="btn btn-outline" style="font-size:12px;border-color:var(--purple);color:var(--purple);">🔄 Sync from Tanda</button>' : '') +
            '<button onclick="window.editStaffForm()" class="btn btn-blue">+ Add Staff Member</button></div>' +
        '</div>' +
        (staff.length === 0 ?
            '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">👥</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No staff added</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add team members with their contact details and emergency info</div></div>' :
            '<div class="card" style="padding:0;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
            '<th style="padding:8px 12px;text-align:left;">Name</th>' +
            '<th style="padding:8px 12px;text-align:left;">Role</th>' +
            '<th style="padding:8px 12px;text-align:left;">Contact</th>' +
            '<th style="padding:8px 12px;text-align:left;">Status</th>' +
            '<th style="padding:8px 12px;"></th>' +
            '</tr></thead><tbody>' +
            staff.map((s, i) =>
                '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:8px 12px;"><strong style="font-size:13px;">' + esc(s.name) + '</strong>' + (s.emergency ? '<br><small style="color:var(--red);font-size:11px;">Emergency: ' + esc(s.emergency) + '</small>' : '') + '</td>' +
                '<td style="padding:12px 15px;font-size:13px;"><span style="background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);">' + esc(s.role||'Staff') + '</span></td>' +
                '<td style="padding:12px 15px;font-size:13px;"><a href="tel:' + esc(s.phone||'') + '" style="color:var(--blue);">' + esc(s.phone||'No phone') + '</a>' + (s.email ? '<br><a href="mailto:' + esc(s.email) + '" style="color:var(--text-muted);font-size:12px;">' + esc(s.email) + '</a>' : '') + '</td>' +
                '<td style="padding:8px 12px;"><span style="font-size:11px;color:' + (s.status==='Active'?'var(--green)':'var(--text-muted)') + ';font-weight:bold;">' + (s.status||'Active') + '</span>' + (s.startDate ? '<br><small style="color:var(--text-muted);font-size:11px;">Since ' + s.startDate + '</small>' : '') + '</td>' +
                '<td style="padding:8px 12px;text-align:right;">' +
                    '<button onclick="window.editStaffForm(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;margin-right:4px;">✏️ Edit</button>' +
                    '<button onclick="window.delStaff(' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button>' +
                '</td>' +
                '</tr>'
            ).join('') +
            '</tbody></table></div>'
        ) +
    '</div>';
};

window.editStaffForm = (idx) => {
    const s = idx !== undefined ? (window.staffDirectory||[])[idx] : { name:'', role:'FOH', phone:'', email:'', emergency:'', status:'Active', startDate:'', notes:'' };
    const isEdit = idx !== undefined;
    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Full Name</label><input type="text" id="sd-name" class="input-box" value="' + esc(s.name||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Role</label><select id="sd-role" class="input-box" style="margin:0;">' + Object.keys((window.staffHubConfig && window.staffHubConfig.roles) || {'FOH':1,'BOH':1,'Bar':1,'Manager':1,'Director':1,'Kitchen Hand':1}).map(r => '<option ' + (s.role===r?'selected':'') + '>' + r + '</option>').join('') + '</select></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Phone</label><input type="text" id="sd-phone" class="input-box" value="' + esc(s.phone||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Email</label><input type="text" id="sd-email" class="input-box" value="' + esc(s.email||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Emergency Contact</label><input type="text" id="sd-emerg" class="input-box" value="' + esc(s.emergency||'') + '" placeholder="Name & number" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Start Date</label><input type="date" id="sd-start" class="input-box" value="' + (s.startDate||'') + '" style="margin:0;"></div>' +
        '</div>' +
        '<label style="font-size:11px;color:var(--text-muted);">Status</label>' +
        '<select id="sd-status" class="input-box"><option ' + (s.status==='Active'?'selected':'') + '>Active</option><option ' + (s.status==='Inactive'?'selected':'') + '>Inactive</option><option ' + (s.status==='Casual'?'selected':'') + '>Casual</option></select>' +
        '<label style="font-size:11px;color:var(--text-muted);">Notes</label>' +
        '<textarea id="sd-notes" class="input-box" style="height:60px;margin-bottom:15px;">' + esc(s.notes||'') + '</textarea>' +
        // Qualification expiry fields
        '<div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:15px;">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text-main);margin-bottom:8px;display:block;">🎓 Qualifications</label>' +
        (window.qualificationTypes||[]).map(qt => {
            const q = (s.qualifications||{})[qt.id] || {};
            return '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">' +
                '<label style="font-size:12px;color:var(--text-muted);width:160px;flex-shrink:0;">' + esc(qt.name) + '</label>' +
                (qt.expiryRequired
                    ? '<input type="date" id="sq-' + qt.id + '" class="input-box" value="' + (q.expiry||'') + '" style="margin:0;flex:1;">'
                    : '<select id="sq-' + qt.id + '" class="input-box" style="margin:0;flex:1;"><option value="">Not provided</option><option value="yes" ' + (q.verified?'selected':'') + '>Verified</option><option value="pending">Pending</option></select>'
                ) +
                '</div>';
        }).join('') +
        '</div>' +
        // Staff PIN section
        '<div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:15px;">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text-main);margin-bottom:8px;display:block;">🔑 Staff PIN</label>' +
        '<div style="display:flex;gap:10px;align-items:center;">' +
        (s.pin ? '<span style="font-size:12px;color:var(--green);">✅ PIN set</span>' : '<span style="font-size:12px;color:var(--text-muted);">No PIN set</span>') +
        '<button onclick="window.setStaffPin(' + (isEdit?idx:'undefined') + ')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">' + (s.pin ? '🔄 Reset PIN' : '🔑 Set PIN') + '</button>' +
        '</div></div>' +
        // Birthday + custom fields
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Birthday</label><input type="date" id="sd-birthday" class="input-box" value="' + (s.birthday||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Custom (key=value, one per line)</label><textarea id="sd-custom" class="input-box" style="margin:0;height:40px;" placeholder="e.g. tshirt=Medium">' + Object.entries(s.customFields||{}).map(([k,v])=>k+'='+v).join('\n') + '</textarea></div>' +
        '</div>' +
        '<button onclick="window.saveStaff(' + (isEdit?idx:'undefined') + ')" class="btn btn-green" style="width:100%;">' + (isEdit?'Save Changes':'Add Staff Member') + '</button>';
    window.openModal(isEdit ? '✏️ Edit — ' + esc(s.name) : '+ New Staff Member', html);
};

window.setStaffPin = (idx) => {
    window._showPinModal('🔑 Set Staff PIN', 'Choose a 4-digit PIN for this staff member', async (newPin) => {
        if (newPin.length >= 4) {
            const hashed = await window._hashPin(newPin);
            // Check for collision with manager PIN
            const mgrPin = localStorage.getItem('venuePin');
            if (mgrPin && hashed === mgrPin) {
                window.showToast('This PIN matches the manager PIN. Choose a different one.', 'error');
                window._pinBuffer = '';
                const dots = document.querySelectorAll('.pin-dot');
                dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
                return;
            }
            // Check for collision with other staff PINs
            const collision = (window.staffDirectory||[]).find((s, i) => i !== idx && s.pin === hashed);
            if (collision) {
                window.showToast('This PIN is already used by ' + collision.name + '. Choose a different one.', 'error');
                window._pinBuffer = '';
                const dots = document.querySelectorAll('.pin-dot');
                dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
                return;
            }
            if (idx !== undefined && (window.staffDirectory||[])[idx]) {
                window.staffDirectory[idx].pin = hashed;
                window.saveToDisk();
                window.closeModal();
                window.showToast('PIN set for ' + window.staffDirectory[idx].name + '!');
                window.editStaffForm(idx); // Re-open form to show updated state
            }
        }
    });
};

window.saveStaff = (idx) => {
    // Collect qualification data
    const quals = {};
    (window.qualificationTypes||[]).forEach(qt => {
        const el = document.getElementById('sq-' + qt.id);
        if (!el) return;
        if (qt.expiryRequired) {
            if (el.value) quals[qt.id] = { expiry: el.value, verified: true };
        } else {
            if (el.value === 'yes') quals[qt.id] = { verified: true };
            else if (el.value === 'pending') quals[qt.id] = { verified: false };
        }
    });
    const existing = (idx !== undefined && idx !== 'undefined') ? (window.staffDirectory||[])[idx] : {};
    // Parse custom fields
    const customEl = document.getElementById('sd-custom');
    const customFields = {};
    if (customEl && customEl.value.trim()) {
        customEl.value.trim().split('\n').forEach(line => {
            const parts = line.split('='); if (parts.length >= 2) customFields[parts[0].trim()] = parts.slice(1).join('=').trim();
        });
    }
    const obj = {
        name: document.getElementById('sd-name').value.trim(),
        role: document.getElementById('sd-role').value,
        phone: document.getElementById('sd-phone').value.trim(),
        email: document.getElementById('sd-email').value.trim(),
        emergency: document.getElementById('sd-emerg').value.trim(),
        startDate: document.getElementById('sd-start').value,
        status: document.getElementById('sd-status').value,
        notes: document.getElementById('sd-notes').value.trim(),
        qualifications: quals,
        birthday: document.getElementById('sd-birthday') ? document.getElementById('sd-birthday').value : (existing.birthday || ''),
        customFields: customFields,
        // Preserve existing fields that aren't in this form
        pin: existing.pin || undefined,
        achievements: existing.achievements || [],
        shiftFeedback: existing.shiftFeedback || [],
        profileConfig: existing.profileConfig || {}
    };
    if (!obj.name) return window.showToast('Name required.','error');
    if (!window.staffDirectory) window.staffDirectory = [];
    if (idx !== undefined && idx !== 'undefined') window.staffDirectory[idx] = obj;
    else window.staffDirectory.push(obj);
    window.logAudit('staffDirectory', idx !== undefined ? 'edit' : 'create', obj.name, obj.role);
    window.saveToDisk(); window.closeModal(); window.showView('staff-directory');
    window.showToast('Staff member saved!');
};

window.delStaff = (i) => {
    window.confirmAction({ title:'👥 Remove Staff', message:'Remove this staff member from the directory?', confirmLabel:'Remove', tier:'standard',
        onConfirm:() => { window.staffDirectory.splice(i,1); window.saveToDisk(); window.showView('staff-directory'); }
    });
};

window.renderPhoneBookView = function() { 
    const mergedContacts = [...(window.phoneBook || []).map((c, i) => ({ ...c, originalIndex: i, isSupplier: false })), ...(window.suppliers || []).map(s => ({ name: s.name, category: 'Supplier', phone: s.contact || 'No email/phone', notes: `Order Cutoff: ${s.cutoff}`, isSupplier: true }))].sort((a, b) => a.name.localeCompare(b.name));
    return `<div style="max-width: 900px; margin: auto;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px"><div><h2 style="margin:0">📞 Phonebook</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Tradies, suppliers, and service providers your team calls regularly</div></div><button onclick="window.addContact()" class="btn btn-blue">+ Add Contact</button></div>${mergedContacts.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">📞</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No contacts yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add tradies, suppliers, and service providers your team calls regularly</div></div>' : '<table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse: collapse; overflow:hidden;"><thead><tr style="text-align:left; border-bottom:1px solid var(--border); background:#111;"><th style="padding:8px 12px;">Name</th><th style="padding:8px 12px;">Contact</th><th style="padding:8px 12px;">Notes</th><th style="text-align:right; padding:8px 12px;">Action</th></tr></thead><tbody>' + mergedContacts.map(c => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:7px 12px;"><strong style="font-size:13px;">${esc(c.name)}</strong><br><small style="color:var(--text-muted);">${esc(c.category)}</small></td><td style="padding:7px 12px;font-size:13px;">${c.phone.includes('@') ? `<a href="mailto:${esc(c.phone)}" style="color:var(--blue); font-weight:bold;">${esc(c.phone)}</a>` : `<a href="tel:${esc(c.phone)}" style="color:var(--blue); font-weight:bold;">${esc(c.phone)}</a>`}</td><td style="padding:7px 12px; color:var(--brand-accent); font-size:12px; white-space:pre-wrap;">${esc(c.notes) || ''}</td><td style="text-align:right; padding:7px 12px;">${c.isSupplier ? `<button onclick="window.showView('suppliers')" class="btn btn-outline" style="font-size:11px; padding:6px 10px;">Edit in Suppliers</button>` : `<button onclick="window.delContact(${c.originalIndex})" style="color:var(--red); background:none; border:none; cursor:pointer; font-weight:bold; font-size:20px; line-height:1;">&times;</button>`}</td></tr>`).join('') + '</tbody></table>'}</div>`; 
}
window.addContact = () => { 
    let html = `<input type="text" id="c-n" class="input-box" placeholder="Name"><select id="c-c" class="input-box"><option>Staff</option><option>Tradie / Maintenance</option><option>Service Provider</option><option>Other</option></select><input type="text" id="c-p" class="input-box" placeholder="Phone or Email"><textarea id="c-notes" class="input-box" placeholder="Notes..." style="height:80px; margin-bottom:20px;"></textarea><button onclick="window.subContact()" class="btn btn-green" style="width:100%;">Save Contact</button>`;
    window.openModal("📞 New Contact", html);
};
window.subContact = () => { const name = document.getElementById('c-n').value.trim(); if (!name) return window.showToast('Contact name is required.','error'); window.phoneBook.push({ name: name, category: document.getElementById('c-c').value.trim(), phone: document.getElementById('c-p').value.trim(), notes: document.getElementById('c-notes').value.trim() }); window.saveToDisk(); window.closeModal(); window.showView('phonebook'); window.showToast("Contact Saved!"); };
window.delContact = (i) => { window.confirmAction({ title:'📞 Delete Contact', message:'Remove this contact from the phonebook?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.phoneBook.splice(i,1); window.saveToDisk(); window.showView('phonebook'); } }); };

// --- 8. INCIDENT LOG ---
window.renderIncidentView = function() {
    const logs = (window.incidentLogs || []).slice().reverse();
    return '<div style="max-width:800px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0">⚠️ Incident Log</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Record workplace incidents for compliance and safety tracking</div></div>' +
            '<button onclick="window.exportIncidentLog()" class="btn btn-outline" style="font-size:12px;">🖨️ Export / Print</button>' +
        '</div>' +
        '<div class="card" style="border-top:4px solid var(--red);margin-bottom:15px;">' +
            '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px;">' +
                '<textarea id="inc-desc" class="input-box" style="height:90px;margin:0;" placeholder="Describe the incident in detail..."></textarea>' +
                '<div style="display:flex;flex-direction:column;gap:8px;">' +
                    '<input type="text" id="inc-staff" class="input-box" placeholder="Staff Name" style="margin:0;">' +
                    '<input type="text" id="inc-type" class="input-box" placeholder="Type (e.g. Injury, Spill)" style="margin:0;">' +
                '</div>' +
            '</div>' +
            '<button onclick="window.saveIncident()" class="btn btn-red" style="width:100%;font-size:15px;">Log Incident to Permanent Record</button>' +
        '</div>' +
        (logs.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">⚠️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No incidents logged</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Record workplace incidents here for compliance and safety tracking</div></div>' :
        logs.map(l => '<div class="card" style="margin-bottom:10px;padding:14px;border-left:3px solid var(--red);">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                '<div><strong style="font-size:15px;">' + esc(l.staff) + '</strong>' + (l.type ? ' <span style="font-size:11px;color:var(--red);background:rgba(239,68,68,0.1);padding:2px 8px;border-radius:8px;margin-left:8px;">' + esc(l.type) + '</span>' : '') + '</div>' +
                '<span style="color:var(--text-muted);font-size:12px;">' + esc(l.time) + '</span>' +
            '</div>' +
            '<p style="margin:0;font-size:14px;white-space:pre-wrap;">' + esc(l.desc) + '</p>' +
        '</div>').join('')) +
    '</div>';
};
window.saveIncident = function() {
    const staff = document.getElementById('inc-staff').value;
    const desc = document.getElementById('inc-desc').value;
    const type = document.getElementById('inc-type') ? document.getElementById('inc-type').value : '';
    if (!staff || !desc) return window.showToast('Staff name and description required.', 'error');
    window.incidentLogs.push({ staff, desc, type, time: window._isoNow() });
    window.saveToDisk(); window.showToast('Incident Logged', 'error'); window.showView('incidents');
};

window.exportIncidentLog = () => {
    const allLogs = (window.incidentLogs || []).slice().reverse();
    const html = '<p style="font-size:13px;color:var(--text-muted);margin-top:0;">Select a date range or leave blank to export all (' + allLogs.length + ' total).</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">' +
            '<div><label style="font-size:11px;color:var(--text-muted);">From</label><input type="date" id="inc-from" class="input-box" style="margin:0;"></div>' +
            '<div><label style="font-size:11px;color:var(--text-muted);">To</label><input type="date" id="inc-to" class="input-box" style="margin:0;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;">' +
            '<button onclick="window.runIncidentExport(\'print\')" class="btn btn-blue" style="flex:1;">🖨️ Print / PDF</button>' +
            '<button onclick="window.runIncidentExport(\'csv\')" class="btn btn-outline" style="flex:1;">📊 CSV</button>' +
        '</div>';
    window.openModal('🖨️ Export Incident Log', html);
};

window.runIncidentExport = (format) => {
    const fromVal = document.getElementById('inc-from') ? document.getElementById('inc-from').value : '';
    const toVal = document.getElementById('inc-to') ? document.getElementById('inc-to').value : '';
    const from = fromVal ? new Date(fromVal) : null;
    const to = toVal ? new Date(toVal + 'T23:59:59') : null;
    let logs = (window.incidentLogs || []).slice().reverse();
    if (from || to) logs = logs.filter(l => { const d = new Date(l.time); return (!from||d>=from) && (!to||d<=to); });
    const periodLabel = (from||to) ? ((from?from.toLocaleDateString('en-AU'):'All') + ' to ' + (to?to.toLocaleDateString('en-AU'):'Present')) : 'Full History';
    if (format === 'csv') {
        const rows = logs.map(l => ['"'+l.time+'"','"'+(l.staff||'')+'"','"'+(l.type||'')+'"','"'+(l.desc||'').replace(/"/g,"''")+'"'].join(','));
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('Date/Time,Staff,Type,Description\n' + rows.join('\n'));
        a.download = 'IncidentLog_BWI_' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        window.closeModal(); window.showToast(logs.length + ' incidents exported.');
        return;
    }
    const win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Incident Log</title><style>body{font-family:sans-serif;font-size:13px;max-width:750px;margin:30px auto;}.h{font-size:20px;font-weight:bold;border-bottom:3px solid #dc2626;padding-bottom:8px;margin-bottom:5px;}.meta{color:#888;font-size:12px;margin-bottom:20px;}.inc{border-left:4px solid #dc2626;padding:12px 15px;margin-bottom:12px;background:#fff5f5;border-radius:0 6px 6px 0;}.row{display:flex;justify-content:space-between;margin-bottom:6px;}.name{font-weight:bold;}.time{color:#888;font-size:11px;}.type{font-size:11px;background:#fca5a5;color:#dc2626;padding:2px 8px;border-radius:8px;margin-left:8px;}.desc{white-space:pre-wrap;line-height:1.6;}@media print{body{margin:15px;}}</style></head><body>');
    win.document.write('<div class="h">⚠️ Incident Log — ' + window._getVenueName() + '</div><div class="meta">Period: ' + periodLabel + ' · ' + logs.length + ' incident(s) · Printed ' + new Date().toLocaleDateString('en-AU') + '</div>');
    logs.forEach(l => { win.document.write('<div class="inc"><div class="row"><span><span class="name">' + esc(l.staff) + '</span>' + (l.type ? '<span class="type">' + esc(l.type) + '</span>' : '') + '</span><span class="time">' + esc(l.time) + '</span></div><div class="desc">' + esc(l.desc) + '</div></div>'); });
    win.document.write('<script>window.onload=()=>{window.print();}<\/script></body></html>');
    win.document.close(); window.closeModal();
};

// --- 9. COMMAND CENTER (DASHBOARD) ---

window.generateWeeklySummary = () => {
    const today = new Date();
    const weekStart = new Date(today);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
    weekStart.setHours(0,0,0,0);
    const parseDate = (str) => {
        const m = str && str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m ? new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1])) : new Date(str);
    };
    const weekSales = (window.salesData||[]).filter(s => { const d = parseDate(s.date); return d >= weekStart && d <= today; });
    const totalRev = weekSales.reduce((s,d) => s + Number(d.total||0), 0);
    const totalWages = weekSales.reduce((s,d) => s + Number(d.wages||0), 0);
    const wagePct = totalRev > 0 && totalWages > 0 ? ((totalWages/totalRev)*100).toFixed(1) : null;
    const avgDaily = weekSales.length > 0 ? (totalRev/weekSales.length).toFixed(0) : 0;
    const bestDay = weekSales.length > 0 ? weekSales.reduce((b,d) => Number(d.total)>Number(b.total)?d:b) : null;
    const isWeekend = [0,5,6].includes(today.getDay());
    const lowStock = (window.inventoryItems||[]).filter(i => { if(i.archived) return false; const par = isWeekend?(i.parWeekend||i.par||0):(i.parWeekday||i.par||0); return i.stock < par; });
    const openTickets = (window.defectLogs||[]).filter(d => d.status === 'Open');
    const weekWastage = (window.wastageLogs||[]).filter(w => { const d = new Date(w.time); return d >= weekStart && d <= today; });
    const wastageVal = weekWastage.reduce((s,w) => s + Number(w.value||0), 0);
    const weekIncidents = (window.incidentLogs||[]).filter(i => { const d = new Date(i.time); return d >= weekStart && d <= today; });
    const freqMap = {'Weekly':7,'Fortnightly':14,'Monthly':30,'Quarterly':90};
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific') return t.specificDueDate && new Date(t.specificDueDate) <= today;
        if (t.lastLogIso) return ((today - new Date(t.lastLogIso)) / 86400000) >= (freqMap[t.freq] || 7);
        if (t.anchorDate) { const ad = new Date(t.anchorDate); if (ad > today) return false; const ds = (today - ad) / 86400000; const iv = freqMap[t.freq] || 7; return (ds - Math.floor(ds / iv) * iv) < 1 || ds >= iv; }
        return true;
    });
    const weekLabel = weekStart.toLocaleDateString('en-AU',{day:'numeric',month:'short'}) + ' – ' + today.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
    const fmt = (n) => Number(n).toLocaleString('en-AU',{minimumFractionDigits:0,maximumFractionDigits:0});
    const lines = [
        (window.getCurrentVenue ? window.getCurrentVenue().name.toUpperCase() : 'BAR WA IZAKAYA') + ' — WEEKLY SUMMARY',
        weekLabel,
        '─────────────────────────────',
        '',
        '💰 REVENUE',
        'Total: $' + fmt(totalRev),
        'Avg Daily: $' + fmt(avgDaily),
        bestDay ? 'Best Day: ' + bestDay.date + ' ($' + fmt(bestDay.total) + ')' : '',
        '',
        '💼 WAGES',
        totalWages > 0 ? 'Total: $' + fmt(totalWages) + (wagePct ? ' (' + wagePct + '%)' : '') : 'No wages data',
        '',
        '🗑️ WASTAGE',
        weekWastage.length > 0 ? weekWastage.length + ' items · $' + wastageVal.toFixed(2) + ' lost' : 'None logged',
        '',
        '📦 INVENTORY',
        lowStock.length > 0 ? lowStock.length + ' below PAR: ' + lowStock.slice(0,5).map(i=>i.name).join(', ') + (lowStock.length>5?'...':'') : 'All at or above PAR',
        '',
        '🛠️ MAINTENANCE',
        openTickets.length > 0 ? openTickets.length + ' open: ' + openTickets.map(t=>t.item).join(', ') : 'No open tickets',
        '',
        '⚠️ INCIDENTS',
        weekIncidents.length > 0 ? weekIncidents.length + ' incident(s) this week' : 'None',
        '',
        '🔄 OVERDUE TASKS',
        overdueTasks.length > 0 ? overdueTasks.map(t => '• ' + t.name + ' (' + t.freq + ')').join('\n') : 'All current',
        '',
        '─────────────────────────────',
        'Generated by Hobart Hub · ' + today.toLocaleDateString('en-AU')
    ];
    window._weeklySummaryText = lines.filter(l => l !== null).join('\n');
    const html = '<div style="background:var(--bg-main);padding:15px;border-radius:8px;margin-bottom:15px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:50vh;overflow-y:auto;line-height:1.7;">' + window._weeklySummaryText + '</div>' +
        '<div style="display:flex;gap:10px;">' +
            '<button onclick="navigator.clipboard.writeText(window._weeklySummaryText).then(()=>window.showToast(\'Copied!\'))" class="btn btn-blue" style="flex:1;">📋 Copy</button>' +
            '<button onclick="window.printWeeklySummary()" class="btn btn-outline" style="flex:1;">🖨️ Print</button>' +
        '</div>';
    window.openModal('📊 Weekly Summary — ' + weekLabel, html);
};
