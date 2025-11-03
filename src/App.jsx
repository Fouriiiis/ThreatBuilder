import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Trash2,
  Plus,
  Download,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/*
  Minimal inline UI primitives (Button, Card, etc.) so this file is self-contained
  for GitHub Pages. You can replace these with shadcn/ui later.
*/
function Button({ className = "", variant, size, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-lg border text-sm font-medium transition-colors " +
    "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    outline:
      "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 focus:ring-purple-500",
    destructive:
      "border-red-600 bg-red-600 text-white hover:bg-red-700 focus:ring-red-400",
    default:
      "border-neutral-800 bg-neutral-800 text-white hover:bg-neutral-700 focus:ring-purple-500",
    subtle:
      "border-transparent bg-neutral-100 text-neutral-700 hover:bg-neutral-200 focus:ring-purple-500",
    ghost:
      "border-transparent bg-transparent text-neutral-600 hover:bg-neutral-200/60 focus:ring-purple-500",
  };
  const sizes = {
    xs: "h-6 px-2 py-0.5 text-[11px]",
    sm: "h-7 px-2 py-1 text-xs",
    md: "h-9 px-3 py-2 text-sm",
  };
  return (
    <button
      className={`${base} ${
        variants[variant || "default"]
      } ${sizes[size || "md"]} ${className}`}
      {...props}
    />
  );
}

function Card({ className = "", children }) {
  return (
    <div
      className={`border border-neutral-300 shadow-sm rounded-xl bg-white ${className}`}
    >
      {children}
    </div>
  );
}
function CardHeader({ className = "", children }) {
  return <div className={`rounded-t-xl ${className}`}>{children}</div>;
}
function CardContent({ className = "", ...props }) {
  return <div className={className} {...props} />;
}
function Input(props) {
  return (
    <input
      {...props}
      className={
        "rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 " +
        "focus:outline-none focus:ring-2 focus:ring-purple-500 " +
        (props.className || "")
      }
    />
  );
}

/* ------------------ Helpers ------------------ */
function sanitizeName(raw) {
  // lowercase, spaces -> _
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

// a "track" is now { id: string, file: File }
function makeTrackFromFile(file) {
  const baseId = sanitizeName(file.name.replace(/\.ogg$/i, ""));
  return { id: baseId, file };
}

function makeEmptyRegion(idx) {
  return {
    id: crypto.randomUUID(),
    name: `Region ${idx}`,
    layers: [[]], // array of layer arrays, each layer array is Track[]
    nightLayers: [[]],
    music: [], // Track[]
  };
}

// drag payload types to distinguish what's being dragged
const DRAG_TRACK = "drag/track";
const DRAG_LAYER = "drag/layer";

/* ------------------ Collapsible Section ------------------ */
function CollapsibleSection({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-neutral-200 bg-white/70 backdrop-blur-sm shadow-sm">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          {icon}
          <span>{title}</span>
        </div>
        <div className="text-neutral-500">
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-neutral-200 px-3 py-3">{children}</div>
      )}
    </section>
  );
}

/* ------------------ TrackDropZone ------------------ */
function TrackDropZone({
  onDropFiles,
  onDropMoveTrack,
  onDropMoveLayer,
  acceptLayer,
  acceptTrack,
  className,
  children,
}) {
  const [isOver, setIsOver] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    setIsOver(true);
  }
  function handleDragLeave() {
    setIsOver(false);
  }
  function handleDrop(e) {
    e.preventDefault();
    setIsOver(false);

    // 1) Files dropped?
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const oggFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".ogg")
      );
      if (oggFiles.length && onDropFiles) {
        onDropFiles(oggFiles);
      }
      return;
    }

    // 2) Custom drag data (track or layer)
    const kind = e.dataTransfer.getData("kind");
    if (kind === DRAG_TRACK && acceptTrack) {
      const json = e.dataTransfer.getData("payload");
      if (json && onDropMoveTrack) {
        onDropMoveTrack(JSON.parse(json));
      }
    } else if (kind === DRAG_LAYER && acceptLayer) {
      const json = e.dataTransfer.getData("payload");
      if (json && onDropMoveLayer) {
        onDropMoveLayer(JSON.parse(json));
      }
    }
  }

  return (
    <div
      className={`rounded-xl border border-dashed p-3 transition-colors text-sm ${
        isOver
          ? "bg-purple-50/70 border-purple-400"
          : "bg-neutral-50/40 border-neutral-300"
      } ${className || ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}

/* ------------------ TrackChip ------------------ */
function TrackChip({ track, layerIdx, trackIdx, onRemove }) {
  function handleDragStart(e) {
    e.dataTransfer.setData("kind", DRAG_TRACK);
    e.dataTransfer.setData(
      "payload",
      JSON.stringify({ layerIdx, trackIdx })
    );
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg bg-neutral-900 text-white px-2 py-1 text-[11px] cursor-move select-none shadow-sm"
      draggable
      onDragStart={handleDragStart}
    >
      <span className="font-mono break-all leading-none">{track.id}</span>
      <button
        onClick={onRemove}
        className="text-red-400 hover:text-red-500"
        title="Remove track"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

/* ------------------ LayerRow ------------------ */
function LayerRow({
  label,
  layerIdx,
  tracks,
  onFilesAdded,
  onTrackRemove,
  onMoveTrackHere,
  onMoveLayerHere,
  onDeleteLayer,
}) {
  const fileInputRef = useRef(null);

  function handlePick() {
    fileInputRef.current?.click();
  }
  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesAdded(files);
    e.target.value = "";
  }
  function handleDragStartLayer(e) {
    e.dataTransfer.setData("kind", DRAG_LAYER);
    e.dataTransfer.setData("payload", JSON.stringify({ layerIdx }));
  }

  return (
    <TrackDropZone
      acceptTrack
      acceptLayer
      onDropFiles={onFilesAdded}
      onDropMoveTrack={onMoveTrackHere}
      onDropMoveLayer={onMoveLayerHere}
      className="mb-3"
    >
      <div className="flex flex-col gap-2">
        {/* Header row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div
            className="flex items-center gap-2 rounded-md bg-neutral-200 text-neutral-900 px-2 py-1 font-bold cursor-move select-none shadow-sm"
            draggable
            onDragStart={handleDragStartLayer}
            title="Drag to reorder/move this whole layer"
          >
            <span>{label}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            className="px-2 py-1 h-6"
            onClick={handlePick}
            title="Add .ogg track(s)"
          >
            <Plus className="w-3 h-3 mr-1" /> Track
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ogg"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          <Button
            type="button"
            variant="destructive"
            size="xs"
            className="px-2 py-1 h-6"
            onClick={onDeleteLayer}
            title="Delete this layer"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Tracks row */}
        <div className="flex flex-wrap gap-2">
          {tracks.map((trk, trkIdx) => (
            <TrackChip
              key={trkIdx}
              track={trk}
              layerIdx={layerIdx}
              trackIdx={trkIdx}
              onRemove={() => onTrackRemove(layerIdx, trkIdx)}
            />
          ))}
          {tracks.length === 0 && (
            <div className="text-[11px] text-neutral-500 italic">
              (drop or + .ogg here)
            </div>
          )}
        </div>
      </div>
    </TrackDropZone>
  );
}

/* ------------------ MusicList ------------------ */
function MusicList({ title, tracks, onFilesAdded, onRemove }) {
  const fileInputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  function startPick() {
    fileInputRef.current?.click();
  }
  function handleChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesAdded(files);
    e.target.value = "";
  }
  function onDragOver(e) {
    e.preventDefault();
    setIsOver(true);
  }
  function onDragLeave() {
    setIsOver(false);
  }
  function onDrop(e) {
    e.preventDefault();
    setIsOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const oggFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".ogg")
      );
      if (oggFiles.length) onFilesAdded(oggFiles);
    }
  }

  return (
    <Card className="border border-neutral-300 shadow-sm rounded-xl bg-white/90 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 rounded-t-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
          <Sun className="w-4 h-4" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="px-2 py-1 h-6"
            onClick={startPick}
          >
            <Plus className="w-3 h-3 mr-1" /> Track
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ogg"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </div>
      </CardHeader>

      <CardContent
        className={`px-3 pb-3 rounded-b-xl text-sm ${
          isOver
            ? "bg-purple-50/70 border border-purple-400 rounded-md"
            : "bg-white/0"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {tracks.length === 0 && (
          <div className="text-[11px] text-neutral-500 italic">
            (drop or + .ogg here)
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {tracks.map((t, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between rounded-md bg-neutral-900 text-white px-2 py-1 text-[11px] leading-none shadow-sm"
            >
              <span className="font-mono break-all">{t.id}</span>
              <button
                className="text-red-400 hover:text-red-500"
                onClick={() => onRemove(idx)}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------ RegionEditor ------------------ */
function RegionEditor({ region, index, onChange, onDelete }) {
  // expand/collapse for the whole region card
  const [open, setOpen] = useState(true);

  function updateRegion(partial) {
    onChange({ ...region, ...partial });
  }

  // ---- LAYERS helpers ----
  function addLayer(which) {
    const next = [...region[which], []];
    updateRegion({ [which]: next });
  }

  function deleteLayer(which, layerIdx) {
    const next = region[which].filter((_, i) => i !== layerIdx);
    if (next.length === 0) next.push([]);
    updateRegion({ [which]: next });
  }

  // add files to a specific layer
  function addTracksToLayer(which, layerIdx, files) {
    const nextLayers = region[which].map((layer, i) => {
      if (i !== layerIdx) return layer;
      return [...layer, ...files.map((f) => makeTrackFromFile(f))];
    });
    updateRegion({ [which]: nextLayers });
  }

  function removeTrackFromLayer(which, layerIdx, trackIdx) {
    const nextLayers = region[which].map((layer, i) => {
      if (i !== layerIdx) return layer;
      return layer.filter((_, j) => j !== trackIdx);
    });
    updateRegion({ [which]: nextLayers });
  }

  // move a track between/within layers
  function moveTrack(which, targetLayerIdx, payload) {
    const { layerIdx: fromLayerIdx, trackIdx } = payload;
    if (fromLayerIdx === undefined) return;

    const allLayers = region[which].map((layer) => [...layer]);

    const [movedTrack] = allLayers[fromLayerIdx].splice(trackIdx, 1);
    if (!movedTrack) return;

    allLayers[targetLayerIdx].push(movedTrack);
    updateRegion({ [which]: allLayers });
  }

  // move/reorder an entire layer
  function moveLayer(which, targetLayerIdx, payload) {
    const { layerIdx: fromIdx } = payload;
    if (fromIdx === undefined) return;

    const allLayers = region[which].map((layer) => [...layer]);
    const [moved] = allLayers.splice(fromIdx, 1);
    if (!moved) return;

    allLayers.splice(targetLayerIdx, 0, moved);
    updateRegion({ [which]: allLayers });
  }

  // ---- MUSIC helpers ----
  function addMusic(files) {
    const next = [...region.music, ...files.map((f) => makeTrackFromFile(f))];
    updateRegion({ music: next });
  }

  function removeMusic(idx) {
    const next = region.music.filter((_, i) => i !== idx);
    updateRegion({ music: next });
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-neutral-300 shadow-md rounded-xl overflow-hidden">
      {/* Region header bar */}
      <CardHeader className="flex items-stretch justify-between bg-gradient-to-r from-neutral-900 to-neutral-700 text-white px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-2 w-full">
          <div className="flex items-center gap-2 text-base font-semibold">
            <button
              className="text-neutral-200 hover:text-white flex-shrink-0"
              onClick={() => setOpen((o) => !o)}
              title={open ? "Collapse" : "Expand"}
            >
              {open ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            <span className="text-neutral-300 text-sm font-normal">
              #{index}
            </span>
            <Input
              className="text-base font-semibold text-white bg-neutral-800/60 border-neutral-600 focus:ring-purple-400 placeholder:text-neutral-400"
              value={region.name}
              onChange={(e) => updateRegion({ name: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Button
            type="button"
            variant="destructive"
            size="xs"
            className="px-2 py-1 h-6 border-white/20 bg-red-600 hover:bg-red-700"
            onClick={onDelete}
            title="Delete region"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="px-4 py-4 flex flex-col gap-6 text-sm text-neutral-800 bg-white">
          {/* Day Threat Layers */}
          <CollapsibleSection
            title="Day Threat Layers"
            icon={<Sun className="w-4 h-4 text-yellow-500" />}
            defaultOpen={true}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="text-[12px] text-neutral-500 leading-tight">
                Drag individual chips to move tracks between layers. Drag the
                grey layer tag to reorder whole layers.
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="px-2 py-1 h-6"
                onClick={() => addLayer("layers")}
              >
                <Plus className="w-3 h-3 mr-1" /> Layer
              </Button>
            </div>

            <div className="grid gap-3">
              {region.layers.map((layerTracks, layerIdx) => (
                <LayerRow
                  key={layerIdx}
                  label={`Layer ${layerIdx + 1}`}
                  layerIdx={layerIdx}
                  tracks={layerTracks}
                  onFilesAdded={(files) =>
                    addTracksToLayer("layers", layerIdx, files)
                  }
                  onTrackRemove={(lIdx, tIdx) =>
                    removeTrackFromLayer("layers", lIdx, tIdx)
                  }
                  onMoveTrackHere={(payload) =>
                    moveTrack("layers", layerIdx, payload)
                  }
                  onMoveLayerHere={(payload) =>
                    moveLayer("layers", layerIdx, payload)
                  }
                  onDeleteLayer={() => deleteLayer("layers", layerIdx)}
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* Night Threat Layers */}
          <CollapsibleSection
            title="Night Threat Layers"
            icon={<Moon className="w-4 h-4 text-blue-500" />}
            defaultOpen={false}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="text-[12px] text-neutral-500 leading-tight">
                Same rules as Day Threat Layers, but these tracks are used at
                night.
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="px-2 py-1 h-6"
                onClick={() => addLayer("nightLayers")}
              >
                <Plus className="w-3 h-3 mr-1" /> Layer
              </Button>
            </div>

            <div className="grid gap-3">
              {region.nightLayers.map((layerTracks, layerIdx) => (
                <LayerRow
                  key={layerIdx}
                  label={`Layer ${layerIdx + 1}`}
                  layerIdx={layerIdx}
                  tracks={layerTracks}
                  onFilesAdded={(files) =>
                    addTracksToLayer("nightLayers", layerIdx, files)
                  }
                  onTrackRemove={(lIdx, tIdx) =>
                    removeTrackFromLayer("nightLayers", lIdx, tIdx)
                  }
                  onMoveTrackHere={(payload) =>
                    moveTrack("nightLayers", layerIdx, payload)
                  }
                  onMoveLayerHere={(payload) =>
                    moveLayer("nightLayers", layerIdx, payload)
                  }
                  onDeleteLayer={() => deleteLayer("nightLayers", layerIdx)}
                />
              ))}
            </div>
          </CollapsibleSection>

          {/* Ambient / Exploration Music */}
          <CollapsibleSection
            title="Ambient / Exploration Music"
            icon={<Sun className="w-4 h-4 text-orange-400" />}
            defaultOpen={false}
          >
            <MusicList
              title="Ambient / Exploration Tracks"
              tracks={region.music}
              onFilesAdded={addMusic}
              onRemove={removeMusic}
            />
            <p className="text-[11px] text-neutral-500 mt-2 leading-tight">
              These tracks export to{" "}
              <code className="font-mono">sounds/songs/</code>. Threat layers
              export to
              <code className="font-mono"> sounds/threatMusic/</code>.
            </p>
          </CollapsibleSection>
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------ Main App Layout ------------------ */
export default function ThreatMusicBuilder() {
  const [regions, setRegions] = useState([makeEmptyRegion(0)]);

  function addRegion() {
    setRegions((prev) => [...prev, makeEmptyRegion(prev.length)]);
  }
  function updateRegion(idx, newRegion) {
    setRegions((prev) => prev.map((r, i) => (i === idx ? newRegion : r)));
  }
  function deleteRegion(idx) {
    setRegions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleExportZip() {
    // create zip structure
    const zip = new JSZip();
    const root = zip.folder("customMusic");
    const regionsFolder = root.folder("regions");
    const soundsFolder = root.folder("sounds");
    const songsFolder = soundsFolder.folder("songs");
    const threatFolder = soundsFolder.folder("threatMusic");

    // We'll dedupe audio exports by id
    const songAdded = new Set();
    const threatAdded = new Set();

    // normalize tracks from either "string" or {id,file}
    function normalizeTrack(t) {
      if (typeof t === "string") {
        return { id: t, file: undefined };
      }
      return t;
    }

    // 1. Region JSONs
    regions.forEach((r) => {
      const jsonOut = {
        name: r.name,
        layers: r.layers.map((layerArr) =>
          layerArr.map((t) => normalizeTrack(t).id)
        ),
        nightLayers: r.nightLayers.map((layerArr) =>
          layerArr.map((t) => normalizeTrack(t).id)
        ),
        music: r.music.map((t) => normalizeTrack(t).id),
      };
      const fileBase = sanitizeName(r.name) || "region";
      regionsFolder.file(
        fileBase + ".json",
        JSON.stringify(jsonOut, null, 2)
      );
    });

    // 2. Copy Ambient music tracks -> sounds/songs/
    regions.forEach((r) => {
      r.music.forEach((tRaw) => {
        const t = normalizeTrack(tRaw);
        if (!songAdded.has(t.id) && t.file) {
          songAdded.add(t.id);
          songsFolder.file(t.id + ".ogg", t.file);
        }
      });
    });

    // 3. Copy Threat tracks -> sounds/threatMusic/
    regions.forEach((r) => {
      // day
      r.layers.forEach((layerArr) => {
        layerArr.forEach((tRaw) => {
          const t = normalizeTrack(tRaw);
          if (!threatAdded.has(t.id) && t.file) {
            threatAdded.add(t.id);
            threatFolder.file(t.id + ".ogg", t.file);
          }
        });
      });
      // night
      r.nightLayers.forEach((layerArr) => {
        layerArr.forEach((tRaw) => {
          const t = normalizeTrack(tRaw);
          if (!threatAdded.has(t.id) && t.file) {
            threatAdded.add(t.id);
            threatFolder.file(t.id + ".ogg", t.file);
          }
        });
      });
    });

    // 4. Download zip
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "customMusic.zip");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-100 via-neutral-200 to-neutral-300 text-neutral-900 flex flex-col">
      {/* Top nav bar */}
      <header className="sticky top-0 z-20 bg-neutral-950 text-white shadow-lg border-b border-neutral-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 py-4 max-w-7xl mx-auto w-full">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-white tracking-[-0.03em] flex items-center gap-2">
              <span className="text-purple-400 font-bold">Threat</span>
              Music Pack Builder
            </h1>
            <p className="text-[11px] text-neutral-400 leading-snug max-w-xl">
              Build custom region JSONs and bundle your .ogg files into a
              pack-ready zip. Drag to reorder layers & tracks.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-lg border-white/20 bg-neutral-800/60 hover:bg-neutral-700/80 text-white"
              variant="ghost"
              size="sm"
              onClick={addRegion}
            >
              <Plus className="w-4 h-4 mr-1" /> New Region
            </Button>

            <Button
              type="button"
              className="rounded-lg border-white/20 bg-purple-600 hover:bg-purple-500 text-white shadow-md"
              size="sm"
              onClick={handleExportZip}
            >
              <Download className="w-4 h-4 mr-1" /> Save as Zip
            </Button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Sidebar / info panel */}
        <aside className="md:sticky md:top-[4.5rem] h-min bg-white/80 backdrop-blur-sm rounded-xl border border-neutral-300 shadow-sm p-4 flex flex-col gap-4 text-sm text-neutral-700">
          <section>
            <h2 className="text-[13px] font-semibold text-neutral-900 mb-1">
              How to use
            </h2>
            <ol className="text-[12px] leading-relaxed list-decimal list-inside space-y-1 text-neutral-600">
              <li>Add or rename regions.</li>
              <li>
                Drop .ogg files into Day/Night threat layers or Ambient Music.
              </li>
              <li>Drag chips to move tracks between layers.</li>
              <li>Click "Save as Zip".</li>
            </ol>
          </section>

          <section className="text-[11px] leading-snug text-neutral-500">
            <p className="mb-2 font-semibold text-neutral-700">
              Minecraft naming rules
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>File names forced to lowercase.</li>
              <li>
                Spaces become <code className="font-mono">_</code>.
              </li>
              <li>
                Region JSON files go into{" "}
                <code className="font-mono">regions/</code>.
              </li>
              <li>
                Ambient .ogg go into{" "}
                <code className="font-mono">sounds/songs/</code>.
              </li>
              <li>
                Threat layer .ogg go into{" "}
                <code className="font-mono">sounds/threatMusic/</code>.
              </li>
            </ul>
          </section>
        </aside>

        {/* Regions list */}
        <section className="grid gap-6">
          {regions.length === 0 && (
            <div className="text-sm italic text-neutral-500 bg-white/60 backdrop-blur-sm rounded-lg border border-neutral-300 shadow-sm p-4">
              No regions yet. Click "New Region".
            </div>
          )}

          {regions.map((r, idx) => (
            <RegionEditor
              key={r.id}
              region={r}
              index={idx}
              onChange={(nr) => updateRegion(idx, nr)}
              onDelete={() => deleteRegion(idx)}
            />
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-[10px] text-neutral-600 text-center py-6 border-t border-neutral-300 bg-neutral-200/40">
        <p className="leading-relaxed max-w-3xl mx-auto px-4">
          Export creates customMusic/ with regions/*.json, sounds/songs/*.ogg
          and sounds/threatMusic/*.ogg. All names are sanitized for Minecraft.
        </p>
      </footer>
    </div>
  );
}
