import { Queue, Worker } from "bullmq";
import IORedis from "ioredis"
import redis from "../database/radis.connect.js"

import { config } from '../config/env.js';
let radis_token = config.get("redisToken");

export const connection = new IORedis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

export const queueName = "videoprocessing";
export const queue = new Queue(queueName, { connection });

