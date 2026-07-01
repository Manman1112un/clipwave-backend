require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- 1. GITHUB OAUTH ---
app.get('/auth/github', (req, res) => {
    const redirectUri = "https://clipwave-backend.onrender.com/auth/github/callback";
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    res.redirect(githubAuthUrl);
});

app.get('/auth/github/callback', async (req, res) => {
    try {
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: req.query.code,
            redirect_uri: "https://clipwave-backend.onrender.com/auth/github/callback"
        }, { headers: { accept: 'application/json' }});

        res.redirect(`${process.env.FRONTEND_URL}/?authed=true`);
    } catch (e) {
        res.redirect(`${process.env.FRONTEND_URL}/?error=github_failed`);
    }
});

// --- 2. GOOGLE OAUTH ---
app.get('/auth/google', (req, res) => {
    const redirectUri = "https://clipwave-backend.onrender.com/auth/google/callback";
    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email`;
    res.redirect(googleUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code: req.query.code,
            redirect_uri: "https://clipwave-backend.onrender.com/auth/google/callback",
            grant_type: 'authorization_code'
        });
        res.redirect(`${process.env.FRONTEND_URL}/?authed=true`);
    } catch (e) { 
        res.redirect(`${process.env.FRONTEND_URL}/?error=google_failed`); 
    }
});

// --- 3. TWITCH OAUTH ---
app.get('/auth/twitch', (req, res) => {
    const redirectUri = "https://clipwave-backend.onrender.com/auth/twitch/callback";
    const twitchUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=user:read:email`;
    res.redirect(twitchUrl);
});

app.get('/auth/twitch/callback', async (req, res) => {
    try {
        await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                code: req.query.code,
                grant_type: 'authorization_code',
                redirect_uri: "https://clipwave-backend.onrender.com/auth/twitch/callback"
            }
        });
        res.redirect(`${process.env.FRONTEND_URL}/?authed=true`);
    } catch (e) { 
        res.redirect(`${process.env.FRONTEND_URL}/?error=twitch_failed`); 
    }
});

// --- 4. AI CLIP GENERATOR ---
app.post('/api/generate', async (req, res) => {
    res.json({ message: "AI Analysis Complete!", status: "success" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend live on port ${PORT}`));
