require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- GITHUB OAUTH ---
app.get('/auth/github', (req, res) => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GITHUB_REDIRECT_URI)}&scope=user:email`;
    res.redirect(githubAuthUrl);
});

app.get('/auth/github/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code
        }, { headers: { accept: 'application/json' }});

        const userRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${tokenRes.data.access_token}` }
        });
        
        console.log(`GitHub Login: ${userRes.data.login}`);
        res.redirect(`${process.env.FRONTEND_URL}/?authed=true`);
    } catch (e) {
        res.redirect(`${process.env.FRONTEND_URL}/?error=github_failed`);
    }
});

// --- GOOGLE OAUTH ---
app.get('/auth/google', (req, res) => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.GOOGLE_REDIRECT_URI)}&response_type=code&scope=profile email`;
    res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            code: req.query.code,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code'
        });
        res.redirect(`${process.env.FRONTEND_URL}/?authed=true`);
    } catch (e) { res.redirect(`${process.env.FRONTEND_URL}/?error=google_failed`); }
});

// --- TWITCH OAUTH ---
app.get('/auth/twitch', (req, res) => {
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${process.env.TWITCH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.TWITCH_REDIRECT_URI)}&response_type=code&scope=user:read:email`;
    res.redirect(url);
});

app.get('/auth/twitch/callback', async (req, res) => {
    try {
        const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
                client_id: process.env.TWITCH_CLIENT_ID,
                client_secret: process.env.TWITCH_CLIENT_SECRET,
                code: req.query.code,
                grant_type: 'authorization_code',
                redirect_uri: process.env.TWITCH_REDIRECT_URI
            }
        });
        res.redirect(`${process.env.FRONTEND_URL}/?authed=true`);
    } catch (e) { res.redirect(`${process.env.FRONTEND_URL}/?error=twitch_failed`); }
});

// --- AI CLIP GENERATOR ---
app.post('/api/generate', async (req, res) => {
    setTimeout(() => {
        res.json({ message: "AI Analysis Complete!", status: "success" });
    }, 2500);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend live on port ${PORT}`));
