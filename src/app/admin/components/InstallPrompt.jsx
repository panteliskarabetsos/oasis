"use client";

import { useEffect, useState } from "react";

const HIDE_KEY = "oasis-admin-install-hide";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showBtn, setShowBtn] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect previous dismiss
    const hidden =
      typeof localStorage !== "undefined" &&
      localStorage.getItem(HIDE_KEY) === "1";
    if (hidden) return;

    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator?.standalone === true; // iOS

    const isiOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

    // iOS can't use beforeinstallprompt; show a gentle hint if not installed
    if (!isStandalone && isiOS) setShowIosHint(true);

    const onBeforeInstall = (e) => {
      // Chrome/Edge/Android
      e.preventDefault();
      setDeferred(e);
      setShowBtn(true);
    };

    const onInstalled = () => {
      // Hide everything after successful install
      setShowBtn(false);
      setShowIosHint(false);
      setDeferred(null);
      try {
        localStorage.setItem(HIDE_KEY, "1");
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setShowBtn(false);
    setShowIosHint(false);
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {}
  };

  if (!showBtn && !showIosHint) return null;

  // Common container styles (mobile only)
  const containerCls =
    "md:hidden fixed right-3 z-40 rounded-lg shadow border border-[#e8e5df] bg-white";

  return (
    <>
      {showBtn && deferred ? (
        <div
          className={`${containerCls} bottom-16 px-3 py-2 text-xs text-[#3f382f]`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4rem)" }} // sits above your bottom nav
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span>Install Oasis Admin?</span>
            <button
              className="inline-flex items-center rounded-md bg-[#3f382f] px-2 py-1 text-[11px] text-white"
              onClick={async () => {
                try {
                  deferred.prompt();
                  await deferred.userChoice;
                } finally {
                  // Regardless of accept/dismiss, hide for now
                  setShowBtn(false);
                  setDeferred(null);
                  try {
                    localStorage.setItem(HIDE_KEY, "1");
                  } catch {}
                }
              }}
            >
              Install
            </button>
            <button
              className="ml-1 rounded px-1 text-[#7a6a58] hover:text-[#3f382f]"
              aria-label="Close install prompt"
              onClick={dismiss}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      {showIosHint ? (
        <div
          className={`${containerCls} bottom-16 px-3 py-2 text-xs text-[#3f382f]`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4rem)" }}
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <span>
              On iPhone: <strong>Share</strong> →{" "}
              <strong>Add to Home Screen</strong>
            </span>
            <button
              className="ml-1 rounded px-1 text-[#7a6a58] hover:text-[#3f382f]"
              aria-label="Close"
              onClick={dismiss}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
