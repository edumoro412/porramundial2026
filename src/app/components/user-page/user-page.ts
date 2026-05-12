import { Component, signal } from '@angular/core';
import { UserSimple } from '../../interface/user';
import { OnInit } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-page',
  imports: [CommonModule],
  templateUrl: './user-page.html',
  styleUrl: './user-page.scss',
})
export class UserPage implements OnInit {
  loading = signal(false);
  disabled = signal(false);

  currentUser: UserSimple | null = null;
  profileUser: UserSimple | null = null;
  isOwnProfile = signal(true);

  username = signal<string | undefined>(undefined);
  errorMsg = signal('');

  totalPoints = signal(0);
  matchPredictions = signal<any[]>([]);
  winnerTeamName = signal<string | null>(null);
  topScorer = signal<string | null>(null);

  activeTab = signal<'matches' | 'specials'>('matches');

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.currentUser = await this.auth.getCurrentSimpleUser();
      if (!this.currentUser) {
        this.router.navigateByUrl('/login');
        return;
      }

      const paramId = this.route.snapshot.paramMap.get('id');
      const targetId = paramId ?? this.currentUser.id;
      this.isOwnProfile.set(targetId === this.currentUser.id);

      if (this.isOwnProfile()) {
        this.profileUser = this.currentUser;
      } else {
        this.profileUser = await this.auth.getUserProfile(targetId);
      }

      this.username.set(this.profileUser?.name);

      this.totalPoints.set(await this.auth.getUserTotalPoints(targetId));
      this.matchPredictions.set(
        await this.auth.getUserMatchPredictions(targetId),
      );

      const winnerId = await this.auth.getWinner(targetId);
      if (winnerId) {
        const name = await this.auth.getTeamName(winnerId);
        this.winnerTeamName.set(name);
      }

      const scorer = await this.auth.getScorer(targetId);
      this.topScorer.set(scorer);
    } catch (error) {
      console.log('Error ' + error);
    } finally {
      this.loading.set(false);
    }
  }

  getInitial(): string {
    return (this.username() ?? '?')[0].toUpperCase();
  }

  async cambiarNombre(nombre: string) {
    this.errorMsg.set('');
    this.disabled.set(true);
    try {
      if (!nombre || !this.currentUser) return;
      const response = await this.auth.updateUserName(
        this.currentUser.id,
        nombre,
      );
      if (!response.success) {
        this.errorMsg.set(response.message);
        return;
      }
      this.username.set(nombre);
    } catch (error) {
      console.log(error);
    } finally {
      this.disabled.set(false);
    }
  }

  resetErrorMsg() {
    this.errorMsg.set('');
  }

  async logOut() {
    await this.auth.logOut();
    this.router.navigateByUrl('/login');
  }

  getSignLabel(sign: string): string {
    if (sign === '1') return 'Local';
    if (sign === 'X') return 'Empate';
    if (sign === '2') return 'Visitante';
    return sign;
  }

  getPointsClass(points: number | null): string {
    if (points === null) return '';
    if (points === 0) return 'points--zero';
    if (points <= 3) return 'points--low';
    if (points <= 7) return 'points--mid';
    return 'points--high';
  }
}
