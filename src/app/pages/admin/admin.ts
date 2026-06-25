import { Component, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { UserSimple } from '../../interface/user';
import { Router } from '@angular/router';
import { MatchContent, TeamInterface } from '../../interface/response';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class Admin implements OnInit {
  loading = signal<boolean>(false);
  saving = signal<boolean>(false);
  savingGroup = signal<boolean>(false);

  teams: TeamInterface[] = [];
  matches: MatchContent[] = [];
  teamNames = new Map<number, string>();

  winnerTeamId = signal<number | null>(null);
  topScorer = signal<string>('');
  selectedWinnerId: number | null = null;
  topScorerInput: string = '';

  groupMap: { [letter: string]: TeamInterface[] } = {};
  groupLetters: string[] = [];
  selectedGroup = signal<string>('');

  // Posiciones temporales del grupo seleccionado (no se guardan hasta pulsar el botón)
  tempPositions: { [team_id: number]: number | null } = {};

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    try {
      this.loading.set(true);

      const user: UserSimple | null = await this.auth.getCurrentSimpleUser();
      if (!user?.is_admin) {
        this.router.navigateByUrl('/');
        return;
      }

      const [teamsResponse, matchesResponse, winnerTeamId, scorer] =
        await Promise.all([
          this.auth.getTeams(),
          this.auth.getMatchesPlaying(),
          this.auth.getWinnerTeam(),
          this.auth.getTournamentScorer(),
        ]);

      if (teamsResponse) {
        this.teams = teamsResponse;
        for (const team of this.teams) {
          this.teamNames.set(team.team_id, team.name);
        }
        this.buildGroupMap();
      }

      if (matchesResponse) this.matches = matchesResponse;

      if (winnerTeamId != null) {
        this.winnerTeamId.set(winnerTeamId);
        this.selectedWinnerId = winnerTeamId;
      }

      if (scorer) {
        this.topScorer.set(scorer);
        this.topScorerInput = scorer;
      }
    } catch (error) {
      console.error(error);
    } finally {
      this.loading.set(false);
    }
  }

  buildGroupMap() {
    this.groupMap = {};
    for (const team of this.teams) {
      const g = team.group_letter;
      if (!this.groupMap[g]) this.groupMap[g] = [];
      this.groupMap[g].push(team);
    }
    this.groupLetters = Object.keys(this.groupMap).sort();
    if (this.groupLetters.length) {
      this.selectedGroup.set(this.groupLetters[0]);
      this.initTempPositions();
    }
  }

  selectGroup(letter: string) {
    this.selectedGroup.set(letter);
    this.initTempPositions();
  }

  initTempPositions() {
    this.tempPositions = {};
    const teams = this.groupMap[this.selectedGroup()] ?? [];
    for (const team of teams) {
      this.tempPositions[team.team_id] = (team as any).group_position ?? null;
    }
  }

  getGroupTeams(): TeamInterface[] {
    return (this.groupMap[this.selectedGroup()] ?? []).slice().sort((a, b) => {
      const pa = (a as any).group_position ?? 99;
      const pb = (b as any).group_position ?? 99;
      return pa - pb;
    });
  }

  async guardarGrupo() {
    const teams = this.groupMap[this.selectedGroup()] ?? [];
    const positions = teams.map((t) => this.tempPositions[t.team_id]);

    if (positions.some((p) => !p)) {
      alert('Asigna una posición a los 4 equipos antes de guardar');
      return;
    }

    const unique = new Set(positions);
    if (unique.size !== 4) {
      alert(
        'Hay posiciones duplicadas, cada equipo debe tener una posición distinta',
      );
      return;
    }

    this.savingGroup.set(true);
    try {
      // Guardar SECUENCIALMENTE, no en paralelo, para evitar la condición de carrera
      // en el trigger que comprueba si los 4 equipos del grupo ya están completos.
      for (const t of teams) {
        const result = await this.auth.saveTeamGroupPosition(
          t.team_id,
          this.tempPositions[t.team_id]!,
        );
        if (!result.success) {
          alert('Error al guardar: ' + result.message);
          return;
        }
      }

      for (const team of teams) {
        (team as any).group_position = this.tempPositions[team.team_id];
      }

      alert('Grupo guardado correctamente ✅');
    } catch (e) {
      alert('Error inesperado al guardar');
    } finally {
      this.savingGroup.set(false);
    }
  }

  async guardarCampeonYGoleador() {
    if (!this.selectedWinnerId) {
      alert('Selecciona un equipo campeón');
      return;
    }
    if (!this.topScorerInput.trim()) {
      alert('Escribe el nombre del máximo goleador');
      return;
    }
    this.saving.set(true);
    const res = await this.auth.addTournamentWinnerScorer(
      Number(this.selectedWinnerId),
      this.topScorerInput.trim(),
    );
    this.saving.set(false);
    if (res.success) {
      this.winnerTeamId.set(Number(this.selectedWinnerId));
      this.topScorer.set(this.topScorerInput.trim());
      alert('Campeón y goleador guardados');
    } else {
      alert(res.message);
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
    if (response.success) alert('Partido añadido con éxito');
    else console.log(response.message);
  }

  getName(id: number): string {
    return this.teamNames.get(Number(id)) ?? 'Desconocido';
  }

  async guardarResultado(
    match_id: Number,
    home_score: string,
    away_score: string,
    sign: string,
    winnerId: string,
  ) {
    const respuesta = await this.auth.saveResult(
      Number(match_id),
      Number(home_score),
      Number(away_score),
      sign,
      Number(winnerId),
    );
    if (respuesta.success) alert('Resultado guardado');
    else alert(respuesta.message);
  }
}
