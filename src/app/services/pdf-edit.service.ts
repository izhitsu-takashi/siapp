import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PDFDocument, PDFFont, rgb } from 'pdf-lib';

@Injectable({
  providedIn: 'root'
})
export class PdfEditService {
  // 文書タイプとPDFファイル名のマッピング
  private documentTypeToFileName: { [key: string]: string } = {
    '健康保険・厚生年金保険被保険者資格取得届': '被保険者資格取得届.pdf',
    '健康保険・厚生年金保険被保険者資格喪失届': '被保険者資格喪失届.pdf',
    '健康保険 任意継続被保険者資格取得申請書': '任意継続保険申請.pdf',
    '健康保険被扶養者（異動）届': '健康保険被扶養者（異動）届.pdf',
    '健康保険資格確認書交付申請書': '健康保険資格確認書交付申請書.pdf',
    '健康保険資格確認書再交付申請書': '健康保険資格確認書再交付申請書.pdf',
    '被保険者住所変更届': '住所変更届.pdf',
    '被保険者氏名変更届': '氏名変更届.pdf',
    '産前産後休業取得者申出書／変更（終了）届': '産前産後休業届.pdf',
    '算定基礎届': '被保険者報酬月額算定基礎届.pdf',
    '被保険者報酬月額変更届': '被保険者報酬月額変更届.pdf',
    '健康保険・厚生年金保険被保険者賞与支払届': '被保険者賞与支払い届.pdf'
  };

  constructor(private http: HttpClient) {}

  /**
   * PDFテンプレートを読み込む
   */
  async loadPdfTemplate(documentType: string): Promise<Uint8Array> {
    const fileName = this.documentTypeToFileName[documentType];
    if (!fileName) {
      throw new Error(`文書タイプ "${documentType}" に対応するPDFファイルが見つかりません`);
    }

    try {
      const response = await this.http.get(`/assets/${fileName}`, {
        responseType: 'arraybuffer'
      }).toPromise();
      
      if (!response) {
        throw new Error('PDFファイルの読み込みに失敗しました');
      }
      
      return new Uint8Array(response);
    } catch (error) {
      console.error('Error loading PDF template:', error);
      throw new Error(`PDFテンプレート "${fileName}" の読み込みに失敗しました`);
    }
  }

  /**
   * 従業員データをPDFに記入する
   */
  async fillPdfWithEmployeeData(
    documentType: string,
    employeeData: any
  ): Promise<Uint8Array> {
    try {
      // PDFテンプレートを読み込む
      const pdfBytes = await this.loadPdfTemplate(documentType);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // フォントを取得または埋め込み
      // 注意: pdf-libは日本語フォントを直接サポートしていません
      // 日本語を表示するには、日本語フォントファイル（.ttf）を埋め込む必要があります
      // 現時点では、英数字のみの記入に対応しています
      let font: PDFFont;
      try {
        // 標準フォントを使用（日本語は後で対応）
        font = await pdfDoc.embedFont('Helvetica');
      } catch (error) {
        // フォントの埋め込みに失敗した場合はデフォルトフォントを使用
        font = await pdfDoc.embedFont('Helvetica');
      }

      // 文書タイプに応じて記入処理を実行
      switch (documentType) {
        case '健康保険・厚生年金保険被保険者資格取得届':
          this.fillQualificationAcquisitionForm(firstPage, font, employeeData);
          break;
        case '健康保険・厚生年金保険被保険者資格喪失届':
          this.fillQualificationLossForm(firstPage, font, employeeData);
          break;
        case '健康保険 任意継続被保険者資格取得申請書':
          this.fillVoluntaryContinuationForm(firstPage, font, employeeData);
          break;
        case '健康保険被扶養者（異動）届':
          this.fillDependentChangeForm(firstPage, font, employeeData);
          break;
        case '健康保険資格確認書交付申請書':
          this.fillQualificationConfirmationForm(firstPage, font, employeeData);
          break;
        case '健康保険資格確認書再交付申請書':
          this.fillQualificationReissueForm(firstPage, font, employeeData);
          break;
        case '被保険者住所変更届':
          this.fillAddressChangeForm(firstPage, font, employeeData);
          break;
        case '被保険者氏名変更届':
          this.fillNameChangeForm(firstPage, font, employeeData);
          break;
        case '産前産後休業取得者申出書／変更（終了）届':
          this.fillMaternityLeaveForm(firstPage, font, employeeData);
          break;
        case '算定基礎届':
          this.fillStandardSalaryForm(firstPage, font, employeeData);
          break;
        case '被保険者報酬月額変更届':
          this.fillSalaryChangeForm(firstPage, font, employeeData);
          break;
        case '健康保険・厚生年金保険被保険者賞与支払届':
          this.fillBonusPaymentForm(firstPage, font, employeeData);
          break;
        default:
          console.warn(`文書タイプ "${documentType}" の記入処理が未実装です`);
      }

      // 編集したPDFを保存
      return await pdfDoc.save();
    } catch (error) {
      console.error('Error filling PDF:', error);
      throw error;
    }
  }

  /**
   * 被保険者資格取得届の記入
   * 注意: 座標は実際のPDFに合わせて調整が必要です
   * 
   * 座標の確認方法:
   * 1. debugPdfCoordinates()メソッドを使用して座標グリッドを表示
   * 2. PDFビューアで座標を確認
   * 3. 以下の座標を実際のPDFに合わせて調整
   */
  private fillQualificationAcquisitionForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    const { width, height } = page.getSize();
    
    // 従業員データから必要な情報を取得
    const name = employeeData.name || '';
    const employeeNumber = employeeData.employeeNumber || '';
    const birthDate = this.formatDate(employeeData.birthDate);
    const address = employeeData.currentAddress || employeeData.address || '';
    const postalCode = employeeData.currentPostalCode || employeeData.postalCode || '';
    
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    // 例: 氏名を記入（座標は実際のPDFに合わせて調整）
    // page.drawText(name, {
    //   x: 100,
    //   y: height - 200,
    //   size: 12,
    //   font: font,
    // });
    
    console.log('被保険者資格取得届の記入処理（座標調整が必要）', {
      name,
      employeeNumber,
      birthDate,
      address,
      postalCode
    });
  }

  /**
   * 被保険者資格喪失届の記入
   */
  private fillQualificationLossForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者資格喪失届の記入処理（座標調整が必要）');
  }

  /**
   * 任意継続被保険者資格取得申請書の記入
   */
  private fillVoluntaryContinuationForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('任意継続被保険者資格取得申請書の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険被扶養者（異動）届の記入
   */
  private fillDependentChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険被扶養者（異動）届の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険資格確認書交付申請書の記入
   */
  private fillQualificationConfirmationForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険資格確認書交付申請書の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険資格確認書再交付申請書の記入
   */
  private fillQualificationReissueForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険資格確認書再交付申請書の記入処理（座標調整が必要）');
  }

  /**
   * 被保険者住所変更届の記入
   */
  private fillAddressChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者住所変更届の記入処理（座標調整が必要）');
  }

  /**
   * 被保険者氏名変更届の記入
   */
  private fillNameChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者氏名変更届の記入処理（座標調整が必要）');
  }

  /**
   * 産前産後休業取得者申出書／変更（終了）届の記入
   */
  private fillMaternityLeaveForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('産前産後休業取得者申出書／変更（終了）届の記入処理（座標調整が必要）');
  }

  /**
   * 算定基礎届の記入
   */
  private fillStandardSalaryForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('算定基礎届の記入処理（座標調整が必要）');
  }

  /**
   * 被保険者報酬月額変更届の記入
   */
  private fillSalaryChangeForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('被保険者報酬月額変更届の記入処理（座標調整が必要）');
  }

  /**
   * 健康保険・厚生年金保険被保険者賞与支払届の記入
   */
  private fillBonusPaymentForm(
    page: any,
    font: PDFFont,
    employeeData: any
  ) {
    // TODO: 実際のPDFの座標を確認して記入処理を実装
    console.log('健康保険・厚生年金保険被保険者賞与支払届の記入処理（座標調整が必要）');
  }

  /**
   * PDFをダウンロードする
   */
  downloadPdf(pdfBytes: Uint8Array, fileName: string) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * PDFの座標を確認するためのヘルパーメソッド
   * デバッグ用: PDFの各位置にテキストを配置して座標を確認
   */
  async debugPdfCoordinates(documentType: string): Promise<Uint8Array> {
    try {
      const pdfBytes = await this.loadPdfTemplate(documentType);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont('Helvetica');
      const { width, height } = firstPage.getSize();

      // 座標グリッドを描画（デバッグ用）
      const gridSize = 50;
      for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
          firstPage.drawText(`(${x},${y})`, {
            x: x,
            y: height - y,
            size: 8,
            font: font,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
      }

      return await pdfDoc.save();
    } catch (error) {
      console.error('Error in debugPdfCoordinates:', error);
      throw error;
    }
  }

  /**
   * 日付をフォーマットする（YYYY-MM-DD → YYYY年MM月DD日）
   */
  private formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}年${month}月${day}日`;
    } catch (error) {
      return dateString;
    }
  }

  /**
   * 郵便番号をフォーマットする（1234567 → 123-4567）
   */
  private formatPostalCode(postalCode: string | null | undefined): string {
    if (!postalCode) return '';
    const cleaned = postalCode.replace(/\D/g, '');
    if (cleaned.length === 7) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`;
    }
    return postalCode;
  }

  /**
   * 電話番号をフォーマットする
   */
  private formatPhoneNumber(phone: string | null | undefined): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }
}

