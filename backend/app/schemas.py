from .illustrations import cover_allowed
from .youtube import canonical_youtube_url
from datetime import datetime
import re
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, field_validator


def valid_material_url(value: str | None) -> str | None:
    if not value:
        return value
    if re.fullmatch(r"/api/files/[0-9a-f]{36}", value):
        return value
    parsed = urlparse(value)
    if parsed.scheme == "https" and parsed.netloc:
        return value
    raise ValueError("Utilisez une URL HTTPS ou un fichier interne de la plateforme")

class Model(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class Registration(Model):
    full_name: str = Field(min_length=2, max_length=160)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)

class Login(Model):
    email: str
    password: str

class UserOut(Model):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool

class TokenOut(Model):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class CourseInput(Model):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=20000)
    category: str = Field(default="Général", max_length=90)
    level: str = Field(default="Tous niveaux", max_length=60)
    color: str = Field(default="#705CF6", pattern=r"^#[0-9a-fA-F]{6}$")
    cover_image: str = Field(default="auto", max_length=40)
    duration_hours: int = Field(default=1, ge=1, le=1000)
    published: bool = False

    @field_validator("cover_image")
    @classmethod
    def valid_cover(cls, value: str) -> str:
        if not cover_allowed(value):
            raise ValueError("Cette illustration n’appartient pas à la bibliothèque CampusLearn")
        return value

class CoursePatch(Model):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = Field(default=None, max_length=20000)
    category: str | None = None
    level: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    cover_image: str | None = Field(default=None, max_length=40)
    duration_hours: int | None = Field(default=None, ge=1)
    published: bool | None = None

    @field_validator("cover_image")
    @classmethod
    def valid_cover(cls, value: str | None) -> str | None:
        if value is not None and not cover_allowed(value):
            raise ValueError("Cette illustration n’appartient pas à la bibliothèque CampusLearn")
        return value

class LessonInput(Model):
    title: str = Field(min_length=3, max_length=200)
    content: str = Field(default="", max_length=100000)
    video_url: str | None = Field(default=None, max_length=1000)
    material_url: str | None = Field(default=None, max_length=1000)
    position: int = Field(default=1, ge=1)

    @field_validator("video_url")
    @classmethod
    def validate_video_url(cls, value: str | None) -> str | None:
        return canonical_youtube_url(value)

    @field_validator("material_url")
    @classmethod
    def validate_material_url(cls, url: str | None) -> str | None:
        return valid_material_url(url)


class LessonPatch(Model):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    content: str | None = Field(default=None, max_length=100000)
    video_url: str | None = Field(default=None, max_length=1000)
    material_url: str | None = Field(default=None, max_length=1000)
    position: int | None = Field(default=None, ge=1)

    @field_validator("video_url")
    @classmethod
    def validate_video_url(cls, value: str | None) -> str | None:
        return canonical_youtube_url(value)

    @field_validator("material_url")
    @classmethod
    def validate_material_url(cls, value: str | None) -> str | None:
        return valid_material_url(value)

class QuestionInput(Model):
    prompt: str = Field(min_length=3)
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0, le=5)

class QuizInput(Model):
    title: str = Field(min_length=3)
    duration_minutes: int = Field(default=15, ge=1, le=240)
    questions: list[QuestionInput] = Field(min_length=1)

class AnswersInput(Model):
    answers: dict[str, int]

class AssignmentInput(Model):
    title: str = Field(min_length=3)
    description: str = ""
    due_at: datetime | None = None
    max_score: int = Field(default=20, ge=1, le=100)

class SubmissionInput(Model):
    content: str = Field(min_length=1, max_length=20000)

class GradeInput(Model):
    score: float = Field(ge=0)
    feedback: str = Field(default="", max_length=20000)

class TextInput(Model):
    content: str = Field(min_length=1, max_length=5000)

class AnnouncementInput(Model):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=10000)

class UserPatch(Model):
    role: str | None = None
    is_active: bool | None = None
