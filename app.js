import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

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

let currentUserRole = null;
let currentUserName = "Vendedor";

let LOCAL_CART = {};
let MASTER_ITEMS = [];
let ACTIVE_CATEGORY_FILTER = "TODOS";

// SISTEMA DE CAMBIO DE PESTAÑAS (EVITA SUBDIVIDIR ARCHIVOS HTML)
window.switchTab = (tabId) => {
    document.querySelectorAll('.app-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${tabId}`);
    const targetLink = document.getElementById(`tab-link-${tabId}`);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetLink) targetLink.classList.add('active');

    // Carga selectiva según pestaña abierta
    if (tabId === 'ventas') window.loadPOSMenu();
    if (tabId === 'productos') { window.loadCategories(); window.loadProducts(); }
    if (tabId === 'dashboard') window.loadDashboard();
    if (tabId === 'movimientos') window.loadMovements();
};

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
                currentUserName = userDoc.data().username || "Cajero";
                applyRoleRestrictions();
            }
        } catch (e) { console.error(e); }

        if (currentPath.includes('login.html')) {
            window.location.href = 'index.html';
        } else {
            // Por defecto, abre la caja registradora instantáneamente
            window.switchTab('ventas');
        }
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
// MÓDULO CONTROL CAJA REGISTRADORA
// ==========================================
window.loadPOSMenu = async () => {
    const grid = document.getElementById('pos_grid');
    const catBar = document.getElementById('pos_categories_bar');
    if (!grid) return;

    try {
        const catSnapshot = await getDocs(query(collection(db, "categorias"), orderBy("nombre")));
        catBar.innerHTML = `<button class="category-btn ${ACTIVE_CATEGORY_FILTER === 'TODOS' ? 'active':''}" onclick="window.filterPOSCategory('TODOS')">🌟 TODOS</button>`;
        catSnapshot.forEach(doc => {
            const c = doc.data();
            catBar.innerHTML += `<button class="category-btn ${ACTIVE_CATEGORY_FILTER === c.nombre ? 'active':''}" onclick="window.filterPOSCategory('${c.nombre}')">🏷️ ${c.nombre}</button>`;
        });

        const snapshot = await getDocs(query(collection(db, "productos"), orderBy("nombre")));
        MASTER_ITEMS = [];
        snapshot.forEach(doc => { MASTER_ITEMS.push({ id: doc.id, ...doc.data() }); });

        window.renderPOSGrid(MASTER_ITEMS);
    } catch (e) { console.error(e); }
};

window.renderPOSGrid = (items) => {
    const grid = document.getElementById('pos_grid');
    if (!grid) return;
    grid.innerHTML = '';

    items.forEach(item => {
        const isLowStock = item.stock <= 5;
        const qty = LOCAL_CART[item.id] ? LOCAL_CART[item.id].cantidad : 1;
        
        const card = document.createElement('div');
        card.className = `articulo-card ${isLowStock ? 'stock-bajo' : ''}`;
        card.innerHTML = `
            ${item.tipo_articulo === 'Promo' ? '<span class="badge-promo">PROMO</span>' : ''}
            <div class="articulo-info">
                <h4>${item.nombre}</h4>
                <p class="presentation">${item.marca}</p>
                ${isLowStock ? `<p class="stock-alerta-text">⚠️ ÚLTIMAS ${item.stock} UNID.</p>` : ''}
            </div>
            <div>
                <div class="articulo-price">$${item.precio_venta}</div>
                <div class="quantity-control">
                    <button class="quantity-btn" onclick="window.changeQTY('${item.id}', -1, ${item.stock})">-</button>
                    <div class="quantity-value" id="qty_${item.id}">${qty}</div>
                    <button class="quantity-btn" onclick="window.changeQTY('${item.id}', 1, ${item.stock})">+</button>
                </div>
                <button class="add-btn" onclick="window.addToCart('${item.id}')">AGREGAR</button>
            </div>
        `;
        grid.appendChild(card);
    });
};

window.changeQTY = (id, delta, maxStock) => {
    const el = document.getElementById(`qty_${id}`);
    if (!el) return;
    let currentQty = Number(el.innerText);
    currentQty += delta;
    if (currentQty < 1) currentQty = 1;
    if (currentQty > maxStock) {
        showModal("Stock Crítico", "No queda suficiente mercadería en la barra.");
        currentQty = maxStock;
    }
    el.innerText = currentQty;
    
    if (LOCAL_CART[id]) {
        LOCAL_CART[id].cantidad = currentQty;
        window.updateCartUI();
    }
};

window.addToCart = (id) => {
    const item = MASTER_ITEMS.find(i => i.id === id);
    const targetQty = Number(document.getElementById(`qty_${id}`).innerText);

    LOCAL_CART[id] = { nombre: item.nombre, precio: item.precio_venta, cantidad: targetQty };
    window.updateCartUI();
};

window.updateCartUI = () => {
    const totalEl = document.getElementById('carrito-total');
    const countEl = document.getElementById('carrito-count');
    if (!totalEl) return;
    
    let total = 0, count = 0;
    Object.keys(LOCAL_CART).forEach(id => {
        total += LOCAL_CART[id].precio * LOCAL_CART[id].cantidad;
        count += LOCAL_CART[id].cantidad;
    });

    totalEl.innerText = `$${total}`;
    countEl.innerText = `${count} ítems listos`;
};

window.filterPOSCategory = (categoryName) => {
    ACTIVE_CATEGORY_FILTER = categoryName;
    window.filterPOSItems();
};

window.filterPOSItems = () => {
    const searchVal = document.getElementById('pos_search').value.toLowerCase().trim();
    let filtered = MASTER_ITEMS;

    if (ACTIVE_CATEGORY_FILTER !== 'TODOS') {
        filtered = filtered.filter(i => i.categoria === ACTIVE_CATEGORY_FILTER);
    }
    if (searchVal !== '') {
        filtered = filtered.filter(i => i.nombre.toLowerCase().includes(searchVal) || i.marca.toLowerCase().includes(searchVal));
    }
    window.renderPOSGrid(filtered);
};

window.checkoutPOS = async () => {
    if (Object.keys(LOCAL_CART).length === 0) {
        showModal("Aviso", "Selecciona al menos un artículo.");
        return;
    }
    const metodoPago = document.getElementById('pos_metodo_pago').value;

    try {
        for (const id of Object.keys(LOCAL_CART)) {
            const cartItem = LOCAL_CART[id];
            const productRef = doc(db, "productos", id);
            const freshSnap = await getDoc(productRef);
            const currentStock = freshSnap.data().stock;
            const finalTotal = cartItem.precio * cartItem.cantidad;

            await addDoc(collection(db, "ventas"), {
                producto_id: id, producto_nombre: cartItem.nombre, cantidad: cartItem.cantidad,
                total: finalTotal, metodo_pago: metodoPago, usuario: currentUserName, fecha: serverTimestamp()
            });

            await updateDoc(productRef, { stock: currentStock - cartItem.cantidad });
            await window.logMovement('Venta POS', cartItem.nombre, -cartItem.cantidad, `Caja Rápida - ${metodoPago}`);
        }

        showModal("Cobrado exitosamente", "El registro fue enviado a base de datos.");
        LOCAL_CART = {};
        window.updateCartUI();
        window.loadPOSMenu();
    } catch (e) { showModal("Error", "Fallo al enviar los datos."); }
};

// ==========================================
// ADMINISTRACIÓN INTERNA UNIFICADA
// ==========================================
window.saveCategory = async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('new_category_name');
    try {
        await addDoc(collection(db, "categorias"), { nombre: nameInput.value.trim() });
        nameInput.value = '';
        window.loadCategories();
    } catch (error) { console.error(error); }
};

window.loadCategories = async () => {
    const select = document.getElementById('categoria');
    if (!select) return;
    const snapshot = await getDocs(query(collection(db, "categorias"), orderBy("nombre")));
    select.innerHTML = '<option value="" disabled selected>-- Elige una categoría --</option>';
    snapshot.forEach(doc => { select.innerHTML += `<option value="${doc.data().nombre}">${doc.data().nombre}</option>`; });
};

window.saveProduct = async (e) => {
    e.preventDefault();
    const producto = {
        nombre: document.getElementById('nombre').value,
        categoria: document.getElementById('categoria').value,
        marca: document.getElementById('marca').value,
        precio_venta: Number(document.getElementById('precio_venta').value),
        stock: Number(document.getElementById('stock').value),
        tipo_articulo: document.getElementById('tipo_articulo').value,
        precio_compra: 0, stock_minimo: 5, unidad: 'U', estado: 'Activo', fecha_creacion: serverTimestamp()
    };
    try {
        await addDoc(collection(db, "productos"), producto);
        await window.logMovement('Creación', producto.nombre, producto.stock, 'Ingreso artículo');
        document.getElementById('form-producto').reset();
        window.loadProducts();
    } catch (e) { console.error(e); }
};

window.loadProducts = async () => {
    const tbody = document.getElementById('productos-tbody');
    if (!tbody) return;
    const snapshot = await getDocs(query(collection(db, "productos"), orderBy("nombre")));
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
        const p = doc.data();
        tbody.innerHTML += `<tr>
            <td><strong>${p.nombre}</strong></td>
            <td>${p.categoria}</td>
            <td>${p.marca}</td>
            <td>$${p.precio_venta}</td>
            <td>${p.stock}</td>
            <td><button onclick="window.deleteProduct('${doc.id}')" class="logout-btn" style="padding:4px 8px; margin:0;">X</button></td>
        </tr>`;
    });
};

window.deleteProduct = async (id) => {
    if (confirm("¿Borrar artículo?")) { await deleteDoc(doc(db, "productos", id)); window.loadProducts(); }
};

window.logMovement = async (accion, producto, cantidad, observaciones) => {
    try { await addDoc(collection(db, "movimientos"), { fecha: serverTimestamp(), usuario: currentUserName, accion: accion, producto: producto, cantidad: cantidad, observaciones: observaciones }); } catch (e) {}
};

window.loadMovements = async () => {
    const tbody = document.getElementById('movimientos-tbody');
    if (!tbody) return;
    const snapshot = await getDocs(query(collection(db, "movimientos"), orderBy("fecha", "desc")));
    tbody.innerHTML = '';
    snapshot.forEach(doc => {
        const m = doc.data();
        let f = m.fecha ? m.fecha.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Ahora";
        tbody.innerHTML += `<tr>
            <td>${f}</td>
            <td><span style="color:var(--primary-color)">${m.accion}</span></td>
            <td>${m.producto}</td>
            <td>${m.cantidad}</td>
            <td>${m.observaciones}</td>
        </tr>`;
    });
};

window.loadDashboard = async () => {
    const ev = document.getElementById('ventas-dia');
    const ef = document.getElementById('rec-efectivo');
    const et = document.getElementById('rec-transf');
    if (!ev) return;
    const snapshot = await getDocs(collection(db, "ventas"));
    let v = 0, e = 0, t = 0;
    snapshot.forEach(doc => {
        const d = doc.data();
        v += d.cantidad;
        if (d.metodo_pago === 'Efectivo') e += d.total;
        if (d.metodo_pago === 'Transferencia') t += d.total;
    });
    ev.innerText = v; ef.innerText = `$${e}`; et.innerText = `$${t}`;
};
