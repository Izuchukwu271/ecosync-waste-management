
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
