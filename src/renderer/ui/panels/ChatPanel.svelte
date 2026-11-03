<script lang="ts">
  import { tick } from 'svelte';
  import type { AgentTask, EffortLevel, Project, Settings } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import IdeMenu from '../IdeMenu.svelte';
  import { enhanceCodeBlocks, renderMarkdown } from '../markdown';
  import { ui } from '../state.svelte';
  import { voice } from '../voice.svelte';

  let { project, taskId = null, onclose }: { project: Project; taskId?: string | null; onclose: () => void } = $props();

  let selectedId = $state<string | null>(null);
  let draft = $state('');
  let thread = $state<HTMLElement>();
  let diff = $state<{ title: string; text: string } | null>(null);

  const conversations = $derived(ui.conversations.filter((c) => c.projectId === project.id));
  const CONVERSATION_LABEL = { running: 'En cours', unread: 'Non lue', open: 'Ouverte' } as const;

  function ago(at: number): string {
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 1) return "à l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    return `il y a ${Math.round(hours / 24)} j`;
  }

  const tasks = $derived(ui.projectTasks(project.id).slice().sort((a, b) => b.createdAt - a.createdAt));
  const selected = $derived<AgentTask | null>(tasks.find((t) => t.id === selectedId) ?? null);
  const busy = $derived(selected?.status === 'running' || selected?.status === 'queued');

  $effect(() => {
    selectedId = taskId ?? ui.latestTaskId(project.id);
  });

  $effect(() => {
    if (selected && !selected.acknowledged && selected.status !== 'running' && selected.status !== 'queued') {
      ui.acknowledge(selected.id);
    }
  });

  $effect(() => {
    void selected?.messages[selected.messages.length - 1]?.text;
    void tick().then(() => {
      if (thread) thread.scrollTop = thread.scrollHeight;
    });
  });

  async function send() {
    const prompt = draft.trim();
    if (!prompt) return;
    const continuing = selected && !busy && selected.sessionId && (selected.status === 'waiting' || selected.status === 'done');
    draft = '';
    const task = await ui.call(() => window.house.sendPrompt(project.id, prompt, continuing ? selected.id : undefined));
    if (task) {
      ui.setTask(task);
      selectedId = task.id;
    }
  }

  function startNew() {
    selectedId = null;
    diff = null;
  }

  async function showDiff(relPath?: string) {
    const text = await ui.call(() => window.house.gitDiff(project.id, relPath));
    if (text !== undefined) diff = { title: relPath ?? 'Tous les fichiers', text: text || 'Aucune différence avec le dernier commit.' };
  }

  function lineClass(line: string): string {
    if (line.startsWith('+') && !line.startsWith('+++')) return 'diff-line-add';
    if (line.startsWith('-') && !line.startsWith('---')) return 'diff-line-del';
    return '';
  }

  function enhance(node: HTMLElement) {
    enhanceCodeBlocks(node, (text) => void ui.call(() => window.house.copyText(text)));
  }

  const MODELS = [
    { id: 'fable', label: 'Fable' },
    { id: 'opus', label: 'Opus' },
    { id: 'sonnet', label: 'Sonnet' },
    { id: 'haiku', label: 'Haiku' },
  ];
  const EFFORTS: { id: EffortLevel; label: string }[] = [
    { id: 'low', label: 'bas' },
    { id: 'medium', label: 'moyen' },
    { id: 'high', label: 'élevé' },
    { id: 'xhigh', label: 'très élevé' },
    { id: 'max', label: 'maximal' },
  ];
  const model = $derived(ui.app?.settings.model ?? '');
  const effort = $derived(ui.app?.settings.effort ?? '');

  async function setOption<K extends 'model' | 'effort'>(key: K, value: Settings[K]) {
    const state = await ui.call(() => window.house.updateSettings({ [key]: value }));
    if (state) ui.app = state;
  }

  const VOICE_LABEL = $derived(
    voice.status === 'recording' ? 'Arrêter' : voice.status === 'transcribing' ? 'Transcription…' : voice.status === 'preparing' ? `Téléchargement ${Math.round(voice.progress * 100)} %` : 'Dicter',
  );

  function dictate() {
    void voice.toggle(
      (text) => (draft = draft.trim() ? `${draft.trimEnd()} ${text}` : text),
      (message) => ui.toast(message, 'error'),
    );
  }

  const STATUS_LABEL: Record<AgentTask['status'], string> = {
    queued: 'En file',
    running: 'En cours',
    waiting: 'Attend ta réponse',
    done: 'Terminé',
    error: 'Erreur',
    cancelled: 'Annulée',
  };
</script>

<GlassPanel title={project.name} eyebrow="Ordinateur · agent" color={project.color} {onclose}>
  <div class="tasks">
    <select class="select grow" aria-label="Tâche" bind:value={selectedId}>
      <option value={null}>Nouvelle conversation</option>
      {#each tasks as task (task.id)}
        <option value={task.id}>{STATUS_LABEL[task.status]} · {task.title}</option>
      {/each}
    </select>
    <button class="btn" onclick={startNew}>Nouvelle</button>
    <button class="btn" onclick={() => ui.openPanel({ kind: 'history', projectId: project.id })}>Historique</button>
  </div>

  {#if conversations.length > 0}
    <details class="desktop" open={conversations.some((c) => c.state !== 'open')}>
      <summary>
        Claude Desktop · {conversations.length} conversation{conversations.length > 1 ? 's' : ''} ouverte{conversations.length > 1 ? 's' : ''}
      </summary>
      <ul>
        {#each conversations as conversation (conversation.id)}
          <li>
            <button class="conversation" onclick={() => ui.openPanel({ kind: 'history', projectId: project.id, sessionId: conversation.sessionId })}>
              <span class="state" data-state={conversation.state}>{CONVERSATION_LABEL[conversation.state]}</span>
              <span class="grow truncate" title={conversation.title}>{conversation.title}</span>
              <span class="faint">{ago(conversation.lastActivity)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  {#if ui.claude && !ui.claude.available}
    <div class="notice">
      <strong>Claude Code n'est pas installé.</strong> L'agent tourne en mode démo, sans action réelle.
      <div class="path">npm install -g @anthropic-ai/claude-code</div>
      <button class="btn" onclick={async () => (ui.claude = (await ui.call(() => window.house.claudeStatus(true))) ?? ui.claude)}>Vérifier à nouveau</button>
    </div>
  {/if}

  <div class="thread scroll" bind:this={thread}>
    {#if diff}
      <div class="row">
        <strong class="grow truncate">Diff · {diff.title}</strong>
        <button class="btn btn-ghost" onclick={() => (diff = null)}>Retour</button>
      </div>
      <pre class="diff">{#each diff.text.split('\n') as line}<span class={lineClass(line)}>{line}</span>{'\n'}{/each}</pre>
    {:else if selected}
      {#each selected.messages as message, index (index)}
        <div class="msg {message.role}">
          {#if message.role === 'user'}
            {message.text}
          {:else}
            <div class="markdown" {@attach enhance}>{@html renderMarkdown(message.text)}</div>
          {/if}
        </div>
      {/each}
      {#if busy}
        <div class="progress faint"><span class="spinner"></span>{selected.progress}</div>
      {/if}
      {#if selected.error}
        <div class="error">{selected.error}</div>
      {/if}
      {#if selected.files.length > 0}
        <div class="card stack">
          <div class="label">Fichiers modifiés</div>
          {#each selected.files as file (file)}
            <div class="row">
              <span class="mono grow truncate" title={file}>{file}</span>
              <button class="btn btn-ghost" onclick={() => showDiff(file)}>Diff</button>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="intro">
        <h3>Salut, je m'occupe de {project.name}.</h3>
        <p class="muted">Écris une tâche : je m'installe à mon bureau et je lance Claude Code dans <span class="mono">{project.path}</span>.</p>
      </div>
    {/if}
  </div>

  <footer class="composer">
    <textarea
      class="textarea"
      rows="3"
      placeholder={selected?.status === 'waiting' ? 'Réponds à ton agent…' : 'Écrire une tâche…'}
      bind:value={draft}
      onkeydown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          void send();
        }
      }}
    ></textarea>
    <div class="row options">
      <select class="select" aria-label="Modèle" value={model} onchange={(event) => setOption('model', event.currentTarget.value)}>
        <option value="">Modèle par défaut</option>
        {#each MODELS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
        {#if model && !MODELS.some((m) => m.id === model)}
          <option value={model}>{model}</option>
        {/if}
      </select>
      <select class="select" aria-label="Effort" value={effort} onchange={(event) => setOption('effort', event.currentTarget.value as EffortLevel | '')}>
        <option value="">Effort par défaut</option>
        {#each EFFORTS as option (option.id)}
          <option value={option.id}>Effort {option.label}</option>
        {/each}
      </select>
    </div>
    <div class="row">
      <IdeMenu {project} />
      {#if selected?.files.length}
        <button class="btn" onclick={() => showDiff()}>Voir le diff</button>
      {/if}
      <button
        class="btn mic"
        class:recording={voice.status === 'recording'}
        disabled={voice.status === 'preparing' || voice.status === 'transcribing'}
        title="Dictée en français, traitée sur ta machine. La première fois, télécharge le modèle Whisper (77 Mo)."
        onclick={dictate}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {VOICE_LABEL}
      </button>
      <span class="grow"></span>
      {#if busy && selected}
        <button class="btn btn-danger" onclick={() => ui.call(() => window.house.cancelTask(selected.id))}>Annuler</button>
      {/if}
      <button class="btn btn-primary" disabled={!draft.trim()} onclick={send}>Envoyer</button>
    </div>
  </footer>
</GlassPanel>

<style>
  .tasks {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }

  .desktop {
    margin: 0 var(--space-4) var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 13px;
  }

  summary {
    cursor: pointer;
    font-weight: 600;
  }

  .desktop ul {
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-height: 132px;
    overflow-y: auto;
  }

  .desktop li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .mic {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .mic.recording {
    background: var(--badge-alert);
    border-color: var(--badge-alert);
    color: #fff;
  }

  .conversation {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 2px;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .conversation:hover {
    background: var(--surface);
  }

  .options .select {
    flex: 1;
    min-width: 0;
  }

  .state {
    flex: none;
    width: 58px;
    padding: 1px 0;
    border-radius: 999px;
    background: #8b8880;
    color: #fff;
    font: 600 10.5px var(--font-text);
    text-align: center;
  }

  .state[data-state='running'],
  .state[data-state='unread'] {
    background: var(--badge-alert);
  }

  .notice {
    margin: 0 var(--space-4) var(--space-3);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-radius: var(--radius-control);
    border: 1px solid var(--quest-waiting);
    background: var(--surface);
    font-size: 13px;
  }

  .thread {
    flex: 1;
    min-height: 0;
    padding: var(--space-1) var(--space-4) var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .msg {
    max-width: 92%;
    padding: 8px 12px;
    border-radius: 14px;
    font-size: 13.5px;
  }

  .msg.user {
    align-self: flex-end;
    background: var(--accent);
    color: var(--accent-contrast);
    white-space: pre-wrap;
    border-bottom-right-radius: 4px;
  }

  .msg.assistant {
    align-self: flex-start;
    background: var(--surface);
    border: 1px solid var(--line);
    border-bottom-left-radius: 4px;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .spinner {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--line);
    border-top-color: var(--quest-running);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    padding: 8px 12px;
    border-radius: var(--radius-control);
    border: 1px solid var(--quest-error);
    color: var(--quest-error);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .intro {
    margin: auto 0;
    text-align: center;
  }

  .intro p {
    overflow-wrap: anywhere;
  }

  .diff {
    margin: 0;
    padding: var(--space-3);
    background: var(--code-bg);
    border-radius: var(--radius-small);
    overflow-x: auto;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-4);
    border-top: 1px solid var(--line);
  }
</style>
