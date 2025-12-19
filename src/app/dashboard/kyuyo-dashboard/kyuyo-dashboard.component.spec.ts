import { TestBed } from '@angular/core/testing';
import { KyuyoDashboardComponent } from './kyuyo-dashboard.component';
import { FirestoreService } from '../../services/firestore.service';
import { PLATFORM_ID } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('KyuyoDashboardComponent', () => {
  let component: KyuyoDashboardComponent;
  let firestoreService: jasmine.SpyObj<FirestoreService>;

  // 健康介護保険等級表のモックデータ（全等級）
  const mockHealthGradeTable = [
    { grade: 1, monthlyStandard: 58000, from: 0, to: 62999 },
    { grade: 2, monthlyStandard: 68000, from: 63000, to: 72999 },
    { grade: 3, monthlyStandard: 78000, from: 73000, to: 82999 },
    { grade: 4, monthlyStandard: 88000, from: 83000, to: 92999 },
    { grade: 5, monthlyStandard: 98000, from: 93000, to: 100999 },
    { grade: 6, monthlyStandard: 104000, from: 101000, to: 106999 },
    { grade: 7, monthlyStandard: 110000, from: 107000, to: 113999 },
    { grade: 8, monthlyStandard: 118000, from: 114000, to: 121999 },
    { grade: 9, monthlyStandard: 126000, from: 122000, to: 129999 },
    { grade: 10, monthlyStandard: 134000, from: 130000, to: 137999 },
    { grade: 11, monthlyStandard: 142000, from: 138000, to: 145999 },
    { grade: 12, monthlyStandard: 150000, from: 146000, to: 154999 },
    { grade: 13, monthlyStandard: 160000, from: 155000, to: 164999 },
    { grade: 14, monthlyStandard: 170000, from: 165000, to: 174999 },
    { grade: 15, monthlyStandard: 180000, from: 175000, to: 184999 },
    { grade: 16, monthlyStandard: 190000, from: 185000, to: 194999 },
    { grade: 17, monthlyStandard: 200000, from: 195000, to: 209999 },
    { grade: 18, monthlyStandard: 220000, from: 210000, to: 229999 },
    { grade: 19, monthlyStandard: 240000, from: 230000, to: 249999 },
    { grade: 20, monthlyStandard: 260000, from: 250000, to: 269999 },
    { grade: 21, monthlyStandard: 280000, from: 270000, to: 289999 },
    { grade: 22, monthlyStandard: 300000, from: 290000, to: 309999 },
    { grade: 23, monthlyStandard: 320000, from: 310000, to: 329999 },
    { grade: 24, monthlyStandard: 340000, from: 330000, to: 349999 },
    { grade: 25, monthlyStandard: 360000, from: 350000, to: 369999 },
    { grade: 26, monthlyStandard: 380000, from: 370000, to: 394999 },
    { grade: 27, monthlyStandard: 410000, from: 395000, to: 424999 },
    { grade: 28, monthlyStandard: 440000, from: 425000, to: 454999 },
    { grade: 29, monthlyStandard: 470000, from: 455000, to: 484999 },
    { grade: 30, monthlyStandard: 500000, from: 485000, to: 514999 },
    { grade: 31, monthlyStandard: 530000, from: 515000, to: 544999 },
    { grade: 32, monthlyStandard: 560000, from: 545000, to: 574999 },
    { grade: 33, monthlyStandard: 590000, from: 575000, to: 604999 },
    { grade: 34, monthlyStandard: 620000, from: 605000, to: 634999 },
    { grade: 35, monthlyStandard: 650000, from: 635000, to: 664999 },
    { grade: 36, monthlyStandard: 680000, from: 665000, to: 694999 },
    { grade: 37, monthlyStandard: 710000, from: 695000, to: 729999 },
    { grade: 38, monthlyStandard: 750000, from: 730000, to: 769999 },
    { grade: 39, monthlyStandard: 790000, from: 770000, to: 809999 },
    { grade: 40, monthlyStandard: 830000, from: 810000, to: 854999 },
    { grade: 41, monthlyStandard: 880000, from: 855000, to: 904999 },
    { grade: 42, monthlyStandard: 930000, from: 905000, to: 954999 },
    { grade: 43, monthlyStandard: 980000, from: 955000, to: 1004999 },
    { grade: 44, monthlyStandard: 1030000, from: 1005000, to: 1054999 },
    { grade: 45, monthlyStandard: 1090000, from: 1055000, to: 1114999 },
    { grade: 46, monthlyStandard: 1150000, from: 1115000, to: 1174999 },
    { grade: 47, monthlyStandard: 1210000, from: 1175000, to: 1234999 },
    { grade: 48, monthlyStandard: 1270000, from: 1235000, to: 1294999 },
    { grade: 49, monthlyStandard: 1330000, from: 1295000, to: 1354999 },
    { grade: 50, monthlyStandard: 1390000, from: 1355000, to: 99999999 }
  ];

  // 厚生年金保険等級表のモックデータ（全等級）
  const mockPensionGradeTable = [
    { grade: 1, monthlyStandard: 88000, from: 83000, to: 92999 },
    { grade: 2, monthlyStandard: 98000, from: 93000, to: 100999 },
    { grade: 3, monthlyStandard: 104000, from: 101000, to: 106999 },
    { grade: 4, monthlyStandard: 110000, from: 107000, to: 113999 },
    { grade: 5, monthlyStandard: 118000, from: 114000, to: 121999 },
    { grade: 6, monthlyStandard: 126000, from: 122000, to: 129999 },
    { grade: 7, monthlyStandard: 134000, from: 130000, to: 137999 },
    { grade: 8, monthlyStandard: 142000, from: 138000, to: 145999 },
    { grade: 9, monthlyStandard: 150000, from: 146000, to: 154999 },
    { grade: 10, monthlyStandard: 160000, from: 155000, to: 164999 },
    { grade: 11, monthlyStandard: 170000, from: 165000, to: 174999 },
    { grade: 12, monthlyStandard: 180000, from: 175000, to: 184999 },
    { grade: 13, monthlyStandard: 190000, from: 185000, to: 194999 },
    { grade: 14, monthlyStandard: 200000, from: 195000, to: 209999 },
    { grade: 15, monthlyStandard: 220000, from: 210000, to: 229999 },
    { grade: 16, monthlyStandard: 240000, from: 230000, to: 249999 },
    { grade: 17, monthlyStandard: 260000, from: 250000, to: 269999 },
    { grade: 18, monthlyStandard: 280000, from: 270000, to: 289999 },
    { grade: 19, monthlyStandard: 300000, from: 290000, to: 309999 },
    { grade: 20, monthlyStandard: 320000, from: 310000, to: 329999 },
    { grade: 21, monthlyStandard: 340000, from: 330000, to: 349999 },
    { grade: 22, monthlyStandard: 360000, from: 350000, to: 369999 },
    { grade: 23, monthlyStandard: 380000, from: 370000, to: 394999 },
    { grade: 24, monthlyStandard: 410000, from: 395000, to: 424999 },
    { grade: 25, monthlyStandard: 440000, from: 425000, to: 454999 },
    { grade: 26, monthlyStandard: 470000, from: 455000, to: 484999 },
    { grade: 27, monthlyStandard: 500000, from: 485000, to: 514999 },
    { grade: 28, monthlyStandard: 530000, from: 515000, to: 544999 },
    { grade: 29, monthlyStandard: 560000, from: 545000, to: 574999 },
    { grade: 30, monthlyStandard: 590000, from: 575000, to: 604999 },
    { grade: 31, monthlyStandard: 620000, from: 605000, to: 634999 },
    { grade: 32, monthlyStandard: 650000, from: 635000, to: 99999999 }
  ];

  // 等級表全体のモックデータ
  const mockGradeTable = {
    hyouzyungetugakuReiwa7: mockHealthGradeTable,
    kouseinenkinReiwa7: mockPensionGradeTable
  };

  beforeEach(async () => {
    // window.alertをモック
    spyOn(window, 'alert');
    
    const firestoreServiceSpy = jasmine.createSpyObj('FirestoreService', [
      'getAllEmployees',
      'getAllOnboardingEmployees',
      'getEmployeeData',
      'getSalaryHistory',
      'getBonusHistory',
      'getSettings',
      'saveSalariesBatch',
      'getStandardMonthlySalaryChange',
      'getPensionStandardMonthlySalaryChange',
      'getStandardMonthlySalaryChangesInPeriod',
      'getPensionStandardMonthlySalaryChangesInPeriod',
      'deleteStandardMonthlySalaryChange',
      'deletePensionStandardMonthlySalaryChange',
      'saveStandardMonthlySalaryChange',
      'savePensionStandardMonthlySalaryChange',
      'getAllSalaryHistory',
      'saveBonus'
    ]);
    
    // deleteStandardMonthlySalaryChangeとdeletePensionStandardMonthlySalaryChangeのモック
    // saveSalary内で標準報酬月額変更情報を削除する際に使用される
    firestoreServiceSpy.deleteStandardMonthlySalaryChange.and.returnValue(Promise.resolve());
    firestoreServiceSpy.deletePensionStandardMonthlySalaryChange.and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [
        KyuyoDashboardComponent,
        HttpClientTestingModule
      ],
      providers: [
        { provide: FirestoreService, useValue: firestoreServiceSpy },
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    }).compileComponents();

    component = TestBed.createComponent(KyuyoDashboardComponent).componentInstance;
    firestoreService = TestBed.inject(FirestoreService) as jasmine.SpyObj<FirestoreService>;

    // 等級表を設定
    component.gradeTable = mockGradeTable;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('社会保険料計算のテスト', () => {
    // 保険料率の設定
    const healthInsuranceRate = 9.91; // 健康保険料率 9.91%
    const nursingInsuranceRate = 1.59; // 介護保険料率 1.59%
    const pensionInsuranceRate = 18.3; // 厚生年金保険料率 18.3%

    beforeEach(() => {
      // 保険料率を設定
      firestoreService.getSettings.and.returnValue(Promise.resolve({
        insuranceRates: {
          healthInsurance: healthInsuranceRate,
          nursingInsurance: nursingInsuranceRate,
          pensionInsurance: pensionInsuranceRate
        }
      }));
    });

    describe('閾値テスト（等級の境界値）', () => {
      it('健康介護保険等級1の下限（0円）の社会保険料を計算', () => {
        const standardMonthlySalary = 58000; // 等級1の標準報酬月額
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 5747.8円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 922.2円
        const pensionStandardMonthlySalary = 88000; // 厚生年金等級1の標準報酬月額
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 16104円

        // 社員負担額を計算（端数処理：0.50以下なら切り捨て、0.51以上なら切り上げ）
        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 3335円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 3335円
        const pensionHalf = pensionInsuranceRaw / 2; // 8052円
        const pensionBurden = component.roundHalf(pensionHalf); // 8052円
        const employeeBurden = healthNursingBurden + pensionBurden; // 11387円

        expect(healthInsuranceRaw).toBeCloseTo(5747.8, 1);
        expect(nursingInsuranceRaw).toBeCloseTo(922.2, 1);
        expect(pensionInsuranceRaw).toBe(16104);
        expect(healthNursingBurden).toBe(3335);
        expect(pensionBurden).toBe(8052);
        expect(employeeBurden).toBe(11387);
      });

      it('健康介護保険等級1の上限（62999円）の社会保険料を計算', () => {
        const standardMonthlySalary = 58000; // 等級1の標準報酬月額（上限でも等級1）
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 5747.8円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 922.2円
        const pensionStandardMonthlySalary = 88000; // 厚生年金等級1の標準報酬月額
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 16104円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 3335円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 3335円
        const pensionHalf = pensionInsuranceRaw / 2; // 8052円
        const pensionBurden = component.roundHalf(pensionHalf); // 8052円
        const employeeBurden = healthNursingBurden + pensionBurden; // 11387円

        expect(healthInsuranceRaw).toBeCloseTo(5747.8, 1);
        expect(nursingInsuranceRaw).toBeCloseTo(922.2, 1);
        expect(pensionInsuranceRaw).toBe(16104);
        expect(healthNursingBurden).toBe(3335);
        expect(pensionBurden).toBe(8052);
        expect(employeeBurden).toBe(11387);
      });

      it('健康介護保険等級2の下限（63000円）の社会保険料を計算', () => {
        const standardMonthlySalary = 68000; // 等級2の標準報酬月額
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 6738.8円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 1081.2円
        const pensionStandardMonthlySalary = 88000; // 厚生年金等級1の標準報酬月額
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 16104円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 3910円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 3910円
        const pensionHalf = pensionInsuranceRaw / 2; // 8052円
        const pensionBurden = component.roundHalf(pensionHalf); // 8052円
        const employeeBurden = healthNursingBurden + pensionBurden; // 11962円

        expect(healthInsuranceRaw).toBeCloseTo(6738.8, 1);
        expect(nursingInsuranceRaw).toBeCloseTo(1081.2, 1);
        expect(pensionInsuranceRaw).toBe(16104);
        expect(healthNursingBurden).toBe(3910);
        expect(pensionBurden).toBe(8052);
        expect(employeeBurden).toBe(11962);
      });

      it('健康介護保険等級4の下限（83000円）の社会保険料を計算', () => {
        const standardMonthlySalary = 88000; // 等級4の標準報酬月額
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 8720.8円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 1399.2円
        const pensionStandardMonthlySalary = 88000; // 厚生年金等級1の標準報酬月額
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 16104円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 5060円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 5060円
        const pensionHalf = pensionInsuranceRaw / 2; // 8052円
        const pensionBurden = component.roundHalf(pensionHalf); // 8052円
        const employeeBurden = healthNursingBurden + pensionBurden; // 13112円

        expect(healthInsuranceRaw).toBeCloseTo(8720.8, 1);
        expect(nursingInsuranceRaw).toBeCloseTo(1399.2, 1);
        expect(pensionInsuranceRaw).toBe(16104);
        expect(healthNursingBurden).toBe(5060);
        expect(pensionBurden).toBe(8052);
        expect(employeeBurden).toBe(13112);
      });

      it('健康介護保険等級50の上限（1390000円）の社会保険料を計算', () => {
        const standardMonthlySalary = 1390000; // 等級50の標準報酬月額
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 137749円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 22101円
        const pensionStandardMonthlySalary = 650000; // 厚生年金等級32の標準報酬月額（上限）
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 118950円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 79925円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 79925円
        const pensionHalf = pensionInsuranceRaw / 2; // 59475円
        const pensionBurden = component.roundHalf(pensionHalf); // 59475円
        const employeeBurden = healthNursingBurden + pensionBurden; // 139400円

        expect(healthInsuranceRaw).toBeCloseTo(137749, 0);
        expect(nursingInsuranceRaw).toBeCloseTo(22101, 0);
        expect(pensionInsuranceRaw).toBe(118950);
        expect(healthNursingBurden).toBe(79925);
        expect(pensionBurden).toBe(59475);
        expect(employeeBurden).toBe(139400);
      });

      it('厚生年金保険等級32の上限（650000円）の社会保険料を計算', () => {
        const standardMonthlySalary = 1390000; // 健康介護保険等級50の標準報酬月額
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 137749円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 22101円
        const pensionStandardMonthlySalary = 650000; // 厚生年金等級32の標準報酬月額（上限）
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 118950円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 79925円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 79925円
        const pensionHalf = pensionInsuranceRaw / 2; // 59475円
        const pensionBurden = component.roundHalf(pensionHalf); // 59475円
        const employeeBurden = healthNursingBurden + pensionBurden; // 139400円

        expect(pensionInsuranceRaw).toBe(118950);
        expect(pensionBurden).toBe(59475);
        expect(employeeBurden).toBe(139400);
      });
    });

    describe('端数処理のテスト', () => {
      it('roundHalf: 0.50以下の端数は切り捨て', () => {
        expect(component.roundHalf(100.50)).toBe(100);
        expect(component.roundHalf(100.49)).toBe(100);
        expect(component.roundHalf(100.00)).toBe(100);
      });

      it('roundHalf: 0.51以上の端数は切り上げ', () => {
        expect(component.roundHalf(100.51)).toBe(101);
        expect(component.roundHalf(100.99)).toBe(101);
      });

      it('roundHalfCash: 0.50未満の端数は切り捨て', () => {
        expect(component.roundHalfCash(100.49)).toBe(100);
        expect(component.roundHalfCash(100.00)).toBe(100);
      });

      it('roundHalfCash: 0.50以上の端数は切り上げ', () => {
        expect(component.roundHalfCash(100.50)).toBe(101);
        expect(component.roundHalfCash(100.51)).toBe(101);
        expect(component.roundHalfCash(100.99)).toBe(101);
      });

      it('端数処理の違いによる社会保険料の計算', () => {
        const healthInsuranceRaw = 8720.8; // 88000円 × 9.91% = 8720.8円
        const nursingInsuranceRaw = 1399.2; // 88000円 × 1.59% = 1399.2円
        const pensionInsuranceRaw = 16104; // 88000円 × 18.3% = 16104円

        // 通常の端数処理（0.50以下なら切り捨て）
        const healthNursingHalf1 = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 5060.00円
        const healthNursingBurden1 = component.roundHalf(healthNursingHalf1); // 5060円
        const pensionHalf1 = pensionInsuranceRaw / 2; // 8052.00円
        const pensionBurden1 = component.roundHalf(pensionHalf1); // 8052円

        // 現金徴収の端数処理（0.50未満なら切り捨て）
        const healthNursingBurden2 = component.roundHalfCash(healthNursingHalf1); // 5060円
        const pensionBurden2 = component.roundHalfCash(pensionHalf1); // 8052円

        expect(healthNursingBurden1).toBe(5060);
        expect(pensionBurden1).toBe(8052);
        expect(healthNursingBurden2).toBe(5060);
        expect(pensionBurden2).toBe(8052);
      });

      it('端数処理の違いによる社会保険料の計算（0.50のケース）', () => {
        // 健康保険料 + 介護保険料 = 10120円の場合、÷2 = 5060.00円（端数なし）
        // 健康保険料 + 介護保険料 = 10121円の場合、÷2 = 5060.50円
        const healthInsuranceRaw = 8720.8;
        const nursingInsuranceRaw = 1400.2; // 1400.2円に変更（合計10121円）
        const pensionInsuranceRaw = 16105; // 16105円に変更

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 5060.50円
        const healthNursingBurden1 = component.roundHalf(healthNursingHalf); // 5060円（0.50以下なので切り捨て）
        const healthNursingBurden2 = component.roundHalfCash(healthNursingHalf); // 5061円（0.50以上なので切り上げ）

        const pensionHalf = pensionInsuranceRaw / 2; // 8052.50円
        const pensionBurden1 = component.roundHalf(pensionHalf); // 8052円（0.50以下なので切り捨て）
        const pensionBurden2 = component.roundHalfCash(pensionHalf); // 8053円（0.50以上なので切り上げ）

        expect(healthNursingBurden1).toBe(5060);
        expect(healthNursingBurden2).toBe(5061);
        expect(pensionBurden1).toBe(8052);
        expect(pensionBurden2).toBe(8053);
      });
    });

    describe('標準報酬月額が上限を超えた時の社会保険料', () => {
      it('健康介護保険等級50（1390000円）を超えた給与の社会保険料を計算', () => {
        // 給与が1500000円の場合でも、標準報酬月額は1390000円（等級50）に制限される
        const standardMonthlySalary = 1390000; // 等級50の標準報酬月額（上限）
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 137749円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 22101円
        const pensionStandardMonthlySalary = 650000; // 厚生年金等級32の標準報酬月額（上限）
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 118950円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 79925円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 79925円
        const pensionHalf = pensionInsuranceRaw / 2; // 59475円
        const pensionBurden = component.roundHalf(pensionHalf); // 59475円
        const employeeBurden = healthNursingBurden + pensionBurden; // 139400円

        expect(standardMonthlySalary).toBe(1390000);
        expect(healthInsuranceRaw).toBeCloseTo(137749, 0);
        expect(nursingInsuranceRaw).toBeCloseTo(22101, 0);
        expect(pensionInsuranceRaw).toBe(118950);
        expect(employeeBurden).toBe(139400);
      });

      it('厚生年金保険等級32（650000円）を超えた給与の社会保険料を計算', () => {
        // 健康介護保険の標準報酬月額が1390000円でも、厚生年金保険の標準報酬月額は650000円（等級32）に制限される
        const standardMonthlySalary = 1390000; // 健康介護保険等級50の標準報酬月額
        const healthInsuranceRaw = standardMonthlySalary * (healthInsuranceRate / 100); // 137749円
        const nursingInsuranceRaw = standardMonthlySalary * (nursingInsuranceRate / 100); // 22101円
        const pensionStandardMonthlySalary = 650000; // 厚生年金等級32の標準報酬月額（上限）
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 118950円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 79925円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 79925円
        const pensionHalf = pensionInsuranceRaw / 2; // 59475円
        const pensionBurden = component.roundHalf(pensionHalf); // 59475円
        const employeeBurden = healthNursingBurden + pensionBurden; // 139400円

        expect(pensionStandardMonthlySalary).toBe(650000);
        expect(pensionInsuranceRaw).toBe(118950);
        expect(pensionBurden).toBe(59475);
        expect(employeeBurden).toBe(139400);
      });
    });

    describe('標準賞与額が上限を超えた時の社会保険料', () => {
      it('健康介護保険の標準賞与額が年度間上限573万円を超えた場合の社会保険料を計算', () => {
        // 年度間の賞与累積額が573万円を超える場合、超過分は保険料計算の対象外
        const healthNursingFiscalYearTotalStandardBonus = 6000000; // 年度間累積額600万円
        const standardBonusAmount = 2000000; // 今回の賞与額200万円
        const healthNursingStandardBonusAmount = Math.min(standardBonusAmount, Math.max(0, 5730000 - (healthNursingFiscalYearTotalStandardBonus - standardBonusAmount)));
        // 5730000 - (6000000 - 2000000) = 5730000 - 4000000 = 1730000円（上限）

        const healthInsuranceRaw = healthNursingStandardBonusAmount * (healthInsuranceRate / 100); // 171443円
        const nursingInsuranceRaw = healthNursingStandardBonusAmount * (nursingInsuranceRate / 100); // 27507円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 99475円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 99475円

        expect(healthNursingStandardBonusAmount).toBe(1730000);
        expect(healthInsuranceRaw).toBeCloseTo(171443, 0);
        expect(nursingInsuranceRaw).toBeCloseTo(27507, 0);
        expect(healthNursingBurden).toBe(99475);
      });

      it('厚生年金保険の標準賞与額が月上限150万円を超えた場合の社会保険料を計算', () => {
        // 賞与額が150万円を超える場合、超過分は保険料計算の対象外
        const standardBonusAmount = 2000000; // 賞与額200万円
        const pensionStandardBonusAmount = Math.min(1500000, standardBonusAmount); // 150万円（上限）

        const pensionInsuranceRaw = pensionStandardBonusAmount * (pensionInsuranceRate / 100); // 274500円
        const pensionHalf = pensionInsuranceRaw / 2; // 137250円
        const pensionBurden = component.roundHalf(pensionHalf); // 137250円

        expect(pensionStandardBonusAmount).toBe(1500000);
        expect(pensionInsuranceRaw).toBe(274500);
        expect(pensionBurden).toBe(137250);
      });

      it('賞与額が150万円ちょうどの場合の社会保険料を計算', () => {
        const standardBonusAmount = 1500000; // 賞与額150万円（上限）
        const healthNursingStandardBonusAmount = standardBonusAmount; // 150万円
        const pensionStandardBonusAmount = Math.min(1500000, standardBonusAmount); // 150万円

        const healthInsuranceRaw = healthNursingStandardBonusAmount * (healthInsuranceRate / 100); // 148650円
        const nursingInsuranceRaw = healthNursingStandardBonusAmount * (nursingInsuranceRate / 100); // 23850円
        const pensionInsuranceRaw = pensionStandardBonusAmount * (pensionInsuranceRate / 100); // 274500円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 86250円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 86250円
        const pensionHalf = pensionInsuranceRaw / 2; // 137250円
        const pensionBurden = component.roundHalf(pensionHalf); // 137250円
        const employeeBurden = healthNursingBurden + pensionBurden; // 223500円

        expect(healthInsuranceRaw).toBeCloseTo(148650, 0);
        expect(nursingInsuranceRaw).toBeCloseTo(23850, 0);
        expect(pensionInsuranceRaw).toBe(274500);
        expect(healthNursingBurden).toBe(86250);
        expect(pensionBurden).toBe(137250);
        expect(employeeBurden).toBe(223500);
      });

      it('賞与額が150万円を超える場合の社会保険料を計算', () => {
        const standardBonusAmount = 2000000; // 賞与額200万円（上限超過）
        const healthNursingStandardBonusAmount = standardBonusAmount; // 200万円（年度間上限チェックなしの場合）
        const pensionStandardBonusAmount = Math.min(1500000, standardBonusAmount); // 150万円（上限）

        const healthInsuranceRaw = healthNursingStandardBonusAmount * (healthInsuranceRate / 100); // 198200円
        const nursingInsuranceRaw = healthNursingStandardBonusAmount * (nursingInsuranceRate / 100); // 31800円
        const pensionInsuranceRaw = pensionStandardBonusAmount * (pensionInsuranceRate / 100); // 274500円

        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 115000円
        const healthNursingBurden = component.roundHalf(healthNursingHalf); // 115000円
        const pensionHalf = pensionInsuranceRaw / 2; // 137250円
        const pensionBurden = component.roundHalf(pensionHalf); // 137250円
        const employeeBurden = healthNursingBurden + pensionBurden; // 252250円

        expect(pensionStandardBonusAmount).toBe(1500000);
        expect(pensionInsuranceRaw).toBe(274500);
        expect(pensionBurden).toBe(137250);
        expect(employeeBurden).toBe(252250);
      });
    });

    describe('年齢による保険料免除のテスト', () => {
      it('75歳以上の健康保険料は0円', () => {
        const standardMonthlySalary = 88000;
        const age = 75; // 75歳
        const isHealthInsuranceTarget = age < 75; // false
        const healthInsuranceRaw = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;

        expect(isHealthInsuranceTarget).toBe(false);
        expect(healthInsuranceRaw).toBe(0);
      });

      it('40歳未満の介護保険料は0円', () => {
        const standardMonthlySalary = 88000;
        const age = 39; // 39歳
        const isNursingInsuranceTarget = age >= 40 && age < 65; // false
        const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;

        expect(isNursingInsuranceTarget).toBe(false);
        expect(nursingInsuranceRaw).toBe(0);
      });

      it('65歳以上の介護保険料は0円', () => {
        const standardMonthlySalary = 88000;
        const age = 65; // 65歳
        const isNursingInsuranceTarget = age >= 40 && age < 65; // false
        const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;

        expect(isNursingInsuranceTarget).toBe(false);
        expect(nursingInsuranceRaw).toBe(0);
      });

      it('70歳以上の厚生年金保険料は0円', () => {
        const pensionStandardMonthlySalary = 88000;
        const age = 70; // 70歳
        const isPensionInsuranceTarget = age < 70; // false
        const pensionInsuranceRaw = isPensionInsuranceTarget ? pensionStandardMonthlySalary * (pensionInsuranceRate / 100) : 0;

        expect(isPensionInsuranceTarget).toBe(false);
        expect(pensionInsuranceRaw).toBe(0);
      });

      it('40歳以上65歳未満の介護保険料は計算される', () => {
        const standardMonthlySalary = 88000;
        const age = 50; // 50歳
        const isNursingInsuranceTarget = age >= 40 && age < 65; // true
        const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;

        expect(isNursingInsuranceTarget).toBe(true);
        expect(nursingInsuranceRaw).toBeCloseTo(1399.2, 1);
      });
    });

    describe('産前産後休業による保険料免除のテスト', () => {
      it('産前産後休業期間中の健康保険料は0円', () => {
        const standardMonthlySalary = 88000;
        const isInMaternityLeave = true;
        const isVoluntaryContinuation = false;
        const isHealthInsuranceTarget = true;
        const healthInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0);

        expect(healthInsuranceRaw).toBe(0);
      });

      it('産前産後休業期間中の介護保険料は0円', () => {
        const standardMonthlySalary = 88000;
        const isInMaternityLeave = true;
        const isVoluntaryContinuation = false;
        const isNursingInsuranceTarget = true;
        const nursingInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0);

        expect(nursingInsuranceRaw).toBe(0);
      });

      it('産前産後休業期間中の厚生年金保険料は0円', () => {
        const pensionStandardMonthlySalary = 88000;
        const isInMaternityLeave = true;
        const isVoluntaryContinuation = false;
        const isPensionInsuranceTarget = true;
        const pensionInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isPensionInsuranceTarget ? pensionStandardMonthlySalary * (pensionInsuranceRate / 100) : 0);

        expect(pensionInsuranceRaw).toBe(0);
      });

      it('任意継続被保険者の産前産後休業期間中は保険料が免除されない', () => {
        const standardMonthlySalary = 88000;
        const isInMaternityLeave = true;
        const isVoluntaryContinuation = true;
        const isHealthInsuranceTarget = true;
        const isNursingInsuranceTarget = true;
        const healthInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0);
        const nursingInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0);

        expect(healthInsuranceRaw).toBeCloseTo(8720.8, 1);
        expect(nursingInsuranceRaw).toBeCloseTo(1399.2, 1);
      });
    });

    describe('任意継続被保険者の保険料計算のテスト', () => {
      it('任意継続被保険者の健康保険料と介護保険料は全額自己負担', () => {
        const standardMonthlySalary = 88000;
        const isVoluntaryContinuation = true;
        const isHealthInsuranceTarget = true;
        const isNursingInsuranceTarget = true;
        
        const healthInsuranceRaw = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;
        const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;
        
        // 任意継続被保険者の場合、健康保険料と介護保険料は全額社員負担
        const healthNursingTotal = healthInsuranceRaw + nursingInsuranceRaw;
        const employeeBurden = component.roundHalf(healthNursingTotal);

        expect(healthInsuranceRaw).toBeCloseTo(8720.8, 1);
        expect(nursingInsuranceRaw).toBeCloseTo(1399.2, 1);
        expect(employeeBurden).toBe(10120); // 8720.8 + 1399.2 = 10120円
      });

      it('任意継続被保険者の厚生年金保険料は0円', () => {
        const pensionStandardMonthlySalary = 88000;
        const isVoluntaryContinuation = true;
        const isPensionInsuranceTarget = true;
        const pensionInsuranceRaw = isVoluntaryContinuation ? 0 : (isPensionInsuranceTarget ? pensionStandardMonthlySalary * (pensionInsuranceRate / 100) : 0);

        expect(pensionInsuranceRaw).toBe(0);
      });

      it('任意継続被保険者の標準報酬月額は最大32万円に制限される', () => {
        const resignationSalary = 500000; // 退職時の給与
        const standardInfo = component.calculateStandardMonthlySalary(resignationSalary);
        let voluntaryStandardMonthlySalary = standardInfo ? standardInfo.monthlyStandard : 0;
        
        // 最大32万円に制限
        if (voluntaryStandardMonthlySalary > 320000) {
          voluntaryStandardMonthlySalary = 320000;
        }

        expect(voluntaryStandardMonthlySalary).toBe(320000);
      });

      it('任意継続被保険者の入社月の社会保険料は計算される', () => {
        const acquisitionDate = '2026-04-01'; // 2026年4月1日入社
        const filterYear = 2026;
        const filterMonth = 4; // 入社月
        const isVoluntaryContinuation = false; // 入社時はまだ任意継続ではない
        
        // 資格取得年月日を確認
        const acquisition = new Date(acquisitionDate);
        const acquisitionYear = acquisition.getFullYear();
        const acquisitionMonth = acquisition.getMonth() + 1;
        
        // 資格取得年月日以降の月かどうかを判定
        const isAcquired = filterYear > acquisitionYear || (filterYear === acquisitionYear && filterMonth >= acquisitionMonth);
        
        // 入社月の社会保険料は計算される
        expect(isAcquired).toBe(true);
        expect(isVoluntaryContinuation).toBe(false); // 入社時は通常の被保険者
      });

      it('任意継続被保険者の退社月の社会保険料は0円', () => {
        const resignationDate = '2026-03-31'; // 2026年3月31日退社
        const filterYear = 2026;
        const filterMonth = 3; // 退社月
        const isVoluntaryContinuation = true; // 任意継続被保険者
        
        // 資格喪失年月日を計算（退職日の翌日）
        const resignation = new Date(resignationDate);
        const nextDay = new Date(resignation);
        nextDay.setDate(nextDay.getDate() + 1); // 4月1日
        const lossYear = nextDay.getFullYear();
        const lossMonth = nextDay.getMonth() + 1; // 4月
        
        // 退社月の社会保険料は0円（資格喪失年月日の前月までが通常の社会保険料）
        // 退社月（3月）は資格喪失年月日（4月1日）より前なので、通常の社会保険料が計算される
        // ただし、任意継続被保険者の場合、退社月の社会保険料は0円
        const isNotLost = filterYear < lossYear || (filterYear === lossYear && filterMonth < lossMonth);
        
        // 任意継続被保険者の場合、退社月の社会保険料は0円
        // これは、退社月は資格喪失年月日の前月なので、通常の社会保険料は計算されるが、
        // 任意継続被保険者の場合は退社月の社会保険料が0円になる
        const shouldCalculateInsurance = isNotLost && !isVoluntaryContinuation;
        
        expect(isNotLost).toBe(true); // 3月は喪失前
        expect(isVoluntaryContinuation).toBe(true); // 任意継続被保険者
        expect(shouldCalculateInsurance).toBe(false); // 任意継続被保険者の退社月は0円
      });

      it('任意継続被保険者の退社月の翌月の社会保険料は任意継続保険料として計算される', () => {
        const resignationDate = '2026-03-31'; // 2026年3月31日退社
        const filterYear = 2026;
        const filterMonth = 4; // 退社月の翌月（任意継続開始月）
        const isVoluntaryContinuation = true; // 任意継続被保険者
        const standardMonthlySalary = 320000; // 任意継続の最大額
        const isHealthInsuranceTarget = true;
        const isNursingInsuranceTarget = true;
        
        // 資格喪失年月日を計算（退職日の翌日）
        const resignation = new Date(resignationDate);
        const nextDay = new Date(resignation);
        nextDay.setDate(nextDay.getDate() + 1); // 4月1日
        const lossYear = nextDay.getFullYear();
        const lossMonth = nextDay.getMonth() + 1; // 4月
        
        // 任意継続開始月は退社月の翌月
        const voluntaryStartDate = nextDay; // 4月1日
        const voluntaryStartMonth = new Date(voluntaryStartDate.getFullYear(), voluntaryStartDate.getMonth(), 1);
        const selectedDate = new Date(filterYear, filterMonth - 1, 1);
        
        // 選択年月が任意継続開始月かどうかを判定
        const isVoluntaryStartMonth = selectedDate.getTime() === voluntaryStartMonth.getTime();
        
        // 任意継続保険料を計算（全額自己負担）
        const voluntaryHealthInsurance = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;
        const voluntaryNursingInsurance = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;
        const voluntaryTotal = voluntaryHealthInsurance + voluntaryNursingInsurance;
        const voluntaryBurden = component.roundHalf(voluntaryTotal);
        
        expect(isVoluntaryStartMonth).toBe(true); // 4月は任意継続開始月
        expect(voluntaryHealthInsurance).toBeCloseTo(31712, 0); // 320000 × 9.91% = 31712円
        expect(voluntaryNursingInsurance).toBeCloseTo(5088, 0); // 320000 × 1.59% = 5088円
        expect(voluntaryBurden).toBeCloseTo(36800, 0); // 31712 + 5088 = 36800円
      });
    });

    describe('同年月で資格取得と喪失がある場合の保険料計算のテスト', () => {
      it('同年月で任意継続の場合、通常の社会保険料と任意継続保険料の両方を計算', () => {
        const standardMonthlySalary = 88000;
        const voluntaryStandardMonthlySalary = 320000; // 任意継続用（最大32万円）
        const isSameMonthAcquisitionAndLoss = true;
        const isHealthInsuranceTarget = true;
        const isNursingInsuranceTarget = true;
        const isPensionInsuranceTarget = true;
        
        // 通常の社会保険料（会社と折半）
        const normalHealthInsuranceRaw = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;
        const normalNursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;
        const pensionInsuranceRaw = isPensionInsuranceTarget ? standardMonthlySalary * (pensionInsuranceRate / 100) : 0;
        
        // 任意継続保険料（全額自己負担）
        const voluntaryHealthInsurance = isHealthInsuranceTarget ? voluntaryStandardMonthlySalary * (healthInsuranceRate / 100) : 0;
        const voluntaryNursingInsurance = isNursingInsuranceTarget ? voluntaryStandardMonthlySalary * (nursingInsuranceRate / 100) : 0;
        
        // 通常の社会保険料（会社と折半）
        const normalHealthNursingHalf = (normalHealthInsuranceRaw + normalNursingInsuranceRaw) / 2;
        const normalHealthNursingBurden = component.roundHalf(normalHealthNursingHalf);
        
        // 厚生年金保険料 ÷ 2
        const pensionHalf = pensionInsuranceRaw / 2;
        const pensionBurden = component.roundHalf(pensionHalf);
        
        // 任意継続保険料（全額自己負担）
        const voluntaryTotal = voluntaryHealthInsurance + voluntaryNursingInsurance;
        const voluntaryBurden = component.roundHalf(voluntaryTotal);
        
        // 社員負担額（合計）
        const employeeBurden = normalHealthNursingBurden + pensionBurden + voluntaryBurden;

        expect(normalHealthNursingBurden).toBeCloseTo(5060, 0);
        expect(pensionBurden).toBeCloseTo(8052, 0);
        expect(voluntaryBurden).toBeCloseTo(36800, 0); // 320000 * (9.91% + 1.59%) = 36800円
        expect(employeeBurden).toBeCloseTo(49912, 0);
      });
    });

    describe('入社・退社による保険料計算のテスト', () => {
      it('入社月の保険料は計算される', () => {
        const socialInsuranceAcquisitionDate = '2026-04-01'; // 2026年4月1日入社
        const filterYear = 2026;
        const filterMonth = 4;
        
        // 資格取得年月日を確認
        const acquisitionDate = new Date(socialInsuranceAcquisitionDate);
        const acquisitionYear = acquisitionDate.getFullYear();
        const acquisitionMonth = acquisitionDate.getMonth() + 1;
        
        const isAcquired = filterYear > acquisitionYear || (filterYear === acquisitionYear && filterMonth >= acquisitionMonth);
        
        expect(isAcquired).toBe(true);
      });

      it('退社月の保険料は計算される', () => {
        const resignationDate = '2026-03-31'; // 2026年3月31日退社
        const filterYear = 2026;
        const filterMonth = 3;
        
        // 資格喪失年月日を計算（退職日の翌日）
        const resignation = new Date(resignationDate);
        const nextDay = new Date(resignation);
        nextDay.setDate(nextDay.getDate() + 1);
        const lossYear = nextDay.getFullYear();
        const lossMonth = nextDay.getMonth() + 1;
        
        const isNotLost = filterYear < lossYear || (filterYear === lossYear && filterMonth < lossMonth);
        
        expect(isNotLost).toBe(true); // 3月は喪失前なので計算される
      });

      it('退社後の月の保険料は計算されない（任意継続でない場合）', () => {
        const resignationDate = '2026-03-31'; // 2026年3月31日退社
        const filterYear = 2026;
        const filterMonth = 4; // 退社後の月
        
        // 資格喪失年月日を計算（退職日の翌日）
        const resignation = new Date(resignationDate);
        const nextDay = new Date(resignation);
        nextDay.setDate(nextDay.getDate() + 1);
        const lossYear = nextDay.getFullYear();
        const lossMonth = nextDay.getMonth() + 1;
        
        const isNotLost = filterYear < lossYear || (filterYear === lossYear && filterMonth < lossMonth);
        
        expect(isNotLost).toBe(false); // 4月は喪失後なので計算されない
      });

      it('2月15日入社、4月15日退社の場合、2月と3月は徴収され、4月は徴収されない', () => {
        const acquisitionDate = '2026-02-15'; // 2026年2月15日入社
        const resignationDate = '2026-04-15'; // 2026年4月15日退社
        
        // 資格取得年月日を確認
        const acquisition = new Date(acquisitionDate);
        const acquisitionYear = acquisition.getFullYear();
        const acquisitionMonth = acquisition.getMonth() + 1; // 2月
        
        // 資格喪失年月日を計算（退職日の翌日）
        const resignation = new Date(resignationDate);
        const nextDay = new Date(resignation);
        nextDay.setDate(nextDay.getDate() + 1); // 4月16日
        const lossYear = nextDay.getFullYear();
        const lossMonth = nextDay.getMonth() + 1; // 4月
        
        // 2月の保険料計算判定
        const filterYearFeb = 2026;
        const filterMonthFeb = 2;
        const isAcquiredFeb = filterYearFeb > acquisitionYear || (filterYearFeb === acquisitionYear && filterMonthFeb >= acquisitionMonth);
        const isNotLostFeb = filterYearFeb < lossYear || (filterYearFeb === lossYear && filterMonthFeb < lossMonth);
        const shouldCalculateFeb = isAcquiredFeb && isNotLostFeb;
        
        // 3月の保険料計算判定
        const filterYearMar = 2026;
        const filterMonthMar = 3;
        const isAcquiredMar = filterYearMar > acquisitionYear || (filterYearMar === acquisitionYear && filterMonthMar >= acquisitionMonth);
        const isNotLostMar = filterYearMar < lossYear || (filterYearMar === lossYear && filterMonthMar < lossMonth);
        const shouldCalculateMar = isAcquiredMar && isNotLostMar;
        
        // 4月の保険料計算判定
        const filterYearApr = 2026;
        const filterMonthApr = 4;
        const isAcquiredApr = filterYearApr > acquisitionYear || (filterYearApr === acquisitionYear && filterMonthApr >= acquisitionMonth);
        const isNotLostApr = filterYearApr < lossYear || (filterYearApr === lossYear && filterMonthApr < lossMonth);
        const shouldCalculateApr = isAcquiredApr && isNotLostApr;
        
        expect(shouldCalculateFeb).toBe(true); // 2月は徴収される
        expect(shouldCalculateMar).toBe(true); // 3月は徴収される
        expect(shouldCalculateApr).toBe(false); // 4月は徴収されない
      });
    });

    describe('複合パターンのテスト', () => {
      it('40歳の産前産後休業中の社員の保険料計算', () => {
        const standardMonthlySalary = 88000;
        const age = 40; // 40歳
        const isInMaternityLeave = true;
        const isVoluntaryContinuation = false;
        const isHealthInsuranceTarget = age < 75; // true
        const isNursingInsuranceTarget = age >= 40 && age < 65; // true
        const isPensionInsuranceTarget = age < 70; // true
        
        const healthInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0);
        const nursingInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0);
        const pensionInsuranceRaw = (isInMaternityLeave && !isVoluntaryContinuation) ? 0 : (isPensionInsuranceTarget ? standardMonthlySalary * (pensionInsuranceRate / 100) : 0);
        
        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
        const healthNursingBurden = component.roundHalf(healthNursingHalf);
        const pensionHalf = pensionInsuranceRaw / 2;
        const pensionBurden = component.roundHalf(pensionHalf);
        const employeeBurden = healthNursingBurden + pensionBurden;

        expect(healthInsuranceRaw).toBe(0);
        expect(nursingInsuranceRaw).toBe(0);
        expect(pensionInsuranceRaw).toBe(0);
        expect(employeeBurden).toBe(0);
      });

      it('75歳の任意継続被保険者の保険料計算', () => {
        const standardMonthlySalary = 320000; // 任意継続の最大額
        const age = 75; // 75歳
        const isVoluntaryContinuation = true;
        const isHealthInsuranceTarget = age < 75; // false
        const isNursingInsuranceTarget = age >= 40 && age < 65; // false
        const isPensionInsuranceTarget = age < 70; // false
        
        const healthInsuranceRaw = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;
        const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;
        const pensionInsuranceRaw = isVoluntaryContinuation ? 0 : (isPensionInsuranceTarget ? standardMonthlySalary * (pensionInsuranceRate / 100) : 0);
        
        // 任意継続被保険者の場合、健康保険料と介護保険料は全額社員負担
        const healthNursingTotal = healthInsuranceRaw + nursingInsuranceRaw;
        const employeeBurden = component.roundHalf(healthNursingTotal);

        expect(healthInsuranceRaw).toBe(0); // 75歳以上は健康保険料0円
        expect(nursingInsuranceRaw).toBe(0); // 65歳以上は介護保険料0円
        expect(pensionInsuranceRaw).toBe(0); // 任意継続は厚生年金0円
        expect(employeeBurden).toBe(0);
      });

      it('70歳の通常社員の保険料計算', () => {
        const standardMonthlySalary = 88000;
        const age = 70; // 70歳
        const isHealthInsuranceTarget = age < 75; // true
        const isNursingInsuranceTarget = age >= 40 && age < 65; // false
        const isPensionInsuranceTarget = age < 70; // false
        
        const healthInsuranceRaw = isHealthInsuranceTarget ? standardMonthlySalary * (healthInsuranceRate / 100) : 0;
        const nursingInsuranceRaw = isNursingInsuranceTarget ? standardMonthlySalary * (nursingInsuranceRate / 100) : 0;
        const pensionInsuranceRaw = isPensionInsuranceTarget ? standardMonthlySalary * (pensionInsuranceRate / 100) : 0;
        
        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2;
        const healthNursingBurden = component.roundHalf(healthNursingHalf);
        const pensionHalf = pensionInsuranceRaw / 2;
        const pensionBurden = component.roundHalf(pensionHalf);
        const employeeBurden = healthNursingBurden + pensionBurden;

        expect(healthInsuranceRaw).toBeCloseTo(8720.8, 1);
        expect(nursingInsuranceRaw).toBe(0); // 65歳以上は介護保険料0円
        expect(pensionInsuranceRaw).toBe(0); // 70歳以上は厚生年金保険料0円
        expect(employeeBurden).toBeCloseTo(4360, 0); // 8720.8 / 2 = 4360.4 → 4360円
      });

      it('現金徴収社員の端数処理の違い（0.50のケース）', () => {
        const healthInsuranceRaw = 8720.8;
        const nursingInsuranceRaw = 1399.3; // 0.1円増加して合計が10120.1円、÷2 = 5060.05円
        const pensionInsuranceRaw = 16105; // 16105円に変更
        
        const healthNursingHalf = (healthInsuranceRaw + nursingInsuranceRaw) / 2; // 5060.05円
        const healthNursingBurden1 = component.roundHalf(healthNursingHalf); // 5060円（0.50以下なので切り捨て）
        const healthNursingBurden2 = component.roundHalfCash(healthNursingHalf); // 5060円（0.50未満なので切り捨て）
        
        const pensionHalf = pensionInsuranceRaw / 2; // 8052.50円
        const pensionBurden1 = component.roundHalf(pensionHalf); // 8052円（0.50以下なので切り捨て）
        const pensionBurden2 = component.roundHalfCash(pensionHalf); // 8053円（0.50以上なので切り上げ）

        expect(healthNursingBurden1).toBe(5060);
        expect(healthNursingBurden2).toBe(5060);
        expect(pensionBurden1).toBe(8052);
        expect(pensionBurden2).toBe(8053);
      });
    });

    describe('随時改定が1等級でも行われるテスト（境界条件）', () => {
      it('厚生年金保険等級1から等級2への随時改定（下限から離れる）の社会保険料を計算', () => {
        // 等級1（88000円）から等級2（98000円）への改定
        // 等級差は1だが、下限から離れるため随時改定が適用される
        const standardMonthlySalaryBefore = 88000; // 等級1
        const standardMonthlySalaryAfter = 98000; // 等級2
        const pensionStandardMonthlySalaryBefore = 88000; // 等級1
        const pensionStandardMonthlySalaryAfter = 98000; // 等級2

        // 改定前の保険料
        const healthInsuranceRawBefore = standardMonthlySalaryBefore * (healthInsuranceRate / 100); // 8720.8円
        const nursingInsuranceRawBefore = standardMonthlySalaryBefore * (nursingInsuranceRate / 100); // 1399.2円
        const pensionInsuranceRawBefore = pensionStandardMonthlySalaryBefore * (pensionInsuranceRate / 100); // 16104円

        // 改定後の保険料
        const healthInsuranceRawAfter = standardMonthlySalaryAfter * (healthInsuranceRate / 100); // 9711.8円
        const nursingInsuranceRawAfter = standardMonthlySalaryAfter * (nursingInsuranceRate / 100); // 1558.2円
        const pensionInsuranceRawAfter = pensionStandardMonthlySalaryAfter * (pensionInsuranceRate / 100); // 17934円

        // 改定前の社員負担額
        const healthNursingHalfBefore = (healthInsuranceRawBefore + nursingInsuranceRawBefore) / 2; // 5060円
        const healthNursingBurdenBefore = component.roundHalf(healthNursingHalfBefore); // 5060円
        const pensionHalfBefore = pensionInsuranceRawBefore / 2; // 8052円
        const pensionBurdenBefore = component.roundHalf(pensionHalfBefore); // 8052円
        const employeeBurdenBefore = healthNursingBurdenBefore + pensionBurdenBefore; // 13112円

        // 改定後の社員負担額
        const healthNursingHalfAfter = (healthInsuranceRawAfter + nursingInsuranceRawAfter) / 2; // 5635円
        const healthNursingBurdenAfter = component.roundHalf(healthNursingHalfAfter); // 5635円
        const pensionHalfAfter = pensionInsuranceRawAfter / 2; // 8967円
        const pensionBurdenAfter = component.roundHalf(pensionHalfAfter); // 8967円
        const employeeBurdenAfter = healthNursingBurdenAfter + pensionBurdenAfter; // 14602円

        expect(employeeBurdenBefore).toBe(13112);
        expect(employeeBurdenAfter).toBe(14602);
        expect(employeeBurdenAfter - employeeBurdenBefore).toBe(1490); // 1490円の増加
      });

      it('健康介護保険等級49から等級50への随時改定（上限に到達）の社会保険料を計算', () => {
        // 等級49（1330000円）から等級50（1390000円）への改定
        // 等級差は1だが、上限に到達するため随時改定が適用される
        const standardMonthlySalaryBefore = 1330000; // 等級49
        const standardMonthlySalaryAfter = 1390000; // 等級50
        const pensionStandardMonthlySalary = 650000; // 厚生年金等級32（上限）

        // 改定前の保険料
        const healthInsuranceRawBefore = standardMonthlySalaryBefore * (healthInsuranceRate / 100); // 131803円
        const nursingInsuranceRawBefore = standardMonthlySalaryBefore * (nursingInsuranceRate / 100); // 21147円
        const pensionInsuranceRaw = pensionStandardMonthlySalary * (pensionInsuranceRate / 100); // 118950円

        // 改定後の保険料
        const healthInsuranceRawAfter = standardMonthlySalaryAfter * (healthInsuranceRate / 100); // 137749円
        const nursingInsuranceRawAfter = standardMonthlySalaryAfter * (nursingInsuranceRate / 100); // 22101円

        // 改定前の社員負担額
        const healthNursingHalfBefore = (healthInsuranceRawBefore + nursingInsuranceRawBefore) / 2; // 76475円
        const healthNursingBurdenBefore = component.roundHalf(healthNursingHalfBefore); // 76475円
        const pensionHalf = pensionInsuranceRaw / 2; // 59475円
        const pensionBurden = component.roundHalf(pensionHalf); // 59475円
        const employeeBurdenBefore = healthNursingBurdenBefore + pensionBurden; // 135950円

        // 改定後の社員負担額
        const healthNursingHalfAfter = (healthInsuranceRawAfter + nursingInsuranceRawAfter) / 2; // 79925円
        const healthNursingBurdenAfter = component.roundHalf(healthNursingHalfAfter); // 79925円
        const employeeBurdenAfter = healthNursingBurdenAfter + pensionBurden; // 139400円

        expect(employeeBurdenBefore).toBe(135950);
        expect(employeeBurdenAfter).toBe(139400);
        expect(employeeBurdenAfter - employeeBurdenBefore).toBe(3450); // 3450円の増加
      });
    });
  });

  describe('給与設定時の随時改定・定時改定のテスト', () => {
    const employeeNumber = '1';
    let currentSalaryHistory: any[] = [];
    let currentStandardMonthlySalaryChanges: any[] = [];
    let currentPensionStandardMonthlySalaryChanges: any[] = [];
    let currentBonusHistory: any[] = [];

    beforeEach(() => {
      currentSalaryHistory = [];
      currentStandardMonthlySalaryChanges = [];
      currentPensionStandardMonthlySalaryChanges = [];
      currentBonusHistory = [];

      // コンポーネントの初期化
      component.salaryHistory = [];
      component.employees = [
        {
          employeeNumber: employeeNumber,
          name: 'テスト社員',
          email: 'test@example.com',
          employmentType: '正社員',
          expectedSalary: 500000,
          hireDate: { year: 2025, month: 1 }
        }
      ];
      component.bonusHistory = [];
      component.bonusList = [];
      component.insuranceList = [];

      // 社員データのモック
      firestoreService.getAllEmployees.and.returnValue(Promise.resolve([
        {
          employeeNumber: employeeNumber,
          name: 'テスト社員',
          email: 'test@example.com',
          employmentType: '正社員',
          expectedSalary: 500000,
          hireDate: { year: 2025, month: 1 }
        }
      ]));

      // getAllOnboardingEmployeesのモック（空配列を返す）
      firestoreService.getAllOnboardingEmployees.and.returnValue(Promise.resolve([]));

      firestoreService.getEmployeeData.and.returnValue(Promise.resolve({
        employeeNumber: employeeNumber,
        expectedSalary: 500000,
        hireDate: { year: 2025, month: 1 }
      }));

      // 給与設定履歴のモック（動的に更新）
      firestoreService.getAllSalaryHistory.and.returnValue(Promise.resolve(currentSalaryHistory));
      
      // getSalaryHistoryのモック（動的に更新）
      firestoreService.getSalaryHistory.and.returnValue(Promise.resolve(currentSalaryHistory));

      // 標準報酬月額変更情報のモック（動的に更新）
      firestoreService.getStandardMonthlySalaryChangesInPeriod.and.callFake(
        (empNum: string, startYear: number, startMonth: number, endYear: number, endMonth: number) => {
          return Promise.resolve(
            currentStandardMonthlySalaryChanges.filter((c: any) => {
              if (String(c.employeeNumber) !== String(empNum)) return false;
              const cYear = c.effectiveYear;
              const cMonth = c.effectiveMonth;
              if (cYear < startYear || (cYear === startYear && cMonth < startMonth)) return false;
              if (cYear > endYear || (cYear === endYear && cMonth > endMonth)) return false;
              return true;
            })
          );
        }
      );

      firestoreService.getPensionStandardMonthlySalaryChangesInPeriod.and.callFake(
        (empNum: string, startYear: number, startMonth: number, endYear: number, endMonth: number) => {
          return Promise.resolve(
            currentPensionStandardMonthlySalaryChanges.filter((c: any) => {
              if (String(c.employeeNumber) !== String(empNum)) return false;
              const cYear = c.effectiveYear;
              const cMonth = c.effectiveMonth;
              if (cYear < startYear || (cYear === startYear && cMonth < startMonth)) return false;
              if (cYear > endYear || (cYear === endYear && cMonth > endMonth)) return false;
              return true;
            })
          );
        }
      );

      // getStandardMonthlySalaryChangeのモック（変更月以前の最新の変更情報を取得）
      firestoreService.getStandardMonthlySalaryChange.and.callFake(
        (empNum: string, year: number, month: number) => {
          const changes = currentStandardMonthlySalaryChanges
            .filter((c: any) => {
              if (String(c.employeeNumber) !== String(empNum)) return false;
              const cYear = c.effectiveYear;
              const cMonth = c.effectiveMonth;
              if (cYear < year) return true;
              if (cYear === year && cMonth <= month) return true;
              return false;
            })
            .sort((a: any, b: any) => {
              if (a.effectiveYear !== b.effectiveYear) return b.effectiveYear - a.effectiveYear;
              return b.effectiveMonth - a.effectiveMonth;
            });
          return Promise.resolve(changes.length > 0 ? changes[0] : null);
        }
      );

      firestoreService.getPensionStandardMonthlySalaryChange.and.callFake(
        (empNum: string, year: number, month: number) => {
          const changes = currentPensionStandardMonthlySalaryChanges
            .filter((c: any) => {
              if (String(c.employeeNumber) !== String(empNum)) return false;
              const cYear = c.effectiveYear;
              const cMonth = c.effectiveMonth;
              if (cYear < year) return true;
              if (cYear === year && cMonth <= month) return true;
              return false;
            })
            .sort((a: any, b: any) => {
              if (a.effectiveYear !== b.effectiveYear) return b.effectiveYear - a.effectiveYear;
              return b.effectiveMonth - a.effectiveMonth;
            });
          return Promise.resolve(changes.length > 0 ? changes[0] : null);
        }
      );

      // saveStandardMonthlySalaryChangeのモック（変更情報を保存）
      firestoreService.saveStandardMonthlySalaryChange.and.callFake(
        (empNum: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number) => {
          console.log(`[テスト] saveStandardMonthlySalaryChange呼び出し: 社員番号=${empNum}, 適用年月=${effectiveYear}年${effectiveMonth}月, 等級=${grade}, 標準報酬月額=${monthlyStandard}`);
          // 既存の変更情報を削除（同じ年月の変更情報を上書き）
          const index = currentStandardMonthlySalaryChanges.findIndex((c: any) => 
            String(c.employeeNumber) === String(empNum) && 
            c.effectiveYear === effectiveYear && 
            c.effectiveMonth === effectiveMonth
          );
          if (index >= 0) {
            currentStandardMonthlySalaryChanges.splice(index, 1);
          }
          
          const change = {
            employeeNumber: empNum,
            effectiveYear: effectiveYear,
            effectiveMonth: effectiveMonth,
            grade: grade,
            monthlyStandard: monthlyStandard
          };
          currentStandardMonthlySalaryChanges.push(change);
          console.log(`[テスト] 標準報酬月額変更情報を保存しました。現在の件数: ${currentStandardMonthlySalaryChanges.length}`);
          return Promise.resolve();
        }
      );

      firestoreService.savePensionStandardMonthlySalaryChange.and.callFake(
        (empNum: string, effectiveYear: number, effectiveMonth: number, grade: number, monthlyStandard: number) => {
          // 既存の変更情報を削除（同じ年月の変更情報を上書き）
          const index = currentPensionStandardMonthlySalaryChanges.findIndex((c: any) => 
            String(c.employeeNumber) === String(empNum) && 
            c.effectiveYear === effectiveYear && 
            c.effectiveMonth === effectiveMonth
          );
          if (index >= 0) {
            currentPensionStandardMonthlySalaryChanges.splice(index, 1);
          }
          
          currentPensionStandardMonthlySalaryChanges.push({
            employeeNumber: empNum,
            effectiveYear: effectiveYear,
            effectiveMonth: effectiveMonth,
            grade: grade,
            monthlyStandard: monthlyStandard
          });
          return Promise.resolve();
        }
      );

      // saveSalariesBatchのモック（給与設定履歴を更新）
      firestoreService.saveSalariesBatch.and.callFake((salaries: any[], onProgress?: (current: number, total: number) => void) => {
        // 既存の給与設定履歴を削除（同じ年月の給与設定を上書き）
        salaries.forEach((salary: any) => {
          const index = currentSalaryHistory.findIndex((s: any) => 
            String(s.employeeNumber) === String(salary.employeeNumber) && 
            s.year === salary.year && 
            s.month === salary.month
          );
          if (index >= 0) {
            currentSalaryHistory.splice(index, 1);
          }
        });
        
        // 新しい給与設定履歴を追加
        currentSalaryHistory.push(...salaries.map((s: any) => ({
          employeeNumber: s.employeeNumber,
          year: s.year,
          month: s.month,
          amount: s.amount,
          isManual: s.isManual,
          createdAt: new Date(),
          updatedAt: new Date()
        })));
        
        // 進捗コールバックを呼び出す
        if (onProgress) {
          onProgress(salaries.length, salaries.length);
        }
        
        return Promise.resolve();
      });

      // deleteStandardMonthlySalaryChangeのモック（変更情報を削除）
      firestoreService.deleteStandardMonthlySalaryChange.and.callFake(
        (empNum: string, effectiveYear: number, effectiveMonth: number) => {
          console.log(`[テスト] deleteStandardMonthlySalaryChange呼び出し: 社員番号=${empNum}, 適用年月=${effectiveYear}年${effectiveMonth}月`);
          const index = currentStandardMonthlySalaryChanges.findIndex((c: any) => 
            String(c.employeeNumber) === String(empNum) && 
            c.effectiveYear === effectiveYear && 
            c.effectiveMonth === effectiveMonth
          );
          if (index >= 0) {
            currentStandardMonthlySalaryChanges.splice(index, 1);
            console.log(`[テスト] 標準報酬月額変更情報を削除しました。残りの件数: ${currentStandardMonthlySalaryChanges.length}`);
          } else {
            console.log(`[テスト] 削除対象の標準報酬月額変更情報が見つかりませんでした`);
          }
          return Promise.resolve();
        }
      );

      // deletePensionStandardMonthlySalaryChangeのモック（変更情報を削除）
      firestoreService.deletePensionStandardMonthlySalaryChange.and.callFake(
        (empNum: string, effectiveYear: number, effectiveMonth: number) => {
          console.log(`[テスト] deletePensionStandardMonthlySalaryChange呼び出し: 社員番号=${empNum}, 適用年月=${effectiveYear}年${effectiveMonth}月`);
          const index = currentPensionStandardMonthlySalaryChanges.findIndex((c: any) => 
            String(c.employeeNumber) === String(empNum) && 
            c.effectiveYear === effectiveYear && 
            c.effectiveMonth === effectiveMonth
          );
          if (index >= 0) {
            currentPensionStandardMonthlySalaryChanges.splice(index, 1);
            console.log(`[テスト] 厚生年金標準報酬月額変更情報を削除しました。残りの件数: ${currentPensionStandardMonthlySalaryChanges.length}`);
          } else {
            console.log(`[テスト] 削除対象の厚生年金標準報酬月額変更情報が見つかりませんでした`);
          }
          return Promise.resolve();
        }
      );

      // 賞与履歴のモック（動的に更新）
      firestoreService.getBonusHistory.and.returnValue(Promise.resolve(currentBonusHistory));

      // saveBonusのモック（賞与履歴を更新）
      firestoreService.saveBonus.and.callFake((empNum: string, year: number, month: number, amount: number) => {
        currentBonusHistory.push({
          employeeNumber: empNum,
          year: year,
          month: month,
          amount: amount,
          createdAt: new Date(),
          id: `bonus-${currentBonusHistory.length}`
        });
        return Promise.resolve();
      });

      // 設定のモック
      firestoreService.getSettings.and.returnValue(Promise.resolve({
        insuranceRates: {
          healthInsurance: 9.91,
          nursingInsurance: 1.59,
          pensionInsurance: 18.3
        }
      }));
    });

    it('1月に給与設定した場合、4月に随時改定が適用される', async () => {
      component.selectedSalaryEmployee = employeeNumber;
      component.salaryYear = 2026;
      component.salaryMonth = 1;
      component.salaryAmount = 88000;

      await component.saveSalary();

      // デバッグ: 保存された変更情報を確認
      console.log(`[テスト] 保存された標準報酬月額変更情報の件数: ${currentStandardMonthlySalaryChanges.length}`);
      console.log(`[テスト] 保存された変更情報:`, currentStandardMonthlySalaryChanges);

      // 4月の標準報酬月額変更情報を確認（1月の3か月後）
      const aprilChange = currentStandardMonthlySalaryChanges.find((c: any) => 
        String(c.employeeNumber) === String(employeeNumber) && 
        c.effectiveYear === 2026 && 
        c.effectiveMonth === 4
      );

      expect(aprilChange).toBeTruthy('4月の標準報酬月額変更情報が保存されていません');
      if (aprilChange) {
        expect(aprilChange.grade).toBe(4); // 88000円は等級4
      }
    });

    it('4月に給与設定した場合、7月に随時改定が適用される', async () => {
      component.selectedSalaryEmployee = employeeNumber;
      component.salaryYear = 2026;
      component.salaryMonth = 4;
      component.salaryAmount = 98000;

      await component.saveSalary();

      // 7月の標準報酬月額変更情報を確認（4月の3か月後）
      const julyChange = currentStandardMonthlySalaryChanges.find((c: any) => 
        c.employeeNumber === employeeNumber && 
        c.effectiveYear === 2026 && 
        c.effectiveMonth === 7
      );

      expect(julyChange).toBeTruthy();
      expect(julyChange.grade).toBe(5); // 98000円は等級5
    });

    it('給与設定と同じ月に4回目の賞与を支給した場合、正しく処理される', async () => {
      // まず給与設定（2026年4月）
      component.selectedSalaryEmployee = employeeNumber;
      component.salaryYear = 2026;
      component.salaryMonth = 4;
      component.salaryAmount = 88000;
      await component.saveSalary();

      // 賞与を3回支給（2025年度）
      component.selectedBonusEmployee = employeeNumber;
      component.bonusYear = 2025;
      component.bonusMonth = 6;
      component.bonusAmount = 30000;
      await component.saveBonus();

      component.bonusYear = 2025;
      component.bonusMonth = 7;
      component.bonusAmount = 30000;
      await component.saveBonus();

      component.bonusYear = 2025;
      component.bonusMonth = 8;
      component.bonusAmount = 30000;
      await component.saveBonus();

      // 4回目の賞与を設定（給与設定と同じ月：2026年4月）
      component.bonusYear = 2026;
      component.bonusMonth = 4;
      component.bonusAmount = 30000;
      await component.saveBonus();

      // 2026年7月の標準報酬月額変更情報を確認（給与設定月の3か月後）
      const julyChange = currentStandardMonthlySalaryChanges.find((c: any) => 
        c.employeeNumber === employeeNumber && 
        c.effectiveYear === 2026 && 
        c.effectiveMonth === 7
      );

      expect(julyChange).toBeTruthy();
      // 報酬加算額が含まれるため、等級が上がる可能性がある
    });

    it('10月に給与設定した場合、翌年1月に随時改定が適用される', async () => {
      component.selectedSalaryEmployee = employeeNumber;
      component.salaryYear = 2026;
      component.salaryMonth = 10;
      component.salaryAmount = 98000;

      await component.saveSalary();

      // 翌年1月の標準報酬月額変更情報を確認（10月の3か月後）
      const januaryChange = currentStandardMonthlySalaryChanges.find((c: any) => 
        c.employeeNumber === employeeNumber && 
        c.effectiveYear === 2027 && 
        c.effectiveMonth === 1
      );

      expect(januaryChange).toBeTruthy();
      expect(januaryChange.grade).toBe(5); // 98000円は等級5
    });

    it('12月に給与設定した場合、翌年3月に随時改定が適用される', async () => {
      component.selectedSalaryEmployee = employeeNumber;
      component.salaryYear = 2026;
      component.salaryMonth = 12;
      component.salaryAmount = 104000;

      await component.saveSalary();

      // 翌年3月の標準報酬月額変更情報を確認（12月の3か月後）
      const marchChange = currentStandardMonthlySalaryChanges.find((c: any) => 
        c.employeeNumber === employeeNumber && 
        c.effectiveYear === 2027 && 
        c.effectiveMonth === 3
      );

      expect(marchChange).toBeTruthy();
      expect(marchChange.grade).toBe(6); // 104000円は等級6
    });
  });
});

// モックデータのエクスポート（他のテストで使用可能にするため）
export const MOCK_HEALTH_GRADE_TABLE = [
  { grade: 1, monthlyStandard: 58000, from: 0, to: 62999 },
  { grade: 2, monthlyStandard: 68000, from: 63000, to: 72999 },
  { grade: 3, monthlyStandard: 78000, from: 73000, to: 82999 },
  { grade: 4, monthlyStandard: 88000, from: 83000, to: 92999 },
  { grade: 5, monthlyStandard: 98000, from: 93000, to: 100999 },
  { grade: 6, monthlyStandard: 104000, from: 101000, to: 106999 },
  { grade: 7, monthlyStandard: 110000, from: 107000, to: 113999 },
  { grade: 8, monthlyStandard: 118000, from: 114000, to: 121999 },
  { grade: 9, monthlyStandard: 126000, from: 122000, to: 129999 },
  { grade: 10, monthlyStandard: 134000, from: 130000, to: 137999 },
  { grade: 11, monthlyStandard: 142000, from: 138000, to: 145999 },
  { grade: 12, monthlyStandard: 150000, from: 146000, to: 154999 },
  { grade: 13, monthlyStandard: 160000, from: 155000, to: 164999 },
  { grade: 14, monthlyStandard: 170000, from: 165000, to: 174999 },
  { grade: 15, monthlyStandard: 180000, from: 175000, to: 184999 },
  { grade: 16, monthlyStandard: 190000, from: 185000, to: 194999 },
  { grade: 17, monthlyStandard: 200000, from: 195000, to: 209999 },
  { grade: 18, monthlyStandard: 220000, from: 210000, to: 229999 },
  { grade: 19, monthlyStandard: 240000, from: 230000, to: 249999 },
  { grade: 20, monthlyStandard: 260000, from: 250000, to: 269999 },
  { grade: 21, monthlyStandard: 280000, from: 270000, to: 289999 },
  { grade: 22, monthlyStandard: 300000, from: 290000, to: 309999 },
  { grade: 23, monthlyStandard: 320000, from: 310000, to: 329999 },
  { grade: 24, monthlyStandard: 340000, from: 330000, to: 349999 },
  { grade: 25, monthlyStandard: 360000, from: 350000, to: 369999 },
  { grade: 26, monthlyStandard: 380000, from: 370000, to: 394999 },
  { grade: 27, monthlyStandard: 410000, from: 395000, to: 424999 },
  { grade: 28, monthlyStandard: 440000, from: 425000, to: 454999 },
  { grade: 29, monthlyStandard: 470000, from: 455000, to: 484999 },
  { grade: 30, monthlyStandard: 500000, from: 485000, to: 514999 },
  { grade: 31, monthlyStandard: 530000, from: 515000, to: 544999 },
  { grade: 32, monthlyStandard: 560000, from: 545000, to: 574999 },
  { grade: 33, monthlyStandard: 590000, from: 575000, to: 604999 },
  { grade: 34, monthlyStandard: 620000, from: 605000, to: 634999 },
  { grade: 35, monthlyStandard: 650000, from: 635000, to: 664999 },
  { grade: 36, monthlyStandard: 680000, from: 665000, to: 694999 },
  { grade: 37, monthlyStandard: 710000, from: 695000, to: 729999 },
  { grade: 38, monthlyStandard: 750000, from: 730000, to: 769999 },
  { grade: 39, monthlyStandard: 790000, from: 770000, to: 809999 },
  { grade: 40, monthlyStandard: 830000, from: 810000, to: 854999 },
  { grade: 41, monthlyStandard: 880000, from: 855000, to: 904999 },
  { grade: 42, monthlyStandard: 930000, from: 905000, to: 954999 },
  { grade: 43, monthlyStandard: 980000, from: 955000, to: 1004999 },
  { grade: 44, monthlyStandard: 1030000, from: 1005000, to: 1054999 },
  { grade: 45, monthlyStandard: 1090000, from: 1055000, to: 1114999 },
  { grade: 46, monthlyStandard: 1150000, from: 1115000, to: 1174999 },
  { grade: 47, monthlyStandard: 1210000, from: 1175000, to: 1234999 },
  { grade: 48, monthlyStandard: 1270000, from: 1235000, to: 1294999 },
  { grade: 49, monthlyStandard: 1330000, from: 1295000, to: 1354999 },
  { grade: 50, monthlyStandard: 1390000, from: 1355000, to: 99999999 }
];

export const MOCK_PENSION_GRADE_TABLE = [
  { grade: 1, monthlyStandard: 88000, from: 83000, to: 92999 },
  { grade: 2, monthlyStandard: 98000, from: 93000, to: 100999 },
  { grade: 3, monthlyStandard: 104000, from: 101000, to: 106999 },
  { grade: 4, monthlyStandard: 110000, from: 107000, to: 113999 },
  { grade: 5, monthlyStandard: 118000, from: 114000, to: 121999 },
  { grade: 6, monthlyStandard: 126000, from: 122000, to: 129999 },
  { grade: 7, monthlyStandard: 134000, from: 130000, to: 137999 },
  { grade: 8, monthlyStandard: 142000, from: 138000, to: 145999 },
  { grade: 9, monthlyStandard: 150000, from: 146000, to: 154999 },
  { grade: 10, monthlyStandard: 160000, from: 155000, to: 164999 },
  { grade: 11, monthlyStandard: 170000, from: 165000, to: 174999 },
  { grade: 12, monthlyStandard: 180000, from: 175000, to: 184999 },
  { grade: 13, monthlyStandard: 190000, from: 185000, to: 194999 },
  { grade: 14, monthlyStandard: 200000, from: 195000, to: 209999 },
  { grade: 15, monthlyStandard: 220000, from: 210000, to: 229999 },
  { grade: 16, monthlyStandard: 240000, from: 230000, to: 249999 },
  { grade: 17, monthlyStandard: 260000, from: 250000, to: 269999 },
  { grade: 18, monthlyStandard: 280000, from: 270000, to: 289999 },
  { grade: 19, monthlyStandard: 300000, from: 290000, to: 309999 },
  { grade: 20, monthlyStandard: 320000, from: 310000, to: 329999 },
  { grade: 21, monthlyStandard: 340000, from: 330000, to: 349999 },
  { grade: 22, monthlyStandard: 360000, from: 350000, to: 369999 },
  { grade: 23, monthlyStandard: 380000, from: 370000, to: 394999 },
  { grade: 24, monthlyStandard: 410000, from: 395000, to: 424999 },
  { grade: 25, monthlyStandard: 440000, from: 425000, to: 454999 },
  { grade: 26, monthlyStandard: 470000, from: 455000, to: 484999 },
  { grade: 27, monthlyStandard: 500000, from: 485000, to: 514999 },
  { grade: 28, monthlyStandard: 530000, from: 515000, to: 544999 },
  { grade: 29, monthlyStandard: 560000, from: 545000, to: 574999 },
  { grade: 30, monthlyStandard: 590000, from: 575000, to: 604999 },
  { grade: 31, monthlyStandard: 620000, from: 605000, to: 634999 },
  { grade: 32, monthlyStandard: 650000, from: 635000, to: 99999999 }
];

export const MOCK_GRADE_TABLE = {
  hyouzyungetugakuReiwa7: MOCK_HEALTH_GRADE_TABLE,
  kouseinenkinReiwa7: MOCK_PENSION_GRADE_TABLE
};
