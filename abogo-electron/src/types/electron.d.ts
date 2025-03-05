// Global type declarations for Electron API
declare global {
  interface Window {
    electron?: {
      saveAudioFile: (options: {
        buffer: ArrayBuffer;
        filename: string;
      }) => Promise<string>;
      openExternal: (url: string) => void;
      onAuthToken: (callback: (token: string) => void) => void;
      getAuthToken: () => Promise<string>;
      clearAuthToken: () => Promise<boolean>;
    };
  }
}

export {};
