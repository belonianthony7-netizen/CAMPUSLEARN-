import { IconComponent } from '../shared/icon.component';
import { Component, inject, signal } from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
@Component({selector:'app-auth-page',standalone:true,imports:[IconComponent,FormsModule,RouterLink],template:`
<div class="auth-page">
  <section class="auth-aside"><div class="auth-hero-logo"><app-icon name="graduation-cap"></app-icon> campus<span>learn</span></div><div class="auth-hero-copy"><span class="auth-pill"><app-icon name="heart"></app-icon> BIENVENUE SUR TON CAMPUS</span><h1>Un endroit pour apprendre. <em>À ton rythme.</em></h1><p>Une leçon après l’autre, retrouve tes cours, échange avec les enseignants et suis tes progrès.</p><div class="auth-feature"><app-icon name="circle-check"></app-icon> Des parcours d'apprentissage structurés</div><div class="auth-feature"><app-icon name="circle-check"></app-icon> Un suivi de progression personnalisé</div><div class="auth-feature"><app-icon name="circle-check"></app-icon> Des échanges directs avec vos enseignants</div></div><img class="campus-auth-3d" src="/assets/illustrations/3d/etudiant.png" alt="" width="512" height="512" loading="lazy"/><div class="auth-hero-footer">CampusLearn · Projet universitaire</div></section>
  <section class="auth-form-panel"><div class="auth-form-wrap"><div class="auth-mobile-logo"><app-icon name="graduation-cap"></app-icon> CampusLearn</div><span class="small-tag">{{registerMode()?'INSCRIPTION ÉTUDIANTE':'ACCÈS À VOTRE ESPACE'}}</span><h2>{{registerMode()?'Bienvenue à bord !':'Content de te revoir !'}}</h2><p class="muted intro">{{registerMode()?'Quelques informations et tu pourras explorer les cours.':'Connecte-toi pour retrouver tes cours, là où tu les as laissés.'}}</p>
    <form (ngSubmit)="submit()">
      @if(registerMode()){<label for="auth-full-name">Nom complet</label><div class="field-wrap"><app-icon name="user-round"></app-icon><input id="auth-full-name" name="name" [(ngModel)]="fullName" minlength="2" required placeholder="Votre nom complet" autocomplete="name"/></div>}
      <label for="auth-email">Adresse e-mail</label><div class="field-wrap"><app-icon name="mail"></app-icon><input id="auth-email" name="email" type="email" [(ngModel)]="email" required placeholder="exemple@universite.ac.cd" autocomplete="email"/></div>
      <label for="auth-password">Mot de passe</label><div class="field-wrap"><app-icon name="lock-keyhole"></app-icon><input id="auth-password" name="password" [type]="showPassword()?'text':'password'" [(ngModel)]="password" required minlength="8" placeholder="Au moins 8 caractères" [autocomplete]="registerMode()?'new-password':'current-password'"/><button class="show-pass" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword()?'Masquer le mot de passe':'Afficher le mot de passe'"><app-icon [name]="showPassword()?'eye-off':'eye'"></app-icon></button></div>
      @if(error()){<div class="form-error" role="alert"><app-icon name="circle-alert"></app-icon> {{error()}}</div>}
      <button class="btn btn-primary auth-submit" type="submit" [disabled]="loading()">{{loading()?'Veuillez patienter...':registerMode()?'Créer mon compte':'Se connecter'}} <app-icon name="arrow-right"></app-icon></button>
    </form>
    <div class="auth-divider"><span>CampusLearn · Espace pédagogique</span></div>
    <p class="auth-switch">{{registerMode()?'Déjà un compte ?':'Pas encore de compte ?'}} <a [routerLink]="registerMode()?'/connexion':'/inscription'">{{registerMode()?'Se connecter':'Créer un compte'}}</a></p>
    <p class="auth-policy">Accès de démonstration à une plateforme universitaire.</p>
  </div></section>
</div>`})
export class AuthPage {
  private auth=inject(AuthService);private router=inject(Router);
  registerMode=signal(this.router.url.startsWith('/inscription'));loading=signal(false);error=signal('');showPassword=signal(false);
  fullName='';email='';password='';
  constructor(){this.router.events.pipe(filter(e=>e instanceof NavigationEnd),takeUntilDestroyed()).subscribe(()=>{this.registerMode.set(this.router.url.startsWith('/inscription'));this.error.set('');});}
  submit():void {
    if(!this.email||!this.password||(this.registerMode()&&!this.fullName.trim())){this.error.set('Veuillez remplir les champs obligatoires.');return;}
    this.loading.set(true);this.error.set('');
    const call=this.registerMode()?this.auth.register(this.fullName,this.email,this.password):this.auth.login(this.email,this.password);
    call.subscribe({next:()=>{this.loading.set(false);void this.router.navigateByUrl('/accueil');},error:(err)=>{this.loading.set(false);this.error.set(err.error?.detail||'Une erreur est survenue. Vérifiez votre connexion.');}});
  }
}
