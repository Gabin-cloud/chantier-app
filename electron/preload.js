const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("chantierDesktop", {
  isDesktop: true,
  platform: process.platform,
});
