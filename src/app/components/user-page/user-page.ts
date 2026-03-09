import { Component, signal } from '@angular/core';
import { UserSimple } from '../../interface/user';
import { OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-page',
  imports: [],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  loading = signal(false);
  disabled = signal(false);
  user: UserSimple | null = null;
  avatarUrl = signal(this.user?.avatar_url);
  username = signal(this.user?.name);
  errorMsg = signal('');

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}
  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.user = await this.auth.getCurrentSimpleUser();
      if (!this.user) {
        this.router.navigateByUrl('/login');
      }
      this.avatarUrl.set(this.user?.avatar_url);
      this.username.set(this.user?.name);
    } catch (error) {
      console.log('Error ' + error);
    } finally {
      this.loading.set(false);
    }
  }
  async changeAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.user) return;

    try {
      const newUrl = await this.auth.uploadAvatar(file, this.user.id);
      if (newUrl) {
        this.avatarUrl.set(newUrl);
      }
    } catch (err) {
      console.log(err);
    }
  }

  async cambiarNombre(nombre: string) {
    this.errorMsg.set('');
    this.disabled.set(true);
    try {
      const user = this.user;
      if (!nombre || !user) {
        return;
      }

      const response = await this.auth.updateUserName(user.id, nombre);
      if (!response.success) {
        this.errorMsg.set(response.message);
        return;
      }
      this.username.set(nombre);
    } catch (error) {
      console.log(error);
    } finally {
      this.disabled.set(false);
    }
  }

  resetErrorMsg() {
    this.errorMsg.set('');
  }
  async logOut() {
    await this.auth.logOut();
    this.router.navigateByUrl('/login');
  }
}
