import { Component, input, output } from '@angular/core';
import { Liga, LigaContent } from '../../interface/response';

@Component({
  selector: 'app-card-league',
  imports: [],
  templateUrl: './card-league.html',
  styleUrl: './card-league.scss',
})
export class CardLeague {
  liga = input.required<LigaContent>();
  user_id = input.required<string>();
  onCopy = output<string>();
}
