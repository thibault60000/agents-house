<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let {
    title,
    eyebrow = '',
    color = null,
    onclose,
    children,
    actions,
    wide = false,
    reader = false,
    flat = false,
  }: {
    title: string;
    eyebrow?: string;
    color?: string | null;
    onclose: () => void;
    children: Snippet;
    actions?: Snippet;
    wide?: boolean;
    reader?: boolean;
    flat?: boolean;
  } = $props();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside
  class="panel glass"
  class:glass-liquid={!flat}
  class:wide
  class:reader
  data-panel
  aria-label={title}
  transition:fly={{ x: reduced ? 0 : 60, duration: reduced ? 1 : 260, easing: cubicOut }}
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose();
  }}
>
  <header class="head">
    <div class="grow">
      {#if eyebrow}<div class="label">{eyebrow}</div>{/if}
      <h2 class="row">
        {#if color}<span class="dot" style:background={color}></span>{/if}
        <span class="truncate">{title}</span>
      </h2>
    </div>
    {#if actions}{@render actions()}{/if}
    <button class="btn btn-ghost btn-icon" aria-label="Fermer" onclick={onclose}>✕</button>
  </header>
  <div class="body">
    {@render children()}
  </div>
</aside>

<style>
  .panel {
    position: fixed;
    top: 68px;
    right: 12px;
    bottom: 12px;
    width: min(440px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    z-index: 20;
  }

  .wide {
    width: min(620px, calc(100vw - 24px));
  }

  .reader {
    width: min(780px, calc(100vw - 24px));
    bottom: 64px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-4) var(--space-3);
    border-bottom: 1px solid var(--line);
  }

  h2 {
    font-size: 19px;
  }

  .dot {
    flex: none;
    width: 13px;
    height: 13px;
    border-radius: 50%;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
</style>
