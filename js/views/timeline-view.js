// ============================================================================
// Línea de tiempo / Gantt. Se le pasa `groups`: un array de secciones (vista
// por proyecto) o de proyectos (vista global) con sus tareas ya dentro, así
// la misma vista sirve para los dos casos sin duplicar lógica.
//
// Cómo se calcula cada barra: si la tarea tiene fecha de inicio Y fecha
// límite, la barra cubre todo ese rango. Si solo tiene una de las dos, se
// dibuja un marcador de un día en esa fecha. Los hitos siempre se dibujan
// como un rombo en su fecha, nunca como barra (por definición no tienen
// duración).
// ============================================================================
import { escapeHtml, toDate, addDays, daysBetween } from "../utils.js";
import { openTaskContextMenu } from "./list-view.js";

const DAY_W = 32;
const LABEL_W = 224;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const PRIORITY_COLORS = {
  urgente: "var(--color-danger)",
  alta: "var(--color-signal)",
  media: "#78848C",
  baja: "var(--color-text-faint)",
};

export function renderTimelineView(container, { groups, onOpenTask }) {
  const allTasks = groups.flatMap((g) => g.tasks);
  const withDates = allTasks.filter((t) => t.startDate || t.dueDate);
  const withoutDates = allTasks.length - withDates.length;

  let rangeStart, rangeEnd;
  if (withDates.length) {
    const dates = withDates.flatMap((t) => [t.startDate && toDate(t.startDate), t.dueDate && toDate(t.dueDate)].filter(Boolean));
    rangeStart = addDays(new Date(Math.min(...dates)), -3);
    rangeEnd = addDays(new Date(Math.max(...dates)), 4);
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    rangeStart = addDays(today, -3);
    rangeEnd = addDays(today, 25);
  }
  const dayCount = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(rangeStart, i));
  const todayIdx = daysBetween(rangeStart, new Date());

  const rows = [];
  groups.forEach((g) => {
    if (!g.tasks.length) return;
    rows.push({ type: "group", label: g.label, color: g.color });
    g.tasks.forEach((t) => rows.push({ type: "task", task: t }));
  });

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__eyebrow">— LÍNEA DE TIEMPO —</span>
        <h2>Nada que mostrar todavía</h2>
        <p>Ponle fecha de inicio y/o fecha límite a alguna tarea para que aparezca aquí.</p>
      </div>`;
    return;
  }

  const totalRows = rows.length + 1;
  const gridTemplateColumns = `${LABEL_W}px repeat(${dayCount}, ${DAY_W}px)`;

  let cells = `<div class="tl-cell tl-corner" style="grid-column:1;grid-row:1;"></div>`;

  days.forEach((d, i) => {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isMonthStart = d.getDate() === 1 || i === 0;
    cells += `<div class="tl-daycol${isWeekend ? " is-weekend" : ""}" style="grid-column:${i + 2};grid-row:1;">
      ${isMonthStart ? `<span class="tl-month">${MESES[d.getMonth()]}</span>` : ""}
      <span class="tl-daynum">${d.getDate()}</span>
    </div>`;
  });

  rows.forEach((row, ri) => {
    const gridRow = ri + 2;
    if (row.type === "group") {
      cells += `<div class="tl-group-label" style="grid-column:1;grid-row:${gridRow};"><span class="tl-group-dot" style="background:${row.color}"></span>${escapeHtml(row.label)}</div>`;
      cells += `<div class="tl-group-band" style="grid-column:2 / ${dayCount + 2};grid-row:${gridRow};"></div>`;
      return;
    }
    const t = row.task;
    cells += `<div class="tl-task-label" data-open="${t.id}" data-task-id="${t.id}" title="${escapeHtml(t.title)}" style="grid-column:1;grid-row:${gridRow};${t.isComplete ? "color:var(--color-text-faint);text-decoration:line-through;" : ""}">${t.isMilestone ? "🚩 " : ""}${escapeHtml(t.title)}</div>`;
    cells += `<div class="tl-row-band" style="grid-column:2 / ${dayCount + 2};grid-row:${gridRow};"></div>`;

    const span = taskSpan(t, rangeStart, dayCount);
    if (!span) return;
    if (t.isMilestone) {
      cells += `<div class="tl-milestone" data-open="${t.id}" data-task-id="${t.id}" title="${escapeHtml(t.title)}" style="grid-column:${span.e + 2};grid-row:${gridRow};"><span class="tl-milestone__diamond"></span></div>`;
    } else {
      const color = PRIORITY_COLORS[t.priority] || "var(--color-line-bright)";
      cells += `<div class="tl-bar${t.isComplete ? " is-complete" : ""}" data-open="${t.id}" data-task-id="${t.id}" title="${escapeHtml(t.title)}" style="grid-column:${span.s + 2} / ${span.e + 3};grid-row:${gridRow};border-color:${color};background:${color};"></div>`;
    }
  });

  if (todayIdx >= 0 && todayIdx < dayCount) {
    cells += `<div class="tl-today-line" style="grid-column:${todayIdx + 2};grid-row:1 / ${totalRows + 1};"></div>`;
  }

  container.innerHTML = `
    <div class="timeline">
      <div class="timeline__toolbar">
        <button class="btn btn--ghost btn--sm" id="tl-today-btn">Hoy</button>
        ${withoutDates > 0 ? `<span class="timeline__hint">${withoutDates} ${withoutDates === 1 ? "tarea sin fecha no se muestra" : "tareas sin fecha no se muestran"} aquí</span>` : ""}
      </div>
      <div class="timeline__scroll" id="tl-scroll">
        <div class="timeline__grid" style="grid-template-columns:${gridTemplateColumns};grid-template-rows:40px repeat(${rows.length}, 34px);">
          ${cells}
        </div>
      </div>
    </div>
  `;

  const scrollBox = container.querySelector("#tl-scroll");
  const scrollToToday = () => {
    const x = Math.max(0, LABEL_W + todayIdx * DAY_W - scrollBox.clientWidth / 2);
    scrollBox.scrollTo({ left: x, behavior: "smooth" });
  };
  container.querySelector("#tl-today-btn").addEventListener("click", scrollToToday);
  if (todayIdx >= 0 && todayIdx < dayCount) requestAnimationFrame(scrollToToday);

  container.querySelectorAll("[data-open]").forEach((elx) => {
    elx.addEventListener("click", () => onOpenTask(elx.dataset.open));
    elx.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const task = allTasks.find((t) => t.id === elx.dataset.taskId);
      if (task) openTaskContextMenu(e.clientX, e.clientY, task, onOpenTask);
    });
  });
}

function taskSpan(task, rangeStart, dayCount) {
  const start = task.startDate ? toDate(task.startDate) : task.dueDate ? toDate(task.dueDate) : null;
  const end = task.dueDate ? toDate(task.dueDate) : task.startDate ? toDate(task.startDate) : null;
  if (!start || !end) return null;
  let s = daysBetween(rangeStart, start);
  let e = daysBetween(rangeStart, end);
  s = Math.max(0, Math.min(s, dayCount - 1));
  e = Math.max(0, Math.min(e, dayCount - 1));
  if (e < s) e = s;
  return { s, e };
}
