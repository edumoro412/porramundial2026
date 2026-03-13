import { Component, inject, signal } from '@angular/core';
import { OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { LigaContent } from '../../interface/response';
import { UserSimples } from '../../interface/user';

@Component({
  selector: 'app-league-detail',
  imports: [],
  templateUrl: './league-detail.html',
  styleUrl: './league-detail.scss',
})
export class LeagueDetail implements OnInit {
  loading = signal<boolean>(false);
  private route = inject(ActivatedRoute);
  liga: LigaContent | null = null;
  players: UserSimples[] | null = null;
  //Tengo que guardar el players, y llamar a la funcion getPlayers

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}
  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    const user = this.auth.getCurrentSimpleUser();
    if (!user) {
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

  copyToTheClipboard(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      alert('Codigo copiado');
    });
  }
}
