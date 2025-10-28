import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = 3000;

app.use(express.json());

app.use(express.static(path.join(__dirname, './client/dist')))

// app.get("/", (req, res) => {
//   res.send("server is running");
// });


app.listen(PORT, () => {
  console.log(` Server is running at http://localhost:${PORT}`);
});
