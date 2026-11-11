import { IconComponent } from './icon.component';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';

@Component({ selector: 'app-shell', standalone: true,
  imports: [IconComponent, RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
<a class="skip-link" href="#contenu">Aller au contenu</a>
<div class="app-shell">
  <div class="mobile-screen" [class.shown]="menuOpen()" (click)="menuOpen.set(false)"></div>
  <aside class="sidebar" [class.mobile-open]="menuOpen()" aria-label="Navigation principale">
    <a class="brand" routerLink="/accueil" (click)="menuOpen.set(false)">
      <span class="brand-symbol"><app-icon name="graduation-cap"/></span>
      <span>campus<span class="brand-accent">learn</span><small>PLATEFORME UNIVERSITAIRE</small></span>
    </a>
    <div class="sidebar-workspace"><span class="workspace-indicator"></span><span><strong>{{auth.user()?.role==='student'?'Mon coin d’étude':auth.user()?.role==='teacher'?'Ma salle de cours':'Mon espace campus'}}</strong><small>Tout au même endroit</small></span><app-icon name="chevron-right"/></div>
    <div class="nav-caption">ESPACE PERSONNEL</div>
    <nav class="nav-links">
      <a routerLink="/accueil" routerLinkActive="active" (click)="menuOpen.set(false)"><app-icon name="house"/> <span>Tableau de bord</span></a>
      <a routerLink="/cours" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" (click)="menuOpen.set(false)"><app-icon name="compass"/> <span>Explorer les cours</span></a>
      <a routerLink="/mes-cours" routerLinkActive="active" (click)="menuOpen.set(false)"><app-icon name="book-open"/> <span>Mes cours</span></a>
      <a routerLink="/notifications" routerLinkActive="active" (click)="menuOpen.set(false)"><app-icon name="bell"/> <span>Notifications</span></a>
    </nav>
    @if(auth.user()?.role === 'teacher' || auth.user()?.role === 'admin') {
      <div class="nav-caption nav-section">ENSEIGNEMENT</div>
      <nav class="nav-links"><a routerLink="/enseignement" routerLinkActive="active" (click)="menuOpen.set(false)"><app-icon name="pencil-line"/><span>Mes formations</span></a><a routerLink="/illustrations" routerLinkActive="active" (click)="menuOpen.set(false)"><app-icon name="images"/><span>Illustrations</span></a></nav>
    }
    @if(auth.user()?.role === 'admin') {
      <div class="nav-caption nav-section">GESTION</div>
      <nav class="nav-links"><a routerLink="/administration" routerLinkActive="active" (click)="menuOpen.set(false)"><app-icon name="settings"/><span>Administration</span></a></nav>
    }
    <div class="sidebar-companion">
      <img src="/assets/illustrations/3d/ressources-livres.png" width="104" height="104" alt="" loading="lazy" />
      <span class="companion-overline">UN PETIT RAPPEL</span>
      <p>{{auth.user()?.role==='student'?'Une leçon à la fois. Tu avances à ton rythme.':auth.user()?.role==='teacher'?'Chaque cours aide quelqu’un à progresser.':'Une plateforme plus simple pour toute la communauté.'}}</p>
      <a [routerLink]="auth.user()?.role==='student'?'/mes-cours':auth.user()?.role==='teacher'?'/enseignement':'/administration'" (click)="menuOpen.set(false)">{{auth.user()?.role==='student'?'Retrouver mes cours':auth.user()?.role==='teacher'?'Gérer mes cours':'Gérer les comptes'}} <app-icon name="arrow-up-right"/></a>
    </div>
    <div class="sidebar-bottom">
      <div class="nav-user"><div class="avatar">{{initials()}}</div><div class="user-details"><b>{{auth.user()?.full_name}}</b><small>{{roleLabel()}}</small></div><button type="button" class="icon-button" aria-label="Se déconnecter" title="Se déconnecter" (click)="auth.logout()"><app-icon name="log-out"/></button></div>
    </div>
  </aside>
  <section class="app-main">
    <header class="topbar">
      <div class="topbar-left">
        <button type="button" class="icon-button mobile-toggle" aria-label="Ouvrir le menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(true)"><app-icon name="menu"/></button>
        <div class="breadcrumb-block"><span>CampusLearn <app-icon name="chevron-right"/></span><strong>{{pageTitle()}}</strong></div>
      </div>
      <div class="topbar-actions">
        <form class="top-search" role="search" (submit)="find($event)"><app-icon name="search"/><input placeholder="Rechercher un cours..." aria-label="Rechercher des cours" [(ngModel)]="search" name="q"/><kbd>Entrée</kbd></form>
        <a routerLink="/notifications" class="icon-button top-notice" aria-label="Ouvrir les notifications" title="Notifications"><app-icon name="bell"/></a>
        <span class="topbar-divider"></span>
        <div class="top-profile"><span class="top-avatar">{{initials()}}</span><span class="top-profile-text"><strong>{{auth.user()?.full_name}}</strong><small>{{roleLabel()}}</small></span></div>
      </div>
    </header>
    <main id="contenu" class="content"><router-outlet/></main>
    <footer class="footer"><span>© 2026 CampusLearn</span><span>Un espace pour apprendre, partager et progresser.</span></footer>
  </section>
</div>` })
export class ShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly pageTitle = signal('Tableau de bord');
  search = '';
  constructor() {
    this.updateTitle();
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.updateTitle();
      this.menuOpen.set(false);
    });
  }
  private updateTitle(): void {
    const path = this.router.url.split('?')[0];
    this.pageTitle.set(path.startsWith('/administration') ? 'Administration' : path.startsWith('/illustrations') ? 'Illustrations' : path.startsWith('/enseignement') ? 'Espace enseignant' : path.startsWith('/notifications') ? 'Notifications' : path.startsWith('/mes-cours') ? 'Mes cours' : path.startsWith('/cours/') ? 'Détails du cours' : path.startsWith('/cours') ? 'Explorer les cours' : 'Tableau de bord');
  }
  initials(): string { return (this.auth.user()?.full_name || 'CL').trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase(); }
  roleLabel(): string { return ({student:'Étudiant',teacher:'Enseignant',admin:'Administrateur'} as Record<string,string>)[this.auth.user()?.role || ''] || 'Membre'; }
  find(event: Event): void { event.preventDefault(); void this.router.navigate(['/cours'], {queryParams: {q: this.search.trim()}}); }
}
