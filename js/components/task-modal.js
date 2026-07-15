// ============================================================================
// Modal de detalle de tarea. Todo se autoguarda al cambiar (como en Asana):
// no hay botón de "Guardar" salvo para comentarios nuevos.
//
// IMPORTANTE sobre el re-render: la primera vez que llegan datos de Firestore
// se construye el HTML completo (buildShell). A partir de ahí, cada vez que
// llega una actualización (incluida la que provoca tu propio autoguardado)
// se llama a patchShell, que actualiza los valores SIN destruir los campos
// de texto que puedas tener enfocados — si reconstruyéramos todo el HTML en
// cada actualización, el campo de título/descripción perdería el foco a
// media escritura (justo el "petardeo" que se reportó).
// ============================================================================
import { updateTask, deleteTask, toggleTaskComplete, subscribeToTask } from "../data/tasks.js";
import { addComment, subscribeToComments } from "../data/comments.js";
import {
  el,
  uid,
  escapeHtml,
  initials,
  colorFromString,
  formatDateLong,
  toDateInputValue,
  isOverdue,
  PRIORITY_LABELS,
} from "../utils.js";

const PRIORITIES = ["urgente", "alta", "media", "baja"];

export function openTaskModal({ taskId, project, teamMembers, allProjectTasks, currentUserProfile, onClosed, onDeleted }) {
  const root = document.getElementById("modal-root");
  let task = null;
  let comments = [];
  let builtOnce = false;

  const overlay = el(`<div class="modal-overlay"><div class="modal"><div style="padding:40px;text-align:center;color:var(--color-text-lo);">Cargando…</div></div></div>`);
  root.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKeydown);

  const unsubTask = subscribeToTask(taskId, (t) => {
    if (!t) { close(true); return; }
    task = t;
    if (!builtOnce) {
      buildShell();
      builtOnce = true;
    } else {
      patchShell();
    }
  });
  const unsubComments = subscribeToComments(taskId, (c) => {
    comments = c;
    if (builtOnce) renderComments();
  });

  function close(skipCallback) {
    unsubTask();
    unsubComments();
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (!skipCallback) onClosed();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  // --------------------------------------------------------------------
  // Construcción inicial (una sola vez)
  // --------------------------------------------------------------------
  function buildShell() {
    const section = project.sections.find((s) => s.id === task.sectionId) || project.sections[0];

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <button class="task-row__check${task.isComplete ? " is-checked" : ""}" id="t-complete" title="Marcar como completada" style="width:22px;height:22px;">${task.isComplete ? "✓" : ""}</button>
          <input class="modal__title-input" id="t-title" value="${escapeHtml(task.title)}" placeholder="Título de la tarea">
          <button class="modal__close" id="t-close">✕</button>
        </div>
        <div class="modal__body">

          <div class="modal-row">
            <label class="field">
              <span class="field__label">Sección</span>
              <select class="field__select" id="t-section">
                ${project.sections.map((s) => `<option value="${s.id}" ${s.id === section.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span class="field__label">Prioridad</span>
              <div class="chip-select" id="t-priority"></div>
            </label>
          </div>

          <div class="modal-row">
            <label class="field">
              <span class="field__label">Inicio</span>
              <input class="field__input" type="date" id="t-start" value="${toDateInputValue(task.startDate)}">
            </label>
            <label class="field">
              <span class="field__label">Fecha límite</span>
              <input class="field__input" type="date" id="t-due" value="${toDateInputValue(task.dueDate)}">
            </label>
          </div>

          <div id="t-milestone-wrap"></div>

          <div class="field">
            <span class="field__label">Responsables</span>
            <div class="chip-select" id="t-assignees"></div>
          </div>

          <div class="field">
            <span class="field__label">Etiquetas</span>
            <div class="chip-select" id="t-tags"></div>
            <div class="subtask-add">
              <input class="field__input" id="t-new-tag" placeholder="Añadir etiqueta y pulsar Enter">
            </div>
          </div>

          <div class="field" id="t-depends-wrap"></div>

          <label class="field">
            <span class="field__label">Descripción</span>
            <textarea class="field__textarea" id="t-description" placeholder="Añade detalles, contexto o enlaces…">${escapeHtml(task.description)}</textarea>
          </label>

          <div class="field">
            <span class="field__label">Subtareas</span>
            <div class="subtask-list" id="t-subtasks"></div>
            <div class="subtask-add">
              <input class="field__input" id="t-new-subtask" placeholder="Añadir subtarea y pulsar Enter">
            </div>
          </div>

          <div class="field">
            <span class="field__label">Enlaces adjuntos</span>
            <div id="t-attachments" style="display:flex;flex-direction:column;gap:6px;"></div>
            <div class="modal-row" style="gap:8px;">
              <input class="field__input" id="t-link-name" placeholder="Nombre (ej. Plano instalación)" style="flex:1;">
              <input class="field__input" id="t-link-url" placeholder="https://…" style="flex:1.4;">
              <button class="btn btn--ghost btn--sm" id="t-add-link" type="button">Añadir</button>
            </div>
          </div>

          <div class="section-divider"><span class="section-divider__label">Comentarios</span></div>
          <div id="t-comments"></div>
          <div class="comment-add">
            <textarea class="field__textarea" id="t-new-comment" placeholder="Escribe un comentario…" style="min-height:44px;"></textarea>
            <button class="btn btn--primary btn--sm" id="t-send-comment">Enviar</button>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--danger" id="t-delete">Eliminar tarea</button>
        </div>
      </div>
    `;

    // ---- listeners de una sola vez, sobre elementos que nunca se recrean ----
    overlay.addEventListener("click", onDelegatedClick);

    let titleTimer;
    overlay.querySelector("#t-title").addEventListener("input", (e) => {
      clearTimeout(titleTimer);
      const val = e.target.value;
      titleTimer = setTimeout(() => updateTask(task.id, { title: val || "Sin título" }), 500);
    });

    let descTimer;
    overlay.querySelector("#t-description").addEventListener("input", (e) => {
      clearTimeout(descTimer);
      const val = e.target.value;
      descTimer = setTimeout(() => updateTask(task.id, { description: val }), 600);
    });

    overlay.querySelector("#t-section").addEventListener("change", (e) => updateTask(task.id, { sectionId: e.target.value }));
    overlay.querySelector("#t-start").addEventListener("change", (e) => updateTask(task.id, { startDate: e.target.value || null }));
    overlay.querySelector("#t-due").addEventListener("change", (e) => updateTask(task.id, { dueDate: e.target.value || null }));

    overlay.querySelector("#t-new-tag").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val && !task.tags.includes(val)) updateTask(task.id, { tags: [...task.tags, val] });
        e.target.value = "";
      }
    });

    overlay.querySelector("#t-new-subtask").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val) {
          updateTask(task.id, { subtasks: [...task.subtasks, { id: uid(), title: val, done: false }] });
          e.target.value = "";
        }
      }
    });

    overlay.querySelector("#t-link-url").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); handleAddLink(); }
    });

    overlay.querySelector("#t-new-comment").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment();
    });

    // ---- piezas que sí se regeneran en cada patch, pintadas ahora por primera vez ----
    renderPriorityChips();
    renderMilestoneButton();
    renderAssigneeChips();
    renderTagChips();
    renderDependencyChips();
    renderSubtasks();
    renderAttachments();
    renderComments();
  }

  // --------------------------------------------------------------------
  // Actualización tras la primera vez: solo toca lo necesario
  // --------------------------------------------------------------------
  function patchShell() {
    const titleInput = overlay.querySelector("#t-title");
    if (titleInput && document.activeElement !== titleInput && titleInput.value !== task.title) {
      titleInput.value = task.title;
    }
    const descInput = overlay.querySelector("#t-description");
    if (descInput && document.activeElement !== descInput && descInput.value !== task.description) {
      descInput.value = task.description;
    }
    const sectionSelect = overlay.querySelector("#t-section");
    if (sectionSelect && document.activeElement !== sectionSelect) sectionSelect.value = task.sectionId;
    const startInput = overlay.querySelector("#t-start");
    if (startInput && document.activeElement !== startInput) startInput.value = toDateInputValue(task.startDate);
    const dueInput = overlay.querySelector("#t-due");
    if (dueInput && document.activeElement !== dueInput) dueInput.value = toDateInputValue(task.dueDate);
    if (dueInput) dueInput.style.borderColor = isOverdue(task.dueDate, task.isComplete) ? "var(--color-danger)" : "";

    const completeBtn = overlay.querySelector("#t-complete");
    if (completeBtn) {
      completeBtn.classList.toggle("is-checked", task.isComplete);
      completeBtn.textContent = task.isComplete ? "✓" : "";
    }

    renderPriorityChips();
    renderMilestoneButton();
    renderAssigneeChips();
    renderTagChips();
    renderDependencyChips();
    renderSubtasks();
    renderAttachments();
  }

  // --------------------------------------------------------------------
  // Click delegado: como estas piezas se regeneran, un solo listener sobre
  // el overlay (que nunca se destruye) evita tener que re-engancharlo cada vez.
  // --------------------------------------------------------------------
  function onDelegatedClick(e) {
    const priorityChip = e.target.closest("#t-priority .chip");
    if (priorityChip) { updateTask(task.id, { priority: priorityChip.dataset.priority }); return; }

    const milestoneBtn = e.target.closest("#t-milestone");
    if (milestoneBtn) { updateTask(task.id, { isMilestone: !task.isMilestone }); return; }

    const assigneeChip = e.target.closest("#t-assignees .chip");
    if (assigneeChip) {
      const u = assigneeChip.dataset.uid;
      const set = new Set(task.assigneeIds);
      set.has(u) ? set.delete(u) : set.add(u);
      updateTask(task.id, { assigneeIds: [...set] });
      return;
    }

    const removeTagBtn = e.target.closest("[data-remove-tag]");
    if (removeTagBtn) { updateTask(task.id, { tags: task.tags.filter((t) => t !== removeTagBtn.dataset.removeTag) }); return; }

    const depChip = e.target.closest("#t-depends .chip");
    if (depChip) {
      const d = depChip.dataset.dep;
      const set = new Set(task.dependsOn);
      set.has(d) ? set.delete(d) : set.add(d);
      updateTask(task.id, { dependsOn: [...set] });
      return;
    }

    if (e.target.closest("#t-complete")) { toggleTaskComplete(task.id, !task.isComplete); return; }

    const subCheck = e.target.closest("[data-sub]");
    if (subCheck) {
      const subtasks = task.subtasks.map((s) => (s.id === subCheck.dataset.sub ? { ...s, done: !s.done } : s));
      updateTask(task.id, { subtasks });
      return;
    }
    const subRemove = e.target.closest("[data-remove-sub]");
    if (subRemove) { updateTask(task.id, { subtasks: task.subtasks.filter((s) => s.id !== subRemove.dataset.removeSub) }); return; }

    const attachRemove = e.target.closest("[data-remove-attach]");
    if (attachRemove) { updateTask(task.id, { attachments: task.attachments.filter((a) => a.id !== attachRemove.dataset.removeAttach) }); return; }

    if (e.target.closest("#t-add-link")) { handleAddLink(); return; }
    if (e.target.closest("#t-close")) { close(); return; }
    if (e.target.closest("#t-send-comment")) { sendComment(); return; }
    if (e.target.closest("#t-delete")) { handleDelete(); return; }
  }

  // --------------------------------------------------------------------
  // Piezas regenerables (sin estado de foco que preservar)
  // --------------------------------------------------------------------
  function renderPriorityChips() {
    const box = overlay.querySelector("#t-priority");
    box.innerHTML = PRIORITIES.map(
      (p) => `<button type="button" class="chip${p === task.priority ? " is-selected" : ""}" data-priority="${p}"><span class="chip__dot priority-${p}"></span>${PRIORITY_LABELS[p]}</button>`
    ).join("");
  }

  function renderMilestoneButton() {
    const wrap = overlay.querySelector("#t-milestone-wrap");
    wrap.innerHTML = `
      <button type="button" class="chip${task.isMilestone ? " is-selected" : ""}" id="t-milestone" style="width:fit-content;">
        🚩 ${task.isMilestone ? "Marcada como hito" : "Marcar como hito"}
      </button>`;
  }

  function renderAssigneeChips() {
    const box = overlay.querySelector("#t-assignees");
    box.innerHTML = teamMembers
      .map(
        (m) => `
      <button type="button" class="chip${task.assigneeIds.includes(m.uid) ? " is-selected" : ""}" data-uid="${m.uid}">
        <span class="avatar avatar--sm" style="background:${colorFromString(m.uid)}">${initials(m.name)}</span>
        ${escapeHtml(m.name)}
      </button>`
      )
      .join("");
  }

  function renderTagChips() {
    const box = overlay.querySelector("#t-tags");
    box.innerHTML = task.tags
      .map((tag) => `<span class="chip is-selected" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span data-remove-tag="${escapeHtml(tag)}" style="cursor:pointer;">✕</span></span>`)
      .join("");
  }

  function renderDependencyChips() {
    const wrap = overlay.querySelector("#t-depends-wrap");
    const others = allProjectTasks.filter((t) => t.id !== task.id);
    if (!others.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = `
      <span class="field__label">Bloqueada por</span>
      <div class="chip-select" id="t-depends">
        ${others.map((t) => `<button type="button" class="chip${task.dependsOn.includes(t.id) ? " is-selected" : ""}" data-dep="${t.id}">${t.isComplete ? "✓ " : ""}${escapeHtml(t.title)}</button>`).join("")}
      </div>`;
  }

  function renderSubtasks() {
    const list = overlay.querySelector("#t-subtasks");
    if (!task.subtasks.length) {
      list.innerHTML = `<p style="color:var(--color-text-faint);font-size:12.5px;">Sin subtareas todavía.</p>`;
      return;
    }
    list.innerHTML = task.subtasks
      .map(
        (s) => `
      <div class="subtask-row">
        <button class="subtask-row__check${s.done ? " is-checked" : ""}" data-sub="${s.id}">${s.done ? "✓" : ""}</button>
        <span class="subtask-row__text${s.done ? " is-checked" : ""}" style="cursor:default;">${escapeHtml(s.title)}</span>
        <button class="subtask-row__remove" data-remove-sub="${s.id}">✕</button>
      </div>`
      )
      .join("");
  }

  function renderAttachments() {
    const list = overlay.querySelector("#t-attachments");
    if (!task.attachments.length) { list.innerHTML = ""; return; }
    list.innerHTML = task.attachments
      .map(
        (a) => `
      <div class="attachment-row">
        <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="attachment-row__name">🔗 ${escapeHtml(a.name)}</a>
        <button class="attachment-row__remove" data-remove-attach="${a.id}">✕</button>
      </div>`
      )
      .join("");
  }

  function handleAddLink() {
    const nameInput = overlay.querySelector("#t-link-name");
    const urlInput = overlay.querySelector("#t-link-url");
    let url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    const name = nameInput.value.trim() || url.replace(/^https?:\/\//i, "").split("/")[0];
    updateTask(task.id, { attachments: [...task.attachments, { id: uid(), name, url }] });
    nameInput.value = "";
    urlInput.value = "";
  }

  function renderComments() {
    const list = overlay.querySelector("#t-comments");
    if (!list) return;
    if (!comments.length) {
      list.innerHTML = `<p style="color:var(--color-text-faint);font-size:12.5px;">Sin comentarios todavía.</p>`;
      return;
    }
    list.innerHTML = comments
      .map(
        (c) => `
      <div class="comment">
        <span class="avatar avatar--sm" style="background:${colorFromString(c.authorId)}">${initials(c.authorName)}</span>
        <div class="comment__body">
          <div class="comment__meta">
            <span class="comment__author">${escapeHtml(c.authorName)}</span>
            <span class="comment__time">${c.createdAt ? formatDateLong(c.createdAt) : "enviando…"}</span>
          </div>
          <p class="comment__text">${escapeHtml(c.text)}</p>
        </div>
      </div>`
      )
      .join("");
  }

  async function sendComment() {
    const textarea = overlay.querySelector("#t-new-comment");
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = "";
    await addComment(task.id, { authorId: currentUserProfile.uid, authorName: currentUserProfile.name, text });
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar "${task.title}"? No se puede deshacer.`)) return;
    await deleteTask(task.id);
    close(true);
    onDeleted();
  }
}
