import { Component, inject, signal, OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { UserSimples } from '../../interface/user';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-ranking',
  imports: [NgClass],
  templateUrl: './ranking.html',
  styleUrl: './ranking.scss',
})
export class Ranking implements OnInit {
  loading = signal<boolean>(false);
  players: UserSimples[] = [];
  user: UserSimples | null = null;

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
        return;
      }

      this.players = await this.auth.getAllUsers();
      console.log('Todos los usuarios', this.players);
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  /*   HABLARLO CON EL TIO */

  getRank(index: number): number {
    if (index === 0) return 1;
    const current = this.players[index].points ?? 0;
    const prev = this.players[index - 1].points ?? 0;
    return current === prev ? this.getRank(index - 1) : index + 1;
  }

  goToUserPage(user_id: string): void {
    this.router.navigate(['/user', user_id]);
  }
}
