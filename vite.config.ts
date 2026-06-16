import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [solidStart(), nitro(), tailwindcss()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@generated": path.resolve(__dirname, "./generated"),
		},
	},
});
