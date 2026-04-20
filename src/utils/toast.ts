import { toast } from "sonner";

type ToastId = string | number;

const activeLoadingToasts = new Set<ToastId>();

const dismissActiveLoadingToasts = () => {
  activeLoadingToasts.forEach((toastId) => {
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
  return toastId;
};

export const dismissToast = (toastId: ToastId) => {
  activeLoadingToasts.delete(toastId);
  toast.dismiss(toastId);
};
