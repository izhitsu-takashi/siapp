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
  loginType: 'employee' | 'hr' = 'employee';
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
      password: [''] // パスワードは任意
    });
  }

  switchLoginType(type: 'employee' | 'hr') {
    this.loginType = type;
    this.loginForm.reset();
    this.errorMessage = '';
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      // ローディング中はフォームを無効化
      this.loginForm.disable();

      try {
        if (this.loginType === 'employee') {
          // 従業員ログイン: メールアドレスで認証（パスワードは任意）
          const email = this.loginForm.value.email;
          const password = this.loginForm.value.password || '';
          
          const employee = await this.firestoreService.getEmployeeByEmail(email);
          
          if (employee) {
            // パスワードが入力されている場合のみチェック
            if (password) {
              // パスワードが設定されている場合、パスワードをチェック
              if (employee.password && employee.password !== password) {
                this.errorMessage = 'メールアドレスまたはパスワードが正しくありません。';
                this.isLoading = false;
                this.loginForm.enable();
                return;
              }
            }
            
            // ログイン成功: 社員番号をセッションストレージに保存（ブラウザ環境でのみ）
            if (employee.employeeNumber && isPlatformBrowser(this.platformId)) {
              sessionStorage.setItem('employeeNumber', employee.employeeNumber);
              sessionStorage.setItem('employeeName', employee.name || '');
            }
            this.router.navigate(['/dashboard/employee']);
          } else {
            this.errorMessage = 'このメールアドレスは登録されていません。社員情報管理で登録されているメールアドレスでログインしてください。';
          }
        } else {
          // 人事用ログイン: 現時点では検証なし（後で実装可能）
          this.router.navigate(['/dashboard/hr']);
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

