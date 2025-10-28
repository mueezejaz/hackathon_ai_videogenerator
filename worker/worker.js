import queue from '../Queueconnection/Queue.connection.js';

queue.on('ready', () => {
  console.log(' worker ready and waiting for jobs...');
});

queue.process(async (job, done) => {
  console.log('processing job:', job.id, job.data);
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`finished job ${job.id}`);
  new Error("some thing went wrong")
});
