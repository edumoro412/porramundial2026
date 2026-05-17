import { Component, OnInit, signal } from '@angular/core';
import {
  MatchContent,
  Prediction,
  TeamInterface,
} from '../../interface/response';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { KeyValuePipe } from '@angular/common';
import { UserSimple } from '../../interface/user';

@Component({
  selector: 'app-matches',
  imports: [KeyValuePipe],
  templateUrl: './matches.html',
  styleUrl: './matches.scss',
})
export class Matches implements OnInit {
  countdowns = signal<Map<string, string>>(new Map());
  phaseDeadlineCountdown = signal<string>('');
  private countdownSub!: Subscription;

  phase = signal<string>('grupos');
  matches = signal<MatchContent[]>([]);
  loading = signal<boolean>(false);
  isTransitioning = signal<boolean>(false);
  errorMesage = signal<Map<number, string>>(new Map());
  predictions = signal<Map<number, Prediction>>(new Map());
  isSavingAll = signal<boolean>(false);
  isSavingGroup = signal<Map<string, boolean>>(new Map());
  groupSaved = signal<Map<string, boolean>>(new Map());
  dieciseiavosButton = signal<boolean>(true);
  octavosButton = signal<boolean>(true);
  semisButton = signal<boolean>(true);
  cuartosButton = signal<boolean>(true);
  finalButton = signal<boolean>(true);
  winner_team = signal<number | null>(null);
  top_scorer = signal<string | null>(null);
  teams = signal<TeamInterface[] | null>(null);
  user: UserSimple | null = null;

  groupRankings = signal<
    Map<
      string,
      {
        team_id: number;
        short_name: string;
        img: string;
        predicted_position: number;
      }[]
    >
  >(new Map());
  isSavingRankings = signal<Map<string, boolean>>(new Map());
  rankingSaved = signal<Map<string, boolean>>(new Map());

  private dragState: {
    groupLetter: string;
    fromIndex: number;
    currentIndex: number;
  } | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const userr = await this.auth.getCurrentSimpleUser();
      if (!userr) {
        this.router.navigateByUrl('/login');
        return;
      }
      this.user = userr;

      // Una sola llamada para todos los partidos + datos en paralelo
      const [allMatches, teamsResponse, winner_team, top_scorer] =
        await Promise.all([
          this.auth.getMatches(),
          this.auth.getTeams(),
          this.auth.getWinner(userr.id),
          this.auth.getScorer(userr.id),
        ]);

      if (teamsResponse) this.teams.set(teamsResponse);
      if (winner_team != null) this.winner_team.set(winner_team);
      if (top_scorer) this.top_scorer.set(top_scorer);

      if (!allMatches || allMatches.length === 0) return;

      // Detectar qué fases tienen partidos sin llamadas extra
      const fases = allMatches.map((m) => m.phase);
      if (!fases.includes('dieciseisavos')) this.dieciseiavosButton.set(false);
      if (!fases.includes('octavos')) this.octavosButton.set(false);
      if (!fases.includes('cuartos')) this.cuartosButton.set(false);
      if (!fases.includes('semifinal')) this.semisButton.set(false);
      if (!fases.includes('final')) this.finalButton.set(false);

      // Solo partidos de grupos para mostrar inicialmente
      const response = allMatches.filter((m) => m.phase === 'grupos');
      if (response.length === 0) return;

      this.matches.set(response);

      // Una sola llamada para todas las predicciones
      const map = await this.auth.getMatchPredictions(
        response.map((m) => m.match_id),
        userr.id,
      );
      this.predictions.set(map);

      await this.loadGroupRankings(userr.id, response);
      this.updateCountdowns();
      this.updatePhaseDeadlineCountdown();
      this.countdownSub = interval(1000).subscribe(() => {
        this.updateCountdowns();
        this.updatePhaseDeadlineCountdown();
      });
    } catch (err) {
      console.error('Error en ngOnInit:', err);
    } finally {
      this.loading.set(false);
    }
  }

  async changePhase(phase: string): Promise<void> {
    this.phase.set(phase);
    await this.searchMatches(phase);
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

  async searchMatches(phase: string): Promise<void> {
    this.isTransitioning.set(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.matches.set([]);
    this.predictions.set(new Map());

    const user = await this.auth.getCurrentSimpleUser();
    if (!user?.id) {
      this.router.navigateByUrl('/login');
      return;
    }

    const response: MatchContent[] | null = await this.auth.getMatches(phase);
    if (response && response.length > 0) {
      this.matches.set(response);

      // Una sola llamada para todas las predicciones de la fase
      const map = await this.auth.getMatchPredictions(
        response.map((m) => m.match_id),
        user.id,
      );
      this.predictions.set(map);

      if (phase === 'grupos') {
        await this.loadGroupRankings(user.id, response);
      }

      this.updatePhaseDeadlineCountdown();
      this.updateCountdowns();
    }

    setTimeout(() => this.isTransitioning.set(false), 50);
  }

  async saveSpecialPredictions(
    team_id: HTMLSelectElement,
    scorer: HTMLInputElement,
  ) {
    if (this.isPhaseBlocked()) {
      alert('🔒 Las predicciones especiales están cerradas');
      return;
    }
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

  async loadGroupRankings(
    userId: string,
    matches: MatchContent[],
  ): Promise<void> {
    const groupTeams = new Map<
      string,
      { team_id: number; short_name: string; img: string }[]
    >();

    for (const match of matches) {
      if (!match.group_letter) continue;
      const key = match.group_letter;
      if (!groupTeams.has(key)) groupTeams.set(key, []);
      const arr = groupTeams.get(key)!;
      if (!arr.find((t) => t.team_id === match.home_team_id)) {
        arr.push({
          team_id: match.home_team_id,
          short_name: match.home_team_short_name,
          img: match.home_team_img,
        });
      }
      if (!arr.find((t) => t.team_id === match.away_team_id)) {
        arr.push({
          team_id: match.away_team_id,
          short_name: match.away_team_short_name,
          img: match.away_team_img,
        });
      }
    }

    // Obtener todas las clasificaciones en paralelo
    const letters = Array.from(groupTeams.keys());
    const savedResults = await Promise.all(
      letters.map((letter) =>
        this.auth.getGroupStandingsPrediction(letter, userId),
      ),
    );

    const rankingsMap = new Map<
      string,
      {
        team_id: number;
        short_name: string;
        img: string;
        predicted_position: number;
      }[]
    >();

    letters.forEach((letter, idx) => {
      const teams = groupTeams.get(letter)!;
      const saved = savedResults[idx];
      let ordered: typeof teams;
      if (saved.length > 0) {
        ordered = [...teams].sort((a, b) => {
          const posA =
            saved.find((s) => s.team_id === a.team_id)?.predicted_position ??
            99;
          const posB =
            saved.find((s) => s.team_id === b.team_id)?.predicted_position ??
            99;
          return posA - posB;
        });
      } else {
        ordered = teams;
      }
      rankingsMap.set(
        letter,
        ordered.map((t, i) => ({ ...t, predicted_position: i + 1 })),
      );
    });

    this.groupRankings.set(rankingsMap);
  }

  // ── Drag & drop ────────────────────────────────────────────────────

  onDragStart(groupLetter: string, fromIndex: number): void {
    this.dragState = { groupLetter, fromIndex, currentIndex: fromIndex };
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, groupLetter: string, toIndex: number): void {
    event.preventDefault();
    if (!this.dragState || this.dragState.groupLetter !== groupLetter) return;
    const { fromIndex } = this.dragState;
    if (fromIndex === toIndex) return;
    this.reorderGroup(groupLetter, fromIndex, toIndex);
    this.dragState = null;
  }

  onDragEnd(): void {
    this.dragState = null;
  }

  onTouchStart(
    event: TouchEvent,
    groupLetter: string,
    fromIndex: number,
  ): void {
    this.dragState = { groupLetter, fromIndex, currentIndex: fromIndex };
  }

  onTouchMove(event: TouchEvent, groupLetter: string): void {
    if (!this.dragState) return;
    const touch = event.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    const item = el.closest('[data-index]') as HTMLElement | null;
    if (!item) return;
    const toIndex = parseInt(item.dataset['index'] ?? '-1');
    if (toIndex === -1 || toIndex === this.dragState.currentIndex) return;
    this.reorderGroup(groupLetter, this.dragState.currentIndex, toIndex);
    this.dragState.currentIndex = toIndex;
  }

  onTouchEnd(): void {
    this.dragState = null;
  }

  private reorderGroup(
    groupLetter: string,
    fromIndex: number,
    toIndex: number,
  ): void {
    const map = new Map(this.groupRankings());
    const list = [...(map.get(groupLetter) ?? [])];
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    map.set(
      groupLetter,
      list.map((t, i) => ({ ...t, predicted_position: i + 1 })),
    );
    this.groupRankings.set(map);
  }

  // ──────────────────────────────────────────────────────────────────

  async saveGroup(groupLetter: string, matches: MatchContent[]): Promise<void> {
    if (this.isPhaseBlocked()) {
      alert('🔒 Las predicciones de esta fase están cerradas');
      return;
    }

    const user = await this.auth.getCurrentSimpleUser();
    if (!user?.id) {
      this.router.navigateByUrl('/login');
      return;
    }

    const saving = new Map(this.isSavingGroup());
    saving.set(groupLetter, true);
    this.isSavingGroup.set(saving);

    const pendingMatches = matches.filter(
      (m) => !this.matchPlayed(m.kickoff_time),
    );
    let errorCount = 0;
    for (const match of pendingMatches) {
      const result = await this.uploadPrediction(match, true);
      if (result === false) errorCount++;
    }

    const teams = this.groupRankings().get(groupLetter) ?? [];
    const rankings = teams.map((t) => ({
      team_id: t.team_id,
      predicted_position: t.predicted_position,
    }));

    const response = await this.auth.saveGroupStandingsPrediction(
      groupLetter,
      user.id,
      rankings,
    );

    const savingDone = new Map(this.isSavingGroup());
    savingDone.set(groupLetter, false);
    this.isSavingGroup.set(savingDone);

    if (response.success) {
      const saved = new Map(this.groupSaved());
      saved.set(groupLetter, true);
      this.groupSaved.set(saved);
      setTimeout(() => {
        const s = new Map(this.groupSaved());
        s.delete(groupLetter);
        this.groupSaved.set(s);
      }, 2500);
    }

    if (errorCount === 0) {
      alert('✅ Grupo guardado correctamente');
    } else {
      alert(
        `✅ Clasificación guardada\n⚠️ ${errorCount} predicción(es) con errores`,
      );
    }
  }

  async uploadAllPredictions(): Promise<void> {
    this.isSavingAll.set(true);

    const allMatches =
      this.phase() === 'grupos'
        ? Array.from(this.matchesByGroup.values()).flat()
        : this.matches();

    const pendingMatches = allMatches.filter(
      (match) =>
        !this.matchPlayed(match.kickoff_time) && !this.isPhaseBlocked(),
    );

    let successCount = 0;
    let errorCount = 0;

    for (const match of pendingMatches) {
      const result = await this.uploadPrediction(match, true);
      if (result === true) successCount++;
      else if (result === false) errorCount++;
    }

    if (this.phase() === 'grupos' && !this.isPhaseBlocked()) {
      const user = await this.auth.getCurrentSimpleUser();
      if (user?.id) {
        const groupLetters = Array.from(this.groupRankings().keys());
        for (const letter of groupLetters) {
          const teams = this.groupRankings().get(letter) ?? [];
          const rankings = teams.map((t) => ({
            team_id: t.team_id,
            predicted_position: t.predicted_position,
          }));
          await this.auth.saveGroupStandingsPrediction(
            letter,
            user.id,
            rankings,
          );
        }

        const champSelect = document.getElementById(
          'champSelect',
        ) as HTMLSelectElement;
        const goleador = document.getElementById(
          'goleador',
        ) as HTMLInputElement;
        if (champSelect && goleador) {
          const winnerId = champSelect.value ? Number(champSelect.value) : null;
          const scorer = goleador.value.trim() || null;
          if (winnerId != null || scorer != null) {
            await this.auth.saveSpecialPredictions(user.id, winnerId, scorer);
          }
        }
      }
    }

    this.isSavingAll.set(false);

    if (errorCount === 0) {
      alert('✅ Todo guardado correctamente');
    } else {
      alert(`✅ ${successCount} guardadas\n❌ ${errorCount} con errores`);
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

  private setError(matchId: number, message: string): void {
    const errors = new Map(this.errorMesage());
    errors.set(matchId, message);
    this.errorMesage.set(errors);
  }

  ngOnDestroy(): void {
    this.countdownSub?.unsubscribe();
  }

  formatKickoff(kickoff: string): string {
    return new Date(kickoff).toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  matchPlayed(kickoff: string): boolean {
    return new Date() > new Date(kickoff);
  }

  isPhaseBlocked(): boolean {
    const matches = this.matches();
    if (!matches || matches.length === 0) return false;
    const futureKickoffs = matches
      .map((m) => new Date(m.kickoff_time).getTime())
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b);
    if (futureKickoffs.length === 0) return true;
    const hoursUntilFirst = (futureKickoffs[0] - Date.now()) / (1000 * 60 * 60);
    return hoursUntilFirst < 3;
  }

  isInputDisabled(kickoff: string): boolean {
    return this.matchPlayed(kickoff) || this.isPhaseBlocked();
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

  clearError(matchId: number): void {
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

  private updatePhaseDeadlineCountdown(): void {
    const matches = this.matches();
    if (!matches || matches.length === 0) {
      this.phaseDeadlineCountdown.set('');
      return;
    }
    const futureKickoffs = matches
      .map((m) => new Date(m.kickoff_time).getTime())
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b);
    if (futureKickoffs.length === 0) {
      this.phaseDeadlineCountdown.set('cerrado');
      return;
    }
    const deadline = futureKickoffs[0] - 3 * 60 * 60 * 1000;
    const diff = deadline - Date.now();
    if (diff <= 0) {
      this.phaseDeadlineCountdown.set('cerrado');
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    this.phaseDeadlineCountdown.set(
      d > 0 ? `${d}d ${h}:${m}:${s}` : `${h}:${m}:${s}`,
    );
  }

  isWinner(match: MatchContent, teamId: number): boolean {
    const winner = this.predictions().get(match.match_id)?.winner_team_id;
    if (!winner) return false;
    return winner === teamId;
  }
}
