import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs-extra'

// Global reference to the Express server process
let serverProcess: ChildProcess | null = null
let browserProcess: ChildProcess | null = null

// Helper function to get platform-appropriate icon
function getPlatformIcon(): string | undefined {
  const iconDir = join(__dirname, '../../build');
  
  if (process.platform === 'win32') {
    // Windows icon
    const iconPath = join(iconDir, 'icon.ico');
    return fs.existsSync(iconPath) ? iconPath : undefined;
  } else if (process.platform === 'darwin') {
    // macOS icon
    const iconPath = join(iconDir, 'icon.icns');
    return fs.existsSync(iconPath) ? iconPath : undefined;
  } else {
    // Linux icon
    const iconPath = join(iconDir, 'icon.png');
    return fs.existsSync(iconPath) ? iconPath : undefined;
  }
}

let mainWindow: BrowserWindow | null = null;

// Handle custom protocol for OAuth callback
if (app.isPackaged) {
  app.setAsDefaultProtocolClient('electron-nyx');
} else {
  // In development, we need to pass the path to the electron executable explicitly
  app.setAsDefaultProtocolClient('electron-nyx', process.execPath, [join(__dirname, '..', '..', 'electron.vite.config.ts')]);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    
    // Handle the URL from the command line (for OAuth redirects)
    const url = commandLine.find(arg => arg.startsWith('electron-nyx://'));
    if (url) {
      handleProtocolUrl(url);
    }
  });
}

// Handle protocol URL when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});

function handleProtocolUrl(url: string) {
  console.log('[MAIN] Received protocol URL:', url);
  try {
    const hash = new URL(url).hash;
    if (!hash) {
      console.log('[MAIN] No hash found in URL, aborting.');
      return;
    }

    const params = new URLSearchParams(hash.substring(1)); // Remove the leading '#'
    const accessToken = params.get('access_token');
    const error = params.get('error');

    const dataToSend: { [key: string]: string | null } = {};

    if (accessToken) {
      console.log('[MAIN] Found access token in URL.');
      params.forEach((value, key) => {
        dataToSend[key] = value;
      });
    } else if (error) {
      console.log('[MAIN] Found error in URL.');
      dataToSend['error'] = error;
      dataToSend['error_description'] = params.get('error_description');
    } else {
      console.log('[MAIN] No access token or error found in URL hash.');
      return; // Nothing to do
    }

    console.log('[MAIN] Preparing to send data to renderer:', dataToSend);

    const sendToRenderer = (window: BrowserWindow) => {
      console.log('[MAIN] Sending "oauth-callback" IPC message to renderer.');
      window.webContents.send('oauth-callback', dataToSend);
    };

    if (mainWindow) {
      sendToRenderer(mainWindow);
    } else {
      console.log('[MAIN] Main window not available, waiting for it to be created.');
      app.on('browser-window-created', (_, window) => {
        sendToRenderer(window);
      });
    }
  } catch (err) {
    console.error('[MAIN] Error handling protocol URL:', err);
  }
}

function handleOAuthCallback(url: string) {
  try {
    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get('code');
    const error = parsedUrl.searchParams.get('error');

    if (mainWindow) {
      if (code) {
        mainWindow.webContents.send('oauth-callback', { code });
      } else if (error) {
        mainWindow.webContents.send('oauth-callback', { error });
      }
    }
  } catch (err) {
    console.error('Error handling OAuth callback:', err);
  }
}

// Load the server controllers and services to handle IPC requests directly
let systemController: any = null;
let campaignController: any = null;
let profilePoolManager: any = null;
let proxyManager: any = null;
let dbCampaignStorageService: any = null;
let dbProfileStorageService: any = null;
let dbProxyStorageService: any = null;
let dbSettingsStorageService: any = null;
let syncService: any = null;

// Initialize server components
async function initializeServerComponents() {
  try {
    // Ensure resources/storage directory exists
    const storagePath = join(app.getPath('userData'), '../..', 'resources', 'storage');
    await fs.ensureDir(storagePath);
    await fs.ensureDir(join(storagePath, 'profiles'));
    await fs.ensureDir(join(storagePath, 'proxies'));
    await fs.ensureDir(join(storagePath, 'logs'));
    
    // Import the controllers and services directly
    const SystemController = require('../server/system/controllers/systemController');
    const CampaignControllerClass = require('../server/domains/campaigns/controllers/campaignController');
    const ProxyManagerClass = require('../server/domains/proxies/services/proxyManager');
    
    // Create instances
    systemController = new SystemController();
    campaignController = new CampaignControllerClass();
    proxyManager = new ProxyManagerClass();
    
    // Access profile pool manager
    profilePoolManager = require('../server/domains/profiles/services/profilePoolManager');
    
    // Initialize the SQLite services
  dbCampaignStorageService = require('../server/sqlite/dbCampaignStorageService');
  dbProfileStorageService = require('../server/sqlite/dbProfileStorageService');
  dbProxyStorageService = require('../server/sqlite/dbProxyStorageService');
  dbSettingsStorageService = require('../server/sqlite/dbSettingsStorageService');
  syncService = require('../server/system/services/syncService');
    
    // Initialize services
    systemController.initialize();
    profilePoolManager.initialize();
    proxyManager.initialize();
    
    // Initialize SQLite services
    dbCampaignStorageService.initialize();
    dbProfileStorageService.initialize();
    dbProxyStorageService.initialize();
    dbSettingsStorageService.initialize();
  } catch (error) {
    console.error('Failed to initialize server components:', error);
  }
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: getPlatformIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
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
async function startServer(): Promise<void> {
  // Ensure resources/storage directory exists before starting server
  const resourcesPath = join(app.getPath('exe'), '../resources'); // Try to find resources relative to executable
  const storagePath = join(resourcesPath, 'storage');
  await fs.ensureDir(storagePath);
  await fs.ensureDir(join(storagePath, 'profiles'));
  await fs.ensureDir(join(storagePath, 'proxies'));
  await fs.ensureDir(join(storagePath, 'logs'));
  
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
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.nyx.app')

  // Register custom protocol handler for authentication callbacks
  protocol.registerHttpProtocol('electron-app', (request, callback) => {
    // Parse the URL and redirect to the auth callback page
    const url = new URL(request.url);
    const hash = url.hash;
    
    // Get the main window
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      // Navigate to the auth callback route with the hash parameters
      mainWindow.loadURL(`http://localhost:5173/callback${hash}`);
    }
  });

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize server components
  await initializeServerComponents();

  // IPC handlers for profiles
  ipcMain.handle('profiles:create', async (_, profileData: any) => {
    try {
      const mockReq = { body: profileData };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await systemController.createProfile(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:getAll', async (_, filters?: any) => {
    try {
      const mockReq = { query: filters || {} };
      const mockRes = {
        json: (data: any) => data
      };
      
      return await systemController.getAllProfiles(mockReq, mockRes);
    } catch (error) {
      console.error('Error getting all profiles:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:getById', async (_, profileId: string) => {
    try {
      const mockReq = { params: { profileId } };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await systemController.getProfile(mockReq, mockRes);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error getting profile by ID:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:update', async (_, profileId: string, updateData: any) => {
    try {
      const mockReq = { params: { profileId }, body: updateData };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await systemController.updateProfile(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:delete', async (_, profileId: string) => {
    try {
      const mockReq = { params: { profileId } };
      const mockRes = {
        json: (data: any) => data
      };
      
      await systemController.deleteProfile(mockReq, mockRes);
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:search', async (_, query: string) => {
    // For now, implement basic search functionality
    try {
      const allProfiles = await systemController.getAllProfiles({ query: {} }, { json: (data: any) => data });
      return allProfiles.filter((profile: any) => 
        profile.name && profile.name.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching profiles:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:getStats', async (_, profileId: string) => {
    try {
      const mockReq = { params: { profileId } };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await systemController.getProfileStats(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error getting profile stats:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:getFingerprint', async (_, profileId: string) => {
    try {
      const mockReq = { params: { profileId } };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await systemController.getProfileFingerprint(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error getting profile fingerprint:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:batchCreate', async (_, batchConfig: any) => {
    try {
      const mockReq = { body: Array.isArray(batchConfig) ? batchConfig : [batchConfig] };
      const mockRes = {
        json: (data: any) => data
      };
      
      return await systemController.createBatchProfiles(mockReq, mockRes);
    } catch (error) {
      console.error('Error creating batch profiles:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:launch', async (_, profileId: string, options?: any) => {
    try {
      const mockReq = { 
        params: { profileId }, 
        query: options || {},
        body: { options: options || {} }
      };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await systemController.launchProfileDirect(mockReq, mockRes);
      return result;
    } catch (error) {
      console.error('Error launching profile:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:setBrowserConfig', async (_, profileId: string, config: any) => {
    try {
      const mockReq = { params: { profileId }, body: config };
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await systemController.setProfileBrowserConfig(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error setting browser config:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:close', async (_, profileId: string) => {
    try {
      const mockReq = { params: { profileId } };
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await systemController.closeProfileBrowser(mockReq, mockRes);
      return result;
    } catch (error) {
      console.error('Error closing profile browser:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:assignProxy', async (_, profileId: string, proxyId: string) => {
    try {
      const mockReq = { params: { profileId }, body: { proxyId } };
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await systemController.assignProxyToProfile(mockReq, mockRes);
      return result;
    } catch (error) {
      console.error('Error assigning proxy to profile:', error);
      throw error;
    }
  });

  ipcMain.handle('profiles:importFromJson', async (_, formData: any) => {
    try {
      const mockReq = { body: formData };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 201
      };
      
      const result = await systemController.importProfile(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error importing profile from JSON:', error);
      throw error;
    }
  });

  // IPC handlers for campaigns
  ipcMain.handle('campaigns:getAll', async () => {
    try {
      const mockReq = {};
      const mockRes = {
        json: (data: any) => data
      };
      
      return await campaignController.getAllCampaigns(mockReq, mockRes);
    } catch (error) {
      console.error('Error getting all campaigns:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:getById', async (_, campaignId: string) => {
    try {
      const mockReq = { params: { campaignId } };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 200
      };
      
      const result = await campaignController.getCampaign(mockReq, mockRes);
      return result.success ? result.data : null;
    } catch (error) {
      console.error('Error getting campaign by ID:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:create', async (_, campaignData: any) => {
    try {
      const mockReq = { body: campaignData };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 201
      };
      
      const result = await campaignController.createCampaign(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:update', async (_, campaignId: string, updateData: any) => {
    try {
      const mockReq = { params: { campaignId }, body: updateData };
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await campaignController.updateCampaign(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:delete', async (_, campaignId: string) => {
    try {
      const mockReq = { params: { campaignId } };
      const mockRes = {
        json: (data: any) => data
      };
      
      await campaignController.deleteCampaign(mockReq, mockRes);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:getStats', async () => {
    try {
      const mockReq = {};
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await campaignController.getCampaignStats(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error getting campaign stats:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:launch', async (_, campaignId: string, options?: any) => {
    try {
      const mockReq = { 
        params: { campaignId }, 
        body: options || {} 
      };
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await campaignController.launchCampaign(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error launching campaign:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:getProgress', async (_, campaignId: string) => {
    try {
      const mockReq = { params: { campaignId } };
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await campaignController.getCampaignProgress(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error getting campaign progress:', error);
      throw error;
    }
  });

  ipcMain.handle('campaigns:export', async (_, campaignIds: string[]) => {
    // For now, we'll just return the campaign IDs since export functionality would need more implementation
    return { success: true, exportedCampaignIds: campaignIds };
  });

  ipcMain.handle('campaigns:import', async (_, data: any) => {
    try {
      const mockReq = { body: data };
      const mockRes = {
        status: (code: number) => {
          mockRes.statusCode = code;
          return mockRes;
        },
        json: (data: any) => data,
        statusCode: 201
      };
      
      const result = await campaignController.importCampaign(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error importing campaign:', error);
      throw error;
    }
  });

  // IPC handlers for proxies
  ipcMain.handle('proxies:getAll', async () => {
    try {
      return await proxyManager.getAllProxies();
    } catch (error) {
      console.error('Error getting all proxies:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:getById', async (_, proxyId: string) => {
    try {
      return await proxyManager.getProxyById(proxyId);
    } catch (error) {
      console.error('Error getting proxy by ID:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:create', async (_, proxyData: any) => {
    try {
      return await proxyManager.createProxy(proxyData);
    } catch (error) {
      console.error('Error creating proxy:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:delete', async (_, proxyId: string) => {
    try {
      const success = await proxyManager.deleteProxy(proxyId);
      if (!success) {
        throw new Error('Proxy not found');
      }
    } catch (error) {
      console.error('Error deleting proxy:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:check', async (_, proxyId: string) => {
    try {
      const proxy = await proxyManager.getProxyById(proxyId);
      if (!proxy) {
        throw new Error('Proxy not found');
      }
      
      const isHealthy = await proxyManager.testProxyHealth(proxy);
      return { id: proxyId, healthy: isHealthy };
    } catch (error) {
      console.error('Error checking proxy:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:assign', async (_, profileId: string) => {
    // For now, this would implement the proxy assignment logic
    try {
      // This is a simplified version - in practice, it would assign a proxy to the profile
      const mockReq = { params: { profileId }, body: {} };
      const mockRes = {
        json: (data: any) => data
      };
      
      return await systemController.assignProxyToProfile(mockReq, mockRes);
    } catch (error) {
      console.error('Error assigning proxy:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:getStats', async () => {
    try {
      return await proxyManager.getStats();
    } catch (error) {
      console.error('Error getting proxy stats:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:batchCreate', async (_, proxies: any[]) => {
    try {
      return await proxyManager.createBatchProxies(proxies);
    } catch (error) {
      console.error('Error creating batch proxies:', error);
      throw error;
    }
  });

  ipcMain.handle('proxies:validate', async (_, proxyData: any) => {
    try {
      const isValid = await proxyManager.testProxyHealth(proxyData);
      const geolocation = isValid ? await proxyManager.fetchGeolocationData(proxyData.host) : null;
      
      return {
        success: isValid,
        message: isValid ? 'Proxy is valid and healthy.' : 'Proxy validation failed. Proxy is unhealthy or unreachable.',
        details: {
          host: proxyData.host,
          port: proxyData.port,
          protocol: proxyData.protocol,
          geolocation
        }
      };
    } catch (error) {
      console.error('Error validating proxy:', error);
      throw error;
    }
  });

  // IPC handlers for system
  ipcMain.handle('system:getStatus', async () => {
    try {
      const mockReq = {};
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await systemController.getSystemStatus(mockReq, mockRes);
      return result.status;
    } catch (error) {
      console.error('Error getting system status:', error);
      throw error;
    }
  });

  ipcMain.handle('system:getStats', async () => {
    try {
      const mockReq = {};
      const mockRes = {
        json: (data: any) => data
      };
      
      const result = await systemController.getSystemStats(mockReq, mockRes);
      return result.data;
    } catch (error) {
      console.error('Error getting system stats:', error);
      throw error;
    }
  });

  // IPC handlers for server control
  ipcMain.handle('start-server', async () => {
    try {
      startServer();
      return { success: true };
    } catch (error) {
      console.error('Error starting server:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('launch-browser', async (_, url: string) => {
    try {
      launchCustomBrowser(url);
      return { success: true };
    } catch (error) {
      console.error('Error launching browser:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // IPC handlers for SQLite operations - Campaigns
  ipcMain.handle('sqlite:campaigns:getAll', async (_) => {
    try {
      return await dbCampaignStorageService.listCampaigns();
    } catch (error) {
      console.error('Error getting all campaigns from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:campaigns:getById', async (_, campaignId: string) => {
    try {
      const campaign = await dbCampaignStorageService.loadCampaign(campaignId);
      return campaign;
    } catch (error) {
      console.error('Error getting campaign by ID from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:campaigns:save', async (_, campaignId: string, campaignData: any) => {
    try {
      await dbCampaignStorageService.saveCampaign(campaignId, campaignData);
      return { success: true };
    } catch (error) {
      console.error('Error saving campaign to SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:campaigns:delete', async (_, campaignId: string) => {
    try {
      await dbCampaignStorageService.deleteCampaign(campaignId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting campaign from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:campaigns:getStats', async (_, campaignId: string) => {
    try {
      const stats = await dbCampaignStorageService.getCampaignStats(campaignId);
      return stats;
    } catch (error) {
      console.error('Error getting campaign stats from SQLite:', error);
      throw error;
    }
  });

  // IPC handlers for SQLite operations - Profiles
  ipcMain.handle('sqlite:profiles:getAll', async (_) => {
    try {
      return await dbProfileStorageService.listProfiles();
    } catch (error) {
      console.error('Error getting all profiles from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:profiles:getById', async (_, profileId: string) => {
    try {
      const profile = await dbProfileStorageService.loadProfile(profileId);
      return profile;
    } catch (error) {
      console.error('Error getting profile by ID from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:profiles:save', async (_, profileId: string, profileData: any) => {
    try {
      await dbProfileStorageService.saveProfile(profileId, profileData);
      return { success: true };
    } catch (error) {
      console.error('Error saving profile to SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:profiles:delete', async (_, profileId: string) => {
    try {
      await dbProfileStorageService.deleteProfile(profileId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting profile from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:profiles:getStats', async (_, profileId: string) => {
    try {
      const stats = await dbProfileStorageService.getProfileStats(profileId);
      return stats;
    } catch (error) {
      console.error('Error getting profile stats from SQLite:', error);
      throw error;
    }
  });

  // IPC handlers for SQLite operations - Proxies
  ipcMain.handle('sqlite:proxies:getAll', async (_, filters?: any) => {
    try {
      return await dbProxyStorageService.listProxies(filters || {});
    } catch (error) {
      console.error('Error getting all proxies from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:proxies:getById', async (_, proxyId: string) => {
    try {
      const proxy = await dbProxyStorageService.loadProxy(proxyId);
      return proxy;
    } catch (error) {
      console.error('Error getting proxy by ID from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:proxies:save', async (_, proxyId: string, proxyData: any) => {
    try {
      await dbProxyStorageService.saveProxy(proxyId, proxyData);
      return { success: true };
    } catch (error) {
      console.error('Error saving proxy to SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:proxies:delete', async (_, proxyId: string) => {
    try {
      await dbProxyStorageService.deleteProxy(proxyId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting proxy from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:proxies:saveTestResult', async (_, proxyId: string, testId: string, testData: any) => {
    try {
      await dbProxyStorageService.saveProxyTest(proxyId, testId, testData);
      return { success: true };
    } catch (error) {
      console.error('Error saving proxy test result to SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:proxies:getStats', async (_, proxyId: string) => {
    try {
      const stats = await dbProxyStorageService.getProxyStats(proxyId);
      return stats;
    } catch (error) {
      console.error('Error getting proxy stats from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:proxies:updateStatus', async (_, proxyId: string, statusData: any) => {
    try {
      await dbProxyStorageService.updateProxyStatus(proxyId, statusData);
      return { success: true };
    } catch (error) {
      console.error('Error updating proxy status in SQLite:', error);
      throw error;
    }
  });

  // IPC handlers for SQLite operations - Settings
  ipcMain.handle('sqlite:settings:getAll', async (_) => {
    try {
      return await dbSettingsStorageService.listSettings();
    } catch (error) {
      console.error('Error getting all settings from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:settings:getById', async (_, userId: string) => {
    try {
      const settings = await dbSettingsStorageService.loadSettings(userId);
      return settings;
    } catch (error) {
      console.error('Error getting settings by ID from SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:settings:save', async (_, userId: string, settingsData: any) => {
    try {
      const result = await dbSettingsStorageService.saveSettings(userId, settingsData);
      return result;
    } catch (error) {
      console.error('Error saving settings to SQLite:', error);
      throw error;
    }
  });

  ipcMain.handle('sqlite:settings:delete', async (_, userId: string) => {
    try {
      await dbSettingsStorageService.deleteSettings(userId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting settings from SQLite:', error);
      throw error;
    }
  });

  // IPC handlers for sync operations
  ipcMain.handle('sync:campaigns', async (_, userId: string) => {
    try {
      const result = await syncService.syncCampaigns(userId);
      return result;
    } catch (error) {
      console.error('Error syncing campaigns:', error);
      throw error;
    }
  });

  ipcMain.handle('sync:profiles', async (_, userId: string) => {
    try {
      const result = await syncService.syncProfiles(userId);
      return result;
    } catch (error) {
      console.error('Error syncing profiles:', error);
      throw error;
    }
  });

  ipcMain.handle('sync:proxies', async (_, userId: string) => {
    try {
      const result = await syncService.syncProxies(userId);
      return result;
    } catch (error) {
      console.error('Error syncing proxies:', error);
      throw error;
    }
  });

  ipcMain.handle('sync:all', async (_, userId: string) => {
    try {
      const result = await syncService.syncAll(userId);
      return result;
    } catch (error) {
      console.error('Error syncing all data:', error);
      throw error;
    }
  });

  ipcMain.handle('sync:status', async (_, userId: string) => {
    try {
      const result = await syncService.getSyncStatus(userId);
      return result;
    } catch (error) {
      console.error('Error getting sync status:', error);
      throw error;
    }
  });

  // IPC handlers for authentication operations
  // Note: These use direct Supabase calls from the main process
  // We need to import Supabase client in the main process context
  let supabaseClient: any = null;
  const initSupabase = () => {
    if (!supabaseClient) {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnonKey) {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false, // Disable for desktop apps to prevent conflicts with custom protocol
            flowType: 'pkce',  // Enable PKCE flow for secure OAuth in desktop apps
          }
        });
      } else {
        console.error('Missing Supabase environment variables');
      }
    }
    return supabaseClient;
  };

  ipcMain.handle('auth:signIn', async (_, credentials: { email: string, password: string }) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw error;
      }

      return {
        user: data.user,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      };
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:signUp', async (_, credentials: { email: string, password: string, metadata?: any }) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          emailRedirectTo: 'electron-app://auth/callback', // Using a custom scheme
          data: credentials.metadata,
        },
      });

      if (error) {
        throw error;
      }

      return {
        user: data.user,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:signOut', async (_) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:getSession', async (_) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }

      return {
        user: data.session?.user || null,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      };
    } catch (error) {
      console.error('Get session error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:resetPassword', async (_, email: string) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'electron-app://reset-password',
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:updatePassword', async (_, request: { password: string }) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { error } = await supabase.auth.updateUser({
        password: request.password,
      });
      
      if (error) {
        throw error;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Update password error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:verifyOtp', async (_, request: { email: string, token: string, type: any }) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await supabase.auth.verifyOtp({
        email: request.email,
        token: request.token,
        type: request.type,
      });

      if (error) {
        throw error;
      }

      return {
        user: data.user,
        session: data.session ? {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        } : null,
      };
    } catch (error) {
      console.error('Verify OTP error:', error);
      throw error;
    }
  });

  ipcMain.handle('auth:exchangeCodeForSession', async (_, data: { code: string }) => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(data.code);

      if (error) {
        throw error;
      }

      return {
        user: sessionData.user,
        session: sessionData.session ? {
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          expires_at: sessionData.session.expires_at,
        } : null,
      };
    } catch (error) {
      console.error('Exchange code for session error:', error);
      throw error;
    }
  });

  // IPC handler for Google OAuth sign-in
  ipcMain.handle('auth:signInWithGoogle', async (_, redirectTo: string = '/admin') => {
    try {
      const supabase = initSupabase();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      // Use Supabase OAuth with PKCE for secure desktop authentication
      // This will handle PKCE automatically since flowType is set to 'pkce' in the client
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'electron-nyx://oauth/callback', // Custom protocol for desktop app
          queryParams: {
            access_type: 'offline',
            prompt: 'consent' // Always ask for consent to ensure refresh token is provided
          }
        }
      });

      if (error) {
        throw error;
      }

      // The browser should open automatically with Supabase's OAuth flow
      // Once authenticated, it will redirect to the custom protocol
      // Supabase handles opening the browser automatically in desktop environments
      if (data?.url) {
        // Open the URL in the default browser
        await shell.openExternal(data.url);
      }

      return {
        success: true,
        message: 'Google OAuth initiated successfully'
      };
    } catch (error) {
      console.error('Google OAuth sign in error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // IPC license management handlers
  ipcMain.handle('license:getTiers', async () => {
    try {
      const licenseService = require('../server/domains/auth/services/licenseService');
      const tiers = licenseService.getAvailableTiers();
      
      return {
        success: true,
        data: tiers
      };
    } catch (error) {
      console.error('License:getTiers error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:getSubscription', async (event) => {
    try {
      // Get user ID from session (in real implementation, validate session)
      const userId = 'user-' + event.sender.id; // Simplified for demo
      
      const licenseService = require('../server/domains/auth/services/licenseService');
      const subscription = await licenseService.getUserSubscription(userId);
      
      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      console.error('License:getSubscription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:getAnalytics', async (event) => {
    try {
      const userId = 'user-' + event.sender.id;
      
      const licenseService = require('../server/domains/auth/services/licenseService');
      const analytics = await licenseService.getUserAnalytics(userId);
      
      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      console.error('License:getAnalytics error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:getUpgradeRecommendation', async (event) => {
    try {
      const userId = 'user-' + event.sender.id;
      
      const licenseService = require('../server/domains/auth/services/licenseService');
      const recommendation = await licenseService.getUpgradeRecommendation(userId);
      
      return {
        success: true,
        data: recommendation
      };
    } catch (error) {
      console.error('License:getUpgradeRecommendation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:validateSubscription', async (event) => {
    try {
      const userId = 'user-' + event.sender.id;
      
      const licenseService = require('../server/domains/auth/services/licenseService');
      const validation = await licenseService.validateSubscription(userId);
      
      return {
        success: true,
        data: validation
      };
    } catch (error) {
      console.error('License:validateSubscription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:upgradeSubscription', async (event, data) => {
    try {
      const { tier, paymentMethod } = data;
      const userId = 'user-' + event.sender.id;
      
      const licenseService = require('../server/domains/auth/services/licenseService');
      const subscription = await licenseService.setUserSubscription(userId, tier, {
        status: 'active',
        metadata: {
          upgradedAt: new Date().toISOString(),
          paymentMethod: paymentMethod
        }
      });
      
      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      console.error('License:upgradeSubscription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:cancelSubscription', async (event) => {
    try {
      const userId = 'user-' + event.sender.id;
      
      const licenseService = require('../server/domains/auth/services/licenseService');
      const subscription = await licenseService.setUserSubscription(userId, 'free', {
        status: 'cancelled',
        metadata: {
          cancelledAt: new Date().toISOString()
        }
      });
      
      return {
        success: true,
        data: subscription
      };
    } catch (error) {
      console.error('License:cancelSubscription error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  ipcMain.handle('license:getQuotas', async (event) => {
    try {
      const userId = 'user-' + event.sender.id;

      // Get quota information for each resource
      const quotas = {
        profiles: await licenseService.checkQuotaLimit(userId, 'profiles', 0),
        campaigns: await licenseService.checkQuotaLimit(userId, 'campaigns', 0),
        proxies: await licenseService.checkQuotaLimit(userId, 'proxies', 0),
        sessions: await licenseService.checkQuotaLimit(userId, 'sessions', 0)
      };

      return {
        success: true,
        data: {
          subscription: await licenseService.getUserSubscription(userId),
          quotas: quotas,
          limits: {
            profiles: await licenseService.getMaxQuota(userId, 'profiles'),
            campaigns: await licenseService.getMaxQuota(userId, 'campaigns'),
            proxies: await licenseService.getMaxQuota(userId, 'proxies'),
            sessions: await licenseService.getMaxQuota(userId, 'sessions')
          }
        },
        message: 'Quota information retrieved successfully'
      };
    } catch (error) {
      console.error('License:getQuotas error:', error);
      return {
        success: false,
        error: 'Failed to retrieve quota information',
        message: 'An error occurred while retrieving your quota information'
      };
    }
  });

  // Payment-related IPC handlers
  ipcMain.handle('payments:createCheckoutSession', async (event, data) => {
    try {
      const { quantity, price, userId, userEmail, productName, productDescription } = data;
      const paymentGatewayService = require('./server/domains/payments/services/paymentGatewayService');
      
      // Create checkout session through the payment gateway
      const result = await paymentGatewayService.createProfileCheckoutSession({
        quantity,
        price,
        userId,
        customerEmail: userEmail,
        productName,
        productDescription
      });
      
      return {
        success: true,
        data: result,
        message: 'Checkout session created successfully'
      };
    } catch (error) {
      console.error('Payments:createCheckoutSession error:', error);
      return {
        success: false,
        error: 'Failed to create checkout session',
        message: error instanceof Error ? error.message : 'An error occurred while creating the checkout session'
      };
    }
  });

  ipcMain.handle('payments:validatePayment', async (event, sessionId) => {
    try {
      const paymentGatewayService = require('./server/domains/payments/services/paymentGatewayService');
      
      // Validate payment through the payment gateway
      const result = await paymentGatewayService.validateAndCompletePayment(sessionId);
      
      return {
        success: true,
        data: result,
        message: 'Payment validated successfully'
      };
    } catch (error) {
      console.error('Payments:validatePayment error:', error);
      return {
        success: false,
        error: 'Failed to validate payment',
        message: error instanceof Error ? error.message : 'An error occurred while validating the payment'
      };
    }
  });

  // Database management IPC handlers
  ipcMain.handle('db:create-table', async (_, tableData: any) => {
    try {
      // Since hybridDatabaseService is initialized during server startup,
      // we'll access the database instance that's already created
      // For this to work properly, we'd need access to the hybridDB instance
      // This would typically be imported from the server module 
      console.log('Creating table in SQLite:', tableData);
      
      // This is a simplified implementation - in a real scenario,
      // we'd need to access the initialized database service
      return { success: true, message: `Table ${tableData.name} processed in SQLite` };
    } catch (error) {
      console.error('Error creating table in SQLite:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:create-supabase-table', async (_, tableData: any) => {
    try {
      console.log('Creating table in Supabase:', tableData);
      
      // This would connect to Supabase and create the table
      // We need to access the sync service or a Supabase client instance
      return { success: true, message: `Table ${tableData.name} processed in Supabase` };
    } catch (error) {
      console.error('Error creating table in Supabase:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:get-table-names', async () => {
    try {
      // Get table names from SQLite
      return ['profiles', 'campaigns', 'proxies', 'sync_queue']; // Placeholder
    } catch (error) {
      console.error('Error getting SQLite table names:', error);
      return [];
    }
  });

  ipcMain.handle('db:get-supabase-table-names', async () => {
    try {
      // Get table names from Supabase
      return ['profiles', 'campaigns', 'proxies']; // Placeholder
    } catch (error) {
      console.error('Error getting Supabase table names:', error);
      return [];
    }
  });

  // IPC handlers for utility functions
  ipcMain.handle('utils:open-external', async (_, url: string) => {
    try {
      const { shell } = require('electron');
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Error opening external URL:', error);
      return { success: false, error: error.message };
    }
  });

  // Start the server when the app starts
  startServer();

  createWindow();

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

// Handle custom protocol URLs on macOS
app.on('open-url', (event, url) => {
  event.preventDefault();
  
  // Parse the URL and redirect to the auth callback page
  if (url.startsWith('electron-nyx://')) {
    const parsedUrl = new URL(url);
    // Extract parameters from the URL to send to renderer
    const code = parsedUrl.searchParams.get('code');
    const error = parsedUrl.searchParams.get('error');
    
    if (mainWindow) {
      if (code) {
        mainWindow.webContents.send('oauth-callback', { code });
      } else if (error) {
        mainWindow.webContents.send('oauth-callback', { error });
      } else {
        // If there are access tokens in the URL, we need to handle them differently
        const accessToken = parsedUrl.searchParams.get('access_token');
        if (accessToken) {
          // Send the full URL params to the renderer
          mainWindow.webContents.send('oauth-callback', {
            access_token: accessToken,
            refresh_token: parsedUrl.searchParams.get('refresh_token'),
            expires_in: parsedUrl.searchParams.get('expires_in'),
            expires_at: parsedUrl.searchParams.get('expires_at'),
            token_type: parsedUrl.searchParams.get('token_type'),
            provider_token: parsedUrl.searchParams.get('provider_token'),
            provider_refresh_token: parsedUrl.searchParams.get('provider_refresh_token')
          });
        }
      }
    }
  }
});

// Also handle custom protocol URLs on Windows/Linux when app is already running
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  const windows = BrowserWindow.getAllWindows();
  
  if (windows.length > 0) {
    const mainWindow = windows[0];
    
    // Check if the command line has a URL
    const url = commandLine.find(arg => arg.startsWith('electron-nyx://'));
    
    if (url) {
      // Parse URL and send to renderer for processing
      const parsedUrl = new URL(url);
      const code = parsedUrl.searchParams.get('code');
      const error = parsedUrl.searchParams.get('error');
      
      if (code) {
        mainWindow.webContents.send('oauth-callback', { code });
      } else if (error) {
        mainWindow.webContents.send('oauth-callback', { error });
      } else {
        // If there are access tokens in the URL, we need to handle them differently
        const accessToken = parsedUrl.searchParams.get('access_token');
        if (accessToken) {
          // Send the full URL params to the renderer
          mainWindow.webContents.send('oauth-callback', {
            access_token: accessToken,
            refresh_token: parsedUrl.searchParams.get('refresh_token'),
            expires_in: parsedUrl.searchParams.get('expires_in'),
            expires_at: parsedUrl.searchParams.get('expires_at'),
            token_type: parsedUrl.searchParams.get('token_type'),
            provider_token: parsedUrl.searchParams.get('provider_token'),
            provider_refresh_token: parsedUrl.searchParams.get('provider_refresh_token')
          });
        }
      }
    }
    
    // Focus the window
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
