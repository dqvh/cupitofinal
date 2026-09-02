import { useState, type FormEvent } from "react";
import { PLAN_META, type Plan, useStore } from "../lib/store";
import { LogoMark, IconCheck, IconArrow } from "./kit";

type Mode = "registro" | "login";

function hashQuery(): URLSearchParams {
  const h = window.location.hash || "";
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

const PLAN_BLURBS: Record<Plan, string> = {
  semilla: "Gratis para siempre. Ideal para probar tu link.",
  crece: "El más elegido. Seña, tienda y 3 profesionales.",
  escala: "Equipo ilimitado y soporte prioritario.",
};

export default function Auth({ initialMode = "registro" }: { initialMode?: Mode }) {
  const { register, login, toast } = useStore();
  const presetPlan = ((): Plan | null => {
    const p = hashQuery().get("plan");
    if (p === "semilla" || p === "crece" || p === "escala") return p;
    return null;
  })();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pickPlan, setPickPlan] = useState(false);
  const [chosen, setChosen] = useState<Plan>(presetPlan ?? "crece");

  const switchMode = (m: Mode) => { setMode(m); setError(null); setPickPlan(false); };
  const fail = (msg: string) => { setError(msg); setShakeKey((k) => k + 1); setLoading(false); };

  const goApp = (plan: Plan) => {
    toast("¡Cuenta creada! Tu agenda ya está viva 🎉");
    window.location.hash = plan === "semilla" ? "#/app?setup=1" : `#/app?checkout=${plan}`;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "registro") {
      if (name.trim().length < 2) return fail("Contanos tu nombre.");
      if (business.trim().length < 2) return fail("¿Cómo se llama tu negocio?");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail("Ese email no parece válido.");
      if (password.length < 6) return fail("La contraseña necesita al menos 6 caracteres.");
    } else {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return fail("Ese email no parece válido.");
      if (password.length === 0) return fail("Falta la contraseña.");
    }
    setLoading(true);
    setTimeout(() => {
      const err = mode === "registro" ? register({ name, business, email, password }) : login(email, password);
      setLoading(false);
      if (err) return fail(err);
      if (mode === "login") {
        toast("¡Hola de nuevo!");
        window.location.hash = "#/app";
        return;
      }
      if (presetPlan) {
        goApp(presetPlan);
        return;
      }
      setPickPlan(true);
    }, 650);
  };

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-evergreen text-paper lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="gridlines absolute inset-0" aria-hidden="true" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 65%)" }} aria-hidden="true" />
        <a href="#/" className="relative flex items-center gap-2.5">
          <LogoMark className="h-10 w-10 text-fern" />
          <span className="font-display text-3xl font-bold tracking-tight">cupito<span className="text-lime">.</span></span>
        </a>
        <div className="relative">
          <h1 className="max-w-md font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em]">
            Tu agenda,<br />en <span className="text-lime">piloto automático</span>.
          </h1>
          <ul className="mt-8 space-y-3.5">
            {["Configurada en 10 minutos, sin técnicos", "Tus clientes reservan y pagan la seña solos", "Recordatorios por email y calendario que bajan ausencias"].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime text-ink"><IconCheck className="h-3 w-3" /></span>
                <span className="text-paper/85">{t}</span>
              </li>
            ))}
          </ul>
          <div className="mt-10 max-w-sm rounded-2xl border-2 border-paper/15 bg-pine/70 p-5">
            <p className="font-display text-[15px] font-semibold leading-snug">
              “Me registré un martes a la noche. El miércoles a las 9 AM ya tenía turnos que jamás hubiera visto en WhatsApp.”
            </p>
            <p className="mt-3 text-sm text-paper/55">Marcos Ledesma · Barbería La 9</p>
          </div>
        </div>
        <p className="relative text-sm text-paper/45">Hecho para negocios de barrio · 14 días gratis · Sin tarjeta</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <a href="#/" className="mb-8 flex items-center gap-2.5 text-ink lg:hidden">
            <LogoMark className="h-9 w-9 text-fern" />
            <span className="font-display text-2xl font-bold tracking-tight">cupito<span className="text-coral">.</span></span>
          </a>
          <div className="rounded-[24px] border-2 border-ink/12 bg-card p-7 shadow-block-ink sm:p-9">
            {pickPlan ? (
              <div className="pop-in">
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">¿Con qué plan arrancás?</h2>
                <p className="mt-2 text-sm text-inkmute">Podés empezar gratis. Si elegís Crece o Escala, te llevamos a MercadoPago para pagar la suscripción.</p>
                <div className="mt-6 space-y-2.5">
                  {(["semilla", "crece", "escala"] as Plan[]).map((p) => (
                    <button key={p} type="button" onClick={() => setChosen(p)}
                      className={`flex w-full items-start justify-between gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition-all ${chosen === p ? "border-evergreen bg-lime/20" : "border-ink/12 hover:border-evergreen/50"}`}>
                      <span>
                        <span className="block font-display text-lg font-extrabold text-ink">{PLAN_META[p].name}</span>
                        <span className="mt-0.5 block text-xs text-inkmute">{PLAN_BLURBS[p]}</span>
                      </span>
                      <span className="shrink-0 font-display text-sm font-bold text-fern">{PLAN_META[p].price}</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => goApp(chosen)}
                  className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-full bg-evergreen px-6 py-4 font-display text-lg font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">
                  {chosen === "semilla" ? "Empezar gratis" : `Continuar con ${PLAN_META[chosen].name}`}
                  <IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
                <p className="mt-3 text-center text-[11px] text-inkmute">
                  {chosen === "semilla" ? "Después podés subir de plan desde el panel, pagando con MercadoPago." : "El plan se activa recién cuando MercadoPago confirma el pago."}
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{mode === "registro" ? "Creá tu cuenta" : "Iniciá sesión"}</h2>
                <p className="mt-2 text-sm text-inkmute">
                  {mode === "registro" ? "Después te preguntamos el plan. Semilla es gratis y no pide tarjeta." : "Tus turnos te están esperando."}
                </p>
                <div className="relative mt-6 rounded-full border-2 border-ink/12 bg-paper p-1">
                  <span className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-evergreen transition-transform duration-300 ease-out ${mode === "registro" ? "translate-x-0" : "translate-x-full"}`} style={{ left: 4 }} aria-hidden="true" />
                  <div className="relative z-10 grid grid-cols-2">
                    {(["registro", "login"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => switchMode(m)}
                        className={`rounded-full py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors duration-300 ${mode === m ? "text-lime" : "text-ink/45 hover:text-ink"}`}>
                        {m === "registro" ? "Crear cuenta" : "Entrar"}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <div key={shakeKey} className="shake mt-5 rounded-xl border-2 border-coral/40 bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">{error}</div>}

                <form onSubmit={submit} className="mt-6 space-y-4">
                  {mode === "registro" && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Tu nombre</label>
                        <input className="field" placeholder="Caro Méndez" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Nombre del negocio</label>
                        <input className="field" placeholder="Studio Nails" value={business} onChange={(e) => setBusiness(e.target.value)} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Email</label>
                    <input className="field" type="email" placeholder="caro@studio.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-inkmute">Contraseña</label>
                    <div className="relative">
                      <input className="field pr-12" type={showPass ? "text" : "password"} placeholder={mode === "registro" ? "Mínimo 6 caracteres" : "Tu contraseña"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "registro" ? "new-password" : "current-password"} />
                      <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-inkmute transition-colors hover:text-fern">
                        {showPass ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading}
                    className="group flex w-full items-center justify-center gap-2.5 rounded-full bg-evergreen px-6 py-4 font-display text-lg font-bold text-lime transition-all duration-200 hover:-translate-y-0.5 hover:bg-pine hover:shadow-[0_14px_35px_rgba(8,43,34,0.35)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70">
                    {loading ? (
                      <span className="flex items-center gap-2.5"><span className="blinkdot h-2.5 w-2.5 rounded-full bg-lime" /> Preparando tu agenda…</span>
                    ) : (
                      <>{mode === "registro" ? "Crear mi agenda" : "Entrar a mi panel"}<IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" /></>
                    )}
                  </button>
                </form>
              </>
            )}

            {!pickPlan && (
              <p className="mt-6 text-center text-xs leading-relaxed text-inkmute">
                Al continuar aceptás nuestros <a href="#/" className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-2">términos</a> y{" "}
                <a href="#/" className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-2">política de privacidad</a>.
              </p>
            )}
          </div>
          {!pickPlan && (
            <p className="mt-6 text-center text-sm text-inkmute">
              {mode === "registro" ? "¿Ya tenés cuenta? " : "¿Todavía no tenés cuenta? "}
              <button onClick={() => switchMode(mode === "registro" ? "login" : "registro")} className="font-display font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-4 transition-colors hover:text-evergreen">
                {mode === "registro" ? "Iniciá sesión" : "Creala gratis"}
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
