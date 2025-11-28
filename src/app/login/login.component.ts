import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  loginType: 'employee' | 'roumu' | 'kyuyo' = 'employee';
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private firestoreService: FirestoreService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      username: [''],
      password: ['']
    });
    // 初期状態は従業員ログイン用のバリデーション
    this.loginForm.get('username')?.clearValidators();
    this.loginForm.get('password')?.clearValidators();
  }

  switchLoginType(type: 'employee' | 'roumu' | 'kyuyo') {
    this.loginType = type;
    this.loginForm.reset();
    this.errorMessage = '';
    
    // フォームのバリデーションを更新
    if (type === 'employee') {
      this.loginForm.get('email')?.setValidators([Validators.required, Validators.email]);
      this.loginForm.get('email')?.updateValueAndValidity();
      this.loginForm.get('username')?.clearValidators();
      this.loginForm.get('username')?.updateValueAndValidity();
      this.loginForm.get('password')?.setValidators([]); // 従業員はパスワード任意
      this.loginForm.get('password')?.updateValueAndValidity();
    } else {
      this.loginForm.get('email')?.clearValidators();
      this.loginForm.get('email')?.updateValueAndValidity();
      this.loginForm.get('username')?.setValidators([Validators.required]);
      this.loginForm.get('username')?.updateValueAndValidity();
      this.loginForm.get('password')?.setValidators([Validators.required]);
      this.loginForm.get('password')?.updateValueAndValidity();
    }
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      // ローディング中はフォームを無効化
      this.loginForm.disable();

      try {
        if (this.loginType === 'employee') {
          // 従業員ログイン: メールアドレスのみで認証
          const email = this.loginForm.value.email;
          
          const employee = await this.firestoreService.getEmployeeByEmail(email);
          
          if (employee) {
            // ログイン成功: 社員番号をセッションストレージに保存（ブラウザ環境でのみ）
            if (employee.employeeNumber && isPlatformBrowser(this.platformId)) {
              sessionStorage.setItem('employeeNumber', employee.employeeNumber);
              sessionStorage.setItem('employeeName', employee.name || '');
            }
            this.router.navigate(['/dashboard/employee']);
          } else {
            this.errorMessage = 'このメールアドレスは登録されていません。社員情報管理で登録されているメールアドレスでログインしてください。';
          }
        } else if (this.loginType === 'roumu') {
          // 労務担当者ログイン: ユーザーネーム：roumu、パスワード：roumu
          const username = this.loginForm.value.username;
          const password = this.loginForm.value.password;
          
          if (username === 'roumu' && password === 'roumu') {
            if (isPlatformBrowser(this.platformId)) {
              sessionStorage.setItem('userType', 'roumu');
              sessionStorage.setItem('userName', '労務担当者');
            }
            this.router.navigate(['/dashboard/hr']);
          } else {
            this.errorMessage = 'ユーザーネームまたはパスワードが正しくありません。';
          }
        } else if (this.loginType === 'kyuyo') {
          // 給与担当者ログイン: ユーザーネーム：kyuyo、パスワード：kyuyo
          const username = this.loginForm.value.username;
          const password = this.loginForm.value.password;
          
          if (username === 'kyuyo' && password === 'kyuyo') {
            if (isPlatformBrowser(this.platformId)) {
              sessionStorage.setItem('userType', 'kyuyo');
              sessionStorage.setItem('userName', '給与担当者');
            }
            this.router.navigate(['/dashboard/kyuyo']);
          } else {
            this.errorMessage = 'ユーザーネームまたはパスワードが正しくありません。';
          }
        }
      } catch (error) {
        console.error('Login error:', error);
        this.errorMessage = 'ログイン中にエラーが発生しました。もう一度お試しください。';
      } finally {
        this.isLoading = false;
        // ローディング終了後はフォームを有効化
        this.loginForm.enable();
      }
    }
  }
}

