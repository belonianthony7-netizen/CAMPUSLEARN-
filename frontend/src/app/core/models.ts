export type Role = 'student' | 'teacher' | 'admin';
export interface User { id:string; full_name:string; email:string; role:Role; is_active:boolean; }
export interface Session { access_token:string; token_type:string; user:User; }
export interface Course {
  id:string; title:string; description:string; category:string; level:string; color:string;
  teacher_id:string; teacher_name:string; duration_hours:number; published:boolean; cover_image:string;
  lesson_count:number; student_count:number; is_enrolled:boolean; progress:number; created_at:string;
}
export interface Lesson {id:string; course_id:string; title:string; content:string; position:number; video_url:string|null; material_url:string|null; completed:boolean;}
export interface Question {id:string; prompt:string; options:string[]; correct_index?:number;}
export interface Quiz {id:string; course_id:string; title:string; duration_minutes:number; question_count:number; questions:Question[];}
export interface Assignment {id:string; course_id:string; title:string; description:string; due_at:string|null; max_score:number; submission:{id:string;content:string;score:number|null;feedback:string|null}|null;}
export interface Submission {id:string; student_name:string; student_id:string; content:string; score:number|null; feedback:string|null; submitted_at:string;}
export interface CourseStudent {id:string;name:string;email:string;progress:number;quiz_attempts:number;quiz_average:number|null;submissions:number;graded_submissions:number;}
export interface CourseQuizAttempt {id:string;quiz_id:string;quiz_title:string;student_id:string;student_name:string;score:number;total:number;percentage:number;submitted_at:string;}
export interface Announcement {id:string;title:string;body:string;created_at:string;}
export interface Post {id:string;content:string;author:string;author_role:Role;created_at:string;}
export interface Notification {id:string;title:string;message:string;read:boolean;created_at:string;}
export interface Dashboard {
  role:Role; courses:number; students?:number; enrollments?:number; assignments?:number;
  users?:number; completed?:number; quizzes?:number; average_score?:number; pending_submissions?:number; quiz_attempts?:number; recent_courses:Course[];
}
