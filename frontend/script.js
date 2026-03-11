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

window.telegramId = telegramId;
window.API_BASE = API_BASE;
window.selectedEmoji = selectedEmoji;
window.currentScreen = currentScreen;
window.currentTab = currentTab;

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function showError(message) {
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

// ===== ФУНКЦИЯ ОТРИСОВКИ ПРОФИЛЯ =====

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

    console.log("Проверка изменений:", {
      nameChanged,
      emojiChanged,
      profileEmoji,
      currentEmoji,
    });

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

async function updateQuickStats() {
  if (!telegramId) return;

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
    await updateQuickStats();
  } catch (error) {
    console.error("Ошибка:", error);
    showError("Не удалось обновить привычку");
  }
}

window.toggleHabitCompletion = toggleHabitCompletion;

async function deleteHabit(habitId) {
  if (!confirm("Удалить привычку?")) return;

  try {
    const response = await fetch(`${API_BASE}/api/delete-habit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habit_id: habitId }),
    });

    if (response.ok) {
      if (currentScreen === "habits") {
        await renderHabitsScreen(document.getElementById("screenContainer"));
      }
      await updateTodayProgress();
      await updateQuickStats();
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    showError("Не удалось удалить привычку");
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
    await updateQuickStats();
    showScreen("habits");
  } catch (error) {
    console.error("Ошибка при добавлении привычки:", error);
    showError("Ошибка при добавлении привычки");
  }
}

window.createHabit = createHabit;

// ===== ФУНКЦИИ ОТРИСОВКИ ЭКРАНОВ =====

function renderMainScreen(container) {
  const menuItems = [
    {
      id: "habits",
      icon: "📋",
      title: "Мои привычки",
      desc: "Управление",
    },
    {
      id: "create",
      icon: "➕",
      title: "Создать привычку",
      desc: "Добавить",
    },
    {
      id: "stats",
      icon: "📊",
      title: "Статистика",
      desc: "Прогресс",
    },
    {
      id: "leaderboard",
      icon: "🏆",
      title: "Рейтинг",
      desc: "Топ пользователей",
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
  updateQuickStats();
}

// ===== ПОЛНОСТЬЮ ОБНОВЛЕННАЯ ФУНКЦИЯ СТАТИСТИКИ =====

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

    // Вычисляем общее количество выполнений и максимальную серию
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

    // Получаем данные активности за 30 дней
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

    // Вычисляем проценты для каждой привычки
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

    // Функция для генерации полосок активности
    function generateActivityBars(data) {
      if (!data || data.length === 0) {
        let bars = "";
        for (let i = 0; i < 30; i++) {
          bars += `<div class="activity-bar" style="height: 8px; background-color: var(--accent-gray);"></div>`;
        }
        return bars;
      }

      // Нормализуем значения для отображения (максимальная высота полоски 24px)
      const max = Math.max(...data, 1);

      return data
        .map((value) => {
          const height = Math.max(
            4,
            Math.min(24, Math.round((value / max) * 24)),
          );
          return `<div class="activity-bar" style="height: ${height}px; background-color: var(--accent-green);" title="Выполнено: ${value}"></div>`;
        })
        .join("");
    }

    const html = `
      <div class="screen stats-screen">
        <!-- Заголовок -->
        <h2 class="stats-main-title">Статистика</h2>
        
        <!-- Верхний блок с очками -->
        <div class="stats-points-block">
          <div class="stats-points-large">${userData.points || 0}</div>
          <div class="stats-points-label-large">очков</div>
        </div>

        <!-- Блок мини-статистики (6 карточек в 2 ряда) -->
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

        <!-- Блок активности за 30 дней (полоски) -->
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

        <!-- Блок "По привычкам" -->
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

        <!-- Блок с информацией о начислении очков -->
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

    let html = `
      <div class="screen">
        <div class="leaderboard-card">
    `;

    if (leaderboard.length === 0) {
      html += '<div class="empty-state">Пока нет участников</div>';
    } else {
      leaderboard.forEach((user, index) => {
        html += `
          <div class="leaderboard-item">
            <div class="leaderboard-rank">#${index + 1}</div>
            <div class="leaderboard-info">
              <div class="leaderboard-id">${user.username || "Пользователь " + user.telegram_id}</div>
              <div class="leaderboard-points">⭐ <span>${user.points}</span> очков</div>
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
  } catch (error) {
    console.error("Ошибка загрузки рейтинга:", error);
    container.innerHTML =
      '<div class="screen"><div class="error-message">Ошибка при загрузке рейтинга</div></div>';
  }
}

// ===== НАВИГАЦИЯ =====

function showScreen(screenName) {
  currentScreen = screenName;
  window.currentScreen = currentScreen;

  const container = document.getElementById("screenContainer");
  const navBack = document.getElementById("navBackBtn");
  const navTitle = document.getElementById("navTitle");

  if (screenName === "main") {
    navBack.style.display = "none";
    navTitle.textContent = "Главное меню";
  } else {
    navBack.style.display = "block";

    const titles = {
      habits: "Мои привычки",
      stats: "Статистика",
      create: "Создать привычку",
      leaderboard: "Рейтинг",
    };
    navTitle.textContent = titles[screenName] || "Habit Power";
  }

  container.innerHTML =
    '<div class="screen" style="text-align: center; padding: 50px;">Загрузка...</div>';

  setTimeout(() => {
    switch (screenName) {
      case "main":
        renderMainScreen(container);
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
    }
    updateTodayProgress();
  }, 10);
}

window.showScreen = showScreen;

// ===== УПРАВЛЕНИЕ ВКЛАДКАМИ =====

function switchTab(tabName) {
  currentTab = tabName;
  window.currentTab = currentTab;

  const progressBlock = document.getElementById("progressBlock");
  const navBar = document.getElementById("navBar");
  const headerTitle = document.getElementById("mainHeaderTitle");
  const container = document.getElementById("screenContainer");
  const tabHome = document.getElementById("tabHome");
  const tabProfile = document.getElementById("tabProfile");

  if (tabHome && tabProfile) {
    if (tabName === "home") {
      tabHome.classList.add("active");
      tabProfile.classList.remove("active");
    } else {
      tabProfile.classList.add("active");
      tabHome.classList.remove("active");
    }
  }

  if (tabName === "home") {
    progressBlock.style.display = "block";
    navBar.style.display = "flex";
    headerTitle.textContent = "Habit Power";
    showScreen("main");
  } else {
    progressBlock.style.display = "none";
    navBar.style.display = "none";
    headerTitle.textContent = "Мой профиль";

    container.innerHTML =
      '<div class="screen" style="text-align: center; padding: 50px;">Загрузка...</div>';

    setTimeout(async () => {
      await loadUserProfile();
      renderProfileScreen(container);
    }, 10);
  }
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
    switchTab("home");

    document.getElementById("navBackBtn").addEventListener("click", () => {
      showScreen("main");
    });

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

    setInterval(() => {
      updateTodayProgress();
      updateQuickStats();
    }, 30000);
  } catch (error) {
    console.error("Ошибка при инициализации:", error);
    showError("Ошибка при подключении к серверу");
  }
}

document.addEventListener("DOMContentLoaded", initApp);
