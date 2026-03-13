from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
import re

from database import engine, get_db
from models import Base, User, Habit, Completion, UserProfile, UsernameHistory, Reminder

# Создание таблиц
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS для локальной разработки
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://habit-power-api.onrender.com",
        "https://web.telegram.org",
        "https://t.me",
        "https://telegram.org",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем статические файлы
app.mount("/frontend", StaticFiles(directory="frontend"), name="frontend")


# Pydantic модели
class UserCreate(BaseModel):
    telegram_id: int


class HabitCreate(BaseModel):
    telegram_id: int
    name: str
    emoji: Optional[str] = "😀"


class HabitDelete(BaseModel):
    habit_id: int


class HabitComplete(BaseModel):
    habit_id: int
    telegram_id: int


class HabitUndo(BaseModel):
    habit_id: int
    telegram_id: int


class HabitResponse(BaseModel):
    id: int
    name: str
    streak: int
    completed_today: bool
    emoji: Optional[str] = None


class HabitCompleteResponse(BaseModel):
    status: str
    points: int
    streak: int
    points_earned: int


class HabitUndoResponse(BaseModel):
    status: str
    habit_id: int
    streak: int
    points: int
    completed_today: bool
    points_removed: int


class LeaderboardResponse(BaseModel):
    telegram_id: int
    points: int
    username: Optional[str] = None
    emoji: Optional[str] = None
    streak: Optional[int] = 0


# Модели для профиля
class UsernameCheckRequest(BaseModel):
    telegram_id: int
    username: str


class UsernameCheckResponse(BaseModel):
    available: bool
    reason: Optional[str] = None


class UserProfileRequest(BaseModel):
    telegram_id: int


class UserProfileResponse(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    emoji: Optional[str] = "😀"
    created_at: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    telegram_id: int
    username: str
    emoji: str


# Модель для активности
class ActivityRequest(BaseModel):
    telegram_id: int
    days: Optional[int] = 30


# Модели для напоминаний
class ReminderCreate(BaseModel):
    telegram_id: int
    habit_id: int
    reminder_time: str
    is_active: bool = True


class ReminderUpdate(BaseModel):
    reminder_id: int
    reminder_time: Optional[str] = None
    is_active: Optional[bool] = None


class ReminderResponse(BaseModel):
    id: int
    habit_id: int
    habit_name: str
    habit_emoji: str
    reminder_time: str
    is_active: bool


class ReminderDelete(BaseModel):
    reminder_id: int


# API Endpoints
@app.post("/api/user")
async def create_or_get_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Создает пользователя если его нет"""
    user = db.query(User).filter(User.telegram_id == user_data.telegram_id).first()
    if not user:
        user = User(telegram_id=user_data.telegram_id, points=0)
        db.add(user)
        db.commit()
        db.refresh(user)

        # Создаем профиль для нового пользователя
        profile = UserProfile(
            user_id=user.id, telegram_id=user.telegram_id, username=None, emoji="😀"
        )
        db.add(profile)
        db.commit()

    return {"status": "success", "user_id": user.id, "points": user.points}


@app.post("/api/check-username", response_model=UsernameCheckResponse)
async def check_username(request: UsernameCheckRequest, db: Session = Depends(get_db)):
    """Проверяет, доступно ли имя пользователя"""

    # Валидация длины
    if len(request.username) < 3:
        return {"available": False, "reason": "too_short"}

    if len(request.username) > 20:
        return {"available": False, "reason": "too_long"}

    # Валидация символов (только латинские буквы, цифры и _)
    if not re.match("^[a-zA-Z0-9_]+$", request.username):
        return {"available": False, "reason": "invalid_chars"}

    # Проверяем, не занято ли имя другим пользователем
    existing_profile = (
        db.query(UserProfile)
        .filter(
            UserProfile.username == request.username,
            UserProfile.telegram_id != request.telegram_id,
        )
        .first()
    )

    if existing_profile:
        return {"available": False, "reason": "taken"}

    return {"available": True, "reason": None}


@app.post("/api/user-profile", response_model=UserProfileResponse)
async def get_user_profile(request: UserProfileRequest, db: Session = Depends(get_db)):
    """Возвращает профиль пользователя"""

    profile = (
        db.query(UserProfile)
        .filter(UserProfile.telegram_id == request.telegram_id)
        .first()
    )

    if not profile:
        # Если профиля нет, создаем его
        user = db.query(User).filter(User.telegram_id == request.telegram_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        profile = UserProfile(
            user_id=user.id, telegram_id=user.telegram_id, username=None, emoji="😀"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return {
        "telegram_id": profile.telegram_id,
        "username": profile.username,
        "emoji": profile.emoji,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


@app.post("/api/update-profile")
async def update_profile(request: UpdateProfileRequest, db: Session = Depends(get_db)):
    """Обновляет профиль пользователя (имя и эмодзи)"""

    # Проверяем пользователя
    user = db.query(User).filter(User.telegram_id == request.telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Валидация имени
    if len(request.username) < 3:
        raise HTTPException(status_code=400, detail="username_too_short")

    if len(request.username) > 20:
        raise HTTPException(status_code=400, detail="username_too_long")

    if not re.match("^[a-zA-Z0-9_]+$", request.username):
        raise HTTPException(status_code=400, detail="username_invalid_chars")

    # Проверяем уникальность имени
    existing_profile = (
        db.query(UserProfile)
        .filter(
            UserProfile.username == request.username,
            UserProfile.telegram_id != request.telegram_id,
        )
        .first()
    )

    if existing_profile:
        raise HTTPException(status_code=400, detail="username_taken")

    # Получаем или создаем профиль
    profile = (
        db.query(UserProfile)
        .filter(UserProfile.telegram_id == request.telegram_id)
        .first()
    )

    if not profile:
        profile = UserProfile(user_id=user.id, telegram_id=user.telegram_id)
        db.add(profile)

    # Сохраняем старое имя в историю, если оно меняется
    if profile.username and profile.username != request.username:
        history = UsernameHistory(
            user_id=user.id, telegram_id=user.telegram_id, username=profile.username
        )
        db.add(history)

    # Обновляем профиль
    profile.username = request.username
    profile.emoji = request.emoji
    profile.updated_at = datetime.utcnow()

    db.commit()

    return {"status": "success", "username": profile.username, "emoji": profile.emoji}


@app.get("/api/habits/{telegram_id}", response_model=List[HabitResponse])
async def get_habits(telegram_id: int, db: Session = Depends(get_db)):
    """Возвращает привычки пользователя"""
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        return []

    habits = db.query(Habit).filter(Habit.user_id == user.id).all()
    today = date.today()

    result = []
    for habit in habits:
        completed_today = (
            db.query(Completion)
            .filter(Completion.habit_id == habit.id, Completion.date == today)
            .first()
            is not None
        )

        result.append(
            {
                "id": habit.id,
                "name": habit.name,
                "streak": habit.streak,
                "completed_today": completed_today,
                "emoji": habit.emoji,
            }
        )

    return result


@app.post("/api/add-habit")
async def add_habit(habit_data: HabitCreate, db: Session = Depends(get_db)):
    """Добавляет новую привычку"""
    user = db.query(User).filter(User.telegram_id == habit_data.telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Проверяем количество привычек
    habits_count = db.query(Habit).filter(Habit.user_id == user.id).count()
    if habits_count >= 10:
        raise HTTPException(status_code=400, detail="Maximum habits limit (10) reached")

    new_habit = Habit(
        user_id=user.id, name=habit_data.name, streak=0, emoji=habit_data.emoji
    )
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)

    return {"status": "success", "habit_id": new_habit.id, "emoji": new_habit.emoji}


@app.post("/api/delete-habit")
async def delete_habit(habit_data: HabitDelete, db: Session = Depends(get_db)):
    """Удаляет привычку"""
    try:
        print(f"Получен запрос на удаление: habit_id={habit_data.habit_id}")

        habit = db.query(Habit).filter(Habit.id == habit_data.habit_id).first()
        if not habit:
            print(f"Привычка с id {habit_data.habit_id} не найдена")
            raise HTTPException(status_code=404, detail="Habit not found")

        print(f"Найдена привычка: {habit.name}, удаляем...")
        db.delete(habit)
        db.commit()
        print("Привычка успешно удалена")

        return {"status": "success", "message": "Habit deleted"}
    except Exception as e:
        print(f"Ошибка при удалении: {str(e)}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/complete-habit", response_model=HabitCompleteResponse)
async def complete_habit(habit_data: HabitComplete, db: Session = Depends(get_db)):
    """Отмечает привычку как выполненную с начислением бонусов за серии"""
    habit = db.query(Habit).filter(Habit.id == habit_data.habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    user = db.query(User).filter(User.id == habit.user_id).first()

    today = date.today()

    # Проверяем, не выполнялась ли привычка сегодня
    existing_completion = (
        db.query(Completion)
        .filter(Completion.habit_id == habit.id, Completion.date == today)
        .first()
    )

    if existing_completion:
        raise HTTPException(status_code=400, detail="already_done")

    # Добавляем выполнение
    completion = Completion(habit_id=habit.id, date=today)
    db.add(completion)

    # Сохраняем старый streak для расчета бонуса
    old_streak = habit.streak

    # Увеличиваем streak
    habit.streak += 1

    # Базовые очки за выполнение
    points_earned = 10

    # Проверяем бонусы за серию
    # Бонус за серию 3 дня (когда streak становится 3)
    if old_streak < 3 and habit.streak >= 3:
        points_earned += 5
        print(f"Бонус за серию 3 дня: +5 очков")

    # Бонус за серию 7 дней (когда streak становится 7)
    if old_streak < 7 and habit.streak >= 7:
        points_earned += 25
        print(f"Бонус за серию 7 дней: +25 очков")

    # Добавляем очки пользователю
    user.points += points_earned

    db.commit()

    return {
        "status": "success",
        "points": user.points,
        "streak": habit.streak,
        "points_earned": points_earned,
    }


@app.post("/api/undo-habit", response_model=HabitUndoResponse)
async def undo_habit(habit_data: HabitUndo, db: Session = Depends(get_db)):
    """Отменяет выполнение привычки с корректным списанием очков"""
    # Получаем привычку
    habit = db.query(Habit).filter(Habit.id == habit_data.habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    # Получаем пользователя
    user = db.query(User).filter(User.telegram_id == habit_data.telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    today = date.today()

    # Проверяем, выполнялась ли привычка сегодня
    existing_completion = (
        db.query(Completion)
        .filter(Completion.habit_id == habit.id, Completion.date == today)
        .first()
    )

    if not existing_completion:
        raise HTTPException(status_code=400, detail="not_done_today")

    # Удаляем запись о выполнении
    db.delete(existing_completion)

    # Сохраняем старый streak для расчета отнимаемых очков
    old_streak = habit.streak

    # Уменьшаем streak (но не ниже 0)
    if habit.streak > 0:
        habit.streak -= 1

    # Рассчитываем, сколько очков нужно отнять
    points_to_remove = 10  # Базовое выполнение

    # Если была достигнута серия 7 дней, отнимаем бонус
    if old_streak >= 7:
        points_to_remove += 25
    # Если была достигнута серия 3 дня, отнимаем бонус
    elif old_streak >= 3:
        points_to_remove += 5

    # Отнимаем очки у пользователя (но не ниже 0)
    if user.points >= points_to_remove:
        user.points -= points_to_remove
    else:
        user.points = 0

    db.commit()

    return {
        "status": "success",
        "habit_id": habit.id,
        "streak": habit.streak,
        "points": user.points,
        "completed_today": False,
        "points_removed": points_to_remove,
    }


@app.post("/api/habit-activity")
async def get_habit_activity(request: ActivityRequest, db: Session = Depends(get_db)):
    """Возвращает активность пользователя за последние N дней"""

    user = db.query(User).filter(User.telegram_id == request.telegram_id).first()
    if not user:
        return {"activity": []}

    # Получаем все привычки пользователя
    habits = db.query(Habit).filter(Habit.user_id == user.id).all()
    habit_ids = [habit.id for habit in habits]

    if not habit_ids:
        return {"activity": [0] * request.days}

    # Вычисляем дату начала периода
    end_date = date.today()
    start_date = end_date - timedelta(days=request.days - 1)

    # Получаем все выполнения за период
    completions = (
        db.query(Completion)
        .filter(
            Completion.habit_id.in_(habit_ids),
            Completion.date >= start_date,
            Completion.date <= end_date,
        )
        .all()
    )

    # Группируем по дням
    activity_by_date = {}
    for completion in completions:
        date_str = completion.date.isoformat()
        if date_str not in activity_by_date:
            activity_by_date[date_str] = 0
        activity_by_date[date_str] += 1

    # Формируем массив за каждый день
    activity = []
    for i in range(request.days):
        current_date = start_date + timedelta(days=i)
        date_str = current_date.isoformat()
        activity.append(activity_by_date.get(date_str, 0))

    return {"activity": activity}


@app.get("/api/leaderboard", response_model=List[LeaderboardResponse])
async def get_leaderboard(db: Session = Depends(get_db)):
    """Возвращает рейтинг пользователей"""
    users = db.query(User).order_by(User.points.desc()).limit(50).all()

    result = []
    for user in users:
        profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()

        # Получаем максимальный streak пользователя
        habits = db.query(Habit).filter(Habit.user_id == user.id).all()
        max_streak = max([habit.streak for habit in habits], default=0)

        result.append(
            {
                "telegram_id": user.telegram_id,
                "points": user.points,
                "username": profile.username if profile else None,
                "emoji": profile.emoji if profile else "😀",
                "streak": max_streak,
            }
        )

    return result


# Эндпоинты для напоминаний
@app.get("/api/reminders/{telegram_id}", response_model=List[ReminderResponse])
async def get_reminders(telegram_id: int, db: Session = Depends(get_db)):
    """Возвращает все напоминания пользователя"""
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        return []

    reminders = db.query(Reminder).filter(Reminder.user_id == user.id).all()

    result = []
    for reminder in reminders:
        habit = db.query(Habit).filter(Habit.id == reminder.habit_id).first()
        if habit:
            result.append(
                {
                    "id": reminder.id,
                    "habit_id": habit.id,
                    "habit_name": habit.name,
                    "habit_emoji": habit.emoji or "📋",
                    "reminder_time": reminder.reminder_time,
                    "is_active": reminder.is_active,
                }
            )

    # Сортируем по времени
    result.sort(key=lambda x: x["reminder_time"])
    return result


@app.post("/api/add-reminder")
async def add_reminder(reminder_data: ReminderCreate, db: Session = Depends(get_db)):
    """Добавляет напоминание для привычки"""
    user = db.query(User).filter(User.telegram_id == reminder_data.telegram_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    habit = db.query(Habit).filter(Habit.id == reminder_data.habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    # Проверяем валидность времени
    time_pattern = re.compile(r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    if not time_pattern.match(reminder_data.reminder_time):
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

    # Проверяем, есть ли уже напоминание для этой привычки
    existing = (
        db.query(Reminder)
        .filter(
            Reminder.user_id == user.id, Reminder.habit_id == reminder_data.habit_id
        )
        .first()
    )

    if existing:
        # Обновляем существующее
        existing.reminder_time = reminder_data.reminder_time
        existing.is_active = reminder_data.is_active
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return {"status": "success", "reminder_id": existing.id}
    else:
        # Создаем новое
        new_reminder = Reminder(
            user_id=user.id,
            habit_id=reminder_data.habit_id,
            reminder_time=reminder_data.reminder_time,
            is_active=reminder_data.is_active,
        )
        db.add(new_reminder)
        db.commit()
        db.refresh(new_reminder)
        return {"status": "success", "reminder_id": new_reminder.id}


@app.post("/api/update-reminder")
async def update_reminder(reminder_data: ReminderUpdate, db: Session = Depends(get_db)):
    """Обновляет напоминание"""
    reminder = (
        db.query(Reminder).filter(Reminder.id == reminder_data.reminder_id).first()
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    if reminder_data.reminder_time is not None:
        # Проверяем валидность времени
        time_pattern = re.compile(r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
        if not time_pattern.match(reminder_data.reminder_time):
            raise HTTPException(
                status_code=400, detail="Invalid time format. Use HH:MM"
            )
        reminder.reminder_time = reminder_data.reminder_time

    if reminder_data.is_active is not None:
        reminder.is_active = reminder_data.is_active

    reminder.updated_at = datetime.utcnow()
    db.commit()

    return {"status": "success"}


@app.post("/api/delete-reminder")
async def delete_reminder(reminder_data: ReminderDelete, db: Session = Depends(get_db)):
    """Удаляет напоминание"""
    reminder = (
        db.query(Reminder).filter(Reminder.id == reminder_data.reminder_id).first()
    )
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    db.delete(reminder)
    db.commit()

    return {"status": "success"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
