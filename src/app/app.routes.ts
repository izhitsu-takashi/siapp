import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { EmployeeDashboardComponent } from './dashboard/employee-dashboard/employee-dashboard.component';
import { HrDashboardComponent } from './dashboard/hr-dashboard/hr-dashboard.component';
import { KyuyoDashboardComponent } from './dashboard/kyuyo-dashboard/kyuyo-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'dashboard/employee', component: EmployeeDashboardComponent },
  { path: 'dashboard/hr', component: HrDashboardComponent },
  { path: 'dashboard/kyuyo', component: KyuyoDashboardComponent }
];
