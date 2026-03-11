import { MongoClient } from "mongodb";

// Singleton pattern — reuses connection across serverless invocations
const globalForMongo = globalThis as unknown as { _mongoClient?: MongoClient };

export async function getMongoDb(dbName = "axigrade") {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set.");
  }

  if (!globalForMongo._mongoClient) {
    globalForMongo._mongoClient = new MongoClient(process.env.DATABASE_URL);
  }

  await globalForMongo._mongoClient.connect();
  return globalForMongo._mongoClient.db(dbName);
}
