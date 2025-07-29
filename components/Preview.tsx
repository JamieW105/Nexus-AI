
import React, { useRef, useEffect } from 'react';

interface PreviewProps {
  htmlContent: string;
  onError: (error: string) => void;
}

const Preview: React.FC<PreviewProps> = ({ htmlContent, onError }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
  
    useEffect(() => {
        if (iframeRef.current) {
            iframeRef.current.srcdoc = htmlContent;

            const handleLoad = () => {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    // Reset previous error handler to avoid duplicates
                    iframeRef.current.contentWindow.onerror = null;
                    
                    // Add new error handler
                    iframeRef.current.contentWindow.onerror = (message, source, lineno, colno, error) => {
                        onError(`Error in preview: ${message} at line ${lineno}, column ${colno}`);
                        return true; // Prevents the browser's default error handling
                    };
                }
            };

            const currentIframe = iframeRef.current;
            currentIframe.addEventListener('load', handleLoad);

            return () => {
                if (currentIframe) {
                    currentIframe.removeEventListener('load', handleLoad);
                }
            };
        }
    }, [htmlContent, onError]);
    
  return (
    <div className="w-full h-full p-4 bg-black/20 flex items-center justify-center">
      <div className="w-full h-full bg-white rounded-lg shadow-2xl shadow-black/50 ring-1 ring-inset ring-white/10 overflow-hidden">
        <iframe
          ref={iframeRef}
          title="Live Preview"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </div>
  );
};

export default Preview;
