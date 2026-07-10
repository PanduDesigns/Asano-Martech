// ============================================================================
// Orquestador principal: maneja el estado de sesión, la selección de
// proyecto/vista, y conecta los componentes con los datos de Firestore.
// ============================================================================
import { onAuthChange, signUp, logIn, logOut } from "./auth.js";
import { createProject, subscribeToUserProjects, subscribeToProject, subscribeToAllUsers } from "./data/projects.js";
import { createTask, subscribeToProjectTasks } from "./data/tasks.js";
import { renderSidebar } from "./components/sidebar.js";
import { renderTopbar } from "./components/topbar.js";
import { renderListView } from "./views/list-view.js";
import { renderBoardView } from "./views/board-view.js";
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
let currentProjectId = null;
let currentProject = null;
let currentTasks = [];
let currentView = "list";

let unsubProjects = null;
let unsubUsers = null;
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
  [unsubProjects, unsubUsers, unsubCurrentProject, unsubCurrentTasks].forEach((fn) => fn && fn());
  unsubProjects = unsubUsers = unsubCurrentProject = unsubCurrentTasks = null;
  projects = []; teamMembers = []; currentProjectId = null; currentProject = null; currentTasks = [];
}

function bootstrap() {
  if (unsubUsers) unsubUsers();
  unsubUsers = subscribeToAllUsers((users) => { teamMembers = users; renderShell(); });

  if (unsubProjects) unsubProjects();
  unsubProjects = subscribeToUserProjects(currentUser.uid, (userProjects) => {
    projects = userProjects;
    if (!currentProjectId && projects.length) {
      selectProject(projects[0].id);
      return;
    }
    if (currentProjectId && !projects.find((p) => p.id === currentProjectId)) {
      currentProjectId = null; currentProject = null; currentTasks = [];
    }
    renderShell();
  });
}

function selectProject(projectId) {
  if (projectId === currentProjectId) return;
  currentProjectId = projectId;
  if (unsubCurrentProject) unsubCurrentProject();
  if (unsubCurrentTasks) unsubCurrentTasks();

  unsubCurrentProject = subscribeToProject(projectId, (project) => { currentProject = project; renderShell(); });
  unsubCurrentTasks = subscribeToProjectTasks(projectId, (tasks) => { currentTasks = tasks; renderShell(); });
  renderShell();
}

function renderShell() {
  if (!currentUser) return;

  renderSidebar(sidebarEl, {
    projects,
    currentProjectId,
    userProfile: currentUser,
    onSelectProject: (id) => { selectProject(id); sidebarEl.classList.remove("is-open"); },
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

  if (!currentProject) {
    topbarEl.innerHTML = "";
    mainContentEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__eyebrow">— SIN PROYECTO —</span>
        <h2>${projects.length ? "Selecciona un proyecto" : "Crea tu primer proyecto"}</h2>
        <p>Los proyectos organizan las tareas de tu equipo en secciones. Puedes verlas en lista o en tablero.</p>
      </div>`;
    return;
  }

  renderTopbar(topbarEl, {
    project: currentProject,
    taskCount: currentTasks.length,
    currentView,
    onViewChange: (v) => { currentView = v; renderMain(); },
    onNewTask: () => quickCreateTask(currentProject.sections[0]?.id),
    onToggleSidebar: () => sidebarEl.classList.toggle("is-open"),
  });

  renderMain();
}

function renderMain() {
  if (!currentProject) return;
  const viewFn = currentView === "board" ? renderBoardView : renderListView;
  viewFn(mainContentEl, {
    project: currentProject,
    tasks: currentTasks,
    teamMembers,
    onOpenTask: openTask,
    onAddTask: quickCreateTask,
  });
}

async function quickCreateTask(sectionId) {
  const targetSection = sectionId || currentProject.sections[0]?.id;
  if (!targetSection) { showToast("Este proyecto no tiene secciones todavía.", "error"); return; }
  try {
    const id = await createTask(currentProject.id, {
      sectionId: targetSection,
      title: "Nueva tarea",
      createdBy: currentUser.uid,
      order: Date.now(),
    });
    openTask(id);
  } catch (e) {
    console.error(e);
    showToast("No se pudo crear la tarea.", "error");
  }
}

function openTask(taskId) {
  openTaskModal({
    taskId,
    project: currentProject,
    teamMembers,
    allProjectTasks: currentTasks,
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
