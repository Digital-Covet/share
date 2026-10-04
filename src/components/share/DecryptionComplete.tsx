import { SecuritySeal } from "./SecuritySeal";

export function DecryptionComplete() {
	return (
		<section class="share-fade-in flex flex-col items-center py-4 text-center" role="status">
			<SecuritySeal />
			<h2 class="mt-3 font-display text-lg font-bold text-text-main">
				Decryption Complete &amp; Verified
			</h2>
			<p class="mt-3 text-[11px] text-text-muted">
				Data decrypted directly into your browser. Nothing was decrypted on any server.
			</p>
		</section>
	);
}
