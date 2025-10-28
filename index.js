import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import queue from "./Queueconnection/Queue.connection.js";
import redis from "./database/radis.connect.js"
import cors from "cors";

const app = express();
app.use(cors());
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, './client/dist')))

app.post("/createvideo", (req, res) => {
  console.log(req.body)
  res.json({
    message: "done",
  })

})
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
