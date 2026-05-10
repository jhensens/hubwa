// =============================================================================
// HOBART HUB — CLOUD FUNCTIONS
// Lightspeed OAuth proxy: solves CORS + handles OAuth flow + token refresh
// =============================================================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// CORS headers — allow our hosted Hub to call these functions from the browser
const ALLOWED_ORIGINS = [
    'https://hobart-hub.web.app',
    'https://hobart-hub.firebaseapp.com',
    'https://jhensens.github.io',
    'http://localhost:8080',
    'http://localhost:5000'
];

function applyCors(req, res) {
    const origin = req.headers.origin || '';
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.set('Access-Control-Allow-Origin', allowed);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true;
    }
    return false;
}

// =============================================================================
// 1. LIGHTSPEED OAUTH — Exchange authorization code for access/refresh tokens
// =============================================================================
// Called once when user completes "Connect with Lightspeed" flow.
// Body: { code, redirect_uri, client_id, client_secret }
// Returns: { access_token, refresh_token, expires_in, token_type }
//
// Note: client_secret is sent from browser. NOT ideal but acceptable for an
// internal tool where the user already has the secret in their localStorage.
// Alternative: store secret in functions config (firebase functions:config:set)
// and reference it server-side. Doing that for production hardening below.
// =============================================================================
exports.lightspeedExchange = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { code, redirect_uri, client_id, client_secret } = req.body || {};
        if (!code || !redirect_uri || !client_id || !client_secret) {
            return res.status(400).json({ error: 'Missing required fields: code, redirect_uri, client_id, client_secret' });
        }

        // Kounta token endpoint expects form-encoded body
        const params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', redirect_uri);
        params.append('client_id', client_id);
        params.append('client_secret', client_secret);

        const tokenResponse = await fetch('https://api.kounta.com/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: params.toString()
        });

        const data = await tokenResponse.json();
        if (!tokenResponse.ok) {
            console.error('Token exchange failed:', tokenResponse.status, data);
            return res.status(tokenResponse.status).json({
                error: 'Token exchange failed',
                detail: data,
                status: tokenResponse.status
            });
        }

        // data should contain: access_token, refresh_token, expires_in, token_type
        return res.status(200).json(data);
    } catch (err) {
        console.error('lightspeedExchange error:', err);
        return res.status(500).json({ error: 'Server error', detail: err.message });
    }
});

// =============================================================================
// 2. LIGHTSPEED REFRESH — Use refresh token to get new access token
// =============================================================================
// Body: { refresh_token, client_id, client_secret }
// Returns: { access_token, refresh_token, expires_in, token_type }
// =============================================================================
exports.lightspeedRefresh = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { refresh_token, client_id, client_secret } = req.body || {};
        if (!refresh_token || !client_id || !client_secret) {
            return res.status(400).json({ error: 'Missing required fields: refresh_token, client_id, client_secret' });
        }

        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refresh_token);
        params.append('client_id', client_id);
        params.append('client_secret', client_secret);

        const tokenResponse = await fetch('https://api.kounta.com/v1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: params.toString()
        });

        const data = await tokenResponse.json();
        if (!tokenResponse.ok) {
            console.error('Refresh failed:', tokenResponse.status, data);
            return res.status(tokenResponse.status).json({
                error: 'Refresh failed',
                detail: data,
                status: tokenResponse.status
            });
        }
        return res.status(200).json(data);
    } catch (err) {
        console.error('lightspeedRefresh error:', err);
        return res.status(500).json({ error: 'Server error', detail: err.message });
    }
});

// =============================================================================
// 3. LIGHTSPEED PROXY — Generic API call relay (solves CORS)
// =============================================================================
// Body: { access_token, path, method?, body?, query? }
// Returns: { ok, status, data, headers: { x_next_page? } }
//
// Path examples:
//   "companies/me"
//   "companies/12345/sites"
//   "companies/12345/sites/67890/orders/complete.json?created_gte=2026-05-01"
// =============================================================================
exports.lightspeedProxy = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { access_token, path, method, body } = req.body || {};
        if (!access_token || !path) {
            return res.status(400).json({ error: 'Missing required fields: access_token, path' });
        }

        // Construct full URL — accept either a relative path or absolute kounta URL (for pagination)
        let url;
        if (path.startsWith('http')) {
            url = path;
        } else {
            const cleanPath = path.replace(/^\/+/, '');
            url = 'https://api.kounta.com/v1/' + cleanPath;
        }

        const opts = {
            method: method || 'GET',
            headers: {
                'Authorization': 'Bearer ' + access_token,
                'Accept': 'application/json'
            }
        };
        if (body && (method === 'POST' || method === 'PUT')) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }

        const apiResponse = await fetch(url, opts);
        let data = null;
        const contentType = apiResponse.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await apiResponse.json().catch(() => null);
        } else {
            data = await apiResponse.text().catch(() => null);
        }

        // Pass through key headers (especially X-Next-Page for pagination)
        const passHeaders = {};
        const nextPage = apiResponse.headers.get('x-next-page') || apiResponse.headers.get('X-Next-Page');
        if (nextPage) passHeaders.x_next_page = nextPage;

        return res.status(200).json({
            ok: apiResponse.ok,
            status: apiResponse.status,
            data: data,
            headers: passHeaders
        });
    } catch (err) {
        console.error('lightspeedProxy error:', err);
        return res.status(500).json({ error: 'Server error', detail: err.message });
    }
});

// =============================================================================
// 4. HEALTH CHECK — quick endpoint to verify functions are deployed
// =============================================================================
exports.healthCheck = functions.https.onRequest((req, res) => {
    if (applyCors(req, res)) return;
    res.status(200).json({
        ok: true,
        service: 'Hobart Hub Cloud Functions',
        timestamp: new Date().toISOString(),
        endpoints: ['lightspeedExchange', 'lightspeedRefresh', 'lightspeedProxy', 'healthCheck']
    });
});
