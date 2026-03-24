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

export interface MatchContent {
  match_id: string;
  phase: string;
  home_team_id: string;
  home_team_name: string;
  home_team_img: string;
  home_team_short_name: string;
  away_team_id: string;
  away_team_name: string;
  away_team_img: string;
  away_team_short_name: string;
  real_score_home?: number;
  real_score_away?: number;
  played_at?: string;
}
