import express from "express";
import path from "path";
import { fileURLToPath } from "url";
//import queue from "./Queueconnection/Queue.connection.js";
import redis from "./database/radis.connect.js"
import { queue } from "./Queueconnection/Queue.connection.js"
import cors from "cors";
import { queueName } from "./Queueconnection/Queue.connection.js"
const app = express();
app.use(cors());
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, './client/dist')))

app.post("/createvideo", async (req, res) => {
  const { input, id } = req.body;
  console.log(input, id);

  const data = {
    input,
    message: "will start processing soon",
    isprocessing: false,
    isdone: false,
    iserror: false,
  };
  // Add this endpoint to your Express server
  app.get("/status/:userId", async (req, res) => {
    try {
      console.log("calling");
      const { userId } = req.params;
      const data = await redis.get(userId);

      if (!data) {
        return res.status(404).json({
          message: "No data found for this user",
          isprocessing: false,
          isdone: false,
          iserror: false
        });
      }

      res.json(data);
      console.log("this is data", data);
    } catch (error) {
      console.error("Error fetching status:", error);
      res.status(500).json({
        message: "Server error",
        isprocessing: false,
        isdone: false,
        iserror: true
      });
    }
  });
  console.log("setting");
  await redis.set(id, data);
  //const job = queue.createJob({ userid: id, input });
  //await job.save();
  console.log("gettting");
  const existingData = await redis.get(id);

  const job = await queue.add(queueName, { userId: id, userinput: input });
  console.log("job added", job);

  console.log(existingData);

  res.json({ status: "ok", message: "Job data stored in Redis", data });
});

app.get("/test", async (req, res) => {
  (async () => {
    const job = queue.createJob({ foo: 'this is working' });
    await job.save();
    console.log('Job added:', job.id);

    //  listen to job events
    job.on('succeeded', (result) => {
      console.log(`Job ${job.id} succeeded with result:`, result);
    });

    job.on('failed', (err) => {
      console.error(`Job ${job.id} failed:`, err);
    });
  })();
  res.json({
    data: "done",
  })
});


app.listen(PORT, () => {
  console.log(` Server is running at http://localhost:${PORT}`);
});
