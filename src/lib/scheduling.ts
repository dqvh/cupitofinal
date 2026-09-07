export interface WorkingDay { open: boolean; from: string; to: string; from2?: string; to2?: string }
const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function validateHours(hours: WorkingDay[]): string | null {
  if (hours.length !== 7) return "Configurá los siete días de la semana.";
  for (const day of hours) {
    if (!day.open) continue;
    if (!validTime(day.from) || !validTime(day.to) || day.from >= day.to) return "La hora de cierre debe ser posterior a la apertura.";
    if (day.from2 || day.to2) {
      if (!day.from2 || !day.to2 || !validTime(day.from2) || !validTime(day.to2) || day.from2 >= day.to2) return "Completá la apertura y el cierre del segundo tramo.";
      if (day.from2 <= day.to) return "La reapertura debe ser posterior al cierre del primer tramo.";
    }
  }
  return null;
}

export function fitsWorkingDay(day: WorkingDay | undefined, time: string, duration: number): boolean {
  if (!day?.open || !validTime(time) || !(duration > 0)) return false;
  const start = minutes(time);
  return [[day.from, day.to], [day.from2, day.to2]].some(([from, to]) =>
    !!from && !!to && validTime(from) && validTime(to) && start >= minutes(from) && start + duration <= minutes(to));
}

export function validateTransfer(alias: string, cbu: string, holder: string): string | null {
  if (!alias.trim() && !cbu.trim()) return "Ingresá un alias o un CBU / CVU para recibir la seña.";
  if (cbu.trim() && !/^\d{22}$/.test(cbu.replace(/\s/g, ""))) return "El CBU / CVU debe tener 22 dígitos.";
  if (!holder.trim()) return "Ingresá el nombre del titular de la cuenta.";
  return null;
}
