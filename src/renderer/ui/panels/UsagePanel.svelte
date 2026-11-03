<script lang="ts">
  import { emptyStats, type ModelStats, type UsageDay, type UsageReport } from '@shared/types';
  import GlassPanel from '../GlassPanel.svelte';
  import { ui } from '../state.svelte';

  let { onclose }: { onclose: () => void } = $props();

  type Period = 7 | 30 | 90 | 0;
  type Metric = 'tokens' | 'lines';

  let failed = $state(false);
  let refreshing = $state(false);
  let switching = $state(false);
  let period = $state<Period>(7);
  let metric = $state<Metric>('tokens');
  let hovered = $state<{ date: string; x: number } | null>(null);

  const report = $derived<UsageReport | null>(ui.usage);

  async function load() {
    refreshing = true;
    const result = await ui.call(() => window.house.getUsage());
    refreshing = false;
    if (result) ui.usage = result;
    else failed = ui.usage === null;
  }
  void load();

  function choosePeriod(next: Period) {
    if (next === period) return;
    switching = true;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        period = next;
        switching = false;
      }),
    );
  }

  const consumed = (s: ModelStats) => s.input + s.cacheWrite + s.output;
  const valueOf = (s: ModelStats, m: Metric) => (m === 'tokens' ? consumed(s) : s.linesAdded);

  function add(target: ModelStats, stats: ModelStats) {
    for (const field of Object.keys(stats) as (keyof ModelStats)[]) target[field] += stats[field];
  }

  function shortName(model: string): string {
    return model
      .replace(/^claude-/, '')
      .replace(/-\d{8}$/, '')
      .replace(/-(\d)-(\d)$/, ' $1.$2')
      .replace(/-(\d)$/, ' $1')
      .replace(/^./, (c) => c.toUpperCase());
  }

  const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const cutoff = $derived.by(() => {
    if (period === 0) return '';
    const d = new Date();
    d.setDate(d.getDate() - period + 1);
    return dateKey(d);
  });
  const rows = $derived<UsageDay[]>((report?.days ?? []).filter((row) => row.date >= cutoff && /^\d{4}-/.test(row.date)));

  const SLOTS = 7;
  const palette = $derived.by(() => {
    const totals = new Map<string, number>();
    for (const row of report?.days ?? []) totals.set(row.model, (totals.get(row.model) ?? 0) + consumed(row.stats));
    const kept = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, SLOTS).map(([model]) => model).sort();
    return new Map(kept.map((model, index) => [model, `var(--series-${index + 1})`]));
  });
  const colorOf = (model: string) => palette.get(model) ?? 'var(--series-other)';

  const perModel = $derived.by(() => {
    const map = new Map<string, ModelStats>();
    for (const row of rows) {
      const stats = map.get(row.model) ?? emptyStats();
      add(stats, row.stats);
      map.set(row.model, stats);
    }
    return [...map.entries()].filter(([, stats]) => consumed(stats) > 0).sort((a, b) => consumed(b[1]) - consumed(a[1]));
  });
  const total = $derived.by(() => {
    const out = emptyStats();
    for (const [, stats] of perModel) add(out, stats);
    return out;
  });

  const days = $derived.by(() => {
    const list: string[] = [];
    const known = rows.map((row) => row.date).sort();
    const first = period === 0 ? known[0] : cutoff;
    if (!first) return list;
    const d = new Date(`${first}T12:00:00`);
    const end = dateKey(new Date());
    while (dateKey(d) <= end && list.length < 800) {
      list.push(dateKey(d));
      d.setDate(d.getDate() + 1);
    }
    return list;
  });
  const byDay = $derived.by(() => {
    const map = new Map<string, UsageDay[]>();
    for (const row of rows) {
      const list = map.get(row.date) ?? [];
      list.push(row);
      map.set(row.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.model.localeCompare(b.model));
    return map;
  });
  const maxDay = $derived(Math.max(1, ...days.map((day) => (byDay.get(day) ?? []).reduce((sum, row) => sum + valueOf(row.stats, metric), 0))));

  const CHART_W = 720;
  const CHART_H = 170;
  const AXIS = 22;
  const niceMax = $derived.by(() => {
    const power = 10 ** Math.floor(Math.log10(maxDay));
    const step = [1, 2, 5, 10].find((s) => s * power >= maxDay) ?? 10;
    return step * power;
  });
  const barWidth = $derived(days.length ? (CHART_W - 6) / days.length : 0);

  const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
  const plain = new Intl.NumberFormat('fr-FR');
  const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' });
  const fmt = (n: number) => (n >= 10000 ? compact.format(n) : plain.format(n));
  const fmtDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const tip = $derived(hovered ? { date: hovered.date, x: hovered.x, rows: (byDay.get(hovered.date) ?? []).filter((row) => valueOf(row.stats, metric) > 0) } : null);
  const unit = $derived(metric === 'tokens' ? 'tokens' : 'lignes');
</script>

<GlassPanel title="Garage" eyebrow="Consommation et production par modèle" reader flat {onclose}>
  <div class="content scroll viz-root">
    {#if failed}
      <p class="muted empty">Impossible de lire les sessions de Claude Code.</p>
    {:else if !report}
      <div class="loader" role="status">
        <span class="spinner"></span>
        <strong>Analyse de tes sessions…</strong>
        <span class="faint">La première fois peut prendre quelques dizaines de secondes.</span>
      </div>
    {:else}
      <div class="filters">
        <div class="seg" role="group" aria-label="Période">
          {#each [[7, '7 j'], [30, '30 j'], [90, '90 j'], [0, 'Tout']] as const as [value, label] (value)}
            <button class:active={period === value} aria-pressed={period === value} onclick={() => choosePeriod(value)}>{label}</button>
          {/each}
        </div>
        {#if refreshing || switching}
          <span class="updating faint" role="status"><span class="spinner small"></span>{switching ? 'Calcul…' : 'Mise à jour…'}</span>
        {/if}
        <div class="seg" role="group" aria-label="Mesure du graphique">
          <button class:active={metric === 'tokens'} aria-pressed={metric === 'tokens'} onclick={() => (metric = 'tokens')}>Consommation</button>
          <button class:active={metric === 'lines'} aria-pressed={metric === 'lines'} onclick={() => (metric = 'lines')}>Production</button>
        </div>
      </div>

      <div class="tiles">
        <div class="tile"><div class="label">Tokens consommés</div><div class="big">{fmt(consumed(total))}</div><div class="faint">+ {fmt(total.cacheRead)} relus du cache</div></div>
        <div class="tile"><div class="label">Coût relevé</div><div class="big">{money.format(total.cost)}</div><div class="faint">partiel, voir la note</div></div>
        <div class="tile"><div class="label">Lignes écrites</div><div class="big">{fmt(total.linesAdded)}</div><div class="faint">− {fmt(total.linesRemoved)} retirées</div></div>
        <div class="tile"><div class="label">Livraisons</div><div class="big">{plain.format(total.commits)}</div><div class="faint">commits · {plain.format(total.pullRequests)} PR</div></div>
      </div>

      <figure class="chart" onmouseleave={() => (hovered = null)}>
        <figcaption class="label">{metric === 'tokens' ? 'Tokens consommés par jour' : 'Lignes écrites par jour'}</figcaption>
        <svg viewBox="0 0 {CHART_W} {CHART_H + AXIS}" role="img" aria-label={metric === 'tokens' ? 'Tokens consommés par jour et par modèle' : 'Lignes écrites par jour et par modèle'}>
          {#each [0.5, 1] as ratio (ratio)}
            <line class="grid-line" x1="0" x2={CHART_W} y1={CHART_H - (CHART_H - 14) * ratio} y2={CHART_H - (CHART_H - 14) * ratio} />
            <text class="tick" x="0" y={CHART_H - (CHART_H - 14) * ratio - 4}>{compact.format(niceMax * ratio)}</text>
          {/each}
          <line class="base-line" x1="0" x2={CHART_W} y1={CHART_H} y2={CHART_H} />
          {#each days as day, i (day)}
            {@const x = i * barWidth + 3}
            {@const list = byDay.get(day) ?? []}
            {#if hovered?.date === day}<rect class="hover-band" x={x - 1} y="0" width={barWidth} height={CHART_H} />{/if}
            {@const scale = (CHART_H - 14) / niceMax}
            {#each list.reduce<{ row: UsageDay; y: number; h: number }[]>((acc, row) => {
              const h = valueOf(row.stats, metric) * scale;
              const base = acc.length ? acc[acc.length - 1]!.y : CHART_H;
              if (h > 0) acc.push({ row, y: base - h, h });
              return acc;
            }, []) as seg (seg.row.model)}
              <rect x={x} y={seg.y} width={Math.max(1, barWidth - 2)} height={Math.max(0.5, seg.h - (seg.h > 3 ? 1.5 : 0))} fill={colorOf(seg.row.model)} rx={Math.min(2, barWidth / 3)} />
            {/each}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <rect class="hit" x={x - 1} y="0" width={barWidth} height={CHART_H} onmouseenter={() => (hovered = { date: day, x: (x + barWidth / 2) / CHART_W })} />
          {/each}
          {#if days[0]}<text class="tick" x="0" y={CHART_H + 16}>{fmtDay(days[0])}</text>{/if}
          {#if days.length > 1}<text class="tick" x={CHART_W} y={CHART_H + 16} text-anchor="end">{fmtDay(days[days.length - 1] as string)}</text>{/if}
        </svg>
        {#if tip}
          <div class="tooltip" style:left="{Math.min(78, Math.max(0, tip.x * 100 - 11))}%">
            <strong>{fmtDay(tip.date)}</strong>
            {#each tip.rows as row (row.model)}
              <div class="tip-row"><span class="swatch" style:background={colorOf(row.model)}></span><span class="grow">{shortName(row.model)}</span><span class="num">{fmt(valueOf(row.stats, metric))}</span></div>
            {:else}
              <div class="faint">Aucune activité</div>
            {/each}
            {#if tip.rows.length > 0}<div class="faint">{unit}</div>{/if}
          </div>
        {/if}
      </figure>

      {#if perModel.length > 1}
        <div class="legend" aria-label="Légende">
          {#each perModel as [model] (model)}
            <span class="legend-item"><span class="swatch" style:background={colorOf(model)}></span>{shortName(model)}</span>
          {/each}
        </div>
      {/if}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Modèle</th><th class="num" title="Entrée + écriture en cache + sortie">Tokens</th><th class="num">Sortie</th><th class="num">Cache relu</th><th class="num">Coût relevé</th><th class="num">+ Lignes</th><th class="num">− Lignes</th><th class="num">Modifs</th><th class="num">Commits</th>
            </tr>
          </thead>
          <tbody>
            {#each perModel as [model, stats] (model)}
              <tr>
                <td class="model"><span class="swatch" style:background={colorOf(model)}></span>{shortName(model)}</td>
                <td class="num">{fmt(consumed(stats))}</td>
                <td class="num">{fmt(stats.output)}</td>
                <td class="num">{fmt(stats.cacheRead)}</td>
                <td class="num">{stats.cost > 0 ? money.format(stats.cost) : '—'}</td>
                <td class="num">{fmt(stats.linesAdded)}</td>
                <td class="num">{fmt(stats.linesRemoved)}</td>
                <td class="num">{fmt(stats.edits)}</td>
                <td class="num">{fmt(stats.commits)}</td>
              </tr>
            {:else}
              <tr><td colspan="9" class="muted">Aucune activité sur cette période.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="faint note">
        Calculé depuis {plain.format(report.files)} fichiers de session sur cette machine, sans ce qui tourne ailleurs ; Claude Code efface les plus anciens, donc « Tout » ne remonte pas au-delà. Le coût n'est enregistré que sur {plain.format(report.costSessions)} session{report.costSessions > 1 ? 's' : ''} récente{report.costSessions > 1 ? 's' : ''} : c'est un minimum, et il ne reflète pas ce que tu paies avec un abonnement. Les lignes écrites comptent ce que le modèle a demandé d'écrire, y compris ce qui a été remplacé ensuite.
      </p>
    {/if}
  </div>
</GlassPanel>

<style>
  .viz-root {
    --series-1: #2a78d6;
    --series-2: #eb6834;
    --series-3: #1baf7a;
    --series-4: #eda100;
    --series-5: #e87ba4;
    --series-6: #008300;
    --series-7: #6250d6;
    --series-other: #8a8983;
  }

  :global(:root[data-theme='dark']) .viz-root {
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --series-4: #c98500;
    --series-5: #d55181;
    --series-6: #008300;
    --series-7: #9085e9;
    --series-other: #8a8983;
  }

  .content {
    flex: 1;
    min-height: 0;
    padding: var(--space-3) var(--space-4) var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .loader {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
  }

  .spinner {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 3px solid var(--line);
    border-top-color: var(--accent);
    animation: usage-spin 0.8s linear infinite;
  }

  .spinner.small {
    display: inline-block;
    width: 13px;
    height: 13px;
    border-width: 2px;
  }

  .updating {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-left: auto;
    margin-right: var(--space-2);
  }

  @keyframes usage-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 4s;
    }
  }

  .empty {
    margin: auto;
    padding: var(--space-5);
    text-align: center;
  }

  .filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .seg {
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

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-2);
  }

  .tile {
    padding: var(--space-3);
    border-radius: var(--radius-control);
    background: var(--surface);
    border: 1px solid var(--line);
  }

  .big {
    margin: 2px 0;
    font: 600 22px var(--font-display);
    font-variant-numeric: tabular-nums;
  }

  .chart {
    position: relative;
    margin: 0;
  }

  svg {
    display: block;
    width: 100%;
    margin-top: var(--space-2);
  }

  .grid-line {
    stroke: var(--line);
    stroke-width: 1;
  }

  .base-line {
    stroke: var(--fg-faint);
    stroke-width: 1;
  }

  .tick {
    fill: var(--fg-faint);
    font: 10.5px var(--font-text);
  }

  .hover-band {
    fill: var(--surface-hover);
  }

  .hit {
    fill: transparent;
  }

  .tooltip {
    position: absolute;
    top: 22px;
    width: 22%;
    min-width: 170px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-small);
    border: 1px solid var(--glass-border);
    background: var(--glass-bg-strong);
    box-shadow: 0 6px 18px rgba(20, 24, 50, 0.25);
    font-size: 12.5px;
    pointer-events: none;
    z-index: 2;
  }

  .tip-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .swatch {
    flex: none;
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    font-size: 12.5px;
  }

  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .table-wrap {
    flex: none;
    overflow-x: auto;
    overflow-y: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: var(--surface);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }

  th {
    padding: 6px;
    font: 600 11px var(--font-text);
    color: var(--fg-muted);
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--line);
  }

  th.num {
    text-align: right;
  }

  td {
    padding: 6px;
    white-space: nowrap;
    border-bottom: 1px solid var(--line);
  }

  tr:last-child td {
    border-bottom: 0;
  }

  .model {
    font-weight: 600;
  }

  .model .swatch {
    margin-right: 6px;
  }

  .note {
    margin: 0;
  }
</style>
