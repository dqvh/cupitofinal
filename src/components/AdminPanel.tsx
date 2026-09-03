import { useMemo, useState, type FormEvent } from "react";
import { useStore, getAdminKey, setAdminKey, PLAN_META, fmtLong, fmtMoney, type Plan, type User, type UserSubscription } from "../lib/store";
import {
  LogoMark,
  IconLock,
  IconUsers,
  IconCalendar,
  IconStar,
  IconTrash,
  IconChevron,
  IconLogout,
  IconPencil,
  IconPlus,
  IconCheck,
  IconSearch,
  CopyButton,
  Badge,
} from "./kit";

/* Central Cupito — ruta #/admin o #/central.
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

  const [attempts, setAttempts] = useState(() => {
    try {
      return Number(sessionStorage.getItem("cupito_admin_fails") || "0");
    } catch { return 0; }
  });
  const [lockoutUntil, setLockoutUntil] = useState(() => {
    try {
      return Number(sessionStorage.getItem("cupito_admin_locked_until") || "0");
    } catch { return 0; }
  });

  const isLocked = lockoutUntil > Date.now();
  const minutesLeft = Math.ceil((lockoutUntil - Date.now()) / (1000 * 60));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError(`Acceso bloqueado por seguridad. Esperá ${minutesLeft} minuto${minutesLeft === 1 ? "" : "s"}.`);
      setShakeKey((k) => k + 1);
      return;
    }
    setBusy(true);
    setError(null);

    if (hasCode) {
      const ok = await adminLogin(code);
      setBusy(false);
      if (!ok) {
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        try { sessionStorage.setItem("cupito_admin_fails", String(nextAttempts)); } catch {}

        if (nextAttempts >= 5) {
          const lockTime = Date.now() + 5 * 60 * 1000;
          setLockoutUntil(lockTime);
          try { sessionStorage.setItem("cupito_admin_locked_until", String(lockTime)); } catch {}
          setError("Demasiados intentos incorrectos. El acceso está bloqueado por 5 minutos.");
        } else {
          setError(`Llave incorrecta. Te quedan ${5 - nextAttempts} intento${5 - nextAttempts === 1 ? "" : "s"}.`);
        }
        setShakeKey((k) => k + 1);
        return;
      }
      try {
        sessionStorage.removeItem("cupito_admin_fails");
        sessionStorage.removeItem("cupito_admin_locked_until");
      } catch {}
      toast("Bienvenido a la Central 🔑");
      return;
    }

    if (code.length < 4) {
      setBusy(false);
      setError("La llave necesita al menos 4 caracteres.");
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
      <div className="gridlines absolute inset-0 opacity-30" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/3 h-80 w-[560px] -translate-x-1/2 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #cdf463 0%, transparent 65%)" }} aria-hidden="true" />
      <div key={shakeKey} className={`relative w-full max-w-sm rounded-[24px] border-2 border-paper/15 bg-pine/90 p-8 shadow-2xl backdrop-blur-md ${error ? "shake" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime/15 text-lime"><IconLock className="h-6 w-6" /></span>
          <div>
            <p className="font-display text-2xl font-extrabold">Central Cupito</p>
            <p className="text-xs text-paper/60">Panel Super-Admin</p>
          </div>
        </div>

        {isLocked && (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-center text-xs font-semibold text-rose-300">
            🛡️ Acceso suspendido temporalmente por seguridad. Podrás intentar de nuevo en {minutesLeft} minuto{minutesLeft === 1 ? "" : "s"}.
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-paper/60">
              {hasCode ? "Llave maestra de acceso" : "Creá tu llave maestra (mín. 4 caracteres)"}
            </label>
            <input
              type="password"
              disabled={isLocked}
              className="field !bg-evergreen/80 !text-paper !border-paper/20 disabled:opacity-40"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              placeholder="••••••••"
            />
          </div>
          {!hasCode && (
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-paper/60">Repetila para confirmar</label>
              <input type="password" className="field !bg-evergreen/80 !text-paper !border-paper/20" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          {error && <p className="rounded-lg border-2 border-coral/40 bg-coral/10 px-3 py-2 text-xs font-semibold text-coral">{error}</p>}
          <button type="submit" disabled={busy || isLocked} className="btn-press w-full rounded-full bg-lime py-3.5 font-display text-base font-bold text-ink hover:bg-limedeep shadow-lg disabled:opacity-60">
            {busy ? "Verificando…" : isLocked ? "Bloqueado temporalmente" : hasCode ? "Entrar a la Central →" : "Crear llave y entrar →"}
          </button>
        </form>
        <p className="mt-5 text-center text-[11px] leading-snug text-paper/50">
          Protegido con SHA-256 y bloqueo automático anti-ataques. La sesión se destruye al cerrar la pestaña.
        </p>
        <a href="#/" className="mt-4 block text-center text-xs font-bold text-paper/60 underline-offset-4 transition-colors hover:text-lime hover:underline">← Volver al sitio principal</a>
      </div>
    </div>
  );
}

function Console() {
  const store = useStore();
  const { users, adminLogout, adminDeleteUser, loginAs, getData, toast, isCloudSyncActive } = store;
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"todos" | Plan | "expiring">("todos");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const now = Date.now();
    return [...users]
      .filter((u) => {
        if (planFilter === "todos") return true;
        if (planFilter === "expiring") {
          return u.subscription && u.subscription.nextRenewal && u.subscription.nextRenewal - now < 7 * 24 * 3600 * 1000;
        }
        return u.plan === planFilter;
      })
      .filter((u) => {
        if (!t) return true;
        return (
          u.business.toLowerCase().includes(t) ||
          u.name.toLowerCase().includes(t) ||
          u.email.toLowerCase().includes(t) ||
          u.slug.toLowerCase().includes(t) ||
          u.plan.toLowerCase().includes(t)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [users, q, planFilter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let bookings = 0;
    let todayCount = 0;
    for (const u of users) {
      const d = getData(u.id);
      bookings += d.bookings.length;
      todayCount += d.bookings.filter((b) => b.date === today && b.status !== "cancelada").length;
    }
    const paidCount = users.filter((u) => u.plan !== "semilla").length;
    const estimatedMonthly = users.reduce((acc, u) => {
      if (u.plan === "crece") return acc + 9500;
      if (u.plan === "escala") return acc + 22000;
      return acc;
    }, 0);

    return { locales: users.length, bookings, todayCount, paid: paidCount, estimatedMonthly };
  }, [users, getData]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b-2 border-ink/10 bg-evergreen text-paper shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 text-fern" />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-display text-xl font-extrabold leading-tight">Central Cupito</p>
                <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold uppercase text-ink">Super-Admin</span>
              </div>
              <p className="text-[11px] text-paper/60">Control total de negocios, planes y soporte</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowSyncModal(true)}
              className={`btn-press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                isCloudSyncActive
                  ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  : "border border-amber-400/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              }`}
              title="Estado de conexión con Supabase"
            >
              <span className={`h-2 w-2 rounded-full ${isCloudSyncActive ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
              {isCloudSyncActive ? "Nube activa ☁️" : "Modo Local (Activar Nube)"}
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-press inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 font-display text-xs font-bold text-ink hover:bg-limedeep shadow-sm"
            >
              <IconPlus className="h-4 w-4" /> Agregar negocio
            </button>
            <button
              onClick={() => { adminLogout(); window.location.hash = "#/"; }}
              className="btn-press inline-flex items-center gap-1.5 rounded-full border-2 border-paper/20 px-3.5 py-2 font-display text-xs font-bold text-paper transition-all hover:border-coral hover:text-coral"
            >
              <IconLogout className="h-4 w-4" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        {/* Métricas clave */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/5 text-fern"><IconUsers className="h-5 w-5" /></span>
            <p className="mt-3 font-display text-3xl font-extrabold text-ink">{stats.locales}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">Negocios registrados</p>
          </div>
          <div className="card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime/20 text-fern"><IconStar className="h-5 w-5" /></span>
            <p className="mt-3 font-display text-3xl font-extrabold text-ink">{stats.paid}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">Planes pagos activos</p>
          </div>
          <div className="card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-extrabold">$</span>
            <p className="mt-3 font-display text-3xl font-extrabold text-emerald-800">{fmtMoney(stats.estimatedMonthly)}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">Facturación estimada / mes</p>
          </div>
          <div className="card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/5 text-fern"><IconCalendar className="h-5 w-5" /></span>
            <p className="mt-3 font-display text-3xl font-extrabold text-ink">{stats.todayCount}</p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">Turnos agendados hoy ({stats.bookings} totales)</p>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-inkmute" />
            <input
              className="field !py-2.5 !pl-9 !pr-4 !rounded-full !text-xs"
              placeholder="Buscar por negocio, dueño, email, slug o plan…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-inkmute hover:text-ink">✕</button>
            )}
          </div>

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
            {[
              { id: "todos", label: `Todos (${users.length})` },
              { id: "semilla", label: `Semilla (${users.filter((u) => u.plan === "semilla").length})` },
              { id: "crece", label: `Crece (${users.filter((u) => u.plan === "crece").length})` },
              { id: "escala", label: `Escala (${users.filter((u) => u.plan === "escala").length})` },
              { id: "expiring", label: "Próximos a vencer" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setPlanFilter(f.id as typeof planFilter)}
                className={`btn-press whitespace-nowrap rounded-full border-2 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                  planFilter === f.id ? "border-evergreen bg-evergreen text-lime" : "border-ink/12 bg-card text-inkmute hover:border-evergreen"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Listado de Negocios */}
        {list.length === 0 ? (
          <div className="mt-8 rounded-2xl border-2 border-dashed border-ink/20 bg-card/60 px-6 py-12 text-center">
            <p className="font-display text-xl font-extrabold text-ink">No se encontraron negocios{q && ` para "${q}"`}.</p>
            <p className="mt-1 text-sm text-inkmute">Podés registrar un negocio manualmente usando el botón de arriba.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {list.map((u) => {
              const d = getData(u.id);
              const activeBookings = d.bookings.filter((b) => b.status !== "cancelada");
              const now = Date.now();
              const sub = u.subscription;
              const renewalDate = sub?.nextRenewal ? new Date(sub.nextRenewal) : null;
              const isExpired = renewalDate ? renewalDate.getTime() < now : false;
              const daysLeft = renewalDate ? Math.ceil((renewalDate.getTime() - now) / (1000 * 3600 * 24)) : null;

              return (
                <div key={u.id} className="card card-hover p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {/* Info principal */}
                    <div className="flex items-start gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-evergreen font-display text-base font-extrabold text-lime shadow-sm">
                        {u.business.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-xl font-extrabold text-ink">{u.business}</p>
                          <Badge
                            variant={u.plan === "escala" ? "lime" : u.plan === "crece" ? "success" : "neutral"}
                            size="sm"
                          >
                            Plan {PLAN_META[u.plan].name}
                          </Badge>
                          {sub && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${isExpired ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                              {isExpired ? "Vencido" : `Vence en ${daysLeft} días`}
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 text-sm text-inkmute">
                          Dueño: <strong className="text-ink">{u.name}</strong> · Email: <strong className="text-ink">{u.email}</strong>
                        </p>

                        {/* Credenciales y URL */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink/5 px-2.5 py-1">
                            <span className="text-inkmute font-semibold">Contraseña:</span>
                            <span className="font-mono font-bold text-ink">
                              {revealedPasswords[u.id] ? u.password : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(u.id)}
                              className="text-[10px] font-bold text-fern hover:underline ml-1"
                            >
                              {revealedPasswords[u.id] ? "Ocultar" : "Ver"}
                            </button>
                            <CopyButton text={u.password} label="" copiedLabel="✓" className="!p-1 !bg-transparent" />
                          </span>

                          <span className="inline-flex items-center gap-1 text-inkmute">
                            <span>Link público:</span>
                            <a
                              href={`/${u.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-bold text-fern hover:underline"
                            >
                              cupito.app/{u.slug}
                            </a>
                            <CopyButton text={`https://cupito.app/${u.slug}`} label="" copiedLabel="✓" className="!p-1 !bg-transparent" />
                          </span>

                          {sub?.nextRenewal && (
                            <span className="text-inkmute">
                              📅 Vence: <strong className="text-ink">{renewalDate?.toLocaleDateString("es-AR")}</strong> ({sub.billing})
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-xs text-ink/50">
                          {activeBookings.length} turnos activos · {d.services.length} servicios · {d.reviews.length} reseñas · Registrado: {new Date(u.createdAt).toLocaleDateString("es-AR")}
                        </p>
                      </div>
                    </div>

                    {/* Acciones de administración */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          loginAs(u.id);
                          window.location.hash = "#/app";
                        }}
                        className="btn-press inline-flex items-center gap-1.5 rounded-full bg-evergreen px-4 py-2 font-display text-xs font-bold text-lime hover:bg-pine shadow-sm"
                        title="Abrir panel del negocio para configurarlo o ayudar al dueño"
                      >
                        🚀 Entrar como dueño
                      </button>

                      <button
                        onClick={() => setEditingUser(u)}
                        className="btn-press inline-flex items-center gap-1 rounded-full border-2 border-ink/15 bg-white px-3.5 py-2 font-display text-xs font-bold text-ink hover:border-ink hover:shadow-sm"
                      >
                        <IconPencil className="h-3.5 w-3.5" /> Editar
                      </button>

                      <a
                        href={`/${u.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-press rounded-full border-2 border-ink/15 px-3.5 py-2 font-display text-xs font-bold text-ink hover:border-evergreen hover:text-evergreen"
                      >
                        Ver página ↗
                      </a>

                      {confirmDel === u.id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              adminDeleteUser(u.id);
                              setConfirmDel(null);
                              toast(`${u.business} eliminado permanentemente.`, "warn");
                            }}
                            className="btn-press rounded-full bg-coral px-3.5 py-2 font-display text-xs font-bold text-white hover:bg-coral/90"
                          >
                            Confirmar borrado
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            className="btn-press rounded-full border-2 border-ink/15 px-3 py-2 font-display text-xs font-bold text-inkmute"
                          >
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDel(u.id)}
                          aria-label="Eliminar cuenta"
                          title="Eliminar este negocio"
                          className="btn-press flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute hover:border-coral hover:text-coral"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal de Editar Negocio */}
      {editingUser && (
        <EditBusinessModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
        />
      )}

      {/* Modal de Agregar Nuevo Negocio */}
      {showNewModal && (
        <NewBusinessModal
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* Modal informativo de Sincronización Supabase */}
      {showSyncModal && (
        <SyncInfoModal
          isConfigured={isCloudSyncActive}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </div>
  );
}

/* ============ MODAL: EDITAR NEGOCIO ============ */
function EditBusinessModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { adminUpdateUser, toast } = useStore();
  const [name, setName] = useState(user.name);
  const [business, setBusiness] = useState(user.business);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState(user.password);
  const [slug, setSlug] = useState(user.slug);
  const [plan, setPlan] = useState<Plan>(user.plan);
  const [billing, setBilling] = useState<"mensual" | "anual">(user.subscription?.billing || "mensual");
  const [renewalDateStr, setRenewalDateStr] = useState(
    user.subscription?.nextRenewal
      ? new Date(user.subscription.nextRenewal).toISOString().slice(0, 10)
      : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [autoRenew, setAutoRenew] = useState(user.subscription?.autoRenew ?? true);
  const [status, setStatus] = useState<"activa" | "cancelada">(user.subscription?.status || "activa");

  const addDaysToRenewal = (days: number) => {
    const d = new Date(Date.now() + days * 24 * 3600 * 1000);
    setRenewalDateStr(d.toISOString().slice(0, 10));
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !business.trim() || !email.trim()) {
      return toast("Completá nombre, negocio y email.", "warn");
    }

    const nextRenewal = new Date(renewalDateStr + "T23:59:59").getTime();

    const subscription: UserSubscription | undefined =
      plan === "semilla"
        ? undefined
        : {
            billing,
            activeSince: user.subscription?.activeSince || Date.now(),
            nextRenewal: isNaN(nextRenewal) ? Date.now() + 30 * 24 * 3600 * 1000 : nextRenewal,
            autoRenew,
            status,
          };

    adminUpdateUser(user.id, {
      name: name.trim(),
      business: business.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-"),
      plan,
      subscription,
    });

    toast(`Datos de ${business} actualizados con éxito ✓`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-ink/15 bg-card p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <div>
            <h3 className="font-display text-2xl font-extrabold text-ink">Editar Negocio</h3>
            <p className="text-xs text-inkmute">Modificá información, credenciales y plan</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute hover:border-coral hover:text-coral font-bold">✕</button>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Nombre del Negocio *</label>
              <input className="field" value={business} onChange={(e) => setBusiness(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Nombre del Dueño *</label>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Email de Ingreso *</label>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Contraseña *</label>
              <input className="field" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Slug de la Página (URL)</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-inkmute font-mono">cupito.app/</span>
              <input className="field !py-2 font-mono text-xs" value={slug} onChange={(e) => setSlug(e.target.value)} required />
            </div>
          </div>

          {/* Configuración de Plan y Vencimiento */}
          <div className="rounded-2xl border-2 border-ink/10 bg-paper p-4 space-y-3">
            <p className="font-display text-xs font-extrabold uppercase tracking-wider text-ink">Plan y Suscripción</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Plan Asignado</label>
                <select className="field !py-2" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
                  <option value="semilla">Semilla (Gratis)</option>
                  <option value="crece">Crece ($9.500/mes)</option>
                  <option value="escala">Escala ($22.000/mes)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Facturación</label>
                <select className="field !py-2" value={billing} onChange={(e) => setBilling(e.target.value as "mensual" | "anual")}>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
            </div>

            {plan !== "semilla" && (
              <div className="space-y-2 pt-2 border-t border-ink/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-ink">Fecha de vencimiento / renovación</label>
                  <span className="text-[11px] font-mono text-inkmute">{renewalDateStr}</span>
                </div>
                <input
                  type="date"
                  className="field !py-2"
                  value={renewalDateStr}
                  onChange={(e) => setRenewalDateStr(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" onClick={() => addDaysToRenewal(30)} className="rounded-md border border-ink/15 bg-white px-2 py-1 text-[10px] font-bold hover:bg-ink/5">+30 días</button>
                  <button type="button" onClick={() => addDaysToRenewal(90)} className="rounded-md border border-ink/15 bg-white px-2 py-1 text-[10px] font-bold hover:bg-ink/5">+90 días</button>
                  <button type="button" onClick={() => addDaysToRenewal(365)} className="rounded-md border border-ink/15 bg-white px-2 py-1 text-[10px] font-bold hover:bg-ink/5">+1 año</button>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <label className="text-xs text-inkmute font-semibold">Estado de suscripción:</label>
                  <select className="field !w-auto !py-1 !text-xs" value={status} onChange={(e) => setStatus(e.target.value as "activa" | "cancelada")}>
                    <option value="activa">Activa</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-ink/10 pt-4">
            <button type="button" onClick={onClose} className="btn-press rounded-full border-2 border-ink/15 px-5 py-2.5 font-display text-sm font-bold text-inkmute hover:text-ink">Cancelar</button>
            <button type="submit" className="btn-press rounded-full bg-evergreen px-6 py-2.5 font-display text-sm font-bold text-lime hover:bg-pine shadow-sm">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============ MODAL: NUEVO NEGOCIO ============ */
function NewBusinessModal({ onClose }: { onClose: () => void }) {
  const { adminAddUser, toast } = useStore();
  const [business, setBusiness] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("cupito123");
  const [plan, setPlan] = useState<Plan>("crece");
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");
  const [durationDays, setDurationDays] = useState(30);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!business.trim() || !name.trim() || !email.trim()) {
      return toast("Completá todos los campos requeridos.", "warn");
    }

    setBusy(true);
    const res = await adminAddUser({
      business: business.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password.trim() || "cupito123",
      plan,
      billing,
      durationDays,
    });
    setBusy(false);

    if (!res.ok) {
      return toast(res.error || "No se pudo crear el negocio.", "warn");
    }

    toast(`¡Negocio ${business} creado con éxito en plan ${PLAN_META[plan].name}! 🎉`);
    if (res.warning) toast(res.warning, "warn");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border-2 border-ink/15 bg-card p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <div>
            <h3 className="font-display text-2xl font-extrabold text-ink">Agregar Nuevo Negocio</h3>
            <p className="text-xs text-inkmute">Dalo de alta directamente con el plan y vigencia que elijas</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute hover:border-coral hover:text-coral font-bold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Nombre del Negocio *</label>
              <input className="field" placeholder="Ej. Peluquería Central" value={business} onChange={(e) => setBusiness(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Nombre del Dueño *</label>
              <input className="field" placeholder="Ej. Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Email de Ingreso *</label>
              <input className="field" type="email" placeholder="juan@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-inkmute uppercase">Contraseña</label>
              <input className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="cupito123" />
            </div>
          </div>

          <div className="rounded-2xl border-2 border-ink/10 bg-paper p-4 space-y-3">
            <p className="font-display text-xs font-extrabold uppercase tracking-wider text-ink">Plan y Vigencia</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Plan</label>
                <select className="field !py-2" value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
                  <option value="semilla">Semilla (Gratis)</option>
                  <option value="crece">Crece</option>
                  <option value="escala">Escala</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Facturación</label>
                <select className="field !py-2" value={billing} onChange={(e) => setBilling(e.target.value as "mensual" | "anual")}>
                  <option value="mensual">Mensual</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Días Vigencia</label>
                <select className="field !py-2" value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))}>
                  <option value={30}>30 días (1 mes)</option>
                  <option value={60}>60 días (2 meses)</option>
                  <option value={90}>90 días (3 meses)</option>
                  <option value={365}>365 días (1 año)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-ink/10 pt-4">
            <button type="button" onClick={onClose} className="btn-press rounded-full border-2 border-ink/15 px-5 py-2.5 font-display text-sm font-bold text-inkmute hover:text-ink">Cancelar</button>
            <button type="submit" disabled={busy} className="btn-press rounded-full bg-lime px-6 py-2.5 font-display text-sm font-bold text-ink hover:bg-limedeep shadow-sm disabled:opacity-60">{busy ? "Creando…" : "Crear Negocio →"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============ MODAL: INFORMACIÓN SUPABASE ============ */
function SyncInfoModal({ isConfigured, onClose }: { isConfigured: boolean; onClose: () => void }) {
  const [adminKey, setAdminKeyState] = useState(getAdminKey());
  const sqlSnippet = `-- 1. Columnas Auth (migración segura, correr de nuevo si ya existe todo)
ALTER TABLE cupito_users ADD COLUMN IF NOT EXISTS auth_id TEXT UNIQUE;
ALTER TABLE cupito_users ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE cupito_users ALTER COLUMN password DROP NOT NULL;
ALTER TABLE cupito_data ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- 2. RLS: lectura pública, escritura solo del dueño, SIN delete público
-- (ver supabase-schema.sql en el repo para el script completo)`;

  const saveKey = () => {
    setAdminKey(adminKey.trim());
    setAdminKeyState(adminKey.trim());
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="pop-in max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-ink/15 bg-card p-6 shadow-2xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ink/10 pb-4">
          <div className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-base ${isConfigured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {isConfigured ? "☁️" : "⚠️"}
            </span>
            <div>
              <h3 className="font-display text-xl font-extrabold text-ink">Sincronización en la Nube (Supabase)</h3>
              <p className="text-xs text-inkmute">Conexión en tiempo real entre computadoras y celulares</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink/15 text-inkmute hover:border-coral hover:text-coral font-bold">✕</button>
        </div>

        <div className="mt-5 space-y-4 text-sm text-ink">
          {isConfigured ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-emerald-900">
              <p className="font-bold flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
                ¡Supabase está conectado y sincronizando!
              </p>
              <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                Cualquier negocio que crees o edites se guardará en la base de datos central. Cuando alguien abra el link desde su celular o cualquier otro navegador, verá la página inmediatamente.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-amber-900">
              <p className="font-bold">⚠️ Actualmente estás en Modo Local (localStorage)</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Los datos que creás se guardan únicamente en la memoria de este navegador. Por eso, al entrar desde el celular, te dice que el negocio todavía no tiene su página.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-inkmute">Pasos para conectar Supabase en 2 minutos:</p>

            <div className="rounded-xl border border-ink/10 bg-paper p-3 text-xs space-y-1.5">
              <p className="font-bold text-ink">1. Variables de entorno en Vercel:</p>
              <p className="text-inkmute">En tu proyecto de Vercel ➔ <strong>Settings</strong> ➔ <strong>Environment Variables</strong>, agregá:</p>
              <ul className="list-disc pl-5 font-mono text-[11px] text-fern space-y-0.5">
                <li>VITE_SUPABASE_URL = (tu Project URL de Supabase)</li>
                <li>VITE_SUPABASE_ANON_KEY = (tu anon public API key)</li>
              </ul>
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper p-3 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-bold text-ink">2. Tablas en Supabase (SQL Editor):</p>
                <CopyButton text={sqlSnippet} label="Copiar SQL" copiedLabel="¡Copiado!" className="!py-1 !px-2.5 !text-[11px]" />
              </div>
              <p className="text-inkmute">En Supabase ➔ <strong>SQL Editor</strong> ➔ Pegá el script y dale a <strong>Run</strong>.</p>
              <pre className="max-h-28 overflow-y-auto rounded-lg bg-ink/5 p-2 font-mono text-[10px] text-ink/70">
                {sqlSnippet}
              </pre>
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper p-3 text-xs space-y-1.5">
              <p className="font-bold text-ink">3. Clave de Central (para crear/editar negocios en la nube):</p>
              <p className="text-inkmute">Creá <strong className="font-mono">CUPITO_ADMIN_KEY</strong> en Vercel con cualquier texto largo, y pegala acá (queda en este navegador):</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="field !py-2 font-mono !text-xs"
                  placeholder="Pegá la clave…"
                  value={adminKey}
                  onChange={(e) => setAdminKeyState(e.target.value)}
                />
                <button
                  type="button"
                  onClick={saveKey}
                  className="btn-press shrink-0 rounded-xl bg-evergreen px-4 font-display text-xs font-bold text-lime"
                >
                  Guardar
                </button>
              </div>
              {adminKey && getAdminKey() === adminKey.trim() && adminKey.trim() !== "" && (
                <p className="font-bold text-fern">✓ Clave guardada: la Central ya puede operar la nube.</p>
              )}
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper p-3 text-xs space-y-1.5">
              <p className="font-bold text-ink">4. Login sin fricción (Supabase Auth):</p>
              <p className="text-inkmute">En Supabase ➔ <strong>Authentication</strong> ➔ <strong>Sign In/Up</strong> ➔ desactivá <strong>“Confirm email”</strong>. Si no, cada registro exige verificar el email.</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-ink/10 pt-4">
            <button onClick={onClose} className="btn-press rounded-full bg-evergreen px-6 py-2.5 font-display text-xs font-bold text-lime">Entendido</button>
          </div>
        </div>
      </div>
    </div>
  );
}

