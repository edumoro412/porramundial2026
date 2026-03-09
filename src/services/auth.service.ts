import { Injectable } from '@angular/core';
import { createClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environments';
import { RegisterResponse } from '../app/interface/response';
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

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<RegisterResponse> {
    const { data: existingProfile } = await this.supabase
      .from('profiles')
      .select('id')
      .eq('name', name)
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
      name,
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
}
