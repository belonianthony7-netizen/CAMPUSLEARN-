"""CampusLearn REST API: enrollment-aware university learning management system."""
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from .database import Base, engine, get_db, settings
from .models import (
    Announcement, Assignment, Course, Enrollment, Lesson, LessonProgress,
    Material, Notification, Post, Question, Quiz, QuizAttempt, Submission, User,
)
from .schemas import (
    AnnouncementInput, AnswersInput, AssignmentInput, CourseInput, CoursePatch,
    GradeInput, LessonInput, LessonPatch, Login, QuizInput, Registration, SubmissionInput,
    TextInput, TokenOut, UserOut, UserPatch,
)
from .security import current_user, hash_password, make_token, require_role, verify_password

@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.app_env == "production" and settings.jwt_secret.startswith("CHANGE_ME"):
        raise RuntimeError("JWT_SECRET doit être configuré en production")
    if settings.app_env != "production":
        Base.metadata.create_all(bind=engine)
    Path(settings.upload_directory).mkdir(parents=True, exist_ok=True)
    yield

app = FastAPI(title="CampusLearn API", version="1.0.0", description="Plateforme d'apprentissage universitaire", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
router = APIRouter(prefix="/api")
Db = Annotated[Session, Depends(get_db)]
Me = Annotated[User, Depends(current_user)]
Teacher = Annotated[User, Depends(require_role("teacher", "admin"))]
Student = Annotated[User, Depends(require_role("student"))]
Admin = Annotated[User, Depends(require_role("admin"))]


@app.get("/health")
def health():
    return {"status": "ok", "service": "campuslearn-api"}


def get_course(db: Session, course_id: str) -> Course:
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "Cours introuvable")
    return course


def can_manage(user: User, course: Course) -> bool:
    return user.role == "admin" or (user.role == "teacher" and course.teacher_id == user.id)


def check_owner(db: Session, course_id: str, user: User) -> Course:
    course = get_course(db, course_id)
    if not can_manage(user, course):
        raise HTTPException(403, "Vous ne gérez pas ce cours")
    return course


def enrolled(db: Session, course_id: str, user_id: str) -> bool:
    return db.scalar(select(Enrollment.id).where(Enrollment.course_id == course_id, Enrollment.user_id == user_id)) is not None


def check_access(db: Session, course_id: str, user: User) -> Course:
    course = get_course(db, course_id)
    if not can_manage(user, course) and not (course.published and enrolled(db, course_id, user.id)):
        raise HTTPException(403, "Inscrivez-vous au cours pour accéder à son contenu")
    return course


def user_data(user: User) -> dict:
    return UserOut.model_validate(user).model_dump()


def course_data(db: Session, course: Course, user: User) -> dict:
    lesson_count = db.scalar(select(func.count(Lesson.id)).where(Lesson.course_id == course.id)) or 0
    enrollment_count = db.scalar(select(func.count(Enrollment.id)).where(Enrollment.course_id == course.id)) or 0
    my_enrollment = enrolled(db, course.id, user.id)
    progress = 0
    if my_enrollment and lesson_count:
        done = db.scalar(
            select(func.count(LessonProgress.id))
            .join(Lesson, LessonProgress.lesson_id == Lesson.id)
            .where(Lesson.course_id == course.id, LessonProgress.student_id == user.id)
        ) or 0
        progress = round(done * 100 / lesson_count)
    return {
        "id": course.id, "title": course.title, "description": course.description,
        "category": course.category, "level": course.level, "color": course.color, "cover_image": course.cover_image,
        "duration_hours": course.duration_hours, "published": course.published,
        "teacher_id": course.teacher_id, "teacher_name": course.teacher.full_name,
        "lesson_count": lesson_count, "student_count": enrollment_count,
        "is_enrolled": my_enrollment, "progress": progress,
        "created_at": course.created_at,
    }


def quiz_data(quiz: Quiz, student_view: bool = True) -> dict:
    result = {"id": quiz.id, "course_id": quiz.course_id, "title": quiz.title,
              "duration_minutes": quiz.duration_minutes, "question_count": len(quiz.questions), "questions": []}
    for q in quiz.questions:
        data = {"id": q.id, "prompt": q.prompt, "options": q.options}
        if not student_view:
            data["correct_index"] = q.correct_index
        result["questions"].append(data)
    return result


def notify(db: Session, user_id: str, title: str, message: str):
    db.add(Notification(user_id=user_id, title=title, message=message))


@router.post("/auth/register", response_model=TokenOut, status_code=201)
def register(payload: Registration, db: Db):
    email = payload.email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(422, "Adresse e-mail invalide")
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Un compte existe déjà avec cet e-mail")
    user = User(full_name=payload.full_name.strip(), email=email, password_hash=hash_password(payload.password), role="student")
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": make_token(user), "user": user_data(user)}


@router.post("/auth/login", response_model=TokenOut)
def login(payload: Login, db: Db):
    user = db.scalar(select(User).where(User.email == payload.email.strip().lower()))
    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        raise HTTPException(401, "Identifiants incorrects")
    return {"access_token": make_token(user), "user": user_data(user)}


@router.get("/auth/me", response_model=UserOut)
def me(user: Me):
    return user_data(user)


@router.get("/courses")
def list_courses(db: Db, user: Me, q: str = "", category: str = "", mine: bool = False):
    statement = select(Course).join(User, Course.teacher_id == User.id)
    if mine:
        if user.role == "student":
            statement = statement.join(Enrollment, Enrollment.course_id == Course.id).where(Enrollment.user_id == user.id)
        elif user.role == "teacher":
            statement = statement.where(Course.teacher_id == user.id)
    elif user.role == "teacher":
        statement = statement.where(or_(Course.published.is_(True), Course.teacher_id == user.id))
    elif user.role != "admin":
        statement = statement.where(Course.published.is_(True))
    if q.strip():
        statement = statement.where(or_(Course.title.ilike(f"%{q.strip()}%"), Course.description.ilike(f"%{q.strip()}%")))
    if category.strip():
        statement = statement.where(Course.category == category.strip())
    courses = db.scalars(statement.order_by(Course.created_at.desc()).limit(250)).all()
    return [course_data(db, course, user) for course in courses]


@router.post("/courses", status_code=201)
def create_course(payload: CourseInput, db: Db, user: Teacher):
    course = Course(**payload.model_dump(), teacher_id=user.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course_data(db, course, user)


@router.get("/courses/{course_id}")
def course_details(course_id: str, db: Db, user: Me):
    course = get_course(db, course_id)
    if not course.published and not can_manage(user, course):
        raise HTTPException(404, "Cours introuvable")
    return course_data(db, course, user)


@router.patch("/courses/{course_id}")
def update_course(course_id: str, payload: CoursePatch, db: Db, user: Teacher):
    course = check_owner(db, course_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(course, field, value)
    db.commit()
    return course_data(db, course, user)


@router.post("/courses/{course_id}/enroll", status_code=201)
def enroll_course(course_id: str, db: Db, user: Student):
    course = get_course(db, course_id)
    if not course.published:
        raise HTTPException(404, "Cours indisponible")
    if enrolled(db, course_id, user.id):
        raise HTTPException(409, "Vous êtes déjà inscrit")
    db.add(Enrollment(user_id=user.id, course_id=course_id))
    notify(db, user.id, "Inscription confirmée", f"Vous êtes inscrit au cours {course.title}.")
    db.commit()
    return {"message": "Inscription effectuée"}


@router.get("/courses/{course_id}/lessons")
def lessons(course_id: str, db: Db, user: Me):
    check_access(db, course_id, user)
    items = db.scalars(select(Lesson).where(Lesson.course_id == course_id).order_by(Lesson.position, Lesson.title)).all()
    completed = set(db.scalars(select(LessonProgress.lesson_id).where(LessonProgress.student_id == user.id)).all())
    return [{"id": l.id, "course_id": l.course_id, "title": l.title, "content": l.content,
             "position": l.position, "video_url": l.video_url, "material_url": l.material_url,
             "completed": l.id in completed} for l in items]


@router.post("/courses/{course_id}/lessons", status_code=201)
def add_lesson(course_id: str, payload: LessonInput, db: Db, user: Teacher):
    check_owner(db, course_id, user)
    lesson = Lesson(course_id=course_id, **payload.model_dump())
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return {"id": lesson.id, "title": lesson.title}


@router.patch("/lessons/{lesson_id}")
def update_lesson(lesson_id: str, payload: LessonPatch, db: Db, user: Teacher):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None:
        raise HTTPException(404, "Leçon introuvable")
    check_owner(db, lesson.course_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in ("title", "position", "content") and value is None:
            raise HTTPException(422, f"Le champ {field} ne peut pas être vide")
        setattr(lesson, field, value)
    db.commit()
    db.refresh(lesson)
    return {"id": lesson.id, "title": lesson.title, "video_url": lesson.video_url}


@router.patch("/lessons/{lesson_id}/complete")
def complete_lesson(lesson_id: str, db: Db, user: Student):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Leçon introuvable")
    check_access(db, lesson.course_id, user)
    existing = db.scalar(select(LessonProgress.id).where(LessonProgress.lesson_id == lesson_id, LessonProgress.student_id == user.id))
    if not existing:
        db.add(LessonProgress(lesson_id=lesson_id, student_id=user.id))
        db.commit()
    return {"completed": True}


@router.post("/courses/{course_id}/files", status_code=201)
async def upload_material(course_id: str, db: Db, user: Teacher, file: UploadFile = File(...)):
    check_owner(db, course_id, user)
    allowed = {"application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
    if file.content_type not in allowed:
        raise HTTPException(415, "Supports acceptés : PDF, PNG, JPG et WebP")
    size_limit = 20 * 1024 * 1024
    safe_name = Path(file.filename or "document").name[:200]
    file_id = secrets.token_hex(18)
    folder = Path(settings.upload_directory)
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / (file_id + allowed[file.content_type])
    total = 0
    try:
        with dest.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > size_limit:
                    raise HTTPException(413, "Fichier limité à 20 Mo")
                output.write(chunk)
        with dest.open("rb") as content:
            signature = content.read(12)
        if file.content_type == "application/pdf" and not signature.startswith(b"%PDF-"):
            raise HTTPException(415, "Le fichier PDF est invalide")
        if file.content_type == "image/png" and not signature.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(415, "Le fichier PNG est invalide")
        if file.content_type == "image/jpeg" and not signature.startswith(b"\xff\xd8\xff"):
            raise HTTPException(415, "Le fichier JPEG est invalide")
        if file.content_type == "image/webp" and not (signature.startswith(b"RIFF") and signature[8:12] == b"WEBP"):
            raise HTTPException(415, "Le fichier WebP est invalide")
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    stored = Material(id=file_id, course_id=course_id, uploader_id=user.id,
                      original_name=safe_name, content_type=file.content_type,
                      storage_path=str(dest), size_bytes=total)
    db.add(stored)
    db.commit()
    return {"id": stored.id, "name": safe_name, "size": total, "url": f"/api/files/{file_id}"}


@router.get("/files/{file_id}")
def download_material(file_id: str, db: Db, user: Me):
    file = db.get(Material, file_id)
    if not file:
        raise HTTPException(404, "Fichier introuvable")
    check_access(db, file.course_id, user)
    dest = Path(file.storage_path)
    if not dest.is_file():
        raise HTTPException(404, "Fichier supprimé du stockage")
    return FileResponse(dest, media_type=file.content_type, filename=file.original_name,
                        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/courses/{course_id}/quizzes")
def list_quizzes(course_id: str, db: Db, user: Me):
    course = check_access(db, course_id, user)
    managing = can_manage(user, course)
    quizzes = db.scalars(select(Quiz).where(Quiz.course_id == course_id)).all()
    return [quiz_data(quiz, not managing) for quiz in quizzes]


@router.post("/courses/{course_id}/quizzes", status_code=201)
def add_quiz(course_id: str, payload: QuizInput, db: Db, user: Teacher):
    check_owner(db, course_id, user)
    for q in payload.questions:
        if q.correct_index >= len(q.options):
            raise HTTPException(422, "La réponse correcte doit correspondre à une option")
    quiz = Quiz(course_id=course_id, title=payload.title, duration_minutes=payload.duration_minutes)
    quiz.questions = [Question(**q.model_dump()) for q in payload.questions]
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz_data(quiz, False)


@router.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, payload: AnswersInput, db: Db, user: Student):
    quiz = db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(404, "Quiz introuvable")
    check_access(db, quiz.course_id, user)
    if not quiz.questions:
        raise HTTPException(409, "Ce quiz ne contient aucune question")
    if set(payload.answers) != {q.id for q in quiz.questions} or any(
        not 0 <= payload.answers[q.id] < len(q.options) for q in quiz.questions
    ):
        raise HTTPException(422, "Répondez à chaque question avec une option valide")
    score = sum(1 for q in quiz.questions if payload.answers.get(q.id) == q.correct_index)
    attempt = QuizAttempt(quiz_id=quiz_id, student_id=user.id, answers=payload.answers, score=score, total=len(quiz.questions))
    db.add(attempt)
    notify(db, get_course(db, quiz.course_id).teacher_id, "Quiz remis",
           f"{user.full_name} a terminé « {quiz.title} » : {score}/{len(quiz.questions)}.")
    db.commit()
    return {"id": attempt.id, "score": score, "total": len(quiz.questions), "percentage": round(score / len(quiz.questions) * 100)}


@router.get("/courses/{course_id}/assignments")
def assignments(course_id: str, db: Db, user: Me):
    check_access(db, course_id, user)
    items = db.scalars(select(Assignment).where(Assignment.course_id == course_id).order_by(Assignment.due_at)).all()
    result = []
    for a in items:
        sub = db.scalar(select(Submission).where(Submission.assignment_id == a.id, Submission.student_id == user.id)) if user.role == "student" else None
        result.append({"id": a.id, "course_id": a.course_id, "title": a.title, "description": a.description,
                       "due_at": a.due_at, "max_score": a.max_score,
                       "submission": {"id": sub.id, "content": sub.content, "score": sub.score, "feedback": sub.feedback} if sub else None})
    return result


@router.post("/courses/{course_id}/assignments", status_code=201)
def add_assignment(course_id: str, payload: AssignmentInput, db: Db, user: Teacher):
    check_owner(db, course_id, user)
    assignment = Assignment(course_id=course_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return {"id": assignment.id, "title": assignment.title}


@router.post("/assignments/{assignment_id}/submit", status_code=201)
def submit_assignment(assignment_id: str, payload: SubmissionInput, db: Db, user: Student):
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Devoir introuvable")
    check_access(db, assignment.course_id, user)
    if assignment.due_at:
        deadline = assignment.due_at.replace(tzinfo=timezone.utc) if assignment.due_at.tzinfo is None else assignment.due_at
        if deadline < datetime.now(timezone.utc):
            raise HTTPException(400, "La date de remise est dépassée")
    existing = db.scalar(select(Submission).where(Submission.assignment_id == assignment_id, Submission.student_id == user.id))
    if existing:
        if existing.score is not None:
            raise HTTPException(409, "Devoir déjà corrigé")
        existing.content = payload.content
        existing.submitted_at = datetime.now(timezone.utc)
    else:
        existing = Submission(assignment_id=assignment_id, student_id=user.id, content=payload.content)
        db.add(existing)
    notify(db, get_course(db, assignment.course_id).teacher_id, "Copie à corriger",
           f"{user.full_name} a remis « {assignment.title} ».")
    db.commit()
    return {"message": "Devoir remis"}


@router.get("/assignments/{assignment_id}/submissions")
def submissions(assignment_id: str, db: Db, user: Teacher):
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(404, "Devoir introuvable")
    check_owner(db, assignment.course_id, user)
    result = db.execute(select(Submission, User).join(User, Submission.student_id == User.id).where(Submission.assignment_id == assignment_id)).all()
    return [{"id": sub.id, "student_name": student.full_name, "student_id": student.id,
             "content": sub.content, "score": sub.score, "feedback": sub.feedback,
             "submitted_at": sub.submitted_at} for sub, student in result]


@router.patch("/submissions/{submission_id}/grade")
def grade_submission(submission_id: str, payload: GradeInput, db: Db, user: Teacher):
    sub = db.get(Submission, submission_id)
    if not sub:
        raise HTTPException(404, "Copie introuvable")
    assignment = db.get(Assignment, sub.assignment_id)
    check_owner(db, assignment.course_id, user)
    if payload.score > assignment.max_score:
        raise HTTPException(422, "Note supérieure au maximum du devoir")
    sub.score, sub.feedback = payload.score, payload.feedback
    notify(db, sub.student_id, "Devoir corrigé", f"Votre devoir « {assignment.title} » a été corrigé.")
    db.commit()
    return {"message": "Note enregistrée"}


@router.get("/courses/{course_id}/posts")
def list_posts(course_id: str, db: Db, user: Me):
    check_access(db, course_id, user)
    items = db.scalars(select(Post).where(Post.course_id == course_id).order_by(Post.created_at.desc()).limit(150)).all()
    return [{"id": p.id, "content": p.content, "author": p.author.full_name, "author_role": p.author.role,
             "created_at": p.created_at} for p in items]


@router.post("/courses/{course_id}/posts", status_code=201)
def add_post(course_id: str, payload: TextInput, db: Db, user: Me):
    check_access(db, course_id, user)
    post = Post(course_id=course_id, author_id=user.id, content=payload.content)
    db.add(post)
    db.commit()
    return {"id": post.id}


@router.get("/courses/{course_id}/announcements")
def list_announcements(course_id: str, db: Db, user: Me):
    check_access(db, course_id, user)
    items = db.scalars(select(Announcement).where(Announcement.course_id == course_id).order_by(Announcement.created_at.desc())).all()
    return [{"id": a.id, "title": a.title, "body": a.body, "created_at": a.created_at} for a in items]


@router.post("/courses/{course_id}/announcements", status_code=201)
def add_announcement(course_id: str, payload: AnnouncementInput, db: Db, user: Teacher):
    check_owner(db, course_id, user)
    announcement = Announcement(course_id=course_id, author_id=user.id, **payload.model_dump())
    db.add(announcement)
    for student_id in db.scalars(select(Enrollment.user_id).where(Enrollment.course_id == course_id)):
        notify(db, student_id, "Nouvelle annonce", payload.title)
    db.commit()
    return {"id": announcement.id}


@router.get("/notifications")
def notifications(db: Db, user: Me):
    items = db.scalars(select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(100)).all()
    return [{"id": n.id, "title": n.title, "message": n.message, "read": n.read, "created_at": n.created_at} for n in items]


@router.patch("/notifications/{notification_id}/read")
def read_notification(notification_id: str, db: Db, user: Me):
    note = db.get(Notification, notification_id)
    if not note or note.user_id != user.id:
        raise HTTPException(404, "Notification introuvable")
    note.read = True
    db.commit()
    return {"read": True}


@router.get("/dashboard")
def dashboard(db: Db, user: Me):
    if user.role == "admin":
        return {"role": "admin", "users": db.scalar(select(func.count(User.id))) or 0,
                "courses": db.scalar(select(func.count(Course.id))) or 0,
                "students": db.scalar(select(func.count(User.id)).where(User.role == "student")) or 0,
                "enrollments": db.scalar(select(func.count(Enrollment.id))) or 0,
                "recent_courses": [course_data(db, c, user) for c in db.scalars(select(Course).order_by(Course.created_at.desc()).limit(5))]}
    if user.role == "teacher":
        my_courses = db.scalars(select(Course).where(Course.teacher_id == user.id).order_by(Course.created_at.desc())).all()
        return {"role": "teacher", "courses": len(my_courses),
                "students": sum(db.scalar(select(func.count(Enrollment.id)).where(Enrollment.course_id == c.id)) or 0 for c in my_courses),
                "assignments": sum(db.scalar(select(func.count(Assignment.id)).where(Assignment.course_id == c.id)) or 0 for c in my_courses),
                "pending_submissions": db.scalar(select(func.count(Submission.id)).join(Assignment, Submission.assignment_id == Assignment.id)
                    .join(Course, Assignment.course_id == Course.id).where(Course.teacher_id == user.id, Submission.score.is_(None))) or 0,
                "quiz_attempts": db.scalar(select(func.count(QuizAttempt.id)).join(Quiz, QuizAttempt.quiz_id == Quiz.id)
                    .join(Course, Quiz.course_id == Course.id).where(Course.teacher_id == user.id)) or 0,
                "recent_courses": [course_data(db, c, user) for c in my_courses[:6]]}
    my_courses = db.scalars(select(Course).join(Enrollment, Enrollment.course_id == Course.id).where(Enrollment.user_id == user.id)).all()
    attempts = db.scalars(select(QuizAttempt).where(QuizAttempt.student_id == user.id)).all()
    return {"role": "student", "courses": len(my_courses), "completed": sum(course_data(db, c, user)["progress"] == 100 for c in my_courses),
            "quizzes": len(attempts), "average_score": round(sum(a.score / a.total * 100 for a in attempts if a.total) / len(attempts)) if attempts else 0,
            "recent_courses": [course_data(db, c, user) for c in my_courses[:6]]}


@router.get("/teacher/courses/{course_id}/students")
def course_students(course_id: str, db: Db, user: Teacher):
    check_owner(db, course_id, user)
    rows = db.execute(select(User, Enrollment).join(Enrollment, User.id == Enrollment.user_id).where(Enrollment.course_id == course_id)).all()
    total_lessons = db.scalar(select(func.count(Lesson.id)).where(Lesson.course_id == course_id)) or 0
    completed = dict(db.execute(select(LessonProgress.student_id, func.count(LessonProgress.id))
        .join(Lesson, LessonProgress.lesson_id == Lesson.id).where(Lesson.course_id == course_id).group_by(LessonProgress.student_id)).all())
    attempts = {row[0]: row[1:] for row in db.execute(select(QuizAttempt.student_id, func.count(QuizAttempt.id),
        func.avg(QuizAttempt.score * 100.0 / func.nullif(QuizAttempt.total, 0)))
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id).where(Quiz.course_id == course_id).group_by(QuizAttempt.student_id)).all()}
    copies = {row[0]: row[1:] for row in db.execute(select(Submission.student_id, func.count(Submission.id), func.count(Submission.score))
        .join(Assignment, Submission.assignment_id == Assignment.id).where(Assignment.course_id == course_id).group_by(Submission.student_id)).all()}
    return [{"id": student.id, "name": student.full_name, "email": student.email,
             "registered_at": membership.created_at,
             "progress": round(completed.get(student.id, 0) * 100 / total_lessons) if total_lessons else 0,
             "quiz_attempts": attempts.get(student.id, (0, None))[0],
             "quiz_average": round(attempts[student.id][1]) if student.id in attempts and attempts[student.id][1] is not None else None,
             "submissions": copies.get(student.id, (0, 0))[0],
             "graded_submissions": copies.get(student.id, (0, 0))[1]} for student, membership in rows]


@router.get("/teacher/courses/{course_id}/quiz-attempts")
def course_quiz_attempts(course_id: str, db: Db, user: Teacher):
    check_owner(db, course_id, user)
    rows = db.execute(select(QuizAttempt, Quiz, User).join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(User, QuizAttempt.student_id == User.id).where(Quiz.course_id == course_id)
        .order_by(QuizAttempt.submitted_at.desc(), QuizAttempt.id).limit(500)).all()
    return [{"id": attempt.id, "quiz_id": quiz.id, "quiz_title": quiz.title,
             "student_id": student.id, "student_name": student.full_name,
             "score": attempt.score, "total": attempt.total,
             "percentage": round(attempt.score * 100 / attempt.total) if attempt.total else 0,
             "submitted_at": attempt.submitted_at} for attempt, quiz, student in rows]


@router.get("/admin/users")
def admin_users(db: Db, user: Admin, q: str = ""):
    statement = select(User)
    if q:
        statement = statement.where(or_(User.full_name.ilike(f"%{q}%"), User.email.ilike(f"%{q}%")))
    return [user_data(u) for u in db.scalars(statement.order_by(User.created_at.desc()).limit(500))]


@router.patch("/admin/users/{user_id}")
def update_user(user_id: str, payload: UserPatch, db: Db, admin: Admin):
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if payload.role is not None and payload.role not in {"student", "teacher", "admin"}:
        raise HTTPException(422, "Rôle invalide")
    if target.id == admin.id and (payload.is_active is False or (payload.role and payload.role != "admin")):
        raise HTTPException(400, "Vous ne pouvez pas retirer votre propre accès administrateur")
    if payload.role is not None:
        target.role = payload.role
    if payload.is_active is not None:
        target.is_active = payload.is_active
    db.commit()
    return user_data(target)


app.include_router(router)
