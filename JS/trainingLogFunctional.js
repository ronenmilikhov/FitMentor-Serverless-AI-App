document.addEventListener("DOMContentLoaded", () => {
    initSidebar();
    initTrainingLog();
});

function getTodayLocalIsoDate() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}

function isPastDate(dateStr) {
    if (!dateStr) return false;
    const today = getTodayLocalIsoDate();
    return String(dateStr) < today;
}

function isFutureDate(dateStr) {
    if (!dateStr) return false;
    const today = getTodayLocalIsoDate();
    return String(dateStr) > today;
}

function ensureReadOnlyNotice() {
    const container = document.querySelector(".training-log-container");
    if (!container) return null;

    let el = document.getElementById("trainingLogReadOnlyNotice");
    if (el) return el;

    el = document.createElement("div");
    el.id = "trainingLogReadOnlyNotice";
    el.style.display = "none";
    el.style.marginBottom = "12px";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "12px";
    el.style.border = "1px solid var(--border-color)";
    el.style.background = "rgba(250, 204, 21, 0.08)";
    el.style.color = "var(--text-main)";
    el.style.fontWeight = "700";
    el.textContent = "צפייה בלבד: לוג בתאריך עבר לא ניתן לעריכה";

    const dateGroup = container.querySelector(".date-selector-group");
    if (dateGroup && dateGroup.nextSibling) {
        dateGroup.parentNode.insertBefore(el, dateGroup.nextSibling);
    } else {
        container.insertBefore(el, container.firstChild);
    }

    return el;
}

function setTrainingLogReadOnly(isReadOnly) {
    const notice = ensureReadOnlyNotice();
    if (notice) notice.style.display = isReadOnly ? "block" : "none";

    const addExerciseBtn = document.getElementById("addExerciseBtn");
    const saveBtn = document.getElementById("saveWorkoutBtn");
    const deleteBtn = document.getElementById("deleteWorkoutBtn");
    const notesInput = document.getElementById("workoutNotes");
    const bodyWeightInput = document.getElementById("bodyWeightKg");

    const container = document.querySelector(".training-log-container");
    const addWrapper = container?.querySelector(".add-exercise-wrapper");
    setElementVisible(addWrapper, !isReadOnly);
    setElementVisible(saveBtn, !isReadOnly);
    setElementVisible(deleteBtn, !isReadOnly);

    document.querySelectorAll(".remove-exercise-btn, .add-set-btn, .remove-set-btn").forEach((btn) => {
        setElementVisible(btn, !isReadOnly);
    });

    if (addExerciseBtn) addExerciseBtn.disabled = isReadOnly;
    if (saveBtn) saveBtn.disabled = isReadOnly;
    if (deleteBtn) deleteBtn.disabled = isReadOnly;
    if (notesInput) notesInput.disabled = isReadOnly;
    if (bodyWeightInput) bodyWeightInput.disabled = isReadOnly;

    document.querySelectorAll(".exercise-card input, .exercise-card textarea, .exercise-card select").forEach((el) => {
        el.disabled = isReadOnly;
    });

    document.querySelectorAll(".remove-exercise-btn, .add-set-btn, .remove-set-btn").forEach((btn) => {
        btn.disabled = isReadOnly;
    });
}

function setElementVisible(el, visible) {
    if (!el) return;
    if (el.dataset.fmPrevDisplay === undefined) {
        el.dataset.fmPrevDisplay = el.style.display || "";
    }
    el.style.display = visible ? el.dataset.fmPrevDisplay : "none";
}

function setPastNoLogView(isOn) {
    const container = document.querySelector(".training-log-container");
    if (!container) return;

    const addWrapper = container.querySelector(".add-exercise-wrapper");
    const divider = container.querySelector(".divider");
    const footer = container.querySelector(".log-footer");

    setElementVisible(addWrapper, !isOn);
    setElementVisible(divider, !isOn);
    setElementVisible(footer, !isOn);

    const notice = document.getElementById("trainingLogReadOnlyNotice");
    if (notice && isOn) notice.style.display = "none";
}

function ensureDeleteLogConfirmModal() {
    let modal = document.getElementById("deleteLogConfirmModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "deleteLogConfirmModal";
    modal.className = "fm-modal";
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";

    const content = document.createElement("div");
    content.className = "fm-modal-content";
    content.setAttribute("role", "dialog");
    content.setAttribute("aria-modal", "true");
    content.setAttribute("aria-label", "אישור מחיקת אימון");

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "fm-modal-close";
    closeBtn.setAttribute("aria-label", "סגור");
    closeBtn.textContent = "×";

    const title = document.createElement("h2");
    title.className = "fm-modal-title";
    title.textContent = "למחוק את האימון?";

    const subtitle = document.createElement("p");
    subtitle.className = "fm-modal-subtitle";
    subtitle.id = "deleteLogConfirmSubtitle";
    subtitle.textContent = "הפעולה אינה הפיכה.";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "12px";
    actions.style.justifyContent = "center";
    actions.style.flexWrap = "wrap";
    actions.style.marginTop = "10px";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "deleteLogConfirmCancel";
    cancelBtn.className = "btn-cta";
    cancelBtn.style.opacity = "1";
    cancelBtn.style.animation = "none";
    cancelBtn.style.background = "transparent";
    cancelBtn.style.border = "1px solid var(--text-muted)";
    cancelBtn.style.color = "var(--text-muted)";
    cancelBtn.textContent = "ביטול";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.id = "deleteLogConfirmOk";
    confirmBtn.className = "btn-cta";
    confirmBtn.style.opacity = "1";
    confirmBtn.style.animation = "none";
    confirmBtn.style.backgroundColor = "#ef4444";
    confirmBtn.textContent = "מחק אימון";

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);

    content.appendChild(closeBtn);
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(actions);
    modal.appendChild(content);
    document.body.appendChild(modal);

    return modal;
}

function openDeleteLogConfirmModal(date) {
    const modal = ensureDeleteLogConfirmModal();
    const subtitle = document.getElementById("deleteLogConfirmSubtitle");
    if (subtitle) {
        subtitle.textContent = `האם אתה בטוח שברצונך למחוק את האימון מתאריך ${date}? פעולה זו אינה הפיכה.`;
    }

    const closeBtn = modal.querySelector(".fm-modal-close");
    const cancelBtn = document.getElementById("deleteLogConfirmCancel");
    const okBtn = document.getElementById("deleteLogConfirmOk");

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");

    return new Promise((resolve) => {
        const cleanup = () => {
            modal.removeEventListener("click", onBackdropClick);
            document.removeEventListener("keydown", onKeyDown);
            closeBtn?.removeEventListener("click", onClose);
            cancelBtn?.removeEventListener("click", onCancel);
            okBtn?.removeEventListener("click", onOk);
        };

        const close = (result) => {
            modal.style.display = "none";
            modal.setAttribute("aria-hidden", "true");
            cleanup();
            resolve(result);
        };

        const onBackdropClick = (e) => {
            if (e.target === modal) close(false);
        };
        const onKeyDown = (e) => {
            if (modal.getAttribute("aria-hidden") === "false" && e.key === "Escape") close(false);
        };
        const onClose = () => close(false);
        const onCancel = () => close(false);
        const onOk = () => close(true);

        modal.addEventListener("click", onBackdropClick);
        document.addEventListener("keydown", onKeyDown);
        closeBtn?.addEventListener("click", onClose);
        cancelBtn?.addEventListener("click", onCancel);
        okBtn?.addEventListener("click", onOk);
    });
}

function applyTodayEmptyLogMinimumLock({ date, foundLog } = {}) {
    const shouldLock = true;

    const exercisesList = document.getElementById("exercisesList");
    if (!exercisesList) return;
    const cards = Array.from(exercisesList.querySelectorAll(".exercise-card"));
    if (cards.length === 0) return;

    const lockBtn = (btn, tooltip) => {
        if (!btn) return;
        btn.dataset.fmMinLock = "1";
        btn.disabled = true;
        btn.style.visibility = "hidden";
        if (tooltip) btn.title = tooltip;
    };

    const unlockBtn = (btn) => {
        if (!btn) return;
        if (btn.dataset.fmMinLock !== "1") return;
        btn.disabled = false;
        btn.style.visibility = "";
        delete btn.dataset.fmMinLock;
    };

    if (shouldLock) {
        const firstCard = cards[0];
        lockBtn(firstCard?.querySelector(".remove-exercise-btn"), "אי אפשר להסיר את התרגיל הראשון");

        cards.forEach((card) => {
            const firstSetRow = card.querySelector(".set-row");
            lockBtn(firstSetRow?.querySelector(".remove-set-btn"), "אי אפשר להסיר את הסט הראשון");
        });
    } else {
        cards.forEach((card, idx) => {
            if (idx === 0) unlockBtn(card.querySelector(".remove-exercise-btn"));
            const firstSetRow = card.querySelector(".set-row");
            unlockBtn(firstSetRow?.querySelector(".remove-set-btn"));
        });
    }
}

function initSidebar() {
    const hamburgerButton = document.getElementById("hamburgerButton");
    const sidebar = document.getElementById("modernSidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const closeBtn = document.getElementById("sidebarCloseBtn");

    if (!hamburgerButton || !sidebar || !overlay) return;

    function openSidebar() {
        sidebar.classList.add("is-open");
        overlay.classList.add("is-active");
        hamburgerButton.classList.add("is-active");
        hamburgerButton.setAttribute("aria-expanded", "true");
    }

    function closeSidebar() {
        sidebar.classList.remove("is-open");
        overlay.classList.remove("is-active");
        hamburgerButton.classList.remove("is-active");
        hamburgerButton.setAttribute("aria-expanded", "false");
    }

    hamburgerButton.addEventListener("click", (e) => {
        e.stopPropagation();
        if (sidebar.classList.contains("is-open")) closeSidebar();
        else openSidebar();
    });

    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeSidebar();
    });
}

function initTrainingLog() {
    const dateInput = document.getElementById("workoutDate");
    if (dateInput) {
        const today = getTodayLocalIsoDate();
        dateInput.max = today;

        if (!dateInput.value || isFutureDate(dateInput.value)) {
            dateInput.value = today;
        }

        dateInput.addEventListener("click", () => {
            if (typeof dateInput.showPicker === "function") {
                dateInput.showPicker();
            }
        });
        dateInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && typeof dateInput.showPicker === "function") {
                e.preventDefault();
                dateInput.showPicker();
            }
        });
    }

    const dateGroup = document.querySelector(".date-selector-group");
    if (dateGroup && dateInput) {
        dateGroup.addEventListener("click", (e) => {
            if (e.target !== dateInput) {
                dateInput.focus();
                if (typeof dateInput.showPicker === "function") {
                    dateInput.showPicker();
                }
            }
        });
    }

    document.getElementById("addExerciseBtn")?.addEventListener("click", () => addExercise());
    document.getElementById("saveWorkoutBtn")?.addEventListener("click", saveWorkoutLog);
    document.getElementById("deleteWorkoutBtn")?.addEventListener("click", deleteWorkoutLog);
    
    if (dateInput) {
        dateInput.addEventListener("change", (e) => {
            const selected = e.target.value;
            if (isFutureDate(selected)) {
                const today = getTodayLocalIsoDate();
                e.target.value = today;
                if (typeof showToast === "function") {
                    showToast("אי אפשר לבחור תאריך עתידי", { variant: "danger", durationMs: 2400 });
                } else {
                    alert("אי אפשר לבחור תאריך עתידי");
                }
                loadLogForDate(today);
                return;
            }
            loadLogForDate(selected);
        });
        loadLogForDate(dateInput.value);
    }
}

async function getLogFromDB(date) {
    const userId = localStorage.getItem("fitmentorUserId");
    if (!userId) return null;

    console.log(`Fetching log for ${date}...`);
    try {
        const response = await apiRequest("getWorkoutLog", userId, { date });
        return response.log?.Data || response.log || null;
    } catch (error) {
        console.error("Error fetching log:", error);
        return null; 
    }
}

async function saveLogToDB(date, data) {
    const userId = localStorage.getItem("fitmentorUserId");
    if (!userId) throw new Error("User not logged in");

    console.log(`Saving log for ${date}...`, data);
    const payload = {
        date,
        log: {
            timestamp: data.timestamp,
            notes: data.notes,
            exercises: data.exercises,
            bodyWeightKg: data.bodyWeightKg ?? null
        }
    };
    await apiRequest("saveWorkoutLog", userId, payload);
}

async function deleteLogFromDB(date) {
    const userId = localStorage.getItem("fitmentorUserId");
    if (!userId) throw new Error("User not logged in");

    console.log(`Deleting log for ${date}...`);
    await apiRequest("deleteWorkoutLog", userId, { date });
}

async function loadLogForDate(date) {
    const exercisesList = document.getElementById("exercisesList");
    const notesInput = document.getElementById("workoutNotes");
    const bodyWeightInput = document.getElementById("bodyWeightKg");
    const deleteBtn = document.getElementById("deleteWorkoutBtn");

    let foundLog = false;
    
    exercisesList.innerHTML = "";
    if (notesInput) notesInput.value = "";
    if (bodyWeightInput) bodyWeightInput.value = "";
    if (deleteBtn) deleteBtn.style.display = "none";

    try {
        const log = await getLogFromDB(date);
        foundLog = Boolean(log);
        
        if (log) {
            console.log("Log found:", log);
            if (deleteBtn) deleteBtn.style.display = "inline-block";
            if (notesInput) notesInput.value = log.notes || "";
            if (bodyWeightInput && log.bodyWeightKg != null && log.bodyWeightKg !== "") {
                bodyWeightInput.value = String(log.bodyWeightKg);
            }
            
            if (log.exercises && log.exercises.length > 0) {
                log.exercises.forEach(exData => {
                    const card = addExercise(exData.name);
                    const setsList = card.querySelector(".sets-list");
                    setsList.innerHTML = "";
                    
                    if (exData.sets) {
                        exData.sets.forEach(setData => {
                            addSetRow(setsList, setData);
                        });
                    }
                });
            } else {
                 addExercise();
            }
        } else {
            console.log("No log found for this date.");

            if (isPastDate(date)) {
                exercisesList.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 12px;">אין לוג לתאריך זה.</div>';
            } else {
                addExercise();
            }
        }
    } catch (err) {
        console.error("Error loading log:", err);
        foundLog = false;
        if (isPastDate(date)) {
            exercisesList.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 12px;">לא הצלחתי לטעון את הלוג לתאריך הזה</div>';
        } else {
            addExercise();
        }
    }

    if (isPastDate(date)) {
        if (foundLog) {
            setPastNoLogView(false);
            setTrainingLogReadOnly(true);
        } else {
            setTrainingLogReadOnly(false);
            setPastNoLogView(true);
        }
    } else {
        setPastNoLogView(false);
        setTrainingLogReadOnly(false);
    }

    applyTodayEmptyLogMinimumLock({ date, foundLog });

    updateStats();
}

function addExercise(initialName = "") {
    const exercisesList = document.getElementById("exercisesList");
    const template = document.getElementById("exerciseTemplate");
    
    if (!exercisesList || !template) return;

    const clone = template.content.cloneNode(true);
    const exerciseCard = clone.querySelector(".exercise-card");
    
    const index = exercisesList.children.length + 1;
    exerciseCard.querySelector(".exercise-number").textContent = `#${index}`;
    
    if (initialName) {
        exerciseCard.querySelector(".exercise-name-input").value = initialName;
    }

    exerciseCard.querySelector(".remove-exercise-btn").addEventListener("click", () => {
        exerciseCard.remove();
        updateStats();
        renumberExercises();
        applyTodayEmptyLogMinimumLock();
    });

    const setsList = exerciseCard.querySelector(".sets-list");
    const addSetBtn = exerciseCard.querySelector(".add-set-btn");
    
    addSetBtn.addEventListener("click", () => addSetRow(setsList));

    if (!initialName) {
        addSetRow(setsList);
    }

    exercisesList.appendChild(exerciseCard);

    applyTodayEmptyLogMinimumLock();
    
    if (!initialName) {
        exerciseCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    updateStats();
    return exerciseCard;
}

function addSetRow(container, data = null) {
    const setNum = container.children.length + 1;
    
    const div = document.createElement("div");
    div.className = "set-row";
    div.innerHTML = `
        <span class="set-num">${setNum}</span>
        <input type="number" class="form-input set-input weight-input" placeholder="0" min="0" step="0.5">
        <input type="number" class="form-input set-input reps-input" placeholder="0" min="0">
        <input type="number" class="form-input set-input rest-input" placeholder="שניות" min="0">
        <input type="text" class="form-input set-input notes-input" placeholder="הערות">
        <button class="remove-set-btn" title="מחק סט">×</button>
    `;

    if (data) {
        div.querySelector(".weight-input").value = data.weight || "";
        div.querySelector(".reps-input").value = data.reps || "";
        div.querySelector(".rest-input").value = data.rest || "";
        div.querySelector(".notes-input").value = data.notes || "";
    }

    div.querySelector(".remove-set-btn").addEventListener("click", () => {
        div.remove();
        Array.from(container.children).forEach((row, idx) => {
            row.querySelector(".set-num").textContent = idx + 1;
        });
        updateStats();
        applyTodayEmptyLogMinimumLock();
    });

    div.querySelectorAll("input").forEach(input => {
        input.addEventListener("change", updateStats);
    });

    container.appendChild(div);
    updateStats();
    applyTodayEmptyLogMinimumLock();
}

function renumberExercises() {
    const list = document.getElementById("exercisesList");
    Array.from(list.children).forEach((card, idx) => {
        card.querySelector(".exercise-number").textContent = `#${idx + 1}`;
    });
}

function updateStats() {
    const exercises = document.querySelectorAll(".exercise-card").length;
    const sets = document.querySelectorAll(".set-row").length;
    
    document.getElementById("totalExercisesCount").textContent = exercises;
    document.getElementById("totalSetsCount").textContent = sets;
}

async function saveWorkoutLog() {
    const saveBtn = document.getElementById("saveWorkoutBtn");
    const date = document.getElementById("workoutDate").value;
    const globalNotes = document.getElementById("workoutNotes")?.value || "";
    const bodyWeightRaw = document.getElementById("bodyWeightKg")?.value;
    const bodyWeightKg = bodyWeightRaw === "" || bodyWeightRaw == null ? null : Number(bodyWeightRaw);
    const bodyWeightInputEl = document.getElementById("bodyWeightKg");
    const exercisesCards = document.querySelectorAll(".exercise-card");
    const userId = localStorage.getItem("fitmentorUserId") || "guest_user";

    if (isPastDate(date)) {
        if (typeof showToast === "function") {
            showToast("לוג בתאריך עבר הוא לצפייה בלבד", { variant: "danger", durationMs: 2400 });
        } else {
            alert("לוג בתאריך עבר הוא לצפייה בלבד");
        }
        return;
    }

    if (isFutureDate(date)) {
        if (typeof showToast === "function") {
            showToast("אי אפשר לשמור לוג לתאריך עתידי", { variant: "danger", durationMs: 2400 });
        } else {
            alert("אי אפשר לשמור לוג לתאריך עתידי");
        }
        return;
    }

    if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 30 || bodyWeightKg > 250) {
        const msg = "נא להזין משקל גוף תקין (30-250 ק\"ג)";
        if (typeof showToast === "function") {
            showToast(msg, { variant: "danger", durationMs: 2600 });
        } else {
            alert(msg);
        }
        try {
            if (bodyWeightInputEl) {
                bodyWeightInputEl.focus();
                bodyWeightInputEl.select?.();
            }
        } catch {}
        return;
    }

    const showValidationError = (msg) => {
        if (typeof showToast === "function") {
            showToast(msg, { variant: "danger", durationMs: 2800 });
        } else {
            alert(msg);
        }
    };

    const isValidExerciseName = (name) => {
        const s = String(name || "").trim();
        if (s.length < 2) return false;
        try {
            if (!/[\p{L}]/u.test(s)) return false;
        } catch {
            if (!/[A-Za-zא-ת]/.test(s)) return false;
        }
        if (/^[0-9\s\-_.]+$/.test(s)) return false;
        return true;
    };

    if (exercisesCards.length === 0) {
        showValidationError("יש להוסיף לפחות תרגיל אחד עם סט אחד לפחות.");
        return;
    }

    const workoutLog = {
        userId: userId,
        date: date,
        timestamp: new Date().toISOString(),
        notes: globalNotes,
        bodyWeightKg,
        exercises: []
    };

    let isValid = true;

    exercisesCards.forEach(card => {
        const nameInput = card.querySelector(".exercise-name-input");
        const nameRaw = (nameInput?.value || "").trim();
        const setRows = card.querySelectorAll(".set-row");

        let hasAnySetData = false;
        setRows.forEach((row) => {
            const w = (row.querySelector(".weight-input")?.value || "").trim();
            const r = (row.querySelector(".reps-input")?.value || "").trim();
            const rest = (row.querySelector(".rest-input")?.value || "").trim();
            const notes = (row.querySelector(".notes-input")?.value || "").trim();
            if (w || r || rest || notes) hasAnySetData = true;
        });

        const cardIsEmpty = !nameRaw && !hasAnySetData;
        if (cardIsEmpty) {
            if (nameInput) nameInput.style.borderColor = "";
            setRows.forEach((row) => {
                [".weight-input", ".reps-input", ".rest-input"].forEach((sel) => {
                    const el = row.querySelector(sel);
                    if (el) el.style.borderColor = "";
                });
            });
            return;
        }

        if (!isValidExerciseName(nameRaw)) {
            isValid = false;
            if (nameInput) nameInput.style.borderColor = "red";
        } else {
            if (nameInput) nameInput.style.borderColor = "";
        }

        const exerciseData = {
            name: nameRaw,
            sets: []
        };

        setRows.forEach(row => {
            const weightEl = row.querySelector(".weight-input");
            const repsEl = row.querySelector(".reps-input");
            const restEl = row.querySelector(".rest-input");
            const notesEl = row.querySelector(".notes-input");

            const weightRaw = (weightEl?.value || "").trim();
            const repsRaw = (repsEl?.value || "").trim();
            const restRaw = (restEl?.value || "").trim();
            const notes = (notesEl?.value || "");

            const rowAllEmpty = !weightRaw && !repsRaw && !restRaw && !String(notes || "").trim();
            if (rowAllEmpty) {
                if (weightEl) weightEl.style.borderColor = "";
                if (repsEl) repsEl.style.borderColor = "";
                if (restEl) restEl.style.borderColor = "";
                return;
            }

            let rowValid = true;
            if (!weightRaw) rowValid = false;
            if (!repsRaw) rowValid = false;
            if (!restRaw) rowValid = false;

            const weight = weightRaw === "" ? NaN : Number(weightRaw);
            const reps = repsRaw === "" ? NaN : Number(repsRaw);
            const rest = restRaw === "" ? NaN : Number(restRaw);

            if (!Number.isFinite(weight) || weight < 0) rowValid = false;
            if (!Number.isFinite(reps) || !Number.isInteger(reps) || reps < 1) rowValid = false;
            if (!Number.isFinite(rest) || !Number.isInteger(rest) || rest < 0) rowValid = false;

            if (weightEl) weightEl.style.borderColor = rowValid ? "" : "red";
            if (repsEl) repsEl.style.borderColor = rowValid ? "" : "red";
            if (restEl) restEl.style.borderColor = rowValid ? "" : "red";

            if (!rowValid) {
                isValid = false;
                return;
            }

            exerciseData.sets.push({ weight, reps, rest, notes });
        });

        if (exerciseData.sets.length === 0) {
            isValid = false;
        } else {
            workoutLog.exercises.push(exerciseData);
        }
    });

    if (!isValid) {
        showValidationError(
            "כדי לשמור אימון חייב להיות לפחות תרגיל אחד עם שם תקין וסט אחד תקין. בכל סט חובה למלא משקל, חזרות ומנוחה (לא שלילי)."
        );
        return;
    }

    if (workoutLog.exercises.length === 0) {
        showValidationError("כדי לשמור אימון חייב להיות לפחות תרגיל אחד עם סט אחד תקין.");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = "שומר נתונים... ⏳";

    try {
        console.log("Saving workout log to DynamoDB:", workoutLog);
        
        await saveLogToDB(date, workoutLog);

        if (typeof showToast === "function") {
            showToast("האימון נשמר בהצלחה.");
        }

        window.setTimeout(() => window.location.reload(), 200);
        
    } catch (error) {
        console.error("Error saving log:", error);
        alert("שגיאה בשמירת האימון. נסה שוב.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "שמור אימון ביומן";
    }
}

async function deleteWorkoutLog() {
    const date = document.getElementById("workoutDate").value;

    if (isPastDate(date)) {
        if (typeof showToast === "function") {
            showToast("לוג בתאריך עבר הוא לצפייה בלבד", { variant: "danger", durationMs: 2400 });
        } else {
            alert("לוג בתאריך עבר הוא לצפייה בלבד");
        }
        return;
    }

    if (isFutureDate(date)) {
        if (typeof showToast === "function") {
            showToast("אי אפשר לנהל לוג לתאריך עתידי", { variant: "danger", durationMs: 2400 });
        } else {
            alert("אי אפשר לנהל לוג לתאריך עתידי");
        }
        return;
    }

        const confirmed = await openDeleteLogConfirmModal(date);
        if (!confirmed) return;

    const deleteBtn = document.getElementById("deleteWorkoutBtn");
    deleteBtn.disabled = true;
    deleteBtn.textContent = "מוחק...";

    try {
        await deleteLogFromDB(date);
        if (typeof showToast === "function") {
            showToast("האימון נמחק בהצלחה.");
        }

        window.setTimeout(() => window.location.reload(), 200);
    } catch (err) {
        console.error("Error deleting log:", err);
        alert("שגיאה במחיקת האימון.");
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.textContent = "מחק אימון";
    }
}