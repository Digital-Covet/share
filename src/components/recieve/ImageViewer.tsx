import {
	createSignal,
	createMemo,
	Show,
	onCleanup,
	type Component,
} from "solid-js";
import {
	ZoomIn,
	ZoomOut,
	RotateCw,
	Maximize,
	Minimize,
	RefreshCw,
} from "lucide-solid";

interface ImageViewerProps {
	src: string;
	alt: string;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_STEP = 0.25;

export const ImageViewer: Component<ImageViewerProps> = (props) => {
	const [zoom, setZoom] = createSignal(1);
	const [rotation, setRotation] = createSignal(0);
	const [position, setPosition] = createSignal({ x: 0, y: 0 });
	const [isDragging, setIsDragging] = createSignal(false);
	const [isFullscreen, setIsFullscreen] = createSignal(false);
	const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
	const [posStart, setPosStart] = createSignal({ x: 0, y: 0 });

	let containerRef!: HTMLDivElement;

	const transform = createMemo(() => {
		const z = zoom();
		const r = rotation();
		const p = position();
		return `translate(${p.x}px, ${p.y}px) scale(${z}) rotate(${r}deg)`;
	});

	const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, ZOOM_MAX));
	const zoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, ZOOM_MIN));
	const rotate = () => setRotation((r) => (r + 90) % 360);
	const resetView = () => {
		setZoom(1);
		setRotation(0);
		setPosition({ x: 0, y: 0 });
	};

	const handleWheel = (e: WheelEvent) => {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
		setZoom((z) => {
			const next = Math.min(Math.max(z + delta, ZOOM_MIN), ZOOM_MAX);
			return Math.round(next * 100) / 100;
		});
	};

	const handleMouseDown = (e: MouseEvent) => {
		if (e.button !== 0) return;
		setIsDragging(true);
		setDragStart({ x: e.clientX, y: e.clientY });
		setPosStart(position());
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!isDragging()) return;
		const dx = e.clientX - dragStart().x;
		const dy = e.clientY - dragStart().y;
		setPosition({
			x: posStart().x + dx,
			y: posStart().y + dy,
		});
	};

	const handleMouseUp = () => {
		setIsDragging(false);
	};

	const handleDoubleClick = () => {
		if (zoom() === 1) {
			setZoom(2);
		} else {
			resetView();
		}
	};

	const toggleFullscreen = async () => {
		if (!document.fullscreenElement) {
			await containerRef.requestFullscreen();
			setIsFullscreen(true);
		} else {
			await document.exitFullscreen();
			setIsFullscreen(false);
		}
	};

	const handleFullscreenChange = () => {
		setIsFullscreen(!!document.fullscreenElement);
	};

	document.addEventListener("fullscreenchange", handleFullscreenChange);
	onCleanup(() => {
		document.removeEventListener("fullscreenchange", handleFullscreenChange);
	});

	const zoomPercent = createMemo(() => Math.round(zoom() * 100));

	return (
		<div
			ref={containerRef}
			class="relative flex h-full w-full flex-col overflow-hidden bg-zinc-950"
		>
			{/* Toolbar */}
			<div class="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-zinc-700/50 bg-zinc-900/80 px-2 py-1 backdrop-blur-sm">
				<ToolbarButton onClick={zoomOut} title="Zoom out">
					<ZoomOut class="h-3.5 w-3.5" />
				</ToolbarButton>

				<span class="min-w-[3rem] px-1 text-center text-xs font-medium text-zinc-300">
					{zoomPercent()}%
				</span>

				<ToolbarButton onClick={zoomIn} title="Zoom in">
					<ZoomIn class="h-3.5 w-3.5" />
				</ToolbarButton>

				<div class="mx-1 h-4 w-px bg-zinc-700" />

				<ToolbarButton onClick={rotate} title="Rotate 90°">
					<RotateCw class="h-3.5 w-3.5" />
				</ToolbarButton>

				<ToolbarButton onClick={resetView} title="Reset view">
					<RefreshCw class="h-3.5 w-3.5" />
				</ToolbarButton>

				<div class="mx-1 h-4 w-px bg-zinc-700" />

				<ToolbarButton onClick={toggleFullscreen} title="Fullscreen">
					<Show
						when={isFullscreen()}
						fallback={<Maximize class="h-3.5 w-3.5" />}
					>
						<Minimize class="h-3.5 w-3.5" />
					</Show>
				</ToolbarButton>
			</div>

			{/* Image container */}
			<div
				class="flex h-full w-full items-center justify-center overflow-hidden"
				onWheel={handleWheel}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onDblClick={handleDoubleClick}
				style={{ cursor: isDragging() ? "grabbing" : "grab" }}
			>
				<img
					src={props.src}
					alt={props.alt}
					class="pointer-events-none max-w-none select-none rounded shadow-lg transition-transform duration-75"
					style={{ transform: transform(), "transform-origin": "center center" }}
					draggable={false}
				/>
			</div>

			{/* Bottom hint */}
			<Show when={!isFullscreen()}>
				<div class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-500 backdrop-blur-sm">
					Scroll to zoom · Drag to pan · Double-click to toggle
				</div>
			</Show>
		</div>
	);
};

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

const ToolbarButton: Component<{
	onClick: () => void;
	title: string;
	children: any;
}> = (props) => (
	<button
		type="button"
		onClick={props.onClick}
		title={props.title}
		class="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-700/60 hover:text-zinc-100"
	>
		{props.children}
	</button>
);
