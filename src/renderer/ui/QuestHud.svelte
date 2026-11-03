<script lang="ts">
  import type { AgentTask } from '@shared/types';
  import { ui } from './state.svelte';

  const ICONS: Record<AgentTask['status'], string> = { queued: '!', running: '!', waiting: '?', done: '✓', error: '!', cancelled: '' };

  const hiddenByPanel = $derived(ui.panel !== null);
  const list = $derived(ui.quests.slice(0, 6));

  function go(task: AgentTask) {
    ui.world?.focusAgent(task.projectId);
  }
</script>

{#if list.length > 0 && !hiddenByPanel}
  <section class="hud" aria-label="Quêtes actives">
    {#each list as task (task.id)}
      {@const project = ui.project(task.projectId)}
      <button class="quest glass" data-status={task.status} onclick={() => go(task)} title={task.title}>
        <span class="icon">{ICONS[task.status]}</span>
        <span class="grow text">
          <strong class="truncate">{project?.name ?? 'Projet'}</strong>
          <span class="truncate faint">{task.progress}</span>
        </span>
      </button>
    {/each}
  </section>
{/if}

<style>
  .hud {
    position: fixed;
    top: 68px;
    right: 12px;
    width: 250px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    z-index: 12;
  }

  .quest {
    appearance: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 6px 10px 6px 6px;
    border-radius: 14px;
    color: var(--fg);
    font: 13px var(--font-text);
    text-align: left;
    cursor: pointer;
  }

  .text {
    display: flex;
    flex-direction: column;
  }

  .icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    color: #fff;
    font: 700 15px var(--font-display);
  }

  [data-status='running'] .icon,
  [data-status='queued'] .icon {
    background: var(--quest-running);
    color: #3a2a00;
  }

  [data-status='done'] .icon {
    background: var(--quest-done);
  }

  [data-status='error'] .icon {
    background: var(--quest-error);
  }

  [data-status='waiting'] .icon {
    background: var(--quest-waiting);
  }
</style>
