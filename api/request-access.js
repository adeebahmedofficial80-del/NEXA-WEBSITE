// Vercel Serverless Function: POST /api/request-access

const rateLimitMap = new Map();

function checkRateLimit(ip) {
    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const maxRequests = 5;

    const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) {
        record.count = 0;
        record.resetAt = now + windowMs;
    }
    record.count++;
    rateLimitMap.set(ip, record);
    return record.count <= maxRequests;
}

function sanitizeInput(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>'"&]/g, '').trim();
}

module.exports = async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please wait a few minutes before trying again.'
        });
    }

    try {
        const data = req.body || {};

        // 1. Honeypot check
        if (data.website || data.hp_check) {
            return res.status(200).json({ success: true, message: 'Request received.' });
        }

        // 2. Submission speed check (bot protection)
        const elapsed = Date.now() - (parseInt(data.renderTime, 10) || 0);
        if (data.renderTime && elapsed < 800) {
            return res.status(400).json({ success: false, error: 'Suspiciously rapid submission.' });
        }

        // 3. Validation
        const fullName = sanitizeInput(data.name || '');
        const email = sanitizeInput(data.email || '').toLowerCase();
        const useCase = sanitizeInput(data.useCase || 'Personal');
        const tier = sanitizeInput(data.tier || 'Nexa Plus');

        if (!fullName || fullName.length < 2 || fullName.length > 80) {
            return res.status(400).json({ success: false, error: 'Please enter a valid name (2-80 characters).' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email) || email.length > 120) {
            return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
        }

        const refId = 'nx_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

        return res.status(200).json({
            success: true,
            message: 'Your spot in the Nexa early access program has been reserved.',
            ref: refId
        });
    } catch (err) {
        return res.status(400).json({ success: false, error: 'Invalid submission data.' });
    }
};
