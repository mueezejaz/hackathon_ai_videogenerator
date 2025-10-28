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
  model: "gemini-2.5-pro",
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

async function generateAndTestManimCode(audioDurations, maxRetries = 4, job) {
  let currentCode = null;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`\n${attempt}/${maxRetries}: Generating Manim code...`);

    let promptMessages;

    if (attempt === 1) {
      console.log("first attapt")
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
- Forced sequence: Render scenes automatically in order: Scene_1, Scene_2, Scene_3, ... Scene_N."

FORCED SEQUENCE:
- Render scenes automatically in order: Scene_1, Scene_2, Scene_3, ... Scene_N.
- Do not wait for user input or provide options.
`
        ),
        new HumanMessage(
          `Generate Manim code with animated 2D visuals (not just text). Translate each narration line into animations using circles, squares, lines, dots, arrows, etc. Do not simply write text.

SCENE TIMINGS:
${audioDurations.map((item, i) => `Scene_${i + 1}: ${item.duration.toFixed(2)}s - "${item.line}" this is what should happend in each schene "${item.visuals}"`).join('\n')}

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

    // Generate code
    console.log("this is prompt to generate video", promptMessages);
    console.log("start generating code ");
    let codeResult = await model.invoke(promptMessages);
    let rawCode = codeResult.content;

    console.log(`Raw AI Response (Attempt ${attempt}):`);
    console.log("================");
    console.log(rawCode.substring(0, 500) + "...");
    console.log("================");

    // Clean and parse the response
    console.log("start cleaning code")
    let cleanedCode = rawCode.replace(/```json|```/g, "").trim();

    console.log("start cleandd code")
    let parsedCode = JSON.parse(cleanedCode);
    console.log("cleand")
    console.log(parsedCode.code);
    if (!parsedCode || typeof parsedCode.code !== 'string') {
      throw new Error("invalid response structure. Expected JSON with 'code' field containing string.");
    }

    currentCode = parsedCode.code;

    // validate that the code contains required elements
    if (!currentCode.includes('from manim import') && !currentCode.includes('import manim')) {
      throw new Error("Generated code doesn't contain manim import");
    }

    console.log(`code generated successfully! (Attempt ${attempt})`);

    // saving  the code
    const pythonFile = `userdata/${job.data.userid}/manim_code/animation.py`;

    fs.writeFileSync(pythonFile, currentCode, "utf-8");
    console.log("code saved at:", pythonFile);

    console.log(`start running the python code`);

    const tempMediaDir = `userdata/${job.data.userid}/temp_manim_output`;
    const hostProjectPath = process.cwd();
    console.log(hostProjectPath);
    // running and recoring outputs 
    const dockerCommand = `docker run --rm -v "${hostProjectPath}:/manim" manimcommunity/manim manim -pqh ${pythonFile} --media_dir ${tempMediaDir}`;
    try {
      const output = execSync(dockerCommand, { stdio: "pipe", encoding: 'utf-8' });

      console.log("✅ Manim rendering successful!");
      console.log("Manim output:", output);

      return { success: true, code: currentCode, pythonFile, tempMediaDir };

    } catch (error) {
      console.log("this is error", error);
      lastError = error.stderr || error.stdout || error.message;
      console.error(` manim rendering failed attempt ${attempt}`);
      console.error("Error output:", lastError);


      if (attempt === maxRetries) {
        // todo update user that code generation faild
        console.error(` all ${maxRetries} attempts failed. Final error:`);
        console.error(lastError);
        throw new Error(`failed to generate working Manim code after ${maxRetries} attempts. Final error: ${lastError}`);
      }

      // Clean up failed attempt
      if (fs.existsSync(tempMediaDir)) {
        try {
          fs.rmSync(tempMediaDir, { recursive: true, force: true });
        } catch (e) {
          console.warn("⚠️ Failed to clean up temp directory:", e.message);
        }
      }

      console.log(`🔄 Retrying with error feedback... (${maxRetries - attempt} attempts remaining)`);
      continue;
    }
  }
}

const worker = new Worker(
  queueName,
  async (job) => {
    // generating directorys for user
    console.log("starting to generate video", job.data.userinput);
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
    console.log("this is prompt", scriptPrompt);
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
    await updateUser(job.data.userid, "converting script to audio file", true, false, false);
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

    // step 3 start generating python code
    console.log("start generating python code");
    await updateUser(job.data.userid, "generating python code for making video", true, false, false);

    let manimResult = await generateAndTestManimCode(audioDurations, 4, job);
    console.log(" job done:", job.id);

    return { status: "done", processedAt: new Date().toISOString() };
  },
  { connection }
);


