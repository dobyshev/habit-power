from sqlalchemy import Column, Integer, String, Date, ForeignKey, BigInteger, DateTime
from sqlalchemy.orm import relationship
from database import Base
from datetime import date, datetime


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True)
    points = Column(Integer, default=0)

    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
    profile = relationship(
        "UserProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    streak = Column(Integer, default=0)
    emoji = Column(String, default="😀")

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


# 👇 НОВЫЕ МОДЕЛИ ДЛЯ ПРОФИЛЯ
class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    username = Column(String(50), unique=True, nullable=True)
    emoji = Column(String(10), nullable=True, default="😀")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")


class UsernameHistory(Base):
    __tablename__ = "username_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    telegram_id = Column(BigInteger, index=True)
    username = Column(String(50))
    changed_at = Column(DateTime, default=datetime.utcnow)
