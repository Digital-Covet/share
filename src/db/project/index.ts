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

const base = new PrismaClient({ adapter });

export const prisma =
	globalForPrisma.prismaProject ??
	base.$extends({
		result: {
			file: {
				originalSize: {
					needs: { originalSize: true },
					compute(f) {
						return f.originalSize?.toString() ?? null;
					},
				},
				encryptedSize: {
					needs: { encryptedSize: true },
					compute(f) {
						return f.encryptedSize?.toString() ?? null;
					},
				},
			},
		},
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prismaProject = prisma as PrismaClient;
}
