import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import redis from "./database/radis.connect.js"; // your Upstash Redis
import cors from "cors";
import { config } from "./config/env.js"; // assuming you have a config file

const app = express();
app.use(cors());
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// BullMQ / Redis setup
const radis_token = config.get("redisToken");

const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const queueName = "videoprocessing";
const queue = new Queue(queueName, { connection });

// Optional: delete all jobs at startup
async function deleteAllJobs() {
  await queue.obliterate({ force: true });
  console.log("✅ All jobs deleted from the queue");
}
deleteAllJobs();

app.use(express.json());
app.use(express.static(path.join(__dirname, './client/dist')));

// Create video job
app.post("/createvideo", async (req, res) => {
  try {
    const { input, id } = req.body;
    console.log("Received input:", input, id);

    const data = {
      input,
      message: "will start processing soon",
      isprocessing: false,
      isdone: false,
      iserror: false,
    };

    // Save job data to Redis
    await redis.set(id, data);

    // Add job to BullMQ queue
    const job = await queue.add(queueName, { userId: id, userinput: input });
    console.log("Job added:", job.id);

    res.json({ status: "ok", message: "Job data stored in Redis", data });
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ status: "error", message: "Failed to create job" });
  }
});

// Status endpoint
app.get("/status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const data = await redis.get(userId);

    if (!data) {
      return res.status(404).json({
        message: "No data found for this user",
        isprocessing: false,
        isdone: false,
        iserror: false,
      });
    }

    res.json(data);
    console.log("Status fetched:", data);
  } catch (error) {
    console.error("Error fetching status:", error);
    res.status(500).json({
      message: "Server error",
      isprocessing: false,
      isdone: false,
      iserror: true,
    });
  }
});

// Test endpoint
app.get("/test", async (req, res) => {
  try {
    const job = await queue.add(queueName, { foo: "this is working" });
    console.log("Test job added:", job.id);

    job.on("succeeded", (result) => {
      console.log(`Job ${job.id} succeeded with result:`, result);
    });

    job.on("failed", (err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    res.json({ data: "done" });
  } catch (err) {
    console.error("Error adding test job:", err);
    res.status(500).json({ data: "error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
