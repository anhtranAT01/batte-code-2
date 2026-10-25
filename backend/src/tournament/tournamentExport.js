/**
 * Tournament Export Module
 * Generates styled .xlsx and .csv reports for school competitions
 */

const ExcelJS = require('exceljs');

/**
 * Generate Excel (.xlsx) workbook buffer for tournament results
 * @param {Object} tournament - Tournament details
 * @param {Array<Object>} standings - Array of participant performance metrics
 * @returns {Promise<Buffer>}
 */
async function generateTournamentExcel(tournament, standings = []) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Tactical RPS Arena System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Bảng Xếp Hạng Giải Đấu', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  // 1. Title Banner
  worksheet.mergeCells('A1:O1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `BÁO CÁO KẾT QUẢ: ${tournament.name.toUpperCase()}`;
  titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 36;

  // 2. Metadata Subtitle
  worksheet.mergeCells('A2:O2');
  const metaCell = worksheet.getCell('A2');
  metaCell.value = `Trạng thái: ${tournament.status} | Tổng thí sinh: ${standings.length} | Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`;
  metaCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
  metaCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  worksheet.addRow([]); // Blank row 3

  // 3. Define Header Columns
  const headers = [
    { header: 'Hạng', key: 'rank', width: 8 },
    { header: 'Tài Khoản', key: 'username', width: 22 },
    { header: 'Đội / Team', key: 'teamName', width: 20 },
    { header: 'Tên Bot AI', key: 'botName', width: 22 },
    { header: 'Điểm Giải Đấu', key: 'points', width: 15 },
    { header: 'Điểm Elo', key: 'elo', width: 12 },
    { header: 'Thay Đổi Elo', key: 'eloDelta', width: 14 },
    { header: 'Tổng Trận', key: 'matchesPlayed', width: 12 },
    { header: 'Thắng', key: 'wins', width: 10 },
    { header: 'Thua', key: 'losses', width: 10 },
    { header: 'Hòa', key: 'draws', width: 10 },
    { header: 'Tỷ Lệ Thắng', key: 'winRate', width: 14 },
    { header: 'TG Thắng TB (ms)', key: 'avgWinDurationMs', width: 18 },
    { header: 'Số Lượt TB', key: 'avgTurns', width: 14 },
    { header: 'Lỗi Vòng Lặp (Loop)', key: 'infiniteLoopErrors', width: 20 },
    { header: 'Trạng Thái Bot', key: 'botStatus', width: 16 },
  ];

  const headerRow = worksheet.addRow(headers.map((h) => h.header));
  headerRow.height = 26;

  // Style Header Row
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Royal Blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // 4. Fill Data Rows
  standings.forEach((st, idx) => {
    const row = worksheet.addRow([
      idx + 1,
      st.username,
      st.teamName || '—',
      st.botName || 'Chưa nộp Bot',
      st.points,
      st.elo,
      st.eloDelta > 0 ? `+${st.eloDelta}` : st.eloDelta,
      st.matchesPlayed,
      st.wins,
      st.losses,
      st.draws,
      `${st.winRate}%`,
      st.avgWinDurationMs || 0,
      st.avgTurns || 0,
      st.infiniteLoopErrors > 0 ? `${st.infiniteLoopErrors} lần (CẢNH BÁO)` : 'Không',
      st.botStatus || 'active',
    ]);

    row.height = 22;

    // Apply zebra striping & borders
    const isEven = idx % 2 === 0;
    const bgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 10 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 || colNumber === 3 ? 'left' : 'center' };
    });

    // Top 3 Medal Highlighting
    if (idx === 0) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Gold
    } else if (idx === 1) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Silver
    } else if (idx === 2) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }; // Bronze
    }

    // Highlight infinite loop errors in Red
    if (st.infiniteLoopErrors > 0) {
      const errCell = row.getCell(14);
      errCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFDC2626' } };
      errCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    }
  });

  // Set individual column widths
  headers.forEach((h, index) => {
    worksheet.getColumn(index + 1).width = h.width;
  });

  return await workbook.xlsx.writeBuffer();
}

/**
 * Generate CSV string with UTF-8 BOM for flawless Excel display in Vietnamese
 * @param {Object} tournament
 * @param {Array<Object>} standings
 * @returns {string}
 */
function generateTournamentCSV(tournament, standings = []) {
  const headers = [
    'Hạng',
    'Tên Tài Khoản',
    'Đội / Team',
    'Tên Bot AI',
    'Điểm Giải Đấu',
    'Điểm Elo',
    'Thay Đổi Elo',
    'Tổng Số Trận',
    'Trận Thắng',
    'Trận Thua',
    'Trận Hòa',
    'Tỷ Lệ Thắng (%)',
    'Thời Gian Thắng TB (ms)',
    'Số Lượt TB',
    'Lỗi Vòng Lặp Vô Hạn',
    'Trạng Thái Bot',
  ];

  const rows = standings.map((st, idx) => [
    idx + 1,
    `"${st.username}"`,
    `"${st.teamName || '—'}"`,
    `"${st.botName || 'Chưa nộp Bot'}"`,
    st.points,
    st.elo,
    st.eloDelta,
    st.matchesPlayed,
    st.wins,
    st.losses,
    st.draws,
    st.winRate,
    st.avgWinDurationMs || 0,
    st.avgTurns || 0,
    st.infiniteLoopErrors,
    `"${st.botStatus || 'active'}"`,
  ]);

  // Prepend UTF-8 BOM (\uFEFF)
  const csvContent =
    '\uFEFF' +
    [
      `"BÁO CÁO GIẢI ĐẤU: ${tournament.name}"`,
      `"Thời gian xuất: ${new Date().toLocaleString('vi-VN')}"`,
      '',
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\r\n');

  return csvContent;
}

module.exports = {
  generateTournamentExcel,
  generateTournamentCSV,
};
