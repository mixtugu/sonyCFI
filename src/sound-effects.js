const STORAGE_KEY = 'maze-sound';
const DEFAULTS = { enabled: true, volume: 35 };
const SOUNDS = {
  confirm: [[0, 620, 920, .09, .22]],
  move: [[0, 420, 560, .065, .12]],
  swim: [[0, 190, 85, .22, .22], [.055, 280, 620, .14, .12], [.12, 210, 390, .1, .08]],
  countdown: [[0, 440, 380, .12, .25]],
  start: [[0, 523, 523, .16, .22], [.12, 784, 784, .25, .2]],
  wall: [[0, 320, 140, .3, .85]],
  encounter: [[0, 660, 880, .16, .22], [.11, 990, 1100, .22, .16]],
  damage: [[0, 220, 110, .22, .23]],
  finish: [[0, 523, 523, .3, .2], [.18, 659, 659, .3, .18], [.36, 784, 1047, .45, .16]],
  alarm: [[0, 130.81, 98, .3, .3], [.06, 392, 392, .085, .18, 'triangle'],
    [.15, 466.16, 466.16, .085, .18, 'triangle'], [.24, 554.37, 554.37, .085, .18, 'triangle']],
  bubbles: Array.from({ length: 16 }, (_, i) => {
    const frequency = 160 + (i * 73 % 260);
    return [i * .12, frequency, frequency * 2.2, .18, .28];
  }),
};

export function deadlineRhythm(remaining) {
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > 5) return null;
  const periods = [1, .8, .65, .5, .4];
  const elapsed = 5 - remaining, stage = Math.min(4, Math.floor(elapsed));
  // Integrate tempo changes so a new second never inserts an extra beat.
  const phase = periods.slice(0, stage).reduce((sum, period) => sum + 1 / period, 0)
    + (elapsed - stage) / periods[stage];
  return { period: periods[stage], beat: Math.floor(phase + 1e-9) };
}

export function createSoundObserver(play, { deadline = true } = {}) {
  let previous = null;
  return {
    reset() { previous = null; },
    update(game, countdown = 0) {
      const current = {
        phase: game.phase, time: game.time, walls: game.walls.size, countdown,
        avatar: game.avatar, mode: game.mode,
        taken: new Set(game.items.filter(item => item.taken).map(item => item.cell)),
        remaining: deadline && Number.isFinite(game.settings?.duration) ? Math.ceil(game.settings.duration - game.time) : null,
        rhythm: deadline ? deadlineRhythm(game.settings?.duration - game.time) : null,
      };
      const before = previous;
      previous = current;
      // Rejoining a running room must not replay its history.
      if (!before || current.time < before.time || current.walls < before.walls) return;
      if (current.phase === 'countdown' && countdown > 0
        && (before.phase !== 'countdown' || before.countdown !== countdown)) play('countdown');
      if (current.phase === 'playing' && ['ready', 'countdown'].includes(before.phase)) play('start');
      if (current.phase === 'playing' && current.rhythm
        && (current.rhythm.beat !== before.rhythm?.beat || ['ready', 'countdown'].includes(before.phase))) play('alarm');
      if (['playing', 'result'].includes(current.phase) && before.phase === 'playing') {
        if (current.phase === 'playing' && current.mode === 'child' && before.mode === 'child'
          && Number.isInteger(before.avatar) && current.avatar !== before.avatar) play('swim');
        if (current.walls > before.walls) play('wall');
        const fresh = game.items.filter(item => item.taken && !before.taken.has(item.cell));
        // Only use damage already visible to this role; the explorer must not learn hidden HP.
        if (fresh.length) play(fresh.some(item => item.damage > 0) ? 'damage' : 'encounter');
      }
      if (current.phase === 'result' && before.phase !== 'result') play(current.remaining !== null && current.remaining <= 0 ? 'bubbles' : 'finish');
    },
  };
}

export function createSoundEffects({ storage, createContext, report }) {
  let settings = { ...DEFAULTS }, context = null, master = null, resuming = null;
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
    if (typeof saved?.enabled === 'boolean') settings.enabled = saved.enabled;
    if (Number.isFinite(saved?.volume)) settings.volume = Math.min(100, Math.max(0, saved.volume));
  } catch (error) { report('効果音の設定を読み込めませんでした。', error); }
  const active = new Map();
  function stop(name) {
    for (const [oscillator, effect] of active) {
      if (name && effect !== name) continue;
      oscillator.stop(); active.delete(oscillator);
    }
  }
  function configure(next) {
    settings = { ...settings, ...next };
    if (!settings.enabled || settings.volume === 0) stop();
    if (master) master.gain.setValueAtTime(settings.enabled ? settings.volume / 100 : 0, context.currentTime);
    try { storage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    catch (error) { report('効果音の設定を保存できませんでした。', error); }
  }
  async function unlock() {
    if (!settings.enabled || settings.volume === 0) return false;
    try {
      if (!context) {
        context = createContext();
        master = context.createGain();
        master.gain.value = settings.volume / 100;
        master.connect(context.destination);
      }
      if (context.state === 'suspended') {
        resuming ||= context.resume().finally(() => { resuming = null; });
        await resuming;
      }
      return context.state === 'running';
    } catch (error) {
      report('効果音を再生できません。画面をクリックしてから再度お試しください。', error);
      return false;
    }
  }
  function surfaceSplash() {
    const duration = 1.25, at = context.currentTime;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, at);
    filter.frequency.exponentialRampToValueAtTime(4800, at + .08);
    filter.frequency.exponentialRampToValueAtTime(450, at + duration);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(.65, at + .045);
    gain.gain.exponentialRampToValueAtTime(.16, at + .35);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    active.set(source, 'surface');
    source.onended = () => { active.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(at); source.stop(at + duration);
  }
  function play(name) {
    if (!settings.enabled || settings.volume === 0 || context?.state !== 'running') return;
    if (name === 'surface') { surfaceSplash(); return; }
    const notes = SOUNDS[name];
    if (!notes) throw new Error(`Unknown sound effect: ${name}`);
    for (const [delay, frequency, endFrequency, duration, level, waveform = 'sine'] of notes) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const at = context.currentTime + delay;
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
      oscillator.connect(gain); gain.connect(master);
      active.set(oscillator, name);
      oscillator.onended = () => { active.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at); oscillator.stop(at + duration + .02);
    }
  }
  return { get settings() { return { ...settings }; }, configure, unlock, play, stop };
}
