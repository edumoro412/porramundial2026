import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { UserSimple } from '../../interface/user';
import { interval, Subscription } from 'rxjs';
import { LigaContent } from '../../interface/response';
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
    this.loading.set(false);

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
