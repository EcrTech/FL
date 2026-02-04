// Google Analytics gtag types
interface GtagEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  currency?: string;
  transaction_id?: string;
  send_to?: string;
  [key: string]: any;
}

interface Gtag {
  (command: 'js', date: Date): void;
  (command: 'config', targetId: string, config?: object): void;
  (command: 'event', eventName: string, eventParams?: GtagEventParams): void;
  (command: 'set', config: object): void;
}

// Meta (Facebook) Pixel types
type FbqStandardEvent = 
  | 'PageView'
  | 'Lead'
  | 'SubmitApplication'
  | 'CompleteRegistration'
  | 'Purchase'
  | 'InitiateCheckout'
  | 'AddToCart'
  | 'Search'
  | 'ViewContent';

interface FbqEventParams {
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  status?: string;
  [key: string]: any;
}

interface Fbq {
  (command: 'init', pixelId: string): void;
  (command: 'track', event: FbqStandardEvent, params?: FbqEventParams): void;
  (command: 'trackCustom', event: string, params?: FbqEventParams): void;
  // Generic overload for dynamic calls
  (...args: any[]): void;
  callMethod?: (...args: any[]) => void;
  queue: any[];
  push: (...args: any[]) => void;
  loaded: boolean;
  version: string;
}

declare global {
  interface Window {
    dataLayer: any[];
    gtag: Gtag;
    fbq: Fbq;
    _fbq?: Fbq;
  }
}

export {};
