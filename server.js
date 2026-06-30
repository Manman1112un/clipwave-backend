require('dotenv').config(); // Secures your API keys using Render Environment Variables
const express = require('express');
const path = require('path');
const axios = require('axios'); // Used to securely communicate with GitHub's servers
const app = express();

// Middleware to parse incoming JSON data from your dashboard
app.use(express.json());
app.use(express.static('.'));

// ==========================================
// 1. FRONTEND ROUTING
// ==========================================

// Serve the main website index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// 2. GITHUB OAUTH SIGN-IN FLOW
// ==========================================

// Step A: Redirect user to GitHub's secure login panel
app.get('/auth/github', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    
    if (!clientId) {
        console.error("Missing GITHUB_CLIENT_ID");
        return res.status(500).send("Server configuration error: Missing GITHUB_CLIENT_ID.");
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    res.redirect(githubAuthUrl);
});

// Step B: GitHub returns the user here with a secure temporary access code
app.get('/auth/github/callback', async (req, res) => {
    const code = req.query.code; 
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!code) {
        return res.redirect('/?error=no_code_provided');
    }

    try {
        // Exchange temporary code for a secure Access Token
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: clientId,
            client_secret: clientSecret,
            code: code
        }, {
            headers: { accept: 'application/json' }
        });

        const accessToken = tokenResponse.data.access_token;

        if (!accessToken) {
            return res.redirect('/?error=token_exchange_failed');
        }

        // Use the access token to fetch the user's secure profile information
        const userResponse = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
        });

        console.log(`User authenticated successfully: ${userResponse.data.login}`);
        
        // Redirect back to the frontend with an 'authed' flag so the dashboard unlocks
        res.redirect('/?authed=true');

    } catch (error) {
        console.error("GitHub Auth Error:", error.message);
        res.redirect('/?error=auth_failed');
    }
});

// ==========================================
// 3. AI CLIP GENERATION GATEWAY
// ==========================================

// Receives the video link from the dashboard and securely handles the Google API Key
app.post('/api/generate', async (req, res) => {
    const streamUrl = req.body.url;
    const myGoogleKey = process.env.GOOGLE_API_KEY;

    console.log(`Processing clip request for link: ${streamUrl}`);

    if (!myGoogleKey) {
        console.error("Missing GOOGLE_API_KEY");
        return res.status(500).json({ error: "Server configuration error: Missing Google API Key!" });
    }

    // --- FUTURE CORE AI LOGIC PIPELINE ---
    // 1. Download streamUrl data via a worker script
    // 2. Feed transcripts/frames to Google Gemini API using myGoogleKey
    // 3. Segment highlights via FFmpeg
    // -------------------------------------

    // Simulating the backend processing delay before sending success to the frontend dashboard
    setTimeout(() => {
        res.json({ 
            message: "AI Analysis Complete! Your vertical clips are being prepared.", 
            status: "success" 
        });
    }, 2500);
});

// Start server on Render's dynamic port or local default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ClipWave running live on port ${PORT}`));
