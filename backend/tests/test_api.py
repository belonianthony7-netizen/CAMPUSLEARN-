from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.security import hash_password


@pytest.fixture()
def client(monkeypatch):
    with TemporaryDirectory() as tmp:
        from app.database import settings
        monkeypatch.setattr(settings, 'upload_directory', str(Path(tmp) / 'uploads'))
        engine = create_engine(f"sqlite:///{Path(tmp) / 'test.db'}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(engine)
        maker = sessionmaker(bind=engine)
        with maker() as db:
            db.add_all([
                User(full_name="Enseignant Test", email="prof@test.cd", role="teacher", password_hash=hash_password("TeacherPass123!")),
                User(full_name="Gestionnaire Test", email="admin@test.cd", role="admin", password_hash=hash_password("AdminPass123!")),
            ])
            db.commit()
        def override():
            with maker() as db:
                yield db
        app.dependency_overrides[get_db] = override
        with TestClient(app) as c:
            yield c
        app.dependency_overrides.clear()
        engine.dispose()


def headers(client, email, password):
    r = client.post('/api/auth/login', json={"email":email,"password":password})
    assert r.status_code == 200, r.text
    return {"Authorization":f"Bearer {r.json()['access_token']}"}


def register_student(client, email="student@test.cd"):
    r = client.post('/api/auth/register', json={"full_name":"Étudiante Test","email":email,"password":"StudentPass123!", "role":"admin"})
    assert r.status_code == 201, r.text
    assert r.json()['user']['role'] == 'student'
    return {"Authorization":f"Bearer {r.json()['access_token']}"}


def create_course(client, teacher):
    r = client.post('/api/courses',headers=teacher,json={"title":"Algorithmique appliquée","description":"Apprendre à concevoir des algorithmes.","category":"Informatique","published":True})
    assert r.status_code == 201, r.text
    return r.json()['id']


def test_auth_roles_and_duplicate(client):
    student = register_student(client)
    assert client.get('/api/auth/me',headers=student).json()['role'] == 'student'
    assert client.post('/api/courses',headers=student,json={"title":"Fraude"}).status_code == 403
    assert client.post('/api/auth/register',json={"full_name":"Même étudiant","email":"student@test.cd","password":"StudentPass123!"}).status_code == 409
    assert client.get('/api/auth/me').status_code == 401


def test_course_enrollment_progress_and_quiz(client):
    teacher = headers(client,'prof@test.cd','TeacherPass123!')
    student = register_student(client)
    course_id = create_course(client, teacher)
    assert client.get(f'/api/courses/{course_id}/lessons', headers=student).status_code == 403
    lesson = client.post(f'/api/courses/{course_id}/lessons',headers=teacher,json={"title":"Notions de base","content":"Introduction aux concepts","position":1})
    assert lesson.status_code == 201
    q = client.post(f'/api/courses/{course_id}/quizzes',headers=teacher,json={"title":"Quiz de départ","questions":[{"prompt":"Combien font 2 + 2 ?","options":["3","4"],"correct_index":1}]})
    assert q.status_code == 201, q.text
    assert client.post(f'/api/courses/{course_id}/enroll',headers=student).status_code == 201
    assert client.post(f'/api/courses/{course_id}/enroll',headers=student).status_code == 409
    lessons = client.get(f'/api/courses/{course_id}/lessons',headers=student).json()
    assert len(lessons) == 1
    assert client.patch(f"/api/lessons/{lesson.json()['id']}/complete",headers=student).status_code == 200
    assert client.get(f'/api/courses/{course_id}', headers=student).json()['progress'] == 100
    quiz = client.get(f'/api/courses/{course_id}/quizzes',headers=student).json()[0]
    assert 'correct_index' not in quiz['questions'][0]
    question_id = quiz['questions'][0]['id']
    result = client.post(f"/api/quizzes/{quiz['id']}/submit",headers=student,json={"answers":{question_id:1}})
    assert result.status_code == 200
    assert result.json()['percentage'] == 100
    assert client.get('/api/dashboard', headers=student).json()['average_score'] == 100


def test_assignments_discussion_and_announcements(client):
    teacher = headers(client,'prof@test.cd','TeacherPass123!')
    student = register_student(client)
    cid = create_course(client,teacher)
    client.post(f'/api/courses/{cid}/enroll',headers=student)
    a = client.post(f'/api/courses/{cid}/assignments',headers=teacher,json={"title":"Exercice de synthèse","description":"Faites une analyse.","max_score":20})
    assert a.status_code == 201
    aid=a.json()['id']
    assert client.post(f'/api/assignments/{aid}/submit',headers=student,json={"content":"Voici mon analyse."}).status_code == 201
    submissions = client.get(f'/api/assignments/{aid}/submissions',headers=teacher).json()
    assert len(submissions)==1
    assert client.patch(f"/api/submissions/{submissions[0]['id']}/grade",headers=teacher,json={"score":21,"feedback":"Trop"}).status_code == 422
    assert client.patch(f"/api/submissions/{submissions[0]['id']}/grade",headers=teacher,json={"score":17,"feedback":"Très bien"}).status_code == 200
    assert client.get(f'/api/courses/{cid}/assignments',headers=student).json()[0]['submission']['score']==17
    assert client.post(f'/api/courses/{cid}/posts',headers=student,json={"content":"Bonjour !"}).status_code == 201
    assert client.get(f'/api/courses/{cid}/posts',headers=teacher).json()[0]['content']=='Bonjour !'
    assert client.post(f'/api/courses/{cid}/announcements',headers=student,json={"title":"Interdite","body":"Une annonce"}).status_code == 403
    assert client.post(f'/api/courses/{cid}/announcements',headers=teacher,json={"title":"Bienvenue","body":"Bonjour à tous !"}).status_code == 201
    assert len(client.get('/api/notifications',headers=student).json())>=2


def test_admin_and_course_ownership(client):
    teacher = headers(client,'prof@test.cd','TeacherPass123!')
    admin = headers(client,'admin@test.cd','AdminPass123!')
    student = register_student(client)
    cid = create_course(client,teacher)
    student_id = client.get('/api/auth/me',headers=student).json()['id']
    assert client.get('/api/admin/users',headers=teacher).status_code == 403
    assert client.patch(f'/api/admin/users/{student_id}',headers=admin,json={"role":"teacher"}).status_code == 200
    assert client.patch(f'/api/courses/{cid}',headers=student,json={"published":False}).status_code == 403
    # jwt role isn't trusted alone; server reads role from DB, but only owner can edit.
    assert client.patch(f'/api/courses/{cid}',headers=student,json={"published":False}).status_code == 403
    assert client.patch(f'/api/courses/{cid}',headers=admin,json={"published":False}).status_code == 200
    assert client.get(f'/api/courses/{cid}',headers=teacher).status_code == 200


def test_private_material_upload(client):
    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    student = register_student(client)
    cid = create_course(client, teacher)
    uploaded = client.post(f'/api/courses/{cid}/files', headers=teacher,
                           files={"file": ("notes.pdf", b"%PDF-1.4\nsynthetic test pdf", "application/pdf")})
    assert uploaded.status_code == 201, uploaded.text
    resource = uploaded.json()['url']
    assert client.get(resource, headers=student).status_code == 403
    assert client.post(f'/api/courses/{cid}/enroll', headers=student).status_code == 201
    assert client.get(resource, headers=student).status_code == 200
    invalid = client.post(f'/api/courses/{cid}/files', headers=teacher,
                          files={"file": ("fake.pdf", b"not a real pdf", "application/pdf")})
    assert invalid.status_code == 415


def test_course_cover_selection_and_update(client):
    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    student = register_student(client)
    created = client.post('/api/courses',headers=teacher,json={
        'title':'Introduction à Python', 'category':'Informatique', 'cover_image':'python', 'published':True
    })
    assert created.status_code==201, created.text
    cid=created.json()['id']
    assert created.json()['cover_image']=='python'
    assert client.get(f'/api/courses/{cid}', headers=student).json()['cover_image']=='python'
    changed=client.patch(f'/api/courses/{cid}',headers=teacher,json={'cover_image':'web'})
    assert changed.status_code==200, changed.text
    assert changed.json()['cover_image']=='web'
    for choice in ['pastel-formation-livres','od-reading','i3d-trophy','cover-python']:
        new_cover=client.patch(f'/api/courses/{cid}',headers=teacher,json={'cover_image':choice})
        assert new_cover.status_code==200, (choice,new_cover.text)
        assert new_cover.json()['cover_image']==choice
    invalid=client.patch(f'/api/courses/{cid}',headers=teacher,json={'cover_image':'https://bad.example/img.png'})
    assert invalid.status_code==422
    assert client.patch(f'/api/courses/{cid}',headers=student,json={'cover_image':'sql'}).status_code==403

@pytest.mark.parametrize('link', [
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'https://youtu.be/M7lc1UVf-VE?t=12',
    'https://www.youtube.com/shorts/M7lc1UVf-VE',
    'https://m.youtube.com/live/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    'M7lc1UVf-VE',
])
def test_youtube_links_accepted_and_normalized(client, link):
    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    cid = create_course(client, teacher)
    response = client.post(f'/api/courses/{cid}/lessons', headers=teacher, json={
        'title':'Tutoriel vidéo', 'video_url':link, 'content':'', 'position':1
    })
    assert response.status_code == 201, response.text
    lesson = client.get(f'/api/courses/{cid}/lessons', headers=teacher).json()[0]
    assert lesson['video_url'] == 'https://www.youtube.com/watch?v=M7lc1UVf-VE'
    assert lesson['content'] == ''


@pytest.mark.parametrize('link', [
    'https://youtube.com.evil.net/watch?v=M7lc1UVf-VE',
    'https://vimeo.com/123456',
    'javascript:alert(1)',
    'https://www.youtube.com/watch?v=bad',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE&v=xxxxxxxxxxx',
    'https://youtube.com:1234/watch?v=M7lc1UVf-VE',
    'https://www.youtube.com@evil.com/watch?v=M7lc1UVf-VE',
    '<iframe src="https://youtube.com/embed/M7lc1UVf-VE"></iframe>',
])
def test_invalid_youtube_rejected(client, link):
    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    cid = create_course(client, teacher)
    response = client.post(f'/api/courses/{cid}/lessons', headers=teacher,
                           json={'title':'Tutoriel vidéo','video_url':link})
    assert response.status_code == 422, (link,response.text)


def test_teacher_updates_youtube_video_and_student_cannot(client):
    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    admin = headers(client,'admin@test.cd','AdminPass123!')
    student = register_student(client)
    course = create_course(client,teacher)
    lesson_response = client.post(f'/api/courses/{course}/lessons',headers=teacher,
                                  json={'title':'Introduction en vidéo', 'content':'Explications', 'position':1})
    assert lesson_response.status_code == 201
    lesson = lesson_response.json()['id']
    assert client.patch(f'/api/lessons/{lesson}',headers=student,json={'video_url':'https://youtu.be/M7lc1UVf-VE'}).status_code == 403
    assert client.patch(f'/api/lessons/{lesson}',headers=teacher,json={'video_url':'https://youtu.be/M7lc1UVf-VE'}).status_code == 200
    assert client.patch(f'/api/lessons/{lesson}',headers=teacher,json={'video_url':'https://evil.com/'}).status_code == 422
    assert client.post(f'/api/courses/{course}/enroll',headers=student).status_code == 201
    retrieved = client.get(f'/api/courses/{course}/lessons',headers=student).json()[0]
    assert retrieved['video_url'] == 'https://www.youtube.com/watch?v=M7lc1UVf-VE'
    assert retrieved['content'] == 'Explications'
    # An unrelated teacher cannot edit another instructor's lesson
    other_course=create_course(client,teacher)
    # admin may edit, but an unrelated course ID isn't a lesson ID
    assert client.patch('/api/lessons/nonexistent',headers=admin,json={'title':'Essayé'}).status_code==404
    assert client.patch(f'/api/lessons/{lesson}',headers=teacher,json={'video_url':None}).status_code==200
    assert client.get(f'/api/courses/{course}/lessons',headers=teacher).json()[0]['video_url'] is None


def test_other_teacher_cannot_change_someone_elses_video(client):
    teacher = headers(client,'prof@test.cd','TeacherPass123!')
    admin = headers(client,'admin@test.cd','AdminPass123!')
    cid = create_course(client,teacher)
    lesson = client.post(f'/api/courses/{cid}/lessons',headers=teacher,
                         json={'title':'Tutoriel initial','video_url':'https://youtu.be/M7lc1UVf-VE'}).json()['id']
    other_user = register_student(client,email='other@test.cd')
    user_id = client.get('/api/auth/me',headers=other_user).json()['id']
    promoted = client.patch(f'/api/admin/users/{user_id}',headers=admin,json={'role':'teacher'})
    assert promoted.status_code == 200, promoted.text
    other_teacher = headers(client,'other@test.cd','StudentPass123!')
    blocked = client.patch(f'/api/lessons/{lesson}',headers=other_teacher,
                           json={'video_url':'https://youtu.be/M7lc1UVf-VE','title':'Piratée'})
    assert blocked.status_code == 403, blocked.text
    assert client.get(f'/api/courses/{cid}/lessons',headers=teacher).json()[0]['title']=='Tutoriel initial'


def import_catalogue_for_test():
    from contextlib import contextmanager
    from app.seed_catalogue import populate_catalogue
    with contextmanager(app.dependency_overrides[get_db])() as db:
        result = populate_catalogue(db, teacher_email='prof@test.cd')
        db.commit()
        return result


def test_catalogue_import_preserves_existing_data_and_is_idempotent(client):
    from contextlib import contextmanager
    from app.models import Course, Lesson, Quiz, Assignment, Enrollment, Notification
    from app.seed_catalogue import stable_id
    from sqlalchemy import select, func

    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    student = register_student(client, 'etudiant@campuslearn.test')
    old_course = create_course(client, teacher)
    result = import_catalogue_for_test()
    assert result['created'] == {'courses': 4, 'lessons': 13, 'quizzes': 4, 'questions': 24,
                                 'assignments': 8, 'announcements': 4, 'enrollments': 4}
    with contextmanager(app.dependency_overrides[get_db])() as db:
        owner = db.scalar(select(User).where(User.email == 'prof@test.cd'))
        original_password = owner.password_hash
        db.get(Course, stable_id('python-pratique')).title = 'Titre personnalisé par le professeur'
        db.get(Lesson, stable_id('python-pratique:lesson:PVB8Qn5bjqY')).content = 'Notes personnalisées'
        db.commit()
        counts_before = [db.scalar(select(func.count()).select_from(model)) for model in
                         [Course, Lesson, Quiz, Assignment, Enrollment, Notification]]
    second = import_catalogue_for_test()
    assert all(count == 0 for count in second['created'].values())
    with contextmanager(app.dependency_overrides[get_db])() as db:
        assert counts_before == [db.scalar(select(func.count()).select_from(model)) for model in
                                 [Course, Lesson, Quiz, Assignment, Enrollment, Notification]]
        assert db.scalar(select(User).where(User.email == 'prof@test.cd')).password_hash == original_password
        assert db.get(Course, stable_id('python-pratique')).title == 'Titre personnalisé par le professeur'
        assert db.get(Lesson, stable_id('python-pratique:lesson:PVB8Qn5bjqY')).content == 'Notes personnalisées'
    assert client.get(f'/api/courses/{old_course}', headers=teacher).json()['title'] == 'Algorithmique appliquée'
    assert len(client.get('/api/courses?mine=true', headers=teacher).json()) == 5
    assert len(client.get('/api/courses?mine=true', headers=student).json()) == 4


def test_catalogue_student_quiz_assignment_and_teacher_tracking(client):
    from app.seed_catalogue import stable_id
    teacher = headers(client, 'prof@test.cd', 'TeacherPass123!')
    student = register_student(client, 'etudiant@campuslearn.test')
    import_catalogue_for_test()
    cid = stable_id('python-pratique')
    lessons = client.get(f'/api/courses/{cid}/lessons', headers=student).json()
    assert len(lessons) == 4
    assert all(lesson['video_url'].startswith('https://www.youtube.com/watch?v=') for lesson in lessons)
    assert 'Auteur : Lucas Willems' in lessons[0]['content']
    assert client.patch(f"/api/lessons/{lessons[0]['id']}/complete", headers=student).status_code == 200
    assert client.get(f'/api/courses/{cid}', headers=student).json()['progress'] == 25
    quiz = client.get(f'/api/courses/{cid}/quizzes', headers=teacher).json()[0]
    student_quiz = client.get(f'/api/courses/{cid}/quizzes', headers=student).json()[0]
    assert len(quiz['questions']) == 6
    assert all('correct_index' not in question for question in student_quiz['questions'])
    answers = {question['id']: question['correct_index'] for question in quiz['questions']}
    assert client.post(f"/api/quizzes/{quiz['id']}/submit", headers=student, json={'answers': {}}).status_code == 422
    invalid = {**answers, quiz['questions'][0]['id']: 99}
    assert client.post(f"/api/quizzes/{quiz['id']}/submit", headers=student, json={'answers': invalid}).status_code == 422
    result = client.post(f"/api/quizzes/{quiz['id']}/submit", headers=student, json={'answers': answers})
    assert result.status_code == 200, result.text
    assert result.json()['percentage'] == 100
    attempts = client.get(f'/api/teacher/courses/{cid}/quiz-attempts', headers=teacher).json()
    assert len(attempts) == 1 and attempts[0]['score'] == 6 and attempts[0]['student_name'] == 'Étudiante Test'
    assert client.get(f'/api/teacher/courses/{cid}/quiz-attempts', headers=student).status_code == 403

    assignments = client.get(f'/api/courses/{cid}/assignments', headers=student).json()
    assert len(assignments) == 2 and all('BARÈME /20' in a['description'] for a in assignments)
    aid = assignments[0]['id']
    answer = 'def moyenne(notes):\n    return sum(notes) / len(notes)\n\nTest : moyenne([12, 16]) == 14.'
    assert client.post(f'/api/assignments/{aid}/submit', headers=student, json={'content': answer}).status_code == 201
    assert client.get('/api/dashboard', headers=teacher).json()['pending_submissions'] == 1
    copies = client.get(f'/api/assignments/{aid}/submissions', headers=teacher).json()
    assert len(copies) == 1 and copies[0]['content'] == answer
    assert client.patch(f"/api/submissions/{copies[0]['id']}/grade", headers=teacher,
                        json={'score': 18.5, 'feedback': 'Calcul correct ; ajouter la gestion de la liste vide.'}).status_code == 200
    saved = next(a for a in client.get(f'/api/courses/{cid}/assignments', headers=student).json() if a['id'] == aid)
    assert saved['submission']['score'] == 18.5 and saved['submission']['content'] == answer
    assert 'liste vide' in saved['submission']['feedback']
    assert client.post(f'/api/assignments/{aid}/submit', headers=student, json={'content': 'Écraser'}).status_code == 409
    tracking = client.get(f'/api/teacher/courses/{cid}/students', headers=teacher).json()[0]
    assert {key: tracking[key] for key in ['progress', 'quiz_attempts', 'quiz_average', 'submissions', 'graded_submissions']} == {
        'progress': 25, 'quiz_attempts': 1, 'quiz_average': 100, 'submissions': 1, 'graded_submissions': 1}
    dashboard = client.get('/api/dashboard', headers=teacher).json()
    assert dashboard['pending_submissions'] == 0 and dashboard['quiz_attempts'] == 1
    assert {'Quiz remis', 'Copie à corriger'} <= {n['title'] for n in client.get('/api/notifications', headers=teacher).json()}
    assert 'Devoir corrigé' in {n['title'] for n in client.get('/api/notifications', headers=student).json()}

    # Les données d'un cours restent réservées à son propriétaire et à l'administrateur.
    admin = headers(client, 'admin@test.cd', 'AdminPass123!')
    other = register_student(client, 'autre-prof@test.cd')
    other_id = client.get('/api/auth/me', headers=other).json()['id']
    assert client.patch(f'/api/admin/users/{other_id}', headers=admin, json={'role': 'teacher'}).status_code == 200
    assert client.get(f'/api/teacher/courses/{cid}/students', headers=other).status_code == 403
    assert client.get(f'/api/teacher/courses/{cid}/quiz-attempts', headers=other).status_code == 403
    assert client.get(f'/api/assignments/{aid}/submissions', headers=other).status_code == 403
    assert client.get(f'/api/teacher/courses/{cid}/quiz-attempts', headers=admin).status_code == 200
