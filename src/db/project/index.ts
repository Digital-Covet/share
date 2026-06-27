import "dotenv/config";
import { PrismaClient } from "@generated/project/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_PROJECT_URL;

if (!connectionString) {
  throw new Error("Missing environment variable: DATABASE_PROJECT_URL");
}

const adapter = new PrismaPg({ connectionString });

const client = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

type ExtendedPrismaClient = typeof client;

const globalForPrisma = globalThis as unknown as {
  prismaProject?: ExtendedPrismaClient;
};

if (!globalForPrisma.prismaProject) {
  globalForPrisma.prismaProject = client;
}

export const prisma = globalForPrisma.prismaProject;
