<script lang="ts">
  import type { Project } from '@shared/types';
  import { ui } from './state.svelte';

  let { project, relPath, label = 'Ouvrir dans…' }: { project: Project; relPath?: string; label?: string } = $props();
  let open = $state(false);
  let root = $state<HTMLElement>();

  const available = $derived(ui.ides.filter((ide) => ide.available));
  const preferred = $derived(project.ideId ?? ui.app?.settings.defaultIdeId ?? null);

  function launch(ideId: string) {
    open = false;
    void ui.call(() => window.house.openInIde(project.id, ideId, relPath));
  }

  function onWindowClick(event: MouseEvent) {
    if (open && root && !root.contains(event.target as Node)) open = false;
  }
</script>

<svelte:window onclick={onWindowClick} />

<div class="menu" bind:this={root}>
  <button class="btn" aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}>{label} ▾</button>
  {#if open}
    <div class="list glass" role="menu">
      {#each available as ide (ide.id)}
        <button class="item" role="menuitem" onclick={() => launch(ide.id)}>
          <span class="badge">{ide.name.slice(0, 2)}</span>
          <span class="grow truncate">{ide.name}</span>
          {#if ide.id === preferred}<span class="faint">par défaut</span>{/if}
        </button>
      {:else}
        <div class="empty faint">Aucun IDE détecté. Ajoute-en un dans les réglages.</div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .menu {
    position: relative;
    display: inline-block;
  }

  .list {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 230px;
    max-height: 320px;
    overflow-y: auto;
    padding: var(--space-1);
    z-index: 40;
    background: var(--glass-bg-strong);
    border-radius: var(--radius-control);
  }

  .item {
    appearance: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 6px 8px;
    background: none;
    border: 0;
    border-radius: var(--radius-small);
    color: var(--fg);
    font: 13px var(--font-text);
    cursor: pointer;
    text-align: left;
  }

  .item:hover {
    background: var(--surface-hover);
  }

  .badge {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: var(--accent);
    color: var(--accent-contrast);
    font: 600 10px var(--font-display);
    text-transform: uppercase;
  }

  .empty {
    padding: var(--space-3);
  }
</style>
