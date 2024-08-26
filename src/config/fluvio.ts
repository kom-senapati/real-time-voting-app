import Fluvio, { Offset } from "@fluvio/client";
import dotenv from "dotenv";

dotenv.config();

const FLUVIO_TOPIC = process.env.FLUVIO_TOPIC || "vote-topic";
const PARTITION = 0;

export const initializeFluvio = async () => {
  try {
    const fluvio = new Fluvio();
    await fluvio.connect();
    console.log("Fluvio initialized");
  } catch (error) {
    console.error("Failed to initialize Fluvio:", error);
  }
};

export const getConsumer = async () => {
  const fluvio = new Fluvio();
  await fluvio.connect();
  const consumer = await fluvio.partitionConsumer(FLUVIO_TOPIC, PARTITION);
  return consumer;
};

const getProducer = async () => {
  const fluvio = new Fluvio();
  await fluvio.connect();
  const producer = await fluvio.topicProducer(FLUVIO_TOPIC);
  return producer;
};

export const sendVote = async (candidate: string) => {
  const producer = await getProducer();
  await producer.send("candidate", JSON.stringify(candidate));
};

export const getVotes = async () => {
  const votes: string[] = [];
  const consumer = await getConsumer();

  await consumer.stream(Offset.FromEnd(), async (record) => {
    votes.push(record.valueString());
  });
  return votes;
};
