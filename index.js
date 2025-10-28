import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import redis from "./database/radis.connect.js"

const app = express();
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, './client/dist')))

app.get("/test", async (req, res) => {
  await redis.set("foo", "bar")
  const value = await redis.get("foo")
  res.json({
    data: value,
  })
});


app.listen(PORT, () => {
  console.log(` Server is running at http://localhost:${PORT}`);
});
