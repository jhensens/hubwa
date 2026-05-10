// --- HOBART HUB: Lightspeed/Kounta API Integration (OAuth via Cloud Function) ---
// Browser cannot call Kounta API directly (CORS + Bearer token requirements).
// All API calls route through Firebase Cloud Functions:
//   - lightspeedExchange: OAuth code → access/refresh tokens
//   - lightspeedRefresh:  refresh access token when expired
//   - lightspeedProxy:    relay API calls with auth header
// Tokens stored in localStorage, scoped per venue.

// =============================================================================
// 0. CLOUD FUNCTION ENDPOINTS
// =============================================================================
// Format: https://us-central1-{project}.cloudfunctions.net/{funcName}
// Override via localStorage.setItem('lsCloudFnBase', 'https://...') for testing.
window.LS_CLOUD_FN_BASE = (() => {
    const override = localStorage.getItem('lsCloudFnBase');
    if (override) return override;
    return 'https://us-central1-hobart-hub.cloudfunctions.net';
})();

// OAuth redirect URI — base URL of the Hub (works on both Firebase + GitHub Pages).
// GitHub Pages doesn't support URL rewrites, so we can't use a fake path like
// /lightspeed-callback. Instead we redirect to the base URL with ?code=xxx&state=xxx;
// the Hub auto-detects these params on page load (see handleLsOAuthCallback).
window.LS_REDIRECT_URI = (() => {
    // Base URL — strips any filename (e.g. index.html) but keeps the trailing slash
    return window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
})();

// =============================================================================
// 1. CREDENTIAL HELPERS — now manages OAuth tokens too
// =============================================================================

window.getLsCredentials = () => {
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    return {
        clientId: localStorage.getItem(vid + '_lsClientId') || '',
        clientSecret: localStorage.getItem(vid + '_lsClientSecret') || '',
        accessToken: localStorage.getItem(vid + '_lsAccessToken') || '',
        refreshToken: localStorage.getItem(vid + '_lsRefreshToken') || '',
        tokenExpiry: Number(localStorage.getItem(vid + '_lsTokenExpiry') || '0'),
        companyId: localStorage.getItem(vid + '_lsCompanyId') || '',
        siteId: localStorage.getItem(vid + '_lsSiteId') || '',
        siteName: localStorage.getItem(vid + '_lsSiteName') || '',
        lastPull: localStorage.getItem(vid + '_lsLastPull') || ''
    };
};

window.setLsTokens = (accessToken, refreshToken, expiresIn) => {
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    if (accessToken) localStorage.setItem(vid + '_lsAccessToken', accessToken);
    if (refreshToken) localStorage.setItem(vid + '_lsRefreshToken', refreshToken);
    if (expiresIn) localStorage.setItem(vid + '_lsTokenExpiry', String(Date.now() + (expiresIn * 1000) - 60000)); // -1min safety
};

window.isLsConnected = () => {
    const c = window.getLsCredentials();
    return !!(c.clientId && c.clientSecret && c.accessToken && c.companyId && c.siteId);
};

window.isLsTokenExpired = () => {
    const c = window.getLsCredentials();
    return !c.tokenExpiry || Date.now() >= c.tokenExpiry;
};

// =============================================================================
// 2. TOKEN MANAGEMENT — auto-refresh on expiry
// =============================================================================
window._lsRefreshing = null;

window.refreshLsToken = async () => {
    if (window._lsRefreshing) return window._lsRefreshing; // dedupe concurrent calls
    const creds = window.getLsCredentials();
    if (!creds.refreshToken || !creds.clientId || !creds.clientSecret) return false;

    window._lsRefreshing = (async () => {
        try {
            const res = await fetch(window.LS_CLOUD_FN_BASE + '/lightspeedRefresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    refresh_token: creds.refreshToken,
                    client_id: creds.clientId,
                    client_secret: creds.clientSecret
                })
            });
            const data = await res.json();
            if (!res.ok) {
                console.error('Token refresh failed:', data);
                return false;
            }
            window.setLsTokens(data.access_token, data.refresh_token || creds.refreshToken, data.expires_in);
            return true;
        } catch (e) {
            console.error('Token refresh error:', e);
            return false;
        } finally {
            window._lsRefreshing = null;
        }
    })();
    return window._lsRefreshing;
};

// =============================================================================
// 3. API FETCH WRAPPER — calls Cloud Function proxy (solves CORS)
// =============================================================================

window.fetchKounta = async (endpoint) => {
    let creds = window.getLsCredentials();
    if (!creds.accessToken) return null;
    if (!navigator.onLine) return null;

    // Auto-refresh if token expired
    if (window.isLsTokenExpired()) {
        const ok = await window.refreshLsToken();
        if (!ok) return null;
        creds = window.getLsCredentials();
    }

    // Normalise path — accept both "companies/me" and "companies/me.json"
    const path = endpoint.startsWith('http') ? endpoint : (endpoint.includes('.json') ? endpoint : endpoint + '.json');

    const callProxy = async (token) => {
        return fetch(window.LS_CLOUD_FN_BASE + '/lightspeedProxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: token, path: path })
        });
    };

    try {
        let res = await callProxy(creds.accessToken);
        let result = await res.json();

        // 401 from Kounta → token may have expired between our check and the call. Refresh + retry once.
        if (result && result.status === 401) {
            const refreshed = await window.refreshLsToken();
            if (!refreshed) return null;
            const newCreds = window.getLsCredentials();
            res = await callProxy(newCreds.accessToken);
            result = await res.json();
        }

        if (!result || !result.ok) {
            if (result && result.status === 429) {
                // Rate limited — wait and retry once
                await new Promise(r => setTimeout(r, 2000));
                res = await callProxy(window.getLsCredentials().accessToken);
                result = await res.json();
                if (!result || !result.ok) return null;
            } else {
                console.error('Kounta API call failed:', result);
                return null;
            }
        }

        // Mimic the original {data, headers} shape so existing callers keep working
        const headersGet = (key) => {
            if (!result.headers) return null;
            return result.headers.x_next_page || result.headers[key.toLowerCase().replace(/-/g, '_')] || null;
        };
        return {
            data: result.data,
            headers: { get: headersGet }
        };
    } catch (e) {
        console.error('Kounta proxy error:', e);
        return null;
    }
};

// Paginated fetch — follows X-Next-Page cursor, accumulates all pages
window.fetchKountaAll = async (endpoint) => {
    var allResults = [];
    var url = endpoint;
    var maxPages = 200; // safety cap (5000 orders max — handles ~30 days at busy venue)
    var page = 0;
    while (url && page < maxPages) {
        var result = await window.fetchKounta(url);
        if (!result) break;
        var data = Array.isArray(result.data) ? result.data : [];
        if (data.length === 0) break;
        allResults = allResults.concat(data);
        // Stash a sample of the first order for debugging
        if (page === 0 && allResults.length > 0 && !window._lsLastSampleOrder) {
            window._lsLastSampleOrder = allResults[0];
        }
        var nextPage = result.headers ? result.headers.get('X-Next-Page') : null;
        url = nextPage || null;
        page++;
    }
    return allResults;
};

// =============================================================================
// 3. CONNECTION TEST & SITE DISCOVERY
// =============================================================================

window.lsTestConnection = async () => {
    // Step 1: Verify credentials via /v1/companies/me
    var result = await window.fetchKounta('companies/me');
    if (!result || !result.data) {
        return { ok: false, error: 'Invalid credentials or API unreachable. Check your Client ID and Secret.' };
    }

    var company = result.data;
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsCompanyId', company.id);

    // Step 2: Fetch sites for this company
    var sitesResult = await window.fetchKounta('companies/' + company.id + '/sites');
    if (!sitesResult || !sitesResult.data) {
        return { ok: false, error: 'Connected but could not fetch sites.' };
    }

    var sites = Array.isArray(sitesResult.data) ? sitesResult.data : [];
    return { ok: true, company: company, sites: sites };
};

// =============================================================================
// 4. SALES PULL
// =============================================================================

// Pull completed orders since last pull (or given date). Aggregates product quantities.
// Returns { salesItems: [{rawName, qtySold}], orderCount, revenue } or null on failure.
window.lsPullSales = async (dateFrom) => {
    var creds = window.getLsCredentials();
    if (!creds.companyId || !creds.siteId) return null;

    // Default: pull since last pull date, or today
    if (!dateFrom) {
        dateFrom = creds.lastPull ? creds.lastPull.split('T')[0] : window._isoDate();
    }

    var endpoint = 'companies/' + creds.companyId + '/sites/' + creds.siteId +
        '/orders/complete.json?created_gte=' + dateFrom;
    var orders = await window.fetchKountaAll(endpoint);

    if (!orders || orders.length === 0) {
        window._lightspeedData = window._lightspeedData || {};
        window._lightspeedData.lastUpdated = window._isoTime();
        return { salesItems: [], orderCount: 0, revenue: 0 };
    }

    // Aggregate product quantities across all orders + daily revenue + daily covers
    var productMap = {}; // productName -> { qtySold, revenue }
    var dailyMap = {}; // YYYY-MM-DD -> { revenue, orderCount, covers }
    var totalRevenue = 0;

    // Helpers: handle Kounta's varied field naming
    var pickDate = function(o) {
        return (o.completed_at || o.created_at || o.updated_at || o.payment_taken_at || o.date || '').toString().substring(0, 10);
    };
    var pickOrderTotal = function(o) {
        // Try order-level totals first (more reliable than summing lines)
        return Number(o.amount || o.total || o.subtotal || o.amount_total || o.gross || 0) || 0;
    };
    var pickCovers = function(o) {
        return Number(o.cover_count || o.covers || o.guest_count || o.pax || 0) || 0;
    };
    var pickLineQty = function(l) {
        return Math.abs(Number(l.quantity || l.qty || 1));
    };
    var pickLinePrice = function(l) {
        // Try unit_price first, then derive from amount/quantity if missing
        if (l.unit_price != null) return Number(l.unit_price);
        if (l.price != null) return Number(l.price);
        if (l.amount != null && l.quantity) return Number(l.amount) / Math.abs(Number(l.quantity)) || 0;
        return 0;
    };
    var pickLineName = function(l) {
        return (l.product && l.product.name) || l.product_name || l.name || l.title || '';
    };
    var getLines = function(o) {
        return o.lines || o.order_lines || o.items || o.products || [];
    };

    orders.forEach(function(order) {
        var orderDate = pickDate(order);
        var orderTotal = pickOrderTotal(order);

        if (orderDate) {
            if (!dailyMap[orderDate]) dailyMap[orderDate] = { revenue: 0, orderCount: 0, covers: 0 };
            dailyMap[orderDate].orderCount++;
            dailyMap[orderDate].covers += pickCovers(order);
            // Use order-level total for daily revenue (most reliable)
            dailyMap[orderDate].revenue += orderTotal;
        }
        totalRevenue += orderTotal;

        // Line-level aggregation for product depletion (best-effort — may be empty if API returns summaries only)
        var lines = getLines(order);
        lines.forEach(function(line) {
            var name = pickLineName(line);
            var qty = pickLineQty(line);
            var price = pickLinePrice(line);
            if (!name || qty <= 0) return;

            if (!productMap[name]) productMap[name] = { qtySold: 0, revenue: 0 };
            productMap[name].qtySold += qty;
            productMap[name].revenue += qty * price;
        });
    });

    // Push daily aggregates into salesData[] using lsRevenue/lsCovers fields
    // (separate from manual `total`/`covers` so manual entries never get overwritten)
    if (window.lsUpdateSalesData) window.lsUpdateSalesData(dailyMap);

    var salesItems = Object.entries(productMap).map(function(entry) {
        return { rawName: entry[0], qtySold: entry[1].qtySold };
    });

    // Update last pull timestamp
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsLastPull', window._isoNow());

    // Log the pull
    if (!window.lsApiPullLog) window.lsApiPullLog = [];
    window.lsApiPullLog.push({
        date: window._isoDate(),
        time: window._isoTime(),
        orderCount: orders.length,
        revenue: totalRevenue,
        itemCount: salesItems.length,
        source: 'api-pull'
    });
    // Keep last 100 pull logs
    if (window.lsApiPullLog.length > 100) window.lsApiPullLog = window.lsApiPullLog.slice(-100);

    // Update runtime data
    window._lightspeedData = {
        companyId: creds.companyId,
        siteName: creds.siteName,
        lastPull: window._isoTime(),
        lastUpdated: window._isoTime(),
        orderCount: orders.length,
        totalRevenue: totalRevenue,
        productCount: salesItems.length
    };

    window.saveToDisk();
    return { salesItems: salesItems, orderCount: orders.length, revenue: totalRevenue };
};

// =============================================================================
// 5. AUTO-SYNC TIMER
// =============================================================================

window._lsAutoInterval = null;

window.startLsAutoRefresh = () => {
    window.stopLsAutoRefresh();
    // Poll every 15 minutes for new completed orders
    window._lsAutoInterval = setInterval(async () => {
        if (document.hidden || !navigator.onLine || !window.isLsConnected()) return;
        try {
            var result = await window.lsPullSales();
            if (result && result.salesItems.length > 0) {
                window._pendingApiSalesItems = result.salesItems;
                window.showToast('Lightspeed: ' + result.orderCount + ' order' + (result.orderCount !== 1 ? 's' : '') + ' found (' + result.salesItems.length + ' products). Review in Lightspeed settings.');
            }
        } catch (e) {
            console.error('Lightspeed auto-sync error:', e);
        }
    }, 15 * 60 * 1000);
};

window.stopLsAutoRefresh = () => {
    if (window._lsAutoInterval) {
        clearInterval(window._lsAutoInterval);
        window._lsAutoInterval = null;
    }
};

// =============================================================================
// 6. DEPLETION BRIDGE
// =============================================================================

// Feed sales data into the existing unified depletion confirmation pipeline
window.lsRunDepletion = (salesItems) => {
    if (!salesItems || salesItems.length === 0) {
        return window.showToast('No sales items to deplete.', 'error');
    }
    window.showDepletionConfirmation(salesItems, 'api-depletion');
};

// Pull + deplete in one action (settings modal button)
window.lsPullAndDeplete = async () => {
    window.showLoadingOverlay('Pulling sales from Lightspeed...');
    try {
        var result = await window.lsPullSales();
        window.hideLoadingOverlay();

        if (!result) {
            return window.showToast('Failed to connect to Lightspeed. Check credentials.', 'error');
        }
        if (result.salesItems.length === 0) {
            return window.showToast('No new orders found since last pull.');
        }

        window.showToast(result.orderCount + ' order' + (result.orderCount !== 1 ? 's' : '') + ', ' + result.salesItems.length + ' products found.');
        window.lsRunDepletion(result.salesItems);
    } catch (e) {
        window.hideLoadingOverlay();
        window.showToast('Lightspeed pull failed: ' + e.message, 'error');
    }
};

// Deplete from previously auto-synced pending items
window.lsDepletePending = () => {
    if (window._pendingApiSalesItems && window._pendingApiSalesItems.length > 0) {
        window.lsRunDepletion(window._pendingApiSalesItems);
        window._pendingApiSalesItems = null;
    } else {
        window.showToast('No pending sales data. Try pulling fresh data first.');
    }
};

// =============================================================================
// 7. SETTINGS MODAL
// =============================================================================

window.openLightspeedSettings = () => {
    var creds = window.getLsCredentials();
    var connected = window.isLsConnected();
    var ld = window._lightspeedData;
    var pending = window._pendingApiSalesItems;
    var E = window.esc;

    var statusDot = connected ? '🟢' : '🔴';
    var statusText = connected ? 'Connected' : 'Not Connected';

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);">' +
        '<span style="font-size:20px;">' + statusDot + '</span>' +
        '<div style="flex:1;">' +
            '<div style="font-weight:600;font-size:14px;">' + statusText + '</div>' +
            (connected ? '<div style="font-size:11px;color:var(--text-muted);">Site: ' + E(creds.siteName || 'Unknown') +
                (ld ? ' · Last sync: ' + (ld.lastUpdated || '—') : '') + '</div>' : '') +
        '</div>' +
        (connected ? '<span style="font-size:10px;padding:3px 8px;border-radius:12px;background:rgba(16,185,129,0.1);color:var(--green);border:1px solid rgba(16,185,129,0.2);">Auto-sync: 15min</span>' : '') +
    '</div>';

    // Credential inputs (only shown if not yet connected, OR for re-entry)
    if (!connected) {
        html += '<div style="margin-bottom:12px;padding:12px;background:rgba(59,130,246,0.05);border-left:4px solid var(--blue);border-radius:6px;font-size:12px;color:var(--text-muted);">' +
            '<strong style="color:var(--blue);">How OAuth works:</strong> Enter your Client ID + Secret below. Click "Connect with Lightspeed" → you\'ll be sent to Lightspeed to log in and approve → automatically returned here.' +
        '</div>';
    }
    html += '<div style="margin-bottom:12px;">' +
        '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Client ID</label>' +
        '<input type="text" id="ls-client-id" class="input-box" value="' + E(creds.clientId) + '" placeholder="From Lightspeed Back Office → Integrations" style="margin-bottom:8px;">' +
        '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Client Secret</label>' +
        '<input type="password" id="ls-client-secret" class="input-box" value="' + E(creds.clientSecret) + '" placeholder="From the same Integrations page (only shown once on creation)">' +
    '</div>';

    if (!connected) {
        html += '<button onclick="window.startLsOAuth()" class="btn btn-green" style="width:100%;margin-bottom:8px;font-size:14px;padding:12px;">🔗 Connect with Lightspeed</button>';
    } else {
        html += '<button onclick="window.startLsOAuth()" class="btn btn-outline" style="width:100%;margin-bottom:8px;font-size:12px;">🔄 Re-authenticate (use if connection breaks)</button>';
    }

    if (connected) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
            '<button onclick="window.lsPullAndDeplete()" class="btn btn-blue" style="font-size:12px;">📥 Pull & Deplete</button>' +
            '<button onclick="window.showLoadingOverlay(\'Refreshing...\');window.lsPullSales().then(function(){window.hideLoadingOverlay();window.openLightspeedSettings();})" class="btn btn-outline" style="font-size:12px;">🔄 Refresh Data</button>' +
        '</div>';
        // Prominent "Sync Recent" button — pulls full days for dashboard
        html += '<button onclick="window.showLoadingOverlay(\'Syncing last 7 days from Lightspeed...\');window.lsSyncRecentDays(7).then(function(r){window.hideLoadingOverlay();if(r){window.showToast(\'Synced \'+r.orderCount+\' orders, $\'+(r.revenue||0).toFixed(0)+\' revenue.\');}window.openLightspeedSettings();})" class="btn btn-green" style="width:100%;font-size:13px;margin-bottom:12px;">⚡ Sync Last 7 Days into Dashboard</button>';

        // Recent days' POS data status
        var recentDays = (window.salesData || []).filter(function(s) { return s.lsRevenue || s.lsCovers; }).slice(-7).reverse();
        if (recentDays.length > 0) {
            html += '<div style="border-top:1px solid var(--border);padding-top:10px;margin-bottom:12px;">' +
                '<div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">⚡ Live POS Data</div>' +
                '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
                '<thead><tr style="text-align:left;border-bottom:1px solid var(--border);"><th style="padding:4px 6px;color:var(--text-muted);font-weight:600;">Date</th><th style="padding:4px 6px;color:var(--text-muted);font-weight:600;">Orders</th><th style="padding:4px 6px;color:var(--text-muted);font-weight:600;text-align:right;">Revenue</th></tr></thead><tbody>';
            recentDays.forEach(function(d) {
                html += '<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:4px 6px;">' + E(d.date) + '</td><td style="padding:4px 6px;">' + (d.lsOrderCount || 0) + '</td><td style="padding:4px 6px;text-align:right;color:var(--green);font-weight:600;">$' + (d.lsRevenue || 0).toLocaleString('en-AU',{maximumFractionDigits:0}) + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        // Pending data alert
        if (pending && pending.length > 0) {
            html += '<div class="card" style="border-left:4px solid var(--orange);padding:10px 14px;margin-bottom:12px;">' +
                '<div style="font-size:13px;font-weight:600;color:var(--orange);margin-bottom:4px;">📦 ' + pending.length + ' products pending depletion</div>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">From auto-sync. Review and confirm stock deductions.</div>' +
                '<button onclick="window.closeModal();window.lsDepletePending()" class="btn btn-orange" style="font-size:12px;width:100%;">Review & Deplete</button>' +
            '</div>';
        }

        // Data summary
        if (ld) {
            html += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">' +
                '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Last Pull Summary</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;">' +
                    '<div style="color:var(--text-muted);">Orders: <strong style="color:var(--text-main);">' + (ld.orderCount || 0) + '</strong></div>' +
                    '<div style="color:var(--text-muted);">Products: <strong style="color:var(--text-main);">' + (ld.productCount || 0) + '</strong></div>' +
                    '<div style="color:var(--text-muted);">Revenue: <strong style="color:var(--green);">$' + (ld.totalRevenue || 0).toFixed(0) + '</strong></div>' +
                    '<div style="color:var(--text-muted);">Pulled at: <strong style="color:var(--text-main);">' + (ld.lastPull || '—') + '</strong></div>' +
                '</div>' +
            '</div>';
        }

        // Debug section
        html += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">' +
            '<button onclick="window.lsShowSampleOrder()" class="btn btn-outline" style="width:100%;font-size:11px;margin-bottom:6px;">🔬 Debug: Show Sample Order JSON</button>' +
            '<button onclick="window.lsDisconnect()" class="btn btn-outline" style="width:100%;font-size:11px;color:var(--text-muted);">Disconnect Lightspeed</button>' +
        '</div>';
    }

    // Help text
    html += '<div style="margin-top:12px;padding:10px;background:var(--bg-main);border-radius:6px;border:1px solid var(--border);font-size:11px;color:var(--text-muted);">' +
        'Get your Client ID and Secret from <a href="https://my.kounta.com" target="_blank" style="color:var(--blue);">my.kounta.com</a> → Add-ons section. ' +
        '<a href="https://apidoc.kounta.com" target="_blank" style="color:var(--blue);">API Docs ↗</a>' +
    '</div>';

    window.openModal('🛒 Lightspeed Integration', html);
};

// =============================================================================
// OAUTH FLOW — "Connect with Lightspeed" button
// =============================================================================
// 1. Save Client ID + Secret to localStorage (needed for token exchange later)
// 2. Generate random state for CSRF protection
// 3. Redirect to Lightspeed authorize URL
// 4. User logs in / approves → Lightspeed redirects back to our callback URL
// 5. Callback handler extracts code → exchanges for tokens via Cloud Function
// =============================================================================

window.startLsOAuth = () => {
    var clientId = document.getElementById('ls-client-id').value.trim();
    var clientSecret = document.getElementById('ls-client-secret').value.trim();
    if (!clientId || !clientSecret) return window.showToast('Both Client ID and Secret are required.', 'error');

    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsClientId', clientId);
    localStorage.setItem(vid + '_lsClientSecret', clientSecret);

    // Generate CSRF state — opaque random string
    var state = vid + '_' + Math.random().toString(36).substring(2, 18);
    sessionStorage.setItem('lsOAuthState', state);

    // Construct authorize URL
    var authUrl = 'https://my.kounta.com/authorize'
        + '?response_type=code'
        + '&client_id=' + encodeURIComponent(clientId)
        + '&redirect_uri=' + encodeURIComponent(window.LS_REDIRECT_URI)
        + '&state=' + encodeURIComponent(state);

    // Redirect — Lightspeed will bring us back to LS_REDIRECT_URI with ?code=xxx
    window.location.href = authUrl;
};

// Called when the page loads with ?code= in URL — completes the OAuth flow
window.handleLsOAuthCallback = async () => {
    var params = new URLSearchParams(window.location.search);
    var code = params.get('code');
    var state = params.get('state');
    var error = params.get('error');

    // Clear the URL so refresh doesn't re-trigger
    window.history.replaceState({}, document.title, window.location.pathname);

    if (error) {
        window.showToast('Lightspeed authorization failed: ' + error, 'error');
        return;
    }
    if (!code) return; // not an OAuth callback

    var savedState = sessionStorage.getItem('lsOAuthState');
    if (!state || state !== savedState) {
        window.showToast('OAuth state mismatch — possible CSRF. Please try connecting again.', 'error');
        return;
    }
    sessionStorage.removeItem('lsOAuthState');

    var creds = window.getLsCredentials();
    if (!creds.clientId || !creds.clientSecret) {
        window.showToast('Lightspeed credentials missing. Open Lightspeed API settings to retry.', 'error');
        return;
    }

    window.showLoadingOverlay('Completing Lightspeed connection...');

    try {
        var res = await fetch(window.LS_CLOUD_FN_BASE + '/lightspeedExchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: code,
                redirect_uri: window.LS_REDIRECT_URI,
                client_id: creds.clientId,
                client_secret: creds.clientSecret
            })
        });
        var data = await res.json();
        if (!res.ok) {
            window.hideLoadingOverlay();
            window.showToast('Token exchange failed: ' + (data.error || res.status), 'error');
            console.error('Token exchange failed:', data);
            return;
        }

        window.setLsTokens(data.access_token, data.refresh_token, data.expires_in);

        // Now discover company + sites
        var testResult = await window.lsTestConnection();
        window.hideLoadingOverlay();

        if (!testResult.ok) {
            window.showToast('Connection test failed: ' + testResult.error, 'error');
            return;
        }
        if (testResult.sites.length === 0) {
            window.showToast('Connected but no sites found.', 'error');
            return;
        }
        if (testResult.sites.length === 1) {
            var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
            localStorage.setItem(vid + '_lsSiteId', testResult.sites[0].id);
            localStorage.setItem(vid + '_lsSiteName', testResult.sites[0].name);
            window.showToast('Lightspeed connected! Site: ' + testResult.sites[0].name);
            window.startLsAutoRefresh();
            window.openLightspeedSettings();
        } else {
            window._lsOpenSitePicker(testResult.sites);
        }
    } catch (e) {
        window.hideLoadingOverlay();
        window.showToast('OAuth callback error: ' + e.message, 'error');
        console.error('OAuth callback error:', e);
    }
};

// Auto-trigger callback handler if URL contains ?code= on page load
if (typeof window !== 'undefined') {
    var __lsCheckCallback = function() {
        var params = new URLSearchParams(window.location.search);
        if (params.get('code') && params.get('state') && (params.get('state') || '').startsWith((window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi') + '_')) {
            // Wait for Hub to finish initial render
            setTimeout(function() { window.handleLsOAuthCallback(); }, 1500);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', __lsCheckCallback);
    } else {
        __lsCheckCallback();
    }
}

// Site picker for multi-site accounts
window._lsOpenSitePicker = (sites) => {
    var E = window.esc;
    var html = '<p style="font-size:13px;color:var(--text-muted);margin-bottom:15px;">Multiple sites found in your Kounta account. Select the site that corresponds to <strong>' + E(window._getVenueName()) + '</strong>:</p>';
    sites.forEach(function(s) {
        html += '<button onclick="window._lsSelectSite(' + s.id + ',\'' + E(s.name).replace(/'/g, "\\'") + '\')" class="btn btn-outline" style="width:100%;margin-bottom:8px;text-align:left;padding:12px 16px;">' +
            '<strong>' + E(s.name) + '</strong>' +
            (s.code ? ' <span style="font-size:11px;color:var(--text-muted);">(' + E(s.code) + ')</span>' : '') +
            ' <span style="font-size:11px;color:var(--text-muted);float:right;">ID: ' + s.id + '</span>' +
        '</button>';
    });
    window.openModal('Select Lightspeed Site', html);
};

window._lsSelectSite = (siteId, siteName) => {
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsSiteId', siteId);
    localStorage.setItem(vid + '_lsSiteName', siteName);
    window.closeModal();
    window.showToast('Lightspeed connected! Site: ' + siteName);
    window.startLsAutoRefresh();
};

// =============================================================================
// 8. SALES DATA BRIDGE — populate salesData[] with live POS revenue
// =============================================================================
// Mirrors the dual-field pattern from SevenRooms (coversBooked vs covers):
// - lsRevenue: live POS data (this) — never overwrites manual entry
// - total:     manual takings entry — owned by user, untouched by sync
// - lsCovers:  live POS data — separate from manual `covers`
//
// Dashboard prefers lsRevenue when available, falls back to manual total.
// =============================================================================

window.lsUpdateSalesData = (dailyMap) => {
    if (!dailyMap || Object.keys(dailyMap).length === 0) return 0;
    if (!window.salesData) window.salesData = [];
    var touched = 0;

    Object.entries(dailyMap).forEach(function(entry) {
        var isoDate = entry[0]; // YYYY-MM-DD
        var info = entry[1];
        // Normalise to DD/MM/YYYY (existing salesData convention)
        var parts = isoDate.split('-');
        var ddmmyyyy = parts[2] + '/' + parts[1] + '/' + parts[0];

        var idx = window.salesData.findIndex(function(s) { return s.date === ddmmyyyy; });
        if (idx >= 0) {
            window.salesData[idx].lsRevenue = Number(info.revenue.toFixed(2));
            window.salesData[idx].lsCovers = info.covers || 0;
            window.salesData[idx].lsOrderCount = info.orderCount;
            window.salesData[idx].lsLastSync = window._isoNow();
        } else {
            window.salesData.push({
                date: ddmmyyyy,
                total: 0,
                covers: 0,
                lsRevenue: Number(info.revenue.toFixed(2)),
                lsCovers: info.covers || 0,
                lsOrderCount: info.orderCount,
                lsLastSync: window._isoNow()
            });
        }
        touched++;
    });
    return touched;
};

// Pull yesterday + today (full-day sync — useful for dashboard)
window.lsSyncRecentDays = async (daysBack) => {
    var creds = window.getLsCredentials();
    if (!creds.companyId || !creds.siteId) return null;
    var d = new Date();
    d.setDate(d.getDate() - (daysBack || 1));
    var dateFrom = d.toISOString().split('T')[0];
    return await window.lsPullSales(dateFrom);
};

// =============================================================================
// 9. DAILY AUTO-SYNC — runs once per session, pulls last 2 days
// =============================================================================
window.lsAutoSyncOnLoad = async () => {
    if (!window.isLsConnected || !window.isLsConnected()) return;
    if (!navigator.onLine) return;
    // Only do this once per session
    if (window._lsLoadedThisSession) return;
    window._lsLoadedThisSession = true;
    try {
        await window.lsSyncRecentDays(2);
    } catch (e) {
        console.warn('Lightspeed auto-sync on load failed:', e);
    }
};

// Show sample order JSON for debugging Kounta's actual response shape
window.lsShowSampleOrder = () => {
    var sample = window._lsLastSampleOrder;
    if (!sample) {
        return window.openModal('🔬 No Sample Yet', '<p style="font-size:13px;color:var(--text-muted);">Run a sync first (click "⚡ Sync Last 7 Days into Dashboard" or "Refresh Data") to capture a sample order.</p>');
    }
    var fields = Object.keys(sample).map(function(k) {
        var v = sample[k];
        var type = Array.isArray(v) ? 'array[' + v.length + ']' : (v === null ? 'null' : typeof v);
        return '<div style="font-size:11px;padding:4px 8px;border-bottom:1px solid var(--border);"><strong>' + k + '</strong> <span style="color:var(--text-muted);">(' + type + ')</span></div>';
    }).join('');
    var json = JSON.stringify(sample, null, 2);
    var html = '<p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">First order from the most recent sync. Use this to verify field names.</p>' +
        '<details open style="margin-bottom:12px;"><summary style="cursor:pointer;font-size:12px;font-weight:600;">📋 Top-level fields</summary>' +
        '<div style="margin-top:8px;background:var(--bg-main);border-radius:6px;padding:6px;">' + fields + '</div></details>' +
        '<details><summary style="cursor:pointer;font-size:12px;font-weight:600;">📄 Full JSON (click to expand)</summary>' +
        '<pre style="font-size:10px;background:var(--bg-main);padding:10px;border-radius:6px;overflow:auto;max-height:400px;white-space:pre-wrap;word-break:break-all;">' + window.esc(json) + '</pre></details>' +
        '<button onclick="navigator.clipboard.writeText(' + JSON.stringify(json) + ').then(function(){window.showToast(\'Copied to clipboard\');})" class="btn btn-outline" style="width:100%;margin-top:10px;font-size:12px;">📋 Copy JSON to clipboard</button>';
    window.openModal('🔬 Sample Order JSON', html);
};

// Disconnect — clear all credentials
window.lsDisconnect = () => {
    window.confirmAction({
        title: 'Disconnect Lightspeed',
        message: 'This will remove your Lightspeed API credentials for this venue. You can reconnect at any time.',
        tier: 'dangerous',
        onConfirm: function() {
            var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
            localStorage.removeItem(vid + '_lsClientId');
            localStorage.removeItem(vid + '_lsClientSecret');
            localStorage.removeItem(vid + '_lsAccessToken');
            localStorage.removeItem(vid + '_lsRefreshToken');
            localStorage.removeItem(vid + '_lsTokenExpiry');
            localStorage.removeItem(vid + '_lsCompanyId');
            localStorage.removeItem(vid + '_lsSiteId');
            localStorage.removeItem(vid + '_lsSiteName');
            localStorage.removeItem(vid + '_lsLastPull');
            window.stopLsAutoRefresh();
            window._lightspeedData = null;
            window._pendingApiSalesItems = null;
            window.showToast('Lightspeed disconnected.');
            window.openLightspeedSettings();
        }
    });
};
