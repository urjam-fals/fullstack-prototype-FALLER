const STORAGE_KEY = 'ipt_demo_v1';
let db = { users: [], departments: [], employees: [], requests: []};
let currentUser = null;
let editingIndex = null;

// -------------------- ROUTES --------------------
const routes = {
    '#/': 'home-page',
    '#/login': 'login-page',
    '#/register': 'register-page',
    '#/profile': 'profile-page',
    '#/requests': 'my-requests-page',
    '#/employees': 'employees-page',
    '#/accounts': 'accounts-page',
    '#/departments': 'departments-page',
    '#/verify-email': 'verify-email-page'
};

// -------------------- UTILITY --------------------
function showToast(message, type = "success") {
    const toastEl = document.getElementById("app-toast");
    const toastMsg = document.getElementById("toast-message");

    toastMsg.textContent = message;

    // Set color
    toastEl.classList.remove("bg-success", "bg-danger", "bg-warning", "bg-info");

    if (type === "success") toastEl.classList.add("bg-success");
    if (type === "error") toastEl.classList.add("bg-danger");
    if (type === "warning") toastEl.classList.add("bg-warning");
    if (type === "info") toastEl.classList.add("bg-info");

    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// Helper to show one page and hide the rest
// -------------------- SPA ROUTING --------------------
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
}
// Navigation helper
function navigateTo(hash) {
    if (window.location.hash !== hash) window.location.hash = hash;
    else handleRouting();
}
// Routing handler
function handleRouting() {
    const hash = window.location.hash || '#/';
    const pageId = routes[hash] || 'home-page';

    // Protected routes
    const protectedRoutes = ['#/profile', '#/requests'];
    const adminRoutes = ['#/employees', '#/accounts', '#/departments'];

    if (!currentUser && protectedRoutes.includes(hash)) return navigateTo('#/login');
    if ((currentUser?.role !== 'Admin') && adminRoutes.includes(hash)) return navigateTo('#/');

    // Show page
    showPage(pageId);

    // Hide welcome section if not home
    const welcome = document.getElementById('welcome-section');
    if (welcome) welcome.classList.toggle('d-none', hash !== '#/');

    // Dynamic page loading
    if (hash === '#/profile') populateProfilePage();
    if (hash === '#/verify-email') loadVerifyEmailPage();
    if (hash === '#/login') {
        showVerifiedMessage();

        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();

        const err = document.getElementById('login-error');
        if (err) err.textContent = '';
    }
    if (hash === '#/departments') loadDepartmentsPage();
    if (hash === '#/employees') loadEmployeesPage();
    if (hash === '#/requests') loadRequestsPage();
}

// Load initial data
// -------------------- STORAGE --------------------
function loadFromStorage() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (stored && stored.users && stored.departments) {
            db = stored;
        } else throw new Error();
    } catch {
        db = {
            users: [
                { firstName: 'Admin', lastName: 'User', email: 'admin@example.com', password: 'Password123!', role: 'Admin', verified: true }
            ],
            departments: [ { name: 'Engineering' }, { name: 'HR' } ],
            employees: [],
            requests: []
        };
        saveToStorage();
    }

    db.users.forEach((u, i) => { if (!u.id) u.id = 'user' + (i+1); });
    db.departments.forEach((d, i) => { if (!d.id) d.id = 'dept' + (i+1); });

    // Patch old employees
    db.employees.forEach(emp => {
        if (!emp.userId && emp.email) {
            const user = db.users.find(u => u.email === emp.email);
            if (user) emp.userId = user.id;
        }
        if (!emp.departmentId && emp.departmentName) {
            const dept = db.departments.find(d => d.name === emp.departmentName);
            if (dept) emp.departmentId = dept.id;
        }
        delete emp.email;
        delete emp.departmentName;
    });
    // Ensure requests array exists
    if (!db.requests) db.requests = [];

    saveToStorage();

    const authEmail = localStorage.getItem('auth_token');
    currentUser = authEmail ? db.users.find(u => u.email === authEmail) || null : null;

    // Render tables depending on current page
    renderAccountsTable();
    if (window.location.hash === '#/employees') renderEmployeesTable();
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// -------------------- AUTH --------------------
function updateNavbarUsername() {
    const usernameSpan = document.getElementById('username-display');
    if (!usernameSpan) return;

    if (!currentUser) { usernameSpan.textContent = 'User'; return;}

    if (currentUser.role === 'Admin') { usernameSpan.textContent = 'Admin';
    } else {
        usernameSpan.textContent = 'User';
    }
}

function setAuthState(isAuth, user = null) {
    currentUser = isAuth ? user : null;

    document.body.classList.toggle('authenticated', isAuth);
    document.body.classList.toggle('not-authenticated', !isAuth);
    document.body.classList.toggle('is-admin', isAuth && user?.role === 'Admin');

    updateNavbarUsername();
}

// -------------------- LOGIN --------------------
document.getElementById('login-form')?.addEventListener('submit', function(e) {
    e.preventDefault();

    const email = e.target.email.value.trim();
    const password = e.target.password.value;

    const err = document.getElementById('login-error');
    if (err) {
        err.textContent = '';
        err.style.display = 'none';   // hide first
    }

    // First: check if email exists
    const user = db.users.find(u => u.email === email);

    if (!user) {
        if (err) {
            err.textContent = 'Invalid Email.';
            err.style.display = 'block';
        }
        return;
    }

    // Second: check password
    if (user.password !== password) {
        if (err) {
            err.textContent = 'Invalid Password.';
            err.style.display = 'block';
        }
        return;
    }
    // Third: check verification
    if (!user.verified) {
        if (err) {
            err.textContent = 'Please verify your email first.';
            err.style.display = 'block';
        }
        return;
    }

    // Successful login
    localStorage.setItem('auth_token', user.email);
    setAuthState(true, user);
    navigateTo('#/profile');
});

// -------------------- LOGOUT --------------------
function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('showVerifiedMsg'); // Clear verified message
    setAuthState(false);
    
    // Clear login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();

    // Clear register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.reset();

    // Hide verified message in DOM
    const verifiedMsg = document.getElementById("verified-msg");
    if (verifiedMsg) {
        verifiedMsg.style.display = "none";
        verifiedMsg.textContent = "";
    }
    navigateTo('#/');
}
document.getElementById('logout-btn')?.addEventListener('click', logout);

// -------------------- REGISTER --------------------
document.getElementById("register-form")?.addEventListener("submit", function(e) {
    e.preventDefault();

    const firstName = document.getElementById("register-firstname").value.trim();
    const lastName = document.getElementById("register-lastname").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    // ✅ New validation
    if (!isValidEmail(email)) {
        showToast("Please enter a valid email address.", "warning");
        return;
    }

    // Check if email already exists
    const existingAccount = db.users.find(acc => acc.email === email);
    if (existingAccount) {
        if (!existingAccount.verified) {
            localStorage.setItem("unverified_email", email);
            navigateTo('#/verify-email');
        } else {
            showToast("Account already exists. Please log in.");
            navigateTo('#/login');
        }
        return;
    }

    const newAccount = {
        firstName,
        lastName,
        email,
        password,
        verified: false,
        role: 'User'
    };

    if (!db.users) db.users = [];
    db.users.push(newAccount);
    saveToStorage();

    // ✅ Reset form immediately
    const form = document.getElementById("register-form");
    form.reset(); // clears all fields

    // ✅ Clear any local storage flags
    localStorage.removeItem("unverified_email");
    
    localStorage.setItem("unverified_email", email);
    navigateTo("#/verify-email");
});

function isValidEmail(email) {
    // Basic regex: must have something@something.something
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// -------------------- PROFILE --------------------
function populateProfilePage() {
    if (!currentUser) return navigateTo('#/login');

    const container = document.getElementById('profile-container');
    if (!container) return;

    let name;

    if (currentUser.firstName && currentUser.lastName) {
        const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
        name = capitalizeWords(fullName);
    } else if (currentUser.role === 'Admin') {
        name = 'Admin User';
    } else {
        name = 'User';
    }

    // Generate initials for avatar
    const initials = name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();

    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="profile-avatar mx-auto mb-3">
                ${initials}
            </div>
            <h4 class="fw-bold mb-1">${name}</h4>
            <span class="badge ${currentUser.role === 'Admin' ? 'bg-danger' : 'bg-secondary'}">
                ${currentUser.role}
            </span>
        </div>
        <hr>
        <div class="profile-info">
            <div class="mb-3">
                <label class="form-label text-muted small">Email</label>
                <div class="fw-semibold">${currentUser.email}</div>
            </div>

            <div class="mb-3">
                <label class="form-label text-muted small">Role</label>
                <div class="fw-semibold">${currentUser.role}</div>
            </div>
        </div>
        <div class="d-grid gap-2 mt-4">
            <button id="edit-profile-btn" class="btn btn-primary">
                Edit Profile
            </button>
        </div>
    `;
    const editBtn = document.getElementById("edit-profile-btn");
    editBtn?.addEventListener("click", enableProfileEdit);
}

function enableProfileEdit() {
    const container = document.getElementById("profile-container");
    if (!container || !currentUser) return;

    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="profile-avatar mx-auto mb-3">
                ${currentUser.firstName[0].toUpperCase()}${currentUser.lastName[0].toUpperCase()}
            </div>

            <div class="mb-3">
                <label class="form-label">First Name</label>
                <input type="text" id="edit-firstname" class="form-control"
                       value="${currentUser.firstName}">
            </div>

            <div class="mb-3">
                <label class="form-label">Last Name</label>
                <input type="text" id="edit-lastname" class="form-control"
                       value="${currentUser.lastName}">
            </div>

            <span class="badge ${currentUser.role === 'Admin' ? 'bg-danger' : 'bg-secondary'}">
                ${currentUser.role}
            </span>
        </div>

        <hr>

        <div class="profile-info">
            <div class="mb-3">
                <label class="form-label text-muted small">Email</label>
                <div class="fw-semibold">${currentUser.email}</div>
            </div>

            <div class="mb-3">
                <label class="form-label text-muted small">Role</label>
                <div class="fw-semibold">${currentUser.role}</div>
            </div>
        </div>

        <div class="d-grid gap-2 mt-4">
            <button id="save-profile-btn" class="btn btn-success">
                Save Changes
            </button>
            <button id="cancel-profile-btn" class="btn btn-secondary">
                Cancel
            </button>
        </div>
    `;

    attachProfileEditEvents();
}

function attachProfileEditEvents() {
    const saveBtn = document.getElementById("save-profile-btn");
    const cancelBtn = document.getElementById("cancel-profile-btn");

    saveBtn?.addEventListener("click", () => {
        const newFirst = document.getElementById("edit-firstname").value.trim();
        const newLast = document.getElementById("edit-lastname").value.trim();

        if (!newFirst || !newLast) {
            showToast("Name fields cannot be empty.", "warning");
            return;
        }

        // Update user in database
        const userIndex = db.users.findIndex(u => u.email === currentUser.email);
        if (userIndex !== -1) {
            db.users[userIndex].firstName = newFirst;
            db.users[userIndex].lastName = newLast;

            currentUser = db.users[userIndex];

            saveToStorage();
        }

        showToast("✅ Profile updated successfully!", "success");

        updateNavbarUsername();   // refresh navbar name
        populateProfilePage();    // reload profile page
    });

    cancelBtn?.addEventListener("click", () => {
        populateProfilePage(); // revert back
    });
}

// -------------------- VERIFY EMAIL --------------------
function loadVerifyEmailPage() {
    const email = localStorage.getItem("unverified_email");
    const span = document.getElementById("verify-email-text");
    if (email && span) span.textContent = email;
}

function showVerifiedMessage() {
    const msgContainer = document.getElementById("verified-msg");
    if (localStorage.getItem("showVerifiedMsg") === "true" && msgContainer) {
        msgContainer.textContent = "✅ Email verified! You may now log in.";
        msgContainer.style.display = "block";
        localStorage.removeItem("showVerifiedMsg");
    }
}

document.getElementById("simulate-verify-btn")?.addEventListener("click", function() {
    const email = localStorage.getItem("unverified_email");
    const account = db.users.find(acc => acc.email === email);
    if (account) {
        account.verified = true;
        saveToStorage();
        localStorage.removeItem("unverified_email");
        localStorage.setItem("showVerifiedMsg", "true");
        // Show alert immediately
        showToast("✅ Email verified! Please log in.");

        navigateTo("#/login");
    }
});

document.getElementById("go-to-login-btn")?.addEventListener("click", function() {
    localStorage.setItem("showVerifiedMsg", "true");
    navigateTo("#/login");
});

// -------------------- CANCEL BUTTONS --------------------
document.getElementById('login-cancel-btn')?.addEventListener('click', () => navigateTo('#/'));
document.getElementById('register-cancel-btn')?.addEventListener('click', () => navigateTo('#/'));

// -------------------- INIT --------------------
window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', () => {
    loadFromStorage(); // sets db and currentUser

    // Ensure auth state is correct
    if (currentUser) setAuthState(true, currentUser);
    
    document.getElementById('brand-link')?.addEventListener('click', function(e) {
        if (currentUser) {
            e.preventDefault();
            navigateTo('#/profile');
        }
    });
    handleRouting(); // now currentUser is guaranteed set
});

function capitalizeWords(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// -------------------- ACCOUNTS --------------------
function renderAccountsTable() {
    const tbody = document.getElementById("accounts-table-body");
    if (!tbody) return;

    tbody.innerHTML = ""; // clear table

    db.users.forEach((user, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${capitalizeWords(user.firstName + " " + user.lastName)}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td>${user.verified ? "✅" : "❌"}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-btn" data-index="${index}">Edit</button>
                <button class="btn btn-sm btn-warning reset-btn" data-index="${index}">Reset PW</button>
                <button class="btn btn-sm btn-danger delete-btn" data-index="${index}">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    attachAccountActions();
}

document.getElementById("account-form")?.addEventListener("submit", function(e) {
    e.preventDefault();

    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("email").value.trim();
    
    // Add this at the top, after trimming email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        showToast("Please enter a valid email address (must include @ and domain).", "warning");
        return;
    }

    const role = document.getElementById("role").value;
    const verified = document.getElementById("verified").checked;   
    // NEW: handle password securely
    let password;
    if (editingIndex !== null) {
        password = db.users[editingIndex].password; // keep existing password
    } else {
        password = document.getElementById("password").value; // new account

        // ✅ Validate password length
        if (password.length < 6) {
            showToast("Password must be at least 6 characters long!", "warning");
            return;
        }
    }
    const existingIndex = db.users.findIndex(u => u.email === email);

    if (existingIndex !== -1 && editingIndex === null) {
        showToast("Account already exists!");
        return;
    }
    const accountData = { firstName, lastName, email, password, role, verified };

    if (editingIndex !== null) {
        // Update existing account
        db.users[editingIndex] = accountData;
        editingIndex = null;

        saveToStorage();
        renderAccountsTable();

        // Show success 
        showToast("✅ Account updated successfully!");

        // Hide the form after 
        const form = document.getElementById("account-form");
        form.classList.add("d-none");
        form.querySelector("form").reset(); // clear form
    } else {
        // New account
        db.users.push(accountData);
        saveToStorage();
        renderAccountsTable();

        // Optional: alert for new account
        showToast("✅ Account added successfully!");

        // Hide the form
        const form = document.getElementById("account-form");
        form.classList.add("d-none");
        form.querySelector("form").reset();
    }
});

// Show the modal
function resetPassword(index) {
    const user = db.users[index];
    if (!user) return;

    const modal = document.getElementById("passwordModal");
    const modalEmail = document.getElementById("modal-user-email");
    const form = document.getElementById("passwordModalForm");
    const newPwInput = document.getElementById("new-password");
    const confirmPwInput = document.getElementById("confirm-password");
    
    modalEmail.textContent = `Enter new password for ${user.email} (min 6 chars)`;
    newPwInput.value = "";
    confirmPwInput.value = "";

    modal.style.display = "flex";

    // Cancel button
    document.getElementById("cancelPassword").onclick = () => {
        modal.style.display = "none";
    };
    // Handle form submission
    form.onsubmit = (e) => {
        e.preventDefault();

        const newPw = newPwInput.value.trim();
        const confirmPw = confirmPwInput.value.trim();

        if (newPw.length < 6) {
            showToast("Password must be at least 6 characters.", "warning");
            return;
        }

        if (newPw !== confirmPw) {
            showToast("Passwords do not match.", "warning");
            return;
        }

        user.password = newPw;
        saveToStorage();
        modal.style.display = "none";
        showToast("Resetting password successfully!", "success");
    };
}

function deleteAccount(index) {
    const user = db.users[index];
    if (!user) return;

    if (user.email === currentUser.email) {
        showToast("You cannot delete your own admin account!", "warning");
        return;
    }
    // Get the row element
    const tbody = document.getElementById("accounts-table-body");
    const row = tbody.children[index];
    if (!row) return;

    // Remove any existing confirmation rows first
    const existingConfirm = tbody.querySelector(".confirm-row");
    if (existingConfirm) existingConfirm.remove();

    // Insert a new row right below
    const confirmRow = document.createElement("tr");
    confirmRow.classList.add("confirm-row");
    confirmRow.innerHTML = `
        <td colspan="5" class="text-center text-danger">
            Are you sure you want to delete <strong>${user.email}</strong>?
            <button class="btn btn-sm btn-danger ms-2" id="confirm-yes">Yes</button>
            <button class="btn btn-sm btn-secondary ms-1" id="confirm-no">No</button>
        </td>
    `;

    row.after(confirmRow);

    // Handle Yes / No buttons
    confirmRow.querySelector("#confirm-yes").addEventListener("click", () => {
        db.users.splice(index, 1);
        saveToStorage();
        renderAccountsTable();
        showToast(`Employee account deleted successfully!`, "success");
    });

    confirmRow.querySelector("#confirm-no").addEventListener("click", () => {
        confirmRow.remove();
    });
}

function attachAccountActions() {
    document.querySelectorAll(".edit-btn").forEach(btn =>
        btn.addEventListener("click", () => editAccount(btn.dataset.index))
    );
    document.querySelectorAll(".reset-btn").forEach(btn =>
        btn.addEventListener("click", () => resetPassword(btn.dataset.index))
    );
    document.querySelectorAll(".delete-btn").forEach(btn =>
        btn.addEventListener("click", () => deleteAccount(btn.dataset.index))
    );
}

function editAccount(index) {
    const user = db.users[index];
    if (!user) return;

    editingIndex = index;

    document.getElementById("first-name").value = user.firstName;
    document.getElementById("last-name").value = user.lastName;
    document.getElementById("email").value = user.email;
    document.getElementById("password").value = user.password;
    document.getElementById("role").value = user.role;
    document.getElementById("verified").checked = user.verified;

    // Show the form
    const form = document.getElementById("account-form");
    form.classList.remove("d-none");
    form.scrollIntoView({ behavior: "smooth" });

    // --- Insert these lines here ---
    form.dataset.editing = "true";
    form.querySelector("#password").disabled = true; // prevent typing
}

document.getElementById("add-account-btn").addEventListener("click", () => {
    const form = document.getElementById("account-form");
    form.classList.remove("d-none"); // show form
    form.scrollIntoView({ behavior: "smooth" }); // scroll to form

    const passwordInput = form.querySelector("#password"); // get password field
    passwordInput.disabled = false; // enable typing when adding
    passwordInput.value = ""; // optional: clear previous value

    // If you have an "Edit" flag, make sure to set it to false
    form.dataset.editing = "false";
});

document.getElementById("cancel-account-btn")?.addEventListener("click", () => {
    const form = document.getElementById("account-form");
    if (!form) return;

    form.classList.add("d-none"); // hide the form
    form.querySelector("form").reset(); // clear all input fields
    editingIndex = null; // reset editing state
});

function openAccountForm(mode, index = null) {
    const form = document.getElementById("account-form");
    const passwordField = document.getElementById("user-password");
    const submitBtn = document.getElementById("account-submit");

    if (mode === "add") {
        form.reset(); // clear previous values
        passwordField.disabled = false; // allow typing
        submitBtn.textContent = "Add Account";
    } else if (mode === "edit") {
        const user = db.users[index];
        if (!user) return;
        document.getElementById("user-email").value = user.email;
        document.getElementById("user-name").value = user.name;
        passwordField.value = "********"; // or empty
        passwordField.disabled = true; // block typing
        submitBtn.textContent = "Save Changes";
    }
    form.dataset.mode = mode; // optional, to know current mode
    form.dataset.index = index; // optional, to know which user
}

// -------------------- DEPARTMENTS --------------------
function renderDepartmentsTable() {
    const tbody = document.querySelector('#departments-table tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // clear table

    db.departments.forEach((dept, index) => {
        const tr = document.createElement('tr');

        // Optional: Description fallback if undefined
        const description = dept.description || '';

        tr.innerHTML = `
            <td>${dept.name}</td>
            <td>${description}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm edit-dept-btn" data-index="${index}">Edit</button>
                <button class="btn btn-outline-danger btn-sm delete-dept-btn" data-index="${index}">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    attachDepartmentActions();
}

function attachDepartmentActions() {
    document.querySelectorAll('.edit-dept-btn').forEach(btn =>
        btn.addEventListener('click', () => showToast('Edit department not implemented'))
    );
    document.querySelectorAll('.delete-dept-btn').forEach(btn =>
        btn.addEventListener('click', () => showToast('Delete department not implemented'))
    );
}

// "+ Add Department" button
document.getElementById('add-department-btn')?.addEventListener('click', () => {
    showToast('Add department not implemented');
});

// Call this whenever departments page is shown
function loadDepartmentsPage() {
    if (!db || !db.departments) db = { departments: [] }; // use db instead of window.db

    renderDepartmentsTable();
}

// -------------------- EMPLOYEES --------------------
function populateDepartmentDropdown() {
  const select = document.getElementById("emp-department");
  select.innerHTML = "";

  db.departments.forEach(dept => {
    const option = document.createElement("option");
    option.value = dept.id;
    option.textContent = dept.name;
    select.appendChild(option);
  });
}

function showEmployeeForm() {
  populateDepartmentDropdown();
  document.getElementById("employee-form-card").classList.remove("d-none");
}

function hideEmployeeForm() {
  document.getElementById("employee-form-card").classList.add("d-none");
  document.getElementById("employee-form").reset();
}

document.getElementById("employee-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const empId = document.getElementById("emp-id").value.trim();
  const inputEmail = document.getElementById("emp-email").value.trim();
  const position = document.getElementById("emp-position").value.trim();
  const departmentId = document.getElementById("emp-department").value;
  const hireDate = document.getElementById("emp-hiredate").value;

  // CHECK 1: Duplicate Employee ID
  const existingEmployee = db.employees.find(e => e.id === empId);

  if (existingEmployee) {
    showToast("Employee ID already exists. Please use a unique ID.");
    return;
  }
  // CHECK 2: User must exist
  const user = db.users.find(u => u.email === inputEmail);

  if (!user) {
    showToast("User email does not exist.");
    return;
  }
  // CHECK 3: Prevent same user from being added twice
  const userAlreadyEmployee = db.employees.find(e => e.userId === user.id);

  if (userAlreadyEmployee) {
    showToast("This user is already assigned as an employee.");
    return;
  }
  const newEmployee = {
    id: empId,
    userId: user.id,
    departmentId: departmentId,
    position: position,
    hireDate: hireDate
  };

  db.employees.push(newEmployee);

  saveToStorage();
  renderEmployeesTable();
  hideEmployeeForm();
});

function renderEmployeesTable() {
  const tbody = document.querySelector("#employees-table tbody");
  const noData = document.getElementById("no-employees");

  tbody.innerHTML = "";

  if (db.employees.length === 0) {
    noData.classList.remove("d-none");
    return;
  }

  noData.classList.add("d-none");

  db.employees.forEach(emp => {

    const user = db.users.find(u => u.id === emp.userId);
    const dept = db.departments.find(d => d.id === emp.departmentId);

    const tr = document.createElement("tr");

    tr.innerHTML = `
    <td>${emp.id}</td>
    <td>${user ? user.email : "Unknown"}</td>
    <td>${emp.position}</td>
    <td>${dept ? dept.name : "Unknown"}</td>
    <td></td>
    `;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-sm btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => confirmDeleteEmployee(emp.id));

    tr.querySelector("td:last-child").appendChild(deleteBtn);

    tbody.appendChild(tr);
  });
}

function confirmDeleteEmployee(empId) {
  const tbody = document.querySelector("#employees-table tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const row = rows.find(r => r.querySelector("td").textContent == empId);
  if (!row) return;

  const user = db.users.find(u => u.id === db.employees.find(e => e.id === empId).userId);

  // Replace last cell with confirmation buttons
  const confirmRow = row.querySelector("td:last-child");
  confirmRow.innerHTML = `
    <span class="text-danger">Are you sure you want to delete <strong>${user.email}</strong>?</span>
    <button class="btn btn-sm btn-danger ms-2" id="confirm-yes">Yes</button>
    <button class="btn btn-sm btn-secondary ms-1" id="confirm-no">No</button>
  `;

  // Yes button
  confirmRow.querySelector("#confirm-yes").addEventListener("click", () => {
    db.employees = db.employees.filter(e => e.id !== empId);
    saveToStorage();
    renderEmployeesTable();
    showToast("Deleted successfully!", "warning");
  });

  // No button
  confirmRow.querySelector("#confirm-no").addEventListener("click", () => {
    renderEmployeesTable(); // just re-render to remove confirmation buttons
  });
}

function seedDefaultDepartments() {
  if (!db.departments || db.departments.length === 0) {
    db.departments = [
      { id: 'dept1', name: 'Engineering' },
      { id: 'dept2', name: 'HR' }
    ];
    saveToStorage();
  }
}

// -------------------- REQUESTS --------------------
function loadRequestsPage() {
    if (!currentUser) return;
    
    const tbody = document.getElementById("requests-table-body"); // Equipment/Resources
    const leaveTbody = document.getElementById("leave-requests-table-body"); // Leave
    const noData = document.getElementById("no-requests");
    
    if (!tbody) return;

    tbody.innerHTML = "";
    if (leaveTbody) leaveTbody.innerHTML = "";

    let requestsToShow = [];

    if (currentUser.role === "Admin") {
        requestsToShow = [...db.requests];
    } else {
        requestsToShow = db.requests.filter(r => 
            r.employeeEmail === currentUser.email
        );
    }
    // Status sorting
    const statusOrder = {
        "Pending": 1,
        "Approved": 2,
        "Rejected": 3
    };

    requestsToShow.sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return new Date(b.date) - new Date(a.date);
    });

    if (requestsToShow.length === 0) {
        noData.style.display = "block";
        return;
    }

    noData.style.display = "none";

    // Split Leave vs Others
    const leaveRequests = requestsToShow.filter(r => r.type === "Leave");
    const otherRequests = requestsToShow.filter(r => r.type !== "Leave");

    // ==============================
    // Render Equipment / Resources
    // ==============================
    otherRequests.forEach(req => {
        const realIndex = currentUser.role === "Admin"
            ? db.requests.indexOf(req)
            : null;

        const tr = document.createElement("tr");
        const statusBadge = getStatusBadge(req.status);

        const itemsText = req.items
            .map(i => `${i.name} (${i.qty})`)
            .join(", ");

        tr.innerHTML = `
            <td>${new Date(req.date).toLocaleString()}</td>
            <td class="admin-only">${req.employeeEmail}</td>
            <td>${req.type}</td>
            <td>${itemsText}</td>
            <td>
                ${statusBadge}
                ${currentUser.role === "Admin" ? `
                <select class="form-select form-select-sm mt-2 status-select"
                        data-index="${realIndex}">
                    <option ${req.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option ${req.status === "Approved" ? "selected" : ""}>Approved</option>
                    <option ${req.status === "Rejected" ? "selected" : ""}>Rejected</option>
                </select>
                ` : ""}
            </td>
            ${currentUser.role === "Admin" ? `<td>
                <button class="btn btn-sm btn-danger delete-btn" ${req.status === "Pending" ? "disabled" : ""}>Delete</button>
            </td>` : ""}
        `;

        const statusSelect = tr.querySelector(".status-select");
        const delBtn = tr.querySelector(".delete-btn");

        if (statusSelect && delBtn) {
            statusSelect.addEventListener("change", (e) => {
                const newStatus = e.target.value;
                db.requests[realIndex].status = newStatus;
                saveToStorage();
                delBtn.disabled = newStatus === "Pending";
                const badgeCell = tr.querySelector("td:nth-child(5)");
                if (badgeCell) badgeCell.innerHTML = getStatusBadge(newStatus) + statusSelect.outerHTML;
            });
        }

        tbody.appendChild(tr);
        // Add delete button logic for admins
        if (delBtn) {
            delBtn.addEventListener("click", () => {
                if (delBtn.disabled) return;

                if (confirm("Are you sure you want to delete this request?")) {
                    db.requests.splice(realIndex, 1);
                    saveToStorage();

                    showToast("✅ Deleted successfully!", "success");

                    loadRequestsPage();
                }
            });
        }

    });

    // ==============================
    // Render Leave Requests
    // ==============================
    leaveRequests.forEach(req => {
        const realIndex = currentUser.role === "Admin"
            ? db.requests.indexOf(req)
            : null;

        const leaveData = req.items[0]; // Leave stored inside items[0]

        const tr = document.createElement("tr");
        const statusBadge = getStatusBadge(req.status);

        tr.innerHTML = `
            <td>${new Date(req.date).toLocaleString()}</td>
            <td class="admin-only">${req.employeeEmail}</td>
            <td>${leaveData.startDate}</td>
            <td>${leaveData.endDate}</td>
            <td>${leaveData.reason}</td>
            <td>
                ${statusBadge}
                ${currentUser.role === "Admin" ? `
                <select class="form-select form-select-sm mt-2 status-select"
                        data-index="${realIndex}">
                    <option ${req.status === "Pending" ? "selected" : ""}>Pending</option>
                    <option ${req.status === "Approved" ? "selected" : ""}>Approved</option>
                    <option ${req.status === "Rejected" ? "selected" : ""}>Rejected</option>
                </select>
                ` : ""}
            </td>
            ${currentUser.role === "Admin" ? `<td><button class="btn btn-sm btn-danger delete-btn" ${req.status === "Pending" ? "disabled" : ""}>Delete</button></td>` : ""}

        `;
        leaveTbody.appendChild(tr);

        if (currentUser.role === "Admin") {
            const delBtn = tr.querySelector(".delete-btn");

            delBtn.addEventListener("click", () => {
                if (delBtn.disabled) return;

                if (confirm("Are you sure you want to delete this leave request?")) {
                    db.requests.splice(realIndex, 1);
                    saveToStorage();

                    showToast("✅ Deleted successfully!", "success");

                    loadRequestsPage();
                }
            });
        }

    });
}

document.addEventListener("change", function(e) {
    if (e.target.classList.contains("status-select")) {
        const index = e.target.dataset.index;
        const newStatus = e.target.value;

        db.requests[index].status = newStatus;
        saveToStorage();

        loadRequestsPage();
    }
});

document.addEventListener("click", function(e) {
    if (e.target.classList.contains("edit-status-btn")) {
        const index = e.target.dataset.index;

        const newStatus = prompt(
            "Enter new status: Pending, Approved, or Rejected"
        );
        if (!newStatus) return;

        const validStatuses = ["Pending", "Approved", "Rejected"];

        if (!validStatuses.includes(newStatus)) {
            showToast("Invalid status. Please type exactly: Pending, Approved, or Rejected.");
            return;
        }

        db.requests[index].status = newStatus;
        saveToStorage();

        loadRequestsPage();
    }
});

function getStatusBadge(status) {
    if (status === "Pending") return `<span class="badge bg-warning text-dark">Pending</span>`;
    if (status === "Approved") return `<span class="badge bg-success">Approved</span>`;
    if (status === "Rejected") return `<span class="badge bg-danger">Rejected</span>`;
    return status;
}

document.getElementById("add-item-btn")?.addEventListener("click", () => {
    const container = document.getElementById("request-items");

    const div = document.createElement("div");
    div.className = "d-flex mb-2 request-item";

    div.innerHTML = `
        <input type="text" class="form-control me-2 item-name" placeholder="Item Name">
        <input type="number" class="form-control me-2 item-qty" placeholder="Qty" min="1">
        <button type="button" class="btn btn-danger btn-sm remove-item">×</button>
    `;

    container.appendChild(div);
});

document.getElementById("request-items")?.addEventListener("click", function(e) {
    if (e.target.classList.contains("remove-item")) {
        e.target.closest(".request-item").remove();
    }
});

document.getElementById("new-request-btn").addEventListener("click", function() {
    const modalEl = document.getElementById("new-request-modal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    requestTypeSelect.value = "Equipment"; // default
    renderRequestFields("Equipment");
});

document.getElementById("request-form")?.addEventListener("submit", function(e) {
    e.preventDefault();

    const type = document.getElementById("request-type").value;
    let items = [];

    if (type === "Leave") {
        // Leave: get start/end/reason
        const start = document.getElementById("leave-start")?.value;
        const end = document.getElementById("leave-end")?.value;
        const reason = document.getElementById("leave-reason")?.value.trim();

        if (!start || !end || !reason) {
            showToast("Please fill all fields for Leave request.");
            return;
        }

        if (new Date(end) < new Date(start)) {
            showToast("End Date cannot be earlier than Start Date.");
            return;
        }

        items.push({ startDate: start, endDate: end, reason });
    } else {
        // Equipment/Resources: get items from rows
        const itemRows = document.querySelectorAll(".request-item");

        itemRows.forEach(row => {
            const name = row.querySelector(".item-name")?.value.trim();
            const qty = Number(row.querySelector(".item-qty")?.value);

            if (name && qty > 0) items.push({ name, qty });
        });

        if (items.length === 0) {
            showToast("Please add at least one valid item."); // only triggers for Equipment/Resources
            return;
        }
    }
    // Save request
    const newRequest = {
        type,
        items,
        status: "Pending",
        date: new Date().toISOString(),
        employeeEmail: currentUser.email
    };

    db.requests.push(newRequest);
    saveToStorage();

    // Close modal
    const modalEl = document.getElementById("new-request-modal");
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();

    // Reset form
    e.target.reset();
    renderRequestFields("Equipment"); // reset form to default
    loadRequestsPage();
});

const requestTypeSelect = document.getElementById("request-type");
const requestItemsContainer = document.getElementById("request-items");

requestTypeSelect.addEventListener("change", function() {
    const type = this.value;
    renderRequestFields(type);
});

function renderRequestFields(type) {
    const container = document.getElementById("request-items");

    container.innerHTML = ""; // clear old fields

    if (type === "Leave") {
        container.innerHTML = `
            <div class="mb-2">
                <label>Start Date</label>
                <input type="date" class="form-control" id="leave-start" required>
            </div>
            <div class="mb-2">
                <label>End Date</label>
                <input type="date" class="form-control" id="leave-end" required>
            </div>
            <div class="mb-2">
                <label>Reason</label>
                <input type="text" class="form-control" id="leave-reason" placeholder="Reason" required>
            </div>
        `;
        document.getElementById("add-item-btn").style.display = "none";
    } else {
        // Equipment/Resources
        container.innerHTML = `
            <div class="d-flex mb-2 request-item">
                <input type="text" class="form-control me-2 item-name" placeholder="Item Name" required>
                <input type="number" class="form-control me-2 item-qty" placeholder="Qty" min="1" required>
                <button type="button" class="btn btn-danger btn-sm remove-item">×</button>
            </div>
        `;
        document.getElementById("add-item-btn").style.display = "inline-block";
    }
}

function renderRequestsTable(requests, isAdmin = false) {
  const tbody = document.getElementById("requests-table-body");
  tbody.innerHTML = "";

  requests.forEach((req, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${req.date}</td>
      ${isAdmin ? `<td>${req.employee}</td>` : ""}
      <td>${req.type}</td>
      <td>${req.items}</td>
      <td>${req.status}</td>
      ${isAdmin ? `<td><button class="btn btn-sm btn-danger delete-btn">Delete</button></td>` : ""}
    `;

    tbody.appendChild(tr);

    // Delete button logic
    if (isAdmin) {
      const deleteBtn = tr.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete this request?")) {
          requests.splice(index, 1); // remove from array
          renderRequestsTable(requests, isAdmin); // re-render table
        }
      });
    }
  });
}

function renderLeaveRequestsTable(leaveRequests, isAdmin = false) {
  const tbody = document.getElementById("leave-requests-table-body");
  tbody.innerHTML = "";

  leaveRequests.forEach((req, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${req.dateSubmitted}</td>
      ${isAdmin ? `<td>${req.employee}</td>` : ""}
      <td>${req.startDate}</td>
      <td>${req.endDate}</td>
      <td>${req.reason}</td>
      <td>${req.status}</td>
      ${isAdmin ? `<td><button class="btn btn-sm btn-danger delete-btn">Delete</button></td>` : ""}
    `;

    tbody.appendChild(tr);

    if (isAdmin) {
      const deleteBtn = tr.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to delete this leave request?")) {
          leaveRequests.splice(index, 1);
          renderLeaveRequestsTable(leaveRequests, isAdmin);
        }
      });
    }
  });
}


