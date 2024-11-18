export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ProxyRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}
