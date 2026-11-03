<script lang="ts">
  import { ROOM_LABELS } from '@shared/types';
  import { ui } from './state.svelte';

  interface Command {
    id: string;
    label: string;
    hint: string;
    run: () => void;
  }

  let query = $state('');
  let index = $state(0);
  let input = $state<HTMLInputElement>();

  const commands = $derived.by((): Command[] => {
    const out: Command[] = [];
    const enabled = ui.projects.filter((p) => p.enabled);
    for (const project of enabled) {
      out.push({
        id: `go-${project.id}`,
        label: `Aller à ${project.name}`,
        hint: project.roomType ? ROOM_LABELS[project.roomType] : 'Pièce',
        run: () => ui.world?.focusProject(project.id),
      });
    }
    for (const project of enabled) {
      out.push({
        id: `task-${project.id}`,
        label: `Lancer une tâche dans ${project.name}`,
        hint: 'Agent',
        run: () => {
          ui.world?.focusProject(project.id);
          ui.openPanel({ kind: 'chat', projectId: project.id, taskId: null });
        },
      });
      out.push({
        id: `ide-${project.id}`,
        label: `Ouvrir ${project.name} dans l'IDE`,
        hint: 'IDE',
        run: () => void ui.call(() => window.house.openInIde(project.id)),
      });
      out.push({
        id: `docs-${project.id}`,
        label: `Documentation de ${project.name}`,
        hint: `${project.docCount} fichier${project.docCount > 1 ? 's' : ''}`,
        run: () => {
          ui.world?.focusProject(project.id);
          ui.openPanel({ kind: 'docs', projectId: project.id });
        },
      });
    }
    out.push(
      { id: 'overview', label: "Vue d'ensemble", hint: 'F', run: () => ui.world?.overview() },
      { id: 'rooms', label: 'Gérer les pièces', hint: 'Panneau', run: () => ui.openPanel({ kind: 'rooms', projectId: null }) },
      { id: 'settings', label: 'Réglages', hint: 'Panneau', run: () => ui.openPanel({ kind: 'settings', projectId: null }) },
      { id: 'rotate-left', label: 'Tourner à gauche', hint: 'Q', run: () => ui.world?.rotate(-1) },
      { id: 'rotate-right', label: 'Tourner à droite', hint: 'E', run: () => ui.world?.rotate(1) },
    );
    const logistics = [
      ['logistics', "Logistique : vue d'ensemble du PC et des projets"],
      ['schedules', 'Tâches planifiées'],
      ['artifacts', 'Artéfacts'],
      ['skills', 'Skills installées'],
      ['commands', 'Commandes installées'],
    ] as const;
    for (const [kind, label] of logistics) {
      out.push({
        id: `logistics-${kind}`,
        label,
        hint: 'Logistique',
        run: () => {
          ui.world?.focusStation('logistics');
          ui.openPanel({ kind, projectId: null });
        },
      });
    }
    out.push({
      id: 'garage',
      label: 'Garage : consommation et production des modèles',
      hint: 'Garage',
      run: () => {
        ui.world?.focusStation('usage');
        ui.openPanel({ kind: 'usage', projectId: null });
      },
    });
    return out;
  });

  const filtered = $derived.by(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = words.length === 0 ? commands : commands.filter((c) => words.every((w) => c.label.toLowerCase().includes(w)));
    return matches.slice(0, 40);
  });

  $effect(() => {
    void query;
    index = 0;
  });

  $effect(() => {
    if (ui.paletteOpen) {
      query = '';
      queueMicrotask(() => input?.focus());
    }
  });

  function close() {
    ui.paletteOpen = false;
  }

  function run(command: Command | undefined) {
    if (!command) return;
    close();
    command.run();
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      index = (index + 1) % Math.max(1, filtered.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      index = (index - 1 + filtered.length) % Math.max(1, filtered.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(filtered[index]);
    }
  }
</script>

{#if ui.paletteOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="backdrop" onclick={close}>
    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
    <div class="palette glass glass-liquid" data-panel onclick={(event) => event.stopPropagation()}>
      <input class="field" placeholder="Aller à une pièce, lancer une tâche, ouvrir dans un IDE…" aria-label="Commande" bind:this={input} bind:value={query} onkeydown={onKey} />
      <div class="results scroll" role="listbox">
        {#each filtered as command, i (command.id)}
          <button class="item" class:active={i === index} role="option" aria-selected={i === index} onmouseenter={() => (index = i)} onclick={() => run(command)}>
            <span class="grow truncate">{command.label}</span>
            <span class="faint">{command.hint}</span>
          </button>
        {:else}
          <p class="faint none">Aucune commande.</p>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 14vh;
    z-index: 50;
  }

  .palette {
    width: min(620px, calc(100vw - 32px));
    background: var(--glass-bg-strong);
    overflow: hidden;
  }

  .field {
    width: 100%;
    padding: var(--space-4) var(--space-5);
    background: none;
    border: 0;
    border-bottom: 1px solid var(--line);
    color: var(--fg);
    font: 16px var(--font-text);
    outline: none;
  }

  .results {
    max-height: 46vh;
    padding: var(--space-2);
  }

  .item {
    appearance: none;
    display: flex;
    gap: var(--space-3);
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: 0;
    border-radius: var(--radius-small);
    color: var(--fg);
    font: 14px var(--font-text);
    text-align: left;
    cursor: pointer;
  }

  .item.active {
    background: var(--surface-hover);
  }

  .none {
    padding: var(--space-3);
  }
</style>
