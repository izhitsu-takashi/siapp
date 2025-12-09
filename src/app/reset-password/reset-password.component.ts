import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup;
  isLoading = false;
  isValidatingToken = true;
  errorMessage = '';
  successMessage = '';
  token = '';
  email = '';
  isTokenValid = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private firestoreService: FirestoreService
  ) {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    try {
      // URLパラメータからトークンとメールアドレスを取得
      this.route.queryParams.subscribe({
        next: (params) => {
          this.token = params['token'] || '';
          this.email = decodeURIComponent(params['email'] || '');

          console.log('Reset password params:', { token: this.token, email: this.email });

          if (!this.token || !this.email) {
            this.errorMessage = '無効なリンクです。';
            this.isValidatingToken = false;
            return;
          }

          // トークンの有効性を確認
          this.validateToken();
        },
        error: (error) => {
          console.error('Error reading query params:', error);
          this.errorMessage = 'URLパラメータの読み込みに失敗しました。';
          this.isValidatingToken = false;
        }
      });
    } catch (error) {
      console.error('Error in ngOnInit:', error);
      this.errorMessage = 'ページの初期化に失敗しました。';
      this.isValidatingToken = false;
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');

    if (!newPassword || !confirmPassword) {
      return null;
    }

    if (newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      confirmPassword.setErrors(null);
      return null;
    }
  }

  async validateToken() {
    try {
      this.isValidatingToken = true;
      this.errorMessage = '';

      const isValid = await this.firestoreService.verifyPasswordResetToken(
        this.token,
        this.email
      );

      if (!isValid) {
        this.errorMessage = 'このリンクは無効または期限切れです。パスワード再発行ページから再度メールを送信してください。';
        this.isTokenValid = false;
      } else {
        this.isTokenValid = true;
      }
    } catch (error) {
      console.error('Error validating token:', error);
      this.errorMessage = 'トークンの確認中にエラーが発生しました。';
      this.isTokenValid = false;
    } finally {
      this.isValidatingToken = false;
    }
  }

  async onSubmit() {
    if (this.resetPasswordForm.valid && this.isTokenValid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      try {
        const newPassword = this.resetPasswordForm.value.newPassword;

        // パスワードを更新
        await this.firestoreService.resetPassword(
          this.token,
          this.email,
          newPassword
        );

        this.successMessage = 'パスワードを変更しました。ログイン画面から新しいパスワードでログインしてください。';
        this.resetPasswordForm.reset();

        // 3秒後にログイン画面にリダイレクト
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      } catch (error: any) {
        console.error('Error resetting password:', error);
        this.errorMessage = error.message || 'パスワードの変更に失敗しました。もう一度お試しください。';
      } finally {
        this.isLoading = false;
      }
    } else {
      this.resetPasswordForm.markAllAsTouched();
      if (!this.isTokenValid) {
        this.errorMessage = '無効なリンクです。';
      } else {
        this.errorMessage = '必須項目を正しく入力してください。';
      }
    }
  }
}

