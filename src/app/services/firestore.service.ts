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

  async saveEmployeeData(employeeNumber: string, data: any): Promise<void> {
    try {
      const docRef = doc(this.db, 'employees', employeeNumber);
      await setDoc(docRef, {
        ...data,
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

