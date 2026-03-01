import os
from aiogram import Bot, Dispatcher
from aiogram.types import Message
from aiogram.filters import CommandStart
from aiogram.utils.keyboard import InlineKeyboardBuilder

TOKEN = os.getenv("BOT_TOKEN")

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def start_handler(message: Message):
    kb = InlineKeyboardBuilder()
    kb.button(
        text="🚀 Открыть Habit Power",
        web_app={"url": os.getenv("WEBAPP_URL")}
    )
    await message.answer("Открой мини-приложение:", reply_markup=kb.as_markup())

async def start_bot():
    await dp.start_polling(bot)
