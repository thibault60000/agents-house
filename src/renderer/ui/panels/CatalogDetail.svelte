<script lang="ts">
  import type { CatalogEntry, CatalogFile } from '@shared/types';
  import { enhanceCodeBlocks, renderMarkdown } from '../markdown';
  import { ui } from '../state.svelte';

  let { entry, onclose }: { entry: CatalogEntry; onclose: () => void } = $props();

  let file = $state<CatalogFile | null>(null);
  let failed = $state(false);
  let copied = $state(false);
  let root = $state<HTMLElement>();

  $effect(() => {
    const id = entry.id;
    file = null;
    failed = false;
    void ui.call(() => window.house.readCatalogFile(id)).then((result) => {
      if (result) file = result;
      else failed = true;
    });
  });

  $effect(() => {
    root?.focus();
  });

  const project = $derived(ui.project(entry.projectId));

  function enhance(node: HTMLElement) {
    enhanceCodeBlocks(node, (text) => void ui.call(() => window.house.copyText(text)));
  }

  async function copyPath() {
    if (!file) return;
    await ui.call(() => window.house.copyText((file as CatalogFile).path));
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
<div class="backdrop" onclick={onclose}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="reader glass"
    data-panel
    role="dialog"
    aria-modal="true"
    aria-label={entry.name}
    tabindex="-1"
    bind:this={root}
    onclick={(event) => event.stopPropagation()}
    onkeydown={(event) => {
      event.stopPropagation();
      if (event.key === 'Escape') onclose();
    }}
  >
    <header class="head">
      <div class="grow">
        <div class="meta">
          {#if project}
            <span class="pill"><span class="dot" style:background={project.color}></span>Projet {project.name}</span>
          {:else}
            <span class="pill global">Global · tout le PC</span>
          {/if}
          <span class="faint">{entry.source}</span>
          {#if !entry.enabled}<span class="faint">· désactivé</span>{/if}
        </div>
        <h2 class="mono title">{entry.name}</h2>
      </div>
      {#if file}<button class="btn" onclick={copyPath}>{copied ? 'Copié' : 'Copier le chemin'}</button>{/if}
      <button class="btn btn-ghost btn-icon" aria-label="Fermer" onclick={onclose}>✕</button>
    </header>

    <div class="layout scroll">
      {#if failed}
        <p class="muted">Impossible de lire ce fichier.</p>
      {:else if !file}
        <p class="faint">Lecture…</p>
      {:else}
        {#if entry.description}<p class="lead">{entry.description}</p>{/if}
        <article class="markdown" {@attach enhance}>{@html renderMarkdown(file.content)}</article>
        {#if file.files.length > 0}
          <h3 class="files-title">Fichiers livrés avec ({file.files.length})</h3>
          <ul class="files">
            {#each file.files as name (name)}
              <li class="mono">{name}</li>
            {/each}
          </ul>
        {/if}
        <p class="faint path">{file.path}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 72px 24px 24px;
    background: rgba(40, 24, 16, 0.28);
    z-index: 45;
  }

  .reader {
    display: flex;
    flex-direction: column;
    width: min(980px, 100%);
    height: 100%;
    background: var(--glass-bg-strong);
    outline: none;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--line);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 1px 9px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-hover);
    font-size: 12px;
    font-weight: 600;
  }

  .pill.global {
    border-color: var(--accent);
    color: var(--accent);
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .title {
    margin: 0;
    font: 600 20px var(--font-mono);
    overflow-wrap: anywhere;
  }

  .layout {
    flex: 1;
    min-height: 0;
    padding: var(--space-5);
    font-size: 14.5px;
    line-height: 1.6;
  }

  .lead {
    margin: 0 0 var(--space-4);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--line);
    color: var(--fg-muted);
  }

  .files-title {
    margin: var(--space-5) 0 var(--space-2);
    font-size: 15px;
  }

  .files {
    margin: 0;
    padding: 0;
    list-style: none;
    columns: 2;
  }

  .path {
    margin: var(--space-4) 0 0;
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
</style>
