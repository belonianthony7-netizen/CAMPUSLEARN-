import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/auth.service';
import { AuthPage } from './pages/auth.page';
import { ShellComponent } from './shared/shell.component';

const authenticated = () => inject(AuthService).signedIn() ? true : inject(Router).parseUrl('/connexion');
const staff = () => ['teacher','admin'].includes(inject(AuthService).user()?.role||'') ? true : inject(Router).parseUrl('/accueil');
const admin = () => inject(AuthService).user()?.role === 'admin' ? true : inject(Router).parseUrl('/accueil');

export const routes: Routes = [
  {path:'connexion',component:AuthPage},
  {path:'inscription',component:AuthPage},
  {path:'',component:ShellComponent,canActivate:[authenticated],children:[
    {path:'',pathMatch:'full',redirectTo:'accueil'},
    {path:'accueil',loadComponent:()=>import('./pages/dashboard.page').then(m=>m.DashboardPage)},
    {path:'cours',loadComponent:()=>import('./pages/courses.page').then(m=>m.CoursesPage)},
    {path:'mes-cours',loadComponent:()=>import('./pages/courses.page').then(m=>m.CoursesPage),data:{mine:true}},
    {path:'cours/:id',loadComponent:()=>import('./pages/course-detail.page').then(m=>m.CourseDetailPage)},
    {path:'illustrations',loadComponent:()=>import('./pages/illustrations.page').then(m=>m.IllustrationsPage),canActivate:[staff]},
    {path:'enseignement',loadComponent:()=>import('./pages/teacher.page').then(m=>m.TeacherPage),canActivate:[staff]},
    {path:'administration',loadComponent:()=>import('./pages/admin.page').then(m=>m.AdminPage),canActivate:[admin]},
    {path:'notifications',loadComponent:()=>import('./pages/notifications.page').then(m=>m.NotificationsPage)},
  ]},
  {path:'**',redirectTo:'accueil'}
];
