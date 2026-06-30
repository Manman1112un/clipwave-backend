const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// Directory setup
const uploadsDir = path.join(__dirname, 'uploads');
const clipsDir = path.join(__dirname, 'public', 'clips');
[uploadsDir, path.join(__dirname, 'public'), clipsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use('/clips', express.static(clipsDir));

const upload = multer({ dest: uploadsDir, limits: { fileSize: 100 * 1024 * 1024 } });

// INITIALIZE GEMINI (Using OpenAI-compatible structure)
const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY, 
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

app.post('/api/analyze', upload.single('video'), async (req, res) => {
    const videoFile = req.file;
    if (!videoFile) return res.status(400).json({ error: "No video file uploaded." });

    try {
        // --- ADD YOUR LOGIC HERE ---
        // For example, calling Gemini:
        const aiResponse = await geminiClient.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: "Analyze this video for highlights." }],
        });

        res.json({ success: true, data: aiResponse.choices[0].message.content });
    } catch (error) {
        console.error("Pipeline failure:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => console.log(`ClipWave Server running on port ${port}`));
