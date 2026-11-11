"""Tests du transfert, sur des bases et fichiers temporaires uniquement."""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import zipfile
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

from exporter_donnees import export_data
from importer_donnees import project_paths, restore, sha256, table_counts, verify_bundle


def make_project(root, marker, source=False):
    backend = root / "backend"
    (backend / "app").mkdir(parents=True)
    (backend / "app" / "database.py").write_text("# Projet temporaire de validation\n")
    uploads = backend / "data" / "uploads"
    uploads.mkdir(parents=True)
    (uploads / "piece.pdf").write_bytes(b"%PDF-1.4\n" + marker.encode())
    with closing(sqlite3.connect(backend / "campuslearn.db")) as db, db:
        db.executescript("""
            CREATE TABLE users (id TEXT PRIMARY KEY, password_hash TEXT);
            CREATE TABLE courses (id TEXT PRIMARY KEY, teacher_id TEXT REFERENCES users(id));
            CREATE TABLE lessons (id TEXT PRIMARY KEY, course_id TEXT REFERENCES courses(id));
            CREATE TABLE materials (id TEXT PRIMARY KEY, course_id TEXT REFERENCES courses(id), storage_path TEXT);
        """)
        db.execute("INSERT INTO users VALUES (?, ?)", (marker, "empreinte-conservee-" + marker))
        db.execute("INSERT INTO courses VALUES (?, ?)", ("cours-" + marker, marker))
        db.execute("INSERT INTO lessons VALUES (?, ?)", ("lecon-" + marker, "cours-" + marker))
        storage = r"C:\Ancienne machine\CampusLearn\data\uploads\piece.pdf" if source else "data/uploads/piece.pdf"
        db.execute("INSERT INTO materials VALUES (?, ?, ?)", ("fichier-" + marker, "cours-" + marker, storage))
    return backend


class TransferTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / "Source avec espaces"
        self.target = self.root / "Autre machine"
        self.source_backend = make_project(self.source, "source", source=True)
        self.target_backend = make_project(self.target, "destination")
        # Les variables du poste courant ne doivent pas influencer les projets de test.
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def exported_bundle(self):
        archive = self.root / "donnees.zip"
        export_data(self.source, archive)
        with zipfile.ZipFile(archive) as zipped:
            self.assertIsNone(zipped.testzip())
            zipped.extractall(self.root / "extrait")
        return self.root / "extrait" / "campuslearn-donnees"

    def test_restore_preserves_ids_passwords_files_and_backs_up_destination(self):
        bundle = self.exported_bundle()
        result = restore(bundle, self.target)
        database = self.target_backend / "campuslearn.db"
        self.assertEqual(table_counts(database), verify_bundle(bundle)["tables"])
        with closing(sqlite3.connect(database)) as db:
            self.assertEqual(db.execute("SELECT * FROM users").fetchall(), [("source", "empreinte-conservee-source")])
            self.assertEqual(db.execute("SELECT id FROM lessons").fetchone()[0], "lecon-source")
            relative = db.execute("SELECT storage_path FROM materials").fetchone()[0]
            self.assertEqual((self.target_backend / relative).read_bytes(), b"%PDF-1.4\nsource")
        backup = Path(result["sauvegarde_avant_import"])
        with closing(sqlite3.connect(backup / "campuslearn.db")) as old:
            self.assertEqual(old.execute("SELECT id FROM users").fetchone()[0], "destination")
        self.assertEqual((backup / "uploads" / "piece.pdf").read_bytes(), b"%PDF-1.4\ndestination")
        run = subprocess.run([sys.executable, str(bundle / "importer_donnees.py"), "--verifier"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("aucun import", run.stdout)

    def test_corrupted_file_stops_before_any_destination_change(self):
        bundle = self.exported_bundle()
        database = self.target_backend / "campuslearn.db"
        before = sha256(database)
        (bundle / "donnees" / "uploads" / "piece.pdf").write_bytes(b"alteration")
        with self.assertRaisesRegex(ValueError, "altéré"):
            restore(bundle, self.target)
        self.assertEqual(sha256(database), before)
        self.assertEqual((self.target_backend / "data" / "uploads" / "piece.pdf").read_bytes(), b"%PDF-1.4\ndestination")
        self.assertFalse((self.target_backend / "data" / "sauvegardes-import").exists())

    def test_missing_referenced_attachment_prevents_export(self):
        (self.source_backend / "data" / "uploads" / "piece.pdf").unlink()
        archive = self.root / "incomplet.zip"
        with self.assertRaisesRegex(ValueError, "référencé introuvable"):
            export_data(self.source, archive)
        self.assertFalse(archive.exists())

    def test_custom_sqlite_and_upload_paths_are_respected(self):
        (self.target_backend / ".env").write_text('DATABASE_URL="sqlite:///./custom/live.db"\nUPLOAD_DIRECTORY="./pieces-jointes"\n')
        bundle = self.exported_bundle()
        result = restore(bundle, self.target)
        self.assertEqual(Path(result["database"]), self.target_backend / "custom" / "live.db")
        self.assertEqual((self.target_backend / "pieces-jointes" / "piece.pdf").read_bytes(), b"%PDF-1.4\nsource")
        # La base par défaut n'a pas été touchée quand la configuration en choisit une autre.
        with closing(sqlite3.connect(self.target_backend / "campuslearn.db")) as db:
            self.assertEqual(db.execute("SELECT id FROM users").fetchone()[0], "destination")

    def test_failure_during_restore_rolls_back_old_database_and_uploads(self):
        bundle = self.exported_bundle()
        database = self.target_backend / "campuslearn.db"
        before = sha256(database)
        from importer_donnees import copy_database
        def fail_final_copy(source, target):
            if Path(target) == database and Path(source).parent.name.startswith(".import-campuslearn-"):
                raise OSError("Échec de copie simulé")
            return copy_database(source, target)
        with patch("importer_donnees.copy_database", side_effect=fail_final_copy):
            with self.assertRaisesRegex(OSError, "simulé"):
                restore(bundle, self.target)
        with closing(sqlite3.connect(database)) as db:
            self.assertEqual(db.execute("SELECT * FROM users").fetchall(), [("destination", "empreinte-conservee-destination")])
            self.assertEqual(db.execute("SELECT id FROM lessons").fetchone()[0], "lecon-destination")
        self.assertEqual((self.target_backend / "data" / "uploads" / "piece.pdf").read_bytes(), b"%PDF-1.4\ndestination")


if __name__ == "__main__":
    unittest.main()
