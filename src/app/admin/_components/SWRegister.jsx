"use client";
import { useEffect } from "react";

/**
 * Robust Service Worker registration just for the Admin app
 * - Scopes to /admin
 * - Detects updates and dispatches CustomEvents you can hook into
 *   • sw:ready          -> first install complete
 *   • sw:updated        -> a new version is waiting (registration.waiting provided)
 *   • sw:controllerchange -> a new SW took control (good time to reload UI)
 * - Periodically checks for updates when the tab is visible
 * - Exposes window.__adminSW.skipWaiting() to activate the new version on demand
 *
 * Optional SW addition (to support skipWaiting messaging):
 *  self.addEventListener('message', (e) => {
 *    if (e?.data?.type === 'SKIP_WAITING') { self.skipWaiting(); }
 *  });
 */
export default function SWRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let intervalId = null;

    const SCOPE = "/admin"; // normalized without trailing slash

    const dispatch = (name, detail) => {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    };

    const onControllerChange = () => {
      dispatch("sw:controllerchange", {});
    };

    const setupUpdateChecks = (reg) => {
      // Check on visibility gain and every 30 minutes
      const tick = () => reg.update().catch(() => {});
      const onVis = () => {
        if (document.visibilityState === "visible") tick();
      };
      document.addEventListener("visibilitychange", onVis);
      intervalId = window.setInterval(tick, 30 * 60 * 1000);
      return () => {
        document.removeEventListener("visibilitychange", onVis);
        if (intervalId) window.clearInterval(intervalId);
      };
    };

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register(`${SCOPE}/sw.js`, {
          scope: `${SCOPE}/`,
          updateViaCache: "none",
        });

        // expose helpers
        window.__adminSW = {
          registration: reg,
          /** Tries to activate the waiting worker (requires SW message handler). */
          skipWaiting: async () => {
            try {
              const r =
                reg ||
                (await navigator.serviceWorker.getRegistration(`${SCOPE}/`));
              const w = r?.waiting;
              if (!w) return false;
              w.postMessage({ type: "SKIP_WAITING" });
              return true;
            } catch {
              return false;
            }
          },
        };

        // If there is already a waiting worker (e.g., tab resumed), notify UI
        if (reg.waiting) {
          dispatch("sw:updated", { registration: reg, waiting: reg.waiting });
        }

        // Listen for newly found updates
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") {
              // If there's an existing controller, it's an update
              if (navigator.serviceWorker.controller) {
                dispatch("sw:updated", {
                  registration: reg,
                  waiting: reg.waiting || installing,
                });
              } else {
                // First install
                dispatch("sw:ready", { registration: reg });
              }
            }
          });
        });

        navigator.serviceWorker.addEventListener(
          "controllerchange",
          onControllerChange
        );

        const teardown = setupUpdateChecks(reg);

        return () => {
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            onControllerChange
          );
          teardown();
        };
      } catch (err) {
        // fail silent; SW is optional
        return () => {};
      }
    };

    let cleanup = () => {};
    registerSW().then((fn) => {
      if (typeof fn === "function") cleanup = fn;
    });

    return () => {
      cancelled = true; // reserved for future use
      cleanup();
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
