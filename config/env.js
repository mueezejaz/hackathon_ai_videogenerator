import dotenv from "dotenv"

dotenv.config()

const _config = {
  redisToken: process.env.REDIS_TOKEN,
  nodeEnv: process.env.NODE_ENV || "development",
}

// Public API
export const config = {
  get(key) {
    return _config[key]
  },
}
