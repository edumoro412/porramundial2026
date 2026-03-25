import { Component, OnInit, signal } from '@angular/core';
import { MatchContent } from '../../interface/response';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-matches',
  imports: [],
  templateUrl: './matches.html',
  styleUrl: './matches.scss',
})
export class Matches implements OnInit {
  matches = signal<MatchContent[]>([]);
  loading = signal<boolean>(false);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const response: MatchContent[] | null = await this.auth.getMatches();
      if (!response || response.length === 0) {
        return;
      }
      this.matches.set(response);
      console.log(this.matches());
    } catch (err) {
      console.log('Error', err);
    } finally {
      this.loading.set(false);
    }
  }

  formatKickoff(kickoff: string): string {
    return new Date(kickoff).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
