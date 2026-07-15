# Nexus — Gestor de tareas del equipo

Gestor de tareas multiusuario con Kanban, lista, calendario con hitos, vista
personal "Mis tareas", subtareas, dependencias, comentarios y enlaces
adjuntos. Es un sitio 100% estático (HTML/CSS/JS, sin paso de compilación)
pensado para vivir en GitHub Pages, con Firebase como base de datos
compartida en tiempo real.

Puedes cambiar el nombre "Nexus" por el que prefieras: aparece en
`index.html` (título de la pestaña y pantalla de login) y en
`js/components/sidebar.js`.

**Identidad visual:** los colores (gris pizarra #78848C, antracita #3C3C3C
y el dorado #FCD000 como acento) y el logotipo salen directamente de los
archivos de marca de Martech Corporation, en `assets/`. Si el dorado no es
exactamente el tono que usáis en marketing, es el único valor que habría
que ajustar — está centralizado en `--color-signal` dentro de
`css/styles.css`.

**Modelo de acceso:** todo el equipo ve todos los proyectos y tareas — no
hay proyectos privados entre compañeros. Cualquier persona con cuenta
puede crear proyectos, crear/editar tareas y asignárselas a quien quiera;
solo borrar un proyecto o tarea queda limitado a quien lo creó o a un
admin. Es el modelo pensado para un departamento pequeño donde todos
necesitan verse el trabajo entre sí.

---

## 1. Puesta en marcha (una sola vez)

### 1.1 Crear el proyecto de Firebase
1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y pulsa **Crear proyecto**.
2. Dale un nombre y termina el asistente. El plan gratuito **Spark** es suficiente para un equipo de 6-15 personas — no hace falta dar tarjeta ni pasar a Blaze para nada de lo que usa esta app.

### 1.2 Activar Authentication
1. En el menú lateral: **Compilación → Authentication → Comenzar**.
2. En la pestaña **Sign-in method**, activa **Correo electrónico/contraseña**.

### 1.3 Activar Firestore Database
1. **Compilación → Firestore Database → Crear base de datos**.
2. Elige una ubicación (por ejemplo `eur3 (europe-west)` si tu equipo está en España/Europa) y empieza en **modo producción** (ya tenemos reglas propias, ver 1.5).

No hace falta activar **Storage**: los archivos adjuntos de las tareas son enlaces (a Drive, OneDrive, un servidor propio, etc.), no subidas de archivo, precisamente para no depender del plan de pago **Blaze** que Firebase exige para Storage.

### 1.4 Registrar la app web y copiar la configuración
1. En la página principal del proyecto (icono ⚙️ → **Configuración del proyecto**), baja hasta "Tus apps" y pulsa el icono **</>** (Web).
2. Ponle un apodo y **no** marques Firebase Hosting (usamos GitHub Pages).
3. Copia el objeto `firebaseConfig` que te muestra y pégalo en [`js/firebase-config.js`](js/firebase-config.js).

Estos valores no son secretos — están pensados para ir en código público, así que no pasa nada por subirlos a GitHub. Lo que de verdad protege los datos son las reglas de seguridad del siguiente paso.

### 1.5 Publicar las reglas de seguridad
**Firestore Database → Reglas** → pega el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.

Cada vez que te pase una versión nueva de este proyecto y el archivo `firestore.rules` haya cambiado, hay que repetir este paso — copiar el archivo no actualiza las reglas ya publicadas en tu proyecto de Firebase, solo lo hace pegarlas de nuevo en la consola.

(Si en el futuro prefieres el CLI de Firebase: `firebase deploy --only firestore:rules`.)

### 1.6 Probar en local
Los navegadores bloquean algunas cosas de Firebase Auth si abres `index.html` haciendo doble clic (protocolo `file://`). Levanta un servidor local sencillo desde la carpeta del proyecto:

```bash
# Python (ya viene instalado en Mac/Linux)
python3 -m http.server 8000

# o con Node
npx serve .
```

Y abre `http://localhost:8000`.

### 1.7 Subir a GitHub y activar GitHub Pages
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
  firebase-init.js           Inicializa Firebase (auth, db)
  auth.js                    Registro / inicio de sesión / roles
  utils.js                   Fechas, avatares, notificaciones, helpers
  data/
    projects.js               CRUD de proyectos
    tasks.js                   CRUD de tareas (incluye "mis tareas" entre proyectos)
    comments.js                 Comentarios de una tarea
  components/
    sidebar.js                  Proyectos + Mis tareas + usuario
    topbar.js                    Selector de vista + nueva tarea
    project-modal.js             Crear proyecto
    quick-add-task-modal.js       Alta rápida de tarea (título + sección + botón Añadir)
    task-modal.js                 Panel completo de una tarea
  views/
    list-view.js                  Vista de Lista
    board-view.js                  Vista de Tablero (Kanban con drag & drop)
    calendar-view.js                Vista de Calendario (con hitos)
    my-tasks-view.js                 Vista "Mis tareas" (todas tus tareas, cualquier proyecto)
  app.js                     Conecta todo: sesión, estado, enrutado simple
firestore.rules             Reglas de seguridad de Firestore
```

## 4. Modelo de datos (Firestore)

- **`users/{uid}`** — `name`, `email`, `role` (`admin` | `miembro`)
- **`projects/{id}`** — `name`, `description`, `color`, `sections[]` (columnas del tablero), `memberIds[]` (informativo), `createdBy`
- **`tasks/{id}`** — `projectId`, `sectionId`, `title`, `description`, `assigneeIds[]`, `startDate`, `dueDate`, `priority`, `tags[]`, `dependsOn[]` (bloqueada por), `subtasks[]`, `attachments[]` (`{id,name,url}`), `isComplete`, `isMilestone`, `order`
- **`tasks/{id}/comments/{id}`** — `authorId`, `authorName`, `text`

## 5. Qué falta (próxima iteración)

- Línea de tiempo/Gantt
- Filtros avanzados, vistas guardadas y búsqueda global
- Notificaciones dentro de la app
- Panel con métricas (completadas, vencidas, carga por persona)
- Campos personalizados (el dato ya existe en el modelo, falta la interfaz)
- Automatizaciones, formularios de solicitud, revisión de archivos, metas/OKRs, integraciones
- Pantalla de administración de equipo (ascender/quitar personas, gestionar `allowedEmailDomains` desde la interfaz, gestionar miembros por proyecto si en algún momento hiciera falta volver a un modelo con proyectos privados)

## 6. Limitaciones conocidas de esta primera versión

- La primera vez que Firestore ejecute algunas consultas puede mostrarte en la consola un enlace para crear un índice compuesto — es normal, solo hay que pulsarlo una vez.
- El orden de tareas al arrastrar en el tablero usa valores numéricos intermedios; tras miles de reordenaciones en la misma columna convendría "renormalizar" los números (no es un problema a la escala de un departamento).
- Al abrir una tarea desde "Mis tareas" que pertenece a un proyecto distinto al que tienes seleccionado, el selector de "bloqueada por" solo lista las tareas de ese proyecto que también tienes asignadas a ti, no todas — es una limitación menor de esta iteración, no de las reglas de acceso.
