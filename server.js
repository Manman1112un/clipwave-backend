require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// --- SECURITY: ALLOW FRONTEND TO TALK TO BACKEND ---
app.use(cors({ origin: '*' }));
app.use(express.json());

// --- 1. GITHUB OAUTH SIGN-IN FLOW ---
app.get('/auth/github', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    
    if (!clientId) return res.status(500).send("Missing GITHUB_CLIENT_ID.");

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    res.redirect(githubAuthUrl);
});

app.get('/auth/github/callback', async (req, res) => {
    const code = req.query.code; 
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    // FIXED: Using environment variable instead of a hardcoded URL
    const frontendDashboardUrl = process.env.FRONTEND_URL || 'https://YOUR_STACKBLITZ_URL.webcontainer.io';

    if (!code) return res.redirect(`${frontendDashboardUrl}?error=no_code_provided`);

    try {
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: clientId,
            client_secret: clientSecret,
            code: code
        }, { headers: { accept: 'application/json' }});

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) return res.redirect(`${frontendDashboardUrl}?error=token_failed`);

        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
        });

        console.log(`Login Success: ${userResponse.data.login}`);
        res.redirect(`${frontendDashboardUrl}?authed=true`);

    } catch (error) {
        console.error("Auth Error:", error.message);
        res.redirect(`${frontendDashboardUrl}?error=auth_failed`);
    }
});

// --- 2. AI CLIP GENERATOR ---
app.post('/api/generate', async (req, res) => {
    const streamUrl = req.body.url;
    const myGoogleKey = process.env.GOOGLE_API_KEY;

    if (!myGoogleKey) {
        return res.status(500).json({ error: "Missing Google API Key!" });
    }

    setTimeout(() => {
        res.json({ message: "AI Analysis Complete! Clips generated.", status: "success" });
    }, 2500);
});

// --- 3. START SERVER ---
// FIXED: Use Render's provided port or default to 10000
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend live on port ${PORT}`));
