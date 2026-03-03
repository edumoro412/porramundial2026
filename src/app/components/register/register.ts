import { Component } from '@angular/core';
import { AuthLayout } from '../../layouts/auth-layout/auth-layout';

@Component({
  selector: 'app-register',
  imports: [AuthLayout],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {}
