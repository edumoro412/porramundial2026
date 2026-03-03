import { Component } from '@angular/core';
import { AuthLayout } from '../../layouts/auth-layout/auth-layout';
import { Validators } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  imports: [AuthLayout, ReactiveFormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  errorMsg: string = '';
  form!: FormGroup;
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  async onSubmit() {
    this.errorMsg = '';
    this.loading = true;

    const { name, email, password } = this.form.value;

    try {
      const response = await this.auth.register(email, password, name);
      if (response?.success) {
        this.router.navigateByUrl('/login');
      } else {
        this.errorMsg = response?.message || 'Error desconocido';
        this.form.reset();
      }
    } catch (error: any) {
      this.form.reset();
      this.errorMsg = 'Credenciales incorrectas';
    } finally {
      this.loading = false;
    }
  }
}
