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
