import { IconComponent } from '../shared/icon.component';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { User } from '../core/models';
@Component({selector:'app-admin',standalone:true,imports:[IconComponent,FormsModule],template:`
<div class="page-stack"><div class="page-intro"><div><span class="eyebrow">GESTION DE LA PLATEFORME</span><h1>Administration</h1><p>Gérez les comptes utilisateurs et leurs droits d'accès.</p></div></div>
<section class="role-hero admin-hero"><div class="role-hero-copy"><span class="hero-kicker"><app-icon name="shield-check"/> ADMINISTRATION</span><h2>Gérer les comptes et les accès.</h2><p>Attribuez les rôles et activez ou désactivez les comptes utilisateurs.</p></div><img src="/assets/illustrations/admin-control.svg" alt="" width="480" height="320"/></section>
<div class="overview-mini-grid admin-mini-grid"><div class="overview-mini-card"><span class="mini-icon violet"><app-icon name="users-round"/></span><div><small>Utilisateurs affichés</small><strong>{{users().length}}</strong></div></div><div class="overview-mini-card"><span class="mini-icon mint"><app-icon name="graduation-cap"/></span><div><small>Étudiants</small><strong>{{studentCount()}}</strong></div></div><div class="overview-mini-card"><span class="mini-icon peach"><app-icon name="pencil-line"/></span><div><small>Enseignants</small><strong>{{teacherCount()}}</strong></div></div></div>
<div class="admin-info"><app-icon name="shield-check"></app-icon><div><strong>Gestion sécurisée des rôles</strong><p>Seuls les administrateurs peuvent accorder le rôle d'enseignant ou désactiver un compte. Les permissions sont vérifiées par l'API FastAPI.</p></div></div>
<div class="panel"><div class="panel-title"><div><h2>Utilisateurs <span class="muted">({{users().length}})</span></h2><p>Rechercher, gérer les rôles et les statuts.</p></div><div class="admin-search"><label class="search-field narrow"><app-icon name="search"></app-icon><input [(ngModel)]="q" (keyup.enter)="load()" placeholder="Nom ou adresse e-mail" aria-label="Rechercher un utilisateur"/></label><button class="btn btn-soft btn-small" (click)="load()">Rechercher</button></div></div>
@if(message()){<div class="inline-message">{{message()}}</div>}
<div class="table-scroll"><table class="data-table"><thead><tr><th>Utilisateur</th><th>E-mail</th><th>Rôle</th><th>Statut</th><th>Action</th></tr></thead><tbody>@for(u of users();track u.id){<tr><td><div class="user-cell"><div class="avatar small">{{u.full_name.charAt(0)}}</div><strong>{{u.full_name}}</strong></div></td><td>{{u.email}}</td><td><select [(ngModel)]="draftRoles[u.id]" [disabled]="u.id===auth.user()?.id"><option value="student">Étudiant</option><option value="teacher">Enseignant</option><option value="admin">Administrateur</option></select></td><td><label class="toggle-row"><input type="checkbox" [(ngModel)]="draftActive[u.id]" [disabled]="u.id===auth.user()?.id"/> {{draftActive[u.id]?'Actif':'Désactivé'}}</label></td><td><button class="btn btn-soft btn-small" [disabled]="saving()===u.id || u.id===auth.user()?.id" (click)="save(u)">Enregistrer</button></td></tr>}@empty{<tr><td colspan="5">Aucun utilisateur trouvé.</td></tr>}</tbody></table></div></div>
</div>`})
export class AdminPage implements OnInit {
 private api=inject(ApiService);readonly auth=inject(AuthService);
 users=signal<User[]>([]);saving=signal<string|null>(null);message=signal('');
 readonly studentCount=computed(()=>this.users().filter(u=>u.role==='student').length);
 readonly teacherCount=computed(()=>this.users().filter(u=>u.role==='teacher').length);
 q='';draftRoles:Record<string,string>={};draftActive:Record<string,boolean>={};
 ngOnInit():void{this.load();}
 load():void{this.api.adminUsers(this.q).subscribe({next:items=>{this.users.set(items);for(const u of items){this.draftRoles[u.id]=u.role;this.draftActive[u.id]=u.is_active;}},error:()=>this.message.set('Impossible de charger les utilisateurs.')});}
 save(u:User):void{
  const changed=this.draftRoles[u.id]!==u.role || this.draftActive[u.id]!==u.is_active;
  if(!changed){this.message.set('Aucune modification à enregistrer.');return;}
  if(!window.confirm('Confirmer les modifications du compte de '+u.full_name+' ?'))return;
  this.saving.set(u.id);this.api.updateUser(u.id,this.draftRoles[u.id],this.draftActive[u.id]).subscribe({next:()=>{this.saving.set(null);this.message.set('Compte mis à jour.');this.load();},error:e=>{this.saving.set(null);this.message.set(e.error?.detail||'Erreur lors de la mise à jour.');}});}
}
