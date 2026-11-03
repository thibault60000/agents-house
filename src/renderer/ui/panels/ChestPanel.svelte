<script lang="ts">
  import type { GitInfo, Project } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import IdeMenu from '../IdeMenu.svelte';
  import { ui } from '../state.svelte';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();
  let git = $state<GitInfo | null>(null);
  let copied = $state(false);

  $effect(() => {
    const id = project.id;
    git = null;
    void ui.call(() => window.house.gitInfo(id)).then((info) => {
      git = info ?? null;
    });
  });

  async function copyPath() {
    await ui.call(() => window.house.copyText(project.path));
    copied = true;
    setTimeout(() => (copied = false), 1400);
  }

  function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

<GlassPanel title={project.name} eyebrow="Coffre · projet" color={project.color} {onclose}>
  <div class="content scroll stack">
    <section class="stack">
      <div class="label">Chemin</div>
      <div class="path">{project.path}</div>
      <div class="row wrap">
        <button class="btn" onclick={copyPath}>{copied ? 'Copié' : 'Copier le chemin'}</button>
        <button class="btn" onclick={() => ui.call(() => window.house.openInExplorer(project.id))}>Explorateur</button>
        <button class="btn" onclick={() => ui.call(() => window.house.openTerminal(project.id))}>Terminal</button>
        <IdeMenu {project} />
      </div>
    </section>

    <section class="stack">
      <div class="label">Git</div>
      {#if git === null}
        <p class="faint">Lecture du dépôt…</p>
      {:else if !git.isRepo}
        <p class="muted">Ce dossier n'est pas un dépôt Git.</p>
      {:else}
        <div class="card stack">
          <div class="row"><span class="faint key">Branche</span><span class="mono">{git.branch ?? 'HEAD détachée'}</span></div>
          {#if git.lastCommit}
            <div class="row top">
              <span class="faint key">Dernier commit</span>
              <div class="grow">
                <div>{git.lastCommit.subject}</div>
                <div class="faint"><span class="mono">{git.lastCommit.hash}</span> · {git.lastCommit.author} · {formatDate(git.lastCommit.date)}</div>
              </div>
            </div>
          {/if}
        </div>
        <div class="label">{git.changedFiles.length} fichier{git.changedFiles.length > 1 ? 's' : ''} modifié{git.changedFiles.length > 1 ? 's' : ''}</div>
        {#each git.changedFiles.slice(0, 200) as file (file.path)}
          <div class="row"><span class="mono status">{file.status}</span><span class="mono grow truncate" title={file.path}>{file.path}</span></div>
        {:else}
          <p class="faint">Copie de travail propre.</p>
        {/each}
      {/if}
    </section>

    <section class="stack">
      <div class="label">Projet</div>
      <div class="row"><span class="faint key">Type</span>{project.kind}</div>
      <div class="row"><span class="faint key">Documents</span>{project.docCount}</div>
      <div class="row"><span class="faint key">Outils Claude</span>{ui.projectTotal(project.id)}</div>
      <button class="btn" onclick={() => ui.openPanel({ kind: 'logistics', projectId: project.id })}>Voir la logistique du projet</button>
    </section>
  </div>
</GlassPanel>

<style>
  .content {
    flex: 1;
    min-height: 0;
    padding: var(--space-4);
    gap: var(--space-5);
  }

  .wrap {
    flex-wrap: wrap;
  }

  .top {
    align-items: flex-start;
  }

  .key {
    flex: none;
    width: 110px;
  }

  .status {
    flex: none;
    width: 24px;
    color: var(--quest-running);
    font-weight: 600;
  }
</style>
