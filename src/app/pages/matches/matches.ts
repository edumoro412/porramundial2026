import { Component, OnInit, signal } from '@angular/core';
import { MatchContent, Prediction } from '../../interface/response';
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
  predictions = signal<Map<number, Prediction>>(new Map());

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const user = await this.auth.getCurrentSimpleUser();
      if (!user?.id) {
        this.router.navigateByUrl('/login');
        return;
      }
      const response: MatchContent[] | null = await this.auth.getMatches(
        this.phase(),
      );

      if (!response || response.length === 0) {
        return;
      }
      this.matches.set(response);

      const map = new Map<number, Prediction>();

      for (const match of response) {
        const predict = await this.auth.getMatchPrediction(
          match.match_id,
          user.id,
        );

        if (predict) {
          map.set(match.match_id, predict);
        }
      }

      this.predictions.set(map);

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

    if (!homeInput?.value || !awayInput?.value) {
      this.setError(match.match_id, 'Debes poner un resultado válido');
      return;
    }
    if (!selectInput.value) {
      this.setError(match.match_id, 'Debes poner un signo válido');
      return;
    }

    const homeScore = parseInt(homeInput.value);
    const awayScore = parseInt(awayInput.value);

    if (
      isNaN(homeScore) ||
      isNaN(awayScore) ||
      homeScore < 0 ||
      homeScore > 30 ||
      awayScore < 0 ||
      awayScore > 30
    ) {
      this.setError(match.match_id, 'Inserta un número de goles coherente');
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
      this.setError(match.match_id, response.message);
    } else {
      const newPrediction: Prediction = {
        match_id: match.match_id,
        score_home: homeScore,
        score_away: awayScore,
        sign: selectInput.value,
      };

      const updatedPredictions = new Map(this.predictions());
      updatedPredictions.set(match.match_id, newPrediction);
      this.predictions.set(updatedPredictions);

      this.errorMesage.set(new Map());
      alert('Predicción enviada correctamente');
    }
  }

  private setError(matchId: number, message: string) {
    const errors = new Map(this.errorMesage());
    errors.set(matchId, message);
    this.errorMesage.set(errors);
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

  matchPlayed(kickoff: string): boolean {
    const matchDate = new Date(kickoff);
    return new Date() > matchDate;
  }

  matchStatus(match: MatchContent): 'upcoming' | 'live' | 'finished' {
    const now = new Date();
    const kickoff = new Date(match.kickoff_time);
    const minutesElapsed = (now.getTime() - kickoff.getTime()) / 60000;

    if (match.real_score_home !== null && match.real_score_away !== null) {
      return 'finished';
    }
    if (minutesElapsed >= 0 && minutesElapsed <= 105) {
      return 'live';
    }
    return 'upcoming';
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
