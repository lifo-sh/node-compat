export interface CommandOutputStream {
  write(text: string): void;
}

export interface VirtualRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | Uint8Array;
}

export interface VirtualResponse {
  statusCode: number;
  headers: Record<string, string>;
  body?: string | Uint8Array;
}

export type VirtualRequestHandler = (req: VirtualRequest, res: VirtualResponse) => void;
