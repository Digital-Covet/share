import { betterAuth } from "better-auth";

export const auth = betterAuth({
  baseURL: {
    allowedHosts: ["share.digitalcovet.com", "localhost:5173"],
    protocol: process.env.NODE_ENV === "production" ? "https" : "http",
  },
});
