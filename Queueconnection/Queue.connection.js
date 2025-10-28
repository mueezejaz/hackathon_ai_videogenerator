import Queue from 'bee-queue';

let queue;
try {
  queue = new Queue('videoprocessing', {
    redis: {
      host: '127.0.0.1',
      port: 6379,
    },
  });
  console.log("✅ Queue connected to Redis");
} catch (error) {
  console.log("❌ Error connecting queue:", error);
}

export default queue;
