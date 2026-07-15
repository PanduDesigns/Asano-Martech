// ============================================================================
// Inicialización de Firebase. El resto de la app importa `auth` y `db`
// desde aquí en lugar de inicializar Firebase varias veces.
// ============================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const isPlaceholderConfig = firebaseConfig.apiKey === "TU_API_KEY";

if (isPlaceholderConfig) {
  // Aviso visible en pantalla además de en consola, para que no cueste
  // encontrar el motivo si alguien abre el proyecto sin haber configurado
  // Firebase todavía.
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;
        background:#17181A;color:#ECEDED;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
        <div style="max-width:480px;">
          <h1 style="font-size:20px;margin-bottom:12px;">Falta configurar Firebase</h1>
          <p style="color:#8B959C;font-size:14px;line-height:1.6;">
            Edita <code style="color:#FCD000;">js/firebase-config.js</code> con las claves de tu
            proyecto de Firebase (Firebase Console → Configuración del proyecto → Tus apps).
            Consulta el README.md incluido para el paso a paso.
          </p>
        </div>
      </div>`;
  });
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
