"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VillageScene } from "./village-scene";

type Resource = "wood" | "stone";
type Recipe = { id: string; version: number; name: string; resource: Resource; durationSeconds: number; outputPerWorker: number };
type Job = { id: string; recipeId: string; recipeVersion: number; workers: number; resource: Resource; outputQuantity: number; startedAt: string; dueAt: string; completedAt: string | null; status: "running" | "completed" };
type VillageState = { serverNow: string; village: { id: string; name: string; totalWorkers: number; busyWorkers: number }; inventory: Record<Resource, number>; recipes: Recipe[]; jobs: Job[] };
type Order = { recipeId: string; workers: number; idempotencyKey: string };

function ResourceIcon({ resource, className = "" }: { resource: Resource | "workers"; className?: string }) {
  return <svg className={`resource-icon ${className}`} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    {resource === "wood" ? <><path d="M8 26L24 10l10 10-16 16z" fill="#937550"/><path d="M10 25l15-14M15 30l15-14" stroke="#c2a379" strokeWidth="2"/><ellipse cx="13" cy="31" rx="8" ry="6" transform="rotate(45 13 31)" fill="#c4a97d"/><ellipse cx="13" cy="31" rx="4" ry="3" transform="rotate(45 13 31)" fill="none" stroke="#856643"/><path d="M25 8l-7 8h14z" fill="#4e7050"/><path d="M26 1L15 13h21z" fill="#628260"/></> : resource === "stone" ? <><path d="M5 28l6-15 15-5 10 14-4 12-18 2z" fill="#8c9993"/><path d="M11 13l7 11 8-16z" fill="#bdc4b9"/><path d="M18 24l18-2-4 12-18 2z" fill="#73867e"/><path d="M5 28l13-4-4 12z" fill="#a6b2a7"/></> : <><circle cx="20" cy="12" r="7" fill="currentColor"/><path d="M9 35v-8a11 11 0 0122 0v8z" fill="currentColor"/><circle cx="6" cy="16" r="4" fill="currentColor" opacity=".5"/><path d="M0 32v-7a6 6 0 017-6l-2 13z" fill="currentColor" opacity=".5"/><circle cx="34" cy="16" r="4" fill="currentColor" opacity=".5"/><path d="M40 32v-7a6 6 0 00-7-6l2 13z" fill="currentColor" opacity=".5"/></>}
  </svg>;
}

function formatDuration(seconds: number) {
  const whole = Math.max(0, Math.ceil(seconds));
  return whole >= 60 ? `${Math.floor(whole / 60)}m ${whole % 60}s` : `${whole}s`;
}

function GatheringCard({ recipe, freeWorkers, locked, onStart }: { recipe: Recipe; freeWorkers: number; locked: boolean; onStart: (recipeId: string, workers: number) => void }) {
  const [workers, setWorkers] = useState("1");
  const quantity = Number(workers);
  const valid = Number.isInteger(quantity) && quantity > 0 && quantity <= freeWorkers;
  const wood = recipe.resource === "wood";
  return <article className={`gather-card ${recipe.resource}`}>
    <div className="gather-card-heading"><div className="activity-icon"><ResourceIcon resource={recipe.resource}/></div><span className="small-label">GATHERING · {formatDuration(recipe.durationSeconds)}</span></div>
    <h3>{wood ? "The woodland" : "The stone quarry"}</h3>
    <p className="activity-description">{wood ? "Send a few hands into the forest. Every village begins with timber." : "Gather stone from the hillside. A solid foundation for what comes next."}</p>
    <div className="recipe-yield"><ResourceIcon resource={recipe.resource}/><strong>{recipe.outputPerWorker} {recipe.resource}</strong><span>per worker</span></div>
    <form onSubmit={event => { event.preventDefault(); if (valid && !locked) onStart(recipe.id, quantity); }}>
      <label htmlFor={`workers-${recipe.id}`}>Assign workers <span>{freeWorkers} available</span></label>
      <div className="assignment-row"><input id={`workers-${recipe.id}`} name="workers" type="number" inputMode="numeric" min="1" max={Math.max(1, freeWorkers)} step="1" value={workers} onChange={event => setWorkers(event.target.value)} disabled={locked || freeWorkers === 0} required aria-describedby={`yield-${recipe.id}`}/><button type="submit" disabled={locked || !valid}>{freeWorkers === 0 ? "Workers occupied" : `Gather ${recipe.resource}`}<span aria-hidden="true">↗</span></button></div>
      <p id={`yield-${recipe.id}`} className="yield-preview">{valid ? `${quantity * recipe.outputPerWorker} ${recipe.resource} after ${formatDuration(recipe.durationSeconds)} · delivered automatically` : freeWorkers === 0 ? "Workers return when their current task finishes." : `Choose 1–${freeWorkers} workers.`}</p>
    </form>
  </article>;
}

export function VillageDashboard() {
  const [data, setData] = useState<VillageState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(0);
  // Wall-clock changes on the device must not advance the displayed server countdown.
  const anchor = useRef({ server: 0, local: 0 });
  const loading = useRef(false);
  const sending = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const response = await fetch("/api/village", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The village could not be loaded.");
      if (!mounted.current) return;
      anchor.current = { server: Date.parse(result.serverNow), local: performance.now() };
      setNow(anchor.current.server);
      setData(result);
      setLoadError(null);
    } catch (error) {
      if (mounted.current) setLoadError(error instanceof Error ? error.message : "Cannot reach the village. Check that the local server is running.");
    } finally { loading.current = false; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      await refresh();
      if (!stopped) timer = setTimeout(poll, 2_000);
    }
    void poll();
    const tick = setInterval(() => { if (anchor.current.server) setNow(anchor.current.server + performance.now() - anchor.current.local); }, 250);
    return () => { stopped = true; mounted.current = false; clearTimeout(timer); clearInterval(tick); };
  }, [refresh]);

  async function sendOrder(order: Order) {
    if (sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setPendingOrder(order);
    setActionError(null);
    setNotice("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order), signal: AbortSignal.timeout(10_000) });
      const result = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        // A server/network failure can happen after commit. Keep the same request key.
        if (response.status >= 400 && response.status < 500) setPendingOrder(null);
        throw new Error(result.error || "The assignment could not be confirmed.");
      }
      setPendingOrder(null);
      setNotice("Workers assigned. Your supplies will arrive automatically, even with this tab closed.");
      await refresh();
    } catch (error) {
      if (mounted.current) setActionError(error instanceof Error ? error.message : "The assignment could not be confirmed.");
    } finally {
      sending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }

  const freeWorkers = data ? data.village.totalWorkers - data.village.busyWorkers : 0;
  const running = data?.jobs.filter(job => job.status === "running") ?? [];
  const completed = data?.jobs.filter(job => job.status === "completed").sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!)).slice(0, 5) ?? [];

  return <div className="app-shell">
    <header className="site-header"><Link className="brand" href="/" aria-label="Medieval Economy home"><span className="brand-mark" aria-hidden="true">M<span>✦</span></span><span>MEDIEVAL<span className="brand-subtitle">ECONOMY</span></span></Link><div className="world-indicator"><span className="status-dot"/>Local development world</div><span className="header-edition">THE FIRST SETTLEMENT</span></header>
    <main id="main-content">
      <div className="page-heading"><div><p className="eyebrow">A SMALL BEGINNING. A WORLD TO BUILD.</p><h1>Your village</h1></div><span className="chapter-label">CHAPTER I <span> / </span> THE FOUNDATIONS</span></div>
      <section className="village-banner" aria-label="Village overview"><VillageScene/><div className="banner-caption"><span className="banner-kicker">HOME, FOR NOW</span><h2>{data?.village.name ?? "Your first settlement"}</h2><p>A clearing, a few willing hands, and possibility.</p></div><span className="scene-label">THE COUNTRYSIDE</span></section>
      {!data ? <section className="loading-panel" aria-live="polite"><h2>{loadError ? "Your village is out of reach" : "Opening the village gates…"}</h2><p>{loadError ?? "Fetching your supplies and assignments."}</p>{loadError && <button onClick={() => void refresh()}>Try again</button>}</section> : <>
        <section className="resource-bar" aria-label="Village resources"><div className="resource-stat"><ResourceIcon resource="wood"/><div><span>Wood</span><strong data-testid="wood-balance">{data.inventory.wood.toLocaleString()}</strong></div><small>IN STORAGE</small></div><div className="resource-stat"><ResourceIcon resource="stone"/><div><span>Stone</span><strong data-testid="stone-balance">{data.inventory.stone.toLocaleString()}</strong></div></div><div className="resource-stat workforce"><ResourceIcon resource="workers"/><div><span>Available workers</span><strong><span data-testid="free-workers">{freeWorkers}</span><em> / {data.village.totalWorkers}</em></strong></div><span className="worker-status">{data.village.busyWorkers} at work</span></div></section>
        {loadError && <div className="alert" role="alert"><strong>Village updates paused.</strong> {loadError} Displayed balances may be out of date. Retrying automatically. <button className="text-button" onClick={() => void refresh()}>Retry now</button></div>}
        <div className="dashboard-grid"><section className="gathering-section" aria-labelledby="gathering-heading"><div className="section-heading"><div><p className="eyebrow">PUT YOUR PEOPLE TO WORK</p><h2 id="gathering-heading">Gather the essentials</h2></div><span className="section-count">02 ACTIVITIES</span></div><p className="section-description">Your workers are shared between tasks. Decide where their time is best spent.</p>
          {actionError && <div className="alert" role="alert">{actionError}{pendingOrder && <><p>We could not confirm this assignment. Retry the same request to safely check it without assigning workers twice.</p><button disabled={submitting} onClick={() => void sendOrder(pendingOrder)}>{submitting ? "Confirming…" : "Retry assignment"}</button></>}</div>}
          <p className={`action-notice ${notice ? "visible" : ""}`} role="status">{submitting ? "Sending your assignment…" : notice}</p>
          <div className="gathering-cards">{data.recipes.map(recipe => <GatheringCard key={`${recipe.id}-${recipe.version}`} recipe={recipe} freeWorkers={freeWorkers} locked={submitting || pendingOrder !== null || loadError !== null} onStart={(recipeId, workers) => void sendOrder({ recipeId, workers, idempotencyKey: crypto.randomUUID() })}/>)}</div>
          <div className="village-note"><span aria-hidden="true">✧</span><p><strong>A village that carries on.</strong> Tasks finish and supplies arrive while you are away. Assigned workers return automatically. Tasks cannot be cancelled.</p></div>
        </section><aside className="work-panel" aria-labelledby="work-heading"><div className="work-heading"><h2 id="work-heading">At work</h2><span className="count-badge">{running.length}</span></div><p className="work-subtitle">Good things take a little time.</p>
          {running.length === 0 ? <div className="empty-work"><ResourceIcon resource="workers"/><h3>A moment of quiet</h3><p>Assign workers to the woodland or quarry to begin gathering.</p><span className="empty-ornament" aria-hidden="true">— ✦ —</span></div> : <ul className="job-list">{running.map(job => {
            const remaining = (Date.parse(job.dueAt) - now) / 1000;
            const duration = Date.parse(job.dueAt) - Date.parse(job.startedAt);
            const progress = Math.max(0, Math.min(100, (1 - (Date.parse(job.dueAt) - now) / Math.max(1, duration)) * 100));
            return <li className="job-card" key={job.id}><div className="job-title"><ResourceIcon resource={job.resource}/><div><h3>Gathering {job.resource}</h3><span>{job.workers} {job.workers === 1 ? "worker" : "workers"} · {job.outputQuantity} {job.resource} on completion</span></div></div><div className="job-time"><span>{remaining > 0 ? "In progress" : "Awaiting delivery"}</span><strong>{remaining > 0 ? formatDuration(remaining) : "Due"}</strong></div><div className="progress-track" role="progressbar" aria-label={`Gathering ${job.resource}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(progress)}><span style={{ width: `${progress}%` }}/></div>{remaining <= 0 && <p className="delivery-note">The village worker will deliver these supplies automatically.</p>}</li>;
          })}</ul>}
          <div className="recent-heading"><h3>Recent deliveries</h3><span aria-hidden="true">↓</span></div>{completed.length ? <ul className="delivery-list">{completed.map(job => <li key={job.id}><span className="delivery-check" aria-hidden="true">✓</span><div><strong>+{job.outputQuantity} {job.resource}</strong><span>{job.workers} {job.workers === 1 ? "worker returned" : "workers returned"}</span></div><span className="delivered-label">Delivered</span></li>)}</ul> : <p className="no-deliveries">Your first delivery is yet to come.</p>}
        </aside></div>
      </>}
      <footer className="site-footer"><p><span aria-hidden="true">◇</span> Local prototype · Progress may be reset during development.</p><span>MEDIEVAL ECONOMY <span aria-hidden="true">✦</span> M1</span></footer>
    </main>
  </div>;
}
