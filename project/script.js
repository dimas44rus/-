"use strict";

/* ============================================================
   Константы и состояние
   ============================================================ */

const STORAGE_KEY = "study_tasks_v2";
const THEME_KEY = "study_tasks_theme";

const PRIORITY_ORDER = { high: 3, medium: 2, low: 1 };
const PRIORITY_LABEL = { high: "Высокий", medium: "Средний", low: "Низкий" };

/** @type {Array<{id:string,title:string,description:string,priority:string,dueDate:string,done:boolean,createdAt:number}>} */
let tasks = [];
let currentFilter = "all";
let currentSort = "created";
let editingId = null;

/* ============================================================
   Ссылки на DOM-элементы
   ============================================================ */

const els = {
  form: document.getElementById("taskForm"),
  formTitle: document.getElementById("formTitle"),
  taskId: document.getElementById("taskId"),
  title: document.getElementById("title"),
  titleError: document.getElementById("titleError"),
  description: document.getElementById("description"),
  priority: document.getElementById("priority"),
  dueDate: document.getElementById("dueDate"),
  submitBtn: document.getElementById("submitBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),

  statTotal: document.getElementById("statTotal"),
  statDone: document.getElementById("statDone"),
  statActive: document.getElementById("statActive"),
  progressBar: document.getElementById("progressBar"),

  taskList: document.getElementById("taskList"),
  emptyState: document.getElementById("emptyState"),

  filters: document.querySelectorAll(".chip"),
  sortSelect: document.getElementById("sortSelect"),
  searchInput: document.getElementById("searchInput"),

  themeToggle: document.getElementById("themeToggle"),
  clearDoneBtn: document.getElementById("clearDoneBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importFile: document.getElementById("importFile"),
};

/* ============================================================
   Работа с localStorage
   ============================================================ */

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Ошибка чтения localStorage:", err);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error("Ошибка записи в localStorage:", err);
  }
}

/* ============================================================
   Тема
   ============================================================ */

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  els.themeToggle.textContent = isDark ? "☀️" : "🌙";
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) {
    applyTheme(saved);
    return;
  }
  // Автоопределение по системной теме
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

els.themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark");
  const next = isDark ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

/* ============================================================
   Утилиты
   ============================================================ */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

/** Возвращает количество дней до срока (может быть отрицательным) */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due - today) / 86400000);
}

/* ============================================================
   CRUD
   ============================================================ */

function addTask(data) {
  tasks.push({
    id: generateId(),
    title: data.title,
    description: data.description,
    priority: data.priority,
    dueDate: data.dueDate,
    done: false,
    createdAt: Date.now(),
  });
  saveTasks();
}

function updateTask(id, data) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.title = data.title;
  task.description = data.description;
  task.priority = data.priority;
  task.dueDate = data.dueDate;
  saveTasks();
}

function deleteTask(id) {
  const li = document.querySelector(`.task[data-id="${id}"]`);
  const finish = () => {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  };
  if (li) {
    li.style.opacity = "0";
    li.style.transform = "translateX(24px)";
    setTimeout(finish, 200);
  } else {
    finish();
  }
}

function toggleDone(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.done = !task.done;
  saveTasks();
}

/* ============================================================
   Фильтрация и сортировка
   ============================================================ */

function getVisibleTasks() {
  let result = [...tasks];

  // Фильтр
  switch (currentFilter) {
    case "active":
      result = result.filter((t) => !t.done);
      break;
    case "done":
      result = result.filter((t) => t.done);
      break;
    case "high":
      result = result.filter((t) => t.priority === "high");
      break;
    // "all" — без фильтра
  }

  // Поиск
  const q = els.searchInput.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }

  // Сортировка
  switch (currentSort) {
    case "dueDate":
      result.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      break;
    case "priority":
      result.sort(
        (a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
      );
      break;
    case "created":
    default:
      result.sort((a, b) => b.createdAt - a.createdAt);
  }

  return result;
}

/* ============================================================
   Рендер
   ============================================================ */

function renderStats() {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const active = total - done;

  els.statTotal.textContent = total;
  els.statDone.textContent = done;
  els.statActive.textContent = active;

  const percent = total ? Math.round((done / total) * 100) : 0;
  els.progressBar.style.width = percent + "%";
}

function renderFilterCounts() {
  const all = tasks.length;
  const active = tasks.filter((t) => !t.done).length;
  const done = tasks.filter((t) => t.done).length;
  const high = tasks.filter((t) => t.priority === "high").length;

  const map = { all, active, done, high };
  els.filters.forEach((chip) => {
    const f = chip.dataset.filter;
    const labelMap = {
      all: "Все",
      active: "Активные",
      done: "Выполненные",
      high: "Высокий",
    };
    chip.textContent = `${labelMap[f]} (${map[f] ?? 0})`;
  });
}

function renderTasks() {
  const visible = getVisibleTasks();
  els.taskList.innerHTML = "";

  if (visible.length === 0) {
    els.emptyState.hidden = false;
    const isEmptyBase = tasks.length === 0;
    els.emptyState.textContent = isEmptyBase
      ? "Пока нет задач — добавьте первую 👆"
      : "Ничего не найдено по текущему фильтру 🔍";
    return;
  }
  els.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();

  visible.forEach((task) => {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " is-done" : "");
    li.dataset.id = task.id;
    li.dataset.priority = task.priority;

    // Блок срока
    let dueHtml = "";
    let urgentBadge = "";
    if (task.dueDate) {
      const diff = daysUntil(task.dueDate);
      let dueClass = "due";
      let note = "";
      if (!task.done) {
        if (diff < 0) {
          dueClass = "due due--soon";
          note = ` (просрочено на ${Math.abs(diff)} дн.)`;
        } else if (diff === 0) {
          dueClass = "due due--soon";
          note = " (сегодня)";
        } else if (diff === 1) {
          dueClass = "due due--soon";
          note = " (завтра)";
        } else if (diff <= 3) {
          dueClass = "due due--soon";
          note = ` (через ${diff} дн.)`;
        }
      }
      dueHtml = `<span class="${dueClass}">📅 ${formatDate(task.dueDate)}${note}</span>`;

      if (!task.done && diff <= 1 && task.priority === "high") {
        urgentBadge = `<span class="badge badge--urgent">🔥 Срочно</span>`;
      }
    }

    li.innerHTML = `
      <input
        type="checkbox"
        class="task__checkbox"
        ${task.done ? "checked" : ""}
        data-action="toggle"
        aria-label="Отметить выполненной"
      />
      <div class="task__body">
        <h3 class="task__title">${escapeHtml(task.title)}</h3>
        ${
          task.description
            ? `<p class="task__desc">${escapeHtml(task.description)}</p>`
            : ""
        }
        <div class="task__meta">
          <span class="badge badge--${task.priority}">
            ${PRIORITY_LABEL[task.priority]}
          </span>
          ${urgentBadge}
          ${dueHtml}
        </div>
      </div>
      <div class="task__actions">
        <button class="icon-btn" data-action="edit" title="Редактировать">✏️</button>
        <button class="icon-btn" data-action="delete" title="Удалить">🗑️</button>
      </div>
    `;

    fragment.appendChild(li);
  });

  els.taskList.appendChild(fragment);
}

function render() {
  renderStats();
  renderFilterCounts();
  renderTasks();
}

/* ============================================================
   Форма
   ============================================================ */

function validateForm() {
  const title = els.title.value.trim();
  if (!title) {
    els.titleError.textContent = "Введите название задачи";
    els.title.classList.add("form__input--error");
    return false;
  }
  if (title.length < 3) {
    els.titleError.textContent = "Название слишком короткое (мин. 3 символа)";
    els.title.classList.add("form__input--error");
    return false;
  }
  els.titleError.textContent = "";
  els.title.classList.remove("form__input--error");
  return true;
}

function resetForm() {
  els.form.reset();
  els.taskId.value = "";
  els.priority.value = "medium";
  els.titleError.textContent = "";
  els.title.classList.remove("form__input--error");
  editingId = null;

  els.formTitle.textContent = "Новая задача";
  els.submitBtn.textContent = "Добавить задачу";
  els.cancelEditBtn.hidden = true;
}

function startEdit(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  editingId = id;
  els.taskId.value = id;
  els.title.value = task.title;
  els.description.value = task.description;
  els.priority.value = task.priority;
  els.dueDate.value = task.dueDate;

  els.formTitle.textContent = "Редактирование задачи";
  els.submitBtn.textContent = "Сохранить изменения";
  els.cancelEditBtn.hidden = false;

  window.scrollTo({ top: 0, behavior: "smooth" });
  els.title.focus();
}

/* ============================================================
   Обработчики событий
   ============================================================ */

// Отправка формы
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const data = {
    title: els.title.value.trim(),
    description: els.description.value.trim(),
    priority: els.priority.value,
    dueDate: els.dueDate.value,
  };

  if (editingId) {
    updateTask(editingId, data);
  } else {
    addTask(data);
  }

  resetForm();
  render();
});

// Отмена редактирования
els.cancelEditBtn.addEventListener("click", () => {
  resetForm();
});

// Клики по списку задач
els.taskList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const li = e.target.closest(".task");
  if (!li) return;
  const id = li.dataset.id;
  const action = btn.dataset.action;

  if (action === "toggle") toggleDone(id);
  if (action === "edit") {
    startEdit(id);
    return;
  }
  if (action === "delete") {
    if (confirm("Удалить эту задачу?")) {
      deleteTask(id);
      return;
    }
  }

  render();
});

// Фильтры
els.filters.forEach((chip) => {
  chip.addEventListener("click", () => {
    els.filters.forEach((c) => c.classList.remove("is-active"));
    chip.classList.add("is-active");
    currentFilter = chip.dataset.filter;
    renderTasks();
  });
});

// Сортировка
els.sortSelect.addEventListener("change", () => {
  currentSort = els.sortSelect.value;
  renderTasks();
});

// Поиск
els.searchInput.addEventListener("input", () => {
  renderTasks();
});

// Очистить выполненные
els.clearDoneBtn.addEventListener("click", () => {
  const count = tasks.filter((t) => t.done).length;
  if (count === 0) {
    alert("Нет выполненных задач.");
    return;
  }
  if (!confirm(`Удалить ${count} выполненных задач?`)) return;
  tasks = tasks.filter((t) => !t.done);
  saveTasks();
  render();
});

// Экспорт
els.exportBtn.addEventListener("click", () => {
  if (tasks.length === 0) {
    alert("Нет задач для экспорта.");
    return;
  }
  const blob = new Blob([JSON.stringify(tasks, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tasks_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// Импорт
els.importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) {
        alert("Файл не содержит массив задач.");
        return;
      }
      if (
        !confirm(
          `Импортировать ${imported.length} задач?\nТекущие задачи будут заменены.`
        )
      ) {
        return;
      }
      // Нормализуем импортированные записи
      tasks = imported
        .filter((t) => t && typeof t === "object" && t.title)
        .map((t) => ({
          id: t.id || generateId(),
          title: String(t.title),
          description: String(t.description || ""),
          priority: ["low", "medium", "high"].includes(t.priority)
            ? t.priority
            : "medium",
          dueDate: typeof t.dueDate === "string" ? t.dueDate : "",
          done: Boolean(t.done),
          createdAt: Number(t.createdAt) || Date.now(),
        }));
      saveTasks();
      render();
      alert("Импорт завершён ✅");
    } catch (err) {
      console.error(err);
      alert("Некорректный JSON-файл.");
    } finally {
      els.importFile.value = "";
    }
  };
  reader.readAsText(file);
});

// Горячие клавиши
document.addEventListener("keydown", (e) => {
  // "/" — фокус на поиск
  if (e.key === "/" && document.activeElement !== els.title && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
    e.preventDefault();
    els.searchInput.focus();
  }
  // Esc — отмена редактирования
  if (e.key === "Escape" && editingId) {
    resetForm();
  }
});

/* ============================================================
   Инициализация
   ============================================================ */

function init() {
  initTheme();
  tasks = loadTasks();
  render();
}

init();