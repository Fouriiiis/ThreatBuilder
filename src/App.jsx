import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Trash2, Plus, Download, Moon, Sun } from "lucide-react";

/* --- Minimal inline UI components to avoid "@/components/ui/*" imports.
   You can swap these back to shadcn Button/Card/etc in your actual project.
*/
function Button({ className="", variant, size, ...props }) {
  const base =
    "inline-flex items-center justify-center rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    outline: "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50",
    destructive: "border-red-600 bg-red-600 text-white hover:bg-red-700",
    default: "border-neutral-800 bg-neutral-800 text-white hover:bg-neutral-700",
  };
  const sizes = {
    sm: "h-7 px-2 py-1 text-xs",
    md: "h-9 px-3 py-2 text-sm",
  };
  return (
    <button
      className={`${base} ${variants[variant||"default"]} ${sizes[size||"md"]} ${className}`}
      {...props}
    />
  );
}

function Card({ className="", children }) {
  return (
    <div className={`border border-neutral-300 shadow-md rounded-2xl bg-white ${className}`}>
      {children}
    </div>
  );
}
function CardHeader({ className="", children }) {
  return (
    <div className={`border-b border-neutral-200 rounded-t-2xl ${className}`}>
      {children}
    </div>
  );
}
function CardContent({ className="", ...props }) {
  return (
    <div className={className} {...props} />
  );
}
function Input(props) {
  return (
    <input
      {...props}
      className={
        "rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500 " +
        (props.className||"")
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
    layers: [ [] ],       // array of layer arrays, each layer array is Track[]
    nightLayers: [ [] ],
    music: [],            // Track[]
  };
}

// drag payload types
const DRAG_TRACK = "drag/track";
const DRAG_LAYER = "drag/layer";

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
      const oggFiles = Array
        .from(e.dataTransfer.files)
        .filter(f => f.name.toLowerCase().endsWith(".ogg"));
      if (oggFiles.length && onDropFiles) {
        onDropFiles(oggFiles);
      }
      return;
    }

    // 2) DnD payload
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
      className={
        `rounded-xl border border-dashed p-2 transition-colors ${
          isOver ? "bg-purple-100 border-purple-500" : "bg-transparent border-neutral-300"
        } ${className || ""}`
      }
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}

/* ------------------ TrackChip ------------------ */
function TrackChip({
  track,
  layerIdx,
  trackIdx,
  onRemove,
}) {
  function handleDragStart(e) {
    e.dataTransfer.setData("kind", DRAG_TRACK);
    e.dataTransfer.setData("payload", JSON.stringify({ layerIdx, trackIdx }));
  }

  return (
    <div
      className="flex items-center gap-1 rounded-lg bg-neutral-800 text-white px-2 py-1 text-xs cursor-move select-none"
      draggable
      onDragStart={handleDragStart}
    >
      <span className="font-mono break-all">{track.id}</span>
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
      className="mb-2"
    >
      <div className="flex flex-col gap-2">
        {/* header row */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-lg bg-neutral-200 text-neutral-900 px-2 py-1 text-xs font-bold cursor-move select-none"
            draggable
            onDragStart={handleDragStartLayer}
            title="Drag to reorder/move this whole layer"
          >
            <span>{label}</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 py-1 text-xs"
            onClick={handlePick}
            title="Add track(s) via file picker (.ogg)"
          >
            <Plus className="w-3 h-3" /> Track
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
            size="sm"
            className="h-7 px-2 py-1 text-xs"
            onClick={onDeleteLayer}
            title="Delete this layer"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* tracks row */}
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
            <div className="text-xs text-neutral-500 italic">(drop or + .ogg here)</div>
          )}
        </div>
      </div>
    </TrackDropZone>
  );
}

/* ------------------ MusicList ------------------ */
function MusicList({
  title,
  tracks,
  onFilesAdded,
  onRemove,
}) {
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
      const oggFiles = Array
        .from(e.dataTransfer.files)
        .filter(f => f.name.toLowerCase().endsWith(".ogg"));
      if (oggFiles.length) onFilesAdded(oggFiles);
    }
  }

  return (
    <Card className="border border-neutral-300 shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3 bg-white rounded-t-2xl">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sun className="w-4 h-4" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 py-1 text-xs"
            onClick={startPick}
          >
            <Plus className="w-3 h-3" /> Track
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
        className={`px-3 pb-3 rounded-b-2xl ${
          isOver ? "bg-purple-100 border border-purple-500 rounded-xl" : ""
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {tracks.length === 0 && (
          <div className="text-xs text-neutral-500 italic">(drop or + .ogg here)</div>
        )}
        <ul className="flex flex-col gap-1">
          {tracks.map((t, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between rounded-lg bg-neutral-800 text-white px-2 py-1 text-xs"
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
function RegionEditor({
  region,
  index,
  onChange,
  onDelete,
}) {
  function updateRegion(partial) {
    onChange({ ...region, ...partial });
  }

  // ---- LAYERS helpers (day + night) ----
  function addLayer(which) {
    const next = [...region[which], []];
    updateRegion({ [which]: next });
  }

  function deleteLayer(which, layerIdx) {
    const next = region[which].filter((_,i)=>i!==layerIdx);
    if (next.length === 0) next.push([]);
    updateRegion({ [which]: next });
  }

  // add files to a specific layer
  function addTracksToLayer(which, layerIdx, files) {
    const nextLayers = region[which].map((layer,i)=>{
      if (i !== layerIdx) return layer;
      return [
        ...layer,
        ...files.map(f => makeTrackFromFile(f)),
      ];
    });
    updateRegion({ [which]: nextLayers });
  }

  function removeTrackFromLayer(which, layerIdx, trackIdx) {
    const nextLayers = region[which].map((layer,i)=>{
      if (i!==layerIdx) return layer;
      return layer.filter((_,j)=>j!==trackIdx);
    });
    updateRegion({ [which]: nextLayers });
  }

  // move track between layers (or within the same layer)
  function moveTrack(which, targetLayerIdx, payload) {
    const { layerIdx: fromLayerIdx, trackIdx } = payload;
    if (fromLayerIdx === undefined) return;

    const allLayers = region[which].map(layer => [...layer]);

    const [movedTrack] = allLayers[fromLayerIdx].splice(trackIdx, 1);
    if (!movedTrack) return;

    allLayers[targetLayerIdx].push(movedTrack);
    updateRegion({ [which]: allLayers });
  }

  // move/reorder an entire layer
  function moveLayer(which, targetLayerIdx, payload) {
    const { layerIdx: fromIdx } = payload;
    if (fromIdx === undefined) return;

    const allLayers = region[which].map(layer => [...layer]);
    const [moved] = allLayers.splice(fromIdx,1);
    if (!moved) return;

    allLayers.splice(targetLayerIdx,0,moved);
    updateRegion({ [which]: allLayers });
  }

  // ---- MUSIC helpers ----
  function addMusic(files) {
    const next = [
      ...region.music,
      ...files.map(f => makeTrackFromFile(f)),
    ];
    updateRegion({ music: next });
  }

  function removeMusic(idx) {
    const next = region.music.filter((_,i)=>i!==idx);
    updateRegion({ music: next });
  }

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col gap-2 py-3 px-4 bg-white rounded-t-2xl">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-neutral-500 text-base">#{index}</span>
            <Input
              className="text-base font-semibold"
              value={region.name}
              onChange={e => updateRegion({ name: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8"
            onClick={onDelete}
            title="Delete region"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-4 flex flex-col gap-6 rounded-b-2xl bg-white">
        {/* Day Threat Layers */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sun className="w-4 h-4" />
            <span>Day Threat Layers</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 py-1 text-xs"
              onClick={()=>addLayer("layers")}
            >
              <Plus className="w-3 h-3" /> Layer
            </Button>
          </div>

          <div className="grid gap-2">
            {region.layers.map((layerTracks, layerIdx) => (
              <LayerRow
                key={layerIdx}
                label={`Layer ${layerIdx+1}`}
                layerIdx={layerIdx}
                tracks={layerTracks}
                onFilesAdded={(files)=>addTracksToLayer("layers", layerIdx, files)}
                onTrackRemove={(lIdx,tIdx)=>removeTrackFromLayer("layers", lIdx, tIdx)}
                onMoveTrackHere={(payload)=>moveTrack("layers", layerIdx, payload)}
                onMoveLayerHere={(payload)=>moveLayer("layers", layerIdx, payload)}
                onDeleteLayer={()=>deleteLayer("layers", layerIdx)}
              />
            ))}
          </div>
        </section>

        {/* Night Threat Layers */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Moon className="w-4 h-4" />
            <span>Night Threat Layers</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 py-1 text-xs"
              onClick={()=>addLayer("nightLayers")}
            >
              <Plus className="w-3 h-3" /> Layer
            </Button>
          </div>

          <div className="grid gap-2">
            {region.nightLayers.map((layerTracks, layerIdx) => (
              <LayerRow
                key={layerIdx}
                label={`Layer ${layerIdx+1}`}
                layerIdx={layerIdx}
                tracks={layerTracks}
                onFilesAdded={(files)=>addTracksToLayer("nightLayers", layerIdx, files)}
                onTrackRemove={(lIdx,tIdx)=>removeTrackFromLayer("nightLayers", lIdx, tIdx)}
                onMoveTrackHere={(payload)=>moveTrack("nightLayers", layerIdx, payload)}
                onMoveLayerHere={(payload)=>moveLayer("nightLayers", layerIdx, payload)}
                onDeleteLayer={()=>deleteLayer("nightLayers", layerIdx)}
              />
            ))}
          </div>
        </section>

        {/* Ambient / Exploration Music */}
        <section className="flex flex-col gap-2">
          <MusicList
            title="Ambient / Exploration Music"
            tracks={region.music}
            onFilesAdded={addMusic}
            onRemove={removeMusic}
          />
        </section>
      </CardContent>
    </Card>
  );
}

/* ------------------ Main App ------------------ */
export default function ThreatMusicBuilder() {
  const [regions, setRegions] = useState([ makeEmptyRegion(0) ]);

  function addRegion() {
    setRegions(prev => [...prev, makeEmptyRegion(prev.length)]);
  }

  function updateRegion(idx, newRegion) {
    setRegions(prev => prev.map((r,i)=> i===idx ? newRegion : r));
  }

  function deleteRegion(idx) {
    setRegions(prev => prev.filter((_,i)=>i!==idx));
  }

async function handleExportZip() {
  const zip = new JSZip();
  const root = zip.folder("customMusic");
  const regionsFolder = root.folder("regions");
  const soundsFolder = root.folder("sounds");
  const songsFolder = soundsFolder.folder("songs");
  const threatFolder = soundsFolder.folder("threatMusic");

  // Dedup
  const songAdded = new Set();
  const threatAdded = new Set();

  // Helper to normalize a track entry that might be:
  //   "stringName"
  //   OR { id: "stringName", file: File }
  function normalizeTrack(t) {
    if (typeof t === "string") {
      return { id: t, file: undefined };
    }
    return t; // already {id, file}
  }

  // 1. Write region JSONs
  regions.forEach(r => {
    const jsonOut = {
      name: r.name,
      layers: r.layers.map(layerArr =>
        layerArr.map(t => normalizeTrack(t).id)
      ),
      nightLayers: r.nightLayers.map(layerArr =>
        layerArr.map(t => normalizeTrack(t).id)
      ),
      music: r.music.map(t => normalizeTrack(t).id),
    };

    const fileBase = sanitizeName(r.name) || "region";
    regionsFolder.file(fileBase + ".json", JSON.stringify(jsonOut, null, 2));
  });

  // 2. Add music tracks -> sounds/songs/
  regions.forEach(r => {
    r.music.forEach(tRaw => {
      const t = normalizeTrack(tRaw);
      if (!songAdded.has(t.id) && t.file) {
        songAdded.add(t.id);
        songsFolder.file(t.id + ".ogg", t.file);
      }
    });
  });

  // 3. Add threat layer tracks -> sounds/threatMusic/
  regions.forEach(r => {
    // day
    r.layers.forEach(layerArr => {
      layerArr.forEach(tRaw => {
        const t = normalizeTrack(tRaw);
        if (!threatAdded.has(t.id) && t.file) {
          threatAdded.add(t.id);
          threatFolder.file(t.id + ".ogg", t.file);
        }
      });
    });
    // night
    r.nightLayers.forEach(layerArr => {
      layerArr.forEach(tRaw => {
        const t = normalizeTrack(tRaw);
        if (!threatAdded.has(t.id) && t.file) {
          threatAdded.add(t.id);
          threatFolder.file(t.id + ".ogg", t.file);
        }
      });
    });
  });

  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "customMusic.zip");
}


  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 p-4 md:p-8 grid gap-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Threat Music Pack Builder</h1>
          <p className="text-sm text-neutral-600 max-w-xl">
            Drag & drop .ogg files into layers or music. Reorder tracks (drag chips)
            or whole layers (drag layer tag). Export to a ready-to-pack zip.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            className="rounded-2xl shadow-md"
            onClick={addRegion}
          >
            <Plus className="w-4 h-4 mr-1" /> New Region
          </Button>

          <Button
            type="button"
            className="rounded-2xl shadow-md"
            onClick={handleExportZip}
          >
            <Download className="w-4 h-4 mr-1" /> Save as Zip
          </Button>
        </div>
      </header>

      <main className="grid gap-6">
        {regions.length === 0 && (
          <div className="text-sm italic text-neutral-500">
            No regions yet. Click "New Region".
          </div>
        )}

        {regions.map((r, idx) => (
          <RegionEditor
            key={r.id}
            region={r}
            index={idx}
            onChange={(nr)=>updateRegion(idx,nr)}
            onDelete={()=>deleteRegion(idx)}
          />
        ))}
      </main>

      <footer className="text-[10px] text-neutral-500 text-center pt-4 pb-8">
        <p>
          File naming rules: .ogg files become lowercase and spaces → _. Region
          json filenames also lowercase and spaces → _.
        </p>
      </footer>
    </div>
  );
}
