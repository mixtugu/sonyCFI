import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundEffects, createSoundObserver, deadlineRhythm } from './sound-effects.js';

const game = (overrides = {}) => ({ phase: 'ready', time: 0, walls: new Set(), items: [], ...overrides });

test('observes countdown, start, walls, encounters and finish exactly once across snapshots', () => {
  const heard = [], observer = createSoundObserver(name => heard.push(name));
  observer.update(game());
  for (const n of [3, 3, 2, 2, 1]) observer.update(game({ phase: 'countdown' }), n);
  const playing = game({ phase: 'playing' });
  observer.update(playing); observer.update(playing);
  const wall = { ...playing, time: 1, walls: new Set(['1:2']) };
  observer.update(wall); observer.update(wall);
  const caught = { ...wall, time: 2, items: [{ cell: 3, taken: true, damage: 2 }] };
  observer.update(caught); observer.update(caught);
  const result = { ...caught, phase: 'result' };
  observer.update(result); observer.update(result);
  assert.deepEqual(heard, ['countdown', 'countdown', 'countdown', 'start', 'wall', 'damage', 'finish']);
});

test('never infers hidden damage, and plays final encounters before finish', () => {
  const heard = [], observer = createSoundObserver(name => heard.push(name));
  observer.update(game({ phase: 'playing' }));
  observer.update(game({ phase: 'result', time: 1, items: [{ cell: 1, taken: true }] }));
  assert.deepEqual(heard, ['encounter', 'finish']);
});

test('initial join, repeated updates, reset and pause/resume do not replay sounds', () => {
  const heard = [], observer = createSoundObserver(name => heard.push(name));
  const current = game({ phase: 'playing', time: 10, walls: new Set(['1:2']), items: [{ cell: 1, taken: true }] });
  observer.update(current);
  observer.update({ ...current, phase: 'paused' });
  observer.update(current);
  observer.reset(); observer.update(current);
  observer.update(game()); observer.update(game());
  assert.deepEqual(heard, []);
});

test('swimming follows actual explorer movement, not held input or navigator snapshots', () => {
  for (const mode of ['parent', 'child', 'cpu']) {
    const heard = [], observer = createSoundObserver(name => heard.push(name));
    const state = avatar => game({ phase: 'playing', time: 1, mode, avatar });
    observer.update(state(15));
    observer.update(state(10)); observer.update(state(10));
    observer.update(state(5)); observer.update(state(5));
    assert.deepEqual(heard, mode === 'child' ? ['swim', 'swim'] : []);
  }
});

test('swim does not replay on join, resume, result, role change or reset', () => {
  const heard = [], observer = createSoundObserver(name => heard.push(name));
  const state = (phase, avatar, mode = 'child') => game({ phase, time: 1, mode, avatar });
  observer.update(state('playing', 15));
  observer.update(state('paused', 15));
  observer.update(state('playing', 10));
  observer.update(state('playing', 5, 'parent'));
  observer.update(state('playing', 0));
  observer.reset(); observer.update(state('playing', 1));
  observer.update(state('result', 2));
  assert.deepEqual(heard, ['finish']);
});

test('deadline music starts at exactly five seconds, accelerates, then bubbles replace it', () => {
  const heard = [], observer = createSoundObserver(name => heard.push(name));
  const state = time => game({ phase: 'playing', time, settings: { duration: 30 } });
  observer.update(state(24));
  observer.update(state(24.999));
  assert.deepEqual(heard, []);
  const perSecond = [];
  for (let second = 25; second < 30; second++) {
    const before = heard.length;
    for (let i = 0; i < 100; i++) {
      const current = state(second + i / 100);
      observer.update(current); observer.update(current);
    }
    perSecond.push(heard.length - before);
  }
  assert.equal(perSecond[0], 1);
  assert.ok(perSecond.at(-1) >= 2);
  assert.deepEqual(heard, Array(9).fill('alarm'));
  observer.update({ ...state(30), phase: 'result' });
  observer.update({ ...state(30), phase: 'result' });
  assert.deepEqual(heard, [...Array(9).fill('alarm'), 'bubbles']);
});

test('light and music share a progressively faster rhythm, capped at 2.5 pulses per second', () => {
  const periods = [5, 4, 3, 2, 1].map(remaining => deadlineRhythm(remaining).period);
  assert.deepEqual(periods, [1, .8, .65, .5, .4]);
  assert.ok(periods.every(period => 1 / period <= 2.5));
  for (const remaining of [6, 5.001, 0, -1, NaN]) assert.equal(deadlineRhythm(remaining), null);
  assert.equal(deadlineRhythm(5).beat, 0);
  assert.equal(deadlineRhythm(.001).beat, 8);
});

test('deadline respects pause, reset, short rounds and tutorial opt-out', () => {
  const heard = [], observer = createSoundObserver(name => heard.push(name));
  const state = (phase, time = 0) => game({ phase, time, settings: { duration: 5 } });
  observer.update(state('ready'));
  observer.update(state('countdown'), 3);
  observer.update(state('playing'));
  assert.deepEqual(heard, ['countdown', 'start', 'alarm']);
  observer.update(state('paused', .1)); observer.update(state('paused', .1));
  observer.update(state('playing', .1));
  assert.equal(heard.filter(name => name === 'alarm').length, 1);
  observer.update(state('playing', 1.1));
  assert.equal(heard.filter(name => name === 'alarm').length, 2);
  observer.reset(); observer.update(state('result', 5));
  assert.equal(heard.includes('bubbles'), false, 'joining a result does not replay timeout');
  const tutorial = createSoundObserver(name => heard.push(name), { deadline: false });
  heard.length = 0;
  tutorial.update(state('playing')); tutorial.update(state('playing', 1));
  assert.deepEqual(heard, []);
});

function setup(saved = null, failure = false) {
  const calls = [], errors = [], nodes = [];
  let stored = saved, created = 0;
  const param = () => ({
    value: 0,
    setValueAtTime: (...args) => calls.push(['set', ...args]),
    linearRampToValueAtTime: (...args) => calls.push(['linear', ...args]),
    exponentialRampToValueAtTime: (...args) => calls.push(['exponential', ...args]),
  });
  const context = {
    state: 'suspended', currentTime: 5, sampleRate: 48000, destination: {},
    createBuffer(channels, length, sampleRate) {
      assert.equal(channels, 1); assert.equal(sampleRate, 48000);
      return { duration: length / sampleRate, getChannelData: () => new Float32Array(length) };
    },
    createBiquadFilter() { return { frequency: param(), connect() {}, disconnect() {} }; },
    createBufferSource() {
      const source = {
        connect() {}, disconnect() {},
        start: time => calls.push(['noise-start', time]),
        stop: time => calls.push(['noise-stop', time]),
      };
      nodes.push(source); return source;
    },
    async resume() { this.state = 'running'; },
    createGain() { return { gain: param(), connect() {}, disconnect() {} }; },
    createOscillator() {
      const node = {
        frequency: param(), connect() {}, disconnect() {},
        start: time => calls.push(['start', time]),
        stop: time => calls.push(['stop', time]),
      };
      nodes.push(node); return node;
    },
  };
  const sound = createSoundEffects({
    storage: {
      getItem() { return stored; },
      setItem(key, value) { if (failure) throw new Error('storage blocked'); stored = value; },
    },
    createContext() { created++; return context; },
    report: (...args) => errors.push(args),
  });
  return { sound, calls, errors, nodes, context, get stored() { return JSON.parse(stored); }, get created() { return created; } };
}

test('audio is lazy, unlocked once, envelopes are bounded and every sound terminates', async () => {
  const run = setup();
  run.sound.play('wall'); assert.equal(run.created, 0);
  await run.sound.unlock(); await run.sound.unlock();
  assert.equal(run.created, 1);
  for (const name of ['confirm', 'move', 'countdown', 'start', 'wall', 'encounter', 'damage', 'finish']) run.sound.play(name);
  assert.equal(run.nodes.length, 12);
  assert.equal(run.calls.filter(call => call[0] === 'start').length, 12);
  assert.equal(run.calls.filter(call => call[0] === 'stop').length, 12);
  assert.ok(run.calls.filter(call => call[0] === 'linear').every(call => call[1] <= .85));
  assert.ok(run.calls.filter(call => call[0] === 'stop').every(call => call[1] <= 5.83));
  run.sound.configure({ enabled: false });
  const count = run.nodes.length; run.sound.play('finish');
  assert.equal(run.nodes.length, count);
  assert.equal(run.stored.enabled, false);
});

test('wall impact is lower, louder and longer than the previous 480 Hz impact', async () => {
  const run = setup();
  await run.sound.unlock(); run.sound.play('wall');
  assert.ok(run.calls.some(call => call[0] === 'linear' && call[1] === .85));
  assert.ok(run.calls.some(call => call[0] === 'set' && call[1] === 320));
  assert.ok(run.calls.some(call => call[0] === 'exponential' && call[1] === 140 && call[2] === 5.3));
});

test('swim combines a low water stroke with two short rising bubbles, obeying mute', async () => {
  const run = setup();
  await run.sound.unlock(); run.sound.play('swim');
  assert.equal(run.nodes.length, 3);
  assert.ok(run.calls.some(call => call[0] === 'set' && call[1] === 190));
  assert.ok(run.calls.some(call => call[0] === 'exponential' && call[1] === 85));
  assert.ok(run.calls.some(call => call[0] === 'exponential' && call[1] === 620));
  assert.ok(run.calls.filter(call => call[0] === 'linear').every(call => call[1] <= .22));
  assert.ok(run.calls.filter(call => call[0] === 'stop').every(call => call[1] <= 5.24));
  run.sound.configure({ enabled: false }); run.sound.play('swim');
  assert.equal(run.nodes.length, 3);
});

test('bubble sequence lasts two seconds and named stop cancels only alarms', async () => {
  const run = setup();
  await run.sound.unlock();
  run.sound.play('bubbles');
  assert.equal(run.nodes.length, 16);
  const ends = run.calls.filter(call => call[0] === 'stop').map(call => call[1]);
  assert.ok(Math.abs(Math.max(...ends) - 7) < .001);
  assert.ok(run.calls.filter(call => call[0] === 'linear').every(call => call[1] <= .28));
  run.sound.play('alarm');
  const before = run.calls.filter(call => call[0] === 'stop').length;
  run.sound.stop('alarm');
  assert.equal(run.calls.filter(call => call[0] === 'stop').length - before, 4);
  run.sound.stop();
  assert.equal(run.calls.filter(call => call[0] === 'stop').length - before, 20);
});

test('urgent music combines a bass pulse and a diminished arpeggio within the fastest beat', async () => {
  const run = setup();
  await run.sound.unlock(); run.sound.play('alarm');
  assert.equal(run.nodes.length, 4);
  assert.equal(run.nodes.filter(node => node.type === 'triangle').length, 3);
  assert.ok(run.calls.some(call => call[0] === 'set' && call[1] === 130.81));
  for (const frequency of [392, 466.16, 554.37]) {
    assert.ok(run.calls.some(call => call[0] === 'set' && call[1] === frequency));
  }
  assert.ok(run.calls.filter(call => call[0] === 'stop').every(call => call[1] < 5.4));
});

test('surfacing is a short filtered splash, stopped by mute and never played before unlock', async () => {
  const run = setup();
  run.sound.play('surface'); assert.equal(run.nodes.length, 0);
  await run.sound.unlock(); run.sound.play('surface');
  assert.equal(run.nodes.length, 1);
  assert.equal(run.nodes[0].buffer.duration, 1.25);
  assert.ok(run.calls.some(call => call[0] === 'noise-start' && call[1] === 5));
  assert.ok(run.calls.some(call => call[0] === 'noise-stop' && call[1] === 6.25));
  assert.ok(run.calls.some(call => call[0] === 'exponential' && call[1] === 4800));
  run.sound.configure({ enabled: false }); run.sound.play('surface');
  assert.equal(run.nodes.length, 1);
  assert.equal(run.calls.filter(call => call[0] === 'noise-stop').length, 2);
  run.nodes[0].onended();
});
test('preferences persist, zero volume mutes, and malformed storage is reported', async () => {
  const run = setup('{"enabled":false,"volume":200}');
  assert.deepEqual(run.sound.settings, { enabled: false, volume: 100 });
  assert.equal(await run.sound.unlock(), false);
  assert.equal(run.created, 0);
  run.sound.configure({ enabled: true, volume: 0 });
  assert.equal(await run.sound.unlock(), false);
  run.sound.configure({ volume: 25 });
  await run.sound.unlock(); run.sound.play('confirm');
  assert.deepEqual(run.stored, { enabled: true, volume: 25 });
  assert.equal(run.nodes.length, 1);
  const broken = setup('invalid', true);
  assert.equal(broken.errors.length, 1);
  broken.sound.configure({ enabled: false });
  assert.equal(broken.errors.length, 2);
});

test('unsupported audio reports an error instead of claiming playback succeeded', async () => {
  const errors = [];
  const sound = createSoundEffects({
    storage: { getItem: () => null, setItem() {} },
    createContext() { throw new Error('AudioContext unavailable'); },
    report: (...args) => errors.push(args),
  });
  assert.equal(await sound.unlock(), false);
  assert.equal(errors.length, 1);
});
