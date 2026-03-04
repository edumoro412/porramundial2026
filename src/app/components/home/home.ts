import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  loading: boolean = false;
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    console.log('Loading true' + this.loading);
    this.loading = true;
    console.log('Loading' + this.loading);
    try {
      const logged = await this.auth.isLogged();
      if (!logged) {
        this.loading = false;
        this.router.navigateByUrl('/login');
        return;
      }
      this.loading = false;
    } catch (err: any) {
      console.error(err.message);
    } finally {
      this.loading = false;
      console.log('lOading false' + this.loading);
    }
  }
}
