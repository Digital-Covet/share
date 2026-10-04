import type {
	WorkerInit,
	WorkerRequest,
	WorkerResponse,
} from "@/workers/crypto-worker";

interface Pending {
	resolve: (cipher: Uint8Array) => void;
	reject: (error: Error) => void;
}

export type SessionConfig = Omit<WorkerInit, "type">;

export class CryptoWorkerClient {
	private readonly worker = new Worker(
		new URL("../../workers/crypto-worker.ts", import.meta.url),
		{ type: "module" },
	);
	private readonly pending = new Map<number, Pending>();

	constructor() {
		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const message = event.data;
			const waiter = this.pending.get(message.index);
			if (!waiter) return;
			this.pending.delete(message.index);
			if ("error" in message) waiter.reject(new Error(message.error));
			else waiter.resolve(new Uint8Array(message.cipher));
		};
		this.worker.onerror = () => this.rejectAll(new Error("Encryption worker crashed."));
	}

	start(config: SessionConfig): void {
		this.send({ type: "init", ...config });
	}

	encrypt(index: number, chunk: ArrayBuffer): Promise<Uint8Array> {
		return new Promise((resolve, reject) => {
			this.pending.set(index, { resolve, reject });
			this.send({ type: "encrypt", index, chunk }, [chunk]);
		});
	}

	terminate(): void {
		this.rejectAll(new Error("Upload cancelled."));
		this.worker.terminate();
	}

	private send(request: WorkerRequest, transfer: Transferable[] = []): void {
		this.worker.postMessage(request, transfer);
	}

	private rejectAll(error: Error): void {
		for (const waiter of this.pending.values()) waiter.reject(error);
		this.pending.clear();
	}
}
