# Directory Structure
```
src/app.tsx
src/entry-client.tsx
src/entry-server.tsx
src/routes/index.tsx
vite.config.ts
```

# Files

## File: src/app.tsx
```typescript
import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "@fontsource-variable/jost";
import "@fontsource-variable/rubik";
import "./app.css";
export default function App() {
	return (
		<Router
			root={(props) => (
				<MetaProvider>
					<Suspense>{props.children}</Suspense>
				</MetaProvider>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
```

## File: src/entry-client.tsx
```typescript
import { mount, StartClient } from "@solidjs/start/client";
mount(() => <StartClient />, document.getElementById("app")!);
```

## File: src/entry-server.tsx
```typescript
import { createHandler, StartServer } from "@solidjs/start/server";
export default createHandler(() => (
	<StartServer
		document={({ assets, children, scripts }) => (
			<html lang="en">
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<link rel="icon" href="/favicon.ico" />
					{assets}
				</head>
				<body>
					<div id="app">{children}</div>
					{scripts}
				</body>
			</html>
		)}
	/>
));
```

## File: src/routes/index.tsx
```typescript
import { Navigate } from "@solidjs/router";
export default function Home() {
	return <Navigate href="/auth/login" />;
}
```

## File: vite.config.ts
```typescript
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
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules")) {
						if (/better-auth[\\/]/.test(id)) return "better-auth";
						if (/@aws-sdk[\\/]/.test(id)) return "aws-sdk";
						if (/@prisma[\\/]/.test(id)) return "prisma";
						if (/@ark-ui[\\/]/.test(id)) return "ark-ui";
						if (/solid-js[\\/]/.test(id)) return "solid-js";
						if (/lucide-solid[\\/]/.test(id)) return "lucide";
					}
				},
			},
		},
	},
});
```
