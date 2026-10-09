import {scenarios, sample, initialState, update} from './demo-model.mjs';

const $ = selector => document.querySelector(selector);
let state = initialState();
const current = () => state.work[state.scenario];
const status = text => { $('#demo-status').textContent = text; };

function render({fields = false} = {}) {
  const work = current();
  document.querySelectorAll('[data-scenario]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scenario === state.scenario)));
  $('#scenario-description').textContent = scenarios[state.scenario].description;
  if (fields) { $('#intent').value = work.intent; $('#change').value = work.change; }
  for (const id of ['a','b']) {
    const selected = work.selected === id;
    $('#candidate-' + id).classList.toggle('is-selected', selected);
    $('#selected-' + id).hidden = !selected;
    document.querySelector('[data-choose="' + id + '"]').setAttribute('aria-pressed', String(selected));
  }
  $('#selection-message').textContent = work.selected ? `${work.selected.toUpperCase()} yönü korundu. Sonraki turda yalnız bir şeyi değiştir.` : 'Önce bir yön seç. Kararını verirken acele etme.';
  $('#change').disabled = !work.selected;
  $('#prepare-revision').disabled = !work.selected;
  $('#brief-result').hidden = !work.brief;
  $('#brief-text').textContent = work.brief || '';
  $('#download-brief').disabled = !work.brief;
}
document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => {
  state = update(state, {type: 'scenario', id: button.dataset.scenario});
  render({fields: true}); status('Bu başlangıca ait niyet ve seçim gösteriliyor. Yeni ses üretilmedi.');
}));
document.querySelectorAll('[data-choose]').forEach(button => button.addEventListener('click', () => {
  state = update(state, {type: 'select', id: button.dataset.choose}); render();
  status('Örnek yön seçildi. Şimdi yalnızca değiştirmek istediğin şeyi tarif et.');
}));
for (const id of ['intent','change']) $('#' + id).addEventListener('input', () => {
  const previousBrief = current().brief;
  state = update(state, {type: id, value: $('#' + id).value}); render();
  if (previousBrief) status('Metin değişti; eski brief gizlendi. Güncel taslağı yeniden hazırla.');
});
$('#revision-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    state = update(state, {type:'revision'}); render();
    status('Seçimin ve tek değişiklik taslakta birleşti. Yeni ses veya DAW işlemi başlatılmadı.');
    $('#result-title').focus({preventScroll:true});
    $('#brief-result').scrollIntoView({block:'nearest'});
  } catch { status('Önce bir yön seç, niyetini ve tek değişikliği yaz.'); }
});
$('#copy-brief').addEventListener('click', async () => {
  if (!current().brief) return;
  try { await navigator.clipboard.writeText(current().brief); status('Brief kopyalandı. Saklayabilir veya üretim adımında kullanabilirsin.'); }
  catch { status('Kopyalama izni yok. Brief metnini seçip elle kopyalayabilirsin.'); }
});
$('#download-brief').addEventListener('click', () => {
  const brief = current().brief;
  if (!brief) return;
  const url = URL.createObjectURL(new Blob([brief], {type: 'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url; link.download = 'novtrak-ornek-brief.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  status('Brief metin dosyası olarak indirildi. Hiçbir veri gönderilmedi.');
});
$('#reset').addEventListener('click', () => { stopAudio(); state = initialState(); render({fields:true}); status('Örnek başa alındı. Gerçek projen üzerinde bir işlem yapılmadı.'); });

// Exactly one owned audio run. Tokens protect pending resume from stale callbacks.
let runCounter = 0, activeRun = null;
function audioButtons(kind = null) {
  $('#ambient').setAttribute('aria-pressed', String(kind === 'ambient'));
  $('#ambient-label').textContent = kind === 'ambient' ? 'Sesi kapat' : 'Sesi aç';
  document.body.classList.toggle('playing', !!kind);
  document.querySelectorAll('[data-listen]').forEach(button => {
    const id = button.dataset.listen, playing = kind === id;
    button.setAttribute('aria-pressed', String(playing));
    button.textContent = playing ? `${id.toUpperCase()} · Durdur ■` : `${id === 'a' ? 'A’yı' : 'B’yi'} dinle ▶`;
  });
}
function dispose(run) {
  clearTimeout(run.timer);
  for (const node of run.sources) { try { node.stop(); } catch {} try { node.disconnect(); } catch {} }
  try { run.gain.gain.cancelScheduledValues(run.context.currentTime); run.gain.gain.value = 0; run.gain.disconnect(); } catch {}
  if (run.context.state !== 'closed') run.context.close().catch(() => {});
}
function stopAudio() {
  runCounter++;
  const previous = activeRun; activeRun = null;
  if (previous) dispose(previous);
  audioButtons();
  if (previous?.kind === 'ambient') $('#sound-status').textContent = 'Tarayıcı tonu durduruldu.';
  else if (previous) status(`${previous.kind.toUpperCase()} örneği durduruldu.`);
}
async function play(kind) {
  if (activeRun?.kind === kind) { stopAudio(); return; }
  stopAudio();
  const token = ++runCounter;
  let run;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('unsupported_audio');
    const context = new Context(), gain = context.createGain();
    gain.gain.value = 0; gain.connect(context.destination);
    run = {context, gain, sources: [], kind, token, timer: null}; activeRun = run;
    await context.resume();
    if (token !== runCounter || activeRun !== run || document.hidden) {
      if (activeRun === run) stopAudio(); else dispose(run);
      return;
    }
    const start = context.currentTime + .025;
    if (kind === 'ambient') {
      gain.gain.setTargetAtTime(.035, start, .25);
      [110,164.81,220].forEach((frequency, i) => {
        const osc = context.createOscillator(), voice = context.createGain();
        osc.type = 'sine'; osc.frequency.value = frequency;
        voice.gain.value = i === 0 ? .55 : .15;
        osc.connect(voice); voice.connect(gain); osc.start(start); run.sources.push(osc);
      });
      $('#sound-status').textContent = 'Tarayıcı tonu çalıyor. Sayfadan ayrıldığında durur.';
    } else {
      const config = sample[kind];
      gain.gain.setValueAtTime(.08, start);
      sample.frequencies.forEach((frequency, i) => {
        const osc = context.createOscillator(), envelope = context.createGain();
        const time = start + config.beats[i] * 60 / sample.bpm;
        osc.type = 'sine'; osc.frequency.value = frequency;
        envelope.gain.setValueAtTime(0, time);
        envelope.gain.linearRampToValueAtTime(config.velocities[i], time + .012);
        envelope.gain.exponentialRampToValueAtTime(.001, time + .42);
        osc.connect(envelope); envelope.connect(gain); osc.start(time); osc.stop(time + .44); run.sources.push(osc);
      });
      run.timer = setTimeout(() => {
        if (activeRun === run && token === runCounter) { stopAudio(); status(`${kind.toUpperCase()} örneği bitti. Diğer yönle karşılaştırabilirsin.`); }
      }, (sample.duration + .05) * 1000);
      status(`${kind.toUpperCase()} tarayıcı motifi çalıyor. Bu ses bir ürün çıktısı değildir.`);
    }
    audioButtons(kind);
  } catch {
    if (activeRun === run) stopAudio();
    else if (run) dispose(run);
    if (token === runCounter || !activeRun) {
      const text = 'Ses bu tarayıcıda açılamadı. Metin ve seçim akışıyla devam edebilirsin.';
      $('#sound-status').textContent = text; status(text);
    }
  }
}
$('#ambient').addEventListener('click', () => play('ambient'));
document.querySelectorAll('[data-listen]').forEach(button => button.addEventListener('click', () => play(button.dataset.listen)));
document.addEventListener('visibilitychange', () => {
  document.body.classList.toggle('visual-paused', document.hidden);
  if (document.hidden) { stopAudio(); $('#sound-status').textContent = 'Ses durduruldu; yeniden açmak için düğmeye bas.'; }
});
window.addEventListener('pagehide', stopAudio);
window.addEventListener('pageshow', () => { if (!activeRun) audioButtons(); });
for (let i = 0; i < 42; i++) $('#hero-wave').append(document.createElement('i'));
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => { for (const entry of entries) $('#hero-wave').classList.toggle('visual-paused', !entry.isIntersecting); }).observe($('#hero-wave'));
}
render(); $('#demo-desk').hidden = false;
