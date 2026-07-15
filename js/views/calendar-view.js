// ============================================================================
// Vista de Calendario: cuadrícula mensual con las tareas en su fecha límite.
// Las marcadas como hito se resaltan con un borde dorado y bandera.
// ============================================================================
import { escapeHtml, toDateInputValue } from "../utils.js";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MAX_PER_DAY = 3;

export function renderCalendarView(container, { tasks, viewDate, onOpenTask, onAddTaskOnDate, onMonthChange }) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayKey = toDateInputValue(new Date());

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0=Lunes

  const byDate = new Map();
  tasks.forEach((t) => {
    if (!t.dueDate) return;
    const key = toDateInputValue(t.dueDate);
    if (!key) return;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(t);
  });
  byDate.forEach((list) => list.sort((a, b) => (b.isMilestone ? 1 : 0) - (a.isMilestone ? 1 : 0)));

  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - firstWeekday + 1;
    if (dayNum < 1) {
      cells.push({ key: null, label: daysInPrevMonth + dayNum, otherMonth: true, tasks: [] });
    } else if (dayNum > daysInMonth) {
      cells.push({ key: null, label: dayNum - daysInMonth, otherMonth: true, tasks: [] });
    } else {
      const key = toDateInputValue(new Date(year, month, dayNum));
      cells.push({ key, label: dayNum, otherMonth: false, tasks: byDate.get(key) || [] });
    }
  }

  container.innerHTML = `
    <div class="calendar">
      <div class="calendar-header">
        <button class="btn btn--ghost btn--sm" id="cal-prev">‹</button>
        <span class="calendar-header__label">${MESES_LARGOS[month]} ${year}</span>
        <button class="btn btn--ghost btn--sm" id="cal-next">›</button>
        <button class="btn btn--ghost btn--sm" id="cal-today" style="margin-left:auto;">Hoy</button>
      </div>
      <div class="calendar-grid">
        ${DIAS_SEMANA.map((d) => `<div class="calendar-weekday">${d}</div>`).join("")}
        ${cells
          .map((cell) => {
            const isToday = cell.key === todayKey;
            const visible = cell.tasks.slice(0, MAX_PER_DAY);
            const extra = cell.tasks.length - visible.length;
            return `
            <div class="calendar-day${cell.otherMonth ? " is-other-month" : ""}${isToday ? " is-today" : ""}">
              <div style="display:flex;align-items:center;">
                <span class="calendar-day__number">${cell.label}</span>
                ${!cell.otherMonth ? `<button class="calendar-day__add" data-add-date="${cell.key}" title="Nueva tarea este día">+</button>` : ""}
              </div>
              ${visible
                .map(
                  (t) => `
                <div class="calendar-task-chip${t.isMilestone ? " is-milestone" : ""}" data-open="${t.id}">${t.isMilestone ? "🚩 " : ""}${escapeHtml(t.title)}</div>`
                )
                .join("")}
              ${extra > 0 ? `<div class="calendar-more" data-more="${cell.key}">+${extra} más</div>` : ""}
            </div>`;
          })
          .join("")}
      </div>
    </div>
  `;

  container.querySelector("#cal-prev").addEventListener("click", () => onMonthChange(new Date(year, month - 1, 1)));
  container.querySelector("#cal-next").addEventListener("click", () => onMonthChange(new Date(year, month + 1, 1)));
  container.querySelector("#cal-today").addEventListener("click", () => onMonthChange(new Date()));

  container.querySelectorAll("[data-open]").forEach((elx) => {
    elx.addEventListener("click", () => onOpenTask(elx.dataset.open));
  });
  container.querySelectorAll("[data-add-date]").forEach((btn) => {
    btn.addEventListener("click", () => onAddTaskOnDate(btn.dataset.addDate));
  });
  container.querySelectorAll("[data-more]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.more;
      const dayTasks = byDate.get(key) || [];
      if (dayTasks.length) onOpenTask(dayTasks[MAX_PER_DAY]?.id || dayTasks[0].id);
    });
  });
}
