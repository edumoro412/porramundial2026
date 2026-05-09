import { Component, OnInit, signal } from '@angular/core';
import { MatchContent, Prediction } from '../../interface/response';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { KeyValuePipe } from '@angular/common';

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
  dieciseiavosButton = signal<boolean>(true);
  octavosButton = signal<boolean>(true);
  semisButton = signal<boolean>(true);
  cuartosButton = signal<boolean>(true);
  finalButton = signal<boolean>(true);

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
      const user = await this.auth.getCurrentSimpleUser();
      if (!user?.id) {
        this.router.navigateByUrl('/login');
        return;
      }

      const response: MatchContent[] | null = await this.auth.getMatches(
        this.phase(),
      );
      if (!response || response.length === 0) return;

      const dieciseisavosMatches = await this.auth.getMatches('dieciseisavos');
      const octavosMatches = await this.auth.getMatches('octavos');
      const cuartosMatches = await this.auth.getMatches('cuartos');
      const semisMatches = await this.auth.getMatches('semifinal');
      const finalMatches = await this.auth.getMatches('final');

      if (!dieciseisavosMatches || dieciseisavosMatches.length === 0)
        this.dieciseiavosButton.set(false);
      if (!octavosMatches || octavosMatches.length === 0)
        this.octavosButton.set(false);
      if (!cuartosMatches || cuartosMatches.length === 0)
        this.cuartosButton.set(false);
      if (!semisMatches || semisMatches.length === 0)
        this.semisButton.set(false);
      if (!finalMatches || finalMatches.length === 0)
        this.finalButton.set(false);

      this.matches.set(response);

      const map = new Map<number, Prediction>();
      for (const match of response) {
        const predict = await this.auth.getMatchPrediction(
          match.match_id,
          user.id,
        );
        console.log('prediccion partido', match.match_id, predict);
        if (predict) map.set(match.match_id, predict);
      }

      this.predictions.set(map);
      await this.loadGroupRankings(user.id, response);
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

      const map = new Map<number, Prediction>();
      for (const match of response) {
        const predict = await this.auth.getMatchPrediction(
          match.match_id,
          user.id,
        );
        if (predict) map.set(match.match_id, predict);
      }
      this.predictions.set(map);

      if (phase === 'grupos') {
        await this.loadGroupRankings(user.id, response);
      }

      this.updatePhaseDeadlineCountdown();
      this.updateCountdowns();
    }

    setTimeout(() => this.isTransitioning.set(false), 50);
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

    const rankingsMap = new Map<
      string,
      {
        team_id: number;
        short_name: string;
        img: string;
        predicted_position: number;
      }[]
    >();

    for (const [letter, teams] of groupTeams.entries()) {
      const saved = await this.auth.getGroupStandingsPrediction(letter, userId);
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
    }

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

  async saveGroupRanking(groupLetter: string): Promise<void> {
    if (this.isPhaseBlocked()) {
      alert('🔒 Las predicciones de esta fase están cerradas');
      return;
    }

    const saving = new Map(this.isSavingRankings());
    saving.set(groupLetter, true);
    this.isSavingRankings.set(saving);

    const user = await this.auth.getCurrentSimpleUser();
    if (!user?.id) {
      this.router.navigateByUrl('/login');
      return;
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

    saving.set(groupLetter, false);
    this.isSavingRankings.set(new Map(saving));

    if (response.success) {
      const saved = new Map(this.rankingSaved());
      saved.set(groupLetter, true);
      this.rankingSaved.set(saved);
      setTimeout(() => {
        const s = new Map(this.rankingSaved());
        s.delete(groupLetter);
        this.rankingSaved.set(s);
      }, 2500);
    } else {
      alert('Error al guardar: ' + response.message);
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

    if (pendingMatches.length === 0 && this.phase() !== 'grupos') {
      this.isSavingAll.set(false);
      if (this.isPhaseBlocked()) {
        alert('🔒 Las predicciones de esta fase están cerradas');
      } else {
        alert('No hay predicciones nuevas que guardar');
      }
      return;
    }

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
          const saving = new Map(this.isSavingRankings());
          saving.set(letter, true);
          this.isSavingRankings.set(saving);

          const teams = this.groupRankings().get(letter) ?? [];
          const rankings = teams.map((t) => ({
            team_id: t.team_id,
            predicted_position: t.predicted_position,
          }));

          const response = await this.auth.saveGroupStandingsPrediction(
            letter,
            user.id,
            rankings,
          );

          const savingDone = new Map(this.isSavingRankings());
          savingDone.set(letter, false);
          this.isSavingRankings.set(savingDone);

          if (response.success) {
            const saved = new Map(this.rankingSaved());
            saved.set(letter, true);
            this.rankingSaved.set(saved);
            setTimeout(() => {
              const s = new Map(this.rankingSaved());
              s.delete(letter);
              this.rankingSaved.set(s);
            }, 2500);
          }
        }
      }
    }

    this.isSavingAll.set(false);

    if (this.phase() === 'grupos' && !this.isPhaseBlocked()) {
      alert('✅ Predicciones y clasificaciones guardadas');
    } else if (errorCount === 0 && successCount > 0) {
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
