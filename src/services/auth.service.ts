import { Injectable } from '@angular/core';
import { createClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environments';
import { Liga, RegisterResponse } from '../app/interface/response';
import { UserSimple } from '../app/interface/user';

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
}
