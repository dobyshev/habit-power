from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from datetime import date
from typing import List
from pydantic import BaseModel

from database import engine, get_db
from models import Base, User, Habit, Completion

# Создание таблиц
Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS для локальной разработки
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

    class Config:
        from_attributes = True


class HabitDelete(BaseModel):
    habit_id: int


class HabitComplete(BaseModel):
    habit_id: int
    telegram_id: int


class HabitResponse(BaseModel):
    id: int
    name: str
    streak: int
    completed_today: bool


class LeaderboardResponse(BaseModel):
    telegram_id: int
    points: int


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
    return {"status": "success", "user_id": user.id, "points": user.points}


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

    new_habit = Habit(user_id=user.id, name=habit_data.name, streak=0)
    db.add(new_habit)
    db.commit()
    db.refresh(new_habit)

    return {"status": "success", "habit_id": new_habit.id}


@app.post("/api/delete-habit")
async def delete_habit(habit_data: HabitDelete, db: Session = Depends(get_db)):
    """Удаляет привычку"""
    habit = db.query(Habit).filter(Habit.id == habit_data.habit_id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")

    db.delete(habit)
    db.commit()

    return {"status": "success"}


@app.post("/api/complete-habit")
async def complete_habit(habit_data: HabitComplete, db: Session = Depends(get_db)):
    """Отмечает привычку как выполненную"""
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

    # Увеличиваем streak
    habit.streak += 1

    # Добавляем очки пользователю
    user.points += 10

    db.commit()

    return {"status": "success", "points": user.points, "streak": habit.streak}


@app.get("/api/leaderboard", response_model=List[LeaderboardResponse])
async def get_leaderboard(db: Session = Depends(get_db)):
    """Возвращает рейтинг пользователей"""
    users = db.query(User).order_by(User.points.desc()).limit(50).all()
    return [{"telegram_id": user.telegram_id, "points": user.points} for user in users]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
