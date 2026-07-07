const { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, safeStorage } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow = null;
let tray = null;

function appRoot() {
  return path.join(__dirname, "..");
}

function secretsFile() {
  return path.join(app.getPath("userData"), "workbuddy-secrets.json");
}

function readSecrets() {
  try {
    return JSON.parse(fs.readFileSync(secretsFile(), "utf8"));
  } catch {
    return {};
  }
}

function writeSecrets(secrets) {
  const file = secretsFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(secrets, null, 2), "utf8");
}

function encodeSecret(value) {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      encrypted: true,
      value: safeStorage.encryptString(value).toString("base64"),
    };
  }

  return { encrypted: false, value };
}

function decodeSecret(entry) {
  if (!entry) return "";
  if (!entry.encrypted) return String(entry.value ?? "");

  try {
    return safeStorage.decryptString(Buffer.from(String(entry.value), "base64"));
  } catch {
    return "";
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 680,
    minWidth: 360,
    minHeight: 520,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    center: true,
    title: "WorkBuddy",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (process.env.WORKBUDDY_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.WORKBUDDY_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(appRoot(), "dist", "index.html"));
  }
}

function emitToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function registerShortcut(name, accelerator) {
  try {
    globalShortcut.unregister(accelerator);
    globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        mainWindow.show();
        emitToRenderer("workbuddy:shortcut", name);
      }
    });
    return true;
  } catch {
    return false;
  }
}

function registerDefaultShortcuts() {
  registerShortcut("toggleChat", "CommandOrControl+Alt+W");
  registerShortcut("hidePet", "CommandOrControl+Alt+H");
  registerShortcut("centerPet", "CommandOrControl+Alt+B");
  registerShortcut("quickAsk", "CommandOrControl+Alt+Space");
}

function createTray() {
  const iconPath = path.join(appRoot(), "dist", "pet-packs", "kenney-cat", "preview.png");
  tray = new Tray(iconPath);
  const menu = Menu.buildFromTemplate([
    {
      label: "Open Chat",
      click: () => {
        mainWindow?.show();
        emitToRenderer("workbuddy:tray", "showChat");
      },
    },
    {
      label: "Open Settings",
      click: () => {
        mainWindow?.show();
        emitToRenderer("workbuddy:tray", "showSettings");
      },
    },
    {
      label: "Hide / Show Pet",
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
      },
    },
    { type: "separator" },
    {
      label: "Quit WorkBuddy",
      click: () => app.quit(),
    },
  ]);
  tray.setToolTip("WorkBuddy");
  tray.setContextMenu(menu);
  tray.on("double-click", () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerDefaultShortcuts();

  ipcMain.handle("workbuddy:hide", () => mainWindow?.hide());
  ipcMain.handle("workbuddy:show", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
  ipcMain.handle("workbuddy:center", () => {
    mainWindow?.center();
    mainWindow?.show();
    mainWindow?.focus();
  });
  ipcMain.handle("workbuddy:register-shortcut", (_event, name, accelerator) =>
    registerShortcut(name, accelerator.replace("Ctrl+", "CommandOrControl+")),
  );
  ipcMain.handle("workbuddy:unregister-shortcut", (_event, accelerator) =>
    globalShortcut.unregister(accelerator.replace("Ctrl+", "CommandOrControl+")),
  );
  ipcMain.handle("workbuddy:get-api-key", (_event, provider) => {
    const secrets = readSecrets();
    return decodeSecret(secrets[String(provider)]);
  });
  ipcMain.handle("workbuddy:set-api-key", (_event, provider, apiKey) => {
    const secrets = readSecrets();
    secrets[String(provider)] = encodeSecret(String(apiKey));
    writeSecrets(secrets);
  });
  ipcMain.handle("workbuddy:delete-api-key", (_event, provider) => {
    const secrets = readSecrets();
    delete secrets[String(provider)];
    writeSecrets(secrets);
  });
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
  mainWindow?.hide();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
  mainWindow?.show();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
