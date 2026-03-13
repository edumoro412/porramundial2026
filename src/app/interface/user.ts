export interface UserSimple {
  name: string;
  avatar_url?: string;
  id: string;
}

export interface UserSimples extends UserSimple {
  points?: number;
}
