// earth's network — показ экрана в голосовых каналах и клипы (как на twitch)
// клип = последние ~15–30 секунд просмотра. два перекрывающихся рекордера по очереди,
// чтобы каждый кусок был самостоятельным валидным webm-файлом.

const SEG = 30000;
class ClipBuffer {
  constructor(stream) {
    this.stream = stream;
    this.slots = [null, null];
    this.mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => window.MediaRecorder?.isTypeSupported(m)) || '';
    this.dead = false;
    this.begin(0);
    this.phase = setTimeout(() => this.begin(1), SEG / 2);
  }
  begin(i) {
    if (this.dead) return;
    const chunks = [];
    let rec;
    try { rec = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_500_000 }); } catch { return; }
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.start(1000);
    const slot = { rec, chunks, t0: Date.now(), timer: setTimeout(() => this.cycle(i), SEG) };
    this.slots[i] = slot;
  }
  cycle(i) {
    const old = this.slots[i];
    if (old) { old.rec.onstop = null; try { old.rec.stop(); } catch {} }
    this.begin(i);
  }
  // самый «старый» активный рекордер даёт самый длинный клип
  clip() {
    const act = this.slots.map((s, i) => ({ s, i })).filter((x) => x.s && Date.now() - x.s.t0 > 3000).sort((a, b) => a.s.t0 - b.s.t0)[0];
    if (!act) return Promise.reject(new Error('подожди пару секунд — буфер ещё наполняется'));
    const { s, i } = act;
    clearTimeout(s.timer);
    return new Promise((res) => {
      s.rec.onstop = () => { res(new Blob(s.chunks, { type: 'video/webm' })); this.begin(i); };
      try { s.rec.stop(); } catch { res(new Blob(s.chunks, { type: 'video/webm' })); }
    });
  }
  stop() {
    this.dead = true;
    clearTimeout(this.phase);
    for (const s of this.slots) if (s) { clearTimeout(s.timer); s.rec.onstop = null; try { s.rec.stop(); } catch {} }
  }
}

function setWatch(key, stream, who) {
  const V = S.voice;
  if (!V) return;
  V.watch?.buf.stop();
  V.watch = { key, stream, who, buf: window.MediaRecorder ? new ClipBuffer(stream) : null };
  $('#vclip')?.classList.remove('hidden');
}
function clearWatch(key) {
  const V = S.voice;
  if (V?.watch && V.watch.key === key) { V.watch.buf?.stop(); V.watch = null; $('#vclip')?.classList.add('hidden'); }
}

async function startShare() {
  const V = S.voice;
  if (!V) return;
  let scr;
  try { scr = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true }); }
  catch { return; }
  V.screen = scr;
  V.videos ||= {};
  V.videos.me = { stream: scr, name: 'ты' };
  scr.getVideoTracks()[0].onended = () => stopShare();
  for (const [cid, pc] of Object.entries(V.pcs)) {
    scr.getTracks().forEach((t) => pc.addTrack(t, scr));
    await renegotiate(cid);
  }
  setWatch('me', scr, 'ты');
  renderVoiceView();
}
async function renegotiate(cid) {
  const V = S.voice, pc = V?.pcs[cid];
  if (!pc) return;
  try {
    const off = await pc.createOffer();
    await pc.setLocalDescription(off);
    V.ws.send(JSON.stringify({ type: 'offer', to: cid, sdp: pc.localDescription }));
  } catch {}
}
async function stopShare(leaving) {
  const V = S.voice;
  if (!V?.screen) return;
  const scr = V.screen;
  V.screen = null;
  scr.getTracks().forEach((t) => { t.onended = null; t.stop(); });
  clearWatch('me');
  delete V.videos?.me;
  if (leaving) return;
  for (const [cid, pc] of Object.entries(V.pcs)) {
    pc.getSenders().filter((s) => s.track && scr.getTracks().includes(s.track)).forEach((s) => { try { pc.removeTrack(s); } catch {} });
    await renegotiate(cid);
  }
  renderVoiceView();
}

function onRemoteVideo(cid, stream, track) {
  const V = S.voice;
  if (!V) return;
  V.videos ||= {};
  V.videos[cid] = { stream, name: V.peers[cid]?.name || 'участник' };
  const gone = () => { dropRemoteVideo(cid); };
  track.onended = gone; track.onmute = gone;
  stream.onremovetrack = gone;
  track.onunmute = () => { V.videos[cid] = { stream, name: V.peers[cid]?.name || 'участник' }; setWatch(cid, stream, V.videos[cid].name); renderVoiceView(); };
  setWatch(cid, stream, V.videos[cid].name);
  renderVoiceView();
}
function dropRemoteVideo(cid) {
  const V = S.voice;
  if (!V?.videos?.[cid]) return;
  delete V.videos[cid];
  clearWatch(cid);
  if (V.channelId === S.channel?.id) renderVoiceView();
}
function renderStage() {
  const V = S.voice, st = $('#stage');
  if (!V || !st) return;
  st.innerHTML = '';
  for (const [cid, v] of Object.entries(V.videos || {})) {
    const box = document.createElement('div');
    box.className = 'stage-item';
    const el = document.createElement('video');
    el.autoplay = true; el.playsInline = true; el.muted = cid === 'me';
    el.srcObject = v.stream;
    box.appendChild(el);
    box.insertAdjacentHTML('beforeend', `<span class="stage-name">${ic('screen')} ${esc(cid === 'me' ? 'твой экран' : v.name)}</span>`);
    st.appendChild(box);
  }
}

async function makeClip() {
  const w = S.voice?.watch;
  if (!w?.buf) return toast('запись клипов не поддерживается в этом браузере');
  const btn = $('#vclip');
  btn?.setAttribute('disabled', '');
  let blob;
  try { blob = await w.buf.clip(); } catch (e) { btn?.removeAttribute('disabled'); return toast(e.message); }
  btn?.removeAttribute('disabled');
  const url = URL.createObjectURL(blob);
  modal(`<h3>клип готов</h3><video src="${url}" controls playsinline class="clip-prev"></video>
    <div class="muted small">${(blob.size / 1048576).toFixed(1)} мб${S.config.files ? '' : ' · публикация станет доступна после включения r2'}</div>
    <textarea id="cl-text" rows="2" maxlength="300" placeholder="подпись к клипу (необязательно)"></textarea>
    <div class="error" id="m-err"></div>
    <div class="modal-actions"><a class="ghost-link" href="${url}" download="clip-${Date.now()}.webm">скачать</a><button class="ghost" id="m-cancel">отмена</button><button id="m-ok" ${S.config.files ? '' : 'disabled'}>опубликовать</button></div>`, (c) => {
    c.querySelector('#m-cancel').onclick = () => { closeModal(); URL.revokeObjectURL(url); };
    c.querySelector('#m-ok').onclick = async () => {
      const ok = c.querySelector('#m-ok');
      ok.disabled = true; ok.textContent = 'загрузка…';
      try {
        const att = await uploadFile(new File([blob], `clip-${Date.now()}.webm`, { type: 'video/webm' }));
        const text = c.querySelector('#cl-text').value.trim();
        await api('/posts', { body: { content: text || `клип из «${S.voice?.name || 'голосового канала'}»`, ...att } });
        closeModal(); toast('клип опубликован в ленте');
      } catch (er) { c.querySelector('#m-err').textContent = er.message; ok.disabled = false; ok.textContent = 'опубликовать'; }
    };
  });
}
