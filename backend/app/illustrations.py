"""Validated, user-selectable illustration identifiers. Never accept user-provided URLs."""
BASE = {"auto", "python", "sql", "research", "web", "math", "business", "language", "science"}
PASTEL = ['certificat-diplome', 'cours-en-ligne', 'devoir-valide', 'enseignante', 'etudiant', 'formation-livres', 'notification', 'planning-calendrier', 'ressources-livres', 'reussite-trophee']
DOODLES = ['unboxing', 'selfie', 'sprinting', 'coffee', 'dog-jump', 'loving', 'clumsy', 'rolling', 'running', 'reading', 'zombieing', 'ballet', 'float', 'meditating', 'moshing', 'sitting', 'strolling', 'roller-skating', 'ice-cream', 'jumping', 'reading-side', 'dancing', 'swinging', 'plant', 'sleek', 'bikini', 'Doggie', 'laying', 'groovy', 'sitting-reading', 'chilling', 'levitate', 'petting']
ICONS3D = ['notebook', 'pencil', 'computer', 'headphone', 'trophy', 'calender', 'calculator', 'chart', 'file-text', 'tick', 'target', 'lab', 'bulb', 'video-camera', 'megaphone', 'rocket']
VECTOR = ['hero-learning', 'catalogue-explore', 'teacher-studio', 'admin-control', 'spotlight-path', 'course-general', 'course-tech', 'course-math', 'course-business', 'course-language', 'course-science', 'cover-python', 'cover-sql', 'cover-research', 'cover-web']
ARTWORK_IDS = BASE | set(VECTOR) | {f"pastel-{name}" for name in PASTEL} | {f"od-{name.lower()}" for name in DOODLES} | {f"i3d-{name}" for name in ICONS3D}

def cover_allowed(value: str) -> bool:
    return value in ARTWORK_IDS
