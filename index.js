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

  console.log("setting");
  await redis.set(id, data);
  //const job = queue.createJob({ userid: id, input });
  //await job.save();
  console.log("gettting");
  const existingData = await redis.get(id);

  const job = await queue.add(queueName, { userid: id, userinput: input });
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
