from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Column, Integer, String, Date, ForeignKey, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import date
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, unique=True)
    points = Column(Integer, default=0)

class Habit(Base):
   Integer, String= "habits"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    name = Column(String)
    streak = Column(Integer, default=0)

class Completion(Base):
    Date, ForeignK= "completions"

    id = Column(Integer, primary_key=True)
    habit_id = Column(Integer)
    date = Column(Date)

Base.metadata.create_all(engine)

@app.post("/api/user")
async def create_user(data: dict):
    session = SessionLocal()

    user = session.query(User).filter_by(
        telegram_id=data["telegram_id"]
    ).first()

    if not user:
        user = User(
            telegram_id=data["telegram_id"],
            points=0
        )
        session.add(user)
        session.commit()

    session.close()

    return {"points": user.points}

@app.get("/api/habits/{telegram_id}")
async def get_habits(telegram_id: str):
    session = SessionLocal()

    user = session.query(User).filter_by(
        telegram_id=telegram_id
    ).first()

    habits = session.query(Habit).filter_by(
        user_id=user.id
    ).all()

    result = []

    for h in habits:
        result.append({
            "id": h.id,
            "name": h.name,
            "streak": h.streak
        })

    session.close()

    return result

@app.post("/api/add-habit")
async def add_habit(data: dict):

    session = SessionLocal()

    user = session.query(User).filter_by(
        telegram_id=data["telegram_id"]
    ).first()

    count = session.query(Habit).filter_by(
        user_id=user.id
    ).count()

    if count >= 10:
        return {"error": "max_habits"}

    habit = Habit(
        user_id=user.id,
        name=data["name"]
    )

    session.add(habit)
    session.commit()
    session.close()

    return {"success": True}

@app.post("/api/delete-habit")
async def delete_habit(data: dict):

    session = SessionLocal()

    session.query(Completion).filter_by(
        habit_id=data["habit_id"]
    ).delete()

    session.query(Habit).filter_by(
        id=data["habit_id"]
    ).delete()

    session.commit()
    session.close()

    return {"success": True}

@app.post("/api/complete-habit")
async def complete_habit(data: dict):

    session = SessionLocal()

    today = date.today()

    done = session.query(Completion).filter_by(
        habit_id=data["habit_id"],
        date=today
    ).first()

    if done:
        return {"error": "already_done"}

    completion = Completion(
        habit_id=data["habit_id"],
        date=today
    )

    session.add(completion)

    habit = session.query(Habit).filter_by(
        id=data["habit_id"]
    ).first()

    habit.streak += 1

    user = session.query(User).filter_by(
        telegram_id=data["telegram_id"]
    ).first()

    user.points += 10

    session.commit()

    session.close()

    return {"points": user.points}

@app.get("/api/leaderboard")
async def leaderboard():

    session = SessionLocal()

    users = session.query(User).order_by(
        User.points.desc()
    ).limit(10).all()

    result = []

    rank = 1

    for u in users:
        result.append({
            "rank": rank,
            "points": u.points
        })
        rank += 1

    session.close()

    return result

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
