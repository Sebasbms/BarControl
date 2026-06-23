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
    
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().rol;
                applyRoleRestrictions();
            }
        } catch (error) {
            console.log("Aún no se configuran roles en la BD, acceso base concedido.");
        }

        // Si está logueado y está en la raíz, index o login, mandarlo al dashboard
        if (currentPath.includes('login.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // Si NO está logueado, y NO está ya en la página de login, lo mandamos a login
        if (!currentPath.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
});

// El truco del Login con Usuario
window.login = async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    // Configurado con el dominio de tu base de datos
    const fakeEmail = `${username}@fogon.com`;
    
    try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
    } catch (error) {
        alert("Usuario o contraseña incorrectos.");
        console.error(error);
    }
};

window.logout = async () => {
    await signOut(auth);
};

function applyRoleRestrictions() {
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    if (currentUserRole === 'Cajero' || currentUserRole === 'Barra') {
        adminOnlyElements.forEach(el => el.style.display = 'none');
    }
}
