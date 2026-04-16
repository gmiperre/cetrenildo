import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import { CalendarDay } from '../models/calendar';
import { FrequenciaRegistro } from '../models/frequencia';

type FolhaPdfInput = {
  usuario: {
    nome: string;
    email: string;
    horarioEntradaEsperado: string;
    horarioSaidaEsperado: string;
    matricula?: string | null;
    cargo?: string | null;
    cargaHoraria?: string | null;
  };
  month: number;
  year: number;
  registros: FrequenciaRegistro[];
  resumo: {
    diasComRegistro: number;
    presentes: number;
    faltas: number;
    faltasJustificadas: number;
    abonos: number;
    presencasContestadas: number;
  };
  calendarPolicies?: Record<string, CalendarDay>;
};

const templateAsset = Asset.fromModule(require('../../modelo_frequencia.pdf'));

const MONTH_NAMES_PT = [
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
];

const LEFT_START_COL_X = 96.6;
const LEFT_END_COL_X = 205.2;
const LEFT_RUBRIC_COL_X = 286.0;

const RIGHT_START_COL_X = 358.8;
const RIGHT_END_COL_X = 472.2;
const RIGHT_RUBRIC_COL_X = 551.0;

const DAILY_TOP = 411.66;
const DAILY_ROW_HEIGHT = 19.44;

const OCORRENCIAS_TOP = 601;
const OCORRENCIAS_ROW_HEIGHT = 11.2;
const OCORRENCIAS_MAX_ROWS = 31;

const readTemplateBase64 = async () => {
  if (!templateAsset.localUri) {
    await templateAsset.downloadAsync();
  }

  const uri = templateAsset.localUri ?? templateAsset.uri;
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
};

const safeValue = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : '-';
};

const parseMatricula = (matricula: string | null | undefined) => {
  const digits = (matricula ?? '').replace(/\D/g, '');
  if (!digits) {
    return { numero: '-', dv: '-' };
  }

  if (digits.length <= 2) {
    return { numero: digits, dv: '-' };
  }

  return {
    numero: digits.slice(0, -2),
    dv: digits.slice(-2),
  };
};

const formatTime = (value: FrequenciaRegistro['horaEntrada'] | FrequenciaRegistro['horaSaida']) => {
  if (!value) {
    return '';
  }

  return value.toDate().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export const folhaPdfService = {
  async generateFolhaMensalPdf(input: FolhaPdfInput) {
    const templateBase64 = await readTemplateBase64();
    const pdfDoc = await PDFDocument.load(templateBase64);
    const page = pdfDoc.getPage(0);

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    const yFromTop = (top: number, fontSize: number) => height - top - fontSize;

    const drawText = (
      text: string,
      x: number,
      top: number,
      fontSize = 8,
      isBold = false,
    ) => {
      page.drawText(text, {
        x,
        y: yFromTop(top, fontSize),
        size: fontSize,
        font: isBold ? boldFont : font,
        color: rgb(0, 0, 0),
      });
    };

    const drawCentered = (
      text: string,
      leftX: number,
      rightX: number,
      top: number,
      fontSize = 8,
      isBold = false,
    ) => {
      const useFont = isBold ? boldFont : font;
      const textWidth = useFont.widthOfTextAtSize(text, fontSize);
      const x = leftX + Math.max(0, (rightX - leftX - textWidth) / 2);
      drawText(text, x, top, fontSize, isBold);
    };

    const nomeMes = MONTH_NAMES_PT[input.month - 1] ?? '-';
    const matricula = parseMatricula(input.usuario.matricula);

    drawText(nomeMes, 274.08, 198.8, 12, true);
    drawText(String(input.year), 360.0, 198.8, 12, true);

    drawText('PRO-REITORIA DE GRADUACAO / DEPARTAMENTO DE ESTAGIOS E BOLSAS', 36.48, 227.22, 8);
    drawText(safeValue(input.usuario.nome), 36.48, 248.94, 8);
    drawText(matricula.numero, 451.44, 248.94, 8);
    drawText(matricula.dv, 517.08, 248.94, 8);
    drawText(safeValue(input.usuario.cargo), 36.48, 271.02, 8);

    drawText('PR-1/CETREINA', 36.48, 294.42, 8);
    drawText('X', 342.0, 294.0, 9, true);
    drawText(`${safeValue(input.usuario.horarioEntradaEsperado)} as ${safeValue(input.usuario.horarioSaidaEsperado)}`, 451.44, 271.02, 8);
    drawText(safeValue(input.usuario.cargaHoraria), 451.44, 294.42, 8);

    const recordsByDay = new Map<number, FrequenciaRegistro>();
    input.registros.forEach((record) => {
      const day = Number(record.data.split('-')[2]);
      if (!Number.isNaN(day) && day >= 1 && day <= 31) {
        recordsByDay.set(day, record);
      }
    });

    const lastDayOfMonth = new Date(input.year, input.month, 0).getDate();

    const drawDailyCell = (day: number, rowTop: number, isRight: boolean) => {
      if (day > lastDayOfMonth) {
        return;
      }

      const key = toDateKey(input.year, input.month, day);
      const policy = input.calendarPolicies?.[key];
      const weekday = new Date(input.year, input.month - 1, day).getDay();
      const isNonWork = weekday === 0 || weekday === 6 || policy?.tipo === 'feriado' || policy?.tipo === 'ponto_facultativo' || policy?.tipo === 'sem_expediente';
      const record = recordsByDay.get(day);

      const startX = isRight ? RIGHT_START_COL_X : LEFT_START_COL_X;
      const endX = isRight ? RIGHT_END_COL_X : LEFT_END_COL_X;
      const rubricX = isRight ? RIGHT_RUBRIC_COL_X : LEFT_RUBRIC_COL_X;

      if (isNonWork) {
        return;
      }

      if (!record) {
        return;
      }

      if (record.status === 'presente') {
        const entrada = formatTime(record.horaEntrada);
        const saida = formatTime(record.horaSaida);
        drawText(entrada, startX, rowTop, 8);
        drawText(saida, endX, rowTop, 8);
      } else {
        drawCentered('---', startX, endX, rowTop, 8, true);
        drawCentered('---', endX, rubricX, rowTop, 8, true);
      }
    };

    for (let row = 0; row < 16; row += 1) {
      const rowTop = DAILY_TOP + row * DAILY_ROW_HEIGHT;
      const leftDay = row + 1;
      const rightDay = row + 17;

      drawDailyCell(leftDay, rowTop, false);
      drawDailyCell(rightDay, rowTop, true);
    }

    const ocorrencias = input.registros
      .filter((r) => !!r.justificativaTexto?.trim())
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, OCORRENCIAS_MAX_ROWS);

    ocorrencias.forEach((record, idx) => {
      const rowTop = OCORRENCIAS_TOP + idx * OCORRENCIAS_ROW_HEIGHT;
      const day = Number(record.data.split('-')[2]);
      drawCentered(String(day).padStart(2, '0'), 38, 86, rowTop, 7.2, true);

      const raw = record.justificativaTexto?.trim() ?? '';
      const descricao = raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
      drawText(descricao, 96, rowTop, 7.1);
    });

    const outputBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
    const outputUri = `${FileSystem.cacheDirectory}folha-frequencia-${input.year}-${String(input.month).padStart(2, '0')}-${Date.now()}.pdf`;

    await FileSystem.writeAsStringAsync(outputUri, outputBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputUri;
  },
};
