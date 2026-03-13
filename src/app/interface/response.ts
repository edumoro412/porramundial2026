export interface RegisterResponse {
  success: boolean;
  message: string;
}

export interface Liga {
  name: string;
  code: string;
  creator: string;
}

export interface LigaContent extends Liga {
  players?: number;
  id: string;
}
