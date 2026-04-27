import { useCallback, useRef, useState } from "react";

type ToastType = "success" | "error";

interface Toast {
  message: string;
  type: ToastType;
}

export function useToast(autohideMs = 5000) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType) => {
      setToast({ message, type });
      timerRef.current = setTimeout(() => setToast(null), autohideMs);
    },
    [autohideMs]
  );

  const dismiss = useCallback(() => {
    setToast(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { toast, show, dismiss };
}
