import { Component } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { AuthLayout } from '../../layouts/auth-layout/auth-layout';

@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, AuthLayout],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  form: FormGroup;
  loading = false;
  successMsg = '';
  errorMsg = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.errorMsg = '';
    this.successMsg = '';

    const res = await this.auth.resetPassword(this.form.value.email);
    this.loading = false;

    if (res.success) {
      this.successMsg =
        '📧 ¡Email enviado! Revisa tu bandeja de entrada (y el spam, por si acaso 😅)';
    } else {
      this.errorMsg = 'Algo salió mal. Comprueba que el email es correcto.';
    }
  }
}
