import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { Session, User } from './models';

const TOKEN_KEY = 'campuslearn_access_token';
const USER_KEY = 'campuslearn_user';

@Injectable({providedIn:'root'})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly _user = signal<User | null>(this.restoreUser());
  readonly user = this._user.asReadonly();
  readonly signedIn = computed(() => !!this._user() && !!this.token());
  token(): string | null { return localStorage.getItem(TOKEN_KEY); }
  private restoreUser(): User | null {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') as User | null; }
    catch { return null; }
  }
  private save(s: Session): void {
    localStorage.setItem(TOKEN_KEY, s.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(s.user));
    this._user.set(s.user);
  }
  login(email:string,password:string) {return this.http.post<Session>('/api/auth/login',{email,password}).pipe(tap(s=>this.save(s)));}
  register(full_name:string,email:string,password:string) {return this.http.post<Session>('/api/auth/register',{full_name,email,password}).pipe(tap(s=>this.save(s)));}
  refresh() {return this.http.get<User>('/api/auth/me').pipe(tap(u=>{this._user.set(u); localStorage.setItem(USER_KEY,JSON.stringify(u));}));}
  updateLocalUser(user:User):void {this._user.set(user);localStorage.setItem(USER_KEY,JSON.stringify(user));}
  logout():void {localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_KEY);this._user.set(null); void this.router.navigateByUrl('/connexion');}
}
