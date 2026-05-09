import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { UserSimple } from '../../interface/user';
import { interval, Subscription } from 'rxjs';
import { LigaContent, TeamInterface } from '../../interface/response';
import { CardLeague } from '../../components/card-league/card-league';

@Component({
  selector: 'app-home',
  imports: [CommonModule, CardLeague],
  templateUrl: './home.html',
  styleUrls: ['./home.scss'],
})
export class Home implements OnInit, OnDestroy {
  copyToTheClipboard(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      alert('Codigo copiado');
    });
  }
  loading = signal(true);
  user: UserSimple | null = null;
  leagues = signal<LigaContent[] | null>(null);
  teams = signal<TeamInterface[] | null>(null);
  winner_team = signal<number | null>(null);
  top_scorer = signal<string | null>(null);

  days = signal('000');
  hours = signal('00');
  minutes = signal('00');
  seconds = signal('00');
  private target = new Date('2026-06-11T20:00:00');
  private countdownSub!: Subscription;

  constructor(
    private auth: AuthService,
    public router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const { data } = await this.auth.getSession();
    this.user = await this.auth.getCurrentSimpleUser();

    if (!data.session) {
      await this.router.navigateByUrl('/login');
      return;
    }

    if (!this.user?.id) {
      await this.router.navigateByUrl('/login');
      return;
    }
    const ligas = await this.auth.getLigas(this.user?.id);
    console.log('Estas son la sligas', ligas);
    this.leagues.set(ligas ?? []);
    console.log('prueba', this.leagues());
    const teams = await this.auth.getTeams();
    this.teams.set(teams);

    const winner_team = await this.auth.getWinner(this.user.id);
    this.loading.set(false);
    this.winner_team.set(winner_team);

    const top_scorer = await this.auth.getScorer(this.user.id);
    this.top_scorer.set(top_scorer);
    this.updateCountdown();
    this.countdownSub = interval(1000).subscribe(() => this.updateCountdown());
  }

  ngOnDestroy(): void {
    this.countdownSub?.unsubscribe();
  }

  private updateCountdown(): void {
    const diff = this.target.getTime() - new Date().getTime();
    if (diff <= 0) return;

    this.days.set(String(Math.floor(diff / 86400000)).padStart(2, '0'));
    this.hours.set(
      String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'),
    );
    this.minutes.set(
      String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
    );
    this.seconds.set(
      String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    );
  }

  async saveSpecialPredictions(
    team_id: HTMLSelectElement,
    scorer: HTMLInputElement,
  ) {
    const winnerId = team_id.value ? Number(team_id.value) : null;
    const top_scorer = scorer.value.trim() || null;

    if ((winnerId == null && top_scorer == null) || !this.user?.id) {
      alert('❌ ¡No hay datos que actualizar!');
    } else {
      const response = await this.auth.saveSpecialPredictions(
        this.user.id,
        winnerId,
        top_scorer,
      );
      if (!response.success) {
        alert(response.message);
      } else {
        alert(response.message);
      }
    }
  }

  redirectInstrucciones() {
    console.log('Hubo vclick');
    this.router.navigateByUrl('/instructions');
  }

  goToUnirse() {
    this.router.navigate(['/leagues'], {
      fragment: 'unirseLiga',
    });
  }
  goToCrear() {
    this.router.navigate(['/leagues'], { fragment: 'crearLiga' });
  }
}
