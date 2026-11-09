
// ==========================================
// ECOSYNC REPORTER DASHBOARD
// ==========================================

const API_BASE_URL = "http://localhost:3000";

const token = sessionStorage.getItem("ecosyncToken");

let reporterReports = [];


async function loadReporterReports() {
    const tableBody = document.getElementById("allReportsTableBody");

    try {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-loading">
                    Loading your reports...
                </td>
            </tr>
        `;

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

        // Store reports safely
        reporterReports = Array.isArray(data.reports)
            ? data.reports
            : [];

        // Display newest reports first
        reporterReports.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        // Update dashboard statistics
        renderReporterStatistics();

        // Update dashboard recent reports
        renderRecentReports();

        // Update complete report history
        renderReportHistory();

        console.log("Reporter reports loaded:", reporterReports);

    } catch (error) {
        console.error("Failed to load reports:", error.message);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="report-table-message">
                        <strong>Unable to load reports</strong>
                        <span>${escapeHTML(error.message)}</span>
                        <button class="report-retry-button"
                            id="retryReportLoading">
                            Try again
                        </button>
                    </div>
                </td>
            </tr>
        `;

        document.getElementById("retryReportLoading")
            .addEventListener("click", loadReporterReports);
    }
}


function renderReporterStatistics() {
    const total = reporterReports.length;

    const pending = reporterReports.filter(
        report => report.status === "pending"
    ).length;

    const active = reporterReports.filter(
        report => ["verified", "assigned"].includes(report.status)
    ).length;

    const collected = reporterReports.filter(
        report => report.status === "collected"
    ).length;

    document.getElementById("totalReports").textContent = total;
    document.getElementById("pendingReports").textContent = pending;
    document.getElementById("activeReports").textContent = active;
    document.getElementById("collectedReports").textContent = collected;
}


function renderRecentReports() {
    const container = document.getElementById("recentReports");

    if (!reporterReports.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">▤</div>
                <strong>No reports yet</strong>
                <span>Your waste reports will appear here when you submit them.</span>
            </div>
        `;
        return;
    }

    const recentReports = reporterReports.slice(0, 5);

    container.innerHTML = `
        <div class="recent-reports-table">
            <div class="recent-reports-header">
                <span>REPORT DETAILS</span>
                <span>WASTE LEVEL</span>
                <span>STATUS</span>
                <span>DATE SUBMITTED</span>
            </div>

            ${recentReports.map(report => {
                const date = new Date(report.createdAt);

                const formattedDate = date.toLocaleDateString(
                    "en-GB",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );

                const statusLabels = {
                    pending: "Pending",
                    verified: "Verified",
                    assigned: "Assigned",
                    collected: "Collected",
                    rejected: "Rejected"
                };

                const description = escapeHTML(
                    report.description || "Waste report"
                );

                const wasteAmount = escapeHTML(
                    report.wasteAmount || "unknown"
                );

                const status = String(report.status || "pending")
                    .toLowerCase();

                return `
                    <div class="recent-report-row">
                        <div class="recent-report-details">
                            <strong>${description}</strong>
                            <small>Report #${escapeHTML(String(report.id))}</small>
                        </div>

                        <div>
                            <span class="waste-level ${wasteAmount.toLowerCase()}">
                                ${wasteAmount.charAt(0).toUpperCase() + wasteAmount.slice(1)}
                            </span>
                        </div>

                        <div>
                            <span class="report-status ${status}">
                                ${statusLabels[status] || "Unknown"}
                            </span>
                        </div>

                        <div class="report-date">
                            ${formattedDate}
                        </div>
                    </div>
                `;
            }).join("")}
        </div>
    `;
}

// ==========================================
// MY REPORTS: SEARCH AND FILTER
// ==========================================

function initializeReportHistory() {
    const searchInput = document.getElementById("reportSearch");
    const statusFilter = document.getElementById("reportStatusFilter");
    const tableBody = document.getElementById("allReportsTableBody");

    searchInput.addEventListener("input", renderReportHistory);
    statusFilter.addEventListener("change", renderReportHistory);

    // Handle View Details buttons
    tableBody.addEventListener("click", event => {
        const button = event.target.closest("[data-report-details]");

        if (!button) return;

        const reportId = button.dataset.reportDetails;

        const report = reporterReports.find(
            item => String(item.id) === String(reportId)
        );

        if (report) {
            openReportDetails(report);
        }
    });
}


// ==========================================
// RENDER REPORT HISTORY TABLE
// ==========================================

function renderReportHistory() {
    const tableBody = document.getElementById("allReportsTableBody");
    const countElement = document.getElementById("reportHistoryCount");
    const resultsInfo = document.getElementById("reportResultsInfo");

    const searchTerm = document
        .getElementById("reportSearch")
        .value.trim().toLowerCase();

    const selectedStatus = document
        .getElementById("reportStatusFilter")
        .value;

    const filteredReports = reporterReports.filter(report => {
        const description = String(report.description || "").toLowerCase();
        const reportId = String(report.id).toLowerCase();

        const matchesSearch =
            description.includes(searchTerm) ||
            reportId.includes(searchTerm);

        const matchesStatus =
            selectedStatus === "all" ||
            report.status === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    countElement.textContent =
        `${reporterReports.length} ${reporterReports.length === 1 ? "report" : "reports"}`;

    // No reports have been submitted
    if (reporterReports.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="report-empty-state">
                        <span class="report-empty-icon">▤</span>
                        <strong>No reports submitted yet</strong>
                        <p>Your submitted waste reports will appear here.</p>
                    </div>
                </td>
            </tr>
        `;

        resultsInfo.textContent = "No submissions to display";
        return;
    }

    // No search/filter matches
    if (filteredReports.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="report-empty-state compact">
                        <strong>No matching reports found</strong>
                        <p>Try another search term or status.</p>
                        <button id="clearReportFilters"
                            class="report-clear-filters">
                            Clear filters
                        </button>
                    </div>
                </td>
            </tr>
        `;

        resultsInfo.textContent = "No matching reports";

        document.getElementById("clearReportFilters")
            .addEventListener("click", () => {
                document.getElementById("reportSearch").value = "";
                document.getElementById("reportStatusFilter").value = "all";
                renderReportHistory();
            });

        return;
    }

    // Display matching reports
    tableBody.innerHTML = filteredReports.map(report => {
        const status = String(report.status || "pending").toLowerCase();
        const waste = String(report.wasteAmount || "unknown").toLowerCase();
        const road = String(report.roadCondition || "unknown").toLowerCase();

        return `
            <tr>
                <td>
                    <div class="report-table-description">
                        <strong>${escapeHTML(report.description || "Waste report")}</strong>
                        <span>Report #${escapeHTML(String(report.id))}</span>
                    </div>
                </td>

                <td>
                    <span class="waste-level ${waste}">
                        ${escapeHTML(waste.charAt(0).toUpperCase() + waste.slice(1))}
                    </span>
                </td>

                <td>
                    <span class="road-condition ${road}">
                        ${escapeHTML(road.charAt(0).toUpperCase() + road.slice(1))}
                    </span>
                </td>

                <td>
                    <span class="report-status ${status}">
                        ${escapeHTML(status.charAt(0).toUpperCase() + status.slice(1))}
                    </span>
                </td>

                <td class="report-table-date">
                    ${formatReportDate(report.createdAt)}
                </td>

                <td>
                    <button
                        type="button"
                        class="report-view-button"
                        data-report-details="${escapeHTML(String(report.id))}">
                        View details →
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    resultsInfo.textContent =
        `Showing ${filteredReports.length} of ${reporterReports.length} reports`;
}


// ==========================================
// REPORT DETAILS
// ==========================================

function openReportDetails(report) {
    let modal = document.getElementById("reportDetailsModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "reportDetailsModal";
        modal.className = "report-details-overlay";

        modal.innerHTML = `
            <section class="report-details-modal">
                <button type="button"
                    class="report-details-close"
                    aria-label="Close details">×</button>

                <div id="reportDetailsContent"></div>
            </section>
        `;

        document.body.appendChild(modal);

        modal.querySelector(".report-details-close")
            .addEventListener("click", closeReportDetails);

        modal.addEventListener("click", event => {
            if (event.target === modal) closeReportDetails();
        });
    }

    const status = String(report.status || "pending");
    const waste = String(report.wasteAmount || "unknown");
    const road = String(report.roadCondition || "unknown");

    document.getElementById("reportDetailsContent").innerHTML = `
        <span class="section-eyebrow">SUBMISSION DETAILS</span>

        <h2>Report #${escapeHTML(String(report.id))}</h2>

        <p class="report-details-intro">
            Review the information associated with this report.
        </p>

        <div class="report-details-status-row">
            <span class="report-status ${escapeHTML(status)}">
                ${escapeHTML(status)}
            </span>

            <span class="report-details-date">
                Submitted ${formatReportDate(report.createdAt)}
            </span>
        </div>

        <div class="report-details-description">
            <span>DESCRIPTION</span>
            <p>${escapeHTML(report.description || "No description provided.")}</p>
        </div>

        <div class="report-details-grid">
            <div>
                <span>WASTE LEVEL</span>
                <strong>${escapeHTML(waste)}</strong>
            </div>

            <div>
                <span>ROAD CONDITION</span>
                <strong>${escapeHTML(road)}</strong>
            </div>

            <div>
                <span>LATITUDE</span>
                <strong>${formatCoordinate(report.latitude)}</strong>
            </div>

            <div>
                <span>LONGITUDE</span>
                <strong>${formatCoordinate(report.longitude)}</strong>
            </div>
        </div>

        <button type="button"
            class="report-details-done"
            id="closeReportDetailsButton">
            Close details
        </button>
    `;

    modal.classList.add("active");
    document.body.classList.add("modal-open");

    document.getElementById("closeReportDetailsButton")
        .addEventListener("click", closeReportDetails);
}


function closeReportDetails() {
    document.getElementById("reportDetailsModal")
        ?.classList.remove("active");

    document.body.classList.remove("modal-open");
}


// ==========================================
// DATE AND COORDINATE HELPERS
// ==========================================

function formatReportDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function formatCoordinate(value) {
    if (value === null || value === undefined || value === "") {
        return "Not available";
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number.toFixed(5)
        : "Not available";
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
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

       initializeReportHistory();


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
