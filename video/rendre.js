/**
 * Rendu de la vidéo de présentation : capture image par image de presentation.html (1920 × 1080, 60 i/s),
 * puis assemblage H.264 avec la voix enregistrée (voix.webm, voix.wav, voix.m4a ou voix.mp3 dans video/).
 * Sans fichier de voix, produit une version muette (pour valider l'image).
 *
 * Usage : node video/rendre.js [--ips 60]   (PARALLELE=4 onglets de capture par défaut)
 * Sortie : video/comptapilot-presentation.mp4
 * ffmpeg : variable FFMPEG, sinon celui d'imageio-ffmpeg installé dans ~/.local/share/comptapilot-outils.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');

const RACINE = path.join(__dirname, '..');
const IPS = Number(process.argv[process.argv.indexOf('--ips') + 1]) || 60;
const SORTIE = path.join(__dirname, 'comptapilot-presentation.mp4');

function trouverFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const py = path.join(process.env.HOME, '.local/share/comptapilot-outils/venv/bin/python');
  return execFileSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
}

/** Petit serveur de fichiers statiques sur la racine du dépôt (les pages chargent ../node_modules et ../frontend). */
function serveur() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const s = http.createServer((req, res) => {
    const f = path.join(RACINE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] ?? 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s)));
}

(async () => {
  const ffmpeg = trouverFfmpeg();
  const voix = ['voix.wav', 'voix.webm', 'voix.m4a', 'voix.mp3', 'voix.ogg'].map((n) => path.join(__dirname, n)).find((f) => fs.existsSync(f));
  const srv = await serveur();
  const url = `http://127.0.0.1:${srv.address().port}/video/presentation.html`;
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', timeout: 20000 });
  // Plusieurs onglets capturent en parallèle ; les images sont envoyées à ffmpeg dans l'ordre.
  const PARALLELE = Number(process.env.PARALLELE) || 4;
  const pages = await Promise.all(
    Array.from({ length: PARALLELE }, async () => {
      const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
      await p.goto(url, { waitUntil: 'networkidle' });
      await p.evaluate(() => window.pret);
      return p;
    }),
  );
  const duree = await pages[0].evaluate(() => window.SCENARIO.duree);
  const total = Math.round(duree * IPS);

  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(IPS), '-c:v', 'mjpeg', '-i', '-'];
  if (voix) args.push('-i', voix);
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart');
  if (voix) args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-t', String(duree));
  args.push(SORTIE + '.partiel.mp4');
  const enc = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });

  const t0 = Date.now();
  const enAttente = new Map();
  let prochaine = 0;
  let suivante = 0;
  const ecrire = async () => {
    while (enAttente.has(prochaine)) {
      const img = enAttente.get(prochaine);
      enAttente.delete(prochaine);
      if (!enc.stdin.write(img)) await new Promise((r) => enc.stdin.once('drain', r));
      prochaine++;
    }
  };
  let verrou = Promise.resolve();
  await Promise.all(
    pages.map(async (p) => {
      for (;;) {
        const i = suivante++;
        if (i >= total) return;
        await p.evaluate((t) => window.aller(t), i / IPS);
        enAttente.set(i, await p.screenshot({ type: 'jpeg', quality: 92 }));
        verrou = verrou.then(ecrire);
        await verrou;
        if (i % IPS === 0) process.stdout.write(`\r  image ${i}/${total} (${Math.round(((Date.now() - t0) / (i + 1)) * (total - i) / 1000)} s restantes)   `);
      }
    }),
  );
  enc.stdin.end();
  await new Promise((r, j) => enc.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg a échoué')))));
  fs.renameSync(SORTIE + '.partiel.mp4', SORTIE); // le fichier final n'apparaît que complet
  await b.close();
  srv.close();
  console.log(`\n✓ ${path.relative(RACINE, SORTIE)} — ${duree} s, ${IPS} i/s, ${voix ? 'voix : ' + path.basename(voix) : 'sans voix (aucun fichier voix.* dans video/)'}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
