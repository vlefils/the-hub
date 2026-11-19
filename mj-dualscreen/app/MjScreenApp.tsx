"use client";

import {
  type ChangeEvent,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  memo,
} from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThemeSwitch, useInterfaceTheme } from "./InterfaceTheme";
import "./interface.css";
import { hubScenarios, openHubScenario } from "./lib/catalog";
import {
  CHANNEL_NAME,
  PROTOCOL_VERSION,
  isProtocolMessage,
  readPlayerScreenSize,
  type PlayerScreenSize,
  type ProtocolMessage,
} from "./lib/protocol";
import {
  DEFAULT_SCENARIO_THEME,
  DEFAULT_PANEL_WIDTH,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  clamp,
  clampPanelWidth,
  cloneScene,
  createId,
  createScene,
  createScenario,
  findZoneAtPoint,
  getImageViewport,
  getPlayerLayout,
  showSceneImage,
  isUsableRect,
  mergePolygonBoundaries,
  mergePolygonDraftBoundaries,
  movePolygonVertex,
  snapPointToZoneBoundaries,
  normalizePoint,
  selectSceneMap,
  syncActiveMap,
  snapshotFog,
  withTimestamp,
  type FogSnapshot,
  type ImageDimensions,
  type AssetRecord,
  type MapViewport,
  type Point,
  type RevealStroke,
  type RevealZone,
  type Scene,
  type Scenario,
  type ScenarioTheme,
  type ZoneKind,
} from "./lib/model";
import {
  createBackup,
  getAsset,
  getLibrary,
  getSetting,
  importBackup,
  putScene,
  putScenario,
  saveScenarioBundle,
  removeScenario,
  removeScene,
  saveImageFile,
  setSetting,
} from "./lib/storage";
import { collectScenarioMedia, isScenarioImageUsed, preservePlayerDisplay, unifyScenarioMedia, updateScenarioMedia, withScenarioMedia } from "./lib/media";
import {
  getScenarioOutline,
  splitScenarioMarkdown,
  type EncounterSheetData,
  type ScenarioOutlineItem,
} from "./lib/scenario";

type AppMode = "prepare" | "live" | "scenario";
type MapTool = "pan" | "rect" | "polygon" | "vertices" | "erase";
type Notice = { tone: "success" | "error"; text: string } | null;

function quantity(count: number, noun: string) {
  return `${count} ${noun}${count > 1 ? "s" : ""}`;
}

function InterfaceIcon({ name }: { name: "book" | "map" | "screen" | "image" | "edit" | "list" | "hide" }) {
  const paths = {
    book: "M12 5v15M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a5 5 0 0 0-4 1 5 5 0 0 0-4-1H3Z",
    map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16",
    screen: "M3 4h18v13H3Zm5 17h8m-4-4v4",
    image: "M3 3h18v18H3Zm0 14 6-6 4 4 3-3 5 5M15 7h.01",
    edit: "m15 4 5 5M4 20l5-1L21 7l-5-5L4 14Z",
    list: "M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01",
    hide: "m3 3 18 18M10 5c5-1 9 3 12 7a19 19 0 0 1-4 4M6 6a20 20 0 0 0-4 6c5 7 11 9 16 4M10 10a3 3 0 0 0 4 4",
  };
  return <svg className="interface-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

type FilePickerButtonProps = {
  accept: string;
  children: React.ReactNode;
  className: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

const ACTIVE_SCENE_KEY = "activeSceneId";
const POLYGON_DRAFT_COLOR = "#58d6ff";
const OUTSIDE_ZONE_TARGET = "__outside-zones__";
const SCENARIO_THEME_OPTIONS: Array<{
  value: ScenarioTheme;
  label: string;
}> = [
  { value: "medieval", label: "Médiéval" },
  { value: "cyberpunk", label: "Cyberpunk" },
  { value: "dark", label: "Sombre" },
  { value: "light", label: "Clair" },
  { value: "gritty", label: "Gritty" },
  { value: "occult", label: "Occulte" },
];

function formatError(error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "UnknownError")
  ) {
    return "Le navigateur n’a plus assez d’espace pour enregistrer ce fichier.";
  }
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

function uniqueSceneName(scenes: Scene[], base: string): string {
  const names = new Set(scenes.map((scene) => scene.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function nextSceneOrder(scenes: Scene[]): number {
  return Math.max(-1, ...scenes.map((scene) => scene.sortOrder ?? -1)) + 1;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function FilePickerButton({
  accept,
  children,
  className,
  multiple = false,
  disabled = false,
  onChange,
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        className="file-picker-input"
        type="file"
        accept={accept}
        disabled={disabled}
        multiple={multiple}
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
      />
      <button
        type="button"
        className={className}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </button>
    </>
  );
}

function useSceneAssets(scene: Scene | null) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [dimensions, setDimensions] = useState<Map<string, ImageDimensions>>(new Map());
  const assetKey = useMemo(() => {
    if (!scene) return "";
    const ids = new Set<string>();
    if (scene.mapAssetId) ids.add(scene.mapAssetId);
    for (const map of scene.maps ?? []) ids.add(map.assetId);
    for (const id of scene.galleryAssetIds) ids.add(id);
    return [...ids].sort().join("|");
  }, [scene]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    const ids = assetKey ? assetKey.split("|") : [];
    void (async () => {
      const next = new Map<string, string>();
      const nextNames = new Map<string, string>();
      const nextDimensions = new Map<string, ImageDimensions>();
      for (const id of ids) {
        const asset = await getAsset(id);
        if (asset) {
          const url = URL.createObjectURL(asset.blob);
          objectUrls.push(url);
          next.set(id, url);
          nextNames.set(id, asset.name);
          nextDimensions.set(id, { width: asset.width, height: asset.height });
        }
      }
      if (!cancelled) { setUrls(next); setNames(nextNames); setDimensions(nextDimensions); }
    })();
    return () => {
      cancelled = true;
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [assetKey]);

  return { urls, names, dimensions };
}

function mapFitRect(
  width: number,
  height: number,
  image: HTMLImageElement,
): { x: number; y: number; width: number; height: number } {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const viewportRatio = width / height;
  if (imageRatio > viewportRatio) {
    const fittedHeight = width / imageRatio;
    return { x: 0, y: (height - fittedHeight) / 2, width, height: fittedHeight };
  }
  const fittedWidth = height * imageRatio;
  return { x: (width - fittedWidth) / 2, y: 0, width: fittedWidth, height };
}

function drawZonePath(
  context: CanvasRenderingContext2D,
  zone: RevealZone,
  mapRect: { x: number; y: number; width: number; height: number },
): void {
  if (zone.points.length < 2) return;
  const pointAt = (point: Point) => ({
    x: mapRect.x + point.x * mapRect.width,
    y: mapRect.y + point.y * mapRect.height,
  });

  context.beginPath();
  if (zone.kind === "rect") {
    const start = pointAt(zone.points[0]);
    const end = pointAt(zone.points[1]);
    context.rect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else {
    const start = pointAt(zone.points[0]);
    context.moveTo(start.x, start.y);
    for (const point of zone.points.slice(1)) {
      const current = pointAt(point);
      context.lineTo(current.x, current.y);
    }
    context.closePath();
  }
}

type MapStageProps = {
  scene: Scene | null;
  mapUrl?: string;
  interactive?: boolean;
  mode?: AppMode;
  tool?: MapTool;
  brushSize?: number;
  polygonDraft?: Point[];
  editingZoneId?: string | null;
  onPolygonDraftChange?: (points: Point[]) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  onCreateZone?: (kind: ZoneKind, points: Point[]) => void;
  onMoveZoneVertex?: (
    zoneId: string,
    vertexIndex: number,
    point: Point,
  ) => void;
  onStroke?: (stroke: RevealStroke) => void;
  onToggleZone?: (zoneId: string) => void;
  onToggleOutside?: () => void;
};

function MapStage({
  scene,
  mapUrl,
  interactive = false,
  mode = "live",
  tool = "pan",
  brushSize = 4,
  polygonDraft = [],
  editingZoneId = null,
  onPolygonDraftChange,
  onViewportChange,
  onCreateZone,
  onMoveZoneVertex,
  onStroke,
  onToggleZone,
  onToggleOutside,
}: MapStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<
    | {
        kind: "pan";
        startX: number;
        startY: number;
        viewport: MapViewport;
        moved: boolean;
      }
    | { kind: "rect" }
    | { kind: "erase" }
    | { kind: "vertex"; zoneId: string; vertexIndex: number }
    | null
  >(null);
  const [loadedImage, setLoadedImage] = useState<{ url: string; image: HTMLImageElement } | null>(null);
  const image = loadedImage && loadedImage.url === mapUrl ? loadedImage.image : null;
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [draftRect, setDraftRect] = useState<Point[] | null>(null);
  const [draftStroke, setDraftStroke] = useState<Point[]>([]);
  const [snapIndicator, setSnapIndicator] = useState<Point | null>(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const polygonPreview = useMemo(
    () =>
      mergePolygonDraftBoundaries(
        polygonDraft,
        scene?.zones ?? [],
      ),
    [polygonDraft, scene?.zones],
  );

  useEffect(() => {
    if (!mapUrl) return;
    let cancelled = false;
    const nextImage = new Image();
    nextImage.onload = () => { if (!cancelled) setLoadedImage({ url: mapUrl, image: nextImage }); };
    nextImage.src = mapUrl;
    return () => { cancelled = true; };
  }, [mapUrl]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () =>
      setSize({
        width: Math.max(1, element.clientWidth),
        height: Math.max(1, element.clientHeight),
      });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = "#080a0d";
    context.fillRect(0, 0, size.width, size.height);
    if (!image || !scene) return;

    const rect = mapFitRect(size.width, size.height, image);
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);

    const fog = document.createElement("canvas");
    fog.width = Math.round(size.width * ratio);
    fog.height = Math.round(size.height * ratio);
    const fogContext = fog.getContext("2d");
    if (!fogContext) return;
    fogContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    const fogFillStyle =
      mode === "prepare"
        ? "rgba(5, 7, 10, 0.58)"
        : interactive
          ? "rgba(5, 7, 10, 0.88)"
          : "rgba(5, 7, 10, 0.97)";
    fogContext.fillStyle = fogFillStyle;
    fogContext.fillRect(rect.x, rect.y, rect.width, rect.height);

    if (scene.outsideRevealed) {
      fogContext.globalCompositeOperation = "destination-out";
      fogContext.fillRect(rect.x, rect.y, rect.width, rect.height);
      fogContext.globalCompositeOperation = "source-over";
      fogContext.fillStyle = fogFillStyle;
      for (const zone of scene.zones.filter((item) => !item.revealed)) {
        drawZonePath(fogContext, zone, rect);
        fogContext.fill();
      }
    }

    fogContext.globalCompositeOperation = "destination-out";

    for (const zone of scene.zones.filter((item) => item.revealed)) {
      drawZonePath(fogContext, zone, rect);
      fogContext.fill();
    }

    const strokes = draftStroke.length
      ? [
          ...scene.strokes,
          {
            id: "draft",
            points: draftStroke,
            radius: brushSize / 100,
          },
        ]
      : scene.strokes;
    for (const stroke of strokes) {
      if (!stroke.points.length) continue;
      fogContext.beginPath();
      fogContext.lineCap = "round";
      fogContext.lineJoin = "round";
      fogContext.lineWidth =
        Math.max(2, stroke.radius * Math.min(rect.width, rect.height) * 2);
      const first = stroke.points[0];
      fogContext.moveTo(
        rect.x + first.x * rect.width,
        rect.y + first.y * rect.height,
      );
      for (const point of stroke.points.slice(1)) {
        fogContext.lineTo(
          rect.x + point.x * rect.width,
          rect.y + point.y * rect.height,
        );
      }
      if (stroke.points.length === 1) {
        fogContext.lineTo(
          rect.x + first.x * rect.width + 0.01,
          rect.y + first.y * rect.height,
        );
      }
      fogContext.stroke();
    }

    context.drawImage(fog, 0, 0, size.width, size.height);

    if (interactive && mode === "live") {
      context.save();
      if (hoveredZoneId === OUTSIDE_ZONE_TARGET) {
        context.lineWidth = 3;
        context.strokeStyle = POLYGON_DRAFT_COLOR;
        context.setLineDash([9, 6]);
        context.strokeRect(
          rect.x + 2,
          rect.y + 2,
          Math.max(0, rect.width - 4),
          Math.max(0, rect.height - 4),
        );
      }
      for (const zone of scene.zones) {
        const isHovered = zone.id === hoveredZoneId;
        drawZonePath(context, zone, rect);
        if (isHovered) {
          context.fillStyle = "rgba(88, 214, 255, 0.12)";
          context.fill();
          drawZonePath(context, zone, rect);
        }
        context.lineWidth = isHovered ? 4 : 2;
        context.strokeStyle = isHovered
          ? POLYGON_DRAFT_COLOR
          : zone.revealed
            ? "#5ad4a4"
            : "#d7ad64";
        context.setLineDash(zone.revealed || isHovered ? [] : [7, 5]);
        context.stroke();
      }
      context.restore();
    }

    if (mode === "prepare") {
      context.save();
      context.lineWidth = 2;
      context.font = "600 12px Arial, sans-serif";
      for (const zone of scene.zones) {
        const isEditing = zone.id === editingZoneId;
        context.strokeStyle = isEditing
          ? "#f8d99d"
          : zone.revealed
            ? "#5ad4a4"
            : "#d7ad64";
        context.lineWidth = isEditing ? 3 : 2;
        context.fillStyle = "rgba(7, 9, 12, 0.82)";
        context.setLineDash(isEditing || zone.revealed ? [] : [6, 5]);
        drawZonePath(context, zone, rect);
        context.stroke();
        const anchor = zone.points[0];
        const labelX = rect.x + anchor.x * rect.width + 8;
        const labelY = rect.y + anchor.y * rect.height + 18;
        const labelWidth = context.measureText(zone.name).width + 14;
        context.fillRect(labelX - 4, labelY - 14, labelWidth, 21);
        context.fillStyle = "#f7f0e6";
        context.fillText(zone.name, labelX + 3, labelY);

        if (isEditing && zone.kind === "polygon") {
          context.setLineDash([]);
          for (const point of zone.points) {
            const x = rect.x + point.x * rect.width;
            const y = rect.y + point.y * rect.height;
            context.beginPath();
            context.arc(x, y, 7, 0, Math.PI * 2);
            context.fillStyle = "#0b0d10";
            context.fill();
            context.lineWidth = 3;
            context.strokeStyle = "#f0c97c";
            context.stroke();
            context.beginPath();
            context.arc(x, y, 2, 0, Math.PI * 2);
            context.fillStyle = "#f8e2b8";
            context.fill();
          }
        }
      }

      if (draftRect && draftRect.length === 2) {
        context.strokeStyle = "#f0c97c";
        context.setLineDash([5, 4]);
        drawZonePath(
          context,
          {
            id: "draft",
            name: "",
            kind: "rect",
            revealed: false,
            points: draftRect,
          },
          rect,
        );
        context.stroke();
      }

      if (polygonPreview.length) {
        context.beginPath();
        context.strokeStyle = POLYGON_DRAFT_COLOR;
        context.lineWidth = 3;
        context.setLineDash([5, 4]);
        polygonPreview.forEach((point, index) => {
          const x = rect.x + point.x * rect.width;
          const y = rect.y + point.y * rect.height;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.stroke();

        context.setLineDash([]);
        polygonDraft.forEach((point) => {
          const x = rect.x + point.x * rect.width;
          const y = rect.y + point.y * rect.height;
          context.beginPath();
          context.fillStyle = "#08141a";
          context.arc(x, y, 5, 0, Math.PI * 2);
          context.fill();
          context.beginPath();
          context.fillStyle = POLYGON_DRAFT_COLOR;
          context.arc(x, y, 3, 0, Math.PI * 2);
          context.fill();
        });
      }

      if (snapIndicator) {
        const x = rect.x + snapIndicator.x * rect.width;
        const y = rect.y + snapIndicator.y * rect.height;
        context.setLineDash([]);
        context.beginPath();
        context.arc(x, y, 10, 0, Math.PI * 2);
        context.fillStyle =
          tool === "polygon"
            ? "rgba(88, 214, 255, 0.18)"
            : "rgba(240, 201, 124, 0.16)";
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle =
          tool === "polygon" ? POLYGON_DRAFT_COLOR : "#f8d99d";
        context.stroke();
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fillStyle =
          tool === "polygon" ? POLYGON_DRAFT_COLOR : "#f8e2b8";
        context.fill();
      }
      context.restore();
    }
  }, [
    brushSize,
    draftRect,
    draftStroke,
    editingZoneId,
    hoveredZoneId,
    image,
    interactive,
    mode,
    polygonDraft,
    polygonPreview,
    scene,
    size,
    snapIndicator,
    tool,
  ]);

  const eventPoint = useCallback(
    (
      clientX: number,
      clientY: number,
      clampToMap = true,
    ): Point | null => {
      const container = containerRef.current;
      if (!container || !image || !scene) return null;
      const bounds = container.getBoundingClientRect();
      const viewport = scene.viewport;
      const rawX =
        (clientX - bounds.left - bounds.width / 2 - viewport.x * bounds.width) /
          viewport.zoom +
        bounds.width / 2;
      const rawY =
        (clientY - bounds.top - bounds.height / 2 - viewport.y * bounds.height) /
          viewport.zoom +
        bounds.height / 2;
      const fitted = mapFitRect(bounds.width, bounds.height, image);
      const point = {
        x: (rawX - fitted.x) / fitted.width,
        y: (rawY - fitted.y) / fitted.height,
      };
      if (
        !clampToMap &&
        (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)
      ) {
        return null;
      }
      return normalizePoint(point);
    },
    [image, scene],
  );

  const snapCreationPoint = useCallback(
    (point: Point) => {
      const container = containerRef.current;
      if (!container || !image || !scene) {
        return { point, snapped: false, zoneId: null };
      }
      const bounds = container.getBoundingClientRect();
      const fitted = mapFitRect(bounds.width, bounds.height, image);
      return snapPointToZoneBoundaries(
        point,
        scene.zones,
        14,
        fitted.width * scene.viewport.zoom,
        fitted.height * scene.viewport.zoom,
      );
    },
    [image, scene],
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !scene || !image) return;
    if (tool === "vertices" && editingZoneId) {
      const point = eventPoint(event.clientX, event.clientY);
      const zone = scene.zones.find(
        (item) => item.id === editingZoneId && item.kind === "polygon",
      );
      const container = containerRef.current;
      if (!point || !zone || !container) return;
      const bounds = container.getBoundingClientRect();
      const fitted = mapFitRect(bounds.width, bounds.height, image);
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      zone.points.forEach((vertex, index) => {
        const distance = Math.hypot(
          (vertex.x - point.x) * fitted.width * scene.viewport.zoom,
          (vertex.y - point.y) * fitted.height * scene.viewport.zoom,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      if (nearestIndex >= 0 && nearestDistance <= 20) {
        event.currentTarget.setPointerCapture(event.pointerId);
        gestureRef.current = {
          kind: "vertex",
          zoneId: zone.id,
          vertexIndex: nearestIndex,
        };
      }
      return;
    }
    if (tool === "pan") {
      setHoveredZoneId(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = {
        kind: "pan",
        startX: event.clientX,
        startY: event.clientY,
        viewport: scene.viewport,
        moved: false,
      };
      return;
    }
    const rawPoint = eventPoint(event.clientX, event.clientY);
    if (!rawPoint) return;
    if (tool === "polygon") {
      const snapped = snapCreationPoint(rawPoint);
      setSnapIndicator(snapped.snapped ? snapped.point : null);
      const point = snapped.point;
      onPolygonDraftChange?.([...polygonDraft, point]);
      return;
    }
    const point =
      tool === "rect" ? snapCreationPoint(rawPoint).point : rawPoint;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "rect") {
      const snapped = snapCreationPoint(rawPoint);
      setSnapIndicator(snapped.snapped ? snapped.point : null);
      gestureRef.current = { kind: "rect" };
      setDraftRect([snapped.point, snapped.point]);
    } else if (tool === "erase") {
      gestureRef.current = { kind: "erase" };
      setDraftStroke([point]);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const gesture = gestureRef.current;
    if (!scene) return;
    if (!gesture && mode === "live" && tool === "pan") {
      const point = eventPoint(event.clientX, event.clientY, false);
      const zone = point ? findZoneAtPoint(point, scene.zones) : null;
      setHoveredZoneId(
        point ? (zone?.id ?? OUTSIDE_ZONE_TARGET) : null,
      );
      return;
    }
    if (!gesture && tool === "polygon") {
      const rawPoint = eventPoint(event.clientX, event.clientY);
      if (!rawPoint) return;
      const snapped = snapCreationPoint(rawPoint);
      setSnapIndicator(snapped.snapped ? snapped.point : null);
      return;
    }
    if (!gesture) return;
    if (gesture.kind === "pan") {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      if (
        Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY,
        ) >= 5
      ) {
        gesture.moved = true;
      }
      if (!gesture.moved) return;
      onViewportChange?.({
        ...gesture.viewport,
        x: clamp(
          gesture.viewport.x + (event.clientX - gesture.startX) / bounds.width,
          -1,
          1,
        ),
        y: clamp(
          gesture.viewport.y + (event.clientY - gesture.startY) / bounds.height,
          -1,
          1,
        ),
      });
      return;
    }
    const rawPoint = eventPoint(event.clientX, event.clientY);
    if (!rawPoint) return;
    if (gesture.kind === "vertex") {
      onMoveZoneVertex?.(gesture.zoneId, gesture.vertexIndex, rawPoint);
    } else if (gesture.kind === "rect") {
      const snapped = snapCreationPoint(rawPoint);
      setSnapIndicator(snapped.snapped ? snapped.point : null);
      setDraftRect((current) =>
        current
          ? [current[0], snapped.point]
          : [snapped.point, snapped.point],
      );
    } else if (gesture.kind === "erase") {
      const point = rawPoint;
      setDraftStroke((current) => {
        const previous = current[current.length - 1];
        if (
          previous &&
          Math.hypot(previous.x - point.x, previous.y - point.y) < 0.004
        ) {
          return current;
        }
        return [...current, point];
      });
    }
  };

  const finishGesture = (
    event?: ReactPointerEvent<HTMLCanvasElement>,
    cancelled = false,
  ) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (
      gesture.kind === "pan" &&
      !gesture.moved &&
      !cancelled &&
      event &&
      mode === "live"
    ) {
      const point = eventPoint(event.clientX, event.clientY, false);
      const zone = point ? findZoneAtPoint(point, scene?.zones ?? []) : null;
      if (zone) onToggleZone?.(zone.id);
      else if (point) onToggleOutside?.();
      setHoveredZoneId(
        point ? (zone?.id ?? OUTSIDE_ZONE_TARGET) : null,
      );
    }
    if (gesture.kind === "rect" && draftRect && isUsableRect(draftRect)) {
      onCreateZone?.("rect", draftRect);
    }
    if (gesture.kind === "erase" && draftStroke.length) {
      onStroke?.({
        id: createId("stroke"),
        points: draftStroke,
        radius: brushSize / 100,
      });
    }
    gestureRef.current = null;
    setDraftRect(null);
    setDraftStroke([]);
    setSnapIndicator(null);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    if (!interactive || !scene || mode !== "live") return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    onViewportChange?.({
      ...scene.viewport,
      zoom: clamp(scene.viewport.zoom * factor, 0.75, 4),
    });
  };

  const viewport = scene?.viewport ?? { zoom: 1, x: 0, y: 0 };
  return (
    <div
      ref={containerRef}
      className={`map-stage map-tool-${tool}`}
      data-empty={!mapUrl}
      data-zone-hovered={
        interactive &&
        mode === "live" &&
        tool === "pan" &&
        Boolean(hoveredZoneId)
      }
    >
      <canvas
        ref={canvasRef}
        aria-label={
          interactive
            ? mode === "live"
              ? "Carte interactive : cliquez une zone ou le fond pour changer sa visibilité"
              : "Carte interactive et brouillard de guerre"
            : "Carte des joueurs"
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={(event) => finishGesture(event, true)}
        onPointerLeave={() => {
          if (!gestureRef.current) {
            setSnapIndicator(null);
            setHoveredZoneId(null);
          }
        }}
        onWheel={handleWheel}
        style={{
          transform: `translate(${viewport.x * 100}%, ${viewport.y * 100}%) scale(${viewport.zoom})`,
        }}
      />
      {!mapUrl && (
        <div className="stage-empty">
          <span className="stage-empty-mark" aria-hidden="true">
            <InterfaceIcon name="map" />
          </span>
          <strong>{interactive ? "Aucun média sélectionné" : "La suite de l’aventure arrive…"}</strong>
          <span>{interactive ? "Choisissez un plan ou une illustration dans vos médias." : ""}</span>
        </div>
      )}
    </div>
  );
}

type PlayerFrameProps = MapStageProps & {
  assetUrls: Map<string, string>;
  assetDimensions: Map<string, ImageDimensions>;
  className?: string;
  onImageViewportChange?: (viewport: MapViewport) => void;
};

function ImageStage({
  src,
  viewport,
  interactive = false,
  onViewportChange,
}: {
  src: string;
  viewport: MapViewport;
  interactive?: boolean;
  onViewportChange?: (viewport: MapViewport) => void;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    viewport: MapViewport;
  } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!interactive || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      viewport,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!gesture || !bounds) return;
    onViewportChange?.({
      ...gesture.viewport,
      x: clamp(
        gesture.viewport.x + (event.clientX - gesture.startX) / bounds.width,
        -1,
        1,
      ),
      y: clamp(
        gesture.viewport.y + (event.clientY - gesture.startY) / bounds.height,
        -1,
        1,
      ),
    });
  };

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    gestureRef.current = null;
  };

  const handleWheel = (event: ReactWheelEvent<HTMLElement>) => {
    if (!interactive) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    onViewportChange?.({
      ...viewport,
      zoom: clamp(viewport.zoom * factor, 0.75, 4),
    });
  };

  return (
    <aside
      ref={containerRef}
      className={`player-image-panel ${interactive ? "is-interactive" : ""}`}
      aria-label={
        interactive
          ? "Illustration interactive : glissez pour la recadrer et utilisez la molette pour zoomer"
          : "Illustration"
      }
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      onWheel={handleWheel}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          transform: `translate(${viewport.x * 100}%, ${viewport.y * 100}%) scale(${viewport.zoom})`,
        }}
      />
    </aside>
  );
}

function PlayerFrame({
  scene,
  assetUrls,
  assetDimensions,
  className = "",
  onImageViewportChange,
  ...mapProps
}: PlayerFrameProps) {
  const mapUrl = scene?.mapAssetId
    ? assetUrls.get(scene.mapAssetId)
    : undefined;
  const imageUrl = scene?.activeImageId
    ? assetUrls.get(scene.activeImageId)
    : undefined;
  const { panelWidth, showPanel, showMap, layout } = getPlayerLayout(scene, assetDimensions);
  const imageViewport = getImageViewport(
    scene,
    scene?.activeImageId ?? null,
  );
  const imageInteractive = Boolean(
    mapProps.interactive && mapProps.mode === "live",
  );

  return (
    <div
      className={`player-frame ${className}`}
      data-layout={layout}
      style={{
        gridTemplateColumns:
          layout === "split"
            ? `minmax(0, 1fr) ${panelWidth}%`
            : "minmax(0, 1fr)",
      }}
    >
      {showMap && <MapStage scene={scene} mapUrl={mapUrl} {...mapProps} />}
      {showPanel && imageUrl && (
        <ImageStage
          src={imageUrl}
          viewport={imageViewport}
          interactive={imageInteractive}
          onViewportChange={onImageViewportChange}
        />
      )}
    </div>
  );
}

type PlayerMirrorProps = Pick<PlayerFrameProps, "scene" | "assetUrls" | "assetDimensions"> & {
  screenSize: PlayerScreenSize;
};

function PlayerMirror({ screenSize, ...frameProps }: PlayerMirrorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setAvailable({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(available.width / screenSize.width, available.height / screenSize.height);
  return <div ref={containerRef} className="player-mirror" aria-label="Aperçu de la diffusion joueurs">
    <div className="player-mirror-surface" style={{ width: screenSize.width, height: screenSize.height,
      transform: `translate(-50%, -50%) scale(${scale})` }}>
      <PlayerFrame {...frameProps} />
    </div>
  </div>;
}

type PlayerMonitorProps = PlayerMirrorProps & {
  connected: boolean;
  assetNames: Map<string, string>;
  onHide: () => void;
};

function ExpandedPlayerMonitor({ onClose, connected, assetNames, onHide, ...mirrorProps }: PlayerMonitorProps & { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const close = () => {
    dialogRef.current?.close();
    onClose();
  };
  return <dialog ref={dialogRef} className="player-monitor-dialog" aria-labelledby="player-monitor-title"
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header><h2 id="player-monitor-title">Retour écran joueurs</h2><button type="button" onClick={close} autoFocus>Fermer l’aperçu</button></header>
    <PlayerMirror {...mirrorProps} />
    <footer className="monitor-details">
      <div>
        <p className="monitor-caption">{connected ? "Vue joueurs, sans les repères du MJ." : "Écran non connecté : aperçu de la diffusion préparée."}</p>
        <dl className="monitor-media">
          <div><dt>Plan</dt><dd>{mirrorProps.scene?.maps.find((map) => map.id === mirrorProps.scene?.activeMapId)?.name ?? "Aucun plan"}</dd></div>
          <div><dt>Illustration</dt><dd>{mirrorProps.scene?.panelVisible && mirrorProps.scene.activeImageId ? assetNames.get(mirrorProps.scene.activeImageId) ?? "Illustration" : "Aucune image"}</dd></div>
        </dl>
      </div>
      <button type="button" className="monitor-hide" disabled={!mirrorProps.scene?.mapAssetId && !mirrorProps.scene?.activeImageId} onClick={onHide}>
        <InterfaceIcon name="hide" /> Masquer les médias
      </button>
    </footer>
  </dialog>;
}

function PlayerMonitor({ connected, assetNames, onHide, ...mirrorProps }: PlayerMonitorProps) {
  const [expanded, setExpanded] = useState(false);
  return <aside className="player-monitor" aria-label="Retour écran joueurs">
    <header className="player-monitor-heading">
      <strong>Joueurs</strong>
      <span className={`monitor-connection ${connected ? "is-online" : ""}`} role="status">
        <span className={`live-dot ${connected ? "is-online" : ""}`} />{connected ? "Connecté" : "Non connecté"}
      </span>
    </header>
    <div className="monitor-thumbnail">
      <PlayerMirror {...mirrorProps} />
      <button type="button" className="monitor-enlarge" onClick={() => setExpanded(true)} aria-label="Agrandir le retour joueurs" title="Agrandir le retour joueurs">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /></svg>
      </button>
    </div>
    {expanded && <ExpandedPlayerMonitor {...mirrorProps} connected={connected} assetNames={assetNames} onHide={onHide} onClose={() => setExpanded(false)} />}
  </aside>;
}

function PlayerView() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [connected, setConnected] = useState(false);
  const { urls: assetUrls, dimensions: assetDimensions } = useSceneAssets(scene);

  useEffect(() => {
    // Wait for the controller: persisted chapter selections may be stale.
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const announce = () => {
      const message: ProtocolMessage = {
        version: PROTOCOL_VERSION,
        type: "PLAYER_READY",
        screenSize: { width: window.innerWidth, height: window.innerHeight },
      };
      channel.postMessage(message);
    };
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isProtocolMessage(event.data)) return;
      if (
        event.data.type === "STATE_SNAPSHOT" ||
        event.data.type === "STATE_PATCH"
      ) {
        setScene(event.data.scene);
        setConnected(true);
      } else if (event.data.type === "PING") {
        channel.postMessage({
          version: PROTOCOL_VERSION,
          type: "PONG",
          sentAt: event.data.sentAt,
          screenSize: { width: window.innerWidth, height: window.innerHeight },
        } satisfies ProtocolMessage);
        setConnected(true);
      }
    };
    announce();
    window.addEventListener("resize", announce);
    const interval = window.setInterval(announce, 4000);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("resize", announce);
      channel.close();
    };
  }, []);

  return (
    <main className="player-shell">
      <PlayerFrame scene={scene} assetUrls={assetUrls} assetDimensions={assetDimensions} />
      <div className="player-utility">
        <span className={connected ? "live-dot is-online" : "live-dot"} />
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen()}
        >
          Plein écran
        </button>
      </div>
    </main>
  );
}

const MarkdownContent = memo(function MarkdownContent({
  markdown,
  className = "scenario-markdown",
  headings = [],
  assetUrls,
  onShowImage,
}: {
  markdown: string;
  className?: string;
  headings?: ScenarioOutlineItem[];
  assetUrls?: Map<string, string>;
  onShowImage?: (id: string) => void;
}) {
  let headingIndex = 0;
  const nextHeadingId = () => headings[headingIndex++]?.id;

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url.startsWith("asset:") ? url : defaultUrlTransform(url)}
        components={{
          img: ({ node, src, alt }) => {
            void node;
            const source = typeof src === "string" ? src : "";
            if (source.startsWith("asset:")) {
              const id = source.slice(6);
              const url = assetUrls?.get(id);
              return url ? (
                <button type="button" className="scenario-image-link" onClick={() => onShowImage?.(id)} title="Afficher sur l’écran joueurs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={alt ?? "Illustration"} />
                  <span>Afficher sur l’écran joueurs</span>
                </button>
              ) : <span className="scenario-image-missing">Image indisponible : {alt || id}</span>;
            }
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={source} alt={alt ?? ""} />;
          },
          a: ({ node, ...props }) => {
            void node;
            return (
              <a {...props} target="_blank" rel="noreferrer noopener" />
            );
          },
          h1: ({ node, ...props }) => {
            void node;
            return (
              <h1
                {...props}
                id={nextHeadingId()}
                data-scenario-anchor
                tabIndex={-1}
              />
            );
          },
          h2: ({ node, ...props }) => {
            void node;
            return (
              <h2
                {...props}
                id={nextHeadingId()}
                data-scenario-anchor
                tabIndex={-1}
              />
            );
          },
          h3: ({ node, ...props }) => {
            void node;
            return (
              <h3
                {...props}
                id={nextHeadingId()}
                data-scenario-anchor
                tabIndex={-1}
              />
            );
          },
          h4: ({ node, ...props }) => {
            void node;
            return (
              <h4
                {...props}
                id={nextHeadingId()}
                data-scenario-anchor
                tabIndex={-1}
              />
            );
          },
          h5: ({ node, ...props }) => {
            void node;
            return (
              <h5
                {...props}
                id={nextHeadingId()}
                data-scenario-anchor
                tabIndex={-1}
              />
            );
          },
          h6: ({ node, ...props }) => {
            void node;
            return (
              <h6
                {...props}
                id={nextHeadingId()}
                data-scenario-anchor
                tabIndex={-1}
              />
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

const EncounterSheet = memo(function EncounterSheet({
  sheet,
  headings,
  assetUrls,
  onShowImage,
}: {
  sheet: EncounterSheetData;
  headings: ScenarioOutlineItem[];
  assetUrls: Map<string, string>;
  onShowImage: (id: string) => void;
}) {
  const EncounterTitle =
    sheet.headingLevel === 3 ? "h3" : sheet.headingLevel === 2 ? "h2" : "h1";
  const titleHeading = headings[0];

  return (
    <article
      className={`encounter-sheet encounter-level-${sheet.headingLevel}`}
      aria-label={`Fiche de ${sheet.title}`}
    >
      <header className="encounter-header">
        <div className="encounter-heading-row">
          <div>
            <span className="encounter-kicker">Encounter détecté</span>
            <EncounterTitle
              id={titleHeading?.id}
              data-scenario-anchor
              tabIndex={-1}
            >
              {sheet.title}
            </EncounterTitle>
          </div>
          {sheet.challengeRating && (
            <span className="encounter-rating">{sheet.challengeRating}</span>
          )}
        </div>
        {sheet.subtitle && <p className="encounter-subtitle">{sheet.subtitle}</p>}
      </header>

      {sheet.descriptionMarkdown && (
        <MarkdownContent
          markdown={sheet.descriptionMarkdown}
          className="encounter-description scenario-markdown"
          assetUrls={assetUrls}
          onShowImage={onShowImage}
        />
      )}

      <div className="encounter-stat-block">
        <dl className="encounter-vitals">
          {sheet.vitals.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>

        <dl className="encounter-abilities">
          {sheet.abilities.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>

        {sheet.details.length > 0 && (
          <dl className="encounter-details">
            {sheet.details.map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {sheet.bodyMarkdown && (
        <MarkdownContent
          markdown={sheet.bodyMarkdown}
          className="encounter-body scenario-markdown"
          headings={headings.slice(1)}
          assetUrls={assetUrls}
          onShowImage={onShowImage}
        />
      )}
    </article>
  );
});

function ScenarioWorkspace({
  scene,
  activeSceneId,
  editorVisible,
  outlineVisible,
  onEditorVisibleChange,
  onOutlineVisibleChange,
  onMarkdownChange,
  onThemeChange,
  assetUrls,
  assetNames,
  onShowImage,
  onMapChange,
  onImportImages,
  scrollPositions,
}: {
  scene: Scene | null;
  activeSceneId: string;
  editorVisible: boolean;
  outlineVisible: boolean;
  onEditorVisibleChange: (visible: boolean) => void;
  onOutlineVisibleChange: (visible: boolean) => void;
  onMarkdownChange: (markdown: string) => void;
  onThemeChange: (theme: ScenarioTheme) => void;
  assetUrls: Map<string, string>;
  assetNames: Map<string, string>;
  onShowImage: (id: string | null) => void;
  onMapChange: (id: string) => void;
  onImportImages: (event: ChangeEvent<HTMLInputElement>) => void;
  scrollPositions: RefObject<Map<string, { editor: number; preview: number; selectionStart: number; selectionEnd: number }>>;
}) {
  const markdown = scene?.scenarioMarkdown ?? "";
  const theme = scene?.scenarioTheme ?? DEFAULT_SCENARIO_THEME;
  const wordCount = markdown.trim()
    ? markdown.trim().split(/\s+/u).length
    : 0;
  const lineCount = markdown ? markdown.split(/\r\n|\r|\n/u).length : 0;
  const scenarioSegments = useMemo(
    () => splitScenarioMarkdown(markdown),
    [markdown],
  );
  const scenarioOutline = useMemo(
    () => getScenarioOutline(markdown),
    [markdown],
  );
  const renderedSegments = useMemo(() => {
    return scenarioSegments.reduce<{ cursor: number; items: Array<{ segment: (typeof scenarioSegments)[number]; headings: ScenarioOutlineItem[] }> }>((state, segment) => {
      const headingCount = getScenarioOutline(segment.markdown).length;
      const headings = scenarioOutline.slice(
        state.cursor,
        state.cursor + headingCount,
      );
      return { cursor: state.cursor + headingCount, items: [...state.items, { segment, headings }] };
    }, { cursor: 0, items: [] }).items;
  }, [scenarioOutline, scenarioSegments]);
  const encounterCount = scenarioSegments.filter(
    (segment) => segment.kind === "encounter",
  ).length;
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const activeSceneRef = useRef(activeSceneId);
  useEffect(() => {
    activeSceneRef.current = activeSceneId;
    const position = scrollPositions.current.get(activeSceneId);
    if (editorRef.current) {
      editorRef.current.scrollTop = position?.editor ?? 0;
      editorRef.current.setSelectionRange(position?.selectionStart ?? 0, position?.selectionEnd ?? 0);
    }
    if (previewPanelRef.current) previewPanelRef.current.scrollTop = position?.preview ?? 0;
  }, [activeSceneId, editorVisible, scrollPositions]);
  const rememberScroll = (part: "editor" | "preview", top: number) => {
    const id = activeSceneRef.current;
    const current = scrollPositions.current.get(id) ?? { editor: 0, preview: 0, selectionStart: 0, selectionEnd: 0 };
    scrollPositions.current.set(id, { ...current, [part]: top });
  };
  const rememberSelection = (textarea: HTMLTextAreaElement) => {
    const id = activeSceneRef.current;
    const current = scrollPositions.current.get(id) ?? { editor: 0, preview: 0, selectionStart: 0, selectionEnd: 0 };
    scrollPositions.current.set(id, { ...current, selectionStart: textarea.selectionStart, selectionEnd: textarea.selectionEnd });
  };
  const insertImage = (id: string, label: string) => {
    const textarea = editorRef.current;
    const insertion = `![${label}](asset:${id})`;
    const start = textarea?.selectionStart ?? markdown.length;
    const end = textarea?.selectionEnd ?? markdown.length;
    const before = markdown.slice(0, start);
    const after = markdown.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
    onMarkdownChange(`${before}${prefix}${insertion}${suffix}${after}`);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + prefix.length + insertion.length, start + prefix.length + insertion.length);
      if (textarea) rememberSelection(textarea);
    });
  };
  const [activeHeadingId, setActiveHeadingId] = useState(
    scenarioOutline[0]?.id ?? "",
  );

  useEffect(() => {
    const previewPanel = previewPanelRef.current;
    if (!previewPanel || scenarioOutline.length === 0) {
      setActiveHeadingId("");
      return;
    }

    let frame = 0;
    const updateActiveHeading = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const threshold = previewPanel.getBoundingClientRect().top + 96;
        let nextActive = scenarioOutline[0].id;
        for (const item of scenarioOutline) {
          const heading = document.getElementById(item.id);
          if (!heading || !previewPanel.contains(heading)) continue;
          if (heading.getBoundingClientRect().top <= threshold) {
            nextActive = item.id;
          } else {
            break;
          }
        }
        setActiveHeadingId((current) =>
          current === nextActive ? current : nextActive,
        );
      });
    };

    updateActiveHeading();
    previewPanel.addEventListener("scroll", updateActiveHeading, {
      passive: true,
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previewPanel.removeEventListener("scroll", updateActiveHeading);
    };
  }, [scenarioOutline]);

  const navigateToHeading = (headingId: string) => {
    const target = document.getElementById(headingId);
    const previewPanel = previewPanelRef.current;
    if (!target || !previewPanel?.contains(target)) return;
    setActiveHeadingId(headingId);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${headingId}`);
  };

  return (
    <section
      className="scenario-workspace"
      data-scenario-theme={theme}
      aria-label="Scénario de la scène"
    >
      <header className="scenario-toolbar">
        <div className="reading-view-controls" aria-label="Panneaux de lecture">
          <button type="button" aria-pressed={editorVisible} aria-controls="scenario-editor-panel"
            onClick={() => onEditorVisibleChange(!editorVisible)}><InterfaceIcon name="edit" /> Éditer le texte</button>
          <button type="button" aria-pressed={outlineVisible} aria-controls="scenario-outline-panel"
            onClick={() => onOutlineVisibleChange(!outlineVisible)}><InterfaceIcon name="list" /> Sommaire</button>
        </div>
        <div className="scenario-toolbar-meta">
          <div className="scenario-stats" aria-label="Statistiques du scénario">
            <span>{wordCount.toLocaleString("fr-FR")} mots</span>
            <span>{lineCount.toLocaleString("fr-FR")} lignes</span>
            <span className="scenario-encounter-count">
              {encounterCount
                ? `${encounterCount} fiche${encounterCount > 1 ? "s" : ""} détectée${encounterCount > 1 ? "s" : ""}`
                : "Détection auto"}
            </span>
            <span className="scenario-saved">Enregistrement automatique</span>
          </div>
          <label className="scenario-theme-picker">
            <span className="scenario-theme-swatches" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>Style du texte</span>
            <select
              value={theme}
              onChange={(event) =>
                onThemeChange(event.target.value as ScenarioTheme)
              }
            >
              {SCENARIO_THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <details className="reading-media">
        <summary>Montrer un média aux joueurs <span>{scene?.galleryAssetIds.length ?? 0} image{scene?.galleryAssetIds.length === 1 ? "" : "s"} · {scene?.maps.length ?? 0} plan{scene?.maps.length === 1 ? "" : "s"}</span></summary>
        <div className="reading-media-content">
          <div className="reading-media-map">
            <label className="field-label" htmlFor="reading-map">Plan affiché aux joueurs</label>
            <select id="reading-map" value={scene?.activeMapId ?? ""} onChange={(event) => onMapChange(event.target.value)}>
              <option value="">Aucun plan</option>
              {scene?.maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
            </select>
            <p>Changer de chapitre conserve l’affichage joueurs. Choisissez ici les médias à montrer ; les plans conservent leur brouillard.</p>
          </div>
          <div className="reading-media-gallery">
            <span className="field-label">Illustration affichée aux joueurs</span>
            <GalleryGrid scene={scene} assetUrls={assetUrls} assetNames={assetNames} onSelect={onShowImage} />
            {!scene?.galleryAssetIds.length && <p>Aucune image dans ce scénario.</p>}
          </div>
        </div>
      </details>

      <div
        className={`scenario-split ${editorVisible ? "has-editor" : ""} ${outlineVisible ? "has-outline" : ""} ${!editorVisible && !outlineVisible ? "is-focus" : ""}`}
      >
        {editorVisible && (
          <section className="scenario-editor-panel" id="scenario-editor-panel">
            <div className="scenario-panel-heading">
              <div>
                <span className="section-eyebrow">ÉDITION</span>
                <h2>Texte du chapitre</h2>
              </div>
            </div>
            <textarea
              ref={editorRef}
              className="scenario-editor"
              aria-label="Texte du scénario en Markdown"
              value={markdown}
              onChange={(event) => onMarkdownChange(event.target.value)}
              onScroll={(event) => rememberScroll("editor", event.currentTarget.scrollTop)}
              onSelect={(event) => rememberSelection(event.currentTarget)}
              placeholder={
                "# La Crypte du roi sans nom\n\n> À lire à voix haute : une brume froide rampe entre les pierres.\n\n## Entrée dans les ruines\n\n- **Objectif :** retrouver le sceau brisé\n- **Danger :** 3 gardiens spectraux\n\n---\n\n### Si les héros fouillent l’autel\n\nIls découvrent une clé d’obsidienne."
              }
              spellCheck
            />
            <footer className="scenario-editor-footer">
              Markdown standard · fiches de rencontre détectées automatiquement
            </footer>
            <details className="scenario-assets">
              <summary>Insérer une image <span>{scene?.galleryAssetIds.length ?? 0} disponibles</span></summary>
              <FilePickerButton className="upload-button" multiple accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" onChange={onImportImages}>Ajouter des images</FilePickerButton>
              <div className="scenario-assets-list">
                {scene?.galleryAssetIds.map((id, index) => (
                  <button key={id} type="button" onClick={() => insertImage(id, assetNames.get(id)?.replace(/\.[^.]+$/, "") ?? `Image ${index + 1}`)} title="Insérer à la position du curseur">
                    {assetUrls.get(id) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={assetUrls.get(id)} alt="" />
                    ) : <span>…</span>}
                    <span>{assetNames.get(id) ?? `Image ${index + 1}`}</span><small>Insérer</small>
                  </button>
                ))}
                {!scene?.galleryAssetIds.length && <p>Ajoutez une image, puis insérez-la dans le texte.</p>}
              </div>
            </details>
          </section>
        )}

        <section
          ref={previewPanelRef}
          onScroll={(event) => rememberScroll("preview", event.currentTarget.scrollTop)}
          className="scenario-preview-panel"
          id="scenario-preview-panel"
          aria-label="Aperçu du scénario"
        >
          <article
            className={`scenario-page ${encounterCount ? "has-encounter" : ""}`}
          >
            {!scenarioOutline.some((heading) => heading.level === 1 || heading.label === scene?.name) && (
              <header className="scenario-page-header">
                <span>Chronique du maître du jeu</span>
                <h2>{scene?.name ?? "Scène sans titre"}</h2>
              </header>
            )}
            {markdown.trim() ? (
              <div className="scenario-document">
                {renderedSegments.map(({ segment, headings }, index) =>
                  segment.kind === "encounter" ? (
                    <EncounterSheet
                      key={`encounter-${index}`}
                      sheet={segment.sheet}
                      headings={headings}
                      assetUrls={assetUrls}
                      onShowImage={onShowImage}
                    />
                  ) : (
                    <MarkdownContent
                      key={`markdown-${index}`}
                      markdown={segment.markdown}
                      headings={headings}
                      assetUrls={assetUrls}
                      onShowImage={onShowImage}
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="scenario-empty">
                <span className="scenario-empty-mark" aria-hidden="true">✦</span>
                <h3>Votre aventure commence ici</h3>
                <p>
                  Collez votre scénario dans le manuscrit. Les titres, citations,
                  listes, tableaux et notes prendront forme dans cet aperçu.
                </p>
              </div>
            )}
          </article>
        </section>

        {outlineVisible && (
          <aside className="scenario-outline-panel" id="scenario-outline-panel">
            <div className="scenario-outline-heading">
              <div>
                <span className="section-eyebrow">NAVIGATION</span>
                <h2>Dans ce chapitre</h2>
              </div>
              <span className="scenario-outline-count">
                {scenarioOutline.length}
              </span>
            </div>
            {scenarioOutline.length ? (
              <nav className="scenario-outline-nav" aria-label="Plan du Markdown">
                <ol>
                  {scenarioOutline.map((item) => (
                    <li
                      key={item.id}
                      className={`scenario-outline-level-${Math.min(item.level, 4)}`}
                    >
                      <a
                        href={`#${item.id}`}
                        aria-current={
                          activeHeadingId === item.id ? "location" : undefined
                        }
                        onClick={(event) => {
                          event.preventDefault();
                          navigateToHeading(item.id);
                        }}
                      >
                        <span>{item.label}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            ) : (
              <p className="scenario-outline-empty">
                Ajoutez des titres avec # pour construire le plan.
              </p>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

type ScenarioDialogAction = "create" | "rename" | "delete";

function ScenarioDialog({ action, initialName, sceneCount, busy, error, onSubmit, onClose }: {
  action: ScenarioDialogAction;
  initialName: string;
  sceneCount: number;
  busy: boolean;
  error: string | null;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  const title = action === "create" ? "Nouveau scénario" : action === "rename" ? "Renommer le scénario" : "Supprimer le scénario";
  return (
    <dialog ref={dialogRef} className="scenario-dialog" aria-labelledby="scenario-dialog-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={(event) => { event.preventDefault(); if (!busy && name.trim()) onSubmit(name.trim()); }}>
        <h2 id="scenario-dialog-title">{title}</h2>
        {action === "delete" ? (
          <p>Supprimer <strong>{initialName}</strong> et {quantity(sceneCount, "scène")} de ce navigateur ?
            Exportez le scénario au préalable pour en conserver une copie. Cette suppression est définitive.</p>
        ) : (
          <>
            <label className="field-label" htmlFor="scenario-dialog-name">Nom du scénario</label>
            <input id="scenario-dialog-name" type="text" value={name} maxLength={160} required
              disabled={busy} onChange={(event) => setName(event.target.value)} />
          </>
        )}
        {error && <p className="scenario-dialog-error" role="alert">{error}</p>}
        <div className="scenario-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>Annuler</button>
          <button type="submit" className={action === "delete" ? "danger-button" : "primary-button"}
            disabled={busy || !name.trim()}>
            {busy ? "Enregistrement…" : action === "create" ? "Créer le scénario" : action === "rename" ? "Enregistrer" : "Supprimer définitivement"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ControllerView() {
  const appearance = useInterfaceTheme();
  const [playerScreenSize, setPlayerScreenSize] = useState<PlayerScreenSize>({ width: 1600, height: 900 });
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const scenariosRef = useRef<Scenario[]>([]);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const libraryBusyRef = useRef(false);
  const [scenarioDialog, setScenarioDialog] = useState<ScenarioDialogAction | null>(null);
  const [activeSceneId, setActiveSceneId] = useState("");
  const [mode, setMode] = useState<AppMode>("scenario");
  const [loadingScenario, setLoadingScenario] = useState("");
  const [scenarioEditorVisible, setScenarioEditorVisible] = useState(false);
  const [scenarioOutlineVisible, setScenarioOutlineVisible] = useState(true);
  const [preparePanel, setPreparePanel] = useState<"map" | "images" | "chapter">("map");
  const [tool, setTool] = useState<MapTool>("rect");
  const [brushSize, setBrushSize] = useState(4);
  const [polygonDraft, setPolygonDraft] = useState<Point[]>([]);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [playerConnected, setPlayerConnected] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const scenesRef = useRef<Scene[]>([]);
  const activeSceneIdRef = useRef("");
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastPongRef = useRef(0);
  const saveTimersRef = useRef<Map<string, number>>(new Map());
  const historyRef = useRef<Map<string, FogSnapshot[]>>(new Map());
  const [undoAvailable, setUndoAvailable] = useState<Record<string, boolean>>({});
  const scenarioScrollRef = useRef<Map<string, { editor: number; preview: number; selectionStart: number; selectionEnd: number }>>(new Map());

  const activeScene =
    scenes.find((scene) => scene.id === activeSceneId) ?? scenes[0] ?? null;
  const activeScenario = scenarios.find((scenario) => scenario.id === activeScene?.scenarioId);
  const personalScenarios = scenarios.filter(scenario => !hubScenarios.some(entry => entry.id === scenario.id));
  const scenarioScenes = scenes.filter((scene) => scene.scenarioId === activeScenario?.id);
  const { urls: assetUrls, names: assetNames, dimensions: assetDimensions } = useSceneAssets(activeScene);

  useEffect(() => {
    scenesRef.current = scenes;
  }, [scenes]);

  useEffect(() => {
    activeSceneIdRef.current = activeSceneId;
  }, [activeSceneId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    void (async () => {
      try {
        let library = await getLibrary({ allowEmpty: true });
        if (!library.scenarios.length) {
          try {
            const first = await openHubScenario(hubScenarios[0], []);
            library = { scenarios: [first.scenario], scenes: first.scenes };
          } catch (error) {
            // Keep local creation and file import available if the site is offline.
            library = await getLibrary();
            setNotice({ tone: "error", text: formatError(error) });
          }
        }
        const storedScenes = library.scenes;
        scenariosRef.current = library.scenarios;
        setScenarios(library.scenarios);
        const storedActiveId = await getSetting(ACTIVE_SCENE_KEY);
        const initialId = storedScenes.some(
          (scene) => scene.id === storedActiveId,
        )
          ? String(storedActiveId)
          : storedScenes[0].id;
        scenesRef.current = storedScenes;
        activeSceneIdRef.current = initialId;
        setScenes(storedScenes);
        setActiveSceneId(initialId);
        await setSetting(ACTIVE_SCENE_KEY, initialId);
      } catch (error) {
        setNotice({ tone: "error", text: formatError(error) });
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  const currentSceneFromRefs = useCallback(() => {
    return (
      scenesRef.current.find(
        (scene) => scene.id === activeSceneIdRef.current,
      ) ?? null
    );
  }, []);

  useEffect(() => {
    if (initializing) return;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isProtocolMessage(event.data)) return;
      if (event.data.type === "PLAYER_READY" || event.data.type === "PONG") {
        const size = readPlayerScreenSize(event.data.screenSize);
        if (size) setPlayerScreenSize((current) => current.width === size.width && current.height === size.height ? current : size);
      }
      if (event.data.type === "PLAYER_READY") {
        lastPongRef.current = Date.now();
        setPlayerConnected(true);
        channel.postMessage({
          version: PROTOCOL_VERSION,
          type: "STATE_SNAPSHOT",
          scene: currentSceneFromRefs(),
        } satisfies ProtocolMessage);
      }
      if (event.data.type === "PONG") {
        lastPongRef.current = Date.now();
        setPlayerConnected(true);
      }
    };
    const interval = window.setInterval(() => {
      channel.postMessage({
        version: PROTOCOL_VERSION,
        type: "PING",
        sentAt: Date.now(),
      } satisfies ProtocolMessage);
      if (Date.now() - lastPongRef.current > 7000) setPlayerConnected(false);
    }, 3000);
    return () => {
      window.clearInterval(interval);
      channel.close();
      channelRef.current = null;
    };
  }, [currentSceneFromRefs, initializing]);

  const queueSave = useCallback((scene: Scene) => {
    const key = scene.scenarioId ?? scene.id;
    const existing = saveTimersRef.current.get(key);
    if (existing) window.clearTimeout(existing);
    const timeout = window.setTimeout(() => {
      const scenario = scenariosRef.current.find((item) => item.id === scene.scenarioId);
      if (!scenario) return;
      const members = scenesRef.current.filter((item) => item.scenarioId === scenario.id);
      void saveScenarioBundle(scenario, members).catch((error) =>
        setNotice({ tone: "error", text: formatError(error) }),
      );
      saveTimersRef.current.delete(key);
    }, 220);
    saveTimersRef.current.set(key, timeout);
  }, []);

  const commitScene = useCallback(
    (scene: Scene, messageType: "STATE_PATCH" | "STATE_SNAPSHOT" = "STATE_PATCH") => {
      const stamped = withTimestamp(syncActiveMap(scene));
      const scenario = scenariosRef.current.find((item) => item.id === stamped.scenarioId);
      if (!scenario) return;
      const unified = updateScenarioMedia(scenario, scenesRef.current.filter((item) => item.scenarioId === scenario.id), stamped);
      scenariosRef.current = scenariosRef.current.map((item) => item.id === scenario.id ? unified.scenario : item);
      setScenarios(scenariosRef.current);
      const members = new Map(unified.scenes.map((item) => [item.id, item]));
      const nextScenes = scenesRef.current.map((item) => members.get(item.id) ?? item);
      scenesRef.current = nextScenes;
      setScenes(nextScenes);
      queueSave(stamped);
      if (stamped.scenarioId === nextScenes.find((item) => item.id === activeSceneIdRef.current)?.scenarioId) channelRef.current?.postMessage({
        version: PROTOCOL_VERSION,
        type: messageType,
        scene: nextScenes.find((item) => item.id === activeSceneIdRef.current) ?? stamped,
      } satisfies ProtocolMessage);
    },
    [queueSave],
  );

  const changeActiveScene = useCallback((sceneId: string) => {
    const target = scenesRef.current.find((item) => item.id === sceneId);
    if (!target) return;
    const scene = preservePlayerDisplay(target, currentSceneFromRefs());
    activeSceneIdRef.current = sceneId;
    setActiveSceneId(sceneId);
    setPolygonDraft([]);
    setEditingZoneId(null);
    void setSetting(ACTIVE_SCENE_KEY, sceneId).catch((error) => setNotice({ tone: "error", text: formatError(error) }));
    const scenario = scenariosRef.current.find((item) => item.id === scene.scenarioId);
    if (scenario) {
      const updated = { ...scenario, lastSceneId: sceneId };
      scenariosRef.current = scenariosRef.current.map((item) => item.id === updated.id ? updated : item);
      setScenarios(scenariosRef.current);
      void putScenario(updated).catch((error) => setNotice({ tone: "error", text: formatError(error) }));
    }
    commitScene(scene, "STATE_SNAPSHOT");
  }, [commitScene, currentSceneFromRefs]);

  const updateActiveScene = useCallback(
    (update: (scene: Scene) => Scene) => {
      const current = currentSceneFromRefs();
      if (!current) return;
      commitScene(update(current));
    },
    [commitScene, currentSceneFromRefs],
  );

  const showImage = useCallback((id: string | null) => {
    updateActiveScene((scene) => showSceneImage(scene, id));
  }, [updateActiveScene]);

  const rememberFog = useCallback((scene: Scene) => {
    const key = scene.activeMapId ?? scene.id;
    const currentHistory = historyRef.current.get(key) ?? [];
    historyRef.current.set(key, [
      ...currentHistory.slice(-19),
      snapshotFog(scene),
    ]);
    setUndoAvailable((current) => ({ ...current, [key]: true }));
  }, []);

  const setAppMode = (nextMode: AppMode) => {
    setMode(nextMode);
    setPolygonDraft([]);
    setEditingZoneId(null);
    setTool(nextMode === "prepare" ? "rect" : "pan");
  };

  const addScene = async () => {
    if (!activeScenario) return;
    const scene = withScenarioMedia(createScene(scenarioScenes.length + 1), activeScenario.media ?? collectScenarioMedia(scenarioScenes));
    scene.scenarioId = activeScenario.id;
    scene.name = uniqueSceneName(scenarioScenes, scene.name);
    scene.sortOrder = nextSceneOrder(scenarioScenes);
    await putScene(scene);
    const next = [...scenesRef.current, scene];
    scenesRef.current = next;
    setScenes(next);
    changeActiveScene(scene.id);
  };

  const duplicateActiveScene = async () => {
    const current = currentSceneFromRefs();
    if (!current) return;
    const scene = cloneScene(
      current,
      uniqueSceneName(scenarioScenes, `${current.name} copie`),
    );
    scene.sortOrder = nextSceneOrder(scenarioScenes);
    await putScene(scene);
    const next = [...scenesRef.current, scene];
    scenesRef.current = next;
    setScenes(next);
    changeActiveScene(scene.id);
    setNotice({ tone: "success", text: "Scène dupliquée." });
  };

  const deleteActiveScene = async () => {
    const current = currentSceneFromRefs();
    if (!current || scenarioScenes.length <= 1) return;
    if (!window.confirm(`Supprimer définitivement « ${current.name} » ?`)) {
      return;
    }
    const next = scenesRef.current.filter((scene) => scene.id !== current.id);
    window.clearTimeout(saveTimersRef.current.get(current.id));
    saveTimersRef.current.delete(current.id);
    await removeScene(current.id);
    scenesRef.current = next;
    setScenes(next);
    changeActiveScene(next.find((scene) => scene.scenarioId === current.scenarioId)!.id);
  };

  const importMap = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const targetId = activeSceneIdRef.current;
    try {
      const asset = await saveImageFile(file);
      const scene = scenesRef.current.find((item) => item.id === targetId);
      if (!scene) return;
      const saved = syncActiveMap(scene);
      const mapId = createId("map");
      commitScene({
        ...saved,
        maps: [...saved.maps, {
          id: mapId,
          name: file.name.replace(/\.[^.]+$/, ""),
          assetId: asset.id,
          outsideRevealed: false,
          zones: [],
          strokes: [],
          viewport: { zoom: 1, x: 0, y: 0 },
        }],
        activeMapId: mapId,
        mapAssetId: asset.id,
        galleryAssetIds: [...new Set([...scene.galleryAssetIds, asset.id])],
        outsideRevealed: false,
        zones: [],
        strokes: [],
        viewport: { zoom: 1, x: 0, y: 0 },
      });
      setPolygonDraft([]);
      setEditingZoneId(null);
      setNotice({ tone: "success", text: "Carte enregistrée localement." });
    } catch (error) {
      setNotice({ tone: "error", text: formatError(error) });
    }
  };

  const addImageAsMap = (assetId: string) => {
    updateActiveScene((scene) => {
      const saved = syncActiveMap(scene);
      const mapId = createId("map");
      return {
        ...saved,
        maps: [...saved.maps, {
          id: mapId,
          name: `Carte ${saved.maps.length + 1}`,
          assetId,
          outsideRevealed: false,
          zones: [],
          strokes: [],
          viewport: { zoom: 1, x: 0, y: 0 },
        }],
        activeMapId: mapId,
        mapAssetId: assetId,
        outsideRevealed: false,
        zones: [],
        strokes: [],
        viewport: { zoom: 1, x: 0, y: 0 },
      };
    });
    setPolygonDraft([]);
    setEditingZoneId(null);
  };

  const changeMap = (mapId: string) => {
    updateActiveScene((scene) => mapId ? selectSceneMap(scene, mapId) : {
      ...syncActiveMap(scene), activeMapId: null, mapAssetId: null,
      outsideRevealed: false, zones: [], strokes: [], viewport: { zoom: 1, x: 0, y: 0 },
    });
    setPolygonDraft([]);
    setEditingZoneId(null);
  };

  const removeActiveMap = () => {
    updateActiveScene((scene) => {
      const saved = syncActiveMap(scene);
      const maps = saved.maps.filter((map) => map.id !== saved.activeMapId);
      return {
        ...saved, maps, activeMapId: null, mapAssetId: null,
        outsideRevealed: false, zones: [], strokes: [], viewport: { zoom: 1, x: 0, y: 0 },
      };
    });
    setPolygonDraft([]);
    setEditingZoneId(null);
  };

  const importGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    const targetId = activeSceneIdRef.current;
    try {
      const assets: AssetRecord[] = [];
      for (const file of files) assets.push(await saveImageFile(file));
      const scene = scenesRef.current.find((item) => item.id === targetId);
      if (!scene) return;
      commitScene({
        ...scene,
        galleryAssetIds: [...new Set([
          ...scene.galleryAssetIds,
          ...assets.map((asset) => asset.id),
        ])],
      });
      setNotice({
        tone: "success",
        text: `${assets.length} illustration${assets.length > 1 ? "s" : ""} ajoutée${assets.length > 1 ? "s" : ""}.`,
      });
    } catch (error) {
      setNotice({ tone: "error", text: formatError(error) });
    }
  };

  const addZone = useCallback(
    (kind: ZoneKind, points: Point[]) => {
      updateActiveScene((scene) => {
        const merged =
          kind === "polygon"
            ? mergePolygonBoundaries(points, scene.zones)
            : { points, zones: scene.zones };
        return {
          ...scene,
          zones: [
            ...merged.zones,
            {
              id: createId("zone"),
              name: `Zone ${scene.zones.length + 1}`,
              kind,
              points: merged.points,
              revealed: false,
            },
          ],
        };
      });
    },
    [updateActiveScene],
  );

  const finishPolygon = () => {
    if (polygonDraft.length < 3) return;
    addZone("polygon", polygonDraft);
    setPolygonDraft([]);
  };

  const moveZoneVertex = useCallback(
    (zoneId: string, vertexIndex: number, point: Point) => {
      updateActiveScene((scene) => ({
        ...scene,
        zones: scene.zones.map((zone) =>
          zone.id === zoneId
            ? movePolygonVertex(zone, vertexIndex, point)
            : zone,
        ),
      }));
    },
    [updateActiveScene],
  );

  const toggleZone = (zoneId: string) => {
    const current = currentSceneFromRefs();
    if (!current) return;
    rememberFog(current);
    commitScene({
      ...current,
      zones: current.zones.map((zone) =>
        zone.id === zoneId ? { ...zone, revealed: !zone.revealed } : zone,
      ),
    });
  };

  const toggleOutside = () => {
    const current = currentSceneFromRefs();
    if (!current) return;
    rememberFog(current);
    commitScene({
      ...current,
      outsideRevealed: !current.outsideRevealed,
    });
  };

  const addStroke = useCallback(
    (stroke: RevealStroke) => {
      const current = currentSceneFromRefs();
      if (!current) return;
      rememberFog(current);
      commitScene({ ...current, strokes: [...current.strokes, stroke] });
    },
    [commitScene, currentSceneFromRefs, rememberFog],
  );

  const undoFog = () => {
    const current = currentSceneFromRefs();
    if (!current) return;
    const key = current.activeMapId ?? current.id;
    const history = historyRef.current.get(key) ?? [];
    const previous = history.at(-1);
    if (!previous) return;
    historyRef.current.set(key, history.slice(0, -1));
    setUndoAvailable((available) => ({ ...available, [key]: history.length > 1 }));
    commitScene({
      ...current,
      outsideRevealed: previous.outsideRevealed,
      zones: previous.zones,
      strokes: previous.strokes,
    });
  };

  const resetFog = () => {
    const current = currentSceneFromRefs();
    if (!current) return;
    if (!window.confirm("Recouvrir toute la carte et effacer les révélations ?")) {
      return;
    }
    rememberFog(current);
    commitScene({
      ...current,
      outsideRevealed: false,
      zones: current.zones.map((zone) => ({ ...zone, revealed: false })),
      strokes: [],
    });
  };

  const openPlayerWindow = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "player");
    const player = window.open(
      url,
      "the-hub-mj-dualscreen-joueurs",
      "popup=yes,width=1280,height=720",
    );
    if (!player) {
      setNotice({
        tone: "error",
        text: "La fenêtre a été bloquée. Autorisez les fenêtres surgissantes pour ce site.",
      });
    }
  };

  const runLibraryAction = async (action: () => Promise<void>) => {
    if (libraryBusyRef.current) return;
    libraryBusyRef.current = true;
    setLibraryBusy(true);
    try {
      await action();
    } catch (error) {
      setNotice({ tone: "error", text: formatError(error) });
    } finally {
      libraryBusyRef.current = false;
      setLibraryBusy(false);
    }
  };

  const changeScenario = (scenarioId: string) => {
    const scenario = scenariosRef.current.find((item) => item.id === scenarioId);
    const members = scenesRef.current.filter((scene) => scene.scenarioId === scenarioId);
    const target = members.find((scene) => scene.id === scenario?.lastSceneId) ?? members[0];
    if (target) changeActiveScene(target.id);
  };

  const addScenario = async (name: string) => {
    const scenario = createScenario(name);
    const scene = { ...createScene(), scenarioId: scenario.id };
    scenario.lastSceneId = scene.id;
    await saveScenarioBundle(scenario, [scene]);
    scenariosRef.current = [...scenariosRef.current, scenario];
    setScenarios(scenariosRef.current);
    scenesRef.current = [...scenesRef.current, scene];
    setScenes(scenesRef.current);
    changeActiveScene(scene.id);
  };

  const renameScenario = async (name: string) => {
    if (!activeScenario) return;
    const updated = { ...activeScenario, name };
    await putScenario(updated);
    scenariosRef.current = scenariosRef.current.map((item) => item.id === updated.id ? updated : item);
    setScenarios(scenariosRef.current);
  };

  const deleteScenario = async () => {
    if (!activeScenario || scenariosRef.current.length <= 1) return;
    window.clearTimeout(saveTimersRef.current.get(activeScenario.id));
    saveTimersRef.current.delete(activeScenario.id);
    for (const scene of scenarioScenes) {
      window.clearTimeout(saveTimersRef.current.get(scene.id));
      saveTimersRef.current.delete(scene.id);
    }
    await removeScenario(activeScenario.id, scenesRef.current);
    scenariosRef.current = scenariosRef.current.filter((item) => item.id !== activeScenario.id);
    setScenarios(scenariosRef.current);
    scenesRef.current = scenesRef.current.filter((scene) => scene.scenarioId !== activeScenario.id);
    setScenes(scenesRef.current);
    changeScenario(scenariosRef.current[0].id);
    setNotice({ tone: "success", text: "Scénario supprimé de ce navigateur." });
  };

  const moveActiveScene = async (scenarioId: string) => {
    const current = currentSceneFromRefs();
    if (!current || !scenarioId || scenarioScenes.length <= 1) return;
    const targetScenes = scenesRef.current.filter((scene) => scene.scenarioId === scenarioId);
    const target = scenariosRef.current.find((scenario) => scenario.id === scenarioId);
    if (!target) return;
    // Copy media used by this chapter; the source keeps its shared library.
    const linkedIds = new Set([...current.scenarioMarkdown.matchAll(/asset:([A-Za-z0-9_-]+)/g)].map((match) => match[1]));
    if (current.activeImageId) linkedIds.add(current.activeImageId);
    const maps = current.maps.filter((map) => map.id === current.activeMapId).map((map) => ({ ...map, id: createId("map") }));
    for (const map of maps) linkedIds.add(map.assetId);
    const moved = { ...current, scenarioId, sortOrder: nextSceneOrder(targetScenes), maps,
      activeMapId: maps[0]?.id ?? null, galleryAssetIds: [...linkedIds],
      imageViewports: Object.fromEntries(Object.entries(current.imageViewports).filter(([id]) => linkedIds.has(id))),
    };
    const unified = unifyScenarioMedia({ ...target, media: collectScenarioMedia([...targetScenes, moved]) }, [...targetScenes, moved]);
    window.clearTimeout(saveTimersRef.current.get(current.id));
    saveTimersRef.current.delete(current.id);
    await saveScenarioBundle(unified.scenario, unified.scenes);
    scenariosRef.current = scenariosRef.current.map((scenario) => scenario.id === target.id ? unified.scenario : scenario);
    setScenarios(scenariosRef.current);
    const members = new Map(unified.scenes.map((scene) => [scene.id, scene]));
    scenesRef.current = scenesRef.current
      .map((scene) => members.get(scene.id) ?? scene)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    setScenes(scenesRef.current);
    changeActiveScene(moved.id);
    setNotice({ tone: "success", text: "Scène déplacée dans le scénario choisi." });
  };

  const exportScenario = async () => {
    if (!activeScenario) return;
    const members = scenesRef.current.filter((scene) => scene.scenarioId === activeScenario.id);
    const blob = await createBackup(members, activeScenario);
    const filename = Array.from(activeScenario.name.replace(/[<>:"/\\|?*]/g, "-"))
      .filter((character) => character.charCodeAt(0) >= 32).join("").trim() || "scenario";
    downloadBlob(blob, `${filename}.mjscreen`);
    setNotice({ tone: "success", text: `« ${activeScenario.name} » exporté : ${quantity(members.length, "scène")}.` });
  };

  const importScenario = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await runLibraryAction(async () => {
      const imported = await importBackup(file, scenariosRef.current);
      activateImportedScenario(imported);
      setNotice({
        tone: "success",
        text: `« ${imported.scenario.name} » importé : ${quantity(imported.scenes.length, "scène")}.`,
      });
    });
  };

  const activateImportedScenario = (imported: { scenario: Scenario; scenes: Scene[] }) => {
    scenariosRef.current = [...scenariosRef.current, imported.scenario];
    setScenarios(scenariosRef.current);
    scenesRef.current = [...scenesRef.current, ...imported.scenes];
    setScenes(scenesRef.current);
    changeScenario(imported.scenario.id);
  };

  const selectScenario = (id: string) => {
    if (scenariosRef.current.some(scenario => scenario.id === id)) {
      changeScenario(id);
      return;
    }
    const entry = hubScenarios.find(scenario => scenario.id === id);
    if (!entry) return;
    void runLibraryAction(async () => {
      setLoadingScenario(id);
      try {
        activateImportedScenario(await openHubScenario(entry, scenariosRef.current));
      } finally {
        setLoadingScenario("");
      }
    });
  };

  const openScenarioDialog = (action: ScenarioDialogAction) => {
    setNotice(null);
    setScenarioDialog(action);
  };

  if (initializing) {
    return (
      <main className="loading-shell">
        <div className="loading-mark">MJ</div>
        <p>Ouverture de votre table…</p>
      </main>
    );
  }

  const canUndoFog = activeScene ? Boolean(undoAvailable[activeScene.activeMapId ?? activeScene.id]) : false;
  const effectivePanelWidth = getPlayerLayout(activeScene, assetDimensions).panelWidth;
  const effectiveMapWidth = PANEL_WIDTH_MAX - effectivePanelWidth;
  const activeImageViewport = getImageViewport(
    activeScene,
    activeScene?.activeImageId ?? null,
  );

  return (
    <div className="mj-interface" data-theme={appearance.theme}>
    <main className="controller-shell" data-mode={mode} data-interface="carnet">
      <header className="app-header">
        <div className="brand-block">
          <div><a className="hub-return" href="../index.html#outils-overview">Outils de The Hub</a><span className="brand-name">MJ Dualscreen</span></div>
        </div>
        <nav className="mode-switch" aria-label="Mode de travail">
          <button
            type="button"
            className={mode === "prepare" ? "is-active" : ""}
            aria-pressed={mode === "prepare"}
            onClick={() => setAppMode("prepare")}
          >
            <InterfaceIcon name="map" /> Préparer
          </button>
          <button
            type="button"
            className={mode === "scenario" ? "is-active" : ""}
            aria-pressed={mode === "scenario"}
            onClick={() => setAppMode("scenario")}
          >
            <InterfaceIcon name="book" /> Lire
          </button>
          <button
            type="button"
            className={mode === "live" ? "is-active" : ""}
            aria-pressed={mode === "live"}
            onClick={() => setAppMode("live")}
          >
            <InterfaceIcon name="screen" /> Diffuser
          </button>
        </nav>
        <div className="header-actions">
          <ThemeSwitch theme={appearance.theme} onToggle={appearance.toggleTheme} />
          <span
            className={`connection-status ${playerConnected ? "is-online" : ""}`}
          >
            <span className="live-dot" />
            {playerConnected ? "Écran connecté" : "Écran hors ligne"}
          </span>
          <button type="button" className="primary-button" onClick={openPlayerWindow}>
            <InterfaceIcon name="screen" /> Écran joueurs
          </button>
        </div>
      </header>

      <section className="scenario-library" aria-label="Bibliothèque de scénarios" aria-busy={libraryBusy}>
        <div className="scenario-library-picker">
          <label htmlFor="active-scenario">Scénario</label>
          <select id="active-scenario" value={loadingScenario || activeScenario?.id || ""} disabled={libraryBusy}
            onChange={(event) => selectScenario(event.target.value)}>
            <optgroup label="Scénarios de The Hub">
              {hubScenarios.map(entry => <option key={entry.id} value={entry.id}>
                {scenarios.find(scenario => scenario.id === entry.id)?.name ?? entry.name}
              </option>)}
            </optgroup>
            {personalScenarios.length > 0 && <optgroup label="Mes scénarios">
              {personalScenarios.map(scenario => (
                <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
              ))}
            </optgroup>}
          </select>
        </div>
        <div className="chapter-picker">
          <label htmlFor="active-chapter">Chapitre</label>
          <select id="active-chapter" value={activeSceneId} disabled={libraryBusy}
            onChange={(event) => changeActiveScene(event.target.value)}>
            {scenarioScenes.map((scene, index) => <option key={scene.id} value={scene.id}>{index + 1}. {scene.name}</option>)}
          </select>
          <span className="scenario-library-count" aria-label={`Chapitre ${scenarioScenes.findIndex((scene) => scene.id === activeSceneId) + 1} sur ${scenarioScenes.length}`}>
            {scenarioScenes.findIndex((scene) => scene.id === activeSceneId) + 1} / {scenarioScenes.length}
          </span>
        </div>
        <div className="scenario-library-actions">
          <FilePickerButton className="secondary-button" accept=".mjscreen,application/json" disabled={libraryBusy}
            onChange={(event) => void importScenario(event)}>
            {loadingScenario ? "Chargement…" : libraryBusy ? "Traitement…" : "Importer"}
          </FilePickerButton>
          <details className="scenario-library-menu">
            <summary>Gérer</summary>
            <div className="scenario-library-menu-content">
              <p>Un fichier .mjscreen = un scénario et toutes ses scènes.</p>
              <button type="button" disabled={libraryBusy || !activeScenario} onClick={() => void runLibraryAction(exportScenario)}>Exporter ce scénario</button>
              <button type="button" disabled={libraryBusy} onClick={() => openScenarioDialog("create")}>Nouveau scénario</button>
              <button type="button" disabled={libraryBusy || !activeScenario} onClick={() => openScenarioDialog("rename")}>Renommer le scénario</button>
              <button type="button" className="danger-button" disabled={libraryBusy || scenarios.length <= 1} onClick={() => openScenarioDialog("delete")}>Supprimer le scénario</button>
            </div>
          </details>
        </div>
      </section>

      {scenarioDialog && (
        <ScenarioDialog action={scenarioDialog} initialName={scenarioDialog === "create" ? "Nouveau scénario" : activeScenario?.name ?? ""}
          sceneCount={scenarioScenes.length} busy={libraryBusy} error={notice?.tone === "error" ? notice.text : null}
          onClose={() => setScenarioDialog(null)}
          onSubmit={(name) => void runLibraryAction(async () => {
            if (scenarioDialog === "create") await addScenario(name);
            else if (scenarioDialog === "rename") await renameScenario(name);
            else await deleteScenario();
            setScenarioDialog(null);
          })} />
      )}

      {notice && (
        <div className={`notice notice-${notice.tone}`} role="status">
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Fermer">
            ×
          </button>
        </div>
      )}

      <div
        className={`workspace ${mode === "scenario" ? "scenario-mode" : ""}`}
        inert={libraryBusy}
      >
        {mode === "scenario" ? (
          <ScenarioWorkspace
            scene={activeScene}
            activeSceneId={activeSceneId}
            editorVisible={scenarioEditorVisible}
            outlineVisible={scenarioOutlineVisible}
            onEditorVisibleChange={setScenarioEditorVisible}
            onOutlineVisibleChange={setScenarioOutlineVisible}
            onMarkdownChange={(scenarioMarkdown) =>
              updateActiveScene((scene) => ({ ...scene, scenarioMarkdown }))
            }
            onThemeChange={(scenarioTheme) =>
              updateActiveScene((scene) => ({ ...scene, scenarioTheme }))
            }
            assetUrls={assetUrls}
            assetNames={assetNames}
            onShowImage={showImage}
            onImportImages={(event) => void importGallery(event)}
            onMapChange={changeMap}
            scrollPositions={scenarioScrollRef}
          />
        ) : (
          <>
            <aside className="control-panel" id="media-controls">
          <div className="panel-scroll">
            <div className="control-panel-heading">
              <span className="section-eyebrow">{mode === "prepare" ? "ATELIER DU MJ" : "RÉGIE JOUEURS"}</span>
              <h1>{mode === "prepare" ? "Préparer la partie" : "Piloter la table"}</h1>
              <p>{mode === "prepare" ? "Vos médias et vos repères, prêts pour le récit." : "Choisissez ce que les joueurs découvrent."}</p>
            </div>
            {mode === "prepare" && (
              <nav className="prepare-navigation" aria-label="Outils de préparation">
                <button type="button" aria-pressed={preparePanel === "map"} onClick={() => setPreparePanel("map")}>Plans</button>
                <button type="button" aria-pressed={preparePanel === "images"} onClick={() => setPreparePanel("images")}>Images</button>
                <button type="button" aria-pressed={preparePanel === "chapter"} onClick={() => setPreparePanel("chapter")}>Chapitre</button>
              </nav>
            )}

            {mode === "prepare" ? (
              <>
                <section className="control-section" hidden={preparePanel !== "chapter"}>
                  <div className="section-title-row">
                    <h3>Ce chapitre</h3>
                    <span>Dans ce scénario</span>
                  </div>
                  <label className="field-label" htmlFor="scene-name">
                    Nom du chapitre
                  </label>
                  <input
                    id="scene-name"
                    type="text"
                    value={activeScene?.name ?? ""}
                    maxLength={80}
                    onChange={(event) =>
                      updateActiveScene((scene) => ({
                        ...scene,
                        name: event.target.value || "Scène sans titre",
                      }))
                    }
                  />
                  <div className="button-grid">
                    <button type="button" disabled={libraryBusy} onClick={() => void runLibraryAction(addScene)}>
                      Nouvelle
                    </button>
                    <button
                      type="button"
                      disabled={libraryBusy}
                      onClick={() => void runLibraryAction(duplicateActiveScene)}
                    >
                      Dupliquer
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={scenarioScenes.length <= 1 || libraryBusy}
                      onClick={() => void runLibraryAction(deleteActiveScene)}
                    >
                      Supprimer
                    </button>
                  </div>
                </section>

                {scenarios.length > 1 && (
                  <section className="control-section" hidden={preparePanel !== "chapter"}>
                    <label className="field-label" htmlFor="move-scene">Déplacer cette scène vers</label>
                    <select id="move-scene" value="" disabled={libraryBusy || scenarioScenes.length <= 1}
                      onChange={(event) => {
                        const targetId = event.target.value;
                        void runLibraryAction(() => moveActiveScene(targetId));
                      }}>
                      <option value="">Choisir un autre scénario</option>
                      {scenarios.filter((item) => item.id !== activeScenario?.id).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                    {scenarioScenes.length <= 1 && <p className="library-help">Gardez au moins une scène dans ce scénario.</p>}
                  </section>
                )}

                <section className="control-section" hidden={preparePanel !== "map"}>
                  <div className="section-title-row">
                    <h3>Plans du scénario</h3>
                    <span>{quantity(activeScene?.maps.length ?? 0, "carte")}</span>
                  </div>
                  <div className="map-picker-row">
                    <select aria-label="Carte active" value={activeScene?.activeMapId ?? ""} onChange={(event) => changeMap(event.target.value)}>
                      <option value="">Aucun plan</option>
                      {activeScene?.maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
                    </select>
                    <button type="button" disabled={!activeScene?.activeMapId} onClick={removeActiveMap} aria-label="Retirer la carte active">Retirer</button>
                  </div>
                  <FilePickerButton
                    className="upload-button"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={(event) => void importMap(event)}
                  >
                    Importer une carte
                  </FilePickerButton>
                  {Boolean(activeScene?.galleryAssetIds.some((id) => !activeScene.maps.some((map) => map.assetId === id))) && (
                    <select className="map-from-pool" aria-label="Créer une carte avec une image du scénario" value="" onChange={(event) => { if (event.target.value) addImageAsMap(event.target.value); }}>
                      <option value="">Ou utiliser une image du scénario…</option>
                      {activeScene?.galleryAssetIds.filter((id) => !activeScene.maps.some((map) => map.assetId === id)).map((id, index) => <option key={id} value={id}>{assetNames.get(id) ?? `Image ${index + 1}`}</option>)}
                    </select>
                  )}
                </section>

                <section className="control-section" hidden={preparePanel !== "map" || !activeScene?.mapAssetId}>
                  <div className="section-title-row">
                    <h3>Zones préparées</h3>
                    <span>{quantity(activeScene?.zones.length ?? 0, "zone")}</span>
                  </div>
                  <div className="tool-row">
                    <button
                      type="button"
                      className={tool === "rect" ? "is-selected" : ""}
                      onClick={() => {
                        setTool("rect");
                        setPolygonDraft([]);
                        setEditingZoneId(null);
                      }}
                    >
                      Rectangle
                    </button>
                    <button
                      type="button"
                      className={
                        tool === "polygon" || tool === "vertices"
                          ? "is-selected"
                          : ""
                      }
                      onClick={() => {
                        setTool("polygon");
                        setEditingZoneId(null);
                      }}
                    >
                      Polygone
                    </button>
                  </div>
                  {tool === "polygon" && (
                    <div className="polygon-actions">
                      <span>{quantity(polygonDraft.length, "point")}</span>
                      <button
                        type="button"
                        disabled={polygonDraft.length < 3}
                        onClick={finishPolygon}
                      >
                        Terminer
                      </button>
                      <button type="button" onClick={() => setPolygonDraft([])}>
                        Annuler
                      </button>
                    </div>
                  )}
                  <p className="helper-copy">
                    {tool === "rect"
                      ? "Glissez sur la carte pour créer une zone."
                      : tool === "vertices"
                        ? "Glissez les sommets dorés pour ajuster le polygone."
                        : "Cliquez les angles, puis terminez le polygone."}
                  </p>
                  {(tool === "rect" || tool === "polygon") && (
                    <p className="snap-helper">
                      <strong>Accrochage auto</strong>
                      {tool === "polygon"
                        ? "Les contours adjacents fusionnent dès le tracé."
                        : "Les points proches d’une zone se calent sur son contour."}
                    </p>
                  )}
                  <div className="zone-list compact-list">
                    {activeScene?.zones.map((zone) => (
                      <div
                        className={`zone-edit-row ${editingZoneId === zone.id ? "is-editing" : ""}`}
                        key={zone.id}
                      >
                        <input
                          aria-label={`Nom de ${zone.name}`}
                          value={zone.name}
                          maxLength={50}
                          onChange={(event) =>
                            updateActiveScene((scene) => ({
                              ...scene,
                              zones: scene.zones.map((item) =>
                                item.id === zone.id
                                  ? { ...item, name: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                        />
                        {zone.kind === "polygon" && (
                          <button
                            type="button"
                            className="vertex-edit-button"
                            aria-pressed={editingZoneId === zone.id}
                            onClick={() => {
                              const isCurrent = editingZoneId === zone.id;
                              setEditingZoneId(isCurrent ? null : zone.id);
                              setTool(isCurrent ? "polygon" : "vertices");
                              setPolygonDraft([]);
                            }}
                          >
                            {editingZoneId === zone.id ? "Terminer" : "Sommets"}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Supprimer ${zone.name}`}
                          onClick={() => {
                            if (editingZoneId === zone.id) {
                              setEditingZoneId(null);
                              setTool("polygon");
                            }
                            updateActiveScene((scene) => ({
                              ...scene,
                              zones: scene.zones.filter(
                                (item) => item.id !== zone.id,
                              ),
                            }));
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {!activeScene?.zones.length && (
                      <p className="empty-copy">Aucune zone préparée.</p>
                    )}
                  </div>
                </section>

                <section className="control-section" hidden={preparePanel !== "images"}>
                  <div className="section-title-row">
                    <h3>Images du scénario</h3>
                    <span>{quantity(activeScene?.galleryAssetIds.length ?? 0, "image")}</span>
                  </div>
                  <FilePickerButton
                    className="upload-button"
                    multiple
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    onChange={(event) => void importGallery(event)}
                  >
                    Ajouter des images
                  </FilePickerButton>
                  <p className="helper-copy">Sélectionnez une image pour la montrer aux joueurs.</p>
                  <GalleryGrid
                    scene={activeScene}
                    assetUrls={assetUrls}
                    assetNames={assetNames}
                    editing
                    canRemove={(id) => !isScenarioImageUsed(scenarioScenes, id)}
                    onSelect={showImage}
                    onRemove={(id) =>
                      updateActiveScene((scene) => {
                        if (isScenarioImageUsed(scenesRef.current.filter((item) => item.scenarioId === scene.scenarioId), id)) return scene;
                        const imageViewports = { ...scene.imageViewports };
                        delete imageViewports[id];
                        return {
                          ...scene,
                          galleryAssetIds: scene.galleryAssetIds.filter(
                            (assetId) => assetId !== id,
                          ),
                          activeImageId:
                            scene.activeImageId === id
                              ? null
                              : scene.activeImageId,
                          imageViewports,
                        };
                      })
                    }
                  />
                </section>

              </>
            ) : (
              <>
                <section className="control-section">
                  <div className="section-title-row"><h3>Carte en direct</h3><span>{quantity(activeScene?.maps.length ?? 0, "carte")}</span></div>
                  <select aria-label="Carte affichée aux joueurs" value={activeScene?.activeMapId ?? ""} onChange={(event) => changeMap(event.target.value)}>
                    <option value="">Aucun plan</option>
                    {activeScene?.maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
                  </select>
                </section>
                <section className="control-section" hidden={!activeScene?.mapAssetId}>
                  <div className="section-title-row">
                    <h3>Brouillard</h3>
                    <span>Pilotage en direct</span>
                  </div>
                  <div className="tool-row">
                    <button
                      type="button"
                      className={tool === "pan" ? "is-selected" : ""}
                      onClick={() => setTool("pan")}
                    >
                      Déplacer
                    </button>
                    <button
                      type="button"
                      className={tool === "erase" ? "is-selected" : ""}
                      onClick={() => setTool("erase")}
                    >
                      Gomme libre
                    </button>
                  </div>
                  {tool === "erase" && (
                    <label className="range-field">
                      <span>
                        Taille de la gomme <strong>{brushSize}%</strong>
                      </span>
                      <input
                        type="range"
                        min="2"
                        max="12"
                        value={brushSize}
                        onChange={(event) =>
                          setBrushSize(Number(event.target.value))
                        }
                      />
                    </label>
                  )}
                  <div className="zone-list">
                    <button
                      type="button"
                      className={`zone-live-row ${activeScene?.outsideRevealed ? "is-revealed" : ""}`}
                      onClick={toggleOutside}
                    >
                      <span>Hors zones</span>
                      <strong>
                        {activeScene?.outsideRevealed ? "Visible" : "Masqué"}
                      </strong>
                    </button>
                    {activeScene?.zones.map((zone) => (
                      <button
                        type="button"
                        key={zone.id}
                        className={`zone-live-row ${zone.revealed ? "is-revealed" : ""}`}
                        onClick={() => toggleZone(zone.id)}
                      >
                        <span>{zone.name}</span>
                        <strong>{zone.revealed ? "Visible" : "Masquée"}</strong>
                      </button>
                    ))}
                    {!activeScene?.zones.length && (
                      <p className="empty-copy">
                        Aucune zone préparée : le fond représente toute la carte.
                      </p>
                    )}
                  </div>
                  <div className="button-grid">
                    <button
                      type="button"
                      disabled={!canUndoFog}
                      onClick={undoFog}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={resetFog}
                    >
                      Tout recouvrir
                    </button>
                  </div>
                </section>

                <section className="control-section">
                  <div className="section-title-row">
                    <h3>Illustration</h3>
                    <button
                      type="button"
                      className={`small-toggle ${activeScene?.panelVisible ? "is-on" : ""}`}
                      onClick={() =>
                        updateActiveScene((scene) => {
                          const panelVisible = !scene.panelVisible;
                          return {
                            ...scene,
                            panelVisible,
                            panelWidth:
                              panelVisible &&
                              scene.panelWidth === PANEL_WIDTH_MIN
                                ? DEFAULT_PANEL_WIDTH
                                : scene.panelWidth,
                          };
                        })
                      }
                    >
                      {activeScene?.panelVisible ? "Panneau visible" : "Panneau masqué"}
                    </button>
                  </div>
                  <GalleryGrid
                    scene={activeScene}
                    assetUrls={assetUrls}
                    assetNames={assetNames}
                    onSelect={showImage}
                  />
                </section>

                <details className="control-section composition-controls">
                  <summary>Cadrage et répartition</summary>
                  <div className="section-title-row">
                    <span>Ajuster la vue joueurs</span>
                    <button type="button" className="small-toggle" aria-pressed={activeScene?.panelSizing !== "manual"}
                      onClick={() => updateActiveScene((scene) => showSceneImage(scene, scene.activeImageId))}>
                      Ajustement auto
                    </button>
                  </div>
                  <label className="range-field">
                    <span>
                      Répartition{" "}
                      <strong>
                        {effectiveMapWidth}% carte · {effectivePanelWidth}% image
                      </strong>
                    </span>
                    <input
                      type="range"
                      min={PANEL_WIDTH_MIN}
                      max={PANEL_WIDTH_MAX}
                      aria-label="Répartition entre la carte et l’image"
                      value={effectivePanelWidth}
                      onChange={(event) => {
                        const panelWidth = clampPanelWidth(
                          Number(event.target.value),
                        );
                        updateActiveScene((scene) => ({
                          ...scene,
                          panelWidth,
                          panelSizing: "manual",
                          panelVisible: panelWidth > PANEL_WIDTH_MIN,
                        }));
                      }}
                    />
                  </label>
                  <label className="range-field">
                    <span>
                      Zoom carte{" "}
                      <strong>
                        {Math.round((activeScene?.viewport.zoom ?? 1) * 100)}%
                      </strong>
                    </span>
                    <input
                      type="range"
                      min="75"
                      max="400"
                      value={Math.round(
                        (activeScene?.viewport.zoom ?? 1) * 100,
                      )}
                      onChange={(event) =>
                        updateActiveScene((scene) => ({
                          ...scene,
                          viewport: {
                            ...scene.viewport,
                            zoom: Number(event.target.value) / 100,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="range-field">
                    <span>
                      Zoom image{" "}
                      <strong>
                        {Math.round(activeImageViewport.zoom * 100)}%
                      </strong>
                    </span>
                    <input
                      type="range"
                      min="75"
                      max="400"
                      disabled={!activeScene?.activeImageId}
                      value={Math.round(activeImageViewport.zoom * 100)}
                      onChange={(event) => {
                        const zoom = Number(event.target.value) / 100;
                        updateActiveScene((scene) => {
                          const imageId = scene.activeImageId;
                          if (!imageId) return scene;
                          return {
                            ...scene,
                            imageViewports: {
                              ...scene.imageViewports,
                              [imageId]: {
                                ...getImageViewport(scene, imageId),
                                zoom,
                              },
                            },
                          };
                        });
                      }}
                    />
                  </label>
                  <div className="button-grid">
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveScene((scene) => ({
                          ...scene,
                          viewport: { zoom: 1, x: 0, y: 0 },
                        }))
                      }
                    >
                      Recentrer la carte
                    </button>
                    <button
                      type="button"
                      disabled={!activeScene?.activeImageId}
                      onClick={() =>
                        updateActiveScene((scene) => {
                          const imageId = scene.activeImageId;
                          if (!imageId) return scene;
                          return {
                            ...scene,
                            imageViewports: {
                              ...scene.imageViewports,
                              [imageId]: { zoom: 1, x: 0, y: 0 },
                            },
                          };
                        })
                      }
                    >
                      Ajuster l’image
                    </button>
                  </div>
                </details>
              </>
            )}
          </div>
        </aside>

        <section className="preview-area">
          <div className="preview-heading">
            <div>
              <span className="section-eyebrow">{mode === "prepare" ? "ESPACE DE PRÉPARATION" : "APERÇU EN DIRECT"}</span>
              <h2>{activeScene?.maps.find((map) => map.id === activeScene.activeMapId)?.name ?? (activeScene?.activeImageId ? "Illustration à l’écran" : "Votre table de jeu")}</h2>
            </div>
            <div className="preview-hints">
              <span>
                {mode === "prepare"
                  ? "Les repères de zones ne sont visibles qu’ici."
                  : tool === "erase"
                    ? "Glissez sur la carte pour révéler."
                    : "Cliquez une zone ou le fond pour l’afficher ; glissez la carte ou l’image pour cadrer."}
              </span>
              <span className="autosave-label">Enregistrement automatique</span>
            </div>
          </div>
          <div className="preview-bezel">
            <PlayerFrame
              scene={activeScene}
              assetUrls={assetUrls}
              assetDimensions={assetDimensions}
              className="controller-preview"
              interactive
              mode={mode}
              tool={tool}
              brushSize={brushSize}
              polygonDraft={polygonDraft}
              editingZoneId={editingZoneId}
              onPolygonDraftChange={setPolygonDraft}
              onCreateZone={addZone}
              onMoveZoneVertex={moveZoneVertex}
              onStroke={addStroke}
              onToggleZone={toggleZone}
              onToggleOutside={toggleOutside}
              onViewportChange={(viewport) =>
                updateActiveScene((scene) => ({ ...scene, viewport }))
              }
              onImageViewportChange={(viewport) =>
                updateActiveScene((scene) => {
                  const imageId = scene.activeImageId;
                  if (!imageId) return scene;
                  return {
                    ...scene,
                    imageViewports: {
                      ...scene.imageViewports,
                      [imageId]: viewport,
                    },
                  };
                })
              }
            />
          </div>
          <div className="preview-footer">
            <span>{mode === "prepare" ? "Les contours des zones restent réservés au MJ." : "Cet aperçu suit l’affichage joueurs."}</span>
            <span>
              {activeScene?.mapAssetId
                ? "Carte prête"
                : "Aucun plan sélectionné"}
            </span>
          </div>
            </section>
          </>
        )}
      </div>
      <PlayerMonitor scene={activeScene} assetUrls={assetUrls} assetDimensions={assetDimensions} assetNames={assetNames}
        connected={playerConnected} screenSize={playerScreenSize}
        onHide={() => updateActiveScene((scene) => ({ ...syncActiveMap(scene), activeMapId: null, mapAssetId: null,
          activeImageId: null, panelVisible: false, outsideRevealed: false, zones: [], strokes: [], viewport: { zoom: 1, x: 0, y: 0 } }))} />
    </main>
    </div>
  );
}

function GalleryGrid({
  scene,
  assetUrls,
  assetNames,
  editing = false,
  canRemove,
  onSelect,
  onRemove,
}: {
  scene: Scene | null;
  assetUrls: Map<string, string>;
  assetNames?: Map<string, string>;
  editing?: boolean;
  canRemove?: (id: string) => boolean;
  onSelect: (id: string | null) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="gallery-grid">
      <button
        type="button"
        className={`gallery-tile gallery-none ${!scene?.activeImageId || !scene.panelVisible ? "is-active" : ""}`}
        aria-pressed={!scene?.activeImageId || !scene.panelVisible}
        onClick={() => onSelect(null)}
      >
        <InterfaceIcon name="hide" />
        <small>Masquer l’image</small>
      </button>
      {scene?.galleryAssetIds.map((assetId, index) => {
        const url = assetUrls.get(assetId);
        return (
          <div
            className={`gallery-tile ${scene.activeImageId === assetId && scene.panelVisible ? "is-active" : ""}`}
            key={assetId}
          >
            <button
              type="button"
              className="gallery-select"
              aria-pressed={scene.activeImageId === assetId && scene.panelVisible}
              onClick={() => onSelect(assetId)}
              aria-label={`Afficher ${assetNames?.get(assetId) ?? `l’illustration ${index + 1}`}`}
              title={assetNames?.get(assetId)}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" />
              ) : (
                <span className="image-loading">…</span>
              )}
            </button>
            {assetNames?.get(assetId) && <span className="gallery-caption">{assetNames.get(assetId)}</span>}
            {editing && onRemove && (canRemove?.(assetId) ?? true) && !scene.maps.some((map) => map.assetId === assetId) && !scene.scenarioMarkdown.includes(`asset:${assetId}`) && (
              <button
                type="button"
                className="gallery-remove"
                aria-label={`Retirer l’illustration ${index + 1}`}
                onClick={() => onRemove(assetId)}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MjScreenApp() {
  const isPlayer = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("view") === "player",
    () => false,
  );
  return isPlayer ? <PlayerView /> : <ControllerView />;
}
