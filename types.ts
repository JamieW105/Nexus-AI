
export type NodeType = 'file' | 'folder';

export interface FileNode {
  id: string;
  name: string;
  type: NodeType;
  content?: string;
  children?: FileNode[];
}

export interface FlatFileNode {
  id: string;
  name: string;
  type: NodeType;
  path: string;
}

export type AiModel = 'gemini' | 'deepseek';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model: AiModel;
  isError?: boolean;
  isAutoFix?: boolean;
}

export interface ModelInfo {
  id: AiModel;
  name: string;
  apiKeyEnvVar: string;
}

export type ViewMode = 'editor' | 'preview';