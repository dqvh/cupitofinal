import { useState, type FormEvent } from "react";
import { PLAN_META, type Plan, useStore } from "../lib/store";
import { LogoMark, IconCheck, IconArrow, LegalModal, TERMS_DOC, PRIVACY_DOC } from "./kit";
import { sendWelcomeAccountEmail } from "../lib/email";

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
  const { registerAsync, loginAsync, toast } = useStore();
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
  const [notice, setNotice] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pickPlan, setPickPlan] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [chosen, setChosen] = useState<Plan>(presetPlan ?? "crece");

  const switchMode = (m: Mode) => { setMode(m); setError(null); setNotice(null); setPickPlan(false); };
  const fail = (msg: string) => { setError(msg); setNotice(null); setShakeKey((k) => k + 1); setLoading(false); };
  const info = (msg: string) => { setNotice(msg); setError(null); setShakeKey((k) => k + 1); setLoading(false); };

  const goApp = (plan: Plan) => {
    toast("¡Cuenta creada! Tu agenda ya está lista 🎉");
    if (email.trim()) {
      const slug = business.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mi-negocio";
      sendWelcomeAccountEmail({
        toEmail: email.trim(),
        ownerName: name,
        businessName: business,
        slug,
      }).catch(() => {});
    }
    window.location.hash = plan === "semilla" ? "#/app?onboarding=1" : `#/app?checkout=${plan}&onboarding=1`;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
    setTimeout(async () => {
      try {
        const err = mode === "registro"
          ? await registerAsync({ name, business, email, password })
          : await loginAsync(email, password);
        setLoading(false);
        if (err) {
          // Avisos informativos (confirmar email, cuenta migrada) van en verde, no en rojo
          if (/confirmaci|revisá tu email|entrá de nuevo|migrada/i.test(err)) return info(err);
          return fail(err);
        }
      } catch {
        setLoading(false);
        return fail("No pudimos conectar con la nube. Revisá tu internet e intentá de nuevo.");
      }
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
        <p className="relative text-sm text-paper/45">Hecho para negocios de barrio · Gratis para empezar · Sin tarjeta</p>
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
                <div className="inline-flex items-center gap-2 rounded-full bg-lime/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-evergreen">
                  Paso 2 de 2 · Elegí tu plan
                </div>
                <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">¿Con qué plan querés arrancar?</h2>
                <p className="mt-1 text-sm text-inkmute">Podés empezar 100% gratis con Semilla o suscribirte a Crece/Escala con Mercado Pago.</p>
                
                <div className="mt-5 space-y-3">
                  {(["semilla", "crece", "escala"] as Plan[]).map((p) => {
                    const isSelected = chosen === p;
                    const isPopular = p === "crece";
                    return (
                      <button key={p} type="button" onClick={() => setChosen(p)}
                        className={`relative flex w-full flex-col gap-1 rounded-2xl border-2 p-4 text-left transition-all ${isSelected ? "border-evergreen bg-lime/20 shadow-[3px_3px_0_rgba(8,43,34,0.15)]" : "border-ink/12 bg-white/50 hover:border-evergreen/40 hover:bg-white"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-lg font-extrabold text-ink">{PLAN_META[p].name}</span>
                            {isPopular && <span className="rounded-full bg-coral px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-white">Recomendado</span>}
                            {p === "semilla" && <span className="rounded-full bg-fern/15 px-2 py-0.5 text-[10px] font-bold text-fern">Gratis</span>}
                          </div>
                          <span className="font-display text-base font-extrabold text-fern">{PLAN_META[p].price}</span>
                        </div>
                        <p className="text-xs text-inkmute leading-snug">{PLAN_BLURBS[p]}</p>
                      </button>
                    );
                  })}
                </div>

                <button type="button" onClick={() => goApp(chosen)}
                  className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-full bg-evergreen px-6 py-4 font-display text-base font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine shadow-block-ink">
                  {chosen === "semilla" ? "Empezar gratis en Semilla" : `Continuar y Pagar ${PLAN_META[chosen].name}`}
                  <IconArrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>
                <p className="mt-3 text-center text-[11px] text-inkmute">
                  {chosen === "semilla" ? "Configurás tus horarios y servicios de inmediato. Podés subir de plan cuando quieras." : "Te abriremos el checkout de Mercado Pago para confirmar la suscripción."}
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
                {notice && <div key={shakeKey} className="shake mt-5 rounded-xl border-2 border-fern/40 bg-fern/10 px-4 py-3 text-sm font-semibold text-fern">{notice}</div>}

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
                Al continuar aceptás nuestros <button type="button" onClick={() => setLegal("terms")} className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-2">términos</button> y{" "}
                <button type="button" onClick={() => setLegal("privacy")} className="font-bold text-fern underline decoration-limedeep decoration-2 underline-offset-2">política de privacidad</button>.
              </p>
            )}
          </div>
          {legal && <LegalModal doc={legal === "terms" ? TERMS_DOC : PRIVACY_DOC} onClose={() => setLegal(null)} />}
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
