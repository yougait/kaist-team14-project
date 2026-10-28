(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Kneech = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'kneech.hw6.yougait.v1';
  const ACTION = { id: 'observe-and-record', text: '다음 러닝에서 평소와 다른 느낌이 있었는지 관찰하고, 끝난 뒤 한 줄로 기록한다.' };
  const normal = { schema_version: 1, mode: 'synthetic', session_id: 'DEMO-RUN-001', movement_type: 'run', source: 'synthetic', sensor_sides: ['left', 'right'], metric: { label: '정강이 분절 움직임 범위', value: 34.2, unit: '°', side: 'left' }, review_status: 'approved', action: ACTION };
  const FIXTURES = {
    approved: normal,
    pending: { ...normal, session_id: 'DEMO-PENDING-002', review_status: 'pending' },
    missing: { ...normal, session_id: 'DEMO-MISSING-003', sensor_sides: ['left'], metric: { ...normal.metric, value: null } },
    mismatch: { ...normal, session_id: 'DEMO-WALK-004', movement_type: 'walk_figure8', followup: { movement_type: 'run', metric: { ...normal.metric, value: 35.1 } } }
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  function fail(message) { throw new Error(message); }
  function obj(value, label) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + ' 형식이 올바르지 않습니다.'); }
  function keys(value, allowed, label) { obj(value, label); if (Object.keys(value).some(k => !allowed.includes(k))) fail(label + '에 허용되지 않은 필드가 있습니다. 실제 식별정보를 넣지 마세요.'); }
  function text(value, max, label) { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(label + '을 확인해 주세요.'); return value.trim(); }
  function one(value, values, label) { if (!values.includes(value)) fail(label + '을 확인해 주세요.'); return value; }
  function validateMetric(value) {
    keys(value, ['label', 'value', 'unit', 'side'], '측정값');
    if (!(value.value === null || (typeof value.value === 'number' && Number.isFinite(value.value)))) fail('측정값은 숫자 또는 null이어야 합니다.');
    return { label: text(value.label, 80, '지표 이름'), value: value.value, unit: text(value.unit, 20, '단위'), side: one(value.side, ['left', 'right'], '측정 방향') };
  }
  function validateFixture(value) {
    keys(value, ['schema_version', 'mode', 'session_id', 'movement_type', 'source', 'sensor_sides', 'metric', 'review_status', 'action', 'followup'], '입력 자료');
    if (value.schema_version !== 1 || value.mode !== 'synthetic' || value.source !== 'synthetic') fail('schema_version 1인 합성 데이터(synthetic)만 사용할 수 있습니다. 실제 자료는 불러오지 않습니다.');
    if (!Array.isArray(value.sensor_sides) || !value.sensor_sides.length || value.sensor_sides.length > 2 || new Set(value.sensor_sides).size !== value.sensor_sides.length || value.sensor_sides.some(x => !['left', 'right'].includes(x))) fail('센서 방향은 left 또는 right의 중복 없는 배열이어야 합니다.');
    keys(value.action, ['id', 'text'], '행동');
    const result = { schema_version: 1, mode: 'synthetic', session_id: text(value.session_id, 80, '가상 세션 ID'), movement_type: one(value.movement_type, ['run', 'walk_figure8'], '과제 종류'), source: 'synthetic', sensor_sides: [...value.sensor_sides], metric: validateMetric(value.metric), review_status: one(value.review_status, ['approved', 'pending'], '검토 상태'), action: { id: text(value.action.id, 80, '행동 ID'), text: text(value.action.text, 300, '행동 내용') } };
    if (!result.sensor_sides.includes(result.metric.side)) fail('측정 방향과 센서 방향이 일치하지 않습니다.');
    if (value.followup !== undefined) {
      keys(value.followup, ['movement_type', 'metric'], '후속 자료');
      result.followup = { movement_type: one(value.followup.movement_type, ['run', 'walk_figure8'], '후속 과제'), metric: validateMetric(value.followup.metric) };
    }
    return result;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y,m,d] = value.split('-').map(Number);
    if (y < 1900 || y > 9999) return false;
    const date = new Date(0); date.setUTCFullYear(y,m-1,d); date.setUTCHours(0,0,0,0);
    return date.getUTCFullYear() === y && date.getUTCMonth() === m-1 && date.getUTCDate() === d;
  }
  function today(date = new Date()) { return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-'); }
  function timestamp(value) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail('기록 시간이 올바르지 않습니다.'); return value; }
  function freshState(fixture = normal, id = 'draft-1', at = new Date().toISOString()) {
    return { version: 1, current_id: id, records: [{ id, fixture: validateFixture(fixture), created_at: timestamp(at), plan: null, checkin: null }], events: [] };
  }
  function current(state) { const record = state.records.find(r => r.id === state.current_id); if (!record) fail('현재 카드를 찾을 수 없습니다.'); return record; }
  function status(record) { return record.fixture.review_status !== 'approved' || (record.checkin && record.checkin.discomfort === 'yes') ? 'review_required' : record.checkin ? 'checked_in' : record.plan ? 'planned' : 'ready'; }
  function comparison(f) {
    const reasons = [];
    if (f.followup && f.movement_type !== f.followup.movement_type) reasons.push('과제 다름');
    if (f.metric.value === null || (f.followup && f.followup.metric.value === null)) reasons.push('지표 자료 없음');
    if (!f.followup) reasons.push('후속 측정 자료 없음');
    else if (!reasons.length) reasons.push('비교 기준 검토 전');
    return '비교 보류: ' + reasons.join(' · ');
  }
  function validateState(raw) {
    keys(raw, ['version', 'current_id', 'records', 'events'], '저장 자료');
    if (raw.version !== 1 || !Array.isArray(raw.records) || !raw.records.length || raw.records.length > 500 || !Array.isArray(raw.events) || raw.events.length > 1500) fail('저장 자료의 버전 또는 기록 수를 확인해 주세요.');
    const ids = new Set();
    const records = raw.records.map(r => {
      keys(r, ['id', 'fixture', 'created_at', 'plan', 'checkin'], '카드');
      const id = text(r.id, 100, '카드 ID'); if (ids.has(id)) fail('중복 카드가 있습니다.'); ids.add(id);
      const f = validateFixture(r.fixture);
      let plan = null, checkin = null;
      if (r.plan !== null) {
        keys(r.plan, ['date', 'confirmed', 'saved_at'], '계획');
        if (!validDate(r.plan.date) || r.plan.confirmed !== true || f.review_status !== 'approved') fail('저장된 계획이 올바르지 않습니다.');
        plan = { date: r.plan.date, confirmed: true, saved_at: timestamp(r.plan.saved_at) };
      }
      if (r.checkin !== null) {
        keys(r.checkin, ['execution', 'barrier', 'discomfort', 'saved_at'], '체크인');
        if (!plan || typeof r.checkin.barrier !== 'string' || r.checkin.barrier.length > 300) fail('저장된 체크인이 올바르지 않습니다.');
        checkin = { execution: one(r.checkin.execution, ['done', 'partial', 'not_done'], '실행 상태'), barrier: r.checkin.barrier, discomfort: one(r.checkin.discomfort, ['no', 'yes'], '새 불편'), saved_at: timestamp(r.checkin.saved_at) };
      }
      return { id, fixture: f, created_at: timestamp(r.created_at), plan, checkin };
    });
    const eventIds = new Set();
    const events = raw.events.map(e => {
      keys(e, ['id','record_id','type','at'], '변경 기록');
      const id = text(e.id, 150, '이벤트 ID'); if (eventIds.has(id)) fail('중복 이벤트가 있습니다.'); eventIds.add(id);
      if (!ids.has(e.record_id)) fail('이벤트가 존재하지 않는 카드를 참조합니다.');
      const type = one(e.type, ['loaded', 'planned', 'checked_in'], '이벤트 종류');
      if (id !== e.record_id + ':' + type) fail('이벤트 ID가 올바르지 않습니다.');
      return { id, record_id: e.record_id, type, at: timestamp(e.at) };
    });
    if (!ids.has(raw.current_id)) fail('현재 카드 참조가 올바르지 않습니다.');
    for (const r of records) {
      if (Boolean(r.plan) !== eventIds.has(r.id + ':planned') || Boolean(r.checkin) !== eventIds.has(r.id + ':checked_in')) fail('계획·체크인과 변경 기록이 일치하지 않습니다.');
    }
    return { version: 1, current_id: raw.current_id, records, events };
  }
  function event(state, recordId, type, at) {
    const id = recordId + ':' + type;
    if (state.events.some(e => e.id === id)) fail('이미 저장된 기록입니다.');
    state.events.push({ id, record_id: recordId, type, at });
  }
  function loadFixture(state, fixture, id, at = new Date().toISOString()) {
    const next = clone(state);
    const record = freshState(fixture, id, at).records[0];
    if (next.records.some(r => r.id === id)) fail('중복 카드 ID입니다.');
    // Unplanned drafts have no user record to retain.
    next.records = next.records.filter(r => r.plan);
    const kept = new Set(next.records.map(r => r.id));
    next.events = next.events.filter(e => kept.has(e.record_id));
    next.records.push(record); next.current_id = id; event(next, id, 'loaded', at);
    return validateState(next);
  }
  function savePlan(state, date, confirmed, localToday = today(), at = new Date().toISOString()) {
    const next = clone(state), r = current(next);
    if (status(r) !== 'ready') fail(r.plan ? '이 카드의 계획은 이미 저장되었습니다.' : '승인된 행동이 없어 담당자 검토가 필요합니다.');
    if (confirmed !== true) fail('실행할 행동을 확인해 주세요.');
    if (!validDate(date) || !validDate(localToday) || date < localToday) fail('오늘 또는 미래의 올바른 실행 날짜를 선택해 주세요.');
    r.plan = { date, confirmed: true, saved_at: at }; event(next, r.id, 'planned', at);
    return validateState(next);
  }
  function saveCheckin(state, execution, barrier, discomfort, at = new Date().toISOString()) {
    const next = clone(state), r = current(next);
    if (status(r) !== 'planned') fail(r.checkin ? '이 카드의 체크인은 이미 저장되었습니다.' : '먼저 승인된 행동과 실행 날짜를 저장해 주세요.');
    if (typeof barrier !== 'string' || barrier.length > 300) fail('어려움은 300자 이내로 입력해 주세요.');
    r.checkin = { execution: one(execution, ['done','partial','not_done'], '실행 상태'), barrier: barrier.trim(), discomfort: one(discomfort, ['no','yes'], '새 불편 여부'), saved_at: at };
    event(next, r.id, 'checked_in', at); return validateState(next);
  }
  function persist(storage, state) { const validated = validateState(state); storage.setItem(STORAGE_KEY, JSON.stringify(validated)); return validated; }
  function restore(storage) { const raw = storage.getItem(STORAGE_KEY); return raw === null ? null : validateState(JSON.parse(raw)); }
  return { STORAGE_KEY, FIXTURES, clone, validateFixture, validDate, today, freshState, current, status, comparison, validateState, loadFixture, savePlan, saveCheckin, persist, restore };
});
