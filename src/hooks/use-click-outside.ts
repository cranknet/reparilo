import { useEffect, useRef } from "react";

export function useClickOutside(
  callback: () => void
): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current) {
        return;
      }
      if (!ref.current.contains(e.target as Node)) {
        callbackRef.current?.();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  return ref;
}
