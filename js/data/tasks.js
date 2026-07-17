// ============================================================================
// Acceso a datos: tareas.
//
// Tareas personales: si `projectId` es null, es una tarea privada de una
// sola persona (recordatorio en "Mis tareas"), marcada con `ownerId`. Se
// guarda en la misma colección para reutilizar toda la lógica de fechas,
// prioridad, subtareas, etc. — las reglas de Firestore son las que hacen
// que solo su dueña/o pueda verla.
//
// Nota sobre orden: no usamos orderBy() en la consulta de Firestore a
// propósito, para no depender de un índice compuesto. El orden (por
// sección/columna y por prioridad) se calcula en el cliente, en las vistas.
// ============================================================================
import { db } from "../firebase-init.js";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

export async function createTask(projectId, data) {
  const ref = await addDoc(collection(db, "tasks"), {
    projectId: projectId || null,
    ownerId: data.ownerId || null,
    sectionId: data.sectionId || null,
    title: data.title,
    description: data.description || "",
    assigneeIds: data.assigneeIds || [],
    dueDate: data.dueDate || null,
    startDate: data.startDate || null,
    priority: data.priority || "media",
    tags: data.tags || [],
    dependsOn: data.dependsOn || [],
    subtasks: data.subtasks || [],
    attachments: data.attachments || [],
    customFields: data.customFields || {},
    isComplete: data.isComplete || false,
    isMilestone: data.isMilestone || false,
    completedAt: null,
    order: data.order ?? Date.now(),
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Copia una tarea existente (sin comentarios, sin marcar como completada). */
export async function duplicateTask(task) {
  return createTask(task.projectId, {
    ownerId: task.ownerId,
    sectionId: task.sectionId,
    title: `${task.title} (copia)`,
    description: task.description,
    assigneeIds: task.assigneeIds,
    dueDate: task.dueDate,
    startDate: task.startDate,
    priority: task.priority,
    tags: task.tags,
    dependsOn: [],
    subtasks: (task.subtasks || []).map((s) => ({ ...s, done: false })),
    attachments: task.attachments,
    isMilestone: task.isMilestone,
    createdBy: task.createdBy,
    order: Date.now(),
  });
}

export function updateTask(taskId, data) {
  return updateDoc(doc(db, "tasks", taskId), { ...data, updatedAt: serverTimestamp() });
}

export function deleteTask(taskId) {
  return deleteDoc(doc(db, "tasks", taskId));
}

export function toggleTaskComplete(taskId, isComplete) {
  return updateDoc(doc(db, "tasks", taskId), {
    isComplete,
    completedAt: isComplete ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

/** Cambia una tarea de sección/columna (drag & drop en el tablero). */
export function moveTask(taskId, sectionId, order) {
  return updateDoc(doc(db, "tasks", taskId), { sectionId, order, updatedAt: serverTimestamp() });
}

/** Lectura única (no en tiempo real) — usada al abrir el modal para editar. */
export async function getTask(taskId) {
  const snap = await getDoc(doc(db, "tasks", taskId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeToProjectTasks(projectId, callback) {
  const q = query(collection(db, "tasks"), where("projectId", "==", projectId));
  return onSnapshot(
    q,
    (snap) => {
      const tasks = [];
      snap.forEach((d) => tasks.push({ id: d.id, ...d.data() }));
      callback(tasks);
    },
    (err) => console.error("subscribeToProjectTasks:", err)
  );
}

export function subscribeToTask(taskId, callback) {
  return onSnapshot(doc(db, "tasks", taskId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

/**
 * Tareas asignadas a `uid` en cualquier proyecto, MÁS sus tareas
 * personales (que también llevan su propio uid en assigneeIds) — por eso
 * un solo listener sirve para toda la vista "Mis tareas".
 */
export function subscribeToMyTasks(uid, callback) {
  const q = query(collection(db, "tasks"), where("assigneeIds", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => {
      const tasks = [];
      snap.forEach((d) => tasks.push({ id: d.id, ...d.data() }));
      callback(tasks);
    },
    (err) => console.error("subscribeToMyTasks:", err)
  );
}
