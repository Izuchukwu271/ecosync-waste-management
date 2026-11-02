// ==========================================
// ECOSYNC API CONFIGURATION
// ==========================================

const API_BASE_URL = "http://localhost:3000";
// ==========================================
// ECOSYNC - AUTHENTICATION PAGE
// ==========================================

// Get the HTML elements
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");

const switchText = document.getElementById("switchText");
const switchAuthButton = document.getElementById("switchAuth");

// Track which form is currently displayed
let currentMode = "login";

// ==========================================
// 1. SWITCH BETWEEN LOGIN AND REGISTRATION
// ==========================================

switchAuthButton.addEventListener("click", () => {
    if (currentMode === "login") {
        showRegisterForm();
    } else {
        showLoginForm();
    }
});

function showRegisterForm() {
    currentMode = "register";

    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");

    authTitle.textContent = "Create your account";

    authSubtitle.textContent =
        "Join EcoSync and help build cleaner communities.";

    switchText.textContent = "Already have an account?";

    switchAuthButton.textContent = "Sign in";

    clearMessages();
}

function showLoginForm() {
    currentMode = "login";

    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");

    authTitle.textContent = "Welcome back";

    authSubtitle.textContent =
        "Sign in to continue to your EcoSync account.";

    switchText.textContent = "Don't have an account?";

    switchAuthButton.textContent = "Create account";

    clearMessages();
}

// ==========================================
// 2. SHOW AND HIDE PASSWORD
// ==========================================

const passwordToggleButtons = document.querySelectorAll(
    ".password-toggle"
);

passwordToggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const targetId = button.dataset.target;
        const passwordInput = document.getElementById(targetId);

        if (!passwordInput) return;

        const isPasswordHidden =
            passwordInput.type === "password";

        passwordInput.type = isPasswordHidden ? "text" : "password";

        button.textContent = isPasswordHidden ? "Hide" : "Show";

        button.setAttribute(
            "aria-label",
            isPasswordHidden ? "Hide password" : "Show password"
        );
    });
});

// ==========================================
// 3. CLEAR FORM MESSAGES
// ==========================================

function clearMessages() {
    document.getElementById("loginMessage").textContent = "";
    document.getElementById("registerMessage").textContent = "";
}

// ==========================================
// API REQUEST HANDLER
// ==========================================

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}


// ==========================================
// 4. USER REGISTRATION
// ==========================================

const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");

const registerMessage = document.getElementById("registerMessage");

const registerButton = registerForm.querySelector(
    'button[type="submit"]'
);

// Display registration messages
function showRegisterMessage(message, type) {
    registerMessage.textContent = message;
    registerMessage.className = `form-message ${type}`;
}

// Handle registration submission
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Clear previous message
    showRegisterMessage("", "");

    // Collect form information
    const fullName = registerName.value.trim();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;

    // Basic frontend validation
    if (fullName.length < 2 || fullName.length > 150) {
        showRegisterMessage(
            "Your name must contain between 2 and 150 characters.",
            "error"
        );
        return;
    }

    if (password.length < 12 || password.length > 72) {
        showRegisterMessage(
            "Your password must contain between 12 and 72 characters.",
            "error"
        );
        return;
    }

    // Prevent repeated submissions
    registerButton.disabled = true;

    const originalButtonText =
        registerButton.querySelector("span").textContent;

    registerButton.querySelector("span").textContent =
        "Creating account...";

    try {
        // Send registration data to Express API
        const result = await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                fullName,
                email,
                password
            })
        });

        showRegisterMessage(
            result.message + ". You can now sign in.",
            "success"
        );

        // Clear registration fields
        registerForm.reset();

        // Switch to login after successful registration
        registerButton.querySelector("span").textContent =
            "Account created!";

        setTimeout(() => {
            showLoginForm();

            // Pre-fill the email address
            document.getElementById("loginEmail").value = email;
        }, 1500);

    } catch (error) {
        showRegisterMessage(error.message, "error");

    } finally {
        registerButton.disabled = false;

        if (registerButton.querySelector("span")) {
            registerButton.querySelector("span").textContent =
                originalButtonText;
        }
    }
});


// ==========================================
// 5. USER LOGIN
// ==========================================

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const loginMessage = document.getElementById("loginMessage");

const loginButton = loginForm.querySelector(
    'button[type="submit"]'
);

// Display login messages
function showLoginMessage(message, type) {
    loginMessage.textContent = message;
    loginMessage.className = `form-message ${type}`;
}

// Handle login submission
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showLoginMessage("", "");

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
        showLoginMessage(
            "Please enter your email and password.",
            "error"
        );
        return;
    }

    // Prevent multiple submissions
    loginButton.disabled = true;

    const originalButtonText =
        loginButton.querySelector("span").textContent;

    loginButton.querySelector("span").textContent =
        "Signing in...";

    try {
        // 1. Send login credentials to the backend
        const result = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });

        // 2. Save the JWT for this browser session
        sessionStorage.setItem("ecosyncToken", result.token);

        setTimeout(() => {
        window.location.href = "reporter.html";
        }, 1000);

        // 3. Verify the token with the backend
        const profile = await apiRequest("/api/auth/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${result.token}`
            }
        });

        // 4. Save the verified user information
        sessionStorage.setItem(
            "ecosyncUser",
            JSON.stringify(profile.user)
        );

        // 5. Display a successful login message
        showLoginMessage(
            `Welcome back, ${profile.user.fullName}! Authentication successful.`,
            "success"
        );

        // Clear the password field
        loginPassword.value = "";

        console.log("Authenticated EcoSync user:", profile.user);

    } catch (error) {
        // Remove any incomplete session
        sessionStorage.removeItem("ecosyncToken");
        sessionStorage.removeItem("ecosyncUser");

        showLoginMessage(error.message, "error");

    } finally {
        loginButton.disabled = false;

        loginButton.querySelector("span").textContent =
            originalButtonText;
    }
});

