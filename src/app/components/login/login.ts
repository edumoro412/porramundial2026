import { Component } from '@angular/core';
import { AuthLayout } from '../../layouts/auth-layout/auth-layout';

@Component({
  selector: 'app-login',
  imports: [AuthLayout],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {}
