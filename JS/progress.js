let chart1rm;
let chartVolume;
let chartWeight;
let chartBalance;

let __exercise1rmPayload;
let __selectedExercise1rm;

let __progressDataCache;

document.addEventListener("DOMContentLoaded", () => {
	initSidebarToggle();
	initProgressPage();
});


async function initProgressPage() {
	try {
		if (typeof updateNavGreeting === "function") updateNavGreeting();
	} catch {
	}

	try {
		const data = await loadProgressData();
		__progressDataCache = data;
		renderAll(data);
		void hydrateAiInsights(data, { days: 30 });
	} catch (e) {
		console.error("Failed to load progress data:", e);
		if (typeof showToast === "function") showToast(formatApiError(e, "שגיאה בטעינת נתוני התקדמות"), { variant: "danger" });
		renderAll({ overview: {}, heatmap: [], charts: {}, prs: [], insights: {} });
	}
}

async function loadProgressData() {
	const userId = getUserId();
	if (typeof enforceAuthOrRedirect === "function") {
		if (!enforceAuthOrRedirect("נדרשת התחברות כדי לראות התקדמות")) throw new Error("Not authenticated");
	}
	if (typeof apiRequest !== "function") throw new Error("Missing apiRequest helper");
	const res = await apiRequest("getProgressData", userId, {});
	return normalizeProgressData(res);
}

async function loadAiInsights({ days = 30 } = {}) {
	const userId = getUserId();
	if (!userId) throw new Error("Missing userId");
	if (typeof apiRequest !== "function") throw new Error("Missing apiRequest helper");
	return await apiRequest("getAiInsights", userId, { days });
}

function setAiInsightsLoading() {
	const list = document.getElementById("recList");
	if (!list) return;
	const card = list.closest(".rec-card");
	if (card) card.classList.remove("is-scroll");
	list.innerHTML = `<div class="rec-item"><div class="rec-title">טוען תובנות...</div><div class="rec-text">מנתח את האימונים מהחודש האחרון.</div></div>`;
}

async function hydrateAiInsights(progressData, { days = 30 } = {}) {
	setAiInsightsLoading();
	try {
		const ai = await loadAiInsights({ days });
		const recs = ai?.recommendations || ai?.recs || [];
		if (!progressData.insights) progressData.insights = {};
		if (Array.isArray(recs)) progressData.insights.recommendations = recs;
		renderInsights({ insights: progressData.insights });
	} catch (e) {
		console.warn("Failed to load AI insights:", e);
		if (typeof showToast === "function") showToast(formatApiError(e, "שגיאה בטעינת AI Insights"), { variant: "danger" });
		renderInsights({ insights: progressData?.insights || {} });
	}
}

function normalizeProgressData(raw) {
	const overview = raw?.overview || raw?.stats || {};
	const heatmap = raw?.heatmap || raw?.heatmapYear || [];
	const charts = raw?.charts || {};
	const prs = raw?.prs || raw?.personalRecords || [];
	const insights = raw?.insights || raw?.smartInsights || {};
	return { overview, heatmap, charts, prs, insights };
}

function renderAll(data) {
	renderHeatmapAndStreaks(data);
	renderCharts(data);
	renderPRs(data);
	renderInsights(data);
}

function renderHeatmapAndStreaks({ overview, heatmap }) {
	const weightCanvas = document.getElementById("chartWeight");
	const weightValueEl = document.getElementById("weightValue");
	const weightDeltaEl = document.getElementById("weightDelta");
	const calTitleEl = document.getElementById("calTitle");
	const calGridEl = document.getElementById("calGrid");
	const calPrevBtn = document.getElementById("calPrev");
	const calNextBtn = document.getElementById("calNext");
	const dayCaloriesValueEl = document.getElementById("dayCaloriesValue");
	const dayCaloriesMetaEl = document.getElementById("dayCaloriesMeta");

	const normalizedHeat = coerceHeatmapYear(heatmap);

	renderBodyweightChart(overview, weightCanvas, weightValueEl, weightDeltaEl);

	renderHebrewCalendar({
		calTitleEl,
		calGridEl,
		calPrevBtn,
		calNextBtn,
		byDateCount: normalizedHeat.byDateCount,
		byDateCalories: normalizedHeat.byDateCalories,
		dayCaloriesValueEl,
		dayCaloriesMetaEl,
	});
}

let __calState;

function renderHebrewCalendar({
	calTitleEl,
	calGridEl,
	calPrevBtn,
	calNextBtn,
	byDateCount,
	byDateCalories,
	dayCaloriesValueEl,
	dayCaloriesMetaEl,
}) {
	if (!calGridEl) return;

	if (!__calState) {
		const now = new Date();
		__calState = { year: now.getFullYear(), month: now.getMonth(), selectedIso: toISODate(startOfDay(now)) };
	}

	if (calPrevBtn && !calPrevBtn.dataset.bound) {
		calPrevBtn.dataset.bound = "1";
		calPrevBtn.addEventListener("click", () => {
			__calState.month -= 1;
			if (__calState.month < 0) {
				__calState.month = 11;
				__calState.year -= 1;
			}
			drawCalendar();
		});
	}
	if (calNextBtn && !calNextBtn.dataset.bound) {
		calNextBtn.dataset.bound = "1";
		calNextBtn.addEventListener("click", () => {
			__calState.month += 1;
			if (__calState.month > 11) {
				__calState.month = 0;
				__calState.year += 1;
			}
			drawCalendar();
		});
	}

	function drawCalendar() {
		const { year, month } = __calState;
		const first = new Date(year, month, 1);
		const firstDow = first.getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const daysPrevMonth = new Date(year, month, 0).getDate();
		const todayIso = toISODate(startOfDay(new Date()));

		if (calTitleEl) {
			const titleDate = new Date(year, month, 1);
			calTitleEl.textContent = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(titleDate);
		}

		calGridEl.innerHTML = "";

		const totalCells = 42;
		for (let i = 0; i < totalCells; i++) {
			const cell = document.createElement("div");
			cell.className = "cal-cell";

			let date;
			let inMonth = true;
			if (i < firstDow) {
				const dayNum = daysPrevMonth - (firstDow - 1 - i);
				date = new Date(year, month - 1, dayNum);
				inMonth = false;
				cell.classList.add("is-out");
				cell.textContent = String(dayNum);
			} else if (i >= firstDow + daysInMonth) {
				const dayNum = i - (firstDow + daysInMonth) + 1;
				date = new Date(year, month + 1, dayNum);
				inMonth = false;
				cell.classList.add("is-out");
				cell.textContent = String(dayNum);
			} else {
				const dayNum = i - firstDow + 1;
				date = new Date(year, month, dayNum);
				cell.textContent = String(dayNum);
			}

			const iso = toISODate(date);
			cell.dataset.date = iso;
			cell.title = new Intl.DateTimeFormat("he-IL", {
				weekday: "long",
				year: "numeric",
				month: "long",
				day: "numeric",
			}).format(date);

			const count = Number(byDateCount.get(iso) ?? 0);
			if (count > 0) cell.classList.add("has-workout");
			if (iso === todayIso) cell.classList.add("is-today");
			if (inMonth && iso === __calState.selectedIso) cell.classList.add("is-selected");

			if (inMonth) {
				cell.addEventListener("click", () => {
					__calState.selectedIso = iso;
					updateSelection();
					updateCaloriesPanel({ iso });
				});
			}

			calGridEl.appendChild(cell);
		}

		const selected = new Date(__calState.selectedIso + "T00:00:00");
		if (selected.getFullYear() !== year || selected.getMonth() !== month) {
			const today = new Date(todayIso + "T00:00:00");
			__calState.selectedIso = (today.getFullYear() === year && today.getMonth() === month)
				? todayIso
				: toISODate(new Date(year, month, 1));
			updateSelection();
		}

		updateCaloriesPanel({ iso: __calState.selectedIso });
	}

	function updateSelection() {
		for (const el of Array.from(calGridEl.querySelectorAll(".cal-cell"))) {
			const d = el.dataset.date;
			const dateObj = new Date(d + "T00:00:00");
			const isCurrentMonth = dateObj.getFullYear() === __calState.year && dateObj.getMonth() === __calState.month;
			el.classList.toggle("is-selected", isCurrentMonth && d === __calState.selectedIso);
		}
	}

	function updateCaloriesPanel({ iso }) {
		if (!dayCaloriesValueEl || !dayCaloriesMetaEl) return;
		const count = Number(byDateCount.get(iso) ?? 0);
		const calories = getCaloriesForDate(iso, byDateCount, byDateCalories);
		dayCaloriesValueEl.textContent = String(Math.max(0, Math.round(calories)));

		const label = new Intl.DateTimeFormat("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
			new Date(iso + "T00:00:00")
		);
		dayCaloriesMetaEl.textContent = count > 0 ? `${label} · ${count} אימונים` : `${label} · לא התאמנת ביום זה`;
	}

	drawCalendar();
}

function getCaloriesForDate(iso, byDateCount, byDateCalories) {
	const fromData = Number(byDateCalories?.get(iso));
	if (Number.isFinite(fromData)) return fromData;
	const count = Number(byDateCount?.get(iso) ?? 0);
	if (!Number.isFinite(count) || count <= 0) return 0;
	return 220 + count * 140;
}

function renderBodyweightChart(overview, canvas, valueEl, deltaEl) {
	if (!canvas || typeof Chart === "undefined") return;

	const emptyEl = document.getElementById("weightEmpty");
	const series = overview.bodyWeight || overview.bodyweight || overview.weight || null;
	const labels = Array.isArray(series?.labels) ? series.labels : [];
	const data = (Array.isArray(series?.data) ? series.data : []).map((v) => {
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	});

	const hasAnyPoints = labels.length > 0 && data.some((x) => typeof x === "number");
	if (!hasAnyPoints) {
		if (chartWeight) {
			chartWeight.destroy();
			chartWeight = null;
		}
		canvas.hidden = true;
		if (emptyEl) emptyEl.hidden = false;
		if (valueEl) valueEl.textContent = "--";
		if (deltaEl) {
			deltaEl.textContent = "--";
			deltaEl.classList.remove("is-up");
		}
		return;
	}

	canvas.hidden = false;
	if (emptyEl) emptyEl.hidden = true;

	const first = data.find((x) => typeof x === "number");
	const last = [...data].reverse().find((x) => typeof x === "number");
	if (typeof last === "number" && valueEl) valueEl.textContent = `${last.toFixed(1)}`;
	if (typeof first === "number" && typeof last === "number" && deltaEl) {
		const diff = last - first;
		const abs = Math.abs(diff).toFixed(1);
		const arrow = diff <= 0 ? "↓" : "↑";
		deltaEl.textContent = `${arrow} ${abs} ק\"ג`;
		deltaEl.classList.toggle("is-up", diff > 0);
	}

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const stroke = "rgba(34, 211, 238, 0.95)";
	const fill = ctx.createLinearGradient(0, 0, 0, 260);
	fill.addColorStop(0, "rgba(34, 211, 238, 0.22)");
	fill.addColorStop(1, "rgba(34, 211, 238, 0.02)");

	if (chartWeight) chartWeight.destroy();
	chartWeight = new Chart(ctx, {
		type: "line",
		data: {
			labels,
			datasets: [
				{
					label: "משקל",
					data,
					borderColor: stroke,
					backgroundColor: fill,
					fill: true,
					tension: 0.35,
					borderWidth: 2,
					pointRadius: 3.5,
					pointHoverRadius: 4.5,
					pointBackgroundColor: "rgba(15, 23, 42, 0.85)",
					pointBorderColor: stroke,
					pointBorderWidth: 2,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: "rgba(15, 23, 42, 0.92)",
					borderColor: "rgba(255,255,255,0.10)",
					borderWidth: 1,
				},
			},
			scales: {
				y: {
					grid: { color: "rgba(148, 163, 184, 0.16)" },
					ticks: { color: "rgba(148, 163, 184, 0.85)", maxTicksLimit: 5 },
				},
				x: {
					grid: { display: false },
					ticks: { color: "rgba(148, 163, 184, 0.75)", maxRotation: 0 },
				},
			},
		},
	});
}

function coerceHeatmapYear(input) {
	const map = new Map();
 	const caloriesMap = new Map();
	for (const item of Array.isArray(input) ? input : []) {
		if (!item || typeof item.date !== "string") continue;
		const count = Number(item.count ?? 0);
		map.set(item.date, Number.isFinite(count) ? count : 0);
		const calories = Number(item.calories);
		if (Number.isFinite(calories)) caloriesMap.set(item.date, calories);
	}

	const today = startOfDay(new Date());
	const start = new Date(today);
	start.setDate(start.getDate() - 364);

	const startDow = start.getDay();
	const cells = [];

	for (let i = 0; i < startDow; i++) {
		cells.push({ date: "", count: 0, level: 0, isBlank: true });
	}

	let total = 0;
	const byDate = new Map();
	const byDateCount = byDate;
	const byDateCalories = new Map();
	for (let i = 0; i < 365; i++) {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		const iso = toISODate(d);
		const count = map.has(iso) ? map.get(iso) : 0;
		const safeCount = Number.isFinite(count) ? count : 0;
		const level = clamp(Math.round(safeCount), 0, 4);
		total += safeCount > 0 ? 1 : 0;
		byDate.set(iso, safeCount);
		if (caloriesMap.has(iso)) byDateCalories.set(iso, caloriesMap.get(iso));
		cells.push({ date: iso, count: safeCount, level, isBlank: false });
	}

	const remainder = cells.length % 7;
	if (remainder !== 0) {
		const pad = 7 - remainder;
		for (let i = 0; i < pad; i++) {
			cells.push({ date: "", count: 0, level: 0, isBlank: true });
		}
	}

	return { cells, total, byDate, byDateCount, byDateCalories };
}

function computeStreaksFromHeatmap(byDate) {
	const today = startOfDay(new Date());
	let dayStreak = 0;
	for (let i = 0; i < 365; i++) {
		const d = new Date(today);
		d.setDate(today.getDate() - i);
		const iso = toISODate(d);
		const count = Number(byDate.get(iso) ?? 0);
		if (count > 0) dayStreak++;
		else break;
	}

	const weekBuckets = new Map();
	for (const [iso, count] of byDate.entries()) {
		if (!count || count <= 0) continue;
		const d = new Date(iso + "T00:00:00");
		const key = weekKey(d);
		weekBuckets.set(key, true);
	}

	let weekStreak = 0;
	let cursor = startOfWeekSunday(today);
	for (let i = 0; i < 60; i++) {
		const key = weekKey(cursor);
		if (weekBuckets.get(key)) {
			weekStreak++;
			cursor = new Date(cursor);
			cursor.setDate(cursor.getDate() - 7);
		} else {
			break;
		}
	}

	return { days: dayStreak, weeks: weekStreak };
}

function renderCharts({ charts, overview }) {
	const ctx1 = document.getElementById("chart1rm");
	const ctxV = document.getElementById("chartVolume");
	const exerciseSelect = document.getElementById("chart1rmExerciseSelect");
	const daySelect = document.getElementById("chart1rmDaySelect");
	const subtitleEl = document.getElementById("chart1rmSubtitle");
	const empty1rmEl = document.getElementById("chart1rmEmpty");
	const emptyVolEl = document.getElementById("chartVolumeEmpty");
	if (!ctx1 || !ctxV || typeof Chart === "undefined") return;

	const exercise1RM = charts.exercise1RM || charts.exerciseOneRM;
	const oneRM = charts.oneRM || charts.estimated1RM;
	const volume = charts.volume || charts.volumeLoad;

	if (chartVolume) chartVolume.destroy();

	Chart.defaults.color = "#cbd5e1";
	Chart.defaults.font.family = "system-ui, -apple-system, Segoe UI, sans-serif";

	const workoutDays30 = Array.isArray(overview?.workoutDays30) ? overview.workoutDays30 : [];
	const ex1rmByDay30 = overview?.exercise1rmByDay30 && typeof overview.exercise1rmByDay30 === "object" ? overview.exercise1rmByDay30 : {};
	const selectedDay = wire1rmDayDropdown({ daySelect, workoutDays30 });
	const isDayMode = Boolean(selectedDay);
	if (exerciseSelect) exerciseSelect.disabled = isDayMode;

	if (isDayMode) {
		const rows = Object.entries(ex1rmByDay30?.[selectedDay] || {})
			.map(([name, v]) => ({ name, v: Number(v) }))
			.filter((x) => x.name && Number.isFinite(x.v) && x.v > 0)
			.sort((a, b) => b.v - a.v)
			.slice(0, 18);

		if (rows.length === 0) {
			if (chart1rm) {
				chart1rm.destroy();
				chart1rm = null;
			}
			ctx1.hidden = true;
			if (subtitleEl) subtitleEl.textContent = "אין נתונים זמינים להצגה";
			if (empty1rmEl) empty1rmEl.hidden = false;
		} else {
			if (empty1rmEl) empty1rmEl.hidden = true;
			ctx1.hidden = false;
			if (subtitleEl) subtitleEl.textContent = `יום: ${formatYmdHe(selectedDay)} · Estimated 1RM לפי תרגילים`;
			renderDayExercise1rmChart(ctx1, rows);
		}
	} else if (exercise1RM && exercise1RM.labels && exercise1RM.seriesByExercise) {
		__exercise1rmPayload = exercise1RM;
		if (exerciseSelect) {
			const exercises = Array.isArray(exercise1RM.exercises) ? exercise1RM.exercises : Object.keys(exercise1RM.seriesByExercise);
			exerciseSelect.innerHTML = "";
			for (const name of exercises) {
				const opt = document.createElement("option");
				opt.value = name;
				opt.textContent = name;
				exerciseSelect.appendChild(opt);
			}
			exerciseSelect.disabled = exercises.length === 0;

			if (!__selectedExercise1rm || !exercises.includes(__selectedExercise1rm)) {
				__selectedExercise1rm = exercises[0] || "";
			}
			exerciseSelect.value = __selectedExercise1rm;

			if (!exerciseSelect.dataset.bound) {
				exerciseSelect.dataset.bound = "1";
				exerciseSelect.addEventListener("change", () => {
					__selectedExercise1rm = exerciseSelect.value;
					renderExercise1rmChart(ctx1, __exercise1rmPayload, __selectedExercise1rm, subtitleEl);
				});
			}
		}

		if (empty1rmEl) empty1rmEl.hidden = true;
		ctx1.hidden = false;
		renderExercise1rmChart(ctx1, __exercise1rmPayload, __selectedExercise1rm, subtitleEl);
	} else if (oneRM) {
		const c = ctx1.getContext("2d");
		if (chart1rm) chart1rm.destroy();

		const gradients = {
			bench: makeLineGradient(c, "#22d3ee", "#a855f7"),
			squat: makeLineGradient(c, "#34d399", "#22d3ee"),
			deadlift: makeLineGradient(c, "#f87171", "#a855f7"),
		};

		if (exerciseSelect) {
			exerciseSelect.innerHTML = "";
			exerciseSelect.disabled = true;
		}
		if (subtitleEl) subtitleEl.textContent = "סקוואט • בנץ׳ • דדליפט";

		if (empty1rmEl) empty1rmEl.hidden = true;
		ctx1.hidden = false;
		chart1rm = new Chart(c, {
			type: "line",
			data: {
				labels: oneRM.labels,
				datasets: (oneRM.datasets || []).map((ds) => {
					const key = (ds.key || ds.label || "").toLowerCase();
					const grad =
						key.includes("bench") ? gradients.bench :
						key.includes("squat") ? gradients.squat :
						key.includes("dead") ? gradients.deadlift :
						makeLineGradient(c, "#22d3ee", "#a855f7");

					return {
						label: ds.label,
						data: ds.data,
						borderColor: grad,
						backgroundColor: "rgba(34, 211, 238, 0.08)",
						tension: 0.35,
						pointRadius: 3,
						pointHoverRadius: 6,
						borderWidth: 3,
					};
				}),
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { labels: { boxWidth: 14, boxHeight: 14 } },
					tooltip: {
						backgroundColor: "rgba(15, 23, 42, 0.9)",
						borderColor: "rgba(255,255,255,0.10)",
						borderWidth: 1,
					},
				},
				scales: {
					y: { grid: { color: "rgba(148, 163, 184, 0.18)" } },
					x: { grid: { display: false } },
				},
			},
		});
	}

	if (!isDayMode && !exercise1RM && !oneRM) {
		const hasAnyWorkouts = Boolean(overview?.hasAnyWorkouts) || (Array.isArray(workoutDays30) && workoutDays30.length > 0);
		if (!hasAnyWorkouts) {
			if (chart1rm) {
				chart1rm.destroy();
				chart1rm = null;
			}
			ctx1.hidden = true;
			if (subtitleEl) subtitleEl.textContent = "אין נתונים זמינים להצגה";
			if (empty1rmEl) empty1rmEl.hidden = false;
		}
	}

	if (volume && Array.isArray(volume.labels) && volume.labels.length > 0 && Array.isArray(volume.data) && volume.data.length > 0) {
		const c = ctxV.getContext("2d");

		const barGradient = c.createLinearGradient(0, 0, 0, 320);
		barGradient.addColorStop(0, "rgba(248, 113, 113, 0.95)");
		barGradient.addColorStop(1, "rgba(168, 85, 247, 0.85)");

		chartVolume = new Chart(c, {
			type: "bar",
			data: {
				labels: volume.labels,
				datasets: [
					{
						label: "Volume",
						data: volume.data,
						backgroundColor: barGradient,
						borderRadius: 10,
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: "rgba(15, 23, 42, 0.9)",
						borderColor: "rgba(255,255,255,0.10)",
						borderWidth: 1,
					},
				},
				scales: {
					y: { grid: { color: "rgba(148, 163, 184, 0.18)" } },
					x: { grid: { display: false } },
				},
			},
		});
		ctxV.hidden = false;
		if (emptyVolEl) emptyVolEl.hidden = true;
	} else {
		if (chartVolume) {
			chartVolume.destroy();
			chartVolume = null;
		}
		ctxV.hidden = true;
		if (emptyVolEl) emptyVolEl.hidden = false;
	}
}

function wire1rmDayDropdown({ daySelect, workoutDays30 }) {
	if (!daySelect) return "";

	const days = Array.isArray(workoutDays30) ? workoutDays30 : [];
	const prev = String(daySelect.value || "");
	daySelect.innerHTML = "";
	daySelect.hidden = false;

	const ph = document.createElement("option");
	ph.value = "";
	ph.textContent = days.length > 0 ? "בחר יום (30 ימים אחרונים)" : "אין אימונים ב-30 ימים אחרונים";
	daySelect.appendChild(ph);

	for (const ymd of days) {
		const opt = document.createElement("option");
		opt.value = ymd;
		opt.textContent = formatYmdHe(ymd);
		daySelect.appendChild(opt);
	}

	daySelect.disabled = days.length === 0;
	daySelect.value = days.includes(prev) ? prev : "";

	if (!daySelect.dataset.bound) {
		daySelect.dataset.bound = "1";
		daySelect.addEventListener("change", () => {
			if (__progressDataCache) renderCharts(__progressDataCache);
		});
	}

	return String(daySelect.value || "");
}

function renderDayExercise1rmChart(canvasEl, rows) {
	if (!canvasEl || typeof Chart === "undefined") return;
	const c = canvasEl.getContext("2d");
	if (!c) return;

	if (chart1rm) chart1rm.destroy();

	const labels = rows.map((r) => r.name);
	const data = rows.map((r) => Math.round(r.v));
	const grad = c.createLinearGradient(0, 0, 0, 320);
	grad.addColorStop(0, "rgba(34, 211, 238, 0.95)");
	grad.addColorStop(1, "rgba(168, 85, 247, 0.85)");

	chart1rm = new Chart(c, {
		type: "bar",
		data: {
			labels,
			datasets: [
				{
					label: "Estimated 1RM",
					data,
					backgroundColor: grad,
					borderRadius: 10,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			indexAxis: "y",
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: "rgba(15, 23, 42, 0.9)",
					borderColor: "rgba(255,255,255,0.10)",
					borderWidth: 1,
					callbacks: {
						label: (ctx) => ` ${ctx.raw} ק\"ג`,
					},
				},
			},
			scales: {
				x: { grid: { color: "rgba(148, 163, 184, 0.18)" } },
				y: { grid: { display: false } },
			},
		},
	});
}

function formatYmdHe(ymd) {
	if (!ymd || typeof ymd !== "string") return "";
	try {
		return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(ymd + "T00:00:00"));
	} catch {
		return ymd;
	}
}

function renderExercise1rmChart(canvasEl, payload, exerciseName, subtitleEl) {
	if (!canvasEl || !payload || !payload.labels) return;
	const c = canvasEl.getContext("2d");
	if (!c) return;

	const name = String(exerciseName || "").trim();
	const series = name && payload.seriesByExercise ? payload.seriesByExercise[name] : null;

	if (subtitleEl) subtitleEl.textContent = name ? `תרגיל: ${name}` : "בחר תרגיל מהלוג אימונים";

	if (chart1rm) chart1rm.destroy();

	const dataPoints = Array.isArray(series) ? series : payload.labels.map(() => null);
	const grad = makeLineGradient(c, "#22d3ee", "#a855f7");

	chart1rm = new Chart(c, {
		type: "line",
		data: {
			labels: payload.labels,
			datasets: [
				{
					label: name || "1RM",
					data: dataPoints,
					borderColor: grad,
					backgroundColor: "rgba(34, 211, 238, 0.08)",
					tension: 0.35,
					pointRadius: 3,
					pointHoverRadius: 6,
					borderWidth: 3,
					spanGaps: true,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: "rgba(15, 23, 42, 0.9)",
					borderColor: "rgba(255,255,255,0.10)",
					borderWidth: 1,
				},
			},
			scales: {
				y: { grid: { color: "rgba(148, 163, 184, 0.18)" } },
				x: { grid: { display: false } },
			},
		},
	});
}

function makeLineGradient(ctx, from, to) {
	const g = ctx.createLinearGradient(0, 0, 600, 0);
	g.addColorStop(0, from);
	g.addColorStop(1, to);
	return g;
}

function renderPRs({ prs }) {
	const grid = document.getElementById("prGrid");
	if (!grid) return;

	if (!Array.isArray(prs) || prs.length === 0) {
		grid.innerHTML = `<div class="card pr-card"><div class="pr-title">אין עדיין שיאים להצגה</div><div class="pr-meta text-muted">יכול להיות שלא תועדו אימונים או שאין מספיק נתונים כדי לחשב שיאים. תעד משקלים וחזרות, ושיאים יופיעו כאן ✨</div></div>`;
		return;
	}

	grid.innerHTML = prs
		.map((pr) => {
			const badge = pr.isNew ? `<div class="pr-badge">NEW</div>` : "";
			const title = escapeHtml(pr.title || pr.exercise || "PR");
			const value = escapeHtml(pr.value || pr.weight || pr.reps || "");
			const meta = escapeHtml(pr.meta || pr.date || pr.when || "");
			const message = pr.message ? `<div class="pr-meta" style="margin-top:8px;">${escapeHtml(pr.message)}</div>` : "";
			return `
				<div class="card pr-card">
					${badge}
					<div class="pr-title">${title}</div>
					<div class="pr-value">${value}</div>
					<div class="pr-meta">${meta}</div>
					${message}
				</div>
			`;
		})
		.join("");
}

function renderInsights({ insights }) {
	renderBodyBalanceChart(insights);
	const recs = insights.recommendations || insights.recs || [];
	const list = document.getElementById("recList");
	if (!list) return;
	const card = list.closest(".rec-card");

	if (!Array.isArray(recs) || recs.length === 0) {
		if (card) card.classList.remove("is-scroll");
		list.innerHTML = `<div class="rec-item"><div class="rec-title">אין תובנות זמינות</div><div class="rec-text">כשתצטבר היסטוריה של אימונים, FitMentor יתחיל להוציא תובנות.</div></div>`;
		return;
	}

	if (card) card.classList.toggle("is-scroll", recs.length > 3);

	list.innerHTML = recs
		.map((r) => {
			const type = (r.type || "tip").toLowerCase();
			const title = escapeHtml(r.title || defaultRecTitle(type));
			const text = escapeHtml(r.text || "");
			return `
				<div class="rec-item ${escapeHtml(type)}">
					<div class="rec-title">${title}</div>
					<div class="rec-text">${text}</div>
				</div>
			`;
		})
		.join("");
}

function renderBodyBalanceChart(insights) {
	const canvas = document.getElementById("chartBalance");
	if (!canvas || typeof Chart === "undefined") return;
	const balance = insights.balance || insights.bodyBalance || insights.muscleBalance;
	let labels;
	let data;

	if (balance && Array.isArray(balance.labels) && Array.isArray(balance.data)) {
		labels = balance.labels;
		data = balance.data;
	} else if (balance && typeof balance === "object") {
		const defaultOrder = [
			{ key: "chest", label: "חזה" },
			{ key: "back", label: "גב" },
			{ key: "legs", label: "רגליים" },
			{ key: "shoulders", label: "כתפיים" },
			{ key: "arms", label: "ידיים" },
			{ key: "core", label: "ליבה" },
		];
		labels = defaultOrder.map((x) => x.label);
		data = defaultOrder.map((x) => Number(balance?.[x.key] ?? 0));
	} else {
		labels = ["חזה", "גב", "רגליים", "כתפיים", "ידיים", "ליבה"];
		data = [0, 0, 0, 0, 0, 0];
	}

	const safeData = (Array.isArray(data) ? data : []).map((v) => {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	});

	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const stroke = makeLineGradient(ctx, "rgba(248, 113, 113, 1)", "rgba(168, 85, 247, 1)");
	const fill = makeLineGradient(ctx, "rgba(248, 113, 113, 0.22)", "rgba(168, 85, 247, 0.10)");

	if (chartBalance) chartBalance.destroy();
	chartBalance = new Chart(ctx, {
		type: "radar",
		data: {
			labels,
			datasets: [
				{
					label: "איזון גוף",
					data: safeData,
					borderColor: stroke,
					backgroundColor: fill,
					borderWidth: 2,
					pointRadius: 3,
					pointHoverRadius: 4,
					pointBackgroundColor: "rgba(255, 255, 255, 0.92)",
					pointBorderColor: "rgba(15, 23, 42, 0.8)",
					pointBorderWidth: 1,
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: "rgba(15, 23, 42, 0.92)",
					borderColor: "rgba(255,255,255,0.10)",
					borderWidth: 1,
					callbacks: {
						label: function (context) {
							return `${context.label}: ${context.raw}`;
						},
					},
				},
			},
			scales: {
				r: {
					beginAtZero: true,
					suggestedMax: 10,
					grid: { color: "rgba(148, 163, 184, 0.18)" },
					angleLines: { color: "rgba(148, 163, 184, 0.16)" },
					pointLabels: {
						color: "rgba(226, 232, 240, 0.92)",
						font: { size: 12, weight: "700" },
					},
					ticks: {
						display: false,
					},
				},
			},
			elements: {
				line: { tension: 0.2 },
			},
		},
	});
}

function defaultRecTitle(type) {
	if (type === "neglect") return "⚠️ נקודת חולשה";
	if (type === "stall") return "📉 זיהוי תקיעות";
	if (type === "progression") return "🚀 הצעת התקדמות";
	return "💡 טיפ";
}

function toISODate(d) {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function startOfDay(d) {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

function startOfWeekSunday(d) {
	const x = startOfDay(d);
	x.setDate(x.getDate() - x.getDay());
	return x;
}

function weekKey(d) {
	const s = startOfWeekSunday(d);
	return toISODate(s);
}

function clamp(n, min, max) {
	return Math.max(min, Math.min(max, n));
}

function escapeHtml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
