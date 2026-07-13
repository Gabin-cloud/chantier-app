import {
  getSharePointDriveName,
  getSharePointSiteUrl,
  isSharePointConfigured,
} from "@/lib/microsoft/config";
import { getValidUserAccessToken } from "@/lib/microsoft/m365-store";
import { MicrosoftConsentRequiredError } from "@/lib/microsoft/errors";
import { fetchApplicationAccessToken } from "@/lib/microsoft/oauth";

export type SharePointAuthContext = {
  userId?: string;
};

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

function formatGraphError(status: number, detail: string): string {
  if (status === 403) {
    return (
      "Accès SharePoint refusé. Connectez votre compte Microsoft 365 dans Profil " +
      "(puis reconnectez-le pour valider les nouvelles autorisations). " +
      "Si le problème persiste, l'admin Azure doit accorder Sites.ReadWrite.All à l'application."
    );
  }
  if (status === 404) {
    return "Dossier SharePoint introuvable. Vérifiez le chemin ou utilisez « Parcourir SharePoint ».";
  }
  return `SharePoint Graph (${status}) : ${detail}`;
}

async function resolveGraphAccessToken(
  context?: SharePointAuthContext
): Promise<string> {
  if (context?.userId) {
    try {
      const userToken = await getValidUserAccessToken(context.userId);
      if (userToken) return userToken;
    } catch (error) {
      if (error instanceof MicrosoftConsentRequiredError) {
        throw error;
      }
    }
    throw new Error(
      "Compte Microsoft 365 non connecté. Allez dans Profil → Connecter Microsoft 365."
    );
  }

  return fetchApplicationAccessToken();
}

async function graphFetch<T>(
  path: string,
  init?: RequestInit,
  context?: SharePointAuthContext
): Promise<T> {
  const accessToken = await resolveGraphAccessToken(context);
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(formatGraphError(response.status, detail));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getSharePointSiteId(
  context?: SharePointAuthContext
): Promise<string> {
  if (!context?.userId && cachedSiteId) return cachedSiteId;

  const { hostname, sitePath } = parseSharePointSite();
  const site = await graphFetch<GraphSite>(
    `/sites/${hostname}:${sitePath}`,
    undefined,
    context
  );
  if (!context?.userId) cachedSiteId = site.id;
  return site.id;
}

export async function listSharePointDrives(
  context?: SharePointAuthContext
): Promise<GraphDrive[]> {
  const siteId = await getSharePointSiteId(context);
  const { value } = await graphFetch<{ value: GraphDrive[] }>(
    `/sites/${siteId}/drives`,
    undefined,
    context
  );
  return value ?? [];
}

export async function getSharePointDriveId(
  context?: SharePointAuthContext
): Promise<string> {
  if (!context?.userId && cachedDriveId) return cachedDriveId;

  const siteId = await getSharePointSiteId(context);
  const driveName = getSharePointDriveName();
  const { value } = await graphFetch<{ value: GraphDrive[] }>(
    `/sites/${siteId}/drives`,
    undefined,
    context
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

  if (!context?.userId) cachedDriveId = drive.id;
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

  if (trimmed.startsWith("\\\\") || trimmed.startsWith("\\")) {
    const parts = trimmed.replace(/^\\+/, "").split("\\").filter(Boolean);
    const driveName = getSharePointDriveName().toLowerCase();
    if (parts[0]?.toLowerCase() === driveName) {
      return normalizeSharePointPath(...parts.slice(1));
    }
    if (
      parts[0]?.toLowerCase().includes("serveur") ||
      parts[0]?.toLowerCase().includes("danobat")
    ) {
      return normalizeSharePointPath(...parts.slice(1));
    }
    return normalizeSharePointPath(...parts);
  }

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
  itemPath: string,
  context?: SharePointAuthContext
): Promise<GraphDriveItem | null> {
  try {
    return await graphFetch<GraphDriveItem>(
      `/drives/${driveId}/root:/${encodeDrivePath(itemPath)}`,
      undefined,
      context
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("introuvable") || message.includes("(404)")) return null;
    throw error;
  }
}

async function createFolder(
  driveId: string,
  parentPath: string,
  folderName: string,
  context?: SharePointAuthContext
): Promise<GraphDriveItem> {
  const parentSegment =
    parentPath.length > 0
      ? `/root:/${encodeDrivePath(parentPath)}:/children`
      : "/root/children";

  return graphFetch<GraphDriveItem>(
    `/drives/${driveId}${parentSegment}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    },
    context
  );
}

/** Crée récursivement les dossiers manquants le long du chemin. */
export async function ensureSharePointFolderPath(
  folderPath: string,
  context?: SharePointAuthContext
): Promise<void> {
  if (!folderPath) return;

  const driveId = await getSharePointDriveId(context);
  const segments = cleanSharePointRelativePath(folderPath).split("/").filter(Boolean);
  let currentPath = "";

  for (const segment of segments) {
    const nextPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = await getDriveItemByPath(driveId, nextPath, context);

    if (!existing) {
      await createFolder(driveId, currentPath, segment, context);
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
  userId?: string;
}): Promise<SharePointUploadResult> {
  if (!isSharePointConfigured()) {
    throw new Error(
      "SharePoint n'est pas configuré (Azure + SHAREPOINT_SITE_URL)."
    );
  }

  const context: SharePointAuthContext = { userId: input.userId };
  const driveId = await getSharePointDriveId(context);
  const folderPath = cleanSharePointRelativePath(input.folderPath);
  const fileName = sanitizeSharePointFileName(input.fileName);

  await ensureSharePointFolderPath(folderPath, context);

  const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;

  const item = await graphFetch<GraphDriveItem>(
    `/drives/${driveId}/root:/${encodeDrivePath(relativePath)}:/content`,
    {
      method: "PUT",
      headers: {
        "Content-Type": input.contentType || "application/octet-stream",
      },
      body: new Uint8Array(input.content),
    },
    context
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
  availableDrives?: string[];
  error?: string;
};

export async function testSharePointConnection(
  userId?: string
): Promise<SharePointConnectionStatus> {
  const siteUrl = getSharePointSiteUrl();
  const driveName = getSharePointDriveName();
  const context: SharePointAuthContext = { userId };

  if (!isSharePointConfigured()) {
    return {
      ok: false,
      siteUrl,
      driveName,
      error: "Configuration SharePoint incomplète.",
    };
  }

  try {
    const driveId = await getSharePointDriveId(context);
    const drive = await graphFetch<GraphDrive>(
      `/drives/${driveId}`,
      undefined,
      context
    );
    return {
      ok: true,
      siteUrl,
      driveName,
      driveWebUrl: drive.webUrl,
    };
  } catch (error) {
    let availableDrives: string[] | undefined;
    try {
      const drives = await listSharePointDrives(context);
      availableDrives = drives.map((drive) => drive.name);
    } catch {
      availableDrives = undefined;
    }

    return {
      ok: false,
      siteUrl,
      driveName,
      availableDrives,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

export async function listSharePointFolder(
  folderPath: string,
  context?: SharePointAuthContext
): Promise<{ name: string; webUrl: string; isFolder: boolean }[]> {
  const driveId = await getSharePointDriveId(context);
  const normalized = cleanSharePointRelativePath(folderPath);

  const segment =
    normalized.length > 0
      ? `/root:/${encodeDrivePath(normalized)}:/children`
      : "/root/children";

  const { value } = await graphFetch<{
    value: { name: string; webUrl: string; folder?: unknown }[];
  }>(`/drives/${driveId}${segment}`, undefined, context);

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
  folderPath: string,
  userId?: string
): Promise<SharePointFolderListing> {
  const driveName = getSharePointDriveName();
  const currentPath = cleanSharePointRelativePath(folderPath);
  const context: SharePointAuthContext = { userId };

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
    const items = await listSharePointFolder(currentPath, context);
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
