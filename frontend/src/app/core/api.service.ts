import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Announcement, Assignment, Course, CourseStudent, CourseQuizAttempt, Dashboard, Lesson, Notification, Post, Quiz, Submission, User } from './models';

@Injectable({providedIn:'root'})
export class ApiService {
  private http = inject(HttpClient);
  dashboard() {return this.http.get<Dashboard>('/api/dashboard');}
  courses(q='', category='', mine=false) {return this.http.get<Course[]>('/api/courses', {params: new HttpParams().set('q',q).set('category',category).set('mine',mine)});}
  course(id:string) {return this.http.get<Course>(`/api/courses/${id}`);}
  createCourse(payload:Partial<Course>) {return this.http.post<Course>('/api/courses',payload);}
  updateCourse(id:string,payload:Partial<Course>) {return this.http.patch<Course>(`/api/courses/${id}`,payload);}
  enroll(id:string) {return this.http.post(`/api/courses/${id}/enroll`,{});}
  lessons(id:string) {return this.http.get<Lesson[]>(`/api/courses/${id}/lessons`);}
  uploadFile(courseId:string,file:File){const body=new FormData();body.append('file',file);return this.http.post<{id:string;name:string;size:number;url:string}>(`/api/courses/${courseId}/files`,body);}
  downloadFile(url:string){return this.http.get(url,{responseType:'blob'});}
  addLesson(id:string,payload:Partial<Lesson>) {return this.http.post<{id:string;title:string}>(`/api/courses/${id}/lessons`,payload);}
  updateLesson(id:string,payload:Partial<Lesson>) {return this.http.patch<{id:string;title:string;video_url:string|null}>(`/api/lessons/${id}`,payload);}
  completeLesson(id:string) {return this.http.patch(`/api/lessons/${id}/complete`,{});}
  quizzes(id:string) {return this.http.get<Quiz[]>(`/api/courses/${id}/quizzes`);}
  addQuiz(id:string,payload:{title:string;duration_minutes:number;questions:{prompt:string;options:string[];correct_index:number}[]}) {return this.http.post(`/api/courses/${id}/quizzes`,payload);}
  submitQuiz(id:string,answers:Record<string,number>) {return this.http.post<{score:number;total:number;percentage:number}>(`/api/quizzes/${id}/submit`,{answers});}
  assignments(id:string) {return this.http.get<Assignment[]>(`/api/courses/${id}/assignments`);}
  addAssignment(id:string,payload:{title:string;description:string;due_at:string|null;max_score:number}) {return this.http.post(`/api/courses/${id}/assignments`,payload);}
  submitAssignment(id:string,content:string) {return this.http.post(`/api/assignments/${id}/submit`,{content});}
  submissions(id:string) {return this.http.get<Submission[]>(`/api/assignments/${id}/submissions`);}
  grade(id:string,score:number,feedback:string) {return this.http.patch(`/api/submissions/${id}/grade`,{score,feedback});}
  posts(id:string) {return this.http.get<Post[]>(`/api/courses/${id}/posts`);}
  addPost(id:string,content:string) {return this.http.post(`/api/courses/${id}/posts`,{content});}
  announcements(id:string) {return this.http.get<Announcement[]>(`/api/courses/${id}/announcements`);}
  addAnnouncement(id:string,title:string,body:string) {return this.http.post(`/api/courses/${id}/announcements`,{title,body});}
  notifications() {return this.http.get<Notification[]>('/api/notifications');}
  readNotification(id:string) {return this.http.patch(`/api/notifications/${id}/read`,{});}
  adminUsers(q='') {return this.http.get<User[]>('/api/admin/users',{params:{q}});}
  updateUser(id:string,role:string,is_active:boolean) {return this.http.patch<User>(`/api/admin/users/${id}`,{role,is_active});}
  students(id:string) {return this.http.get<CourseStudent[]>(`/api/teacher/courses/${id}/students`);}
  quizAttempts(id:string) {return this.http.get<CourseQuizAttempt[]>(`/api/teacher/courses/${id}/quiz-attempts`);}
}
