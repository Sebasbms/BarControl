import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCDUFlyIbHSUv51EtNeceJcb6maKX4vhtc",
    authDomain: "controlbarra-86844.firebaseapp.com",
    projectId: "controlbarra-86844",
    storageBucket: "controlbarra-86844.firebasestorage.app",
    messagingSenderId: "577978842483",
    appId: "1:577978842483:web:0a65062dbaff7ad716d906"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserRole = null;

// Control de Sesión Automático
onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath.includes('login.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html');
    
    if (user) {
        // Obtenemos el rol desde Firestore (Si aún no hay roles, asumimos admin temporalmente)
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().rol;
                applyRoleRestrictions();
            }
        } catch (error) {
            console.log("Aún no se configuran roles en la BD, acceso base concedido.");
        }

        // Si está en la pantalla de login y ya tiene sesión, lo mandamos al panel
        if (isAuthPage) window.location.href = 'dashboard.html';
    } else {
        // Si NO tiene sesión y no está en el login, lo expulsamos al login
        if (!isAuthPage) window.location.href = 'login.html';
    }
});

// El truco del Login con Usuario
window.login = async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    // Convertimos el usuario en un correo fantasma para Firebase
    const fakeEmail = `${username}@sistemabarra.com`;
    
    try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
    } catch (error) {
        alert("Usuario o contraseña incorrectos.");
        console.error(error);
    }
};

// Función para cerrar sesión
window.logout = async () => {
    await signOut(auth);
};

// Función para ocultar botones según el rol
function applyRoleRestrictions() {
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    if (currentUserRole === 'Cajero' || currentUserRole === 'Barra') {
        adminOnlyElements.forEach(el => el.style.display = 'none');
    }
}
