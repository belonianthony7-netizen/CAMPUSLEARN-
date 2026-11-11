import { IconComponent } from '../shared/icon.component';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { Notification } from '../core/models';
@Component({selector:'app-notifications',standalone:true,imports:[IconComponent,DatePipe],template:`
<div class="page-stack"><div class="page-intro"><div><span class="eyebrow">LA VIE DE TES COURS</span><h1>Des nouvelles de ton campus</h1><p>Messages de cours, annonces et informations importantes : tout est ici.</p></div></div>
<div class="notification-summary"><span class="mini-icon violet"><app-icon name="bell"/></span><div><strong>{{unreadCount()}} notification(s) non lue(s)</strong><p>Retrouvez ici les nouveautés de votre espace de cours.</p></div></div>
<div class="panel notification-panel">@for(n of notes();track n.id){<div class="notification-item" [class.unread]="!n.read"><span class="notification-icon"><app-icon name="bell"></app-icon></span><div><h3>{{n.title}}</h3><p>{{n.message}}</p><small>{{n.created_at|date:'dd MMM yyyy · HH:mm'}}</small></div>@if(!n.read){<button class="btn btn-soft btn-small" (click)="read(n)">Marquer comme lu</button>}</div>}@empty{<div class="empty-state inner"><img class="campus-empty-3d" src="/assets/illustrations/3d/notification.png" alt="" width="512" height="512" loading="lazy"><h3>Tout est à jour ✨</h3><p>Rien de nouveau pour l’instant. Profite-en pour avancer dans un cours.</p></div>}</div>
</div>`})
export class NotificationsPage implements OnInit {
 private api=inject(ApiService);notes=signal<Notification[]>([]);unreadCount=computed(()=>this.notes().filter(n=>!n.read).length);
 ngOnInit():void{this.load();}load():void{this.api.notifications().subscribe({next:items=>this.notes.set(items)});}
 read(n:Notification){this.api.readNotification(n.id).subscribe({next:()=>this.load()});}
}
