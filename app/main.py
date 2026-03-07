import os
import datetime
from typing import List

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Date,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session

# -----------------------------
# DB setup
# -----------------------------

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

# Fix для postgres:// от Render
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# -----------------------------
# SQLAlchemy модели
# -----------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(String, unique=True, index=True, nullable=False)
    points = Column(Integer, default=0, nullable=False)

    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")


class Habit(Base):
    __tablename__= "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    streak = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="habits")
    completions = relationship("Completion", back_populates="habit", cascade="all, delete-orphan")


class Completion(Base):
   
# ------------= "completions"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)

    habit = relationship("Habit", back_populates="completions")

       Column,
    = (
        UniqueConstraint("habit_id", "date", name="uq_habit_date"),
    )


# -----------------------------
# Pydantic схемы
# -----------------------------

class UserCreate(BaseModel):
    telegram_id: str


class HabitCreate(BaseModel):
    telegram_id: str
    name: str


class HabitDelete(BaseModel):
    telegram_id: str
    habit_id: int


class HabitComplete(BaseModel):
    telegram_id: str
    habit_id: int


class HabitOut(BaseModel):
    id: int
    name: str
    streak: int
    completed_today: bool

    class Config:
        orm_mode = True


class HabitsResponse(BaseModel):
    habits: List[HabitOut]
    points: int


class LeaderboardUser(BaseModel):
    telegram_id: str
    points: int

    class Config:
        orm_mode = True


# -----------------------------
# FastAPI app
# -----------------------------

app = FastAPI(title="Habit Power API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Dependency
# -----------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Startup
# -----------------------------

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


# -----------------------------
# Helpers
# -----------------------------

def get_or_create_user(db: Session, telegram_id: str) -> User:
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        user = User(telegram_id=telegram_id, points=0)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def today_date() -> datetime.date:
    return datetime.date.today()


# -----------------------------
# API endpoints
# -----------------------------

@app.post("/api/user")
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    user = get_or_create_user(db, user_in.telegram_id)
    return {"id": user.id, "telegram_id": user.telegram_id, "points": user.points}


@app.get("/api/habits/{telegram_id}", response_model=HabitsResponse)
def get_habits(telegram_id: str, db: Session = Depends(get_db)):
    user = get_or_create_user(db, telegram_id)
    today = today_date()

    habits = (
        db.query(Habit)
        .filter(Habit.user_id == user.id)
        .order_by(Habit.id.asc())
        .all()
    )

    result: List[HabitOut] = []
    for h in habits:
        completed = (
            db.query(Completion)
            .filter(Completion.habit_id == h.id, Completion.date == today)
            .first()
            is not None
        )
        result.append(
            HabitOut(
                id=h.id,
                name=h.name,
                streak=h.streak,
                completed_today=completed,
            )
        )

    return HabitsResponse(habits=result, points=user.points)


@app.post("/api/add-habit", response_model=HabitOut)
def add_habit(habit_in: HabitCreate, db: Session = Depends(get_db)):
    user = get_or_create_user(db, habit_in.telegram_id)

    count = db.query(Habit).filter(Habit.user_id == user.id).count()
    if count >= 10:
        raise HTTPException(status_code=400, detail="Habit limit reached (10).")

    name = habit_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Habit name cannot be empty.")

    habit = Habit(user_id=user.id, name=name, streak=0)
    db.add(habit)
    db.commit()
    db.refresh(habit)

    return HabitOut(
        id=habit.id,
        name=habit.name,
        streak=habit.streak,
        completed_today=False,
    )


@app.post("/api/delete-habit")
def delete_habit(habit_del: HabitDelete, db: Session = Depends(get_db)):
    user = get_or_create_user(db, habit_del.telegram_id)

    habit = (
        db.query(Habit)
        .filter(Habit.id == habit_del.habit_id, Habit.user_id == user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found.")

    db.delete(habit)
    db.commit()
    return {"status": "deleted"}


@app.post("/api/complete-habit")
def complete_habit(habit_comp: HabitComplete, db: Session = Depends(get_db)):
    user = get_or_create_user(db, habit_comp.telegram_id)

    habit = (
        db.query(Habit)
        .filter(Habit.id == habit_comp.habit_id, Habit.user_id == user.id)
        .first()
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found.")

    today = today_date()

    existing = (
        db.query(Completion)
        .filter(Completion.habit_id == habit.id, Completion.date == today)
        .first()
    )
    if existing:
        return {"status": "already_done"}

    completion = Completion(habit_id=habit.id, date=today)
    db.add(completion)

    habit.streak += 1
    user.points += 10

    db.commit()
    db.refresh(habit)
    db.refresh(user)

    return {
        "status": "ok",
        "streak": habit.streak,
        "points": user.points,
    }


@app.get("/api/leaderboard", response_model=List[LeaderboardUser])
def leaderboard(db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .order_by(User.points.desc(), User.id.asc())
        .limit(100)
        .all()
    )
    return [LeaderboardUser(telegram_id=u.telegram_id, points=u.points) for u in users]


# -----------------------------
# Static frontend
# -----------------------------

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
