<script lang="ts">
  import { LIMIT_ALARM, ui } from './state.svelte';
  import type { LimitWindow } from '@shared/types';

  const entries = $derived(
    (
      [
        { label: '5 h', window: ui.limits.fiveHour },
        { label: '7 j', window: ui.limits.sevenDay },
      ] as { label: string; window: LimitWindow | null }[]
    ).filter((entry) => entry.window),
  );

  function resetLabel(at: number): string {
    const minutes = Math.max(0, Math.round((at - ui.clock) / 60000));
    if (minutes < 60) return `dans ${minutes} min`;
    if (minutes < 24 * 60) return `dans ${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
    return `le ${new Date(at).toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}`;
  }

  const title = $derived(entries.map((e) => `${e.label === '5 h' ? 'Session de 5 h' : 'Semaine'} : ${Math.round(ui.limitUsed(e.window) ?? 0)} %, remise à zéro ${resetLabel(e.window!.resetsAt)}`).join('\n'));
</script>

{#if entries.length > 0}
  <button class="chip" class:alert={ui.alarmLevel > 0} data-level={ui.alarmLevel} {title} aria-label={title} onclick={() => ui.openPanel({ kind: 'usage', projectId: null })}>
    {#each entries as entry (entry.label)}
      {@const used = ui.limitUsed(entry.window) ?? 0}
      <span class="entry" class:hot={used >= LIMIT_ALARM}>
        <span class="name">{entry.label}</span>
        <span class="gauge"><span class="fill" style:width="{used}%"></span></span>
        <span class="value">{Math.round(used)} %</span>
      </span>
    {/each}
  </button>
{/if}

<style>
  .chip {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--surface);
    color: inherit;
    font: 600 12px var(--font-text);
    cursor: pointer;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    opacity: 0.7;
  }

  .gauge {
    width: 34px;
    height: 6px;
    border-radius: 999px;
    background: var(--line);
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: currentColor;
    opacity: 0.65;
  }

  .value {
    font-variant-numeric: tabular-nums;
  }

  .hot {
    color: #e0301e;
  }

  .hot .fill {
    opacity: 1;
  }

  .chip.alert {
    border-color: #e0301e;
    animation: alert 1.4s ease-in-out infinite;
  }

  .chip[data-level='1'] .hot {
    color: #d9650b;
  }

  .chip[data-level='1'].alert {
    border-color: #d9650b;
  }

  @keyframes alert {
    50% {
      box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 22%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip.alert {
      animation: none;
    }
  }
</style>
