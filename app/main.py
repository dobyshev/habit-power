from fastapi import FastAPI, Request
from sqlalchemy import select, desc
from datetime import date

from .database import AsyncSessionLocal
from .models import User, Habit, Completion

app = FastAPI()

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app.mount("/frontend", StaticFiles(directory="app/frontend"), name="frontend")


@app.get("/app")
async def web_app():
    return FileResponse("app/frontend/index.html")

@app.get("/")
async def root():
    return {"status": "ok"}


@app.post("/api/add-points")
async def add_points(request: Request):
    data = await request.json()
    telegram_id = str(data["telegram_id"])

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        user = result.scalar_one()

        user.points += 10
        await session.commit()

    return {"points": user.points}


@app.get("/api/leaderboard")
async def leaderboard():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).order_by(desc(User.points))
        )

        users = result.scalars().all()

        data = []
        rank = 1

        for user in users:
            data.append({
                "rank": rank,
                "telegram_id": user.telegram_id,
                "points": user.points
            })
            rank += 1

    return data


@app.post("/api/add-habit")
async def add_habit(request: Request):
    data = await request.json()

    telegram_id = str(data["telegram_id"])
    name = data["name"]

    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )

        user = result.scalar_one()

        result = await session.execute(
            select(Habit).where(Habit.user_id == user.id)
        )

        habits = result.scalars().all()

        if len(habits) >= 10:
            return {"error": "limit_reached"}

        habit = Habit(
            user_id=user.id,
            name=name,
            streak=0
        )

        session.add(habit)
        await session.commit()

    return {"status": "ok"}


@app.get("/api/habits/{telegram_id}")
async def get_habits(telegram_id: str):

    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(User).where(User.telegram_id == telegram_id)
        )

        user = result.scalar_one()

        result = await session.execute(
            select(Habit).where(Habit.user_id == user.id)
        )

        habits = result.scalars().all()

        return [
            {
                "id": h.id,
                "name": h.name,
                "streak": h.streak
            }
            for h in habits
        ]


@app.post("/api/complete-habit")
async def complete_habit(request: Request):

    data = await request.json()
    habit_id = data["habit_id"]

    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(Habit).where(Habit.id == habit_id)
        )

        habit = result.scalar_one()

        today = date.today()

        result = await session.execute(
            select(Completion).where(
                Completion.habit_id == habit_id,
                Completion.date == today
            )
        )

        already_done = result.scalar_one_or_none()

        if already_done:
            return {"error": "already_completed"}

        completion = Completion(
            habit_id=habit_id,
            date=today
        )

        session.add(completion)

        habit.streak += 1

        result = await session.execute(
            select(User).where(User.id == habit.user_id)
        )

        user = result.scalar_one()

        user.points += 10

        await session.commit()

    return {
        "points": user.points,
        "streak": habit.streak
    }


@app.post("/api/delete-habit")
async def delete_habit(request: Request):

    data = await request.json()
    habit_id = data["habit_id"]

    async with AsyncSessionLocal() as session:

        result = await session.execute(
            select(Habit).where(Habit.id == habit_id)
        )

        habit = result.scalar_one()

        await session.delete(habit)
        await session.commit()

    return {"status": "ok"}
