const modal = document.getElementById("registerModal");
const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");
const registeringView = document.getElementById("registeringView");
const registeringTitle = document.getElementById("registeringTitle");
const registeringSubtitle = document.getElementById("registeringSubtitle");
const registerStatusIndicator = document.getElementById("registerStatusIndicator");
const closeBtn = document.querySelector("#registerModal .close-btn");

const API_BASE_URL = "https://6dgvos0k8a.execute-api.us-east-1.amazonaws.com/prod";
const AUTH_URL = `${API_BASE_URL}/API`;       
const DASHBOARD_URL = `${API_BASE_URL}/Dashboard`; 
const TRAINING_LOG_URL = `${API_BASE_URL}/TrainingLog`; 
const PROGRESS_URL = `${API_BASE_URL}/Progress`; 

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_VALIDATION_MESSAGE = "האימייל צריך להיות בצורה הזאת: example@email.com";
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const PASSWORD_VALIDATION_MESSAGE = "הסיסמה חייבת להכיל לפחות 8 תווים, לפחות אות גדולה אחת ולפחות מספר אחד";

function fmNormalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
    const json = atob(b64);
    const utf8 = decodeURIComponent(
      Array.prototype.map
        .call(json, (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}

function extractDisplayNameFromIdToken(idToken) {
  const payload = decodeJwtPayload(idToken);
  if (!payload || typeof payload !== "object") return "";
  const name = payload.name || payload.given_name || payload["cognito:username"] || "";
  return typeof name === "string" ? name.trim() : "";
}


async function apiRequest(action, userId, payload = {}) {
  let targetUrl = DASHBOARD_URL; 
  
  if (["login", "register", "confirmRegister", "resendCode", "forgotPassword", "confirmForgotPassword"].includes(action)) {
    targetUrl = AUTH_URL; 
  } else if (["saveWorkoutLog", "getWorkoutLog", "deleteWorkoutLog"].includes(action)) {
    targetUrl = TRAINING_LOG_URL; 
  } else if (["getProgressData"].includes(action)) {
    targetUrl = PROGRESS_URL; 
  }

  console.log(`Sending ${action} request to: ${targetUrl}`);

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, userId, payload }),
  });

  const rawText = await response.text().catch(() => "");
  const data = (() => {
    if (!rawText) return {};
    try {
      return JSON.parse(rawText);
    } catch {
      return { rawText };
    }
  })();

  console.log(`Response ${action}:`, response.status, data);
  if (!response.ok) {
    const message = data.message || data.error || data.rawText || `Request failed: ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

function formatApiError(err, fallbackMessage) {
  const status = err?.status ? ` (${err.status})` : "";
  const msg = err?.data?.message || err?.data?.error || err?.message || fallbackMessage;
  return `${msg}${status}`;
}

async function apiRequestWithFallback(actions, userId, payload = {}) {
  let lastErr;
  for (const action of actions) {
    try {
      return await apiRequest(action, userId, payload);
    } catch (e) {
      lastErr = e;
      const status = e?.status;
      if (status && ![400, 404].includes(Number(status))) {
        throw e;
      }
    }
  }
  throw lastErr;
}


function resetLoginForm() {
  const loginEmailEl = document.getElementById("loginEmail");
  const loginPasswordEl = document.getElementById("loginPassword");
  if (loginEmailEl) { loginEmailEl.value = ""; loginEmailEl.setCustomValidity(""); }
  if (loginPasswordEl) { loginPasswordEl.value = ""; loginPasswordEl.setCustomValidity(""); }
}

function isUserLoggedIn() {
  try { return localStorage.getItem("fitmentorIsLoggedIn") === "1"; } catch { return false; }
}

function setLoginModalSubtitle(message) {
  const loginViewEl = document.getElementById("loginView");
  const subtitleEl = loginViewEl?.querySelector(".modal-subtitle");
  if (subtitleEl && typeof message === "string" && message.trim().length > 0) {
    subtitleEl.textContent = message;
  }
}

function openLoginModal(message = "נדרשת התחברות") {
  if (!modal) return;
  openModal();
  showLoginView();
  setLoginModalSubtitle(message);
}

function updateNavGreeting() {
  const userGreeting = document.getElementById("userGreeting");
  const authBtn = document.getElementById("authNavButton");
  const dashboardBtn = document.getElementById("dashboardNavButton");

  let isLoggedIn = false;
  let userName = "";
  try {
    isLoggedIn = localStorage.getItem("fitmentorIsLoggedIn") === "1";
    userName = localStorage.getItem("fitmentorUserName") || "";
  } catch { isLoggedIn = false; userName = ""; }

  if (userGreeting) userGreeting.textContent = isLoggedIn ? `שלום${userName ? " " + userName : ""}` : "";
  if (authBtn) {
    authBtn.textContent = isLoggedIn ? "התנתקות" : "הרשמה / התחברות";
    authBtn.classList.toggle("btn-nav-logout", isLoggedIn);
  }
  if (dashboardBtn) dashboardBtn.classList.toggle("hidden", !isLoggedIn);
}

function navigateToPage(fileName) {
  const url = new URL(window.location.href);
  const cleanFile = String(fileName || "").replace(/^\/+/g, "").replace(/\\/g, "/");
  const currentPath = url.pathname || "/";

  let targetPath = "";
  if (cleanFile.toLowerCase().startsWith("html/")) {
    targetPath = `/${cleanFile}`;
  } else if (currentPath.includes("/Html/")) {
    targetPath = currentPath.replace(/\/Html\/[^/]*$/, `/Html/${cleanFile}`);
  } else if (currentPath.endsWith("/Html")) {
    targetPath = `${currentPath}/${cleanFile}`;
  } else {
    targetPath = `/Html/${cleanFile}`;
  }

  url.pathname = targetPath;
  url.search = "";
  window.location.href = url.toString();
}

function showToast(message, { variant = "info", durationMs = 2200 } = {}) {
  try {
    const existing = document.getElementById("fitmentorToast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "fitmentorToast";
    toast.className = `toast${variant === "danger" ? " is-danger" : ""}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), durationMs);
  } catch {}
}

function blockUi(message = "מתנתק...", subtitle = "מעביר אותך לדף הבית") {
  try {
    if (document.getElementById("fitmentorBlockUi")) return;

    const overlay = document.createElement("div");
    overlay.id = "fitmentorBlockUi";
    overlay.setAttribute("role", "alert");
    overlay.setAttribute("aria-live", "assertive");

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "99999";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "24px";
    overlay.style.background = "rgba(0, 0, 0, 0.8)";
    overlay.style.backdropFilter = "blur(5px)";
    overlay.style.color = "var(--text-main, #f8fafc)";
    overlay.style.pointerEvents = "auto";
    overlay.style.userSelect = "none";

    overlay.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    overlay.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    overlay.addEventListener("mouseup", (e) => { e.preventDefault(); e.stopPropagation(); }, true);
    overlay.addEventListener("touchstart", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, passive: false });
    overlay.addEventListener("touchmove", (e) => { e.preventDefault(); e.stopPropagation(); }, { capture: true, passive: false });

    const toastEl = document.createElement("div");
    toastEl.className = "toast is-danger";
    toastEl.style.position = "static";
    toastEl.style.top = "auto";
    toastEl.style.left = "auto";
    toastEl.style.transform = "none";
    toastEl.style.margin = "0 auto";

    const titleEl = document.createElement("div");
    titleEl.textContent = message;
    titleEl.style.fontWeight = "900";

    toastEl.appendChild(titleEl);

    if (subtitle) {
      const subEl = document.createElement("div");
      subEl.textContent = subtitle;
      subEl.style.marginTop = "6px";
      subEl.style.color = "var(--text-muted, #cbd5e1)";
      subEl.style.fontWeight = "600";
      toastEl.appendChild(subEl);
    }

    overlay.appendChild(toastEl);
    document.body.appendChild(overlay);

    document.body.style.overflow = "hidden";
  } catch {}
}

function requestLogout() {
  blockUi("מתנתק...", "מעביר אותך לדף הבית");
  logoutUser();
  const waitMs = 1200;
  window.setTimeout(() => {
    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
      window.location.reload();
    } else {
      navigateToPage("index.html");
    }
  }, waitMs);
}

function logoutUser() {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.toLowerCase().startsWith("fitmentor")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.error("Error clearing localStorage:", e);
  }
  updateNavGreeting();
}

function redirectGuestsToIndex(message = "נדרשת התחברות") {
  try { sessionStorage.setItem("fitmentorLoginReason", message); } catch {}
  const url = new URL(window.location.href);
  url.pathname = url.pathname.replace(/[^/]*$/, "index.html");
  url.searchParams.set("login", "1");
  window.location.href = url.toString();
}

function enforceAuthOrRedirect(message = "נדרשת התחברות") {
  if (isUserLoggedIn()) return true;
  redirectGuestsToIndex(message);
  return false;
}

function resetRegisterForm() {
  const regNameEl = document.getElementById("regName");
  const regEmailEl = document.getElementById("regEmail");
  const regPasswordEl = document.getElementById("regPassword");
  if (regNameEl) regNameEl.value = "";
  if (regEmailEl) { regEmailEl.value = ""; regEmailEl.setCustomValidity(""); }
  if (regPasswordEl) { regPasswordEl.value = ""; regPasswordEl.setCustomValidity(""); }
}

function showRegisteringView(title = "ההרשמה מתחילה...", subtitle = "") {
  if (loginView) loginView.style.display = "none";
  if (registerView) registerView.style.display = "none";
  if (registeringView) registeringView.style.display = "block";
  if (closeBtn) closeBtn.style.display = "none";
  if (registeringView) registeringView.classList.remove("registering-fade-out");
  if (registeringTitle) registeringTitle.textContent = title;
  if (registeringSubtitle) registeringSubtitle.textContent = subtitle;
  if (registerStatusIndicator) {
    registerStatusIndicator.classList.remove("is-success", "is-error");
    registerStatusIndicator.classList.add("is-loading");
  }
}

function hideRegisteringView() {
  if (registeringView) registeringView.style.display = "none";
  if (closeBtn) closeBtn.style.display = "";
}

function validateEmailField(emailEl) {
  if (!emailEl) return false;
  const value = emailEl.value.trim();
  if (value.length === 0) { emailEl.setCustomValidity("נא להזין אימייל"); return false; }
  const isValid = EMAIL_REGEX.test(value);
  emailEl.setCustomValidity(isValid ? "" : EMAIL_VALIDATION_MESSAGE);
  return isValid;
}

function validatePasswordField(passwordEl) {
  if (!passwordEl) return false;
  const value = passwordEl.value;
  if (value.length === 0) { passwordEl.setCustomValidity("נא להזין סיסמה"); return false; }
  const isValid = PASSWORD_REGEX.test(value);
  passwordEl.setCustomValidity(isValid ? "" : PASSWORD_VALIDATION_MESSAGE);
  return isValid;
}

function setupEmailValidationPopups() {
  const loginEmailEl = document.getElementById("loginEmail");
  const regEmailEl = document.getElementById("regEmail");
  [loginEmailEl, regEmailEl].forEach((emailEl) => {
    if (!emailEl) return;
    emailEl.addEventListener("input", () => { validateEmailField(emailEl); });
    emailEl.addEventListener("blur", () => { validateEmailField(emailEl); });
  });
}

function setupPasswordValidationPopups() {
  const loginPasswordEl = document.getElementById("loginPassword");
  const regPasswordEl = document.getElementById("regPassword");
  [loginPasswordEl, regPasswordEl].forEach((passwordEl) => {
    if (!passwordEl) return;
    passwordEl.addEventListener("input", () => { validatePasswordField(passwordEl); });
    passwordEl.addEventListener("blur", () => { validatePasswordField(passwordEl); });
  });
}

async function handleLogin() {
  const loginEmailEl = document.getElementById("loginEmail");
  const loginPasswordEl = document.getElementById("loginPassword");
  const btn = document.querySelector("#loginView .btn-register-action");

  if (!validateEmailField(loginEmailEl)) { loginEmailEl.reportValidity(); return; }
  if (!validatePasswordField(loginPasswordEl)) { loginPasswordEl.reportValidity(); return; }

  const emailInput = fmNormalizeEmail(loginEmailEl.value);
  const passwordInput = loginPasswordEl.value;
  const originalText = btn ? btn.innerText : "התחברות";
  if (btn) {
    btn.innerText = "מתחבר...";
    btn.disabled = true;
  }
  showRegisteringView("מתחבר...", "");

  try {
    const data = await apiRequest("login", emailInput, { password: passwordInput });

    const idToken = data?.token;
    const displayName = extractDisplayNameFromIdToken(idToken);

    try {
        localStorage.setItem("fitmentorIsLoggedIn", "1");
        localStorage.setItem("fitmentorUserId", emailInput);
      localStorage.setItem("fitmentorUserName", displayName || data.userName || "משתמש");
      if (idToken) localStorage.setItem("fitmentorToken", idToken);
      if (data.role) localStorage.setItem("fitmentorRole", data.role);
    } catch (e) {
      console.error("Error saving login session:", e);
    }

    updateNavGreeting();
    if (registeringTitle) registeringTitle.textContent = "התחברת בהצלחה!";
    if (registeringSubtitle) registeringSubtitle.textContent = (data.role === "Admin") ? "מעביר אותך לדשבורד אדמין..." : "מעביר אותך לדשבורד...";
    if (registerStatusIndicator) {
        registerStatusIndicator.classList.remove("is-loading", "is-error");
        registerStatusIndicator.classList.add("is-success");
    }

    const popupHoldMs = 2250;
    const fadeMs = 450;
    setTimeout(() => { if (registeringView) registeringView.classList.add("registering-fade-out"); }, popupHoldMs);
    setTimeout(() => {
        closeModal();
        showLoginView();
        if (registeringView) registeringView.classList.remove("registering-fade-out");

        if (data.role === "Admin") {
          navigateToPage("admindashboard.html");
        } else {
          navigateToPage("dashboard.html");
        }
    }, popupHoldMs + fadeMs);

  } catch (error) {
    console.error("Login Error:", error);
    let message = "שם משתמש אן סיסמא שגויים";
    
    if (error.data && error.data.message) {
        message = error.data.message;
    } else if (error.status === 401) {
      message = "אימייל או סיסמה לא נכונים";
    } else if (error.status === 404) {
      message = "משתמש זה לא קיים במערכת";
    } else if (error.status === 403) {
        message = "נדרש אימות אימייל";
    }

    if (registeringTitle) registeringTitle.textContent = message;
    if (registeringSubtitle) registeringSubtitle.textContent = "";
    if (registerStatusIndicator) {
        registerStatusIndicator.classList.remove("is-loading", "is-success");
        registerStatusIndicator.classList.add("is-error");
    }

    const popupHoldMs = 2250;
    const fadeMs = 450;
    setTimeout(() => { if (registeringView) registeringView.classList.add("registering-fade-out"); }, popupHoldMs);
    setTimeout(() => {
        if (error.status === 403) {
             showLoginView();
             showToast("המשתמש טרם אומת. לינק אימות נשלח לאימייל שלך.", { variant: "info", durationMs: 4000 });
        } else {
            showLoginView();
        }
        if (registeringView) registeringView.classList.remove("registering-fade-out");
    }, popupHoldMs + fadeMs);
  } finally {
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
    resetLoginForm();
  }
}

async function testConnection() { 
  const nameInput = document.getElementById("regName").value;
  const emailEl = document.getElementById("regEmail");
  const passwordEl = document.getElementById("regPassword");
  const btn = document.querySelector("#registerView .btn-register-action");

  if (!validateEmailField(emailEl)) { emailEl.reportValidity(); return; }
  if (!validatePasswordField(passwordEl)) { passwordEl.reportValidity(); return; }

  const emailInput = emailEl.value.trim();
  const passwordInput = passwordEl.value;
  const originalText = btn.innerText;
  btn.innerText = "מבצע רישום...";
  btn.disabled = true;
  showRegisteringView("מתבצע רישום...", "שולח לינק אימות...");

  try {
    await apiRequest("register", emailInput, { name: nameInput, password: passwordInput });

    if (registeringTitle) registeringTitle.textContent = "לינק אימות נשלח!";
    if (registeringSubtitle) registeringSubtitle.textContent = "בדוק את האימייל שלך";
    if (registerStatusIndicator) {
        registerStatusIndicator.classList.remove("is-loading", "is-error");
        registerStatusIndicator.classList.add("is-success");
    }

    setTimeout(() => {
        hideRegisteringView();
        if (registerView) registerView.style.display = "none";
        
        showLoginView();
        showToast("לינק אימות נשלח ל-" + emailInput + ". אנא אמת את חשבונך והתחבר.", { variant: "success", durationMs: 5000 });
        
        const loginEmail = document.getElementById("loginEmail");
        if(loginEmail) loginEmail.value = emailInput;

    }, 2000);

  } catch (error) {
    console.error("Register Error:", error);
    let message = "שגיאה בתקשורת";
    
    if (error.data && error.data.message) {
        message = error.data.message;
    } else if (error.status === 409) {
        message = "האימייל הזה כבר רשום במערכת";
    }

    if (registeringTitle) registeringTitle.textContent = message;
    if (registeringSubtitle) registeringSubtitle.textContent = "";
    if (registerStatusIndicator) {
        registerStatusIndicator.classList.remove("is-loading", "is-success");
        registerStatusIndicator.classList.add("is-error");
    }

    setTimeout(() => {
        showRegisterView();
    }, 2500);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
    resetRegisterForm();
  }
}

function openModal() {
  if (modal) {
    modal.style.display = "block";
    showLoginView();
  }
}

function closeModal() {
  if (modal) modal.style.display = "none";
}

function showRegisterView() {
  const verifyView = document.getElementById("verificationView");
  if (verifyView) verifyView.style.display = "none";
  const forgotView = document.getElementById("forgotPasswordView");
  if (forgotView) forgotView.style.display = "none";
  const resetView = document.getElementById("resetPasswordView");
  if (resetView) resetView.style.display = "none";
  if (loginView) loginView.style.display = "none";
  if (registerView) registerView.style.display = "block";
  if (closeBtn) closeBtn.style.display = "";
  hideRegisteringView();
}

function showLoginView() {
  const verifyView = document.getElementById("verificationView");
  if (verifyView) verifyView.style.display = "none";
  const forgotView = document.getElementById("forgotPasswordView");
  if (forgotView) forgotView.style.display = "none";
  const resetView = document.getElementById("resetPasswordView");
  if (resetView) resetView.style.display = "none";
  if (registerView) registerView.style.display = "none";
  if (loginView) loginView.style.display = "block";
  if (closeBtn) closeBtn.style.display = "";
  hideRegisteringView();
}

function showResetPasswordView(e) {
  try { if (e && typeof e.preventDefault === "function") e.preventDefault(); } catch {}

  if (modal) modal.style.display = "block";
  if (loginView) loginView.style.display = "none";
  if (registerView) registerView.style.display = "none";
  hideRegisteringView();
  if (closeBtn) closeBtn.style.display = "";

  const verifyView = document.getElementById("verificationView");
  if (verifyView) verifyView.style.display = "none";

  const forgotView = document.getElementById("forgotPasswordView");
  if (forgotView) forgotView.style.display = "none";

  const resetView = document.getElementById("resetPasswordView");
  if (resetView) resetView.style.display = "block";
}

function showForgotPasswordView(e) {
  try { if (e && typeof e.preventDefault === "function") e.preventDefault(); } catch {}

  if (modal) modal.style.display = "block";
  if (loginView) loginView.style.display = "none";
  if (registerView) registerView.style.display = "none";
  hideRegisteringView();
  if (closeBtn) closeBtn.style.display = "";

  const verifyView = document.getElementById("verificationView");
  if (verifyView) verifyView.style.display = "none";

  const forgotView = document.getElementById("forgotPasswordView");
  if (forgotView) forgotView.style.display = "block";

  const forgotEmail = document.getElementById("forgotEmail");
  const loginEmail = document.getElementById("loginEmail");
  if (forgotEmail && loginEmail && loginEmail.value) {
    forgotEmail.value = loginEmail.value;
  }
}

async function handleForgotPassword() {
  const emailEl = document.getElementById("forgotEmail");
  if (!validateEmailField(emailEl)) { emailEl?.reportValidity(); return; }

  const email = (emailEl?.value || "").trim();
  const btn = document.querySelector("#forgotPasswordView .btn-register-action");
  const originalText = btn ? btn.innerText : "שלח איפוס סיסמה";
  if (btn) { btn.disabled = true; btn.innerText = "שולח..."; }

  showRegisteringView("שולח בקשת איפוס...", "");

  try {
    await apiRequest("forgotPassword", email, {});

    if (registeringTitle) registeringTitle.textContent = "לינק לאיפוס הסיסמה נשלח";
    if (registeringSubtitle) registeringSubtitle.textContent = "בדוק את תיבת הדואר שלך (כולל תיקיית SPAM)";
    if (registerStatusIndicator) {
      registerStatusIndicator.classList.remove("is-loading", "is-error");
      registerStatusIndicator.classList.add("is-success");
    }

    const holdMs = 2200;
    const fadeMs = 450;
    setTimeout(() => { if (registeringView) registeringView.classList.add("registering-fade-out"); }, holdMs);
    setTimeout(() => {
      showLoginView();
      if (registeringView) registeringView.classList.remove("registering-fade-out");
      const loginEmail = document.getElementById("loginEmail");
      if (loginEmail) loginEmail.value = email;
      showToast("לינק לאיפוס הסיסמה נשלח בהצלחה", { variant: "success", durationMs: 4000 });
    }, holdMs + fadeMs);
  } catch (err) {
    if (registeringTitle) registeringTitle.textContent = "לינק לאיפוס הסיסמה נשלח";
    if (registeringSubtitle) registeringSubtitle.textContent = "בדוק את תיבת הדואר שלך (כולל תיקיית SPAM)";
    if (registerStatusIndicator) {
      registerStatusIndicator.classList.remove("is-loading", "is-error");
      registerStatusIndicator.classList.add("is-success");
    }

    const holdMs = 2200;
    const fadeMs = 450;
    setTimeout(() => { if (registeringView) registeringView.classList.add("registering-fade-out"); }, holdMs);
    setTimeout(() => {
      showLoginView();
      if (registeringView) registeringView.classList.remove("registering-fade-out");
      const loginEmail = document.getElementById("loginEmail");
      if (loginEmail) loginEmail.value = email;
      showToast("לינק לאיפוס הסיסמה נשלח בהצלחה", { variant: "success", durationMs: 4000 });
    }, holdMs + fadeMs);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = originalText; }
  }
}

function validateResetPasswordMatch(newPassEl, confirmEl) {
  if (!newPassEl || !confirmEl) return false;
  if (confirmEl.value.length === 0) { confirmEl.setCustomValidity("נא לאמת סיסמה"); return false; }
  const ok = newPassEl.value === confirmEl.value;
  confirmEl.setCustomValidity(ok ? "" : "הסיסמאות לא תואמות");
  return ok;
}

async function handleConfirmForgotPassword() {
  const usernameEl = document.getElementById("resetUsername") || document.getElementById("resetEmail");
  const codeEl = document.getElementById("resetCode");
  const newPassEl = document.getElementById("resetNewPassword");
  const confirmEl = document.getElementById("resetConfirmPassword");

  const username = String(usernameEl?.value || "").trim();
  const code = String(codeEl?.value || "").trim();
  if (!username || !code) {
    showToast("הלינק לאיפוס סיסמה לא תקין או חסר מידע. נסה לשלוח איפוס מחדש.", { variant: "danger", durationMs: 4500 });
    showForgotPasswordView();
    return;
  }

  if (!validatePasswordField(newPassEl)) { newPassEl?.reportValidity(); return; }
  if (!validateResetPasswordMatch(newPassEl, confirmEl)) { confirmEl?.reportValidity(); return; }

  const newPassword = String(newPassEl?.value || "");

  const btn = document.querySelector("#resetPasswordView .btn-register-action");
  const originalText = btn ? btn.innerText : "עדכן סיסמה";
  if (btn) { btn.disabled = true; btn.innerText = "מעדכן..."; }
  showRegisteringView("מעדכן סיסמה...", "");

  try {
    await apiRequest("confirmForgotPassword", username, { code, newPassword });

    if (registeringTitle) registeringTitle.textContent = "הסיסמה עודכנה בהצלחה";
    if (registeringSubtitle) registeringSubtitle.textContent = "אפשר להתחבר עם הסיסמה החדשה";
    if (registerStatusIndicator) {
      registerStatusIndicator.classList.remove("is-loading", "is-error");
      registerStatusIndicator.classList.add("is-success");
    }

    const holdMs = 2200;
    const fadeMs = 450;
    setTimeout(() => { if (registeringView) registeringView.classList.add("registering-fade-out"); }, holdMs);
    setTimeout(() => {
      showLoginView();
      if (registeringView) registeringView.classList.remove("registering-fade-out");
      const loginEmail = document.getElementById("loginEmail");
      showToast("הסיסמה עודכנה בהצלחה", { variant: "success", durationMs: 4000 });
    }, holdMs + fadeMs);
  } catch (err) {
    const msg = formatApiError(err, "שגיאה בעדכון סיסמה");
    if (registeringTitle) registeringTitle.textContent = "שגיאה בעדכון סיסמה";
    if (registeringSubtitle) registeringSubtitle.textContent = msg;
    if (registerStatusIndicator) {
      registerStatusIndicator.classList.remove("is-loading", "is-success");
      registerStatusIndicator.classList.add("is-error");
    }

    const holdMs = 2600;
    const fadeMs = 450;
    setTimeout(() => { if (registeringView) registeringView.classList.add("registering-fade-out"); }, holdMs);
    setTimeout(() => {
      showResetPasswordView();
      if (registeringView) registeringView.classList.remove("registering-fade-out");
    }, holdMs + fadeMs);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = originalText; }
  }
}

setupEmailValidationPopups();
setupPasswordValidationPopups();

document.addEventListener("DOMContentLoaded", () => {
  updateNavGreeting();
  const authBtn = document.getElementById("authNavButton");
  if (authBtn) {
    authBtn.addEventListener("click", () => {
      if (isUserLoggedIn()) { requestLogout(); return; }
      if (modal) openLoginModal();
      else redirectGuestsToIndex("נדרשת התחברות");
    });
  }
  const dashboardBtn = document.getElementById("dashboardNavButton");
  if (dashboardBtn) {
    dashboardBtn.addEventListener("click", () => {
      if (!isUserLoggedIn()) {
        if (modal) openLoginModal("כדי לעבור לדשבורד צריך להתחבר");
        else redirectGuestsToIndex("כדי לעבור לדשבורד צריך להתחבר");
        return;
      }
      const role = (() => {
        try { return localStorage.getItem("fitmentorRole") || "User"; } catch { return "User"; }
      })();
      navigateToPage(role === "Admin" ? "admindashboard.html" : "dashboard.html");
    });
  }
  const homeBtn = document.getElementById("homeNavButton");
  if (homeBtn) {
    homeBtn.addEventListener("click", () => { navigateToPage("index.html"); });
  }

  const isIndexPage = /index\.html$/i.test(window.location.pathname) || window.location.pathname.endsWith("/Html/") || window.location.pathname.endsWith("/Html");
  if (isIndexPage) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1") {
      openLoginModal("איפוס סיסמה");
      showResetPasswordView();
      const usernameEl = document.getElementById("resetUsername") || document.getElementById("resetEmail");
      const codeEl = document.getElementById("resetCode");
      const qUser = params.get("username") || params.get("email") || "";
      const qCode = params.get("code") || "";
      if (usernameEl && qUser) usernameEl.value = qUser;
      if (codeEl && qCode) codeEl.value = qCode;

	  if (!qUser || !qCode) {
		showToast("הלינק לאיפוס סיסמה לא תקין. נסה לשלוח איפוס מחדש.", { variant: "danger", durationMs: 4500 });
		showForgotPasswordView();
	  }
    } else if (params.get("login") === "1" && !isUserLoggedIn()) {
      let message = "נדרשת התחברות";
      try {
        message = sessionStorage.getItem("fitmentorLoginReason") || message;
        sessionStorage.removeItem("fitmentorLoginReason");
      } catch {}
      openLoginModal(message);
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const resetBtn = document.querySelector("#resetPasswordView .btn-register-action");
  if (resetBtn) resetBtn.addEventListener("click", handleConfirmForgotPassword);

  const newPassEl = document.getElementById("resetNewPassword");
  const confirmEl = document.getElementById("resetConfirmPassword");
  if (newPassEl && confirmEl) {
    const onInput = () => validateResetPasswordMatch(newPassEl, confirmEl);
    confirmEl.addEventListener("input", onInput);
    newPassEl.addEventListener("input", onInput);
  }
});

