import { useState, useRef, type FormEvent } from "react";
import {
  CalendarDays,
  Users,
  Link as LinkIcon,
  LockKeyhole,
  Copy,
  Download,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useStore, getSessionUser, type Plan } from "../lib/store";
import { LogoMark, LegalModal, TERMS_DOC, PRIVACY_DOC } from "./kit";
import { sendWelcomeAccountEmail } from "../lib/email";
import "../styles/auth.css";

type Mode = "login" | "registro" | "recuperar";

function hashQuery(): URLSearchParams {
  const h = window.location.hash || "";
  const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

export default function Auth({ initialMode = "registro" }: { initialMode?: "registro" | "login" }) {
  const { registerAsync, loginAsync, recoverPasswordAsync, toast } = useStore();

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
  const [recoveryInput, setRecoveryInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  // Pantalla de clave de recuperación post-registro
  const [generatedRecovery, setGeneratedRecovery] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inFlight = useRef(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
    setGeneratedRecovery(null);
    setPassword("");
  };

  const goDashboard = () => {
    const plan = presetPlan ?? "semilla";
    const su = getSessionUser();
    const oName = name.trim() || su?.name || "";
    const oBiz = business.trim() || su?.business || "";
    const oEmail = email.trim() || su?.email || "";
    toast("¡Bienvenido a Cupito!");
    if (oEmail) {
      const slug =
        oBiz.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
        su?.slug ||
        "mi-negocio";
      sendWelcomeAccountEmail({
        toEmail: oEmail,
        ownerName: oName,
        businessName: oBiz,
        slug,
      }).catch(() => {});
    }
    window.location.hash =
      plan === "semilla" ? "#/app?onboarding=1" : `#/app?checkout=${plan}&onboarding=1`;
  };

  const downloadRecoveryFile = () => {
    if (!generatedRecovery) return;
    const content = `=========================================
CUPITO · CLAVE DE RECUPERACIÓN DE CUENTA
=========================================

Tu clave de recuperación es:
${generatedRecovery}

Email asociado: ${email || "tu-email@ejemplo.com"}
Fecha de generación: ${new Date().toLocaleDateString("es-AR")}

INSTRUCCIONES IMPORTANTES:
- Guardá este archivo en una ubicación segura o en tu gestor de contraseñas.
- Si alguna vez olvidás tu contraseña, ingresá a https://cupito.app/#/auth?modo=login, seleccioná "Olvidé mi contraseña" y pegá esta clave.
- Esta clave puede usarse una sola vez. Cada vez que recuperes tu acceso se generará una nueva clave.
=========================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cupito-clave-recuperacion-${email.split("@")[0] || "cuenta"}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyRecovery = async () => {
    if (!generatedRecovery) return;
    try {
      await navigator.clipboard.writeText(generatedRecovery);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError("No se pudo copiar automáticamente. Seleccioná el texto y copialo manualmente.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);
    setNotice(null);

    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) {
      setError("Ingresá un email válido.");
      return;
    }

    if (mode === "registro") {
      if (name.trim().length < 2) {
        setError("Contanos tu nombre.");
        return;
      }
      if (business.trim().length < 2) {
        setError("¿Cómo se llama tu negocio?");
        return;
      }
      if (password.length < 6) {
        setError("La contraseña necesita al menos 6 caracteres.");
        return;
      }

      inFlight.current = true;
      setLoading(true);

      try {
        const res = await registerAsync({
          name: name.trim(),
          business: business.trim(),
          email: em,
          password,
        });

        if (res.error) {
          setError(res.error);
        } else if (res.recovery) {
          setGeneratedRecovery(res.recovery);
        } else {
          goDashboard();
        }
      } catch (err: any) {
        setError(err?.message || "No pudimos completar el registro. Intentá de nuevo.");
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
      return;
    }

    if (mode === "login") {
      if (!password) {
        setError("Ingresá tu contraseña.");
        return;
      }

      inFlight.current = true;
      setLoading(true);

      try {
        const err = await loginAsync(em, password);
        if (err) {
          setError(err);
        } else {
          toast("¡Hola de nuevo! Agenda al día ✓");
          window.location.hash = "#/app";
        }
      } catch (err: any) {
        setError(err?.message || "No pudimos verificar tu cuenta.");
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
      return;
    }

    if (mode === "recuperar") {
      const rec = recoveryInput.trim();
      if (!rec) {
        setError("Ingresá tu clave de recuperación.");
        return;
      }
      if (password.length < 6) {
        setError("La nueva contraseña necesita al menos 6 caracteres.");
        return;
      }

      inFlight.current = true;
      setLoading(true);

      try {
        const err = await recoverPasswordAsync({
          email: em,
          recovery: rec,
          newPassword: password,
        });
        if (err) {
          setError(err);
        } else {
          toast("¡Contraseña restablecida! Ingresando a tu panel… ✓");
          window.location.hash = "#/app";
        }
      } catch (err: any) {
        setError(err?.message || "Error al recuperar la cuenta.");
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
      return;
    }
  };

  return (
    <>
      <main className="auth-shell">
        {/* Left Column: Story & Identity */}
        <section className="auth-story">
          <a href="#/" className="auth-brand">
            <LogoMark className="h-9 w-9 text-emerald-400" />
            <span>cupito</span>.
          </a>

          <div className="auth-story-body">
            <span className="auth-kicker">TU PRÓXIMO PASO, MÁS SIMPLE</span>
            <h1>
              Un poco de orden.<br />
              <em>Mucho más tiempo.</em>
            </h1>
            <p>
              Hacé lugar para lo que más amás de tu negocio.
              <br />
              Cupito se ocupa de coordinar tus turnos, sin idas y vueltas.
            </p>

            <div className="auth-feature-list">
              <div>
                <span>
                  <CalendarDays size={20} />
                </span>
                <div>
                  <strong>Una agenda que se entiende</strong>
                  <p>Todos los turnos organizados y visibles desde cualquier pantalla.</p>
                </div>
              </div>

              <div>
                <span>
                  <Users size={20} />
                </span>
                <div>
                  <strong>Tus clientes, a mano</strong>
                  <p>Historial, contacto directo por WhatsApp y preferencias en un solo lugar.</p>
                </div>
              </div>

              <div>
                <span>
                  <LinkIcon size={20} />
                </span>
                <div>
                  <strong>Tu propio enlace de reservas</strong>
                  <p>Lo compartís en tu Instagram o WhatsApp y tus clientes eligen su horario.</p>
                </div>
              </div>
            </div>
          </div>

          <small>
            <Check size={14} className="text-emerald-400" /> Gratis para empezar · Sin tarjeta de crédito
          </small>
        </section>

        {/* Right Column: Form / Recovery Screen */}
        <section className="auth-main">
          <a className="auth-back" href="#/">
            <ArrowLeft size={16} /> Volver a Cupito
          </a>

          <div className="auth-mobile-brand">
            <LogoMark className="h-7 w-7 text-emerald-600" />
            <span>cupito</span>.
          </div>

          <div className="auth-card">
            {generatedRecovery ? (
              /* PANTALLA DE CLAVE DE RECUPERACIÓN ÚNICA */
              <div>
                <span className="auth-symbol">
                  <LockKeyhole size={24} />
                </span>
                <h2>Tu cuenta, protegida.</h2>
                <p>
                  Guardá esta clave única para recuperar tu acceso si alguna vez olvidás la
                  contraseña. <strong>Se muestra una sola vez.</strong>
                </p>

                <code className="recovery-code">{generatedRecovery}</code>

                <div className="auth-recovery-actions">
                  <button type="button" className="auth-secondary" onClick={copyRecovery}>
                    <Copy size={16} />
                    {copied ? "¡Copiada!" : "Copiar clave"}
                  </button>
                  <button type="button" className="auth-secondary" onClick={downloadRecoveryFile}>
                    <Download size={16} />
                    Descargar (.txt)
                  </button>
                </div>

                <button type="button" className="auth-submit" onClick={goDashboard}>
                  Ya la guardé. Ir a mi panel <ArrowRight size={18} />
                </button>

                <p className="auth-recovery-note">
                  Esta clave es confidencial. Guardala en un lugar seguro.
                </p>
              </div>
            ) : (
              /* FORMULARIOS DE LOGIN / REGISTRO / RECUPERACIÓN */
              <div>
                <span className="auth-kicker">
                  {mode === "registro"
                    ? "CREAR TU ESPACIO"
                    : mode === "recuperar"
                    ? "RECUPERAR ACCESO"
                    : "TU ESPACIO EN CUPITO"}
                </span>

                <h2>
                  {mode === "registro"
                    ? "Todo empieza acá."
                    : mode === "recuperar"
                    ? "Volvé a tu negocio."
                    : "Hola, de nuevo."}
                </h2>

                <p>
                  {mode === "registro"
                    ? "Creá tu cuenta gratis y empezá a recibir reservas en menos de dos minutos."
                    : mode === "recuperar"
                    ? "Ingresá tu email y la clave de recuperación que guardaste al registrarte."
                    : "Ingresá tus datos para abrir tu panel y ver tus turnos de hoy."}
                </p>

                <form onSubmit={handleSubmit}>
                  <fieldset disabled={loading} className="auth-fields">
                    {mode === "registro" && (
                      <>
                        <label>
                          Tu nombre
                          <input
                            name="name"
                            autoComplete="name"
                            required
                            maxLength={70}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nombre y apellido"
                            autoFocus
                          />
                        </label>
                        <label>
                          Nombre de tu negocio o local
                          <input
                            name="business"
                            required
                            maxLength={80}
                            value={business}
                            onChange={(e) => setBusiness(e.target.value)}
                            placeholder="Ej. Barbería Central, Nails by Juli…"
                          />
                        </label>
                      </>
                    )}

                    <label>
                      Email
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vos@tunegocio.com"
                        autoFocus={mode !== "registro"}
                      />
                    </label>

                    {mode === "recuperar" && (
                      <label>
                        Clave de recuperación
                        <input
                          name="recovery"
                          required
                          autoComplete="off"
                          spellCheck={false}
                          value={recoveryInput}
                          onChange={(e) => setRecoveryInput(e.target.value)}
                          placeholder="Pegá acá tu clave de 64 caracteres"
                          className="font-mono text-xs"
                        />
                      </label>
                    )}

                    <label>
                      {mode === "recuperar" ? "Nueva contraseña" : "Contraseña"}
                      <span className="auth-password">
                        <input
                          name="password"
                          type={showPass ? "text" : "password"}
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          required
                          minLength={6}
                          maxLength={128}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                          placeholder={mode === "login" ? "Tu contraseña" : "Mínimo 6 caracteres"}
                        />
                        <button
                          type="button"
                          aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
                          onClick={() => setShowPass(!showPass)}
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </span>
                    </label>

                    {mode !== "login" && (
                      <div
                        className={`password-guidance ${password.length >= 6 ? "ready" : ""}`}
                      >
                        <span className="password-length-track">
                          <i
                            style={{
                              width: `${Math.min(100, (password.length / 12) * 100)}%`,
                            }}
                          />
                        </span>
                        <span>
                          {password.length >= 6 ? (
                            <>
                              <Check size={13} /> Longitud adecuada
                            </>
                          ) : (
                            "Usá al menos 6 caracteres para mayor seguridad."
                          )}
                        </span>
                      </div>
                    )}

                    {caps && (
                      <p className="caps-notice flex items-center gap-1.5"><AlertCircle size={14} className="text-amber-500 shrink-0" /> Tenés la tecla Bloq Mayús activada.</p>
                    )}

                    {mode === "login" && (
                      <button
                        type="button"
                        className="auth-forgot"
                        onClick={() => switchMode("recuperar")}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}

                    {error && (
                      <div role="alert" className="auth-error">
                        {error}
                      </div>
                    )}

                    {notice && (
                      <div role="status" className="auth-notice">
                        {notice}
                      </div>
                    )}

                    <button className="auth-submit" type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 size={18} className="auth-spinner" />
                          Verificando…
                        </>
                      ) : (
                        <>
                          {mode === "registro"
                            ? "Crear mi cuenta gratis"
                            : mode === "recuperar"
                            ? "Guardar nueva contraseña"
                            : "Ingresar a mi panel"}
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </fieldset>
                </form>

                <div className="auth-switch">
                  {mode === "registro" ? (
                    <>
                      ¿Ya tenés una cuenta?{" "}
                      <button type="button" onClick={() => switchMode("login")}>
                        Ingresá acá
                      </button>
                    </>
                  ) : mode === "recuperar" ? (
                    <>
                      ¿Te acordaste tu clave?{" "}
                      <button type="button" onClick={() => switchMode("login")}>
                        Volver al inicio de sesión
                      </button>
                    </>
                  ) : (
                    <>
                      ¿Todavía no tenés cuenta?{" "}
                      <button type="button" onClick={() => switchMode("registro")}>
                        Empezá gratis
                      </button>
                    </>
                  )}
                </div>

                <div className="auth-note">
                  <LockKeyhole size={14} />
                  Tus datos y turnos están protegidos y encriptados.
                </div>

                {mode === "registro" && (
                  <p className="mt-4 text-center text-[11px] text-slate-400">
                    Al registrarte aceptás los{" "}
                    <button
                      type="button"
                      onClick={() => setLegal("terms")}
                      className="underline hover:text-emerald-600"
                    >
                      Términos del Servicio
                    </button>{" "}
                    y la{" "}
                    <button
                      type="button"
                      onClick={() => setLegal("privacy")}
                      className="underline hover:text-emerald-600"
                    >
                      Política de Privacidad
                    </button>
                    .
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="auth-bottom">
            ¿Dudas o consultas? Escribinos a{" "}
            <a href="mailto:hola@cupito.app">hola@cupito.app</a>
          </div>
        </section>
      </main>

      {legal === "terms" && (
        <LegalModal doc={TERMS_DOC} onClose={() => setLegal(null)} />
      )}
      {legal === "privacy" && (
        <LegalModal doc={PRIVACY_DOC} onClose={() => setLegal(null)} />
      )}
    </>
  );
}
