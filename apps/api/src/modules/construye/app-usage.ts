/**
 * Uso de una app publicada de Edusyn Crea. Todo es anónimo: un "dispositivo" es un identificador
 * aleatorio que la app guarda en el navegador; no hay nombre, IP ni datos del teléfono.
 *
 * El uso del propio equipo (sus dispositivos marcados) se cuenta aparte: lo que se evalúa es que
 * OTRAS personas instalen y usen la app.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Colombia es UTC-5 todo el año (sin horario de verano). */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** "2026-09-22" del día en Colombia para un instante dado. */
export function bogotaDayKey(at: Date): string {
  return new Date(at.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Medianoche UTC del día de Colombia (así se guarda en la columna DATE). */
export function bogotaDay(at: Date): Date {
  return new Date(`${bogotaDayKey(at)}T00:00:00.000Z`);
}

const DEVICE_ID = /^[A-Za-z0-9_-]{16,64}$/;
export const isValidDeviceId = (value: unknown): value is string => typeof value === 'string' && DEVICE_ID.test(value);

export type UsageSource = 'qr' | 'link' | 'team' | 'direct';
export const usageSource = (value: unknown): UsageSource =>
  value === 'qr' || value === 'link' || value === 'team' ? value : 'direct';

export type UsageEventType = 'open' | 'ping' | 'install';
export const usageEventType = (value: unknown): UsageEventType | null =>
  value === 'open' || value === 'ping' || value === 'install' ? value : null;

/** Un "ping" llega cada ~30 s con la app visible; se acota para que nadie infle el tiempo. */
export const MAX_PING_SECONDS = 60;
export const pingSeconds = (value: unknown): number => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PING_SECONDS) : 0;
};

export interface UsageDevice {
  id: string;
  isTeam: boolean;
  source: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  installedAt: Date | null;
}
export interface UsageDay { deviceId: string; day: Date; opens: number; seconds: number; standalone: boolean }

export interface UsageStats {
  /** Personas (dispositivos) distintas que no son del equipo. */
  devices: number;
  /** Dispositivos del propio equipo (se muestran aparte). */
  teamDevices: number;
  /** Instalaciones en la pantalla de inicio, sin contar al equipo. */
  installs: number;
  activeToday: number;
  activeWeek: number;
  opens: number;
  minutes: number;
  /** De quienes la conocieron hace al menos 1/7 días, cuántos volvieron otro día posterior. */
  returnedNextDay: { eligible: number; returned: number };
  returnedWeek: { eligible: number; returned: number };
  sources: Record<UsageSource, number>;
  /** Últimos 14 días de Colombia, del más antiguo al de hoy: dispositivos activos (sin equipo). */
  daily: { day: string; active: number; newDevices: number }[];
  /** Muchos dispositivos nuevos en poco tiempo: se señala para que el docente lo revise. */
  suspicious: boolean;
  lastUseAt: string | null;
}

/** Más de esta cantidad de dispositivos nuevos en una hora se marca para revisión. */
export const SUSPICIOUS_NEW_DEVICES_PER_HOUR = 25;

export function computeUsageStats(devices: UsageDevice[], days: UsageDay[], now: Date = new Date()): UsageStats {
  const others = devices.filter(device => !device.isTeam);
  const otherIds = new Set(others.map(device => device.id));
  const otherDays = days.filter(day => otherIds.has(day.deviceId));
  const today = bogotaDayKey(now);
  const weekStart = bogotaDayKey(new Date(now.getTime() - 6 * DAY_MS));

  const activeOn = new Map<string, Set<string>>();
  for (const day of otherDays) {
    const key = day.day.toISOString().slice(0, 10);
    if (!activeOn.has(key)) activeOn.set(key, new Set());
    activeOn.get(key)!.add(day.deviceId);
  }
  const activeWeek = new Set(otherDays.filter(day => day.day.toISOString().slice(0, 10) >= weekStart).map(day => day.deviceId));

  // Retención: un dispositivo "vuelve" si tiene uso en un día posterior al primero, a ≥1 o ≥7 días.
  const daysByDevice = new Map<string, string[]>();
  for (const day of otherDays) {
    const list = daysByDevice.get(day.deviceId) ?? [];
    list.push(day.day.toISOString().slice(0, 10));
    daysByDevice.set(day.deviceId, list);
  }
  const retention = (afterDays: number) => {
    let eligible = 0;
    let returned = 0;
    for (const device of others) {
      const first = bogotaDayKey(device.firstSeenAt);
      const target = bogotaDayKey(new Date(device.firstSeenAt.getTime() + afterDays * DAY_MS));
      if (target > today) continue;
      eligible++;
      if ((daysByDevice.get(device.id) ?? []).some(day => day > first && day >= target)) returned++;
    }
    return { eligible, returned };
  };

  const sources: Record<UsageSource, number> = { qr: 0, link: 0, team: 0, direct: 0 };
  for (const device of others) sources[usageSource(device.source)]++;

  const daily: UsageStats['daily'] = [];
  for (let i = 13; i >= 0; i--) {
    const key = bogotaDayKey(new Date(now.getTime() - i * DAY_MS));
    daily.push({
      day: key,
      active: activeOn.get(key)?.size ?? 0,
      newDevices: others.filter(device => bogotaDayKey(device.firstSeenAt) === key).length,
    });
  }

  const hourAgo = now.getTime() - 60 * 60 * 1000;
  const lastUse = others.reduce<number>((max, device) => Math.max(max, device.lastSeenAt.getTime()), 0);

  return {
    devices: others.length,
    teamDevices: devices.length - others.length,
    installs: others.filter(device => device.installedAt).length,
    activeToday: activeOn.get(today)?.size ?? 0,
    activeWeek: activeWeek.size,
    opens: otherDays.reduce((sum, day) => sum + day.opens, 0),
    minutes: Math.round(otherDays.reduce((sum, day) => sum + day.seconds, 0) / 60),
    returnedNextDay: retention(1),
    returnedWeek: retention(7),
    sources,
    daily,
    suspicious: others.filter(device => device.firstSeenAt.getTime() >= hourAgo).length > SUSPICIOUS_NEW_DEVICES_PER_HOUR,
    lastUseAt: lastUse ? new Date(lastUse).toISOString() : null,
  };
}
