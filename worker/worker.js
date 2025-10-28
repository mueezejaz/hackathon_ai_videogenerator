import { queueName, queue, connection } from '../Queueconnection/Queue.connection.js';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Queue, Worker } from "bullmq";
import redis from '../database/radis.connect.js';
import { config } from '../config/env.js';

let geminiKey = config.get("geminiKey");
console.log(geminiKey);
const model = new ChatGoogleGenerativeAI({
  apiKey: geminiKey,
  model: "gemini-2.0-flash",
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
}

const worker = new Worker(
  queueName,
  async (job) => {
    await updateUser(job.data.userid, "waiting for ai to write script for the video", true, false, false);
    let output = await model.invoke(job.data.userinput);
    console.log(output);
    console.log("✅ Job done:", job.id);
    return { status: "done", processedAt: new Date().toISOString() };
  },
  { connection }
);


