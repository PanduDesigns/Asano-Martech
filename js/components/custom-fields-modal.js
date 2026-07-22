// ============================================================================
// Modal: definir los campos personalizados de un proyecto (nombre + lista
// de opciones). Se editan en cualquier momento desde el menú contextual
// del proyecto — no hace falta decidirlos al crearlo.
// ============================================================================
import { el, uid, escapeHtml } from "../utils.js";
import { updateProject } from "../data/projects.js";

export function openCustomFieldsModal({ project }) {
  const root = document.getElementById("modal-root");
  let fields = (project.customFieldDefs || []).map((f) => ({ ...f, optionsText: (f.options || []).join(", ") }));

  const overlay = el(`
    <div class="modal-overlay">
      <div class="modal modal--sm">
        <div class="modal__header">
          <h3 style="font-size:16px;">Campos personalizados</h3>
          <button class="modal__close" id="close">✕</button>
        </div>
        <div class="modal__body">
          <p class="field__hint">Cada campo es una lista de opciones (p. ej. "Cliente" con "Talgo, Stelia, Togg"). Se podrán elegir en cada tarea y usarse como filtro.</p>
          <div id="cf-list" style="display:flex;flex-direction:column;gap:12px;"></div>
          <button class="btn btn--ghost btn--sm" id="cf-add" type="button" style="width:fit-content;">+ Añadir campo</button>
        </div>
        <div class="modal__footer">
          <button class="btn btn--ghost" id="cancel">Cancelar</button>
          <button class="btn btn--primary" id="save" style="margin-left:auto;">Guardar</button>
        </div>
      </div>
    </div>
  `);
  root.appendChild(overlay);

  function renderFields() {
    const list = overlay.querySelector("#cf-list");
    if (!fields.length) {
      list.innerHTML = `<p style="color:var(--color-text-faint);font-size:12.5px;">Sin campos todavía.</p>`;
      return;
    }
    list.innerHTML = fields
      .map(
        (f) => `
      <div class="modal-row" data-field="${f.id}" style="align-items:flex-end;">
        <label class="field" style="flex:1;">
          <span class="field__label">Nombre</span>
          <input class="field__input cf-name" value="${escapeHtml(f.name)}" placeholder="Ej. Cliente">
        </label>
        <label class="field" style="flex:1.6;">
          <span class="field__label">Opciones (separadas por comas)</span>
          <input class="field__input cf-options" value="${escapeHtml(f.optionsText)}" placeholder="Ej. Talgo, Stelia, Togg">
        </label>
        <button class="subtask-row__remove" data-remove="${f.id}" type="button" style="margin-bottom:10px;">✕</button>
      </div>`
      )
      .join("");

    list.querySelectorAll("[data-field]").forEach((row) => {
      const id = row.dataset.field;
      row.querySelector(".cf-name").addEventListener("input", (e) => {
        const f = fields.find((f) => f.id === id);
        if (f) f.name = e.target.value;
      });
      row.querySelector(".cf-options").addEventListener("input", (e) => {
        const f = fields.find((f) => f.id === id);
        if (f) f.optionsText = e.target.value;
      });
    });
    list.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        fields = fields.filter((f) => f.id !== btn.dataset.remove);
        renderFields();
      });
    });
  }
  renderFields();

  overlay.querySelector("#cf-add").addEventListener("click", () => {
    fields.push({ id: uid(), name: "", optionsText: "" });
    renderFields();
  });

  function close() {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  }
  function onKeydown(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKeydown);
  overlay.querySelector("#close").addEventListener("click", close);
  overlay.querySelector("#cancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  overlay.querySelector("#save").addEventListener("click", async () => {
    const cleaned = fields
      .map((f) => ({
        id: f.id,
        name: f.name.trim(),
        options: f.optionsText.split(",").map((o) => o.trim()).filter(Boolean),
      }))
      .filter((f) => f.name && f.options.length);
    const saveBtn = overlay.querySelector("#save");
    saveBtn.disabled = true;
    saveBtn.textContent = "Guardando…";
    try {
      await updateProject(project.id, { customFieldDefs: cleaned });
      close();
    } catch (e) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Guardar";
    }
  });
}
