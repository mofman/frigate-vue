/** Tiny app wide toast queue, rendered by ToastHost in the shell. */
import { shallowReactive } from "vue";

export type Toast = {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
};

const toasts = shallowReactive<Toast[]>([]);
let next = 0;

export function showToast(
  message: string,
  tone: Toast["tone"] = "info",
  durationMs = 4000,
) {
  const toast = { id: ++next, message, tone };
  toasts.push(toast);
  setTimeout(() => dismissToast(toast.id), durationMs);
}

export function dismissToast(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

export function useToasts() {
  return toasts;
}
