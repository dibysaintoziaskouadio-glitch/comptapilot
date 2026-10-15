"""
Voix off de synthèse (voix féminine fictive, service neuronal Microsoft Edge via edge-tts).

Chaque phrase du scénario (video/scenario.js) est générée séparément puis placée à son instant exact (voix.a),
si bien que la voix tombe sur les bonnes images. Si une phrase déborde sur la suivante, son débit est accéléré
jusqu'à ce qu'elle tienne (au plus +25 %).

Usage : ~/.local/share/comptapilot-outils/venv/bin/python video/voix-off.py [--voix fr-FR-DeniseNeural]
Sortie : video/voix.wav (utilisée automatiquement par video/rendre.js)
"""
import asyncio, json, re, subprocess, sys, tempfile
from pathlib import Path

import edge_tts
import imageio_ffmpeg

ICI = Path(__file__).parent
VOIX = sys.argv[sys.argv.index('--voix') + 1] if '--voix' in sys.argv else 'fr-FR-DeniseNeural'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
MARGE = 0.35  # silence minimal (s) avant la phrase suivante


def scenario():
    js = (ICI / 'scenario.js').read_text(encoding='utf-8')
    corps = js[js.index('{', js.index('window.SCENARIO')) : js.rindex('}') + 1]
    corps = re.sub(r'//.*', '', corps)
    corps = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', corps)  # clés JS → JSON
    corps = corps.replace("'", '"')
    corps = re.sub(r',(\s*[}\]])', r'\1', corps)
    return json.loads(corps)


def duree(fichier: Path) -> float:
    sortie = subprocess.run([FFMPEG, '-i', str(fichier)], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', sortie).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


async def generer(texte: str, cible: Path, debit: int) -> float:
    await edge_tts.Communicate(texte, VOIX, rate=f'{debit:+d}%', pitch='+0Hz').save(str(cible))
    return duree(cible)


async def principal():
    sc = scenario()
    scenes = sc['scenes']
    with tempfile.TemporaryDirectory() as tmp:
        morceaux = []
        for i, s in enumerate(scenes):
            debut = s['voix']['a']
            limite = (scenes[i + 1]['voix']['a'] if i + 1 < len(scenes) else sc['duree']) - debut - MARGE
            f = Path(tmp) / f'{i}.mp3'
            debit = 0
            d = await generer(s['voix']['texte'], f, debit)
            while d > limite and debit < 25:
                debit += 5
                d = await generer(s['voix']['texte'], f, debit)
            etat = 'ok' if d <= limite else 'DÉBORDE'
            print(f'  {s["id"]:<9} à {debut:5.1f} s · {d:4.1f} s / {limite:4.1f} s disponibles · débit {debit:+d} % · {etat}')
            morceaux.append((f, debut))

        entrees = sum((['-i', str(f)] for f, _ in morceaux), [])
        filtres = ''.join(f'[{k}:a]adelay={int(a * 1000)}|{int(a * 1000)}[v{k}];' for k, (_, a) in enumerate(morceaux))
        filtres += ''.join(f'[v{k}]' for k in range(len(morceaux))) + f'amix=inputs={len(morceaux)}:normalize=0,apad,atrim=0:{sc["duree"]}[sortie]'
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', *entrees, '-filter_complex', filtres, '-map', '[sortie]', '-ar', '48000', '-ac', '2', str(ICI / 'voix.wav')], check=True)
    print(f'✓ video/voix.wav — voix {VOIX}, {sc["duree"]} s')


asyncio.run(principal())
