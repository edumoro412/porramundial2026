import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { Home } from './pages/home/home';
import { MainLayout } from './layouts/main-layout/main-layout';
import { UserPage } from './components/user-page/user-page';
import { LeaguesPage } from './pages/leagues-page/leagues-page';
import { LeagueDetail } from './pages/league-detail/league-detail';
import { Matches } from './pages/matches/matches';
import { Admin } from './pages/admin/admin';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      {
        path: '',
        component: Home,
      },
      {
        path: 'user',
        component: UserPage,
      },
      {
        path: 'leagues',
        component: LeaguesPage,
      },
      {
        path: 'leagues/:id',
        component: LeagueDetail,
      },
      {
        path: 'matches',
        component: Matches,
      },
      {
        path: 'admin',
        component: Admin,
      },
    ],
  },
  {
    path: 'login',
    component: Login,
  },
  {
    path: 'register',
    component: Register,
  },
];
