import React, { forwardRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

export const isElectron = navigator.userAgent.includes('Electron');

interface WebFrameProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  loading?: 'lazy' | 'eager';
  allowFullScreen?: boolean;
  title?: string;
  codeServer?: boolean;
}

export const WebFrame = forwardRef<HTMLIFrameElement, WebFrameProps>(
  ({ src, className, style, onLoad, loading, allowFullScreen, title }, ref) => {
    const [isLoading, setIsLoading] = useState(true);

    const handleLoad = () => {
      setIsLoading(false);
      onLoad?.();
    };

    return (
      <>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-vsc-bg z-10">
            <Loader2 className="animate-spin" />
          </div>
        )}
        <iframe
          ref={ref}
          src={src}
          className={className}
          style={style}
          onLoad={handleLoad}
          loading={loading}
          allowFullScreen={allowFullScreen}
          title={title}
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
          allow="clipboard-read; clipboard-write"
        />
      </>
    );
  }
);
