// ============================================================================
// Orquestador principal: maneja el estado de sesión, la selección de
// proyecto/vista, y conecta los componentes con los datos de Firestore.
// ============================================================================
import { onAuthChange, signUp, logIn, logOut } from "./auth.js";
import { createProject, subscribeToAllProjects, subscribeToProject, subscribeToAllUsers } from "./data/projects.js";
import { subscribeToProjectTasks, subscribeToMyTasks } from "./data/tasks.js";
import { subscribeToAllTags } from "./data/tags.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderTopbar } from "./components/topbar.js";
import { renderListView } from "./views/list-view.js";
import { renderBoardView } from "./views/board-view.js";
import { renderCalendarView } from "./views/calendar-view.js";
import { renderTimelineView } from "./views/timeline-view.js";
import { renderMyTasksView } from "./views/my-tasks-view.js";
import { openProjectModal } from "./components/project-modal.js";
import { openTaskModal } from "./components/task-modal.js";
import { showToast } from "./utils.js";

const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const sidebarEl = document.getElementById("sidebar");
const topbarEl = document.getElementById("topbar");
const mainContentEl = document.getElementById("main-content");

// ---- estado en memoria ----
let currentUser = null;
let projects = [];
let teamMembers = [];
let myTasks = [];
let tagsRegistry = [];
let currentProjectId = null;
let currentProject = null;
let currentTasks = [];
let currentView = "list";
let mode = "project"; // 'project' | 'mytasks' | 'timeline'
let calendarViewDate = new Date();
let globalTasksByProject = {}; // { [projectId]: tasks[] } — para la línea de tiempo global
let unsubGlobalTasks = {}; // { [projectId]: unsubscribeFn }

let unsubProjects = null;
let unsubUsers = null;
let unsubMyTasks = null;
let unsubTags = null;
let unsubCurrentProject = null;
let unsubCurrentTasks = null;

function showApp() { authScreen.classList.add("hidden"); appShell.classList.remove("hidden"); }
function showAuth() { appShell.classList.add("hidden"); authScreen.classList.remove("hidden"); }

onAuthChange((profile) => {
  currentUser = profile;
  if (!profile) {
    cleanup();
    showAuth();
    return;
  }
  showApp();
  bootstrap();
});

function cleanup() {
  [unsubProjects, unsubUsers, unsubMyTasks, unsubTags, unsubCurrentProject, unsubCurrentTasks].forEach((fn) => fn && fn());
  Object.values(unsubGlobalTasks).forEach((fn) => fn && fn());
  unsubProjects = unsubUsers = unsubMyTasks = unsubTags = unsubCurrentProject = unsubCurrentTasks = null;
  unsubGlobalTasks = {}; globalTasksByProject = {};
  projects = []; teamMembers = []; myTasks = []; tagsRegistry = [];
  currentProjectId = null; currentProject = null; currentTasks = []; mode = "project";
}

function bootstrap() {
  if (unsubUsers) unsubUsers();
  unsubUsers = subscribeToAllUsers((users) => { teamMembers = users; renderShell(); });

  if (unsubTags) unsubTags();
  unsubTags = subscribeToAllTags((tags) => { tagsRegistry = tags; renderShell(); });

  if (unsubMyTasks) unsubMyTasks();
  unsubMyTasks = subscribeToMyTasks(currentUser.uid, (tasks) => { myTasks = tasks; renderShell(); });

  if (unsubProjects) unsubProjects();
  unsubProjects = subscribeToAllProjects((allProjects) => {
    projects = allProjects;
    syncGlobalTimelineSubscriptions();
    if (mode === "project") {
      if (!currentProjectId && projects.length) {
        selectProject(projects[0].id);
        return;
      }
      if (currentProjectId && !projects.find((p) => p.id === currentProjectId)) {
        currentProjectId = null; currentProject = null; currentTasks = [];
      }
    }
    renderShell();
  });
}

/**
 * La línea de tiempo global necesita las tareas de TODOS los proyectos a
 * la vez. En vez de una consulta sin filtro (que las reglas de seguridad
 * rechazarían, porque no pueden garantizar de antemano que todo lo que
 * devuelva sea legible), mantenemos un listener por proyecto — a la
 * escala de un departamento no supone ningún problema, y así reutilizamos
 * exactamente las mismas reglas que ya funcionan para la vista de un solo
 * proyecto.
 */
function syncGlobalTimelineSubscriptions() {
  const currentIds = new Set(projects.map((p) => p.id));
  Object.keys(unsubGlobalTasks).forEach((id) => {
    if (!currentIds.has(id)) {
      unsubGlobalTasks[id]();
      delete unsubGlobalTasks[id];
      delete globalTasksByProject[id];
    }
  });
  projects.forEach((p) => {
    if (!unsubGlobalTasks[p.id]) {
      unsubGlobalTasks[p.id] = subscribeToProjectTasks(p.id, (tasks) => {
        globalTasksByProject[p.id] = tasks;
        if (mode === "timeline") renderShell();
      });
    }
  });
}

function selectProject(projectId) {
  mode = "project";
  if (projectId === currentProjectId) { renderShell(); return; }
  currentProjectId = projectId;
  if (unsubCurrentProject) unsubCurrentProject();
  if (unsubCurrentTasks) unsubCurrentTasks();

  unsubCurrentProject = subscribeToProject(projectId, (project) => { currentProject = project; renderShell(); });
  unsubCurrentTasks = subscribeToProjectTasks(projectId, (tasks) => { currentTasks = tasks; renderShell(); });
  renderShell();
}

function selectMyTasks() {
  mode = "mytasks";
  renderShell();
}

function selectTimeline() {
  mode = "timeline";
  renderShell();
}

function renderShell() {
  if (!currentUser) return;

  renderSidebar(sidebarEl, {
    projects,
    currentProjectId: mode === "project" ? currentProjectId : null,
    isMyTasksActive: mode === "mytasks",
    isTimelineActive: mode === "timeline",
    myTasksCount: myTasks.filter((t) => !t.isComplete).length,
    userProfile: currentUser,
    onSelectProject: (id) => { selectProject(id); sidebarEl.classList.remove("is-open"); },
    onSelectMyTasks: () => { selectMyTasks(); sidebarEl.classList.remove("is-open"); },
    onSelectTimeline: () => { selectTimeline(); sidebarEl.classList.remove("is-open"); },
    onCreateProject: () =>
      openProjectModal({
        onCreate: async (data) => {
          const id = await createProject({ ...data, creatorUid: currentUser.uid });
          showToast("Proyecto creado.");
          selectProject(id);
        },
      }),
    onLogout: () => logOut(),
  });

  if (mode === "mytasks") {
    topbarEl.innerHTML = `
      <div>
        <span class="topbar__title">Mis tareas</span>
        <span class="topbar__count">${myTasks.length} ${myTasks.length === 1 ? "tarea" : "tareas"}</span>
      </div>
      <button class="btn btn--primary btn--sm" id="btn-new-personal-task" style="margin-left:auto;">+ Tarea personal</button>`;
    topbarEl.querySelector("#btn-new-personal-task").addEventListener("click", openNewPersonalTask);
    renderMyTasksView(mainContentEl, { tasks: myTasks, teamMembers, projects, tagsRegistry, onOpenTask: openTask });
    return;
  }

  if (mode === "timeline") {
    const allGlobalTasks = Object.values(globalTasksByProject).flat();
    topbarEl.innerHTML = `
      <div>
        <span class="topbar__title">Línea de tiempo</span>
        <span class="topbar__count">todos los proyectos</span>
      </div>`;
    const groups = projects.map((p) => ({
      id: p.id,
      label: p.name,
      color: p.color,
      tasks: (globalTasksByProject[p.id] || []).filter((t) => !t.isComplete),
    }));
    renderTimelineView(mainContentEl, { groups, onOpenTask: openTask });
    return;
  }

  if (!currentProject) {
    topbarEl.innerHTML = "";
    mainContentEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__eyebrow">— SIN PROYECTO —</span>
        <h2>${projects.length ? "Selecciona un proyecto" : "Crea tu primer proyecto"}</h2>
        <p>Los proyectos organizan las tareas de tu equipo en secciones. Puedes verlas en lista, tablero, calendario o línea de tiempo.</p>
      </div>`;
    return;
  }

  renderTopbar(topbarEl, {
    project: currentProject,
    taskCount: currentTasks.length,
    currentView,
    onViewChange: (v) => { currentView = v; renderMain(); },
    onNewTask: () => openNewProjectTask(currentProject.sections[0]?.id),
    onToggleSidebar: () => sidebarEl.classList.toggle("is-open"),
  });

  renderMain();
}

function renderMain() {
  if (mode !== "project" || !currentProject) return;
  if (currentView === "board") {
    renderBoardView(mainContentEl, { project: currentProject, tasks: currentTasks, teamMembers, tagsRegistry, onOpenTask: openTask, onAddTask: openNewProjectTask });
  } else if (currentView === "calendar") {
    renderCalendarView(mainContentEl, {
      tasks: currentTasks,
      viewDate: calendarViewDate,
      onOpenTask: openTask,
      onAddTaskOnDate: (dateKey) => openNewProjectTask(currentProject.sections[0]?.id, dateKey),
      onMonthChange: (d) => { calendarViewDate = d; renderMain(); },
    });
  } else if (currentView === "timeline") {
    const sectionsSorted = [...currentProject.sections].sort((a, b) => a.order - b.order);
    const groups = sectionsSorted.map((s) => ({
      id: s.id,
      label: s.name,
      color: currentProject.color,
      tasks: currentTasks.filter((t) => t.sectionId === s.id),
    }));
    renderTimelineView(mainContentEl, { groups, onOpenTask: openTask });
  } else {
    renderListView(mainContentEl, { project: currentProject, tasks: currentTasks, teamMembers, tagsRegistry, onOpenTask: openTask, onAddTask: openNewProjectTask });
  }
}

function openNewProjectTask(sectionId, presetDueDate) {
  if (!currentProject) return;
  openTaskModal({
    taskId: null,
    project: currentProject,
    isPersonal: false,
    defaultSectionId: sectionId,
    presetDueDate,
    teamMembers,
    allProjectTasks: currentTasks,
    tagsRegistry,
    currentUserProfile: currentUser,
    onSaved: () => showToast("Tarea creada."),
    onClosed: () => {},
  });
}

function openNewPersonalTask() {
  openTaskModal({
    taskId: null,
    isPersonal: true,
    teamMembers,
    allProjectTasks: [],
    tagsRegistry,
    currentUserProfile: currentUser,
    onSaved: () => showToast("Recordatorio creado."),
    onClosed: () => {},
  });
}

function openTask(taskId) {
  // La tarea puede venir de "Mis tareas" o de la línea de tiempo global
  // (de un proyecto distinto al seleccionado, o ser un recordatorio
  // personal sin proyecto), así que buscamos su contexto real entre lo
  // que ya tenemos cargado.
  const pool = mode === "mytasks" ? myTasks : mode === "timeline" ? Object.values(globalTasksByProject).flat() : currentTasks;
  const task = pool.find((t) => t.id === taskId);
  const isPersonal = task ? !task.projectId : false;
  const taskProject = !isPersonal
    ? (task && projects.find((p) => p.id === task.projectId)) || currentProject
    : null;
  const relatedTasks = taskProject
    ? (mode === "timeline" ? (globalTasksByProject[taskProject.id] || []) : pool.filter((t) => t.projectId === taskProject.id))
    : [];

  openTaskModal({
    taskId,
    project: taskProject,
    isPersonal,
    teamMembers,
    allProjectTasks: relatedTasks,
    tagsRegistry,
    currentUserProfile: currentUser,
    onSaved: () => {},
    onClosed: () => {},
  });
}

// ============================================================================
// Pantalla de autenticación
// ============================================================================
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("is-active", t === tab));
    loginForm.classList.toggle("hidden", tab.dataset.tab !== "login");
    signupForm.classList.toggle("hidden", tab.dataset.tab !== "signup");
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = loginForm.querySelector("[data-error]");
  errorEl.textContent = "";
  const fd = new FormData(loginForm);
  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await logIn({ email: fd.get("email"), password: fd.get("password") });
  } catch (err) {
    errorEl.textContent = err.message;
  }
  btn.disabled = false;
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = signupForm.querySelector("[data-error]");
  errorEl.textContent = "";
  const fd = new FormData(signupForm);
  const btn = signupForm.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await signUp({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
  } catch (err) {
    errorEl.textContent = err.message;
  }
  btn.disabled = false;
});
