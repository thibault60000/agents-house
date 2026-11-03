<script lang="ts">
  import LimitsChip from './LimitsChip.svelte';
  import { ui } from './state.svelte';

  const houseName = $derived.by(() => {
    const root = ui.app?.rootPath;
    return root ? (root.split(/[\\/]/).filter(Boolean).pop() ?? 'Maison') : 'Maison des Agents';
  });
  const isMac = $derived(ui.app?.platform === 'darwin');
  const running = $derived(ui.tasks.filter((t) => t.status === 'running' || t.status === 'queued').length);

</script>

<header class="bar glass" class:mac={isMac}>
  <h1 class="title truncate">{houseName}</h1>
  <span class="count faint">{ui.projects.filter((p) => p.enabled).length} pièces</span>

  <div class="drag grow"></div>

  <button class="btn search" onclick={() => (ui.paletteOpen = true)}>
    <span>Rechercher</span>
    <kbd>Ctrl K</kbd>
  </button>
  <LimitsChip />
  {#if running > 0}
    <span class="running" title="Tâches en cours">{running} en cours</span>
  {/if}
  <button class="btn btn-ghost" onclick={() => ui.world?.overview()} title="Vue d'ensemble (F)">Vue d'ensemble</button>
  <button
    class="btn btn-ghost"
    onclick={() => {
      ui.world?.focusStation('logistics');
      ui.openPanel({ kind: 'logistics', projectId: null });
    }}>Logistique</button>
  <button
    class="btn btn-ghost"
    onclick={() => {
      ui.world?.focusStation('usage');
      ui.openPanel({ kind: 'usage', projectId: null });
    }}>Garage</button>
  <button class="btn btn-ghost" onclick={() => ui.openPanel({ kind: 'history', projectId: null })}>Discussions</button>
  <button class="btn btn-ghost" onclick={() => ui.openPanel({ kind: 'rooms', projectId: null })}>Pièces</button>
  <button class="btn btn-ghost" onclick={() => ui.openPanel({ kind: 'settings', projectId: null })}>Réglages</button>

  {#if !isMac}
    <div class="controls">
      <button class="control" aria-label="Réduire" onclick={() => window.house.windowControl('minimize')}>–</button>
      <button class="control" aria-label="Agrandir" onclick={() => window.house.windowControl('maximize')}>▢</button>
      <button class="control close" aria-label="Fermer" onclick={() => window.house.windowControl('close')}>✕</button>
    </div>
  {/if}
</header>

<style>
  .bar {
    position: fixed;
    top: 10px;
    left: 12px;
    right: 12px;
    height: 48px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2) 0 var(--space-4);
    z-index: 15;
    -webkit-app-region: drag;
  }

  .bar.mac {
    padding-left: 84px;
  }

  .bar button {
    -webkit-app-region: no-drag;
    flex: none;
    white-space: nowrap;
  }

  .title {
    flex: none;
    font-size: 18px;
    max-width: 240px;
  }

  .count {
    flex: none;
    white-space: nowrap;
  }

  .search {
    min-width: 170px;
    justify-content: space-between;
    color: var(--fg-muted);
  }

  kbd {
    font: 11px var(--font-mono);
    color: var(--fg-faint);
  }

  .running {
    padding: 2px 10px;
    border-radius: 999px;
    background: var(--quest-running);
    color: #3a2a00;
    font: 600 12px var(--font-text);
  }

  .controls {
    display: flex;
    margin-left: var(--space-1);
  }

  .control {
    appearance: none;
    width: 34px;
    height: 32px;
    border: 0;
    border-radius: var(--radius-small);
    background: none;
    color: var(--fg);
    cursor: pointer;
  }

  .control:hover {
    background: var(--surface-hover);
  }

  .control.close:hover {
    background: var(--quest-error);
    color: #fff;
  }
</style>
