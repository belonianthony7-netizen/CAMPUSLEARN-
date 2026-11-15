import { IconComponent } from '../shared/icon.component';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CourseCardComponent } from '../shared/course-card.component';
import { coverFor } from '../core/course-artwork';
import { Dashboard } from '../core/models';
import { LearningLottieComponent } from '../shared/learning-lottie.component';

@Component({selector:'app-dashboard',standalone:true,imports:[IconComponent,RouterLink,CourseCardComponent,NgOptimizedImage,LearningLottieComponent],template:`
<div class="page-stack dashboard-page editorial-dashboard">
  <header class="page-intro dashboard-intro student-welcome">
    <div class="welcome-copy">
      <span class="welcome-kicker"><span class="welcome-kicker-dot"></span>{{auth.user()?.role==='student'?'TON COIN POUR APPRENDRE':auth.user()?.role==='teacher'?'TA SALLE DE COURS':'LA VIE DU CAMPUS'}}</span>
      <h1>{{greeting()}}, <span class="welcome-firstname">{{firstName()}}</span> <span class="welcome-wave" aria-hidden="true">👋</span></h1>
      <p>{{auth.user()?.role==='student'?'Ton espace pour étudier tranquillement, reprendre un cours et voir le chemin parcouru.':auth.user()?.role==='teacher'?'Tes ressources et tes formations sont réunies ici. Prêt à accompagner la prochaine leçon ?':'Une vue claire des cours et des personnes qui font vivre la plateforme.'}}</p>
      <div class="welcome-actions"><a class="welcome-primary" [routerLink]="auth.user()?.role==='student'?'/mes-cours':auth.user()?.role==='teacher'?'/enseignement':'/administration'"><app-icon name="book-open"/> {{auth.user()?.role==='student'?'Retrouver mes cours':auth.user()?.role==='teacher'?'Voir mes formations':'Voir les comptes'}} <app-icon name="arrow-up-right"/></a><a class="welcome-secondary" routerLink="/cours">Explorer les cours <app-icon name="arrow-right"/></a></div>
    </div>
    <div class="welcome-visual"><span class="welcome-date"><app-icon name="calendar-days"/> {{today}}</span>
      @if(auth.user()?.role==='teacher'){<img ngSrc="/assets/illustrations/3d/enseignante.png" width="512" height="512" priority alt=""/>}
      @else if(auth.user()?.role==='admin'){<img ngSrc="/assets/illustrations/3d/cours-en-ligne.png" width="512" height="512" priority alt=""/>}
      @else{<img ngSrc="/assets/illustrations/3d/etudiant.png" width="512" height="512" priority alt=""/>}
      <span class="welcome-mini-sticker"><app-icon name="heart"/> À ton rythme</span>
    </div>
  </header>
  @if(loading()) {
    <div class="dashboard-skeleton" role="status" aria-live="polite"><div class="campus-loading-indicator"><app-learning-lottie animation="book-loading" [size]="94" [loop]="true"/><span>Préparation de votre tableau de bord…</span></div><div class="skeleton-block skeleton-feature"></div><div class="skeleton-row"><div class="skeleton-block"></div><div class="skeleton-block"></div><div class="skeleton-block"></div></div><span class="sr-only">Chargement du tableau de bord</span></div>
  }
  @else if(stats();as d){
    <div class="university-dashboard-layout"><div class="university-dashboard-main"><section class="editorial-feature" aria-labelledby="feature-title">
      <div class="editorial-feature-copy">
        <span class="feature-label">{{d.role==='student'?'ON CONTINUE ?':d.role==='teacher'?'PRÉPARER LE PROCHAIN COURS':'À GÉRER AUJOURD’HUI'}}</span>
        @if(d.role==='student' && d.recent_courses.length){
          <h2 id="feature-title">On reprend {{d.recent_courses[0].title}} ?</h2>
          <p>Ton cours t'attend là où tu l'avais laissé.</p>
          <div class="feature-progress"><span>Tu en es ici</span><strong>{{d.recent_courses[0].progress}} %</strong><div class="feature-track"><span [style.width.%]="d.recent_courses[0].progress"></span></div></div>
          <a class="feature-action" [routerLink]="['/cours',d.recent_courses[0].id]">Continuer ma leçon <app-icon name="arrow-up-right"/></a>
        } @else if(d.role==='student') {
          <h2 id="feature-title">Et si on choisissait ton premier cours ?</h2><p>Une matière qui t'intéresse, et c'est parti.</p>
          <a class="feature-action" routerLink="/cours">Ouvrir le catalogue <app-icon name="arrow-up-right"/></a>
        } @else if(d.role==='teacher') {
          <h2 id="feature-title">À toi de transmettre</h2><p>{{d.courses}} cours dans ton espace. Prépare tes leçons et accompagne les étudiants.</p>
          <a class="feature-action" routerLink="/enseignement">Gérer les formations <app-icon name="arrow-up-right"/></a>
        } @else {
          <h2 id="feature-title">Administrer votre plateforme</h2><p>Vérifiez les comptes, leurs rôles et leur accès aux cours.</p>
          <a class="feature-action" routerLink="/administration">Ouvrir l'administration <app-icon name="arrow-up-right"/></a>
        }
      </div>
      <div class="editorial-feature-media">
        @if(d.role==='student' && d.recent_courses.length){
          <img [ngSrc]="coverFor(d.recent_courses[0].title,d.recent_courses[0].category,d.recent_courses[0].cover_image)" width="480" height="320" priority alt=""/>
        } @else if(d.role==='teacher') {
          <img class="campus-3d-hero" ngSrc="/assets/illustrations/3d/enseignante.png" width="512" height="512" priority alt=""/>
        } @else if(d.role==='admin') {
          <img ngSrc="/assets/illustrations/admin-control.svg" width="480" height="320" priority alt=""/>
        } @else {<img class="campus-3d-hero" ngSrc="/assets/illustrations/3d/formation-livres.png" width="512" height="512" priority alt=""/>}
      </div>
    </section>
    <section aria-labelledby="activity-title" class="editorial-stat-section">
      <div class="section-head editorial-section-head"><div><span class="eyebrow">TON PARCOURS</span><h2 id="activity-title">{{d.role==='student'?'Tes repères':'L’essentiel en un regard'}}</h2><p>{{d.role==='student'?'Des petites avancées qui finissent par compter.':'Les informations utiles de votre espace.'}}</p></div></div>
      <div class="stats-grid editorial-stats">
        @if(d.role==='student'){
          <div class="stat-card"><span class="stat-icon"><app-icon name="book-open"/></span><div><small>Cours suivis</small><strong>{{d.courses}}</strong><span>Dans votre bibliothèque</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="circle-check"/></span><div><small>Cours terminés</small><strong>{{d.completed||0}}</strong><span>Leçons et progression</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="file-pen-line"/></span><div><small>Quiz réalisés</small><strong>{{d.quizzes||0}}</strong><span>Évaluations effectuées</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="chart-no-axes-combined"/></span><div><small>Moyenne aux quiz</small><strong>{{d.average_score||0}} %</strong><span>Sur les quiz soumis</span></div></div>
        } @else if(d.role==='teacher'){
          <div class="stat-card"><span class="stat-icon"><app-icon name="book-open"/></span><div><small>Mes cours</small><strong>{{d.courses}}</strong><span>Cours créés</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="users-round"/></span><div><small>Inscriptions</small><strong>{{d.students||0}}</strong><span>Dans vos cours</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="file-pen-line"/></span><div><small>Devoirs</small><strong>{{d.assignments||0}}</strong><span>Devoirs publiés</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="pencil-line"/></span><div><small>Copies à corriger</small><strong>{{d.pending_submissions||0}}</strong><a routerLink="/enseignement">Ouvrir mes cours</a></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="square-check"/></span><div><small>Quiz remis</small><strong>{{d.quiz_attempts||0}}</strong><span>Résultats dans chaque cours</span></div></div>
        } @else {
          <div class="stat-card"><span class="stat-icon"><app-icon name="users-round"/></span><div><small>Utilisateurs</small><strong>{{d.users||0}}</strong><span>Comptes enregistrés</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="book-open"/></span><div><small>Cours</small><strong>{{d.courses}}</strong><span>Sur la plateforme</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="graduation-cap"/></span><div><small>Étudiants</small><strong>{{d.students||0}}</strong><span>Comptes étudiants</span></div></div>
          <div class="stat-card"><span class="stat-icon"><app-icon name="chart-no-axes-combined"/></span><div><small>Inscriptions</small><strong>{{d.enrollments||0}}</strong><span>Sur tous les cours</span></div></div>
        }
      </div>
    </section>
    <section aria-labelledby="course-list-title" class="dashboard-course-section">
      <div class="section-head editorial-section-head"><div><span class="eyebrow">POUR CONTINUER</span><h2 id="course-list-title">{{d.role==='student'?'Les cours qui t’attendent':'Les derniers cours'}}</h2><p>{{d.role==='student'?'Reprends quand tu veux, sans perdre le fil.':'Retrouvez les formations disponibles.'}}</p></div><a [routerLink]="d.role==='teacher'?'/enseignement':'/mes-cours'" class="subtle-link">Voir les cours <app-icon name="arrow-right"/></a></div>
      @if(d.recent_courses.length){<div class="course-grid">@for(c of d.recent_courses;track c.id){<app-course-card [course]="c"/>}</div>}
      @else {<div class="empty-state"><app-learning-lottie animation="education-animation" [size]="142"/><h3>Aucun cours à afficher</h3><p>Vous retrouverez ici vos formations dès qu'elles seront disponibles.</p><a class="btn btn-primary" [routerLink]="d.role==='teacher'?'/enseignement':'/cours'">{{d.role==='teacher'?'Créer un cours':'Parcourir les cours'}}</a></div>}
    </section>
    </div>
    <aside class="university-right-rail" aria-label="Accès rapide">
      <section class="university-rail-card">
        <div class="university-rail-heading"><h2>À portée de main</h2><app-icon name="arrow-up-right"/></div>
        <a routerLink="/cours" class="university-rail-link"><span class="rail-icon mint"><app-icon name="book-open"/></span><span><strong>Catalogue</strong><small>Parcourir les cours disponibles</small></span><app-icon name="chevron-right"/></a>
        <a routerLink="/mes-cours" class="university-rail-link"><span class="rail-icon peach"><app-icon name="graduation-cap"/></span><span><strong>Mes cours</strong><small>Reprendre mon apprentissage</small></span><app-icon name="chevron-right"/></a>
        <a routerLink="/notifications" class="university-rail-link"><span class="rail-icon blue"><app-icon name="bell"/></span><span><strong>Notifications</strong><small>Voir les nouvelles annonces</small></span><app-icon name="chevron-right"/></a>
      </section>
      <section class="university-rail-card">
        <div class="university-rail-heading"><h2>Derniers cours</h2><a routerLink="/mes-cours">Tout voir</a></div>
        @if(d.recent_courses.length) {
          @for(c of d.recent_courses.slice(0,3);track c.id) {
            <a class="university-recent-course" [routerLink]="['/cours',c.id]">
              <img [ngSrc]="coverFor(c.title,c.category,c.cover_image)" width="72" height="58" alt="" />
              <span><strong>{{c.title}}</strong><small>{{c.progress}} % de progression</small></span>
              <app-icon name="arrow-up-right"/>
            </a>
          }
        } @else {<p class="university-rail-empty">Les cours consultés apparaîtront ici.</p>}
      </section>
      <section class="university-rail-note"><img class="rail-pastel-accent" src="/assets/illustrations/3d/planning-calendrier.png" alt="" width="88" height="88" loading="lazy"/><app-icon name="sparkles"/><strong>Un peu chaque jour, c'est déjà beaucoup.</strong><p>Commence avec une leçon. Tu pourras reprendre plus tard.</p></section>
    </aside></div>
  } @else {<div class="empty-state"><h2>Le tableau de bord n'a pas pu être chargé</h2><p>Vérifiez la connexion à FastAPI puis réessayez.</p><button class="btn btn-primary" (click)="load()">Réessayer</button></div>}
</div>`})
export class DashboardPage implements OnInit {
  private readonly api=inject(ApiService);
  readonly auth=inject(AuthService);
  readonly coverFor=coverFor;
  readonly stats=signal<Dashboard|null>(null);
  readonly loading=signal(true);
  readonly today=new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  greeting():string{const hour=new Date().getHours();return hour<12?'Bonjour':hour<18?'Bon après-midi':'Bonsoir';}
  firstName():string{return this.auth.user()?.full_name.split(' ')[0]||'vous';}
  ngOnInit():void{this.load();}
  load():void{this.loading.set(true);this.api.dashboard().subscribe({next:d=>{this.stats.set(d);this.loading.set(false);},error:()=>{this.stats.set(null);this.loading.set(false);}});}
}
