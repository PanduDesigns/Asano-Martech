// ============================================================================
// Utilidades compartidas por toda la app.
// ============================================================================

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Convierte un Timestamp de Firestore, Date o string ISO a Date. */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // "YYYY-MM-DD" (lo que da un <input type="date">) se trata como fecha
    // LOCAL a propósito. Si se dejara que new Date(string) lo interprete
    // como UTC, el cálculo de "vencida" se desplazaría según la zona
    // horaria de quien lo mire.
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Formato corto para tarjetas/listas: "8 jul". */
export function formatDate(value) {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Formato largo: "8 de julio de 2026". */
export function formatDateLong(value) {
  const d = toDate(value);
  if (!d) return "";
  const mesesLargos = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d.getDate()} de ${mesesLargos[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Para inputs type="date": "2026-07-08". */
export function toDateInputValue(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isOverdue(value, isComplete) {
  if (!value || isComplete) return false;
  const d = toDate(value);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/** Iniciales para avatares: "Ramón Panduro" -> "RP". */
export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = ["#FCD000", "#6BB0B0", "#D98F55", "#8FBF98", "#9FA6D9", "#D98BA0", "#7FAFC4", "#C9A876"];

/** Color determinista a partir de un string (uid o nombre), para avatares. */
export function colorFromString(str) {
  if (!str) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

const PRIORITY_ORDER = { urgente: 0, alta: 1, media: 2, baja: 3 };
export function sortByPriority(a, b) {
  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
}

export const PRIORITY_LABELS = { urgente: "Urgente", alta: "Alta", media: "Media", baja: "Baja" };

/** Toast de notificación en la esquina inferior derecha. */
export function showToast(message, type = "info") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " toast--error" : ""}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 200ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

export function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
