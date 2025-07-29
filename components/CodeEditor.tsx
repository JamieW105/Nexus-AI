
import React from 'react';
import { FileNode } from '../types.ts';
import { CloseIcon, FileIcon } from './icons.tsx';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  activeFile: FileNode | null;
  onContentChange: (id: string, content: string) => void;
  openFiles: FileNode[];
  onFileSelect: (id: string) => void;
  onCloseFile: (id: string) => void;
}

const getLanguageFromFileName = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'html': return 'html';
    case 'css': return 'css';
    case 'js': return 'javascript';
    case 'json': return 'json';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'md': return 'markdown';
    default: return 'plaintext';
  }
};

const CodeEditor: React.FC<CodeEditorProps> = ({ activeFile, onContentChange, openFiles, onFileSelect, onCloseFile }) => {
  
  const handleTabClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onFileSelect(id);
  }

  const handleCloseClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onCloseFile(id);
  }

  return (
    <div className="w-full h-full flex flex-col bg-surface/70">
        <div className="flex-shrink-0 flex items-center border-b border-white/10 bg-surface/50 overflow-x-auto">
            {openFiles.map(file => (
                <div
                    key={file.id}
                    onClick={(e) => handleTabClick(e, file.id)}
                    className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-r border-white/10 cursor-pointer transition-colors duration-200 whitespace-nowrap ${activeFile?.id === file.id ? 'bg-primary/30 text-cyan-glow' : 'text-light-gray hover:bg-white/5'}`}
                >
                    <FileIcon />
                    <span className="text-sm">{file.name}</span>
                    <button 
                      onClick={(e) => handleCloseClick(e, file.id)} 
                      className="ml-2 p-0.5 rounded-full hover:bg-white/20 transition-colors"
                    >
                        <CloseIcon />
                    </button>
                </div>
            ))}
        </div>
        <div className="flex-1 w-full overflow-hidden">
            {activeFile && activeFile.type === 'file' ? (
                <Editor
                    key={activeFile.id}
                    height="100%"
                    language={getLanguageFromFileName(activeFile.name)}
                    value={activeFile.content}
                    onChange={(value) => {
                        if (value !== undefined) {
                            onContentChange(activeFile.id, value);
                        }
                    }}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: true, side: 'right' },
                        fontSize: 14,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        glyphMargin: false,
                        folding: false,
                        lineNumbersMinChars: 3,
                        padding: { top: 16 },
                        fontFamily: '"JetBrains Mono", monospace'
                    }}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-light-gray">
                    {activeFile ? 'Folders cannot be edited. Please select a file.' : 'Select a file to view or edit.'}
                </div>
            )}
        </div>
    </div>
  );
};

export default CodeEditor;