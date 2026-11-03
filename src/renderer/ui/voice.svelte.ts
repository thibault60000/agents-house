export type VoiceStatus = 'idle' | 'preparing' | 'recording' | 'transcribing';

const WORKER_IDLE_MS = 3 * 60_000;

class Voice {
  status = $state<VoiceStatus>('idle');
  progress = $state(0);
  private ready = false;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private worker: Worker | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private onText: ((text: string) => void) | null = null;

  async toggle(onText: (text: string) => void, onError: (message: string) => void): Promise<void> {
    if (this.status === 'recording') {
      this.recorder?.stop();
      return;
    }
    if (this.status !== 'idle') return;
    this.onText = onText;
    try {
      if (!this.ready) {
        this.status = 'preparing';
        this.progress = 0;
        const off = window.house.onVoiceProgress((fraction) => (this.progress = fraction));
        try {
          await window.house.prepareVoice();
        } finally {
          off();
        }
        this.ready = true;
      }
      await this.record(onError);
    } catch (error) {
      this.status = 'idle';
      onError(this.explain(error));
    }
  }

  private explain(error: unknown): string {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'NotFoundError')) return 'Micro indisponible : vérifie qu’il est branché et autorisé.';
    return error instanceof Error ? error.message : String(error);
  }

  private async record(onError: (message: string) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    this.chunks = [];
    const recorder = new MediaRecorder(this.stream);
    this.recorder = recorder;
    recorder.ondataavailable = (event) => this.chunks.push(event.data);
    recorder.onstop = () => {
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.recorder = null;
      this.status = 'transcribing';
      void this.transcribe()
        .then((text) => {
          if (text) this.onText?.(text);
        })
        .catch((error) => onError(this.explain(error)))
        .finally(() => (this.status = 'idle'));
    };
    recorder.start();
    this.status = 'recording';
  }

  private async transcribe(): Promise<string> {
    const context = new AudioContext({ sampleRate: 16000 });
    const buffer = await context.decodeAudioData(await new Blob(this.chunks).arrayBuffer());
    void context.close();
    const audio = buffer.getChannelData(0);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.worker ??= new Worker(new URL('./voice.worker.ts', import.meta.url), { type: 'module' });
    const worker = this.worker;
    try {
      return await new Promise<string>((resolve, reject) => {
        worker.onmessage = ({ data }) => (data.error ? reject(new Error(data.error)) : resolve(data.text));
        worker.onerror = (event) => reject(new Error(event.message || 'La reconnaissance vocale a échoué.'));
        worker.postMessage({ id: 1, audio });
      });
    } finally {
      this.idleTimer = setTimeout(() => {
        this.worker?.terminate();
        this.worker = null;
      }, WORKER_IDLE_MS);
    }
  }
}

export const voice = new Voice();
