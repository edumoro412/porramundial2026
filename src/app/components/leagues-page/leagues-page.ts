import { Component, signal } from '@angular/core';
import { OnInit } from '@angular/core';

@Component({
  selector: 'app-leagues-page',
  imports: [],
  templateUrl: './leagues-page.html',
  styleUrl: './leagues-page.scss',
})
export class LeaguesPage implements OnInit {
  errorMsg = signal('');
  invitationcode = signal('');
  loading = signal(false);

  /*   falta crear y comprobar que funciona el crearLiga, falta quitar las ligas de ejemplo y crear una funcion para traerse las ligas a las que pertenece el usuario, falta un boton para al darle que te cree un nuevo codigo, falta que el boton de copiar funcione, y falta la funcion de unirse a liga teniendo en cuenta que no puede unirse un usuario que ya esta unido */
  ngOnInit(): void {
    this.loading.set(true);
    try {
      this.codeCreator();
      console.log('Este es el codigo de invitacion', this.invitationcode());
    } catch (err) {
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async crearLiga(nombre: string, code: any) {
    if (code == null) {
      return;
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
}
