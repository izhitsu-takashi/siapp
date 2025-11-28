import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-kyuyo-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './kyuyo-dashboard.component.html',
  styleUrl: './kyuyo-dashboard.component.css'
})
export class KyuyoDashboardComponent {
  currentTab: string = '社会保険料';
  
  tabs = [
    { id: 'social-insurance', name: '社会保険料' },
    { id: 'salary', name: '給与' },
    { id: 'bonus', name: '賞与' },
    { id: 'settings', name: '設定' }
  ];

  userName = '給与担当者';

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      const storedName = sessionStorage.getItem('userName');
      if (storedName) {
        this.userName = storedName;
      }
    }
  }

  switchTab(tabName: string) {
    this.currentTab = tabName;
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.clear();
    }
    this.router.navigate(['/login']);
  }
}

