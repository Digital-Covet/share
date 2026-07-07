import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/auth.prisma",
	migrations: {
		path: "prisma/auth-migrations",
	},
	datasource: {
		url: process.env.DIRECT_AUTH_URL ?? process.env.DIRECT_PROJECT_URL,
	},
});
