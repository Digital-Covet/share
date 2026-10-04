import { describe, expect, it } from "vitest";
import { isProtectedRoute } from "./protected-routes";

describe("isProtectedRoute", () => {
  it.each(["/", "/dashboard", "/upload", "/recieve", "/recieve/x"])(
    "protects %s",
    (path) => expect(isProtectedRoute(path)).toBe(true),
  );

  it.each(["/auth/login", "/s/abc", "/recieved"])("leaves %s public", (path) =>
    expect(isProtectedRoute(path)).toBe(false),
  );
});
