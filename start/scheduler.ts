/*
|--------------------------------------------------------------------------
| Scheduler
|--------------------------------------------------------------------------
|
| Recurring jobs. Preloaded by the web server only (adonisrc.ts); the
| schedule is stored in the queue's `queue_schedules` table and a worker
| (`pnpm worker`) runs it. Defining an existing schedule again at boot
| updates it without resetting its next run.
|
*/

import CleanupTransfersJob from '#jobs/cleanup_transfers_job'
import SendExpiryRemindersJob from '#jobs/send_expiry_reminders_job'

await CleanupTransfersJob.schedule({}).id('cleanup-transfers').every('15m').run()
await SendExpiryRemindersJob.schedule({}).id('expiry-reminders').every('1h').run()
