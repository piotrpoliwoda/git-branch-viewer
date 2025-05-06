// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),
  getBranches: (repoPath: string) => ipcRenderer.invoke('git:getBranches', repoPath),
  deleteBranch: (repoPath: string, branchName: string) =>
    ipcRenderer.invoke('git:deleteBranch', repoPath, branchName),
  checkoutBranch: (repoPath: string, branchName: string) =>
    ipcRenderer.invoke('git:checkoutBranch', repoPath, branchName),
  fetchOrigin: (repoPath: string) => ipcRenderer.invoke('git:fetchOrigin', repoPath),
});

// TypeScript interface for the exposed API
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      getBranches: (repoPath: string) => Promise<{
        branches: Array<{ name: string; commitCount: number }>;
        currentBranch: string;
      }>;
      deleteBranch: (repoPath: string, branchName: string) => Promise<boolean>;
      checkoutBranch: (
        repoPath: string,
        branchName: string,
      ) => Promise<{
        success: boolean;
        errorMessage?: string;
        errorTrace?: string;
      }>;
      fetchOrigin: (repoPath: string) => Promise<{
        success: boolean;
        output?: string;
        errorMessage?: string;
        errorTrace?: string;
      }>;
    };
  }
}
