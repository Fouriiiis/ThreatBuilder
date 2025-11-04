import React, { useState, useRef } from "react";
import "./builder.css";
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

/* ------------------ Helpers ------------------ */
function sanitizeName(raw) {
  // normalize
  const lower = String(raw ?? "").toLowerCase();
  // 1) convert spaces to underscore
  // 2) remove dot-like characters entirely (., fullwidth/ideographic variants)
  // 3) replace any remaining non [a-z0-9_-] with underscore
  // 4) collapse multiple underscores and trim leading/trailing underscores
  return lower
    .replace(/\s+/g, "_")
    .replace(/[.\u3002\uff0e\uff61]+/g, "")
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
// Track object = { id: string, file: File }
function makeTrackFromFile(file) {
  const baseId = sanitizeName(file.name.replace(/\.ogg$/i, ""));
  return { id: baseId, file };
}

function makeEmptyRegion(idx) {
  return {
    id: crypto.randomUUID(),
    name: `Region ${idx}`,
    layers: [[]], // array of arrays of Track
    nightLayers: [[]],
    music: [], // Track[]
  };
}

const DRAG_TRACK = "drag/track";
const DRAG_LAYER = "drag/layer";

/* ------------------ Generic Button ------------------ */
function Btn({ children, onClick, kind = "default" }) {
  let cls = "btn";
  if (kind === "primary") cls += " btn-primary";
  if (kind === "danger") cls += " btn-danger";
  return (
    <button className={cls} onClick={onClick} type="button">
      {children}
    </button>
  );
}

/* ------------------ Collapsible Section ------------------ */
function CollapsibleSection({ title, icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section-shell">
      <div
        className="section-head"
        onClick={() => setOpen((o) => !o)}
        role="button"
      >
        <div className="section-head-left">
          <span className="icon">{icon}</span>
          <span>{title}</span>
        </div>
        <div className="section-chevron">
          {open ? <ChevronDown /> : <ChevronRight />}
        </div>
      </div>

      {open && <div className="section-inner">{children}</div>}
    </div>
  );
}

/* ------------------ Drag/Drop zone per layer ------------------ */
function TrackDropZone({
  onDropFiles,
  onDropMoveTrack,
  onDropMoveLayer,
  acceptLayer,
  acceptTrack,
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

    // 1) files dropped?
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const oggFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".ogg")
      );
      if (oggFiles.length && onDropFiles) {
        onDropFiles(oggFiles);
      }
      return;
    }

    // 2) custom drag payload (track/layer)
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

  const zoneCls = isOver
    ? "layer-dropzone drag-over"
    : "layer-dropzone";

  return (
    <div
      className={zoneCls}
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
      className="track-chip"
      draggable
      onDragStart={handleDragStart}
      title="Drag to move this track between layers"
    >
      <span className="track-chip-id">{track.id}</span>
      <button
        className="track-chip-remove"
        onClick={onRemove}
        title="Remove track"
      >
        <Trash2 className="icon" />
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

  function pickFiles() {
    fileInputRef.current?.click();
  }
  function onFileChange(e) {
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
    >
      {/* header row */}
      <div className="layer-header-row">
        <div
          className="layer-handle"
          draggable
          onDragStart={handleDragStartLayer}
          title="Drag to move this whole layer"
        >
          {label}
        </div>

        <Btn onClick={pickFiles}>
          <Plus className="icon" />
          <span>Track</span>
        </Btn>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ogg"
          multiple
          style={{ display: "none" }}
          onChange={onFileChange}
        />

        <Btn kind="danger" onClick={onDeleteLayer}>
          <Trash2 className="icon" />
        </Btn>
      </div>

      {/* tracks */}
      <div className="tracks-row">
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
          <div className="track-empty-hint">
            (drop or + .ogg here)
          </div>
        )}
      </div>
    </TrackDropZone>
  );
}

/* ------------------ MusicList ------------------ */
function MusicList({ title, tracks, onFilesAdded, onRemove }) {
  const [over, setOver] = useState(false);
  const pickerRef = useRef(null);

  function startPick() {
    pickerRef.current?.click();
  }

  function onPick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesAdded(files);
    e.target.value = "";
  }

  function dragOver(e) {
    e.preventDefault();
    setOver(true);
  }
  function dragLeave() {
    setOver(false);
  }
  function drop(e) {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const oggFiles = Array.from(e.dataTransfer.files).filter((f) =>
        f.name.toLowerCase().endsWith(".ogg")
      );
      if (oggFiles.length) onFilesAdded(oggFiles);
    }
  }

  return (
    <div className="music-card">
      <div className="music-head">
        <div className="music-head-left">
          <Sun className="icon" />
          <span>{title}</span>
        </div>

        <Btn onClick={startPick}>
          <Plus className="icon" />
          <span>Track</span>
        </Btn>
        <input
          ref={pickerRef}
          type="file"
          accept=".ogg"
          multiple
          style={{ display: "none" }}
          onChange={onPick}
        />
      </div>

      <div
        className={`music-body ${over ? "drag-over" : ""}`}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        {tracks.length === 0 ? (
          <div className="track-empty-hint">
            (drop or + .ogg here)
          </div>
        ) : (
          <ul className="music-track-list">
            {tracks.map((t, idx) => (
              <li key={idx} className="music-track-item">
                <span className="music-track-id">{t.id}</span>
                <button
                  className="music-remove-btn"
                  title="Remove"
                  onClick={() => onRemove(idx)}
                >
                  <Trash2 className="icon" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------ RegionEditor ------------------ */
function RegionEditor({ region, index, onChange, onDelete }) {
  const [open, setOpen] = useState(true);

  function updateRegion(partial) {
    onChange({ ...region, ...partial });
  }

  // ----- layer helpers -----
  function addLayer(which) {
    const next = [...region[which], []];
    updateRegion({ [which]: next });
  }

  function deleteLayer(which, layerIdx) {
    const next = region[which].filter((_, i) => i !== layerIdx);
    if (next.length === 0) next.push([]);
    updateRegion({ [which]: next });
  }

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

  // move individual track
  function moveTrack(which, targetLayerIdx, payload) {
    const { layerIdx: fromLayerIdx, trackIdx } = payload;
    if (fromLayerIdx === undefined) return;

    const allLayers = region[which].map((layer) => [...layer]);
    const [movedTrack] = allLayers[fromLayerIdx].splice(trackIdx, 1);
    if (!movedTrack) return;
    allLayers[targetLayerIdx].push(movedTrack);

    updateRegion({ [which]: allLayers });
  }

  // move whole layer
  function moveLayer(which, targetLayerIdx, payload) {
    const { layerIdx: fromIdx } = payload;
    if (fromIdx === undefined) return;

    const allLayers = region[which].map((layer) => [...layer]);
    const [moved] = allLayers.splice(fromIdx, 1);
    if (!moved) return;
    allLayers.splice(targetLayerIdx, 0, moved);

    updateRegion({ [which]: allLayers });
  }

  // music helpers
  function addMusic(files) {
    const next = [
      ...region.music,
      ...files.map((f) => makeTrackFromFile(f)),
    ];
    updateRegion({ music: next });
  }
  function removeMusic(idx) {
    const next = region.music.filter((_, i) => i !== idx);
    updateRegion({ music: next });
  }

  return (
    <div className="region-card">
      {/* HEADER */}
      <div className="region-card-header">
        <div className="region-header-left">
          <div
            className="region-collapse-btn"
            onClick={() => setOpen((o) => !o)}
            title={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="icon" /> : <ChevronRight className="icon" />}
          </div>

          <div className="region-index-label">#{index}</div>

          <input
            className="region-name-input"
            value={region.name}
            onChange={(e) => updateRegion({ name: e.target.value })}
          />
        </div>

        <div>
          <Btn kind="danger" onClick={onDelete}>
            <Trash2 className="icon" />
            <span>Delete</span>
          </Btn>
        </div>
      </div>

      {/* BODY */}
      {open && (
        <div className="region-card-body">
          {/* Day Threat Layers */}
          <CollapsibleSection
            title="Day Threat Layers"
            icon={<Sun color={getComputedStyle(document.documentElement).getPropertyValue('--accent-gold') || "#ffbf4d"} />}
            defaultOpen={true}
          >
            <div className="section-helper-row">
              <div className="section-helper-text">
                Drag track chips to move them between layers. Drag the gray
                layer tag to reorder entire layers.
              </div>
              <Btn onClick={() => addLayer("layers")}>
                <Plus className="icon" />
                <span>New Layer</span>
              </Btn>
            </div>

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
          </CollapsibleSection>

          {/* Night Threat Layers */}
          <CollapsibleSection
            title="Night Threat Layers"
            icon={<Moon color={getComputedStyle(document.documentElement).getPropertyValue('--accent-blue') || "#6fa5ff"} />}
            defaultOpen={false}
          >
            <div className="section-helper-row">
              <div className="section-helper-text">
                These layers are used at night. Same drag rules as day.
              </div>
              <Btn onClick={() => addLayer("nightLayers")}>
                <Plus className="icon" />
                <span>New Layer</span>
              </Btn>
            </div>

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
          </CollapsibleSection>

          {/* Ambient / Exploration Music */}
          <CollapsibleSection
            title="Ambient / Exploration Music"
            icon={<Sun color={getComputedStyle(document.documentElement).getPropertyValue('--accent-purple') || "#be96ff"} />}
            defaultOpen={false}
          >
            <MusicList
              title="Ambient / Exploration Tracks"
              tracks={region.music}
              onFilesAdded={addMusic}
              onRemove={removeMusic}
            />
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-dim)",
                marginTop: "8px",
                lineHeight: "1.4",
              }}
            >
              These export to <code className="side-inline-code">sounds/songs/</code>.
              Threat layers export to{" "}
              <code className="side-inline-code">sounds/threatMusic/</code>.
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

/* ------------------ Main App ------------------ */
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
    const zip = new JSZip();
    const root = zip.folder("customMusic");
    const regionsFolder = root.folder("regions");
    const soundsFolder = root.folder("sounds");
    const songsFolder = soundsFolder.folder("songs");
    const threatFolder = soundsFolder.folder("threatMusic");

    const songAdded = new Set();
    const threatAdded = new Set();

    function norm(t) {
      if (typeof t === "string") return { id: t, file: undefined };
      return t;
    }

      // write JSONs (omit empty lists)
      regions.forEach((r) => {
        const layersIds = r.layers.map((layerArr) =>
          layerArr.map((t) => norm(t).id)
        );
        const nightLayersIds = r.nightLayers.map((layerArr) =>
          layerArr.map((t) => norm(t).id)
        );
        const musicIds = r.music.map((t) => norm(t).id);

        const jsonOut = { name: r.name };
        const hasLayers = layersIds.some((layer) => layer.length > 0);
        const hasNightLayers = nightLayersIds.some((layer) => layer.length > 0);
        const hasMusic = musicIds.length > 0;

        if (hasLayers) jsonOut.layers = layersIds;
        if (hasNightLayers) jsonOut.nightLayers = nightLayersIds;
        if (hasMusic) jsonOut.music = musicIds;

        const fileBase = sanitizeName(r.name) || "region";
        regionsFolder.file(
          fileBase + ".json",
          JSON.stringify(jsonOut, null, 2)
        );
      });

    // ambient music -> sounds/songs/
    regions.forEach((r) => {
      r.music.forEach((tRaw) => {
        const t = norm(tRaw);
        if (!songAdded.has(t.id) && t.file) {
          songAdded.add(t.id);
          songsFolder.file(t.id + ".ogg", t.file);
        }
      });
    });

    // threat (day & night) -> sounds/threatMusic/
    regions.forEach((r) => {
      r.layers.forEach((layerArr) => {
        layerArr.forEach((tRaw) => {
          const t = norm(tRaw);
          if (!threatAdded.has(t.id) && t.file) {
            threatAdded.add(t.id);
            threatFolder.file(t.id + ".ogg", t.file);
          }
        });
      });
      r.nightLayers.forEach((layerArr) => {
        layerArr.forEach((tRaw) => {
          const t = norm(tRaw);
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
    <div className="app-shell">
      {/* header / toolbar */}
      <header className="app-header">
        <div className="app-header-left">
          <div className="app-title-row">
            <span className="app-title-accent">Threat</span>
            <span>Music Pack Builder</span>
          </div>
          <div className="app-subtitle">
            Build custom region JSONs and bundle your .ogg files into a
            pack-ready zip. Drag to reorder layers & tracks.
          </div>
        </div>

        <div className="app-header-right">
          <Btn onClick={addRegion}>
            <Plus className="icon" />
            <span>New Region</span>
          </Btn>

          <Btn kind="primary" onClick={handleExportZip}>
            <Download className="icon" />
            <span>Save as Zip</span>
          </Btn>
        </div>
      </header>

      {/* body layout */}
      <main className="app-body">
        {/* sidebar */}
        <aside className="side-panel">
          <div className="side-section">
            <div className="side-section-title">How to use</div>
            <ol className="side-ol">
              <li>Add or rename regions.</li>
              <li>
                Drop .ogg files into Day/Night threat layers or Ambient Music.
              </li>
              <li>Drag chips to move tracks between layers.</li>
              <li>Click “Save as Zip”.</li>
            </ol>
          </div>

          <div className="side-section">
            <div className="side-section-title">Minecraft naming rules</div>
            <ul className="side-list">
              <li>File names forced to lowercase.</li>
              <li>
                Spaces become <code className="side-inline-code">_</code>.
              </li>
              <li>
                Region JSON files go in{" "}
                <code className="side-inline-code">regions/</code>.
              </li>
              <li>
                Ambient .ogg go in{" "}
                <code className="side-inline-code">sounds/songs/</code>.
              </li>
              <li>
                Threat layer .ogg go in{" "}
                <code className="side-inline-code">
                  sounds/threatMusic/
                </code>
                .
              </li>
            </ul>
          </div>
        </aside>

        {/* regions list */}
        <section className="regions-col">
          {regions.map((r, idx) => (
            <RegionEditor
              key={r.id}
              region={r}
              index={idx}
              onChange={(nr) => updateRegion(idx, nr)}
              onDelete={() => deleteRegion(idx)}
            />
          ))}

          {regions.length === 0 && (
            <div
              style={{
                background: "var(--panel-bg)",
                border: "1px solid var(--panel-border)",
                borderRadius: "var(--panel-radius)",
                boxShadow: "var(--panel-shadow)",
                padding: "16px",
                fontSize: "12px",
                color: "var(--text-dim)",
                fontStyle: "italic",
              }}
            >
              No regions yet. Click “New Region”.
            </div>
          )}
        </section>
      </main>

      {/* footer */}
      <footer className="app-footer">
        Export creates <span className="side-inline-code">customMusic/</span>{" "}
        with{" "}
        <span className="side-inline-code">regions/*.json</span>,{" "}
        <span className="side-inline-code">sounds/songs/*.ogg</span>, and{" "}
        <span className="side-inline-code">sounds/threatMusic/*.ogg</span>. All
        names are sanitized for Minecraft.
      </footer>
    </div>
  );
}
