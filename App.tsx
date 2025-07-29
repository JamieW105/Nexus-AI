
import React, { useState, useEffect, useCallback } from 'react';
import { FileNode, ChatMessage, AiModel, ViewMode, FlatFileNode } from './types';
import { INITIAL_FILES, AI_MODELS } from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import FileExplorer from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';
import Preview from './components/Preview';
import ChatAssistant from './components/ChatAssistant';
import { getAiResponse, AiServiceError } from './services/aiService';
import { DownloadIcon, CodeIcon, EyeIcon } from './components/icons';
import FileSaver from 'file-saver';
import { Buffer } from 'buffer';

// Polyfill Buffer for browser environments that don't have it, e.g., for JSZip
(window as any).Buffer = Buffer;

declare var JSZip: any;

// --- UTILITY FUNCTIONS ---

function findFileById(nodes: FileNode[], id: string): FileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === 'folder' && node.children) {
      const found = findFileById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

function updateFileContentPure(targetFiles: FileNode[], id: string, content: string): FileNode[] {
    const newFiles = JSON.parse(JSON.stringify(targetFiles));
    const file = findFileById(newFiles, id);
    if (file && file.type === 'file') {
        file.content = content;
    }
    return newFiles;
}

function addFileOrFolderPure(targetFiles: FileNode[], parentId: string | null, node: FileNode): FileNode[] {
    const newFiles = JSON.parse(JSON.stringify(targetFiles));
    if (parentId === null) {
        newFiles.push(node);
    } else {
        const parent = findFileById(newFiles, parentId);
        if (parent && parent.type === 'folder') {
            if (!parent.children) {
                parent.children = [];
            }
            parent.children.push(node);
        }
    }
    return newFiles;
}

function deleteFileOrFolderPure(targetFiles: FileNode[], id: string): FileNode[] {
    const newFiles: FileNode[] = [];
    for (const node of targetFiles) {
        if (node.id === id) {
            continue; // Skip this node, effectively deleting it
        }
        const newNode = JSON.parse(JSON.stringify(node));
        if (newNode.type === 'folder' && newNode.children) {
            newNode.children = deleteFileOrFolderPure(newNode.children, id);
        }
        newFiles.push(newNode);
    }
    return newFiles;
}

function getFlattenedFileTree(nodes: FileNode[], path = './'): FlatFileNode[] {
    let flatList: FlatFileNode[] = [];
    for (const node of nodes) {
        const currentPath = path + node.name + (node.type === 'folder' ? '/' : '');
        const flatNode: FlatFileNode = {
            id: node.id,
            name: node.name,
            type: node.type,
            path: currentPath,
        };
        flatList.push(flatNode);
        if (node.type === 'folder' && node.children) {
            flatList = flatList.concat(getFlattenedFileTree(node.children, currentPath));
        }
    }
    return flatList;
}

function getCleanFileTree(nodes: FileNode[]): any[] {
  return nodes.map(node => {
    const item: any = {
      id: node.id,
      name: node.name,
      type: node.type,
    };
    if (node.type === 'folder' && node.children) {
      item.children = getCleanFileTree(node.children);
    }
    return item;
  });
}

function findFileByPath(nodes: FileNode[], path: string): FileNode | null {
    const parts = path.replace('./', '').split('/');
    let currentNodes: FileNode[] | undefined = nodes;
    let foundNode: FileNode | null = null;
    
    for (const part of parts) {
        if (!currentNodes || !part) continue;
        const searchResult = currentNodes.find(node => node.name === part);
        if(!searchResult) return null;

        foundNode = searchResult;
        if (foundNode.type === 'folder') {
            currentNodes = foundNode.children;
        }
    }
    return foundNode;
}


const App: React.FC = () => {
  const [files, setFiles] = useLocalStorage<FileNode[]>('ai-web-builder-files', INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useLocalStorage<string | null>('ai-web-builder-active-file', '1-1');
  const [openFileIds, setOpenFileIds] = useLocalStorage<string[]>('ai-web-builder-open-files', ['1-1', '1-2', '1-3', '2']);
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>('ai-web-builder-messages', []);
  const [selectedModel, setSelectedModel] = useLocalStorage<AiModel>('selectedAiModel', 'gemini');
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  
  // State for auto-fix functionality
  const [lastUserPrompt, setLastUserPrompt] = useState<string | null>(null);
  const [lastAiActions, setLastAiActions] = useState<any | null>(null);
  const [lastFileState, setLastFileState] = useState<FileNode[] | null>(null);

  const activeFile = activeFileId ? findFileById(files, activeFileId) : null;
  const openFiles = openFileIds.map(id => findFileById(files, id)).filter(Boolean) as FileNode[];

  const handleCodeChange = (id: string, content: string) => {
    setFiles(currentFiles => updateFileContentPure(currentFiles, id, content));
  };
  
  const handleFileSelect = (id: string) => {
    setActiveFileId(id);
    if (!openFileIds.includes(id)) {
      setOpenFileIds([...openFileIds, id]);
    }
  };
  
  const handleCloseFile = (id: string) => {
      const newOpenFileIds = openFileIds.filter(fileId => fileId !== id);
      setOpenFileIds(newOpenFileIds);
      if (activeFileId === id) {
          setActiveFileId(newOpenFileIds.length > 0 ? newOpenFileIds[0] : null);
      }
  };

  const parseAiResponse = (responseText: string): any => {
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        try {
            return JSON.parse(jsonMatch[1]);
        } catch (e) {
            console.error("Failed to parse JSON from markdown block:", e);
        }
    }

    const looseJsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (looseJsonMatch && looseJsonMatch[0]) {
      try {
        return JSON.parse(looseJsonMatch[0]);
      } catch (e) {
         console.error("Failed to parse JSON from loose match:", e);
         throw new Error(`Could not find a valid JSON object in the response. Raw response: ${responseText}`);
      }
    }
    
    // As a last resort, if the response is just the JSON string without any markers
    try {
      return JSON.parse(responseText);
    } catch(e) {
       throw new Error(`No valid JSON object found in the AI response. Raw response: ${responseText}`);
    }
  };
  
  const handleAutoFix = useCallback(async (errorMessage: string) => {
    if (!lastUserPrompt || !lastAiActions || !lastFileState) {
        setMessages(prev => [...prev, { role: 'assistant', content: "I don't have enough context to attempt a fix. Please try your last request again.", model: selectedModel, isError: true }]);
        return;
    }

    setIsLoading(true);

    const failedActionsString = JSON.stringify(lastAiActions, null, 2);

    try {
        const cleanFileTree = getCleanFileTree(lastFileState); // Use the state before the failed action
        const fileStructureString = JSON.stringify(cleanFileTree, null, 2);

        const idToPathMap = new Map(getFlattenedFileTree(lastFileState).map(node => [node.id, node.path]));
        const openFilesContext = openFiles.map(file => {
            const path = idToPathMap.get(file.id) || file.name;
            const content = findFileById(lastFileState, file.id)?.content || '';
            return `File: ${path} (id: ${file.id})\n\`\`\`\n${content}\n\`\`\``;
        }).join('\n\n');

        const fullPrompt = `
          ATTEMPTING AUTO-FIX.
          Original User Request: "${lastUserPrompt}"
          
          The following AI actions resulted in an error when applied:
          \`\`\`json
          ${failedActionsString}
          \`\`\`

          This produced the following error in the preview:
          "${errorMessage}"

          Current Project File Structure (with IDs):
          ${fileStructureString}

          Content of currently open files:
          ${openFilesContext || 'No files are currently open.'}

          Please analyze the error and the code that caused it, and provide a new, corrected set of actions to fix the problem.
        `;
      
      const responseText = await getAiResponse(fullPrompt, selectedModel);
      const parsedResponse = parseAiResponse(responseText);

      setLastUserPrompt(null);
      setLastAiActions(null);
      setLastFileState(null);

      if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
        let tempFiles = lastFileState; // Start from the state *before* the failed action
        let tempOpenFileIds = [...openFileIds];
        let tempActiveFileId = activeFileId;
        const actionSummaries: string[] = ["Auto-fix applied:"];
        let didModifyFiles = false;

        for (const action of parsedResponse.actions) {
             if (['edit', 'create', 'delete'].includes(action.type)) {
                didModifyFiles = true;
            }
            if (action.type === 'edit') {
                const fileToEdit = findFileById(tempFiles, action.fileId);
                if (fileToEdit && typeof action.content === 'string') {
                    tempFiles = updateFileContentPure(tempFiles, action.fileId, action.content);
                    actionSummaries.push(`- Updated file: ${fileToEdit.name}`);
                } else {
                    actionSummaries.push(`- Skipped malformed 'edit' action for file ID ${action.fileId}.`);
                }
            } else if (action.type === 'create') {
                const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                const newNode: FileNode = { id: newId, name: action.name, type: action.fileType, ...(action.fileType === 'file' ? { content: action.content || '' } : { children: [] }) };
                tempFiles = addFileOrFolderPure(tempFiles, action.parentId, newNode);
                actionSummaries.push(`- Created ${action.fileType}: ${action.name}`);
            } else if (action.type === 'delete') {
                 const fileToDelete = findFileById(tempFiles, action.fileId);
                if (fileToDelete) {
                    tempFiles = deleteFileOrFolderPure(tempFiles, action.fileId);
                    actionSummaries.push(`- Deleted ${fileToDelete.type}: ${fileToDelete.name}`);
                    if (tempOpenFileIds.includes(action.fileId)) tempOpenFileIds = tempOpenFileIds.filter(fid => fid !== action.fileId);
                    if (tempActiveFileId === action.fileId) tempActiveFileId = tempOpenFileIds.length > 0 ? tempOpenFileIds[0] : null;
                }
            } else if (action.type === 'chat') {
                actionSummaries.push(`- ${action.message}`);
            }
        }
        
        setFiles(tempFiles);
        setOpenFileIds(tempOpenFileIds);
        setActiveFileId(tempActiveFileId);

        if (didModifyFiles) {
            setLastUserPrompt(prompt);
            setLastAiActions(parsedResponse);
            setLastFileState(files); // Save the original state
        }

        setMessages(prev => [...prev, { role: 'assistant', content: actionSummaries.join('\n'), model: selectedModel, isAutoFix: true }]);
      } else {
         throw new AiServiceError('AI returned an invalid action format during auto-fix.', 'invalid_format');
      }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during auto-fix.';
        setMessages(prev => [...prev, { role: 'assistant', content: `Auto-fix failed: ${errorMessage}`, model: selectedModel, isError: true }]);
        setLastUserPrompt(null);
        setLastAiActions(null);
        setLastFileState(null);
    } finally {
      setIsLoading(false);
    }
  }, [files, openFiles, activeFileId, lastUserPrompt, lastAiActions, selectedModel, openFileIds, lastFileState]);
  
  const handlePreviewError = useCallback((errorMessage: string) => {
    if (isLoading || !lastUserPrompt || !lastAiActions) {
        return;
    }
    const autoFixMessage: ChatMessage = {
        role: 'assistant',
        content: `An error was detected in the preview. I will attempt to fix it.\n\nError: ${errorMessage}`,
        model: selectedModel,
        isAutoFix: true
    };
    setMessages(prev => [...prev, autoFixMessage]);
    handleAutoFix(errorMessage);
  }, [isLoading, lastUserPrompt, lastAiActions, selectedModel, handleAutoFix]);

  const handleSendMessage = async (prompt: string) => {
    setIsLoading(true);
    const userMessage: ChatMessage = { role: 'user', content: prompt, model: selectedModel };
    setMessages(prev => [...prev, userMessage]);

    // Reset auto-fix context on new user message
    setLastUserPrompt(null);
    setLastAiActions(null);
    setLastFileState(null);
    
    const originalFiles = files; // Keep a snapshot

    try {
        const cleanFileTree = getCleanFileTree(files);
        const fileStructureString = JSON.stringify(cleanFileTree, null, 2);
        
        const flattenedFiles = getFlattenedFileTree(files);
        const idToPathMap = new Map(flattenedFiles.map(node => [node.id, node.path]));

        const openFilesContext = openFiles.map(file => {
          const path = idToPathMap.get(file.id) || file.name;
          return `File: ${path} (id: ${file.id})\n\`\`\`\n${file.content}\n\`\`\``
        }).join('\n\n');

        const fullPrompt = `User Request: "${prompt}"\n\nCurrent Project File Structure (with IDs):\n${fileStructureString}\n\nContent of currently open files:\n${openFilesContext || 'No files are currently open.'}`;
      
      const responseText = await getAiResponse(fullPrompt, selectedModel);
      
      let parsedResponse;
      try {
        parsedResponse = parseAiResponse(responseText);
      } catch (e) {
        console.error("Failed to parse AI response:", responseText);
        const errorMessage = e instanceof Error ? e.message : 'Unknown parsing error.';
        setMessages(prev => [...prev, { role: 'assistant', content: `Failed to parse AI response:\n${errorMessage}`, model: selectedModel, isError: true }]);
        setIsLoading(false);
        return;
      }
      
      let didModifyFiles = false;
      if (parsedResponse.actions && Array.isArray(parsedResponse.actions)) {
        let tempFiles = files;
        let tempOpenFileIds = [...openFileIds];
        let tempActiveFileId = activeFileId;
        const actionSummaries: string[] = [];

        for (const action of parsedResponse.actions) {
            if (['edit', 'create', 'delete'].includes(action.type)) {
                didModifyFiles = true;
            }
            if (action.type === 'edit') {
                const fileToEdit = findFileById(tempFiles, action.fileId);
                if (fileToEdit && typeof action.content === 'string') {
                    tempFiles = updateFileContentPure(tempFiles, action.fileId, action.content);
                    actionSummaries.push(`Updated file: ${fileToEdit.name}`);
                    tempActiveFileId = action.fileId;
                    if (!tempOpenFileIds.includes(action.fileId)) {
                        tempOpenFileIds.push(action.fileId);
                    }
                } else {
                  console.warn('Skipping malformed "edit" action from AI:', action);
                  actionSummaries.push(`Skipped malformed 'edit' action for file ID ${action.fileId}.`);
                }
            } else if (action.type === 'create') {
                const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                const newNode: FileNode = { id: newId, name: action.name, type: action.fileType, ...(action.fileType === 'file' ? { content: action.content || '' } : { children: [] }) };
                tempFiles = addFileOrFolderPure(tempFiles, action.parentId, newNode);
                actionSummaries.push(`Created ${action.fileType}: ${action.name}`);
                 if (newNode.type === 'file') {
                    tempActiveFileId = newId;
                    if (!tempOpenFileIds.includes(newId)) {
                        tempOpenFileIds.push(newId);
                    }
                }
            } else if (action.type === 'delete') {
                const fileToDelete = findFileById(tempFiles, action.fileId);
                if (fileToDelete) {
                    tempFiles = deleteFileOrFolderPure(tempFiles, action.fileId);
                    actionSummaries.push(`Deleted ${fileToDelete.type}: ${fileToDelete.name}`);
                    if (tempOpenFileIds.includes(action.fileId)) tempOpenFileIds = tempOpenFileIds.filter(fid => fid !== action.fileId);
                    if (tempActiveFileId === action.fileId) tempActiveFileId = tempOpenFileIds.length > 0 ? tempOpenFileIds[0] : null;
                }
            } else if (action.type === 'chat') {
                actionSummaries.push(action.message);
            }
        }
        
        setFiles(tempFiles);
        setOpenFileIds(tempOpenFileIds);
        setActiveFileId(tempActiveFileId);

        if (actionSummaries.length > 0) {
            setMessages(prev => [...prev, { role: 'assistant', content: actionSummaries.join('\n'), model: selectedModel }]);
        } else if (!didModifyFiles) {
            setMessages(prev => [...prev, { role: 'assistant', content: "I didn't make any changes. What would you like to do next?", model: selectedModel }]);
        }

        if (didModifyFiles) {
          setLastUserPrompt(prompt);
          setLastAiActions(parsedResponse.actions);
          setLastFileState(originalFiles); // Save the state *before* the changes
        }

      } else {
         throw new AiServiceError('AI returned an invalid action format.', 'invalid_format');
      }
      
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}`, model: selectedModel, isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const buildPreviewHtml = useCallback(() => {
    const htmlFile = findFileByPath(files, 'project/index.html');
    if (!htmlFile || htmlFile.type !== 'file') return '<h1>index.html not found in project folder</h1>';

    let htmlContent = htmlFile.content || '';

    const regexCss = /<link\s+.*?href="([^"]+)"[^>]*>/g;
    htmlContent = htmlContent.replace(regexCss, (match, href) => {
        if (href.startsWith('http')) return match;
        const cssFile = findFileByPath(files, `project/${href}`);
        if (cssFile && cssFile.type === 'file' && cssFile.content) {
            return `<style>${cssFile.content}</style>`;
        }
        return `<!-- CSS file not found: ${href} -->`;
    });

    const regexJs = /<script\s+.*?src="([^"]+)"[^>]*><\/script>/g;
    htmlContent = htmlContent.replace(regexJs, (match, src) => {
        if (src.startsWith('http')) return match;
        const jsFile = findFileByPath(files, `project/${src}`);
        if (jsFile && jsFile.type === 'file' && jsFile.content) {
            return `<script>${jsFile.content}</script>`;
        }
        return `<!-- JS file not found: ${src} -->`;
    });

    return htmlContent;
  }, [files]);

  useEffect(() => {
    if (viewMode === 'preview') {
      const newHtml = buildPreviewHtml();
      setPreviewContent(newHtml);
    }
  }, [files, viewMode, buildPreviewHtml]);
  
  const handleDownloadProject = async () => {
    const zip = new JSZip();
    
    function addFilesToZip(folder: any, nodes: FileNode[]) {
        nodes.forEach(node => {
            if (node.type === 'file') {
                folder.file(node.name, node.content);
            } else if (node.type === 'folder' && node.children) {
                const subFolder = folder.folder(node.name);
                addFilesToZip(subFolder, node.children);
            }
        });
    }

    // Add all root files and folders to the zip
    addFilesToZip(zip, files);

    const content = await zip.generateAsync({ type: "blob" });
    FileSaver.saveAs(content, "cosmic-ai-builder-project.zip");
  };

  return (
    <div className="flex h-screen w-screen bg-background text-soft-white font-sans overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-primary rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full filter blur-3xl animate-pulse delay-1000"></div>
      </div>
      
      <FileExplorer
        files={files}
        onFileSelect={handleFileSelect}
        activeFileId={activeFileId}
        onDownloadProject={handleDownloadProject}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 h-14 bg-surface/30 backdrop-blur-sm border-b border-white/10 flex items-center justify-between px-4 z-20">
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-lavender-glow to-cyan-glow">
                Cosmic AI Builder
            </h1>
            <div className="flex items-center gap-4">
                <button
                    onClick={handleDownloadProject}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-all text-sm shadow-sm hover:shadow-glow-lavender/50"
                >
                    <DownloadIcon /> Download Project
                </button>
                <button
                    onClick={() => setViewMode(viewMode === 'editor' ? 'preview' : 'editor')}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 transition-all text-sm shadow-md hover:shadow-glow-purple"
                >
                    {viewMode === 'editor' ? <><EyeIcon /> Preview</> : <><CodeIcon /> Editor</>}
                </button>
            </div>
        </header>
        <main className="flex-1 min-h-0 bg-black/10">
          {viewMode === 'editor' ? (
            <CodeEditor
              activeFile={activeFile}
              onContentChange={handleCodeChange}
              openFiles={openFiles}
              onFileSelect={setActiveFileId}
              onCloseFile={handleCloseFile}
            />
          ) : (
            <Preview htmlContent={previewContent} onError={handlePreviewError} />
          )}
        </main>
      </div>
      
      <ChatAssistant
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        models={AI_MODELS}
      />
    </div>
  );
};

export default App;
