import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from './icon.png?asset'
import { spawn, ChildProcess } from 'child_process'

// Global reference to the Express server process
let serverProcess: ChildProcess | null = null
let browserProcess: ChildProcess | null = null

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Start the Express server
function startServer(): void {
  // In development, use src/server, in production use out/server
  const serverPath = join(__dirname, '../server/start.js')
    
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, NODE_ENV: is.dev ? 'development' : 'production' }
  })

  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server stdout: ${data}`)
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server stderr: ${data}`)
  })

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`)
  })
}

// Launch the custom fingerprint browser
function launchCustomBrowser(url: string): void {
  const browserPath = join(app.getAppPath(), '../resources/fingerprint_browser/itBrowser.exe')
  browserProcess = spawn(browserPath, [url], {
    cwd: join(app.getAppPath(), '../resources/fingerprint_browser')
  })

  browserProcess.stdout?.on('data', (data) => {
    console.log(`Browser stdout: ${data}`)
  })

  browserProcess.stderr?.on('data', (data) => {
    console.error(`Browser stderr: ${data}`)
  })

  browserProcess.on('close', (code) => {
    console.log(`Browser process exited with code ${code}`)
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC handlers
  ipcMain.on('ping', () => console.log('pong'))
  
  // Start server IPC handler
  ipcMain.handle('start-server', async () => {
    try {
      startServer()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Launch browser IPC handler
  ipcMain.handle('launch-browser', async (_, url: string) => {
    try {
      launchCustomBrowser(url)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Start the server when the app starts
  startServer()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Kill server process if it's running
  if (serverProcess) {
    serverProcess.kill()
  }
  
  // Kill browser process if it's running
  if (browserProcess) {
    browserProcess.kill()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
