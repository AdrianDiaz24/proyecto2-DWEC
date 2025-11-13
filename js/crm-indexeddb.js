let db;

// --- 1. ABRIR BASE DE DATOS INDEXEDDB ---
const request = indexedDB.open("CRM_Database", 1);

request.onerror = function(event) {
    console.error("Error abriendo IndexedDB", event);
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log("Base de datos abierta exitosamente");
    fetchClients(); // Cargar clientes al iniciar
};

request.onupgradeneeded = function(event) {
    db = event.target.result;
    if(!db.objectStoreNames.contains('clients')) {
        const objectStore = db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('name', 'name', { unique: false });
        objectStore.createIndex('email', 'email', { unique: true });
        objectStore.createIndex('phone', 'phone', { unique: false });
        console.log("Object store 'clients' creado");
    }
};

// --- 2. REFERENCIAS DEL DOM Y ESTADO DE VALIDACIÓN ---
const form = document.getElementById('client-form');
const addBtn = document.getElementById('add-btn');
const cancelBtn = document.getElementById('cancel-btn');
const clientList = document.getElementById('client-list');
const inputs = form.querySelectorAll('input[required]');

const validationStatus = {
    name: false,
    email: false,
    phone: false
};

const regex = {
    name: /^[a-zA-Z\s]{3,}$/, // Letras y espacios, min 3 caracteres
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, // Formato de email estándar
    phone: /^\+?[\d\s-]{7,15}$/ // Números, espacios, guiones, 7-15 chars
};

// --- 3. VALIDACIONES Y MANEJO DEL FORMULARIO ---

// Función para comprobar la validez de todos los campos
function checkFormValidity() {
    const allValid = Object.values(validationStatus).every(status => status === true);
    addBtn.disabled = !allValid;
}

// Añadir listener 'blur' a cada input
inputs.forEach(input => {
    input.addEventListener('blur', e => {
        const fieldName = e.target.name;
        const value = e.target.value.trim();
        const isValid = regex[fieldName].test(value);

        validationStatus[fieldName] = isValid;

        if (isValid) {
            e.target.classList.add('valid');
            e.target.classList.remove('invalid');
        } else {
            e.target.classList.add('invalid');
            e.target.classList.remove('valid');
        }

        checkFormValidity();
    });
});

// Listener del formulario (para Agregar o Actualizar)
form.addEventListener('submit', e => {
    e.preventDefault();
    if (!addBtn.disabled) {
        addOrUpdateClient();
    }
});

// Listener para el botón de cancelar edición
cancelBtn.addEventListener('click', resetForm);

// Función para resetear el formulario
function resetForm() {
    form.reset();
    document.getElementById('clientId').value = '';

    // Limpiar clases de validación
    inputs.forEach(input => {
        input.classList.remove('valid', 'invalid');
        validationStatus[input.name] = false;
    });

    addBtn.textContent = 'Agregar Cliente';
    addBtn.disabled = true;
    cancelBtn.style.display = 'none';
}

// --- 4. FUNCIONES CRUD (CREATE, READ, UPDATE, DELETE) ---

// --- AGREGAR O ACTUALIZAR CLIENTE (CREATE / UPDATE) ---
function addOrUpdateClient() {
    const clientId = document.getElementById('clientId').value;

    const clientData = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim()
    };

    const transaction = db.transaction(['clients'], 'readwrite');
    const objectStore = transaction.objectStore('clients');
    let request;

    if (clientId) {
        // Actualizar (Update)
        clientData.id = parseInt(clientId);
        request = objectStore.put(clientData);
    } else {
        // Agregar (Create)
        request = objectStore.add(clientData);
    }

    request.onsuccess = () => {
        console.log("Cliente guardado exitosamente");
        resetForm();
        fetchClients();
    };

    request.onerror = (event) => {
        console.error("Error guardando cliente", event.target.error);
        if (event.target.error.name === 'ConstraintError') {
            alert('Error: El email proporcionado ya existe en la base de datos.');
        } else {
            alert('Error al guardar el cliente.');
        }
    };
}

// --- LISTADO DINÁMICO (READ) ---
function fetchClients() {
    clientList.innerHTML = ''; // Limpiar lista
    const transaction = db.transaction(['clients'], 'readonly');
    const objectStore = transaction.objectStore('clients');
    const request = objectStore.openCursor();

    request.onsuccess = event => {
        const cursor = event.target.result;
        if (cursor) {
            const client = cursor.value;
            const li = document.createElement('li');
            li.innerHTML = `
                <span>
                    <strong>${client.name}</strong><br>
                    ${client.email}<br>
                    ${client.phone}
                </span>
                <div class="actions">
                    <button class="edit" onclick="window.editClient(${client.id})">Editar</button>
                    <button class="delete" onclick="window.deleteClient(${client.id})">Eliminar</button>
                </div>
            `;
            clientList.appendChild(li);
            cursor.continue();
        } else {
            if (clientList.innerHTML === '') {
                clientList.innerHTML = '<li>No hay clientes registrados.</li>';
            }
        }
    };

    request.onerror = event => {
        console.error("Error al leer clientes", event);
    };
}

// --- EDITAR CLIENTE (Prepara el formulario para Update) ---
window.editClient = function(id) {
    const transaction = db.transaction(['clients'], 'readonly');
    const objectStore = transaction.objectStore('clients');
    const request = objectStore.get(id);

    request.onsuccess = event => {
        const client = event.target.result;
        if (client) {
            // Rellenar formulario
            document.getElementById('clientId').value = client.id;
            document.getElementById('name').value = client.name;
            document.getElementById('email').value = client.email;
            document.getElementById('phone').value = client.phone;

            // Marcar campos como válidos (ya que vienen de la BD)
            inputs.forEach(input => {
                validationStatus[input.name] = true;
                input.classList.add('valid');
                input.classList.remove('invalid');
            });

            // Actualizar botones
            addBtn.textContent = 'Actualizar Cliente';
            addBtn.disabled = false;
            cancelBtn.style.display = 'block';

            // Mover la vista al formulario
            window.scrollTo(0, 0);
        }
    };

    request.onerror = event => {
        console.error("Error al obtener cliente para editar", event);
    };
};

// --- ELIMINAR CLIENTE (DELETE) ---
window.deleteClient = function(id) {
    if (!confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
        return;
    }

    const transaction = db.transaction(['clients'], 'readwrite');
    const objectStore = transaction.objectStore('clients');
    const request = objectStore.delete(id);

    request.onsuccess = () => {
        console.log("Cliente eliminado exitosamente");
        fetchClients(); // Recargar la lista
    };

    request.onerror = event => {
        console.error("Error al eliminar cliente", event);
    };
};