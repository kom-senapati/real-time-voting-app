import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import voteRoutes from "./routes/vote";
import { getVotes, initializeFluvio } from "./config/fluvio";

dotenv.config();
const port = process.env.PORT || 8000;

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/vote", voteRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  initializeFluvio();
});
