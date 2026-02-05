const API_FALLBACK = "https://6dgvos0k8a.execute-api.us-east-1.amazonaws.com/prod/API";
let allUsers = [];
let joinChart;
let activityChart;
let confirmationData = null;

const $ = (id) => document.getElementById(id);
const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const getAdminEmail = () => normalizeEmail(localStorage.getItem("fitmentorUserId"));
const isAdminRow = (user) => {
    const email = normalizeEmail(user?.email);
    const username = normalizeEmail(user?.username);
    const currentUserId = getAdminEmail();
    return email === currentUserId || username === currentUserId;
};
const notify = (msg, { variant = "danger", durationMs = 3000 } = {}) => {
    if (typeof showToast === "function") showToast(msg, { variant, durationMs });
    else alert(msg);
};

document.addEventListener("DOMContentLoaded", () => {
    const userRole = localStorage.getItem("fitmentorRole") || "";
    if (userRole !== "Admin") {
        alert("אין לך הרשאה לצפות בדף זה.");
        window.location.href = "index.html";
        return;
    }
    setupSearch();
    loadAdminDashboard();
});

async function adminApiRequest(action, userId, payload = {}) {
    const url = (typeof AUTH_URL !== "undefined" && AUTH_URL) || API_FALLBACK;
    const token = localStorage.getItem("fitmentorToken");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ action, userId, payload })
    });

    const raw = await response.text().catch(() => "");
    let data = {};
    if (raw) {
        try { data = JSON.parse(raw); } catch { data = { rawText: raw }; }
    }

    if (!response.ok) {
        const msg = data.message || data.error || data.rawText || `Request failed: ${response.status}`;
        const err = new Error(msg);
        err.status = response.status;
        err.data = data;
        throw err;
    }

    return data;
}

function fmtNumber(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "--";
    try { return n.toLocaleString(); } catch { return String(n); }
}

function safeDateFromYmd(ymd) {
    const s = String(ymd || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function safeDateFromYm(ym) {
    const s = String(ym || "").trim();
    if (!/^\d{4}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}-01T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatHebrewWeekdayLabelFromYmd(ymd) {
    const d = safeDateFromYmd(ymd);
    if (!d) return String(ymd || "");
    try {
        return new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(d);
    } catch {
        return String(ymd || "");
    }
}

function formatHebrewMonthLabelFromYm(ym) {
    const d = safeDateFromYm(ym);
    if (!d) return String(ym || "");
    try {
        return new Intl.DateTimeFormat("he-IL", { month: "long", timeZone: "Asia/Jerusalem" }).format(d);
    } catch {
        return String(ym || "");
    }
}

async function loadAdminDashboard() {
    try {
        ["statUsers", "statActive", "statWorkouts", "statAi"].forEach((id) => {
            const el = $(id);
            if (el) el.textContent = "...";
        });

        const data = await adminApiRequest("adminGetDashboardData", getAdminEmail(), { limit: 200 });

        const stats = data?.stats || {};
        if ($("statUsers")) $("statUsers").textContent = fmtNumber(stats.usersRegistered || 0);
        if ($("statActive")) $("statActive").textContent = fmtNumber(stats.activeToday);
        if ($("statWorkouts")) $("statWorkouts").textContent = fmtNumber(stats.workoutsSaved);
        if ($("statAi")) $("statAi").textContent = fmtNumber(stats.aiCallsTotal);

        allUsers = Array.isArray(data?.users) ? data.users : [];
        allUsers = allUsers.filter(u => !isAdminRow(u));
        renderTable(allUsers);

        initCharts(data?.charts);

    } catch (e) {
        console.error("Admin dashboard load failed:", e);
        notify("שגיאה בטעינת נתוני אדמין", { variant: "danger", durationMs: 3500 });
        ["statUsers", "statActive", "statWorkouts", "statAi"].forEach((id) => {
            const el = $(id);
            if (el) el.textContent = "--";
        });
    }
}

function renderTable(users) {
    const tbody = $("usersTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";

    users.forEach((user) => {
        if (isAdminRow(user)) return;

        const tr = document.createElement("tr");
        const status = String(user.status || "active");
        const statusClass = status === "active" ? "status-active" : (status === "unconfirmed" ? "status-unconfirmed" : "status-blocked");
        const statusText = status === "active" ? "פעיל" : (status === "unconfirmed" ? "לא מאומת" : "חסום");

        const isUnconfirmed = status === "unconfirmed";
        const btnAction = isUnconfirmed
            ? `<button class="btn-action btn-disabled" disabled>לא ניתן</button>`
            : (status === "active"
                ? `<button class="btn-action btn-block" onclick="toggleUserStatus('${String(user.username || "")}')">חסום משתמש</button>`
                : `<button class="btn-action btn-activate" onclick="toggleUserStatus('${String(user.username || "")}')">הפעל משתמש</button>`);

        tr.innerHTML = `
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td dir="ltr">${user.joined}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${btnAction}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function toggleUserStatus(username) {
    const user = allUsers.find(u => String(u.username || "") === String(username || ""));
    if (!user) return;

    if (isAdminRow(user)) return notify("לא ניתן לשנות סטטוס למשתמש אדמין", { variant: "danger", durationMs: 3200 });

    const isActive = String(user.status) === "active";
    const nextBlocked = isActive;

    if (nextBlocked) {
        showBlockConfirmation(user.username, user.name);
        return;
    }

    try {
        await adminApiRequest("adminSetUserBlocked", getAdminEmail(), { username: user.username, blocked: nextBlocked });
        notify(`המשתמש ${user.email} הופעל בהצלחה`, { variant: "success", durationMs: 2500 });
        await loadAdminDashboard();
    } catch (e) {
        console.error("Failed to update user status:", e);
        notify("שגיאה בעדכון סטטוס משתמש", { variant: "danger", durationMs: 3500 });
    }
}
function showBlockConfirmation(username, userName) {
    confirmationData = { username, userName };
    
    let modal = $("confirmBlockModal");
    if (!modal) {
        const div = document.createElement("div");
        div.id = "confirmBlockModal";
        div.className = "confirmation-modal-overlay";
        div.innerHTML = `
            <div class="confirmation-modal">
                <div class="confirmation-header">
                    <span class="confirmation-icon">⚠️</span>
                    <h3>אישור חסימת משתמש</h3>
                </div>
                <div class="confirmation-body">
                    <p id="confirmBlockMessage">האם אתה בטוח שברצונך לחסום את <strong>${userName}</strong>?</p>
                    <p class="confirmation-note">לאחר חסימה, המשתמש לא יוכל להתחבר למערכת.</p>
                </div>
                <div class="confirmation-footer">
                    <button class="btn-cancel" onclick="cancelBlockConfirmation()">ביטול</button>
                    <button class="btn-confirm-danger" onclick="confirmBlockUser()">חסום משתמש</button>
                </div>
            </div>
        `;
        document.body.appendChild(div);
        modal = div;
    } else {
        const msg = $("confirmBlockMessage");
        if (msg) msg.innerHTML = `האם אתה בטוח שברצונך לחסום את <strong>${userName}</strong>?`;
    }
    if (modal) modal.style.display = "flex";
}

function cancelBlockConfirmation() {
    const modal = $("confirmBlockModal");
    if (modal) modal.style.display = "none";
    confirmationData = null;
}

async function confirmBlockUser() {
    if (!confirmationData) return;
    
    const modal = $("confirmBlockModal");
    if (modal) modal.style.display = "none";
    
    const { username } = confirmationData;
    const user = allUsers.find(u => String(u.username || "") === String(username || ""));
    if (!user) return;

    try {
        await adminApiRequest("adminSetUserBlocked", getAdminEmail(), { username: user.username, blocked: true });
        notify(`המשתמש ${user.email} נחסם בהצלחה`, { variant: "success", durationMs: 2500 });
        await loadAdminDashboard();
    } catch (e) {
        console.error("Failed to block user:", e);
        notify("שגיאה בחסימת משתמש", { variant: "danger", durationMs: 3500 });
    }
    
    confirmationData = null;
}
function setupSearch() {
    const input = $("userSearch");
    if (!input) return;
    input.addEventListener("input", (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u => 
            String(u.name || "").toLowerCase().includes(term) || 
            String(u.email || "").toLowerCase().includes(term)
        );
        renderTable(filtered);
    });
}

function initCharts(charts) {
    const join = charts?.joinTrend || {};
    const daily = charts?.dailyActivity || {};

    const joinLabels = Array.isArray(join.labels) ? join.labels : [];
    const joinData = Array.isArray(join.data) ? join.data : [];
    const dailyLabels = Array.isArray(daily.labels) ? daily.labels : [];
    const dailyData = Array.isArray(daily.data) ? daily.data : [];

    const joinLabelsPretty = joinLabels.map(formatHebrewMonthLabelFromYm);
    const dailyLabelsPretty = dailyLabels.map(formatHebrewWeekdayLabelFromYmd);

    if (joinChart) { try { joinChart.destroy(); } catch {} joinChart = undefined; }
    if (activityChart) { try { activityChart.destroy(); } catch {} activityChart = undefined; }

    const ctx1 = document.getElementById("chartJoinTrend");
    if (ctx1) {
        joinChart = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: joinLabelsPretty,
                datasets: [{
                    label: 'מצטרפים חדשים',
                    data: joinData,
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }

    const ctx2 = document.getElementById("chartDailyActivity");
    if (ctx2) {
        activityChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: dailyLabelsPretty,
                datasets: [{
                    label: 'משתמשים פעילים',
                    data: dailyData,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
}
