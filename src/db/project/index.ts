import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/project/client";

const connectionString = process.env.DATABASE_PROJECT_URL;

if (!connectionString) {
	throw new Error("Missing environment variable: DATABASE_PROJECT_URL");
}

type PrismaGlobal = {
	prismaProject?: PrismaClient;
};

const globalForPrisma = globalThis as typeof globalThis & PrismaGlobal;

const adapter = new PrismaPg({ connectionString });

export const prisma =
	globalForPrisma.prismaProject ??
	new PrismaClient({
		adapter,
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prismaProject = prisma;
}
