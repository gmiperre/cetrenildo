import * as Print from 'expo-print';

import { FrequenciaRegistro } from '../models/frequencia';

type FolhaPdfInput = {
  usuario: {
    nome: string;
    email: string;
    horarioEntradaEsperado: string;
    horarioSaidaEsperado: string;
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
};

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatMonthLabel = (month: number, year: number) =>
  monthFormatter.format(new Date(year, month - 1, 1)).replace(/^./, (char) => char.toUpperCase());

const formatTime = (date: FrequenciaRegistro['horaEntrada'] | FrequenciaRegistro['horaSaida']) => {
  if (!date) {
    return '';
  }

  return date.toDate().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const buildRows = (records: FrequenciaRegistro[]) => {
  const byDay = new Map<number, FrequenciaRegistro>();
  records.forEach((record) => {
    const [, , dayRaw] = record.data.split('-');
    const day = Number(dayRaw);
    if (!Number.isNaN(day) && day >= 1 && day <= 31) {
      byDay.set(day, record);
    }
  });

  return Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const record = byDay.get(day);
    return {
      day,
      entrada: formatTime(record?.horaEntrada ?? null),
      saida: formatTime(record?.horaSaida ?? null),
      status: record?.status ?? '',
    };
  });
};

const buildHtml = (input: FolhaPdfInput) => {
  const rows = buildRows(input.registros)
    .map(
      (row) => `
        <tr>
          <td>${String(row.day).padStart(2, '0')}</td>
          <td>${escapeHtml(row.entrada)}</td>
          <td>${escapeHtml(row.saida)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td></td>
        </tr>`,
    )
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #1f2937;
            padding: 20px;
          }
          h1 {
            font-size: 18px;
            margin: 0 0 4px 0;
            text-align: center;
          }
          .subtitle {
            text-align: center;
            margin-bottom: 16px;
          }
          .meta {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          .meta td {
            border: 1px solid #111827;
            padding: 6px;
            vertical-align: top;
          }
          .meta-label {
            font-weight: bold;
            width: 24%;
          }
          table.grid {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
          }
          table.grid th,
          table.grid td {
            border: 1px solid #111827;
            padding: 4px;
            text-align: center;
          }
          table.grid th {
            background: #f3f4f6;
          }
          .summary {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .summary td {
            border: 1px solid #111827;
            padding: 6px;
          }
          .signatures {
            width: 100%;
            margin-top: 28px;
          }
          .signature-row {
            width: 100%;
            display: flex;
            gap: 24px;
            justify-content: space-between;
          }
          .signature-box {
            flex: 1;
            text-align: center;
            border-top: 1px solid #111827;
            padding-top: 6px;
          }
        </style>
      </head>
      <body>
        <h1>Folha de Frequência Mensal</h1>
        <div class="subtitle">${escapeHtml(formatMonthLabel(input.month, input.year))}</div>

        <table class="meta">
          <tr>
            <td class="meta-label">Servidor</td>
            <td>${escapeHtml(input.usuario.nome)}</td>
            <td class="meta-label">E-mail</td>
            <td>${escapeHtml(input.usuario.email)}</td>
          </tr>
          <tr>
            <td class="meta-label">Jornada esperada</td>
            <td>${escapeHtml(input.usuario.horarioEntradaEsperado)} às ${escapeHtml(input.usuario.horarioSaidaEsperado)}</td>
            <td class="meta-label">Período</td>
            <td>${String(input.month).padStart(2, '0')}/${input.year}</td>
          </tr>
        </table>

        <table class="grid">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Entrada</th>
              <th>Saída</th>
              <th>Status</th>
              <th>Rubrica</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <table class="summary">
          <tr>
            <td>Dias com registro: ${input.resumo.diasComRegistro}</td>
            <td>Presenças: ${input.resumo.presentes}</td>
            <td>Faltas: ${input.resumo.faltas}</td>
          </tr>
          <tr>
            <td>Faltas justificadas: ${input.resumo.faltasJustificadas}</td>
            <td>Abonos: ${input.resumo.abonos}</td>
            <td>Presenças contestadas: ${input.resumo.presencasContestadas}</td>
          </tr>
        </table>

        <div class="signature-row">
          <div class="signature-box">Assinatura do funcionário</div>
          <div class="signature-box">Assinatura da chefia</div>
        </div>
      </body>
    </html>`;
};

export const folhaPdfService = {
  async generateFolhaMensalPdf(input: FolhaPdfInput) {
    const html = buildHtml(input);
    const result = await Print.printToFileAsync({ html, base64: false });
    return result.uri;
  },
};