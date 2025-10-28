import { Redis } from '@upstash/redis'
import dotenv from "dotenv";
import { config } from '../config/env.js';
let radis_token = config.get("redisToken");

let redis;
try {
  redis = new Redis({
    url: 'https://ready-perch-12526.upstash.io',
    token: radis_token
  })
  console.log("radis database connected successfully")
} catch (error) {
  console.error("faild to connect to radis database", error)
  redis = null
}

export default redis
