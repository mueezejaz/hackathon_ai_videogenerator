import { queueName, queue, connection } from '../Queueconnection/Queue.connection.js';
import { Queue, Worker } from "bullmq";
import redis from '../database/radis.connect.js';

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
    console.log("🎬 Processing job:", job.name);
    await updateUser(job.data.userid, "some thing some thing");

    console.log("✅ Job done:", job.id);
    return { status: "done", processedAt: new Date().toISOString() };
  },
  { connection }
);


