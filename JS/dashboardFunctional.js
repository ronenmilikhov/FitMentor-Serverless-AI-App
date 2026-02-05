if (typeof apiRequestWithFallback === "undefined") {
    console.error("Critical Error: Functional.js is not loaded or loaded after this file.");
}

let isChatPending = false;
let chatLoadingBubbleEl = null;

const byId = (id) => document.getElementById(id);
const getUserId = () => localStorage.getItem("fitmentorUserId");
const requireUserId = () => {
    const id = getUserId();
    if (!id) throw new Error("Missing userId");
    return id;
};
const toast = (msg, opts) => {
    if (typeof showToast === "function") showToast(msg, opts);
    else alert(msg);
};

function getUserDisplayNameFromUi() {
    try {
        const fromStorage = String(localStorage.getItem("fitmentorUserName") || "").trim();
        if (fromStorage) return fromStorage;
    } catch {}

    const el = byId("userGreeting");
    const raw = String(el?.textContent || "").trim();
    const m = raw.match(/^\s*שלום\s+(.+?)\s*$/);
    const name = (m?.[1] || "").trim();
    return name;
}

function formatAiWelcomeMessage(name) {
    const n = String(name || "").trim();
    if (n) return `היי ${n}! אני כאן כדי לעזור לך עם התוכנית. אפשר לבקש שינויים או לשאול שאלות.`;
    return "היי! אני כאן כדי לעזור לך עם התוכנית. אפשר לבקש שינויים או לשאול שאלות.";
}

function renderPlanString(s) {
    if (s === "Empty response") {
        return "<div class=\"ai-plan-result\"><h3>לא הצלחתי לטעון תוכנית כרגע</h3><p>התקבלה תגובה ריקה מהשרת. נסה ליצור שוב את התוכנית.</p></div>";
    }
    const looksLikeJsonError = s.startsWith("{") && (s.includes('"reply"') || s.includes('"updatedPlanHtml"'));
    if (looksLikeJsonError) {
        let msg = "לא הצלחתי לטעון תוכנית כרגע.";
        try {
            const obj = JSON.parse(s);
            if (obj && typeof obj.reply === "string" && obj.reply.trim()) msg = obj.reply.trim();
        } catch {}
        return `<div class="ai-plan-result"><h3>לא הצלחתי לטעון תוכנית כרגע</h3><p>${msg}</p><p>נסה ליצור את התוכנית מחדש.</p></div>`;
    }
    return s;
}

function renderPlanHtml(plan) {
    if (!plan) return "";
    if (typeof plan === "string") return renderPlanString(plan.trim());
    if (plan.planHtml) return renderPlanString(String(plan.planHtml).trim());
    if (plan.plan && plan.plan.planHtml) return renderPlanString(String(plan.plan.planHtml).trim());
    return "";
}

function getPlanBodyElement() {
    return document.getElementById("planBody") || document.getElementById("planContent");
}

function isPlanErrorHtml(html) {
    const s = String(html || "").trim();
    if (!s) return true;
    if (/לא\s+הצלחתי\s+לטעון\s+תוכנית\s+כרגע/.test(s)) return true;
    if (/לא\s+הצלחתי\s+לייצר\s+תוכנית\s+כרגע/.test(s)) return true;
    if (s.startsWith("{") && (s.includes('"reply"') || s.includes('"updatedPlanHtml"'))) return true;
    return false;
}

function isExplicitNewPlanRequest(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    return (
        /תכנית\s+חדשה/.test(t) ||
        /תוכנית\s+חדשה/.test(t) ||
        /בקש\s+תכ(?:נ)?ית\s+חדשה/.test(t) ||
        /(תבנה|בנה|לבנות|תכין|הכן|ליצור|צור)\s+.*תכ(?:נ)?ית\s+חדשה/.test(t) ||
        /אני\s+רוצה\s+תכ(?:נ)?ית\s+חדשה/.test(t)
    );
}

function isHardResetNewPlanRequest(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    return (
        /(תכ(?:נ)?ית|תוכנית)\s+חדשה\s+לגמרי/.test(t) ||
        /לא\s+מתאימ(?:ה|ים)/.test(t) ||
        /לא\s+מתאים\s+לי/.test(t) ||
        /טע(?:י)?ת(?:י)?/.test(t) ||
        /בנ(?:י)?תי\s+בטעות/.test(t) ||
        /עשיתי\s+בטעות/.test(t) ||
        /התבלבלת(?:י)?/.test(t) ||
        /איפוס\s+מלא/.test(t) ||
        /מחדש\s+מאפס/.test(t)
    );
}

function getStoredPlanParams() {
    try {
        const raw = localStorage.getItem("fitmentorPlanParams");
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function setStoredPlanParams(params) {
    try {
        localStorage.setItem("fitmentorPlanParams", JSON.stringify(params || {}));
    } catch {}
}

function setNewPlanModalOpen(isOpen) {
    const modal = byId("newPlanModal");
    if (!modal) return;
    modal.style.display = isOpen ? "flex" : "none";
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function ensurePlanErrorModal() {
    let modal = document.getElementById("planErrorModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "planErrorModal";
    modal.className = "fm-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";

    const content = document.createElement("div");
    content.className = "fm-modal-content";
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");
    content.setAttribute("aria-label", "שגיאה ביצירת תוכנית אימונים");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "fm-modal-close";
    closeBtn.setAttribute("aria-label", "סגור");
    closeBtn.textContent = "×";

    const title = document.createElement("h2");
    title.className = "fm-modal-title";
    title.textContent = "לא הצלחתי ליצור תוכנית כרגע";

    const subtitle = document.createElement("p");
    subtitle.className = "fm-modal-subtitle";
    subtitle.id = "planErrorSubtitle";
    subtitle.textContent = "נראה שהייתה תקלה זמנית. לא נשמרה שום תוכנית.";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.justifyContent = "center";

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn-cta";
    okBtn.style.opacity = "1";
    okBtn.style.animation = "none";
    okBtn.textContent = "הבנתי";

    actions.appendChild(okBtn);

    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(actions);
    modal.appendChild(content);
    document.body.appendChild(modal);

    const close = () => setPlanErrorModalOpen(false);
    closeBtn.onclick = close;
    okBtn.onclick = close;
    modal.addEventListener("click", (e) => {
        if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
        if (modal.getAttribute("aria-hidden") === "false" && e.key === "Escape") close();
    });

    return modal;
}

function setPlanErrorModalOpen(isOpen, subtitleText = "") {
    const modal = ensurePlanErrorModal();
    const subtitle = byId("planErrorSubtitle");
    if (subtitle && typeof subtitleText === "string" && subtitleText.trim()) {
        subtitle.textContent = subtitleText.trim();
    }
    modal.style.display = isOpen ? "flex" : "none";
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");
}

function getFriendlyPlanErrorMessage(err) {
    const raw = String(err?.data?.message || err?.message || "").trim();
    if (/invalid planhtml/i.test(raw) || /valid plan/i.test(raw)) {
        return "ה-AI לא החזיר תוכנית תקינה הפעם, ולכן לא שמרנו שום תוכנית. נסה שוב בעוד רגע.";
    }
    if (/api error\s*(401|403)/i.test(raw) || /unauthorized|forbidden/i.test(raw)) {
        return "יש כרגע בעיית גישה לשירות ה-AI, ולכן לא שמרנו שום תוכנית. נסה שוב מאוחר יותר.";
    }
    if (/empty response/i.test(raw)) {
        return "התקבלה תגובה ריקה מה-AI, ולכן לא שמרנו שום תוכנית. נסה שוב בעוד רגע.";
    }
    return "נראה שהייתה תקלה זמנית ביצירת התוכנית. לא נשמרה שום תוכנית. נסה שוב בעוד רגע.";
}

function fillNewPlanForm(params) {
    const p = params || {};
    const setVal = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (value === undefined || value === null || value === "") return;
        el.value = String(value);
    };
    setVal("npAge", p.age);
    setVal("npGender", p.gender);
    setVal("npWeight", p.weight);
    setVal("npHeight", p.height);
    setVal("npFitnessLevel", p.fitnessLevel);
    setVal("npGoal", p.goal);
    setVal("npDays", p.days);
    setVal("npEquipment", p.equipment);
}

function readNewPlanForm() {
    const age = Number(document.getElementById("npAge")?.value || "");
    const gender = document.getElementById("npGender")?.value || "male";
    const weight = Number(document.getElementById("npWeight")?.value || "");
    const height = Number(document.getElementById("npHeight")?.value || "");
    const fitnessLevel = document.getElementById("npFitnessLevel")?.value || "beginner";
    const goal = document.getElementById("npGoal")?.value || "";
    const days = Number(document.getElementById("npDays")?.value || "0");
    const equipment = document.getElementById("npEquipment")?.value || "";
    return { age, gender, weight, height, fitnessLevel, goal, days, equipment };
}

function validatePlanParams(params) {
    const { age, weight, height, days } = params || {};
    if (!Number.isFinite(age) || age < 12 || age > 100) return "נא להזין גיל תקין (12-100)";
    if (!Number.isFinite(weight) || weight < 30 || weight > 250) return "נא להזין משקל תקין (30-250 ק\"ג)";
    if (!Number.isFinite(height) || height < 100 || height > 250) return "נא להזין גובה תקין (100-250 ס\"מ)";
    if (!Number.isFinite(days) || days < 2 || days > 6) return "נא לבחור מספר ימי אימון תקין";
    return "";
}

function setDashboardState(state, context) {
    console.log("Switching Dashboard State to:", state, context || "");
    const loader = byId("dashboardLoader");
    const loaderTitle = byId("dashboardLoaderTitle");
    const loaderSubtitle = byId("dashboardLoaderSubtitle");
    const noPlan = byId("noPlanState");
    const builder = byId("planBuilderState");
    const display = byId("planDisplayState");

    if (loader) loader.style.display = state === "loading" ? "block" : "none";
    if (noPlan) noPlan.style.display = state === "noPlan" ? "block" : "none";
    if (builder) builder.style.display = state === "builder" ? "block" : "none";
    if (display) display.style.display = state === "display" ? "block" : "none";

    if (state === "loading" && (loaderTitle || loaderSubtitle)) {
        let titleText = "טוען נתונים...";
        let subtitleText = "בודק אם קיימת תוכנית אימונים עבורך.";

        if (context === "creatingPlan") {
            titleText = "יוצר תוכנית אימונים עבורך, אנא המתן...";
            subtitleText = "";
        } else if (context === "checkingPlan") {
            titleText = "טוען נתונים...";
            subtitleText = "בודק אם קיימת תוכנית אימונים עבורך.";
        } else if (context && typeof context === "object") {
            if (typeof context.title === "string") titleText = context.title;
            if (typeof context.subtitle === "string") subtitleText = context.subtitle;
        }

        if (loaderTitle) loaderTitle.textContent = titleText;
        if (loaderSubtitle) loaderSubtitle.textContent = subtitleText;
    }
}

function appendChatBubble(role, text) {
    const messages = byId("chatMessages");
    if (!messages) return;
    
    const div = document.createElement("div");
    div.className = `chat-bubble ${role}`;
    div.textContent = String(text ?? "");
    
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function showChatLoadingBubble() {
    const messages = byId("chatMessages");
    if (!messages) return;

    hideChatLoadingBubble();

    const div = document.createElement("div");
    div.className = "chat-bubble ai is-loading";

    const spinner = document.createElement("div");
    spinner.className = "register-status";
    spinner.setAttribute("aria-hidden", "true");

    const textEl = document.createElement("div");
    textEl.textContent = "ממתין לתשובה...";

    div.appendChild(spinner);
    div.appendChild(textEl);

    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    chatLoadingBubbleEl = div;
}

function hideChatLoadingBubble() {
    try {
        if (chatLoadingBubbleEl && chatLoadingBubbleEl.remove) {
            chatLoadingBubbleEl.remove();
        }
    } catch {}
    chatLoadingBubbleEl = null;
}

function setChatPending(pending) {
    isChatPending = Boolean(pending);
    const btn = byId("chatSendButton");
    const input = byId("chatInput");

    if (btn) {
        btn.disabled = isChatPending;
        btn.innerText = isChatPending ? "..." : "שלח";
    }
    if (input) {
        input.disabled = isChatPending;
    }
}

function tryParseJsonObject(text) {
    const raw = String(text || "").trim();
    if (!raw) return null;

    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const candidates = [];
    candidates.push(unfenced);
    if (!unfenced.startsWith("{") && (unfenced.includes('"reply"') || unfenced.includes("'reply'"))) {
        candidates.push(`{${unfenced}}`);
    }

    for (const c of candidates) {
        try {
            const obj = JSON.parse(c);
            if (obj && typeof obj === "object") return obj;
        } catch {
        }
    }

    return null;
}

function normalizeChatResponse(data) {
    if (typeof data === "string") {
        const parsed = tryParseJsonObject(data);
        if (parsed) return parsed;
        return { reply: data };
    }

    if (data && typeof data === "object") {
        if (typeof data.reply === "string") {
            const parsed = tryParseJsonObject(data.reply);
            if (parsed && typeof parsed.reply === "string") {
                return {
                    reply: parsed.reply,
                    updatedPlanHtml: parsed.updatedPlanHtml ?? data.updatedPlanHtml ?? null,
                    uiAction: parsed.uiAction ?? data.uiAction ?? null
                };
            }
        }
        if (typeof data.rawText === "string") {
            const parsed = tryParseJsonObject(data.rawText);
            if (parsed) return parsed;
        }
        return data;
    }

    return { reply: "לא התקבלה תשובה." };
}

async function loadUserPlanFromAws() {
    const data = await apiRequestWithFallback(["getPlan", "getUserPlan"], requireUserId(), {});
    return data; 
}

async function loadChatHistoryAws() {
    const userId = getUserId();
    if (!userId) return [];
    try {
        const data = await apiRequestWithFallback(["getChatHistory"], userId, {});
        return data.messages || [];
    } catch (e) {
        console.warn("Failed to load history:", e);
        return [];
    }
}

async function generateAndSavePlanAws(formData) {
    const data = await apiRequestWithFallback(["generatePlan"], requireUserId(), formData);
    return data;
}

async function deletePlanAws() {
    await apiRequestWithFallback(["deletePlan"], requireUserId(), {});
}

async function chatWithAiAws(message) {
    const userId = requireUserId();
    const userName = getUserDisplayNameFromUi();
    return await apiRequestWithFallback(["chat"], userId, { message, userName });
}

async function renderChatHistory() {
    const messagesContainer = byId("chatMessages");
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '<div style="text-align:center; color:#ccc; font-size:0.8rem;">טוען שיחה...</div>';
    
    try {
        const history = await loadChatHistoryAws();
        messagesContainer.innerHTML = "";
        
        if (!history || history.length === 0) {
            appendChatBubble("ai", formatAiWelcomeMessage(getUserDisplayNameFromUi()));
        } else {
            history.forEach(msg => {
                appendChatBubble(msg.role, msg.text);
            });
        }
    } catch (e) {
        console.error("Error loading chat history:", e);
        messagesContainer.innerHTML = "";
    }
}

async function handleDashboardSendChat() {
    const input = byId("chatInput");
    const text = (input?.value || "").trim();

    if (isChatPending) return;
    if (!text) {
        toast("כדי לשלוח הודעה צריך לכתוב משהו 🙂", { variant: "danger", durationMs: 2200 });
        try { input?.focus?.(); } catch {}
        return;
    }

    appendChatBubble("user", text);
    if (input) input.value = "";

    if (isHardResetNewPlanRequest(text)) {
        appendChatBubble("ai", "מבין. כדי לבנות לך תוכנית חדשה לגמרי, מלא/עדכן רגע את הפרטים בטופס שנפתח.");
        fillNewPlanForm(getStoredPlanParams());
        setNewPlanModalOpen(true);
        return;
    }

    setChatPending(true);
    showChatLoadingBubble();

    try {
        const rawData = await chatWithAiAws(text);
        const data = normalizeChatResponse(rawData);

        hideChatLoadingBubble();

        if (data && data.uiAction === "openNewPlanForm") {
            fillNewPlanForm(getStoredPlanParams());
            setNewPlanModalOpen(true);
        }
        
        const aiReply = (data && typeof data.reply === "string" && data.reply.trim()) ? data.reply : "לא התקבלה תשובה.";
        appendChatBubble("ai", aiReply);

        if (data.updatedPlanHtml) {
            console.log("Plan updated by AI! Rendering new HTML...");
            const planBody = getPlanBodyElement();
            
            if (planBody) {
                planBody.style.opacity = "0.5";
                setTimeout(() => {
                    const html = renderPlanHtml({ planHtml: data.updatedPlanHtml });
                    planBody.innerHTML = html;
                    planBody.style.opacity = "1";
                    
                    toast("התוכנית עודכנה בהצלחה!", { variant: "success" });
                }, 500);
            }
        }

    } catch (e) {
        hideChatLoadingBubble();
        appendChatBubble("ai", "אופס, לא הצלחתי לתקשר עם השרת כרגע.");
        console.error(e);
    } finally {
        setChatPending(false);
    }
}

async function initDashboardPage() {
    console.log("Initializing Dashboard...");
    
    if (typeof updateNavGreeting === "function") updateNavGreeting();
    
    if (typeof enforceAuthOrRedirect === "function") {
        if (!enforceAuthOrRedirect("כדי לצפות בדשבורד צריך להתחבר")) return;
    }

    const startBtn = byId("startPlanButton");
    const cancelBtn = byId("cancelPlanButton");
    const createBtn = byId("createPlanButton");
    const chatBtn = byId("chatSendButton");
    const chatInput = byId("chatInput");

    const newPlanModal = byId("newPlanModal");
    const newPlanModalClose = byId("newPlanModalClose");
    const npCancelBtn = byId("npCancelButton");
    const npSubmitBtn = byId("npSubmitButton");

    const createPlanFromParams = async (params, successMessage) => {
        setStoredPlanParams(params);
        const planData = await generateAndSavePlanAws(params);
        const html = renderPlanHtml(planData);
        const planBody = getPlanBodyElement();
        if (planBody) planBody.innerHTML = html || "<p>שגיאה בטעינת התוכנית</p>";
        const msgs = byId("chatMessages");
        if (msgs) msgs.innerHTML = "";
        appendChatBubble("ai", successMessage);
        setDashboardState("display");
    };

    const closeNewPlanModal = () => setNewPlanModalOpen(false);
    if (newPlanModalClose) newPlanModalClose.onclick = closeNewPlanModal;
    if (npCancelBtn) npCancelBtn.onclick = closeNewPlanModal;
    if (newPlanModal) {
        newPlanModal.addEventListener("click", (e) => {
            if (e.target === newPlanModal) closeNewPlanModal();
        });
    }

    if (npSubmitBtn) {
        npSubmitBtn.onclick = async () => {
            const params = readNewPlanForm();
            const validationError = validatePlanParams(params);
            if (validationError) {
                alert(validationError);
                return;
            }

            setNewPlanModalOpen(false);
            setDashboardState("loading", "creatingPlan");

            try {
                await createPlanFromParams(params, "הכנתי לך תוכנית חדשה. אפשר לשאול אותי כאן שאלות או לבקש שינויים.");
            } catch (e) {
                console.error(e);
                setPlanErrorModalOpen(true, getFriendlyPlanErrorMessage(e));
                setDashboardState("builder");
            }
        };
    }

    if (startBtn) startBtn.onclick = () => setDashboardState("builder");
    if (cancelBtn) cancelBtn.onclick = () => setDashboardState("noPlan");

    if (createBtn) {
        createBtn.onclick = async () => {
            const age = Number(byId("dAge")?.value || "");
            const gender = byId("dGender")?.value || "male";
            const weight = Number(byId("dWeight")?.value || "");
            const height = Number(byId("dHeight")?.value || "");
            const fitnessLevel = byId("dFitnessLevel")?.value || "beginner";
            const goal = byId("dGoal")?.value || "";
            const days = Number(byId("dDays")?.value || "0");
            const equipment = byId("dEquipment")?.value || "";
            const params = { age, gender, weight, height, fitnessLevel, goal, days, equipment };
            const validationError = validatePlanParams(params);
            if (validationError) {
                alert(validationError);
                return;
            }

            setDashboardState("loading", "creatingPlan");
            try {
                await createPlanFromParams(params, "התוכנית מוכנה! אפשר לשאול אותי שאלות עליה כאן.");
            } catch (e) {
                console.error(e);
                setPlanErrorModalOpen(true, getFriendlyPlanErrorMessage(e));
                setDashboardState("builder");
            }
        };
    }

    const savePdfBtn = byId("savePdfButton");
    if (savePdfBtn) {
        savePdfBtn.onclick = () => {
            const element = getPlanBodyElement();
            const planHtml = (element?.innerHTML || "").trim();
            if (!planHtml) {
                alert("אין תוכנית לשמור / להדפיס");
                return;
            }

            const existing = byId("printOnlyRoot");
            if (existing) existing.remove();

            const printRoot = document.createElement("div");
            printRoot.id = "printOnlyRoot";
            printRoot.innerHTML = `
                                <div class="print-logo-row">
                                    <div class="print-logo-mark" aria-hidden="true">
                                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2.5 10.25h2.25v3.5H2.5a1.5 1.5 0 0 1 0-3z" fill="#000"/>
                                            <path d="M19.25 10.25H21.5a1.5 1.5 0 0 1 0 3h-2.25v-3z" fill="#000"/>
                                            <rect x="5.25" y="9" width="2" height="6" rx="1" fill="#000"/>
                                            <rect x="16.75" y="9" width="2" height="6" rx="1" fill="#000"/>
                                            <rect x="7.75" y="10.25" width="8.5" height="3.5" rx="1.75" fill="#000"/>
                                        </svg>
                                    </div>
                                    <div class="print-logo-texts">
                                        <div class="print-logo-title">FitMentor</div>
                                        <div class="print-logo-sub">תוכנית אימונים אישית</div>
                                    </div>
                                </div>
                                <div class="print-plan-body">${planHtml}</div>
                        `;

            document.body.classList.add("is-printing-plan");
            document.body.appendChild(printRoot);

            const cleanup = () => {
                document.body.classList.remove("is-printing-plan");
                const root = byId("printOnlyRoot");
                if (root) root.remove();
                window.removeEventListener("afterprint", cleanup);
            };
            window.addEventListener("afterprint", cleanup);

            window.print();
        };
    }

    if (chatBtn) chatBtn.onclick = handleDashboardSendChat;
    if (chatInput) {
        chatInput.onkeydown = (e) => {
            if (e.key === "Enter") { e.preventDefault(); handleDashboardSendChat(); }
        };
    }

    setDashboardState("loading", "checkingPlan");
    
    try {
        const [planData] = await Promise.all([
            loadUserPlanFromAws(),
            renderChatHistory()
        ]);

        const html = renderPlanHtml(planData);
        const planBody = getPlanBodyElement();
        
        if (planBody && html && html.length > 20 && !isPlanErrorHtml(html)) {
            planBody.innerHTML = html;
            const serverParams = planData?.plan?.params;
            if (serverParams && typeof serverParams === "object") setStoredPlanParams(serverParams);
            setDashboardState("display");
        } else {
            setDashboardState("noPlan");
        }
    } catch (e) {
        const status = e.status || (e.data && e.data.status);
        
        if (status == 404 || (e.message && e.message.includes("404"))) {
            setDashboardState("noPlan");
        } else {
            console.error("Dashboard Load Error:", e);
            if (typeof showToast === "function") showToast("לא הצלחתי לטעון את הנתונים", {variant: "danger"});
            setDashboardState("noPlan");
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const isDashboard = window.location.pathname.toLowerCase().includes("dashboard");
    
    if (isDashboard) {
        const hamburgerButton = document.getElementById("hamburgerButton");
        const sidebar = document.getElementById("modernSidebar");
        const overlay = document.getElementById("sidebarOverlay");
        const closeBtn = document.getElementById("sidebarCloseBtn");

        const openSidebar = () => {
            if (!sidebar || !overlay || !hamburgerButton) return;
            sidebar.classList.add("is-open");
            overlay.classList.add("is-active");
            hamburgerButton.classList.add("is-active");
            hamburgerButton.setAttribute("aria-expanded", "true");
        };

        const closeSidebar = () => {
            if (!sidebar || !overlay || !hamburgerButton) return;
            sidebar.classList.remove("is-open");
            overlay.classList.remove("is-active");
            hamburgerButton.classList.remove("is-active");
            hamburgerButton.setAttribute("aria-expanded", "false");
        };

        if (hamburgerButton) {
            hamburgerButton.addEventListener("click", (e) => {
                e.stopPropagation();
                const isOpen = hamburgerButton.getAttribute("aria-expanded") === "true";
                if (isOpen) closeSidebar();
                else openSidebar();
            });
        }

        if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
        if (overlay) overlay.addEventListener("click", closeSidebar);

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeSidebar();
        });

        if (sidebar) {
            sidebar.addEventListener("click", (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;

                const link = target.closest(".sidebar-link");
                if (!(link instanceof HTMLElement)) return;
                const page = link.getAttribute("data-page") || "";

                closeSidebar();

                if (page && typeof navigateToPage === "function") {
                    navigateToPage(page);
                }
            });
        }

        initDashboardPage();
    }
});