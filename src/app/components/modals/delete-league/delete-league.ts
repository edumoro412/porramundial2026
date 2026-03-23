import { Component, output } from '@angular/core';

@Component({
  selector: 'app-delete-league',
  imports: [],
  templateUrl: './delete-league.html',
  styleUrl: './delete-league.scss',
})
export class DeleteLeague {
  cancelled = output<void>();
  confirmed = output<void>();
}
