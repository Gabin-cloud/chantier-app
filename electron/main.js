const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const DEV_URL = "http://localhost:3000/pc";
const PROD_PORT = 3847;

let mainWindow = null;
let serverProcess = null;
const isDev = !app.isPackaged;

function waitForServer(url, maxAttempts = 120) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      const req = http.get(url, (res) => {
        clearInterval(interval);
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error(`Serveur indisponible : ${url}`));
        }
      });
      req.end();
    }, 500);
  });
}

function startProdServer() {
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverPath = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverPath)) {
    throw new Error(`Serveur introuvable : ${serverPath}`);
  }

  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(PROD_PORT),
      HOSTNAME: "127.0.0.1",
    },
    stdio: "inherit",
  });

  serverProcess.on("error", console.error);
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Chantier App — Bureau",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    if (isDev) {
      await waitForServer(DEV_URL);
      createWindow(DEV_URL);
    } else {
      startProdServer();
      await waitForServer(`http://127.0.0.1:${PROD_PORT}/`);
      createWindow(`http://127.0.0.1:${PROD_PORT}/pc`);
    }
  } catch (error) {
    console.error(error);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null && isDev) {
    createWindow(DEV_URL);
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
