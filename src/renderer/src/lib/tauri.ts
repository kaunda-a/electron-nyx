// client/src/lib/tauri.ts
import { invoke } from '@tauri-apps/api/tauri';

// Define types for our Tauri commands
export interface GreetResponse {
  message: string;
}

// Example command
export async function greet(name: string): Promise<string> {
  return await invoke('greet', { name });
}

// Server management commands
export async function startServer(): Promise<string> {
  return await invoke('start_server');
}

// Server API configuration
const SERVER_HOST = 'localhost';
const SERVER_PORT = 3000;
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;

// Server communication functions
export async function getServerStatus(): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/status`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get server status: ${error.message}`);
  }
}

export async function getSystemStats(): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/stats`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get system stats: ${error.message}`);
  }
}

// Profile management functions
export async function getAllProfiles(): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/profiles`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get profiles: ${error.message}`);
  }
}

export async function getProfile(profileId: string): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/profiles/${profileId}`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get profile: ${error.message}`);
  }
}

export async function createProfile(profileData: any): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to create profile: ${error.message}`);
  }
}

export async function launchProfile(profileId: string): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/profiles/${profileId}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to launch profile: ${error.message}`);
  }
}

// Campaign management functions
export async function getAllCampaigns(): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/campaigns`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get campaigns: ${error.message}`);
  }
}

export async function getCampaign(campaignId: string): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/campaigns/${campaignId}`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to get campaign: ${error.message}`);
  }
}

export async function createCampaign(campaignData: any): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(campaignData),
    });
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to create campaign: ${error.message}`);
  }
}

export async function launchCampaign(campaignId: string): Promise<any> {
  try {
    const response = await fetch(`${SERVER_URL}/api/campaigns/${campaignId}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to launch campaign: ${error.message}`);
  }
}

// Add more Tauri commands here as we implement them