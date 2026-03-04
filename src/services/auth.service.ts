import { Injectable } from '@angular/core';
import { createClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environments';
import { RegisterResponse } from '../app/interface/response';

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
  ): Promise<RegisterResponse | undefined> {
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
      } else {
        return { success: false, message: error.message };
      }
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

    return { success: true, message: 'Exito' };
  }

  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  async isLogged(): Promise<boolean> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    return !!session;
  }
}
