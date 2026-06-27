import { zip, unzip, type AsyncZipOptions } from "fflate";

export async function createZip(
	files: { name: string; data: Uint8Array }[],
): Promise<Uint8Array> {
	const map: Record<string, Uint8Array> = {};
	for (const f of files) {
		map[f.name] = f.data;
	}
	return new Promise<Uint8Array>((resolve, reject) => {
		zip(map, { level: 6 } as AsyncZipOptions, (err, data) => {
			if (err) reject(err);
			else resolve(data);
		});
	});
}

export async function extractZip(
	data: Uint8Array,
): Promise<{ name: string; data: Uint8Array }[]> {
	return new Promise<{ name: string; data: Uint8Array }[]>(
		(resolve, reject) => {
			unzip(data, (err, files) => {
				if (err) reject(err);
				else
					resolve(
						Object.entries(files).map(([name, content]) => ({
							name,
							data: content as Uint8Array,
						})),
					);
			});
		},
	);
}
