export interface UserSimple {
  name: string;
  avatar_url?: string;
  id: string;
}

export interface User extends UserSimple {
  points?: number;
}
