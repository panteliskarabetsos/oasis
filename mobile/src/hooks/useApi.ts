import { useCallback, useEffect, useRef, useState } from "react";

/** Small fetch-on-mount hook with refresh support. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    setError(null);
    setErrorStatus(null);
    try {
      const result = await fnRef.current();
      setData(result);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      // ApiError carries the status; anything else leaves it null.
      setErrorStatus(typeof e?.status === "number" ? e.status : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, errorStatus, loading, refresh: load, setData };
}
