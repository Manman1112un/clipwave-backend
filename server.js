console.log("--- STEP 1: SERVER SCRIPT STARTING ---");

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

console.log("--- STEP 2: BASIC IMPORTS SUCCESSFUL ---");

let ffmpeg;
let ffmpegPath;

// TRAP 1: Catch FFmpeg configuration errors
try {
    ffmpeg = require('fluent-ffmpeg');
    ffmpegPath = require('ffmpeg-static');
    console.log("--- STEP 3: FFMPEG PATH FOUND AT:", ffmpegPath, "---");
    
    if (ffmpegPath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log("--- STEP 4: FFMPEG CONFIGURED ---");
    } else {
        console.log("--- WARNING: FFMPEG PATH IS NULL ---");
    }
} catch (err) {
    console.error("!!! CRITICAL ERROR CONFIGURING FFMPEG:", err.message, "!!!");
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// --- HEALTH CHECK ROUTE (Helps Render know the app is alive) ---
app.get('/', (req, res) => {
    res.send("ClipWave Backend is Live!");
});

// --- WE HARDCODE THE FRONTEND URL HERE TO BYPASS RENDER ISSUES ---
const FRONTEND_URL = "https://stackblitzwebcontainerapistart-21vq--5173--29a3b5f7.local-credentialless.webcontainer.io";

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

        res.redirect(`${FRONTEND_URL}/?authed=true`);
    } catch (e) {
        res.redirect(`${FRONTEND_URL}/?error=github_failed`);
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
        res.redirect(`${FRONTEND_URL}/?authed=true`);
    } catch (e) { 
        res.redirect(`${FRONTEND_URL}/?error=google_failed`); 
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
        res.redirect(`${FRONTEND_URL}/?authed=true`);
    } catch (e) { 
        res.redirect(`${FRONTEND_URL}/?error=twitch_failed`); 
    }
});

// --- 4. AI CLIP GENERATOR ---
app.post('/api/generate', async (req, res) => {
    res.json({ message: "AI Analysis Complete!", status: "success" });
});

// TRAP 2: Catch random app crashes
process.on('uncaughtException', (err) => {
    console.error("!!! FATAL UNCAUGHT EXCEPTION !!!", err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("!!! FATAL UNHANDLED REJECTION !!!", reason);
});

// --- START SERVER ---
const PORT = process.env.PORT || 10000;

// TRAP 3: Catch port binding errors
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== SUCCESS: BACKEND LIVE ON PORT ${PORT} ===`);
}).on('error', (err) => {
    console.error("!!! ERROR STARTING SERVER !!!", err.message);
});
