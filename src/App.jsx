import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Download, Moon, Sun } from "lucide-react";

// ------------------ Helpers ------------------
function sanitizeName(raw) {
  // lowercase, spaces -> _
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function makeEmptyRegion(idx) {
  return {
    id: crypto.randomUUID(),
    name: `Region ${idx}`,
    layers: [ [ ] ],            // threat layers (day)
    nightLayers: [ [ ] ],       // threat layers (night)
    music: [ ],                 // passive music
  };
}

// drag payload types so we can tell what is being dragged
const DRAG_TRACK = "drag/track";
const DRAG_LAYER = "drag/layer";

// ------------------ TrackDropZone ------------------
// A generic droppable area for either adding tracks or reordering
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

    // 1) Files?
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".ogg"));
      if (files.length && onDropFiles) {
        onDropFiles(files);
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
      className={
        `rounded-xl border border-dashed p-2 transition-colors ${isOver ? "bg-purple-100 border-purple-500" : "bg-transparent border-neutral-300"} ${className || ""}`
      }
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
}

// ------------------ TrackChip ------------------
function TrackChip({
  trackName,
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
      <span className="font-mono">{trackName}</span>
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

// ------------------ LayerRow ------------------
function LayerRow({
  label,
  layerIdx,
  tracks,
  onFilesAdded,
  onTrackRemove,
  onMoveTrackHere,
  onMoveLayerHere,
  onAddFromPicker,
  onDeleteLayer,
}) {
  const fileInputRef = useRef(null);

  function handlePick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesAdded(files);
    // reset so same file can be chosen twice if needed
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
        {/* header row = Layer label + controls */}
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
              trackName={trk}
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

// ------------------ MusicList ------------------
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
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".ogg"));
      if (files.length) onFilesAdded(files);
    }
  }

  return (
    <Card className="border border-neutral-300 shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
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
      <CardContent className={`px-3 pb-3 ${isOver ? "bg-purple-100 border border-purple-500 rounded-xl" : ""}`}
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
              <span className="font-mono break-all">{t}</span>
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

// ------------------ RegionEditor ------------------
function RegionEditor({
  region,
  index,
  onChange,
  onDelete,
}) {
  // local helpers to mutate region and call onChange(updated)
  function updateRegion(partial) {
    onChange({ ...region, ...partial });
  }

  // ---- LAYERS (day+night share logic w/ helper fns)
  function addLayer(which) {
    const key = which; // "layers" | "nightLayers"
    const next = [...region[key], []];
    updateRegion({ [key]: next });
  }
  function deleteLayer(which, layerIdx) {
    const key = which;
    const next = region[key].filter((_,i)=>i!==layerIdx);
    if (next.length === 0) next.push([]); // keep at least 1 layer
    updateRegion({ [key]: next });
  }

  function addTracksToLayer(which, layerIdx, files) {
    const sanitizeFile = (fName)=>{
      return sanitizeName(fName.replace(/\.ogg$/i, ""));
    };
    const key = which;
    const nextKeyLayers = region[key].map((layer,i)=>{
      if (i!==layerIdx) return layer;
      return [
        ...layer,
        ...files.map(f=>sanitizeFile(f.name)),
      ];
    });
    updateRegion({ [key]: nextKeyLayers });
  }

  function removeTrackFromLayer(which, layerIdx, trackIdx) {
    const key = which;
    const nextKeyLayers = region[key].map((layer,i)=>{
      if (i!==layerIdx) return layer;
      return layer.filter((_,j)=>j!==trackIdx);
    });
    updateRegion({ [key]: nextKeyLayers });
  }

  // drag move of a TRACK within/between layers
  function moveTrack(which, targetLayerIdx, payload) {
    const { layerIdx: fromLayerIdx, trackIdx } = payload;
    if (fromLayerIdx === undefined) return;

    const key = which;
    const allLayers = region[key].map(layer=>[...layer]);

    const [movedTrack] = allLayers[fromLayerIdx].splice(trackIdx,1);
    if (movedTrack === undefined) return;

    allLayers[targetLayerIdx].push(movedTrack);
    updateRegion({ [key]: allLayers });
  }

  // drag move of an entire LAYER within/between layer groups
  // NOTE: moving layer between day<->night is allowed
  function moveLayer(which, targetLayerIdx, payload) {
    const { layerIdx: fromIdx } = payload;
    if (fromIdx === undefined) return;

    const key = which;
    const allLayers = region[key].map(layer=>[...layer]);

    const [moved] = allLayers.splice(fromIdx,1);
    if (!moved) return;

    allLayers.splice(targetLayerIdx,0,moved);
    updateRegion({ [key]: allLayers });
  }

  // ---- MUSIC list helpers
  function addMusic(files) {
    const sanitizeFile = (fName)=>{
      return sanitizeName(fName.replace(/\.ogg$/i, ""));
    };
    const next = [...region.music, ...files.map(f=>sanitizeFile(f.name))];
    updateRegion({ music: next });
  }
  function removeMusic(idx) {
    const next = region.music.filter((_,i)=>i!==idx);
    updateRegion({ music: next });
  }

  return (
    <Card className="border border-neutral-300 shadow-lg rounded-2xl">
      <CardHeader className="flex flex-col gap-2 py-3 px-4">
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

      <CardContent className="px-4 pb-4 flex flex-col gap-6">
        {/* LAYERS (Day) */}
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
                onAddFromPicker={(files)=>addTracksToLayer("layers", layerIdx, files)}
                onDeleteLayer={()=>deleteLayer("layers", layerIdx)}
              />
            ))}
          </div>
        </section>

        {/* NIGHTLAYERS */}
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
                onAddFromPicker={(files)=>addTracksToLayer("nightLayers", layerIdx, files)}
                onDeleteLayer={()=>deleteLayer("nightLayers", layerIdx)}
              />
            ))}
          </div>
        </section>

        {/* MUSIC */}
        <section className="flex flex-col gap-2">
          <MusicList
            title="Ambient/Exploration Music"
            tracks={region.music}
            onFilesAdded={addMusic}
            onRemove={removeMusic}
          />
        </section>
      </CardContent>
    </Card>
  );
}

// ------------------ Main App ------------------
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
    // Build filesystem structure:
    // customMusic/
    //   regions/<region_name>.json
    //   sounds/songs/<music>.ogg
    //   sounds/threatMusic/<layerTracks>.ogg

    const zip = new JSZip();
    const root = zip.folder("customMusic");
    const regionsFolder = root.folder("regions");
    const songsFolder = root.folder("sounds").folder("songs");
    const threatFolder = root.folder("sounds").folder("threatMusic");

    // We'll gather unique filenames to avoid duplicates
    const addedSongNames = new Set();
    const addedThreatNames = new Set();

    // 1) Region JSONs
    regions.forEach(r => {
      const regionJson = {
        name: r.name,
        layers: r.layers,
        nightLayers: r.nightLayers,
        music: r.music,
      };
      const fileBase = sanitizeName(r.name) || "region";
      const fileName = fileBase + ".json";
      regionsFolder.file(fileName, JSON.stringify(regionJson, null, 2));
    });

    // NOTE: We can't automatically include the actual .ogg *binary* unless
    // we also track the File objects per track. Right now we only stored
    // sanitized names, not the original File blobs.
    //
    // Implementation plan:
    // - extend state shape later to keep {name, file} instead of just name.
    // - below is placeholder logic for when that data exists.

    // songsFolder.file("README.txt", "Put your .ogg music tracks here.");
    // threatFolder.file("README.txt", "Put your threat layer .ogg tracks here.");

    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "customMusic.zip");
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 p-4 md:p-8 grid gap-6">
      {/* Header / Toolbar */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold">Threat Music Pack Builder</h1>
          <p className="text-sm text-neutral-600 max-w-xl">
            Drag & drop .ogg files into layers or music. Reorder tracks (drag chips) or whole layers (drag layer tag). Export to a ready-to-pack zip.
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

      {/* Regions list */}
      <main className="grid gap-6">
        {regions.length === 0 && (
          <div className="text-sm italic text-neutral-500">No regions yet. Click "New Region".</div>
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
        <p>File naming rules: .ogg files become lowercase and spaces → _. Region json files also lowercase and spaces → _.</p>
      </footer>
    </div>
  );
}
