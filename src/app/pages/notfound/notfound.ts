import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [],
  templateUrl: './notfound.html',
  styleUrl: './notfound.scss',
})
export class NotFound {
  constructor(private router: Router) {}

  goHome() {
    this.router.navigateByUrl('/');
  }
}
