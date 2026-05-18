import { Component, inject, signal } from '@angular/core';
import { OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { LigaContent } from '../../interface/response';
import { UserSimples } from '../../interface/user';
import { DeleteLeague } from '../../components/modals/delete-league/delete-league';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-league-detail',
  imports: [DeleteLeague, NgClass],
  templateUrl: './league-detail.html',
  styleUrl: './league-detail.scss',
})
export class LeagueDetail implements OnInit {
  loading = signal<boolean>(false);
  private route = inject(ActivatedRoute);
  liga: LigaContent | null = null;
  players: UserSimples[] | null = null;
  user: UserSimples | null = null;
  modalOpen = signal<boolean>(false);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}
  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.user = await this.auth.getCurrentSimpleUser();
    if (!this.user) {
      this.router.navigateByUrl('/login');
    }

    try {
      const league_id = this.route.snapshot.paramMap.get('id')?.toString();

      this.liga = await this.auth.getLiga(league_id!);
      if (!this.liga) {
        this.router.navigateByUrl('/leagues');
        return;
      }
      const jugadores = await this.auth.numberOfPlayers(this.liga?.id);
      this.liga = {
        ...this.liga,
        players: jugadores ?? 0,
      };

      this.players = await this.auth.getPlayers(league_id!);
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  getRank(index: number): number {
    if (!this.players || index < 0 || index >= this.players.length) {
      return index + 1;
    }
    if (index === 0) return 1;

    const prevPoints = this.players[index - 1].points ?? 0;
    const currentPoints = this.players[index].points ?? 0;

    return currentPoints === prevPoints ? this.getRank(index - 1) : index + 1;
  }

  copyToTheClipboard(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      alert('Codigo copiado');
    });
  }

  async borrarLiga() {
    try {
      if (this.liga) {
        console.log(this.liga.id);
        await this.auth.DeleteLeague(this.liga?.id);
        console.log('Liga eliminada');
        this.router.navigateByUrl('/leagues');
      }
    } catch (error) {
      console.log('Ocurrio un error: ', error);
    }
  }

  goToUserPage(user_id: string): void {
    this.router.navigate(['/user', user_id]);
  }
}
