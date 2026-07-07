import "dotenv/config";
import { PrismaClient } from "@generated/auth/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
	process.env.DATABASE_AUTH_URL ?? process.env.DATABASE_PROJECT_URL;

if (!connectionString) {
	throw new Error(
		"Missing environment variable: DATABASE_AUTH_URL or DATABASE_PROJECT_URL",
	);
}

const adapter = new PrismaPg({ connectionString });

const client = new PrismaClient({
	adapter,
	log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

type ExtendedPrismaClient = typeof client;

const globalForPrisma = globalThis as unknown as {
	prismaAuth?: ExtendedPrismaClient;
};

if (!globalForPrisma.prismaAuth) {
	globalForPrisma.prismaAuth = client;
}

export const prisma = globalForPrisma.prismaAuth;
