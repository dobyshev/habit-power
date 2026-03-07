from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Date
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import date
import os

app = FastAPI()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, unique=True)
    points = Column(Integer, default=0)


class Habit(Base):
   rt sessionmaker= "habits"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    name = Column(String)
    streak = Column(Integer, default=0)


class Completion(Base):
    declarative_ba= "completions"

    id = Column(Integer, primary_key=True)
    habit_id = Column(Integer)
    date = Column(Date)


Base.metadata.create_all(engine)


@app.get("/api/test")
def test():
    return {"status": "ok"}


@app.post("/api/user")
def create_user(data: dict):

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

    points = user.points

    session.close()

    return {"points": points}


@app.get("/api/habits/{telegram_id}")
def get_habits(telegram_id: str):

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
def add_habit(data: dict):

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
def delete_habit(data: dict):

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
def complete_habit(data: dict):

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

    points = user.points

    session.close()

    return {"points": points}


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
