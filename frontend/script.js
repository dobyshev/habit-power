// Получаем ID пользователя из Telegram
let telegramId = null;
let tg = null;

try {
  // Инициализация Telegram WebApp
  tg = window.Telegram.WebApp;
  tg.expand(); // Разворачиваем на весь экран

  // Получаем данные пользователя
  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    telegramId = tg.initDataUnsafe.user.id;
    console.log("Telegram user ID:", telegramId);
  } else {
    // Если не в Telegram (для локального тестирования)
    console.log("Не в Telegram, используем тестовый ID");
    telegramId = 123456789;
  }
} catch (e) {
  console.log("Ошибка инициализации Telegram WebApp:", e);
  console.log("Используем тестовый режим");
  telegramId = 123456789;
}

// Проверяем, что ID получен
if (!telegramId) {
  console.error("Не удалось получить ID пользователя");
  telegramId = 123456789; // Запасной вариант
}

// API базовый URL
const API_BASE = "";

// Функция для показа ошибок
function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;
  document
    .querySelector(".app")
    .insertBefore(errorDiv, document.querySelector(".habits-container"));

  setTimeout(() => {
    errorDiv.remove();
  }, 3000);
}

// Функция для получения эмодзи по названию привычки
function getHabitEmoji(name) {
  const nameLower = name.toLowerCase();
  const emojiMap = {
    run: "🏃",
    бег: "🏃",
    read: "📚",
    читать: "📚",
    книга: "📚",
    water: "💧",
    вода: "💧",
    пить: "💧",
    workout: "💪",
    тренировка: "💪",
    спорт: "💪",
    code: "💻",
    код: "💻",
    программирование: "💻",
    sleep: "🛌",
    сон: "🛌",
    спать: "🛌",
    study: "📖",
    учиться: "📖",
    учеба: "📖",
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (nameLower.includes(key)) {
      return emoji;
    }
  }
  return "⭐";
}

function updateHabitsCounter(count) {
  const counter = document.getElementById("habitsCounter");
  if (counter) {
    const word = getHabitWord(count);
    counter.textContent = `${count} ${word}`;
  }
}

function getHabitWord(count) {
  if (count === 1) return "привычка";
  if (count >= 2 && count <= 4) return "привычки";
  return "привычек";
}

// Создание карточки привычки (обновленная версия)
function createHabitCard(habit) {
  const card = document.createElement("div");
  card.className = "habit-card";
  card.dataset.habitId = habit.id;

  const emoji = getHabitEmoji(habit.name);
  const isCompleted = habit.completed_today || false;

  card.innerHTML = `
        <div class="habit-emoji ${isCompleted ? "completed" : ""}" id="habitEmoji-${habit.id}">${emoji}</div>
        <div class="habit-info">
            <div class="habit-name">${habit.name}</div>
            <div class="habit-streak">
                <span>🔥 Серия:</span>
                <span class="streak-number" id="streak-${habit.id}">${habit.streak} дней</span>
            </div>
        </div>
        <div class="habit-actions">
            <button class="delete-btn">🗑</button>
        </div>
    `;

  // Обработчик выполнения на эмодзи
  const emojiDiv = card.querySelector(".habit-emoji");
  emojiDiv.addEventListener("click", async () => {
    if (emojiDiv.classList.contains("completed")) return;

    try {
      const response = await fetch(`${API_BASE}/api/complete-habit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habit_id: habit.id,
          telegram_id: telegramId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.detail === "already_done") {
          showError("Уже выполнено сегодня");
          emojiDiv.classList.add("completed");
        }
        return;
      }

      const data = await response.json();
      console.log("✅ Привычка выполнена:", data);

      emojiDiv.classList.add("completed");

      const streakSpan = document.getElementById(`streak-${habit.id}`);
      if (streakSpan) {
        streakSpan.textContent = `${data.streak} дней`;
      }

      document.getElementById("points").textContent = data.points;

      // Обновляем статистику
      await loadStatistics();
    } catch (error) {
      console.error("Ошибка выполнения:", error);
      showError("Не удалось отметить выполнение");
    }
  });

  // Обработчик удаления
  const deleteBtn = card.querySelector(".delete-btn");
  deleteBtn.addEventListener("click", async () => {
    if (confirm("Удалить привычку?")) {
      try {
        const response = await fetch(`${API_BASE}/api/delete-habit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ habit_id: habit.id }),
        });

        if (response.ok) {
          console.log("🗑 Привычка удалена");
          card.remove();

          const container = document.getElementById("habitsContainer");
          if (container.children.length === 0) {
            document.getElementById("emptyState").style.display = "block";
          }

          // Обновляем счетчик и статистику
          const habits = await fetch(
            `${API_BASE}/api/habits/${telegramId}`,
          ).then((r) => r.json());
          updateHabitsCounter(habits.length);
          await loadStatistics();
        }
      } catch (error) {
        console.error("Ошибка удаления:", error);
        showError("Не удалось удалить привычку");
      }
    }
  });

  return card;
}

// Загрузка привычек
async function loadHabits() {
  if (!telegramId) {
    console.error("loadHabits: telegramId отсутствует");
    return;
  }

  try {
    console.log("Загрузка привычек для telegramId:", telegramId);
    const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);

    if (!response.ok) {
      console.error("Ошибка загрузки привычек:", response.status);
      return;
    }

    const habits = await response.json();
    console.log("📋 Загружены привычки:", habits);

    const container = document.getElementById("habitsContainer");
    const emptyState = document.getElementById("emptyState");

    if (!container) {
      console.error("Контейнер habitsContainer не найден");
      return;
    }

    // Очищаем контейнер
    container.innerHTML = "";

    if (!habits || habits.length === 0) {
      console.log("Нет привычек, показываем пустое состояние");
      if (emptyState) {
        emptyState.style.display = "block";
        container.appendChild(emptyState);
      }
    } else {
      console.log(`Создаем ${habits.length} карточек привычек`);
      if (emptyState) {
        emptyState.style.display = "none";
      }

      habits.forEach((habit) => {
        const card = createHabitCard(habit);
        container.appendChild(card);
      });
    }

    updateHabitsCounter(habits ? habits.length : 0);
  } catch (error) {
    console.error("Ошибка загрузки привычек:", error);
    showError("Не удалось загрузить привычки");
  }
}

// Загрузка очков пользователя
async function loadUserPoints() {
  try {
    const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    const habits = await response.json();

    // Получаем очки через отдельный запрос или вычисляем
    const pointsResponse = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        telegram_id: telegramId,
      }),
    });

    const userData = await pointsResponse.json();
    document.getElementById("points").textContent = userData.points;
  } catch (error) {
    console.error("Error loading points:", error);
  }
}

// ===== ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ И ОБНОВЛЕНИЯ СТАТИСТИКИ =====
async function loadStatistics() {
  if (!telegramId) return;

  try {
    // 1. Получаем привычки пользователя, чтобы посчитать статистику
    const habitsResponse = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    if (!habitsResponse.ok) {
      console.error("Ошибка загрузки привычек для статистики");
      return;
    }
    const habits = await habitsResponse.json();

    // 2. Получаем очки пользователя
    const pointsResponse = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    if (!pointsResponse.ok) {
      console.error("Ошибка загрузки очков для статистики");
      return;
    }
    const userData = await pointsResponse.json();

    // 3. Рассчитываем показатели
    const habitsCount = habits.length;

    // Суммируем все streak (это и есть общее количество выполнений)
    const totalCompletions = habits.reduce(
      (sum, habit) => sum + (habit.streak || 0),
      0,
    );

    // Находим максимальный streak
    const bestStreak = habits.reduce(
      (max, habit) => Math.max(max, habit.streak || 0),
      0,
    );

    // 4. Обновляем DOM
    document.getElementById("stat-points").textContent = userData.points || 0;
    document.getElementById("stat-best-streak").textContent = bestStreak;
    document.getElementById("stat-total-completions").textContent =
      totalCompletions;
    document.getElementById("stat-habits-count").textContent = habitsCount;
  } catch (error) {
    console.error("Ошибка при загрузке статистики:", error);
  }
}

// Загрузка рейтинга
async function loadLeaderboard() {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`);
    const leaderboard = await response.json();

    const list = document.getElementById("leaderboardList");
    list.innerHTML = "";

    leaderboard.forEach((user, index) => {
      const item = document.createElement("div");
      item.className = "leaderboard-item";
      item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-id">${user.telegram_id}</span>
                <span class="leaderboard-points">${user.points} ⭐</span>
            `;
      list.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading leaderboard:", error);
    showError("Ошибка при загрузке рейтинга");
  }
}

// Инициализация приложения
async function initApp() {
  if (!telegramId) {
    showError("Не удалось получить ID пользователя");
    return;
  }

  try {
    // Создаем/получаем пользователя
    const userResponse = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    const userData = await userResponse.json();
    console.log("Пользователь создан/получен:", userData);

    // Загружаем привычки
    await loadHabits();

    // Обновляем счетчик
    const habits = await fetch(`${API_BASE}/api/habits/${telegramId}`).then(
      (r) => r.json(),
    );
    updateHabitsCounter(habits.length);

    // Загружаем очки
    document.getElementById("points").textContent = userData.points;

    // Загружаем статистику
    await loadStatistics();
  } catch (error) {
    console.error("Ошибка при инициализации:", error);
    showError("Ошибка при подключении к серверу");
  }
}

// ===== ЛОГИКА ДЛЯ РАСКРЫВАЮЩЕГОСЯ БЛОКА СТАТИСТИКИ =====
function initStatsToggle() {
  const statsHeader = document.getElementById("statsToggle");
  const statsContent = document.getElementById("statsContent");
  const statsArrow = document.getElementById("statsArrow");

  if (!statsHeader || !statsContent || !statsArrow) return;

  // Проверяем, сохранено ли состояние в localStorage
  const isStatsOpen = localStorage.getItem("statsOpen") === "true";

  // Устанавливаем начальное состояние
  if (isStatsOpen) {
    statsContent.classList.add("open");
    statsArrow.classList.add("rotated");
  }

  // Обработчик клика
  statsHeader.addEventListener("click", () => {
    const isOpen = statsContent.classList.contains("open");

    if (isOpen) {
      statsContent.classList.remove("open");
      statsArrow.classList.remove("rotated");
      localStorage.setItem("statsOpen", "false");
    } else {
      statsContent.classList.add("open");
      statsArrow.classList.add("rotated");
      localStorage.setItem("statsOpen", "true");
    }
  });
}

// ===== ЛОГИКА ДЛЯ РАСКРЫВАЮЩЕГОСЯ БЛОКА ПРИВЫЧЕК =====
function initHabitsToggle() {
  const habitsHeader = document.getElementById("habitsToggle");
  const habitsContent = document.getElementById("habitsContent");
  const habitsArrow = document.getElementById("habitsArrow");

  if (!habitsHeader || !habitsContent || !habitsArrow) return;

  // Проверяем, сохранено ли состояние в localStorage (по умолчанию открыто)
  const isHabitsOpen = localStorage.getItem("habitsOpen") !== "false";

  // Устанавливаем начальное состояние
  if (isHabitsOpen) {
    habitsContent.classList.add("open");
    habitsArrow.classList.add("rotated");
  }

  // Обработчик клика
  habitsHeader.addEventListener("click", () => {
    const isOpen = habitsContent.classList.contains("open");

    if (isOpen) {
      habitsContent.classList.remove("open");
      habitsArrow.classList.remove("rotated");
      localStorage.setItem("habitsOpen", "false");
    } else {
      habitsContent.classList.add("open");
      habitsArrow.classList.add("rotated");
      localStorage.setItem("habitsOpen", "true");
    }
  });
}

// Единый обработчик событий при загрузке DOM
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM загружен, инициализация приложения...");

  // Инициализируем приложение
  initApp();

  // Инициализируем сворачивание статистики
  initStatsToggle();

  // Инициализируем сворачивание привычек
  initHabitsToggle();

  // Добавление привычки
  const addBtn = document.getElementById("addHabitBtn");
  if (addBtn) {
    addBtn.addEventListener("click", async () => {
      const input = document.getElementById("habitName");
      const name = input.value.trim();

      if (!name) {
        showError("Введите название привычки");
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/add-habit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telegram_id: telegramId,
            name: name,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.detail === "Maximum habits limit (10) reached") {
            showError("Максимум 10 привычек");
          }
          return;
        }

        console.log("Привычка добавлена:", data);
        input.value = "";

        // Принудительно загружаем привычки заново
        await loadHabits();
        await loadStatistics();
      } catch (error) {
        console.error("Error adding habit:", error);
        showError("Ошибка при добавлении привычки");
      }
    });
  }

  // Рейтинг
  const leaderboardBtn = document.getElementById("leaderboardBtn");
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener("click", async () => {
      await loadLeaderboard();
      document.getElementById("leaderboardModal").classList.add("show");
    });
  }

  const closeBtn = document.getElementById("closeModalBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("leaderboardModal").classList.remove("show");
    });
  }

  // Закрытие модального окна по клику вне его
  const modal = document.getElementById("leaderboardModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("show");
      }
    });
  }

  // Добавление привычки по Enter
  const habitInput = document.getElementById("habitName");
  if (habitInput) {
    habitInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        document.getElementById("addHabitBtn").click();
      }
    });
  }
});
