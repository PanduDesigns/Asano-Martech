// ============================================================================
// Modal de detalle de tarea. Todo se autoguarda al cambiar (como en Asana):
// no hay botón de "Guardar" salvo para comentarios nuevos.
// ============================================================================
import { updateTask, deleteTask, toggleTaskComplete, subscribeToTask } from "../data/tasks.js";
import { addComment, subscribeToComments } from "../data/comments.js";
import { storage } from "../firebase-init.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js";
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
  showToast,
} from "../utils.js";

const PRIORITIES = ["urgente", "alta", "media", "baja"];

export function openTaskModal({ taskId, project, teamMembers, allProjectTasks, currentUserProfile, onClosed, onDeleted }) {
  const root = document.getElementById("modal-root");
  let task = null;
  let comments = [];

  const overlay = el(`<div class="modal-overlay"><div class="modal"><div style="padding:40px;text-align:center;color:var(--color-text-lo);">Cargando…</div></div></div>`);
  root.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", onKeydown);

  const unsubTask = subscribeToTask(taskId, (t) => {
    if (!t) { close(true); return; }
    task = t;
    render();
  });
  const unsubComments = subscribeToComments(taskId, (c) => {
    comments = c;
    renderComments();
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

  function memberById(uidStr) {
    return teamMembers.find((m) => m.uid === uidStr);
  }

  function render() {
    const section = project.sections.find((s) => s.id === task.sectionId) || project.sections[0];
    const overdue = isOverdue(task.dueDate, task.isComplete);

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
              <div class="chip-select" id="t-priority">
                ${PRIORITIES.map((p) => `<button type="button" class="chip${p === task.priority ? " is-selected" : ""}" data-priority="${p}"><span class="chip__dot priority-${p}"></span>${PRIORITY_LABELS[p]}</button>`).join("")}
              </div>
            </label>
          </div>

          <div class="modal-row">
            <label class="field">
              <span class="field__label">Inicio</span>
              <input class="field__input" type="date" id="t-start" value="${toDateInputValue(task.startDate)}">
            </label>
            <label class="field">
              <span class="field__label">Fecha límite</span>
              <input class="field__input" type="date" id="t-due" value="${toDateInputValue(task.dueDate)}" style="${overdue ? "border-color:var(--color-danger)" : ""}">
            </label>
          </div>

          <div class="field">
            <span class="field__label">Responsables</span>
            <div class="chip-select" id="t-assignees">
              ${teamMembers.map((m) => `
                <button type="button" class="chip${task.assigneeIds.includes(m.uid) ? " is-selected" : ""}" data-uid="${m.uid}">
                  <span class="avatar avatar--sm" style="background:${colorFromString(m.uid)}">${initials(m.name)}</span>
                  ${escapeHtml(m.name)}
                </button>`).join("")}
            </div>
          </div>

          <div class="field">
            <span class="field__label">Etiquetas</span>
            <div class="chip-select" id="t-tags">
              ${task.tags.map((tag) => `<span class="chip is-selected" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span data-remove-tag="${escapeHtml(tag)}" style="cursor:pointer;">✕</span></span>`).join("")}
            </div>
            <div class="subtask-add">
              <input class="field__input" id="t-new-tag" placeholder="Añadir etiqueta y pulsar Enter">
            </div>
          </div>

          ${allProjectTasks.filter((t) => t.id !== task.id).length ? `
          <div class="field">
            <span class="field__label">Bloqueada por</span>
            <div class="chip-select" id="t-depends">
              ${allProjectTasks.filter((t) => t.id !== task.id).map((t) => `
                <button type="button" class="chip${task.dependsOn.includes(t.id) ? " is-selected" : ""}" data-dep="${t.id}">${t.isComplete ? "✓ " : ""}${escapeHtml(t.title)}</button>`).join("")}
            </div>
          </div>` : ""}

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
            <span class="field__label">Archivos adjuntos</span>
            <div id="t-attachments" style="display:flex;flex-direction:column;gap:6px;"></div>
            <label class="btn btn--ghost btn--sm" style="width:fit-content;">
              Subir archivo
              <input type="file" id="t-file-input" style="display:none;">
            </label>
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

    wireEvents();
    renderSubtasks();
    renderAttachments();
    renderComments();
  }

  function wireEvents() {
    overlay.querySelector("#t-close").addEventListener("click", () => close());

    overlay.querySelector("#t-complete").addEventListener("click", () => toggleTaskComplete(task.id, !task.isComplete));

    let titleTimer;
    overlay.querySelector("#t-title").addEventListener("input", (e) => {
      clearTimeout(titleTimer);
      const val = e.target.value;
      titleTimer = setTimeout(() => updateTask(task.id, { title: val || "Sin título" }), 500);
    });

    overlay.querySelector("#t-section").addEventListener("change", (e) => updateTask(task.id, { sectionId: e.target.value }));
    overlay.querySelector("#t-start").addEventListener("change", (e) => updateTask(task.id, { startDate: e.target.value || null }));
    overlay.querySelector("#t-due").addEventListener("change", (e) => updateTask(task.id, { dueDate: e.target.value || null }));

    overlay.querySelectorAll("#t-priority .chip").forEach((chip) => {
      chip.addEventListener("click", () => updateTask(task.id, { priority: chip.dataset.priority }));
    });

    overlay.querySelectorAll("#t-assignees .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const u = chip.dataset.uid;
        const set = new Set(task.assigneeIds);
        set.has(u) ? set.delete(u) : set.add(u);
        updateTask(task.id, { assigneeIds: [...set] });
      });
    });

    const depEl = overlay.querySelector("#t-depends");
    if (depEl) {
      depEl.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          const d = chip.dataset.dep;
          const set = new Set(task.dependsOn);
          set.has(d) ? set.delete(d) : set.add(d);
          updateTask(task.id, { dependsOn: [...set] });
        });
      });
    }

    overlay.querySelectorAll("[data-remove-tag]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        updateTask(task.id, { tags: task.tags.filter((t) => t !== btn.dataset.removeTag) });
      });
    });
    overlay.querySelector("#t-new-tag").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val && !task.tags.includes(val)) updateTask(task.id, { tags: [...task.tags, val] });
        e.target.value = "";
      }
    });

    let descTimer;
    overlay.querySelector("#t-description").addEventListener("input", (e) => {
      clearTimeout(descTimer);
      const val = e.target.value;
      descTimer = setTimeout(() => updateTask(task.id, { description: val }), 600);
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

    overlay.querySelector("#t-file-input").addEventListener("change", handleFileUpload);

    overlay.querySelector("#t-send-comment").addEventListener("click", sendComment);
    overlay.querySelector("#t-new-comment").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendComment();
    });

    overlay.querySelector("#t-delete").addEventListener("click", async () => {
      if (!confirm(`¿Eliminar "${task.title}"? No se puede deshacer.`)) return;
      await deleteTask(task.id);
      close(true);
      onDeleted();
    });
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
    list.querySelectorAll("[data-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const subtasks = task.subtasks.map((s) => (s.id === btn.dataset.sub ? { ...s, done: !s.done } : s));
        updateTask(task.id, { subtasks });
      });
    });
    list.querySelectorAll("[data-remove-sub]").forEach((btn) => {
      btn.addEventListener("click", () => {
        updateTask(task.id, { subtasks: task.subtasks.filter((s) => s.id !== btn.dataset.removeSub) });
      });
    });
  }

  function renderAttachments() {
    const list = overlay.querySelector("#t-attachments");
    if (!task.attachments.length) {
      list.innerHTML = "";
      return;
    }
    list.innerHTML = task.attachments
      .map(
        (a) => `
      <div class="attachment-row">
        <a href="${a.url}" target="_blank" rel="noopener" class="attachment-row__name">📎 ${escapeHtml(a.name)}</a>
        <button class="attachment-row__remove" data-remove-attach="${a.path}">✕</button>
      </div>`
      )
      .join("");
    list.querySelectorAll("[data-remove-attach]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const path = btn.dataset.removeAttach;
        try { await deleteObject(storageRef(storage, path)); } catch (e) { /* puede que ya no exista */ }
        updateTask(task.id, { attachments: task.attachments.filter((a) => a.path !== path) });
      });
    });
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast("El archivo supera los 20 MB.", "error"); return; }
    showToast("Subiendo archivo…");
    const path = `attachments/${task.id}/${uid()}-${file.name}`;
    try {
      const sref = storageRef(storage, path);
      await uploadBytes(sref, file);
      const url = await getDownloadURL(sref);
      await updateTask(task.id, { attachments: [...task.attachments, { name: file.name, url, path }] });
      showToast("Archivo adjuntado.");
    } catch (err) {
      console.error(err);
      showToast("No se pudo subir el archivo.", "error");
    }
    e.target.value = "";
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
}
