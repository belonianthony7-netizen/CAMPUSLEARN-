#!/usr/bin/env python3
"""Install optional CC0 illustration assets into CampusLearn's Angular public/ folder.

Usage:
    python tools/install_optional_cc0.py --all         # 33 SVG + 33 PNG Open Doodles + 16 PNG 3dicons
    python tools/install_optional_cc0.py --doodles     # 33 SVG + 33 PNG
    python tools/install_optional_cc0.py --icons3d     # 16 PNG
    python tools/install_optional_cc0.py --check       # offline inventory

Only downloads from two explicit CC0 asset hosts. No third-party libraries needed.
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import time
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ROOT=Path(__file__).resolve().parents[1]/'frontend/public/assets/illustrations'
DOODLES = ['unboxing','selfie','sprinting','coffee','dog-jump','loving','clumsy','rolling','running','reading','zombieing','ballet','float','meditating','moshing','sitting','strolling','roller-skating','ice-cream','jumping','reading-side','dancing','swinging','plant','sleek','bikini','Doggie','laying','groovy','sitting-reading','chilling','levitate','petting']
ICONS = ['notebook','pencil','computer','headphone','trophy','calender','calculator','chart','file-text','tick','target','lab','bulb','video-camera','megaphone','rocket']
URLS = [(f'https://opendoodles.s3-us-west-1.amazonaws.com/{name}.{ext}', ROOT/'open-doodles'/f'{name}.{ext}',ext) for name in DOODLES for ext in ('svg','png')]
URLS += [(f'https://pub-821312cfd07a4061bf7b99c1f23ed29b.r2.dev/v1/dynamic/color/{name}-dynamic-color.png',ROOT/'3d/cc0-3dicons'/f'{name}-dynamic-color.png','png') for name in ICONS]

def validate(data:bytes,kind:str)->bool:
    if len(data)<100:return False
    if kind=='png':return data.startswith(b'\x89PNG\r\n\x1a\n')
    try:
        return ElementTree.fromstring(data).tag.endswith('svg')
    except ElementTree.ParseError:return False

def download(entry)->tuple[str,bool,str]:
    url,target,kind=entry
    if target.exists() and validate(target.read_bytes(),kind):return target.name,True,'local'
    target.parent.mkdir(parents=True,exist_ok=True)
    for attempt in range(3):
        try:
            req=Request(url,headers={'User-Agent':'Mozilla/5.0 (CampusLearn Education Assets; CC0 download)'})
            with urlopen(req,timeout=30) as response:
                content=response.read()
            if not validate(content,kind):raise ValueError('Fichier incomplet / mauvais format')
            target.write_bytes(content)
            return target.name,True,f'{len(content)} octets'
        except Exception as exc:
            error=str(exc)
            if attempt<2:time.sleep(attempt+1)
    return target.name,False,error

def main()->None:
    parser=argparse.ArgumentParser(description=__doc__)
    scope=parser.add_mutually_exclusive_group(required=True)
    scope.add_argument('--all',action='store_true');scope.add_argument('--doodles',action='store_true');scope.add_argument('--icons3d',action='store_true');scope.add_argument('--check',action='store_true')
    args=parser.parse_args()
    files=URLS if (args.all or args.check) else URLS[:66] if args.doodles else URLS[66:]
    if args.check:
        count=sum(int(path.exists() and validate(path.read_bytes(),kind)) for _,path,kind in files)
        print(f'{count}/{len(files)} ressources CC0 installées localement. Les fichiers absents utilisent un secours ou la source officielle.')
        return
    with ThreadPoolExecutor(max_workers=5) as pool:
        outcomes=[future.result() for future in as_completed([pool.submit(download,f) for f in files])]
    ok=sum(int(success) for _,success,_ in outcomes)
    for filename,success,why in sorted(outcomes):print(('OK  ' if success else 'ÉCHEC '),filename,why)
    print(f'Bilan : {ok}/{len(files)} ressources téléchargées / vérifiées dans {ROOT}')
    if ok<len(files):raise SystemExit(1)

if __name__=='__main__':main()
