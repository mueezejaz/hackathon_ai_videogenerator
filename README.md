
```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER (Browser)                                 │
│  • Visits landing page                                                  │
│  • Enters topic: "How does photosynthesis work?"                        │
│  • Clicks "Generate Video"                                              │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ POST /createvideo
                                 │ { input: "topic", id: 1735481234567 }
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      REACT FRONTEND (Port 5173)                         │
│  • Generates unique userId (timestamp)                                  │
│  • Sends HTTP POST request                                              │
│  • Shows loading state                                                  │
│  • Starts polling every 3 seconds ─────────┐                            │
└────────────────────────────────┬───────────┘                            │
                                 │                                        │
                                 │ HTTP Requests                          │
                                 │                                        │
                                 ▼                                        │
┌─────────────────────────────────────────────────────────────────────────┤
│                     EXPRESS SERVER (Port 3000)                          │
│                                                                         │
│  Endpoints:                                                             │
│  • POST /createvideo    ─── Creates job                                 │
│  • GET /status/:userId  ─── Returns job status ◄────────────────────────┘
│                                                                          │
└──────────────────────┬──────────────────┬────────────────────────────────┘
                       │                  │
                       │                  │
          Stores job   │                  │  Adds job to queue
          status       │                  │  { userId, userInput }
                       │                  │
                       ▼                  ▼
         ┌─────────────────┐   ┌──────────────────┐
         │  UPSTASH REDIS  │   │     BULLMQ       │
         │   (Database)    │   │   (Job Queue)    │
         │                 │   │                  │
         │  Stores:        │   │  • Manages jobs  │
         │  • Job status   │   │  • Job priority  │
         │  • Progress     │   │  • Retry logic   │
         │  • Video URL    │   │  • Concurrency   │
         │                 │   │                  │
         │  Key: userId    │   └────────┬─────────┘
         │  Value: {...}   │            │
         └─────────────────┘            │ Worker picks job
                                        │ when available
                                        │
                                        ▼
         ┌──────────────────────────────────────────────┐
         │           WORKER PROCESS                     │
         │        (Background Job Processor)            │
         │                                              │
         │  1. Picks job from BullMQ queue              │
         │  2. Extends lock (30 min timeout)            │
         │  3. Creates user folders                     │
         │  4. Updates Redis: "Processing..."           │
         │  5. Executes 6-step pipeline ────────┐       │
         └──────────────────────────────────────┘       │
                                                        │
                                                        │
         ┌──────────────────────────────────────────────┘
         │
         │ PIPELINE EXECUTION:
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: AI SCRIPT GENERATION                                        │
├─────────────────────────────────────────────────────────────────────┤
│  Worker → Gemini AI                                                 │
│                                                                     │
│  Input:  "How does photosynthesis work?"                            │
│  Output: {                                                          │
│    "script": [                                                      │
│      "Photosynthesis is how plants make food.",                     │
│      "Sunlight is absorbed by chlorophyll.",                        │
│      "This converts CO2 and water into glucose."                    │
│    ],                                                               │
│    "visuals": [                                                     │
│      "Show green plant with sun rays",                              │
│      "Animate light entering leaves",                               │
│      "Display chemical equation"                                    │
│    ]                                                                │
│  }                                                                  │
│                                                                     │
│  Updates Redis: "Generating script... ✓"                            │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: AUDIO GENERATION                                            │
├─────────────────────────────────────────────────────────────────────┤
│  Worker → Google TTS API                                            │
│                                                                     │
│  For each script line:                                              │
│    1. Call Google Text-to-Speech                                    │
│    2. Download MP3: "line_1.mp3"                                    │
│    3. Measure duration with FFprobe: 3.2s                           │
│                                                                     │
│  Output:                                                            │
│    • line_1.mp3 (3.2s)                                              │
│    • line_2.mp3 (2.8s)                                              │
│    • line_3.mp3 (4.1s)                                              │
│                                                                     │
│  audioDurations = [                                                 │
│    {line: "...", duration: 3.2, visuals: "..."},                    │
│    {line: "...", duration: 2.8, visuals: "..."},                    │
│    {line: "...", duration: 4.1, visuals: "..."}                     │
│  ]                                                                  │
│                                                                     │
│  Updates Redis: "Generating audio... ✓"                             │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: MANIM CODE GENERATION (WITH AUTO-RETRY)                     │
├─────────────────────────────────────────────────────────────────────┤
│  Worker → Gemini AI (Attempt 1)                                     │
│                                                                     │
│  Input:                                                             │
│    • Script + Visuals + Timings                                     │
│    • Manim coding rules                                             │
│    • Timing constraints                                             │
│                                                                     │
│  AI generates:                                                      │
│    from manim import *                                              │
│                                                                     │
│    class Scene_1(Scene):                                            │
│        def construct(self):                                         │
│            plant = Circle(color=GREEN)                              │
│            sun = Circle(color=YELLOW)                               │
│            self.play(Create(plant))                                 │
│            self.wait(2.2)  # Total = 3.2s                           │
│                                                                     │
│  Save to: animation.py                                              │
│                                                                     │
│  ┌─────────────────────────────────────────┐                        │
│  │ TEST RENDER: manim -pqh animation.py   │                         │
│  └─────────────────┬───────────────────────┘                        │
│                    │                                                │
│         ┌──────────┴──────────┐                                     │
│         │                     │                                     │
│    ✅ SUCCESS            ❌ ERROR                                   │
│    Continue               "undefined color BROWN"                   │
│                           │                                         │
│                           ├─► Log error                             │
│                           ├─► Worker → Gemini AI (Attempt 2)        │
│                           │   "Fix this error: ..."                 │
│                           │   AI corrects code                      │
│                           ├─► TEST RENDER again                     │
│                           │                                         │
│                           └─► Retry up to 4 times                   │
│                                                                     │
│  Updates Redis: "Generating animation code (Attempt X/4)..."        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: MANIM RENDERING & SCENE MERGING                             │
├─────────────────────────────────────────────────────────────────────┤
│  Manim CLI renders Python code:                                     │
│                                                                     │
│  Output videos:                                                     │
│    • Scene_1.mp4 (3.2s) ─┐                                          │
│    • Scene_2.mp4 (2.8s) ─┤                                          │
│    • Scene_3.mp4 (4.1s) ─┤                                          │
│                          │                                          │
│  ┌───────────────────────┘                                          │
│  │                                                                  │
│  ├─► Create video_list.txt:                                         │
│  │   file 'Scene_1.mp4'                                             │
│  │   file 'Scene_2.mp4'                                             │
│  │   file 'Scene_3.mp4'                                             │
│  │                                                                  │
│  └─► FFmpeg merge:                                                  │
│      ffmpeg -f concat -i video_list.txt -c copy animation.mp4       │
│                                                                     │
│  Result: animation.mp4 (10.1s, no audio)                            │
│                                                                     │
│  Updates Redis: "Rendering animations... ✓"                         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: AUDIO + VIDEO SYNCHRONIZATION                               │
├─────────────────────────────────────────────────────────────────────┤
│  Part A: Merge Audio Files                                          │
│  ───────────────────────────                                        │
│    line_1.mp3 ─┐                                                    │
│    line_2.mp3 ─┼─► FFmpeg concat                                    │
│    line_3.mp3 ─┘   ffmpeg -f concat ... final_audio.mp3             │
│                                                                     │
│    Result: final_audio.mp3 (10.1s)                                  │
│                                                                     │
│  Part B: Merge Audio + Video                                        │
│  ────────────────────────────                                       │
│    animation.mp4 (10.1s) ─┐                                         │
│    final_audio.mp3 (10.1s)─┼─► FFmpeg merge                         │
│                            │   ffmpeg -i video -i audio ...         │
│                            │   -shortest final_video.mp4            │
│                            │                                        │
│                            └─► final_video.mp4                      │
│                                                                     │
│  Result: Complete video with synced narration!                      │
│                                                                     │
│  Updates Redis: "Merging audio with video... ✓"                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: CLOUD UPLOAD & COMPLETION                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Worker → Cloudinary API                                            │
│                                                                     │
│  1. Read: final_video.mp4                                           │
│  2. Upload to Cloudinary                                            │
│  3. Receive URL:                                                    │
│     https://res.cloudinary.com/xxx/video/upload/v123/video.mp4      │
│                                                                     │
│  4. Update Redis with completion:                                   │
│     {                                                               │
│       message: "Video generation completed!",                       │
│       isprocessing: false,                                          │
│       isdone: true,                                                 │
│       iserror: false,                                               │
│       video_uri: "https://cloudinary.com/..."                       │
│     }                                                               │
│                                                                     │
│  5. Cleanup temporary files                                         │
│  6. Keep final video + logs                                         │
│                                                                     │
│  Worker marks job as COMPLETE ✓                                     │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  │ Status stored in Redis
                                  │
                                  ▼
         ┌──────────────────────────────────────┐
         │       UPSTASH REDIS (Updated)        │
         │                                      │
         │  userId: {                           │
         │    message: "Video ready!",          │
         │    isdone: true,                     │
         │    video_uri: "https://..."          │
         │  }                                   │
         └──────────────────┬───────────────────┘
                            │
                            │ Frontend polls
                            │ GET /status/:userId
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │     EXPRESS SERVER (Port 3000)       │
         │  • Fetches data from Redis           │
         │  • Returns JSON response             │
         └──────────────────┬───────────────────┘
                            │
                            │ Response:
                            │ { isdone: true, video_uri: "..." }
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │     REACT FRONTEND (Port 5173)       │
         │  • Receives completion status        │
         │  • Stops polling                     │
         │  • Shows success message             │
         │  • Displays video player             │
         └──────────────────┬───────────────────┘
                            │
                            ▼
         ┌──────────────────────────────────────┐
         │          USER (Browser)              │
         │   Video Ready!                       │
         │   [Video Player]                     │
         │   Download • 🔗 Share                │
         │                                      │
         │  Total time: 2-5 minutes             │
         └──────────────────────────────────────┘
```
https://res.cloudinary.com/dxoptpeuq/video/upload/v1761719374/hackathon_videos/tvxlbkoquersbvegyjfk.mp4
```

---

## **KEY COMPONENTS EXPLAINED:**

### **1. USER → FRONTEND**
- User enters topic in browser
- React creates unique ID (timestamp)
- Sends HTTP POST request

### **2. FRONTEND → BACKEND**
- Express server receives request
- Creates job data structure
- Returns immediately (non-blocking)

### **3. BACKEND → REDIS + BULLMQ**
- **Redis**: Stores job status (for polling)
- **BullMQ**: Queues job for processing
- Separation of concerns

### **4. BULLMQ → WORKER**
- Worker picks up job when available
- Processes one job at a time
- Updates Redis throughout process

### **5. WORKER PIPELINE (6 STEPS)**
- **Step 1**: AI generates script
- **Step 2**: TTS creates audio
- **Step 3**: AI writes animation code (with retry)
- **Step 4**: Manim renders videos
- **Step 5**: FFmpeg merges everything
- **Step 6**: Upload to Cloudinary

### **6. WORKER → REDIS → FRONTEND**
- Worker updates Redis with completion
- Frontend polls and receives update
- Displays video to user

---

## **DATA FLOW:**
```
User Input → Queue → Worker → AI → Audio → Code → Render → Merge → Upload → User
     ↓         ↓       ↓                                                    ↑
  Frontend  Backend  Redis ←─────────── Status Updates ──────────────────┘
     ↑                                    (Polling every 3s)
     └──────────────────────────────────────────────────────────────────┘
