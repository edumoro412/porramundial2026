export interface UserSimple {
  name: string;
  avatar_url?: string;
  id: string;
  is_admin?: boolean;
}

export interface UserSimples extends UserSimple {
  points?: number;
}
