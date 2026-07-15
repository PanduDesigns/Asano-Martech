// ============================================================================
// Vista de Lista: tareas agrupadas por sección, en filas.
// ============================================================================
import { escapeHtml, formatDate, isOverdue, initials, colorFromString, sortByPriority } from "../utils.js";
import { toggleTaskComplete } from "../data/tasks.js";

export function renderListView(container, { project, tasks, teamMembers, onOpenTask, onAddTask }) {
  const bySection = new Map(project.sections.map((s) => [s.id, []]));
  tasks.forEach((t) => {
    if (!bySection.has(t.sectionId)) bySection.set(t.sectionId, []);
    bySection.get(t.sectionId).push(t);
  });

  const sectionsSorted = [...project.sections].sort((a, b) => a.order - b.order);

  container.innerHTML = sectionsSorted
    .map((section) => {
      const sectionTasks = (bySection.get(section.id) || []).sort((a, b) => {
        if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
        const p = sortByPriority(a, b);
        return p !== 0 ? p : (a.order || 0) - (b.order || 0);
      });

      const rows = sectionTasks
        .map((task) => {
          const overdue = isOverdue(task.dueDate, task.isComplete);
          const assignees = task.assigneeIds
            .map((id) => teamMembers.find((m) => m.uid === id))
            .filter(Boolean);
          return `
        <div class="task-row${task.isComplete ? " is-complete" : ""}" data-task-id="${task.id}">
          <span class="task-row__priority priority-${task.priority}${task.priority === "urgente" && !task.isComplete ? " is-pulse" : ""}"></span>
          <button class="task-row__check${task.isComplete ? " is-checked" : ""}" data-check="${task.id}">${task.isComplete ? "✓" : ""}</button>
          <span class="task-row__title" data-open="${task.id}">${task.isMilestone ? "🚩 " : ""}${escapeHtml(task.title)}</span>
          <div class="task-row__meta">
            ${task.tags.slice(0, 2).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
            ${task.subtasks.length ? `<span class="task-card__subtasks">${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length}</span>` : ""}
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
          <span class="section-header__name">${escapeHtml(section.name)}</span>
          <span class="section-header__count">${sectionTasks.length}</span>
          <button class="section-header__add" data-add-section="${section.id}">+ Añadir tarea</button>
        </div>
        ${rows || `<p style="color:var(--color-text-faint);font-size:12.5px;padding:8px 10px;">Sin tareas en esta sección.</p>`}
      </div>`;
    })
    .join("");

  container.querySelectorAll("[data-check]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const task = tasks.find((t) => t.id === btn.dataset.check);
      toggleTaskComplete(task.id, !task.isComplete);
    });
  });
  container.querySelectorAll("[data-open]").forEach((elx) => {
    elx.addEventListener("click", () => onOpenTask(elx.dataset.open));
  });
  container.querySelectorAll("[data-add-section]").forEach((btn) => {
    btn.addEventListener("click", () => onAddTask(btn.dataset.addSection));
  });
}
