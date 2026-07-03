import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
	schema: "prisma/project.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: process.env.DIRECT_PROJECT_URL,
	},
});
