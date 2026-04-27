import { useCallback, useEffect, useState } from "react";

export function useDirtyState() {
  const [dirtyTabs, setDirtyTabs] = useState<Set<string>>(new Set());

  const markDirty = useCallback((tab: string, isDirty = true) => {
    setDirtyTabs((prev) => {
      const next = new Set(prev);
      if (isDirty) {
        next.add(tab);
      } else {
        next.delete(tab);
      }
      return next;
    });
  }, []);

  const isDirty = useCallback((tab: string) => dirtyTabs.has(tab), [dirtyTabs]);

  const hasAnyDirty = dirtyTabs.size > 0;

  useEffect(() => {
    if (!hasAnyDirty) {
      return;
    }
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAnyDirty]);

  return { dirtyTabs, markDirty, isDirty, hasAnyDirty };
}
