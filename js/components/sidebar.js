// ============================================================================
// Sidebar: lista de proyectos, botón de crear proyecto, pie con el usuario.
// ============================================================================
import { initials, colorFromString, escapeHtml } from "../utils.js";

export function renderSidebar(container, { projects, currentProjectId, isMyTasksActive, myTasksCount, userProfile, onSelectProject, onSelectMyTasks, onCreateProject, onLogout }) {
  const items = projects.map((p) => `
    <button class="sidebar__item${p.id === currentProjectId ? " is-active" : ""}" data-project-id="${p.id}">
      <span class="sidebar__item-dot" style="background:${p.color || "#FCD000"}"></span>
      <span class="sidebar__item-name">${escapeHtml(p.name)}</span>
    </button>
  `).join("");

  container.innerHTML = `
    <div class="sidebar__brand">
      <img src="assets/martech-badge.png" alt="Martech Corporation" class="sidebar__brand-logo">
    </div>
    <div class="sidebar__brand-product">
      <span class="sidebar__brand-dot"></span>
      <span class="sidebar__brand-name">NEXUS</span>
    </div>

    <button class="sidebar__item sidebar__item--pinned${isMyTasksActive ? " is-active" : ""}" id="btn-my-tasks">
      <span class="sidebar__item-icon">🗂️</span>
      <span class="sidebar__item-name">Mis tareas</span>
      ${myTasksCount ? `<span class="sidebar__item-count">${myTasksCount}</span>` : ""}
    </button>

    <span class="sidebar__section-label">Proyectos</span>
    <div class="sidebar__list">
      ${items || `<p style="color:var(--color-text-faint);font-size:12.5px;padding:8px;">Todavía no hay proyectos.</p>`}
    </div>
    <button class="sidebar__new-project" id="btn-new-project">+ Nuevo proyecto</button>

    <div class="sidebar__footer">
      <span class="avatar" style="background:${colorFromString(userProfile.uid)}">${initials(userProfile.name)}</span>
      <div style="min-width:0;">
        <div class="sidebar__user-name">${escapeHtml(userProfile.name || userProfile.email)}</div>
        <div class="sidebar__user-role">${userProfile.role === "admin" ? "Admin" : "Miembro"}</div>
      </div>
      <button class="sidebar__logout" title="Cerrar sesión" id="btn-logout">⏻</button>
    </div>
  `;

  container.querySelectorAll(".sidebar__item[data-project-id]").forEach((btn) => {
    btn.addEventListener("click", () => onSelectProject(btn.dataset.projectId));
  });
  container.querySelector("#btn-my-tasks").addEventListener("click", onSelectMyTasks);
  container.querySelector("#btn-new-project").addEventListener("click", onCreateProject);
  container.querySelector("#btn-logout").addEventListener("click", onLogout);
}
