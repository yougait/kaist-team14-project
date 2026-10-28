'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../core.js');
const AT = '2026-10-28T03:00:00.000Z';
const start = f => K.freshState(f || K.FIXTURES.approved, 'test-card', AT);
const plan = s => K.savePlan(s, '2026-10-29', true, '2026-10-28', AT);

test('plan and check-in survive serialization without changing the source state', () => {
  const initial = start(), planned = plan(initial);
  const complete = K.saveCheckin(planned, 'partial', '계획 확인이 늦었다.', 'no', AT);
  const restored = K.validateState(JSON.parse(JSON.stringify(complete)));
  assert.equal(K.current(initial).plan, null);
  assert.equal(K.status(K.current(restored)), 'checked_in');
  assert.equal(K.current(restored).plan.date, '2026-10-29');
  assert.equal(K.current(restored).checkin.barrier, '계획 확인이 늦었다.');
  assert.equal(restored.events.length, 2);
  assert.throws(() => plan(restored), /이미/);
  assert.throws(() => K.saveCheckin(restored, 'done', '', 'no', AT), /이미/);
});
test('confirmation, valid calendar date, and nonpast date are mandatory only when planning', () => {
  assert.throws(() => K.savePlan(start(), '2026-10-29', false, '2026-10-28', AT), /확인/);
  for (const date of ['', '2026-02-30', '2026-10-27', '2026-13-01']) assert.throws(() => K.savePlan(start(), date, true, '2026-10-28', AT));
  assert.equal(K.validDate('2028-02-29'), true);
  assert.equal(K.validDate('2026-02-29'), false);
  const saved = K.savePlan(start(), '2026-10-28', true, '2026-10-28', AT);
  assert.equal(K.validateState(saved).records[0].plan.date, '2026-10-28');
});
test('pending review prevents planning; discomfort stops progression after retaining self report', () => {
  assert.equal(K.status(K.current(start(K.FIXTURES.pending))), 'review_required');
  assert.throws(() => plan(start(K.FIXTURES.pending)), /승인/);
  const reported = K.saveCheckin(plan(start()), 'done', '', 'yes', AT);
  assert.equal(K.status(K.current(reported)), 'review_required');
  assert.equal(K.current(reported).checkin.discomfort, 'yes');
  assert.throws(() => K.saveCheckin(reported, 'done', '', 'no', AT), /이미/);
});
test('null remains null; absent follow-up and differing tasks have explicit comparison reasons', () => {
  const missing = K.validateFixture(K.FIXTURES.missing);
  assert.equal(missing.metric.value, null);
  assert.deepEqual(missing.sensor_sides, ['left']);
  assert.match(K.comparison(missing), /지표 자료 없음/);
  assert.match(K.comparison(missing), /후속 측정 자료 없음/);
  assert.equal(K.comparison(K.FIXTURES.mismatch), '비교 보류: 과제 다름');
  const zero = K.clone(K.FIXTURES.approved); zero.metric.value = 0;
  assert.equal(K.validateFixture(zero).metric.value, 0);
});
test('new fixture preserves earlier plans but replaces unsaved drafts', () => {
  const saved = plan(start());
  const next = K.loadFixture(saved, K.FIXTURES.pending, 'next', AT);
  assert.equal(next.records.length, 2);
  const another = K.loadFixture(next, K.FIXTURES.missing, 'third', AT);
  assert.deepEqual(another.records.map(r => r.id), ['test-card', 'third']);
  assert.equal(another.records[0].plan.date, '2026-10-29');
});
test('real mode, unexpected personal fields, invalid types and sensor mismatch are rejected', () => {
  for (const patch of [{ mode: 'real' }, { participant_name: 'fake-person' }, { source: 'device' }, { sensor_sides: ['right'] }, { sensor_sides: ['left', 'left'] }]) {
    assert.throws(() => K.validateFixture({ ...K.clone(K.FIXTURES.approved), ...patch }));
  }
  const badNumber = K.clone(K.FIXTURES.approved); badNumber.metric.value = '34.2';
  assert.throws(() => K.validateFixture(badNumber));
  const rawText = K.clone(K.FIXTURES.approved); rawText.action.text = '<img src=x onerror=alert(1)>';
  assert.equal(K.validateFixture(rawText).action.text, rawText.action.text);
});
test('blocked storage never reports a saved candidate and does not mutate the active state', () => {
  const initial = start(), candidate = plan(initial);
  const storage = { setItem() { throw new Error('QuotaExceededError'); } };
  assert.throws(() => K.persist(storage, candidate), /QuotaExceededError/);
  assert.equal(K.current(initial).plan, null);
});
test('restoration rejects corrupt state and mismatched or duplicate event history', () => {
  assert.throws(() => K.restore({ getItem: () => '{broken' }));
  const saved = plan(start()); saved.events = [];
  assert.throws(() => K.validateState(saved), /일치/);
  const duplicate = plan(start()); duplicate.events.push(K.clone(duplicate.events[0]));
  assert.throws(() => K.validateState(duplicate), /중복/);
  const normal = plan(start());
  const store = new Map(); const adapter = { setItem: (k,v) => store.set(k,v), getItem: k => store.has(k) ? store.get(k) : null };
  K.persist(adapter, normal); assert.deepEqual(K.restore(adapter), normal);
});
