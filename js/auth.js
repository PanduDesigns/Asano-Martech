// ============================================================================
// Autenticación: registro, inicio de sesión y perfil del usuario en Firestore.
//
// Reparto de roles: el primer documento que se crea en `users` se convierte
// en "admin" (se controla con el documento centinela meta/bootstrap, ver
// firestore.rules). El resto de personas que se registran quedan como
// "miembro". Un admin puede ascender a otras personas más adelante editando
// su documento en users/{uid} desde la consola de Firebase, o desde la
// pantalla de equipo cuando la construyamos.
// ============================================================================
import { auth, db } from "./firebase-init.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/**
 * Da de alta una cuenta nueva y crea su perfil en Firestore.
 * Lanza un Error con un mensaje en español listo para mostrar si algo falla.
 */
export async function signUp({ name, email, password }) {
  await checkAllowedDomain(email);

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (e) {
    throw new Error(translateAuthError(e));
  }

  await updateProfile(cred.user, { displayName: name });

  // ¿Es la primera persona en registrarse? Si el documento centinela no
  // existe todavía, intentamos crearlo: quien lo consiga se convierte en
  // admin. Las reglas de Firestore son las que realmente hacen cumplir esto.
  const bootstrapRef = doc(db, "meta", "bootstrap");
  let role = "miembro";
  const bootstrapSnap = await getDoc(bootstrapRef);
  if (!bootstrapSnap.exists()) {
    try {
      await setDoc(bootstrapRef, {
        createdAt: serverTimestamp(),
        firstAdminUid: cred.user.uid,
      });
      role = "admin";
    } catch (e) {
      // Alguien se adelantó por una fracción de segundo: seguimos como miembro.
      role = "miembro";
    }
  }

  await setDoc(doc(db, "users", cred.user.uid), {
    name,
    email,
    role,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export async function logIn({ email, password }) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (e) {
    throw new Error(translateAuthError(e));
  }
}

export function logOut() {
  return signOut(auth);
}

async function checkAllowedDomain(email) {
  const configSnap = await getDoc(doc(db, "meta", "config"));
  const allowed = configSnap.exists() ? (configSnap.data().allowedEmailDomains || []) : [];
  if (allowed.length === 0) return; // sin restricción configurada
  const domain = (email.split("@")[1] || "").toLowerCase();
  if (!allowed.includes(domain)) {
    throw new Error(`Solo se admiten correos de: ${allowed.join(", ")}`);
  }
}

/**
 * Se suscribe al estado de sesión. `callback` recibe:
 *  - null si no hay nadie autenticado
 *  - { uid, email, name, role, ... } con el perfil de Firestore si hay sesión
 * Devuelve una función para cancelar la suscripción.
 */
export function onAuthChange(callback) {
  let unsubProfile = null;
  const unsubAuth = onAuthStateChanged(auth, (user) => {
    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    if (!user) {
      callback(null);
      return;
    }
    unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) {
        callback({ uid: user.uid, email: user.email, name: user.displayName || user.email, role: "miembro" });
        return;
      }
      callback({ uid: user.uid, ...snap.data() });
    });
  });
  return () => { unsubAuth(); if (unsubProfile) unsubProfile(); };
}

function translateAuthError(e) {
  const code = e && e.code ? e.code : "";
  const map = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/invalid-email": "El correo no parece válido.",
    "auth/weak-password": "La contraseña necesita al menos 6 caracteres.",
    "auth/user-not-found": "No hay ninguna cuenta con ese correo.",
    "auth/wrong-password": "La contraseña no es correcta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento y vuelve a intentarlo.",
  };
  return map[code] || (e && e.message) || "Ha ocurrido un error inesperado.";
}
