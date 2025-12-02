import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'kensyu10117'
};

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private db: Firestore;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  /**
   * 従業員データを正規化して保存する共通メソッド
   * 従業員側と人事側で同じデータ構造を保証する
   */
  normalizeEmployeeData(data: any): any {
    const normalized: any = { ...data };
    
    // マイナンバーと基礎年金番号の一時フィールドを削除（既に結合されている想定）
    delete normalized.myNumberPart1;
    delete normalized.myNumberPart2;
    delete normalized.myNumberPart3;
    delete normalized.basicPensionNumberPart1;
    delete normalized.basicPensionNumberPart2;
    
    // undefinedの値を削除
    return this.removeUndefinedValues(normalized);
  }

  /**
   * undefinedの値を再帰的に削除するヘルパー関数
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
          cleaned[key] = this.removeUndefinedValues(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  }

  async saveEmployeeData(employeeNumber: string, data: any): Promise<void> {
    try {
      // データを正規化してから保存
      const normalizedData = this.normalizeEmployeeData(data);
      
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...normalizedData,
        employeeNumber: employeeNumber, // 社員番号を明示的に設定
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving employee data:', error);
      throw error;
    }
  }

  async getEmployeeData(employeeNumber: string): Promise<any | null> {
    try {
      // まず通常の社員コレクションを検索
      const docRef = doc(this.db, 'employees', employeeNumber);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      }
      
      // 通常の社員コレクションで見つからない場合、新入社員コレクションを検索
      const onboardingDocRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      const onboardingDocSnap = await getDoc(onboardingDocRef);
      
      if (onboardingDocSnap.exists()) {
        return onboardingDocSnap.data();
      }
      
      return null;
    } catch (error) {
      console.error('Error getting employee data:', error);
      throw error;
    }
  }

  /**
   * 申請要求を保存する
   */
  async saveApplicationRequest(requestData: any): Promise<void> {
    try {
      const requestId = `request_${requestData.employeeNumber}_${Date.now()}`;
      const docRef = doc(this.db, 'applicationRequests', requestId);
      await setDoc(docRef, {
        ...requestData,
        id: requestId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error saving application request:', error);
      throw error;
    }
  }

  /**
   * 社員番号に基づいて申請要求を取得する
   */
  async getApplicationRequestsByEmployee(employeeNumber: string): Promise<any[]> {
    try {
      const requestsCollection = collection(this.db, 'applicationRequests');
      const querySnapshot = await getDocs(requestsCollection);
      
      const requests: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['employeeNumber'] === employeeNumber && data['status'] !== '対応済み') {
          requests.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // 日付順にソート（新しいものから）
      return requests.sort((a, b) => {
        const dateA = a.requestedAt?.toDate ? a.requestedAt.toDate() : new Date(a.requestedAt || 0);
        const dateB = b.requestedAt?.toDate ? b.requestedAt.toDate() : new Date(b.requestedAt || 0);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error('Error getting application requests:', error);
      throw error;
    }
  }

  /**
   * 申請要求のステータスを更新する
   */
  async updateApplicationRequestStatus(requestId: string, status: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'applicationRequests', requestId);
      await updateDoc(docRef, {
        status: status,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating application request status:', error);
      throw error;
    }
  }

  async getAllEmployees(): Promise<any[]> {
    try {
      const employeesCollection = collection(this.db, 'employees');
      const querySnapshot = await getDocs(employeesCollection);
      
      const employees: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        employees.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return employees;
    } catch (error) {
      console.error('Error getting all employees:', error);
      throw error;
    }
  }

  /**
   * 保険証ステータスのみを更新する（他のデータに影響を与えない）
   */
  async updateInsuranceCardStatus(employeeNumber: string, status: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        insuranceCardStatus: status,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating insurance card status:', error);
      throw error;
    }
  }

  async getEmployeeByEmail(email: string): Promise<any | null> {
    try {
      // まず通常の社員コレクションを検索
      const employeesCollection = collection(this.db, 'employees');
      const employeesSnapshot = await getDocs(employeesCollection);
      
      let employee = null;
      employeesSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['email'] === email) {
          employee = {
            id: doc.id,
            ...data
          };
        }
      });
      
      // 通常の社員コレクションで見つからなかった場合、新入社員コレクションを検索
      if (!employee) {
        const onboardingCollection = collection(this.db, 'onboardingEmployees');
        const onboardingSnapshot = await getDocs(onboardingCollection);
        
        onboardingSnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          if (data['email'] === email) {
            employee = {
              id: doc.id,
              ...data
            };
          }
        });
      }
      
      return employee;
    } catch (error) {
      console.error('Error getting employee by email:', error);
      throw error;
    }
  }

  /**
   * 設定を保存する
   */
  async saveSettings(settings: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'settings', 'company');
      await setDoc(docRef, {
        ...settings,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * 設定を読み込む
   */
  async getSettings(): Promise<any | null> {
    try {
      const docRef = doc(this.db, 'settings', 'company');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }

  /**
   * 申請データを保存する
   */
  async saveApplication(applicationData: any): Promise<string> {
    try {
      // 申請IDを取得（全申請の最大ID + 1）
      const nextApplicationId = await this.getNextApplicationId();
      
      const applicationWithId = {
        ...applicationData,
        applicationId: nextApplicationId,
        status: '承認待ち',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = doc(this.db, 'applications', `app_${nextApplicationId}`);
      await setDoc(docRef, applicationWithId);
      
      return nextApplicationId.toString();
    } catch (error) {
      console.error('Error saving application:', error);
      throw error;
    }
  }

  /**
   * 次の申請IDを取得する（全申請の最大ID + 1）
   */
  private async getNextApplicationId(): Promise<number> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let maxId = 0;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        const applicationId = data['applicationId'];
        if (applicationId && typeof applicationId === 'number' && applicationId > maxId) {
          maxId = applicationId;
        }
      });
      
      return maxId + 1;
    } catch (error) {
      console.error('Error getting next application ID:', error);
      // エラー時は1から開始
      return 1;
    }
  }

  /**
   * 従業員の申請一覧を取得する
   */
  async getEmployeeApplications(employeeNumber: string): Promise<any[]> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      const applications: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['employeeNumber'] === employeeNumber) {
          applications.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      // 申請IDでソート（古い順）
      applications.sort((a, b) => {
        const idA = a.applicationId || 0;
        const idB = b.applicationId || 0;
        return idA - idB;
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting employee applications:', error);
      throw error;
    }
  }

  /**
   * 申請種類で申請一覧を取得する
   */
  async getEmployeeApplicationsByType(applicationType: string): Promise<any[]> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      const applications: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationType'] === applicationType) {
          applications.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting applications by type:', error);
      throw error;
    }
  }

  /**
   * 全申請一覧を取得する（人事用）
   */
  async getAllApplications(): Promise<any[]> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      const applications: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        applications.push({
          id: doc.id,
          ...data
        });
      });
      
      // 申請IDでソート（新しい順）
      applications.sort((a, b) => {
        const idA = a.applicationId || 0;
        const idB = b.applicationId || 0;
        return idB - idA;
      });
      
      return applications;
    } catch (error) {
      console.error('Error getting all applications:', error);
      throw error;
    }
  }
  
  // 申請のステータスを更新
  async updateApplicationStatus(applicationId: string, status: string, comment: string = ''): Promise<void> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let targetDocId: string | null = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationId'] === parseInt(applicationId) || data['id'] === applicationId || doc.id === applicationId) {
          targetDocId = doc.id;
        }
      });
      
      if (!targetDocId) {
        throw new Error('Application not found');
      }
      
      const applicationRef = doc(this.db, 'applications', targetDocId);
      const updateData: any = {
        status: status,
        updatedAt: new Date()
      };
      
      // 差し戻しの場合はコメントも保存
      if (status === '差し戻し' && comment) {
        updateData.statusComment = comment;
      } else {
        // 差し戻し以外の場合はコメントをクリア
        updateData.statusComment = '';
      }
      
      await updateDoc(applicationRef, updateData);
    } catch (error) {
      console.error('Error updating application status:', error);
      throw error;
    }
  }

  // 申請のデータを更新（ステータス以外のフィールドも更新可能）
  async updateApplicationData(applicationId: string, applicationData: any): Promise<void> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let targetDocId: string | null = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationId'] === parseInt(applicationId) || data['id'] === applicationId || doc.id === applicationId) {
          targetDocId = doc.id;
        }
      });
      
      if (!targetDocId) {
        throw new Error('Application not found');
      }
      
      const applicationRef = doc(this.db, 'applications', targetDocId);
      await updateDoc(applicationRef, {
        ...applicationData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating application data:', error);
      throw error;
    }
  }
  
  // 申請を再提出
  /**
   * 入社時メールを送信する
   * Firebase Functionsのエンドポイントを呼び出す（SMTPまたはTrigger Email拡張機能を使用）
   */
  async sendOnboardingEmail(email: string, name: string, initialPassword: string): Promise<void> {
    try {
      // 本番環境のURLを使用
      const appUrl = 'https://siapp-kadai3.web.app';
      
      // Firebase Functionsのエンドポイントを呼び出す
      const functionsUrl = 'https://us-central1-kensyu10117.cloudfunctions.net/sendOnboardingEmail';
      
      const response = await fetch(functionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          name: name,
          initialPassword: initialPassword,
          appUrl: appUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'メール送信に失敗しました');
      }

      const result = await response.json();
      console.log('Email send result:', result);
    } catch (error) {
      console.error('Error sending onboarding email:', error);
      throw error;
    }
  }

  async resubmitApplication(applicationId: string, applicationData: any): Promise<void> {
    try {
      const applicationsCollection = collection(this.db, 'applications');
      const querySnapshot = await getDocs(applicationsCollection);
      
      let targetDocId: string | null = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['applicationId'] === parseInt(applicationId) || data['id'] === applicationId || doc.id === applicationId) {
          targetDocId = doc.id;
        }
      });
      
      if (!targetDocId) {
        throw new Error('Application not found');
      }
      
      const applicationRef = doc(this.db, 'applications', targetDocId);
      await updateDoc(applicationRef, {
        ...applicationData,
        status: '申請済み',
        statusComment: '', // 差し戻しコメントをクリア
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error resubmitting application:', error);
      throw error;
    }
  }

  /**
   * 新入社員データを保存する
   */
  async saveOnboardingEmployee(employeeNumber: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      const docSnap = await getDoc(docRef);
      const existingData = docSnap.exists() ? docSnap.data() : {};
      
      await setDoc(docRef, {
        ...existingData,
        ...data,
        employeeNumber: employeeNumber,
        status: existingData['status'] || '申請待ち',
        createdAt: existingData['createdAt'] || new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 新入社員データを取得する
   */
  async getOnboardingEmployee(employeeNumber: string): Promise<any | null> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 全新入社員データを取得する
   */
  async getAllOnboardingEmployees(): Promise<any[]> {
    try {
      const onboardingCollection = collection(this.db, 'onboardingEmployees');
      const querySnapshot = await getDocs(onboardingCollection);
      
      const employees: any[] = [];
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        employees.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return employees;
    } catch (error) {
      console.error('Error getting all onboarding employees:', error);
      throw error;
    }
  }

  /**
   * 新入社員のステータスを更新する
   */
  async updateOnboardingEmployeeStatus(employeeNumber: string, status: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      await updateDoc(docRef, {
        status: status,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating onboarding employee status:', error);
      throw error;
    }
  }

  /**
   * 新入社員データを更新する
   */
  async updateOnboardingEmployee(employeeNumber: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 新入社員を削除する
   */
  async deleteOnboardingEmployee(employeeNumber: string): Promise<void> {
    try {
      const docRef = doc(this.db, 'onboardingEmployees', employeeNumber);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting onboarding employee:', error);
      throw error;
    }
  }

  /**
   * 社員の扶養家族情報に新しい扶養家族を追加する
   */
  async addDependentToEmployee(employeeNumber: string, dependentData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 既存の扶養家族情報を取得（なければ空配列）
      const existingDependents = employeeData.dependents || [];
      
      // 新しい扶養家族情報を追加
      const newDependent = {
        name: `${dependentData.lastName || ''} ${dependentData.firstName || ''}`.trim(),
        nameKana: `${dependentData.lastNameKana || ''} ${dependentData.firstNameKana || ''}`.trim(),
        relationship: dependentData.relationshipType === '配偶者' 
          ? (dependentData.spouseType || '配偶者')
          : (dependentData.relationship || ''),
        birthDate: dependentData.birthDate || '',
        gender: dependentData.gender || '',
        myNumber: dependentData.myNumber || '',
        phoneNumber: dependentData.phoneNumber || '',
        occupation: dependentData.occupation || '',
        annualIncome: dependentData.annualIncome || '',
        monthlyIncome: dependentData.monthlyIncome || '',
        dependentStartDate: dependentData.dependentStartDate || '',
        dependentReason: dependentData.dependentReason || '',
        livingTogether: dependentData.livingTogether || '',
        postalCode: dependentData.postalCode || '',
        address: dependentData.address || '',
        addressKana: dependentData.addressKana || '',
        addressChangeDate: dependentData.addressChangeDate || '',
        basicPensionNumber: dependentData.basicPensionNumber || '',
        disabilityCategory: dependentData.disabilityCategory || '',
        disabilityCardType: dependentData.disabilityCardType || '',
        disabilityCardIssueDate: dependentData.disabilityCardIssueDate || ''
      };

      // 既存の扶養家族情報に追加
      const updatedDependents = [...existingDependents, newDependent];

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...employeeData,
        dependents: updatedDependents,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error adding dependent to employee:', error);
      throw error;
    }
  }

  /**
   * 社員の扶養家族情報から指定された扶養家族を削除する
   */
  async removeDependentFromEmployee(employeeNumber: string, dependentName: string, dependentRelationship: string): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 既存の扶養家族情報を取得（なければ空配列）
      const existingDependents = employeeData.dependents || [];
      
      // 指定された扶養家族を削除（氏名と続柄で一致するものを削除）
      const updatedDependents = existingDependents.filter((dep: any) => {
        return !(dep.name === dependentName && dep.relationship === dependentRelationship);
      });

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...employeeData,
        dependents: updatedDependents,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error removing dependent from employee:', error);
      throw error;
    }
  }

  /**
   * 社員の住所情報と住民票情報を更新する
   */
  async updateEmployeeAddress(employeeNumber: string, addressData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 住所情報を更新（undefinedをnullまたは空文字列に変換）
      const updatedData: any = {
        ...employeeData,
        postalCode: addressData.newAddress?.postalCode ?? employeeData.postalCode ?? '',
        currentAddress: addressData.newAddress?.address ?? employeeData.currentAddress ?? '',
        currentAddressKana: addressData.newAddress?.addressKana ?? employeeData.currentAddressKana ?? '',
        currentHouseholdHead: addressData.newAddress?.householdHead ?? employeeData.currentHouseholdHead ?? '',
        currentHouseholdHeadName: addressData.newAddress?.householdHeadName ?? employeeData.currentHouseholdHeadName ?? '',
        residentAddress: addressData.residentAddress?.address ?? employeeData.residentAddress ?? '',
        residentAddressKana: addressData.residentAddress?.addressKana ?? employeeData.residentAddressKana ?? '',
        residentHouseholdHead: addressData.residentAddress?.householdHead ?? employeeData.residentHouseholdHead ?? '',
        residentHouseholdHeadName: addressData.residentAddress?.householdHeadName ?? employeeData.residentHouseholdHeadName ?? '',
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating employee address:', error);
      throw error;
    }
  }

  /**
   * 社員の氏名を更新する
   */
  async updateEmployeeName(employeeNumber: string, nameData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 氏名を結合
      const newName = `${nameData.lastName || ''} ${nameData.firstName || ''}`.trim();
      const newNameKana = `${nameData.lastNameKana || ''} ${nameData.firstNameKana || ''}`.trim();

      // 氏名情報を更新
      const updatedData: any = {
        ...employeeData,
        name: newName || employeeData.name || '',
        nameKana: newNameKana || employeeData.nameKana || '',
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating employee name:', error);
      throw error;
    }
  }

  /**
   * 社員の退職情報を更新する
   */
  async updateEmployeeResignation(employeeNumber: string, resignationData: any): Promise<void> {
    try {
      // 既存の社員データを取得
      const employeeData = await this.getEmployeeData(employeeNumber);
      
      if (!employeeData) {
        throw new Error(`Employee with number ${employeeNumber} not found`);
      }

      // 退職日の次の日を計算（資格喪失年月日）
      let socialInsuranceLossDate = '';
      if (resignationData.resignationDate) {
        const resignationDate = new Date(resignationData.resignationDate);
        resignationDate.setDate(resignationDate.getDate() + 1);
        const year = resignationDate.getFullYear();
        const month = String(resignationDate.getMonth() + 1).padStart(2, '0');
        const day = String(resignationDate.getDate()).padStart(2, '0');
        socialInsuranceLossDate = `${year}-${month}-${day}`;
      }

      // 退職後の社会保険加入が「社会保険を任意継続する」の場合のみ、保険者種別を「任意継続被保険者」に変更
      const isContinuingInsurance = resignationData.postResignationInsurance === '社会保険を任意継続する';
      
      // 退職情報を更新
      const updatedData: any = {
        ...employeeData,
        // 入退社情報
        employmentStatus: '退職',
        resignationDate: resignationData.resignationDate || employeeData.resignationDate || '',
        resignationReason: resignationData.resignationReason || employeeData.resignationReason || '',
        // 現住所や連絡先に変更があれば更新
        currentAddress: resignationData.postResignationAddress || employeeData.currentAddress || '',
        phoneNumber: resignationData.postResignationPhone || employeeData.phoneNumber || '',
        email: resignationData.postResignationEmail || employeeData.email || '',
        // 社会保険
        socialInsuranceLossDate: socialInsuranceLossDate || employeeData.socialInsuranceLossDate || '',
        // 保険者種別は「社会保険を任意継続する」が選択された場合のみ「任意継続被保険者」に変更
        healthInsuranceType: isContinuingInsurance ? '任意継続被保険者' : (employeeData.healthInsuranceType || ''),
        nursingInsuranceType: isContinuingInsurance ? '任意継続被保険者' : (employeeData.nursingInsuranceType || ''),
        // 保険証情報
        insuranceCardCollectionDate: resignationData.lastWorkDate || employeeData.insuranceCardCollectionDate || '',
        insuranceCardDistributionStatus: '回収済み',
        updatedAt: new Date()
      };

      // undefinedの値を削除
      const cleanedData = this.removeUndefinedValues(updatedData);

      // 社員データを更新
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, cleanedData, { merge: true });
    } catch (error) {
      console.error('Error updating employee resignation:', error);
      throw error;
    }
  }

  /**
   * 給与設定を保存
   */
  async saveSalary(employeeNumber: string, year: number, month: number, amount: number): Promise<void> {
    try {
      const docId = `${employeeNumber}_${year}_${month}`;
      const docRef = doc(this.db, 'salaries', docId);
      await setDoc(docRef, {
        employeeNumber: employeeNumber,
        year: year,
        month: month,
        amount: amount,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving salary:', error);
      throw error;
    }
  }

  /**
   * 給与設定履歴を取得
   */
  async saveStandardMonthlySalaryChange(
    employeeNumber: string,
    effectiveYear: number,
    effectiveMonth: number,
    grade: number,
    monthlyStandard: number
  ): Promise<void> {
    const changeRef = doc(this.db, 'standardMonthlySalaryChanges', `${employeeNumber}_${effectiveYear}_${effectiveMonth}`);
    await setDoc(changeRef, {
      employeeNumber,
      effectiveYear,
      effectiveMonth,
      grade,
      monthlyStandard,
      createdAt: new Date()
    }, { merge: true });
  }

  async getStandardMonthlySalaryChange(employeeNumber: string, year: number, month: number): Promise<any | null> {
    // 該当年月以前の最新の変更情報を取得
    const changesRef = collection(this.db, 'standardMonthlySalaryChanges');
    const snapshot = await getDocs(changesRef);
    
    const changes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((change: any) => {
        if (change.employeeNumber !== employeeNumber) return false;
        const changeYear = Number(change.effectiveYear);
        const changeMonth = Number(change.effectiveMonth);
        if (changeYear < year) return true;
        if (changeYear === year && changeMonth <= month) return true;
        return false;
      })
      .sort((a: any, b: any) => {
        const aYear = Number(a.effectiveYear);
        const bYear = Number(b.effectiveYear);
        const aMonth = Number(a.effectiveMonth);
        const bMonth = Number(b.effectiveMonth);
        if (aYear !== bYear) return bYear - aYear;
        return bMonth - aMonth;
      });
    
    return changes.length > 0 ? changes[0] : null;
  }

  async getStandardMonthlySalaryChangesInPeriod(
    employeeNumber: string,
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number
  ): Promise<any[]> {
    // 指定期間内に適用された標準報酬月額変更情報を取得
    const changesRef = collection(this.db, 'standardMonthlySalaryChanges');
    const snapshot = await getDocs(changesRef);
    
    const changes = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((change: any) => {
        if (change.employeeNumber !== employeeNumber) return false;
        const effectiveYear = Number(change.effectiveYear);
        const effectiveMonth = Number(change.effectiveMonth);
        
        // 期間内かどうかをチェック
        if (effectiveYear < startYear) return false;
        if (effectiveYear === startYear && effectiveMonth < startMonth) return false;
        if (effectiveYear > endYear) return false;
        if (effectiveYear === endYear && effectiveMonth > endMonth) return false;
        return true;
      })
      .sort((a: any, b: any) => {
        const aYear = Number(a.effectiveYear);
        const bYear = Number(b.effectiveYear);
        const aMonth = Number(a.effectiveMonth);
        const bMonth = Number(b.effectiveMonth);
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    
    return changes;
  }

  async getSalaryHistory(employeeNumber?: string): Promise<any[]> {
    try {
      const salariesRef = collection(this.db, 'salaries');
      const snapshot = await getDocs(salariesRef);
      const salaries: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!employeeNumber || data['employeeNumber'] === employeeNumber) {
          salaries.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      return salaries;
    } catch (error) {
      console.error('Error getting salary history:', error);
      return [];
    }
  }

  /**
   * 賞与設定を保存
   */
  async saveBonus(employeeNumber: string, year: number, month: number, amount: number): Promise<void> {
    try {
      const docId = `${employeeNumber}_${year}_${month}_bonus`;
      const docRef = doc(this.db, 'bonuses', docId);
      await setDoc(docRef, {
        employeeNumber: employeeNumber,
        year: year,
        month: month,
        amount: amount,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error saving bonus:', error);
      throw error;
    }
  }

  /**
   * 賞与設定履歴を取得
   */
  async getBonusHistory(employeeNumber?: string): Promise<any[]> {
    try {
      const bonusesRef = collection(this.db, 'bonuses');
      const snapshot = await getDocs(bonusesRef);
      const bonuses: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (!employeeNumber || data['employeeNumber'] === employeeNumber) {
          bonuses.push({
            id: doc.id,
            ...data
          });
        }
      });
      
      return bonuses;
    } catch (error) {
      console.error('Error getting bonus history:', error);
      return [];
    }
  }
}

