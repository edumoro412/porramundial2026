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

  phase = signal<string>('');
  matches = signal<MatchContent[]>([]);
  loading = signal<boolean>(false);
  errorMesage = signal<Map<number, string>>(new Map());

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const response: MatchContent[] | null = await this.auth.getMatches(
        this.phase(),
      );
      if (!response || response.length === 0) {
        return;
      }
      this.matches.set(response);
      console.log(this.matches());
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

  async searchMatches(phase: string) {
    this.matches.set([]);

    const response: MatchContent[] | null = await this.auth.getMatches(phase);

    if (!response || response.length === 0) {
      return;
    }
    this.matches.set(response);
  }

  async uploadPrediction(match: MatchContent) {
    const user = await this.auth.getCurrentSimpleUser();
    if (!user?.id) {
      this.router.navigateByUrl('/login');
      return;
    }

    const homeInput = document.getElementById(
      match.match_id + '-home',
    ) as HTMLInputElement;
    const awayInput = document.getElementById(
      match.match_id + '-away',
    ) as HTMLInputElement;
    const selectInput = document.getElementById(
      match.match_id + '-select',
    ) as HTMLSelectElement;

    if (!homeInput?.value || !awayInput?.value || !selectInput?.value) {
      const errors = new Map(this.errorMesage());
      errors.set(match.match_id, 'Debes poner un resultado válido');
      this.errorMesage.set(errors);
      return;
    }

    const homeScore = parseInt(homeInput.value);
    const awayScore = parseInt(awayInput.value);
    if (homeScore < 0 || homeScore > 30 || awayScore < 0 || awayScore > 30) {
      const errors = new Map(this.errorMesage());
      errors.set(match.match_id, 'Inserta un número de goles coherente');
      this.errorMesage.set(errors);

      return;
    }

    if (isNaN(homeScore) || isNaN(awayScore)) {
      const errors = new Map(this.errorMesage());
      errors.set(match.match_id, 'Los goles deben de ser números');
      this.errorMesage.set(errors);
      return;
    }

    const response = await this.auth.sendMatchPrediction(
      match.match_id,
      homeScore,
      awayScore,
      user.id,
      selectInput.value,
    );

    if (!response.success) {
      const errors = new Map(this.errorMesage());
      errors.set(match.match_id, response.message);
      this.errorMesage.set(errors);
      console.log('Algo esta fallando');
    } else {
      this.errorMesage.set(new Map()); // limpia error
      alert('Predicción enviada correctamente');
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

  clearError(matchId: number) {
    const errors = new Map(this.errorMesage());
    errors.delete(matchId);
    this.errorMesage.set(errors);
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
      map.set(match.match_id.toString(), `${h}:${m}:${s}`);
    });
    this.countdowns.set(map);
  }
}
