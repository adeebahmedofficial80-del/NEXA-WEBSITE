const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8080;
const WEB_IMAGES_DIR = path.resolve(__dirname); // e:\web-images
const PARENT_DIR = path.resolve(__dirname, '..'); // e:\

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

// Security Headers Definition
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self' 'unsafe-inline' https: data: blob:; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https:; frame-ancestors 'none';"
};

// In-Memory Rate Limiter & Submissions Storage
const rateLimitMap = new Map();
const accessSubmissions = [];

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const maxRequests = 5;

    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + windowMs;
        rateLimitMap.set(ip, record);
        return true;
    }

    if (record.count >= maxRequests) {
        return false;
    }

    record.count += 1;
    rateLimitMap.set(ip, record);
    return true;
}

function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>'"&]/g, '').trim();
}

const server = http.createServer((req, res) => {
    // Apply standard security headers
    for (const [header, val] of Object.entries(SECURITY_HEADERS)) {
        res.setHeader(header, val);
    }

    // HTTPS enforcement check for reverse proxies
    if (req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === 'http') {
        res.writeHead(301, {
            'Location': `https://${req.headers.host}${req.url}`,
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
        });
        res.end();
        return;
    }

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // ============================================================
    // API ENDPOINT: POST /api/request-access
    // ============================================================
    if ((pathname === '/api/request-access' || pathname === '/web-images/api/request-access') && req.method === 'POST') {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

        if (!checkRateLimit(clientIp)) {
            res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
                success: false,
                error: 'Too many requests. Please wait a few minutes before trying again.'
            }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 10240) { // 10KB limit
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Payload too large.' }));
                req.destroy();
            }
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');

                // 1. Honeypot check (hidden website/company field)
                if (data.website || data.hp_check) {
                    // Silently accept without saving to mislead bot
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true, message: 'Request received.' }));
                    return;
                }

                // 2. Submission speed check (bot protection)
                const elapsed = Date.now() - (parseInt(data.renderTime, 10) || 0);
                if (data.renderTime && elapsed < 800) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Suspiciously rapid submission.' }));
                    return;
                }

                // 3. Validation & Sanitization
                const fullName = sanitizeInput(data.name || '');
                const email = sanitizeInput(data.email || '').toLowerCase();
                const useCase = sanitizeInput(data.useCase || 'Personal');
                const tier = sanitizeInput(data.tier || 'Nexa Plus');

                if (!fullName || fullName.length < 2 || fullName.length > 80) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Please enter a valid name (2-80 characters).' }));
                    return;
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!email || !emailRegex.test(email) || email.length > 120) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: 'Please enter a valid email address.' }));
                    return;
                }

                // 4. Record submission
                const record = {
                    id: 'nx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
                    name: fullName,
                    email: email,
                    useCase: useCase,
                    tier: tier,
                    timestamp: new Date().toISOString()
                };
                accessSubmissions.push(record);

                console.log(`[NEXA API] Early access registered: ${email} (${tier})`);

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'Your spot in the Nexa early access program has been reserved.',
                    ref: record.id
                }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: false, error: 'Invalid submission data.' }));
            }
        });
        return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }

    // ============================================================
    // ROUTE ALIASES & REWRITING
    // ============================================================
    // Clean legal page routes
    if (pathname === '/privacy-policy' || pathname === '/privacy' || pathname === '/web-images/privacy-policy') {
        pathname = '/web-images/privacy.html';
    } else if (pathname === '/terms-and-conditions' || pathname === '/terms' || pathname === '/web-images/terms-and-conditions') {
        pathname = '/web-images/terms.html';
    } else if (pathname === '/' || pathname === '') {
        pathname = '/web-images/index.html';
    }

    // Resolve file path
    let filePath;
    if (pathname.startsWith('/web-images/')) {
        const rel = pathname.slice('/web-images/'.length);
        filePath = path.join(WEB_IMAGES_DIR, rel);
    } else {
        const localInWebImages = path.join(WEB_IMAGES_DIR, pathname);
        if (fs.existsSync(localInWebImages)) {
            filePath = localInWebImages;
        } else {
            filePath = path.join(PARENT_DIR, pathname);
        }
    }

    // If directory requested, append index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end(`404 Not Found: ${pathname}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const totalSize = stats.size;
        const range = req.headers.range;

        // Video and audio range requests
        if (range && (ext === '.mp4' || ext === '.mp3')) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

            if (start >= totalSize || end >= totalSize) {
                res.writeHead(416, { 'Content-Range': `bytes */${totalSize}` });
                res.end();
                return;
            }

            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            });

            if (req.method === 'HEAD') {
                res.end();
                return;
            }

            const stream = fs.createReadStream(filePath, { start, end });
            stream.pipe(res);
            return;
        }

        const headers = {
            'Content-Type': contentType,
            'Content-Length': totalSize,
            'Accept-Ranges': 'bytes'
        };

        if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.svg' || ext === '.woff2') {
            headers['Cache-Control'] = 'public, max-age=86400';
        } else {
            headers['Cache-Control'] = 'no-cache';
        }

        res.writeHead(200, headers);

        if (req.method === 'HEAD') {
            res.end();
            return;
        }

        const stream = fs.createReadStream(filePath);
        stream.on('error', () => {
            if (!res.headersSent) {
                res.writeHead(500);
            }
            res.end();
        });
        stream.pipe(res);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[NEXA] High-Performance Server running at http://localhost:${PORT}/web-images/index.html`);
    console.log(`[NEXA] Listening on http://127.0.0.1:${PORT}`);
});
