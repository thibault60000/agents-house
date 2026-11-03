<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { HistorySession, HistorySource, HistoryTranscript } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { enhanceCodeBlocks, renderMarkdown } from '../markdown';
  import { ui } from '../state.svelte';

  let { initialProject = null, initialSession = null, onclose }: { initialProject?: string | null; initialSession?: string | null; onclose: () => void } = $props();

  const PAGE = 120;
  const SOURCE_LABEL: Record<HistorySource, string> = { desktop: 'Claude Desktop', vscode: 'VS Code', terminal: 'Terminal', other: 'Autre' };

  let sessions = $state.raw<HistorySession[] | null>(null);
  let query = $state('');
  const start = untrack(() => ({ project: initialProject, session: initialSession }));
  let source = $state<HistorySource | 'all'>(start.project ? 'all' : 'desktop');
  let projectId = $state<string | 'all'>(start.project ?? 'all');
  let openId = $state<string | null>(start.session);
  let transcript = $state.raw<HistoryTranscript | null>(null);
  let loading = $state(false);
  let visible = $state(PAGE);
  let reader = $state<HTMLElement>();

  $effect(() => {
    void ui.call(() => window.house.listHistory()).then((list) => {
      sessions = list ?? [];
    });
  });

  const filtered = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    return (sessions ?? []).filter(
      (s) =>
        (source === 'all' || s.source === source) &&
        (projectId === 'all' || s.projectId === projectId) &&
        (!needle || s.title.toLowerCase().includes(needle) || s.cwd.toLowerCase().includes(needle)),
    );
  });

  let request = 0;
  $effect(() => {
    const id = openId;
    const current = ++request;
    transcript = null;
    visible = PAGE;
    if (!id) return;
    loading = true;
    void ui.call(() => window.house.readHistory(id)).then(async (result) => {
      if (current !== request) return;
      loading = false;
      transcript = result ?? null;
      await tick();
      if (reader) reader.scrollTop = reader.scrollHeight;
    });
  });

  const shown = $derived(transcript ? transcript.messages.slice(-visible) : []);

  function projectName(id: string | null): string | null {
    return id ? (ui.project(id)?.name ?? null) : null;
  }

  function folderName(cwd: string): string {
    return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd;
  }

  function when(at: number): string {
    return new Date(at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function enhance(node: HTMLElement) {
    enhanceCodeBlocks(node, (text) => void ui.call(() => window.house.copyText(text)));
  }

  async function resume() {
    if (!transcript) return;
    const task = await ui.call(() => window.house.resumeHistory(transcript!.session.id));
    if (!task) return;
    ui.setTask(task);
    ui.world?.focusAgent(task.projectId);
    ui.openPanel({ kind: 'chat', projectId: task.projectId, taskId: task.id });
  }
</script>

<GlassPanel title="Discussions" eyebrow="Historique Claude Code et Desktop" wide reader {onclose}>
  <div class="layout">
    <aside class="side">
      <input class="input" type="search" placeholder="Rechercher un titre ou un dossier" aria-label="Rechercher" bind:value={query} />
      <div class="filters">
        <select class="select" aria-label="Origine" bind:value={source}>
          <option value="desktop">Claude Desktop</option>
          <option value="all">Toutes les origines</option>
          <option value="vscode">VS Code</option>
          <option value="terminal">Terminal</option>
          <option value="other">Autre</option>
        </select>
        <select class="select" aria-label="Pièce" bind:value={projectId}>
          <option value="all">Toutes les pièces</option>
          {#each ui.projects as project (project.id)}
            <option value={project.id}>{project.name}</option>
          {/each}
        </select>
      </div>
      <div class="list scroll">
        {#if sessions === null}
          <p class="empty faint"><span class="spinner"></span> Lecture de l'historique…</p>
        {:else if filtered.length === 0}
          <p class="empty faint">Aucune discussion avec ces filtres.</p>
        {/if}
        {#each filtered as session (session.id)}
          <button class="item" class:open={session.id === openId} onclick={() => (openId = session.id)}>
            <span class="item-title">{session.title}</span>
            <span class="item-meta faint truncate">
              {projectName(session.projectId) ?? folderName(session.cwd)} · {when(session.lastActivity)}
            </span>
            <span class="tags">
              <span class="tag">{SOURCE_LABEL[session.source]}</span>
              {#if session.live}<span class="tag live">En cours</span>{/if}
              {#if session.archived}<span class="tag">Archivée</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    </aside>

    <section class="main">
      {#if transcript}
        <header class="head">
          <div class="grow">
            <h3 class="truncate" title={transcript.session.title}>{transcript.session.title}</h3>
            <p class="faint mono truncate" title={transcript.session.cwd}>{transcript.session.cwd}</p>
          </div>
          {#if transcript.session.live}
            <span class="faint">En cours dans Claude Desktop</span>
          {:else if transcript.session.projectId}
            <button class="btn btn-primary" onclick={resume}>Reprendre avec l'agent</button>
          {:else}
            <span class="faint">Hors des pièces de la maison</span>
          {/if}
        </header>
        <div class="thread scroll" bind:this={reader}>
          {#if transcript.messages.length > visible}
            <button class="btn more" onclick={() => (visible += PAGE)}>Afficher les messages précédents ({transcript.messages.length - visible})</button>
          {:else if transcript.truncated}
            <p class="faint more">Seuls les messages les plus récents sont affichés.</p>
          {/if}
          {#each shown as message, index (index)}
            {#if message.role === 'tools'}
              <div class="tools faint">{message.text}</div>
            {:else if message.role === 'user'}
              <div class="msg user">{message.text}</div>
            {:else}
              <div class="msg assistant"><div class="markdown" {@attach enhance}>{@html renderMarkdown(message.text)}</div></div>
            {/if}
          {/each}
          {#if transcript.messages.length === 0}
            <p class="empty faint">Cette discussion ne contient aucun message lisible.</p>
          {/if}
        </div>
      {:else if loading}
        <p class="empty faint"><span class="spinner"></span> Lecture de la discussion…</p>
      {:else}
        <p class="empty faint">Choisis une discussion pour la relire.</p>
      {/if}
    </section>
  </div>
</GlassPanel>

<style>
  .layout {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    gap: var(--space-3);
    padding: 0 var(--space-4) var(--space-4);
  }

  .side,
  .main {
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .filters .select {
    min-width: 0;
  }

  .list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .item {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .item:hover {
    background: var(--surface);
  }

  .item.open {
    background: var(--surface);
    border-color: var(--line);
  }

  .item-title {
    font-weight: 600;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-meta {
    font-size: 12px;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .tag {
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-size: 10.5px;
    font-weight: 600;
  }

  .tag.live {
    border-color: transparent;
    background: var(--badge-alert);
    color: #fff;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .head .grow {
    min-width: 0;
  }

  .head h3,
  .head p {
    margin: 0;
  }

  .head p {
    font-size: 12px;
  }

  .thread {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-right: var(--space-1);
  }

  .msg {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  .msg.user {
    align-self: flex-end;
    max-width: 85%;
    background: var(--surface);
    border: 1px solid var(--line);
    white-space: pre-wrap;
  }

  .msg.assistant {
    padding-inline: 0;
  }

  .tools {
    font-size: 12px;
    padding-left: var(--space-3);
    border-left: 2px solid var(--line);
  }

  .more {
    align-self: center;
    flex: none;
  }

  .empty {
    padding: var(--space-4);
    text-align: center;
    font-size: 13px;
  }
</style>
