#!/usr/bin/env python3
"""Restaurer les données CampusLearn dans un projet existant (Python standard)."""
import argparse
import hashlib
import json
import os
import re
import shutil
import sqlite3
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote


def connect_readonly(path):
    return sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=15)


def copy_database(source, destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect_readonly(source)) as original, closing(sqlite3.connect(destination, timeout=15)) as target:
        original.backup(target)


def table_counts(path):
    with closing(connect_readonly(path)) as db:
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise ValueError("La base SQLite ne passe pas le contrôle d'intégrité.")
        if db.execute("PRAGMA foreign_key_check").fetchone():
            raise ValueError("La base contient une relation vers un enregistrement absent.")
        names = [row[0] for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
        if not {"users", "courses", "lessons"}.issubset(names):
            raise ValueError("Le fichier n'est pas une base CampusLearn reconnue.")
        return {name: db.execute('SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0]
                for name in names}


def read_env(backend):
    values = {}
    path = backend / ".env"
    if path.is_file():
        for raw in path.read_text(encoding="utf-8-sig").splitlines():
            line = raw.strip()
            if line.startswith("export "):
                line = line[7:].strip()
            key, separator, value = line.partition("=")
            if separator and key.strip() in {"DATABASE_URL", "UPLOAD_DIRECTORY"}:
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                    value = value[1:-1]
                else:
                    value = value.split(" #", 1)[0].strip()
                values[key.strip()] = value
    for key in ("DATABASE_URL", "UPLOAD_DIRECTORY"):
        if key in os.environ:
            values[key] = os.environ[key]
    return values


def project_paths(project):
    project = Path(project).expanduser().resolve()
    backend = project / "backend" if (project / "backend" / "app").is_dir() else project
    if not (backend / "app" / "database.py").is_file():
        raise ValueError("Indiquez le dossier du projet CampusLearn (celui qui contient backend et frontend).")
    config = read_env(backend)
    url = config.get("DATABASE_URL", "sqlite:///./campuslearn.db")
    match = re.fullmatch(r"sqlite(?:\+pysqlite)?:///(.+)", url)
    if not match or match[1].split("?", 1)[0] == ":memory:":
        raise ValueError("Cet import est prévu pour une base SQLite enregistrée sur disque.")
    database = Path(unquote(match[1].split("?", 1)[0])).expanduser()
    uploads = Path(config.get("UPLOAD_DIRECTORY", "./data/uploads")).expanduser()
    database = (database if database.is_absolute() else backend / database).resolve()
    uploads = (uploads if uploads.is_absolute() else backend / uploads).resolve()
    # Le dossier de fichiers doit être dédié aux pièces jointes, jamais un parent du projet.
    if uploads == backend or uploads in backend.parents or uploads == database.parent or uploads in database.parents:
        raise ValueError("UPLOAD_DIRECTORY doit désigner un dossier dédié aux fichiers importés.")
    return backend, database, uploads


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_bundle(bundle):
    bundle = Path(bundle).resolve()
    manifest = json.loads((bundle / "MANIFESTE.json").read_text(encoding="utf-8"))
    if manifest.get("format") != "campuslearn-sqlite-v1":
        raise ValueError("Format de transfert non reconnu.")
    for relative, expected in manifest["sha256"].items():
        path = (bundle / relative).resolve()
        if not path.is_relative_to(bundle) or not path.is_file() or sha256(path) != expected:
            raise ValueError(f"Fichier absent ou altéré : {relative}. Décompressez à nouveau l'archive.")
    if table_counts(bundle / "donnees" / "campuslearn.db") != manifest["tables"]:
        raise ValueError("Le contenu de la base ne correspond pas au manifeste.")
    return manifest


def relocate_materials(database, uploads_source, uploads_target, backend):
    with closing(sqlite3.connect(database)) as db, db:
        exists = db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='materials'").fetchone()
        if not exists:
            return
        for file_id, previous in db.execute("SELECT id, storage_path FROM materials").fetchall():
            filename = str(previous).replace("\\", "/").rsplit("/", 1)[-1]
            if filename in {"", ".", ".."} or not (uploads_source / filename).is_file():
                raise ValueError(f"Une pièce jointe référencée est absente : {file_id}")
            destination = uploads_target / filename
            try:
                destination = destination.relative_to(backend)
            except ValueError:
                pass
            db.execute("UPDATE materials SET storage_path=? WHERE id=?", (str(destination), file_id))


def restore(bundle, project):
    bundle = Path(bundle).resolve()
    manifest = verify_bundle(bundle)
    backend, database, uploads = project_paths(project)
    source = bundle / "donnees" / "campuslearn.db"
    if source == database:
        raise ValueError("La source et la destination doivent être différentes.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = backend / "data" / "sauvegardes-import" / stamp
    if uploads == backup or uploads in backup.parents or backup in uploads.parents:
        raise ValueError("Le dossier des pièces jointes ne peut pas contenir les sauvegardes d'import.")
    backup.mkdir(parents=True)
    had_database, had_uploads = database.is_file(), uploads.exists()
    if had_database:
        copy_database(database, backup / "campuslearn.db")
    if had_uploads:
        shutil.copytree(uploads, backup / "uploads")
    (backup / "RESTAURATION.json").write_text(json.dumps({
        "database": str(database), "uploads": str(uploads),
        "had_database": had_database, "had_uploads": had_uploads,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    with tempfile.TemporaryDirectory(prefix=".import-campuslearn-", dir=backend) as temp:
        staged = Path(temp) / "campuslearn.db"
        copy_database(source, staged)
        relocate_materials(staged, bundle / "donnees" / "uploads", uploads, backend)
        table_counts(staged)
        try:
            uploads.mkdir(parents=True, exist_ok=True)
            shutil.copytree(bundle / "donnees" / "uploads", uploads, dirs_exist_ok=True)
            copy_database(staged, database)
            if table_counts(database) != manifest["tables"]:
                raise ValueError("Le contrôle après import ne correspond pas aux données attendues.")
            # Copier l'historique sans remplacer les anciennes sauvegardes de la destination.
            history = bundle / "donnees" / "historique"
            if history.is_dir():
                shutil.copytree(history, backup / "historique-source")
        except Exception:
            if had_database:
                copy_database(backup / "campuslearn.db", database)
            else:
                database.unlink(missing_ok=True)
            shutil.rmtree(uploads, ignore_errors=True)
            if had_uploads:
                shutil.copytree(backup / "uploads", uploads)
            raise
    return {"status": "Import terminé", "database": str(database), "uploads": str(uploads),
            "sauvegarde_avant_import": str(backup), "tables": manifest["tables"]}


def main():
    parser = argparse.ArgumentParser(description="Importer une copie complète des données CampusLearn dans votre projet SQLite existant.")
    parser.add_argument("--projet", type=Path, help="Dossier de votre projet existant, ou son dossier backend")
    parser.add_argument("--verifier", action="store_true", help="Contrôler l'export sans modifier le projet")
    args = parser.parse_args()
    bundle = Path(__file__).resolve().parent
    try:
        if args.verifier:
            manifest = verify_bundle(bundle)
            print(json.dumps({"status": "Export vérifié, aucun import effectué", "tables": manifest["tables"]}, ensure_ascii=False, indent=2))
            return
        project = args.projet
        if project is None:
            candidate = bundle.parent
            if (candidate / "backend" / "app" / "database.py").is_file():
                project = candidate
            else:
                project = Path(input("Collez le chemin du projet CampusLearn existant : ").strip().strip('"'))
        print("Import d'une copie complète. Les données actuelles de destination seront sauvegardées, puis remplacées.")
        print(json.dumps(restore(bundle, project), ensure_ascii=False, indent=2))
        print("Redémarrez l'API depuis son dossier backend. Vos comptes conservent leurs mots de passe.")
    except (ValueError, OSError, sqlite3.Error, KeyError) as error:
        parser.exit(1, f"Import interrompu : {error}\n")


if __name__ == "__main__":
    main()
