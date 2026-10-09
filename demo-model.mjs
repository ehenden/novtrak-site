// Deterministic illustrative state. It never generates music or calls a service.
export const scenarios = Object.freeze({
  idea: {description: 'Bir yön ararken aynı fikrin farklı söyleyişlerini karşılaştır.', intent: 'Melodi aynı kalsın; cümlelerin arasına biraz daha alan açılsın.', name: 'Bir fikirden başla'},
  keep: {description: 'Bir performansı beğendiğinde yeni bir yön seçmek, onun kimliğini silmemeli.', intent: 'Seçtiğim performansı ve sözleri koru. Yalnız aranjmanın ona bıraktığı alanı değiştir.', name: 'İyi olanı koru'},
  revise: {description: 'Neyi beğenmediğini bütün bir parçaya yayma. Tek bir değişikliği ayrı tarif et.', intent: 'Önceki fikri koru. Yalnız son cümlenin vurgusunu yeniden düşün.', name: 'Tek bir değişiklik'}
});
export const sample = Object.freeze({
  bpm: 96, duration: 3.2,
  frequencies: Object.freeze([293.66, 349.23, 440, 349.23, 329.63, 293.66]),
  a: Object.freeze({beats: Object.freeze([0, .5, 1, 2, 3, 4]), velocities: Object.freeze([.68,.65,.72,.68,.62,.65])}),
  b: Object.freeze({beats: Object.freeze([0, .25, .75, 2, 2.5, 4]), velocities: Object.freeze([.64,.58,.7,.64,.6,.83])})
});
export function initialState() {
  return {scenario: 'idea', work: Object.fromEntries(Object.entries(scenarios).map(([id, s]) => [id, {intent: s.intent, selected: null, change: '', brief: null}]))};
}
export function update(state, action) {
  if (action.type === 'scenario') {
    if (!Object.hasOwn(scenarios, action.id)) throw new Error('invalid_scenario');
    return {...state, scenario: action.id};
  }
  const next = structuredClone(state), current = next.work[next.scenario];
  if (action.type === 'select') {
    if (!['a','b'].includes(action.id)) throw new Error('invalid_candidate');
    if (current.selected !== action.id) { current.selected = action.id; current.brief = null; }
  } else if (action.type === 'intent' || action.type === 'change') {
    if (typeof action.value !== 'string' || action.value.length > 500) throw new Error('text_limit');
    if (current[action.type] !== action.value) { current[action.type] = action.value; current.brief = null; }
  } else if (action.type === 'revision') {
    if (!current.selected) throw new Error('selection_required');
    if (!current.intent.trim() || !current.change.trim()) throw new Error('intent_and_change_required');
    current.brief = ['NOVTRAK / ÖRNEK ÇALIŞMA BRIEF’İ',
      'Bu bir akış örneğidir. Gerçek şarkı veya yeni ses üretilmedi.',
      '', `Başlangıç: ${scenarios[next.scenario].name}`, `Niyet: ${current.intent}`,
      `Korunan yön: ${current.selected === 'a' ? 'A — Alan bırak.' : 'B — Vurguyu değiştir.'}`,
      'Değişmesin: melodi, sözler ve kaynak performans.',
      `Bu turda tek değişiklik: ${current.change}`,
      '', 'Önceki seçim korunur. Yeni aday ayrı değerlendirilir.',
      'Uygulama veya ses üretimi başlamadı. Müzikal sonuç insan dinlemesiyle değerlendirilir.'].join('\n');
  } else throw new Error('unknown_action');
  return next;
}
