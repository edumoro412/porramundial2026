import { Injectable } from '@angular/core';
import { createClient, User } from '@supabase/supabase-js';
import { environment } from '../environments/environments';

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

  async register(email: string, password: string, name: string) {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (data.user) {
      await this.supabase.from('profiles').insert({
        id: data.user.id,
        name,
      });
    }

    console.log(data);
    return data;
  }

  async getCurrentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }
}
