import { queueName, queue, connection } from '../Queueconnection/Queue.connection.js';
import path from 'path';
import https from 'https'
import { execSync } from "child_process";
import ffprobe from "ffprobe-static";
import fs from "fs";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import googleTTS from 'google-tts-api'
import { Queue, tryCatch, Worker } from "bullmq";
import redis from '../database/radis.connect.js';
import { config } from '../config/env.js';

let geminiKey = config.get("geminiKey");
console.log(geminiKey);
const model = new ChatGoogleGenerativeAI({
  apiKey: geminiKey,
  model: "gemini-2.5-flash",
  temperature: 0.7,
});
async function updateUser(userid, nmessage, isprocessing, isdone, iserror) {
  userid = String(userid);
  const existingData = await redis.get(userid);

  if (!existingData) {
    console.log("User data not found while updating in queue");
    return;
  }

  console.log(existingData);
  const newData = {
    input: existingData.input,
    message: nmessage ?? existingData.message,
    isprocessing: isprocessing ?? existingData.isprocessing,
    isdone: isdone ?? existingData.isdone,
    iserror: iserror ?? existingData.iserror,
  };

  await redis.set(userid, newData);
  console.log("user updated");
}

const worker = new Worker(
  queueName,
  async (job) => {
    // generating directorys for user
    console.log("starting to generate video", job);
    const dirs = [
      `userdata/${job.data.userid}/assets/audio`,
      `userdata/${job.data.userid}/assets/video`,
      `userdata/${job.data.userid}/manim_code`,
      `userdata/${job.data.userid}/final`,
      `userdata/${job.data.userid}/logs`
    ];
    dirs.forEach((d) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });


    // step 1 generate initial script
    console.log("generating inital script")
    await updateUser(job.data.userid, "waiting for ai to write script for the video", true, false, false);
    const scriptPrompt = [
      new SystemMessage(
        `You are an AI that generates detailed narration scripts and perfectly matching scene descriptions 
for educational videos created entirely using the Manim Python library.

===============================
CRITICAL OUTPUT RULES
===============================
- Output **only valid JSON** (no markdown, no code fences, no comments).
- Format:
{
  "script": ["line 1", "line 2", ...],
  "visuals": ["scene 1 explanation", "scene 2 explanation", ...]
}
- The "script" and "visuals" arrays must be the same length.
- Each "script" item = one narration line.
- Each "visuals" item = one self-contained Manim scene that visually matches that narration.

===============================
CONTENT RULES
===============================
1. Narration:
   - Short (1–3 sentences each), educational, and clear.
   - Explain the topic step-by-step: introduction, explanation, process, components, and impact/conclusion.
   - Use a natural, documentary-style tone (not robotic or overly complex).

2. Visuals:
   - Use **only Manim’s built-in classes and functions** — no external assets, images, or extra imports.
   - Allowed objects:
     - Shapes: Circle, Square, Rectangle, Line, Arrow, Dot, Polygon, Ellipse
     - Text and MathText
     - Grouping and layouts: VGroup, arrange_in_grid, arrange_in_circle, etc.
   - Allowed animations:
     - Create, Write, FadeIn, FadeOut, Transform, MoveTo, Rotate, Scale, Wiggle, Shift
   - Use clear, renderable visual metaphors:
     - Network/Connections → circles connected by lines or arrows
     - Data flow → moving dots or arrows
     - Computers/Servers → rectangles (with inner lines for screens)
     - Energy/Flow → glowing dots or lines moving
     - Growth/Change → scaling or color transition
     - Math/Graphs → coordinate axes, plotted dots, or functions
   - Describe:
     - Number, type, and arrangement of objects
     - Basic colors (blue, green, yellow, red, white, gray)
     - Motions, animations, and transitions between scenes
   - Each scene must be **self-contained and renderable** on its own.

===============================
VISUAL STRUCTURE SUGGESTION
===============================
- Scene 1: Introduction or definition
- Scene 5+: Explanation of key parts or process
- Scene 5+: Examples, data flow, or visualization of impact
- Final Scene: Summary or conclusion

===============================
TONE AND STYLE
===============================
- Educational, concise, clear.
- Avoid abstract or emotional language (e.g., “freedom,” “vast,” “mysterious”).
- Focus on what can actually be drawn, animated, or labeled.

===============================
GOAL
===============================
Produce JSON that can be fed directly into a Manim-based scene generator to render an educational animation. 
The output must always be clear, detailed, renderable, and visually descriptive using only Manim’s internal capabilities.
`
      ),
      new HumanMessage(
        `Generate a detailed narration and visual plan for an educational video explaining the following topic.

Topic: "${job.data.userinput}"

Return only JSON with two fields: "script" and "visuals". 
Ensure the visuals match each narration line precisely and use only Manim’s internal objects and animations (no extra assets or imports).`
      ),
    ];
    let scriptResult;
    try {
      scriptResult = await model.invoke(scriptPrompt);
    } catch (error) {
      console.log("error while getting scrypt from ai", error);
    }
    let rawScript = scriptResult.content;
    let parsedScript = JSON.parse(rawScript.replace(/```json|```/g, "").trim());
    const scriptLines = parsedScript.script;

    // use full logs froms first step
    console.log(" parsed JSON successfully!\n");
    console.log(" narration script:\n", scriptLines);
    console.log(" visuals here:\n", parsedScript.visuals);


    // step 2 converting  script form ai to voice using google tts
    console.log("start converting script to voices")
    const audioDurations = [];
    const audioFiles = [];
    for (let i = 0; i < scriptLines.length; i++) {
      console.log("srated working")
      const line = scriptLines[i];
      const audioPath = `userdata/${job.data.userid}/assets/audio/line_${i + 1}.mp3`;

      console.log("srated path done")
      const url = googleTTS.getAudioUrl(line, {
        lang: "en",
        slow: false,
        host: "https://translate.google.com",
      });

      console.log("srated  done")
      const chunks = [];

      await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          if (res.statusCode !== 200) return reject(new Error(`Failed to get audio: ${res.statusCode}`));
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", resolve);
          res.on("error", reject);
        }).on("error", reject);
      });

      const audioBuffer = Buffer.concat(chunks);

      fs.writeFileSync(audioPath, audioBuffer);

      console.log("write to file done")
      try {
        const durationOutput = execSync(`"${ffprobe.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString();
        const duration = parseFloat(durationOutput.trim());
        audioDurations.push({
          line: line,
          visuals: parsedScript.visuals,
          duration: duration
        });
        audioFiles.push(path.resolve(audioPath));
        console.log(`saved narration ${i + 1}: ${audioPath}, Duration: ${duration.toFixed(2)}s`);
      } catch (error) {
        console.error(`failed to get duration for ${audioPath}:`, error.message);
      }
    }


    console.log(" job done:", job.id);

    return { status: "done", processedAt: new Date().toISOString() };
  },
  { connection }
);


