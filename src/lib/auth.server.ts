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
