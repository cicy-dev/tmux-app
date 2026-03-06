import React from 'react';
import SinglePaneApp from './SinglePaneApp';
import { AppProvider } from './contexts/AppContext';
import { DialogProvider } from './contexts/DialogContext';
import { PaneProvider } from './contexts/PaneContext';

export const Router: React.FC = () => {
  return (
    <AppProvider>
      <PaneProvider>
        <DialogProvider>
          <SinglePaneApp />
        </DialogProvider>
      </PaneProvider>
    </AppProvider>
  );
};
