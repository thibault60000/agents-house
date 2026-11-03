<script lang="ts">
  import { PROJECT_ROOM_TYPES, ROOM_LABELS, type Project, type ProjectPatch } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { ui } from '../state.svelte';

  let { onclose }: { onclose: () => void } = $props();

  async function patch(project: Project, change: ProjectPatch) {
    const state = await ui.call(() => window.house.updateProject(project.id, change));
    if (state) ui.app = state;
  }

  async function remove(project: Project) {
    const state = await ui.call(() => window.house.removeProject(project.id));
    if (state) ui.app = state;
  }

  async function rescan() {
    const state = await ui.call(() => window.house.rescan());
    if (state) {
      ui.app = state;
      ui.toast(`${state.projects.length} projets après le scan.`);
    }
  }

  async function addFolder() {
    const state = await ui.call(() => window.house.addExternalProject());
    if (state) ui.app = state;
  }

  async function chooseRoot() {
    const state = await ui.call(() => window.house.chooseRoot());
    if (state) ui.app = state;
  }

  const enabledCount = $derived(ui.projects.filter((p) => p.enabled).length);
</script>

<GlassPanel title="Gérer les pièces" eyebrow="{enabledCount} sur {ui.projects.length} actives" wide {onclose}>
  <div class="tools">
    <button class="btn" onclick={rescan}>Rescanner</button>
    <button class="btn" onclick={addFolder}>Ajouter un dossier</button>
    <button class="btn" onclick={chooseRoot}>Changer de racine</button>
  </div>
  {#if ui.app?.rootPath}<div class="root path">{ui.app.rootPath}</div>{/if}
  <div class="list scroll">
    {#each ui.projects as project (project.id)}
      <article class="room" class:off={!project.enabled}>
        <input
          class="switch"
          type="checkbox"
          aria-label="Afficher {project.name}"
          checked={project.enabled}
          onchange={(event) => patch(project, { enabled: event.currentTarget.checked })}
        />
        <input
          class="color"
          type="color"
          aria-label="Couleur de {project.name}"
          value={project.color}
          onchange={(event) => patch(project, { color: event.currentTarget.value })}
        />
        <div class="grow stack names">
          <input
            class="input"
            aria-label="Nom de la pièce"
            value={project.name}
            onchange={(event) => patch(project, { name: event.currentTarget.value })}
          />
          <span class="faint truncate mono" title={project.path}>{project.path}</span>
        </div>
        <select
          class="select type"
          aria-label="Type de pièce"
          value={project.roomType ?? ''}
          onchange={(event) => patch(project, { roomType: (event.currentTarget.value || null) as ProjectPatch['roomType'] })}
        >
          <option value="">Type auto</option>
          {#each PROJECT_ROOM_TYPES as type (type)}
            <option value={type}>{ROOM_LABELS[type]}</option>
          {/each}
        </select>
        <select
          class="select ide"
          aria-label="IDE du projet"
          value={project.ideId ?? ''}
          onchange={(event) => patch(project, { ideId: event.currentTarget.value || undefined })}
        >
          <option value="">IDE par défaut</option>
          {#each ui.ides.filter((ide) => ide.available) as ide (ide.id)}
            <option value={ide.id}>{ide.name}</option>
          {/each}
        </select>
        <button class="btn btn-ghost btn-icon btn-danger" aria-label="Retirer {project.name}" title="Retirer" onclick={() => remove(project)}>✕</button>
      </article>
    {:else}
      <p class="muted empty">Aucun projet. Choisis un dossier racine ou ajoute un dossier.</p>
    {/each}
  </div>
</GlassPanel>

<style>
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-2);
  }

  .root {
    margin: 0 var(--space-4) var(--space-2);
  }

  .list {
    flex: 1;
    min-height: 0;
    padding: 0 var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .room {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-control);
    background: var(--surface);
    border: 1px solid var(--line);
    transition: opacity var(--duration);
  }

  .room.off {
    opacity: 0.55;
  }

  .names {
    gap: 2px;
  }

  .color {
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    cursor: pointer;
  }

  .type,
  .ide {
    flex: none;
    width: 118px;
  }

  .empty {
    padding: var(--space-4);
    text-align: center;
  }
</style>
