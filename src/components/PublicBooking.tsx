import { fitsWorkingDay } from "../lib/scheduling";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, MapPin,
  ShieldCheck, Package, Plus, Minus, Calendar, Download, Search,
  MessageCircle, ExternalLink, Star, X, ChevronDown
} from "lucide-react";
import {
  useStore, dateKey, addDays, fmtMoney, fmtLong, slotsForDay, dayOfWeek, isPaid,
  findOverlap, isSlotBlocked,
  getProHours, isProAvailable, getAvailablePros, toMinutes,
  type User, type BizData,
} from "../lib/store";
import { CopyButton } from "./kit";
import CustomSelect from "./ui/CustomSelect";
import { normalizeArgentinaPhone, cleanPhoneDigits, createWhatsAppUrl } from "../lib/phone";
import { sound } from "../lib/audio";
import { sendBookingConfirmationEmail } from "../lib/email";
import "../styles/booking.css";

/* ---------- helpers calendario ---------- */
function toLocalStamp(dt: Date) {
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}T${String(dt.getHours()).padStart(2, "0")}${String(dt.getMinutes()).padStart(2, "0")}00`;
}

function buildDates(date: string, time: string, duration: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  return { start, end: new Date(start.getTime() + duration * 60000) };
}

function icsContent(o: { title: string; date: string; time: string; duration: number; desc: string }) {
  const { start, end } = buildDates(o.date, o.time, o.duration);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cupito//Reservas//ES",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@cupito.app`,
    `DTSTART:${toLocalStamp(start)}`,
    `DTEND:${toLocalStamp(end)}`,
    `SUMMARY:${o.title}`,
    `DESCRIPTION:${o.desc}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT24H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu turno es mañana",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio de tu turno",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mi-turno-cupito.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function gcalUrl(o: { title: string; date: string; time: string; duration: number; desc?: string }) {
  const { start, end } = buildDates(o.date, o.time, o.duration);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(o.title)}&dates=${toLocalStamp(start)}/${toLocalStamp(end)}&details=${encodeURIComponent(o.desc || "Turno reservado con Cupito. ¡Te esperamos!")}`;
}

export default function PublicBooking(props: { owner?: ({ user: User; data: BizData }) | null; isPreview?: boolean; initialLookupOpen?: boolean; initialReviewOpen?: boolean } = {}) {
  const store = useStore();
  const owner = props.owner || (store.user && store.data ? { user: store.user, data: store.data } : null);
  if (!owner) return <p role="status" className="p-8 text-center">Cargando información del local…</p>;
  return <BookingForm key={owner.user.id} {...props} owner={owner} />;
}

function BookingForm({
  owner,
  isPreview = false,
  initialLookupOpen = false,
  initialReviewOpen = false,
}: {
  owner?: ({ user: User } & Record<"data", BizData>) | null;
  isPreview?: boolean;
  initialLookupOpen?: boolean;
  initialReviewOpen?: boolean;
} = {}) {
  const store = useStore();
  const user = owner ? owner.user : store.user;
  const biz = owner ? owner.data : store.data;
  const { addBookingFor, cancelBookingByClient, addReviewFor, sessionUserId } = store;

  // Estados del asistente de reserva
  const [step, setStep] = useState(0); // 0: Servicio | 1: Horario y Profesional | 2: Contacto
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => dateKey(new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [productsOpen, setProductsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Modales
  const [showLookupModal, setShowLookupModal] = useState(initialLookupOpen);
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);

  const [showReviewsModal, setShowReviewsModal] = useState(initialReviewOpen);
  const [newReviewAuthor, setNewReviewAuthor] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Filtro de servicios
  const [serviceSearch, setServiceSearch] = useState("");

  const submittingRef = useRef(false);

  // Validación telefónica argentina
  const phoneVal = useMemo(() => normalizeArgentinaPhone(phone), [phone]);

  if (!user || !biz) {
    return (
      <div className="panel form-panel" style={{ maxWidth: 700, margin: "auto", textAlign: "center", padding: 40 }}>
        <p>Cargando información del local...</p>
      </div>
    );
  }

  const settings = biz.settings;
  const isDemo = user.slug === "studio-nails" || user.slug === "demo" || user.slug === "cupito-demo";
  const paid = isPaid(user);

  const accentColor = useMemo(() => {
    switch (settings.theme) {
      case "coral": return "#ff7a59";
      case "midnight": return "#38bdf8";
      case "rose": return "#f472b6";
      case "obsidian": return "#fbbf24";
      case "ocean": return "#34d399";
      default: return "#16845f";
    }
  }, [settings.theme]);

  const service = biz.services.find((s) => s.id === serviceId);
  const pro = biz.professionals.find((p) => p.id === proId);
  const hasPros = biz.professionals.length > 0;
  const maxAdvanceDays = settings.maxAdvanceDays ?? 30;

  const now = new Date();
  const todayKey = dateKey(now);
  const maxDateKey = maxAdvanceDays > 0 ? dateKey(addDays(now, maxAdvanceDays)) : "9999-99-99";
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const dur = service?.duration ?? 45;

  // Filtro de servicios
  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return biz.services;
    return biz.services.filter((s) => s.name.toLowerCase().includes(q));
  }, [biz.services, serviceSearch]);

  // Chequeo de día abierto
  const isDayOpen = (key: string) => {
    const dIdx = dayOfWeek(key);
    if ((settings.closedDates || []).includes(key)) return false;
    if (pro) {
      const proH = getProHours(pro, settings.hours)[dIdx];
      return !!proH?.open;
    }
    if (hasPros) {
      return biz.professionals.some((p) => {
        const proH = getProHours(p, settings.hours)[dIdx];
        return !!proH?.open;
      });
    }
    return !!settings.hours[dIdx]?.open;
  };

  // Turnos brutos para el día seleccionado
  const rawSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dIdx = dayOfWeek(selectedDate);
    if (pro) {
      const proH = getProHours(pro, settings.hours)[dIdx];
      return proH?.open ? slotsForDay(proH) : [];
    }
    if (hasPros) {
      const set = new Set<string>();
      biz.professionals.forEach((p) => {
        const proH = getProHours(p, settings.hours)[dIdx];
        if (proH?.open) {
          slotsForDay(proH).forEach((s) => set.add(s));
        }
      });
      return Array.from(set).sort((a, b) => toMinutes(a) - toMinutes(b));
    }
    const h = settings.hours[dIdx];
    return h?.open ? slotsForDay(h) : [];
  }, [selectedDate, pro, hasPros, biz.professionals, settings.hours]);

  // Verificar si un slot específico está tomado o pasado
  const isSlotDisabled = (t: string) => {
    if (selectedDate === todayKey && t <= currentHHMM) return true;
    if (pro) {
      return !isProAvailable(pro, selectedDate, t, dur, settings.hours, biz.blockedSlots || [], biz.bookings, biz.services);
    }
    if (hasPros) {
      return getAvailablePros(biz.professionals, selectedDate, t, dur, settings.hours, biz.blockedSlots || [], biz.bookings, biz.services).length === 0;
    }
    if (!fitsWorkingDay(settings.hours[dayOfWeek(selectedDate)], t, dur)) return true;
    if (isSlotBlocked(biz.blockedSlots || [], selectedDate, t)) return true;
    return !!findOverlap({ date: selectedDate, time: t, dur }, biz.bookings, biz.services);
  };

  // Seña configurada
  const depositOn = paid && settings.depositEnabled && settings.depositPct > 0;
  const depositAmount = depositOn && service ? Math.round((service.price * settings.depositPct) / 100) : 0;

  // Carrito de productos
  const productsTotal = useMemo(() => {
    return (biz.products || []).reduce((acc, p) => acc + (cart[p.id] || 0) * p.price, 0);
  }, [biz.products, cart]);

  const productsCount = useMemo(
    () => Object.values(cart).reduce((total, quantity) => total + quantity, 0),
    [cart]
  );

  const cartItemsArray = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, quantity]) => ({ id, quantity }));
  }, [cart]);

  // Reseñas y promedio
  const avgRating = useMemo(() => {
    if (!biz.reviews || biz.reviews.length === 0) return null;
    return (biz.reviews.reduce((acc, r) => acc + r.rating, 0) / biz.reviews.length).toFixed(1);
  }, [biz.reviews]);

  // Días de atención
  const openDaysCount = useMemo(() => {
    return settings.hours.filter((h) => h.open).length;
  }, [settings.hours]);

  // Turnos del cliente en modal de consulta
  const clientBookings = useMemo(() => {
    if (!lookupPhone.trim()) return [];
    const digits = cleanPhoneDigits(lookupPhone);
    if (digits.length < 6) return [];
    return (biz.bookings || []).filter((b) => cleanPhoneDigits(b.phone).includes(digits));
  }, [biz.bookings, lookupPhone]);

  // Confirmar reserva
  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!serviceId || !selectedDate || !time) {
      setError("Por favor seleccioná servicio, fecha y horario.");
      return;
    }
    if (client.trim().length < 2) {
      setError("Ingresá tu nombre y apellido.");
      return;
    }
    if (!phoneVal.isValid) {
      setError("Ingresá un número de celular válido de Argentina (ej. 11 1234 5678).");
      return;
    }

    if (selectedDate < todayKey || selectedDate > maxDateKey || (settings.closedDates || []).includes(selectedDate) || isSlotDisabled(time)) {
      setError("Ese horario ya no está disponible. Elegí otro antes de confirmar.");
      setStep(1);
      setTime(null);
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError(null);

    const bookingItems = cartItemsArray.length > 0
      ? cartItemsArray.map(({ id, quantity }) => ({ productId: id, qty: quantity }))
      : undefined;

    let res: Awaited<ReturnType<typeof addBookingFor>>;
    try {
    res = await addBookingFor(user.id, {
      client: client.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      serviceId,
      date: selectedDate,
      time,
      source: "online",
      items: bookingItems,
      proId: proId ?? undefined,
      status: depositOn && depositAmount > 0 ? "pendiente" : undefined,
    });

    } catch {
      setError("No pudimos confirmar el turno. Revisá tu conexión y consultá Mis turnos antes de volver a intentar.");
      return;
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }

    if (!res.ok) {
      setError(res.error || "No se pudo realizar la reserva. Por favor elegí otro horario.");
      return;
    }

    setDone(true);
    sound.playSuccess();

    // Enviar email de confirmación si el cliente puso correo
    if (email.trim()) {
      const gcal = gcalUrl({
        title: `${service?.name || "Turno"} en ${user.business}`,
        date: selectedDate,
        time,
        duration: dur,
        desc: `Turno confirmado en ${user.business}. Dirección: ${settings.address || "A consultar con el local"}.`,
      });

      sendBookingConfirmationEmail({
        toEmail: email.trim(),
        clientName: client.trim(),
        businessName: user.business,
        serviceName: service?.name || "Servicio",
        dateStr: fmtLong(selectedDate),
        timeStr: time,
        proName: pro?.name,
        priceStr: fmtMoney(service?.price || 0),
        depositStr: depositAmount > 0 ? fmtMoney(depositAmount) : undefined,
        address: settings.address,
        slug: user.slug,
        gCalUrl: gcal,
      }).catch(() => {});
    }

    // Scroll suave arriba para ver el comprobante
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setStep(0);
    setServiceId(null);
    setProId(null);
    setTime(null);
    setClient("");
    setPhone("");
    setEmail("");
    setNotes("");
    setCart({});
    setProductsOpen(false);
    setError(null);
    setDone(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // URLs y comprobantes
  const shownDate = selectedDate ? fmtLong(selectedDate) : "";

  const whatsAppProofUrl = useMemo(() => {
    if (!settings.whatsapp) return null;
    const msg = `Hola ${user.business}! Acabo de reservar mi turno para ${service?.name || "un servicio"} el ${shownDate} a las ${time} hs. Te adjunto el comprobante de la seña 🙌`;
    return createWhatsAppUrl(settings.whatsapp, msg);
  }, [settings.whatsapp, user.business, service?.name, shownDate, time]);

  const whatsAppGeneralUrl = useMemo(() => {
    if (!settings.whatsapp) return null;
    const msg = `Hola ${user.business}! Vengo de su página y quería hacer una consulta sobre los turnos 🙌`;
    return createWhatsAppUrl(settings.whatsapp, msg);
  }, [settings.whatsapp, user.business]);

  const gcalHref = useMemo(() => {
    if (!service || !time) return "#";
    return gcalUrl({
      title: `${service.name} en ${user.business}`,
      date: selectedDate,
      time,
      duration: dur,
      desc: `Turno en ${user.business}. Dirección: ${settings.address || "A coordinar"}.`,
    });
  }, [service, user.business, selectedDate, time, dur, settings.address]);

  const handleDownloadIcs = () => {
    if (!service || !time) return;
    const content = icsContent({
      title: `${service.name} - ${user.business}`,
      date: selectedDate,
      time,
      duration: dur,
      desc: `Turno reservado en ${user.business}. ¡Te esperamos!`,
    });
    downloadIcs(content);
  };

  // Enviar reseña
  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewAuthor.trim() || !newReviewText.trim()) return;
    await addReviewFor(user.id, {
      client: newReviewAuthor.trim(),
      rating: newReviewRating,
      text: newReviewText.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    setReviewSuccess(true);
    setTimeout(() => {
      setShowReviewsModal(false);
      setReviewSuccess(false);
      setNewReviewAuthor("");
      setNewReviewText("");
    }, 1500);
  };

  const bookingCardContent = (
    <div className={`booking-shell ${isPreview ? "preview-shell" : ""}`}>
      {/* Columna Izquierda: Tarjeta del Negocio */}
      <aside className="business-card">
        <div className="large-logo">
          <picture>
            <source srcSet="/cupito-logo.webp" type="image/webp" />
            <img src="/cupito-logo.png" width="64" height="64" alt="Logo de Cupito" decoding="async" />
          </picture>
        </div>

        {isDemo && <span className="demo-pill">Página de demostración</span>}

        <h1>{user.business}</h1>
        <p>{settings.description || "Reservá tu lugar en menos de un minuto. Rápido, fácil y sin llamadas."}</p>

        {avgRating !== null && (
          <button
            type="button"
            onClick={() => setShowReviewsModal(true)}
            className="text-link"
            style={{ marginTop: 14, fontSize: 13, gap: 5 }}
          >
            <Star size={15} fill="currentColor" style={{ color: "#eab308" }} />
            <b>{avgRating}</b>
            <span className="muted">({biz.reviews.length} reseña{biz.reviews.length === 1 ? "" : "s"})</span>
          </button>
        )}

        <div className="business-info">
          <div>
            <MapPin size={17} />
            <span>
              {settings.address || "Consultá la dirección con el local"}
              {settings.mapsUrl && (
                <a
                  href={settings.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-link"
                  style={{ display: "inline-flex", marginLeft: 8, fontSize: 12 }}
                >
                  Ver mapa <ExternalLink size={11} />
                </a>
              )}
            </span>
          </div>

          <div>
            <Clock size={17} />
            <span>
              {openDaysCount} días de atención por semana
              <br />
              Hora de Buenos Aires
            </span>
          </div>

          <div>
            <ShieldCheck size={17} />
            <span>Tu horario, reservado para vos.</span>
          </div>

          {settings.whatsapp && (
            <div>
              <MessageCircle size={17} />
              <a href={whatsAppGeneralUrl || "#"} target="_blank" rel="noreferrer" className="text-link">
                Escribir al WhatsApp
              </a>
            </div>
          )}
        </div>

        <p className="small muted" style={{ marginTop: "auto", paddingTop: 35 }}>
          Reservas simples, con <b>cupito.</b>
        </p>
      </aside>

      {/* Columna Derecha: Asistente de Reserva */}
      <section className="booking-form">
        {done ? (
          /* Pantalla de confirmación */
          <div className="success">
            <CheckCircle2 size={58} className="text-emerald-600" />
            <h2 style={{ fontSize: 26, fontWeight: 750, color: "#0f172a", marginTop: 14 }}>
              {depositOn && depositAmount > 0
                ? "¡Turno reservado! Un paso más para confirmar"
                : "¡Tu turno está confirmado!"}
            </h2>
            
            <div
              style={{
                margin: "20px 0 24px",
                padding: "20px",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: 16,
                textAlign: "left",
                display: "grid",
                gap: 8,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, color: "#334155", fontWeight: 500 }}>
                {client}, te esperamos en <b style={{ color: "#0f172a" }}>{user.business}</b>.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{service?.name}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "var(--business-accent, #16845f)" }}>
                  {fmtMoney((service?.price || 0) + productsTotal)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: "#475569" }}>
                📅 {shownDate} a las <b style={{ color: "#0f172a" }}>{time} hs</b> · con {pro ? pro.name : "nuestro equipo"}
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: depositOn && depositAmount > 0 ? "#b45309" : "#059669" }}>
                {depositOn && depositAmount > 0 ? "⚠️ Seña pendiente de transferencia" : "✓ Pago en el local"}
              </p>
            </div>

            {/* Aviso de transferencia si requiere seña */}
            {depositOn && depositAmount > 0 && (
              <div className="notice" style={{ textAlign: "left" }}>
                <b style={{ fontSize: 15, color: "#92400e", display: "block" }}>Transferí la seña de {fmtMoney(depositAmount)}</b>
                <div
                  style={{
                    margin: "12px 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "white",
                    padding: "12px 16px",
                    borderRadius: 12,
                    border: "1.5px solid #fde68a",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#1e293b" }}>
                    Alias / CBU: <b style={{ color: "#0f172a" }}>{settings.transferAlias || settings.transferCBU || "Consultá con el local"}</b>
                  </span>
                  {(settings.transferAlias || settings.transferCBU) && (
                    <CopyButton
                      text={settings.transferAlias || settings.transferCBU}
                      label="Copiar"
                      copiedLabel="Copiado"
                    />
                  )}
                </div>

                {settings.transferHolder && (
                  <p style={{ margin: "6px 0", fontSize: 14, color: "#78350f" }}>
                    Titular: <b style={{ color: "#451a03" }}>{settings.transferHolder}</b>
                  </p>
                )}

                <p style={{ margin: "10px 0 16px", fontSize: 14, color: "#92400e" }}>
                  Enviá el comprobante al WhatsApp del local para que confirmen tu turno en el sistema.
                </p>

                {whatsAppProofUrl && (
                  <a
                    href={whatsAppProofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn primary"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      gap: 8,
                      padding: "14px 20px",
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    <MessageCircle size={18} />
                    <span>Enviar comprobante por WhatsApp</span>
                  </a>
                )}
              </div>
            )}

            {/* Acciones de calendario */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "20px 0" }}>
              <a href={gcalHref} target="_blank" rel="noreferrer" className="btn">
                <Calendar size={15} /> Google Calendar
              </a>
              <button type="button" onClick={handleDownloadIcs} className="btn">
                <Download size={15} /> Descargar .ics
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
              <button type="button" className="btn primary" onClick={reset}>
                Reservar otro turno
              </button>
              <button type="button" className="text-link" onClick={() => setShowLookupModal(true)}>
                Ver todos mis turnos
              </button>
            </div>
          </div>
        ) : (
          /* Formulario en 3 pasos */
          <>
            {/* Pasos */}
            <div className="steps">
              {[0, 1, 2].map((i) => (
                <span className={i <= step ? "on" : ""} key={i} />
              ))}
            </div>

            <span className="small muted">PASO {step + 1} DE 3</span>
            <h2>{["Un momento para vos", "Elegí cuándo venir", "Ya casi está"][step]}</h2>
            <p>
              {[
                "¿Qué te gustaría reservar?",
                "Encontrá el horario que va con tu día.",
                "Dejanos tus datos para guardar tu turno.",
              ][step]}
            </p>

            {error && <div className="error-box" role="alert">{error}</div>}

            {/* PASO 1: Servicios */}
            {step === 0 && (
              <>
                {biz.services.length > 4 && (
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="text"
                      placeholder="Buscar servicio..."
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #d8e5dd",
                        fontSize: 13,
                      }}
                    />
                  </div>
                )}

                <div style={{ display: "grid", gap: 8 }}>
                  {filteredServices.map((v) => {
                    const isSelected = serviceId === v.id;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        className={"choice " + (isSelected ? "selected" : "")}
                        onClick={() => {
                          setServiceId(v.id);
                          setTime(null);
                          setError(null);
                        }}
                      >
                        <div>
                          <b>{v.name}</b>
                          <small>
                            {v.duration} min · {fmtMoney(v.price)}
                          </small>
                        </div>
                        {isSelected ? (
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              minWidth: 22,
                              minHeight: 22,
                              flexShrink: 0,
                              borderRadius: "50%",
                              background: "var(--business-accent, #16845f)",
                              color: "white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </span>
                        ) : (
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              minWidth: 22,
                              minHeight: 22,
                              flexShrink: 0,
                              border: "2px solid #cbd5e1",
                              borderRadius: "50%",
                              background: "white",
                              display: "inline-block",
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {filteredServices.length === 0 && (
                  <p className="notice">No se encontraron servicios con ese nombre.</p>
                )}

                <div className="booking-controls">
                  <button
                    type="button"
                    disabled={!serviceId}
                    className="btn primary"
                    onClick={() => setStep(1)}
                  >
                    Elegir horario <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {/* PASO 2: Horarios, Profesional y Productos opcionales */}
            {step === 1 && (
              <>
                <div className="form-grid">
                  {hasPros && (
                    <label>
                      Profesional
                      <CustomSelect
                        value={proId || ""}
                        onChange={(val) => {
                          setProId(val || null);
                          setTime(null);
                          setError(null);
                        }}
                        options={[
                          {
                            value: "",
                            label: "Cualquier profesional disponible",
                            sublabel: "Sin preferencia · Más rápido",
                          },
                          ...biz.professionals.map((p) => ({
                            value: p.id,
                            label: p.name,
                            sublabel: p.role,
                          })),
                        ]}
                        placeholder="Elegir profesional"
                        buttonClassName="booking-select-trigger"
                      />
                    </label>
                  )}

                  <label>
                    Día
                    <input
                      type="date"
                      min={todayKey}
                      max={maxDateKey}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setTime(null);
                        setError(null);
                      }}
                    />
                  </label>
                </div>

                {/* Atajos rápidos de días */}
                <div className="booking-day-shortcuts">
                  {[
                    { label: "Hoy", date: todayKey },
                    { label: "Mañana", date: dateKey(addDays(now, 1)) },
                    { label: "Pasado mañana", date: dateKey(addDays(now, 2)) },
                  ].map((d) => {
                    const active = selectedDate === d.date;
                    const open = isDayOpen(d.date);
                    return (
                      <button
                        key={d.label}
                        type="button"
                        disabled={!open}
                        onClick={() => {
                          setSelectedDate(d.date);
                          setTime(null);
                          setError(null);
                        }}
                        className={"btn small " + (active ? "primary" : "")}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, opacity: !open ? 0.4 : 1 }}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>

                {/* Disponibilidad en vivo */}
                <div className="live-availability">
                  <i />
                  <span>Disponibilidad en vivo · se actualiza automáticamente</span>
                </div>

                {/* Grilla de turnos */}
                <div className="slots">
                  {rawSlots.map((t) => {
                    const disabled = isSlotDisabled(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={disabled}
                        className={"slot " + (t === time ? "selected" : "")}
                        onClick={() => {
                          setTime(t);
                          setError(null);
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>

                {rawSlots.length === 0 && (
                  <p className="notice">
                    El local no atiende en este día o no quedan horarios con la duración necesaria ({dur} min). Elegí otra fecha.
                  </p>
                )}

                {/* Productos opcionales de tienda */}
                {biz.products && biz.products.length > 0 && (
                  <section className="booking-products-panel" aria-label="Productos opcionales">
                    <button
                      type="button"
                      className="booking-products-toggle"
                      aria-expanded={productsOpen}
                      aria-controls="booking-products-list"
                      onClick={() => setProductsOpen((open) => !open)}
                    >
                      <span className="booking-products-toggle-copy">
                        <span className="booking-products-toggle-icon"><Package size={18} /></span>
                        <span>
                          <strong>¿Te llevás algo más?</strong>
                          <small>Opcional · lo retirás cuando vengas</small>
                        </span>
                      </span>
                      <span className="booking-products-toggle-action">
                        {productsCount > 0 ? `${productsCount} · ${fmtMoney(productsTotal)}` : productsOpen ? "Ocultar" : "Agregar"}
                        <ChevronDown size={17} className={productsOpen ? "rotate-180" : ""} />
                      </span>
                    </button>

                    {productsOpen && (
                      <div id="booking-products-list" className="booking-products">
                        {biz.products.map((p) => {
                          const count = cart[p.id] || 0;
                          return (
                            <article key={p.id} className="booking-product">
                              <span className="product-thumb">
                                <Package size={20} />
                              </span>
                              <div className="booking-product-copy">
                                <h3>{p.name}</h3>
                                <p>{fmtMoney(p.price)}</p>
                              </div>
                              <div className="quantity-control">
                                <button
                                  type="button"
                                  aria-label={"Quitar " + p.name}
                                  disabled={count === 0}
                                  onClick={() => setCart({ ...cart, [p.id]: Math.max(0, count - 1) })}
                                >
                                  <Minus size={12} />
                                </button>
                                <span aria-live="polite">{count}</span>
                                <button
                                  type="button"
                                  aria-label={"Agregar " + p.name}
                                  disabled={count >= 5}
                                  onClick={() => setCart({ ...cart, [p.id]: count + 1 })}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {productsCount > 0 && !productsOpen && (
                      <p className="booking-products-summary">{productsCount} producto{productsCount === 1 ? "" : "s"} agregado{productsCount === 1 ? "" : "s"} · {fmtMoney(productsTotal)}</p>
                    )}
                  </section>
                )}

                <div className="booking-controls">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStep(0)}
                    aria-label="Volver a servicios"
                  >
                    <ArrowLeft size={15} /> Volver
                  </button>
                  <button
                    type="button"
                    disabled={!time || !selectedDate}
                    className="btn primary"
                    onClick={() => setStep(2)}
                  >
                    Continuar <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

            {/* PASO 3: Datos de Contacto y Confirmación */}
            {step === 2 && (
              <form className="form-grid" onSubmit={handleReserve}>
                {/* Resumen del turno */}
                <div className="choice selected">
                  <div>
                    <b>{service?.name}</b>
                    <small>
                      {shownDate} · {time} hs
                      <br />
                      con {pro ? pro.name : "el primer profesional libre"}
                    </small>
                  </div>
                  <b>{fmtMoney(service?.price || 0)}</b>
                </div>

                {productsTotal > 0 && (
                  <div style={{ background: "#f8fbf9", padding: "10px 14px", borderRadius: 10, border: "1px solid #dcebe2" }}>
                    <div className="booking-summary-line">
                      <span>Productos adicionales</span>
                      <b>{fmtMoney(productsTotal)}</b>
                    </div>
                    <div className="booking-summary-line" style={{ borderTop: "1px dashed #dcebe2", paddingTop: 8, marginTop: 6 }}>
                      <span>Total estimado</span>
                      <b>{fmtMoney((service?.price || 0) + productsTotal)}</b>
                    </div>
                  </div>
                )}

                {/* Aviso de seña */}
                {depositOn && depositAmount > 0 && (
                  <div className="notice">
                    <b>Seña requerida por transferencia: {fmtMoney(depositAmount)}</b>
                    <p style={{ marginTop: 6, fontSize: 13 }}>
                      Al confirmar verás el Alias / CBU. El turno queda pendiente hasta que el local verifique tu transferencia.
                    </p>
                  </div>
                )}

                <label>
                  Nombre y apellido *
                  <input
                    required
                    maxLength={100}
                    value={client}
                    autoComplete="name"
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Ej. Valentina Gómez"
                  />
                </label>

                <label>
                  Teléfono celular (WhatsApp) *
                  <input
                    required
                    type="tel"
                    minLength={7}
                    maxLength={40}
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej. 11 1234 5678"
                  />
                  {phone.trim() && !phoneVal.isValid && (
                    <span className="small" style={{ color: "#c45465" }}>
                      Ingresá un celular válido con código de área (ej. 11 1234 5678)
                    </span>
                  )}
                </label>

                <label>
                  Email (opcional)
                  <input
                    type="email"
                    maxLength={150}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vos@ejemplo.com (para recibir confirmación y calendario)"
                  />
                </label>

                <label>
                  Aclaraciones o notas (opcional)
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej. ¿Tenés alguna preferencia o indicación para el turno?"
                  />
                </label>

                <p className="small muted">
                  Para modificar o cancelar, podés hacerlo desde "Mis turnos" o avisando a {user.business}.
                </p>

                <div className="booking-controls">
                  <button
                    type="button"
                    disabled={busy}
                    className="btn"
                    onClick={() => setStep(1)}
                    aria-label="Volver a horarios"
                  >
                    <ArrowLeft size={15} /> Volver
                  </button>
                  <button disabled={busy} className="btn primary">
                    {busy
                      ? "Reservando..."
                      : depositOn && depositAmount > 0
                      ? "Reservar y ver datos de seña"
                      : "Confirmar mi turno"}
                    <Check size={15} />
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );

  // Si está incrustado en el preview del Dashboard, no necesita la barra de navegación exterior completa
  if (isPreview) {
    return (
      <div className="preview-container w-full" style={{ '--business-accent': accentColor } as React.CSSProperties}>
        {bookingCardContent}
      </div>
    );
  }

  // Vista de página completa
  return (
    <main
      className="booking-page business-custom"
      style={{ '--business-accent': accentColor } as React.CSSProperties}
    >
      {/* Barra de navegación superior */}
      <nav className="booking-nav">
        <a href="#/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <picture className="booking-brand-mark">
            <source srcSet="/cupito-logo.webp" type="image/webp" />
            <img src="/cupito-logo.png" width="34" height="34" alt="Logo de Cupito" decoding="async" />
          </picture>
          <span style={{ fontSize: 20, fontWeight: 750, letterSpacing: "-0.5px", color: "#1f4732" }}>
            cupito<span style={{ color: accentColor }}>.</span>
          </span>
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setShowLookupModal(true)}
            className="btn small"
            style={{ fontSize: 13, padding: "8px 14px" }}
          >
            <Search size={14} /> Mis turnos
          </button>

          {sessionUserId === user.id ? (
            <a href="#/app" className="text-link" style={{ fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft size={14} /> Volver a mi panel
            </a>
          ) : sessionUserId ? (
            <a href="#/app" className="text-link" style={{ fontSize: 13, fontWeight: 600 }}>
              Mi panel →
            </a>
          ) : null}
        </div>
      </nav>

      {/* Contenedor central de 2 columnas */}
      {bookingCardContent}

      {/* Modal Mis Turnos */}
      {showLookupModal && (
        <div className="booking-modal-overlay" onClick={() => setShowLookupModal(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h3>Consultar mis turnos</h3>
              <button
                type="button"
                onClick={() => setShowLookupModal(false)}
                className="btn"
                style={{ padding: 6, border: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <p className="small muted" style={{ marginBottom: 16 }}>
              Ingresá el número de celular con el que reservaste en <b>{user.business}</b> para ver o cancelar tus turnos.
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <input
                type="tel"
                placeholder="Ej. 11 1234 5678"
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #dcebe2",
                  fontSize: 14,
                }}
              />
            </div>

            {lookupFeedback && <div className="notice" style={{ margin: "10px 0" }}>{lookupFeedback}</div>}

            {lookupPhone.trim() && clientBookings.length === 0 && (
              <p className="notice" style={{ margin: "14px 0" }}>
                No encontramos ningún turno registrado con ese número de teléfono.
              </p>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {clientBookings.map((b) => {
                const s = biz.services.find((x) => x.id === b.serviceId);
                const isCancelled = b.status === "cancelada";
                return (
                  <div
                    key={b.id}
                    style={{
                      border: "1px solid #dce8df",
                      borderRadius: 12,
                      padding: "14px 16px",
                      background: isCancelled ? "#fafafa" : "#ffffff",
                      opacity: isCancelled ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <b>{s?.name || "Servicio"}</b>
                        <p className="small muted" style={{ marginTop: 4 }}>
                          {fmtLong(b.date)} a las {b.time} hs
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: isCancelled ? "#fee2e2" : "#dcfce7",
                          color: isCancelled ? "#991b1b" : "#166534",
                        }}
                      >
                        {b.status || "confirmada"}
                      </span>
                    </div>

                    {!isCancelled && (
                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn small"
                          style={{ color: "#dc2626", borderColor: "#fecaca" }}
                          onClick={async () => {
                            if (!window.confirm("¿Seguro que querés cancelar este turno?")) return;
                            const r = await cancelBookingByClient(user.id, b.id, "Cancelado por el cliente", lookupPhone);
                            if (r.ok) {
                              setLookupFeedback("Turno cancelado correctamente.");
                            } else {
                              setLookupFeedback(r.error || "No se pudo cancelar el turno.");
                            }
                          }}
                        >
                          Cancelar este turno
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reseñas */}
      {showReviewsModal && (
        <div className="booking-modal-overlay" onClick={() => setShowReviewsModal(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h3>Reseñas de {user.business}</h3>
              <button
                type="button"
                onClick={() => setShowReviewsModal(false)}
                className="btn"
                style={{ padding: 6, border: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de reseñas */}
            <div style={{ display: "grid", gap: 12, maxHeight: 260, overflowY: "auto", marginBottom: 20 }}>
              {biz.reviews.length === 0 ? (
                <p className="small muted">Todavía no hay reseñas. ¡Sé el primero en dejar una!</p>
              ) : (
                biz.reviews.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid #e2ece5",
                      borderRadius: 10,
                      padding: "12px 14px",
                      background: "#fdfefe",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#1f4732" }}>{r.client}</span>
                      <span style={{ color: "#eab308", fontSize: 13 }}>
                        {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "#547563", marginTop: 6, lineHeight: 1.5 }}>{r.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Formulario para dejar reseña */}
            <form onSubmit={submitReview} style={{ borderTop: "1px solid #e2ece5", paddingTop: 16 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: "#1f4732", marginBottom: 12 }}>
                Dejar una opinión
              </h4>

              {reviewSuccess ? (
                <div className="notice" style={{ background: "#ecfdf5", color: "#065f46" }}>
                  ¡Gracias por tu opinión! Se guardó correctamente.
                </div>
              ) : (
                <div className="form-grid">
                  <label>
                    Tu nombre
                    <input
                      required
                      placeholder="Ej. Sofía"
                      value={newReviewAuthor}
                      onChange={(e) => setNewReviewAuthor(e.target.value)}
                    />
                  </label>

                  <label>
                    Puntuación
                    <CustomSelect
                      value={String(newReviewRating)}
                      onChange={(val) => setNewReviewRating(Number(val))}
                      options={[
                        { value: "5", label: "⭐⭐⭐⭐⭐ Excelente (5 estrellas)" },
                        { value: "4", label: "⭐⭐⭐⭐ Muy bueno (4 estrellas)" },
                        { value: "3", label: "⭐⭐⭐ Bueno (3 estrellas)" },
                        { value: "2", label: "⭐⭐ Regular (2 estrellas)" },
                        { value: "1", label: "⭐ Malo (1 estrella)" },
                      ]}
                      placeholder="Calificación"
                    />
                  </label>

                  <label>
                    Comentario
                    <textarea
                      required
                      rows={2}
                      placeholder="Contá qué te pareció la atención..."
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                    />
                  </label>

                  <button type="submit" className="btn primary" style={{ width: "100%", marginTop: 8 }}>
                    Enviar reseña
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
