// Filtres Type / Échéance ajoutés au gestionnaire de tâches Lucca.
// Lucca n'affiche que la date cible relative (« dans 8 jours », « il y a 1 jour », « dans 1 mois ») :
// on la convertit en nombre de jours par rapport à aujourd'hui.

const TASK_FILTER_PATH = "/workflow-automation/task-manager/tasks";
const TASK_FILTER_STORAGE_KEY = "supportIt.taskFilter";

const UNIT_DAYS = { jour: 1, semaine: 7, mois: 30, an: 365, année: 365 };

const PERIODS = [
  { value: "all", label: "Toutes les échéances", matches: () => true },
  { value: "late", label: "En retard", matches: days => days < 0 },
  { value: "today", label: "Aujourd'hui", matches: days => days === 0 },
  { value: "week", label: "7 prochains jours", matches: days => days >= 0 && days <= 7 },
  // Lucca passe en « mois » à partir de 30 jours : « dans N jours » est donc toujours < 30
  { value: "month", label: "30 prochains jours", matches: days => days >= 0 && days < 30 },
  { value: "later", label: "Dans 30 jours ou plus", matches: days => days >= 30 }
];

function parseTargetDays(text) {
  const value = String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!value) return null;
  if (value.includes("avant-hier")) return -2;
  if (value.includes("après-demain")) return 2;
  if (value.includes("aujourd")) return 0;
  if (value.includes("demain")) return 1;
  if (value.includes("hier")) return -1;
  const match = value.match(/(dans|il y a) (\d+|un|une) (jour|semaine|mois|an|année)/);
  if (!match) return null;
  const count = /^\d+$/.test(match[2]) ? Number(match[2]) : 1;
  const days = count * UNIT_DAYS[match[3]];
  return match[1] === "dans" ? days : -days;
}

function taskMatchesFilter(task, filter) {
  if (filter.type !== "all" && task.type !== filter.type) return false;
  const period = PERIODS.find(item => item.value === filter.period) ?? PERIODS[0];
  if (period.value === "all") return true;
  return task.days !== null && period.matches(task.days);
}

if (typeof module !== "undefined") module.exports = { parseTargetDays, taskMatchesFilter, PERIODS };

if (typeof document !== "undefined" && typeof location !== "undefined") startTaskFilter();

function startTaskFilter() {
  const filter = loadFilter();
  let scheduled = false;

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  schedule();

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (location.pathname.startsWith(TASK_FILTER_PATH)) refresh();
    });
  }

  function refresh() {
    const rows = [...document.querySelectorAll("app-task-manager-table tr.indexTable-body-row")];
    const tasks = rows.map(row => ({
      row,
      type: row.querySelector('[data-label^="Type"] .tag-content')?.textContent.trim() ?? "",
      days: parseTargetDays(row.querySelector('[data-label^="Date cible"]')?.textContent)
    }));
    const controls = ensureControls();
    if (!controls) return;
    syncTypeOptions(controls.type, tasks);

    let visible = 0;
    for (const task of tasks) {
      const shown = taskMatchesFilter(task, filter);
      if (shown) visible += 1;
      const display = shown ? "" : "none";
      if (task.row.style.display !== display) task.row.style.display = display;
    }
    const isFiltered = filter.type !== "all" || filter.period !== "all";
    const count = isFiltered ? `${visible} / ${tasks.length} tâches` : "";
    if (controls.count.textContent !== count) controls.count.textContent = count;
  }

  function ensureControls() {
    const existing = document.getElementById("support-it-task-filter");
    if (existing) {
      return {
        type: existing.querySelector('[data-filter="type"]'),
        count: existing.querySelector(".support-it-task-filter-count")
      };
    }
    const group = document.querySelector("lu-filter-bar .filterBar-scrollBox-group");
    if (!group) return null;
    injectStyle();

    const container = document.createElement("div");
    container.id = "support-it-task-filter";

    const type = createSelect("type", "Type de tâche", [{ value: "all", label: "Tous les types" }]);
    const period = createSelect("period", "Échéance", PERIODS);
    const count = document.createElement("span");
    count.className = "support-it-task-filter-count";

    container.append(type, period, count);
    group.append(container);
    return { type, count };
  }

  function createSelect(key, label, options) {
    const select = document.createElement("select");
    select.dataset.filter = key;
    select.title = label;
    select.setAttribute("aria-label", label);
    for (const option of options) select.append(new Option(option.label, option.value));
    if ([...select.options].some(option => option.value === filter[key])) select.value = filter[key];
    select.addEventListener("change", () => {
      filter[key] = select.value;
      saveFilter(filter);
      refresh();
    });
    return select;
  }

  function syncTypeOptions(select, tasks) {
    const known = new Set([...select.options].map(option => option.value));
    const types = [...new Set(tasks.map(task => task.type).filter(Boolean))].sort();
    if (filter.type !== "all") types.push(filter.type);
    for (const type of types) {
      if (known.has(type)) continue;
      known.add(type);
      select.append(new Option(type, type));
    }
    if (select.value !== filter.type) select.value = filter.type;
  }
}

function loadFilter() {
  const filter = { type: "all", period: "all" };
  try {
    Object.assign(filter, JSON.parse(localStorage.getItem(TASK_FILTER_STORAGE_KEY)) ?? {});
  } catch {}
  return filter;
}

function saveFilter(filter) {
  try {
    localStorage.setItem(TASK_FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {}
}

function injectStyle() {
  const style = document.createElement("style");
  style.textContent = `
    #support-it-task-filter {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-inline-start: 8px;
      white-space: nowrap;
    }
    #support-it-task-filter select {
      height: 32px;
      padding: 0 8px;
      border: 1px solid #c5cde0;
      border-radius: 8px;
      background: #fff;
      color: inherit;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }
    #support-it-task-filter select:focus-visible {
      outline: 2px solid #4a6cf7;
      outline-offset: 1px;
    }
    .support-it-task-filter-count {
      color: #5f6b85;
      font-size: 13px;
    }
  `;
  document.head.append(style);
}
