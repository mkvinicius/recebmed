import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      console.log("[PWA] Service Worker registered");
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[PWA] Update available");
              if (confirm("Atualização disponível! Deseja recarregar?")) {
                window.location.reload();
              }
            }
          });
        }
      });
    }).catch((err) => {
      console.warn("[PWA] SW registration failed:", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
