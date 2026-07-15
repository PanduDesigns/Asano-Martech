// ============================================================================
// Modal ligero para crear tareas rápido: título + sección + botón Añadir.
// Tras crear una tarea, el campo se vacía y mantiene el foco para poder
// seguir añadiendo varias seguidas; se cierra con el botón, Escape o
// clicando fuera.
// ============================================================================
import { el, escapeHtml, formatDate } from "../utils.js";

export function openQuickAddTaskModal({ project, defaultSectionId, presetDueDate, onCreate }) {
  const root = document.getElementById("modal-root");
  const initialSection = defaultSectionId || project.sections[0]?.id || "";

  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal modal--sm">
        <div class="modal__header">
          <h3 style="font-size:16px;">Nueva tarea</h3>
          <button class="modal__close" id="close">✕</button>
        </div>
        <div class="modal__body">
          <label class="field">
            <span class="field__label">Título</span>
            <input class="field__input" id="q-title" type="text" placeholder="¿Qué hay que hacer?" autofocus>
          </label>
          <label class="field">
            <span class="field__label">Sección</span>
            <select class="field__select" id="q-section">
              ${project.sections.map((s) => `<option value="${s.id}" ${s.id === initialSection ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </label>
          ${presetDueDate ? `<p class="field__hint">Fecha límite: ${formatDate(presetDueDate)}</p>` : ""}
          <p class="field__hint">Se queda abierto para seguir añadiendo — cierra cuando termines.</p>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="cancel">Cerrar</button>
          <button class="btn btn--primary" id="add" style="margin-left:auto;">Añadir tarea</button>
        </div>
      </div>
    </div>
  `);
  root.appendChild(overlay);

  const titleInput = overlay.querySelector("#q-title");
  const sectionSelect = overlay.querySelector("#q-section");
  const addBtn = overlay.querySelector("#add");
  titleInput.focus();

  function close() {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  }
  function onKeydown(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKeydown);

  overlay.querySelector("#close").addEventListener("click", close);
  overlay.querySelector("#cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  async function submit() {
    const title = titleInput.value.trim();
    if (!title) { titleInput.focus(); return; }
    addBtn.disabled = true;
    try {
      await onCreate({ title, sectionId: sectionSelect.value, dueDate: presetDueDate || null });
      titleInput.value = "";
      titleInput.focus();
    } finally {
      addBtn.disabled = false;
    }
  }

  addBtn.addEventListener("click", submit);
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });
}
