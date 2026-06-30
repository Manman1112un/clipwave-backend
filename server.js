const express = require('express');
const multer = require('multer');
const { OpenAI } = require('openai'); // We use this for BOTH Whisper and Gemini
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// Directories
const uploadsDir = path.join(__dirname, 'uploads');
const clipsDir = path.join(__dirname, 'public', 'clips');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'));
if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true });

app.use(cors());
app.use(express.json());
app.use('/clips', express.static(clipsDir));

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 100 * 1024 * 1024 }
});

// 1. OpenAI Client (for Whisper)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 2. Google Gemini Client (using OpenAI compatibility)
const gemini = new OpenAI({
  apiKey: process.env.GOOGLE_API_KEY, // Use your Google API Key
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

app.post('/api/analyze', upload.single('video'), async (req, res) => {
  const videoFile = req.file;
  const promptPreset = req.body.preset || "Find high-energy viral moments.";
  const requestedCount = parseInt(req.body.clipCount) || 5;

  if (!videoFile) {
    return res.status(400).json({ error: "No video file uploaded." });
  }

  const audioPath = path.join(uploadsDir, `${videoFile.filename}.mp3`);
  
  try {
    // Extract Audio
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -i "${videoFile.path}" -q:a 0 -map a "${audioPath}"`, (err) => {
        if (err) reject(new Error("FFmpeg audio extraction failed: " + err.message));
        else resolve();
      });
    });

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"]
    });

    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

    const scriptTimeline = transcription.segments.map(seg => {
      return `[${seg.start}s - ${seg.end}s]: ${seg.text}`;
    }).join('\n');

    // Analyze with Gemini
    const aiResponse = await gemini.chat.completions.create({
      model: "gemini-2.0-flash", // Use a fast, capable Gemini model
      messages: [
        { 
          role: "system", 
          content: "You are an elite video content manager. Analyze the transcript. Return ONLY a valid JSON array of objects. Properties: title, startSeconds, endSeconds, reason, tags (array), viralScore (number 1-100)." 
        },
        { 
          role: "user", 
          content: `Target Goal: ${promptPreset}. Isolate exactly ${requestedCount} distinct highlights.\n\nTranscript:\n${scriptTimeline}` 
        }
      ],
    });

    let cleanedText = aiResponse.choices[0].message.content.trim();
    // Cleanup if model includes markdown
    cleanedText = cleanedText.replace(/^```json/, "").replace(/```$/, "").trim();
    
    const parsedClips = JSON.parse(cleanedText);
    const clipOutputs = [];

    // Process Clips with FFmpeg
    for (let i = 0; i < parsedClips.length; i++) {
      const clip = parsedClips[i];
      const clipFilename = `clip_${Date.now()}_${i}.mp4`;
      const clipPath = path.join(clipsDir, clipFilename);
      const duration = clip.endSeconds - clip.startSeconds;

      await new Promise((resolve, reject) => {
        exec(`ffmpeg -ss ${clip.startSeconds} -i "${videoFile.path}" -t ${duration} -c:v libx264 -c:a aac -strict -2 "${clipPath}"`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      clipOutputs.push({
        ...clip,
        id: `c_${Date.now()}_${i}`,
        downloadUrl: `http://localhost:${port}/clips/${clipFilename}`
      });
    }

    if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
    res.json({ success: true, clips: clipOutputs });

  } catch (error) {
    console.error("Pipeline failure:", error);
    if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    res.status(500).json({ error: error.message || "Failed to process video." });
  }
});

app.listen(port, () => console.log(`ClipWave Server running on port ${port}`));
