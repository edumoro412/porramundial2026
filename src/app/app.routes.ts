import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Register } from './components/register/register';
import { Home } from './components/home/home';
import { MainLayout } from './layouts/main-layout/main-layout';
import { UserPage } from './components/user-page/user-page';
import { LeaguesPage } from './components/leagues-page/leagues-page';

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
