import {
  getSharePointDriveName,
  getSharePointSiteUrl,
  isSharePointConfigured,
} from "@/lib/microsoft/config";
import { fetchApplicationAccessToken } from "@/lib/microsoft/oauth";

type GraphSite = { id: string; name: string; webUrl: string };
type GraphDrive = { id: string; name: string; webUrl: string };
type GraphDriveItem = {
  id: string;
  name: string;
  webUrl: string;
  parentReference?: { path?: string };
};

let cachedSiteId: string | null = null;
let cachedDriveId: string | null = null;

function parseSharePointSite() {
  const siteUrl = getSharePointSiteUrl();
  if (!siteUrl) {
    throw new Error("SHAREPOINT_SITE_URL n'est pas configuré.");
  }

  const url = new URL(siteUrl);
  return {
    hostname: url.hostname,
    sitePath: url.pathname.replace(/\/$/, ""),
  };
}

async function graphFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const accessToken = await fetchApplicationAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SharePoint Graph (${response.status}) : ${detail}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getSharePointSiteId(): Promise<string> {
  if (cachedSiteId) return cachedSiteId;

  const { hostname, sitePath } = parseSharePointSite();
  const site = await graphFetch<GraphSite>(
    `/sites/${hostname}:${sitePath}`
  );
  cachedSiteId = site.id;
  return site.id;
}

export async function getSharePointDriveId(): Promise<string> {
  if (cachedDriveId) return cachedDriveId;

  const siteId = await getSharePointSiteId();
  const driveName = getSharePointDriveName();
  const { value } = await graphFetch<{ value: GraphDrive[] }>(
    `/sites/${siteId}/drives`
  );

  const drive = value.find(
    (item) => item.name.toLowerCase() === driveName.toLowerCase()
  );

  if (!drive) {
    const available = value.map((item) => item.name).join(", ");
    throw new Error(
      `Bibliothèque « ${driveName} » introuvable. Disponibles : ${available}`
    );
  }

  cachedDriveId = drive.id;
  return drive.id;
}

/** Normalise un chemin relatif dans la bibliothèque (sans slash initial). */
export function normalizeSharePointPath(...segments: string[]): string {
  return segments
    .flatMap((segment) => segment.split("/"))
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

/** Extrait un chemin relatif si l'utilisateur a collé une URL SharePoint. */
export function cleanSharePointRelativePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split("/").filter(Boolean);
      const driveName = getSharePointDriveName().toLowerCase();
      const driveIndex = parts.findIndex(
        (part) => part.toLowerCase() === driveName
      );
      if (driveIndex >= 0) {
        return normalizeSharePointPath(...parts.slice(driveIndex + 1));
      }
      return normalizeSharePointPath(...parts);
    } catch {
      return normalizeSharePointPath(trimmed);
    }
  }

  return normalizeSharePointPath(trimmed.replace(/^\/+/, ""));
}

export function sanitizeSharePointFolderName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function sanitizeSharePointFileName(name: string): string {
  const trimmed = name.trim();
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot) : "";

  const safeBase = base
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return `${safeBase || "document"}${ext.toLowerCase()}`;
}

/** Nom de dossier entreprise : personnalisé ou dérivé du lot. */
export function buildEnterpriseFolderName(input: {
  name: string;
  lot_number: string | null;
  designation: string | null;
  sharepoint_folder_name: string | null;
}): string {
  if (input.sharepoint_folder_name?.trim()) {
    return sanitizeSharePointFolderName(input.sharepoint_folder_name.trim());
  }
  if (input.lot_number && input.designation) {
    return sanitizeSharePointFolderName(
      `Lot ${input.lot_number} - ${input.designation}`
    );
  }
  if (input.lot_number) {
    return sanitizeSharePointFolderName(`Lot ${input.lot_number}`);
  }
  return sanitizeSharePointFolderName(input.name);
}

/** Nom de fichier avec préfixe date pour éviter les collisions. */
export function buildPlanExeFileName(originalName: string): string {
  const datePrefix = new Date().toISOString().slice(0, 10);
  const safeName = sanitizeSharePointFileName(originalName);
  return `${datePrefix}_${safeName}`;
}

function encodeDrivePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function getDriveItemByPath(
  driveId: string,
  itemPath: string
): Promise<GraphDriveItem | null> {
  try {
    return await graphFetch<GraphDriveItem>(
      `/drives/${driveId}/root:/${encodeDrivePath(itemPath)}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("(404)")) return null;
    throw error;
  }
}

async function createFolder(
  driveId: string,
  parentPath: string,
  folderName: string
): Promise<GraphDriveItem> {
  const parentSegment =
    parentPath.length > 0
      ? `/root:/${encodeDrivePath(parentPath)}:/children`
      : "/root/children";

  return graphFetch<GraphDriveItem>(`/drives/${driveId}${parentSegment}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      "@microsoft.graph.conflictBehavior": "fail",
    }),
  });
}

/** Crée récursivement les dossiers manquants le long du chemin. */
export async function ensureSharePointFolderPath(
  folderPath: string
): Promise<void> {
  if (!folderPath) return;

  const driveId = await getSharePointDriveId();
  const segments = cleanSharePointRelativePath(folderPath).split("/").filter(Boolean);
  let currentPath = "";

  for (const segment of segments) {
    const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = await getDriveItemByPath(driveId, nextPath);

    if (!existing) {
      await createFolder(driveId, currentPath, segment);
    }

    currentPath = nextPath;
  }
}

export type SharePointUploadResult = {
  itemId: string;
  webUrl: string;
  fileName: string;
  folderPath: string;
  relativePath: string;
};

export async function uploadToSharePoint(input: {
  folderPath: string;
  fileName: string;
  content: Buffer;
  contentType: string;
}): Promise<SharePointUploadResult> {
  if (!isSharePointConfigured()) {
    throw new Error(
      "SharePoint n'est pas configuré (Azure + SHAREPOINT_SITE_URL)."
    );
  }

  const driveId = await getSharePointDriveId();
  const folderPath = cleanSharePointRelativePath(input.folderPath);
  const fileName = sanitizeSharePointFileName(input.fileName);

  await ensureSharePointFolderPath(folderPath);

  const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;

  const item = await graphFetch<GraphDriveItem>(
    `/drives/${driveId}/root:/${encodeDrivePath(relativePath)}:/content`,
    {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType || "application/octet-stream",
      },
      body: new Uint8Array(input.content),
    }
  );

  return {
    itemId: item.id,
    webUrl: item.webUrl,
    fileName,
    folderPath,
    relativePath,
  };
}

export type SharePointConnectionStatus = {
  ok: boolean;
  siteUrl: string;
  driveName: string;
  driveWebUrl?: string;
  error?: string;
};

export async function testSharePointConnection(): Promise<SharePointConnectionStatus> {
  const siteUrl = getSharePointSiteUrl();
  const driveName = getSharePointDriveName();

  if (!isSharePointConfigured()) {
    return {
      ok: false,
      siteUrl,
      driveName,
      error: "Configuration SharePoint incomplète.",
    };
  }

  try {
    const driveId = await getSharePointDriveId();
    const drive = await graphFetch<GraphDrive>(`/drives/${driveId}`);
    return {
      ok: true,
      siteUrl,
      driveName,
      driveWebUrl: drive.webUrl,
    };
  } catch (error) {
    return {
      ok: false,
      siteUrl,
      driveName,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

export async function listSharePointFolder(
  folderPath: string
): Promise<{ name: string; webUrl: string; isFolder: boolean }[]> {
  const driveId = await getSharePointDriveId();
  const normalized = cleanSharePointRelativePath(folderPath);

  const segment =
    normalized.length > 0
      ? `/root:/${encodeDrivePath(normalized)}:/children`
      : "/root/children";

  const { value } = await graphFetch<{
    value: { name: string; webUrl: string; folder?: unknown }[];
  }>(`/drives/${driveId}${segment}`);

  return (value ?? []).map((item) => ({
    name: item.name,
    webUrl: item.webUrl,
    isFolder: Boolean(item.folder),
  }));
}

export type SharePointFolderListing = {
  ok: boolean;
  currentPath: string;
  driveName: string;
  items: { name: string; webUrl: string; isFolder: boolean }[];
  error?: string;
};

export async function listSharePointFolderSafe(
  folderPath: string
): Promise<SharePointFolderListing> {
  const driveName = getSharePointDriveName();
  const currentPath = cleanSharePointRelativePath(folderPath);

  if (!isSharePointConfigured()) {
    return {
      ok: false,
      currentPath,
      driveName,
      items: [],
      error: "SharePoint n'est pas configuré (Azure + SHAREPOINT_SITE_URL).",
    };
  }

  try {
    const items = await listSharePointFolder(currentPath);
    return { ok: true, currentPath, driveName, items };
  } catch (error) {
    return {
      ok: false,
      currentPath,
      driveName,
      items: [],
      error:
        error instanceof Error
          ? error.message
          : "Impossible de lire ce dossier SharePoint.",
    };
  }
}
