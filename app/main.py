import asyncio
import os
from fastapi import FastAPI
from .database import engine, Base
from .bot import start_bot
from .scheduler import start_scheduler

app = FastAPI()

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    start_scheduler()
    asyncio.create_task(start_bot())

@app.get("/")
async def root():
    return {"status": "Habit Power backend running"}

from fastapi.responses import FileResponse

@app.get("/app")
async def web_app():
    return FileResponse("frontend/index.html")

from fastapi import Request
from sqlalchemy import select
from .database import AsyncSessionLocal
from .models import User

@app.post("/api/user")
async def create_or_get_user(request: Request):
    data = await request.json()
    telegram_id = str(data["telegram_id"])

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one_or_none()

        if not user:
            user = User(telegram_id=telegram_id, points=0)
            session.add(user)
            await session.commit()

        return {"points": user.points}


@app.post("/api/add-points")
async def add_points(request: Request):
    data = await request.json()
    telegram_id = str(data["telegram_id"])

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.telegram_id == telegram_id))
        user = result.scalar_one()

        user.points += 10
        await session.commit()

        return {"points": user.points}

from sqlalchemy import select, desc

@app.get("/api/leaderboard")
async def leaderboard():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).order_by(desc(User.points))
        )
        users = result.scalars().all()

        leaderboard_data = []
        rank = 1
        for user in users:
            leaderboard_data.append({
                "rank": rank,
                "telegram_id": user.telegram_id,
                "points": user.points
            })
            rank += 1

        return leaderboard_data
