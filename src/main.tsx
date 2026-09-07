import "./index.css";
import "./styles/landing.css";
import "./styles/landing-light.css";
import "./styles/landing-refinement.css";
import "./styles/landing-polish.css";

// El HTML público se pinta antes de descargar y ejecutar React.
const start = () => import("./bootstrap").catch(() => {
  const button = document.createElement("button");
  button.textContent = "No pudimos cargar Cupito. Volver a intentar";
  button.className = "fixed bottom-4 inset-x-4 z-50 rounded-xl bg-emerald-700 p-4 text-white";
  button.onclick = () => location.reload();
  document.body.append(button);
});
if (document.getElementById("root")?.hasAttribute("data-prerender") && !document.documentElement.hasAttribute("data-app-route")) {
  requestAnimationFrame(() => requestAnimationFrame(start));
} else {
  void start();
}
