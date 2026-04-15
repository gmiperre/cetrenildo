const fs = require('node:fs');
const path = require('node:path');
const PdfPrinter = require('pdfmake');

function firstExistingPath(candidates) {
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function resolveFonts() {
  const cwd = process.cwd();
  const windowsFonts = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts');

  const regular = firstExistingPath([
    path.join(cwd, 'node_modules', 'pdfmake', 'fonts', 'Roboto-Regular.ttf'),
    path.join(cwd, 'node_modules', 'pdfmake', 'examples', 'fonts', 'Roboto-Regular.ttf'),
    path.join(windowsFonts, 'arial.ttf'),
  ]);

  const bold = firstExistingPath([
    path.join(cwd, 'node_modules', 'pdfmake', 'fonts', 'Roboto-Medium.ttf'),
    path.join(cwd, 'node_modules', 'pdfmake', 'examples', 'fonts', 'Roboto-Medium.ttf'),
    path.join(windowsFonts, 'arialbd.ttf'),
  ]);

  const italics = firstExistingPath([
    path.join(cwd, 'node_modules', 'pdfmake', 'fonts', 'Roboto-Italic.ttf'),
    path.join(cwd, 'node_modules', 'pdfmake', 'examples', 'fonts', 'Roboto-Italic.ttf'),
    path.join(windowsFonts, 'ariali.ttf'),
  ]);

  const bolditalics = firstExistingPath([
    path.join(cwd, 'node_modules', 'pdfmake', 'fonts', 'Roboto-MediumItalic.ttf'),
    path.join(cwd, 'node_modules', 'pdfmake', 'examples', 'fonts', 'Roboto-MediumItalic.ttf'),
    path.join(windowsFonts, 'arialbi.ttf'),
  ]);

  if (!regular || !bold || !italics || !bolditalics) {
    throw new Error(
      'Nao foi possivel localizar fontes TTF para o pdfmake. Defina fontes instaladas no sistema ou inclua arquivos TTF no projeto.'
    );
  }

  return {
    Roboto: {
      normal: regular,
      bold,
      italics,
      bolditalics,
    },
  };
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function formatMatriculaWithDV(matricula, dv) {
  const raw = onlyDigits(matricula);
  if (!raw && !dv) {
    return '';
  }

  if (dv) {
    return `${raw}-${String(dv).trim()}`;
  }

  if (raw.length > 1) {
    return `${raw.slice(0, -1)}-${raw.slice(-1)}`;
  }

  return raw;
}

function normalizeHHmm(value) {
  if (!value) {
    return '';
  }

  const input = String(value).trim();
  const match = input.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (!match) {
    return '';
  }

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return '';
  }

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function monthNamePtBR(monthIndex1to12) {
  const months = [
    'Janeiro',
    'Fevereiro',
    'Marco',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const idx = Number(monthIndex1to12) - 1;
  if (idx < 0 || idx > 11 || Number.isNaN(idx)) {
    return '';
  }
  return months[idx];
}

function ensure31Rows(registros) {
  const normalized = new Map();

  (registros ?? []).forEach((item) => {
    const dia = Number(item?.dia);
    if (Number.isNaN(dia) || dia < 1 || dia > 31) {
      return;
    }

    normalized.set(dia, {
      inicio: normalizeHHmm(item?.inicio),
      fim: normalizeHHmm(item?.fim),
    });
  });

  const rows = [];
  for (let dia = 1; dia <= 31; dia += 1) {
    const row = normalized.get(dia) ?? { inicio: '', fim: '' };
    rows.push({ dia, inicio: row.inicio, fim: row.fim, rubrica: '' });
  }
  return rows;
}

function buildMainTableBody(rows) {
  const body = [
    [
      { text: 'Dia', style: 'thCenter' },
      { text: 'Hora inicio', style: 'thCenter' },
      { text: 'Hora termino', style: 'thCenter' },
      { text: 'Rubrica', style: 'thCenter' },
    ],
  ];

  rows.forEach((row) => {
    body.push([
      { text: String(row.dia).padStart(2, '0'), style: 'tdCenter' },
      { text: row.inicio, style: 'tdCenter' },
      { text: row.fim, style: 'tdCenter' },
      { text: row.rubrica, style: 'tdCenter' },
    ]);
  });

  return body;
}

function buildOcorrenciasBody(ocorrencias) {
  const lines = Math.max((ocorrencias ?? []).length, 4);
  const body = [
    [
      { text: 'Dia', style: 'thCenter' },
      { text: 'Descricao', style: 'thCenter' },
      { text: 'Rubrica da chefia', style: 'thCenter' },
    ],
  ];

  for (let i = 0; i < lines; i += 1) {
    const row = ocorrencias?.[i];
    body.push([
      { text: row?.dia ? String(row.dia).padStart(2, '0') : '', style: 'tdCenter' },
      { text: row?.descricao ? String(row.descricao) : '', style: 'tdLeft' },
      { text: '', style: 'tdCenter' },
    ]);
  }

  return body;
}

function countResumo(registros) {
  const summary = {
    faltas: 0,
    faltasAbonadas: 0,
    atrasosAte60: 0,
    atrasosAcima60: 0,
  };

  (registros ?? []).forEach((r) => {
    const status = String(r?.status ?? '').toLowerCase();
    if (status === 'falta') {
      summary.faltas += 1;
    }
    if (status === 'falta_abonada' || status === 'fa') {
      summary.faltasAbonadas += 1;
    }
    if (status === 'atraso_ate_60' || status === 'a') {
      summary.atrasosAte60 += 1;
    }
    if (status === 'atraso_acima_60' || status === 'A') {
      summary.atrasosAcima60 += 1;
    }
  });

  return summary;
}

/**
 * Gera a folha de frequencia mensal em PDF (A4) usando pdfmake.
 *
 * @param {object} dados
 * @param {object} dados.usuario
 * @param {string} dados.usuario.nome
 * @param {string} dados.usuario.matricula
 * @param {string} [dados.usuario.dv]
 * @param {string} dados.usuario.cargo
 * @param {string} dados.usuario.regime
 * @param {string} dados.usuario.cargaHoraria
 * @param {string} [dados.usuario.horarioTrabalho]
 * @param {number} dados.mes - 1..12
 * @param {number} dados.ano
 * @param {Array<{dia:number,inicio?:string,fim?:string,status?:string}>} [dados.registros]
 * @param {Array<{dia:number,descricao:string}>} [dados.ocorrencias]
 * @param {object} [opts]
 * @param {string} [opts.setor]
 * @param {string} [opts.localizacao]
 * @param {string} [opts.codigoOrganizacional]
 * @param {string} [opts.outputPath] - Se informado, grava o PDF no disco
 * @returns {Promise<Buffer>}
 */
async function gerarFolhaFrequenciaPDF(dados, opts = {}) {
  const fonts = resolveFonts();
  const printer = new PdfPrinter(fonts);
  const setor = opts.setor ?? 'Pro-Reitoria de Graduacao / Departamento de Estagios e Bolsas';
  const localizacao = opts.localizacao ?? 'PR-1/CETREINA';
  const codigoOrganizacional = opts.codigoOrganizacional ?? '';

  const mes = monthNamePtBR(dados?.mes);
  const ano = String(dados?.ano ?? '');
  const rows = ensure31Rows(dados?.registros);
  const ocorrenciasBody = buildOcorrenciasBody(dados?.ocorrencias);
  const resumo = countResumo(dados?.registros);

  const matriculaDV = formatMatriculaWithDV(dados?.usuario?.matricula, dados?.usuario?.dv);
  const regimeTexto = (dados?.usuario?.regime ?? '').trim();
  const regimeOutros = regimeTexto ? `X (${regimeTexto})` : 'X';

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [24, 24, 24, 24],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
    },
    content: [
      { text: 'FOLHA DE FREQUENCIA MENSAL', style: 'title', margin: [0, 0, 0, 2] },
      {
        text: `Mes/Ano: ${mes}${mes ? ' / ' : ''}${ano}`,
        style: 'subtitle',
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: [110, '*', 110, '*'],
          body: [
            [
              { text: 'Setor', style: 'label' },
              { text: setor, style: 'value' },
              { text: 'Codigo org.', style: 'label' },
              { text: codigoOrganizacional, style: 'value' },
            ],
            [
              { text: 'Nome completo do servidor', style: 'label' },
              { text: dados?.usuario?.nome ?? '', style: 'value', colSpan: 3 },
              {},
              {},
            ],
            [
              { text: 'Matricula e DV', style: 'label' },
              { text: matriculaDV, style: 'value' },
              { text: 'Cargo', style: 'label' },
              { text: dados?.usuario?.cargo ?? '', style: 'value' },
            ],
            [
              { text: 'Horario de trabalho', style: 'label' },
              { text: dados?.usuario?.horarioTrabalho ?? '', style: 'value' },
              { text: 'Carga horaria semanal', style: 'label' },
              { text: dados?.usuario?.cargaHoraria ?? '', style: 'value' },
            ],
            [
              { text: 'Localizacao', style: 'label' },
              { text: localizacao, style: 'value' },
              { text: 'Regime de trabalho', style: 'label' },
              { text: `Outros: ${regimeOutros}`, style: 'value' },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          headerRows: 1,
          widths: [34, 92, 92, '*'],
          body: buildMainTableBody(rows),
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
        margin: [0, 0, 0, 8],
      },
      {
        text: 'INDICACOES DE ATIVIDADES EXTERNAS E OCORRENCIAS',
        style: 'sectionTitle',
        margin: [0, 0, 0, 4],
      },
      {
        table: {
          headerRows: 1,
          widths: [34, '*', 120],
          body: ocorrenciasBody,
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 8],
      },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: `Total de faltas (F): ${resumo.faltas}`, style: 'summary' },
              { text: `Total de faltas abonadas (Fa): ${resumo.faltasAbonadas}`, style: 'summary' },
            ],
            [
              { text: `Total de atrasos ate 60 min (a): ${resumo.atrasosAte60}`, style: 'summary' },
              { text: `Total de atrasos acima de 60 min (A): ${resumo.atrasosAcima60}`, style: 'summary' },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#000000',
          vLineColor: () => '#000000',
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [
              { text: 'Assinatura do servidor', style: 'signatureLabel' },
              { text: 'Assinatura da chefia imediata', style: 'signatureLabel' },
              { text: 'Assinatura do diretor', style: 'signatureLabel' },
            ],
            [
              { text: '', margin: [0, 20, 0, 0] },
              { text: '', margin: [0, 20, 0, 0] },
              { text: '', margin: [0, 20, 0, 0] },
            ],
          ],
        },
        layout: {
          hLineWidth: (i) => (i === 0 ? 0 : 0.8),
          vLineWidth: () => 0,
          hLineColor: () => '#000000',
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
    ],
    styles: {
      title: { bold: true, fontSize: 13, alignment: 'center' },
      subtitle: { bold: true, fontSize: 10, alignment: 'center' },
      sectionTitle: { bold: true, fontSize: 9, alignment: 'left' },
      label: { bold: true, fontSize: 8 },
      value: { fontSize: 8 },
      thCenter: { bold: true, alignment: 'center', fontSize: 8 },
      tdCenter: { alignment: 'center', fontSize: 8 },
      tdLeft: { alignment: 'left', fontSize: 8 },
      summary: { fontSize: 8 },
      signatureLabel: { alignment: 'center', fontSize: 8 },
    },
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];

  const buffer = await new Promise((resolve, reject) => {
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });

  if (opts.outputPath) {
    fs.writeFileSync(opts.outputPath, buffer);
  }

  return buffer;
}

module.exports = {
  gerarFolhaFrequenciaPDF,
};

if (require.main === module) {
  const exemplo = {
    mes: 4,
    ano: 2026,
    usuario: {
      nome: 'Servidor Exemplo',
      matricula: '12345678',
      dv: '9',
      cargo: 'Assistente Administrativo',
      regime: '40h semanais',
      cargaHoraria: '40h',
      horarioTrabalho: '08:00 as 17:00',
    },
    registros: [
      { dia: 1, inicio: '08:05', fim: '17:00', status: 'a' },
      { dia: 2, inicio: '08:00', fim: '17:00' },
      { dia: 3, inicio: '08:00', fim: '17:00' },
    ],
    ocorrencias: [
      { dia: 7, descricao: 'Reuniao externa no campus Maracana' },
      { dia: 15, descricao: 'Atendimento em evento institucional' },
    ],
  };

  const outputPath = path.join(process.cwd(), 'folha_frequencia_exemplo.pdf');
  gerarFolhaFrequenciaPDF(exemplo, { outputPath })
    .then(() => {
      process.stdout.write(`PDF gerado em: ${outputPath}\n`);
    })
    .catch((error) => {
      process.stderr.write(`Falha ao gerar PDF: ${error?.message ?? error}\n`);
      process.exitCode = 1;
    });
}
