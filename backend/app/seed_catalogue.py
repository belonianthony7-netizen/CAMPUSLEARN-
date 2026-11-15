"""Importer les parcours vidéo francophones, sans remplacer les données existantes.

Usage local : python -m app.seed_catalogue
Les identifiants stables rendent les réexécutions sans doublons. Les vidéos
restent hébergées par leurs auteurs ; seules les références sont enregistrées.
"""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from .database import SessionLocal, settings
from .models import Announcement, Assignment, Course, Enrollment, Lesson, Notification, Question, Quiz, User
from .schemas import AssignmentInput, CourseInput, LessonInput, QuizInput
from .security import hash_password

DATA_DIRECTORY = Path(__file__).parent
TEACHER_EMAIL = "enseignant@campuslearn.test"


def stable_id(key: str) -> str:
    return str(uuid5(NAMESPACE_URL, f"campuslearn:catalogue-fr-v1:{key}"))


def load_catalogue() -> list[dict]:
    sources = {s["video_id"]: s for s in json.loads((DATA_DIRECTORY / "catalogue_sources.json").read_text(encoding="utf-8"))}
    catalogue = json.loads((DATA_DIRECTORY / "catalogue_fr.json").read_text(encoding="utf-8"))
    for course in catalogue:
        CourseInput.model_validate({k: v for k, v in course.items() if k in CourseInput.model_fields})
        QuizInput.model_validate(course["quiz"])
        for question in course["quiz"]["questions"]:
            if question["correct_index"] >= len(question["options"]):
                raise ValueError("Indice de correction invalide")
        for lesson in course["lessons"]:
            source = sources[lesson["video_id"]]
            if source.get("status") != "OK" and not source.get("embed_available"):
                raise ValueError(f"Source vidéo non vérifiée : {lesson['video_id']}")
            lesson["video_url"] = source["url"]
            lesson["content"] += (
                f"\n\nRESSOURCE VIDÉO\n{source['title']}\nAuteur : {source['author']}"
                f"\n{source['url']}\nLien vérifié le {source['checked_on']}."
                "\nLes notes, exercices et évaluations sont des compléments originaux CampusLearn."
            )
            LessonInput.model_validate(lesson)
        for assignment in course["assignments"]:
            AssignmentInput.model_validate(assignment)
    return catalogue


def populate_catalogue(db: Session, teacher_email: str = TEACHER_EMAIL) -> dict:
    catalogue = load_catalogue()  # Valider toutes les données avant la première écriture.
    teacher = db.scalar(select(User).where(User.email == teacher_email))
    if teacher is None:
        if teacher_email != TEACHER_EMAIL:
            raise ValueError("Le compte enseignant demandé n'existe pas")
        teacher = User(full_name="Marie Kabeya", email=teacher_email, role="teacher",
                       password_hash=hash_password("Enseignant2026!"))
        db.add(teacher)
        db.flush()
    if teacher.role != "teacher" or not teacher.is_active:
        raise ValueError("Le compte doit être un enseignant actif ; aucun rôle ni mot de passe n'a été modifié")
    student = db.scalar(select(User).where(User.email == "etudiant@campuslearn.test", User.role == "student"))
    counts = dict.fromkeys(["courses", "lessons", "quizzes", "questions", "assignments", "announcements", "enrollments"], 0)
    for data in catalogue:
        key = data["slug"]
        course_id = stable_id(key)
        course = db.get(Course, course_id)
        if course is None:
            fields = {k: v for k, v in data.items() if k in CourseInput.model_fields}
            course = Course(id=course_id, teacher_id=teacher.id, published=True, **fields)
            db.add(course)
            db.flush()
            counts["courses"] += 1
        elif course.teacher_id != teacher.id:
            raise ValueError("Un parcours existe déjà avec un autre propriétaire")
        for position, lesson in enumerate(data["lessons"], start=1):
            lesson_id = stable_id(f"{key}:lesson:{lesson['video_id']}")
            if db.get(Lesson, lesson_id) is None:
                fields = LessonInput.model_validate({**lesson, "position": position}).model_dump()
                db.add(Lesson(id=lesson_id, course_id=course_id, **fields))
                counts["lessons"] += 1
        quiz_id = stable_id(f"{key}:quiz")
        if db.get(Quiz, quiz_id) is None:
            quiz_data = data["quiz"]
            quiz = Quiz(id=quiz_id, course_id=course_id, title=quiz_data["title"], duration_minutes=quiz_data["duration_minutes"])
            quiz.questions = [Question(id=stable_id(f"{key}:question:{i}"), **q) for i, q in enumerate(quiz_data["questions"])]
            db.add(quiz)
            counts["quizzes"] += 1
            counts["questions"] += len(quiz.questions)
        for i, assignment in enumerate(data["assignments"]):
            assignment_id = stable_id(f"{key}:assignment:{i}")
            if db.get(Assignment, assignment_id) is None:
                db.add(Assignment(id=assignment_id, course_id=course_id, **AssignmentInput.model_validate(assignment).model_dump()))
                counts["assignments"] += 1
        announcement_id = stable_id(f"{key}:welcome")
        if db.get(Announcement, announcement_id) is None:
            db.add(Announcement(id=announcement_id, course_id=course_id, author_id=teacher.id,
                title="Votre parcours vidéo et vos travaux pratiques sont prêts",
                body="Suivez les leçons dans l'ordre, réalisez les exercices puis le quiz. Deux devoirs sont à remettre en texte dans l'onglet Devoirs : collez votre travail et vos explications. Le professeur peut lire votre copie, la noter et vous transmettre un retour. Posez vos questions dans Discussions. Les vidéos appartiennent aux auteurs crédités dans chaque leçon ; elles restent sur YouTube. La durée du cours comprend les exercices."))
            counts["announcements"] += 1
        if student and not db.scalar(select(Enrollment.id).where(Enrollment.course_id == course_id, Enrollment.user_id == student.id)):
            db.add(Enrollment(course_id=course_id, user_id=student.id))
            notification_id = stable_id(f"{key}:welcome:{student.id}")
            if db.get(Notification, notification_id) is None:
                db.add(Notification(id=notification_id, user_id=student.id, title="Nouveau parcours vidéo disponible", message=data["title"]))
            counts["enrollments"] += 1
        db.flush()
    return {"created": counts, "teacher": teacher.email, "catalogue_courses": len(catalogue)}


def backup_sqlite() -> str | None:
    url = make_url(settings.database_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        return None
    source = Path(url.database)
    if not source.is_file():
        return None
    folder = Path("data/backups")
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination = folder / f"campuslearn-before-catalogue-{stamp}.db"
    with sqlite3.connect(source) as original, sqlite3.connect(destination) as backup:
        original.backup(backup)
    return str(destination)


if __name__ == "__main__":
    if settings.app_env == "production":
        raise SystemExit("Cet import et ses comptes de démonstration sont réservés à l'environnement local.")
    backup = backup_sqlite()
    with SessionLocal.begin() as db:
        result = populate_catalogue(db)
    print(json.dumps({**result, "backup": backup}, ensure_ascii=False, indent=2))
