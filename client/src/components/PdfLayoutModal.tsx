import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DndContext, PointerSensor, useDroppable, useDraggable, useSensor, useSensors } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import Modal from "../ui/Modal";
import type { FormField } from "../api/forms";

type LayoutItem = { id: string; key: string; label: string };

type PdfGrid = {
  rows: number;
  cols: number;
  cells: Record<string, string>;
  rowRatios: number[];
  colRatios: number[];
};

type Props = {
  open: boolean;
  fields: FormField[];
  initialGrid: PdfGrid;
  onClose: () => void;
  onSave: (grid: PdfGrid) => void;
};

const MIN_ROWS = 1;
const MIN_COLS = 1;
const MAX_ROWS = 6;
const MAX_COLS = 6;

const cellId = (r: number, c: number) => `r${r}c${c}`;

const equalRatios = (n: number) => {
  if (n <= 0) return [];
  const v = Number((1 / n).toFixed(3));
  return Array.from({ length: n }, () => v);
};

function normalizeGrid(grid: PdfGrid): PdfGrid {
  const rows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, Number(grid.rows || 1)));
  const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, Number(grid.cols || 1)));
  const validIds = new Set<string>();
  for (let r = 1; r <= rows; r += 1) {
    for (let c = 1; c <= cols; c += 1) {
      validIds.add(cellId(r, c));
    }
  }

  const cells: Record<string, string> = {};
  for (const [id, key] of Object.entries(grid.cells || {})) {
    if (validIds.has(id) && typeof key === "string" && key) cells[id] = key;
  }

  const rowRatios = Array.isArray(grid.rowRatios) && grid.rowRatios.length === rows ? grid.rowRatios : equalRatios(rows);
  const colRatios = Array.isArray(grid.colRatios) && grid.colRatios.length === cols ? grid.colRatios : equalRatios(cols);

  return { rows, cols, cells, rowRatios, colRatios };
}

function DraggableAvailable({ item, disabled, onAdd }: { item: LayoutItem; disabled: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: "transform 120ms ease",
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="fieldRow">
      <div className="fieldRowTop">
        <div className="fieldRowTitle">{item.label}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ padding: "4px 8px" }} {...attributes} {...listeners} disabled={disabled}>
            ↕︎
          </button>
          <button className="btn" style={{ padding: "4px 8px" }} disabled={disabled} onClick={onAdd}>
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}

function DraggableCellItem({ item }: { item: LayoutItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: "transform 120ms ease",
    opacity: isDragging ? 0.6 : 1,
    background: "rgba(255,255,255,.06)",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 12,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {item.label}
    </div>
  );
}

function CellDropArea({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${id}` });
  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px dashed ${isOver ? "rgba(125,211,252,.6)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 10,
        padding: 8,
        minHeight: 60,
        height: "100%",
        display: "grid",
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}

export default function PdfLayoutModal({ open, fields, initialGrid, onClose, onSave }: Props) {
  const [grid, setGrid] = useState<PdfGrid>(() => normalizeGrid(initialGrid));
  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ axis: "row" | "col" | null; index: number }>({ axis: null, index: -1 });

  useEffect(() => {
    if (!open) return;
    setGrid(normalizeGrid(initialGrid));
  }, [initialGrid, open]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const available = useMemo(() => {
    const fieldItems = fields.map((f) => ({
      id: `avail:${f.key}`,
      key: f.key,
      label: `${f.label} (${f.type})`,
    }));
    const photoItem = { id: "avail:__photos__", key: "__photos__", label: "Fotoğraflar (tek başlık)" };
    return [...fieldItems, photoItem];
  }, [fields]);

  const usedKeys = useMemo(() => new Set(Object.values(grid.cells || {})), [grid.cells]);

  const getLabel = (key: string) => {
    if (key === "__photos__") return "Fotoğraflar (tek başlık)";
    const f = fields.find((x) => x.key === key);
    return f ? `${f.label} (${f.type})` : key;
  };

  const setGridSize = (rows: number, cols: number) => {
    const nextRows = Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows));
    const nextCols = Math.min(MAX_COLS, Math.max(MIN_COLS, cols));
    const validIds = new Set<string>();
    for (let r = 1; r <= nextRows; r += 1) {
      for (let c = 1; c <= nextCols; c += 1) validIds.add(cellId(r, c));
    }
    setGrid((prev) => {
      const cells: Record<string, string> = {};
      for (const [id, key] of Object.entries(prev.cells)) {
        if (validIds.has(id)) cells[id] = key;
      }
      return {
        rows: nextRows,
        cols: nextCols,
        cells,
        rowRatios: equalRatios(nextRows),
        colRatios: equalRatios(nextCols),
      };
    });
  };

  const removeFromCells = (key: string) => {
    setGrid((prev) => {
      const nextCells: Record<string, string> = {};
      for (const [id, k] of Object.entries(prev.cells)) {
        if (k !== key) nextCells[id] = k;
      }
      return { ...prev, cells: nextCells };
    });
  };

  const assignToCell = (cell: string, key: string) => {
    setGrid((prev) => {
      const nextCells: Record<string, string> = {};
      for (const [id, k] of Object.entries(prev.cells)) {
        if (k !== key) nextCells[id] = k;
      }
      nextCells[cell] = key;
      return { ...prev, cells: nextCells };
    });
  };

  const onDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!overId.startsWith("cell:")) return;

    const cell = overId.replace("cell:", "");
    const isAvail = activeId.startsWith("avail:");
    const key = isAvail ? activeId.replace("avail:", "") : activeId.replace("item:", "");
    if (!key) return;

    if (isAvail && usedKeys.has(key)) return;

    assignToCell(cell, key);
  };

  const startDrag = (axis: "row" | "col", index: number) => {
    dragRef.current = { axis, index };
  };

  const stopDrag = () => {
    dragRef.current = { axis: null, index: -1 };
  };

  const onDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const axis = dragRef.current.axis;
    const index = dragRef.current.index;
    if (!axis || index < 0 || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();

    if (axis === "col") {
      const ratios = [...grid.colRatios];
      const total = ratios.reduce((a, b) => a + b, 0) || 1;
      const sumBefore = ratios.slice(0, index).reduce((a, b) => a + b, 0);
      const pairTotal = ratios[index] + ratios[index + 1];
      const x = Math.min(Math.max(e.clientX - rect.left, rect.width * 0.1), rect.width * 0.9);
      let newLeft = (x / rect.width) * total - sumBefore;
      const min = Math.min(0.1, pairTotal * 0.45);
      newLeft = Math.min(Math.max(newLeft, min), pairTotal - min);
      ratios[index] = Number(newLeft.toFixed(3));
      ratios[index + 1] = Number((pairTotal - newLeft).toFixed(3));
      setGrid((prev) => ({ ...prev, colRatios: ratios }));
    } else {
      const ratios = [...grid.rowRatios];
      const total = ratios.reduce((a, b) => a + b, 0) || 1;
      const sumBefore = ratios.slice(0, index).reduce((a, b) => a + b, 0);
      const pairTotal = ratios[index] + ratios[index + 1];
      const y = Math.min(Math.max(e.clientY - rect.top, rect.height * 0.1), rect.height * 0.9);
      let newTop = (y / rect.height) * total - sumBefore;
      const min = Math.min(0.1, pairTotal * 0.45);
      newTop = Math.min(Math.max(newTop, min), pairTotal - min);
      ratios[index] = Number(newTop.toFixed(3));
      ratios[index + 1] = Number((pairTotal - newTop).toFixed(3));
      setGrid((prev) => ({ ...prev, rowRatios: ratios }));
    }
  };

  const colPrefix = useMemo(() => {
    const total = grid.colRatios.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return grid.colRatios.map((r) => {
      acc += r;
      return acc / total;
    });
  }, [grid.colRatios]);

  const rowPrefix = useMemo(() => {
    const total = grid.rowRatios.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return grid.rowRatios.map((r) => {
      acc += r;
      return acc / total;
    });
  }, [grid.rowRatios]);

  if (!open) return null;

  return (
    <Modal title="PDF Özelleştir" onClose={onClose} size="lg">
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div className="hint">Alanları grid hücrelerine sürükle-bırak. Her alan tek hücreye yerleşir.</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="hint">Satır</span>
              <button className="btn" onClick={() => setGridSize(grid.rows - 1, grid.cols)} disabled={grid.rows <= MIN_ROWS}>
                -
              </button>
              <div className="hint">{grid.rows}</div>
              <button className="btn" onClick={() => setGridSize(grid.rows + 1, grid.cols)} disabled={grid.rows >= MAX_ROWS}>
                +
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="hint">Sütun</span>
              <button className="btn" onClick={() => setGridSize(grid.rows, grid.cols - 1)} disabled={grid.cols <= MIN_COLS}>
                -
              </button>
              <div className="hint">{grid.cols}</div>
              <button className="btn" onClick={() => setGridSize(grid.rows, grid.cols + 1)} disabled={grid.cols >= MAX_COLS}>
                +
              </button>
            </div>
          </div>
        </div>

        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="modalGrid2">
            <div>
              <div className="label" style={{ marginBottom: 6 }}>
                Alanlar
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {available.map((a) => (
                  <DraggableAvailable
                    key={a.id}
                    item={a}
                    disabled={usedKeys.has(a.key)}
                    onAdd={() => {
                      if (usedKeys.has(a.key)) return;
                      const target = cellId(1, 1);
                      assignToCell(target, a.key);
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="label" style={{ marginBottom: 6 }}>
                PDF Önizleme
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 12,
                  padding: 10,
                  background: "rgba(255,255,255,.02)",
                  aspectRatio: "1 / 1.414",
                  overflow: "auto",
                  position: "relative",
                }}
                ref={previewRef}
                onMouseMove={onDragMove}
                onMouseLeave={stopDrag}
                onMouseUp={stopDrag}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: grid.colRatios.map((r) => `${r}fr`).join(" "),
                    gridTemplateRows: grid.rowRatios.map((r) => `${r}fr`).join(" "),
                    height: "100%",
                  }}
                >
                  {Array.from({ length: grid.rows }).map((_, rIdx) =>
                    Array.from({ length: grid.cols }).map((__, cIdx) => {
                      const id = cellId(rIdx + 1, cIdx + 1);
                      const key = grid.cells[id];
                      return (
                        <CellDropArea key={id} id={id}>
                          {key ? (
                            <div style={{ display: "grid", gap: 6 }}>
                              <DraggableCellItem item={{ id: `item:${key}`, key, label: getLabel(key) }} />
                              <button className="btn" style={{ padding: "4px 8px" }} onClick={() => removeFromCells(key)}>
                                Kaldır
                              </button>
                            </div>
                          ) : (
                            <div className="hint">Boş</div>
                          )}
                        </CellDropArea>
                      );
                    })
                  )}
                </div>

                {grid.colRatios.length > 1
                  ? grid.colRatios.slice(0, -1).map((_, idx) => (
                      <div
                        key={`col-handle-${idx}`}
                        style={{
                          position: "absolute",
                          top: 10,
                          bottom: 10,
                          left: `calc(${colPrefix[idx] * 100}% - 2px)`,
                          width: 4,
                          background: "rgba(148,163,184,.6)",
                          borderRadius: 999,
                          cursor: "col-resize",
                        }}
                        onMouseDown={() => startDrag("col", idx)}
                      />
                    ))
                  : null}

                {grid.rowRatios.length > 1
                  ? grid.rowRatios.slice(0, -1).map((_, idx) => (
                      <div
                        key={`row-handle-${idx}`}
                        style={{
                          position: "absolute",
                          left: 10,
                          right: 10,
                          top: `calc(${rowPrefix[idx] * 100}% - 2px)`,
                          height: 4,
                          background: "rgba(148,163,184,.6)",
                          borderRadius: 999,
                          cursor: "row-resize",
                        }}
                        onMouseDown={() => startDrag("row", idx)}
                      />
                    ))
                  : null}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="btn"
                  style={{ padding: "4px 8px" }}
                  onClick={() => setGrid((prev) => ({ ...prev, cells: {} }))}
                >
                  Temizle
                </button>
                <button className="btn btnPrimary" style={{ padding: "4px 8px" }} onClick={() => onSave(grid)}>
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </DndContext>
      </div>
    </Modal>
  );
}
