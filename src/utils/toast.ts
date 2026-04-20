import { toast } from "sonner";

type ToastId = string | number;

const MAX_LOADING_TOAST_MS = 10_000;
const activeLoadingToasts = new Set<ToastId>();
const loadingToastTimeouts = new Map<ToastId, number>();

const clearLoadingToastTimeout = (toastId: ToastId) => {
  const timeoutId = loadingToastTimeouts.get(toastId);
  if (timeoutId !== undefined) {
    window.clearTimeout(timeoutId);
    loadingToastTimeouts.delete(toastId);
  }
};

const dismissActiveLoadingToasts = () => {
  activeLoadingToasts.forEach((toastId) => {
    clearLoadingToastTimeout(toastId);
    toast.dismiss(toastId);
  });
  activeLoadingToasts.clear();
};

export const showSuccess = (message: string) => {
  dismissActiveLoadingToasts();
  toast.success(message);
};

export const showError = (message: string) => {
  dismissActiveLoadingToasts();
  toast.error(message);
};

export const showLoading = (message: string) => {
  const toastId = toast.loading(message);
  activeLoadingToasts.add(toastId);

  const timeoutId = window.setTimeout(() => {
    activeLoadingToasts.delete(toastId);
    loadingToastTimeouts.delete(toastId);
    toast.dismiss(toastId);
  }, MAX_LOADING_TOAST_MS);

  loadingToastTimeouts.set(toastId, timeoutId);
  return toastId;
};

export const dismissToast = (toastId: ToastId) => {
  activeLoadingToasts.delete(toastId);
  clearLoadingToastTimeout(toastId);
  toast.dismiss(toastId);
};
