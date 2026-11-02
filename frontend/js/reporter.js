
// ==========================================
// ECOSYNC REPORTER DASHBOARD
// ==========================================

const API_BASE_URL = "http://localhost:3000";

const token = sessionStorage.getItem("ecosyncToken");

let reporterReports = [];

async function loadReporterReports() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/reports`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load reports.");
        }

        reporterReports = data.reports;

        console.log("Reporter reports loaded:", reporterReports);

    } catch (error) {
        console.error("Failed to load reports:", error.message);
    }
}

// ==========================================
// 1. AUTHENTICATION PROTECTION
// ==========================================

async function verifyReporterSession() {
    if (!token) {
        window.location.replace("index.html");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Session verification failed.");
        }

        const user = data.user;

        // Only reporters can access this dashboard
        if (user.role !== "reporter") {
            alert("You do not have permission to access this dashboard.");
            window.location.replace("index.html");
            return;
        }

        // Display authenticated user information
        displayUserInformation(user);

       await loadReporterReports();


        // Start dashboard interactions
        initializeNavigation();

    } catch (error) {
        console.error("Session verification failed:", error.message);

        sessionStorage.removeItem("ecosyncToken");
        sessionStorage.removeItem("ecosyncUser");

        window.location.replace("index.html");
    }
}

// ==========================================
// 2. DISPLAY USER INFORMATION
// ==========================================

function displayUserInformation(user) {
    const firstName = user.fullName.split(" ")[0];

    const userName = document.getElementById("userName");
    const userAvatar = document.getElementById("userAvatar");
    const welcomeTitle = document.getElementById("welcomeTitle");

    userName.textContent = user.fullName;

    userAvatar.textContent = user.fullName
        .trim()
        .charAt(0)
        .toUpperCase();

    welcomeTitle.textContent = `Welcome back, ${firstName}!`;

    // Keep verified user information available for this session
    sessionStorage.setItem("ecosyncUser", JSON.stringify(user));
}

// ==========================================
// 3. SIDEBAR NAVIGATION
// ==========================================

function initializeNavigation() {
    const navigationLinks = document.querySelectorAll(".nav-link");
    const dashboardPages = document.querySelectorAll(".dashboard-page");

    const breadcrumbTitle = document.getElementById("breadcrumbTitle");

    function navigateToPage(pageName) {
        const targetPage = document.getElementById(`${pageName}Page`);

        if (!targetPage) return;

        // Hide all dashboard pages
        dashboardPages.forEach(page => {
            page.classList.remove("active");
        });

        // Display selected page
        targetPage.classList.add("active");

        // Update active sidebar link
        navigationLinks.forEach(link => {
            link.classList.toggle(
                "active",
                link.dataset.page === pageName
            );
        });

        // Update breadcrumb
        breadcrumbTitle.textContent =
            pageName.replace(/-/g, " ").replace(/\b\w/g, letter =>
                letter.toUpperCase()
            );

        // Update browser URL hash
        window.location.hash = pageName;

        // Close mobile sidebar after navigation
        document.getElementById("sidebar").classList.remove("open");
    }

    // Sidebar navigation links
    navigationLinks.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            navigateToPage(link.dataset.page);
        });
    });

    // Dashboard quick-action buttons
    document.querySelectorAll("[data-navigate]").forEach(button => {
        button.addEventListener("click", () => {
            navigateToPage(button.dataset.navigate);
        });
    });

    // Support browser back/forward navigation
    window.addEventListener("hashchange", () => {
        const pageName = window.location.hash.replace("#", "");

        if (pageName) {
            navigateToPage(pageName);
        }
    });

    // Open the requested page or default to overview
    const initialPage = window.location.hash.replace("#", "");

    navigateToPage(initialPage || "overview");
}

// ==========================================
// 4. MOBILE SIDEBAR
// ==========================================

const menuButton = document.getElementById("menuButton");
const sidebar = document.getElementById("sidebar");

menuButton.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

// ==========================================
// 5. LOGOUT
// ==========================================

const logoutButton = document.getElementById("logoutButton");
const logoutModal = document.getElementById("logoutModal");
const cancelLogout = document.getElementById("cancelLogout");
const confirmLogout = document.getElementById("confirmLogout");

// Open confirmation modal
logoutButton.addEventListener("click", () => {
    logoutModal.classList.add("active");
});

// Cancel logout
cancelLogout.addEventListener("click", () => {
    logoutModal.classList.remove("active");
});

// Confirm logout
confirmLogout.addEventListener("click", () => {
    sessionStorage.removeItem("ecosyncToken");
    sessionStorage.removeItem("ecosyncUser");

    window.location.replace("index.html");
});

// Close modal when clicking outside it
logoutModal.addEventListener("click", (event) => {
    if (event.target === logoutModal) {
        logoutModal.classList.remove("active");
    }
});

// ==========================================
// 6. START APPLICATION
// ==========================================

verifyReporterSession();
