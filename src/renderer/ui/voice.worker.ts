import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.localModelPath = 'house-model://models/';
const onnx = env.backends.onnx.wasm as NonNullable<typeof env.backends.onnx.wasm>;
onnx.wasmPaths = { wasm: new URL(wasm, self.location.href).href, mjs: new URL(mjs, self.location.href).href };
onnx.numThreads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));

let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

self.onmessage = async ({ data }: MessageEvent<{ id: number; audio: Float32Array }>) => {
  try {
    recognizer ??= pipeline('automatic-speech-recognition', 'whisper-base', { dtype: 'q8', device: 'wasm' }) as Promise<AutomaticSpeechRecognitionPipeline>;
    const run = await recognizer;
    const result = await run(data.audio, { language: 'french', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    self.postMessage({ id: data.id, text: (Array.isArray(result) ? result[0]?.text : result.text)?.trim() ?? '' });
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) });
  }
};
