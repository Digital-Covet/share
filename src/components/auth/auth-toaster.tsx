import { createToaster, Toast, Toaster } from "@ark-ui/solid/toast";
import { XIcon } from "lucide-solid";
import { Portal } from "solid-js/web";

export const authToaster = createToaster({
  placement: "top",
  overlap: true,
  gap: 24,
});

export function AuthToaster() {
  return (
    <Portal>
      <Toaster toaster={authToaster}>
        {(toast) => (
          <Toast.Root class="flex flex-col gap-1 items-start relative p-4 pr-10 rounded-lg bg-background border shadow-lg">
            <Toast.Title class="text-sm font-medium">
              {toast().title}
            </Toast.Title>
            <Toast.CloseTrigger class="absolute top-1 right-1 p-1 rounded-md hover:bg-muted transition-colors">
              <XIcon class="size-4" />
            </Toast.CloseTrigger>
          </Toast.Root>
        )}
      </Toaster>
    </Portal>
  );
}
