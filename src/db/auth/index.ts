import "dotenv/config";
import { PrismaClient } from "@generated/auth/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_AUTH_URL;

if (!connectionString) {
  throw new Error("Missing environment variable: DATABASE_AUTH_URL");
}

const poolMax = Number.parseInt(process.env.DATABASE_AUTH_POOL_MAX ?? "5", 10);
const idleTimeoutMillis = Number.parseInt(
  process.env.DATABASE_AUTH_POOL_IDLE_TIMEOUT_MS ?? "10000",
  10,
);
const connectionTimeoutMillis = Number.parseInt(
  process.env.DATABASE_AUTH_POOL_CONNECTION_TIMEOUT_MS ?? "5000",
  10,
);

type PrismaGlobal = {
  prismaAuth?: PrismaClient;
};

const globalForPrisma = globalThis as typeof globalThis & PrismaGlobal;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
    idleTimeoutMillis:
      Number.isFinite(idleTimeoutMillis) && idleTimeoutMillis >= 0
        ? idleTimeoutMillis
        : 10000,
    connectionTimeoutMillis:
      Number.isFinite(connectionTimeoutMillis) && connectionTimeoutMillis >= 0
        ? connectionTimeoutMillis
        : 5000,
  });

  return new PrismaClient({
    adapter,
  });
}

export const prisma = globalForPrisma.prismaAuth ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaAuth = prisma;
}
