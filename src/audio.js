// WebAudio player for the embedded CC0 samples (window.CC_SOUNDS, base64 mp3) – works via file://
let ctx = null, master = null, musicGain = null, music = null, bufs = {}, ready = false, muted = false;
export const log = [];           // [{n, t}] game-time stamped sfx log (used by the promo video renderer)
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
// iOS Safari: create/resume inside the tap, play a 1-sample silent buffer (unlocks output), ask for 'playback' (ignores the mute switch)
function kick(c) { try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {} }
export function audioState() { return ctx ? ctx.state : 'none'; }
export async function unlock() {
  try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); kick(ctx); if (ctx.state !== 'running') ctx.resume().catch(() => {}); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
  const src = window.CC_SOUNDS || {};
  await Promise.all(Object.keys(src).map(k => new Promise(res => {
    try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); }
  })));
  ready = true; window.__ccAudioReady = Object.keys(bufs).length;
}
export function play(n, vol = 1, rate = 1, delay = 0) {
  log.push({ n, t: clock() + delay, v: vol, r: rate });
  if (!ready || !bufs[n]) return;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(master); s.start(ctx.currentTime + delay);
}
export function startMusic() {
  log.push({ n: 'music_main', t: clock(), v: 1, r: 1, loop: 1 });
  if (!ready || music) return;
  music = ctx.createBufferSource(); music.buffer = bufs.music_main; music.loop = true; music.connect(musicGain); music.start();
}
export function stopMusic() { log.push({ n: '__stopmusic', t: clock() }); if (music) { try { music.stop(); } catch (e) {} music = null; } }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
export function isMuted() { return muted; }
export const sfx = {
  catch(c) { play(Math.random() < .5 ? 'candy_a' : 'candy_b', .9, .95 + Math.min(c, 20) * .012); if (c > 0 && c % 5 === 0) play('chime_c', .55, .9 + Math.min(c, 30) * .01); },
  gold() { play('harp', .7); play('sparkle', .6); play('candy_a', .8, .8); },
  spider() { play('squish_a', .9, .8); play('impact', .8, .85); },
  miss() { play('soft', .35, 1.3); },
  combo(c) { play('magic', .45, 1 + Math.min(c, 30) * .006); },
  start(kids) { play('stinger', .7); if (kids) play('laugh_kids', .5, 1, .4); },
  end(best) { play('bell', .6, .9); play(best ? 'success' : 'choir', .6); },
  ui() { play('soft', .4, 1.5); }
};
