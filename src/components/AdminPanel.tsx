import { useMemo, useState, type FormEvent } from "react";
import { useStore, PLAN_META, fmtLong, type Plan } from "../lib/store";
import { LogoMark, IconLock, IconUsers, IconCalendar, IconStar, IconTrash, IconChevron, IconLogout } from "./kit";

/* Central Cupito — ruta oculta #/central.
   La llave maestra se guarda como hash SHA-256 y la sesión vive en sessionStorage
   (se cierra sola al cerrar la pestaña). En producción se blinda con Supabase RLS. */

async function hashPasscode(code: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`cupito::${code}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminPanel() {
  const store = useStore();
  const { isAdmin, adminHasPasscode } = store;

  if (!isAdmin) return <Gate hasCode={adminHasPasscode()} />;
  return <Console />;
}

function Gate({ hasCode }: { hasCode: boolean }) {
  const { adminSetPasscode, adminLogin, toast } = useStore();
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (hasCode) {
      const ok = await adminLogin(code);
      setBusy(false);
      if (!ok) {
        setError("Llave incorrecta. Probá de nuevo.");
        setShakeKey((k) => k + 1);
        return;
      }
      toast("Bienvenido a la Central 🔑");
      return;
    }
    if (code.length < 6) {
      setBusy(false);
      setError("La llave necesita al menos 6 caracteres.");
      setShakeKey((k) => k + 1);
      return;
    }
    if (code !== confirm) {
      setBusy(false);
      setError("Las dos llaves no coinciden.");
      setShakeKey((k) => k + 1);
      return;
    }
    await adminSetPasscode(code);
    setBusy(false);
    toast("Llave maestra creada. Guardala bien 🔑");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-evergreen px-5 text-paper">
      <div className="gridlines absolute inset-0" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/3 h-80 w-[560px] -translate-x-1/2 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 65%)" }} aria-hidden="true" />
      <div key={shakeKey} className={`relative w-full max-w-sm rounded-[24px] border-2 border-paper/15 bg-pine/80 p-8 ${error ? "shake" : ""}`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime/15 text-lime"><IconLock className="h-5 w-5" /></span>
          <div>
            <p className="font-display text-xl font-extrabold">Central Cupito</p>
            <p className="text-xs text-paper/55">Acceso restringido</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-paper/50">{hasCode ? "Llave maestra" : "Creá tu llave maestra (mín. 6 caracteres)"}</label>
            <input type="password" className="field" value={code} onChange={(e) => setCode(e.target.value)} autoFocus placeholder="••••••••" />
          </div>
          {!hasCode && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-paper/50">Repetila</label>
              <input type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          {error && <p className="rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-lime py-3.5 font-display text-base font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-limedeep disabled:opacity-60">
            {busy ? "Verificando…" : hasCode ? "Entrar a la Central" : "Crear llave y entrar"}
          </button>
        </form>
        <p className="mt-5 text-center text-[11px] leading-snug text-paper/40">
          La llave se guarda cifrada (SHA-256) y la sesión se cierra al cerrar la pestaña.
        </p>
        <a href="#/" className="mt-4 block text-center text-xs font-bold text-paper/50 underline-offset-4 transition-colors hover:text-lime hover:underline">← Volver al sitio</a>
      </div>
    </div>
  );
}

function Console() {
  const store = useStore();
  const { users, adminLogout, adminSetPlan, adminDeleteUser, loginAs, getData, toast } = store;
  const [q, setQ] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => b.createdAt - a.createdAt);
    if (!t) return sorted;
    return sorted.filter((u) => u.business.toLowerCase().includes(t) || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t));
  }, [users, q]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let bookings = 0;
    let todayCount = 0;
    for (const u of users) {
      const d = getData(u.id);
      bookings += d.bookings.length;
      todayCount += d.bookings.filter((b) => b.date === today && b.status !== "cancelada").length;
    }
    return { locales: users.length, bookings, todayCount, paid: users.filter((u) => u.plan !== "semilla").length };
  }, [users, getData]);

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b-2 border-ink/10 bg-evergreen text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 text-fern" />
            <div>
              <p className="font-display text-xl font-bold leading-tight">Central Cupito</p>
              <p className="text-[11px] text-paper/50">Panel de administración · no indexado</p>
            </div>
          </div>
          <button onClick={() => { adminLogout(); window.location.hash = "#/"; }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-paper/25 px-4 py-2 font-display text-xs font-bold text-paper transition-all hover:border-coral hover:text-coral">
            <IconLogout className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Locales registrados", value: stats.locales, icon: <IconUsers className="h-5 w-5" /> },
            { label: "Turnos hoy", value: stats.todayCount, icon: <IconCalendar className="h-5 w-5" /> },
            { label: "Reservas totales", value: stats.bookings, icon: <IconCalendar className="h-5 w-5" /> },
            { label: "Planes pagos", value: stats.paid, icon: <IconStar className="h-5 w-5" /> },
          ].map((k) => (
            <div key={k.label} className="card card-hover p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/8 text-fern">{k.icon}</span>
              <p className="mt-3 font-display text-3xl font-extrabold text-ink">{k.value}</p>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <input className="field max-w-sm" placeholder="Buscar por negocio, nombre o email…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-sm font-bold text-inkmute">{list.length} resultado{list.length === 1 ? "" : "s"}</span>
        </div>

        {list.length === 0 ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-ink/20 bg-card/60 px-6 py-12 text-center">
            <p className="font-display text-xl font-extrabold text-ink">Todavía no hay locales{q && " con esa búsqueda"}.</p>
            <p className="mt-1 text-sm text-inkmute">Cuando alguien se registre, aparece acá al instante.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {list.map((u) => {
              const d = getData(u.id);
              const active = d.bookings.filter((b) => b.status !== "cancelada");
              const next = [...active].filter((b) => b.date >= new Date().toISOString().slice(0, 10)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
              return (
                <div key={u.id} className="card card-hover p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-evergreen font-display text-sm font-bold text-lime">
                        {u.business.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div>
                        <p className="font-display text-xl font-extrabold text-ink">{u.business}</p>
                        <p className="text-sm text-inkmute">{u.name} · {u.email}</p>
                        <p className="text-xs text-ink/50">cupito.app/{u.slug} · {active.length} turnos · {d.reviews.length} reseñas</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={u.plan} onChange={(e) => { adminSetPlan(u.id, e.target.value as Plan); toast(`${u.business} → plan ${PLAN_META[e.target.value as Plan].name}`); }}
                        className="field !w-auto" aria-label={`Plan de ${u.business}`}>
                        {(Object.keys(PLAN_META) as Plan[]).map((p) => <option key={p} value={p}>{PLAN_META[p].name}</option>)}
                      </select>
                      <button onClick={() => { loginAs(u.id); window.location.hash = "#/app"; }}
                        className="rounded-full bg-evergreen px-5 py-2.5 font-display text-sm font-bold text-lime transition-all hover:-translate-y-0.5 hover:bg-pine">Entrar como dueño</button>
                      <a href={`#/b/${u.slug}`} className="rounded-full border-2 border-ink/15 px-4 py-2.5 font-display text-sm font-bold text-ink transition-all hover:border-evergreen hover:text-evergreen">Ver página</a>
                      {confirmDel === u.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={() => { adminDeleteUser(u.id); setConfirmDel(null); toast(`${u.business} eliminado.`, "warn"); }} className="rounded-full bg-coral px-4 py-2.5 font-display text-sm font-bold text-white transition-all hover:-translate-y-0.5">Confirmar</button>
                          <button onClick={() => setConfirmDel(null)} className="rounded-full border-2 border-ink/15 px-3 py-2.5 font-display text-sm font-bold text-inkmute">No</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmDel(u.id)} aria-label="Eliminar cuenta" className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute transition-colors hover:border-coral hover:text-coral"><IconTrash className="h-4 w-4" /></button>
                      )}
                    </div>
                  </div>
                  {next.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t-2 border-dashed border-ink/10 pt-4">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-inkmute">Próximos turnos:</span>
                      {next.map((b) => (
                        <span key={b.id} className="rounded-full bg-lime/30 px-3 py-1 text-xs font-bold text-fern">
                          {fmtLong(b.date).split(",")[0]} {b.time} · {b.client}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 flex items-center gap-2 text-center text-xs text-inkmute">
          <IconChevron className="h-3.5 w-3.5" />
          El modo soporte abre el panel real del local con un banner de aviso. En producción esto se protege con roles en la base de datos (Supabase RLS).
        </p>
      </main>
    </div>
  );
}
