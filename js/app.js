// ============================================================================
// Orquestador principal: maneja el estado de sesión, la selección de
// proyecto/vista, y conecta los componentes con los datos de Firestore.
// ============================================================================
import { onAuthChange, signUp, logIn, logOut } from "./auth.js";
import { createProject, subscribeToAllProjects, subscribeToProject, subscribeToAllUsers } from "./data/projects.js";
import { createTask, subscribeToProjectTasks, subscribeToMyTasks } from "./data/tasks.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderTopbar } from "./components/topbar.js";
import { renderListView } from "./views/list-view.js";
import { renderBoardView } from "./views/board-view.js";
import { renderCalendarView } from "./views/calendar-view.js";
import { renderMyTasksView } from "./views/my-tasks-view.js";
import { openProjectModal } from "./components/project-modal.js";
import { openTaskModal } from "./components/task-modal.js";
import { openQuickAddTaskModal } from "./components/quick-add-task-modal.js";
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
let currentProjectId = null;
let currentProject = null;
let currentTasks = [];
let currentView = "list";
let mode = "project"; // 'project' | 'mytasks'
let calendarViewDate = new Date();

let unsubProjects = null;
let unsubUsers = null;
let unsubMyTasks = null;
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
  [unsubProjects, unsubUsers, unsubMyTasks, unsubCurrentProject, unsubCurrentTasks].forEach((fn) => fn && fn());
  unsubProjects = unsubUsers = unsubMyTasks = unsubCurrentProject = unsubCurrentTasks = null;
  projects = []; teamMembers = []; myTasks = [];
  currentProjectId = null; currentProject = null; currentTasks = []; mode = "project";
}

function bootstrap() {
  if (unsubUsers) unsubUsers();
  unsubUsers = subscribeToAllUsers((users) => { teamMembers = users; renderShell(); });

  if (unsubMyTasks) unsubMyTasks();
  unsubMyTasks = subscribeToMyTasks(currentUser.uid, (tasks) => { myTasks = tasks; renderShell(); });

  if (unsubProjects) unsubProjects();
  unsubProjects = subscribeToAllProjects((allProjects) => {
    projects = allProjects;
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

function renderShell() {
  if (!currentUser) return;

  renderSidebar(sidebarEl, {
    projects,
    currentProjectId: mode === "project" ? currentProjectId : null,
    isMyTasksActive: mode === "mytasks",
    myTasksCount: myTasks.filter((t) => !t.isComplete).length,
    userProfile: currentUser,
    onSelectProject: (id) => { selectProject(id); sidebarEl.classList.remove("is-open"); },
    onSelectMyTasks: () => { selectMyTasks(); sidebarEl.classList.remove("is-open"); },
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
      </div>`;
    renderMyTasksView(mainContentEl, { tasks: myTasks, teamMembers, projects, onOpenTask: openTask });
    return;
  }

  if (!currentProject) {
    topbarEl.innerHTML = "";
    mainContentEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__eyebrow">— SIN PROYECTO —</span>
        <h2>${projects.length ? "Selecciona un proyecto" : "Crea tu primer proyecto"}</h2>
        <p>Los proyectos organizan las tareas de tu equipo en secciones. Puedes verlas en lista, tablero o calendario.</p>
      </div>`;
    return;
  }

  renderTopbar(topbarEl, {
    project: currentProject,
    taskCount: currentTasks.length,
    currentView,
    onViewChange: (v) => { currentView = v; renderMain(); },
    onNewTask: () => openQuickAdd(currentProject.sections[0]?.id),
    onToggleSidebar: () => sidebarEl.classList.toggle("is-open"),
  });

  renderMain();
}

function renderMain() {
  if (mode !== "project" || !currentProject) return;
  if (currentView === "board") {
    renderBoardView(mainContentEl, { project: currentProject, tasks: currentTasks, teamMembers, onOpenTask: openTask, onAddTask: openQuickAdd });
  } else if (currentView === "calendar") {
    renderCalendarView(mainContentEl, {
      tasks: currentTasks,
      viewDate: calendarViewDate,
      onOpenTask: openTask,
      onAddTaskOnDate: (dateKey) => openQuickAdd(currentProject.sections[0]?.id, dateKey),
      onMonthChange: (d) => { calendarViewDate = d; renderMain(); },
    });
  } else {
    renderListView(mainContentEl, { project: currentProject, tasks: currentTasks, teamMembers, onOpenTask: openTask, onAddTask: openQuickAdd });
  }
}

function openQuickAdd(sectionId, presetDueDate) {
  if (!currentProject) return;
  openQuickAddTaskModal({
    project: currentProject,
    defaultSectionId: sectionId,
    presetDueDate,
    onCreate: async ({ title, sectionId: chosenSection, dueDate }) => {
      try {
        await createTask(currentProject.id, {
          sectionId: chosenSection,
          title,
          dueDate: dueDate || null,
          createdBy: currentUser.uid,
          order: Date.now(),
        });
      } catch (e) {
        console.error(e);
        showToast("No se pudo crear la tarea.", "error");
      }
    },
  });
}

function openTask(taskId) {
  // La tarea puede venir de "Mis tareas" (de un proyecto distinto al
  // actualmente seleccionado), así que buscamos su proyecto real entre los
  // que ya tenemos cargados para poder mostrar sus secciones. El listado de
  // "bloqueada por" se limita a las tareas de ese proyecto que ya tenemos
  // en memoria (todas, si estás dentro del proyecto; solo las tuyas, si
  // abres la tarea desde "Mis tareas").
  const pool = mode === "mytasks" ? myTasks : currentTasks;
  const task = pool.find((t) => t.id === taskId);
  const taskProject = (task && projects.find((p) => p.id === task.projectId)) || currentProject;
  const relatedTasks = pool.filter((t) => t.projectId === taskProject?.id);

  openTaskModal({
    taskId,
    project: taskProject,
    teamMembers,
    allProjectTasks: relatedTasks,
    currentUserProfile: currentUser,
    onClosed: () => {},
    onDeleted: () => showToast("Tarea eliminada."),
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
