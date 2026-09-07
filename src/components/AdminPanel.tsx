import { useMemo, useState, type FormEvent } from "react";
import { useStore, getAdminKey, setAdminKey, PLAN_META, getSubscriptionStatus, fmtLong, fmtMoney, type Plan, type User, type UserSubscription } from "../lib/store";
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
import CustomSelect from "./ui/CustomSelect";

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
    const cleanCode = code.trim();

    // 1. Probar si la clave ingresada es CUPITO_ADMIN_KEY del servidor en Vercel
    try {
      const vRes = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", adminKey: cleanCode }),
      });
      const vData = (await vRes.json().catch(() => ({}))) as { ok?: boolean };
      if (vRes.ok && vData.ok) {
        setAdminKey(cleanCode);
        await adminSetPasscode(cleanCode);
        setBusy(false);
        try {
          sessionStorage.removeItem("cupito_admin_fails");
          sessionStorage.removeItem("cupito_admin_locked_until");
        } catch {}
        toast("Bienvenido a la Central 🔑");
        return;
      }
    } catch {}

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

type AdminTab = "resumen" | "negocios" | "dinero" | "alertas" | "sistema";

function Console() {
  const store = useStore();
  const { users, adminLogout, adminDeleteUser, adminUpdateUser, loginAs, getData, toast, isCloudSyncActive } = store;
  const [tab, setTab] = useState<AdminTab>("resumen");
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

  const dateOnly = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
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
    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    let bookings = 0;
    let todayCount = 0;
    let cancelled = 0;
    let noShow = 0;
    let withOutcome = 0;
    let servicesTotal = 0;
    let last7Bookings = 0;
    const perDay: { key: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      perDay.push({ key, label: String(d.getDate()), count: 0 });
    }
    const perDayMap = new Map(perDay.map((d) => [d.key, d]));
    const signups14: { key: string; label: string; count: number }[] = perDay.map((d) => ({ ...d, count: 0 }));
    const signupsMap = new Map(signups14.map((d) => [d.key, d]));
    const byBiz: { user: User; bookings: number; revenue: number; lastBooking: number }[] = [];

    for (const u of users) {
      const d = getData(u.id);
      bookings += d.bookings.length;
      servicesTotal += d.services.length;
      todayCount += d.bookings.filter((b) => b.date === today && b.status !== "cancelada").length;
      cancelled += d.bookings.filter((b) => b.status === "cancelada").length;
      noShow += d.bookings.filter((b) => b.status === "ausente").length;
      withOutcome += d.bookings.filter((b) => b.status === "atendida" || b.status === "ausente").length;
      const last7 = d.bookings.filter((b) => b.date >= daysAgo(6)).length;
      last7Bookings += last7;
      for (const b of d.bookings) {
        const slot = perDayMap.get(b.date);
        if (slot && b.status !== "cancelada") slot.count += 1;
      }
      const createdKey = dateOnly(u.createdAt);
      const sSlot = signupsMap.get(createdKey);
      if (sSlot) sSlot.count += 1;
      const revenue = d.bookings
        .filter((b) => b.status !== "cancelada")
        .reduce((acc, b) => acc + (d.services.find((s) => s.id === b.serviceId)?.price ?? 0), 0);
      let lastTs = 0;
      for (const b of d.bookings) {
        const ts = new Date(b.date + "T" + (b.time || "12:00")).getTime();
        if (!Number.isNaN(ts) && ts > lastTs) lastTs = ts;
      }
      byBiz.push({ user: u, bookings: d.bookings.filter((b) => b.status !== "cancelada").length, revenue, lastBooking: lastTs });
    }
    const semilla = users.filter((u) => u.plan === "semilla").length;
    const crece = users.filter((u) => u.plan === "crece").length;
    const escala = users.filter((u) => u.plan === "escala").length;
    const paidCount = crece + escala;
    const estimatedMonthly = crece * 9500 + escala * 22000;
    const conversion = users.length ? Math.round((paidCount / users.length) * 100) : 0;
    const avgTicket = paidCount ? Math.round(estimatedMonthly / paidCount) : 0;
    const cancelRate = bookings ? Math.round((cancelled / bookings) * 100) : 0;
    const noShowRate = withOutcome ? Math.round((noShow / withOutcome) * 100) : 0;
    const new7 = users.filter((u) => u.createdAt >= now - 7 * DAY).length;
    const new30 = users.filter((u) => u.createdAt >= now - 30 * DAY).length;
    const expiring7 = users.filter((u) => u.subscription?.nextRenewal && u.subscription.nextRenewal - now < 7 * DAY && u.subscription.nextRenewal >= now).length;
    const expired = users.filter((u) => {
      if (u.plan === "semilla") return false;
      return getSubscriptionStatus(u).isExpired;
    }).length;
    const grace = users.filter((u) => getSubscriptionStatus(u).isGracePeriod).length;
    const mpAuto = users.filter((u) => (u.subscription as UserSubscription | undefined)?.mpPreapprovalId).length;
    const inactive7 = byBiz.filter((b) => b.lastBooking === 0 || b.lastBooking < now - 7 * DAY).length;
    const topByBookings = [...byBiz].sort((a, b) => b.bookings - a.bookings).slice(0, 5);
    const topByRevenue = [...byBiz].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const maxDay = Math.max(1, ...perDay.map((d) => d.count));
    const maxSignup = Math.max(1, ...signups14.map((d) => d.count));

    return {
      locales: users.length, bookings, todayCount, paid: paidCount,
      estimatedMonthly, semilla, crece, escala, conversion, avgTicket,
      cancelRate, cancelled, noShowRate, noShow, last7Bookings, servicesTotal,
      new7, new30, expiring7, expired, grace, mpAuto, inactive7,
      perDay, maxDay, signups14, maxSignup, topByBookings, topByRevenue, byBiz,
      arr: estimatedMonthly * 12,
    };
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
        {/* Hero Central */}
        <section className="overflow-hidden rounded-3xl border-2 border-ink bg-evergreen text-paper shadow-block">
          <div className="flex flex-wrap items-start justify-between gap-5 p-6 sm:p-8">
            <div className="min-w-0 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-lime">
                ✨ Tu SaaS en una mirada
              </span>
              <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                Hola 👋 Así viene Cupito hoy: {stats.locales} locales y {fmtMoney(stats.estimatedMonthly)}/mes
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-paper/70">
                Todo explicado en fácil: cuánta plata entra, cuántos pagan, quién está por vencer y qué negocio necesita ayuda. Elegí una pestaña abajo para ver el detalle.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => setShowNewModal(true)} className="btn-press rounded-full bg-lime px-5 py-2.5 font-display text-xs font-extrabold text-ink hover:bg-limedeep">
                  ＋ Agregar negocio
                </button>
                <button onClick={() => { setTab("negocios"); }} className="btn-press rounded-full border border-paper/25 bg-paper/10 px-5 py-2.5 font-display text-xs font-bold text-paper hover:bg-paper/20">
                  Ver negocios →
                </button>
                <button onClick={() => exportAdminCSV(users, getData)} className="btn-press rounded-full border border-paper/25 px-5 py-2.5 font-display text-xs font-bold text-paper/80 hover:text-paper hover:bg-paper/10">
                  ⬇ Exportar Excel
                </button>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-paper/10 p-4 text-center ring-1 ring-paper/15">
                <p className="font-display text-2xl font-extrabold text-lime">{stats.conversion}%</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-paper/60">Pagan</p>
                <p className="mt-1 text-[10px] text-paper/50">De cada 100, pagan {stats.conversion}</p>
              </div>
              <div className="rounded-2xl bg-paper/10 p-4 text-center ring-1 ring-paper/15">
                <p className="font-display text-2xl font-extrabold text-paper">{stats.todayCount}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-paper/60">Turnos hoy</p>
                <p className="mt-1 text-[10px] text-paper/50">En toda la plataforma</p>
              </div>
              <div className="rounded-2xl bg-paper/10 p-4 text-center ring-1 ring-paper/15">
                <p className="font-display text-2xl font-extrabold text-paper">{stats.new7}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-paper/60">Nuevos 7 días</p>
                <p className="mt-1 text-[10px] text-paper/50">Locales que se sumaron</p>
              </div>
              <div className={`rounded-2xl p-4 text-center ring-1 ${stats.expired + stats.grace > 0 ? "bg-coral/20 ring-coral/40" : "bg-paper/10 ring-paper/15"}`}>
                <p className="font-display text-2xl font-extrabold text-paper">{stats.expired + stats.grace}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-paper/60">Necesitan cobro</p>
                <p className="mt-1 text-[10px] text-paper/50">Vencidos + en gracia</p>
              </div>
            </div>
          </div>
          {/* Pestañas grandes y claras */}
          <nav aria-label="Secciones de la Central" className="flex gap-1.5 overflow-x-auto border-t border-paper/15 bg-pine/60 px-4 py-2.5 sm:px-6">
            {([
              { id: "resumen", label: "📊 Resumen", hint: "Lo importante" },
              { id: "negocios", label: "🏪 Negocios", hint: `${stats.locales}` },
              { id: "dinero", label: "💰 Dinero", hint: fmtMoney(stats.estimatedMonthly) },
              { id: "alertas", label: `🔔 Alertas${stats.expired + stats.expiring7 + stats.grace > 0 ? ` (${stats.expired + stats.expiring7 + stats.grace})` : ""}`, hint: "Qué atender" },
              { id: "sistema", label: "☁️ Sistema", hint: isCloudSyncActive ? "Nube OK" : "Local" },
            ] as { id: AdminTab; label: string; hint: string }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-left transition-all ${
                  tab === t.id ? "bg-lime font-extrabold text-ink shadow-sm" : "text-paper/70 hover:bg-paper/10 hover:text-paper"
                }`}
              >
                <span className="font-display text-xs">{t.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tab === t.id ? "bg-ink/10 text-ink" : "bg-paper/10 text-paper/60"}`}>{t.hint}</span>
              </button>
            ))}
          </nav>
        </section>

        {tab === "resumen" && (
          <div className="pop-in mt-6 space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SaasKpi emoji="🏪" value={String(stats.locales)} title="Negocios registrados" sub={`Semilla ${stats.semilla} · Crece ${stats.crece} · Escala ${stats.escala}`} accent={false} />
              <SaasKpi emoji="💳" value={String(stats.paid)} title={`Pagan (${stats.conversion}%)`} sub="Cuántos dejan plata todos los meses." accent={stats.conversion < 20} />
              <SaasKpi emoji="💰" value={fmtMoney(stats.estimatedMonthly)} title="Plata / mes (MRR)" sub={`Por año: ${fmtMoney(stats.arr)}. Ticket: ${fmtMoney(stats.avgTicket)}.`} accent money />
              <SaasKpi emoji="📅" value={String(stats.bookings)} title={`Turnos totales (${stats.todayCount} hoy)`} sub={`Últimos 7 días: ${stats.last7Bookings}. Servicios: ${stats.servicesTotal}.`} accent={false} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SaasKpi emoji="🆕" value={`+${stats.new30}`} title={`Nuevos 30 días (${stats.new7} en 7d)`} sub="Si este número crece, tu publicidad funciona." small />
              <SaasKpi emoji="⚠️" value={String(stats.expiring7)} title="Vencen en 7 días" sub="Escribiles hoy: son plata casi segura." small alert={stats.expiring7 > 0} />
              <SaasKpi emoji="🔴" value={String(stats.expired)} title={`Vencidos (${stats.grace} en gracia)`} sub="Pasaron su fecha y siguen en básico. +30 días los salva." small alert={stats.expired > 0} />
              <SaasKpi emoji="😴" value={String(stats.inactive7)} title="Sin movimiento 7 días" sub="Sin turnos nuevos. Quizás necesitan ayuda." small alert={stats.inactive7 > 0} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-ink">📈 Turnos · últimos 14 días</h3>
                    <p className="text-xs text-inkmute">Actividad total de la plataforma.</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">{stats.perDay.reduce((a, d) => a + d.count, 0)} turnos</span>
                </div>
                <div className="mt-5 flex h-44 items-end gap-1 sm:gap-1.5">
                  {stats.perDay.map((d, i) => (
                    <div key={d.key} className="group relative flex h-full flex-1 items-end" title={`${d.key}: ${d.count} turnos`}>
                      <div className={`w-full rounded-t-md transition-all ${i === stats.perDay.length - 1 ? "bg-emerald-500 ring-2 ring-emerald-600/30" : "bg-emerald-800/90 group-hover:bg-emerald-700"}`} style={{ height: `${d.count === 0 ? 3 : Math.max(8, (d.count / stats.maxDay) * 100)}%` }} />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{d.count} · {d.key.slice(5)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-1">
                  {stats.perDay.map((d) => (<span key={d.key} className="flex-1 text-center text-[9px] font-bold text-ink/35">{d.label}</span>))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="card p-6">
                  <h3 className="font-display text-lg font-extrabold text-ink">🍰 Cómo se reparten los planes</h3>
                  <p className="text-xs text-inkmute">Distribución por plan.</p>
                  <div className="mx-auto mt-4 h-24 w-24 rounded-full border-4 border-white shadow-sm" style={{ background: `conic-gradient(#10b981 0 ${(stats.crece / Math.max(1, stats.locales)) * 100}%, #0f766e ${(stats.crece / Math.max(1, stats.locales)) * 100}% ${((stats.crece + stats.escala) / Math.max(1, stats.locales)) * 100}%, #e2e8f0 ${((stats.crece + stats.escala) / Math.max(1, stats.locales)) * 100}% 100%)` }} aria-hidden="true" />
                  <div className="mt-4 space-y-2.5">
                    {([
                      { label: "🌱 Semilla gratis", n: stats.semilla, color: "bg-slate-300" },
                      { label: "🌿 Crece $9.500", n: stats.crece, color: "bg-emerald-500" },
                      { label: "🚀 Escala $22.000", n: stats.escala, color: "bg-teal-700" },
                    ] as const).map((r) => (
                      <div key={r.label}>
                        <div className="flex justify-between text-xs font-bold"><span>{r.label}</span><span>{r.n} ({stats.locales ? Math.round((r.n / stats.locales) * 100) : 0}%)</span></div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink/8"><div className={`h-full rounded-full ${r.color}`} style={{ width: `${stats.locales ? (r.n / stats.locales) * 100 : 0}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card p-6">
                  <h3 className="font-display text-lg font-extrabold text-ink">🆕 Locales nuevos · 14 días</h3>
                  <p className="text-xs text-inkmute">Cada barrita = cuántos se crearon ese día.</p>
                  <div className="mt-4 flex h-20 items-end gap-1">
                    {stats.signups14.map((d) => (
                      <div key={d.key} title={`${d.key}: ${d.count}`} className="flex-1 rounded-t bg-lime" style={{ height: `${d.count === 0 ? 4 : Math.max(12, (d.count / stats.maxSignup) * 100)}%`, backgroundColor: d.count > 0 ? "#65a30d" : "#e2e8f0" }} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-bold text-ink">Total 14 días: {stats.signups14.reduce((a, d) => a + d.count, 0)} · <span className="text-inkmute font-semibold">Últimos 7: {stats.new7}</span></p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-extrabold text-ink">🏆 Top por turnos</h3>
                  <button onClick={() => setTab("negocios")} className="text-xs font-bold text-fern hover:underline">Ver todos →</button>
                </div>
                <p className="text-xs text-inkmute">Los que más trabajan. Aprendé de ellos.</p>
                <ol className="mt-4 space-y-2.5">
                  {stats.topByBookings.length === 0 && <li className="text-sm text-inkmute">Todavía no hay datos.</li>}
                  {stats.topByBookings.map((t, i) => (
                    <li key={t.user.id} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-paper px-3 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-display text-xs font-extrabold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-display text-sm font-bold text-ink">{t.user.business}</span><span className="block text-[11px] text-inkmute">{t.bookings} turnos · Plan {PLAN_META[t.user.plan].name}</span></span>
                      <button onClick={() => { loginAs(t.user.id); window.location.hash = "#/app"; }} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">Entrar →</button>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="card p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-extrabold text-ink">💰 Top por plata generada</h3>
                  <button onClick={() => setTab("dinero")} className="text-xs font-bold text-fern hover:underline">Ver dinero →</button>
                </div>
                <p className="text-xs text-inkmute">Estimado según precios × turnos no cancelados.</p>
                <ol className="mt-4 space-y-2.5">
                  {stats.topByRevenue.length === 0 && <li className="text-sm text-inkmute">Todavía no hay datos.</li>}
                  {stats.topByRevenue.map((t, i) => (
                    <li key={t.user.id} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-paper px-3 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 font-display text-xs font-extrabold text-white">{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate font-display text-sm font-bold text-ink">{t.user.business}</span><span className="block text-[11px] text-inkmute">{fmtMoney(t.revenue)} estimados</span></span>
                      <button onClick={() => setEditingUser(t.user)} className="rounded-full border border-ink/15 px-3 py-1.5 text-[11px] font-bold hover:border-ink">Editar</button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {(stats.expired > 0 || stats.expiring7 > 0 || stats.inactive7 > 0) && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
                <p className="font-display text-base font-extrabold text-amber-950">🔔 Hoy te conviene atender esto primero</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {stats.expired > 0 && <li>· <strong>{stats.expired}</strong> vencidos + <strong>{stats.grace}</strong> en gracia → <button onClick={() => setTab("alertas")} className="font-bold underline">ver y dar +30 días</button></li>}
                  {stats.expiring7 > 0 && <li>· <strong>{stats.expiring7}</strong> vencen en 7 días → <button onClick={() => setTab("dinero")} className="font-bold underline">avisarles hoy</button></li>}
                  {stats.inactive7 > 0 && <li>· <strong>{stats.inactive7}</strong> sin movimiento en 7 días → <button onClick={() => setTab("alertas")} className="font-bold underline">entrar y ayudarlos</button></li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === "negocios" && (
          <div className="pop-in mt-6 space-y-6">
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4">
              <p className="font-display text-sm font-extrabold text-emerald-950">🏪 Todos tus locales, con buscador.</p>
              <p className="mt-0.5 text-xs text-emerald-900/80">Escribí el nombre, dueño o email. Tocá “Entrar como dueño” para ayudarlos como si fueras ellos. Nada se rompe.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
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
                  planFilter === f.id ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-ink/12 bg-card text-inkmute hover:border-slate-400"
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
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 font-display text-base font-extrabold text-white shadow-sm">
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

                          {u.plan !== "semilla" && (
                            <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                              {sub?.mpPreapprovalId ? (
                                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  ● MP Débito aut.
                                </span>
                              ) : (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  getSubscriptionStatus(u).isExpired
                                    ? "bg-rose-50 border border-rose-200 text-rose-700"
                                    : getSubscriptionStatus(u).isGracePeriod
                                    ? "bg-amber-50 border border-amber-200 text-amber-800"
                                    : "bg-blue-50 border border-blue-200 text-blue-700"
                                }`}>
                                  {getSubscriptionStatus(u).isExpired
                                    ? "🔴 Vencido"
                                    : getSubscriptionStatus(u).isGracePeriod
                                    ? "⚠️ En gracia"
                                    : `⚡ Manual (${getSubscriptionStatus(u).daysRemaining}d)`}
                                </span>
                              )}
                              {sub?.nextRenewal && (
                                <span className="text-inkmute text-[11px]">
                                  📅 Vence: <strong className="text-ink">{renewalDate?.toLocaleDateString("es-AR")}</strong> ({sub.billing})
                                </span>
                              )}
                              {!sub?.mpPreapprovalId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentRenewal = sub?.nextRenewal && sub.nextRenewal > Date.now() ? sub.nextRenewal : Date.now();
                                    const nextRenewal = currentRenewal + 30 * 24 * 3600 * 1000;
                                    adminUpdateUser(u.id, {
                                      subscription: {
                                        billing: sub?.billing || "mensual",
                                        activeSince: sub?.activeSince || Date.now(),
                                        nextRenewal,
                                        autoRenew: true,
                                        status: "activa",
                                      },
                                    });
                                    toast(`+30 días agregados a ${u.business} ✓`);
                                  }}
                                  className="rounded-md border border-ink/15 bg-white px-2 py-0.5 text-[10px] font-bold text-fern hover:border-fern hover:bg-lime/20 transition-colors shadow-xs"
                                  title="Sumar 30 días de vigencia por pago manual o transferencia"
                                >
                                  +30 días
                                </button>
                              )}
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
                        className="btn-press inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-display text-xs font-bold text-white shadow-sm transition-colors"
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
          </div>
        )}

        {tab === "dinero" && (
          <div className="pop-in mt-6 space-y-6">
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4">
              <p className="font-display text-sm font-extrabold text-emerald-950">💰 Tu plata, sin contadora.</p>
              <p className="mt-0.5 text-xs text-emerald-900/80">MRR = lo que entra todos los meses si nadie se va. Tocá “+30 días” para cobrar un pago manual al instante.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SaasKpi emoji="💰" value={fmtMoney(stats.estimatedMonthly)} title="Entra / mes (MRR)" sub={`Por año: ${fmtMoney(stats.arr)}.`} money />
              <SaasKpi emoji="🎫" value={fmtMoney(stats.avgTicket)} title="Ticket promedio" sub="Lo que paga en promedio cada que sí paga." />
              <SaasKpi emoji="🌿" value={`${stats.crece} × $9.500`} title={`Crece = ${fmtMoney(stats.crece * 9500)}`} sub="Tu plan más popular. El que usa casi todo el mundo." />
              <SaasKpi emoji="🚀" value={`${stats.escala} × $22.000`} title={`Escala = ${fmtMoney(stats.escala * 22000)}`} sub="Tus clientes más grandes. Cuidalos mucho." />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card p-6">
                <h3 className="font-display text-lg font-extrabold text-ink">📅 Quién vence pronto (7 días)</h3>
                <p className="text-xs text-inkmute">Contactalos hoy para renovar sin fricción.</p>
                <div className="mt-4 space-y-2.5">
                  {users.filter((u) => u.subscription?.nextRenewal && u.subscription.nextRenewal - Date.now() < 7 * 24 * 3600 * 1000 && u.subscription.nextRenewal >= Date.now()).length === 0 && (
                    <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">🎉 Nadie vence esta semana. Todo al día.</p>
                  )}
                  {users
                    .filter((u) => u.subscription?.nextRenewal && u.subscription.nextRenewal - Date.now() < 7 * 24 * 3600 * 1000 && u.subscription.nextRenewal >= Date.now())
                    .sort((a, b) => (a.subscription!.nextRenewal - b.subscription!.nextRenewal))
                    .slice(0, 8)
                    .map((u) => (
                      <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5">
                        <span className="min-w-0"><span className="block truncate font-display text-sm font-bold text-ink">{u.business}</span><span className="block text-[11px] text-amber-900">Vence {new Date(u.subscription!.nextRenewal).toLocaleDateString("es-AR")} · {PLAN_META[u.plan].name}</span></span>
                        <span className="flex gap-1.5">
                          <button onClick={() => { loginAs(u.id); window.location.hash = "#/app"; }} className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white">Entrar →</button>
                          <button
                            onClick={() => {
                              const cur = u.subscription!.nextRenewal > Date.now() ? u.subscription!.nextRenewal : Date.now();
                              adminUpdateUser(u.id, { subscription: { ...u.subscription!, nextRenewal: cur + 30 * 24 * 3600 * 1000, status: "activa", autoRenew: true } });
                              toast(`+30 días para ${u.business} ✓`);
                            }}
                            className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                          >
                            +30 días
                          </button>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-display text-lg font-extrabold text-ink">🔴 Vencidos: a recuperar hoy</h3>
                <p className="text-xs text-inkmute">Ya pasaron su fecha. Un mensaje + 30 días los trae de vuelta.</p>
                <div className="mt-4 space-y-2.5">
                  {users.filter((u) => getSubscriptionStatus(u).isExpired).length === 0 && (
                    <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">🎉 Cero vencidos. Sos un campeón.</p>
                  )}
                  {users.filter((u) => getSubscriptionStatus(u).isExpired).slice(0, 8).map((u) => (
                    <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3.5 py-2.5">
                      <span className="min-w-0"><span className="block truncate font-display text-sm font-bold text-ink">{u.business}</span><span className="block text-[11px] text-rose-900">{u.name} · {u.email}</span></span>
                      <span className="flex gap-1.5">
                        <a href={`https://wa.me/${u.email ? "" : ""}`} onClick={(e) => e.preventDefault()} className="hidden" aria-hidden="true">x</a>
                        <button onClick={() => setEditingUser(u)} className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-bold">Editar</button>
                        <button
                          onClick={() => {
                            adminUpdateUser(u.id, { subscription: { billing: u.subscription?.billing || "mensual", activeSince: u.subscription?.activeSince || Date.now(), nextRenewal: Date.now() + 30 * 24 * 3600 * 1000, autoRenew: true, status: "activa" } });
                            toast(`Reactivado ${u.business} por 30 días ✓`);
                          }}
                          className="rounded-full bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700"
                        >
                          Reactivar +30d
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl bg-slate-900 p-4 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">💡 Cómo cobrar en 1 minuto</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">1) Pedí la transferencia. 2) Tocá +30 días. 3) Avisale por WhatsApp que ya está activo. Listo, sin Mercado Pago.</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-extrabold text-ink">🧾 Todos los pagos, en una tabla simple</h3>
                  <p className="text-xs text-inkmute">Quién paga, cómo (automático o manual) y cuándo vence. Verde = al día. Rojo = atender hoy.</p>
                </div>
                <button onClick={() => exportAdminCSV(users, getData)} className="rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold hover:border-ink">⬇ Exportar Excel (.csv)</button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-ink/10 text-[10px] uppercase tracking-wider text-inkmute">
                      <th className="py-2 pr-3">Negocio</th>
                      <th className="py-2 pr-3">Plan</th>
                      <th className="py-2 pr-3">Cobro</th>
                      <th className="py-2 pr-3">Vence</th>
                      <th className="py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...users].sort((a, b) => (a.subscription?.nextRenewal || 0) - (b.subscription?.nextRenewal || 0)).slice(0, 20).map((u) => {
                      const st = getSubscriptionStatus(u);
                      const auto = (u.subscription as UserSubscription | undefined)?.mpPreapprovalId ? "⚡ Automático" : u.plan === "semilla" ? "— Gratis" : "✋ Manual";
                      const vence = u.subscription?.nextRenewal ? new Date(u.subscription.nextRenewal).toLocaleDateString("es-AR") : "—";
                      return (
                        <tr key={u.id} className="border-b border-ink/5 hover:bg-paper">
                          <td className="py-2 pr-3 font-bold text-ink">{u.business}</td>
                          <td className="py-2 pr-3">{PLAN_META[u.plan].name}</td>
                          <td className="py-2 pr-3">{auto}</td>
                          <td className="py-2 pr-3">{vence}</td>
                          <td className="py-2">{u.plan === "semilla" ? "🌱 Gratis" : st.isExpired ? "🔴 Vencido" : st.isGracePeriod ? "🟡 En gracia" : st.isExpiringSoon ? `🟡 ${st.daysRemaining}d` : "🟢 Al día"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "alertas" && (
          <div className="pop-in mt-6 space-y-6">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-display text-sm font-extrabold text-amber-950">🔔 Tu lista de hoy: qué atender primero.</p>
              <p className="mt-0.5 text-xs text-amber-900/80">Empezá por los rojos (plata), después amarillos (riesgo) y al final grises (ayuda). Cada tarjeta tiene su botón de solución.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <AlertCard
                emoji="🔴"
                title={`Vencidos (${stats.expired})`}
                desc="Pasaron su fecha y están en básico. Se van si no los llamás."
                empty="🎉 Sin vencidos. Todo cobrado."
                items={users.filter((u) => getSubscriptionStatus(u).isExpired).slice(0, 6).map((u) => ({ id: u.id, name: u.business, sub: `${u.name} · ${u.email}` }))}
                actionLabel="+30 días"
                onAction={(id) => {
                  const u = users.find((x) => x.id === id);
                  if (!u) return;
                  adminUpdateUser(id, { subscription: { billing: u.subscription?.billing || "mensual", activeSince: u.subscription?.activeSince || Date.now(), nextRenewal: Date.now() + 30 * 24 * 3600 * 1000, autoRenew: true, status: "activa" } });
                  toast("Reactivado por 30 días ✓");
                }}
                onOpen={(id) => { loginAs(id); window.location.hash = "#/app"; }}
              />
              <AlertCard
                emoji="🟡"
                title={`Vencen en 7 días (${stats.expiring7})`}
                desc="Avisales hoy por WhatsApp y cobrás sin perseguir."
                empty="🎉 Nadie vence esta semana."
                items={users.filter((u) => u.subscription?.nextRenewal && u.subscription.nextRenewal - Date.now() < 7 * 24 * 3600 * 1000 && u.subscription.nextRenewal >= Date.now()).slice(0, 6).map((u) => ({ id: u.id, name: u.business, sub: `Vence ${new Date(u.subscription!.nextRenewal).toLocaleDateString("es-AR")}` }))}
                actionLabel="+30 días"
                onAction={(id) => {
                  const u = users.find((x) => x.id === id);
                  if (!u?.subscription) return;
                  const cur = u.subscription.nextRenewal > Date.now() ? u.subscription.nextRenewal : Date.now();
                  adminUpdateUser(id, { subscription: { ...u.subscription, nextRenewal: cur + 30 * 24 * 3600 * 1000, status: "activa" } });
                  toast("+30 días ✓");
                }}
                onOpen={(id) => { loginAs(id); window.location.hash = "#/app"; }}
              />
              <AlertCard
                emoji="😴"
                title={`Sin movimiento 7 días (${stats.inactive7})`}
                desc="Sin turnos nuevos. Entrá, mirá sus horarios y dales una mano."
                empty="🎉 Todos se mueven. Buen trabajo."
                items={stats.byBiz.filter((b) => b.lastBooking === 0 || b.lastBooking < Date.now() - 7 * 24 * 3600 * 1000).slice(0, 6).map((b) => ({ id: b.user.id, name: b.user.business, sub: b.lastBooking === 0 ? "Nunca tuvo turnos" : `Último: ${new Date(b.lastBooking).toLocaleDateString("es-AR")}` }))}
                actionLabel="Entrar y ayudar"
                onAction={(id) => { loginAs(id); window.location.hash = "#/app"; }}
                onOpen={(id) => { const u = users.find((x) => x.id === id); if (u) setEditingUser(u); }}
              />
              <AlertCard
                emoji="🧩"
                title="Sin servicios cargados"
                desc="Si no tienen servicios, no pueden recibir reservas. Es lo primero que hay que cargar."
                empty="🎉 Todos tienen servicios."
                items={users.filter((u) => getData(u.id).services.length === 0).slice(0, 6).map((u) => ({ id: u.id, name: u.business, sub: u.email }))}
                actionLabel="Entrar y cargar"
                onAction={(id) => { loginAs(id); window.location.hash = "#/app"; }}
                onOpen={(id) => { const u = users.find((x) => x.id === id); if (u) setEditingUser(u); }}
              />
            </div>
          </div>
        )}

        {tab === "sistema" && (
          <div className="pop-in mt-6 grid gap-6 lg:grid-cols-2">
            <div className="card p-6">
              <h3 className="font-display text-lg font-extrabold text-ink">☁️ Nube: ¿dónde se guardan los datos?</h3>
              <p className="mt-1 text-sm text-inkmute">Verde = todo se guarda en internet y se ve en todos los celus. Amarillo = solo en este navegador.</p>
              <div className={`mt-4 rounded-2xl border p-4 ${isCloudSyncActive ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
                <p className="font-display text-sm font-extrabold">{isCloudSyncActive ? "🟢 Nube activa y sincronizando" : "🟡 Modo local: solo este dispositivo"}</p>
                <p className="mt-1 text-xs text-inkmute">{isCloudSyncActive ? "Lo que crees acá aparece al instante en cualquier celu." : "Conectá Supabase para que todo se vea en todos lados."}</p>
                <button onClick={() => setShowSyncModal(true)} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  {isCloudSyncActive ? "Ver detalles" : "Cómo activar la nube →"}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button onClick={() => exportAdminCSV(users, getData)} className="rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-xs font-bold hover:border-ink">⬇ Exportar negocios</button>
                <button onClick={() => { setTab("negocios"); }} className="rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-xs font-bold hover:border-ink">🔍 Buscar negocio</button>
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-display text-lg font-extrabold text-ink">🧭 Atajos para todos los días</h3>
              <p className="text-xs text-inkmute">Lo que vas a tocar 9 de 10 veces, en botones gigantes.</p>
              <div className="mt-4 grid gap-2.5">
                <button onClick={() => setShowNewModal(true)} className="flex items-center justify-between rounded-2xl bg-lime px-4 py-3.5 font-display text-sm font-extrabold text-ink hover:bg-limedeep">＋ Crear negocio nuevo <span>→</span></button>
                <button onClick={() => { setTab("alertas"); }} className="flex items-center justify-between rounded-2xl bg-slate-900 px-4 py-3.5 font-display text-sm font-extrabold text-white hover:bg-slate-800">🔔 Ver qué necesita atención <span>→</span></button>
                <button onClick={() => { setTab("dinero"); }} className="flex items-center justify-between rounded-2xl border-2 border-ink/10 bg-paper px-4 py-3.5 font-display text-sm font-extrabold text-ink hover:border-ink">💰 Revisar cobros <span>→</span></button>
              </div>
              <p className="mt-4 rounded-xl bg-paper px-4 py-3 text-xs leading-relaxed text-inkmute">💡 Consejo de abuelo: si algo se ve raro, recargá la página. El 90% se arregla así. Si sigue raro, la nube te dice qué pasa arriba a la derecha.</p>
            </div>
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

/* ============ HELPERS SaaS (tarjetas y exportación) ============ */
function SaasKpi({ emoji, value, title, sub, money = false, small = false, alert = false, accent = false }: { emoji: string; value: string; title: string; sub: string; money?: boolean; small?: boolean; alert?: boolean; accent?: boolean }) {
  return (
    <div className={`card p-5 shadow-sm ${alert ? "!border-rose-300 !bg-rose-50/50" : accent ? "!border-amber-300 !bg-amber-50/60" : money ? "!border-emerald-300 !bg-emerald-50/50" : ""}`}>
      <span className="text-2xl" aria-hidden="true">{emoji}</span>
      <p className={`mt-2 font-display font-extrabold text-ink ${small ? "text-2xl" : "text-3xl"} ${money ? "!text-emerald-800" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-inkmute">{title}</p>
      <p className="mt-1 text-[11px] leading-snug text-inkmute">{sub}</p>
    </div>
  );
}

function AlertCard({ emoji, title, desc, empty, items, actionLabel, onAction, onOpen }: {
  emoji: string; title: string; desc: string; empty: string;
  items: { id: string; name: string; sub: string }[];
  actionLabel: string; onAction: (id: string) => void; onOpen: (id: string) => void;
}) {
  return (
    <div className="card p-6">
      <p className="font-display text-lg font-extrabold text-ink">{emoji} {title}</p>
      <p className="mt-0.5 text-xs text-inkmute">{desc}</p>
      {items.length === 0 ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-white px-3.5 py-2.5">
              <span className="min-w-0"><span className="block truncate font-display text-sm font-bold text-ink">{it.name}</span><span className="block truncate text-[11px] text-inkmute">{it.sub}</span></span>
              <span className="flex shrink-0 gap-1.5">
                <button onClick={() => onOpen(it.id)} className="rounded-full border border-ink/15 px-3 py-1.5 text-[11px] font-bold hover:border-ink">Ver</button>
                <button onClick={() => onAction(it.id)} className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700">{actionLabel}</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function exportAdminCSV(users: User[], getData: (id: string) => { bookings: { status: string }[]; services: unknown[] }) {
  try {
    const headers = ["Negocio", "Dueno", "Email", "Slug", "Plan", "Vence", "Turnos", "Creado"];
    const rows = users.map((u) => {
      const d = getData(u.id);
      const vence = u.subscription?.nextRenewal ? new Date(u.subscription.nextRenewal).toISOString().slice(0, 10) : "";
      const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
      return [esc(u.business), esc(u.name), esc(u.email), esc(u.slug), esc(u.plan), vence, d.bookings.length, new Date(u.createdAt).toISOString().slice(0, 10)].join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cupito-negocios-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* noop */ }
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
                <CustomSelect
                  value={plan}
                  onChange={(val) => setPlan(val as Plan)}
                  options={[
                    { value: "semilla", label: "Semilla", sublabel: "Gratis" },
                    { value: "crece", label: "Crece", sublabel: "$9.500/mes" },
                    { value: "escala", label: "Escala", sublabel: "$22.000/mes" },
                  ]}
                  placeholder="Elegir plan"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Facturación</label>
                <CustomSelect
                  value={billing}
                  onChange={(val) => setBilling(val as "mensual" | "anual")}
                  options={[
                    { value: "mensual", label: "Mensual" },
                    { value: "anual", label: "Anual" },
                  ]}
                  placeholder="Elegir facturación"
                />
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
                  <div className="w-36">
                    <CustomSelect
                      value={status}
                      onChange={(val) => setStatus(val as "activa" | "cancelada")}
                      options={[
                        { value: "activa", label: "Activa" },
                        { value: "cancelada", label: "Cancelada" },
                      ]}
                      placeholder="Estado"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-ink/10 pt-4">
            <button type="button" onClick={onClose} className="btn-press rounded-full border-2 border-ink/15 px-5 py-2.5 font-display text-sm font-bold text-inkmute hover:text-ink">Cancelar</button>
            <button type="submit" className="btn-press rounded-full bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 font-display text-sm font-bold text-white shadow-sm transition-colors">Guardar cambios</button>
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
                <CustomSelect
                  value={plan}
                  onChange={(val) => setPlan(val as Plan)}
                  options={[
                    { value: "semilla", label: "Semilla", sublabel: "Gratis" },
                    { value: "crece", label: "Crece", sublabel: "$9.500" },
                    { value: "escala", label: "Escala", sublabel: "$22.000" },
                  ]}
                  placeholder="Plan"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Facturación</label>
                <CustomSelect
                  value={billing}
                  onChange={(val) => setBilling(val as "mensual" | "anual")}
                  options={[
                    { value: "mensual", label: "Mensual" },
                    { value: "anual", label: "Anual" },
                  ]}
                  placeholder="Facturación"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-inkmute uppercase">Días Vigencia</label>
                <CustomSelect
                  value={String(durationDays)}
                  onChange={(val) => setDurationDays(Number(val))}
                  options={[
                    { value: "30", label: "30 días", sublabel: "1 mes" },
                    { value: "60", label: "60 días", sublabel: "2 meses" },
                    { value: "90", label: "90 días", sublabel: "3 meses" },
                    { value: "365", label: "365 días", sublabel: "1 año" },
                  ]}
                  placeholder="Vigencia"
                />
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
                  className="btn-press shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 font-display text-xs font-bold text-white shadow-sm transition-colors"
                >
                  Guardar
                </button>
              </div>
              {adminKey && getAdminKey() === adminKey.trim() && adminKey.trim() !== "" && (
                <p className="font-bold text-fern">✓ Clave guardada: la Central ya puede operar la nube.</p>
              )}
            </div>

            <div className="rounded-xl border border-ink/10 bg-paper p-3 text-xs space-y-1.5">
              <p className="font-bold text-ink">4. Entrada sin fricción (Supabase Auth):</p>
              <p className="text-inkmute">En Supabase ➔ <strong>Authentication</strong> ➔ <strong>Sign In/Up</strong> ➔ desactivá <strong>“Confirm email”</strong> (entran directo, sin verificar). En <strong>URL Configuration</strong> dejá Site URL = tu dominio igual. Opcional anti-bots: sumá Cloudflare Turnstile en <strong>Auth → CAPTCHA</strong> y la var <strong className="font-mono">VITE_TURNSTILE_SITEKEY</strong> en Vercel.</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-ink/10 pt-4">
            <button onClick={onClose} className="btn-press rounded-full bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 font-display text-xs font-bold text-white shadow-sm transition-colors">Entendido</button>
          </div>
        </div>
      </div>
    </div>
  );
}

