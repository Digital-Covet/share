const IP_HASH_SALT = process.env.IP_HASH_SALT;

export async function hashIp(ip: string): Promise<string> {
	const salt = IP_HASH_SALT;
	if (!salt) {
		console.warn("[ip-hash] IP_HASH_SALT not set — using fallback");
	}
	const data = new TextEncoder().encode(`${salt ?? "fallback"}:${ip}`);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
