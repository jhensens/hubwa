// --- HOBART HUB: Tanda Module ---
// Tanda API integration: roster data, clocked-in status, staff sync, settings



// =============================================================================
// TANDA API
// =============================================================================
window.getTandaToken = () => {
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    return localStorage.getItem(vid + '_tandaApiToken') || '';
};

window._tandaErrorShown = false; // throttle: only show one error toast per refresh cycle
window._tandaConnected = false; // track whether at least one call succeeded this cycle
window.fetchTanda = async (endpoint) => {
    const token = window.getTandaToken();
    if (!token) return null;
    try {
        const res = await fetch('https://my.tanda.co/api/v2/' + endpoint, {
            headers: { 'Authorization': 'bearer ' + token, 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            // Only show auth errors if no call has succeeded yet (avoids false alarm
            // when connection works but a secondary endpoint has permission issues)
            if (!window._tandaErrorShown && !window._tandaConnected) {
                window._tandaErrorShown = true;
                if (res.status === 401 || res.status === 403) {
                    window.showToast('Tanda token expired or invalid — update in Settings', 'error');
                } else {
                    window.showToast('Tanda API error (HTTP ' + res.status + ')', 'error');
                }
            }
            return null;
        }
        window._tandaConnected = true;
        return await res.json();
    } catch(e) {
        if (!window._tandaErrorShown && !window._tandaConnected) {
            window._tandaErrorShown = true;
            window.showToast("Can't reach Tanda API — check internet connection", 'error');
        }
        return null;
    }
};

// --- TANDA HOURS HELPER ---
window._tandaCalcHours = (s) => {
    if (s.duration) return s.duration / 3600;
    if (s.finish && s.start) return (s.finish - s.start) / 3600;
    if (s.finish_time && s.start_time) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [fh, fm] = s.finish_time.split(':').map(Number);
        let hrs = ((fh * 60 + fm) - (sh * 60 + sm)) / 60;
        if (hrs < 0) hrs += 24;
        return hrs;
    }
    return 0;
};

// --- TANDA FULL DATA LOAD ---
window._tandaData = window._tandaData || null;
window._tandaStaff = [];
window._tandaDepartments = [];

window.loadTandaData = async () => {
    if (!window.getTandaToken()) return;
    window._tandaErrorShown = false; // reset error throttle for this cycle
    window._tandaConnected = false; // reset connection tracker
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // 1. Users (full profiles)
    const usersData = await window.fetchTanda('users');
    if (!usersData) { return; }
    const users = Array.isArray(usersData) ? usersData : (usersData.users || []);
    if (users.length === 0) { return; }

    // Store full staff profiles
    window._tandaStaff = users.map(u => ({
        id: u.id, name: u.name || '', phone: u.phone || '', email: u.email || '',
        photo: u.photo_url || u.photo || '', dob: u.date_of_birth || '',
        startDate: u.employment_start_date || '', departmentIds: u.department_ids || [],
        active: u.active !== false
    }));

    const userIds = users.map(u => u.id).join(',');

    // 2. Departments
    const deptData = await window.fetchTanda('departments');
    if (deptData) {
        const depts = Array.isArray(deptData) ? deptData : (deptData.departments || []);
        window._tandaDepartments = depts.map(d => ({ id: d.id, name: d.name || 'Unknown' }));
    }

    // 3. Weekly roster — Mon to Sun of current week
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today); weekStart.setDate(today.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const weekSchedData = await window.fetchTanda(
        'schedules?from=' + weekStartStr + '&to=' + weekEndStr + '&user_ids=' + userIds + '&show_costs=true&include_names=true'
    );
    const weekSchedules = weekSchedData ? (Array.isArray(weekSchedData) ? weekSchedData : (weekSchedData.schedules || [])) : [];

    // Parse today's schedules from the weekly pull
    let rosteredHours = 0, rosteredCost = 0, rosteredStaff = [];
    // Build weekly roster grid: { date: [ { name, start, finish, hours, dept } ] }
    const weeklyRoster = {};
    for (let d = 0; d < 7; d++) {
        const dt = new Date(weekStart); dt.setDate(weekStart.getDate() + d);
        weeklyRoster[dt.toISOString().split('T')[0]] = [];
    }

    weekSchedules.forEach(s => {
        const hrs = window._tandaCalcHours(s);
        const user = users.find(u => u.id === s.user_id);
        const name = (user && user.name) || s.user_name || ('Staff #' + (s.user_id || ''));
        const dept = window._tandaDepartments.find(d => d.id === s.department_id);
        const startTime = s.start_time || (s.start ? new Date(s.start * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '');
        const finishTime = s.finish_time || (s.finish ? new Date(s.finish * 1000).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '');
        // Determine date from start timestamp or from schedule date
        let schedDate = dateStr;
        if (s.start) { schedDate = new Date(s.start * 1000).toISOString().split('T')[0]; }
        else if (s.date) { schedDate = s.date; }
        if (weeklyRoster[schedDate]) {
            weeklyRoster[schedDate].push({ name, start: startTime, finish: finishTime, hours: hrs.toFixed(1), dept: dept ? dept.name : '', userId: s.user_id });
        }
        // Accumulate today's totals
        if (schedDate === dateStr) {
            rosteredHours += hrs;
            if (s.cost) rosteredCost += Number(s.cost);
            rosteredStaff.push({ name, hours: hrs > 0 ? hrs.toFixed(1) : 'Rostered', start: startTime });
        }
    });

    // 4. Shifts (actual hours worked) — 30 days back for analytics coverage
    const shiftsStart = new Date(today); shiftsStart.setDate(shiftsStart.getDate() - 30);
    const shiftsStartStr = shiftsStart.toISOString().split('T')[0];
    const weekShiftsData = await window.fetchTanda(
        'shifts?from=' + shiftsStartStr + '&to=' + dateStr + '&show_costs=true'
    );
    const weekShifts = weekShiftsData ? (Array.isArray(weekShiftsData) ? weekShiftsData : (weekShiftsData.shifts || [])) : [];
    let actualHours = 0, actualCost = 0, actualStaff = [];
    const weeklyActual = {};
    weekShifts.forEach(s => {
        const hrs = window._tandaCalcHours(s);
        const user = users.find(u => u.id === s.user_id);
        const name = (user && user.name) || ('Staff #' + (s.user_id || ''));
        let shiftDate = dateStr;
        if (s.start) shiftDate = new Date(s.start * 1000).toISOString().split('T')[0];
        if (!weeklyActual[shiftDate]) weeklyActual[shiftDate] = { hours: 0, cost: 0, count: 0 };
        weeklyActual[shiftDate].hours += hrs;
        if (s.cost) weeklyActual[shiftDate].cost += Number(s.cost);
        weeklyActual[shiftDate].count++;
        // Today's totals
        if (shiftDate === dateStr) {
            actualHours += hrs;
            if (s.cost) actualCost += Number(s.cost);
            actualStaff.push({ name, hours: hrs.toFixed(1) });
        }
    });

    // 5. Clocked in right now
    let clockedIn = [];
    const clockedData = await window.fetchTanda('users/clocked_in');
    if (clockedData) {
        const cArr = Array.isArray(clockedData) ? clockedData : (clockedData.users || []);
        clockedIn = cArr.map(u => {
            // Look up name from users array since clocked_in may only return IDs
            const userId = u.id || u.user_id;
            const knownUser = userId ? users.find(usr => usr.id === userId) : null;
            const name = u.name || (knownUser && knownUser.name) || ('Staff #' + (userId || '?'));
            const since = u.clocked_in_at ? new Date(u.clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (u.last_clocked_in_at ? new Date(u.last_clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
            return { name, since };
        });
    }

    // 6. Leave (next 14 days)
    const leaveEnd = new Date(today); leaveEnd.setDate(leaveEnd.getDate() + 14);
    const leaveEndStr = leaveEnd.toISOString().split('T')[0];
    let upcomingLeave = [];
    const leaveData = await window.fetchTanda('leave?from=' + dateStr + '&to=' + leaveEndStr);
    if (leaveData) {
        const lArr = Array.isArray(leaveData) ? leaveData : (leaveData.leave || []);
        upcomingLeave = lArr.filter(l => l.status === 'approved' || l.status === 'pending').map(l => {
            const user = users.find(u => u.id === l.user_id);
            return {
                name: (user && user.name) || ('Staff #' + l.user_id),
                from: l.start_date || l.from || '',
                to: l.finish_date || l.end_date || l.to || '',
                type: l.leave_type || l.type || 'Leave',
                status: l.status || 'approved'
            };
        });
    }

    // 7. Leave balances
    let leaveBalances = [];
    const balData = await window.fetchTanda('leave_balances?user_ids=' + userIds);
    if (balData) {
        const bArr = Array.isArray(balData) ? balData : (balData.leave_balances || []);
        leaveBalances = bArr.map(b => {
            const user = users.find(u => u.id === b.user_id);
            return { name: (user && user.name) || ('Staff #' + b.user_id), balance: b.balance || 0, typeId: b.leave_type_id };
        });
    }

    // 8. Qualifications (RSA, Food Handler, etc.)
    let qualifications = [];
    const qualData = await window.fetchTanda('qualifications');
    if (qualData) {
        const qArr = Array.isArray(qualData) ? qualData : (qualData.qualifications || []);
        qualifications = qArr.map(q => {
            const user = users.find(u => u.id === q.user_id);
            return {
                name: (user && user.name) || ('Staff #' + q.user_id),
                userId: q.user_id,
                type: q.qualification_type || q.name || 'Unknown',
                expiry: q.expiry_date || q.expiry || null,
                issued: q.issue_date || null
            };
        });
    }

    // 9. Unavailability (next 14 days)
    let unavailability = [];
    const unavData = await window.fetchTanda('unavailability?from=' + dateStr + '&to=' + leaveEndStr);
    if (unavData) {
        const uArr = Array.isArray(unavData) ? unavData : (unavData.unavailability || []);
        unavailability = uArr.map(u => {
            const user = users.find(usr => usr.id === u.user_id);
            return { name: (user && user.name) || ('Staff #' + u.user_id), from: u.start_date || '', to: u.finish_date || '', reason: u.reason || '', recurring: !!u.recurring };
        });
    }

    // Build combined data object
    window._tandaData = {
        date: dateStr,
        // Rostered (planned) — today
        rosteredHours: rosteredHours.toFixed(1),
        estimatedWageCost: rosteredCost.toFixed(2),
        staffCount: rosteredStaff.length,
        staff: rosteredStaff,
        // Actual (worked) — today
        actualHours: actualHours.toFixed(1),
        actualWageCost: actualCost.toFixed(2),
        actualStaffCount: actualStaff.length,
        actualStaff: actualStaff,
        // Weekly roster grid
        weeklyRoster: weeklyRoster,
        weeklyActual: weeklyActual,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        // Live
        clockedIn: clockedIn,
        // Leave & availability
        upcomingLeave: upcomingLeave,
        leaveBalances: leaveBalances,
        unavailability: unavailability,
        // Qualifications
        qualifications: qualifications,
        // Meta
        lastUpdated: new Date().toLocaleTimeString(),
        _lastUpdatedTs: Date.now(),
        userCount: users.length
    };
    if (['dashboard', 'prime-cost', 'orientation'].includes(window.currentView)) window.showView(window.currentView);
};

// --- TANDA CLOCKED-IN QUICK REFRESH (lightweight) ---
window.loadTandaClockedIn = async () => {
    if (!window.getTandaToken() || !window._tandaData) return;
    const clockedData = await window.fetchTanda('users/clocked_in');
    if (!clockedData) return;
    const cArr = Array.isArray(clockedData) ? clockedData : (clockedData.users || []);
    window._tandaData.clockedIn = cArr.map(u => {
        const userId = u.id || u.user_id;
        const knownUser = userId ? (window._tandaStaff || []).find(s => s.id === userId) : null;
        const name = u.name || (knownUser && knownUser.name) || ('Staff #' + (userId || '?'));
        const since = u.clocked_in_at ? new Date(u.clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (u.last_clocked_in_at ? new Date(u.last_clocked_in_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
        return { name, since };
    });
    window._tandaData.lastUpdated = new Date().toLocaleTimeString();
    window._tandaData._lastUpdatedTs = Date.now();
};

// --- TANDA AUTO-REFRESH ---
window._tandaFullInterval = null;
window._tandaQuickInterval = null;
window.startTandaAutoRefresh = () => {
    window.stopTandaAutoRefresh();
    // Full refresh every 15 minutes
    window._tandaFullInterval = setInterval(() => {
        if (!document.hidden && window.getTandaToken()) window.loadTandaData();
    }, 15 * 60 * 1000);
    // Clocked-in refresh every 5 minutes
    window._tandaQuickInterval = setInterval(() => {
        if (!document.hidden && window.getTandaToken()) window.loadTandaClockedIn();
    }, 5 * 60 * 1000);
};
window.stopTandaAutoRefresh = () => {
    if (window._tandaFullInterval) { clearInterval(window._tandaFullInterval); window._tandaFullInterval = null; }
    if (window._tandaQuickInterval) { clearInterval(window._tandaQuickInterval); window._tandaQuickInterval = null; }
};

// --- TANDA STAFF SYNC → STAFF DIRECTORY ---
window.syncTandaStaff = () => {
    if (!window._tandaStaff || window._tandaStaff.length === 0) return window.showToast('No Tanda staff data. Refresh Tanda first.', 'error');
    let added = 0, updated = 0;
    window._tandaStaff.filter(ts => ts.active).forEach(ts => {
        const existing = (window.staffDirectory || []).find(s => s.name && ts.name && s.name.toLowerCase().trim() === ts.name.toLowerCase().trim());
        if (existing) {
            // Merge: fill blanks only
            if (!existing.phone && ts.phone) { existing.phone = ts.phone; updated++; }
            if (!existing.email && ts.email) { existing.email = ts.email; updated++; }
            if (!existing.startDate && ts.startDate) existing.startDate = ts.startDate;
            if (ts.departmentIds && ts.departmentIds.length > 0 && window._tandaDepartments.length > 0) {
                const deptName = window._tandaDepartments.find(d => d.id === ts.departmentIds[0]);
                if (deptName && !existing.role) existing.role = deptName.name;
            }
        } else {
            // Add new staff
            let role = '';
            if (ts.departmentIds && ts.departmentIds.length > 0 && window._tandaDepartments.length > 0) {
                const dept = window._tandaDepartments.find(d => d.id === ts.departmentIds[0]);
                if (dept) role = dept.name;
            }
            window.staffDirectory.push({
                name: ts.name, role: role, phone: ts.phone, email: ts.email,
                emergency: '', status: 'Active', startDate: ts.startDate, notes: 'Synced from Tanda',
                qualifications: {}
            });
            added++;
        }
    });
    // Sync qualifications from Tanda
    let qualSynced = 0;
    if (window._tandaData && window._tandaData.qualifications) {
        window._tandaData.qualifications.forEach(function(tq) {
            const staff = (window.staffDirectory || []).find(s => s.name && tq.name && s.name.toLowerCase().trim() === tq.name.toLowerCase().trim());
            if (!staff) return;
            if (!staff.qualifications) staff.qualifications = {};
            // Map Tanda qual type to a slug
            const slug = tq.type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
            if (!staff.qualifications[slug] || (tq.expiry && !staff.qualifications[slug].expiry)) {
                staff.qualifications[slug] = { expiry: tq.expiry || '', verified: true };
                qualSynced++;
            }
            // Ensure qualification type exists in Hub
            if (window.qualificationTypes && !window.qualificationTypes.find(qt => qt.id === slug)) {
                window.qualificationTypes.push({ id: slug, name: tq.type, requiresExpiry: !!tq.expiry });
            }
        });
    }
    window.saveToDisk();
    window.showToast('Tanda sync: ' + added + ' added, ' + updated + ' fields updated' + (qualSynced > 0 ? ', ' + qualSynced + ' quals synced' : '') + '.');
    if (window.currentView === 'orientation') window.showView('orientation');
};

// --- TANDA SETTINGS MODAL ---
window.openTandaSettings = () => {
    const token = window.getTandaToken();
    const td = window._tandaData;
    const connected = !!token;
    const statusDot = connected ? '🟢' : '🔴';
    const statusText = connected ? 'Connected' : 'Not Connected';

    let html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);">' +
        '<span style="font-size:18px;">' + statusDot + '</span>' +
        '<div><div style="font-weight:600;font-size:14px;">' + statusText + '</div>' +
        (td ? '<div style="font-size:11px;color:var(--text-muted);">Last sync: ' + td.lastUpdated + '</div>' : '') +
        '</div></div>';

    html += '<label style="font-size:11px;color:var(--text-muted);">API Token — get from: <a href="https://my.tanda.co/api/v2/my_tokens" target="_blank" style="color:var(--blue);">my.tanda.co/api/v2/my_tokens ↗</a></label>';
    html += '<input type="text" id="tanda-token" class="input-box" value="' + token + '" placeholder="Paste Tanda API token...">';
    html += '<button onclick="window.saveTandaToken()" class="btn btn-green" style="width:100%;margin-bottom:8px;">Save & Connect</button>';

    if (connected) {
        html += '<button onclick="window.showLoadingOverlay(\'Refreshing Tanda...\');window.loadTandaData().then(()=>{window.hideLoadingOverlay();window.openTandaSettings();});" class="btn btn-outline" style="width:100%;margin-bottom:8px;">🔄 Refresh All Data</button>';
        html += '<button onclick="window.syncTandaStaff();window.closeModal();" class="btn btn-outline" style="width:100%;margin-bottom:12px;">👥 Sync Staff to Hub Directory</button>';
    }

    if (td) {
        html += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">';
        html += '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--brand-dark);">📊 Data Summary</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--text-muted);">';
        html += '<div>👥 Staff synced: <strong>' + td.userCount + '</strong></div>';
        html += '<div>📋 Rostered today: <strong>' + td.staffCount + '</strong></div>';
        html += '<div>⏱️ Rostered hours: <strong>' + td.rosteredHours + 'h</strong></div>';
        html += '<div>💰 Est. wages: <strong>$' + td.estimatedWageCost + '</strong></div>';
        if (Number(td.actualHours) > 0) {
            html += '<div>✅ Actual hours: <strong>' + td.actualHours + 'h</strong></div>';
            html += '<div>💵 Actual cost: <strong>$' + td.actualWageCost + '</strong></div>';
        }
        html += '<div>🟢 Clocked in: <strong>' + (td.clockedIn || []).length + '</strong></div>';
        html += '<div>🏖️ Upcoming leave: <strong>' + (td.upcomingLeave || []).length + '</strong></div>';
        html += '</div></div>';
    }

    window.openModal('⏱️ Tanda Integration', html);
};

window.saveTandaToken = () => {
    const token = document.getElementById('tanda-token').value.trim();
    if (!token) return window.showToast('Token required.','error');
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_tandaApiToken', token);
    window.closeModal();
    window.showToast('Tanda connected!');
    window.showLoadingOverlay('Connecting to Tanda...');
    window.loadTandaData().then(() => { window.hideLoadingOverlay(); window.startTandaAutoRefresh(); });
};
