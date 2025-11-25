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
    '健康保険・厚生年金保険 被保険者住所変更届': '住所変更届.pdf',
    '被保険者氏名変更届': '氏名変更届.pdf',
    '産前産後休業取得者申出書／変更（終了）届': '産前産後休業届.pdf',
    '健康保険・厚生年金保険 産前産後休業取得者申出書／変更（終了）届': '産前産後休業届.pdf',
    '算定基礎届': '被保険者報酬月額算定基礎届.pdf',
    '被保険者報酬月額変更届': '被保険者報酬月額変更届.pdf',
    '健康保険・厚生年金保険被保険者賞与支払届': '被保険者賞与支払い届.pdf',
    '健康保険被保険者証再交付申請書': '健康保険資格確認書再交付申請書.pdf'
  };

  // 日本語フォントのキャッシュ
  private japaneseFontCache: Uint8Array | null = null;

  constructor(private http: HttpClient) {}

  /**
   * 日本語フォントを読み込む
   * フォントファイルが存在する場合は読み込み、存在しない場合はnullを返す
   */
  async loadJapaneseFont(): Promise<Uint8Array | null> {
    // 既にキャッシュされている場合はそれを返す
    if (this.japaneseFontCache) {
      return this.japaneseFontCache;
    }

    try {
      // Noto Sans JP Regularフォントを読み込む
      // フォントファイルは src/assets/fonts/NotoSansJP-Regular.ttf に配置する必要があります
      const response = await this.http.get('/assets/fonts/NotoSansJP-Regular.ttf', {
        responseType: 'arraybuffer'
      }).toPromise();
      
      if (response) {
        this.japaneseFontCache = new Uint8Array(response);
        return this.japaneseFontCache;
      }
    } catch (error) {
      console.warn('日本語フォントファイルが見つかりません。英数字のみの記入になります。');
      console.warn('日本語フォントを使用する場合は、src/assets/fonts/NotoSansJP-Regular.ttf を配置してください。');
    }
    
    return null;
  }

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
      // fontkitを動的にインポート
      // @pdf-lib/fontkitを使用（pdf-libの公式推奨パッケージ）
      let fontkit: any = null;
      try {
        // @ts-ignore - fontkitの型定義が不完全な場合があるため
        const fontkitModule = await import('@pdf-lib/fontkit');
        // デフォルトエクスポートまたは名前付きエクスポートを確認
        fontkit = fontkitModule.default || fontkitModule;
        console.log('@pdf-lib/fontkitを読み込みました');
      } catch (error) {
        // @pdf-lib/fontkitが失敗した場合、通常のfontkitを試す
        try {
          // @ts-ignore
          const fontkitModule = await import('fontkit');
          fontkit = fontkitModule.default || fontkitModule;
          console.log('fontkitを読み込みました');
        } catch (error2) {
          console.warn('fontkitの読み込みに失敗しました:', error2);
          fontkit = null;
        }
      }
      
      // PDFテンプレートを読み込む
      const pdfBytes = await this.loadPdfTemplate(documentType);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // fontkitを登録（カスタムフォントを使用するために必要）
      // pdf-lib v1.17.1では、registerFontkitはPDFDocumentのインスタンスメソッドとして存在する
      if (fontkit) {
        // PDFDocumentのインスタンスに対してregisterFontkitを呼び出す
        if (typeof (pdfDoc as any).registerFontkit === 'function') {
          (pdfDoc as any).registerFontkit(fontkit);
          console.log('fontkitを登録しました');
        } else {
          console.warn('pdfDoc.registerFontkitが存在しません。');
          console.warn('日本語フォントは使用できませんが、英数字のみで続行します。');
          fontkit = null; // fontkitを使用しない
        }
      } else {
        console.warn('fontkitが読み込まれていません。カスタムフォントは使用できません。');
      }
      
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // フォントを取得または埋め込み
      let font: PDFFont;
      let hasJapaneseFont = false;
      
      try {
        // 日本語フォントを読み込む
        const japaneseFontBytes = await this.loadJapaneseFont();
        
        if (japaneseFontBytes && fontkit) {
          // 日本語フォントを埋め込む（pdf-libのembedFontはフォントファイルのバイト配列を受け取る）
          font = await pdfDoc.embedFont(japaneseFontBytes);
          hasJapaneseFont = true;
          console.log('日本語フォントを埋め込みました');
        } else {
          // 日本語フォントが存在しない、またはfontkitが読み込まれていない場合は標準フォントを使用
          font = await pdfDoc.embedFont('Helvetica');
          console.warn('日本語フォントが見つかりません。日本語文字は表示できません。');
          if (!fontkit) {
            console.warn('fontkitが読み込まれていません。');
          }
          if (!japaneseFontBytes) {
            console.warn('日本語フォントを使用する場合は、src/assets/fonts/NotoSansJP-Regular.ttf を配置してください。');
          }
        }
      } catch (error) {
        console.error('フォントの埋め込みに失敗しました:', error);
        // フォントの埋め込みに失敗した場合はデフォルトフォントを使用
        try {
          font = await pdfDoc.embedFont('Helvetica');
        } catch (fallbackError) {
          throw new Error('フォントの埋め込みに失敗しました。fontkitが正しく設定されているか確認してください。');
        }
      }

      // 文書タイプに応じて記入処理を実行
      switch (documentType) {
        case '健康保険・厚生年金保険被保険者資格取得届':
          this.fillQualificationAcquisitionForm(firstPage, font, employeeData, hasJapaneseFont);
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
   * 1. HRダッシュボードの「座標確認用PDFを生成」ボタンを使用
   * 2. 生成されたPDFで座標グリッドを確認
   * 3. 以下の座標を実際のPDFに合わせて調整
   */
  private fillQualificationAcquisitionForm(
    page: any,
    font: PDFFont,
    employeeData: any,
    hasJapaneseFont: boolean = false
  ) {
    const { width, height } = page.getSize();
    
    // 従業員データから必要な情報を取得
    const name = employeeData.name || '';
    const nameKana = employeeData.nameKana || '';
    const employeeNumber = employeeData.employeeNumber || '';
    const birthDate = this.formatDate(employeeData.birthDate);
    const address = employeeData.currentAddress || employeeData.address || '';
    const postalCode = this.formatPostalCode(employeeData.currentPostalCode || employeeData.postalCode || '');
    const phoneNumber = this.formatPhoneNumber(employeeData.phoneNumber || '');
    const joinDate = this.formatDate(employeeData.joinDate);
    const gender = employeeData.gender || '';
    
    // フォントサイズの設定
    const fontSize = 10;
    
    // TODO: 以下の座標は実際のPDFに合わせて調整してください
    // 座標確認用PDFを生成して、各フィールドの位置を確認してください
    
    // 氏名（例: x: 100, y: height - 200）
    // 日本語フォントがない場合は日本語文字をスキップ
    if (name && hasJapaneseFont) {
      page.drawText(name, {
        x: 100,  // 左からの距離（調整必要）
        y: height - 200,  // 下からの距離（調整必要）
        size: fontSize,
        font: font,
      });
    }
    
    // 氏名（カナ）（例: x: 100, y: height - 220）
    if (nameKana && hasJapaneseFont) {
      page.drawText(nameKana, {
        x: 100,  // 調整必要
        y: height - 220,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 生年月日（例: x: 100, y: height - 240）
    if (birthDate) {
      page.drawText(birthDate, {
        x: 100,  // 調整必要
        y: height - 240,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 性別（例: x: 100, y: height - 260）
    if (gender) {
      page.drawText(gender, {
        x: 100,  // 調整必要
        y: height - 260,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 郵便番号（例: x: 100, y: height - 280）
    if (postalCode) {
      page.drawText(postalCode, {
        x: 100,  // 調整必要
        y: height - 280,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 住所（例: x: 100, y: height - 300）
    if (address && hasJapaneseFont) {
      // 住所が長い場合は改行処理が必要な場合があります
      page.drawText(address, {
        x: 100,  // 調整必要
        y: height - 300,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 電話番号（例: x: 100, y: height - 320）
    if (phoneNumber) {
      page.drawText(phoneNumber, {
        x: 100,  // 調整必要
        y: height - 320,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 入社日（例: x: 100, y: height - 340）
    if (joinDate) {
      page.drawText(joinDate, {
        x: 100,  // 調整必要
        y: height - 340,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    // 社員番号（例: x: 100, y: height - 360）
    if (employeeNumber) {
      page.drawText(employeeNumber, {
        x: 100,  // 調整必要
        y: height - 360,  // 調整必要
        size: fontSize,
        font: font,
      });
    }
    
    console.log('被保険者資格取得届の記入処理を実行しました', {
      name,
      nameKana,
      employeeNumber,
      birthDate,
      address,
      postalCode,
      phoneNumber,
      joinDate,
      gender
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

