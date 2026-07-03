import { getRequestEvent } from "solid-js/web";
import { auth } from "./auth";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/**
 * The `id` field is the `userId` claim extracted from the central ID Token
 * (via the getUserInfo callback in auth.ts). All local ACL/permission
 * checks resolve identity against this central userId claim.
 */

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
  };
}

export async function requireUser(
  source?: SessionHeaderSource,
): Promise<AuthUser> {
  const user = await getCurrentUser(source);
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
