import { Component, OnInit, signal } from '@angular/core';
import { MatchContent } from '../../interface/response';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-matches',
  imports: [],
  templateUrl: './matches.html',
  styleUrl: './matches.scss',
})
export class Matches implements OnInit {
  countdowns = signal<Map<string, string>>(new Map());
  private countdownSub!: Subscription;

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
      this.matches.set(response);
      this.updateCountdowns();
      this.countdownSub = interval(1000).subscribe(() =>
        this.updateCountdowns(),
      );
    } catch (err) {
      console.log('Error', err);
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    this.countdownSub?.unsubscribe();
  }

  formatKickoff(kickoff: string): string {
    return new Date(kickoff).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  isLessThan24h(kickoff: string): boolean {
    const diff = new Date(kickoff).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  }

  private updateCountdowns(): void {
    const map = new Map<string, string>();
    this.matches().forEach((match) => {
      if (!this.isLessThan24h(match.kickoff_time)) return;
      const diff = new Date(match.kickoff_time).getTime() - Date.now();
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      map.set(match.match_id, `${h}:${m}:${s}`);
    });
    this.countdowns.set(map);
  }
}
