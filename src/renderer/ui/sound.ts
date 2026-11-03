let context: AudioContext | null = null;
let ambient: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

function audio(): AudioContext {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function chime(kind: 'done' | 'error'): void {
  const ctx = audio();
  const notes = kind === 'done' ? [659.25, 987.77] : [392, 311.13];
  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + index * 0.12;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.55);
  });
}

export function setAmbient(enabled: boolean): void {
  if (!enabled) {
    ambient?.source.stop();
    ambient = null;
    return;
  }
  if (ambient) return;
  const ctx = audio();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = last * 0.985 + (Math.random() * 2 - 1) * 0.015;
    data[i] = last * 6;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 500;
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  ambient = { source, gain };
}
