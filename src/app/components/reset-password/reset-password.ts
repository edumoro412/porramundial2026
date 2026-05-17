import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environments';
import { AuthLayout } from '../../layouts/auth-layout/auth-layout';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, AuthLayout],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss',
})
export class ResetPassword implements OnInit {
  form: FormGroup;
  loading = false;
  successMsg = '';
  errorMsg = '';
  private supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  constructor(
    private fb: FormBuilder,
    private router: Router,
  ) {
    this.form = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordsMatch },
    );
  }

  async ngOnInit() {
    // Supabase manda el token en el hash — hay que procesarlo
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }
  }

  passwordsMatch(group: FormGroup) {
    const pw = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pw === confirm ? null : { mismatch: true };
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    const { error } = await this.supabase.auth.updateUser({
      password: this.form.value.password,
    });

    this.loading = false;

    if (error) {
      this.errorMsg = error.message;
    } else {
      this.successMsg = '✅ Contraseña actualizada correctamente';
      setTimeout(() => this.router.navigateByUrl('/login'), 2000);
    }
  }
}
