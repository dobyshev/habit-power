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
        console.log('Telegram user ID:', telegramId);
    } else {
        // Если не в Telegram (для локального тестирования)
        console.log('Не в Telegram, используем тестовый ID');
        telegramId = 123456789;
    }
} catch (e) {
    console.log('Ошибка инициализации Telegram WebApp:', e);
    console.log('Используем тестовый режим');
    telegramId = 123456789;
}

// Проверяем, что ID получен
if (!telegramId) {
    console.error('Не удалось получить ID пользователя');
    telegramId = 123456789; // Запасной вариант
}

// API базовый URL
const API_BASE = '';

// Функция для показа ошибок
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.querySelector('.app').insertBefore(errorDiv, document.querySelector('.habits-container'));
    
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// Функция для получения эмодзи по названию привычки
function getHabitEmoji(name) {
    const nameLower = name.toLowerCase();
    const emojiMap = {
        'run': '🏃',
        'бег': '🏃',
        'read': '📚',
        'читать': '📚',
        'water': '💧',
        'вода': '💧',
        'workout': '💪',
        'тренировка': '💪',
        'code': '💻',
        'код': '💻',
        'sleep': '🛌',
        'сон': '🛌'
    };
    
    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (nameLower.includes(key)) {
            return emoji;
        }
    }
    return '⭐';
}

// Создание карточки привычки
function createHabitCard(habit) {
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.habitId = habit.id;
    
    const emoji = getHabitEmoji(habit.name);
    
    card.innerHTML = `
        <div class="habit-emoji">${emoji}</div>
        <div class="habit-info">
            <div class="habit-name">${habit.name}</div>
            <div class="habit-streak">Стрик: <span class="streak-number">${habit.streak} 🔥</span></div>
        </div>
        <div class="habit-actions">
            <button class="complete-btn ${habit.completed_today ? 'completed' : ''}" 
                    ${habit.completed_today ? 'disabled' : ''}>
                ✓
            </button>
            <button class="delete-btn">🗑️</button>
        </div>
    `;
    
    // Обработчик выполнения
    const completeBtn = card.querySelector('.complete-btn');
    completeBtn.addEventListener('click', async () => {
        if (completeBtn.classList.contains('completed')) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/complete-habit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    habit_id: habit.id,
                    telegram_id: telegramId
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                if (error.detail === 'already_done') {
                    showError('Привычка уже выполнена сегодня');
                    completeBtn.classList.add('completed');
                    completeBtn.disabled = true;
                }
                return;
            }
            
            const data = await response.json();
            
            // Обновляем очки
            document.getElementById('points').textContent = data.points;
            
            // Обновляем стрик
            const streakSpan = card.querySelector('.streak-number');
            streakSpan.textContent = `${data.streak} 🔥`;
            
            // Делаем кнопку серой
            completeBtn.classList.add('completed');
            completeBtn.disabled = true;

            await loadStatistics();
            
        } catch (error) {
            console.error('Error completing habit:', error);
            showError('Ошибка при выполнении привычки');
        }
    });
    
    // Обработчик удаления
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
        if (confirm('Удалить привычку?')) {
            try {
                const response = await fetch(`${API_BASE}/api/delete-habit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        habit_id: habit.id
                    })
                });
                
                if (response.ok) {
                    card.remove();
                    await loadUserPoints();
                    await loadStatistics();
                }
            } catch (error) {
                console.error('Error deleting habit:', error);
                showError('Ошибка при удалении привычки');
            }
        }
    });
    
    return card;
}

// Загрузка привычек
async function loadHabits() {
    try {
        const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);
        const habits = await response.json();
        
        const container = document.getElementById('habitsContainer');
        container.innerHTML = '';
        
        habits.forEach(habit => {
            container.appendChild(createHabitCard(habit));
        });
        
    } catch (error) {
        console.error('Error loading habits:', error);
        showError('Ошибка при загрузке привычек');
    }
}

// Загрузка очков пользователя
async function loadUserPoints() {
    try {
        const response = await fetch(`${API_BASE}/api/habits/${telegramId}`);
        const habits = await response.json();
        
        // Получаем очки через отдельный запрос или вычисляем
        const pointsResponse = await fetch(`${API_BASE}/api/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_id: telegramId
            })
        });
        
        const userData = await pointsResponse.json();
        document.getElementById('points').textContent = userData.points;
        
    } catch (error) {
        console.error('Error loading points:', error);
    }
}

// ===== НОВАЯ ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ И ОБНОВЛЕНИЯ СТАТИСТИКИ =====
async function loadStatistics() {
    if (!telegramId) return;

    try {
        // 1. Получаем привычки пользователя, чтобы посчитать статистику
        const habitsResponse = await fetch(`${API_BASE}/api/habits/${telegramId}`);
        if (!habitsResponse.ok) {
            console.error('Ошибка загрузки привычек для статистики');
            return;
        }
        const habits = await habitsResponse.json();

        // 2. Получаем очки пользователя
        const pointsResponse = await fetch(`${API_BASE}/api/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: telegramId })
        });

        if (!pointsResponse.ok) {
            console.error('Ошибка загрузки очков для статистики');
            return;
        }
        const userData = await pointsResponse.json();

        // 3. Рассчитываем показатели
        const habitsCount = habits.length;

        // Суммируем все streak (это и есть общее количество выполнений)
        const totalCompletions = habits.reduce((sum, habit) => sum + (habit.streak || 0), 0);

        // Находим максимальный streak
        const bestStreak = habits.reduce((max, habit) => Math.max(max, habit.streak || 0), 0);

        // 4. Обновляем DOM
        document.getElementById('stat-points').textContent = userData.points || 0;
        document.getElementById('stat-best-streak').textContent = bestStreak;
        document.getElementById('stat-total-completions').textContent = totalCompletions;
        document.getElementById('stat-habits-count').textContent = habitsCount;

    } catch (error) {
        console.error('Ошибка при загрузке статистики:', error);
    }
}

// Загрузка рейтинга
async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE}/api/leaderboard`);
        const leaderboard = await response.json();
        
        const list = document.getElementById('leaderboardList');
        list.innerHTML = '';
        
        leaderboard.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span class="leaderboard-rank">#${index + 1}</span>
                <span class="leaderboard-id">${user.telegram_id}</span>
                <span class="leaderboard-points">${user.points} ⭐</span>
            `;
            list.appendChild(item);
        });
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showError('Ошибка при загрузке рейтинга');
    }
}

// Инициализация приложения
async function initApp() {
    if (!telegramId) {
        showError('Не удалось получить ID пользователя');
        return;
    }
    
    try {
        // Создаем/получаем пользователя
        const userResponse = await fetch(`${API_BASE}/api/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: telegramId })
        });
        
        const userData = await userResponse.json();
        console.log('Пользователь создан/получен:', userData);
        
        // Загружаем привычки
        await loadHabits();
        
        // Загружаем очки
        document.getElementById('points').textContent = userData.points;

        // ===== ВАЖНО: Загружаем статистику =====
        await loadStatistics();
        
    } catch (error) {
        console.error('Ошибка при инициализации:', error);
        showError('Ошибка при подключении к серверу');
    }
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    
    // Добавление привычки
    document.getElementById('addHabitBtn').addEventListener('click', async () => {
        const input = document.getElementById('habitName');
        const name = input.value.trim();
        
        if (!name) {
            showError('Введите название привычки');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/api/add-habit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    telegram_id: telegramId,
                    name: name
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                if (error.detail === 'Maximum habits limit (10) reached') {
                    showError('Максимум 10 привычек');
                }
                return;
            }
            
            input.value = '';
            await loadHabits();
            await loadStatistics();
            
        } catch (error) {
            console.error('Error adding habit:', error);
            showError('Ошибка при добавлении привычки');
        }
    });
    
    // Рейтинг
    document.getElementById('leaderboardBtn').addEventListener('click', async () => {
        await loadLeaderboard();
        document.getElementById('leaderboardModal').classList.add('show');
    });
    
    document.getElementById('closeModalBtn').addEventListener('click', () => {
        document.getElementById('leaderboardModal').classList.remove('show');
    });
    
    // Закрытие модального окна по клику вне его
    document.getElementById('leaderboardModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('leaderboardModal')) {
            e.target.classList.remove('show');
        }
    });
    
    // Добавление привычки по Enter
    document.getElementById('habitName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('addHabitBtn').click();
        }
    });
});

// ===== ЛОГИКА ДЛЯ РАСКРЫВАЮЩЕГОСЯ БЛОКА СТАТИСТИКИ =====
function initStatsToggle() {
    const statsHeader = document.getElementById('statsToggle');
    const statsContent = document.getElementById('statsContent');
    const statsArrow = document.getElementById('statsArrow');
    
    if (!statsHeader || !statsContent || !statsArrow) return;
    
    // Проверяем, сохранено ли состояние в localStorage
    const isStatsOpen = localStorage.getItem('statsOpen') === 'true';
    
    // Устанавливаем начальное состояние
    if (isStatsOpen) {
        statsContent.classList.add('open');
        statsArrow.classList.add('rotated');
    }
    
    // Обработчик клика
    statsHeader.addEventListener('click', () => {
        const isOpen = statsContent.classList.contains('open');
        
        if (isOpen) {
            statsContent.classList.remove('open');
            statsArrow.classList.remove('rotated');
            localStorage.setItem('statsOpen', 'false');
        } else {
            statsContent.classList.add('open');
            statsArrow.classList.add('rotated');
            localStorage.setItem('statsOpen', 'true');
        }
    });
}

// Вызываем функцию после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // ... ваш существующий код ...
    
    // Инициализируем сворачивание статистики
    initStatsToggle();
});