import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { HouseApi } from '@shared/types';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: HouseApi = {
  getState: () => ipcRenderer.invoke('state:get'),

  chooseRoot: () => ipcRenderer.invoke('projects:chooseRoot'),
  rescan: () => ipcRenderer.invoke('projects:rescan'),
  addExternalProject: () => ipcRenderer.invoke('projects:addExternal'),
  updateProject: (id, patch) => ipcRenderer.invoke('projects:update', id, patch),
  removeProject: (id) => ipcRenderer.invoke('projects:remove', id),
  acceptDetected: (path) => ipcRenderer.invoke('projects:acceptDetected', path),
  ignoreDetected: (path) => ipcRenderer.invoke('projects:ignoreDetected', path),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),

  listDocs: (id) => ipcRenderer.invoke('docs:list', id),
  readDoc: (id, relPath) => ipcRenderer.invoke('docs:read', id, relPath),
  gitInfo: (id) => ipcRenderer.invoke('git:info', id),
  gitDiff: (id, relPath) => ipcRenderer.invoke('git:diff', id, relPath),

  listIdes: (force) => ipcRenderer.invoke('ide:list', force),
  openInIde: (id, ideId, relPath) => ipcRenderer.invoke('ide:open', id, ideId, relPath),
  addCustomIde: (name, command) => ipcRenderer.invoke('ide:addCustom', name, command),
  removeCustomIde: (id) => ipcRenderer.invoke('ide:removeCustom', id),
  openInExplorer: (id) => ipcRenderer.invoke('os:explorer', id),
  openTerminal: (id) => ipcRenderer.invoke('os:terminal', id),
  copyText: (text) => ipcRenderer.invoke('os:copy', text),

  listNotes: (id) => ipcRenderer.invoke('notes:list', id),
  saveNotes: (id, notes) => ipcRenderer.invoke('notes:save', id, notes),

  claudeStatus: (force) => ipcRenderer.invoke('claude:status', force),
  listTasks: (id) => ipcRenderer.invoke('tasks:list', id),
  sendPrompt: (id, prompt, continueTaskId) => ipcRenderer.invoke('tasks:send', id, prompt, continueTaskId),
  cancelTask: (taskId) => ipcRenderer.invoke('tasks:cancel', taskId),
  acknowledgeTask: (taskId) => ipcRenderer.invoke('tasks:acknowledge', taskId),
  clearHistory: (id) => ipcRenderer.invoke('tasks:clear', id),

  getLogistics: () => ipcRenderer.invoke('logistics:all'),
  readCatalogFile: (id) => ipcRenderer.invoke('logistics:readFile', id),
  getUsage: () => ipcRenderer.invoke('logistics:usage'),
  listArtifacts: () => ipcRenderer.invoke('logistics:artifacts'),
  refreshArtifacts: () => ipcRenderer.invoke('logistics:refreshArtifacts'),
  openArtifact: (url) => ipcRenderer.invoke('logistics:openArtifact', url),

  prepareVoice: () => ipcRenderer.invoke('voice:prepare'),
  onVoiceProgress: (cb) => subscribe('voice:progress', cb),
  getLimits: () => ipcRenderer.invoke('limits:get'),
  onLimits: (cb) => subscribe('limits:update', cb),
  listHistory: () => ipcRenderer.invoke('history:list'),
  readHistory: (id) => ipcRenderer.invoke('history:read', id),
  resumeHistory: (id) => ipcRenderer.invoke('history:resume', id),
  listConversations: () => ipcRenderer.invoke('conversations:list'),
  onConversations: (cb) => subscribe('conversations:update', cb),

  onTaskEvent: (cb) => subscribe('task:event', cb),
  onProjectDetected: (cb) => subscribe('project:detected', cb),
  onStateChanged: (cb) => subscribe('state:changed', cb),
  onOpenTask: (cb) => subscribe('task:open', cb),

  windowControl: (action) => ipcRenderer.invoke('window:control', action),
};

contextBridge.exposeInMainWorld('house', api);
