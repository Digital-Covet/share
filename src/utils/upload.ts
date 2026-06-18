export const CHUNK_SIZE = 5 * 1024 * 1024;
export const getTotalChunks = (fileSize: number) => Math.ceil(fileSize / CHUNK_SIZE);

export const formatFileSize = (bytes: number): string => {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
};

export const getPhaseLabel = (progress: number): string => {
	if (progress < 20) return "Preparing file...";
	if (progress < 50) return "Encrypting...";
	if (progress < 90) return "Uploading securely...";
	return "Finalizing...";
};
