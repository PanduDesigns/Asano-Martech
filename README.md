# Asano — Gestor de tareas del equipo

Gestor de tareas multiusuario con Kanban, lista, calendario con hitos,
vista personal "Mis tareas" (con recordatorios privados), etiquetas de
color, subtareas, dependencias, comentarios y enlaces adjuntos. Sitio
100% estático (HTML/CSS/JS, sin paso de compilación) pensado para vivir
en GitHub Pages, con Firebase como base de datos compartida en tiempo real.

Puedes cambiar el nombre "Asano" por el que prefieras: aparece en
`index.html` (título de la pestaña y pantalla de login) y en
`js/components/sidebar.js`.

**Identidad visual:** los colores (gris pizarra #78848C, antracita #3C3C3C
y el dorado #FCD000 como acento) y el logotipo salen directamente de los
archivos de marca de Martech Corporation, en `assets/`.

**Modelo de acceso:** todo el equipo ve todos los proyectos y tareas de
proyecto — no hay privacidad entre compañeros ahí. La única excepción son
las tareas **personales** de "Mis tareas" (recordatorios propios sin
proyecto), que solo ve quien las creó. Cualquiera puede crear proyectos y
tareas; borrar un proyecto (y sus tareas) o una tarea de otra persona está
limitado a quien lo creó o a un admin.

---

## 1. Puesta en marcha (una sola vez)

### 1.1 Crear el proyecto de Firebase
1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y pulsa **Crear proyecto**.
2. El plan gratuito **Spark** es suficiente — no hace falta pasar a Blaze para nada de lo que usa esta app (los adjuntos son enlaces, no subidas de archivo).

### 1.2 Activar Authentication
**Compilación → Authentication → Comenzar** → pestaña **Sign-in method** → activa **Correo electrónico/contraseña**.

### 1.3 Activar Firestore Database
**Compilación → Firestore Database → Crear base de datos** → modo producción (ya tenemos reglas propias).

### 1.4 Registrar la app web y copiar la configuración
⚙️ **Configuración del proyecto** → "Tus apps" → icono **</>** (Web) → copia `firebaseConfig` en [`js/firebase-config.js`](js/firebase-config.js). No son datos secretos, puedes subirlos a GitHub sin problema.

### 1.5 Publicar las reglas de seguridad
**Firestore Database → Reglas** → pega el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.

Cada vez que este archivo cambie entre una versión y otra del proyecto, hay que repetir este paso — subir el archivo nuevo no actualiza lo ya publicado en tu proyecto de Firebase, solo pegarlo de nuevo en la consola lo hace.

### 1.6 Probar en local
```bash
python3 -m http.server 8000
```
Y abre `http://localhost:8000` (Firebase Auth necesita `http://`, no sirve abrir el archivo con doble clic).

### 1.7 Subir a GitHub y activar GitHub Pages
Sube el contenido de esta carpeta a un repositorio y activa **Settings → Pages → Deploy from a branch → main /(root)**.

---

## 2. Primer uso

La **primera persona que se registre** se convierte automáticamente en **administradora**. El resto queda como **miembro**. Un admin puede ascender a otra persona editando su documento en `users/{uid}` desde la consola de Firebase (`role` → `"admin"`).

Para restringir quién puede registrarse a los correos de tu empresa: Firestore → colección `meta` → documento `config` → campo `allowedEmailDomains` (array), p. ej. `["martechcorp.com"]`.

---

## 3. Cómo funciona lo nuevo de esta versión

### Una sola ventana para crear y editar tareas
Se ve todo el formulario de golpe (fechas, prioridad, responsables, etiquetas, subtareas, adjuntos…) tanto al crear como al editar, y **nada se guarda hasta pulsar "Aceptar"**. Si cierras sin aceptar habiendo cambiado algo, pregunta si quieres descartarlo. Los comentarios son la única excepción: se envían al momento en cuanto pulsas "Enviar", y solo están disponibles editando una tarea ya guardada (una tarea nueva todavía no tiene dónde colgarlos).

### Clic derecho para más acciones
Clic derecho sobre una tarea (en Lista, Tablero o Mis tareas): marcar completada, duplicar, convertir en hito, abrir detalles o eliminar. Clic derecho sobre un proyecto en la barra lateral: renombrar o eliminar (esto último borra también todas sus tareas y comentarios).

### Etiquetas de color
Al escribir una etiqueta en una tarea, se sugieren las que ya existen (con su color) para reutilizarlas; si escribes una nueva, puedes elegirle color desde una paleta, y se queda seleccionado ese mismo color por defecto para la siguiente etiqueta nueva que crees. El color de una etiqueta es compartido: cambiarlo afecta a todas las tareas que la llevan.

### Mis tareas: recordatorios personales
El botón "+ Tarea personal" en "Mis tareas" crea una tarea que **solo tú puedes ver** (sin proyecto, sin responsables) — para apuntes y recordatorios propios. Se distinguen con la etiqueta "🔒 Personal".

### Línea de tiempo / Gantt
Dos formas de verla: por proyecto (pestaña "Línea de tiempo" junto a Lista/Tablero/Calendario, agrupada por sección) o global para todo el departamento (botón fijo en la barra lateral, agrupada por proyecto). Una tarea con fecha de inicio y fecha límite se dibuja como una barra que cubre toda su duración; con una sola fecha, como un bloque de un día; los hitos siempre como un rombo. La línea vertical dorada marca el día de hoy.

### Calendario: duración completa, no solo el vencimiento
Igual que en la línea de tiempo, una tarea con inicio y fin se dibuja como una barra que ocupa todos los días entre medias (incluso cruzando de una semana a la siguiente), no solo un punto en la fecha límite.

### Línea de tiempo: zoom por días, semanas o meses
Botones "Días / Semanas / Meses" en la propia línea de tiempo (por proyecto y global). En semanas, cada columna muestra su número de semana ISO del año (S29, S30…).

### Filtros, incluidas etiquetas y campos personalizados
Barra de filtros encima de Lista/Tablero/Calendario/Línea de tiempo/Mis tareas: Responsable, Prioridad, Estado, Etiquetas y cualquier campo personalizado del proyecto. Se combinan entre sí y se aplican al momento, sin botón de confirmar.

**Campos personalizados** (por ejemplo "Cliente" con opciones "Talgo, Stelia, Togg"): clic derecho sobre un proyecto en la barra lateral → "Campos personalizados". Una vez creados aparecen como desplegable en cada tarea de ese proyecto y como filtro más.

### Sin parpadeo al abrir la app con sesión iniciada
Antes se veía un instante la pantalla de login incluso con la sesión ya iniciada, mientras Firebase comprobaba si había cuenta. Ahora se muestra una pantalla de carga mínima hasta saber con certeza si hay sesión o no, y solo entonces aparece la pantalla que corresponda.

---

## 4. Estructura del proyecto

```
index.html                 Pantalla de login/registro + estructura de la app
css/styles.css              Todo el diseño
assets/                     Logo e íconos de Martech Corporation
js/
  firebase-config.js        ← AQUÍ pegas tu configuración de Firebase
  firebase-init.js           Inicializa Firebase (auth, db)
  auth.js                    Registro / inicio de sesión / roles
  utils.js                   Fechas, avatares, contraste de color, helpers
  data/
    projects.js               CRUD de proyectos (incluye borrado en cascada)
    tasks.js                   CRUD de tareas (proyecto y personales)
    tags.js                     Registro compartido de etiquetas (nombre + color)
    comments.js                  Comentarios de una tarea
  components/
    sidebar.js                  Proyectos + Mis tareas + usuario (clic derecho)
    topbar.js                    Selector de vista + nueva tarea
    project-modal.js             Crear proyecto
    custom-fields-modal.js        Definir campos personalizados de un proyecto
    task-modal.js                  Formulario único de tarea (crear/editar)
    context-menu.js                Menú contextual reutilizable (clic derecho)
    filter-bar.js                   Barra de filtros reutilizable
  task-filters.js             Lógica de filtrado de tareas (compartida por todas las vistas)
  views/
    list-view.js                  Vista de Lista (+ menú contextual de tarea)
    board-view.js                  Vista de Tablero (Kanban con drag & drop)
    calendar-view.js                Vista de Calendario (barras de duración + hitos)
    timeline-view.js                 Línea de tiempo/Gantt (por proyecto o global, zoom día/semana/mes)
    my-tasks-view.js                  "Mis tareas" (de proyecto + personales)
  app.js                     Conecta todo: sesión, estado, enrutado simple
firestore.rules             Reglas de seguridad de Firestore
```

## 5. Modelo de datos (Firestore)

- **`users/{uid}`** — `name`, `email`, `role` (`admin` | `miembro`)
- **`projects/{id}`** — `name`, `description`, `color`, `sections[]`, `memberIds[]` (informativo), `customFieldDefs[]` (`{id,name,options[]}`), `createdBy`
- **`tasks/{id}`** — `projectId` (null si es personal), `ownerId` (solo tareas personales), `sectionId`, `title`, `description`, `assigneeIds[]`, `startDate`, `dueDate`, `priority`, `tags[]` (nombres; el color vive en `tags/`), `dependsOn[]`, `subtasks[]`, `attachments[]` (`{id,name,url}`), `customFields` (`{[fieldId]: valor}`), `isComplete`, `isMilestone`, `order`
- **`tasks/{id}/comments/{id}`** — `authorId`, `authorName`, `text`
- **`tags/{slug}`** — `name`, `color`

## 6. Qué falta (próxima iteración)

- Vistas guardadas (guardar una combinación de filtros con un nombre) y búsqueda global de texto
- Notificaciones dentro de la app
- Panel con métricas (completadas, vencidas, carga por persona)
- Automatizaciones, formularios de solicitud, revisión de archivos, metas/OKRs, integraciones
- Pantalla de administración de equipo
- Flechas de dependencia dibujadas en la línea de tiempo (los datos de "bloqueada por" ya existen, falta representarlos visualmente ahí)

## 7. Limitaciones conocidas

- La primera vez que Firestore ejecute algunas consultas puede mostrarte en la consola un enlace para crear un índice compuesto — es normal, solo hay que pulsarlo una vez.
- El orden de tareas al arrastrar en el tablero usa valores numéricos intermedios; a gran escala convendría "renormalizar" los números de vez en cuando (no es un problema al tamaño de un departamento).
- Al abrir una tarea desde "Mis tareas" que pertenece a un proyecto distinto al que tienes seleccionado, el selector de "bloqueada por" solo lista las tareas de ese proyecto que también tienes asignadas a ti, no todas.
- Renombrar un proyecto usa el cuadro de diálogo nativo del navegador (`prompt`), no un formulario propio — funcional pero sencillo; se puede pulir más adelante.
