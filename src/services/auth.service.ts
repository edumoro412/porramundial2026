import { Injectable } from '@angular/core';
import { createClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environments';
import {
  Liga,
  LigaContent,
  MatchContent,
  Prediction,
  RegisterResponse,
  TeamInterface,
} from '../app/interface/response';
import { UserSimple, UserSimples } from '../app/interface/user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }
    return data;
  }

  async logOut() {
    await this.supabase.auth.signOut();
  }

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<RegisterResponse> {
    const { data: existingProfile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('name', name.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return {
        success: false,
        message: 'El nombre de usuario ya está en uso.',
      };
    }

    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('already registered')) {
        return {
          success: false,
          message: 'El email ya está registrado. Inicia sesión.',
        };
      }
      return { success: false, message: error.message };
    }

    if (!data.user) {
      return { success: false, message: 'Error al crear el usuario' };
    }

    const { error: insertError } = await this.supabase.from('profiles').insert({
      id: data.user.id,
      name: name.toLowerCase(),
    });

    if (insertError) {
      return { success: false, message: insertError.message };
    }

    return { success: true, message: 'Éxito' };
  }
  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async getSession() {
    return this.supabase.auth.getSession();
  }

  async isLogged(): Promise<boolean> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    return !!session;
  }

  async getCurrentSimpleUser(): Promise<UserSimple | null> {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) return null;

    return data;
  }

  async uploadAvatar(file: File, userId: string): Promise<string | null> {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error(uploadError);
      throw uploadError;
    }

    const { data } = this.supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    const { error: dbError } = await this.supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (dbError) {
      console.error(dbError);
      throw dbError;
    }

    return publicUrl;
  }
  async updateUserName(
    user_id: string,
    name: string,
  ): Promise<RegisterResponse> {
    const { data: existing, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('name', name.toLowerCase())
      .maybeSingle();

    if (existing) {
      return { success: false, message: 'Este nombre ya esta en uso' };
    }

    const update = await this.supabase
      .from('profiles')
      .update({ name: name.toLowerCase() })
      .eq('id', user_id);

    if (update) {
      return { success: true, message: 'Cambiado con exito' };
    }

    return { success: false, message: 'Algo no salió como debería' };
  }

  async crearLiga(liga: Liga): Promise<RegisterResponse> {
    const { data: nombre } = await this.supabase
      .from('leagues')
      .select('name')
      .eq('name', liga.name.toLowerCase());

    if (nombre && nombre.length > 0) {
      return { success: false, message: 'Este nombre de liga esta ya en uso' };
    }

    const { data: codigo } = await this.supabase
      .from('leagues')
      .select('code')
      .eq('code', liga.code.toLowerCase());

    if (codigo && codigo.length > 0) {
      return { success: false, message: 'Este codigo de liga esta ya en uso' };
    }

    const user = await this.getCurrentSimpleUser();
    if (!user) {
      return {
        success: false,
        message: 'Necesitas estar registrado para crear una liga',
      };
    }

    const { data: creada, error } = await this.supabase
      .from('leagues')
      .insert({
        code: liga.code.toLowerCase(),
        name: liga.name.toLowerCase(),
        creator: user.id,
      })
      .select('id')
      .single();

    if (error || !creada) {
      return { success: false, message: 'Ocurrió un error al crear la liga' };
    }

    const { error: userLeaguesError } = await this.supabase
      .from('users_leagues')
      .insert({
        user_id: user.id,
        league_id: creada.id,
      });

    if (userLeaguesError) {
      console.error('users_leagues error:', userLeaguesError);
      return {
        success: false,
        message: 'Ocurrió un error al añadir el jugador a la liga',
      };
    }

    return {
      success: true,
      message:
        'La liga fue creada con éxito. Comparte el código con tus amigos!',
    };
  }

  async unirLiga(code: string, user_id: string): Promise<RegisterResponse> {
    const { data: id, error: error } = await this.supabase
      .from('leagues')
      .select('id')
      .eq('code', code.toLowerCase())
      .maybeSingle();

    if (error) {
      return { success: false, message: 'El código no es válido!' };
    }

    const { data: user } = await this.supabase
      .from('users_leagues')
      .select('*')
      .eq('user_id', user_id)
      .eq('league_id', id?.id)
      .maybeSingle();

    if (user) {
      return { success: false, message: 'Ya estas en la liga!' };
    }
    const { error: insertError } = await this.supabase
      .from('users_leagues')
      .insert({
        user_id: user_id.toLowerCase(),
        league_id: id?.id,
      });

    if (insertError) {
      return { success: false, message: 'Hubo un error al añadir al usuario' };
    }

    return { success: true, message: 'Te has unido a la liga!' };
  }

  async getLigas(user_id: string): Promise<LigaContent[] | null> {
    let arrayLigas: LigaContent[] = [];
    const { data: leagues_id } = await this.supabase
      .from('users_leagues')
      .select('league_id')
      .eq('user_id', user_id);
    if (leagues_id && leagues_id.length <= 0) {
      return null;
    }

    for (const league of leagues_id!) {
      const { data } = await this.supabase
        .from('leagues')
        .select('*')
        .eq('id', league.league_id);

      if (!data || data.length === 0) {
        continue;
      } else {
        const { count } = await this.supabase
          .from('users_leagues')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.league_id);

        arrayLigas.push({
          name: data[0].name,
          creator: data[0].creator,
          code: data[0].code,
          id: league.league_id,
          players: count ?? 0,
        });
      }
    }

    return arrayLigas;
  }

  async getLiga(liga_id: string): Promise<LigaContent | null> {
    const { data: liga } = await this.supabase
      .from('leagues')
      .select('*')
      .eq('id', liga_id)
      .maybeSingle();

    if (!liga || liga.length === 0) {
      return null;
    }
    return liga;
  }

  async numberOfPlayers(liga_id: string): Promise<number> {
    const { count } = await this.supabase
      .from('users_leagues')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', liga_id);

    return count ?? 0;
  }

  async getPlayers(liga_id: string): Promise<UserSimples[] | null> {
    let players: UserSimples[] = [];
    const { data: playersId } = await this.supabase
      .from('users_leagues')
      .select('user_id')
      .eq('league_id', liga_id);

    if (!playersId || playersId.length === 0) {
      return null;
    }
    for (const playerId of playersId) {
      const { data: profile } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', playerId.user_id)
        .maybeSingle();

      //Los puntos los tenemos que coger en algun mometno
      players.push({
        ...profile,
        points: 0,
      });
    }

    return players;
  }

  async DeleteLeague(liga_id: string): Promise<any> {
    console.log('Este es el servicio y este es el id: ', liga_id);
    const { data, error } = await this.supabase
      .from('leagues')
      .delete()
      .eq('id', liga_id)
      .select();

    if (error) throw error;

    return data;
  }

  async getMatches(phase?: string): Promise<MatchContent[] | null> {
    //Aqui hacemos un join, home_team es el alias tras los : va la tabla de dodne queremos sacar info que es teams. Y luego la sintaxis es tabla_columna_fkey, por eso es matches_home_team_id_fkey

    if (phase) {
      const { data, error } = await this.supabase
        .from('matches')
        .select(
          `
      match_id,
      phase,
      real_score_home,
      real_score_away,
      played_at,
      kickoff_time,
      home_team:teams!matches_home_team_id_fkey (
        team_id, name, short_name, flag_url, group_letter
      ),
      away_team:teams!matches_away_team_id_fkey (
        team_id, name, short_name, flag_url
      )
    `,
        )
        .eq('phase', phase)
        .order('kickoff_time', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      return data.map((m: any) => ({
        match_id: m.match_id,
        phase: m.phase,
        real_score_home: m.real_score_home,
        real_score_away: m.real_score_away,
        played_at: m.played_at,
        kickoff_time: m.kickoff_time,
        home_team_id: m.home_team.team_id,
        home_team_name: m.home_team.name,
        home_team_short_name: m.home_team.short_name,
        home_team_img: m.home_team.flag_url,
        away_team_id: m.away_team.team_id,
        away_team_name: m.away_team.name,
        away_team_short_name: m.away_team.short_name,
        away_team_img: m.away_team.flag_url,
        group_letter: m.home_team.group_letter ?? null,
      }));
    } else {
      const { data, error } = await this.supabase
        .from('matches')
        .select(
          `
        match_id,
        phase,
        real_score_home,
        real_score_away,
        played_at,
        kickoff_time,
        home_team:teams!matches_home_team_id_fkey (
          team_id, name, short_name, flag_url
        ),
        away_team:teams!matches_away_team_id_fkey (
          team_id, name, short_name, flag_url
        )
      `,
        )
        .order('kickoff_time', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      return data.map((m: any) => ({
        match_id: m.match_id,
        phase: m.phase,
        real_score_home: m.real_score_home,
        real_score_away: m.real_score_away,
        played_at: m.played_at,
        kickoff_time: m.kickoff_time,
        home_team_id: m.home_team.team_id,
        home_team_name: m.home_team.name,
        home_team_short_name: m.home_team.short_name,
        home_team_img: m.home_team.flag_url,
        away_team_id: m.away_team.team_id,
        away_team_name: m.away_team.name,
        away_team_short_name: m.away_team.short_name,
        away_team_img: m.away_team.flag_url,
      }));
    }
  }

  async sendMatchPrediction(
    match_id: number,
    score_home: number,
    score_away: number,
    user_id: string,
    sign: string,
    winner_team_id?: number | null,
  ): Promise<RegisterResponse> {
    const { data: existing, error: selectError } = await this.supabase
      .from('match_predictions')
      .select('*')
      .eq('user_id', user_id)
      .eq('match_id', match_id)
      .maybeSingle();

    if (selectError) {
      return {
        success: false,
        message: 'Ocurrió un error inesperado al buscar la predicción',
      };
    }

    const payload: any = {
      predicted_score_home: score_home,
      predicted_score_away: score_away,
      predicted_sign: sign,
    };

    if (winner_team_id !== undefined) {
      payload.predicted_winner_team_id = winner_team_id;
    }

    if (existing) {
      const { error } = await this.supabase
        .from('match_predictions')
        .update(payload)
        .eq('user_id', user_id)
        .eq('match_id', match_id);

      if (error)
        return {
          success: false,
          message: 'Hubo un error al actualizar tu predicción',
        };
      return { success: true, message: 'Predicción actualizada' };
    }

    const { error } = await this.supabase
      .from('match_predictions')
      .insert({ user_id, match_id, ...payload });

    if (error)
      return {
        success: false,
        message: 'Hubo un error al insertar la predicción',
      };
    return { success: true, message: 'Predicción guardada' };
  }

  async getMatchPrediction(
    match_id: number,
    user_id: string,
  ): Promise<Prediction | null> {
    const { data, error } = await this.supabase
      .from('match_predictions')
      .select(
        'predicted_score_home, predicted_score_away, predicted_sign, predicted_winner_team_id',
      )
      .eq('match_id', match_id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (error) return null;

    return {
      match_id,
      score_home: data?.predicted_score_home,
      score_away: data?.predicted_score_away,
      sign: data?.predicted_sign,
      winner_team_id: data?.predicted_winner_team_id ?? null,
    };
  }

  async getTeams(): Promise<TeamInterface[] | null> {
    const { data, error } = await this.supabase.from('teams').select('*');

    if (error) {
      return null;
    }

    return data;
  }

  async addMatch(
    home_team_id: number,
    away_team_id: number,
    kickoff: string,
    phase: string,
  ): Promise<RegisterResponse> {
    const { data, error } = await this.supabase.from('matches').insert({
      phase: phase,
      home_team_id: home_team_id,
      away_team_id: away_team_id,
      kickoff_time: kickoff,
    });

    if (error) {
      return { success: false, message: 'Ocurrio un error' };
    }
    return { success: true, message: 'Partido añadido con éxito' };
  }

  async getMatchesPlaying(): Promise<MatchContent[] | null> {
    const { data, error } = await this.supabase
      .from('matches')
      .select('*')
      .is('real_score_home', null)
      .is('real_score_away', null)
      .lte('kickoff_time', new Date().toISOString());

    if (error) {
      return null;
    }

    return data;
  }

  async getTeamName(id: number): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('teams')
      .select('name')
      .eq('team_id', id)
      .maybeSingle();

    if (error) {
      return null;
    }

    return data?.name;
  }

  async saveResult(
    match_id: number,
    home_score: number,
    away_score: number,
    sign: string,
  ) {
    const { data, error } = await this.supabase
      .from('matches')
      .update({
        real_score_home: home_score,
        real_score_away: away_score,
        real_sign: sign,
      })
      .eq('match_id', match_id);

    if (error) {
      console.error('Error al guardar el resultado:', error);
      return { success: false, message: error.message };
    }

    return { success: true, data };
  }
}
