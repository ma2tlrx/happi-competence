import { fontsReady, imagesReady, renderers, tl } from './engine.js';

await fontsReady();
const { buildAll, DURATION } = await import('./pn-scenes.js');
// Plan de montage des modules et mesures des vrais écrans captés (voir capture-pn.mjs)
const { modules } = await (await fetch('./modules-pn.json')).json();
const manifests = {};
for (const dir of new Set(modules.flatMap((m) => [m.dir, ...m.frames.map((f) => f.dir).filter(Boolean)]))) {
  manifests[dir] = await (await fetch(`./out/captures-pn/${dir}/manifest.json`)).json();
}
buildAll({ modules, manifests });
await imagesReady();
await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

window.__video = {
  duration: DURATION,
  seek(t) {
    tl.seek(t, false);
    for (const render of renderers) render(t);
  },
};
window.__video.seek(0);
window.__ready = true;
