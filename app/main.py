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
