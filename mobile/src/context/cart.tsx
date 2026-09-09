import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ShopProduct } from "@/lib/types";

const STORAGE_KEY = "oasis.bag.v1";
const MAX_PER_LINE = 20;

export type BagLine = {
  productId: number;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  image: string | null;
  option: string | null;
  quantity: number;
  /** Stock at the time of adding — a soft ceiling; the server re-checks. */
  stockQty: number;
};

type BagContextValue = {
  lines: BagLine[];
  ready: boolean;
  count: number;
  subtotalCents: number;
  currency: string;
  add: (product: ShopProduct, option?: string | null, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  quantityOf: (productId: number, option?: string | null) => number;
  /** Apply the shop's current view of these products to the bag. */
  reconcile: (updates: {
    productId: number;
    available: boolean;
    priceCents?: number;
    stockQty?: number;
  }[]) => string[];
};

/** A bag line is identified by product + chosen option, not product alone. */
export function lineKey(productId: number, option?: string | null) {
  return `${productId}::${option ?? ""}`;
}

const BagContext = createContext<BagContextValue>({
  lines: [],
  ready: false,
  count: 0,
  subtotalCents: 0,
  currency: "EUR",
  add: () => {},
  setQuantity: () => {},
  remove: () => {},
  clear: () => {},
  quantityOf: () => 0,
  reconcile: () => [],
});

function sanitize(raw: unknown): BagLine[] {
  if (!Array.isArray(raw)) return [];
  const out: BagLine[] = [];
  for (const l of raw) {
    const productId = Number((l as BagLine)?.productId);
    const quantity = Math.floor(Number((l as BagLine)?.quantity));
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    out.push({
      productId,
      slug: String((l as BagLine).slug ?? ""),
      title: String((l as BagLine).title ?? "Item"),
      priceCents: Math.max(0, Math.round(Number((l as BagLine).priceCents) || 0)),
      currency: String((l as BagLine).currency || "EUR").toUpperCase(),
      image: (l as BagLine).image ?? null,
      option: (l as BagLine).option ?? null,
      quantity: Math.min(quantity, MAX_PER_LINE),
      stockQty: Math.max(0, Math.round(Number((l as BagLine).stockQty) || 0)),
    });
  }
  return out;
}

export function BagProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([]);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  // Restore once, then mirror every change back to disk.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive) return;
        if (raw) {
          try {
            setLines(sanitize(JSON.parse(raw)));
          } catch {
            // corrupt bag — start empty rather than crash the shop
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        hydrated.current = true;
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Skip the write that would otherwise clobber storage before hydration.
    if (!hydrated.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines]);

  const add = useCallback(
    (product: ShopProduct, option: string | null = null, quantity = 1) => {
      const key = lineKey(product.id, option);
      setLines((prev) => {
        const next = [...prev];
        const at = next.findIndex((l) => lineKey(l.productId, l.option) === key);
        const ceiling = Math.min(
          MAX_PER_LINE,
          product.stockQty > 0 ? product.stockQty : MAX_PER_LINE
        );
        if (at >= 0) {
          next[at] = {
            ...next[at],
            // Refresh the snapshot so a re-priced product doesn't linger.
            priceCents: product.priceCents,
            title: product.title,
            image: product.image,
            stockQty: product.stockQty,
            quantity: Math.min(next[at].quantity + quantity, ceiling),
          };
          return next;
        }
        next.push({
          productId: product.id,
          slug: product.slug,
          title: product.title,
          priceCents: product.priceCents,
          currency: (product.currency || "EUR").toUpperCase(),
          image: product.image,
          option,
          quantity: Math.min(Math.max(1, quantity), ceiling),
          stockQty: product.stockQty,
        });
        return next;
      });
    },
    []
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) => {
      if (quantity <= 0) {
        return prev.filter((l) => lineKey(l.productId, l.option) !== key);
      }
      return prev.map((l) => {
        if (lineKey(l.productId, l.option) !== key) return l;
        const ceiling = Math.min(
          MAX_PER_LINE,
          l.stockQty > 0 ? l.stockQty : MAX_PER_LINE
        );
        return { ...l, quantity: Math.min(quantity, ceiling) };
      });
    });
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => lineKey(l.productId, l.option) !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  /**
   * Bring the bag in line with what the shop now says: drop what is gone, cap
   * what is short, and adopt a new price. Returns a note per correction so the
   * customer is told rather than quietly charged something else.
   */
  const reconcile = useCallback<BagContextValue["reconcile"]>((updates) => {
    const notes: string[] = [];
    const byId = new Map(updates.map((u) => [u.productId, u]));
    setLines((prev) => {
      const next: BagLine[] = [];
      for (const line of prev) {
        const u = byId.get(line.productId);
        if (!u) {
          next.push(line);
          continue;
        }
        if (!u.available) {
          notes.push(`${line.title} is no longer available and was removed.`);
          continue;
        }
        let updated = line;
        if (typeof u.priceCents === "number" && u.priceCents !== line.priceCents) {
          notes.push(`${line.title} is now priced differently.`);
          updated = { ...updated, priceCents: u.priceCents };
        }
        if (typeof u.stockQty === "number") {
          updated = { ...updated, stockQty: u.stockQty };
          if (line.quantity > u.stockQty) {
            notes.push(`Only ${u.stockQty} × ${line.title} left — your bag was adjusted.`);
            updated = { ...updated, quantity: u.stockQty };
          }
        }
        next.push(updated);
      }
      return next;
    });
    return notes;
  }, []);

  const value = useMemo<BagContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotalCents = lines.reduce((n, l) => n + l.priceCents * l.quantity, 0);
    return {
      lines,
      ready,
      count,
      subtotalCents,
      currency: lines[0]?.currency || "EUR",
      add,
      setQuantity,
      remove,
      clear,
      reconcile,
      quantityOf: (productId, option = null) =>
        lines.find((l) => lineKey(l.productId, l.option) === lineKey(productId, option))
          ?.quantity ?? 0,
    };
  }, [lines, ready, add, setQuantity, remove, clear, reconcile]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  return useContext(BagContext);
}
