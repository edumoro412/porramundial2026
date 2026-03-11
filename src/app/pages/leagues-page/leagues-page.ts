import { Component, signal } from '@angular/core';
import { OnInit } from '@angular/core';
import { Liga, LigaContent } from '../../interface/response';
import { AuthService } from '../../../services/auth.service';
import { UserSimple } from '../../interface/user';
import { Router } from '@angular/router';
import { CardLeague } from '../../components/card-league/card-league';

@Component({
  selector: 'app-leagues-page',
  imports: [CardLeague],
  templateUrl: './leagues-page.html',
  styleUrl: './leagues-page.scss',
})
export class LeaguesPage implements OnInit {
  errorMsg = signal<string>('');
  errorJoinMsg = signal<string>('');
  invitationcode = signal<string>('');
  creando = signal<boolean>(false);
  loading = signal<boolean>(false);
  liga: Liga | null = null;
  user: UserSimple | null = null;
  leagues = signal<LigaContent[] | null>(null);

  /*   falta crear y comprobar que funciona el crearLiga, falta quitar las ligas de ejemplo y crear una funcion para traerse las ligas a las que pertenece el usuario, falta un boton para al darle que te cree un nuevo codigo, falta que el boton de copiar funcione, y falta la funcion de unirse a liga teniendo en cuenta que no puede unirse un usuario que ya esta unido */

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      this.codeCreator();

      this.user = await this.auth.getCurrentSimpleUser();
      if (!this.user) {
        this.router.navigateByUrl('/login');
        return;
      }
      await this.obtenerLigas(this.user.id);
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async crearLiga(nombre: string, code: any) {
    this.creando.set(true);
    if (!this.user) {
      return;
    }
    if (code == null) {
      return;
    }

    this.liga = {
      code: code,
      name: nombre,
      creator: this.user.id,
    };

    try {
      const response = await this.auth.crearLiga(this.liga);
      if (!response.success) {
        this.errorMsg.set(response.message);
        return;
      }
      alert('Liga creada con exito!');
    } catch (error) {
      console.error(error);
    } finally {
      this.creando.set(false);
      this.codeCreator();
      this.obtenerLigas(this.user.id);
    }
  }

  codeCreator(): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    const randomChars = (length: number): string =>
      Array.from(
        { length },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('');

    this.invitationcode.set(
      `${randomChars(3)}-${randomChars(4)}-${randomChars(3)}-${randomChars(4)}`,
    );
  }

  copyToTheClipboard(texto: string) {
    navigator.clipboard.writeText(texto).then(() => {
      alert('Codigo copiado');
    });
  }

  async joinLiga(code: string) {
    const user_id = this.user?.id;
    if (!user_id) {
      this.router.navigateByUrl('/login');
      return;
    }

    const response = await this.auth.unirLiga(code, user_id);
    if (!response.success) {
      this.errorJoinMsg.set(response.message);
      return;
    }
    alert(response.message);
    this.obtenerLigas(user_id);
    return;
  }

  async obtenerLigas(code: string) {
    if (!this.user) {
      return;
    }
    const result = await this.auth.getLigas(this.user?.id);
    this.leagues.set(result ?? []);
  }
}
