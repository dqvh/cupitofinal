/**
 * Normalizador y validador especializado en números de celular de Argentina.
 * En Argentina los celulares tienen 10 dígitos (código de área sin 0 + número sin 15).
 * Para WhatsApp internacional, el formato oficial es: +54 9 [código de área] [número] (12 dígitos).
 */

export interface PhoneValidation {
  isValid: boolean;
  cleanDigits: string; // Dígitos limpios sin código de país
  formatted: string;   // Visual: (11) 4567-8901 o (351) 456-7890
  waNumber: string;    // Formato internacional para wa.me: 5491145678901
  waLink: string;      // https://wa.me/5491145678901
  hint: string;
  badgeType: "valid" | "warning" | "empty";
}

export function cleanPhoneDigits(input: string): string {
  let digits = input.replace(/\D/g, "");

  // 1. Quitar prefijo internacional si lo pegaron (+54 9 o +54)
  if (digits.startsWith("549")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("54")) {
    digits = digits.slice(2);
  }

  // 2. Quitar el 0 inicial (ej: 011 -> 11, 0351 -> 351)
  while (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // 3. Si pusieron 15 directo (ej: 15 4567 8901 - 10 dígitos arrancando en 15),
  // se trata de un número de AMBA/CABA donde omitieron el 11:
  if (digits.startsWith("15") && digits.length === 10) {
    digits = "11" + digits.slice(2);
  }

  // 4. Quitar el '15' móvil después del código de área (ej: 11 15 4567 8901)
  if (digits.startsWith("1115")) {
    digits = "11" + digits.slice(4);
  }

  // Códigos de área más comunes de 3 dígitos con 15 (ej: 351 15 456 7890)
  const area3List = ["351", "341", "223", "261", "381", "299", "387", "342", "379", "370", "383", "385", "388", "264", "266", "291", "280", "294", "296"];
  for (const a3 of area3List) {
    if (digits.startsWith(a3 + "15")) {
      digits = a3 + digits.slice(5);
      break;
    }
  }

  // Limpieza general de 15 si se ingresaron 11 o 12 dígitos
  if (digits.length >= 11) {
    if (digits.slice(2, 4) === "15") {
      digits = digits.slice(0, 2) + digits.slice(4);
    } else if (digits.slice(3, 5) === "15") {
      digits = digits.slice(0, 3) + digits.slice(5);
    } else if (digits.slice(4, 6) === "15") {
      digits = digits.slice(0, 4) + digits.slice(6);
    }
  }

  // Los celulares en Argentina tienen exactamente 10 dígitos
  if (digits.length > 10) {
    digits = digits.slice(0, 10);
  }

  return digits;
}

export function formatArgentinaPhone(digits: string): string {
  if (digits.length === 0) return "";

  // Área 2 dígitos (AMBA / CABA: 11)
  if (digits.startsWith("11")) {
    const area = digits.slice(0, 2);
    const first = digits.slice(2, 6);
    const second = digits.slice(6, 10);
    if (digits.length <= 2) return `(${area})`;
    if (digits.length <= 6) return `(${area}) ${first}`;
    return `(${area}) ${first}-${second}`;
  }

  // Áreas comunes de 3 dígitos (351 Córdoba, 341 Rosario, 223 Mar del Plata, 261 Mendoza, 381 Tucumán, etc.)
  const area3List = ["351", "341", "223", "261", "381", "299", "387", "342", "379", "370", "383", "385", "388", "264", "266", "291", "280", "294", "296"];
  const isArea3 = area3List.some((a) => digits.startsWith(a)) || (digits.length >= 3 && !digits.startsWith("11") && digits.length <= 10);

  if (isArea3 && digits.length <= 10) {
    const area = digits.slice(0, 3);
    const first = digits.slice(3, 6);
    const second = digits.slice(6, 10);
    if (digits.length <= 3) return `(${area})`;
    if (digits.length <= 6) return `(${area}) ${first}`;
    return `(${area}) ${first}-${second}`;
  }

  return digits;
}

export function normalizeArgentinaPhone(input: string): PhoneValidation {
  const digits = cleanPhoneDigits(input);

  if (!digits) {
    return {
      isValid: false,
      cleanDigits: "",
      formatted: "",
      waNumber: "",
      waLink: "",
      hint: "Ingresá tu código de área (ej. 11) y celular (sin 0 ni 15).",
      badgeType: "empty",
    };
  }

  // Alerta si empezó escribiendo 15 directamente
  if (digits.startsWith("15") && digits.length < 10) {
    return {
      isValid: false,
      cleanDigits: digits,
      formatted: digits,
      waNumber: `549${digits}`,
      waLink: `https://wa.me/549${digits}`,
      hint: "Ojo: ingresá primero el código de área (ej: 11 para Bs As, 351 para Cba) sin el 15.",
      badgeType: "warning",
    };
  }

  // Un celular en Argentina debe tener exactamente 10 dígitos (ej: 11 1234 5678)
  if (digits.length === 10) {
    const formatted = formatArgentinaPhone(digits);
    const waNumber = `549${digits}`;
    return {
      isValid: true,
      cleanDigits: digits,
      formatted,
      waNumber,
      waLink: `https://wa.me/${waNumber}`,
      hint: "Celular argentino listo ✓ (sin 0 ni 15)",
      badgeType: "valid",
    };
  }

  if (digits.length < 10) {
    const remaining = 10 - digits.length;
    return {
      isValid: false,
      cleanDigits: digits,
      formatted: formatArgentinaPhone(digits),
      waNumber: `549${digits}`,
      waLink: `https://wa.me/549${digits}`,
      hint: `Faltan ${remaining} dígito${remaining === 1 ? "" : "s"} · ej: 11 4567-8901 (sin 0 ni 15)`,
      badgeType: "warning",
    };
  }

  const trimmed = digits.slice(0, 10);
  const formatted = formatArgentinaPhone(trimmed);
  const waNumber = `549${trimmed}`;
  return {
    isValid: true,
    cleanDigits: trimmed,
    formatted,
    waNumber,
    waLink: `https://wa.me/${waNumber}`,
    hint: "Celular argentino listo ✓ (sin 0 ni 15)",
    badgeType: "valid",
  };
}

/**
 * Genera un enlace a WhatsApp seguro con texto codificado
 */
export function createWhatsAppUrl(phone: string, message: string): string {
  const norm = normalizeArgentinaPhone(phone);
  const number = norm.isValid ? norm.waNumber : `549${phone.replace(/\D/g, "")}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
