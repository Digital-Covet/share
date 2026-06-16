# Directory Structure
```
prisma/auth.prisma
src/components/auth/auth-guard.tsx
src/components/auth/sign-out-button.tsx
src/components/auth/two-factor-verify.tsx
src/db/auth/index.ts
src/lib/auth-client.ts
src/lib/auth.server.ts
src/lib/auth.ts
src/routes/api/auth/[...auth].ts
src/routes/auth/forgot-password.tsx
src/routes/auth/login.tsx
src/routes/auth/reset-password.tsx
src/routes/auth/verify-2fa.tsx
src/types/auth.ts
```

# Files

## File: prisma/auth.prisma
```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/auth"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  employee
  admin
  superadmin
}

model User {
  id                  String       @id
  name                String
  email               String
  emailVerified       Boolean      @default(false)
  image               String?

  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  twoFactorEnabled    Boolean?     @default(false)
  passwordChanged     Boolean      @default(false)

  role                UserRole     @default(employee)

  banned              Boolean?     @default(false)
  banReason           String?
  banExpires          DateTime?

  departmentId        String?

  sessions            Session[]
  accounts            Account[]
  twofactors          TwoFactor[]

  invitations         Invitation[] @relation("InvitationInvitedBy")
  assignedInvitations Invitation[] @relation("InvitationUser")

  @@unique([email])
  @@index([departmentId])
  @@map("user")
}

model Session {
  id             String   @id
  expiresAt      DateTime
  token          String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  ipAddress      String?
  userAgent      String?

  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  impersonatedBy String?

  @@unique([token])
  @@index([userId])
  @@index([userId, expiresAt])
  @@map("session")
}

model Account {
  id                    String    @id

  accountId             String
  providerId            String

  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  accessToken           String?
  refreshToken          String?
  idToken               String?

  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?

  scope                 String?
  password              String?

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id

  identifier String
  value      String
  expiresAt  DateTime

  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@index([identifier, expiresAt])
  @@map("verification")
}

model TwoFactor {
  id          String   @id

  secret      String
  backupCodes String

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  verified    Boolean? @default(true)

  @@index([userId])
  @@map("twoFactor")
}

model Invitation {
  id         String    @id @default(cuid())

  email      String

  token      String    @unique

  role       UserRole  @default(employee)

  expiresAt  DateTime  @map("expires_at")
  usedAt     DateTime? @map("used_at")

  createdAt  DateTime  @default(now()) @map("created_at")

  invitedBy  String?   @map("invited_by")
  userId     String?   @map("user_id")

  invitedByUser User? @relation("InvitationInvitedBy", fields: [invitedBy], references: [id])

  user User? @relation("InvitationUser", fields: [userId], references: [id])

  @@index([email])
  @@map("invitations")
}
```

## File: src/components/auth/auth-guard.tsx
```typescript
import { useNavigate } from "@solidjs/router";
import { Show, createEffect, createSignal, type JSX } from "solid-js";
import { authClient } from "@/lib/auth-client";
interface AuthGuardProps {
	children: JSX.Element;
	redirectTo?: string;
}
export default function AuthGuard(props: AuthGuardProps) {
	const navigate = useNavigate();
	const [isChecking, setIsChecking] = createSignal(true);
	createEffect(() => {
		const checkSession = async () => {
			try {
				const session = await authClient.getSession();
				if (!session.data) {
					navigate(props.redirectTo ?? "/auth/login", { replace: true });
					return;
				}
			} catch {
				navigate(props.redirectTo ?? "/auth/login", { replace: true });
				return;
			} finally {
				setIsChecking(false);
			}
		};
		checkSession();
	});
	return (
		<Show
			when={!isChecking()}
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
import { useNavigate } from "@solidjs/router";
import { LogOut } from "lucide-solid";
import { createSignal } from "solid-js";
import { authClient } from "@/lib/auth-client";
interface SignOutButtonProps {
	class?: string;
	showIcon?: boolean;
	label?: string;
}
export default function SignOutButton(props: SignOutButtonProps) {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = createSignal(false);
	const handleSignOut = async () => {
		setIsLoading(true);
		try {
			await authClient.signOut({
				fetchOptions: {
					onSuccess: () => {
						navigate("/auth/login", { replace: true });
					},
				},
			});
		} catch (error) {
			console.error("Sign out failed:", error);
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

## File: src/components/auth/two-factor-verify.tsx
```typescript
import { Field } from "@ark-ui/solid/field";
import { PinInput } from "@ark-ui/solid/pin-input";
import { Toast, Toaster, createToaster } from "@ark-ui/solid/toast";
import { useNavigate } from "@solidjs/router";
import { XIcon } from "lucide-solid";
import { Show, createEffect, createSignal, For, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { authClient } from "@/lib/auth-client";
interface TwoFactorVerifyProps {
	redirectTo?: string;
	onVerified?: () => void;
}
type AuthMode = "totp" | "backup";
export default function TwoFactorVerify({
	redirectTo = "/dashboard",
	onVerified,
}: TwoFactorVerifyProps) {
	const navigate = useNavigate();
	const toaster = createToaster({
		placement: "top",
		overlap: true,
		gap: 24,
	});
	const [mode, setMode] = createSignal<AuthMode>("totp");
	const [code, setCode] = createSignal("");
	const [isLoading, setIsLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [cooldown, setCooldown] = createSignal(0);
	const [pinKey, setPinKey] = createSignal(0);
	createEffect(() => {
		const remaining = cooldown();
		if (remaining <= 0) return;
		const timer = setTimeout(() => {
			setCooldown((current) => Math.max(0, current - 1));
		}, 1000);
		onCleanup(() => clearTimeout(timer));
	});
	const validateInput = (): boolean => {
		if (mode() === "totp") {
			return /^\d{6}$/.test(code());
		}
		return code().trim().length >= 8;
	};
	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();
		if (cooldown() > 0) return;
		if (!validateInput()) {
			setError(
				mode() === "totp"
					? "Please enter a valid 6-digit code."
					: "Please enter a valid backup code.",
			);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			let response: { error?: { message?: string } | null } | undefined;
			if (mode() === "totp") {
				response = await authClient.twoFactor.verifyTotp({
					code: code(),
					trustDevice: false,
				});
			} else {
				response = await authClient.twoFactor.verifyBackupCode({
					code: code(),
					trustDevice: false,
				});
			}
			if (response?.error) {
				throw new Error(response.error.message ?? "Verification failed");
			}
			toaster.create({
				title: "Verification successful!",
				type: "success",
			});
			onVerified?.();
			navigate(redirectTo, { replace: true });
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Invalid code. Please try again.";
			setError(message);
			setCooldown(5);
			setCode("");
			setPinKey((k) => k + 1);
			toaster.create({
				title: message,
				type: "error",
			});
		} finally {
			setIsLoading(false);
		}
	};
	const toggleMode = () => {
		setMode((prev) => (prev === "totp" ? "backup" : "totp"));
		setCode("");
		setPinKey((k) => k + 1);
		setError(null);
	};
	const disabled = () => isLoading() || cooldown() > 0;
	const isTotp = () => mode() === "totp";
	return (
		<div class="space-y-4">
			<form onSubmit={handleSubmit} class="space-y-4">
				<Field.Root invalid={error() !== null} disabled={disabled()}>
					<div class="space-y-3">
						<Field.Label class="block text-center text-sm font-medium">
							{isTotp() ? "Authenticator code" : "Backup code"}
						</Field.Label>
						{isTotp() ? (
							<Show keyed when={pinKey() + 1}>
								<PinInput.Root
									onValueChange={({ value }) => {
										setCode(value.join(""));
										setError(null);
									}}
									count={6}
									otp
									type="numeric"
									disabled={disabled()}
									invalid={error() !== null}
									aria-label="Authenticator code"
								>
									<PinInput.Control class="flex justify-center gap-2">
										<For each={Array.from({ length: 6 }, (_, index) => index)}>
											{(index) => (
												<PinInput.Input
													index={index}
													class="h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
												/>
											)}
										</For>
									</PinInput.Control>
									<PinInput.HiddenInput />
								</PinInput.Root>
							</Show>
						) : (
							<Field.Input
								id="code"
								type="text"
								autocomplete="off"
								maxlength={24}
								value={code()}
								onInput={(e) => {
									setCode(e.currentTarget.value);
									setError(null);
								}}
								disabled={disabled()}
								placeholder="8+ character backup code"
								class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							/>
						)}
					</div>
					{error() && (
						<Field.ErrorText class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
							{error()}
						</Field.ErrorText>
					)}
				</Field.Root>
				<button
					type="submit"
					class="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
					disabled={disabled() || code().length === 0}
				>
					{isLoading()
						? "Verifying..."
						: cooldown() > 0
							? `Try again in ${cooldown()}s`
							: "Verify code"}
				</button>
			</form>
			<div class="relative py-2">
				<div class="absolute inset-0 flex items-center">
					<div class="w-full border-t" />
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-background px-2 text-muted-foreground">
						Having trouble?
					</span>
				</div>
			</div>
			<button
				type="button"
				onClick={toggleMode}
				class="inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent bg-transparent px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
			>
				{isTotp()
					? "Use a backup code instead"
					: "Use authenticator app instead"}
			</button>
			<Portal>
				<Toaster toaster={toaster}>
					{(toast) => (
						<Toast.Root class="flex flex-col gap-1 items-start relative p-4 pr-10 rounded-lg bg-background border shadow-lg">
							<Toast.Title class="text-sm font-medium">
								{toast().title}
							</Toast.Title>
							<Toast.CloseTrigger class="absolute top-1 right-1 p-1 rounded-md hover:bg-muted transition-colors">
								<XIcon class="size-4" />
							</Toast.CloseTrigger>
						</Toast.Root>
					)}
				</Toaster>
			</Portal>
		</div>
	);
}
```

## File: src/db/auth/index.ts
```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/auth/client";
const connectionString = process.env.DATABASE_AUTH_URL;
if (!connectionString) {
	throw new Error("Missing environment variable: DATABASE_AUTH_URL");
}
type PrismaGlobal = {
	prismaAuth?: PrismaClient;
};
const globalForPrisma = globalThis as typeof globalThis & PrismaGlobal;
const adapter = new PrismaPg({ connectionString });
export const prisma =
	globalForPrisma.prismaAuth ??
	new PrismaClient({
		adapter,
	});
if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prismaAuth = prisma;
}
```

## File: src/lib/auth-client.ts
```typescript
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/solid";
export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined" ? process.env.BETTER_AUTH_URL : undefined,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        localStorage.setItem("pending2FA", "true");
        window.location.href = "/auth/verify-2fa";
      },
    }),
    emailOTPClient(),
  ],
});
```

## File: src/lib/auth.server.ts
```typescript
import { getRequestEvent } from "solid-js/web";
import { z } from "zod";
import type { AuthUser, UserRole } from "@/types/auth";
import { auth } from "./auth";
const UserRoleSchema = z
	.enum(["employee", "admin", "superadmin"])
	.catch("employee");
const ROLE_LEVEL: Record<UserRole, number> = {
	employee: 0,
	admin: 1,
	superadmin: 2,
};
type SessionHeaderSource = Request | Headers;
function buildSessionHeaders(source?: SessionHeaderSource): Headers | null {
	if (source instanceof Headers) {
		return new Headers(source);
	}
	if (source instanceof Request) {
		return new Headers(source.headers);
	}
	const event = getRequestEvent();
	if (!event) return null;
	return new Headers(event.request.headers);
}
export async function getSession(source?: SessionHeaderSource) {
	const headers = buildSessionHeaders(source);
	if (!headers) return null;
	return auth.api.getSession({ headers });
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
		role: UserRoleSchema.parse(u.role),
		departmentId: (u.departmentId as string | null | undefined) ?? null,
		emailVerified: u.emailVerified ?? false,
		twoFactorEnabled: u.twoFactorEnabled ?? false,
		passwordChanged: (u.passwordChanged as boolean | undefined) ?? false,
	};
}
export async function requireUser(
	source?: SessionHeaderSource,
): Promise<AuthUser> {
	const user = await getCurrentUser(source);
	if (!user) throw new Error("UNAUTHORIZED");
	return user;
}
export async function requireRole(
	minRole: UserRole,
	source?: SessionHeaderSource,
): Promise<AuthUser> {
	const user = await requireUser(source);
	if (ROLE_LEVEL[user.role] < ROLE_LEVEL[minRole]) {
		throw new Error("FORBIDDEN");
	}
	return user;
}
```

## File: src/lib/auth.ts
```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin, emailOTP, twoFactor } from "better-auth/plugins";
import { prisma } from "@/db/auth";
import { sendEmail } from "@/services/email";
import { renderDeleteVerificationEmail } from "@/services/email-templates";
import { ac, adminRole, employeeRole, superadminRole } from "./permissions";
export const auth = betterAuth({
	trustedOrigins: ["https://send.digitalcovet.com", "http://localhost:3000", "http://localhost:5173"],
	database: prismaAdapter(prisma, {
		provider: "postgresql",
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }, _request) => {
			try {
				await sendEmail({
					to: user.email,
					subject: "Reset your password",
					text: `Click the link to reset your password: ${url}`,
				});
			} catch (error) {
				console.error(
					"[Auth Hook] Failed to send reset password email:",
					error instanceof Error ? error.message : error,
				);
				throw new Error("Failed to send reset password email.");
			}
		},
	},
	emailVerification: {
		sendOnSignUp: true,
		sendOnSignIn: true,
		sendVerificationEmail: async ({ user, url }, _request) => {
			try {
				await sendEmail({
					to: user.email,
					subject: "Verify your email address",
					text: `Click the link to verify your email: ${url}`,
				});
			} catch (error) {
				console.error(
					"[Auth Hook] Failed to send verification email:",
					error instanceof Error ? error.message : error,
				);
				throw new Error("Failed to send verification email.");
			}
		},
	},
	user: {
		additionalFields: {
			departmentId: {
				type: "string",
				required: false,
				defaultValue: null,
			},
			passwordChanged: {
				type: "boolean",
				required: false,
				defaultValue: false,
			},
		},
	},
	plugins: [
		twoFactor({
			issuer: "Digital Covet",
		}),
		adminPlugin({
			defaultRole: "employee",
			ac,
			roles: {
				superadmin: superadminRole,
				admin: adminRole,
				employee: employeeRole,
			},
		}),
		emailOTP({
			async sendVerificationOTP({ email, otp, type }) {
				const username = email.split("@")[0];
				const { html, text } = renderDeleteVerificationEmail({
					username,
					otp,
				});
				const subject =
					type === "sign-in"
						? "Your verification code"
						: type === "email-verification"
							? "Verify your email"
							: "Reset your password";
				try {
					await sendEmail({
						to: email,
						subject,
						text,
						html,
					});
				} catch (error) {
					console.error(
						"[Auth Hook] Failed to send OTP email:",
						error instanceof Error ? error.message : error,
					);
					throw new Error("Failed to send verification code.");
				}
			},
		}),
	],
});
```

## File: src/routes/api/auth/[...auth].ts
```typescript
import { toSolidStartHandler } from "better-auth/solid-start";
import { auth } from "@/lib/auth";
export const { GET, POST } = toSolidStartHandler(auth);
```

## File: src/routes/auth/forgot-password.tsx
```typescript
import { Field } from "@ark-ui/solid/field";
import { Toast, Toaster, createToaster } from "@ark-ui/solid/toast";
import { A } from "@solidjs/router";
import { ArrowLeft, Mail, X, XIcon } from "lucide-solid";
import { type Component, createSignal, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { authClient } from "@/lib/auth-client";
const linkClass = "font-medium text-foreground hover:text-muted-foreground";
const ForgotPasswordForm: Component = () => {
	const [email, setEmail] = createSignal("");
	const [isLoading, setIsLoading] = createSignal(false);
	const [submitted, setSubmitted] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const toaster = createToaster({
		placement: "top",
		overlap: true,
		gap: 24,
	});
	const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
		e,
	) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);
		try {
			const response = await authClient.requestPasswordReset({
				email: email(),
				redirectTo: "/auth/reset-password",
			});
			if (response.error) {
				throw new Error(response.error.message ?? "Failed to send reset link");
			}
			setSubmitted(true);
			toaster.create({
				title: "Reset link sent! Check your email.",
				type: "success",
			});
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to send reset link";
			setError(message);
			toaster.create({
				title: message,
				type: "error",
			});
		} finally {
			setIsLoading(false);
		}
	};
	return (
		<main class="h-screen w-screen flex items-center justify-center">
			<div class="max-w-md p-8 mx-auto shadow bg-linear-180 outline outline-border from-muted to-background rounded-xl">
				<div class="text-center lg:text-balance">
					<h1 class="font-heading text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
						{submitted() ? "Check your email" : "Forgot your password?"}
					</h1>
					<p class="text-base mt-2 text-muted-foreground text-balance">
						{submitted()
							? "We've sent a password reset link to your email address."
							: "No worries. Enter the email tied to your account and we'll send you a link to reset it."}
					</p>
				</div>
				<Show when={!submitted()}>
					<form class="mt-10 space-y-4" onSubmit={handleSubmit}>
						<Show when={error()}>
							<div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
								{error()}
							</div>
						</Show>
						{}
						<Field.Root class="w-full" required disabled={isLoading()}>
							<Field.Label class="font-medium text-muted-foreground text-sm mb-1 block">
								Email Address
							</Field.Label>
							<div class="relative z-0 focus-within:z-10">
								<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
									<Mail
										class="size-4 text-muted-foreground"
										aria-hidden="true"
									/>
								</div>
								<Field.Input
									name="email"
									type="email"
									inputmode="email"
									autocomplete="email"
									placeholder="you@example.com"
									class="block w-full h-10 px-4 py-2 pl-10 pr-10 text-sm leading-tight align-middle rounded-md bg-background text-foreground shadow-sm border border-transparent ring-1 ring-border placeholder:text-muted-foreground transition duration-300 ease-in-out focus:z-10 focus:border-border focus:ring-2 focus:ring-border focus:outline-none"
									value={email()}
									onInput={(e) => setEmail(e.currentTarget.value)}
								/>
								<Show when={email()}>
									<div class="absolute inset-y-0 right-0 flex items-center pr-3">
										<button
											type="button"
											class="text-muted-foreground hover:text-foreground focus:outline-none"
											aria-label="Clear email"
											onClick={() => setEmail("")}
										>
											<X class="size-4" aria-hidden="true" />
										</button>
									</div>
								</Show>
							</div>
						</Field.Root>
						{}
						<button
							type="submit"
							disabled={isLoading()}
							class="relative flex w-full h-10 px-5 items-center justify-center text-sm font-medium text-center select-none rounded-md bg-primary text-primary-foreground outline outline-primary transition-colors duration-200 ease-in-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:z-10 disabled:pointer-events-none disabled:opacity-50"
						>
							{isLoading() ? "Sending..." : "Send reset link"}
						</button>
					</form>
				</Show>
				{}
				<p class="text-xs mt-4 font-medium text-muted-foreground flex items-center justify-center">
					<A
						href="/auth/login"
						class={`${linkClass} inline-flex items-center gap-1.5`}
					>
						<ArrowLeft class="size-3.5" aria-hidden="true" />
						Back to sign in
					</A>
				</p>
			</div>
			<Portal>
				<Toaster toaster={toaster}>
					{(toast) => (
						<Toast.Root class="flex flex-col gap-1 items-start relative p-4 pr-10 rounded-lg bg-background border shadow-lg">
							<Toast.Title class="text-sm font-medium">
								{toast().title}
							</Toast.Title>
							<Toast.CloseTrigger class="absolute top-1 right-1 p-1 rounded-md hover:bg-muted transition-colors">
								<XIcon class="size-4" />
							</Toast.CloseTrigger>
						</Toast.Root>
					)}
				</Toaster>
			</Portal>
		</main>
	);
};
export default ForgotPasswordForm;
```

## File: src/routes/auth/login.tsx
```typescript
import { Checkbox } from "@ark-ui/solid/checkbox";
import { Field } from "@ark-ui/solid/field";
import { Toast, Toaster, createToaster } from "@ark-ui/solid/toast";
import { A, useNavigate } from "@solidjs/router";
import { CheckIcon, Eye, EyeOff, Mail, X, XIcon } from "lucide-solid";
import { createSignal, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { authClient } from "@/lib/auth-client";
export default function LoginForm() {
	const navigate = useNavigate();
	const [email, setEmail] = createSignal("");
	const [password, setPassword] = createSignal("");
	const [showPassword, setShowPassword] = createSignal(false);
	const [rememberMe, setRememberMe] = createSignal(false);
	const [isLoading, setIsLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const toaster = createToaster({
		placement: "top",
		overlap: true,
		gap: 24,
	});
	const handleSubmit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (
		e,
	) => {
		e.preventDefault();
		setError(null);
		setIsLoading(true);
		try {
			const response = await authClient.signIn.email({
				email: email(),
				password: password(),
			});
			if (response.error) {
				throw new Error(response.error.message ?? "Invalid email or password");
			}
			toaster.create({
				title: "Signed in successfully!",
				type: "success",
			});
			navigate("/dashboard", { replace: true });
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Invalid email or password";
			setError(message);
			toaster.create({
				title: message,
				type: "error",
			});
		} finally {
			setIsLoading(false);
		}
	};
	return (
		<main class="h-screen w-screen flex items-center justify-center">
			<div class="max-w-md p-8 mx-auto bg-card text-card-foreground rounded-xl shadow-md">
				<div class="text-center">
					<h2 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
						Sign in
					</h2>
					<p class="text-base mt-4 text-muted-foreground text-balance">
						Welcome back! Fire up that password muscle memory, just like the
						good old dial-up days.
					</p>
				</div>
				<form class="mt-10 space-y-4" onSubmit={handleSubmit}>
					<Show when={error()}>
						<div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
							{error()}
						</div>
					</Show>
					{}
					<Field.Root class="w-full" disabled={isLoading()}>
						<Field.Label class="font-medium text-muted-foreground text-sm mb-1 block">
							Email Address
						</Field.Label>
						<div class="relative z-0 focus-within:z-10">
							<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
								<Mail class="size-4 text-muted-foreground" />
							</div>
							<Field.Input
								placeholder="you@example.com"
								name="email"
								type="email"
								inputMode="email"
								value={email()}
								onInput={(e) => setEmail(e.currentTarget.value)}
								class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 pl-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
							/>
						</div>
					</Field.Root>
					{}
					<Field.Root class="w-full" required disabled={isLoading()}>
						<Field.Label class="font-medium text-muted-foreground text-sm mb-1 block">
							Password <Field.RequiredIndicator class="text-destructive" />
						</Field.Label>
						<div class="relative z-0 focus-within:z-10">
							<Field.Input
								placeholder="••••••••"
								name="password"
								type={showPassword() ? "text" : "password"}
								value={password()}
								onInput={(e) => setPassword(e.currentTarget.value)}
								class="w-full block transition duration-300 ease-in-out leading-tight align-middle focus:z-10 h-10 px-4 py-2 text-sm rounded-md bg-background border border-border text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring focus:outline-none shadow-sm"
							/>
							<div class="absolute inset-y-0 right-0 flex items-center pr-3 gap-2">
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword())}
									class="text-muted-foreground hover:text-foreground focus:outline-none focus:text-foreground transition-colors"
									tabIndex={-1}
									aria-label={
										showPassword() ? "Hide password" : "Show password"
									}
								>
									{showPassword() ? (
										<EyeOff class="size-4" />
									) : (
										<Eye class="size-4" />
									)}
								</button>
								<Show when={password()}>
									<button
										type="button"
										onClick={() => setPassword("")}
										class="text-muted-foreground hover:text-foreground focus:outline-none focus:text-foreground transition-colors"
										aria-label="Clear password"
									>
										<X class="size-4" />
									</button>
								</Show>
							</div>
						</div>
					</Field.Root>
					{}
					<Field.Root class="w-full" data-inline>
						<Checkbox.Root
							checked={rememberMe()}
							onCheckedChange={(details) =>
								setRememberMe(details.checked === true)
							}
							class="inline-flex items-center gap-2"
						>
							<Checkbox.Control class="flex items-center justify-center shrink-0 size-4 rounded border border-border bg-background data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
								<Checkbox.Indicator class="text-primary-foreground">
									<CheckIcon class="size-3" />
								</Checkbox.Indicator>
							</Checkbox.Control>
							<Checkbox.Label class="text-sm font-medium text-muted-foreground select-none">
								Remember me for 30 days
							</Checkbox.Label>
							<Checkbox.HiddenInput name="login-remember" />
						</Checkbox.Root>
					</Field.Root>
					{}
					<button
						type="submit"
						disabled={isLoading()}
						class="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md w-full text-primary-foreground bg-primary hover:opacity-90 focus-visible:outline-ring h-10 px-5 text-sm disabled:pointer-events-none disabled:opacity-50"
					>
						{isLoading() ? "Signing in..." : "Sign in with email"}
					</button>
				</form>
				<p class="text-xs mt-4 font-medium text-muted-foreground">
					Forgot your account?{" "}
					<A
						href="/auth/forgot-password"
						class="font-medium text-foreground hover:text-primary transition-colors"
					>
						Sign up
					</A>
				</p>
			</div>
			<Portal>
				<Toaster toaster={toaster}>
					{(toast) => (
						<Toast.Root class="flex flex-col gap-1 items-start relative p-4 pr-10 rounded-lg bg-background border shadow-lg">
							<Toast.Title class="text-sm font-medium">
								{toast().title}
							</Toast.Title>
							<Toast.CloseTrigger class="absolute top-1 right-1 p-1 rounded-md hover:bg-muted transition-colors">
								<XIcon class="size-4" />
							</Toast.CloseTrigger>
						</Toast.Root>
					)}
				</Toaster>
			</Portal>
		</main>
	);
}
```

## File: src/routes/auth/reset-password.tsx
```typescript
import { Field } from "@ark-ui/solid/field";
import { PasswordInput } from "@ark-ui/solid/password-input";
import { Toast, Toaster, createToaster } from "@ark-ui/solid/toast";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import { EyeIcon, EyeOffIcon, XIcon } from "lucide-solid";
import { createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { authClient } from "@/lib/auth-client";
export default function ResetPasswordForm() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const token = searchParams.token as string | undefined;
	const [password, setPassword] = createSignal("");
	const [confirmPassword, setConfirmPassword] = createSignal("");
	const [isLoading, setIsLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const toaster = createToaster({
		placement: "top",
		overlap: true,
		gap: 24,
	});
	const handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();
		setError(null);
		if (password() !== confirmPassword()) {
			setError("Passwords do not match");
			return;
		}
		if (password().length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}
		if (!token) {
			setError("Invalid or missing reset token");
			return;
		}
		setIsLoading(true);
		try {
			const response = await authClient.resetPassword({
				newPassword: password(),
				token,
			});
			if (response.error) {
				throw new Error(response.error.message ?? "Failed to reset password");
			}
			toaster.create({
				title: "Password reset successfully!",
				type: "success",
			});
			navigate("/auth/login", { replace: true });
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to reset password";
			setError(message);
			toaster.create({
				title: message,
				type: "error",
			});
		} finally {
			setIsLoading(false);
		}
	};
	return (
		<main class="h-screen w-screen flex items-center justify-center">
			<div class="max-w-md p-8 mx-auto shadow bg-linear-180 border border-border from-muted to-background rounded-xl">
				<div class="text-center lg:text-balance">
					<h2 class="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground font-heading">
						Reset your password
					</h2>
					<p class="text-base mt-2 text-muted-foreground text-balance">
						Enter your email and choose a new password to regain access to your
						account.
					</p>
				</div>
				<form class="mt-10 space-y-4" onSubmit={handleSubmit}>
					<Show when={error()}>
						<div class="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-600">
							{error()}
						</div>
					</Show>
					<Field.Root class="w-full" required disabled={isLoading()}>
						<PasswordInput.Root
							name="password"
							autoComplete="new-password"
							required
							class="w-full"
						>
							<PasswordInput.Label class="font-medium text-muted-foreground text-sm mb-1 block">
								New Password
							</PasswordInput.Label>
							<PasswordInput.Control class="relative flex items-center">
								<PasswordInput.Input
									placeholder="••••••••"
									onInput={(e) => setPassword(e.currentTarget.value)}
									class="w-full h-10 px-4 py-2 pr-10 text-sm rounded-md bg-background border border-transparent text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-border focus:ring-border focus:ring-2 focus:outline-none shadow-sm transition duration-300 ease-in-out"
								/>
								<PasswordInput.VisibilityTrigger class="absolute right-2 flex items-center justify-center p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
									<PasswordInput.Indicator
										fallback={<EyeOffIcon class="size-4" />}
									>
										<EyeIcon class="size-4" />
									</PasswordInput.Indicator>
								</PasswordInput.VisibilityTrigger>
							</PasswordInput.Control>
						</PasswordInput.Root>
					</Field.Root>
					<Field.Root class="w-full" required disabled={isLoading()}>
						<PasswordInput.Root
							name="confirmPassword"
							autoComplete="new-password"
							required
							class="w-full"
						>
							<PasswordInput.Label class="font-medium text-muted-foreground text-sm mb-1 block">
								Confirm New Password
							</PasswordInput.Label>
							<PasswordInput.Control class="relative flex items-center">
								<PasswordInput.Input
									placeholder="••••••••"
									onInput={(e) => setConfirmPassword(e.currentTarget.value)}
									class="w-full h-10 px-4 py-2 pr-10 text-sm rounded-md bg-background border border-transparent text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:border-border focus:ring-border focus:ring-2 focus:outline-none shadow-sm transition duration-300 ease-in-out"
								/>
								<PasswordInput.VisibilityTrigger class="absolute right-2 flex items-center justify-center p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
									<PasswordInput.Indicator
										fallback={<EyeOffIcon class="size-4" />}
									>
										<EyeIcon class="size-4" />
									</PasswordInput.Indicator>
								</PasswordInput.VisibilityTrigger>
							</PasswordInput.Control>
						</PasswordInput.Root>
					</Field.Root>
					<p class="text-xs font-medium text-muted-foreground">
						Make sure your password is at least 8 characters long and includes a
						mix of letters, numbers, and symbols.
					</p>
					<button
						type="submit"
						disabled={isLoading()}
						class="relative flex items-center justify-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring rounded-md w-full h-10 px-5 text-sm text-primary-foreground bg-primary hover:opacity-90 disabled:pointer-events-none disabled:opacity-50"
					>
						{isLoading() ? "Resetting..." : "Reset password"}
					</button>
				</form>
				<p class="text-xs mt-4 font-medium text-muted-foreground">
					Remember your password?{" "}
					<A
						href="/auth/login"
						class="font-medium text-foreground hover:text-muted-foreground"
					>
						Back to sign in
					</A>
				</p>
			</div>
			<Portal>
				<Toaster toaster={toaster}>
					{(toast) => (
						<Toast.Root class="flex flex-col gap-1 items-start relative p-4 pr-10 rounded-lg bg-background border shadow-lg">
							<Toast.Title class="text-sm font-medium">
								{toast().title}
							</Toast.Title>
							<Toast.CloseTrigger class="absolute top-1 right-1 p-1 rounded-md hover:bg-muted transition-colors">
								<XIcon class="size-4" />
							</Toast.CloseTrigger>
						</Toast.Root>
					)}
				</Toaster>
			</Portal>
		</main>
	);
}
```

## File: src/routes/auth/verify-2fa.tsx
```typescript
import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import TwoFactorVerify from "@/components/auth/two-factor-verify";
export default function Verify2FAPage() {
	const navigate = useNavigate();
	onMount(() => {
		if (localStorage.getItem("pending2FA") !== "true") {
			navigate("/auth/login", { replace: true });
		}
	});
	return (
		<>
			<Title>Verify 2FA | Secure Login</Title>
			<div class="flex min-h-screen items-center justify-center p-4">
				<div class="w-full max-w-md space-y-6 p-8 shadow-md">
					<div class="text-center">
						<h1 class="text-2xl font-bold tracking-tight">
							Two-Factor Authentication
						</h1>
						<p class="mt-2 text-sm">
							Enter your security code to complete sign-in.
						</p>
					</div>
					<TwoFactorVerify
						onVerified={() => localStorage.removeItem("pending2FA")}
					/>
				</div>
			</div>
		</>
	);
}
```

## File: src/types/auth.ts
```typescript
import type { UserRole as PrismaUserRole } from "@generated/prisma/client";
export type UserRole = PrismaUserRole;
export interface AuthUser {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	departmentId: string | null;
	emailVerified: boolean;
	twoFactorEnabled: boolean;
	passwordChanged: boolean;
	image: string | null;
}
```
