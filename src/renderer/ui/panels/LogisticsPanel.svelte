<script lang="ts">
  import type { CatalogEntry, Project } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { ui } from '../state.svelte';
  import CatalogDetail from './CatalogDetail.svelte';

  type Tab = 'logistics' | 'schedules' | 'artifacts' | 'skills' | 'commands' | 'agents' | 'rules' | 'mcp';

  let {
    initialTab,
    initialProject,
    onclose,
  }: { initialTab: Tab; initialProject: string | null; onclose: () => void } = $props();

  let tab = $state<Tab>('logistics');
  let scope = $state<string | null>(null);
  let query = $state('');
  let loading = $state(false);
  let showSystem = $state(false);
  let origin = $state<'all' | 'global' | 'project'>('all');
  let detail = $state<CatalogEntry | null>(null);

  $effect(() => {
    tab = initialTab;
    scope = initialProject;
  });

  void ui.refreshLogistics();

  const data = $derived(ui.logistics);
  const project = $derived(ui.project(scope));
  const artifacts = $derived(ui.artifactIndex);

  const inScope = <T extends { projectId: string | null }>(list: T[] | undefined): T[] =>
    (list ?? []).filter((item) => scope === null || item.projectId === scope);

  function grouped<T extends { projectId: string | null }>(list: T[]): { key: string; label: string; color: string | null; items: T[] }[] {
    const out: { key: string; label: string; color: string | null; items: T[] }[] = [];
    const global = list.filter((item) => item.projectId === null);
    if (global.length > 0 && origin !== 'project') out.push({ key: 'global', label: 'Global · tout le PC', color: null, items: global });
    if (origin !== 'global') {
      for (const item of ui.projects) {
        const own = list.filter((entry) => entry.projectId === item.id);
        if (own.length > 0) out.push({ key: item.id, label: item.name, color: item.color, items: own });
      }
    }
    return out;
  }

  const split = (list: { projectId: string | null }[]) => {
    const global = list.filter((item) => item.projectId === null).length;
    return { global, project: list.length - global };
  };

  const catalogs = $derived({
    skills: inScope(data?.skills),
    commands: inScope(data?.commands),
    agents: inScope(data?.agents),
    rules: inScope(data?.rules),
    mcp: inScope(data?.mcp),
  });
  const visibleArtifacts = $derived(artifacts.filter((item) => scope === null || item.projectIds.includes(scope)));
  const planned = $derived(inScope(data?.schedules).filter((item) => item.source !== 'Système'));
  const systemTimers = $derived(scope === null ? (data?.schedules ?? []).filter((item) => item.source === 'Système') : []);
  const pastSchedules = $derived(
    (ui.usage?.pastSchedules ?? []).filter((item) => scope === null || ui.projectForPath(item.cwd)?.id === scope),
  );

  const TABS: { id: Tab; label: string }[] = [
    { id: 'logistics', label: "Vue d'ensemble" },
    { id: 'schedules', label: 'Tâches' },
    { id: 'artifacts', label: 'Artéfacts' },
    { id: 'skills', label: 'Skills' },
    { id: 'commands', label: 'Commandes' },
    { id: 'agents', label: 'Agents' },
    { id: 'rules', label: 'Règles' },
    { id: 'mcp', label: 'MCP' },
  ];

  const counts = $derived<Record<Tab, number | null>>({
    logistics: null,
    schedules: planned.length,
    artifacts: visibleArtifacts.length,
    skills: catalogs.skills.length,
    commands: catalogs.commands.length,
    agents: catalogs.agents.length,
    rules: catalogs.rules.length,
    mcp: catalogs.mcp.length,
  });

  const search = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const currentCatalog = $derived<CatalogEntry[]>(
    tab === 'skills' || tab === 'commands' || tab === 'agents' || tab === 'rules' || tab === 'mcp'
      ? catalogs[tab].filter((item) => search(item.name) || search(item.description) || search(item.source))
      : [],
  );
  const filteredArtifacts = $derived(
    visibleArtifacts.filter(
      (item) =>
        search(item.title) && (origin === 'all' || scope !== null || (origin === 'global' ? item.projectIds.length === 0 : item.projectIds.length > 0)),
    ),
  );
  const unnamedCount = $derived(artifacts.filter((item) => !item.named).length);
  const DAY = 86400000;
  let autoRefreshed = false;

  $effect(() => {
    if (tab !== 'artifacts' || autoRefreshed || loading || !ui.claude?.available) return;
    if (unnamedCount === 0 || (ui.artifactsAt && Date.now() - ui.artifactsAt < DAY)) return;
    autoRefreshed = true;
    void refreshArtifacts(true);
  });

  const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

  function folderStats(id: string) {
    let tokens = 0;
    let lines = 0;
    let sessions = 0;
    let lastAt = 0;
    for (const folder of ui.usage?.folders ?? []) {
      if (ui.projectForPath(folder.cwd)?.id !== id) continue;
      tokens += folder.tokens;
      lines += folder.lines;
      sessions += folder.sessions;
      lastAt = Math.max(lastAt, folder.lastAt);
    }
    return { tokens, lines, sessions, lastAt };
  }

  function projectChips(item: Project): { tab: Tab; label: string; count: number }[] {
    const own = (list: { projectId: string | null }[] | undefined) => (list ?? []).filter((entry) => entry.projectId === item.id).length;
    const chips: { tab: Tab; label: string; count: number }[] = [
      { tab: 'skills', label: 'skills', count: own(data?.skills) },
      { tab: 'agents', label: 'agents', count: own(data?.agents) },
      { tab: 'rules', label: 'règles', count: own(data?.rules) },
      { tab: 'commands', label: 'commandes', count: own(data?.commands) },
      { tab: 'mcp', label: 'MCP', count: own(data?.mcp) },
      { tab: 'artifacts', label: 'artéfacts', count: artifacts.filter((entry) => entry.projectIds.includes(item.id)).length },
    ];
    return chips.filter((chip) => chip.count > 0);
  }

  const ranked = $derived(
    [...ui.projects].sort((a, b) => folderStats(b.id).lastAt - folderStats(a.id).lastAt),
  );

  function open(id: string, next: Tab = 'logistics') {
    scope = id;
    tab = next;
    query = '';
    origin = 'all';
  }

  async function refreshArtifacts(quiet = false) {
    loading = true;
    await ui.refreshArtifacts(quiet);
    loading = false;
  }

  function ago(at: number): string {
    if (!at) return 'jamais';
    const days = Math.floor((Date.now() - at) / 86400000);
    if (days < 1) return "aujourd'hui";
    if (days === 1) return 'hier';
    return `il y a ${days} j`;
  }

  function when(value: number | null): string {
    return value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  }

  function originOf(id: Tab): { global: number; project: number } {
    if (id === 'artifacts') {
      const project = artifacts.filter((item) => item.projectIds.length > 0).length;
      return { global: artifacts.length - project, project };
    }
    if (id === 'schedules') return split(planned);
    if (id === 'skills' || id === 'commands' || id === 'agents' || id === 'rules' || id === 'mcp') return split(catalogs[id]);
    return { global: 0, project: 0 };
  }

  const stats = $derived(project ? folderStats(project.id) : null);
  const conversations = $derived(scope === null ? ui.conversations.length : ui.conversations.filter((c) => c.projectId === scope).length);
  const hasClaudeMd = $derived(Boolean(project && data?.claudeMd.includes(project.id)));
</script>

{#snippet scopePill(id: string | null)}
  {#if id}
    <span class="pill"><span class="dot small" style:background={ui.project(id)?.color}></span>{ui.project(id)?.name ?? 'Projet'}</span>
  {:else}
    <span class="pill global"><span class="globe small" aria-hidden="true"></span>Global</span>
  {/if}
{/snippet}

{#snippet originFilter()}
  <div class="seg" role="group" aria-label="Origine">
    {#each [['all', 'Tout'], ['global', 'Global'], ['project', 'Projets']] as const as [value, label] (value)}
      <button class:active={origin === value} aria-pressed={origin === value} onclick={() => (origin = value)}>{label}</button>
    {/each}
  </div>
{/snippet}

<GlassPanel title={project?.name ?? 'Tout le PC'} eyebrow="Logistique" color={project?.color ?? null} reader flat {onclose}>
  {#snippet actions()}
    <select class="select scope" aria-label="Périmètre" value={scope ?? ''} onchange={(event) => (scope = event.currentTarget.value || null)}>
      <option value="">Tout le PC</option>
      {#each ui.projects as item (item.id)}
        <option value={item.id}>{item.name}</option>
      {/each}
    </select>
  {/snippet}

  <nav class="tabs" aria-label="Rubriques">
    {#each TABS as item (item.id)}
      <button class:active={tab === item.id} aria-pressed={tab === item.id} onclick={() => (tab = item.id)}>
        {item.label}
        {#if counts[item.id] !== null}<span class="count">{counts[item.id]}</span>{/if}
      </button>
    {/each}
  </nav>

  <div class="content scroll">
    {#if !data}
      <div class="loader" role="status"><span class="spinner"></span><span class="faint">Lecture de ta configuration…</span></div>
    {:else if tab === 'logistics'}
      {#if project && stats}
        <div class="tiles">
          <div class="tile"><span class="big">{compact.format(stats.tokens)}</span><span class="faint">tokens consommés</span></div>
          <div class="tile"><span class="big">{compact.format(stats.lines)}</span><span class="faint">lignes écrites</span></div>
          <div class="tile"><span class="big">{stats.sessions}</span><span class="faint">sessions</span></div>
          <div class="tile"><span class="big">{conversations}</span><span class="faint">conversations ouvertes</span></div>
        </div>
        <div class="grid-buttons">
          {#each TABS.slice(1) as item (item.id)}
            <button class="stat" onclick={() => (tab = item.id)}>
              <span class="big">{counts[item.id]}</span>
              <span class="faint">{item.label}</span>
            </button>
          {/each}
        </div>
        <p class="muted line">
          {hasClaudeMd ? 'Ce projet a un CLAUDE.md.' : "Ce projet n'a pas de CLAUDE.md."} Dernière session : {ago(stats.lastAt)}.
        </p>
        <button class="btn back" onclick={() => (scope = null)}>Retour à tout le PC</button>
      {:else}
        <div class="grid-buttons">
          {#each TABS.slice(1) as item (item.id)}
            {@const parts = originOf(item.id)}
            <button class="stat" onclick={() => (tab = item.id)}>
              <span class="big">{counts[item.id]}</span>
              <span class="stat-label">{item.label}</span>
              <span class="faint split">{parts.global} global · {parts.project} projets</span>
            </button>
          {/each}
        </div>

        <h3 class="section">Par projet</h3>
        <div class="projects">
          {#each ranked as item (item.id)}
            {@const usage = folderStats(item.id)}
            {@const chips = projectChips(item)}
            <button class="project" onclick={() => open(item.id)}>
              <span class="project-head">
                <span class="dot" style:background={item.color}></span>
                <strong class="truncate">{item.name}</strong>
                {#if data.claudeMd.includes(item.id)}<span class="tag">CLAUDE.md</span>{/if}
              </span>
              <span class="faint">{compact.format(usage.tokens)} tokens · {compact.format(usage.lines)} lignes · {ago(usage.lastAt)}</span>
              <span class="chips">
                {#each chips as chip (chip.tab)}
                  <span class="chip">{chip.count} {chip.label}</span>
                {:else}
                  <span class="faint">Aucun outil propre</span>
                {/each}
              </span>
            </button>
          {/each}
        </div>
      {/if}
    {:else if tab === 'schedules'}
      {#each planned as item (item.id)}
        <article class="entry">
          <div class="row"><strong class="grow truncate" title={item.name}>{item.name}</strong>{@render scopePill(item.projectId)}<span class="faint">{item.source}</span></div>
          <div class="faint">{item.schedule || 'Horaire non précisé'}{item.enabled ? '' : ' · en pause'} · prochaine : {when(item.next)}</div>
        </article>
      {:else}
        <p class="muted empty">
          Aucune tâche planifiée active {project ? 'pour ce projet' : 'dans Claude Desktop, Claude Code ou ta crontab'}. Les routines qui tournent dans le cloud ne sont pas visibles depuis cette machine.
        </p>
      {/each}

      {#if pastSchedules.length > 0}
        <h3 class="section">Programmé depuis tes sessions</h3>
        <p class="faint line">Réveils et tâches demandés pendant une session. Ils disparaissent avec elle : c'est un historique, pas un planning.</p>
        {#each pastSchedules.slice(0, 40) as item, index (index)}
          <article class="entry">
            <div class="row"><span class="grow truncate" title={item.label}>{item.label}</span>{@render scopePill(ui.projectForPath(item.cwd)?.id ?? null)}<span class="faint">{item.tool === 'ScheduleWakeup' ? 'Réveil' : item.tool.replace('mcp__scheduled-tasks__', '')}</span></div>
            <div class="faint">{when(item.at)}</div>
          </article>
        {/each}
      {/if}

      {#if systemTimers.length > 0}
        <button class="btn btn-ghost back" onclick={() => (showSystem = !showSystem)}>{showSystem ? 'Masquer' : 'Afficher'} les {systemTimers.length} minuteurs du système</button>
        {#if showSystem}
          {#each systemTimers as item (item.id)}
            <article class="entry"><div class="row"><span class="grow truncate">{item.name}</span><span class="faint">prochaine : {when(item.next)}</span></div></article>
          {/each}
        {/if}
      {/if}
    {:else if tab === 'artifacts'}
      <div class="row toolbar">
        <input class="input grow" type="search" placeholder="Rechercher…" bind:value={query} />
        {#if scope === null}{@render originFilter()}{/if}
        <button class="btn" disabled={loading} onclick={() => refreshArtifacts()}>{loading ? 'Récupération…' : 'Actualiser'}</button>
      </div>
      {#if loading}
        <p class="faint line row"><span class="spinner small"></span>Récupération des noms depuis claude.ai, environ 20 s…</p>
      {/if}
      <p class="faint line">
        La liste et les noms viennent de claude.ai, via la CLI claude avec Haiku (quelques tokens). « Projet » : l'artéfact est cité dans les sessions de ce projet.
        {#if ui.artifactsAt}Mis à jour le {when(ui.artifactsAt)}.{/if}
      </p>
      <div class="art-grid">
        {#each filteredArtifacts as item (item.url)}
          <button class="art" title={item.url} onclick={() => ui.call(() => window.house.openArtifact(item.url))}>
            <strong class:unnamed={!item.named}>{item.title}</strong>
            {#if !item.named}<span class="faint mono id">{item.url.split('/').pop()}</span>{/if}
            {#if item.updated}<span class="faint">{item.updated}</span>{/if}
            <span class="pills">
              {#each item.projectIds as id (id)}
                {@render scopePill(id)}
              {:else}
                {@render scopePill(null)}
              {/each}
            </span>
          </button>
        {:else}
          <p class="muted empty wide">{visibleArtifacts.length === 0 ? 'Aucun artéfact connu ici pour le moment.' : 'Rien ne correspond.'}</p>
        {/each}
      </div>
    {:else}
      <div class="row toolbar">
        <input class="input grow" type="search" placeholder="Rechercher…" bind:value={query} />
        {#if scope === null}{@render originFilter()}{/if}
      </div>
      {#each grouped(currentCatalog) as group (group.key)}
        <h3 class="group">
          {#if group.color}<span class="dot" style:background={group.color}></span>{:else}<span class="globe" aria-hidden="true"></span>{/if}
          {group.label}
          <span class="faint">{group.items.length}</span>
        </h3>
        {#each group.items as item (item.id)}
          {#if tab === 'mcp'}
            <article class="entry" class:off={!item.enabled}>
              <div class="row">
                <span class="mono name grow truncate" title={item.name}>{item.name}</span>
                <span class="faint">{item.source}</span>
              </div>
              {#if item.description}<p class="muted description">{item.description}</p>{/if}
            </article>
          {:else}
            <button class="entry open" class:off={!item.enabled} title="Ouvrir en grand" onclick={() => (detail = item)}>
              <span class="row">
                <span class="mono name grow truncate">{item.name}</span>
                {#if !item.enabled}<span class="faint">désactivé</span>{/if}
                <span class="faint">{item.source}</span>
                <span class="expand" aria-hidden="true">↗</span>
              </span>
              {#if item.description}<span class="muted description">{item.description}</span>{/if}
            </button>
          {/if}
        {/each}
      {:else}
        <p class="muted empty">{query ? 'Rien ne correspond.' : project ? 'Rien de défini dans ce projet.' : 'Rien d\'installé.'}</p>
      {/each}
    {/if}
  </div>
</GlassPanel>

{#if detail}
  <CatalogDetail entry={detail} onclose={() => (detail = null)} />
{/if}

<style>
  .group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-2) 0 0;
    font-size: 14px;
  }

  .globe {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--accent);
    background: linear-gradient(var(--accent), var(--accent)) center / 100% 1.5px no-repeat;
  }

  .globe.small {
    width: 9px;
    height: 9px;
    border-width: 1.5px;
  }

  .pill {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 170px;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--surface-hover);
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pill.global {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: auto;
    padding-top: var(--space-1);
  }

  .seg {
    flex: none;
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--radius-control);
    background: var(--surface);
  }

  .seg button {
    appearance: none;
    padding: 4px 10px;
    border: 0;
    border-radius: var(--radius-small);
    background: none;
    color: var(--fg);
    font: 500 12.5px var(--font-text);
    cursor: pointer;
  }

  .seg button.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .entry.open {
    appearance: none;
    display: block;
    width: 100%;
    color: var(--fg);
    font: 13px var(--font-text);
    text-align: left;
    cursor: pointer;
    transition: background var(--duration);
  }

  .entry.open:hover {
    background: var(--surface-hover);
  }

  .entry.open .description {
    margin-top: 2px;
  }

  .expand {
    flex: none;
    color: var(--fg-faint);
    font-size: 14px;
  }

  .stat-label {
    font-size: 13px;
    color: var(--fg-muted);
  }

  .split {
    font-size: 10.5px;
    font-variant-numeric: tabular-nums;
  }

  .unnamed {
    font-weight: 500;
    color: var(--fg-muted);
    font-style: italic;
  }

  .id {
    font-size: 10.5px;
    overflow-wrap: anywhere;
  }

  .spinner.small {
    display: inline-block;
    flex: none;
    width: 13px;
    height: 13px;
    border-width: 2px;
  }

  .scope {
    width: 190px;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--line);
  }

  .tabs button {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    border: 0;
    border-radius: var(--radius-small);
    background: none;
    color: var(--fg);
    font: 500 12.5px var(--font-text);
    cursor: pointer;
  }

  .tabs button:hover {
    background: var(--surface-hover);
  }

  .tabs button.active {
    background: var(--accent);
    color: var(--accent-contrast);
  }

  .count {
    font-variant-numeric: tabular-nums;
    opacity: 0.75;
    font-size: 11.5px;
  }

  .content {
    flex: 1;
    min-height: 0;
    padding: var(--space-3) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .loader {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .spinner {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 3px solid var(--line);
    border-top-color: var(--accent);
    animation: logistics-spin 0.8s linear infinite;
  }

  @keyframes logistics-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .tile,
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: var(--surface);
    border: 1px solid var(--line);
    color: var(--fg);
    text-align: left;
  }

  .stat {
    appearance: none;
    cursor: pointer;
    font: inherit;
    transition: background var(--duration);
  }

  .stat:hover,
  .project:hover,
  .art:hover {
    background: var(--surface-hover);
  }

  .big {
    font: 600 22px var(--font-display);
    font-variant-numeric: tabular-nums;
  }

  .grid-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-2);
  }

  .section {
    margin-top: var(--space-2);
    font-size: 15px;
  }

  .line {
    margin: 0;
  }

  .back {
    align-self: flex-start;
  }

  .projects {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .project {
    appearance: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    padding: var(--space-3);
    border-radius: var(--radius-control);
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--fg);
    font: 13px var(--font-text);
    text-align: left;
    cursor: pointer;
    transition: background var(--duration);
  }

  .project-head {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .tag {
    flex: none;
    margin-left: auto;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font: 500 10.5px var(--font-mono);
    color: var(--fg-muted);
  }

  .dot {
    flex: none;
    width: 11px;
    height: 11px;
    border-radius: 50%;
  }

  .dot.small {
    width: 8px;
    height: 8px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .chip {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--code-bg);
    font-size: 11.5px;
    font-variant-numeric: tabular-nums;
  }

  .toolbar {
    margin-bottom: var(--space-1);
  }

  .entry {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  .entry.off {
    opacity: 0.6;
  }

  .name {
    font-size: 13px;
    font-weight: 600;
  }

  .description {
    display: block;
    margin: 2px 0 0;
    font-size: 12.5px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .empty {
    padding: var(--space-4);
    text-align: center;
  }

  .wide {
    grid-column: 1 / -1;
  }

  .art-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: var(--space-2);
  }

  .art {
    appearance: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-height: 72px;
    padding: var(--space-3);
    border-radius: var(--radius-control);
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--fg);
    font: 13px var(--font-text);
    text-align: left;
    cursor: pointer;
    overflow-wrap: anywhere;
    transition: background var(--duration);
  }

</style>
