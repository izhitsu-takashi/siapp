import { TestBed } from '@angular/core/testing';
import { HrDashboardComponent } from './hr-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PdfEditService } from '../../services/pdf-edit.service';
import { ChangeDetectorRef } from '@angular/core';

describe('HrDashboardComponent - Application Management Tests', () => {
  let component: HrDashboardComponent;
  let firestoreService: jasmine.SpyObj<FirestoreService>;
  let router: jasmine.SpyObj<Router>;
  let fb: FormBuilder;

  beforeEach(async () => {
    // アラートをモック（テスト中にアラートが表示されないようにする）
    spyOn(window, 'alert');
    spyOn(window, 'confirm').and.returnValue(true);

    const firestoreServiceSpy = jasmine.createSpyObj('FirestoreService', [
      'getAllApplications',
      'getEmployeeData',
      'updateApplicationStatus',
      'getApplicationRequestsByEmployee',
      'saveApplicationRequest'
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const pdfEditServiceSpy = jasmine.createSpyObj('PdfEditService', ['generateDocument']);
    const cdrSpy = jasmine.createSpyObj('ChangeDetectorRef', ['detectChanges']);

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, HttpClientTestingModule, HrDashboardComponent],
      providers: [
        { provide: FirestoreService, useValue: firestoreServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: PdfEditService, useValue: pdfEditServiceSpy },
        { provide: ChangeDetectorRef, useValue: cdrSpy },
        FormBuilder
      ]
    }).compileComponents();

    firestoreService = TestBed.inject(FirestoreService) as jasmine.SpyObj<FirestoreService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    fb = TestBed.inject(FormBuilder);

    component = new HrDashboardComponent(
      router,
      fb,
      firestoreService,
      {} as any,
      pdfEditServiceSpy,
      cdrSpy
    );
  });

  describe('申請の取得と表示', () => {
    it('扶養家族追加申請（配偶者）が正しく取得・表示されること', async () => {
      const mockApplication = {
        id: 'APP001',
        applicationId: 1,
        employeeNumber: 'EMP001',
        employeeName: 'テスト太郎',
        applicationType: '扶養家族追加',
        status: '承認待ち',
        relationshipType: '配偶者',
        spouseType: '妻',
        lastName: '山田',
        firstName: '花子',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'ハナコ',
        birthDate: '1990-01-01',
        basicPensionNumber: '12345678',
        livingTogether: '同居',
        dependentStartDate: '2024-01-01',
        dependentReason: '婚姻',
        occupation: '無職',
        annualIncome: '0',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      };

      const mockEmployee = {
        employeeNumber: 'EMP001',
        name: 'テスト太郎'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(mockEmployee));

      await component.loadAllApplications();

      expect(component.allApplications.length).toBe(1);
      expect(component.allApplications[0].applicationType).toBe('扶養家族追加');
      expect(component.allApplications[0].relationshipType).toBe('配偶者');
      expect(component.allApplications[0].spouseType).toBe('妻');
      expect(component.allApplications[0].lastName).toBe('山田');
      expect(component.allApplications[0].firstName).toBe('花子');
      expect(component.allApplications[0].employeeName).toBe('テスト太郎');
    });

    it('扶養家族追加申請（配偶者以外、その他選択）が正しく取得・表示されること', async () => {
      const mockApplication = {
        id: 'APP002',
        applicationId: 2,
        employeeNumber: 'EMP002',
        employeeName: 'テスト次郎',
        applicationType: '扶養家族追加',
        status: '承認待ち',
        relationshipType: '配偶者以外',
        relationship: 'その他',
        relationshipOther: '義理の兄弟',
        lastName: '鈴木',
        firstName: '次郎',
        lastNameKana: 'スズキ',
        firstNameKana: 'ジロウ',
        birthDate: '2005-09-10',
        gender: '男性',
        myNumber: '111122223333',
        livingTogether: '同居',
        dependentStartDate: '2024-05-01',
        dependentReason: 'その他',
        dependentReasonOther: '特別な事情',
        occupation: '高校生',
        annualIncome: '0',
        spouseAnnualIncome: '4000000',
        createdAt: new Date('2024-05-01'),
        updatedAt: new Date('2024-05-01')
      };

      const mockEmployee = {
        employeeNumber: 'EMP002',
        name: 'テスト次郎'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(mockEmployee));

      await component.loadAllApplications();

      expect(component.allApplications.length).toBe(1);
      expect(component.allApplications[0].relationshipType).toBe('配偶者以外');
      expect(component.allApplications[0].relationship).toBe('その他');
      expect(component.allApplications[0].relationshipOther).toBe('義理の兄弟');
      expect(component.allApplications[0].dependentReason).toBe('その他');
      expect(component.allApplications[0].dependentReasonOther).toBe('特別な事情');
    });

    it('扶養家族追加申請（配偶者以外、大学生）が正しく取得・表示されること', async () => {
      const mockApplication = {
        id: 'APP003',
        applicationId: 3,
        employeeNumber: 'EMP003',
        employeeName: 'テスト三郎',
        applicationType: '扶養家族追加',
        status: '承認待ち',
        relationshipType: '配偶者以外',
        relationship: '実子・養子',
        lastName: '高橋',
        firstName: '三郎',
        lastNameKana: 'タカハシ',
        firstNameKana: 'サブロウ',
        birthDate: '2003-11-25',
        gender: '男性',
        myNumber: '555566667777',
        livingTogether: '同居',
        dependentStartDate: '2024-06-01',
        dependentReason: '収入減少',
        occupation: '大学生',
        studentYear: '2年',
        annualIncome: '0',
        spouseAnnualIncome: '3500000',
        createdAt: new Date('2024-06-01'),
        updatedAt: new Date('2024-06-01')
      };

      const mockEmployee = {
        employeeNumber: 'EMP003',
        name: 'テスト三郎'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(mockEmployee));

      await component.loadAllApplications();

      expect(component.allApplications.length).toBe(1);
      expect(component.allApplications[0].occupation).toBe('大学生');
      expect(component.allApplications[0].studentYear).toBe('2年');
    });

    it('退職申請が正しく取得・表示されること', async () => {
      const mockApplication = {
        id: 'APP004',
        applicationId: 4,
        employeeNumber: 'EMP004',
        employeeName: 'テスト四郎',
        applicationType: '退職申請',
        status: '承認待ち',
        resignationDate: '2024-12-31',
        lastWorkDate: '2024-12-31',
        resignationReason: '転職のため',
        separationNotice: 'あり',
        postResignationAddress: '東京都港区4-5-6',
        postResignationPhone: '080-1111-2222',
        postResignationEmail: 'newemail@example.com',
        postResignationInsurance: '国民健康保険',
        sameAsCurrentAddress: false,
        sameAsCurrentPhone: false,
        sameAsCurrentEmail: false,
        createdAt: new Date('2024-12-01'),
        updatedAt: new Date('2024-12-01')
      };

      const mockEmployee = {
        employeeNumber: 'EMP004',
        name: 'テスト四郎'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve(mockEmployee));

      await component.loadAllApplications();

      expect(component.allApplications.length).toBe(1);
      expect(component.allApplications[0].applicationType).toBe('退職申請');
      expect(component.allApplications[0].resignationDate).toBe('2024-12-31');
      expect(component.allApplications[0].resignationReason).toBe('転職のため');
      expect(component.allApplications[0].postResignationAddress).toBe('東京都港区4-5-6');
    });
  });

  describe('申請ステータスの更新', () => {
    beforeEach(() => {
      component.selectedApplication = {
        id: 'APP001',
        applicationId: 1,
        employeeNumber: 'EMP001',
        applicationType: '扶養家族追加',
        status: '承認待ち'
      };
      component.statusChangeForm = fb.group({
        status: ['承認待ち'],
        comment: ['']
      });
    });

    it('申請を「承認済み」に更新できること', async () => {
      component.statusChangeForm.patchValue({
        status: '承認済み',
        comment: ''
      });

      firestoreService.updateApplicationStatus.and.returnValue(Promise.resolve());
      firestoreService.getAllApplications.and.returnValue(Promise.resolve([]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({}));

      await component.updateApplicationStatus();

      expect(firestoreService.updateApplicationStatus).toHaveBeenCalledWith(
        'APP001',
        '承認済み',
        ''
      );
    });

    it('申請を「差し戻し」に更新し、コメントが保存されること', async () => {
      component.statusChangeForm.patchValue({
        status: '差し戻し',
        comment: '必須項目が不足しています'
      });

      firestoreService.updateApplicationStatus.and.returnValue(Promise.resolve());
      firestoreService.getAllApplications.and.returnValue(Promise.resolve([]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({}));

      await component.updateApplicationStatus();

      expect(firestoreService.updateApplicationStatus).toHaveBeenCalledWith(
        'APP001',
        '差し戻し',
        '必須項目が不足しています'
      );
    });

    it('申請を「取り消し」に更新できること', async () => {
      component.selectedApplication = {
        id: 'APP001',
        applicationId: 1,
        employeeNumber: 'EMP001',
        applicationType: '退職申請',
        status: '承認待ち'
      };

      firestoreService.updateApplicationStatus.and.returnValue(Promise.resolve());
      firestoreService.getAllApplications.and.returnValue(Promise.resolve([]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({}));

      await component.cancelApplication();

      expect(firestoreService.updateApplicationStatus).toHaveBeenCalledWith(
        'APP001',
        '取り消し',
        ''
      );
    });
  });

  describe('申請フィルタリング', () => {
    beforeEach(async () => {
      const mockApplications = [
        {
          id: 'APP001',
          applicationId: 1,
          employeeNumber: 'EMP001',
          applicationType: '扶養家族追加',
          status: '承認待ち',
          createdAt: new Date('2024-01-01')
        },
        {
          id: 'APP002',
          applicationId: 2,
          employeeNumber: 'EMP002',
          applicationType: '退職申請',
          status: '承認済み',
          createdAt: new Date('2024-02-01')
        },
        {
          id: 'APP003',
          applicationId: 3,
          employeeNumber: 'EMP003',
          applicationType: '扶養家族追加',
          status: '差し戻し',
          createdAt: new Date('2024-03-01')
        },
        {
          id: 'APP004',
          applicationId: 4,
          employeeNumber: 'EMP004',
          applicationType: '退職申請',
          status: '取り消し',
          createdAt: new Date('2024-04-01')
        }
      ];

      firestoreService.getAllApplications.and.returnValue(Promise.resolve(mockApplications));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({ name: 'テスト' }));

      await component.loadAllApplications();
    });

    it('ステータスフィルター「承認待ち」で正しくフィルタリングされること', () => {
      component.applicationStatusFilter = '承認待ち';
      component.filterAndSortApplications();

      expect(component.filteredApplications.length).toBe(1);
      expect(component.filteredApplications[0].status).toBe('承認待ち');
    });

    it('ステータスフィルター「承認済み」で正しくフィルタリングされること', () => {
      component.applicationStatusFilter = '承認済み';
      component.filterAndSortApplications();

      expect(component.filteredApplications.length).toBe(1);
      expect(component.filteredApplications[0].status).toBe('承認済み');
    });

    it('ステータスフィルター「差し戻し」で正しくフィルタリングされること', () => {
      component.applicationStatusFilter = '差し戻し';
      component.filterAndSortApplications();

      expect(component.filteredApplications.length).toBe(1);
      expect(component.filteredApplications[0].status).toBe('差し戻し');
    });

    it('ステータスフィルター「取り消し」で正しくフィルタリングされること', () => {
      component.applicationStatusFilter = '取り消し';
      component.filterAndSortApplications();

      expect(component.filteredApplications.length).toBe(1);
      expect(component.filteredApplications[0].status).toBe('取り消し');
    });

    it('ステータスフィルター「すべて」で全申請が表示されること', () => {
      component.applicationStatusFilter = 'すべて';
      component.filterAndSortApplications();

      expect(component.filteredApplications.length).toBe(4);
    });
  });

  describe('データ整合性チェック', () => {
    it('扶養家族追加申請で「その他」が選択された場合、relationshipOtherが存在すること', async () => {
      const mockApplication = {
        id: 'APP001',
        applicationId: 1,
        employeeNumber: 'EMP001',
        applicationType: '扶養家族追加',
        relationshipType: '配偶者以外',
        relationship: 'その他',
        relationshipOther: '義理の兄弟',
        status: '承認待ち'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({ name: 'テスト' }));

      await component.loadAllApplications();

      const app = component.allApplications[0];
      expect(app.relationship).toBe('その他');
      expect(app.relationshipOther).toBe('義理の兄弟');
      expect(app.relationshipOther).toBeTruthy();
    });

    it('扶養家族追加申請で職業が「大学生」の場合、studentYearが存在すること', async () => {
      const mockApplication = {
        id: 'APP002',
        applicationId: 2,
        employeeNumber: 'EMP002',
        applicationType: '扶養家族追加',
        occupation: '大学生',
        studentYear: '2年',
        status: '承認待ち'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({ name: 'テスト' }));

      await component.loadAllApplications();

      const app = component.allApplications[0];
      expect(app.occupation).toBe('大学生');
      expect(app.studentYear).toBe('2年');
      expect(app.studentYear).toBeTruthy();
    });

    it('扶養家族追加申請で職業が「その他」の場合、occupationOtherが存在すること', async () => {
      const mockApplication = {
        id: 'APP003',
        applicationId: 3,
        employeeNumber: 'EMP003',
        applicationType: '扶養家族追加',
        occupation: 'その他',
        occupationOther: '自営業',
        status: '承認待ち'
      };

      firestoreService.getAllApplications.and.returnValue(Promise.resolve([mockApplication]));
      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({ name: 'テスト' }));

      await component.loadAllApplications();

      const app = component.allApplications[0];
      expect(app.occupation).toBe('その他');
      expect(app.occupationOther).toBe('自営業');
      expect(app.occupationOther).toBeTruthy();
    });
  });
});

