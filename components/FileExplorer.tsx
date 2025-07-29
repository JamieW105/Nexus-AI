
import React, { useState } from 'react';
import { FileNode } from '../types';
import { FolderIcon, FileIcon, ChevronDownIcon, ThreeDotsIcon, DownloadIcon } from './icons';
import FileSaver from 'file-saver';


interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (id: string) => void;
  activeFileId: string | null;
  onDownloadProject: () => void;
}

const FileEntry: React.FC<{ node: FileNode; onFileSelect: (id: string) => void; activeFileId: string | null; level?: number }> = ({ node, onFileSelect, activeFileId, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(true);

  const isFolder = node.type === 'folder';
  const isActive = node.id === activeFileId;

  const handleSelect = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else {
      onFileSelect(node.id);
    }
  };

  return (
    <div>
      <div
        onClick={handleSelect}
        style={{ paddingLeft: `${level * 1.25}rem` }}
        className={`flex items-center space-x-2 p-1.5 rounded-md cursor-pointer transition-all duration-200 ${isActive ? 'bg-primary/40 shadow-glow-lavender/30' : 'hover:bg-white/10'}`}
      >
        {isFolder && <ChevronDownIcon />}
        {isFolder ? <FolderIcon /> : <FileIcon />}
        <span className="flex-grow truncate text-sm">{node.name}</span>
      </div>
      {isFolder && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileEntry key={child.id} node={child} onFileSelect={onFileSelect} activeFileId={activeFileId} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect, activeFileId, onDownloadProject }) => {
    const handleDownloadFile = (file: FileNode) => {
        if(file.type === 'file' && file.content) {
            const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
            FileSaver.saveAs(blob, file.name);
        }
    }
  return (
    <div className="w-64 h-full bg-surface/50 backdrop-blur-md border-r border-white/10 flex flex-col p-2 z-10">
      <div className="flex items-center justify-between p-2 mb-2">
        <h2 className="text-lg font-semibold text-soft-white">Explorer</h2>
        <div className="relative group">
            <button className="p-1 rounded-md hover:bg-white/10"><ThreeDotsIcon /></button>
            <div className="absolute right-0 mt-2 w-48 bg-surface rounded-md shadow-lg py-1 z-50 hidden group-hover:block border border-white/10">
                <a href="#" onClick={(e) => { e.preventDefault(); onDownloadProject(); }} className="flex items-center gap-2 px-4 py-2 text-sm text-soft-white hover:bg-primary/50">
                    <DownloadIcon /> Download Project
                </a>
            </div>
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        {files.map((node) => (
          <FileEntry key={node.id} node={node} onFileSelect={onFileSelect} activeFileId={activeFileId} />
        ))}
      </div>
    </div>
  );
};

export default FileExplorer;
