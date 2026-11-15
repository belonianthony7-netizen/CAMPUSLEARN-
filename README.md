# CampusLearn - Plateforme d'Apprentissage Universitaire

CampusLearn est un système de gestion de l'apprentissage (LMS - *Learning Management System*) moderne, conçu pour les universités et établissements d'enseignement supérieur. Il offre une expérience intuitive pour les étudiants, les enseignants et les administrateurs.

---

## 🚀 Fonctionnalités Clés

- **Gestion des Rôles et Authentification :**
  - Authentification sécurisée via JWT (JSON Web Tokens) et hachage Argon2.
  - Trois rôles avec permissions adaptées : **Étudiant**, **Enseignant**, **Administrateur**.
- **Gestion des Cours & Inscriptions :**
  - Création, édition et publication de cours enrichis avec illustrations et tags.
  - Inscription des étudiants et suivi de progression en temps réel.
- **Leçons & Contenu Pédagogique :**
  - Organisation des leçons par modules.
  - Intégration de vidéos YouTube avec lecteur dédié.
  - Téléversement et consultation de documents pédagogiques (PDF, supports de cours).
- **Évaluations & Devoirs :**
  - Quiz interactifs avec notation automatique.
  - Soumission de devoirs avec système de notation et retours personnalisés des enseignants.
- **Espace Communautaire & Notifications :**
  - Forum de discussion par cours (questions/réponses entre étudiants et enseignants).
  - Centre de notifications pour le suivi des devoirs notés et annonces importantes.

---

## 🛠️ Architecture Technique

### Backend
- **Framework :** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- **ORM / Base de données :** [SQLAlchemy 2.0](https://www.sqlalchemy.org/) avec SQLite (développement) et PostgreSQL (production)
- **Migrations :** [Alembic](https://alembic.sqlalchemy.org/)
- **Validation & Schémas :** [Pydantic v2](https://docs.pydantic.dev/)
- **Sécurité :** PyJWT, Argon2-cffi

### Frontend
- **Framework :** [Angular 22](https://angular.dev/) (Standalone Components, Signals)
- **Langage :** TypeScript
- **Composants & Icônes :** Lucide Angular, animations Lottie Web
- **Style :** Design system sur-mesure (thème universitaire et pastels)

---

## 📦 Installation et Démarrage Rapide

### Option A : Avec Docker Compose (Recommandé)

1. **Créer le fichier d'environnement :**
   ```bash
   cp .env.example .env
   ```
   *(Pensez à définir une valeur sécurisée pour `JWT_SECRET` dans le fichier `.env`)*

2. **Lancer les services :**
   ```bash
   docker compose up --build -d
   ```
3. L'application est accessible sur : [http://localhost:8080](http://localhost:8080)

---

### Option B : Démarrage en Développement Local

#### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv

# Windows :
.venv\Scripts\activate
# Linux/macOS :
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- Documentation Swagger interactive : [http://localhost:8000/docs](http://localhost:8000/docs)
- Endpoint de santé : [http://localhost:8000/health](http://localhost:8000/health)

#### 2. Frontend (Angular)
```bash
cd frontend
npm install
npm start
```
- Application Web : [http://localhost:4200](http://localhost:4200)

---

## 🧪 Tests

- **Tests unitaires et d'intégration Backend :**
  ```bash
  cd backend
  pytest
  ```
- **Vérification des assets Frontend :**
  ```bash
  cd frontend
  npm run test:assets
  npm run test:icons
  ```

---

## 👨‍💻 Auteur & Contribution

- **Auteur :** Mugisho Mulume Jeremie
- **Branche de travail :** `mugisho-mulume-jeremie`
- **Projet :** CampusLearn - Université
