import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home implements OnInit {
  loading = signal(true);
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    console.log('CONSTRUCTOR HOME');
  }

  async ngOnInit(): Promise<void> {
    const { data } = await this.auth.getSession();

    if (!data.session) {
      await this.router.navigateByUrl('/login');
      return;
    }

    this.loading.set(false);
  }
}
