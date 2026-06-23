import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCDUFlyIbHSUv51EtNeceJcb6maKX4vhtc",
    authDomain: "controlbarra-86844.firebaseapp.com",
    projectId: "controlbarra-86844",
    storageBucket: "controlbarra-86844.firebasestorage.app",
    messagingSenderId: "577978842483",
    appId: "1:577978842483:web:0a65062dbaff7ad716d906"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let currentUserRole = null;
let currentUserName = "Usuario";

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

onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().rol;
                currentUserName = userDoc.data().username || "Admin";
                applyRoleRestrictions();
            }
        } catch (e) { console.log(e); }

        if (currentPath.includes('login.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
        
        if (currentPath.includes('usuarios.html')) window.loadUsers();
        if (currentPath.includes('productos.html')) {
            window.loadCategories();
            window.loadProducts();
        }
        if (currentPath.includes('ventas.html')) window.loadProductsForSale();
        if (currentPath.includes('movimientos.html') || currentPath.includes('dashboard.html')) window.loadMovements();
        if (currentPath.includes('dashboard.html')) window.loadDashboard();
    } else {
        if (!currentPath.includes('login.html')) window.location.href = 'login.html';
    }
});

window.logout = async () => { await signOut(auth); };

function applyRoleRestrictions() {
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    if (currentUserRole === 'Cajero' || currentUserRole === 'Barra') {
        adminOnlyElements.forEach(el => el.style.display = 'none');
    }
}

// ==========================================
// MÓDULO: CATEGORÍAS PERSONALIZADAS
// ==========================================
window.saveCategory = async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('new_category_name');
    const name = nameInput.value.trim();

    try {
        await addDoc(collection(db, "categorias"), { nombre: name, fecha: serverTimestamp() });
        showModal("¡Éxito!", `Categoría "${name}" creada correctamente.`);
        nameInput.value = '';
        window.loadCategories();
    } catch (error) {
        showModal("Error", "No se pudo guardar la categoría.");
    }
};

window.loadCategories = async () => {
    const select = document.getElementById('categoria');
    if (!select) return;

    try {
        const snapshot = await getDocs(query(collection(db, "categorias"), orderBy("nombre")));
        select.innerHTML = '<option value="" disabled selected>-- Elige una categoría --</option>';
        if(snapshot.empty) {
            select.innerHTML = '<option value="" disabled>Crea una categoría arriba primero</option>';
            return;
        }
        snapshot.forEach(doc => {
            const cat = doc.data();
            select.innerHTML += `<option value="${cat.nombre}">${cat.nombre}</option>`;
        });
    } catch (error) {
        select.innerHTML = '<option value="" disabled>Error cargando categorías</option>';
    }
};

// ==========================================
// MÓDULO: LIMPIAR REGISTRO / CERRAR CAJA
// ==========================================
window.clearDailyRegister = async () => {
    if (confirm("¿Estás seguro de cerrar la caja de hoy? Las estadísticas del resumen volverán a cero, pero el historial no se borrará.")) {
        try {
            const timestampActual = new Date().getTime();
            localStorage.setItem('caja_clean_timestamp', timestampActual);
            showModal("Caja Cerrada", "El resumen diario se ha reiniciado.");
            if (window.location.pathname.includes('dashboard.html')) window.loadDashboard();
        } catch (error) {
            showModal("Error", "No se pudo limpiar el registro.");
        }
    }
};

// ==========================================
// MÓDULO: DASHBOARD
// ==========================================
window.loadDashboard = async () => {
    const elVentasDia = document.getElementById('ventas-dia');
    const elRecEfectivo = document.getElementById('rec-efectivo');
    const elRecTransf = document.getElementById('rec-transf');
    if (!elVentasDia) return;

    try {
        const q = query(collection(db, "ventas"));
        const snapshot = await getDocs(q);

        let ventasDia = 0;
        let recEfectivo = 0;
        let recTransf = 0;

        const hoy = new Date();
        let startFilterTime = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
        
        const manualReset = localStorage.getItem('caja_clean_timestamp');
        if (manualReset) {
            startFilterTime = Math.max(startFilterTime, Number(manualReset));
        }

        snapshot.forEach(doc => {
            const venta = doc.data();
            if (venta.fecha) {
                const fechaVenta = venta.fecha.toDate().getTime();
                if (fechaVenta >= startFilterTime) {
                    ventasDia += venta.cantidad;
                    if (venta.metodo_pago === 'Efectivo') recEfectivo += venta.total;
                    if (venta.metodo_pago === 'Transferencia') recTransf += venta.total;
                }
            }
        });

        elVentasDia.innerText = ventasDia;
        elRecEfectivo.innerText = `$${recEfectivo}`;
        elRecTransf.innerText = `$${recTransf}`;
    } catch (error) { console.error(error); }
};

// ==========================================
// MÓDULO: ARTÍCULOS
// ==========================================
window.saveProduct = async (e) => {
    e.preventDefault();
    const producto = {
        nombre: document.getElementById('nombre').value,
        categoria: document.getElementById('categoria').value,
        marca: document.getElementById('marca').value,
        precio_compra: Number(document.getElementById('precio_compra').value),
        precio_venta: Number(document.getElementById('precio_venta').value),
        stock: Number(document.getElementById('stock').value),
        stock_minimo: Number(document.getElementById('stock_minimo').value),
        unidad: document.getElementById('unidad').value,
        estado: 'Activo',
        fecha_creacion: serverTimestamp()
    };
    try {
        await addDoc(collection(db, "productos"), producto);
        await window.logMovement('Creación', producto.nombre, producto.stock, 'Ingreso inicial de artículo');
        showModal("¡Éxito!", "Artículo guardado en el inventario.");
        document.getElementById('form-producto').reset();
        window.loadProducts();
    } catch (error) { showModal("Error", "No se pudo guardar."); }
};

window.loadProducts = async () => {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    try {
        const snapshot = await getDocs(query(collection(db, "productos"), orderBy("nombre")));
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay artículos registrados.</td></tr>`;
            return;
        }
        snapshot.forEach(doc => {
            const p = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold;">${p.nombre}</td>
                <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius:6px;">${p.categoria || 'Sin cat.'}</span></td>
                <td>${p.marca}</td>
                <td>$${p.precio_venta}</td>
                <td style="color: ${p.stock <= p.stock_minimo ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">${p.stock} ${p.unidad}</td>
                <td><button onclick="window.deleteProduct('${doc.id}')" class="logout-btn" style="padding: 6px 12px; margin:0; font-size: 0.8rem;">Eliminar</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { tbody.innerHTML = `<tr><td colspan="6">Error de conexión.</td></tr>`; }
};

window.deleteProduct = async (id) => {
    if (confirm("¿Eliminar este artículo permanentemente?")) {
        try { await deleteDoc(doc(db, "productos", id)); window.loadProducts(); } catch (e) { showModal("Error", "No se pudo borrar."); }
    }
};

// ==========================================
// MÓDULO: VENTAS
// ==========================================
window.loadProductsForSale = async () => {
    const select = document.getElementById('producto_select');
    if (!select) return;
    try {
        const snapshot = await getDocs(query(collection(db, "productos"), orderBy("nombre")));
        select.innerHTML = '<option value="" disabled selected>-- Elige un artículo --</option>';
        snapshot.forEach(doc => {
            const p = doc.data();
            select.innerHTML += `<option value="${doc.id}">[${p.stock} disp.] - ${p.nombre} ($${p.precio_venta})</option>`;
        });
    } catch (e) { console.log(e); }
};

window.registerSale = async (e) => {
    e.preventDefault();
    const productId = document.getElementById('producto_select').value;
    const cantidad = Number(document.getElementById('cantidad').value);
    const metodoPago = document.getElementById('metodo_pago').value;

    try {
        const productRef = doc(db, "productos", productId);
        const productSnap = await getDoc(productRef);
        const p = productSnap.data();

        if (p.stock < cantidad) {
            showModal("Stock Insuficiente", `Solo quedan ${p.stock} unidades.`);
            return;
        }
        const total = p.precio_venta * cantidad;
        await addDoc(collection(db, "ventas"), { producto_id: productId, producto_nombre: p.nombre, cantidad: cantidad, total: total, metodo_pago: metodoPago, usuario: currentUserName, fecha: serverTimestamp() });
        await updateDoc(productRef, { stock: p.stock - cantidad });
        await window.logMovement('Venta', p.nombre, -cantidad, `Venta en ${metodoPago}`);
        showModal("Venta Exitosa", `Total: $${total}`);
        document.getElementById('form-venta').reset();
        window.loadProductsForSale();
    } catch (error) { showModal("Error", "Venta cancelada por error."); }
};

// ==========================================
// MOVIMIENTOS
// ==========================================
window.logMovement = async (accion, producto, cantidad, observaciones) => {
    try { await addDoc(collection(db, "movimientos"), { fecha: serverTimestamp(), usuario: currentUserName, accion: accion, producto: producto, cantidad: cantidad, observaciones: observaciones }); } catch (e) {}
};

window.loadMovements = async () => {
    const tbody = document.getElementById('movimientos-tbody');
    if (!tbody) return;
    try {
        const snapshot = await getDocs(query(collection(db, "movimientos"), orderBy("fecha", "desc")));
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Sin movimientos.</td></tr>`;
            return;
        }
        snapshot.forEach(doc => {
            const m = doc.data();
            let f = m.fecha ? m.fecha.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Ahora";
            tbody.innerHTML += `<tr>
                <td>${f}</td>
                <td><span style="background:${m.cantidad > 0 ? 'rgba(16,185,129,0.2)':'rgba(59,130,246,0.2)'}; color:${m.cantidad > 0 ? 'var(--success-color)':'var(--primary-color)'}; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:bold;">${m.accion}</span></td>
                <td>${m.producto}</td>
                <td>${m.cantidad}</td>
                <td>${m.observaciones}</td>
            </tr>`;
        });
    } catch (e) { tbody.innerHTML = `<tr><td colspan="5">Error de red.</td></tr>`; }
};
