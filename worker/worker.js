import { queueName, queue, connection } from '../Queueconnection/Queue.connection.js';
import path from 'path';
import cloudinary from '../database/claud.connect.js';
import https from 'https'
import { execSync } from "child_process";
import ffprobe from "ffprobe-static";
import fs from "fs";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import googleTTS from 'google-tts-api'
import { Queue, Worker } from "bullmq";
import redis from '../database/radis.connect.js';
import { config } from '../config/env.js';
import { jsonrepair } from "jsonrepair";

let geminiKey = config.get("geminiKey");
console.log(geminiKey);

const model = new ChatGoogleGenerativeAI({
  apiKey: geminiKey,
  model: "gemini-2.5-pro",
  temperature: 0.7,
});

async function updateUser(userid, nmessage, isprocessing, isdone, iserror, video_uri) {
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
  if (video_uri) {
    newData.video_uri = video_uri;
  }
  await redis.set(userid, newData);
  console.log("user updated");
}

//loging Functions
function logError(userId, attempt, error, code = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    userId,
    attempt,
    error: error.toString(),
    code: code || "N/A"
  };

  const logDir = `logs/${userId}`;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = `${logDir}/error_log_${new Date().toISOString().split('T')[0]}.json`;
  let logs = [];

  if (fs.existsSync(logFile)) {
    try {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    } catch (e) {
      logs = [];
    }
  }

  logs.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

  console.log(`error logged to ${logFile}`);
}

async function uploadvideotoclaudinary(address) {
  try {
    const uploadResult = await cloudinary.uploader.upload(address, {
      resource_type: "video",
      folder: "hackathon_videos" // optional folder in Cloudinary
    });
    return uploadResult.secure_url;
  } catch (error) {
    console.log("error in uploading video to caludinary", error);
  }
}

function logSuccess(userId, attempt, finalCode) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    userId,
    attempt,
    status: "SUCCESS",
    finalCode
  };

  const logDir = `logs/${userId}`;
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = `${logDir}/success_log_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));

  console.log(`success logged to ${logFile}`);
}

// Create user-specific project folders
function createUserDirectories(userId) {
  const baseDir = `user_projects/${userId}`;
  const dirs = [
    `${baseDir}/assets/audio`,
    `${baseDir}/assets/video`,
    `${baseDir}/manim_code`,
    `${baseDir}/final`,
    `logs/${userId}`
  ];

  dirs.forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  return baseDir;
}

//  code Generation Function with Retry Logic
async function generateAndTestManimCode(userId, baseDir, audioDurations, maxRetries = 4) {
  let currentCode = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\nattempt ${attempt}/${maxRetries}: Generating Manim code`)
    await updateUser(userId, `generating animation code (Attempt ${attempt}/${maxRetries})...`, true, false, false);

    try {
      let promptMessages;

      if (attempt === 1) {
        console.log("first attempt")
        promptMessages = [
          new SystemMessage(
            `You are an expert Python Manim code generator. You must return ONLY valid JSON with a "code" field containing the Python code as a string.

RESPONSE FORMAT:
{
  "code": "from manim import *\\n\\nclass Scene_1(Scene):\\n    def construct(self):\\n        # Your code here\\n        pass"
}

RUNTIME ENVIRONMENT (IMPORTANT):
- The code runs where ONLY Manim is installed. No TeX, no external assets, no internet, no extra Python packages.
- DO NOT use Tex, MathTex, SVGMobject, ImageMobject, or file IO. Use basic Manim 2D mobjects and Text only (default font).
- DO NOT import or rely on any non-Manim libraries beyond Python stdlib implicitly available via Manim.
- All variables/constants must exist. If you define a custom color, define it explicitly at the top before use.

MANDATORY SYNTAX RULES:
1. Import: "from manim import *" at the top
2. Only 2D objects: Circle, Square, Rectangle, Line, Dot, Arrow, Polygon, etc. (NO 3D objects)
3. Colors: ONLY use predefined Manim color constants (BLUE, RED, GREEN, YELLOW, WHITE, BLACK, ORANGE, PURPLE, PINK, GRAY, etc.).
   ❌ NEVER invent colors like BROWN or GRAY_B.
   ✅ If a new color is needed, define it at the top using a HEX string, e.g. BROWN = "#8B4513".
4. Opacity: Use .set_opacity(value) method, NOT an opacity parameter
5. Positioning: Use .move_to([x, y, 0]) or .shift([x, y, 0])
6. Scene names: Scene_1, Scene_2, etc. Each scene inherits from Scene
7. Code must be syntactically valid Python and runnable by Manim as-is.


LAYOUT / READABILITY RULES:
- Ensure visuals are clean: DO NOT overlap or overflow. Use .scale(), .shift(), and .arrange() patterns to space elements.
- Keep labels/tags short. Prefer small Text next to shapes; avoid long sentences.
- If space is tight, shrink or reflow elements so nothing collides.

CRITICAL TIMING RULES:
- You are given a variable "audioDurations" (seconds) with one duration per scene.
- NEVER use self.wait(0). Always positive waits (e.g., self.wait(0.1), self.wait(1.5)).
- Each scene MUST fill its exact duration with animations + waits.
- Always compute: remaining = duration - (sum of run_times used so far). If remaining ≤ 0, use self.wait(0.1); else self.wait(remaining).

🚫 CAMERA USAGE RULE (IMPORTANT TO AVOID ERRORS):
- If you need to zoom, pan, or scale the camera frame (e.g., using self.camera.frame.animate),
  you MUST inherit from "MovingCameraScene" instead of "Scene".
- Otherwise, never use "self.camera.frame". Use only "self.camera" for static scenes.
- This prevents the "AttributeError: 'Camera' object has no attribute 'frame'" error.

FORCED VISUALIZATION (no narration text on screen):
- Translate meanings into animated shapes, flows, and simple labeled tags (e.g., a box labeled "Server").
- Only show Text when absolutely necessary for labeling.
- Make shapes that visually match the concept being shown.

TIMING CALCULATION EXAMPLE:
If Scene_3 duration is 3.5s (from audioDurations):
- Animation 1: run_time=1.0
- Animation 2: run_time=1.5
- Remaining = 1.0 → self.wait(1.0)

ERROR-PREVENTION CHECKLIST (MENTAL BEFORE OUTPUT):
- No undefined names (colors, variables, objects).
- No banned classes (Tex, MathTex, SVGMobject, ImageMobject) or external assets.
- No self.wait(0).
- All scenes consume their durations exactly.
- Layout verified to avoid overlaps/overflow.
- No Transform() between incompatible types.
- Do not require any user input or choice; code must run fully automatically.
- Do not wait for user input or prompt user during execution.
- Forced sequence: Render scenes automatically in order: Scene_1, Scene_2, Scene_3, ... Scene_N.

FORCED SEQUENCE:
- Render scenes automatically in order: Scene_1, Scene_2, Scene_3, ... Scene_N.
- Do not wait for user input or provide options.
`
          ),
          new HumanMessage(
            `Generate Manim code with animated 2D visuals (not just text). Translate each narration line into animations using circles, squares, lines, dots, arrows, etc. Do not simply write text.

SCENE TIMINGS:
${audioDurations.map((item, i) => `Scene_${i + 1}: ${item.duration.toFixed(2)}s - "${item.line}" this is what should happen in each scene "${item.visuals}"`).join('\n')}

Return ONLY JSON: {"code": "your_python_code_here"}`
          )
        ];
      } else {
        // Retry attempt - include previous error
        console.log("this is error that is going in ai", lastError);
        promptMessages = [
          new SystemMessage(
            `You are an expert Python Manim code generator fixing a previous error. You must return ONLY valid JSON with a "code" field containing the corrected Python code.

PREVIOUS ERROR THAT OCCURRED:
${lastError}

PREVIOUS CODE THAT FAILED:
${currentCode}

RESPONSE FORMAT:
{
  "code": "from manim import *\\n\\nclass Scene_1(Scene):\\n    def construct(self):\\n        # Your corrected code here\\n        pass"
}

CRITICAL FIX REQUIREMENTS:
- Analyze the error message carefully and fix the specific issue

RUNTIME ENVIRONMENT (IMPORTANT):
- The code runs where ONLY Manim is installed. No TeX, no external assets, no internet, no extra Python packages.
- DO NOT use Tex, MathTex, SVGMobject, ImageMobject, or file IO. Use basic Manim 2D mobjects and Text only (default font).
- DO NOT import or rely on any non-Manim libraries beyond Python stdlib implicitly available via Manim.

TIMING RULES:
- NEVER use self.wait(0). Always positive waits (e.g., self.wait(0.1), self.wait(1.5)).
- Each scene MUST fill its exact duration with animations + waits.`
          ),
          new HumanMessage(
            `Fix the previous Manim code error and generate corrected code.

SCENE TIMINGS:
${audioDurations.map((item, i) => `Scene_${i + 1}: ${item.duration.toFixed(2)}s - "${item.line}"`).join('\n')}

Return ONLY JSON with corrected code: {"code": "your_corrected_python_code_here"}`
          )
        ];
      }

      // generate code
      console.log("start generating code ");
      let codeResult = await model.invoke(promptMessages);
      let rawCode = codeResult.content;

      console.log(`Raw AI Response (Attempt ${attempt}):`);
      console.log("================");
      console.log(rawCode.substring(0, 500) + "...");
      console.log("================");

      // clean and parse the response
      let cleanedCode = rawCode.replace(/```json|```/g, "").trim();
      const jsonMatch = cleanedCode.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedCode = jsonMatch[0];
      }

      let parsedCode;
      try {
        parsedCode = JSON.parse(cleanedCode);
      } catch (err) {
        console.warn(" JSON invalid, attempting repair...");
        try {
          parsedCode = JSON.parse(jsonrepair(cleanedCode));
        } catch (repairErr) {
          // Fallback: try to extract code if it's not in JSON format
          if (rawCode.includes('from manim import')) {
            console.log("🔧 Attempting to extract Python code directly...");
            const codeMatch = rawCode.match(/```python\s*([\s\S]*?)\s*```/) ||
              rawCode.match(/```\s*(from manim[\s\S]*?)\s*```/) ||
              [null, rawCode];

            if (codeMatch[1]) {
              parsedCode = { code: codeMatch[1].trim() };
            } else {
              throw new Error("could not extract valid Python code from response");
            }
          } else {
            throw new Error("no valid Python code found in response");
          }
        }
      }

      if (!parsedCode || typeof parsedCode.code !== 'string') {
        throw new Error("invalid response structure. Expected JSON with 'code' field containing string.");
      }

      currentCode = parsedCode.code;

      // validate that the code contains required elements
      if (!currentCode.includes('from manim import') && !currentCode.includes('import manim')) {
        throw new Error("Generated code doesn't contain manim import");
      }

      console.log(`manim code generated successfully! (Attempt ${attempt})`);

      // save the code
      const pythonFile = `${baseDir}/manim_code/animation.py`;
      fs.writeFileSync(pythonFile, currentCode, "utf-8");
      console.log("manim code saved at:", pythonFile);

      // Test the code by rendering it
      console.log(`\ntesting Manim code (Attempt ${attempt})...`);
      await updateUser(userId, `testing animation code (Attempt ${attempt}/${maxRetries})...`, true, false, false);

      const tempMediaDir = `${baseDir}/temp_manim_output`;

      try {
        // apture both stdout and stderr
        const output = execSync(
          `manim -pqh -a ${pythonFile} --media_dir ${tempMediaDir}`,
          {
            stdio: "pipe",  // Capture output instead of inherit
            encoding: 'utf-8'
          }
        );

        console.log("manim rendering successful!");
        console.log("manim output:", output);

        // if we get here, the code worked!
        logSuccess(userId, attempt, currentCode);
        return { success: true, code: currentCode, pythonFile, tempMediaDir };

      } catch (error) {
        console.log("this is error", error);
        lastError = error.stderr || error.stdout || error.message;
        console.error(`manim rendering failed (Attempt ${attempt}):`);
        console.error("Error output:", lastError);

        // Log the error
        logError(userId, attempt, lastError, currentCode);

        // If this was our last attempt, throw the error
        if (attempt === maxRetries) {
          console.error(`all ${maxRetries} attempts failed. Final error:`);
          console.error(lastError);
          throw new Error(`Failed to generate working Manim code after ${maxRetries} attempts. Final error: ${lastError}`);
        }

        // Clean up failed attempt
        if (fs.existsSync(tempMediaDir)) {
          try {
            fs.rmSync(tempMediaDir, { recursive: true, force: true });
          } catch (e) {
            console.warn("failed to clean up temp directory:", e.message);
          }
        }

        console.log(`retrying with error feedback... (${maxRetries - attempt} attempts remaining)`);
        continue;
      }

    } catch (error) {
      lastError = error.message;
      console.error(`code generation failed (Attempt ${attempt}):`, lastError);

      logError(userId, attempt, lastError, currentCode);

      if (attempt === maxRetries) {
        throw error;
      }

      console.log(` retrying... (${maxRetries - attempt} attempts remaining)`);
    }
  }
}

// main video generation function
async function generateVideo(userId, userInput) {
  const baseDir = createUserDirectories(userId);

  try {
    //  Step 1: Generate initial narration script
    console.log("step 1: Generating initial narration script...");
    await updateUser(userId, "Generating script...", true, false, false);

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
   - Use **only Manim's built-in classes and functions** — no external assets, images, or extra imports.
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
- Scene 2-4: Explanation of key parts or process
- Scene 5+: Examples, data flow, or visualization of impact
- Final Scene: Summary or conclusion

===============================
TONE AND STYLE
===============================
- Educational, concise, clear.
- Avoid abstract or emotional language (e.g., "freedom," "vast," "mysterious").
- Focus on what can actually be drawn, animated, or labeled.

===============================
GOAL
===============================
Produce JSON that can be fed directly into a Manim-based scene generator to render an educational animation. 
The output must always be clear, detailed, renderable, and visually descriptive using only Manim's internal capabilities.
`
      ),
      new HumanMessage(
        `Generate a detailed narration and visual plan for an educational video explaining the following topic.

Topic: "${userInput}"

Return only JSON with two fields: "script" and "visuals". 
Ensure the visuals match each narration line precisely and use only Manim's internal objects and animations (no extra assets or imports).`
      ),
    ];

    let scriptResult = await model.invoke(scriptPrompt);
    let rawScript = scriptResult.content;
    let parsedScript;
    try {
      parsedScript = JSON.parse(rawScript.replace(/```json|```/g, "").trim());
    } catch (err) {
      console.warn(" JSON invalid, attempting repair...");
      parsedScript = JSON.parse(jsonrepair(rawScript.replace(/```json|```/g, "").trim()));
    }
    const scriptLines = parsedScript.script;
    console.log(" Parsed JSON successfully!\n");
    console.log(" Narration Script:\n", scriptLines);
    console.log(" visuals here:\n", parsedScript.visuals);

    //  Step 2: Generate narration audio files and get durations
    console.log("\n Step 2: Generating audio and measuring durations...");
    await updateUser(userId, "Generating audio narration...", true, false, false);

    const audioDurations = [];
    const audioFiles = [];
    for (let i = 0; i < scriptLines.length; i++) {
      const line = scriptLines[i];
      const audioPath = `${baseDir}/assets/audio/line_${i + 1}.mp3`;

      const url = googleTTS.getAudioUrl(line, {
        lang: "en",
        slow: false,
        host: "https://translate.google.com",
      });

      const chunks = [];

      await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", resolve);
          res.on("error", reject);
        });
      });

      const audioBuffer = Buffer.concat(chunks);
      fs.writeFileSync(audioPath, audioBuffer);

      try {
        const durationOutput = execSync(`"${ffprobe.path}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`).toString();
        const duration = parseFloat(durationOutput.trim());
        audioDurations.push({
          line: line,
          visuals: parsedScript.visuals[i],
          duration: duration
        });
        audioFiles.push(path.resolve(audioPath));
        console.log(` Saved narration ${i + 1}: ${audioPath}, Duration: ${duration.toFixed(2)}s`);
      } catch (error) {
        console.error(` Failed to get duration for ${audioPath}:`, error.message);
        throw error;
      }
    }

    //  Step 3: Generate Manim code with error handling and retry logic
    console.log("\n🎬 Step 3: Generating Manim code with error handling...");

    let manimResult;
    try {
      manimResult = await generateAndTestManimCode(userId, baseDir, audioDurations, 4);
    } catch (error) {
      console.error(" Failed to generate working Manim code:", error.message);
      throw error;
    }

    const { pythonFile, tempMediaDir } = manimResult;

    //  Step 4: Process the successful Manim videos
    console.log("\n Step 4: Processing successful Manim videos...");
    await updateUser(userId, "Processing video scenes...", true, false, false);

    // Get the video directory
    const videoDir = path.join(tempMediaDir, "videos/animation/1080p60");
    if (!fs.existsSync(videoDir)) {
      console.error(" Manim output directory not found. This shouldn't happen after successful rendering.");
      console.log("Available directories:");
      if (fs.existsSync(tempMediaDir)) {
        console.log(fs.readdirSync(tempMediaDir, { recursive: true }));
      }
      throw new Error("Manim output directory not found");
    }

    const sceneVideoNames = fs
      .readdirSync(videoDir)
      .filter((f) => f.endsWith(".mp4"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });

    console.log("Found scene videos:", sceneVideoNames);

    if (sceneVideoNames.length === 0) {
      console.error(" No video files found in output directory");
      throw new Error("No video files found");
    }

    const sceneVideos = sceneVideoNames.map((f) => path.resolve(videoDir, f));

    const videoList = `${baseDir}/assets/video/video_list.txt`;
    const videoListContent = sceneVideos.map((f) => `file '${f.replace(/\\/g, '/')}'`).join("\n");
    fs.writeFileSync(videoList, videoListContent, "utf-8");

    console.log("\nMerging all Manim scenes into one video...");
    await updateUser(userId, "Merging video scenes...", true, false, false);

    try {
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${videoList}" -c copy ${baseDir}/assets/video/animation.mp4`,
        { stdio: "inherit" }
      );
      console.log(" Video scenes merged successfully!");
    } catch (error) {
      console.error(" FFmpeg video merge failed:", error.message);
      // Try alternative approach
      console.log("Trying alternative merging approach...");
      if (sceneVideos.length === 1) {
        execSync(`cp "${sceneVideos[0]}" ${baseDir}/assets/video/animation.mp4`);
      } else {
        const inputs = sceneVideos.map((v, i) => `-i "${v}"`).join(" ");
        const filterComplex = `"${sceneVideos.map((v, i) => `[${i}:v][${i}:a]`).join("")}concat=n=${sceneVideos.length}:v=1:a=1[outv][outa]"`;
        execSync(
          `ffmpeg -y ${inputs} -filter_complex ${filterComplex} -map "[outv]" -map "[outa]" ${baseDir}/assets/video/animation.mp4`,
          { stdio: "inherit" }
        );
      }
    }

    //  Step 5: Merge audio + video
    console.log("\n🎚Step 5: Merging audio and video...");
    await updateUser(userId, "Merging audio with video...", true, false, false);

    const concatList = `${baseDir}/assets/audio/list.txt`;
    const audioListContent = audioFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join("\n");
    fs.writeFileSync(concatList, audioListContent, "utf-8");

    // Concatenate audio into one file
    try {
      execSync(
        `ffmpeg -y -f concat -safe 0 -i "${concatList}" -c copy ${baseDir}/assets/audio/final_audio.mp3`,
        { stdio: "inherit" }
      );
      console.log("✅ Audio files merged successfully!");
    } catch (error) {
      console.error("❌ Audio merge failed:", error.message);
      throw error;
    }

    // Merge final video and audio
    try {
      execSync(
        `ffmpeg -y -i ${baseDir}/assets/video/animation.mp4 -i ${baseDir}/assets/audio/final_audio.mp3 -c:v copy -c:a aac -strict experimental -shortest ${baseDir}/final/final_video.mp4`,
        { stdio: "inherit" }
      );
      console.log("final video ready:", `${baseDir}/final/final_video.mp4`);
    } catch (error) {
      console.error("final merge failed:", error.message);
      throw error;
    }

    // Clean up temporary directory
    try {
      fs.rmSync(tempMediaDir, { recursive: true, force: true });
      console.log("tempooorary files cleaned up");
    } catch (error) {
      console.warn("faile to clean up temporary files:", error.message);
    }

    console.log("\nvideo generation completed successfully!");
    console.log("check the logs folder for detailed error/success logs.");
    let videoPath = `${baseDir}/final/final_video.mp4`;
    console.log("\n start uploading video to claude")
    let video_uri = await uploadvideotoclaudinary(videoPath)
    console.log("\n video is uploaded to claude", video_uri);
    return {
      success: true,
      videoPath: `${baseDir}/final/final_video.mp4`,
      baseDir: baseDir,
      video_uri,
    };

  } catch (error) {
    console.error("video generation failed:", error.message);
    throw error;
  }
}

// worker
const worker = new Worker(
  queueName,
  async (job) => {
    await job.extendLock(1800000);
    const { userId, userinput } = job.data;
    console.log(`sstarting video generation for user ${userId}: "${userinput}"`);

    try {
      // update status to processing
      await updateUser(userId, "starting video generation...", true, false, false);

      // generate the video
      const result = await generateVideo(userId, userinput);

      // update status to done
      await updateUser(userId, "video generation completed!", false, true, false, result.video_uri);

      console.log(`job completed for user ${userId}`);
      return result;

    } catch (error) {
      console.error(`job failed for user ${userId}:`, error.message);

      // Update status to error
      await updateUser(userId, `error: ${error.message}`, false, false, true);

      throw error;
    }
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 600000,
    lockRenewTime: 30000,
    settings: {
      maxStalledCount: 1,
      stalledInterval: 60000
    }
  }
);

// worker event handlers
worker.on('completed', (job) => {
  console.log(`job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('worker error:', err);
});

console.log('worker started and waiting for jobs...');

export { worker };


