#!/usr/bin/env python3
"""Téléchargement depuis la source officielle DrawKit pour l'usage propre de l'utilisateur.
IMPORTANT : ne redistribuez pas ce ZIP ; https://www.drawkit.com/license
"""
from pathlib import Path
import urllib.request, zipfile
url='https://drawkit-free.s3.amazonaws.com/DrawKit_0007_%20Education_Illustration_Pack.zip'
dest=Path('telechargements_officiels_personnels');dest.mkdir(exist_ok=True)
path=dest/'DrawKit_Education_10_Illustrations.zip'
try:
    req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=35) as r:
        data=r.read()
    if not data.startswith(b'PK') or len(data)<1000:
        raise ValueError('Le serveur ne renvoie pas un ZIP valide.')
    path.write_bytes(data)
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
    print('Pack DrawKit téléchargé pour votre utilisation personnelle :',path.resolve())
except Exception as e:
    print('Échec du téléchargement officiel :',e)
    print('Page officielle : https://www.drawkit.com/illustrations/education-free-vector-illustrations')
    raise SystemExit(1)
