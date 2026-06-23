import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ==========================================
// CONFIGURACIÓN DE FIREBASE
// ==========================================
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

// App secundaria EXCLUSIVA para crear usuarios
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

let currentUserRole = null;
let currentUserName = "Usuario";

// ==========================================
// VENTANAS EMERGENTES (MODALES)
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
// CONTROL DE SESIÓN Y RUTAS
// ==========================================
onAuthStateChanged(auth, async (user) => {
    const currentPath = window.location.pathname;
    
    if (user) {
        // Obtener datos del usuario
        try {
            const userDoc = await getDoc(doc(db, "usuarios", user.uid));
            if (userDoc.exists()) {
                currentUserRole = userDoc.data().rol;
                currentUserName = userDoc.data().username || "Admin";
                applyRoleRestrictions();
            } else {
                currentUserName = "Admin Principal";
            }
        } catch (error) {
            console.log("Error obteniendo rol.");
        }

        // Redirección si está en login
        if (currentPath.includes('login.html') || currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
        
        // CARGA AUTOMÁTICA DE DATOS SEGÚN LA PÁGINA
        if (currentPath.includes('usuarios.html')) window.loadUsers();
        if (currentPath.includes('productos.html')) window.loadProducts();
        if (currentPath.includes('ventas.html')) window.loadProductsForSale();
        if (currentPath.includes('movimientos.html')) window.loadMovements();
        if (currentPath.includes('dashboard.html')) window.loadDashboard();
        
    } else {
        // Expulsar si no hay sesión
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
        showModal("Error de Acceso", "Usuario o contraseña incorrectos.");
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
// MÓDULO: DASHBOARD (NUEVO)
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

        // Obtener el inicio del día de hoy para filtrar
        const hoy = new Date();
        const startOfDay = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();

        snapshot.forEach(doc => {
            const venta = doc.data();
            if (venta.fecha) {
                const fechaVenta = venta.fecha.toDate().getTime();
                // Si la venta se hizo hoy
                if (fechaVenta >= startOfDay) {
                    ventasDia += venta.cantidad;
                    if (venta.metodo_pago === 'Efectivo') {
                        recEfectivo += venta.total;
                    } else if (venta.metodo_pago === 'Transferencia') {
                        recTransf += venta.total;
                    }
                }
            }
        });

        elVentasDia.innerText = ventasDia;
        elRecEfectivo.innerText = `$${recEfectivo}`;
        elRecTransf.innerText = `$${recTransf}`;

    } catch (error) {
        console.error("Error cargando estadísticas del dashboard");
    }
};

// ==========================================
// MÓDULO: USUARIOS
// ==========================================
window.createNewUser = async (e) => {
    e.preventDefault();
    const username = document.getElementById('new_username').value.trim().toLowerCase();
    const password = document.getElementById('new_password').value;
    const role = document.getElementById('new_role').value;
    const fakeEmail = `${username}@fogon.com`;

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, fakeEmail, password);
        await setDoc(doc(db, "usuarios", userCredential.user.uid), {
            username: username,
            rol: role,
            email: fakeEmail
        });
        await signOut(secondaryAuth);
        showModal("¡Éxito!", `El usuario '${username}' fue creado correctamente.`);
        document.getElementById('form-usuario').reset();
        window.loadUsers();
    } catch (error) {
        showModal("Error", "No se pudo crear el usuario. Verifique los datos.");
    }
};

window.loadUsers = async () => {
    const tbody = document.getElementById('usuarios-tbody');
    if (!tbody) return;
    try {
        const querySnapshot = await getDocs(collection(db, "usuarios"));
        tbody.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            tbody.innerHTML += `<tr>
                <td style="font-weight: bold; color: var(--primary-color);">${data.username}</td>
                <td>${data.rol}</td>
                <td style="color: var(--text-secondary); font-size: 0.9rem;">${data.email}</td>
            </tr>`;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3">Error cargando usuarios.</td></tr>`;
    }
};

// ==========================================
// MÓDULO: PRODUCTOS
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
        await window.logMovement('Creación', producto.nombre, producto.stock, 'Ingreso inicial de producto');
        showModal("¡Éxito!", "Producto guardado correctamente en la base de datos.");
        document.getElementById('form-producto').reset();
        window.loadProducts();
    } catch (error) {
        showModal("Error", "No se pudo guardar el producto: " + error.message);
    }
};

window.loadProducts = async () => {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "productos"), orderBy("nombre"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No hay productos registrados.</td></tr>`;
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: bold;">${p.nombre}</td>
                <td>${p.categoria}</td>
                <td>${p.marca}</td>
                <td>$${p.precio_venta}</td>
                <td style="color: ${p.stock <= p.stock_minimo ? 'var(--danger-color)' : 'var(--success-color)'}; font-weight: bold;">${p.stock} ${p.unidad}</td>
                <td>
                    ${currentUserRole === 'Administrador' || currentUserRole == null ? `<button onclick="window.deleteProduct('${doc.id}')" class="logout-btn" style="padding: 5px 10px; font-size: 0.8rem;">Eliminar</button>` : '---'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger-color);">Error conectando a la base de datos.</td></tr>`;
    }
};

window.deleteProduct = async (id) => {
    if (confirm("¿Estás seguro de eliminar este producto definitivamente?")) {
        try {
            await deleteDoc(doc(db, "productos", id));
            window.loadProducts();
        } catch (error) {
            showModal("Error", "No se pudo eliminar el producto.");
        }
    }
};

// ==========================================
// MÓDULO: VENTAS
// ==========================================
window.loadProductsForSale = async () => {
    const select = document.getElementById('producto_select');
    if (!select) return;

    try {
        const q = query(collection(db, "productos"), orderBy("nombre"));
        const snapshot = await getDocs(q);
        select.innerHTML = '<option value="" disabled selected>-- Selecciona un producto --</option>';
        
        snapshot.forEach(doc => {
            const p = doc.data();
            select.innerHTML += `<option value="${doc.id}">[${p.stock} disp.] - ${p.nombre} ($${p.precio_venta})</option>`;
        });
    } catch (error) {
        console.error("Error cargando productos para venta");
    }
};

window.registerSale = async (e) => {
    e.preventDefault();
    const productId = document.getElementById('producto_select').value;
    const cantidad = Number(document.getElementById('cantidad').value);
    const metodoPago = document.getElementById('metodo_pago').value;

    if (!productId) {
        showModal("Atención", "Debes seleccionar un producto.");
        return;
    }

    try {
        const productRef = doc(db, "productos", productId);
        const productSnap = await getDoc(productRef);
        
        if (!productSnap.exists()) throw new Error("Producto no encontrado");
        
        const p = productSnap.data();
        if (p.stock < cantidad) {
            showModal("Stock Insuficiente", `Solo quedan ${p.stock} unidades de ${p.nombre}.`);
            return;
        }

        const total = p.precio_venta * cantidad;

        // Registrar Venta
        await addDoc(collection(db, "ventas"), {
            producto_id: productId,
            producto_nombre: p.nombre,
            cantidad: cantidad,
            total: total,
            metodo_pago: metodoPago,
            usuario: currentUserName,
            fecha: serverTimestamp()
        });

        // Descontar Stock
        await updateDoc(productRef, { stock: p.stock - cantidad });

        // Registrar Movimiento
        await window.logMovement('Venta', p.nombre, -cantidad, `Venta en ${metodoPago}`);

        showModal("Venta Registrada", `Se vendieron ${cantidad}x ${p.nombre} por $${total}.`);
        document.getElementById('form-venta').reset();
        window.loadProductsForSale(); // Recargar el stock en el selector
    } catch (error) {
        showModal("Error", "Hubo un problema al registrar la venta.");
    }
};

// ==========================================
// MÓDULO: MOVIMIENTOS
// ==========================================
window.logMovement = async (accion, producto, cantidad, observaciones) => {
    try {
        await addDoc(collection(db, "movimientos"), {
            fecha: serverTimestamp(),
            usuario: currentUserName,
            accion: accion,
            producto: producto,
            cantidad: cantidad,
            observaciones: observaciones
        });
    } catch (error) {
        console.error("Error guardando movimiento");
    }
};

window.loadMovements = async () => {
    const tbody = document.getElementById('movimientos-tbody');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
        const snapshot = await getDocs(q);
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay movimientos registrados.</td></tr>`;
            return;
        }

        snapshot.forEach(documento => {
            const m = documento.data();
            let fechaStr = "Reciente";
            if (m.fecha) fechaStr = m.fecha.toDate().toLocaleString();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-size: 0.9rem; color: var(--text-secondary);">${fechaStr}</td>
                <td><span style="background-color: ${m.cantidad > 0 ? 'var(--success-color)' : 'var(--primary-color)'}; color: black; padding: 3px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${m.accion}</span></td>
                <td style="font-weight: bold;">${m.producto}</td>
                <td style="font-weight: bold;">${m.cantidad > 0 ? '+'+m.cantidad : m.cantidad}</td>
                <td style="font-size: 0.9rem;">${m.observaciones}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Error conectando a la base de datos.</td></tr>`;
    }
};

// ==========================================
// MÓDULO: EXPORTACIÓN (REPORTES)
// ==========================================
window.exportToCSV = async (collectionName) => {
    try {
        const snapshot = await getDocs(collection(db, collectionName));
        if (snapshot.empty) {
            showModal("Sin Datos", "No hay información para exportar.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        const keys = Object.keys(snapshot.docs[0].data());
        csvContent += keys.join(",") + "\r\n";

        snapshot.forEach(doc => {
            const row = doc.data();
            const rowString = keys.map(k => {
                let val = row[k];
                if (val && val.toDate) val = val.toDate().toLocaleString(); 
                return `"${val}"`;
            }).join(",");
            csvContent += rowString + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${collectionName}_export.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        showModal("Error", "Fallo al exportar los datos.");
    }
};
