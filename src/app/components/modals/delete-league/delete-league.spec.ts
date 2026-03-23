import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteLeague } from './delete-league';

describe('DeleteLeague', () => {
  let component: DeleteLeague;
  let fixture: ComponentFixture<DeleteLeague>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeleteLeague]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteLeague);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
