# Nexus — Gestor de tareas del equipo

Gestor de tareas multiusuario con Kanban, lista, subtareas, dependencias,
comentarios y archivos adjuntos. Es un sitio 100% estático (HTML/CSS/JS,
sin paso de compilación) pensado para vivir en GitHub Pages, con Firebase
como base de datos compartida en tiempo real.

Puedes cambiar el nombre "Nexus" por el que prefieras: aparece en
`index.html` (título de la pestaña y pantalla de login) y en
`js/components/sidebar.js`.

**Identidad visual:** los colores (gris pizarra #78848C, antracita #3C3C3C
y el dorado #FCD000 como acento) y el logotipo salen directamente de los
archivos de marca de Martech Corporation, en `assets/`. Si el dorado no es
exactamente el tono que usáis en marketing, es el único valor que habría
que ajustar — está centralizado en `--color-signal` dentro de
`css/styles.css`.

---

## 1. Puesta en marcha (una sola vez)

### 1.1 Crear el proyecto de Firebase
1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y pulsa **Crear proyecto**.
2. Dale un nombre (p. ej. `nexus-martech`) y termina el asistente. El plan gratuito **Spark** es suficiente para un equipo de 6-15 personas.

### 1.2 Activar Authentication
1. En el menú lateral: **Compilación → Authentication → Comenzar**.
2. En la pestaña **Sign-in method**, activa **Correo electrónico/contraseña**.

### 1.3 Activar Firestore Database
1. **Compilación → Firestore Database → Crear base de datos**.
2. Elige una ubicación (por ejemplo `eur3 (europe-west)` si tu equipo está en España/Europa) y empieza en **modo producción** (ya tenemos reglas propias, ver 1.6).

### 1.4 Activar Storage
1. **Compilación → Storage → Comenzar**. Misma ubicación que Firestore.

### 1.5 Registrar la app web y copiar la configuración
1. En la página principal del proyecto (icono ⚙️ → **Configuración del proyecto**), baja hasta "Tus apps" y pulsa el icono **</>** (Web).
2. Ponle un apodo (p. ej. "Nexus web") y **no** marques Firebase Hosting (usamos GitHub Pages).
3. Copia el objeto `firebaseConfig` que te muestra.
4. Pégalo en [`js/firebase-config.js`](js/firebase-config.js), sustituyendo los valores `TU_...`.

Estos valores no son secretos — están pensados para ir en código público, así que no pasa nada por subirlos a GitHub. Lo que de verdad protege los datos son las reglas de seguridad del siguiente paso.

### 1.6 Publicar las reglas de seguridad
Puedes hacerlo desde la consola sin instalar nada:
1. **Firestore Database → Reglas** → pega el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.
2. **Storage → Reglas** → pega el contenido de [`storage.rules`](storage.rules) → **Publicar**.

(Si en el futuro prefieres el CLI de Firebase: `firebase deploy --only firestore:rules,storage:rules`.)

### 1.7 Probar en local
Los navegadores bloquean algunas cosas de Firebase Auth si abres `index.html` haciendo doble clic (protocolo `file://`). Levanta un servidor local sencillo desde la carpeta del proyecto:

```bash
# Python (ya viene instalado en Mac/Linux)
python3 -m http.server 8000

# o con Node
npx serve .
```

Y abre `http://localhost:8000`.

### 1.8 Subir a GitHub y activar GitHub Pages
1. Crea un repositorio nuevo (puede ser público: el código de la app no expone datos, solo Firebase con sus propias reglas los protege).
2. Sube el contenido de esta carpeta a la raíz del repo.
3. **Settings → Pages → Source: Deploy from a branch → main /(root)**.
4. En un par de minutos tendrás la URL pública (algo como `https://tu-usuario.github.io/tu-repo/`).

---

## 2. Primer uso

La **primera persona que se registre** desde la pantalla de "Crear cuenta" se convierte automáticamente en **administradora** del equipo (lo gestiona `meta/bootstrap`, ver `firestore.rules`). El resto de compañeros que se registren después quedarán como **miembro**. Un admin puede ascender a otra persona editando manualmente su documento en `users/{uid}` desde la consola de Firebase (cambiar `role` a `"admin"`) mientras construimos una pantalla para hacerlo desde la app.

### Restringir quién puede registrarse (recomendado para uso real)
Por defecto, cualquiera con el enlace puede crear una cuenta. Para limitarlo a los correos de tu empresa:
1. Firestore Database → colección `meta` → documento `config` (créalo si no existe).
2. Añade el campo `allowedEmailDomains` como **array** con tu dominio, p. ej. `["martechcorp.com"]`.

---

## 3. Estructura del proyecto

```
index.html                 Pantalla de login/registro + estructura de la app
css/styles.css              Todo el diseño (identidad Martech: gris/antracita/dorado)
assets/                     Logo e íconos de Martech Corporation
js/
  firebase-config.js        ← AQUÍ pegas tu configuración de Firebase
  firebase-init.js           Inicializa Firebase (auth, db, storage)
  auth.js                    Registro / inicio de sesión / roles
  utils.js                   Fechas, avatares, notificaciones, helpers
  data/
    projects.js               CRUD de proyectos
    tasks.js                   CRUD de tareas
    comments.js                 Comentarios de una tarea
  components/
    sidebar.js                  Lista de proyectos + usuario
    topbar.js                    Selector de vista + nueva tarea
    project-modal.js             Crear proyecto
    task-modal.js                 Panel completo de una tarea
  views/
    list-view.js                  Vista de Lista
    board-view.js                  Vista de Tablero (Kanban con drag & drop)
  app.js                     Conecta todo: sesión, estado, enrutado simple
firestore.rules             Reglas de seguridad de Firestore
storage.rules                Reglas de seguridad de Storage
```

## 4. Modelo de datos (Firestore)

- **`users/{uid}`** — `name`, `email`, `role` (`admin` | `miembro`)
- **`projects/{id}`** — `name`, `description`, `color`, `sections[]` (columnas del tablero), `memberIds[]`, `createdBy`
- **`tasks/{id}`** — `projectId`, `sectionId`, `title`, `description`, `assigneeIds[]`, `startDate`, `dueDate`, `priority`, `tags[]`, `dependsOn[]` (bloqueada por), `subtasks[]`, `attachments[]`, `isComplete`, `order`
- **`tasks/{id}/comments/{id}`** — `authorId`, `authorName`, `text`

## 5. Qué falta (Fase 2, próxima iteración)

- Vista de Calendario y Línea de tiempo/Gantt
- Filtros avanzados, vistas guardadas y búsqueda global
- Notificaciones dentro de la app
- Panel con métricas (completadas, vencidas, carga por persona)
- Campos personalizados
- Automatizaciones, formularios de solicitud, revisión de archivos, metas/OKRs, integraciones
- Pantalla de administración de equipo (ascender/quitar personas, gestionar `allowedEmailDomains` desde la interfaz)

## 6. Limitaciones conocidas de esta primera versión

- La primera vez que Firestore ejecute algunas consultas puede mostrarte en la consola un enlace para crear un índice compuesto — es normal, solo hay que pulsarlo una vez.
- El orden de tareas al arrastrar en el tablero usa valores numéricos intermedios; tras miles de reordenaciones en la misma columna convendría "renormalizar" los números (no es un problema a la escala de un departamento).
- No hay límite de tamaño en `dependsOn` para evitar dependencias circulares — con un equipo pequeño el riesgo es bajo, pero es algo a vigilar si esta función se usa mucho.
