const EOF_MARKER = new TextEncoder().encode("%%EOF");

export function hasPdfEOF(data: Uint8Array): boolean {
	if (data.length < EOF_MARKER.length) return false;

	for (let i = data.length - EOF_MARKER.length; i >= Math.max(0, data.length - 1024); i--) {
		let match = true;
		for (let j = 0; j < EOF_MARKER.length; j++) {
			if (data[i + j] !== EOF_MARKER[j]) {
				match = false;
				break;
			}
		}
		if (match) return true;
	}

	return false;
}
