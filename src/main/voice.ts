import { createWriteStream, promises as fs } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { app, net, protocol } from 'electron';

const MODEL = 'whisper-base';
const REPOSITORY = `https://huggingface.co/onnx-community/${MODEL}/resolve/main`;
const FILES = ['config.json', 'generation_config.json', 'preprocessor_config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/encoder_model_quantized.onnx', 'onnx/decoder_model_merged_quantized.onnx'];
const SCHEME = 'house-model';

function modelsDir(): string {
  return join(app.getPath('userData'), 'models');
}

export function registerVoiceScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
}

export function serveVoiceModels(): void {
  protocol.handle(SCHEME, async (request) => {
    const root = resolve(modelsDir());
    const file = resolve(root, `.${decodeURIComponent(new URL(request.url).pathname)}`);
    if (!file.startsWith(root + sep)) return new Response('Interdit', { status: 403 });
    const response = await net.fetch(pathToFileURL(file).toString()).catch(() => null);
    if (!response?.ok) return new Response('Introuvable', { status: 404 });
    return new Response(response.body, { headers: { 'content-type': 'application/octet-stream', 'access-control-allow-origin': '*' } });
  });
}

let preparing: Promise<void> | null = null;

async function download(onProgress: (fraction: number) => void): Promise<void> {
  const dir = join(modelsDir(), MODEL);
  const marker = join(dir, '.complete');
  if (await fs.stat(marker).catch(() => null)) return;
  await fs.mkdir(join(dir, 'onnx'), { recursive: true });

  const responses = await Promise.all(FILES.map((file) => net.fetch(`${REPOSITORY}/${file}`)));
  const failed = responses.findIndex((r) => !r.ok);
  if (failed >= 0) throw new Error(`Téléchargement du modèle vocal refusé (${responses[failed]?.status}).`);
  const total = responses.reduce((sum, r) => sum + (Number(r.headers.get('content-length')) || 0), 0);
  let received = 0;
  for (const [index, file] of FILES.entries()) {
    const part = join(dir, `${file}.part`);
    const body = Readable.fromWeb((responses[index] as Response).body as never);
    body.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (total) onProgress(Math.min(1, received / total));
    });
    await pipeline(body, createWriteStream(part));
    await fs.rename(part, join(dir, file));
  }
  await fs.writeFile(marker, '');
}

export function prepareVoice(onProgress: (fraction: number) => void): Promise<void> {
  preparing ??= download(onProgress).finally(() => {
    preparing = null;
  });
  return preparing;
}
