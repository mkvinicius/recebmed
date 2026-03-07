import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const INSTALLED_KEY = "recebmed_pwa_installed";

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(INSTALLED_KEY) === "true") {
      setIsInstalled(true);
      return;
    }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      localStorage.setItem(INSTALLED_KEY, "true");
      return;
    }

    const ua = navigator.userAgent;
    const ios =
      (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    if (ios) {
      setCanInstall(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setCanInstall(false);
      localStorage.setItem(INSTALLED_KEY, "true");
      deferredPrompt = null;
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setCanInstall(false);
      localStorage.setItem(INSTALLED_KEY, "true");
    }
    deferredPrompt = null;
  }, [isIOS]);

  const markInstalled = useCallback(() => {
    setIsInstalled(true);
    setCanInstall(false);
    localStorage.setItem(INSTALLED_KEY, "true");
    setShowIOSGuide(false);
  }, []);

  return { canInstall, isInstalled, isIOS, showIOSGuide, setShowIOSGuide, install, markInstalled };
}
