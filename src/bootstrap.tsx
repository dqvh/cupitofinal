import React from "react";
import ReactDOM from "react-dom/client";
import App, { parseRoute } from "./App.tsx";

const root = document.getElementById("root")!;
if (root.hasAttribute("data-prerender") && parseRoute().name === "landing") {
  // Darle al navegador una oportunidad de pintar el HTML antes de hidratarlo.
  requestAnimationFrame(() => setTimeout(() => {
    if (parseRoute().name === "landing") ReactDOM.hydrateRoot(root, <App />);
    else {
      root.removeAttribute("data-prerender");
      ReactDOM.createRoot(root).render(<App />);
    }
  }, 0));
} else {
  root.removeAttribute("data-prerender");
  ReactDOM.createRoot(root).render(<App />);
}
(window as Window & { __cupito_booted?: boolean }).__cupito_booted = true;
