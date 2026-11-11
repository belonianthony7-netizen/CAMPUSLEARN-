#!/usr/bin/env python3
"""Optional: download free V1 3dicons CC0, only from verified official source."""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
BASE = "https://pub-821312cfd07a4061bf7b99c1f23ed29b.r2.dev/v1/dynamic/color/"
NAMES = ['notebook', 'pencil', 'computer', 'headphone', 'trophy', 'calender', 'calculator', 'chart', 'file-text', 'tick', 'target', 'lab', 'bulb', 'video-camera', 'megaphone', 'rocket']
OUT = Path(__file__).resolve().parent / 'frontend/public/assets/illustrations/3d/cc0-3dicons'
OUT.mkdir(parents=True, exist_ok=True)
for name in NAMES:
    url=f"{BASE}{name}-dynamic-color.png"
    try:
        req=Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; CampusLearn-Education-Assets/1.0)'})
        with urlopen(req,timeout=30) as res: data=res.read()
        if data[:8]!=b'\x89PNG\r\n\x1a\n': raise RuntimeError('Ressource non PNG')
        (OUT / f'{name}.png').write_bytes(data)
        print('OK',name,len(data),'octets')
    except (URLError, HTTPError, RuntimeError) as exc:
        print('ECHEC',name,exc)
print('Licence de 3dicons V1 : CC0 — https://3dicons.co/about')
