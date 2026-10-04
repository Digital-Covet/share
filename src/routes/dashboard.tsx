import { Meta, Title } from "@solidjs/meta";
import { A, useNavigate } from "@solidjs/router";
import { Plus } from "lucide-solid";
import { FileTable } from "@/components/dashboard/FileTable";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { NoticeBanner } from "@/components/dashboard/NoticeBanner";
import { PaginationBar } from "@/components/dashboard/PaginationBar";
import { RevokeDialog } from "@/components/dashboard/RevokeDialog";
import { StatStrip } from "@/components/dashboard/StatStrip";
import { AppShell } from "@/components/shell/AppShell";
import { ROUTES } from "@/lib/constants";
import { PAGE_SIZE, useFileDashboard } from "@/lib/dashboard/use-file-dashboard";
import { pageMetadata } from "@/lib/seo";

const OUTLINE_BUTTON =
	"inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-main hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

export default function Dashboard() {
	const navigate = useNavigate();
	const dashboard = useFileDashboard();

	function purgeExpired() {
		const message = `Permanently purge ${dashboard.expiredCount()} expired files? This cannot be undone.`;
		if (window.confirm(message)) void dashboard.purgeExpired();
	}

	return (
		<>
			<Title>{pageMetadata.dashboard.title}</Title>
			<Meta name="description" content={pageMetadata.dashboard.description} />
			<AppShell>
				<header class="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 class="font-display text-[31px] leading-tight font-extrabold tracking-[-0.02em] text-text-main">
							Shared Vault Files
						</h1>
						<StatStrip stats={dashboard.stats()} />
					</div>
					<div class="flex items-center gap-3">
						<button
							type="button"
							disabled={dashboard.expiredCount() === 0}
							onClick={purgeExpired}
							class={OUTLINE_BUTTON}
						>
							Purge Expired
						</button>
						<A
							href={ROUTES.UPLOAD}
							class="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						>
							<Plus class="size-[18px]" stroke-width={1.75} aria-hidden="true" />
							New Upload
						</A>
					</div>
				</header>

				<FilterBar view={dashboard.view()} onChange={dashboard.setView} />

				<FileTable
					files={dashboard.pageFiles()}
					loading={dashboard.loading()}
					now={dashboard.now()}
					onCreateTransfer={() => navigate(ROUTES.UPLOAD)}
					onCopy={dashboard.copyLink}
					onSaveExpiry={dashboard.saveExpiry}
					onRevoke={dashboard.requestRevoke}
				/>

				<PaginationBar
					window={{
						page: dashboard.page(),
						pageSize: PAGE_SIZE,
						total: dashboard.filteredCount(),
					}}
					onPageChange={dashboard.setPage}
				/>

				<RevokeDialog
					file={dashboard.revokeTarget()}
					pending={dashboard.revoking()}
					onConfirm={dashboard.confirmRevoke}
					onClose={dashboard.cancelRevoke}
				/>
				<NoticeBanner notice={dashboard.notice()} />
			</AppShell>
		</>
	);
}
