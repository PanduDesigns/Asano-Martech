// ============================================================================
// Vista "Mis tareas": todo lo asignado a la persona, en cualquier proyecto,
// agrupado por urgencia de fecha (como la vista personal de Asana).
// ============================================================================
import { escapeHtml, formatDate, isOverdue, toDate, initials, colorFromString, sortByPriority, textColorFor } from "../utils.js";
import { openTaskContextMenu } from "./list-view.js";

function tagPill(name, tagsRegistry) {
  const found = (tagsRegistry || []).find((t) => t.name.toLowerCase() === name.toLowerCase());
  const color = found ? found.color : "#8B959C";
  return `<span class="tag-pill" style="background:${color};color:${textColorFor(color)};">${escapeHtml(name)}</span>`;
}

export function renderMyTasksView(container, { tasks, teamMembers, projects, tagsRegistry, onOpenTask }) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekLimit = new Date(todayStart);
  weekLimit.setDate(weekLimit.getDate() + 7);

  const groups = { vencidas: [], hoy: [], semana: [], adelante: [], sinFecha: [] };

  tasks.forEach((task) => {
    if (!task.dueDate) { groups.sinFecha.push(task); return; }
    const d = toDate(task.dueDate);
    if (!d) { groups.sinFecha.push(task); return; }
    if (d.getTime() < todayStart.getTime()) {
      if (task.isComplete) groups.hoy.push(task); // completadas atrasadas no insisten como "vencidas"
      else groups.vencidas.push(task);
    } else if (d.getTime() === todayStart.getTime()) {
      groups.hoy.push(task);
    } else if (d.getTime() < weekLimit.getTime()) {
      groups.semana.push(task);
    } else {
      groups.adelante.push(task);
    }
  });

  const sorter = (a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    return sortByPriority(a, b);
  };
  Object.values(groups).forEach((list) => list.sort(sorter));

  const sections = [
    { key: "vencidas", label: "Vencidas" },
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Esta semana" },
    { key: "adelante", label: "Más adelante" },
    { key: "sinFecha", label: "Sin fecha" },
  ];

  const nonEmpty = sections.filter((s) => groups[s.key].length);

  if (!nonEmpty.length) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__eyebrow">— MIS TAREAS —</span>
        <h2>No tienes tareas asignadas</h2>
        <p>Cuando alguien te asigne una tarea en cualquier proyecto, aparecerá aquí.</p>
      </div>`;
    return;
  }

  container.innerHTML = nonEmpty
    .map(({ key, label }) => {
      const list = groups[key];
      const rows = list
        .map((task) => {
          const project = projects.find((p) => p.id === task.projectId);
          const overdue = isOverdue(task.dueDate, task.isComplete);
          const assignees = task.assigneeIds.map((id) => teamMembers.find((m) => m.uid === id)).filter(Boolean);
          return `
        <div class="task-row${task.isComplete ? " is-complete" : ""}" data-task-id="${task.id}">
          <span class="task-row__priority priority-${task.priority}${task.priority === "urgente" && !task.isComplete ? " is-pulse" : ""}"></span>
          <span class="task-row__title" data-open="${task.id}">${task.isMilestone ? "🚩 " : ""}${escapeHtml(task.title)}</span>
          <div class="task-row__meta">
            ${task.tags.slice(0, 2).map((t) => tagPill(t, tagsRegistry)).join("")}
            ${!task.projectId ? `<span class="tag" style="color:var(--color-signal);border-color:var(--color-signal-dim);">🔒 Personal</span>` : project ? `<span class="tag" style="border-color:${project.color};color:${project.color};">${escapeHtml(project.name)}</span>` : ""}
            ${task.dueDate ? `<span class="task-row__due${overdue ? " is-overdue" : ""}">${formatDate(task.dueDate)}</span>` : ""}
            <div class="avatar-stack">
              ${assignees.map((m) => `<span class="avatar avatar--sm" style="background:${colorFromString(m.uid)}" title="${escapeHtml(m.name)}">${initials(m.name)}</span>`).join("")}
            </div>
          </div>
        </div>`;
        })
        .join("");

      return `
      <div class="section-block">
        <div class="section-header">
          <span class="section-header__name">${label}</span>
          <span class="section-header__count">${list.length}</span>
        </div>
        ${rows}
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-open]").forEach((elx) => {
    elx.addEventListener("click", () => onOpenTask(elx.dataset.open));
  });
  container.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const task = tasks.find((t) => t.id === row.dataset.taskId);
      if (task) openTaskContextMenu(e.clientX, e.clientY, task, onOpenTask);
    });
  });
}
