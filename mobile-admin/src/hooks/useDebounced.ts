import { useEffect, useState } from "react";

/**
 * Debounced mirror of a fast-changing value.
 *
 * Search fields in this app used to only apply on the keyboard's Search key,
 * which is easy to miss one-handed while holding a phone at a check-in desk.
 */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
