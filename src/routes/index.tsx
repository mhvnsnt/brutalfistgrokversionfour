import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { RingCanvas } from "@/components/ring-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ClipJson, EngineStatus, PreviewMesh } from "@/lib/native/x-mesh";

export const Route = createFileRoute("/")({ component: Home });

const CATS = [
  { id: "all", label: "All" },
  { id: "locomotion", label: "Loco" },
  { id: "strike", label: "Strikes" },
  { id: "reaction", label: "Hits" },
  { id: "grapple", label: "Grapple" },
  { id: "defense", label: "Defense" },
  { id: "knockdown", label: "Down" },
];

function Home() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [mesh, setMesh] = useState<PreviewMesh | null>(null);
  const [clip, setClip] = useState<ClipJson | null>(null);
  const [clipId, setClipId] = useState("idle");
  const [cat, setCat] = useState("all");
  const [psx, setPsx] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/native/chara_bannon/status.json").then((r) => {
        if (!r.ok) throw new Error("status.json missing");
        return r.json();
      }),
      fetch("/native/chara_bannon/engine-mesh.json").then((r) => {
        if (!r.ok) throw new Error("engine-mesh.json missing");
        return r.json();
      }),
    ])
      .then(([s, m]) => {
        if (cancelled) return;
        setStatus(s as EngineStatus);
        setMesh(m as PreviewMesh);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load engine .x");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const row = status?.clips.find((c) => c.clip === clipId);
    const path = row?.viewer ?? `clips/${clipId}.json`;
    let cancelled = false;
    fetch(`/native/chara_bannon/${path}`)
      .then((r) => {
        if (!r.ok) throw new Error(`clip ${clipId} missing`);
        return r.json();
      })
      .then((data: ClipJson) => {
        if (!cancelled) setClip(data);
      })
      .catch(() => {
        if (!cancelled) setClip(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clipId, status]);

  const mocap = status?.mocap;
  const clipRows = useMemo(() => {
    const rows = status?.clips ?? [];
    if (cat === "all") return rows;
    return rows.filter((r) => r.cat === cat);
  }, [status, cat]);

  const stats = useMemo(() => {
    if (!status) return [];
    return [
      ["Source GLB", "BANNON_rigged.glb"],
      [".x mesh", status.mesh.file],
      ["Triangles", status.mesh.triangles.toLocaleString()],
      ["Vertices", status.mesh.vertices.toLocaleString()],
      ["Bones", String(status.mesh.bones)],
      ["Outfit scale", status.mesh.scale.toFixed(2)],
      ["FBX exported", `${mocap?.exported ?? 0} / ${mocap?.listed ?? 0}`],
      ["Mixamo / J-rig", `${mocap?.mixamo ?? 0} / ${mocap?.J_rig ?? 0}`],
    ];
  }, [status, mocap]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0">
        {mesh ? (
          <RingCanvas
            mesh={mesh}
            textureUrl="/native/chara_bannon/bannon.png"
            clip={clip}
            psx={psx}
            playing={playing}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-muted">
            {error ?? "Loading BF_bannon.x from the Schwarzerblitz media slot"}
          </div>
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-3 md:p-5">
        <div className="pointer-events-auto max-w-sm rounded-[var(--radius-md)] border border-border bg-bg/80 px-4 py-3 backdrop-blur-md">
          <p className="font-display text-xs uppercase tracking-[0.28em] text-muted">Brutal Fist</p>
          <h1 className="font-display text-3xl font-semibold uppercase leading-none tracking-wide">
            Bannon
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Real BANNON_rigged.glb converted to DirectX .x and installed in the
            Schwarzerblitz character slot. This viewer draws that same mesh.
          </p>
        </div>
        <div className="pointer-events-auto hidden flex-col items-end gap-2 sm:flex">
          <Badge>REAL_GLB_ONLY</Badge>
          <Badge>chara_bannon · roster 0</Badge>
          {mesh?.parsedFromEngineX ? <Badge>parsed from engine .x</Badge> : null}
        </div>
      </header>

      <aside className="pointer-events-none absolute bottom-36 left-4 z-10 hidden max-w-xs lg:block">
        <div className="pointer-events-auto rounded-[var(--radius-md)] border border-border bg-bg/80 p-4 backdrop-blur-md">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-muted">
            Native pipeline
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {stats.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-6">
                <span className="text-subtle">{k}</span>
                <span className="font-mono text-fg">{v}</span>
              </li>
            ))}
          </ul>
          {status?.bound?.length ? (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs uppercase tracking-[0.18em] text-subtle">Engine binds</p>
              <ul className="mt-2 space-y-1 text-sm">
                {status.bound.map((b) => (
                  <li key={b.engine} className="flex justify-between gap-4">
                    <button
                      type="button"
                      className="text-muted hover:text-fg"
                      onClick={() => setClipId(b.clip)}
                    >
                      {b.engine}
                    </button>
                    <span className="truncate text-fg">{b.clip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {status?.engine?.win32Note ? (
            <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-subtle">
              {status.engine.win32Note}
            </p>
          ) : null}
        </div>
      </aside>

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 md:p-4">
        <div className="pointer-events-auto rounded-[var(--radius-md)] border border-border bg-bg/85 p-3 backdrop-blur-md">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause clip" : "Play clip"}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              <span className="ml-2">{playing ? "Pause" : "Play"}</span>
            </Button>
            <Button variant="outline" onClick={() => setPsx((p) => !p)}>
              {psx ? "PSX 320×240" : "Full res"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setClipId("idle");
                setPlaying(true);
              }}
            >
              <RotateCcw className="size-4" />
              <span className="ml-2">Idle</span>
            </Button>
            <span className="ml-auto hidden max-w-[40%] truncate text-xs uppercase tracking-[0.16em] text-subtle sm:inline">
              {clipId} · {clip?.source ?? clip?.cat ?? "rest pose"}
            </span>
          </div>
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={
                  "min-h-11 shrink-0 rounded-full border px-3 text-sm " +
                  (cat === c.id
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border bg-surface text-muted")
                }
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {clipRows.map((row) => {
              const active = row.clip === clipId;
              return (
                <button
                  key={row.clip}
                  type="button"
                  onClick={() => setClipId(row.clip)}
                  className={
                    "min-h-11 shrink-0 rounded-[var(--radius-sm)] border px-3 text-sm " +
                    (active
                      ? "border-accent bg-accent text-accent-fg"
                      : "border-border bg-surface text-fg")
                  }
                >
                  {row.clip}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
