<script lang="ts">
  import { ui } from './state.svelte';

  const night = $derived(ui.isNight);
  const label = $derived(night ? 'Passer en mode jour' : 'Passer en mode nuit');

  const offset = $derived.by(() => {
    const kind = ui.panel?.kind;
    if (kind === 'rooms') return 644;
    if (kind === 'chat' || kind === 'chest' || kind === 'board' || kind === 'settings') return 464;
    return 0;
  });

  async function toggle() {
    const state = await ui.call(() => window.house.updateSettings({ dayCycle: night ? 'day' : 'night' }));
    if (state) ui.app = state;
  }
</script>

<button class="night glass" class:on={night} style:right="{16 + offset}px" title={label} aria-label={label} aria-pressed={night} onclick={toggle}>
  {#if night}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
      </g>
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M20.5 14.6A8.8 8.8 0 0 1 9.4 3.5a.7.7 0 0 0-.9-.9 9.9 9.9 0 1 0 12.9 12.9.7.7 0 0 0-.9-.9Z" />
    </svg>
  {/if}
</button>

<style>
  .night {
    position: fixed;
    bottom: 16px;
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    padding: 0;
    border-radius: 50%;
    color: var(--fg);
    cursor: pointer;
    z-index: 18;
    background: var(--glass-bg-strong);
    transition:
      right var(--duration) var(--ease-spring),
      transform var(--duration) var(--ease-spring);
  }

  .night:hover {
    transform: scale(1.08);
  }

  svg {
    position: relative;
    width: 22px;
    height: 22px;
  }

  .night.on {
    color: #ffcf6e;
  }
</style>
