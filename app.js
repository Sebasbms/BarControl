import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCDUFlyIbHSUv51EtNeceJcb6maKX4vhtc",
    authDomain: "controlbarra-86844.firebaseapp.com",
    projectId: "controlbarra-86844",
    storageBucket: "controlbarra-86844.firebasestorage.app",
    messagingSenderId: "577978842483",
    appId: "1:577978842483:web:0a65062dbaff7ad716d906"
};

// App principal para el uso normal
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App secundaria EXCLUSIVA para crear usuarios sin desloguear al admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let currentUserRole = null;

// ==========================================
// VENTANAS EMERGENTES MODERNAS (Reemplaza a alert)
// ==========================================
window.showModal = (title, message) => {
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
        <div class="custom-modal">
            <h3>${title}</h3>
            <p>${message}</p>
            <button class="btn-primary" onclick="this.parentElement.parentElement.remove()" style="width: 100%;">Aceptar</button>
        </div>
    `;
    document.body.appendChild(overlay);
};

// ==========================================
// CONTROL DE SESIÓN
// ==========================================
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
            console.log("Acceso base concedido.");
        }

        if (currentPath.includes('login.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
        
        // Si estamos en la página de usuarios, cargamos la tabla
        if (currentPath.includes('usuarios.html')) {
            loadUsers();
        }
    } else {
        if (!currentPath.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
});

window.login = async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const fakeEmail = `${username}@fogon.com`;
    
    try {
        await signInWithEmailAndPassword(auth, fakeEmail, password);
    } catch (error) {
        showModal("Error", "Usuario o contraseña incorrectos.");
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

// ==========================================
// CREACIÓN DE USUARIOS DESDE LA APP
// ==========================================
window.createNewUser = async (e) => {
    e.preventDefault();
    if (currentUserRole !== 'Administrador' && currentUserRole != null) {
        showModal("Denegado", "No tienes permisos para crear usuarios.");
        return;
    }

    const username = document.getElementById('new_username').value.trim().toLowerCase();
    const password = document.getElementById('new_password').value;
    const role = document.getElementById('new_role').value;
    const fakeEmail = `${username}@fogon.com`;

    try {
        // 1. Creamos el usuario en la App Secundaria
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, fakeEmail, password);
        
        // 2. Guardamos su rol en nuestra base de datos
        await setDoc(doc(db, "usuarios", userCredential.user.uid), {
            username: username,
            rol: role,
            email: fakeEmail
        });

        // 3. Cerramos sesión de la app secundaria (tu sesión principal queda intacta)
        await signOut(secondaryAuth);

        showModal("¡Éxito!", `El usuario '${username}' fue creado correctamente como ${role}.`);
        document.getElementById('form-usuario').reset();
        loadUsers();

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showModal("Error", "Ese nombre de usuario ya existe.");
        } else {
            showModal("Error", "No se pudo crear el usuario: " + error.message);
        }
    }
};

// Cargar lista de usuarios
window.loadUsers = async () => {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;

    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        tbody.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold; color: var(--primary-color);">${data.username}</td>
                <td>${data.rol}</td>
                <td style="color: var(--text-secondary); font-size: 0.9rem;">${data.email}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3">Error cargando usuarios.</td></tr>`;
    }
};
