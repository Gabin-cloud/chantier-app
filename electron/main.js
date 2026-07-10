const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const PROD_URL =
  process.env.CHANTIER_APP_URL ?? "https://chantier-app-gab31.vercel.app/pc";
const DEV_URL = process.env.CHANTIER_APP_DEV_URL ?? "http://localhost:3000/pc";

let mainWindow = null;

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

app.whenReady().then(() => {
  const url = app.isPackaged ? PROD_URL : DEV_URL;
  createWindow(url);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    const url = app.isPackaged ? PROD_URL : DEV_URL;
    createWindow(url);
  }
});
