import express, { Request, Response } from "express";
import { getConsumer, sendVote } from "../config/fluvio";
import { Offset, type Record } from "@fluvio/client";
import fs from "fs";
import path from "path";

const router = express.Router();

const votesFilePath = path.join(__dirname, "../data/votes.json");

router.post("/submit", async (req: Request, res: Response) => {
  const { candidate, user } = req.body;

  if (!candidate) {
    return res.status(400).send({ error: "Candidate is required." });
  }

  if (!user) {
    return res.status(400).send({ error: "User is required." });
  }

  try {
    const votesData = JSON.parse(fs.readFileSync(votesFilePath, "utf8"));

    for (const key of Object.keys(votesData)) {
      if (votesData[key].includes(user)) {
        return res.status(400).send({ error: "User has already voted." });
      }
    }

    if (!votesData[candidate]) {
      votesData[candidate] = [];
    }
    votesData[candidate].push(user);

    fs.writeFileSync(votesFilePath, JSON.stringify(votesData, null, 2));

    await sendVote(candidate);
    res.status(200).send({ message: "Vote submitted successfully." });
  } catch (error) {
    console.error("Error submitting vote:", error);
    res.status(500).send({ error: "Failed to submit vote." });
  }
});

router.get("/stream", async (_req: Request, res: Response) => {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/event-stream;");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const consumer = await getConsumer();
    await consumer.stream(Offset.FromEnd(), async (record: Record) => {
      const eventData = record.valueString();
      res.write(`data: ${eventData}\n\n`);
    });

    res.on("close", () => {
      res.end();
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: error,
    });
  }
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const votesData = JSON.parse(fs.readFileSync(votesFilePath, 'utf8'));

    const voteCounts: { [key: string]: number } = {};
    for (const candidate in votesData) {
      voteCounts[candidate] = votesData[candidate].length;
    }

    res.status(200).send(voteCounts);
  } catch (error) {
    console.error("Error fetching vote counts:", error);
    res.status(500).send({ error: "Failed to fetch vote counts." });
  }
});

export default router;
