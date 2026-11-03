<script lang="ts">
  import type { DocFile, Project } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { enhanceCodeBlocks, renderMarkdown } from '../markdown';
  import { ui } from '../state.svelte';

  let { project, onclose }: { project: Project; onclose: () => void } = $props();

  let docs = $state<DocFile[]>([]);
  let loaded = $state(false);
  let current = $state<string | null>(null);
  let content = $state('');
  let query = $state('');
  let cache = $state<Record<string, string>>({});

  $effect(() => {
    const id = project.id;
    loaded = false;
    current = null;
    cache = {};
    void ui.call(() => window.house.listDocs(id)).then((list) => {
      docs = list ?? [];
      loaded = true;
      const first = docs[0];
      if (first) void open(first.relPath);
    });
  });

  async function read(relPath: string): Promise<string> {
    const known = cache[relPath];
    if (known !== undefined) return known;
    const text = (await ui.call(() => window.house.readDoc(project.id, relPath))) ?? '';
    cache[relPath] = text;
    return text;
  }

  async function open(relPath: string) {
    current = relPath;
    content = await read(relPath);
  }

  $effect(() => {
    if (query.trim()) for (const doc of docs) void read(doc.relPath);
  });

  const visible = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) => doc.relPath.toLowerCase().includes(q) || cache[doc.relPath]?.toLowerCase().includes(q));
  });

  function excerpt(relPath: string): string {
    const q = query.trim().toLowerCase();
    const text = cache[relPath];
    if (!q || !text) return '';
    const at = text.toLowerCase().indexOf(q);
    if (at < 0) return '';
    return text.slice(Math.max(0, at - 30), at + q.length + 50).replace(/\s+/g, ' ');
  }

  function enhance(node: HTMLElement) {
    enhanceCodeBlocks(node, (text) => void ui.call(() => window.house.copyText(text)));
  }
</script>

<GlassPanel title={project.name} eyebrow="Armoire · documentation" color={project.color} reader {onclose}>
  <div class="search">
    <input class="input" type="search" placeholder="Rechercher dans {docs.length} fichier{docs.length > 1 ? 's' : ''}…" bind:value={query} />
  </div>
  {#if loaded && docs.length === 0}
    <p class="empty muted">Aucun fichier Markdown à la racine ni dans <span class="mono">docs/</span>.</p>
  {:else}
    <div class="layout">
      <nav class="files scroll">
        {#each visible as doc (doc.relPath)}
          <button class="file" class:active={doc.relPath === current} title={doc.relPath} onclick={() => open(doc.relPath)}>
            <span class="truncate">{doc.relPath}</span>
            {#if excerpt(doc.relPath)}<span class="faint excerpt">{excerpt(doc.relPath)}</span>{/if}
          </button>
        {:else}
          <p class="faint pad">Rien ne correspond.</p>
        {/each}
      </nav>
      <article class="reader scroll markdown">
        {#key current}
          <div {@attach enhance}>{@html renderMarkdown(content)}</div>
        {/key}
      </article>
    </div>
  {/if}
</GlassPanel>

<style>
  .search {
    padding: var(--space-3) var(--space-4);
  }

  .empty {
    padding: var(--space-4);
  }

  .layout {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 180px 1fr;
    border-top: 1px solid var(--line);
  }

  .files {
    padding: var(--space-2);
    border-right: 1px solid var(--line);
  }

  .file {
    appearance: none;
    display: flex;
    flex-direction: column;
    width: 100%;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--radius-small);
    background: none;
    color: var(--fg);
    font: 12.5px var(--font-text);
    text-align: left;
    cursor: pointer;
  }

  .file:hover {
    background: var(--surface-hover);
  }

  .file.active {
    background: var(--surface-hover);
    font-weight: 600;
  }

  .excerpt {
    font-weight: 400;
    overflow-wrap: anywhere;
  }

  .pad {
    padding: var(--space-2);
  }

  .reader {
    padding: var(--space-4);
    font-size: 13.5px;
  }
</style>
