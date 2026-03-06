import React from 'react';
import SinglePaneApp from './SinglePaneApp';
import { AppProvider } from './contexts/AppContext';
import { DialogProvider } from './contexts/DialogContext';

export const Router: React.FC = () => {
  return (
    <AppProvider>
      <DialogProvider>
        <SinglePaneApp />
      </DialogProvider>
    </AppProvider>
  );
};
