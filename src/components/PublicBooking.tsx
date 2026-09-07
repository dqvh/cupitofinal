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
  totalDurationOf, getDayHours,
  type User, type BizData, type Service,
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

const MY_BOOKINGS_STORAGE_KEY = "cupito_my_bookings";
function getMyLocalBookings(ownerId: string): Array<{ id: string; serviceId: string; date: string; time: string; client: string; phone: string; notes?: string; status?: string; proId?: string }> {
  try {
    const raw = localStorage.getItem(MY_BOOKINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return Array.isArray(parsed[ownerId]) ? parsed[ownerId] : [];
  } catch {
    return [];
  }
}
function saveMyLocalBooking(ownerId: string, booking: { id: string; serviceId: string; date: string; time: string; client: string; phone: string; notes?: string; status?: string; proId?: string }) {
  try {
    const raw = localStorage.getItem(MY_BOOKINGS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const list = Array.isArray(parsed[ownerId]) ? parsed[ownerId] : [];
    parsed[ownerId] = [booking, ...list.filter((x: any) => x.id !== booking.id)].slice(0, 30);
    localStorage.setItem(MY_BOOKINGS_STORAGE_KEY, JSON.stringify(parsed));
  } catch { /* noop */ }
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
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([]);
  const [conflictSuggestions, setConflictSuggestions] = useState<string[]>([]);
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
  const [remoteLookupBookings, setRemoteLookupBookings] = useState<any[] | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [showReviewsModal, setShowReviewsModal] = useState(initialReviewOpen);
  const [newReviewAuthor, setNewReviewAuthor] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Filtro de servicios
  const [serviceSearch, setServiceSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  // Acordeón de información del local en mobile
  const [infoOpen, setInfoOpen] = useState(false);

  // Lista de espera pública
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistClient, setWaitlistClient] = useState("");
  const [waitlistPhone, setWaitlistPhone] = useState("");
  const [waitlistSent, setWaitlistSent] = useState(false);

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
    if (settings.brandColor) return settings.brandColor;
    switch (settings.theme) {
      case "coral": return "#ff7a59";
      case "midnight": return "#38bdf8";
      case "rose": return "#f472b6";
      case "obsidian": return "#fbbf24";
      case "ocean": return "#34d399";
      default: return "#16845f";
    }
  }, [settings.theme, settings.brandColor]);

  const service = biz.services.find((s) => s.id === serviceId);
  const pro = biz.professionals.find((p) => p.id === proId);
  const hasPros = biz.professionals.length > 0;
  const maxAdvanceDays = settings.maxAdvanceDays ?? 30;

  const now = new Date();
  const todayKey = dateKey(now);
  const maxDateKey = maxAdvanceDays > 0 ? dateKey(addDays(now, maxAdvanceDays)) : "9999-99-99";
  const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Selección de múltiples servicios combinados
  const selectedServiceIds = useMemo(() => {
    if (!serviceId) return [];
    return [serviceId, ...extraServiceIds];
  }, [serviceId, extraServiceIds]);

  const selectedServices = useMemo(() => {
    return selectedServiceIds
      .map((id) => biz.services.find((s) => s.id === id))
      .filter(Boolean) as Service[];
  }, [selectedServiceIds, biz.services]);

  const totalServicesPrice = useMemo(() => {
    return selectedServices.reduce((acc, s) => acc + s.price, 0);
  }, [selectedServices]);

  const dur = useMemo(() => {
    if (selectedServiceIds.length === 0) return service?.duration ?? 45;
    return totalDurationOf(biz.services, selectedServiceIds, pro) || 45;
  }, [biz.services, selectedServiceIds, pro, service?.duration]);

  const toggleService = (id: string) => {
    setError(null);
    setTime(null);
    setConflictSuggestions([]);
    if (!serviceId) {
      setServiceId(id);
      return;
    }
    if (serviceId === id) {
      if (extraServiceIds.length > 0) {
        setServiceId(extraServiceIds[0]);
        setExtraServiceIds(extraServiceIds.slice(1));
      } else {
        setServiceId(null);
      }
      return;
    }
    if (extraServiceIds.includes(id)) {
      setExtraServiceIds(extraServiceIds.filter((x) => x !== id));
    } else {
      setExtraServiceIds([...extraServiceIds, id]);
    }
  };

  // Filtro de servicios
  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (!q) return biz.services;
    return biz.services.filter((s) => s.name.toLowerCase().includes(q));
  }, [biz.services, serviceSearch]);

  // Chequeo de día abierto (respetando horarios especiales)
  const isDayOpen = (key: string) => {
    const dIdx = dayOfWeek(key);
    if ((settings.closedDates || []).includes(key)) return false;
    const dayH = getDayHours(settings, key);
    if (!dayH || !dayH.open) return false;
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
    return true;
  };

  // Turnos brutos para el día seleccionado
  const rawSlots = useMemo(() => {
    if (!selectedDate) return [];
    const dIdx = dayOfWeek(selectedDate);
    const dayH = getDayHours(settings, selectedDate);
    if (!dayH || !dayH.open) return [];
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
    return slotsForDay(dayH);
  }, [selectedDate, pro, hasPros, biz.professionals, settings]);

  // Verificar si un slot específico está tomado o pasado
  const isSlotDisabled = (t: string) => {
    if (!isDemo && user.id !== "test-owner" && selectedDate === todayKey && t <= currentHHMM) return true;
    const dayH = getDayHours(settings, selectedDate);
    if (!dayH || !dayH.open) return true;
    if (pro) {
      return !isProAvailable(pro, selectedDate, t, dur, settings.hours, biz.blockedSlots || [], biz.bookings, biz.services);
    }
    if (hasPros) {
      return getAvailablePros(biz.professionals, selectedDate, t, dur, settings.hours, biz.blockedSlots || [], biz.bookings, biz.services).length === 0;
    }
    if (!fitsWorkingDay(dayH, t, dur)) return true;
    if (isSlotBlocked(biz.blockedSlots || [], selectedDate, t)) return true;
    return !!findOverlap({ date: selectedDate, time: t, dur }, biz.bookings, biz.services);
  };

  // Sugerencias de horarios más cercanos en caso de conflicto
  const findClosestSlots = (date: string, targetTime: string, count = 3) => {
    const dayH = getDayHours(settings, date);
    if (!dayH || !dayH.open) return [];
    const targetMin = toMinutes(targetTime);
    const available = rawSlots.filter((s) => !isSlotDisabled(s) && s !== targetTime);
    available.sort((a, b) => Math.abs(toMinutes(a) - targetMin) - Math.abs(toMinutes(b) - targetMin));
    return available.slice(0, count);
  };

  // Franjas horarias agrupadas por Mañana y Tarde
  const morningSlots = useMemo(() => {
    return rawSlots.filter((t) => {
      const [h] = t.split(":").map(Number);
      return h < 13;
    });
  }, [rawSlots]);

  const afternoonSlots = useMemo(() => {
    return rawSlots.filter((t) => {
      const [h] = t.split(":").map(Number);
      return h >= 13;
    });
  }, [rawSlots]);

  // Encontrar próximo día disponible automáticamente
  const findNextAvailableDate = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const base = new Date(y, m - 1, d);
    for (let i = 1; i <= 14; i++) {
      const nextDate = addDays(base, i);
      const k = dateKey(nextDate);
      if (k > maxDateKey) break;
      if ((settings.closedDates || []).includes(k)) continue;
      const dIdx = dayOfWeek(k);
      const daySlots = (() => {
        if (pro) {
          const proH = getProHours(pro, settings.hours)[dIdx];
          return proH?.open ? slotsForDay(proH) : [];
        }
        if (hasPros) {
          const set = new Set<string>();
          biz.professionals.forEach((p) => {
            const proH = getProHours(p, settings.hours)[dIdx];
            if (proH?.open) slotsForDay(proH).forEach((s) => set.add(s));
          });
          return Array.from(set).sort((a, b) => toMinutes(a) - toMinutes(b));
        }
        const h = settings.hours[dIdx];
        return h?.open ? slotsForDay(h) : [];
      })();
      const free = daySlots.some((t) => {
        if (pro) return isProAvailable(pro, k, t, dur, settings.hours, biz.blockedSlots || [], biz.bookings, biz.services);
        if (hasPros) return getAvailablePros(biz.professionals, k, t, dur, settings.hours, biz.blockedSlots || [], biz.bookings, biz.services).length > 0;
        if (!fitsWorkingDay(settings.hours[dIdx], t, dur)) return false;
        if (isSlotBlocked(biz.blockedSlots || [], k, t)) return false;
        return !findOverlap({ date: k, time: t, dur }, biz.bookings, biz.services);
      });
      if (free) {
        setSelectedDate(k);
        setTime(null);
        setError(null);
        return;
      }
    }
  };

  // Anotarse en lista de espera
  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistClient.trim() || !waitlistPhone.trim()) return;
    const err = await store.addWaitlist(
      {
        date: selectedDate,
        serviceId: serviceId || biz.services[0]?.id || "service",
        client: waitlistClient.trim(),
        phone: waitlistPhone.trim(),
      },
      user.id
    );
    if (!err) {
      setWaitlistSent(true);
      setTimeout(() => {
        setShowWaitlistModal(false);
        setWaitlistSent(false);
      }, 2000);
    }
  };

  // Seña configurada
  const depositOn = paid && settings.depositEnabled && settings.depositPct > 0;
  const depositAmount = depositOn ? Math.round((totalServicesPrice * settings.depositPct) / 100) : 0;

  // Carrito de productos
  const productsTotal = useMemo(() => {
    return (biz.products || []).reduce((acc, p) => acc + (cart[p.id] || 0) * p.price, 0);
  }, [biz.products, cart]);

  const totalAmount = totalServicesPrice + productsTotal;
  const payAtVenue = Math.max(0, totalAmount - depositAmount);

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

  const myLocalBookings = useMemo(() => {
    return getMyLocalBookings(user.id);
  }, [user.id, done]);

  // Turnos del cliente en modal de consulta (seguro: solo propios, nunca de terceros)
  const clientBookings = useMemo(() => {
    if (remoteLookupBookings !== null) return remoteLookupBookings;
    if (!lookupPhone.trim()) return myLocalBookings;
    const digits = cleanPhoneDigits(lookupPhone);
    if (digits.length < 8) return [];
    const last8 = digits.slice(-8);
    return myLocalBookings.filter((b) => cleanPhoneDigits(b.phone).slice(-8) === last8);
  }, [remoteLookupBookings, lookupPhone, myLocalBookings]);

  const handleLookupSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digits = cleanPhoneDigits(lookupPhone);
    if (digits.length < 8) {
      setLookupFeedback("Ingresá al menos 8 dígitos de tu número de celular.");
      return;
    }
    setIsLookingUp(true);
    setLookupFeedback(null);
    try {
      const res = await fetch("/api/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup", ownerId: user.id, phone: lookupPhone }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.ok && Array.isArray(d.bookings)) {
          setRemoteLookupBookings(d.bookings);
          if (d.bookings.length === 0) {
            setLookupFeedback("No encontramos ningún turno registrado con ese número.");
          }
          return;
        }
      }
    } catch { /* offline o fallback local */ }
    finally {
      setIsLookingUp(false);
    }
    const last8 = digits.slice(-8);
    const matched = myLocalBookings.filter((b) => cleanPhoneDigits(b.phone).slice(-8) === last8);
    setRemoteLookupBookings(matched);
    if (matched.length === 0) {
      setLookupFeedback("No encontramos ningún turno registrado con ese número.");
    }
  };

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
      const suggestions = findClosestSlots(selectedDate, time, 3);
      if (suggestions.length > 0) {
        setConflictSuggestions(suggestions);
        setError(`El horario de las ${time} hs ya no está disponible. Elegí uno de estos horarios sugeridos para confirmar sin perder tus datos:`);
      } else {
        setError("Ese horario ya no está disponible. Por favor elegí otro antes de confirmar.");
        setStep(1);
        setTime(null);
      }
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
      extraServiceIds: extraServiceIds.length > 0 ? extraServiceIds : undefined,
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
    if (res.id) {
      saveMyLocalBooking(user.id, {
        id: res.id,
        serviceId,
        date: selectedDate,
        time,
        client: client.trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
        proId: proId || undefined,
        status: depositOn && depositAmount > 0 ? "pendiente" : "confirmada",
      });
    }

    // Enviar email de confirmación si el cliente puso correo
    if (email.trim()) {
      const combinedTitle = selectedServices.map((s) => s.name).join(" + ") || service?.name || "Turno";
      const gcal = gcalUrl({
        title: `${combinedTitle} en ${user.business}`,
        date: selectedDate,
        time,
        duration: dur,
        desc: `Turno confirmado en ${user.business}. Dirección: ${settings.address || "A consultar con el local"}.`,
      });

      sendBookingConfirmationEmail({
        toEmail: email.trim(),
        clientName: client.trim(),
        businessName: user.business,
        serviceName: combinedTitle,
        dateStr: fmtLong(selectedDate),
        timeStr: time,
        proName: pro?.name,
        priceStr: fmtMoney(totalServicesPrice),
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
    setExtraServiceIds([]);
    setConflictSuggestions([]);
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
    const msg = `Hola ${user.business}! Acabo de reservar mi turno para ${service?.name || "un servicio"} el ${shownDate} a las ${time} hs. Te adjunto el comprobante de la seña.`;
    return createWhatsAppUrl(settings.whatsapp, msg);
  }, [settings.whatsapp, user.business, service?.name, shownDate, time]);

  const whatsAppGeneralUrl = useMemo(() => {
    if (!settings.whatsapp) return null;
    const msg = `Hola ${user.business}! Vengo de su página y quería hacer una consulta sobre los turnos.`;
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
      {/* Header Mobile Compacto Sticky (56px) */}
      <div className="sticky top-0 z-30 col-span-full flex h-14 w-full items-center justify-between border-b border-black/[0.08] bg-white/95 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={settings.logoUrl || "/cupito-logo.png"} width="28" height="28" alt="" className="h-7 w-7 rounded-lg shrink-0 object-cover" />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-display text-xs font-bold text-[#1D1D1F] leading-none">
              {user.business}
            </span>
            <span className="block text-[10px] text-[#6E6E73] font-medium mt-0.5">
              {openDaysCount} días por sem. · Hora Bs.As.
            </span>
          </div>
        </div>
        {settings.whatsapp && (
          <a
            href={whatsAppGeneralUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F7] text-[#16A34A] hover:bg-neutral-200/70"
            title="WhatsApp"
            aria-label="Contactar por WhatsApp"
          >
            <MessageCircle size={15} />
          </a>
        )}
      </div>

      {/* Información del local desplegable en mobile */}
      <div className="col-span-full border-b border-black/[0.08] bg-white md:hidden">
        <button
          type="button"
          onClick={() => setInfoOpen(!infoOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left font-semibold text-xs text-[#1D1D1F] hover:bg-[#F5F5F7] transition-colors"
          aria-expanded={infoOpen}
        >
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-[#16A34A]" />
            <span>Información del local</span>
          </span>
          <ChevronDown size={15} className={`text-[#6E6E73] transition-transform duration-200 ${infoOpen ? "rotate-180" : ""}`} />
        </button>
        {infoOpen && (
          <div className="px-4 pb-3.5 pt-1 space-y-2.5 text-xs text-[#334155] border-t border-black/[0.04] bg-[#F8FAFC]">
            {settings.description && <p className="leading-relaxed">{settings.description}</p>}
            <div className="flex items-start gap-2">
              <MapPin size={14} className="text-[#16A34A] shrink-0 mt-0.5" />
              <div>
                <span>{settings.address || "Consultá la dirección con el local"}</span>
                {settings.mapsUrl && (
                  <a href={settings.mapsUrl} target="_blank" rel="noreferrer" className="ml-1.5 font-bold text-[#16A34A] underline inline-flex items-center gap-0.5">
                    Ver mapa <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#16A34A] shrink-0" />
              <span>{openDaysCount} días de atención por semana · Hora Bs.As.</span>
            </div>
            {settings.whatsapp && (
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className="text-[#16A34A] shrink-0" />
                <a href={whatsAppGeneralUrl || "#"} target="_blank" rel="noreferrer" className="font-bold text-[#16A34A] underline">
                  Escribir al WhatsApp
                </a>
              </div>
            )}
            {avgRating !== null && (
              <button
                type="button"
                onClick={() => setShowReviewsModal(true)}
                className="flex items-center gap-1.5 text-[#1D1D1F] font-semibold pt-1"
              >
                <Star size={13} fill="currentColor" className="text-amber-500" />
                <span>{avgRating}</span>
                <span className="text-[#6E6E73] font-normal">({biz.reviews.length} reseña{biz.reviews.length === 1 ? "" : "s"})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Columna Izquierda: Tarjeta del Negocio */}
      <aside className="business-card hidden md:flex">
        <div className="large-logo">
          <picture>
            <source srcSet={settings.logoUrl || "/cupito-logo.webp"} type="image/webp" />
            <img src={settings.logoUrl || "/cupito-logo.png"} width="64" height="64" alt="Logo de Cupito" decoding="async" />
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

        <div className="business-info hidden md:flex">
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
              <p style={{ margin: 0, fontSize: 14, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                <Calendar size={15} className="text-[#16A34A] shrink-0" />
                <span>{shownDate} a las <b style={{ color: "#0f172a" }}>{time} hs</b> · con {pro ? pro.name : "nuestro equipo"}</span>
              </p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: depositOn && depositAmount > 0 ? "#b45309" : "#059669" }}>
                {depositOn && depositAmount > 0 ? "Seña pendiente de transferencia" : "Pago en el local"}
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

            {/* Cómo llegar */}
            {settings.address && (
              <div style={{ margin: "16px 0", padding: "14px 16px", background: "#f8fafc", borderRadius: 12, border: "1.5px solid #e2e8f0", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <MapPin size={16} className="text-[#16A34A]" />
                  <strong style={{ fontSize: 13, color: "#0f172a" }}>Cómo llegar</strong>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#475569" }}>{settings.address}</p>
                {settings.mapsUrl && (
                  <a
                    href={settings.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn small"
                    style={{ display: "inline-flex", fontSize: 12, padding: "6px 12px", gap: 5 }}
                  >
                    Abrir en Google Maps <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {/* Acciones de calendario */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "20px 0" }}>
              <a href={gcalHref} target="_blank" rel="noreferrer" className="btn">
                <Calendar size={15} /> Agregar a Google
              </a>
              <button type="button" onClick={handleDownloadIcs} className="btn">
                <Download size={15} /> Archivo .ics
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setTime(null);
                  setCart({});
                  setDone(false);
                  setStep(1);
                }}
              >
                Reservar lo mismo otra vez
              </button>
              <button type="button" className="btn" onClick={reset}>
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
            <h2>{["1. Elegí tu servicio", "2. Día y horario", "3. Tus datos"][step]}</h2>
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

                <div style={{ display: "grid", gap: 10 }}>
                  {filteredServices.map((v) => {
                    const isSelected = selectedServiceIds.includes(v.id);
                    return (
                      <button
                        type="button"
                        key={v.id}
                        className={"choice " + (isSelected ? "selected" : "")}
                        onClick={() => toggleService(v.id)}
                        aria-pressed={isSelected}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 14 }}>
                          <div style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
                            <b style={{ display: "block", fontSize: 15, color: "#0f172a" }}>{v.name}</b>
                            <small style={{ display: "block", color: "#64748b", marginTop: 2, fontSize: 13 }}>
                              {v.duration} min
                            </small>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                            <b style={{ fontSize: 15, color: "var(--business-accent, #16845f)" }}>
                              {fmtMoney(v.price)}
                            </b>
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
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedServiceIds.length > 1 && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, fontSize: 13, color: "#166534" }}>
                    <b>Servicios combinados ({selectedServiceIds.length}):</b> {selectedServices.map((s) => s.name).join(" + ")} · {dur} min · {fmtMoney(totalServicesPrice)}
                  </div>
                )}

                {filteredServices.length === 0 && (
                  <p className="notice">No se encontraron servicios con ese nombre.</p>
                )}

                <div className="booking-controls">
                  <button
                    type="button"
                    disabled={selectedServiceIds.length === 0}
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

                {/* Grilla de turnos agrupados por Mañana y Tarde */}
                {morningSlots.length > 0 && (
                  <div className="slot-group">
                    <h4 className="slot-group-title">Mañana</h4>
                    <div className="slots">
                      {morningSlots.map((t) => {
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
                  </div>
                )}

                {afternoonSlots.length > 0 && (
                  <div className="slot-group">
                    <h4 className="slot-group-title">Tarde</h4>
                    <div className="slots">
                      {afternoonSlots.map((t) => {
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
                  </div>
                )}

                {/* Si no hay turnos disponibles o todos están ocupados */}
                {(rawSlots.length === 0 || rawSlots.every((t) => isSlotDisabled(t))) && (
                  <div className="no-slots-notice" style={{ textAlign: "center", padding: "20px 14px", background: "#f8fafc", borderRadius: 14, border: "1px dashed #cbd5e1", margin: "16px 0" }}>
                    <p style={{ margin: "0 0 14px", fontSize: 14, color: "#475569" }}>
                      No quedan horarios disponibles para este día. Podés buscar el próximo día libre o anotarte en lista de espera.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                      <button
                        type="button"
                        onClick={findNextAvailableDate}
                        className="btn primary"
                        style={{ fontSize: 13 }}
                      >
                        <Calendar size={14} /> Próximo día disponible
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowWaitlistModal(true)}
                        className="btn"
                        style={{ fontSize: 13 }}
                      >
                        <Clock size={14} /> Anotarme en lista de espera
                      </button>
                    </div>
                  </div>
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
                                  <Minus size={14} />
                                </button>
                                <span aria-live="polite">{count}</span>
                                <button
                                  type="button"
                                  aria-label={"Agregar " + p.name}
                                  disabled={count >= 5}
                                  onClick={() => setCart({ ...cart, [p.id]: count + 1 })}
                                >
                                  <Plus size={14} />
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

                <div className="booking-controls" style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setStep(0)}
                    aria-label="Volver a servicios"
                  >
                    <ArrowLeft size={15} /> Volver
                  </button>
                </div>

                {/* Barra inferior sticky con horario, precio y Continuar */}
                <div className="booking-bottom-bar">
                  <div className="booking-bottom-bar-info">
                    <span className="booking-bottom-bar-time">
                      {time ? `${time} hs` : "Elegí tu horario"}
                    </span>
                    <span className="booking-bottom-bar-price">
                      {depositOn && depositAmount > 0
                        ? `Total ${fmtMoney(totalAmount)} · Reservás con ${fmtMoney(depositAmount)} · Pagás ${fmtMoney(payAtVenue)} en el local`
                        : `Total: ${fmtMoney(totalAmount)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!time || !selectedDate}
                    className="btn primary booking-bottom-bar-cta"
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
                <div className="choice selected" style={{ display: "block" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <b>{selectedServices.map((s) => s.name).join(" + ") || service?.name}</b>
                    <b style={{ color: "var(--business-accent, #16845f)" }}>{fmtMoney(totalServicesPrice)}</b>
                  </div>
                  <small style={{ display: "block", marginTop: 4 }}>
                    {shownDate} · {time} hs ({dur} min)
                    <br />
                    con {pro ? pro.name : "el primer profesional libre"}
                  </small>
                </div>

                {/* Sugerencias ante conflictos sin perder el formulario */}
                {conflictSuggestions.length > 0 && (
                  <div className="notice" style={{ background: "#fef3c7", border: "1.5px solid #fcd34d", color: "#92400e" }}>
                    <b>Horarios alternativos disponibles:</b>
                    <p style={{ margin: "4px 0 10px", fontSize: 13 }}>
                      Tocá uno para asignarlo a tu turno y confirmar:
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {conflictSuggestions.map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => {
                            setTime(sug);
                            setConflictSuggestions([]);
                            setError(null);
                          }}
                          className="btn small primary"
                          style={{ fontSize: 13, padding: "6px 14px", borderRadius: 8 }}
                        >
                          {sug} hs
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {productsTotal > 0 && (
                  <div style={{ background: "#f8fbf9", padding: "10px 14px", borderRadius: 10, border: "1px solid #dcebe2" }}>
                    <div className="booking-summary-line">
                      <span>Productos adicionales</span>
                      <b>{fmtMoney(productsTotal)}</b>
                    </div>
                    <div className="booking-summary-line" style={{ borderTop: "1px dashed #dcebe2", paddingTop: 8, marginTop: 6 }}>
                      <span>Total estimado</span>
                      <b>{fmtMoney(totalAmount)}</b>
                    </div>
                  </div>
                )}

                {/* Desglose transparente de seña */}
                {depositOn && depositAmount > 0 && (
                  <div className="notice" style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0" }}>
                    <b style={{ color: "#0f172a" }}>Desglose de pago y seña:</b>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#475569" }}>
                      Total {fmtMoney(totalAmount)} · Reservás con {fmtMoney(depositAmount)} ({settings.depositPct}%) · Pagás {fmtMoney(payAtVenue)} en el local
                    </p>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Al confirmar verás el Alias / CBU para transferir. El turno queda pendiente hasta verificar la seña.
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

                <div style={{ margin: "16px 0", padding: "14px 16px", background: "#f8fafc", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 13, color: "#334155" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#0f172a" }}>Condiciones del turno:</p>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                    <li>Cancelación gratuita hasta 24 horas antes.</li>
                    {depositOn && depositAmount > 0 && (
                      <li>Seña requerida de {fmtMoney(depositAmount)} ({settings.depositPct}%) para confirmar.</li>
                    )}
                    <li>Tolerancia de espera: 10 minutos de puntualidad.</li>
                  </ul>
                </div>

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

            <form onSubmit={handleLookupSubmit} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                type="tel"
                placeholder="Ej. 11 1234 5678"
                value={lookupPhone}
                onChange={(e) => {
                  setLookupPhone(e.target.value);
                  setRemoteLookupBookings(null);
                  setLookupFeedback(null);
                }}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: "1px solid #dcebe2",
                  fontSize: 14,
                }}
              />
              <button
                type="submit"
                disabled={isLookingUp}
                className="btn primary"
                style={{ borderRadius: 10, padding: "10px 18px", fontSize: 13 }}
              >
                {isLookingUp ? "Buscando..." : "Buscar"}
              </button>
            </form>

            {lookupFeedback && <div className="notice" style={{ margin: "10px 0" }}>{lookupFeedback}</div>}

            {lookupPhone.trim() && !isLookingUp && clientBookings.length === 0 && !lookupFeedback && (
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

                    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => {
                          setServiceId(b.serviceId);
                          setProId(b.proId || null);
                          setClient(b.client || "");
                          setPhone(b.phone || "");
                          setNotes(b.notes || "");
                          setCart({});
                          setDone(false);
                          setShowLookupModal(false);
                          setStep(1);
                        }}
                      >
                        Reservar lo mismo otra vez
                      </button>

                      {!isCancelled && (
                        <>
                          <button
                            type="button"
                            className="btn small"
                            onClick={() => {
                              setServiceId(b.serviceId);
                              setProId(b.proId || null);
                              setClient(b.client || "");
                              setPhone(b.phone || "");
                              setNotes(b.notes || "");
                              setCart({});
                              setDone(false);
                              setShowLookupModal(false);
                              setStep(1);
                            }}
                          >
                            Reprogramar horario
                          </button>
                          <button
                            type="button"
                            className="btn small"
                            style={{ color: "#dc2626", borderColor: "#fecaca" }}
                            onClick={async () => {
                              if (!window.confirm("¿Seguro que querés cancelar este turno?")) return;
                              const r = await cancelBookingByClient(user.id, b.id, "Cancelado por el cliente", lookupPhone || b.phone);
                              if (r.ok) {
                                setLookupFeedback("Turno cancelado correctamente.");
                                setRemoteLookupBookings((prev) => (prev ? prev.map((x) => x.id === b.id ? { ...x, status: "cancelada" } : x) : null));
                              } else {
                                setLookupFeedback(r.error || "No se pudo cancelar el turno.");
                              }
                            }}
                          >
                            Cancelar este turno
                          </button>
                        </>
                      )}
                    </div>
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
                        { value: "5", label: "5 / 5 - Excelente" },
                        { value: "4", label: "4 / 5 - Muy bueno" },
                        { value: "3", label: "3 / 5 - Bueno" },
                        { value: "2", label: "2 / 5 - Regular" },
                        { value: "1", label: "1 / 5 - Malo" },
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

      {/* Modal de Lista de Espera */}
      {showWaitlistModal && (
        <div className="booking-modal-overlay" onClick={() => setShowWaitlistModal(false)}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="booking-modal-header">
              <h3>Anotarme en lista de espera</h3>
              <button
                type="button"
                onClick={() => setShowWaitlistModal(false)}
                className="btn"
                style={{ padding: 6, border: 0 }}
              >
                <X size={18} />
              </button>
            </div>
            {waitlistSent ? (
              <div className="notice" style={{ background: "#ecfdf5", color: "#065f46", textAlign: "center", padding: "20px" }}>
                <CheckCircle2 size={32} className="text-emerald-600 mx-auto mb-2" />
                <p className="font-bold">¡Anotado con éxito!</p>
                <p className="text-sm mt-1">Si se libera un turno para el {shownDate}, te avisaremos por WhatsApp.</p>
              </div>
            ) : (
              <form onSubmit={handleJoinWaitlist} className="form-grid">
                <p className="text-sm text-slate-600">
                  Dejanos tus datos para el día <b>{shownDate}</b>. Te avisaremos de inmediato si se libera un turno.
                </p>
                <label>
                  Tu nombre y apellido *
                  <input
                    required
                    placeholder="Ej. Martín Gómez"
                    value={waitlistClient}
                    onChange={(e) => setWaitlistClient(e.target.value)}
                  />
                </label>
                <label>
                  Teléfono celular (WhatsApp) *
                  <input
                    required
                    type="tel"
                    placeholder="Ej. 11 1234 5678"
                    value={waitlistPhone}
                    onChange={(e) => setWaitlistPhone(e.target.value)}
                  />
                </label>
                <button type="submit" className="btn primary" style={{ width: "100%", marginTop: 10 }}>
                  Confirmar y avisarme
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
