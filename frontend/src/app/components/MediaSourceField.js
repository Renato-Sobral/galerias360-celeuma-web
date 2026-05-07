"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { File, Folder, HardDriveUpload, ImageIcon, LayoutGrid, List, Music2, RefreshCcw, FolderPlus, Upload, Video } from "lucide-react";
import {
  createLibrarySelection,
  fetchMediaDirectory,
  fetchMediaTree,
  fileMatchesAccept,
  inferPreviewKind,
  resolveUploadsUrl,
  uploadFileToMediaLibrary,
} from "../lib/media-library";

function formatBytes(size) {
  if (!Number.isFinite(size)) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getExtensionLabel(item) {
  const extFromItem = String(item?.extension || "").trim().replace(/^\./, "");
  if (extFromItem) return extFromItem.toUpperCase();

  const fileName = String(item?.name || "");
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === fileName.length - 1) return "-";
  return fileName.slice(lastDot + 1).toUpperCase();
}

function compareMediaItems(a, b, sortBy) {
  const nameA = String(a?.name || "").toLocaleLowerCase("pt-PT");
  const nameB = String(b?.name || "").toLocaleLowerCase("pt-PT");
  const dateA = new Date(a?.modifiedAt || 0).getTime() || 0;
  const dateB = new Date(b?.modifiedAt || 0).getTime() || 0;
  const sizeA = Number(a?.size || 0);
  const sizeB = Number(b?.size || 0);

  if (a?.type === "folder" && b?.type !== "folder") return -1;
  if (a?.type !== "folder" && b?.type === "folder") return 1;

  if (sortBy === "name_asc") return nameA.localeCompare(nameB, "pt-PT");
  if (sortBy === "name_desc") return nameB.localeCompare(nameA, "pt-PT");
  if (sortBy === "size_desc") return sizeB - sizeA;
  if (sortBy === "size_asc") return sizeA - sizeB;
  if (sortBy === "updated_asc") return dateA - dateB;
  return dateB - dateA;
}

function FilePreview({ selection, accept, previewOnly = false }) {
  const [devicePreviewUrl, setDevicePreviewUrl] = useState(null);

  useEffect(() => {
    if (selection?.source !== "device" || !selection.file) {
      setDevicePreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selection.file);
    setDevicePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selection]);

  if (!selection) return null;

  const previewKind = inferPreviewKind(selection.name || selection.file?.name, accept);
  const previewUrl = selection.source === "library"
    ? (selection.url || resolveUploadsUrl(selection.path))
    : devicePreviewUrl;
  const fileName = selection.name || selection.file?.name || "Ficheiro selecionado";
  const folderPath = selection.path
    ? selection.path.split("/").slice(0, -1).join("/")
    : "";
  const label = selection.source === "library" ? "Ficheiro do File Manager" : "Ficheiro do dispositivo";

  const previewContent = (
    <>
      {previewUrl && previewKind === "image" && (
        <img
          src={previewUrl}
          alt={selection.name || "Preview"}
          className={previewOnly ? "max-h-[52vh] w-full rounded-lg object-contain bg-background" : "h-24 w-full rounded-md object-contain bg-background"}
        />
      )}

      {previewUrl && previewKind === "video" && (
        <video
          src={previewUrl}
          controls
          className={previewOnly ? "max-h-[52vh] w-full rounded-lg bg-background" : "h-32 w-full rounded-md bg-background"}
        />
      )}

      {previewUrl && previewKind === "audio" && (
        <audio src={previewUrl} controls className="w-full" />
      )}

      {(!previewUrl || previewKind === "file") && (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Sem preview disponivel para este ficheiro.
        </div>
      )}
    </>
  );

  if (previewOnly) {
    return <div className="flex min-h-[240px] items-center justify-center">{previewContent}</div>;
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {selection.path && (
            <p className="text-xs text-muted-foreground break-all mt-1">
              Pasta: /{folderPath || ""}
            </p>
          )}
        </div>
      </div>

      {previewContent}
    </div>
  );
}

function itemIcon(item, accepted) {
  if (item.type === "folder") return <Folder className="h-4 w-4 text-amber-500" />;
  const kind = inferPreviewKind(item.name, "");
  if (!accepted) return <File className="h-4 w-4 text-muted-foreground" />;
  if (kind === "image") return <ImageIcon className="h-4 w-4 text-sky-500" />;
  if (kind === "video") return <Video className="h-4 w-4 text-violet-500" />;
  if (kind === "audio") return <Music2 className="h-4 w-4 text-emerald-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function toLabelDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function extractDroppedFiles(event) {
  const dt = event?.dataTransfer;
  if (!dt) return [];

  if (dt.items?.length) {
    const files = [];
    for (const item of dt.items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) return files;
  }

  return Array.from(dt.files || []);
}

function normalizeInputAccept(accept = "") {
  const tokens = String(accept)
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (!tokens.length) return accept;

  const hasImageWildcard = tokens.some((token) => token.toLowerCase() === "image/*");
  if (!hasImageWildcard) return accept;

  const lowerSet = new Set(tokens.map((token) => token.toLowerCase()));
  if (!lowerSet.has(".hdr")) tokens.push(".hdr");
  if (!lowerSet.has(".exr")) tokens.push(".exr");
  return tokens.join(",");
}

function FolderTree({ node, currentPath, onOpen, depth = 0 }) {
  if (!node) return null;

  const isCurrent = currentPath === node.path;

  return (
    <div>
      <button
        type="button"
        onClick={() => onOpen(node.path)}
        style={{ paddingLeft: `${depth * 12}px` }}
        className={`mb-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${isCurrent ? "bg-muted font-medium text-foreground" : "text-foreground/90 hover:bg-muted/60"}`}
      >
        <Folder className="h-4 w-4 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>

      {Array.isArray(node.children) && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FolderTree
              key={child.path || child.name}
              node={child}
              currentPath={currentPath}
              onOpen={onOpen}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MediaSourceField({
  label,
  accept = "",
  selection,
  onChange,
  destinationPath = "",
  required = false,
  helperText,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tree, setTree] = useState(null);
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [viewMode, setViewMode] = useState("grid");
  const uploadInputRef = useRef(null);
  const inputAccept = useMemo(() => normalizeInputAccept(accept), [accept]);

  useEffect(() => {
    if (!pickerOpen) return;

    let cancelled = false;

    const loadTree = async () => {
      setLoadingTree(true);
      try {
        const nextTree = await fetchMediaTree();
        if (!cancelled) setTree(nextTree);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Erro ao carregar as pastas.");
      } finally {
        if (!cancelled) setLoadingTree(false);
      }
    };

    const loadDirectory = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await fetchMediaDirectory(currentPath);
        if (cancelled) return;
        setItems(payload.items || []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Erro ao carregar esta pasta.");
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTree();
    loadDirectory();
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, currentPath]);

  useEffect(() => {
    if (!pickerOpen) {
      setCurrentPath(selection?.source === "library" ? selection.path?.split("/").slice(0, -1).join("/") || "" : "");
      setSelectedPath(selection?.source === "library" ? selection.path || "" : "");
    }
  }, [pickerOpen, selection]);

  const breadcrumbs = useMemo(() => {
    const segments = currentPath ? currentPath.split("/") : [];
    return [{ label: "uploads", path: "" }].concat(
      segments.map((segment, index) => ({
        label: segment,
        path: segments.slice(0, index + 1).join("/"),
      }))
    );
  }, [currentPath]);

  const selectableItems = useMemo(
    () => items.filter((item) => item.type === "folder" || fileMatchesAccept(item.name, accept)),
    [accept, items]
  );

  const selectedItem = useMemo(
    () => selectableItems.find((item) => item.path === selectedPath && item.type === "file") || null,
    [selectableItems, selectedPath]
  );

  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("pt-PT");
    const filtered = term
      ? selectableItems.filter((item) => String(item?.name || "").toLocaleLowerCase("pt-PT").includes(term))
      : selectableItems;

    return [...filtered].sort((a, b) => compareMediaItems(a, b, sortBy));
  }, [searchTerm, selectableItems, sortBy]);

  const triggerLabel = selection
    ? `Alterar ${label.toLowerCase()}`
    : `Escolher ${label.toLowerCase()}`;

  const openFolder = async (path) => {
    setCurrentPath(path || "");
    setSelectedPath("");
  };

  const refreshLibrary = async () => {
    setError("");
    setLoading(true);
    setLoadingTree(true);

    try {
      const [nextTree, payload] = await Promise.all([
        fetchMediaTree(),
        fetchMediaDirectory(currentPath),
      ]);
      setTree(nextTree);
      setItems(payload.items || []);
    } catch (refreshError) {
      setError(refreshError.message || "Erro ao atualizar a biblioteca.");
    } finally {
      setLoading(false);
      setLoadingTree(false);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = window.prompt("Nome da nova pasta:");
    if (!folderName) return;

    setError("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/media/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
        body: JSON.stringify({
          parentPath: currentPath,
          name: folderName,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Erro ao criar pasta.");
      }

      await refreshLibrary();
    } catch (createError) {
      setError(createError.message || "Erro ao criar pasta.");
    }
  };

  const handleUploadFromDevice = async (eventOrFiles) => {
    const incomingFiles = Array.isArray(eventOrFiles)
      ? eventOrFiles
      : Array.from(eventOrFiles?.target?.files || []);
    const file = incomingFiles[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const uploaded = await uploadFileToMediaLibrary(file, destinationPath || currentPath);
      const uploadedFolder = uploaded.path.split("/").slice(0, -1).join("/");
      const [nextTree, payload] = await Promise.all([
        fetchMediaTree(),
        fetchMediaDirectory(uploadedFolder),
      ]);

      setTree(nextTree);
      setCurrentPath(uploadedFolder);
      setItems(payload.items || []);
      setSelectedPath(uploaded.path);
    } catch (uploadError) {
      setError(uploadError.message || "Erro ao enviar ficheiro para o File Manager.");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };

  const confirmLibrarySelection = () => {
    if (!selectedPath) return;
    onChange(createLibrarySelection(selectedPath));
    setPickerOpen(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground block">
          {label}
          {required ? " *" : ""}
        </label>

        <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setPickerOpen(true)}>
          <HardDriveUpload className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>

        <p className="text-xs text-muted-foreground">
          Escolhe ou carrega o ficheiro numa biblioteca multimédia simplificada.
        </p>
      </div>

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}

      {selection && <FilePreview selection={selection} accept={accept} />}

      {selection && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Limpar seleção
          </Button>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent
          className="z-[120] flex h-[90vh] w-[96vw] !max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:h-[92vh] sm:w-[94vw] sm:!max-w-6xl xl:!max-w-7xl sm:rounded-xl"
          overlayClassName="z-[110] bg-transparent"
        >
          <DialogHeader>
            <div className="border-b border-border px-5 py-4 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-xl font-semibold tracking-tight">File Manager</DialogTitle>
                  <DialogDescription className="mt-1 text-xs sm:text-sm">
                    Escolhe ou carrega um ficheiro sem sair deste formulário.
                  </DialogDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={refreshLibrary} disabled={loading || loadingTree || uploading}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Atualizar
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCreateFolder}>
                    <FolderPlus className="mr-2 h-4 w-4" />
                    Nova pasta
                  </Button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept={inputAccept}
                    onChange={handleUploadFromDevice}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "A enviar..." : "Upload"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 min-h-0 flex-col overflow-hidden px-5 py-4 gap-4">
            <div
              className="rounded-xl border border-dashed border-border bg-card px-4 py-3 shrink-0"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const droppedFiles = extractDroppedFiles(event);
                if (droppedFiles.length > 0) {
                  handleUploadFromDevice(droppedFiles);
                }
              }}
            >
              <p className="text-xs sm:text-sm text-muted-foreground">
                Arraste ficheiros para fazer upload na pasta atual: <span className="font-medium text-foreground">/{currentPath || ""}</span>
              </p>
            </div>

            {error && <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[220px_minmax(0,1.4fr)_300px]">
              <aside className="rounded-xl border border-border bg-card p-3 min-h-0 overflow-y-auto">
                <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">Pastas</div>
                {loadingTree ? (
                  <p className="text-sm text-muted-foreground">A carregar...</p>
                ) : (
                  <FolderTree node={tree} currentPath={currentPath} onOpen={openFolder} />
                )}
              </aside>

              <div
                className="rounded-xl border border-border bg-card p-4 min-h-0 overflow-y-auto"
                style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
              >
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.path || "root"} className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded px-2 py-1 hover:bg-muted"
                        onClick={() => openFolder(crumb.path)}
                      >
                        {crumb.label}
                      </button>
                      {index < breadcrumbs.length - 1 && <span className="text-muted-foreground">/</span>}
                    </div>
                  ))}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Pesquisar ficheiros e pastas..."
                    className="h-9 min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    <option value="updated_desc">Mais recentes</option>
                    <option value="updated_asc">Mais antigos</option>
                    <option value="name_asc">Nome (A-Z)</option>
                    <option value="name_desc">Nome (Z-A)</option>
                    <option value="size_desc">Maior tamanho</option>
                    <option value="size_asc">Menor tamanho</option>
                  </select>
                  <div className="inline-flex rounded-md border border-border bg-background p-0.5">
                    <Button
                      type="button"
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="h-8 px-2"
                      title="Vista em grelha"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="h-8 px-2"
                      title="Vista em lista"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mb-4 text-xs text-muted-foreground">
                  {visibleItems.length} item(ns)
                  {searchTerm.trim() ? ` para "${searchTerm.trim()}"` : ""}
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">A carregar ficheiros...</p>
                ) : selectableItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Não existem ficheiros compatíveis nesta pasta.</p>
                ) : visibleItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem resultados para a pesquisa atual.</p>
                ) : (
                  <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3" : "flex flex-col gap-2"}>
                    {visibleItems.map((item) => {
                      const accepted = item.type === "folder" || fileMatchesAccept(item.name, accept);
                      const isActive = selectedPath === item.path;
                      const Icon = item.type === "folder"
                        ? Folder
                        : item.type === "file"
                          ? itemIcon(item, accepted).type
                          : File;

                      return (
                        <button
                          key={item.path}
                          type="button"
                          disabled={!accepted}
                          onClick={() => {
                            if (item.type === "folder") {
                              openFolder(item.path);
                              return;
                            }
                            setSelectedPath(item.path);
                          }}
                          className={`rounded-xl border text-left transition ${isActive ? "border-foreground bg-muted" : "border-border hover:border-foreground/40"} ${viewMode === "grid" ? "p-4" : "p-3"}`}
                        >
                          {viewMode === "grid" ? (
                            <>
                              <div className="mb-4 flex items-start gap-2">
                                <Icon className="h-5 w-5 shrink-0" />
                                <span className="truncate text-sm font-semibold text-foreground">{item.name}</span>
                              </div>

                              <div className="space-y-1 text-sm text-muted-foreground">
                                {item.type === "folder" ? (
                                  <div>Pasta</div>
                                ) : (
                                  <div>Extensão: {getExtensionLabel(item)}</div>
                                )}
                                {item.type === "file" && <div>Tamanho: {formatBytes(item.size)}</div>}
                                <div>Atualizado: {toLabelDate(item.modifiedAt)}</div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-foreground">{item.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  {item.type === "folder" ? (
                                    <span>Pasta</span>
                                  ) : (
                                    <span>Extensão: {getExtensionLabel(item)}</span>
                                  )}
                                  {item.type === "file" && <span>Tamanho: {formatBytes(item.size)}</span>}
                                  <span>Atualizado: {toLabelDate(item.modifiedAt)}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="rounded-xl border border-border bg-card p-4 min-h-0 overflow-y-auto">
                <div className="mb-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                </div>

                {selectedItem ? (
                  <FilePreview selection={createLibrarySelection(selectedItem.path)} accept={accept} previewOnly />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Seleciona um ficheiro para veres a pré-visualização aqui.
                  </p>
                )}
              </aside>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-5 py-4 bg-background">
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmLibrarySelection} disabled={!selectedPath}>
              Selecionar ficheiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}