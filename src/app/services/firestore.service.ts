import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, Firestore, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

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
      const docRef = doc(this.db, 'employees', employeeNumber);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting employee data:', error);
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

  async getEmployeeByEmail(email: string): Promise<any | null> {
    try {
      const employeesCollection = collection(this.db, 'employees');
      const querySnapshot = await getDocs(employeesCollection);
      
      let employee = null;
      querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        if (data['email'] === email) {
          employee = {
            id: doc.id,
            ...data
          };
        }
      });
      
      return employee;
    } catch (error) {
      console.error('Error getting employee by email:', error);
      throw error;
    }
  }
}

