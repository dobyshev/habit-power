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
  // Удаляем предыдущие ошибки
  const existingErrors = document.querySelectorAll(".error-message");
  existingErrors.forEach((error) => error.remove());

  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;

  // Вставляем в начало .app
  const app = document.querySelector(".app");
  app.insertBefore(errorDiv, app.firstChild);

  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
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

// ===== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ПРОГРЕССА СЕГОДНЯ =====
async function updateTodayProgress() {
  if (!telegramId) return;

  try {
    // Получаем привычки пользователя
    const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    if (!response.ok) {
      console.error("Ошибка загрузки привычек для прогресса");
      return;
    }

    const habits = await response.json();

    // Общее количество привычек
    const totalHabits = habits.length;

    // Количество выполненных сегодня привычек
    const completedToday = habits.filter(
      (habit) => habit.completed_today,
    ).length;

    // Элементы DOM
    const percentEl = document.getElementById("progressPercent");
    const textEl = document.getElementById("progressText");
    const barFillEl = document.getElementById("progressBarFill");
    const messageEl = document.getElementById("progressMessage");

    // Проверяем, существуют ли элементы
    if (!percentEl || !textEl || !barFillEl || !messageEl) return;

    if (totalHabits === 0) {
      // Нет привычек
      percentEl.textContent = "0%";
      textEl.textContent = "Нет привычек";
      barFillEl.style.width = "0%";
      messageEl.textContent = "👋 Добавьте привычки для начала";
      return;
    }

    // Рассчитываем процент
    const percent = Math.round((completedToday / totalHabits) * 100);

    // Обновляем UI
    percentEl.textContent = `${percent}%`;
    textEl.textContent = `${completedToday} из ${totalHabits} привычек выполнено`;
    barFillEl.style.width = `${percent}%`;

    // Мотивационное сообщение
    if (percent === 100) {
      messageEl.textContent = "🎉 Отличная работа! Все привычки выполнены!";
    } else if (completedToday === 0) {
      messageEl.textContent = "💪 Начни день с выполнения привычек!";
    } else if (percent >= 50) {
      messageEl.textContent = "🔥 Так держать! Осталось совсем немного!";
    } else {
      messageEl.textContent =
        "💪 Продолжай! Каждая привычка приближает к цели!";
    }
  } catch (error) {
    console.error("Ошибка при обновлении прогресса:", error);
  }
}

// Создание карточки привычки
function createHabitCard(habit) {
  const card = document.createElement("div");
  card.className = "habit-card";
  card.dataset.habitId = habit.id;

  const emoji = getHabitEmoji(habit.name);
  const isCompleted = habit.completed_today || false;

  card.innerHTML = `
    <div class="habit-emoji ${isCompleted ? "completed" : ""}" id="habitEmoji-${habit.id}">
        ${isCompleted ? "✅" : emoji}
    </div>
    <div class="habit-info">
        <div class="habit-name ${isCompleted ? "completed-text" : ""}">${habit.name}</div>
        <div class="habit-streak">
            <span>🔥 Серия:</span>
            <span class="streak-number" id="streak-${habit.id}">${habit.streak} дней</span>
        </div>
    </div>
    <div class="habit-actions">
        <button class="delete-btn">🗑</button>
    </div>
  `;

  // Обработчик выполнения/отмены на эмодзи
  const emojiDiv = card.querySelector(".habit-emoji");
  const nameDiv = card.querySelector(".habit-name");

  emojiDiv.addEventListener("click", async (event) => {
    event.stopPropagation();

    const isCurrentlyCompleted = emojiDiv.classList.contains("completed");
    console.log(
      "Текущее состояние:",
      isCurrentlyCompleted ? "выполнено" : "не выполнено",
    );

    try {
      let response;
      let data;

      if (isCurrentlyCompleted) {
        // ОТМЕНА выполнения
        console.log("Отмена выполнения для habit_id:", habit.id);
        response = await fetch(`${API_BASE}/api/undo-habit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            habit_id: habit.id,
            telegram_id: telegramId,
          }),
        });
      } else {
        // ВЫПОЛНЕНИЕ
        console.log("Выполнение habit_id:", habit.id);
        response = await fetch(`${API_BASE}/api/complete-habit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            habit_id: habit.id,
            telegram_id: telegramId,
          }),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        console.error("Ошибка ответа:", error);

        if (error.detail === "already_done") {
          showError("Уже выполнено сегодня");
        } else if (error.detail === "not_done_today") {
          showError("Нельзя отменить - сегодня не выполняли");
        }
        return;
      }

      data = await response.json();
      console.log(
        isCurrentlyCompleted
          ? "↩️ Выполнение отменено:"
          : "✅ Привычка выполнена:",
        data,
      );

      // Принудительно удаляем все inline-стили перед изменением классов
      emojiDiv.style.cssText = "";

      if (isCurrentlyCompleted) {
        // Отмена выполнения
        emojiDiv.classList.remove("completed");
        emojiDiv.textContent = emoji;
        nameDiv.classList.remove("completed-text");

        // Для мобильных устройств: принудительно обновляем фон
        emojiDiv.style.backgroundColor = "";
        emojiDiv.style.background = "";
      } else {
        // Выполнение
        emojiDiv.classList.add("completed");
        emojiDiv.textContent = "✅";
        nameDiv.classList.add("completed-text");

        // Для мобильных устройств: принудительно устанавливаем фон
        emojiDiv.style.backgroundColor = "#2ecc71";
      }

      // Обновляем streak
      const streakSpan = document.getElementById(`streak-${habit.id}`);
      if (streakSpan) {
        streakSpan.textContent = `${data.streak} дней`;
      }

      // Обновляем очки
      document.getElementById("points").textContent = data.points;

      // Обновляем статистику
      await loadStatistics();

      // Обновляем прогресс сегодня
      await updateTodayProgress();

      // Обновляем habit.completed_today для будущих кликов
      habit.completed_today = !isCurrentlyCompleted;

      // Принудительно вызываем перерисовку для мобильных устройств
      emojiDiv.offsetHeight;
    } catch (error) {
      console.error("Ошибка:", error);
      showError("Не удалось обновить привычку");
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

          // Удаляем карточку
          card.remove();

          const container = document.getElementById("habitsContainer");
          let emptyState = document.getElementById("emptyState");

          const habitCards = container.querySelectorAll(".habit-card");
          const remainingHabits = habitCards.length;

          if (remainingHabits === 0) {
            if (!emptyState) {
              emptyState = document.createElement("div");
              emptyState.id = "emptyState";
              emptyState.className = "empty-state";
              emptyState.innerHTML = "<p>✨ Добавьте свою первую привычку</p>";
            }

            emptyState.style.display = "block";
            container.innerHTML = "";
            container.appendChild(emptyState);
          }

          // Обновляем счетчик
          updateHabitsCounter(remainingHabits);

          // Обновляем статистику
          await loadStatistics();

          // Обновляем прогресс сегодня
          await updateTodayProgress();
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

// Функция для загрузки и обновления статистики
async function loadStatistics() {
  if (!telegramId) return;

  try {
    const habitsResponse = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    if (!habitsResponse.ok) {
      console.error("Ошибка загрузки привычек для статистики");
      return;
    }
    const habits = await habitsResponse.json();

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

    const habitsCount = habits.length;
    const totalCompletions = habits.reduce(
      (sum, habit) => sum + (habit.streak || 0),
      0,
    );
    const bestStreak = habits.reduce(
      (max, habit) => Math.max(max, habit.streak || 0),
      0,
    );

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
    const userResponse = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    const userData = await userResponse.json();
    console.log("Пользователь создан/получен:", userData);

    await loadHabits();

    const habits = await fetch(`${API_BASE}/api/habits/${telegramId}`).then(
      (r) => r.json(),
    );
    updateHabitsCounter(habits.length);

    document.getElementById("points").textContent = userData.points;

    await loadStatistics();
    await updateTodayProgress();
  } catch (error) {
    console.error("Ошибка при инициализации:", error);
    showError("Ошибка при подключении к серверу");
  }
}

// Логика для раскрывающегося блока статистики
function initStatsToggle() {
  const statsHeader = document.getElementById("statsToggle");
  const statsContent = document.getElementById("statsContent");
  const statsArrow = document.getElementById("statsArrow");

  if (!statsHeader || !statsContent || !statsArrow) return;

  const isStatsOpen = localStorage.getItem("statsOpen") === "true";

  if (isStatsOpen) {
    statsContent.classList.add("open");
    statsArrow.classList.add("rotated");
  }

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

// Логика для раскрывающегося блока привычек
function initHabitsToggle() {
  const habitsHeader = document.getElementById("habitsToggle");
  const habitsContent = document.getElementById("habitsContent");
  const habitsArrow = document.getElementById("habitsArrow");

  if (!habitsHeader || !habitsContent || !habitsArrow) return;

  const isHabitsOpen = localStorage.getItem("habitsOpen") !== "false";

  if (isHabitsOpen) {
    habitsContent.classList.add("open");
    habitsArrow.classList.add("rotated");
  }

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

  initApp();
  initStatsToggle();
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

        await loadHabits();
        await loadStatistics();
        await updateTodayProgress();
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
