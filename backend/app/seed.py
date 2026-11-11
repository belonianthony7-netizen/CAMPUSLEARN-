"""Données facultatives de démonstration. Exécuter uniquement en local."""
from sqlalchemy import select
from .database import Base, SessionLocal, engine
from .models import Announcement, Assignment, Course, Enrollment, Lesson, Question, Quiz, User
from .security import hash_password


def seed():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)):
            print("Base non vide : aucun compte de démonstration ajouté.")
            return
        users = [
            User(full_name="Administrateur CampusLearn", email="admin@campuslearn.test", role="admin", password_hash=hash_password("AdminDemo2026!")),
            User(full_name="Marie Kabeya", email="enseignant@campuslearn.test", role="teacher", password_hash=hash_password("Enseignant2026!")),
            User(full_name="Alex Mwamba", email="etudiant@campuslearn.test", role="student", password_hash=hash_password("Etudiant2026!")),
        ]
        db.add_all(users)
        db.flush()
        courses = [
            Course(title="Introduction à la programmation Python", description="Maîtrisez les bases de la programmation avec des exercices progressifs, des fonctions et des structures de données.", category="Informatique", level="Débutant", color="#7066F5", cover_image="python", published=True, duration_hours=18, teacher_id=users[1].id),
            Course(title="Bases de données relationnelles", description="Modélisez vos données, écrivez vos premières requêtes SQL et concevez des schémas relationnels.", category="Informatique", level="Intermédiaire", color="#16A5A3", cover_image="sql", published=True, duration_hours=14, teacher_id=users[1].id),
            Course(title="Méthodologie de recherche scientifique", description="Définir une problématique, poser des hypothèses et construire un protocole de recherche rigoureux.", category="Méthodologie", level="Tous niveaux", color="#EE986B", cover_image="research", published=True, duration_hours=12, teacher_id=users[1].id),
            Course(title="Initiation au développement Web", description="Découvrir HTML, CSS, JavaScript et les principes du Web moderne.", category="Informatique", level="Débutant", color="#6688D8", cover_image="web", published=True, duration_hours=20, teacher_id=users[1].id),
        ]
        db.add_all(courses)
        db.flush()
        for course in courses:
            db.add_all([
                Lesson(course_id=course.id, title="Bienvenue et objectifs du cours", position=1, content=f"Bienvenue dans le cours « {course.title} ».\n\nÀ la fin de ce parcours, vous aurez compris les concepts fondamentaux et pourrez les appliquer à des exercices concrets."),
                Lesson(course_id=course.id, title="Concepts fondamentaux", position=2, content="Dans ce chapitre, nous abordons les principaux concepts du domaine.\n\nPrenez des notes, explorez des exemples et posez vos questions dans l'espace discussion."),
                Lesson(course_id=course.id, title="Mise en pratique", position=3, content="Exercez-vous à appliquer les concepts de cette formation à un problème réel de votre choix."),
            ])
            quiz = Quiz(course_id=course.id, title="Quiz de compréhension", duration_minutes=10)
            quiz.questions = [
                Question(prompt="Quel est le meilleur moyen de consolider un apprentissage ?", options=["Pratiquer régulièrement", "Ignorer les exercices", "Lire uniquement le titre", "Éviter de poser des questions"], correct_index=0),
                Question(prompt="Quelle habitude favorise la réussite ?", options=["Tout remettre à demain", "Se fixer des objectifs clairs", "Ne jamais réviser"], correct_index=1),
            ]
            db.add(quiz)
            db.add(Assignment(course_id=course.id, title="Travail pratique : mise en application", description="Présentez une synthèse personnelle avec un exemple concret tiré de votre contexte.", max_score=20))
            db.add(Announcement(course_id=course.id, author_id=users[1].id, title="Bienvenue dans la formation !", body="Consultez les chapitres dans l'ordre, puis réalisez le quiz et le travail pratique."))
        db.add_all([Enrollment(user_id=users[2].id, course_id=courses[i].id) for i in (0, 1)])
        db.commit()
    print("Démonstration installée (comptes dans le README). Ne pas utiliser ces mots de passe en production.")


if __name__ == "__main__":
    seed()
