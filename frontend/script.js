// Получаем ID пользователя из Telegram
let telegramId = null;
let tg = null;

try {
  tg = window.Telegram.WebApp;
  tg.expand();

  if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    telegramId = tg.initDataUnsafe.user.id;
    console.log("Telegram user ID:", telegramId);
  } else {
    console.log("Не в Telegram, используем тестовый ID");
    telegramId = 123456789;
  }
} catch (e) {
  console.log("Ошибка инициализации Telegram WebApp:", e);
  telegramId = 123456789;
}

if (!telegramId) {
  console.error("Не удалось получить ID пользователя");
  telegramId = 123456789;
}

const API_BASE = "";

const POPULAR_EMOJIS = [
  "🏃",
  "📚",
  "💧",
  "💻",
  "💪",
  "🧠",
  "🛌",
  "🍎",
  "🧘",
  "🚶",
  "⭐",
  "🔥",
  "🎯",
  "📝",
  "🎨",
  "🎵",
  "📖",
  "🧹",
  "💰",
  "🌱",
  "😀",
  "😎",
  "🥳",
  "🤔",
  "👨‍💻",
  "👩‍💻",
  "🐧",
  "🦉",
  "🐺",
  "🦊",
];

const DEFAULT_EMOJI = "😀";
let selectedEmoji = DEFAULT_EMOJI;
let currentTab = "home";
let currentScreen = "main";
let profileEmoji = "😀";
let profileName = "";
let isNameChecking = false;
let isNameAvailable = false;
let nameCheckTimeout = null;

// Для оптимизации обновления статистики
let lastStatsUpdate = 0;
const STATS_UPDATE_INTERVAL = 60000; // 1 минута

window.telegramId = telegramId;
window.API_BASE = API_BASE;
window.selectedEmoji = selectedEmoji;
window.currentScreen = currentScreen;
window.currentTab = currentTab;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function showError(message) {
  // Если пришел объект, преобразуем в строку
  if (typeof message === "object") {
    message = JSON.stringify(message);
  }

  const existingErrors = document.querySelectorAll(".error-message");
  existingErrors.forEach((error) => error.remove());

  const errorDiv = document.createElement("div");
  errorDiv.className = "error-message";
  errorDiv.textContent = message;

  const screenContainer = document.getElementById("screenContainer");
  screenContainer.insertBefore(errorDiv, screenContainer.firstChild);

  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 3000);
}

window.showError = showError;

function showSuccess(message) {
  const successDiv = document.createElement("div");
  successDiv.className = "error-message";
  successDiv.style.backgroundColor = "var(--accent-green)";
  successDiv.textContent = message;

  const screenContainer = document.getElementById("screenContainer");
  screenContainer.insertBefore(successDiv, screenContainer.firstChild);

  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.remove();
    }
  }, 3000);
}

window.showSuccess = showSuccess;

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

function getHabitWord(count) {
  if (count === 1) return "привычка";
  if (count >= 2 && count <= 4) return "привычки";
  return "привычек";
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ЭМОДЗИ =====

function openEmojiPicker(source) {
  window.emojiPickerSource = source;
  const modal = document.getElementById("emojiPickerModal");
  if (modal) {
    modal.classList.add("show");
    highlightSelectedEmoji();
  }
}

window.openEmojiPicker = openEmojiPicker;

function closeEmojiPicker() {
  const modal = document.getElementById("emojiPickerModal");
  if (modal) {
    modal.classList.remove("show");
  }
  window.emojiPickerSource = null;
}

window.closeEmojiPicker = closeEmojiPicker;

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

function selectEmoji(emoji) {
  selectedEmoji = emoji;
  window.selectedEmoji = selectedEmoji;

  if (window.emojiPickerSource === "profile") {
    profileEmoji = emoji;
    const profileAvatar = document.getElementById("profileAvatar");
    if (profileAvatar) {
      profileAvatar.textContent = emoji;
    }
    if (typeof window.checkForChanges === "function") {
      window.checkForChanges();
    }
  } else {
    const emojiSelector = document.getElementById("createEmojiSelector");
    if (emojiSelector) {
      emojiSelector.textContent = emoji;
    }
  }

  closeEmojiPicker();
}

window.selectEmoji = selectEmoji;

function resetEmojiToDefault() {
  selectedEmoji = DEFAULT_EMOJI;
  window.selectedEmoji = selectedEmoji;
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ПРОФИЛЕМ =====

async function checkNameAvailability(name) {
  if (!name || name.length < 3) {
    return { available: false, reason: "too_short" };
  }

  try {
    const response = await fetch(`${API_BASE}/api/check-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: telegramId,
        username: name,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Ошибка при проверке имени:", error);
    return { available: false, error: true };
  }
}

async function loadUserProfile() {
  try {
    const response = await fetch(`${API_BASE}/api/user-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    if (response.ok) {
      const data = await response.json();
      profileName = data.username || "";
      profileEmoji = data.emoji || DEFAULT_EMOJI;
      console.log("Профиль загружен:", profileName, profileEmoji);
      return data;
    }
  } catch (error) {
    console.error("Ошибка загрузки профиля:", error);
  }
  return null;
}

async function saveUserProfile(username, emoji) {
  try {
    const response = await fetch(`${API_BASE}/api/update-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: telegramId,
        username: username,
        emoji: emoji,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      profileName = username;
      profileEmoji = emoji;
      showSuccess("Профиль успешно сохранен!");
      return true;
    } else {
      if (data.detail === "username_taken") {
        showError("Это имя уже занято");
      } else {
        showError(data.detail || "Ошибка при сохранении");
      }
      return false;
    }
  } catch (error) {
    console.error("Ошибка при сохранении профиля:", error);
    showError("Ошибка при сохранении профиля");
    return false;
  }
}

// ===== ФУНКЦИЯ ОТРИСОВКИ ПРОФИЛЯ (ИСПРАВЛЕННАЯ) =====

function renderProfileScreen(container) {
  const displayName =
    profileName && profileName.trim() !== "" ? profileName : "Не указано";
  const displayId = telegramId;
  const displayEmoji = profileEmoji || "😀";

  console.log(
    "Рендерим профиль с именем:",
    displayName,
    "эмодзи:",
    displayEmoji,
  );

  const html = `
    <div class="screen">
      <div class="profile-screen">
        <div class="profile-avatar-large" id="profileAvatar" onclick="window.openEmojiPicker('profile')">
          ${displayEmoji}
        </div>
        <div class="profile-avatar-hint">Нажмите, чтобы изменить эмодзи</div>
        
        <div class="profile-info-block">
          <div class="profile-name-display" id="profileDisplayName">${displayName}</div>
          <div class="profile-id-display" id="profileTelegramId">ID: ${displayId}</div>
        </div>
        
        <div class="profile-form">
          <div class="profile-form-group">
            <label class="profile-form-label">Изменить имя</label>
            <div class="profile-input-wrapper">
              <span class="profile-input-icon">👤</span>
              <input 
                type="text" 
                id="profileNameInput" 
                placeholder="От 3 до 20 символов" 
                maxlength="20"
                value="${profileName || ""}"
              >
            </div>
            <div class="profile-name-status" id="profileNameStatus"></div>
          </div>
          
          <button class="profile-save-btn" id="saveProfileBtn">Сохранить изменения</button>
          
          <div class="profile-unique-info">
            <span class="profile-unique-info-icon">ℹ️</span>
            <span>Имя должно быть уникальным. Можно использовать буквы, цифры и _</span>
          </div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const nameInput = document.getElementById("profileNameInput");
  const saveBtn = document.getElementById("saveProfileBtn");
  const statusDiv = document.getElementById("profileNameStatus");
  const profileDisplayName = document.getElementById("profileDisplayName");

  let currentName = profileName;
  let currentEmoji = profileEmoji;

  async function validateName(name) {
    if (name === currentName) {
      statusDiv.textContent = "";
      statusDiv.className = "";
      saveBtn.disabled = false;
      return { valid: true, changed: false };
    }

    if (!name || name.length < 3) {
      statusDiv.textContent = "Минимум 3 символа";
      statusDiv.className = "profile-name-status taken";
      saveBtn.disabled = true;
      return { valid: false, changed: true };
    }

    if (name.length > 20) {
      statusDiv.textContent = "Максимум 20 символов";
      statusDiv.className = "profile-name-status taken";
      saveBtn.disabled = true;
      return { valid: false, changed: true };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      statusDiv.textContent = "Только буквы, цифры и _";
      statusDiv.className = "profile-name-status taken";
      saveBtn.disabled = true;
      return { valid: false, changed: true };
    }

    statusDiv.textContent = "Проверка...";
    statusDiv.className = "profile-name-status checking";
    saveBtn.disabled = true;

    const result = await checkNameAvailability(name);

    if (result.available) {
      statusDiv.textContent = "✓ Имя доступно";
      statusDiv.className = "profile-name-status available";
      saveBtn.disabled = false;
      return { valid: true, changed: true };
    } else {
      if (result.reason === "too_short") {
        statusDiv.textContent = "Минимум 3 символа";
      } else if (result.reason === "too_long") {
        statusDiv.textContent = "Максимум 20 символов";
      } else if (result.reason === "invalid_chars") {
        statusDiv.textContent = "Только буквы, цифры и _";
      } else {
        statusDiv.textContent = "✗ Имя уже занято";
      }
      statusDiv.className = "profile-name-status taken";
      saveBtn.disabled = true;
      return { valid: false, changed: true };
    }
  }

  function checkForChanges() {
    const newName = nameInput.value.trim();
    const nameChanged = newName !== currentName;
    const emojiChanged = profileEmoji !== currentEmoji;

    if (!nameChanged && !emojiChanged) {
      saveBtn.disabled = true;
      statusDiv.textContent = "";
      statusDiv.className = "";
    } else if (emojiChanged && !nameChanged) {
      saveBtn.disabled = false;
      statusDiv.textContent = "✓ Эмодзи изменено";
      statusDiv.className = "profile-name-status available";
    }
  }

  window.checkForChanges = checkForChanges;

  let nameCheckTimeout;
  nameInput.addEventListener("input", (e) => {
    const name = e.target.value.trim();

    if (nameCheckTimeout) {
      clearTimeout(nameCheckTimeout);
    }

    nameCheckTimeout = setTimeout(() => {
      validateName(name);
    }, 500);
  });

  saveBtn.addEventListener("click", async () => {
    const newName = nameInput.value.trim();
    const validation = await validateName(newName);

    if (
      validation.valid ||
      (profileEmoji !== currentEmoji && newName === currentName)
    ) {
      const nameToSave = newName || currentName;
      const success = await saveUserProfile(nameToSave, profileEmoji);

      if (success) {
        currentName = nameToSave;
        currentEmoji = profileEmoji;

        if (profileDisplayName) {
          profileDisplayName.textContent = nameToSave || "Не указано";
        }

        saveBtn.disabled = true;
        statusDiv.textContent = "✓ Профиль сохранен";
        statusDiv.className = "profile-name-status available";
      }
    }
  });

  checkForChanges();
}

// ===== ФУНКЦИИ ДЛЯ БЫСТРОЙ СТАТИСТИКИ =====

function showQuickStatsSkeleton() {
  const statsGrid = document.getElementById("quickStatsGrid");
  if (!statsGrid) return;

  statsGrid.innerHTML = `
    <div class="quick-stat-card skeleton">
      <div class="quick-stat-icon"></div>
      <div class="quick-stat-label"></div>
      <div class="quick-stat-value"></div>
    </div>
    <div class="quick-stat-card skeleton">
      <div class="quick-stat-icon"></div>
      <div class="quick-stat-label"></div>
      <div class="quick-stat-value"></div>
    </div>
    <div class="quick-stat-card skeleton">
      <div class="quick-stat-icon"></div>
      <div class="quick-stat-label"></div>
      <div class="quick-stat-value"></div>
    </div>
  `;
}

window.showQuickStatsSkeleton = showQuickStatsSkeleton;

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

window.formatNumber = formatNumber;

async function updateQuickStats(force = false) {
  if (!telegramId) return;

  const now = Date.now();
  if (!force && now - lastStatsUpdate < STATS_UPDATE_INTERVAL) {
    return;
  }

  try {
    showQuickStatsSkeleton();

    const [userResponse, habitsResponse] = await Promise.all([
      fetch(`${API_BASE}/api/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_id: telegramId }),
      }),
      fetch(`${API_BASE}/api/habits/${telegramId}`),
    ]);

    if (!userResponse.ok || !habitsResponse.ok) {
      throw new Error("Ошибка загрузки данных");
    }

    const userData = await userResponse.json();
    const habits = await habitsResponse.json();

    const points = userData.points || 0;
    const totalCompletions = habits.reduce((sum, habit) => {
      return sum + (habit.streak || 0);
    }, 0);
    const maxStreak = habits.reduce((max, habit) => {
      return Math.max(max, habit.streak || 0);
    }, 0);

    renderQuickStats(points, totalCompletions, maxStreak);

    lastStatsUpdate = now;
  } catch (error) {
    console.error("Ошибка при обновлении быстрой статистики:", error);
    renderQuickStats(0, 0, 0);
  }
}

window.updateQuickStats = updateQuickStats;

function renderQuickStats(points, totalCompletions, maxStreak) {
  const statsGrid = document.getElementById("quickStatsGrid");
  if (!statsGrid) return;

  statsGrid.innerHTML = `
    <div class="quick-stat-card" data-stat="points">
      <div class="quick-stat-icon">⭐</div>
      <div class="quick-stat-label">Очки</div>
      <div class="quick-stat-value">${formatNumber(points)}</div>
    </div>
    
    <div class="quick-stat-card" data-stat="completions">
      <div class="quick-stat-icon">📅</div>
      <div class="quick-stat-label">Выполнено</div>
      <div class="quick-stat-value">${formatNumber(totalCompletions)}</div>
    </div>
    
    <div class="quick-stat-card" data-stat="streak">
      <div class="quick-stat-icon">🔥</div>
      <div class="quick-stat-label">Макс. серия</div>
      <div class="quick-stat-value">
        ${maxStreak}
        <span class="quick-stat-unit">дн</span>
      </div>
    </div>
  `;
}

window.renderQuickStats = renderQuickStats;

// ===== ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ ПРОГРЕССА =====

async function updateTodayProgress() {
  if (!telegramId) return;

  try {
    const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    if (!response.ok) {
      console.error("Ошибка загрузки привычек для прогресса");
      return;
    }

    const habits = await response.json();

    const totalHabits = habits.length;
    const completedToday = habits.filter(
      (habit) => habit.completed_today,
    ).length;
    const incompleteCount = totalHabits - completedToday;

    const badge = document.querySelector(".menu-card-badge.red");
    if (badge) {
      if (incompleteCount > 0) {
        badge.textContent = incompleteCount;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }
    }

    const percentEl = document.getElementById("progressPercent");
    const textEl = document.getElementById("progressText");
    const barFillEl = document.getElementById("progressBarFill");
    const messageEl = document.getElementById("progressMessage");

    if (!percentEl || !textEl || !barFillEl || !messageEl) return;

    if (totalHabits === 0) {
      percentEl.textContent = "0%";
      textEl.textContent = "Нет привычек";
      barFillEl.style.width = "0%";
      messageEl.textContent = "👋 Добавьте привычки для начала";
      return;
    }

    const percent = Math.round((completedToday / totalHabits) * 100);

    percentEl.textContent = `${percent}%`;
    textEl.textContent = `${completedToday} из ${totalHabits} ${getHabitWord(totalHabits)} выполнено`;
    barFillEl.style.width = `${percent}%`;

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

window.updateTodayProgress = updateTodayProgress;

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ПРИВЫЧКАМИ =====

async function toggleHabitCompletion(habitId) {
  const emojiDiv = document.getElementById(`habitEmoji-${habitId}`);
  const habitCard = document.querySelector(
    `.habit-card[data-habit-id="${habitId}"]`,
  );
  const habitName = habitCard?.querySelector(".habit-name");
  const emojiToShow = habitCard?.dataset.habitEmoji || "⭐";

  const isCurrentlyCompleted = emojiDiv.classList.contains("completed");

  try {
    let response;
    if (isCurrentlyCompleted) {
      response = await fetch(`${API_BASE}/api/undo-habit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habitId, telegram_id: telegramId }),
      });
    } else {
      response = await fetch(`${API_BASE}/api/complete-habit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habitId, telegram_id: telegramId }),
      });
    }

    if (!response.ok) {
      const error = await response.json();
      if (error.detail === "already_done") showError("Уже выполнено сегодня");
      else if (error.detail === "not_done_today")
        showError("Нельзя отменить - сегодня не выполняли");
      return;
    }

    const data = await response.json();

    emojiDiv.classList.toggle("completed");
    emojiDiv.textContent = isCurrentlyCompleted ? emojiToShow : "✅";
    if (habitName) habitName.classList.toggle("completed-text");

    const streakSpan = document.getElementById(`streak-${habitId}`);
    if (streakSpan) streakSpan.textContent = `${data.streak} дней`;

    await updateTodayProgress();
    await updateQuickStats(true);
  } catch (error) {
    console.error("Ошибка:", error);
    showError("Не удалось обновить привычку");
  }
}

window.toggleHabitCompletion = toggleHabitCompletion;

// ИСПРАВЛЕННАЯ ФУНКЦИЯ УДАЛЕНИЯ С ДИАГНОСТИКОЙ
async function deleteHabit(habitId) {
  if (!confirm("Удалить привычку?")) return;

  try {
    console.log("Удаляем привычку с ID:", habitId);
    console.log("Telegram ID пользователя:", telegramId);

    // Отправляем оба параметра, которые могут понадобиться серверу
    const requestBody = {
      habit_id: habitId,
      telegram_id: telegramId,
    };

    console.log("Отправляем запрос с телом:", JSON.stringify(requestBody));

    const response = await fetch(`${API_BASE}/api/delete-habit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    console.log("Статус ответа:", response.status);
    console.log("Заголовки ответа:", [...response.headers.entries()]);

    // Пробуем получить ответ как текст
    const responseText = await response.text();
    console.log("Текст ответа:", responseText);

    // Пробуем распарсить как JSON, если получится
    try {
      const data = JSON.parse(responseText);
      console.log("Распарсенные данные:", data);

      if (response.ok) {
        showSuccess("Привычка удалена");

        if (currentScreen === "habits") {
          await renderHabitsScreen(document.getElementById("screenContainer"));
        } else {
          await updateTodayProgress();
          await updateQuickStats(true);
        }
      } else {
        // Показываем детальную ошибку
        const errorMessage =
          data.detail || data.message || JSON.stringify(data);
        showError(`Ошибка: ${errorMessage}`);
      }
    } catch (e) {
      // Если не JSON, показываем как текст
      if (response.ok) {
        showSuccess("Привычка удалена");

        if (currentScreen === "habits") {
          await renderHabitsScreen(document.getElementById("screenContainer"));
        } else {
          await updateTodayProgress();
          await updateQuickStats(true);
        }
      } else {
        showError(`Ошибка сервера (${response.status}): ${responseText}`);
      }
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    showError("Не удалось удалить привычку: " + error.message);
  }
}
window.deleteHabit = deleteHabit;

async function createHabit() {
  const input = document.getElementById("createHabitName");
  const name = input.value.trim();

  if (!name) {
    showError("Введите название привычки");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/add-habit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: telegramId,
        name: name,
        emoji: selectedEmoji,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.detail === "Maximum habits limit (10) reached") {
        showError("Максимум 10 привычек");
      } else {
        showError(`Ошибка: ${data.detail || "Неизвестная ошибка"}`);
      }
      return;
    }

    selectedEmoji = DEFAULT_EMOJI;
    window.selectedEmoji = selectedEmoji;

    await updateTodayProgress();
    await updateQuickStats(true);
    showScreen("habits");
  } catch (error) {
    console.error("Ошибка при добавлении привычки:", error);
    showError("Ошибка при добавлении привычки");
  }
}

window.createHabit = createHabit;

// ===== ГЛАВНЫЙ ЭКРАН =====

function renderMainScreen(container) {
  fetch(`${API_BASE}/api/habits/${telegramId}`)
    .then((response) => response.json())
    .then((habits) => {
      const totalHabits = habits.length;
      const completedToday = habits.filter((h) => h.completed_today).length;
      const incompleteCount = totalHabits - completedToday;

      const menuItems = [
        {
          id: "habits",
          icon: "📋",
          title: "Мои привычки",
          desc: "Управление привычками",
          badge: incompleteCount > 0 ? incompleteCount : null,
          badgeColor: "red",
        },
        {
          id: "create",
          icon: "✨",
          title: "Создать привычку",
          desc: "Добавить новую",
          badge: null,
        },
        {
          id: "stats",
          icon: "📊",
          title: "Статистика",
          desc: "Прогресс и достижения",
          badge: null,
        },
        {
          id: "leaderboard",
          icon: "🏆",
          title: "Рейтинг",
          desc: "Топ пользователей",
          badge: null,
        },
      ];

      let html = `
        <div class="screen">
          <div class="menu-grid">
      `;

      menuItems.forEach((item) => {
        html += `
          <div class="menu-card" onclick="window.showScreen('${item.id}')">
            <div class="menu-card-title">
              <span class="menu-card-icon">${item.icon}</span>
              <span>${item.title}</span>
            </div>
            <div class="menu-card-desc">${item.desc}</div>
            ${item.badge ? `<div class="menu-card-badge ${item.badgeColor}">${item.badge}</div>` : ""}
          </div>
        `;
      });

      html += `
          </div>
          
          <div class="quick-stats-wrapper">
            <div class="quick-stats-grid" id="quickStatsGrid"></div>
          </div>
        </div>
      `;

      container.innerHTML = html;
      updateQuickStats(true);
    })
    .catch((error) => {
      console.error("Ошибка загрузки привычек:", error);

      const fallbackItems = [
        {
          id: "habits",
          icon: "📋",
          title: "Мои привычки",
          desc: "Управление привычками",
          badge: null,
        },
        {
          id: "create",
          icon: "✨",
          title: "Создать привычку",
          desc: "Добавить новую",
          badge: null,
        },
        {
          id: "stats",
          icon: "📊",
          title: "Статистика",
          desc: "Прогресс и достижения",
          badge: null,
        },
        {
          id: "leaderboard",
          icon: "🏆",
          title: "Рейтинг",
          desc: "Топ пользователей",
          badge: null,
        },
      ];

      let html = `
        <div class="screen">
          <div class="menu-grid">
      `;

      fallbackItems.forEach((item) => {
        html += `
          <div class="menu-card" onclick="window.showScreen('${item.id}')">
            <div class="menu-card-title">
              <span class="menu-card-icon">${item.icon}</span>
              <span>${item.title}</span>
            </div>
            <div class="menu-card-desc">${item.desc}</div>
          </div>
        `;
      });

      html += `
          </div>
          
          <div class="quick-stats-wrapper">
            <div class="quick-stats-grid" id="quickStatsGrid"></div>
          </div>
        </div>
      `;

      container.innerHTML = html;
      updateQuickStats(true);
    });
}

async function renderStatsScreen(container) {
  try {
    const habitsResponse = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    const habits = await habitsResponse.json();

    const pointsResponse = await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });
    const userData = await pointsResponse.json();

    const habitsCount = habits.length;
    const completedToday = habits.filter(
      (habit) => habit.completed_today,
    ).length;

    let totalCompletions = 0;
    let maxStreak = 0;
    let currentStreak = 0;

    habits.forEach((habit) => {
      totalCompletions += habit.streak || 0;
      if (habit.streak > maxStreak) maxStreak = habit.streak;
      if (habit.completed_today && habit.streak > currentStreak) {
        currentStreak = habit.streak;
      }
    });

    let activityData = [];
    try {
      const activityResponse = await fetch(`${API_BASE}/api/habit-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: telegramId,
          days: 30,
        }),
      });
      if (activityResponse.ok) {
        const data = await activityResponse.json();
        activityData = data.activity || [];
      }
    } catch (error) {
      console.error("Ошибка загрузки активности:", error);
    }

    const totalHabitCompletions = habits
      .map((habit) => {
        const habitCompletions = habit.streak || 0;
        const percentage =
          totalCompletions > 0
            ? Math.round((habitCompletions / totalCompletions) * 100)
            : 0;
        return {
          ...habit,
          completions: habitCompletions,
          percentage: percentage,
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    function generateActivityBars(data) {
      if (!data || data.length === 0) {
        let bars = "";
        for (let i = 0; i < 30; i++) {
          bars += `<div class="activity-bar" style="height: 8px; background-color: var(--accent-gray);"></div>`;
        }
        return bars;
      }

      const max = Math.max(...data, 1);
      return data
        .map((value) => {
          const height = Math.max(
            4,
            Math.min(24, Math.round((value / max) * 24)),
          );
          return `<div class="activity-bar" style="height: ${height}px;" title="Выполнено: ${value}"></div>`;
        })
        .join("");
    }

    const html = `
      <div class="screen stats-screen">
        <h2 class="stats-main-title">Статистика</h2>

        <div class="stats-mini-cards">
          <div class="stats-mini-card">
            <div class="stats-mini-value">${userData.points || 0}</div>
            <div class="stats-mini-label">Всего очков</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-value">${currentStreak} дн.</div>
            <div class="stats-mini-label">Текущая серия</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-value">${maxStreak} дн.</div>
            <div class="stats-mini-label">Макс. серия</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-value">${totalCompletions}</div>
            <div class="stats-mini-label">Всего выполнений</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-value">${habitsCount}</div>
            <div class="stats-mini-label">Привычек</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-value">${completedToday}/${habitsCount}</div>
            <div class="stats-mini-label">Сегодня</div>
          </div>
        </div>

        <div class="activity-bars-section">
          <div class="activity-bars-header">
            <h3>АКТИВНОСТЬ ЗА 30 ДНЕЙ</h3>
          </div>
          
          <div class="activity-bars-container">
            <div class="activity-bars-labels">
              <span>30 дней назад</span>
              <span>Сегодня</span>
            </div>
            <div class="activity-bars-grid" id="statsActivityBars">
              ${generateActivityBars(activityData)}
            </div>
          </div>
        </div>

        <div class="habits-stats-section">
          <h3>ПО ПРИВЫЧКАМ</h3>
          
          <div class="habits-stats-list">
            ${totalHabitCompletions
              .map(
                (habit) => `
              <div class="habit-stat-item">
                <div class="habit-stat-header">
                  <span class="habit-stat-emoji">${habit.emoji || "📋"}</span>
                  <span class="habit-stat-name">${habit.name}</span>
                </div>
                <div class="habit-stat-progress">
                  <div class="habit-stat-progress-bar" style="width: ${habit.percentage}%;"></div>
                </div>
                <div class="habit-stat-details">
                  <span class="habit-stat-check">✅ ${habit.completions}</span>
                  <span class="habit-stat-percentage">${habit.percentage}%</span>
                </div>
                <div class="habit-stat-info">
                  <span>Выполнено: ${habit.completions}</span>
                  <span>Серия: ${habit.streak} дн.</span>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <div class="points-info-section">
          <h3>Как начисляются очки</h3>
          <ul class="points-info-list">
            <li><span class="points-check">✅</span> Каждое выполнение +10</li>
            <li><span class="points-bonus">🟢</span> Бонус за серию 3 дня +5</li>
            <li><span class="points-bonus">🔵</span> Бонус за серию 7 дней +25</li>
          </ul>
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    console.error("Ошибка загрузки статистики:", error);
    container.innerHTML =
      '<div class="screen"><div class="error-message">Не удалось загрузить статистику</div></div>';
  }
}

async function renderHabitsScreen(container) {
  try {
    const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);
    const habits = await response.json();

    let html = `
      <div class="screen">
        <div class="habits-header">
          <h2>Мои привычки</h2>
          <span class="habits-counter">${habits.length} ${getHabitWord(habits.length)}</span>
        </div>
        <div class="habits-container" id="habitsContainer">
    `;

    if (habits.length === 0) {
      html += '<div class="empty-state">✨ Добавьте свою первую привычку</div>';
    } else {
      habits.forEach((habit) => {
        const emojiToShow =
          habit.emoji &&
          habit.emoji !== "null" &&
          habit.emoji !== "undefined" &&
          habit.emoji !== ""
            ? habit.emoji
            : getFallbackEmoji(habit.name);

        const isCompleted = habit.completed_today || false;

        html += `
          <div class="habit-card" data-habit-id="${habit.id}" data-habit-emoji="${emojiToShow}">
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
              <button class="delete-btn" onclick="window.deleteHabit(${habit.id})">🗑</button>
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;

    if (habits.length > 0) {
      habits.forEach((habit) => {
        const emojiDiv = document.getElementById(`habitEmoji-${habit.id}`);
        if (emojiDiv) {
          emojiDiv.addEventListener("click", () =>
            toggleHabitCompletion(habit.id),
          );
        }
      });
    }
  } catch (error) {
    console.error("Ошибка загрузки привычек:", error);
    container.innerHTML =
      '<div class="screen"><div class="error-message">Не удалось загрузить привычки</div></div>';
  }
}

function renderCreateScreen(container) {
  const html = `
    <div class="screen">
      <div class="create-form">
        <div class="form-card">
          <div class="emoji-section">
            <div class="emoji-label">Выберите эмодзи</div>
            <div class="emoji-selector-large" id="createEmojiSelector" onclick="window.openEmojiPicker('create')">${selectedEmoji}</div>
            <div class="emoji-hint">Нажмите, чтобы выбрать эмодзи</div>
          </div>
          
          <div class="input-section">
            <div class="input-label">Название привычки</div>
            <input type="text" id="createHabitName" placeholder="Например: Утренняя пробежка" maxlength="50">
          </div>
          
          <button class="create-btn" id="createHabitBtn">Создать привычку</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  const createBtn = document.getElementById("createHabitBtn");
  const input = document.getElementById("createHabitName");

  createBtn.addEventListener("click", createHabit);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") createHabit();
  });
}

async function renderLeaderboardScreen(container) {
  try {
    const response = await fetch(`${API_BASE}/api/leaderboard`);
    const leaderboard = await response.json();

    const currentUserIndex = leaderboard.findIndex(
      (user) => user.telegram_id === telegramId,
    );
    const currentUserRank =
      currentUserIndex !== -1 ? currentUserIndex + 1 : null;
    const currentUser =
      currentUserIndex !== -1 ? leaderboard[currentUserIndex] : null;

    const topThree = leaderboard.slice(0, 3);
    const restUsers = leaderboard.slice(3, 20);

    const html = `
      <div class="screen leaderboard-screen">
        <h2 class="leaderboard-main-title">Рейтинг</h2>
        <p class="leaderboard-subtitle">Таблица лидеров</p>

        <div class="user-rank-card">
          <div class="user-rank-header">
            <span class="user-rank-label"> Ваше место</span>
            <span class="user-rank-number">#${currentUserRank || "—"}</span>
          </div>
          <div class="user-rank-stats">
            <div class="user-rank-points">
              <span class="points-value">${currentUser?.points || 0}</span>
              <span class="points-label">очков</span>
            </div>
            <div class="user-rank-streak">
              <span class="streak-value">${currentUser?.streak || 0}</span>
              <span class="streak-label">дней</span>
            </div>
          </div>
        </div>

        <div class="podium-section">
          <h3 class="podium-title">Топ участников</h3>
          <div class="podium">
            ${generatePodium(topThree)}
          </div>
        </div>

        <div class="leaderboard-list">
          <h3 class="leaderboard-list-title">Все участники</h3>
          ${
            restUsers.length > 0
              ? `
            ${restUsers
              .map(
                (user, index) => `
              <div class="leaderboard-list-item ${user.telegram_id === telegramId ? "current-user" : ""}">
                <div class="list-item-rank">#${index + 4}</div>
                <div class="list-item-avatar">
                  <span class="list-item-emoji">${user.emoji || "👤"}</span>
                </div>
                <div class="list-item-info">
                  <div class="list-item-name">${user.username || `Пользователь ${user.telegram_id}`}</div>
                  <div class="list-item-username">@${user.username || `user_${user.telegram_id}`}</div>
                </div>
                <div class="list-item-stats">
                  <div class="list-item-points">${user.points}</div>
                  <div class="list-item-streak">${user.streak || 0} дн.</div>
                </div>
              </div>
            `,
              )
              .join("")}
          `
              : `
            <div class="empty-state-spacer">
              <div class="empty-state-message">
                Пока нет других участников
              </div>
            </div>
          `
          }
        </div>
      </div>
    `;

    container.innerHTML = html;
  } catch (error) {
    console.error("Ошибка загрузки рейтинга:", error);
    container.innerHTML = `
      <div class="screen">
        <div class="error-message">
          Не удалось загрузить рейтинг
        </div>
      </div>
    `;
  }
}

function generatePodium(topThree) {
  if (topThree.length === 0)
    return '<div class="empty-podium">Пока нет участников</div>';

  const first = topThree[0] || null;
  const second = topThree[1] || null;
  const third = topThree[2] || null;

  return `
    <div class="podium-container">
      <div class="podium-item second">
        <div class="podium-avatar">
          <span class="podium-emoji">${second?.emoji || "👤"}</span>
        </div>
        <div class="podium-name">${second?.username || "—"}</div>
        <div class="podium-points">${second?.points || 0} pts</div>
        <div class="podium-rank">2</div>
        <div class="podium-stats">
          <span class="podium-streak">🔥 ${second?.streak || 0}</span>
        </div>
      </div>

      <div class="podium-item first">
        <div class="podium-crown">👑</div>
        <div class="podium-avatar">
          <span class="podium-emoji">${first?.emoji || "👤"}</span>
        </div>
        <div class="podium-name">${first?.username || "—"}</div>
        <div class="podium-points">${first?.points || 0} pts</div>
        <div class="podium-rank">1</div>
        <div class="podium-stats">
          <span class="podium-streak">🔥 ${first?.streak || 0}</span>
        </div>
      </div>

      <div class="podium-item third">
        <div class="podium-avatar">
          <span class="podium-emoji">${third?.emoji || "👤"}</span>
        </div>
        <div class="podium-name">${third?.username || "—"}</div>
        <div class="podium-points">${third?.points || 0} pts</div>
        <div class="podium-rank">3</div>
        <div class="podium-stats">
          <span class="podium-streak">🔥 ${third?.streak || 0}</span>
        </div>
      </div>
    </div>
  `;
}

// ===== НАВИГАЦИЯ =====

function showScreen(screenName) {
  if (currentScreen === screenName) return;

  currentScreen = screenName;
  window.currentScreen = currentScreen;

  const container = document.getElementById("screenContainer");
  const navBack = document.getElementById("navBackBtn");
  const navTitle = document.getElementById("navTitle");
  const progressBlock = document.getElementById("progressBlock");
  const navBar = document.getElementById("navBar");

  navBar.style.display = "flex";

  if (screenName === "main") {
    navBack.style.display = "none";
    navTitle.textContent = "Главное меню";
    progressBlock.style.display = "block";
  } else {
    if (screenName === "profile") {
      navBack.style.display = "none";
    } else {
      navBack.style.display = "block";
    }

    const titles = {
      habits: "Мои привычки",
      stats: "Статистика",
      create: "Создать привычку",
      leaderboard: "Рейтинг",
      profile: "", // Убираем заголовок для профиля
    };
    navTitle.textContent = titles[screenName] || "";
    progressBlock.style.display = "none";
  }

  container.innerHTML = `
    <div class="screen" style="text-align: center; padding: 50px;">
      <div class="loading-spinner"></div>
    </div>
  `;

  setTimeout(() => {
    switch (screenName) {
      case "main":
        renderMainScreen(container);
        updateTodayProgress();
        break;
      case "habits":
        renderHabitsScreen(container);
        break;
      case "stats":
        renderStatsScreen(container);
        break;
      case "create":
        renderCreateScreen(container);
        break;
      case "leaderboard":
        renderLeaderboardScreen(container);
        break;
      case "profile":
        renderProfileScreen(container);
        break;
    }
  }, 10);
}

window.showScreen = showScreen;

// ===== УПРАВЛЕНИЕ ВКЛАДКАМИ =====

function switchTab(tabName) {
  if (currentTab === tabName) return;

  currentTab = tabName;
  window.currentTab = currentTab;

  const progressBlock = document.getElementById("progressBlock");
  const navBar = document.getElementById("navBar");
  const navBack = document.getElementById("navBackBtn");
  const navTitle = document.getElementById("navTitle");
  const headerTitle = document.getElementById("mainHeaderTitle");
  const container = document.getElementById("screenContainer");
  const tabHome = document.getElementById("tabHome");
  const tabProfile = document.getElementById("tabProfile");

  // Обновляем активный таб
  if (tabHome && tabProfile) {
    if (tabName === "home") {
      tabHome.classList.add("active");
      tabProfile.classList.remove("active");
    } else {
      tabProfile.classList.add("active");
      tabHome.classList.remove("active");
    }
  }

  container.innerHTML = `
    <div class="screen" style="text-align: center; padding: 50px;">
      <div class="loading-spinner"></div>
    </div>
  `;

  setTimeout(() => {
    if (tabName === "home") {
      progressBlock.style.display = "block";
      navBar.style.display = "flex";
      navBack.style.display = "none";
      navTitle.textContent = "Главное меню";
      headerTitle.textContent = "";
      headerTitle.classList.remove("profile-header");

      renderMainScreen(container);
      updateQuickStats(true);
      updateTodayProgress();
    } else {
      progressBlock.style.display = "none";
      navBar.style.display = "flex";
      navBack.style.display = "none";
      navTitle.textContent = ""; // Убираем текст в навигации
      headerTitle.textContent = ""; // Убираем "Мой профиль" из верхнего заголовка
      headerTitle.classList.remove("profile-header");

      renderProfileScreen(container);
    }
  }, 10);
}

window.switchTab = switchTab;

// ===== ИНИЦИАЛИЗАЦИЯ =====

async function initApp() {
  if (!telegramId) {
    showError("Не удалось получить ID пользователя");
    return;
  }

  try {
    await fetch(`${API_BASE}/api/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_id: telegramId }),
    });

    createEmojiGrid();

    document.getElementById("tabHome").addEventListener("click", () => {
      switchTab("home");
    });

    document.getElementById("tabProfile").addEventListener("click", () => {
      switchTab("profile");
    });

    await loadUserProfile();

    renderMainScreen(document.getElementById("screenContainer"));

    const progressBlock = document.getElementById("progressBlock");
    const navBar = document.getElementById("navBar");
    const navBack = document.getElementById("navBackBtn");
    const headerTitle = document.getElementById("mainHeaderTitle");

    if (progressBlock) progressBlock.style.display = "block";
    if (navBar) navBar.style.display = "flex";
    if (navBack) navBack.style.display = "none";
    if (navTitle) navTitle.textContent = "Главное меню";

    if (headerTitle) {
      headerTitle.textContent = "";
      headerTitle.classList.remove("profile-header");
    }

    updateQuickStats(true);
    updateTodayProgress();

    const navBackBtn = document.getElementById("navBackBtn");
    if (navBackBtn) {
      navBackBtn.addEventListener("click", () => {
        if (currentTab === "profile") {
          switchTab("home");
        } else {
          showScreen("main");
        }
      });
    }

    const closeEmojiPickerBtn = document.getElementById("closeEmojiPickerBtn");
    if (closeEmojiPickerBtn) {
      closeEmojiPickerBtn.addEventListener("click", closeEmojiPicker);
    }

    const emojiModal = document.getElementById("emojiPickerModal");
    if (emojiModal) {
      emojiModal.addEventListener("click", (e) => {
        if (e.target === emojiModal) {
          closeEmojiPicker();
        }
      });
    }
  } catch (error) {
    console.error("Ошибка при инициализации:", error);
    showError("Ошибка при подключении к серверу: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", initApp);
