/* Local-only synthetic-data prototype. */
(function () {
  'use strict';
  const K = window.Kneech, $ = id => document.getElementById(id);
  const labels = { ready: '계획 전', planned: '계획 저장됨', checked_in: '체크인 완료', review_required: '담당자 검토 필요', done: '실행함', partial: '일부 실행', not_done: '실행하지 않음', run: '러닝', walk_figure8: '8자 보행', left: '왼쪽', right: '오른쪽' };
  let counter = 0, corrupted = false, state = K.freshState(K.FIXTURES.approved, newId());
  function newId() { return 'card-' + Date.now() + '-' + (++counter) + '-' + Math.random().toString(36).slice(2,8); }
  function note(message, error = false) { $('message').hidden = false; $('message').textContent = message; $('message').classList.toggle('error', error); }
  function el(tag, text, cls) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (cls) node.className = cls; return node; }
  function commit(next, message) {
    if (corrupted) { note('저장된 자료가 손상되어 있습니다. 테스트 자료 초기화를 확인한 뒤 다시 시작해 주세요.', true); return false; }
    try { state = K.persist(window.localStorage, next); render(); note(message); return true; }
    catch (error) { note('저장하지 못했습니다. 기존 기록은 유지됩니다. 브라우저 저장 허용 여부와 남은 공간을 확인해 주세요. (' + error.message + ')', true); return false; }
  }
  function operation(fn, message) { try { commit(fn(), message); } catch (error) { note(error.message, true); } }
  function fact(label, value, cls) { const row = el('div', undefined, cls); row.append(el('dt', label), el('dd', value)); $('facts').append(row); }
  function addSummary(target, pairs) { const box = $(target); box.replaceChildren(); pairs.forEach(([label,value]) => box.append(el('p', label + ': ' + value))); box.hidden = false; }
  function render() {
    const r = K.current(state), f = r.fixture, s = K.status(r), approved = f.review_status === 'approved';
    $('state-badge').textContent = labels[s]; $('state-badge').classList.toggle('warning', s === 'review_required');
    $('action-text').textContent = approved ? f.action.text : '승인된 행동이 없습니다.';
    $('approval-note').textContent = approved ? '데모 자료 안에서 사전 승인된 행동 한 가지입니다. 실제 전문가의 승인이나 처방이 아닙니다.' : '미승인 자료입니다. 새로운 교정 행동을 생성하거나 계획을 저장하지 않습니다.';
    $('review-notice').hidden = s !== 'review_required';
    $('review-notice').textContent = r.checkin && r.checkin.discomfort === 'yes' ? '새로운 불편이 기록되었습니다. 담당자 검토가 필요하며 다음 자동 진행과 행동 변경은 제공하지 않습니다.' : '담당자 검토 필요: 승인된 행동이 없어 진행을 멈춥니다.';
    $('plan-form').hidden = !!r.plan;
    $('action-confirm').disabled = !approved;
    $('plan-date').disabled = !approved;
    $('save-plan').disabled = !approved;
    $('action-confirm').checked = !!r.plan;
    $('plan-date').min = K.today(); $('plan-date').value = r.plan ? r.plan.date : '';
    $('plan-summary').hidden = !r.plan;
    if (r.plan) addSummary('plan-summary', [['실행 날짜', r.plan.date], ['선택한 행동', f.action.text]]);
    $('facts').replaceChildren();
    fact('가상 세션', f.session_id); fact('과제', labels[f.movement_type]); fact('출처', '합성 데이터 데모');
    fact('센서 방향', f.sensor_sides.map(x => labels[x]).join(' · ') + (f.sensor_sides.length === 1 ? ' (단측)' : ''));
    fact(f.metric.label, f.metric.value === null ? '자료 없음' : String(f.metric.value) + ' ' + f.metric.unit + ' (' + labels[f.metric.side] + ')', 'metric-row');
    fact('검토 상태', approved ? '가상 승인됨' : '미승인');
    if (f.sensor_sides.length === 1) fact('좌우 비교', '단측 자료로 좌우 비대칭을 산출하지 않음');
    $('comparison').textContent = K.comparison(f);
    $('checkin-fields').disabled = s !== 'planned'; $('checkin-form').hidden = !!r.checkin;
    $('checkin-form').reset();
    $('checkin-helper').textContent = r.checkin ? '자가보고 기록입니다. 센서 측정 결과나 건강 개선의 증거가 아닙니다.' : r.plan ? '가상 실행 후 상황을 입력해 보세요. 저장한 체크인은 같은 카드에 한 번만 기록됩니다.' : '먼저 오늘의 카드에서 계획을 저장해 주세요.';
    $('checkin-summary').hidden = !r.checkin;
    if (r.checkin) addSummary('checkin-summary', [['실행 상태', labels[r.checkin.execution]], ['어려웠던 점', r.checkin.barrier || '기록 없음'], ['새로운 불편', r.checkin.discomfort === 'yes' ? '있음 · 담당자 검토 필요' : '없음']]);
    $('step-one').classList.toggle('active', s === 'ready' || (!r.plan && s === 'review_required'));
    $('step-two').classList.toggle('active', s === 'planned'); $('step-three').classList.toggle('active', !!r.checkin);
    renderHistory();
  }
  function renderHistory() {
    const host = $('history'); host.replaceChildren();
    const records = state.records.filter(r => r.plan).slice().reverse();
    if (!records.length) { host.append(el('p', '아직 저장한 계획이 없습니다. 위에서 첫 계획을 만들어 보세요.', 'empty-history')); return; }
    records.forEach(r => {
      const item = el('article', undefined, 'history-item'), date = el('div'), body = el('div');
      date.append(el('h3', r.plan.date), el('p', '합성 데이터 데모', 'history-meta'));
      body.append(el('p', r.fixture.action.text), el('p', '과제: ' + labels[r.fixture.movement_type] + ' · ' + r.fixture.session_id, 'history-meta'));
      if (r.checkin) {
        body.append(el('p', '실행 상태: ' + labels[r.checkin.execution] + ' (자가보고)'), el('p', '어려웠던 점: ' + (r.checkin.barrier || '기록 없음')));
        body.append(el('p', '새로운 불편: ' + (r.checkin.discomfort === 'yes' ? '있음 · 담당자 검토 필요' : '없음'), r.checkin.discomfort === 'yes' ? 'needs-review' : ''));
      } else body.append(el('p', '실행 후 체크인을 기다리고 있습니다.', 'history-meta'));
      body.append(el('p', K.comparison(r.fixture), 'history-meta')); item.append(date,body); host.append(item);
    });
  }
  function importText(raw) {
    if (raw.length > 100000) { note('입력 자료는 100KB 이내로 제한합니다.', true); return; }
    operation(() => K.loadFixture(state, K.validateFixture(JSON.parse(raw)), newId()), '합성 자료를 불러왔습니다. 기존에 저장한 계획은 지난 기록에 남아 있습니다.');
  }
  $('load-demo').addEventListener('click', () => operation(() => K.loadFixture(state, K.FIXTURES[$('scenario').value], newId()), '데모 자료를 불러왔습니다.'));
  $('plan-form').addEventListener('submit', event => { event.preventDefault(); operation(() => K.savePlan(state, $('plan-date').value, $('action-confirm').checked), '계획을 이 브라우저에 저장했습니다. 새로고침해도 다시 볼 수 있습니다.'); });
  $('checkin-form').addEventListener('submit', event => {
    event.preventDefault(); const execution = document.querySelector('input[name="execution"]:checked'), discomfort = document.querySelector('input[name="discomfort"]:checked');
    operation(() => K.saveCheckin(state, execution ? execution.value : '', $('barrier').value, discomfort ? discomfort.value : ''), '실행 기록을 저장했습니다. 지난 기록에서 계획과 함께 확인할 수 있습니다.');
  });
  $('import-json').addEventListener('click', () => importText($('json-input').value));
  $('json-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 100000) note('파일은 100KB 이내로 제한합니다.', true);
    else { try { importText(await file.text()); } catch (error) { note('파일을 읽지 못했습니다: ' + error.message, true); } }
    event.target.value = '';
  });
  $('print').addEventListener('click', () => window.print());
  $('reset').addEventListener('click', () => {
    if (!window.confirm('이 프로토타입에 저장된 가상 계획과 체크인을 모두 지울까요? 다른 사이트의 기록은 지우지 않습니다.')) return;
    try { window.localStorage.removeItem(K.STORAGE_KEY); state = K.freshState(K.FIXTURES.approved, newId()); corrupted = false; $('scenario').value = 'approved'; render(); note('이 프로토타입의 테스트 자료를 초기화했습니다.'); }
    catch (error) { note('초기화하지 못했습니다. 기존 기록을 유지합니다. (' + error.message + ')', true); }
  });
  try { const restored = K.restore(window.localStorage); if (restored) state = restored; }
  catch (error) { corrupted = true; note('저장 자료를 읽지 못했습니다. 자료가 손상되었거나 브라우저 저장이 차단됐을 수 있습니다. 저장된 내용을 덮어쓰지 않았습니다. 초기화를 확인한 뒤 다시 시작해 주세요. (' + error.message + ')', true); }
  render();
})();
