# Directory Structure
```
src/components/auth/auth-guard.tsx
src/components/auth/sign-out-button.tsx
src/components/sidebar/AccountMenu.tsx
src/lib/auth-client.ts
src/lib/auth.server.ts
src/middleware.ts
src/routes/auth/login.tsx
src/routes/index.tsx
```

# Files

## File: src/components/auth/auth-guard.tsx
```typescript
import { type JSX, Show } from "solid-js";
interface AuthGuardProps {
  children: JSX.Element;
  isChecking?: boolean;
}
export default function AuthGuard(props: AuthGuardProps) {
  return (
    <Show
      when={!props.isChecking}
      fallback={
        <div class="flex h-screen items-center justify-center">Loading...</div>
      }
    >
      {props.children}
    </Show>
  );
}
```

## File: src/components/auth/sign-out-button.tsx
```typescript
import { LogOut } from "lucide-solid";
import { createSignal } from "solid-js";
import { authClient } from "@/lib/auth-client";
const IAM_BASE_URL = import.meta.env.VITE_BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";
interface SignOutButtonProps {
	class?: string;
	showIcon?: boolean;
	label?: string;
}
export default function SignOutButton(props: SignOutButtonProps) {
	const [isLoading, setIsLoading] = createSignal(false);
	const handleSignOut = async () => {
		setIsLoading(true);
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						window.location.href = `${IAM_BASE_URL}/auth/login`;
					},
				},
			});
		} catch (error) {
			console.error("Sign out failed:", error);
			window.location.href = `${IAM_BASE_URL}/auth/login`;
		} finally {
			setIsLoading(false);
		}
	};
	return (
		<button
			type="button"
			onClick={handleSignOut}
			disabled={isLoading()}
			class={
				props.class ??
				"inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
			}
		>
			{props.showIcon !== false && <LogOut class="size-4" />}
			{props.label ?? (isLoading() ? "Signing out..." : "Sign out")}
		</button>
	);
}
```

## File: src/components/sidebar/AccountMenu.tsx
```typescript
import { Menu } from "@ark-ui/solid/menu";
import { ChevronDown, Settings, User } from "lucide-solid";
import { type Component, createSignal, onMount, Show } from "solid-js";
import { authClient } from "@/lib/auth-client";
const PORTFOLIO_API_BASE = "https://portfolio.digitalcovet.com/api/public/file";
const IAM_BASE_URL = import.meta.env.VITE_BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";
function getAvatarUrl(imageKey: string | null): string | null {
  if (!imageKey) return null;
  return `${PORTFOLIO_API_BASE}?key=${encodeURIComponent(imageKey)}`;
}
export const AccountMenu: Component = () => {
  const [user, setUser] = createSignal<{
    name: string;
    email: string;
    image: string | null;
  } | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);
  onMount(async () => {
    try {
      const session = await authClient.getSession();
      if (session.data?.user) {
        setUser({
          name: session.data.user.name,
          email: session.data.user.email,
          image: session.data.user.image ?? null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch session:", error);
    } finally {
      setIsLoading(false);
    }
  });
  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      window.location.href = `${IAM_BASE_URL}/auth/login`;
    }
  };
  const menuItems = [
    { label: "View profile", icon: User, value: "profile" },
    { label: "Account", icon: Settings, value: "account" },
  ];
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  return (
    <Show when={!isLoading()} fallback={<div class="h-10" />}>
      <Show when={user()}>
        <Menu.Root positioning={{ placement: "top-start" }}>
          <Menu.Trigger class="w-full flex items-center justify-between gap-3 px-3 py-2 lg:px-4 rounded-lg outline outline-border hover:bg-background/5">
            <span class="flex items-center gap-3">
              <Show
                when={user()?.image != null}
                fallback={
                  <div class="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {getInitials(user()?.name ?? "")}
                  </div>
                }
              >
                <img
                  src={getAvatarUrl(user()?.image ?? null) ?? ""}
                  alt="Avatar"
                  class="size-8 rounded-full"
                />
              </Show>
              <span class="text-left">
                <span class="block text-sm font-medium text-foreground">
                  {user()?.name}
                </span>
                <span class="block text-xs text-muted-foreground">
                  {user()?.email}
                </span>
              </span>
            </span>
            <ChevronDown class="size-4 text-muted-foreground" />
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content class="z-50 rounded-xl bg-background shadow-xl outline outline-border overflow-hidden min-w-[calc(var(--reference-width)-1rem)]">
              <div class="p-2 text-sm">
                {menuItems.map((item) => (
                  <Menu.Item
                    value={item.value}
                    class="flex items-center justify-between h-9 px-2 rounded-md text-muted-foreground hover:bg-background/5"
                  >
                    <span class="flex items-center gap-2">
                      <item.icon class="size-4" />
                      {item.label}
                    </span>
                  </Menu.Item>
                ))}
              </div>
              <Menu.Separator class="border-t border-border" />
              <div class="p-2">
                <Menu.Item
                  value="sign-out"
                  onSelect={handleSignOut}
                  class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md text-muted-foreground bg-muted outline outline-border hover:opacity-90 focus-visible:outline-border h-7 px-3 text-xs w-full"
                >
                  Sign out
                </Menu.Item>
              </div>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </Show>
    </Show>
  );
};
```

## File: src/lib/auth.server.ts
```typescript
import { getRequestEvent } from "solid-js/web";
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}
const AUTH_BASE_URL = process.env.BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";
type SessionHeaderSource = Request;
function buildSessionHeaders(source?: SessionHeaderSource): Headers | null {
  if (source) {
    return new Headers(source.headers);
  }
  const event = getRequestEvent();
  if (!event) return null;
  return new Headers(event.request.headers);
}
export async function getSession(source?: SessionHeaderSource) {
  const headers = buildSessionHeaders(source);
  if (!headers) return null;
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const res = await fetch(`${AUTH_BASE_URL}/api/auth/get-session`, {
    headers: { cookie },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.session ? data : null;
}
export async function getCurrentUser(
  source?: SessionHeaderSource,
): Promise<AuthUser | null> {
  const session = await getSession(source);
  if (!session?.user) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: (u.image as string | null | undefined) ?? null,
  };
}
export async function requireUser(
  source?: SessionHeaderSource,
): Promise<AuthUser> {
  const user = await getCurrentUser(source);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
```

## File: src/middleware.ts
```typescript
import { createMiddleware } from "@solidjs/start/middleware";
import { hashIp } from "@/lib/ip-hash";
import { getSession } from "@/lib/auth.server";
const R2_ENDPOINT = "https://63a1e79156c2df895c7be8b7506e2fcb.r2.cloudflarestorage.com";
const CSP = [
  "default-src 'none'",
  `connect-src 'self' ${R2_ENDPOINT}`,
  `worker-src 'self' blob:`,
  `media-src 'self' ${R2_ENDPOINT}`,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
const IAM_LOGIN_URL = process.env.BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";
const PROTECTED_PREFIXES = ["/dashboard", "/upload"];
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
export default createMiddleware({
  onRequest: async (event) => {
    const headers = new Headers(event.request.headers);
    const forwarded = headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "0.0.0.0";
    const ipHash = await hashIp(ip);
    event.locals.user = null;
    event.locals.ipHash = ipHash;
    const url = new URL(event.request.url);
    if (url.pathname.startsWith("/api/")) {
      return;
    }
    if (isProtectedRoute(url.pathname)) {
      const session = await getSession(event.request);
      if (!session?.user) {
        const redirectUrl = `${IAM_LOGIN_URL}/auth/login?redirect=${encodeURIComponent(url.href)}`;
        return new Response(null, {
          status: 302,
          headers: { Location: redirectUrl },
        });
      }
      event.locals.user = session.user;
    }
  },
  onBeforeResponse: (event) => {
    event.response.headers.set("Content-Security-Policy", CSP);
    event.response.headers.set("X-Frame-Options", "DENY");
    event.response.headers.set("X-Content-Type-Options", "nosniff");
    event.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    event.response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  },
});
```

## File: src/routes/index.tsx
```typescript
import { Meta, Title } from "@solidjs/meta";
import { Navigate } from "@solidjs/router";
import { pageMetadata } from "@/lib/seo";
export default function Home() {
	return (
		<>
			<Title>{pageMetadata.home.title}</Title>
			<Meta name="description" content={pageMetadata.home.description} />
			<Navigate href="/dashboard" />
		</>
	);
}
```

## File: src/lib/auth-client.ts
```typescript
import { createAuthClient } from "better-auth/solid";
import { twoFactorClient } from "better-auth/client/plugins";
const AUTH_BASE_URL =
  typeof window === "undefined"
    ? process.env.BETTER_AUTH_URL
    : import.meta.env.VITE_BETTER_AUTH_URL;
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        if (typeof window !== "undefined") {
          window.location.href = "/auth/verify-2fa";
        }
      },
    }),
  ],
});
```

## File: src/routes/auth/login.tsx
```typescript
import { Meta, Title } from "@solidjs/meta";
import { pageMetadata } from "@/lib/seo";
const IAM_BASE_URL = import.meta.env.VITE_BETTER_AUTH_URL ?? "https://iam.digitalcovet.com";
export default function LoginRedirect() {
  const redirectUrl = `${IAM_BASE_URL}/auth/login?redirect=${encodeURIComponent(`${window.location.origin}/dashboard`)}`;
  return (
    <>
      <Title>{pageMetadata.login.title}</Title>
      <Meta name="description" content={pageMetadata.login.description} />
      <script>
        {`window.location.replace(${JSON.stringify(redirectUrl)});`}
      </script>
      <main class="h-screen w-screen flex items-center justify-center">
        <p class="text-muted-foreground">Redirecting to sign in...</p>
      </main>
    </>
  );
}
```
