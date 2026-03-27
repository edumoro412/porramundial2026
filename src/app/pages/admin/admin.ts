import { Component, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { UserSimple } from '../../interface/user';
import { Router } from '@angular/router';
import { MatchContent, TeamInterface } from '../../interface/response';

@Component({
  selector: 'app-admin',
  imports: [],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  loading = signal<boolean>(false);
  teams: TeamInterface[] = [];
  matches: MatchContent[] = [];
  teamNames = new Map<number, string>();

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    try {
      this.loading.set(true);
      const user: UserSimple | null = await this.auth.getCurrentSimpleUser();
      if (user?.id != 'b3c18940-f442-4892-a970-d23b73698062') {
        this.router.navigateByUrl('/');
        return;
      }

      const teamsResponse = await this.auth.getTeams();
      if (!teamsResponse) return;

      this.teams = teamsResponse;

      for (const team of this.teams) {
        this.teamNames.set(team.team_id, team.name);
      }

      const matchesResponse = await this.auth.getMatchesPlaying();
      if (!matchesResponse) {
        return;
      }
      this.matches = matchesResponse;
      console.log(
        'estos son los partidos que estn en juego sin resultado',
        this.matches,
      );

      return;
    } catch (error) {
      console.log(error);
    } finally {
      this.loading.set(false);
    }
  }

  async anadirPartido(
    home_team_id: string,
    away_team_id: string,
    phase: string,
    kickoff: string,
  ) {
    if (!kickoff) {
      alert('Por favor, selecciona una fecha y hora.');
      return;
    }

    const kickoff_time = new Date(kickoff).toISOString();

    const response = await this.auth.addMatch(
      Number(home_team_id),
      Number(away_team_id),
      kickoff_time,
      phase,
    );

    if (response.success) {
      alert('Partido añadido con éxito');
    } else {
      console.log(response.message);
    }
  }

  getName(id: string): string {
    return this.teamNames.get(Number(id)) ?? 'Desconocido';
  }

  async guardarResultado(
    match_id: Number,
    home_score: string,
    away_score: string,
    sign: string,
  ) {
    const respuesta = await this.auth.saveResult(
      Number(match_id),
      Number(home_score),
      Number(away_score),
      sign,
    );

    if (respuesta.success) {
      alert('Resultado guardado');
    } else {
      alert(respuesta.message);
    }
  }
}
