#!/usr/bin/env python3
"""Télécharge 33 SVG Open Doodles (CC0) depuis leurs URL officielles.
   Usage : python telecharger_open_doodles_cc0.py
           python telecharger_open_doodles_cc0.py --png
           python telecharger_open_doodles_cc0.py --all
"""
from pathlib import Path
import urllib.request, urllib.error, argparse, time, xml.etree.ElementTree as ET

NAMES = ['unboxing', 'selfie', 'sprinting', 'coffee', 'dog-jump', 'loving', 'clumsy', 'rolling', 'running', 'reading', 'zombieing', 'ballet', 'float', 'meditating', 'moshing', 'sitting', 'strolling', 'roller-skating', 'ice-cream', 'jumping', 'reading-side', 'dancing', 'swinging', 'plant', 'sleek', 'bikini', 'Doggie', 'laying', 'groovy', 'sitting-reading', 'chilling', 'levitate', 'petting']
BASE = 'https://opendoodles.s3-us-west-1.amazonaws.com/'

def download_file(name, ext, destination):
    url = BASE + name + '.' + ext
    target = destination/(name+'.'+ext)
    if target.is_file() and target.stat().st_size>200: print('Conservé :',target.name);return True
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (CampusLearn asset downloader)'})
            with urllib.request.urlopen(request,timeout=25) as resp:
                data=resp.read()
                if resp.status!=200: raise ValueError('HTTP '+str(resp.status))
            if ext=='svg': ET.fromstring(data)
            elif not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('PNG incorrect')
            if len(data)<100: raise ValueError('Fichier vide')
            target.write_bytes(data)
            print('OK:',target.name, len(data),'octets')
            return True
        except Exception as e:
            print('Erreur',url,repr(e))
            if attempt<2: time.sleep(1+attempt)
    return False

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--png', action='store_true', help='Télécharge les 33 PNG au lieu des SVG')
    parser.add_argument('--all', action='store_true', help='Télécharge les 33 SVG et les 33 PNG')
    parser.add_argument('--dest', default='frontend/public/assets/illustrations/open-doodles', help='Destination')
    args=parser.parse_args()
    dest=Path(args.dest);dest.mkdir(parents=True,exist_ok=True)
    exts=['svg','png'] if args.all else ['png'] if args.png else ['svg']
    total=0;ok=0
    for name in NAMES:
        for ext in exts:
            total+=1
            ok+=bool(download_file(name,ext,dest))
    print('Résultat:',ok,'/',total,'fichiers téléchargés vers',dest.resolve())
    print('Licence Open Doodles CC0 : https://opendoodles.com/')
    if ok!=total: raise SystemExit(1)

if __name__=='__main__':main()
