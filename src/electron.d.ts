// Extend CSSProperties to support Electron's -webkit-app-region
import 'react';

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}
