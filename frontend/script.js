// ОТЛАДОЧНАЯ ВЕРСИЯ
console.log('=== НАЧАЛО ЗАГРУЗКИ ПРИЛОЖЕНИЯ ===');
console.log('User Agent:', navigator.userAgent);
console.log('Window location:', window.location.href);

let telegramId = null;
let tg = null;

try {
    console.log('Проверка window.Telegram:', window.Telegram);
    
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        console.log('✅ Telegram WebApp найден!');
        
        console.log('initDataUnsafe:', tg.initDataUnsafe);
        console.log('initDataUnsafe.user:', tg.initDataUnsafe?.user);
        
        tg.ready();
        tg.expand();
        
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            telegramId = tg.initDataUnsafe.user.id;
            console.log('✅ Получен реальный Telegram ID:', telegramId);
            console.log('Данные пользователя:', tg.initDataUnsafe.user);
        } else {
            console.log('❌ Нет данных пользователя в Telegram');
            console.log('initDataUnsafe полный:', JSON.stringify(tg.initDataUnsafe));
            telegramId = 123456789; // Тестовый ID
            console.log('⚠️ Использую тестовый ID:', telegramId);
        }
    } else {
        console.log('❌ Telegram WebApp НЕ доступен (работаем в браузере)');
        console.log('window.Telegram:', window.Telegram);
        telegramId = 123456789;
        console.log('⚠️ Использую тестовый ID:', telegramId);
    }
} catch (e) {
    console.error('❌ Ошибка при инициализации Telegram:', e);
    telegramId = 123456789;
}

console.log('=== ИТОГ ===');
console.log('Telegram ID для запросов:', telegramId);

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

function updateDebugInfo(message) {
    const debugDiv = document.getElementById('debug-info');
    if (debugDiv) {
        debugDiv.innerHTML = message + '<br>' + debugDiv.innerHTML;
    }
    console.log(message);
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
    console.log('initApp() вызван с ID:', telegramId);
    
    if (!telegramId) {
        console.error('❌ telegramId отсутствует!');
        showError('Не удалось получить ID пользователя');
        return;
    }
    
    try {
        console.log('Создание/получение пользователя для ID:', telegramId);
        
        const userResponse = await fetch(`${API_BASE}/api/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_id: telegramId
            })
        });
        
        console.log('Ответ от /api/user статус:', userResponse.status);
        
        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            console.error('❌ Ошибка создания пользователя:', errorText);
            showError('Ошибка при создании пользователя');
            return;
        }
        
        const userData = await userResponse.json();
        console.log('✅ Пользователь создан/получен:', userData);
        
        await loadHabits();
        document.getElementById('points').textContent = userData.points;
        
    } catch (error) {
        console.error('❌ Ошибка при инициализации:', error);
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