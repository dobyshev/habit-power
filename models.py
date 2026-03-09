from sqlalchemy import Column, Integer, String, Date, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from database import Base
from datetime import date


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True)
    points = Column(Integer, default=0)

    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    streak = Column(Integer, default=0)
    emoji = Column(String, default="😀")  # 👈 ДОБАВЛЕНО поле для эмодзи

    user = relationship("User", back_populates="habits")
    completions = relationship(
        "Completion", back_populates="habit", cascade="all, delete-orphan"
    )


class Completion(Base):
    __tablename__ = "completions"

    id = Column(Integer, primary_key=True, index=True)
    habit_id = Column(Integer, ForeignKey("habits.id"))
    date = Column(Date, default=date.today)

    habit = relationship("Habit", back_populates="completions")
