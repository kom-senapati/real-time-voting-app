import express, { Request, Response } from "express";
import { getConsumer, sendVote } from "../config/fluvio";
import { Offset, type Record } from "@fluvio/client";
import fs from "fs";
import path from "path";

const router = express.Router();

const votesFilePath = path.join(__dirname, "../data/votes.json");

interface VotesData {
  [candidate: string]: string[];
}

interface SubmitRequestBody {
  candidate?: string;
  user: string;
  action: "create" | "update" | "delete";
}

router.post(
  "/submit",
  async (req: Request<{}, {}, SubmitRequestBody>, res: Response) => {
    let { candidate, user, action } = req.body;
    let oldParty = "";

    if (!candidate && action !== "delete") {
      return res.status(400).send({ error: "Candidate is required." });
    }

    if (!user) {
      return res.status(400).send({ error: "User is required." });
    }

    if (!["create", "update", "delete"].includes(action)) {
      return res.status(400).send({ error: "Invalid action." });
    }

    try {
      const votesData: VotesData = JSON.parse(
        fs.readFileSync(votesFilePath, "utf8")
      );
      const hasVoted = Object.values(votesData).some((voters: string[]) =>
        voters.includes(user)
      );

      if (action === "create") {
        if (hasVoted) {
          return res.status(400).send({ error: "User has already voted." });
        }

        if (!votesData[candidate!]) {
          votesData[candidate!] = [];
        }
        votesData[candidate!].push(user);
      } else if (action === "update") {
        if (!hasVoted) {
          return res.status(400).send({ error: "User has not voted yet." });
        }

        for (const key of Object.keys(votesData)) {
          if (votesData[key].includes(user)) {
            if (votesData[key].includes(user)) {
              votesData[key] = votesData[key].filter(
                (voter: string) => voter !== user
              );
              oldParty = key;
              break;
            }
          }
        }

        if (!votesData[candidate!]) {
          votesData[candidate!] = [];
        }
        votesData[candidate!].push(user);
      } else if (action === "delete") {
        if (!hasVoted) {
          return res.status(400).send({ error: "User has not voted yet." });
        }

        for (const key of Object.keys(votesData)) {
          if (votesData[key].includes(user)) {
            votesData[key] = votesData[key].filter(
              (voter: string) => voter !== user
            );
            candidate = key;
          }
        }
      }

      fs.writeFileSync(votesFilePath, JSON.stringify(votesData, null, 2));

      const eventData = `${user}:${action}:${candidate}:${oldParty}`;
      await sendVote(JSON.stringify(eventData));

      res
        .status(200)
        .send({ message: "Vote operation completed successfully." });
    } catch (error) {
      console.error("Error submitting vote:", error);
      res.status(500).send({ error: "Failed to perform vote operation." });
    }
  }
);

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
    const votesData = JSON.parse(fs.readFileSync(votesFilePath, "utf8"));

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
