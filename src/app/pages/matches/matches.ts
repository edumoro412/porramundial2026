import { Component, OnInit, signal } from '@angular/core';
import { MatchContent, Prediction } from '../../interface/response';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { NgClass } from '@angular/common';
import { KeyValuePipe } from '@angular/common';

@Component({
  selector: 'app-matches',
  imports: [KeyValuePipe],
  templateUrl: './matches.html',
  styleUrl: './matches.scss',
})
export class Matches implements OnInit {
  countdowns = signal<Map<string, string>>(new Map());
  private countdownSub!: Subscription;

  phase = signal<string>('');
  matches = signal<MatchContent[]>([]);
  loading = signal<boolean>(false);
  isTransitioning = signal<boolean>(false);
  errorMesage = signal<Map<number, string>>(new Map());
  predictions = signal<Map<number, Prediction>>(new Map());
  isSavingAll = signal<boolean>(false);

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

      if (!response || response.length === 0) return;

      this.matches.set(response);
      console.log(this.matches()[0]);

      const map = new Map<number, Prediction>();
      for (const match of response) {
        const predict = await this.auth.getMatchPrediction(
          match.match_id,
          user.id,
        );
        if (predict) map.set(match.match_id, predict);
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

  changePhase(phase: string) {
    this.phase.set(phase);
  }

  get matchesByGroup(): Map<string, MatchContent[]> {
    const map = new Map<string, MatchContent[]>();

    for (const match of this.matches()) {
      const key = match.group_letter
        ? `Grupo ${match.group_letter}`
        : 'Sin grupo';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(match);
    }

    return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  async searchMatches(phase: string) {
    this.isTransitioning.set(true);

    await new Promise((resolve) => setTimeout(resolve, 300));

    this.matches.set([]);
    const response: MatchContent[] | null = await this.auth.getMatches(phase);

    if (response && response.length > 0) {
      this.matches.set(response);
    }

    setTimeout(() => this.isTransitioning.set(false), 50);
  }

  async uploadAllPredictions() {
    this.isSavingAll.set(true);

    const allMatches =
      this.phase() === 'grupos'
        ? [...(Object.values(this.matchesByGroup) as MatchContent[][])].flat()
        : this.matches();

    const pendingMatches = allMatches.filter(
      (match) => !this.matchPlayed(match.kickoff_time),
    );

    let successCount = 0;
    let errorCount = 0;

    for (const match of pendingMatches) {
      const result = await this.uploadPrediction(match, true);
      if (result === true) successCount++;
      else if (result === false) errorCount++;
    }

    this.isSavingAll.set(false);

    if (errorCount === 0 && successCount > 0) {
      alert(`✅ ${successCount} predicción(es) guardadas correctamente`);
    } else if (successCount === 0 && errorCount === 0) {
      alert('No hay predicciones nuevas que guardar');
    } else {
      alert(
        `✅ ${successCount} guardadas correctamente\n❌ ${errorCount} con errores`,
      );
    }
  }

  async uploadPrediction(
    match: MatchContent,
    silent = false,
  ): Promise<boolean | void> {
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
    const winnerInput = document.getElementById(
      match.match_id + '-winner',
    ) as HTMLSelectElement;

    if (!homeInput?.value || !awayInput?.value) {
      if (!silent)
        this.setError(match.match_id, 'Debes poner un resultado válido');
      return false;
    }
    if (!selectInput?.value) {
      if (!silent) this.setError(match.match_id, 'Debes poner un signo válido');
      return false;
    }
    if (match.phase !== 'grupos' && !winnerInput?.value) {
      if (!silent)
        this.setError(match.match_id, 'Debes indicar quién crees que pasa');
      return false;
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
      if (!silent)
        this.setError(match.match_id, 'Inserta un número de goles coherente');
      return false;
    }

    const winnerId =
      match.phase !== 'grupos' && winnerInput?.value
        ? Number(winnerInput.value)
        : null;

    const response = await this.auth.sendMatchPrediction(
      match.match_id,
      homeScore,
      awayScore,
      user.id,
      selectInput.value,
      winnerId,
    );

    if (!response.success) {
      if (!silent) this.setError(match.match_id, response.message);
      return false;
    } else {
      const updatedPredictions = new Map(this.predictions());
      updatedPredictions.set(match.match_id, {
        match_id: match.match_id,
        score_home: homeScore,
        score_away: awayScore,
        sign: selectInput.value,
        winner_team_id: winnerId,
      });
      this.predictions.set(updatedPredictions);
      this.errorMesage.set(new Map());
      if (!silent) alert('Predicción enviada correctamente');
      return true;
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
    return new Date() > new Date(kickoff);
  }

  matchStatus(match: MatchContent): 'upcoming' | 'live' | 'finished' {
    const now = new Date();
    const kickoff = new Date(match.kickoff_time);
    const minutesElapsed = (now.getTime() - kickoff.getTime()) / 60000;

    if (match.real_score_home !== null && match.real_score_away !== null)
      return 'finished';
    if (minutesElapsed >= 0 && minutesElapsed <= 105) return 'live';
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

  isWinner(match: MatchContent, teamId: number): boolean {
    const winner = this.predictions().get(match.match_id)?.winner_team_id;
    if (!winner) return false;
    return winner === teamId;
  }
}
