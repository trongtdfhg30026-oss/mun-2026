const XLSX = require('xlsx');

function generateExcelWorkbook(db, teamsByGrade, topics, gradeFilter) {
  const wb = XLSX.utils.book_new();
  const grades = gradeFilter && gradeFilter !== 'all' ? [gradeFilter] : Object.keys(teamsByGrade);
  const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' });

  // Sheet 1: SUMMARY_STANDINGS
  const summaryRows = [];
  summaryRows.push(['OFFICIAL AUDIT EVIDENCE & RESULTS SUMMARY - SENIOR MODEL UNITED NATIONS (MUN SENIOR)']);
  summaryRows.push(['Generated At:', nowStr, 'Theme:', 'We live differently, but we have the same hope.']);
  summaryRows.push([]);
  summaryRows.push([
    'Grade Level', 'Rank', 'Country Delegation', 'Mentor', 'Delegates',
    'Evaluations Count', 'Preparation (/3)', 'Speaking (/3)', 'Vocabulary (/3)',
    'Teamwork (/3)', 'Active Q&A (/3)', 'Base Score (/15)',
    'Advanced Bonus (+5)', 'TOTAL JUDGE SCORE (/20)',
    'Topic 1 Votes (Climate)', 'Topic 2 Votes (Education)', 'Topic 3 Votes (Health)',
    'TOTAL STUDENT VOTES', 'Judge Commendations & Constructive Feedback'
  ]);

  grades.forEach(g => {
    const isJunior = !['Grade 7', 'Grade 8', 'Grade 10', 'Grade 11'].includes(g);
    const teams = teamsByGrade[g] || [];
    const gScores = db.judgeScores.filter(s => s.grade === g);
    const gBallots = db.studentVotes.filter(v => v.grade === g);

    const teamStats = teams.map(t => {
      const tScores = gScores.filter(s => s.countryId === t.id);
      const count = tScores.length;

      let pSum = 0, spkSum = 0, vSum = 0, tmSum = 0, qSum = 0, baseSum = 0, bonusCount = 0, totalSum = 0;
      const comments = [];

      tScores.forEach(s => {
        pSum += (s.scores ? s.scores.preparation || 0 : 0);
        spkSum += (s.scores ? s.scores.speaking || 0 : 0);
        vSum += (s.scores ? s.scores.vocabulary || 0 : 0);
        tmSum += (s.scores ? s.scores.teamwork || 0 : 0);
        qSum += (s.scores ? s.scores.qna || 0 : 0);
        baseSum += (s.baseScore || 0);
        if (s.advancedBonus) bonusCount++;
        totalSum += (s.totalScore || 0);
        if (s.comments && s.comments.trim()) comments.push(s.judgeName + ': ' + s.comments.trim());
      });

      const isJunior = !['Grade 7', 'Grade 8', 'Grade 10', 'Grade 11'].includes(g);
      let cVotes = 0, eVotes = 0, hVotes = 0, favVotes = 0;
      gBallots.forEach(b => {
        const tv = b.topicVotes || {};
        if (Array.isArray(tv.climate) && tv.climate.includes(t.id)) cVotes++;
        if (Array.isArray(tv.education) && tv.education.includes(t.id)) eVotes++;
        if (Array.isArray(tv.health) && tv.health.includes(t.id)) hVotes++;
        if (Array.isArray(tv.favorites) && tv.favorites.includes(t.id)) favVotes++;
      });
      const totVotes = isJunior ? (favVotes || cVotes) : (cVotes + eVotes + hVotes);

      return {
        grade: g,
        name: t.name,
        mentor: t.mentor || '',
        delegates: Array.isArray(t.delegates) ? t.delegates.join(', ') : (t.delegates || ''),
        count,
        avgPrep: count ? Number((pSum / count).toFixed(2)) : 0,
        avgSpk: count ? Number((spkSum / count).toFixed(2)) : 0,
        avgVocab: count ? Number((vSum / count).toFixed(2)) : 0,
        avgTeam: count ? Number((tmSum / count).toFixed(2)) : 0,
        avgQna: count ? Number((qSum / count).toFixed(2)) : 0,
        avgBase: count ? Number((baseSum / count).toFixed(2)) : 0,
        bonusCount,
        avgTotal: count ? Number((totalSum / count).toFixed(2)) : 0,
        cVotes,
        eVotes,
        hVotes,
        totVotes, isJunior,
        commentsStr: comments.join(' | ')
      };
    });

    teamStats.sort((a, b) => b.avgTotal - a.avgTotal);
    for (let i = 0; i < teamStats.length; i++) {
      if (i > 0 && teamStats[i].avgTotal === teamStats[i - 1].avgTotal) {
        teamStats[i].rank = teamStats[i - 1].rank;
      } else {
        teamStats[i].rank = i + 1;
      }
    }

    teamStats.forEach(ts => {
      summaryRows.push([
        ts.grade,
        ts.avgTotal > 0 ? ('Rank ' + ts.rank) : 'Pending',
        ts.name,
        ts.mentor,
        ts.delegates,
        ts.count,
        ts.avgPrep,
        ts.avgSpk,
        ts.avgVocab,
        ts.avgTeam,
        ts.avgQna,
        ts.avgBase,
        ts.bonusCount > 0 ? ('YES (+' + (ts.isJunior ? (ts.bonusCount * 2) : (ts.bonusCount * 5)) + ' pts)') : 'None (0)',
        ts.avgTotal + (ts.isJunior ? '/10' : '/20'),
        ts.cVotes,
        ts.eVotes,
        ts.hVotes,
        ts.totVotes,
        ts.commentsStr
      ]);
    });

    summaryRows.push([]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 35 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 45 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'SUMMARY_STANDINGS');

  // Sheet 2: RAW_JUDGE_SCORECARDS
  const judgeRows = [
    ['INDIVIDUAL JUDGE EVALUATION AUDIT TRAIL (RAW SUBMISSIONS)'],
    ['Evaluation ID', 'Timestamp', 'Judge Name', 'Grade Level', 'Country Delegation', 'Prep (/3)', 'Speaking (/3)', 'Vocabulary (/3)', 'Teamwork (/3)', 'Active Q&A (/3)', 'Base Score (/15)', 'Advanced Bonus (+5)', 'Total Score (/20)', 'Judge Notes & Feedback']
  ];

  const filteredScores = gradeFilter && gradeFilter !== 'all' ? db.judgeScores.filter(s => s.grade === gradeFilter) : db.judgeScores;
  filteredScores.forEach(s => {
    const teams = teamsByGrade[s.grade] || [];
    const countryName = (teams.find(t => t.id === s.countryId) || {}).name || s.countryId;
    judgeRows.push([
      s.id,
      new Date(s.timestamp || Date.now()).toLocaleString('en-US'),
      s.judgeName || '(Unspecified Judge)',
      s.grade,
      countryName,
      s.scores ? s.scores.preparation : 0,
      s.scores ? s.scores.speaking : 0,
      s.scores ? s.scores.vocabulary : 0,
      s.scores ? s.scores.teamwork : 0,
      s.scores ? s.scores.qna : 0,
      s.baseScore,
      s.advancedBonus ? '+5 Points' : '0',
      s.totalScore,
      s.comments || ''
    ]);
  });
  const wsJudge = XLSX.utils.aoa_to_sheet(judgeRows);
  wsJudge['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 18 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 15 }, { wch: 20 }, { wch: 14 }, { wch: 40 }
  ];
  XLSX.utils.book_append_sheet(wb, wsJudge, 'JUDGE_EVALUATIONS');

  // Sheet 3: RAW_STUDENT_BALLOTS
  const studentRows = [
    ['STUDENT PEER DELEGATION BALLOTS AUDIT TRAIL'],
    ['Ballot ID', 'Timestamp', 'Grade Level', 'Voter Country', 'Delegates', 'Topic 1 Selection (Climate)', 'Topic 2 Selection (Education)', 'Topic 3 Selection (Health)']
  ];

  const filteredBallots = gradeFilter && gradeFilter !== 'all' ? db.studentVotes.filter(v => v.grade === gradeFilter) : db.studentVotes;
  filteredBallots.forEach(b => {
    const teams = teamsByGrade[b.grade] || [];
    const voterName = (teams.find(t => t.id === b.voterCountry) || {}).name || b.voterCountry;
    const tv = b.topicVotes || {};

    const resolveNames = (ids) => {
      if (!Array.isArray(ids)) return '';
      return ids.map(id => (teams.find(t => t.id === id) || {}).name || id).join(' & ');
    };

    studentRows.push([
      b.id,
      new Date(b.timestamp || Date.now()).toLocaleString('en-US'),
      b.grade,
      voterName,
      b.delegates || '',
      resolveNames(tv.climate),
      resolveNames(tv.education),
      resolveNames(tv.health)
    ]);
  });

  const wsStudent = XLSX.utils.aoa_to_sheet(studentRows);
  wsStudent['!cols'] = [
    { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 30 },
    { wch: 30 }, { wch: 30 }, { wch: 30 }
  ];
  XLSX.utils.book_append_sheet(wb, wsStudent, 'STUDENT_BALLOTS');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function generateVisualHtmlReport(db, teamsByGrade, topics, gradeFilter) {
  const grades = gradeFilter && gradeFilter !== 'all' ? [gradeFilter] : Object.keys(teamsByGrade);
  const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium' });

  let gradesHtml = '';

  grades.forEach(g => {
    const isJunior = !['Grade 7', 'Grade 8', 'Grade 10', 'Grade 11'].includes(g);
    const teams = teamsByGrade[g] || [];
    const gScores = db.judgeScores.filter(s => s.grade === g);
    const gBallots = db.studentVotes.filter(v => v.grade === g);

    const teamStats = teams.map(t => {
      const tScores = gScores.filter(s => s.countryId === t.id);
      const count = tScores.length;

      let pSum = 0, spkSum = 0, vSum = 0, tmSum = 0, qSum = 0, baseSum = 0, bonusCount = 0, totalSum = 0;
      const comments = [];

      tScores.forEach(s => {
        pSum += (s.scores ? s.scores.preparation || 0 : 0);
        spkSum += (s.scores ? s.scores.speaking || 0 : 0);
        vSum += (s.scores ? s.scores.vocabulary || 0 : 0);
        tmSum += (s.scores ? s.scores.teamwork || 0 : 0);
        qSum += (s.scores ? s.scores.qna || 0 : 0);
        baseSum += (s.baseScore || 0);
        if (s.advancedBonus) bonusCount++;
        totalSum += (s.totalScore || 0);
        if (s.comments && s.comments.trim()) comments.push(s.judgeName + ': ' + s.comments.trim());
      });

      let cVotes = 0, eVotes = 0, hVotes = 0;
      gBallots.forEach(b => {
        const tv = b.topicVotes || {};
        if (Array.isArray(tv.climate) && tv.climate.includes(t.id)) cVotes++;
        if (Array.isArray(tv.education) && tv.education.includes(t.id)) eVotes++;
        if (Array.isArray(tv.health) && tv.health.includes(t.id)) hVotes++;
      });

      return {
        id: t.id,
        name: t.name,
        flag: t.flag,
        mentor: t.mentor || '',
        delegates: Array.isArray(t.delegates) ? t.delegates.join(', ') : (t.delegates || ''),
        count,
        avgPrep: count ? (pSum / count).toFixed(1) : 0,
        avgSpk: count ? (spkSum / count).toFixed(1) : 0,
        avgVocab: count ? (vSum / count).toFixed(1) : 0,
        avgTeam: count ? (tmSum / count).toFixed(1) : 0,
        avgQna: count ? (qSum / count).toFixed(1) : 0,
        avgBase: count ? (baseSum / count).toFixed(1) : 0,
        bonusCount,
        avgTotal: count ? Number((totalSum / count).toFixed(2)) : 0,
        cVotes,
        eVotes,
        hVotes,
        totVotes: cVotes + eVotes + hVotes,
        comments
      };
    });

    teamStats.sort((a, b) => b.avgTotal - a.avgTotal);
    for (let i = 0; i < teamStats.length; i++) {
      if (i > 0 && teamStats[i].avgTotal === teamStats[i - 1].avgTotal) {
        teamStats[i].rank = teamStats[i - 1].rank;
      } else {
        teamStats[i].rank = i + 1;
      }
    }

    const rows = teamStats.map(ts => {
      let badge = '';
      if (ts.rank === 1 && ts.avgTotal > 0) badge = '<span class="rank-badge gold">&#129351; 1ST PLACE</span>';
      else if (ts.rank === 2 && ts.avgTotal > 0) badge = '<span class="rank-badge silver">&#129352; 2ND PLACE</span>';
      else if (ts.rank === 3 && ts.avgTotal > 0) badge = '<span class="rank-badge bronze">&#129353; 3RD PLACE</span>';
      else if (ts.avgTotal > 0) badge = '<span class="rank-badge normal">Rank ' + ts.rank + '</span>';
      else badge = '<span class="rank-badge pending">Pending</span>';

      return '<tr>' +
        '<td style="text-align: center;">' + badge + '</td>' +
        '<td><div style="display:flex;align-items:center;gap:8px;"><img src="' + ts.flag + '" style="width:28px;height:18px;border:1px solid #cbd5e1;border-radius:2px;object-fit:cover;"><strong>' + ts.name + '</strong></div></td>' +
        '<td>' + ts.mentor + '</td>' +
        '<td style="font-size:11px;color:#475569;">' + ts.delegates + '</td>' +
        '<td style="text-align:center;">' + ts.avgPrep + '</td>' +
        '<td style="text-align:center;">' + ts.avgSpk + '</td>' +
        '<td style="text-align:center;">' + ts.avgVocab + '</td>' +
        '<td style="text-align:center;">' + ts.avgTeam + '</td>' +
        '<td style="text-align:center;">' + ts.avgQna + '</td>' +
        '<td style="text-align:center;font-weight:600;">' + ts.avgBase + (isJunior ? '/8' : '/15') + '</td>' +
        '<td style="text-align:center;color:#b45309;font-weight:600;">' + (ts.bonusCount > 0 ? ('+' + (isJunior ? 2 : 5)) : '0') + '</td>' +
        '<td style="text-align:center;font-size:15px;font-weight:800;color:#0f172a;background:#f8fafc;">' + ts.avgTotal + (isJunior ? ' <span style="font-size:10px;color:#64748b;">/10</span>' : ' <span style="font-size:10px;color:#64748b;">/20</span>') + '</td>' +
        '<td style="text-align:center;color:#0284c7;font-weight:700;">' + ts.totVotes + '</td>' +
        '<td style="font-size:11px;color:#64748b;max-width:220px;">' + (ts.comments.join('<br>') || '—') + '</td>' +
      '</tr>';
    }).join('');

    gradesHtml += '<div class="grade-section">' +
      '<div class="grade-header">' +
        '<h3>OFFICIAL AUDIT & SCORE SUMMARY: ' + g.toUpperCase() + '</h3>' +
        '<span class="badge-total">Total Delegations: ' + teams.length + ' | Evaluations: ' + gScores.length + ' | Student Ballots: ' + gBallots.length + '</span>' +
      '</div>' +
      '<table class="report-table">' +
        '<thead><tr>' +
          '<th style="width:85px;">Rank</th>' +
          '<th style="width:140px;">Delegation</th>' +
          '<th style="width:110px;">Mentor</th>' +
          '<th>Delegates</th>' +
          '<th style="width:55px;">Prep</th>' +
          '<th style="width:55px;">Speak</th>' +
          '<th style="width:55px;">Vocab</th>' +
          '<th style="width:55px;">Team</th>' +
          '<th style="width:55px;">Q&A</th>' +
          '<th style="width:70px;">' + (isJunior ? 'Base (/8)' : 'Base (/15)') + '</th>' +
          '<th style="width:65px;">' + (isJunior ? 'Bonus (+2)' : 'Bonus (+5)') + '</th>' +
          '<th style="width:85px;">' + (isJunior ? 'TOTAL (/10)' : 'TOTAL (/20)') + '</th>' +
          '<th style="width:75px;">Votes</th>' +
          '<th>Judge Feedback</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  });

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Official Evidence Audit Dossier - Senior Model United Nations</title>' +
    '<style>' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; margin: 0; padding: 24px; }' +
      '.report-card { max-width: 1250px; margin: 0 auto; background: #ffffff; padding: 32px 40px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }' +
      '.top-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 24px; }' +
      '.logo-area { display: flex; align-items: center; gap: 16px; }' +
      '.title-h1 { margin: 0; font-size: 20px; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }' +
      '.title-sub { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }' +
      '.meta-box { text-align: right; font-size: 11px; color: #475569; line-height: 1.5; }' +
      '.meta-box strong { color: #0f172a; }' +
      '.action-bar { display: flex; justify-content: flex-end; gap: 12px; margin-bottom: 20px; }' +
      '.btn { padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }' +
      '.btn-print { background: #0284c7; color: white; }' +
      '.btn-excel { background: #16a34a; color: white; }' +
      '.btn-back { background: #e2e8f0; color: #334155; }' +
      '.grade-section { margin-bottom: 36px; }' +
      '.grade-header { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 10px 16px; border-left: 4px solid #0284c7; border-radius: 0 6px 6px 0; margin-bottom: 12px; }' +
      '.grade-header h3 { margin: 0; font-size: 14px; color: #0f172a; }' +
      '.badge-total { font-size: 11px; color: #64748b; font-weight: 600; }' +
      '.report-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }' +
      '.report-table th, .report-table td { border: 1px solid #cbd5e1; padding: 8px 10px; }' +
      '.report-table th { background: #f1f5f9; color: #1e293b; font-weight: 700; text-transform: uppercase; font-size: 10.5px; letter-spacing: 0.3px; }' +
      '.rank-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 10px; }' +
      '.rank-badge.gold { background: #fef08a; color: #854d0e; border: 1px solid #fde047; }' +
      '.rank-badge.silver { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }' +
      '.rank-badge.bronze { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }' +
      '.rank-badge.normal { background: #e2e8f0; color: #475569; }' +
      '.rank-badge.pending { background: #f1f5f9; color: #94a3b8; }' +
      '.signatures-block { margin-top: 40px; padding-top: 24px; border-top: 2px dashed #cbd5e1; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; page-break-inside: avoid; }' +
      '.sig-title { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #1e293b; margin-bottom: 60px; }' +
      '.sig-name { font-size: 12px; font-weight: 600; color: #475569; border-top: 1px solid #cbd5e1; display: inline-block; padding-top: 6px; min-width: 160px; }' +
      '@media print { body { background: white; padding: 0; } .report-card { box-shadow: none; border: none; padding: 0; } .action-bar { display: none !important; } @page { size: landscape; margin: 10mm; } }' +
    '</style></head><body>' +
    '<div class="report-card">' +
      '<div class="action-bar">' +
        '<a href="/admin" class="btn btn-back">&larr; Return to Admin</a>' +
        '<a href="/api/admin/export/excel?grade=' + (gradeFilter || 'all') + '" class="btn btn-excel">&#128196; Export Excel (.xlsx)</a>' +
        '<button onclick="window.print()" class="btn btn-print">&#128424; Print / Save PDF Dossier</button>' +
      '</div>' +
      '<div class="top-header">' +
        '<div class="logo-area">' +
          '<div style="background:white;padding:4px 10px;border:2px solid #eab308;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.1);"><img src="/assets/un-ga-logo.png" style="height:68px;width:auto;object-fit:contain;"></div>' +
          '<div>' +
            '<h1 class="title-h1">Official Evidence Audit & Score Summary Dossier</h1>' +
            '<p class="title-sub">UN Day Special Event: Global Solutions Showcase &bull; Senior Model United Nations</p>' +
          '</div>' +
        '</div>' +
        '<div class="meta-box">' +
          '<div>Dossier ID: <strong>MUN-AUDIT-' + Date.now().toString().slice(-6) + '</strong></div>' +
          '<div>Timestamp: <strong>' + nowStr + '</strong></div>' +
          '<div>Status: <strong style="color:#16a34a;">OFFICIALLY VERIFIED & CERTIFIED</strong></div>' +
        '</div>' +
      '</div>' +
      gradesHtml +
      '<div class="signatures-block">' +
        '<div><div class="sig-title">Head of Judge Panel</div><div class="sig-name">(Signature & Full Name)</div></div>' +
        '<div><div class="sig-title">Secretariat Chair</div><div class="sig-name">(Signature & Full Name)</div></div>' +
        '<div><div class="sig-title">Secretary-General</div><div class="sig-name">(Official Stamp & Signature)</div></div>' +
      '</div>' +
    '</div></body></html>';
}

module.exports = { generateExcelWorkbook, generateVisualHtmlReport };
