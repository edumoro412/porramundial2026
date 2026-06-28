import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  signal,
  ElementRef,
} from '@angular/core';
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
export class Matches implements OnInit, AfterViewInit, OnDestroy {
  countdowns = signal<Map<string, string>>(new Map());
  phaseDeadlineCountdown = signal<string>('');
  private countdownSub!: Subscription;

  phase = signal<string>('dieciseisavos');
  matches = signal<MatchContent[]>([]);
  loading = signal<boolean>(false);
  isTransitioning = signal<boolean>(false);
  errorMesage = signal<Map<number, string>>(new Map());
  predictions = signal<Map<number, Prediction>>(new Map());
  isSavingAll = signal<boolean>(false);
  isSavingMatch = signal<Map<number, boolean>>(new Map());
  matchSaved = signal<Map<number, boolean>>(new Map());

  isSavingGroup = signal<Map<string, boolean>>(new Map());
  groupSaved = signal<Map<string, boolean>>(new Map());

  dieciseiavosButton = signal<boolean>(false);
  octavosButton = signal<boolean>(false);
  semisButton = signal<boolean>(false);
  cuartosButton = signal<boolean>(false);
  finalButton = signal<boolean>(false);

  winner_team = signal<number | null>(null);
  top_scorer = signal<string | null>(null);
  teams = signal<TeamInterface[] | null>(null);
  user: UserSimple | null = null;

  groupRankings = signal<Map<string, any[]>>(new Map());

  private dragState: {
    groupLetter: string;
    fromIndex: number;
    currentIndex: number;
  } | null = null;
  private touchMoveHandler!: (e: TouchEvent) => void;

  constructor(
    private auth: AuthService,
    private router: Router,
    private el: ElementRef,
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

      if (allMatches?.length) {
        const fases = new Set(allMatches.map((m) => m.phase));
        this.dieciseiavosButton.set(fases.has('dieciseisavos'));
        this.octavosButton.set(fases.has('octavos'));
        this.cuartosButton.set(fases.has('cuartos'));
        this.semisButton.set(fases.has('semifinal'));
        this.finalButton.set(fases.has('final'));

        const response = allMatches.filter((m) => m.phase === 'grupos');
        if (response.length) {
          this.matches.set(response);
          const map = await this.auth.getMatchPredictions(
            response.map((m) => m.match_id),
            userr.id,
          );
          this.predictions.set(map);
          await this.loadGroupRankings(userr.id, response);
        }
      }

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

  ngAfterViewInit(): void {
    this.touchMoveHandler = (event: TouchEvent) => {
      if (this.dragState) {
        event.preventDefault();
        this.onTouchMove(event, this.dragState.groupLetter);
      }
    };
    this.el.nativeElement.addEventListener('touchmove', this.touchMoveHandler, {
      passive: false,
    });
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
    if (!user?.id) return;

    const response = await this.auth.getMatches(phase);
    if (response?.length) {
      this.matches.set(response);
      const map = await this.auth.getMatchPredictions(
        response.map((m) => m.match_id),
        user.id,
      );
      this.predictions.set(map);
      if (phase === 'grupos') await this.loadGroupRankings(user.id, response);
    }

    this.updatePhaseDeadlineCountdown();
    this.updateCountdowns();
    setTimeout(() => this.isTransitioning.set(false), 50);
  }

  private isMatchBlocked(kickoff: string): boolean {
    if (!kickoff) return false;
    return (new Date(kickoff).getTime() - Date.now()) / (1000 * 60 * 60) < 3;
  }

  isInputDisabled(kickoff: string): boolean {
    return this.matchPlayed(kickoff) || this.isMatchBlocked(kickoff);
  }

  isPhaseFullyClosed(): boolean {
    return this.matches().every((m) => this.isMatchBlocked(m.kickoff_time));
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

  async saveSingleMatch(match: MatchContent): Promise<void> {
    if (this.isMatchBlocked(match.kickoff_time)) {
      alert('🔒 Las predicciones para este partido están cerradas');
      return;
    }

    const saving = new Map(this.isSavingMatch());
    saving.set(match.match_id, true);
    this.isSavingMatch.set(saving);

    const result = await this.uploadPrediction(match, true);

    const savingDone = new Map(this.isSavingMatch());
    savingDone.set(match.match_id, false);
    this.isSavingMatch.set(savingDone);

    if (result === true) {
      const saved = new Map(this.matchSaved());
      saved.set(match.match_id, true);
      this.matchSaved.set(saved);
      setTimeout(() => {
        const s = new Map(this.matchSaved());
        s.delete(match.match_id);
        this.matchSaved.set(s);
      }, 2000);
    }
  }

  async uploadPrediction(
    match: MatchContent,
    silent = false,
  ): Promise<boolean> {
    const user = await this.auth.getCurrentSimpleUser();
    if (!user?.id) return false;

    const homeInput = document.getElementById(
      match.match_id + '-home',
    ) as HTMLInputElement;
    const awayInput = document.getElementById(
      match.match_id + '-away',
    ) as HTMLInputElement;
    const selectInput = document.getElementById(
      match.match_id + '-select',
    ) as HTMLSelectElement;

    if (!homeInput?.value || !awayInput?.value || !selectInput?.value) {
      if (!silent) this.setError(match.match_id, 'Completa todos los campos');
      return false;
    }

    const homeScore = parseInt(homeInput.value);
    const awayScore = parseInt(awayInput.value);

    if (
      isNaN(homeScore) ||
      isNaN(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      if (!silent) this.setError(match.match_id, 'Resultado inválido');
      return false;
    }

    const response = await this.auth.sendMatchPrediction(
      match.match_id,
      homeScore,
      awayScore,
      user.id,
      selectInput.value,
      null,
    );

    if (response.success) {
      const updated = new Map(this.predictions());
      updated.set(match.match_id, {
        match_id: match.match_id,
        score_home: homeScore,
        score_away: awayScore,
        sign: selectInput.value,
        winner_team_id: null,
      });
      this.predictions.set(updated);
      this.errorMesage.set(new Map());
      if (!silent) alert('✅ Predicción guardada');
      return true;
    } else {
      if (!silent) this.setError(match.match_id, response.message);
      return false;
    }
  }

  async uploadAllPredictions(): Promise<void> {
    this.isSavingAll.set(true);
    let successCount = 0;

    const allMatches =
      this.phase() === 'grupos'
        ? Array.from(this.matchesByGroup.values()).flat()
        : this.matches();

    for (const match of allMatches) {
      if (!this.isInputDisabled(match.kickoff_time)) {
        const result = await this.uploadPrediction(match, true);
        if (result) successCount++;
      }
    }

    this.isSavingAll.set(false);
    alert(`✅ ${successCount} predicciones guardadas`);
  }

  private setError(matchId: number, message: string): void {
    const errors = new Map(this.errorMesage());
    errors.set(matchId, message);
    this.errorMesage.set(errors);
  }

  clearError(matchId: number): void {
    const errors = new Map(this.errorMesage());
    errors.delete(matchId);
    this.errorMesage.set(errors);
  }

  async loadGroupRankings(
    userId: string,
    matches: MatchContent[],
  ): Promise<void> {
    const map = new Map<string, any[]>();

    const groups = new Map<string, MatchContent[]>();
    for (const m of matches) {
      if (!m.group_letter) continue;
      if (!groups.has(m.group_letter)) groups.set(m.group_letter, []);
      groups.get(m.group_letter)!.push(m);
    }

    for (const [letter, groupMatches] of groups) {
      const teamsMap = new Map<number, any>();
      for (const m of groupMatches) {
        if (!teamsMap.has(m.home_team_id)) {
          teamsMap.set(m.home_team_id, {
            team_id: m.home_team_id,
            short_name: m.home_team_short_name,
            img: m.home_team_img,
          });
        }
        if (!teamsMap.has(m.away_team_id)) {
          teamsMap.set(m.away_team_id, {
            team_id: m.away_team_id,
            short_name: m.away_team_short_name,
            img: m.away_team_img,
          });
        }
      }

      let teams = Array.from(teamsMap.values());

      try {
        const saved = await this.auth.getGroupStandingsPrediction(
          letter,
          userId,
        );

        if (saved?.length) {
          teams = teams
            .map((t) => {
              const found = saved.find((r) => r.team_id === t.team_id);
              return {
                ...t,
                predicted_position: found?.predicted_position ?? null,
                points_awarded: found?.points_awarded ?? null,
              };
            })
            .sort(
              (a, b) =>
                (a.predicted_position ?? 99) - (b.predicted_position ?? 99),
            );
        }
      } catch (err) {
        console.error(`Error cargando clasificación del grupo ${letter}:`, err);
      }

      map.set(letter, teams);
    }

    this.groupRankings.set(map);
  }

  onDragStart(groupLetter: string, fromIndex: number): void {
    this.dragState = { groupLetter, fromIndex, currentIndex: fromIndex };
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, groupLetter: string, toIndex: number): void {
    event.preventDefault();
    if (!this.dragState || this.dragState.groupLetter !== groupLetter) {
      this.dragState = null;
      return;
    }
    this.reorderGroup(groupLetter, this.dragState.fromIndex, toIndex);
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
    const items = Array.from(
      this.el.nativeElement.querySelectorAll(
        `[data-group="${groupLetter}"] .matches__group--ranking-item`,
      ),
    ) as HTMLElement[];

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        this.dragState.currentIndex = i;
        break;
      }
    }
  }

  onTouchEnd(): void {
    if (this.dragState) {
      this.reorderGroup(
        this.dragState.groupLetter,
        this.dragState.fromIndex,
        this.dragState.currentIndex,
      );
    }
    this.dragState = null;
  }

  private reorderGroup(
    groupLetter: string,
    fromIndex: number,
    toIndex: number,
  ): void {
    if (fromIndex === toIndex) return;
    const rankings = new Map(this.groupRankings());
    const teams = [...(rankings.get(groupLetter) ?? [])];
    if (
      fromIndex < 0 ||
      fromIndex >= teams.length ||
      toIndex < 0 ||
      toIndex >= teams.length
    )
      return;
    const [moved] = teams.splice(fromIndex, 1);
    teams.splice(toIndex, 0, moved);
    rankings.set(groupLetter, teams);
    this.groupRankings.set(rankings);
  }

  ngOnDestroy(): void {
    this.countdownSub?.unsubscribe();
    if (this.touchMoveHandler) {
      this.el.nativeElement.removeEventListener(
        'touchmove',
        this.touchMoveHandler,
      );
    }
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
    this.phaseDeadlineCountdown.set('');
  }

  isWinner(match: MatchContent, teamId: number): boolean {
    return this.predictions().get(match.match_id)?.winner_team_id === teamId;
  }

  getMatchBlockCountdown(kickoff: string): string | null {
    const blockTime = new Date(kickoff).getTime() - 3 * 60 * 60 * 1000;
    const diff = blockTime - Date.now();
    if (diff <= 0 || diff > 24 * 60 * 60 * 1000) return null;
    const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  getGroupPoints(groupLetter: string): number | null {
    const ranking = this.groupRankings().get(groupLetter);
    if (!ranking || ranking.length === 0) return null;

    if (!this.isPhaseFullyClosed()) return null;

    const total = ranking.reduce((sum, t) => sum + (t.points_awarded ?? 0), 0);
    const anyPoints = ranking.some((t) => (t.points_awarded ?? 0) > 0);

    if (!anyPoints && total === 0) return null;

    return total;
  }

  async saveGroup(groupLetter: string, matches: MatchContent[]): Promise<void> {
    if (this.isPhaseFullyClosed()) {
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
      (m) =>
        !this.matchPlayed(m.kickoff_time) &&
        !this.isMatchBlocked(m.kickoff_time),
    );

    let errorCount = 0;
    for (const match of pendingMatches) {
      const result = await this.uploadPrediction(match, true);
      if (result === false) errorCount++;
    }

    const teams = this.groupRankings().get(groupLetter) ?? [];
    const rankings = teams.map((t, index) => ({
      team_id: t.team_id,
      predicted_position: index + 1,
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

  async saveSpecialPredictions(
    team_id: HTMLSelectElement,
    scorer: HTMLInputElement,
  ) {
    if (this.isPhaseFullyClosed()) {
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
      alert(response.message);
    }
  }
}
