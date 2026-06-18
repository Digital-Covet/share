import "dotenv/config";
import { defineConfig } from "prisma/config";

function resolveDatasourceUrl(): string {
	const schemaArg = process.argv.find((a) => a.startsWith("--schema"));
	let schemaPath: string | undefined;

	if (schemaArg?.includes("=")) {
		schemaPath = schemaArg.split("=")[1];
	} else {
		const idx = process.argv.indexOf("--schema");
		if (idx !== -1) schemaPath = process.argv[idx + 1];
	}

	if (schemaPath?.includes("auth")) {
		const url = process.env.DIRECT_AUTH_URL;
		if (!url) throw new Error("Missing DIRECT_AUTH_URL for auth migrations");
		return url;
	}

	const url = process.env.DIRECT_PROJECT_URL;
	if (!url) throw new Error("Missing DIRECT_PROJECT_URL for project migrations");
	return url;
}

export default defineConfig({
	schema: "prisma/project.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: resolveDatasourceUrl(),
	},
});
