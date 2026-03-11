import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardLeague } from './card-league';

describe('CardLeague', () => {
  let component: CardLeague;
  let fixture: ComponentFixture<CardLeague>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardLeague]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardLeague);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
