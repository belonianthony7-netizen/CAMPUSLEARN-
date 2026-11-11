#!/bin/bash
cd "$(dirname "$0")"
python3 telecharger_open_doodles_cc0.py --all
printf '\nAppuyez sur Entrée pour fermer...'; read -r
