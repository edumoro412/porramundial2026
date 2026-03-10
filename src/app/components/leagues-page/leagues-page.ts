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
