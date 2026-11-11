#!/usr/bin/env python3
"""Créer une archive de données SQLite pour un autre projet CampusLearn existant."""
import argparse
import json
import shutil
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from importer_donnees import copy_database, project_paths, sha256, table_counts, verify_bundle


GUIDE = """# Transférer uniquement les données CampusLearn

Le projet est déjà installé sur l'autre machine. Cette archive contient les données,
les fichiers enregistrés, l'historique de sauvegarde et un importeur sans dépendance
Python supplémentaire. Elle ne contient pas le code Angular/FastAPI, node_modules ou .venv.

## Importer sur l'autre machine

1. Arrêtez l'API CampusLearn sur l'autre machine (Ctrl+C dans son terminal).
2. Décompressez complètement cette archive. Copiez le dossier `campuslearn-donnees`
   dans la racine de votre projet existant, à côté de `backend` et `frontend`.
3. Ouvrez le dossier décompressé, puis lancez :
   - Windows : double-cliquez sur `IMPORTER_WINDOWS.bat` ;
   - macOS : double-cliquez sur `IMPORTER_MAC.command` ;
   - Linux : lancez `sh IMPORTER_LINUX.sh` depuis un terminal.
   Si le dossier n'est pas placé dans le projet, l'importeur demande le chemin du projet existant.
4. Attendez « Import terminé », puis redémarrez votre API et votre interface habituelles.

Alternative depuis un terminal ouvert à la racine du projet :

```sh
# macOS / Linux
python3 campuslearn-donnees/importer_donnees.py --projet .

# Windows (Python installé)
py -3 campuslearn-donnees/importer_donnees.py --projet .
```

Pour contrôler l'archive sans rien importer :

```sh
python3 campuslearn-donnees/importer_donnees.py --verifier
```

Python 3.11 ou plus récent est conseillé, comme pour le projet. Si le double-clic
macOS est bloqué, utilisez la commande terminal ci-dessus. Si `py` n'est pas reconnu
sous Windows, remplacez `py -3` par `python`.

## Ce qui est conservé

- Comptes et mots de passe existants (empreintes de mots de passe), rôles et statut des comptes.
- Cours, leçons, liens YouTube, quiz et questions, devoirs et barèmes.
- Inscriptions, progression, tentatives de quiz, remises et notes enregistrées.
- Annonces, discussions, notifications et références des fichiers, lorsqu'il y en a.
- Tous les fichiers présents dans le dossier de pièces jointes, y compris les fichiers non référencés.
- Les anciennes sauvegardes disponibles sur la machine source.

Les vidéos restent sur YouTube : leurs liens sont conservés, pas les vidéos téléchargées.

## Copie complète, sauvegarde et réglages

L'import remplace les données actives de la destination par cette copie. Ce n'est pas
une fusion entre deux bases. Les données déjà présentes sur la destination sont
sauvegardées avant toute modification dans :

`backend/data/sauvegardes-import/DATE-UTC/`

Ce dossier contient `campuslearn.db`, `uploads/` s'ils existaient et un fichier
`RESTAURATION.json` avec les chemins. L'historique fourni par la source est conservé
dans `historique-source/`. En cas d'échec pendant la copie, l'importeur restaure
automatiquement la base et les fichiers de destination.

Pour revenir manuellement à la sauvegarde : arrêtez l'API, remplacez la base à
l'emplacement indiqué dans `RESTAURATION.json` par sa sauvegarde, puis restaurez
`uploads/`. L'ancienne base ne doit pas être remplacée pendant que le serveur écrit.

L'importeur conserve le `.env` de votre projet et détecte `DATABASE_URL` et
`UPLOAD_DIRECTORY` (avec priorité aux variables d'environnement). Sans configuration,
il utilise `backend/campuslearn.db` et `backend/data/uploads/`. Les anciens chemins
de pièces jointes sont adaptés à la machine de destination.

N'exécutez pas de script `seed` pour ce transfert : les données sont déjà dans la base.
Les comptes gardent leurs mots de passe actuels. Les sessions de navigateur peuvent
demander une nouvelle connexion si les réglages du serveur diffèrent.

## Fichiers de l'archive

- `donnees/campuslearn.db` : copie cohérente de la base active.
- `donnees/uploads/` : fichiers enregistrés sur la source.
- `donnees/historique/` : sauvegardes et autres données historiques de la source.
- `donnees/tables.json` : toutes les lignes et colonnes, pour un traitement complémentaire.
- `donnees/sauvegarde.sql` : export SQL SQLite de secours.
- `MANIFESTE.json` : décompte par table et empreintes SHA-256 des fichiers.

L'importeur vérifie les empreintes, l'intégrité SQLite, les relations et les nombres
d'enregistrements. Conservez cette archive en privé : elle contient vos comptes et données.

## État des données exportées

EXPORT_STATE
"""

WINDOWS = r"""@echo off
chcp 65001 >nul
where py >nul 2>&1
if errorlevel 1 (
  python "%~dp0importer_donnees.py" %*
) else (
  py -3 "%~dp0importer_donnees.py" %*
)
if errorlevel 1 echo L'import a echoue. Lisez le message affiche ci-dessus.
pause
"""

SHELL = """#!/bin/sh
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v python3 >/dev/null 2>&1; then
  python3 "$script_dir/importer_donnees.py" "$@"
else
  python "$script_dir/importer_donnees.py" "$@"
fi
result=$?
exit "$result"
"""


def export_data(project, output):
    project = Path(project).resolve()
    backend, database, uploads = project_paths(project)
    output = Path(output).resolve()
    if output.exists():
        raise ValueError("Cette archive existe déjà. Choisissez un nouveau nom pour conserver l'ancienne copie.")
    if not database.is_file():
        raise ValueError("La base SQLite source est absente.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="campuslearn-export-") as temp:
        bundle = Path(temp) / "campuslearn-donnees"
        payload = bundle / "donnees"
        payload.mkdir(parents=True)
        snapshot = payload / "campuslearn.db"
        copy_database(database, snapshot)
        counts = table_counts(snapshot)
        if uploads.is_dir():
            shutil.copytree(uploads, payload / "uploads")
        else:
            (payload / "uploads").mkdir()
        history = payload / "historique"
        history.mkdir()
        source_data = backend / "data"
        if source_data.is_dir():
            for path in source_data.iterdir():
                if path.resolve() == uploads or path.name.startswith(".import-campuslearn-"):
                    continue
                target = history / path.name
                if path.is_dir():
                    shutil.copytree(path, target)
                elif path.is_file():
                    shutil.copy2(path, target)
        with closing(sqlite3.connect(snapshot)) as db:
            if "materials" in counts:
                for file_id, storage_path in db.execute("SELECT id, storage_path FROM materials"):
                    name = str(storage_path).replace("\\", "/").rsplit("/", 1)[-1]
                    if not (payload / "uploads" / name).is_file():
                        raise ValueError(f"Fichier référencé introuvable : {file_id}. Aucun export incomplet n'a été créé.")
            tables = {}
            for table in counts:
                quoted = '"' + table.replace('"', '""') + '"'
                result = db.execute("SELECT * FROM " + quoted)
                columns = [column[0] for column in result.description]
                tables[table] = {"columns": columns, "rows": [list(row) for row in result]}
            (payload / "tables.json").write_text(json.dumps(tables, ensure_ascii=False, indent=2), encoding="utf-8")
            with (payload / "sauvegarde.sql").open("w", encoding="utf-8", newline="\n") as sql:
                for line in db.iterdump():
                    sql.write(line + "\n")
        shutil.copy2(Path(__file__).with_name("importer_donnees.py"), bundle / "importer_donnees.py")
        upload_count = sum(1 for path in (payload / "uploads").rglob("*") if path.is_file())
        state = "\n".join(f"- `{table}` : {count}" for table, count in counts.items())
        state += f"\n- Fichiers du dossier de pièces jointes : {upload_count}\n"
        (bundle / "LIRE_MOI.md").write_text(GUIDE.replace("EXPORT_STATE", state), encoding="utf-8")
        (bundle / "IMPORTER_WINDOWS.bat").write_bytes(WINDOWS.replace("\n", "\r\n").encode("utf-8"))
        for name in ["IMPORTER_MAC.command", "IMPORTER_LINUX.sh"]:
            launcher = bundle / name
            text = SHELL
            if name.endswith(".command"):
                text = text.replace('exit "$result"', 'printf "Appuyez sur Entree pour fermer..."\nread -r answer\nexit "$result"')
            launcher.write_text(text, encoding="utf-8", newline="\n")
            launcher.chmod(0o755)
        manifest = {"format": "campuslearn-sqlite-v1", "created_at_utc": datetime.now(timezone.utc).isoformat(),
                    "tables": counts, "uploaded_files": upload_count,
                    "sha256": {str(path.relative_to(bundle)).replace("\\", "/"): sha256(path)
                               for path in sorted(bundle.rglob("*")) if path.is_file()}}
        (bundle / "MANIFESTE.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        verify_bundle(bundle)
        pending = output.with_name(output.name + ".part")
        try:
            with zipfile.ZipFile(pending, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
                for path in sorted(bundle.rglob("*")):
                    archive.write(path, path.relative_to(bundle.parent))
            pending.replace(output)
        finally:
            pending.unlink(missing_ok=True)
    return {"archive": str(output), "bytes": output.stat().st_size, "tables": counts, "uploaded_files": upload_count}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--projet", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--sortie", type=Path, default=Path(__file__).resolve().parents[2] / "campuslearn-donnees-2026-11-06.zip")
    args = parser.parse_args()
    try:
        print(json.dumps(export_data(args.projet, args.sortie), ensure_ascii=False, indent=2))
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f"Export interrompu : {error}\n")
