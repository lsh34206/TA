import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { kstDateString, kstDateTimeString, weekday } from '../common/kst.js';
import type { Application, User } from '../store/types.js';
import { STATUS_LABEL, TYPE_LABEL } from './application.labels.js';

const FONT_DIR = join(import.meta.dirname, '../../assets/fonts');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const PAGE_MARGIN = 56;
const LABEL_WIDTH = 110;
const BORDER = '#adb5bd';
const LABEL_BG = '#f1f3f5';
const TEXT = '#212529';
const MUTED = '#868e96';

export interface ApplicationPdfData {
  application: Application;
  applicant: User;
  decidedBy: User | null;
  printedAt: Date;
}

/** FN-REQ-03 신청서 PDF (A4 한 장, 고정 양식) */
@Injectable()
export class ApplicationPdfService {
  render({ application: app, applicant, decidedBy, printedAt }: ApplicationPdfData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: { Title: `근태 신청서 #${app.id}`, Author: '근태관리 시스템' },
    });
    doc.registerFont('regular', join(FONT_DIR, 'Pretendard-Regular.otf'));
    doc.registerFont('bold', join(FONT_DIR, 'Pretendard-Bold.otf'));

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const tableWidth = doc.page.width - PAGE_MARGIN * 2;
    const valueWidth = tableWidth - LABEL_WIDTH;

    const row = (label: string, value: string, height = 34) => {
      const y = doc.y;
      doc.rect(PAGE_MARGIN, y, LABEL_WIDTH, height).fillAndStroke(LABEL_BG, BORDER);
      doc.rect(PAGE_MARGIN + LABEL_WIDTH, y, valueWidth, height).stroke(BORDER);
      doc.fillColor(TEXT).font('bold').fontSize(10.5);
      doc.text(label, PAGE_MARGIN + 12, y + (height - 13) / 2, { width: LABEL_WIDTH - 24 });
      doc.font('regular');
      const multiline = height > 40;
      doc.text(value, PAGE_MARGIN + LABEL_WIDTH + 12, multiline ? y + 12 : y + (height - 13) / 2, {
        width: valueWidth - 24,
        height: height - 20,
      });
      doc.y = y + height;
    };

    // 제목
    doc.font('bold').fontSize(24).fillColor(TEXT);
    doc.text('근태 신청서', PAGE_MARGIN, 64, { width: tableWidth, align: 'center' });
    doc.font('regular').fontSize(10).fillColor(MUTED);
    doc.text(`신청번호 ${String(app.id).padStart(6, '0')}`, PAGE_MARGIN, 100, {
      width: tableWidth,
      align: 'right',
    });
    doc.y = 124;

    // 신청 내용
    const targetDate = app.targetDate;
    row('신청자', `${applicant.name} (${applicant.loginId})`);
    row('신청 구분', TYPE_LABEL[app.type]);
    row('대상 일자', `${targetDate} (${WEEKDAYS[weekday(targetDate)]})`);
    if (app.startTime && app.endTime) row('근무 시간대', `${app.startTime} ~ ${app.endTime}`);
    if (app.ip) row('접속 IP', app.ip);
    row('사유', app.reason ?? '', 110);
    row('신청 일시', kstDateTimeString(new Date(app.createdAt)));

    // 처리 결과
    row('처리 상태', STATUS_LABEL[app.status]);
    if (app.decidedAt) {
      const by = decidedBy ? `${decidedBy.name} · ` : '';
      row('처리 일시', `${by}${kstDateTimeString(new Date(app.decidedAt))}`);
    }
    if (app.decisionNote) row('처리 의견', app.decisionNote, 60);

    // 서명란
    const todayText = kstDateString(printedAt).replace(
      /(\d{4})-(\d{2})-(\d{2})/,
      (_, y, m, d) => `${y}년 ${Number(m)}월 ${Number(d)}일`,
    );
    doc.font('regular').fontSize(11).fillColor(TEXT);
    doc.text('위와 같이 신청합니다.', PAGE_MARGIN, doc.y + 36, { width: tableWidth, align: 'center' });
    doc.text(todayText, PAGE_MARGIN, doc.y + 8, { width: tableWidth, align: 'center' });

    const boxTop = doc.y + 28;
    const boxWidth = (tableWidth - 20) / 2;
    const signature = (x: number, title: string, name: string) => {
      doc.rect(x, boxTop, boxWidth, 84).stroke(BORDER);
      doc.rect(x, boxTop, boxWidth, 24).fillAndStroke(LABEL_BG, BORDER);
      doc.fillColor(TEXT).font('bold').fontSize(10.5);
      doc.text(title, x, boxTop + 6, { width: boxWidth, align: 'center' });
      doc.font('regular').fontSize(10.5);
      doc.text(name, x, boxTop + 58, { width: boxWidth, align: 'center' });
    };
    signature(PAGE_MARGIN, '신청자', `${applicant.name} (인)`);
    signature(
      PAGE_MARGIN + boxWidth + 20,
      '리드 확인',
      app.status === 'APPROVED' && decidedBy ? `${decidedBy.name} (인)` : '',
    );

    // 하단
    doc.font('regular').fontSize(8.5).fillColor(MUTED);
    doc.text(`출력 일시 ${kstDateTimeString(printedAt)}`, PAGE_MARGIN, doc.page.height - 84, {
      width: tableWidth,
      align: 'right',
    });

    doc.end();
    return finished;
  }
}
