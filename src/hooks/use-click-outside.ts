import { useEffect, useRef } from "react";

export function useClickOutside(
  callback: () => void
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current?.();
      }
    }
    function onFocusIn(e: FocusEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current?.();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  return ref;
}
