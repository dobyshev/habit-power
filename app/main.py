from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, Integer, String, ForeignKey, Date, select, delete
from datetime import date

DATABASE_URL = "sqlite+aiosqlite:///./habits.db"

engine = create_async_engine(DATABASE_URL, echo=False)

async_session = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()

app = FastAPI()

# ---------------- MODELS ----------------

class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    name = Column(String)
    streak = Column(Integer, default=0)
    points = Column(Integer, default=0)


class Completion(Base):
    __tablename__ = "completions"

    id = Column(Integer, primary_key=True)
    habit_id = Column(Integer, ForeignKey("habits.id"))
    date = Column(Date)


# ---------------- CREATE TABLES ----------------

@app.on_event("startup")
async def startup():

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ---------------- USER ----------------

@app.post("/api/user")
async def get_user(data: dict):

    telegram_id = data.get("telegram_id")

    async with async_session() as session:

        res = await session.execute(
            select(Habit).where(Habit.user_id == telegram_id)
        )

        habits = res.scalars().all()

        total_points = sum(h.points for h in habits)

        return {"points": total_points}


# ---------------- ADD HABIT ----------------

@app.post("/api/add-habit")
async def add_habit(data: dict):

    telegram_id = data.get("telegram_id")
    name = data.get("name")

    async with async_session() as session:

        res = await session.execute(
            select(Habit).where(Habit.user_id == telegram_id)
        )

        habits = res.scalars().all()

        if len(habits) >= 10:
            return {"error": "limit"}

        habit = Habit(
            user_id=telegram_id,
            name=name,
            streak=0,
            points=0
        )

        session.add(habit)

        await session.commit()

    return {"status": "added"}


# ---------------- GET HABITS ----------------

@app.get("/api/habits/{telegram_id}")
async def get_habits(telegram_id: int):

    async with async_session() as session:

        res = await session.execute(
            select(Habit).where(Habit.user_id == telegram_id)
        )

        habits = res.scalars().all()

        return [
            {
                "id": h.id,
                "name": h.name,
                "streak": h.streak,
                "points": h.points
            }
            for h in habits
        ]


# ---------------- COMPLETE HABIT ----------------

@app.post("/api/complete-habit")
async def complete_habit(data: dict):

    habit_id = data.get("habit_id")

    today = date.today()

    async with async_session() as session:

        res = await session.execute(
            select(Completion).where(
                Completion.habit_id == habit_id,
                Completion.date == today
            )
        )

        existing = res.scalar()

        if existing:
            return {"error": "already_completed"}

        completion = Completion(
            habit_id=habit_id,
            date=today
        )

        session.add(completion)

        habit = await session.get(Habit, habit_id)

        habit.streak += 1
        habit.points += 10

        await session.commit()

        return {"points": habit.points}


# ---------------- DELETE HABIT ----------------

@app.post("/api/delete-habit")
async def delete_habit(data: dict):

    habit_id = data.get("habit_id")

    async with async_session() as session:

        await session.execute(
            delete(Completion).where(Completion.habit_id == habit_id)
        )

        await session.execute(
            delete(Habit).where(Habit.id == habit_id)
        )

        return {"status": "deleted"}


# ---------------- LEADERBOARD ----------------

@app.get("/api/leaderboard")
async def leaderboard():

    async with async_session() as session:

        res = await session.execute(select(Habit))

        habits = res.scalars().all()

        users = {}

        for h in habits:
            users[h.user_id] = users.get(h.user_id, 0) + h.points

        ranking = sorted(users.items(), key=lambda x: x[1], reverse=True)

        result = []

        for i, (user, points) in enumerate(ranking):

            result.append({
                "rank": i + 1,
                "points": points
            })

        return result


# ---------------- FRONTEND ----------------

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

        await session.commit()
