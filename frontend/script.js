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

// Список популярных эмодзи для выбора
const POPULAR_EMOJIS = [
  "🏃", // бег
  "📚", // чтение
  "💧", // вода
  "💻", // программирование
  "💪", // спорт
  "🧠", // ум
  "🛌", // сон
  "🍎", // здоровое питание
  "🧘", // медитация
  "🚶", // прогулка
  "⭐", // общее
  "🔥", // мотивация
  "🎯", // цель
  "📝", // заметки
  "🎨", // творчество
  "🎵", // музыка
  "📖", // учеба
  "🧹", // уборка
  "💰", // финансы
  "🌱", // развитие
];

// Константы для эмодзи
const DEFAULT_EMOJI = "😀";
let selectedEmoji = DEFAULT_EMOJI;

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

// Функция для получения эмодзи по названию привычки (только как запасной вариант)
function getFallbackEmoji(name) {
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

// Обновление счетчика привычек
function updateHabitsCounter(count) {
  const counter = document.getElementById("habitsCounter");
  if (counter) {
    const word = getHabitWord(count);
    counter.textContent = `${count} ${word}`;
  }
}

// Получение правильного склонения слова "привычка"
function getHabitWord(count) {
  if (count === 1) return "привычка";
  if (count >= 2 && count <= 4) return "привычки";
  return "привычек";
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ЭМОДЗИ =====

// Открытие модального окна выбора эмодзи
function openEmojiPicker() {
  const modal = document.getElementById("emojiPickerModal");
  if (modal) {
    modal.classList.add("show");
    highlightSelectedEmoji();
  }
}

// Закрытие модального окна выбора эмодзи
function closeEmojiPicker() {
  const modal = document.getElementById("emojiPickerModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

// Подсветка выбранного эмодзи в сетке
function highlightSelectedEmoji() {
  const emojiItems = document.querySelectorAll(".emoji-item");
  emojiItems.forEach((item) => {
    if (item.textContent === selectedEmoji) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}

// Создание сетки эмодзи
function createEmojiGrid() {
  const grid = document.getElementById("emojiGrid");
  if (!grid) return;

  grid.innerHTML = "";
  POPULAR_EMOJIS.forEach((emoji) => {
    const emojiItem = document.createElement("div");
    emojiItem.className = "emoji-item";
    if (emoji === selectedEmoji) {
      emojiItem.classList.add("selected");
    }
    emojiItem.textContent = emoji;
    emojiItem.addEventListener("click", () => {
      selectEmoji(emoji);
    });
    grid.appendChild(emojiItem);
  });
}

// Выбор эмодзи
function selectEmoji(emoji) {
  selectedEmoji = emoji;
  const emojiBtn = document.getElementById("emojiSelectorBtn");
  if (emojiBtn) {
    emojiBtn.textContent = emoji;
    if (emoji !== DEFAULT_EMOJI) {
      emojiBtn.classList.add("selected");
    } else {
      emojiBtn.classList.remove("selected");
    }
  }
  closeEmojiPicker();
}

// Сброс эмодзи на дефолтный
function resetEmojiToDefault() {
  selectedEmoji = DEFAULT_EMOJI;
  const emojiBtn = document.getElementById("emojiSelectorBtn");
  if (emojiBtn) {
    emojiBtn.textContent = DEFAULT_EMOJI;
    emojiBtn.classList.remove("selected");
  }
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

// ===== СОЗДАНИЕ КАРТОЧКИ ПРИВЫЧКИ =====
function createHabitCard(habit) {
  const card = document.createElement("div");
  card.className = "habit-card";
  card.dataset.habitId = habit.id;

  // ВАЖНО: Подробное логирование для отладки
  console.log(
    `Создание карточки для привычки ID: ${habit.id}, Name: ${habit.name}`,
  );
  console.log(
    `Данные с сервера - emoji: "${habit.emoji}", тип: ${typeof habit.emoji}`,
  );

  // Определяем эмодзи для отображения
  let emojiToShow = "⭐"; // Запасной вариант по умолчанию

  // Проверяем наличие эмодзи в ответе сервера
  if (
    habit.emoji &&
    habit.emoji !== "null" &&
    habit.emoji !== "undefined" &&
    habit.emoji !== ""
  ) {
    emojiToShow = habit.emoji;
    console.log(`✅ Используем эмодзи из ответа сервера: ${emojiToShow}`);
  } else {
    // Если сервер не вернул эмодзи, используем запасной вариант
    emojiToShow = getFallbackEmoji(habit.name);
    console.log(
      `⚠️ Эмодзи не найдено в ответе, используем запасной: ${emojiToShow}`,
    );
  }

  const isCompleted = habit.completed_today || false;

  card.innerHTML = `
    <div class="habit-emoji ${isCompleted ? "completed" : ""}" id="habitEmoji-${habit.id}">
        ${isCompleted ? "✅" : emojiToShow}
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

  // Сохраняем эмодзи в data-атрибут карточки для использования в обработчиках
  card.dataset.habitEmoji = emojiToShow;

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
        emojiDiv.textContent = emojiToShow;
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

// ===== ЗАГРУЗКА ПРИВЫЧЕК =====
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

    // ПОДРОБНОЕ ЛОГИРОВАНИЕ: выводим все поля каждой привычки
    habits.forEach((habit, index) => {
      console.log(`=== Привычка ${index + 1} ===`);
      console.log(`ID: ${habit.id}`);
      console.log(`Name: "${habit.name}"`);
      console.log(`Emoji: "${habit.emoji || "НЕ УКАЗАН"}"`);
      console.log(`Streak: ${habit.streak}`);
      console.log(`Completed today: ${habit.completed_today}`);
      console.log(`Все поля:`, habit);
    });

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

// ===== ЗАГРУЗКА ОЧКОВ ПОЛЬЗОВАТЕЛЯ =====
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

// ===== ЗАГРУЗКА СТАТИСТИКИ =====
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

// ===== ЗАГРУЗКА РЕЙТИНГА =====
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

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
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

    // Устанавливаем дефолтный эмодзи при загрузке
    resetEmojiToDefault();
  } catch (error) {
    console.error("Ошибка при инициализации:", error);
    showError("Ошибка при подключении к серверу");
  }
}

// ===== ЛОГИКА РАСКРЫВАЮЩИХСЯ БЛОКОВ =====

// Статистика
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

// Привычки
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

// ===== ГЛАВНЫЙ ОБРАБОТЧИК СОБЫТИЙ =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM загружен, инициализация приложения...");

  initApp();
  initStatsToggle();
  initHabitsToggle();

  // Создаем сетку эмодзи
  createEmojiGrid();

  // Обработчик для кнопки выбора эмодзи
  const emojiSelectorBtn = document.getElementById("emojiSelectorBtn");
  if (emojiSelectorBtn) {
    emojiSelectorBtn.addEventListener("click", openEmojiPicker);
  }

  // Обработчик для закрытия выбора эмодзи
  const closeEmojiPickerBtn = document.getElementById("closeEmojiPickerBtn");
  if (closeEmojiPickerBtn) {
    closeEmojiPickerBtn.addEventListener("click", closeEmojiPicker);
  }

  // Закрытие модального окна эмодзи по клику вне его
  const emojiModal = document.getElementById("emojiPickerModal");
  if (emojiModal) {
    emojiModal.addEventListener("click", (e) => {
      if (e.target === emojiModal) {
        closeEmojiPicker();
      }
    });
  }

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

      console.log("Добавление привычки:");
      console.log("- telegram_id:", telegramId);
      console.log("- name:", name);
      console.log("- emoji:", selectedEmoji);

      try {
        const response = await fetch(`${API_BASE}/api/add-habit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            telegram_id: telegramId,
            name: name,
            emoji: selectedEmoji,
          }),
        });

        const data = await response.json();
        console.log("Ответ сервера после добавления:", data);

        if (!response.ok) {
          if (data.detail === "Maximum habits limit (10) reached") {
            showError("Максимум 10 привычек");
          } else {
            showError(`Ошибка: ${data.detail || "Неизвестная ошибка"}`);
          }
          return;
        }

        console.log("✅ Привычка успешно добавлена:", data);
        input.value = "";

        // ВАЖНО: Если сервер вернул emoji, используем его
        if (data.emoji) {
          console.log(`Сервер сохранил эмодзи: ${data.emoji}`);
        }

        // Сбрасываем эмодзи на дефолтный после добавления
        resetEmojiToDefault();

        // Перезагружаем привычки с сервера
        await loadHabits();
        await loadStatistics();
        await updateTodayProgress();
      } catch (error) {
        console.error("❌ Ошибка при добавлении привычки:", error);
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

  // Закрытие модального окна рейтинга
  const closeBtn = document.getElementById("closeModalBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      document.getElementById("leaderboardModal").classList.remove("show");
    });
  }

  // Закрытие модального окна рейтинга по клику вне его
  const leaderboardModal = document.getElementById("leaderboardModal");
  if (leaderboardModal) {
    leaderboardModal.addEventListener("click", (e) => {
      if (e.target === leaderboardModal) {
        leaderboardModal.classList.remove("show");
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
