import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaguesPage } from './leagues-page';

describe('LeaguesPage', () => {
  let component: LeaguesPage;
  let fixture: ComponentFixture<LeaguesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaguesPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaguesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
