import React, { useState, useEffect, useCallback } from 'react';
import { FileNode, ChatMessage, AiModel, ViewMode, FlatFileNode, NodeType } from './types.ts';
import { INITIAL_FILES, AI_MODELS } from './constants.ts';
import useLocalStorage from './hooks/useLocalStorage.ts';
import FileExplorer from './components/FileExplorer.tsx';
import CodeEditor from './components/CodeEditor.tsx';
import Preview from './components/Preview.tsx';
import ChatAssistant from './components/ChatAssistant.tsx';
import { getAiResponse, AiServiceError } from './services/aiService.ts';
import { DownloadIcon, CodeIcon, EyeIcon } from './components/icons.tsx';
import FileSaver from 'file-saver';
import { Buffer } from 'buffer';

// Polyfill Buffer for browser environments that don't have it, e.g., for JSZip
(window as any).Buffer = Buffer;

declare var JSZip: any;

// --- UTILITY FUNCTIONS ---
// These functions are pure and operate on the file tree structure.

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

function findParentOfNode(nodes: FileNode[], nodeId: string): FileNode | null {
    for (const node of nodes) {
        if (node.type === 'folder' && node.children?.some(child => child.id === nodeId)) {
            return node;
        }
        if (node.type === 'folder' && node.children) {
            const foundParent = findParentOfNode(node.children, nodeId);
            if (foundParent) {
                return foundParent;
            }
        }
    }
    return null; // Not found, or it's a root node with no parent
}


function updateFileContentPure(nodes: FileNode[], id: string, content: string): FileNode[] {
    return nodes.map(node => {
        if (node.id === id && node.type === 'file') {
            return { ...node, content };
        }
        if (node.type === 'folder' && node.children) {
            return { ...node, children: updateFileContentPure(node.children, id, content) };
        }
        return node;
    });
}

function deleteNodePure(nodes: FileNode[], id: string): FileNode[] {
    return nodes.filter(node => node.id !== id).map(node => {
        if (node.type === 'folder' && node.children) {
            return { ...node, children: deleteNodePure(node.children, id) };
        }
        return node;
    });
}

function addNodePure(nodes: FileNode[], parentId: string | null, newNode: FileNode): FileNode[] {
    if (parentId === null) {
        return [...nodes, newNode];
    }
    return nodes.map(node => {
        if (node.id === parentId && node.type === 'folder') {
            return {
                ...node,
                children: [...(node.children || []), newNode],
            };
        }
        if (node.type === 'folder' && node.children) {
            return {
                ...node,
                children: addNodePure(node.children, parentId, newNode),
            };
        }
        return node;
    });
}


function flattenFileTree(nodes: FileNode[], pathPrefix = ''): FlatFileNode[] {
  let flatList: FlatFileNode[] = [];
  for (const node of nodes) {
    const newPath = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
    flatList.push({ id: node.id, name: node.name, type: node.type, path: newPath });
    if (node.type === 'folder' && node.children) {
      flatList = flatList.concat(flattenFileTree(node.children, newPath));
    }
  }
  return flatList;
}

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [files, setFiles] = useLocalStorage<FileNode[]>('files', INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useLocalStorage<string | null>('activeFileId', '1-1');
  const [openFiles, setOpenFiles] = useLocalStorage<FileNode[]>('openFiles', []);
  const [chatMessages, setChatMessages] = useLocalStorage<ChatMessage[]>('chatMessages', []);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useLocalStorage<AiModel>('selectedModel', 'gemini');
  const [viewMode, setViewMode] = useState<ViewMode>('editor');

  const activeFile = activeFileId ? findFileById(files, activeFileId) : null;

  // Sync open files with active file
  useEffect(() => {
    const activeNode = activeFileId ? findFileById(files, activeFileId) : null;
    if (activeNode && activeNode.type === 'file' && !openFiles.some(f => f.id === activeNode.id)) {
      setOpenFiles(prev => [...prev, activeNode]);
    }
    // Only update openFiles if files have actually changed
    setOpenFiles(currentOpenFiles => {
      const updatedFiles = currentOpenFiles.map(of => findFileById(files, of.id) || of).filter((f): f is FileNode => !!f);
      return JSON.stringify(updatedFiles) === JSON.stringify(currentOpenFiles) ? currentOpenFiles : updatedFiles;
    });
  }, [activeFileId, files, openFiles, setOpenFiles]);


  const handleFileSelect = useCallback((id: string) => {
    const file = findFileById(files, id);
    if (file) {
      setActiveFileId(id);
      if (file.type === 'file' && !openFiles.some(f => f.id === id)) {
        setOpenFiles(prev => [...prev, file]);
      }
    }
  }, [files, openFiles, setActiveFileId, setOpenFiles]);


  const handleContentChange = useCallback((id: string, content: string) => {
    setFiles(prevFiles => updateFileContentPure(prevFiles, id, content));
  }, [setFiles]);


  const handleCloseFile = useCallback((id: string) => {
    const remainingOpenFiles = openFiles.filter(f => f.id !== id);
    setOpenFiles(remainingOpenFiles);
    if (activeFileId === id) {
      setActiveFileId(remainingOpenFiles.length > 0 ? remainingOpenFiles[remainingOpenFiles.length - 1].id : null);
    }
  }, [activeFileId, openFiles, setActiveFileId, setOpenFiles]);

  const handleModelChange = useCallback((model: AiModel) => {
    setSelectedModel(model);
  }, [setSelectedModel]);

  const addMessage = (message: Omit<ChatMessage, 'model'>) => {
     setChatMessages(prev => [...prev, { ...message, model: selectedModel }]);
  };
  
  const handleAddItem = (type: NodeType) => {
    const name = prompt(`Enter name for new ${type}:`);
    if (!name || name.trim() === '') {
        return; // User cancelled or entered empty name
    }

    let parentId: string | null = null;
    const activeNode = activeFileId ? findFileById(files, activeFileId) : null;

    if (activeNode) {
        if (activeNode.type === 'folder') {
            parentId = activeNode.id;
        } else {
            const parentNode = findParentOfNode(files, activeNode.id);
            parentId = parentNode ? parentNode.id : null;
        }
    }
    
    const newNode: FileNode = {
        id: `${Date.now()}-${name}`, // More robust "unique" ID
        name,
        type,
        ...(type === 'file' && { content: '' }),
        ...(type === 'folder' && { children: [] }),
    };

    setFiles(currentFiles => addNodePure(currentFiles, parentId, newNode));

    if (newNode.type === 'file') {
        handleFileSelect(newNode.id);
    }
  };


  const processAiActions = (actions: any[]) => {
      let tempFiles = files;
      actions.forEach(action => {
          switch (action.type) {
              case 'edit':
                  if (action.fileId && action.content !== undefined) {
                      tempFiles = updateFileContentPure(tempFiles, action.fileId, action.content);
                      const fileToOpen = findFileById(tempFiles, action.fileId);
                      if (fileToOpen && fileToOpen.type === 'file' && !openFiles.some(f => f.id === fileToOpen.id)) {
                          setOpenFiles(prev => [...prev, fileToOpen]);
                      }
                      setActiveFileId(action.fileId);
                  }
                  break;
              case 'create':
                  const { parentId, fileType, name, content } = action;
                  const newNode: FileNode = {
                      id: `${Date.now()}-${name}`,
                      name,
                      type: fileType,
                      ...(fileType === 'file' && { content: content || '' }),
                      ...(fileType === 'folder' && { children: [] }),
                  };
                  tempFiles = addNodePure(tempFiles, parentId, newNode);
                  if (newNode.type === 'file') {
                      handleFileSelect(newNode.id);
                  }
                  break;
              case 'delete':
                  if (action.fileId) {
                      if (openFiles.some(f => f.id === action.fileId)) {
                        handleCloseFile(action.fileId);
                      }
                      tempFiles = deleteNodePure(tempFiles, action.fileId);
                  }
                  break;
              case 'chat':
                  if (action.message) {
                      addMessage({ role: 'assistant', content: action.message });
                  }
                  break;
          }
      });
      setFiles(tempFiles);
  };

  const constructAiPrompt = (userPrompt: string, error?: string) => {
    const flatFileTree = flattenFileTree(files);
    const openFileContents = openFiles
        .map(file => `--- Open File: ${file.name} (ID: ${file.id}) ---\n${file.content}`)
        .join('\n\n');
        
    let prompt = `The user wants to: "${userPrompt}".\n\n`;
    if (error) {
        prompt = `AUTO-FIX REQUEST: The previous attempt failed with an error. Please fix it.\nUser's original goal: "${userPrompt}"\nError message: "${error}"\n\n`;
    }
    
    prompt += "Here is the complete file structure of the project. Use the file IDs for actions.\n";
    prompt += JSON.stringify(flatFileTree, null, 2);
    prompt += "\n\nHere are the contents of the currently open files:\n";
    prompt += openFileContents || "No files are currently open.";
    return prompt;
  }
  
  const handleSendMessage = async (prompt: string, isAutoFix = false, originalPrompt = '') => {
      if (!isAutoFix) {
          addMessage({ role: 'user', content: prompt });
      } else {
          addMessage({ role: 'assistant', content: 'An error occurred in the preview. Attempting to auto-fix...', isAutoFix: true });
      }
      setIsLoading(true);

      try {
          const fullPrompt = constructAiPrompt(isAutoFix ? originalPrompt : prompt, isAutoFix ? prompt : undefined);
          const responseText = await getAiResponse(fullPrompt, selectedModel, true);
          
          let parsedResponse;
          try {
              parsedResponse = JSON.parse(responseText.trim());
          } catch(e) {
              throw new AiServiceError(`AI returned invalid JSON. Response:\n${responseText}`, 'json_parse_error');
          }
          
          if (!parsedResponse.actions || !Array.isArray(parsedResponse.actions)) {
              throw new AiServiceError('AI response is missing "actions" array.', 'invalid_response_format');
          }

          processAiActions(parsedResponse.actions);

      } catch (err) {
          console.error("AI Service Error:", err);
          const errorMessage = err instanceof AiServiceError ? err.message : 'An unknown error occurred.';
          addMessage({ role: 'assistant', content: errorMessage, isError: true });
      } finally {
          setIsLoading(false);
      }
  };

  const handlePreviewError = (error: string) => {
    const lastUserMessage = [...chatMessages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
        handleSendMessage(error, true, lastUserMessage.content);
    } else {
        addMessage({ role: 'assistant', content: `Preview Error: ${error}\nI can't auto-fix without a previous user command.`, isError: true });
    }
  };
  
  const buildPreviewContent = (): string => {
    const htmlFile = files.find(f => f.name === 'project')?.children?.find(c => c.name === 'index.html');
    if (!htmlFile || htmlFile.type !== 'file' || !htmlFile.content) return '<h1>Project `index.html` not found</h1>';

    let processedHtml = htmlFile.content;
    const projectRoot = findFileById(files, '1'); // project folder
    if (!projectRoot || !projectRoot.children) return processedHtml;


    const findFileByPath = (path: string) => {
        const pathParts = path.split('/');
        let currentNode: FileNode[] | undefined = projectRoot.children;
        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            const found = currentNode?.find(n => n.name === part);
            if (!found) return null;
            if (i === pathParts.length - 1) return found;
            currentNode = found.children;
        }
        return null;
    }

    // Find all <link> and <script> tags and replace with inline content
    const linkRegex = /<link\s+.*?href=["'](.*?)["'].*?>/g;
    const scriptRegex = /<script\s+.*?src=["'](.*?)["'].*?>/gs;

    processedHtml = processedHtml.replace(linkRegex, (match, href) => {
        const cssFile = findFileByPath(href);
        if (cssFile && cssFile.type === 'file' && cssFile.content) {
            return `<style>\n${cssFile.content}\n</style>`;
        }
        return match; // Keep original tag if file not found
    });

    processedHtml = processedHtml.replace(scriptRegex, (match, src) => {
        const jsFile = findFileByPath(src);
        if (jsFile && jsFile.type === 'file' && jsFile.content) {
            return `<script>\n${jsFile.content}\n</script>`;
        }
        return match; // Keep original tag if file not found
    });

    return processedHtml;
  };
  
  const handleDownloadProject = () => {
    const zip = new JSZip();

    function addFilesToZip(nodes: FileNode[], path: string) {
        for (const node of nodes) {
            const currentPath = path ? `${path}/${node.name}` : node.name;
            if (node.type === 'folder') {
                if(node.children) addFilesToZip(node.children, currentPath);
            } else if (node.content !== undefined) {
                zip.file(currentPath, node.content);
            }
        }
    }
    
    addFilesToZip(files, '');

    zip.generateAsync({ type: 'blob' }).then(function (content: any) {
      FileSaver.saveAs(content, 'cosmic-ai-project.zip');
    });
  };

  return (
    <div className="flex h-screen w-screen text-soft-white font-sans bg-background overflow-hidden">
      <FileExplorer
        files={files}
        onFileSelect={handleFileSelect}
        activeFileId={activeFileId}
        onDownloadProject={handleDownloadProject}
        onAddItem={handleAddItem}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex-shrink-0 flex items-center justify-between p-2 border-b border-white/10 bg-surface/50">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-lavender-glow to-cyan-glow">
            Cosmic AI Builder
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${viewMode === 'editor' ? 'bg-primary text-white shadow-glow-purple' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <CodeIcon /> Editor
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${viewMode === 'preview' ? 'bg-primary text-white shadow-glow-purple' : 'bg-white/5 hover:bg-white/10'}`}
            >
              <EyeIcon /> Preview
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {viewMode === 'editor' ? (
            <CodeEditor
              activeFile={activeFile}
              onContentChange={handleContentChange}
              openFiles={openFiles}
              onFileSelect={handleFileSelect}
              onCloseFile={handleCloseFile}
            />
          ) : (
            <Preview htmlContent={buildPreviewContent()} onError={handlePreviewError} />
          )}
        </div>
      </main>
      <ChatAssistant
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        models={AI_MODELS}
      />
    </div>
  );
};

export default App;