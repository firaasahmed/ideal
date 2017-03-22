const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

const dbManager = require("./database.js");

const gotTheLock = app.requestSingleInstanceLock();
let mainWindow;

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
  app.commandLine.appendSwitch("disable-gpu-compositing");
  app.commandLine.appendSwitch("disable-gpu-rasterization");
  app.commandLine.appendSwitch("disable-webgl");
  app.disableHardwareAcceleration();

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 600,
      frame: false,
      icon: path.join(__dirname, 'build', 'icon.ico'), 
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    mainWindow.loadFile(path.join(__dirname, "src", "index.html"));


    mainWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
        mainWindow.webContents.setZoomFactor(0.65);
    });


    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.setZoomFactor(0.65);
    });



    let preMaximizedBounds = mainWindow.getBounds();
    let isCustomMaximized = false;

    const toggleCustomMaximize = () => {
      if (isCustomMaximized) {
        mainWindow.setBounds(preMaximizedBounds);
        isCustomMaximized = false;
      } else {
        preMaximizedBounds = mainWindow.getBounds();
        const currentDisplay = screen.getDisplayMatching(preMaximizedBounds);

        mainWindow.setBounds({
          x: currentDisplay.workArea.x,
          y: currentDisplay.workArea.y,
          width: currentDisplay.workArea.width,
          height: currentDisplay.workArea.height,
        });
        isCustomMaximized = true;
      }
    };

    ipcMain.on("window-maximize", () => {
      toggleCustomMaximize();
    });

    mainWindow.on("maximize", () => {
      mainWindow.unmaximize();
      toggleCustomMaximize();
    });

    ipcMain.on("window-minimize", () => {
      mainWindow.minimize();
    });

    ipcMain.on("window-close", () => {
      mainWindow.close();
    });
  }

  app.on("ready", async () => {
    try {
      await dbManager.initDatabase();
      createWindow();
    } catch (error) {
      console.error(
        "Critical Error: Failed to initialize database on startup",
        error,
      );
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
