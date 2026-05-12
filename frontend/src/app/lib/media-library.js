const API = process.env.NEXT_PUBLIC_API_URL || "";

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("authToken") || "";
}

export function getAuthHeaders() {
  const token = getAuthToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (!token) {
    console.warn("⚠️ Sem token de autenticação!");
  }
  console.log("🔑 getAuthHeaders:", { hasToken: !!token, tokenLength: token?.length, headers });
  return headers;
}

export function getMediaApiUrl(path = "") {
  return `${API}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function relativePathFromUploadsUrl(value) {
  if (!value || typeof value !== "string") return "";

  const normalized = value.replace(/\\/g, "/");
  const withoutQuery = normalized.split("?")[0].split("#")[0];
  const match = withoutQuery.match(/\/uploads\/(.+)$/);
  if (match?.[1]) {
    return decodeURIComponent(match[1].replace(/^\/+/, ""));
  }

  if (withoutQuery.startsWith("uploads/")) {
    return decodeURIComponent(withoutQuery.slice("uploads/".length));
  }

  return "";
}

export function resolveUploadsUrl(relativePath) {
  if (!relativePath) return null;
  const safePath = relativePath.replace(/^\/+/, "");
  return getMediaApiUrl(`/uploads/${safePath}`);
}

export function createLibrarySelection(relativePath) {
  const safePath = relativePathFromUploadsUrl(relativePath) || String(relativePath || "").replace(/^\/+/, "");
  if (!safePath) return null;

  return {
    source: "library",
    path: safePath,
    name: safePath.split("/").pop() || safePath,
    url: resolveUploadsUrl(safePath),
  };
}

export async function fetchMediaDirectory(relativePath = "") {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(getMediaApiUrl("/media/list"), baseUrl);
  if (relativePath) {
    url.searchParams.set("path", relativePath);
  }

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Erro ao carregar ficheiros do File Manager.");
  }

  return payload;
}

export async function fetchMediaTree() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(getMediaApiUrl("/media/tree"), baseUrl);

  const response = await fetch(url.toString(), {
    headers: getAuthHeaders(),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Erro ao carregar a estrutura do File Manager.");
  }

  return payload.tree || null;
}

export async function uploadFileToMediaLibrary(file, destinationPath = "") {
  const formData = new FormData();
  formData.append("destinationPath", destinationPath);
  formData.append("files", file);

  const response = await fetch(getMediaApiUrl("/media/upload"), {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  
  if (!response.ok || !payload?.success || !payload.files?.[0]) {
    const errorMsg = payload?.message || "Erro ao enviar ficheiro para o File Manager.";
    throw new Error(errorMsg);
  }

  const uploaded = payload.files[0];
  return {
    path: uploaded.path,
    name: uploaded.name || uploaded.originalName,
    originalName: uploaded.originalName,
    url: resolveUploadsUrl(uploaded.path),
    mimeType: uploaded.mimeType || file.type,
  };
}

export async function resolveMediaSelection(selection, destinationPath = "") {
  if (!selection) return null;

  if (selection.source === "library" && selection.path) {
    return {
      path: selection.path,
      name: selection.name || selection.path.split("/").pop() || selection.path,
      url: selection.url || resolveUploadsUrl(selection.path),
      mimeType: selection.mimeType || "",
    };
  }

  if (selection.source === "device" && selection.file) {
    return uploadFileToMediaLibrary(selection.file, destinationPath);
  }

  return null;
}

export async function fetchMediaFileAsFile(relativePath, fileName) {
  const response = await fetch(resolveUploadsUrl(relativePath));
  if (!response.ok) {
    throw new Error("Erro ao obter ficheiro do File Manager.");
  }

  const blob = await response.blob();
  return new File([blob], fileName || relativePath.split("/").pop() || "asset", {
    type: blob.type || undefined,
  });
}

export function fileMatchesAccept(fileName, accept = "") {
  if (!accept) return true;

  const tokens = accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (!tokens.length) return true;

  const lowerName = String(fileName || "").toLowerCase();
  const extension = lowerName.includes(".") ? `.${lowerName.split(".").pop()}` : "";

  return tokens.some((token) => {
    if (token === "*/*") return true;
    if (token.endsWith("/*")) {
      const family = token.slice(0, -2);
      if (family === "image") return [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".hdr", ".exr"].includes(extension);
      if (family === "video") return [".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(extension);
      if (family === "audio") return [".mp3", ".wav", ".ogg", ".aac"].includes(extension);
      return false;
    }

    if (token.startsWith(".")) {
      return extension === token;
    }

    return lowerName.endsWith(token.replace(/^[^/]+\//, "."));
  });
}

export function inferPreviewKind(fileName = "", accept = "") {
  const lowerName = String(fileName).toLowerCase();
  if (accept.includes("image/") || /\.(png|jpe?g|gif|svg|webp|bmp|hdr|exr)$/.test(lowerName)) return "image";
  if (accept.includes("video/") || /\.(mp4|webm|mov|avi|mkv)$/.test(lowerName)) return "video";
  if (accept.includes("audio/") || /\.(mp3|wav|ogg|aac)$/.test(lowerName)) return "audio";
  return "file";
}