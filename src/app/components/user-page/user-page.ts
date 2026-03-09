import { Component, signal } from '@angular/core';
import { UserSimple } from '../../interface/user';
import { OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-user-page',
  imports: [],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  loading = signal(false);
  user: UserSimple | null = null;
  avatarUrl = signal(this.user?.avatar_url);

  constructor(private auth: AuthService) {}
  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.user = await this.auth.getCurrentSimpleUser();
      this.avatarUrl.set(this.user?.avatar_url);
      console.log('Este es el usuario ' + this.user);
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
}
