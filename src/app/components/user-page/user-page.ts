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

  constructor(private auth: AuthService) {}
  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.user = await this.auth.getCurrentSimpleUser();
    } catch (error) {
      console.log('Error ' + error);
    } finally {
      this.loading.set(false);
    }
  }
  async changeAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.user) return;

    this.auth.uploadAvatar(file, this.user.id);
  }
}
