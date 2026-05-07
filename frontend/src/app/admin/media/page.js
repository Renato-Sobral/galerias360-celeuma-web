"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "../../components/protectedRoute";
import ContextMenuWrapper from "../../components/ContextMenuWrapper";
import {
  Folder,
  FolderOpen,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileText,
  Upload,
  FolderPlus,
  Trash2,
  RefreshCcw,
  Link2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif", ".hdr", ".exr"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".webm", ".mkv", ".m4v"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".aac", ".ogg", ".flac"];
const DOC_EXTENSIONS = [".txt", ".md", ".pdf", ".doc", ".docx", ".csv", ".json"];
const ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".gz"];

function resolveAssetUrl(relativeUrl) {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;

  const base = (API || "").replace(/\/$/, "");
  if (!base) return relativeUrl;
  return `${base}${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;
}

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "-";
  if (!Number.isFinite(bytes)) return "-";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
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

function itemIcon(item) {
  if (item.type === "folder") return Folder;

  const ext = (item.extension || "").toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return FileImage;
  if (VIDEO_EXTENSIONS.includes(ext)) return FileVideo;
  if (AUDIO_EXTENSIONS.includes(ext)) return FileAudio;
  if (DOC_EXTENSIONS.includes(ext)) return FileText;
  if (ARCHIVE_EXTENSIONS.includes(ext)) return FileArchive;
  return File;
}

function extractDroppedFiles(event) {
  const dt = event?.dataTransfer;
  if (!dt) return [];

  if (dt.items && dt.items.length > 0) {
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

async function safeReadResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return {
    success: false,
    message: text && text.trim().startsWith("<!DOCTYPE")
      ? "Erro interno no servidor ao processar o pedido."
      : text || "Resposta inválida do servidor.",
  };
}

export default function MediaPage() {
  return (
    <ProtectedRoute rolesRequired={["Admin", "Editor"]}>
      {() => <MediaManager />}
    </ProtectedRoute>
  );
}

function MediaManager() {
  const [activeTab, setActiveTab] = useState("explorer");
  const [tree, setTree] = useState(null);
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedItemPreviewUrl, setSelectedItemPreviewUrl] = useState(null);
  const [references, setReferences] = useState([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [dragOverPath, setDragOverPath] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("updated_desc");
  const fileInputRef = useRef(null);

  const breadcrumbs = useMemo(() => {
    const segments = currentPath ? currentPath.split("/") : [];
    const crumbs = [{ label: "uploads", path: "" }];

    segments.forEach((segment, index) => {
      crumbs.push({
        label: segment,
        path: segments.slice(0, index + 1).join("/"),
      });
    });

    return crumbs;
  }, [currentPath]);

  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("pt-PT");
    const filtered = term
      ? items.filter((item) => String(item?.name || "").toLocaleLowerCase("pt-PT").includes(term))
      : items;

    return [...filtered].sort((a, b) => compareMediaItems(a, b, sortBy));
  }, [items, searchTerm, sortBy]);

  const fetchTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const response = await fetch(`${API}/media/tree`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao carregar árvore");
      setTree(data.tree);
    } catch (err) {
      setError(err.message || "Erro ao carregar árvore de pastas");
    } finally {
      setLoadingTree(false);
    }
  }, []);

  const fetchItems = useCallback(async (pathValue) => {
    setLoadingItems(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (pathValue) query.set("path", pathValue);

      const response = await fetch(`${API}/media/list?${query.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao listar itens");

      setCurrentPath(data.path || "");
      setItems(Array.isArray(data.items) ? data.items : []);
      setSelectedItem(null);
      setSelectedItemPreviewUrl(null);
      setReferences([]);
    } catch (err) {
      setError(err.message || "Erro ao listar itens da pasta");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const fetchReferences = useCallback(async (relativePath) => {
    if (!relativePath) return;

    setLoadingRefs(true);
    try {
      const query = new URLSearchParams({ path: relativePath });
      const response = await fetch(`${API}/media/references?${query.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao obter referências");
      setReferences(Array.isArray(data.references) ? data.references : []);
      setSelectedItemPreviewUrl(resolveAssetUrl(data.url));
    } catch (err) {
      setReferences([]);
      setSelectedItemPreviewUrl(null);
      setError(err.message || "Erro ao obter referências");
    } finally {
      setLoadingRefs(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
    fetchItems("");
  }, [fetchTree, fetchItems]);

  const refreshCurrent = async () => {
    await Promise.all([fetchTree(), fetchItems(currentPath)]);
  };

  const handleCreateFolder = async () => {
    const folderName = window.prompt("Nome da nova pasta:");
    if (!folderName) return;

    try {
      const response = await fetch(`${API}/media/folder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          parentPath: currentPath,
          name: folderName,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao criar pasta");
      await refreshCurrent();
    } catch (err) {
      setError(err.message || "Erro ao criar pasta");
    }
  };

  const handleUploadFiles = async (files, destinationPath = currentPath) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("destinationPath", destinationPath || "");
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await fetch(`${API}/media/upload`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      const data = await safeReadResponse(response);
      if (!response.ok || !data.success) throw new Error(data.message || "Erro no upload");

      await refreshCurrent();
    } catch (err) {
      setError(err.message || "Erro no upload de ficheiros");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleMoveItem = async (sourcePath, destinationPath) => {
    try {
      const response = await fetch(`${API}/media/move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sourcePath, destinationPath }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao mover item");

      await refreshCurrent();
    } catch (err) {
      setError(err.message || "Erro ao mover item");
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = window.confirm(`Eliminar "${item.name}"?`);
    if (!confirmed) return;

    try {
      const response = await fetch(`${API}/media/item`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ targetPath: item.path }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Erro ao eliminar item");

      if (selectedItem?.path === item.path) {
        setSelectedItem(null);
        setReferences([]);
      }
      await refreshCurrent();
    } catch (err) {
      setError(err.message || "Erro ao eliminar item");
    }
  };

  const onDropIntoFolder = async (event, destinationPath) => {
    event.preventDefault();
    setDragOverPath(null);

    const droppedFiles = extractDroppedFiles(event);
    if (droppedFiles.length > 0) {
      await handleUploadFiles(droppedFiles, destinationPath);
      return;
    }

    const sourcePath = event.dataTransfer.getData("text/plain");
    if (!sourcePath || sourcePath === destinationPath) return;
    await handleMoveItem(sourcePath, destinationPath);
  };

  const onItemClick = async (item) => {
    setSelectedItem(item);

    if (item.type === "folder") {
      setActiveTab("explorer");
      setSelectedItemPreviewUrl(null);
      return;
    }

    setActiveTab("references");
    await fetchReferences(item.path);
  };

  const onItemDoubleClick = async (item) => {
    if (item.type === "folder") {
      await fetchItems(item.path);
    }
  };

  const handleItemContextAction = async (action, item) => {
    if (!item) return;

    if (action === "open") {
      if (item.type === "folder") {
        await fetchItems(item.path);
      } else {
        await onItemClick(item);
      }
      return;
    }

    if (action === "references" && item.type === "file") {
      setSelectedItem(item);
      setActiveTab("references");
      await fetchReferences(item.path);
      return;
    }

    if (action === "delete") {
      await handleDeleteItem(item);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex-1 p-4 sm:p-8 overflow-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">File Manager</h1>
            <p className="text-sm text-muted-foreground">Gestão de multimédia com pastas, upload e referências de uso.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={refreshCurrent}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <RefreshCcw className="h-4 w-4" /> Atualizar
            </button>

            <button
              onClick={handleCreateFolder}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <FolderPlus className="h-4 w-4" /> Nova pasta
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm text-background hover:opacity-90">
              <Upload className="h-4 w-4" /> {uploading ? "A enviar..." : "Upload"}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => handleUploadFiles(event.target.files)}
              />
            </label>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-dashed border-border bg-card p-4"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const droppedFiles = extractDroppedFiles(event);
            if (droppedFiles.length > 0) {
              handleUploadFiles(droppedFiles);
            }
          }}
        >
          <p className="text-sm text-muted-foreground">
            Arraste ficheiros para fazer upload na pasta atual: <span className="font-medium text-foreground">/{currentPath || ""}</span>
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${activeTab === "explorer" ? "bg-muted border-border" : "border-transparent hover:border-border"}`}
          >
            <FolderOpen className="h-4 w-4" /> Explorer
          </button>
          <button
            onClick={() => setActiveTab("references")}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm border ${activeTab === "references" ? "bg-muted border-border" : "border-transparent hover:border-border"}`}
            disabled={!selectedItem || selectedItem.type !== "file"}
            title={!selectedItem || selectedItem.type !== "file" ? "Selecione um ficheiro para ver referências" : "Referências"}
          >
            <Link2 className="h-4 w-4" /> Referências
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <aside className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Pastas</div>
            {loadingTree ? (
              <p className="text-sm text-muted-foreground">A carregar...</p>
            ) : (
              <FolderTree
                node={tree}
                currentPath={currentPath}
                onOpen={fetchItems}
                onDropIntoFolder={onDropIntoFolder}
                dragOverPath={dragOverPath}
                setDragOverPath={setDragOverPath}
                onDeleteFolder={handleDeleteItem}
              />
            )}
          </aside>

          <main
            className="relative rounded-xl border border-border bg-card p-4 min-h-[460px] overflow-y-auto"
            style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const droppedFiles = extractDroppedFiles(event);
              if (droppedFiles.length > 0) {
                handleUploadFiles(droppedFiles);
              }
            }}
          >
            {activeTab === "explorer" ? (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.path || "root"}>
                      <button
                        className="rounded px-2 py-1 hover:bg-muted"
                        onClick={() => fetchItems(crumb.path)}
                      >
                        {crumb.label}
                      </button>
                      {index < breadcrumbs.length - 1 && <span className="text-muted-foreground">/</span>}
                    </React.Fragment>
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
                </div>

                <div className="mb-4 text-xs text-muted-foreground">
                  {visibleItems.length} item(ns)
                  {searchTerm.trim() ? ` para "${searchTerm.trim()}"` : ""}
                </div>

                {loadingItems ? (
                  <p className="text-sm text-muted-foreground">A carregar itens...</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Esta pasta está vazia.</p>
                ) : visibleItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem resultados para a pesquisa atual.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                    {visibleItems.map((item) => {
                      const Icon = itemIcon(item);
                      const isSelected = selectedItem?.path === item.path;
                      const isDropTarget = dragOverPath === item.path && item.type === "folder";
                      const contextOptions = [
                        {
                          label: item.type === "folder" ? "Abrir pasta" : "Selecionar ficheiro",
                          value: "open",
                        },
                        ...(item.type === "file" ? [{ label: "Ver referências", value: "references" }] : []),
                        { label: "Eliminar", value: "delete" },
                      ];

                      return (
                        <ContextMenuWrapper
                          key={item.path}
                          options={contextOptions}
                          onSelect={(action) => handleItemContextAction(action, item)}
                        >
                          <div
                            className="relative"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData("text/plain", item.path);
                            }}
                            onDragEnd={() => {
                              setDragOverPath(null);
                            }}
                            onDragOver={(event) => {
                              if (item.type === "folder") {
                                event.preventDefault();
                                setDragOverPath(item.path);
                              }
                            }}
                            onDragLeave={() => setDragOverPath(null)}
                            onDrop={(event) => {
                              if (item.type === "folder") {
                                onDropIntoFolder(event, item.path);
                              }
                            }}
                            onClick={() => onItemClick(item)}
                            onDoubleClick={() => onItemDoubleClick(item)}
                            className={`group rounded-xl border p-3 cursor-pointer transition ${isSelected ? "border-foreground bg-muted" : "border-border hover:border-foreground/40"} ${isDropTarget ? "ring-2 ring-foreground/25" : ""}`}
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div className="inline-flex items-center gap-2 min-w-0">
                                <Icon className="h-5 w-5 shrink-0" />
                                <span className="truncate text-sm font-medium">{item.name}</span>
                              </div>

                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteItem(item);
                                }}
                                className="opacity-0 group-hover:opacity-100 inline-flex items-center rounded p-1 hover:bg-muted-foreground/10"
                                title="Eliminar item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            <div className="space-y-1 text-xs text-muted-foreground">
                              {item.type === "folder" ? (
                                <div>Pasta</div>
                              ) : (
                                <div>Extensão: {getExtensionLabel(item)}</div>
                              )}
                              {item.type === "file" && <div>Tamanho: {formatBytes(item.size)}</div>}
                              <div>Atualizado: {toLabelDate(item.modifiedAt)}</div>
                            </div>
                          </div>
                        </ContextMenuWrapper>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-3">
                  <h2 className="text-base font-semibold">Referências do ficheiro</h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem?.path || "Selecione um ficheiro para visualizar onde está a ser utilizado."}
                  </p>
                </div>

                {selectedItem?.type === "file" && selectedItemPreviewUrl && IMAGE_EXTENSIONS.includes((selectedItem.extension || "").toLowerCase()) && (
                  <div className="mb-4 rounded-lg border border-border p-3 bg-background">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                    <img
                      src={selectedItemPreviewUrl}
                      alt={selectedItem.name}
                      className="max-h-64 w-auto rounded-md border border-border object-contain"
                    />
                  </div>
                )}

                {selectedItem?.type === "file" && selectedItemPreviewUrl && VIDEO_EXTENSIONS.includes((selectedItem.extension || "").toLowerCase()) && (
                  <div className="mb-4 rounded-lg border border-border p-3 bg-background">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                    <video
                      src={selectedItemPreviewUrl}
                      controls
                      className="max-h-64 w-full rounded-md border border-border"
                    />
                  </div>
                )}

                {selectedItem?.type === "file" && selectedItemPreviewUrl && AUDIO_EXTENSIONS.includes((selectedItem.extension || "").toLowerCase()) && (
                  <div className="mb-4 rounded-lg border border-border p-3 bg-background">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                    <audio src={selectedItemPreviewUrl} controls className="w-full" />
                  </div>
                )}

                {!selectedItem || selectedItem.type !== "file" ? (
                  <p className="text-sm text-muted-foreground">Selecione um ficheiro no explorer.</p>
                ) : loadingRefs ? (
                  <p className="text-sm text-muted-foreground">A carregar referências...</p>
                ) : references.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Este ficheiro ainda não está referenciado na base de dados nem no código da aplicação.</p>
                ) : (
                  <div className="space-y-2">
                    {references.map((ref) => (
                      <div key={`${ref.type}-${ref.id}-${ref.details}`} className="rounded-lg border border-border p-3">
                        <div className="text-sm font-medium">{ref.label}</div>
                        <div className="text-xs text-muted-foreground">Tipo: {ref.type}</div>
                        <div className="mt-1 text-xs break-all">{ref.details}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function FolderTree({ node, currentPath, onOpen, onDropIntoFolder, dragOverPath, setDragOverPath, depth = 0, onDeleteFolder }) {
  if (!node) return null;

  const isCurrent = currentPath === node.path;
  const isOver = dragOverPath === node.path;
  const treeOptions = [
    { label: "Abrir pasta", value: "open" },
    ...(node.path ? [{ label: "Eliminar pasta", value: "delete" }] : []),
  ];

  return (
    <div>
      <ContextMenuWrapper
        options={treeOptions}
        onSelect={(action) => {
          if (action === "open") onOpen(node.path);
          if (action === "delete" && node.path && onDeleteFolder) {
            onDeleteFolder({ name: node.name, path: node.path, type: "folder" });
          }
        }}
      >
        <div
          style={{ paddingLeft: `${depth * 12}px` }}
          className={`relative mb-1 flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer ${isCurrent ? "bg-muted font-medium" : "hover:bg-muted/60"} ${isOver ? "ring-2 ring-foreground/25" : ""}`}
          onClick={() => onOpen(node.path)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverPath(node.path);
          }}
          onDragLeave={() => setDragOverPath(null)}
          onDrop={(event) => onDropIntoFolder(event, node.path)}
        >
          {isOver && (
            <div className="pointer-events-none absolute inset-0 rounded bg-foreground/10 border border-dashed border-foreground/40" />
          )}
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
      </ContextMenuWrapper>

      {Array.isArray(node.children) && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              currentPath={currentPath}
              onOpen={onOpen}
              onDropIntoFolder={onDropIntoFolder}
              dragOverPath={dragOverPath}
              setDragOverPath={setDragOverPath}
              depth={depth + 1}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}
