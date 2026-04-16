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

export interface TeamInterface {
  team_id: number;
  name: string;
  short_name: string;
  flag_url: string;
  group_letter: string;
  group_position: number | null;
}
export interface MatchContent {
  match_id: number;
  phase: string;
  home_team_id: number;
  home_team_name: string;
  home_team_img: string;
  home_team_short_name: string;
  away_team_id: number;
  away_team_name: string;
  away_team_img: string;
  away_team_short_name: string;
  real_score_home: number | null;
  real_score_away: number | null;
  real_winner_team_id: number | null;
  played_at?: string;
  kickoff_time: string;
  group_letter?: string;
}

export interface Prediction {
  match_id: number;
  score_home: number;
  score_away: number;
  sign: string;
  winner_team_id?: number | null;
}
