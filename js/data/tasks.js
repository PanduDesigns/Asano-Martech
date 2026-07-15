// ============================================================================
// Acceso a datos: tareas.
//
// Nota sobre orden: no usamos orderBy() en la consulta de Firestore a
// propósito, para no depender de un índice compuesto. El orden (por
// sección/columna y por prioridad) se calcula en el cliente, en las vistas.
// ============================================================================
import { db } from "../firebase-init.js";
import {
  collection,
  doc,
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
    projectId,
    sectionId: data.sectionId,
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
    isComplete: false,
    isMilestone: data.isMilestone || false,
    completedAt: null,
    order: data.order ?? Date.now(),
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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

/** Todas las tareas asignadas a `uid`, en cualquier proyecto (vista "Mis tareas"). */
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
