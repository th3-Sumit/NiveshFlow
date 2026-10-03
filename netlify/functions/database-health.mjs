import { MongoClient } from "mongodb";

export const config = { schedule: "0 0 * * *" };

export default async function databaseHealth() {
  const uri = process.env.MONGO_URI?.trim();

  if (!uri) {
    throw new Error("MONGO_URI must be available to Netlify Functions.");
  }

  try {
    const databaseName = new URL(uri).pathname.slice(1).trim() || "finance_management";
    const client = new MongoClient(uri, {
      maxPoolSize: 1,
      minPoolSize: 0,
      connectTimeoutMS: 10_000,
      serverSelectionTimeoutMS: 10_000,
      timeoutMS: 10_000,
    });

    try {
      await client.connect();
      // Perform an actual database read without accessing anyone's finance records.
      await client.db(databaseName).collection("_systemHealth").findOne(
        { _id: "scheduled-database-check" },
        { projection: { _id: 1 }, maxTimeMS: 5_000 },
      );
    } finally {
      await client.close();
    }

    console.info("Scheduled database health check succeeded.");
  } catch {
    // Driver errors can contain connection details; never forward them to host logs.
    console.error("Scheduled database health check failed. Check Atlas availability and network access.");
    throw new Error("Scheduled database health check failed.");
  }
}
