console.log("--- STEP 1: SERVER SCRIPT STARTING ---");

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

console.log("--- STEP 2: BASIC IMPORTS SUCCESSFUL ---");

// AWS S3 Setup
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const S3_BUCKET = process.env.AWS_BUCKET_NAME || 'clipwave-clips';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

console.log("--- STEP 3: AWS S3 CONFIGURED (Bucket:", S3_BUCKET, ") ---");

// FFmpeg Setup
let ffmpeg;
let ffmpegPath;

try {
    ffmpeg = require('fluent-ffmpeg');
    ffmpegPath = require('ffmpeg-static');
    console.log("--- STEP 4: FFMPEG PATH FOUND AT:", ffmpegPath, "---");
    if (ffmpegPath) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        console.log("--- STEP 5: FFMPEG CONFIGURED ---");
    }
} catch (err) {
    console.error("!!! CRITICAL ERROR CONFIGURING FFMPEG:", err.message, "!!!");
}

// yt-dlp Setup
let ytdlp;
try {
    ytdlp = require('yt-dlp-exec');
    console.log("--- STEP 6: YT-DLP LOADED ---");
} catch (err) {
    console.error("!!! YT-DLP NOT AVAILABLE:", err.message, "!!!");
}

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Create temp output directory for processing
const OUTPUT_DIR = path.join(__dirname, 'clips');
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

app.get('/', (req, res) => {
    res.send("ClipWave Backend is Live! (S3 Enabled)");
});

const FRONTEND_URL = "https://stackblitzwebcontainerapistart-xmi0--5173--29a3b5f7.local-credentialless.webcontainer.io";

// ========================
// === HELPER FUNCTIONS ===
// ========================

// Upload a file to S3 and return the public URL
async function uploadToS3(filePath, s3Key, contentType) {
    const fileBuffer = fs.readFileSync(filePath);
    
    const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        // Make the file publicly readable
        ACL: 'public-read'
    });

    await s3.send(command);
    
    // Return the public URL
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
}

// Delete a file from S3
async function deleteFromS3(s3Key) {
    const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
    });
    await s3.send(command);
}

// Convert "M:SS" or "H:MM:SS" to seconds
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
}

// Generate SRT file content from caption data
function generateSRT(captions) {
    let srt = '';
    captions.forEach((cap, i) => {
        srt += `${i + 1}\n`;
        srt += `${cap.start} --> ${cap.end}\n`;
        srt += `${cap.text}\n\n`;
    });
    return srt;
}

// Format seconds to SRT timestamp (HH:MM:SS,mmm)
function secondsToSRT(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

// ====================
// === OAUTH ROUTES ===
// ====================

app.get('/auth/github', (req, res) => {
    const redirectUri = "https://clipwave-backend.onrender.com/auth/github/callback";
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
    res.redirect(githubAuthUrl);
});

app.get('/auth/github/callback', async (req, res) => {
    try {
        await axios.post('https://github.com/login/oauth/access_token', {
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

app.get('/auth/google', (req, res) => {
    const redirectUri = "https://clipwave-backend.onrender.com/auth/google/callback";
    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=profile email`;
    res.redirect(googleUrl);
});

app.get('/auth/google/callback', async (req, res) => {
    try {
        await axios.post('https://oauth2.googleapis.com/token', {
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

// ===============================
// === AI TEXT GENERATION ROUTE ===
// ===============================

app.post('/api/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "No prompt provided" });

        const apiKey = process.env.GEMINI_API_KEY;
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: prompt }] }] },
            { headers: { 'Content-Type': 'application/json' } }
        );

        const aiResponse = response.data.candidates[0].content.parts[0].text;
        res.json({ status: "success", message: aiResponse });
    } catch (error) {
        console.error("Generate error:", error.response?.data || error.message);
        res.status(500).json({ status: "error", message: "Failed to generate" });
    }
});

// ============================================
// === FULL VIDEO CLIPPING PIPELINE (S3)   ===
// ============================================

app.post('/api/clip', async (req, res) => {
    const { url, clips, aspectRatio, captionLang } = req.body;

    if (!url || !clips || !clips.length) {
        return res.status(400).json({ error: "Missing url or clips array" });
    }

    const jobId = Date.now().toString();
    const jobDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    try {
        // ============================
        // STEP 1: Download video
        // ============================
        console.log(`[JOB ${jobId}] Downloading: ${url}`);
        const videoPath = path.join(jobDir, 'source.mp4');

        await ytdlp(url, {
            output: videoPath,
            format: 'best[height<=720][ext=mp4]/best[height<=720]/best',
            noPlaylist: true,
            limitRate: '5M'
        });

        console.log(`[JOB ${jobId}] Download complete.`);

        if (!fs.existsSync(videoPath)) {
            throw new Error("Video download failed - file not found");
        }

        // ============================
        // STEP 2: Extract audio
        // ============================
        console.log(`[JOB ${jobId}] Extracting audio...`);
        const audioPath = path.join(jobDir, 'audio.wav');

        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .audioFrequency(16000)
                .audioChannels(1)
                .format('wav')
                .on('end', resolve)
                .on('error', reject)
                .run();
        });

        // ============================
        // STEP 3: Process each clip
        // ============================
        const results = [];

        for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const startSec = timeToSeconds(clip.start_time);
            const endSec = timeToSeconds(clip.end_time);
            const duration = endSec - startSec;

            if (duration <= 0 || duration > 300) {
                console.log(`[JOB ${jobId}] Skipping clip ${i + 1} - invalid duration`);
                continue;
            }

            console.log(`[JOB ${jobId}] Processing clip ${i + 1}: ${clip.start_time} → ${clip.end_time}`);

            // --- Extract clip audio for transcription ---
            const clipAudioPath = path.join(jobDir, `clip_${i}_audio.wav`);
            await new Promise((resolve, reject) => {
                ffmpeg(audioPath)
                    .setStartTime(startSec)
                    .setDuration(duration)
                    .output(clipAudioPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            // --- Transcribe with Gemini ---
            let captions = [];
            try {
                const audioBuffer = fs.readFileSync(clipAudioPath);
                const audioBase64 = audioBuffer.toString('base64');

                const transcribeResponse = await axios.post(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        contents: [{
                            parts: [
                                {
                                    inlineData: {
                                        mimeType: "audio/wav",
                                        data: audioBase64
                                    }
                                },
                                {
                                    text: `Transcribe this audio with timestamps. Return ONLY a JSON array where each item has "start" (seconds from beginning as number), "end" (seconds as number), and "text" (spoken words). Break into segments of 3-6 words. Language: ${captionLang || 'English'}. Return ONLY valid JSON, no markdown.`
                                }
                            ]
                        }]
                    },
                    { headers: { 'Content-Type': 'application/json' } }
                );

                let transcriptText = transcribeResponse.data.candidates[0].content.parts[0].text.trim();
                if (transcriptText.startsWith('```')) {
                    transcriptText = transcriptText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
                }
                
                const rawCaptions = JSON.parse(transcriptText);
                captions = rawCaptions.map(c => ({
                    start: secondsToSRT(c.start),
                    end: secondsToSRT(c.end),
                    text: c.text
                }));
            } catch (transcribeErr) {
                console.error(`[JOB ${jobId}] Transcription failed for clip ${i + 1}:`, transcribeErr.message);
                captions = [{
                    start: "00:00:00,000",
                    end: secondsToSRT(duration),
                    text: clip.title || "ClipWave Generated Clip"
                }];
            }

            // --- Write SRT file ---
            const srtPath = path.join(jobDir, `clip_${i}.srt`);
            fs.writeFileSync(srtPath, generateSRT(captions));

            // --- Cut video & burn captions with FFmpeg ---
            const clipOutputPath = path.join(jobDir, `clip_${i}.mp4`);

            let videoFilter = '';
            const subtitleFilter = `subtitles=${srtPath.replace(/\\/g, '/').replace(/:/g, '\\\\:')}:force_style='FontSize=22,FontName=Arial,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Shadow=1,Alignment=2,MarginV=30'`;

            if (aspectRatio === '9:16') {
                videoFilter = `crop=ih*9/16:ih,scale=1080:1920,${subtitleFilter}`;
            } else if (aspectRatio === '1:1') {
                videoFilter = `crop=min(iw\\,ih):min(iw\\,ih),scale=1080:1080,${subtitleFilter}`;
            } else {
                videoFilter = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,${subtitleFilter}`;
            }

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .setStartTime(startSec)
                    .setDuration(duration)
                    .videoFilters(videoFilter)
                    .outputOptions([
                        '-c:v libx264',
                        '-preset fast',
                        '-crf 23',
                        '-c:a aac',
                        '-b:a 128k',
                        '-movflags +faststart'
                    ])
                    .output(clipOutputPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            console.log(`[JOB ${jobId}] Clip ${i + 1} rendered. Uploading to S3...`);

            // ============================
            // STEP 4: Upload to S3
            // ============================
            const s3VideoKey = `clips/${jobId}/clip_${i}.mp4`;
            const s3SrtKey = `clips/${jobId}/clip_${i}.srt`;

            const videoUrl = await uploadToS3(clipOutputPath, s3VideoKey, 'video/mp4');
            const srtUrl = await uploadToS3(srtPath, s3SrtKey, 'text/plain');

            console.log(`[JOB ${jobId}] Clip ${i + 1} uploaded to S3: ${videoUrl}`);

            results.push({
                title: clip.title,
                description: clip.description,
                hashtags: clip.hashtags,
                start_time: clip.start_time,
                end_time: clip.end_time,
                download_url: videoUrl,
                srt_url: srtUrl,
                captions: captions
            });

            // Clean up local clip audio
            if (fs.existsSync(clipAudioPath)) fs.unlinkSync(clipAudioPath);
        }

        // ============================
        // STEP 5: Clean up local files
        // ============================
        console.log(`[JOB ${jobId}] Cleaning up local files...`);
        fs.rmSync(jobDir, { recursive: true, force: true });

        console.log(`[JOB ${jobId}] ✅ DONE. ${results.length} clips uploaded to S3.`);
        res.json({ status: "success", jobId, clips: results });

    } catch (error) {
        console.error(`[JOB ${jobId}] Pipeline error:`, error.message);
        // Clean up on error
        if (fs.existsSync(jobDir)) {
            fs.rmSync(jobDir, { recursive: true, force: true });
        }
        res.status(500).json({ status: "error", message: error.message });
    }
});

// === DELETE CLIPS FROM S3 ===
app.delete('/api/clips/:jobId', async (req, res) => {
    try {
        const jobId = req.params.jobId;
        // Delete up to 10 clips per job (covers most cases)
        for (let i = 0; i < 10; i++) {
            try {
                await deleteFromS3(`clips/${jobId}/clip_${i}.mp4`);
                await deleteFromS3(`clips/${jobId}/clip_${i}.srt`);
            } catch (e) {
                // File doesn't exist, that's fine
                break;
            }
        }
        res.json({ status: "deleted" });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`=== BACKEND LIVE ON PORT ${PORT} (S3 ENABLED) ===`));



