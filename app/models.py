from sqlalchemy import Column, Integer, String, ForeignKey, Date
from .database import Base

class User(Base):
    tablename = "users"
    id = Column(Integer, primary_key=True)
    telegram_id = Column(String, unique=True)
    points = Column(Integer, default=0)

class Habit(Base):
    tablename = "habits"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    streak = Column(Integer, default=0)

class Completion(Base):
    tablename = "completions"
    id = Column(Integer, primary_key=True)
    habit_id = Column(Integer, ForeignKey("habits.id"))
    date = Column(Date)
