import { fontsReady, imagesReady, renderers, tl } from './engine.js';

await fontsReady();
const { buildAll } = await import('./scenes.js');
buildAll();
await imagesReady();
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

window.__video = {
  duration: 58,
  seek(t) {
    tl.seek(t, false);
    for (const render of renderers) render(t);
  },
};
window.__video.seek(0);
window.__ready = true;
