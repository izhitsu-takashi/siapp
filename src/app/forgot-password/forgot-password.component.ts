import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FirestoreService } from '../services/firestore.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private firestoreService: FirestoreService
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      try {
        const email = this.forgotPasswordForm.value.email;
        
        // メールアドレスが登録されているか確認
        const employee = await this.firestoreService.getEmployeeByEmail(email);
        
        if (!employee) {
          this.errorMessage = 'このメールアドレスは登録されていません。';
          return;
        }

        // パスワード再発行メールを送信
        await this.firestoreService.sendPasswordResetEmail(email);
        
        this.successMessage = 'パスワード再発行用のメールを送信しました。メールをご確認ください。';
        this.forgotPasswordForm.reset();
      } catch (error) {
        console.error('Error sending password reset email:', error);
        this.errorMessage = 'メール送信中にエラーが発生しました。もう一度お試しください。';
      } finally {
        this.isLoading = false;
      }
    }
  }
}

