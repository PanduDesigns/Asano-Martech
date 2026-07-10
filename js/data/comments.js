// ============================================================================
// Acceso a datos: comentarios (subcolección de cada tarea).
// ============================================================================
import { db } from "../firebase-init.js";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

export function addComment(taskId, { authorId, authorName, text }) {
  return addDoc(collection(db, "tasks", taskId, "comments"), {
    authorId,
    authorName,
    text,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToComments(taskId, callback) {
  return onSnapshot(collection(db, "tasks", taskId, "comments"), (snap) => {
    const comments = [];
    snap.forEach((d) => comments.push({ id: d.id, ...d.data() }));
    comments.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    callback(comments);
  });
}
