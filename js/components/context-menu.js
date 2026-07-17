// ============================================================================
// Menú contextual genérico (clic derecho). Se usa tanto para tareas como
// para proyectos — cada sitio le pasa su propia lista de acciones.
// ============================================================================
import { el, escapeHtml } from "../utils.js";

/**
 * items: array de { label, icon, danger, onClick } o { divider: true }
 */
export function openContextMenu({ x, y, items }) {
  document.querySelectorAll(".context-menu").forEach((m) => m.remove());

  const html = items
    .map((item) => {
      if (item.divider) return `<div class="context-menu__divider"></div>`;
      return `<button class="context-menu__item${item.danger ? " is-danger" : ""}" type="button">
        <span class="context-menu__icon">${item.icon || ""}</span>${escapeHtml(item.label)}
      </button>`;
    })
    .join("");

  const menu = el(`<div class="context-menu">${html}</div>`);
  document.body.appendChild(menu);

  // Posicionar sin salirse de la ventana
  const rect = menu.getBoundingClientRect();
  const left = Math.min(x, window.innerWidth - rect.width - 8);
  const top = Math.min(y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;

  const buttons = menu.querySelectorAll(".context-menu__item");
  items.filter((i) => !i.divider).forEach((item, i) => {
    buttons[i].addEventListener("click", (e) => {
      e.stopPropagation();
      close();
      item.onClick();
    });
  });

  function close() {
    document.removeEventListener("click", onOutside);
    document.removeEventListener("contextmenu", onOutside);
    document.removeEventListener("keydown", onKeydown);
    menu.remove();
  }
  function onOutside(e) { if (!menu.contains(e.target)) close(); }
  function onKeydown(e) { if (e.key === "Escape") close(); }

  // setTimeout evita que el mismo clic derecho que abre el menú lo cierre al instante
  setTimeout(() => {
    document.addEventListener("click", onOutside);
    document.addEventListener("contextmenu", onOutside);
    document.addEventListener("keydown", onKeydown);
  }, 0);
}
