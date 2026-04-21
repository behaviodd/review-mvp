/**
 * _구성원 시트 완전 재구축 스크립트
 *
 * [실행 방법]
 * 1. Google Sheets → 확장 프로그램 → Apps Script
 * 2. 상단 드롭다운에서 "rebuildUserSheet" 선택 → ▶ 실행
 * 3. 완료 후 _구성원 시트 확인
 *
 * [동작]
 * - 기존 시트를 _구성원_backup_YYYYMMDD 로 복사 (안전장치)
 * - 컬럼 순서/이름에 무관하게 이름으로 매핑
 * - 역할: 기존 '역할' → 없으면 '직책' 값 사용
 * - 권한: 기존 '권한' 컬럼 값 그대로 유지
 * - 최종 15열 구조로 깨끗하게 재작성
 */

var REBUILD_HEADERS = [
  '사번', '주조직', '부조직', '팀', '스쿼드',
  '역할', '권한', '직무',
  '성명', '영문이름', '입사일', '연락처', '이메일',
  '재직 여부', '보고대상(사번)'
];

function rebuildUserSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_구성원');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ "_구성원" 시트를 찾을 수 없습니다.');
    return;
  }

  // 1. 원본 백업
  var today      = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  var backupName = '_구성원_backup_' + today;
  var existing   = ss.getSheetByName(backupName);
  if (existing) ss.deleteSheet(existing);
  sheet.copyTo(ss).setName(backupName);
  Logger.log('백업 완료: ' + backupName);

  // 2. 현재 데이터 읽기
  var rawData = sheet.getDataRange().getValues();
  if (rawData.length < 1) {
    SpreadsheetApp.getUi().alert('⚠️ 데이터가 없습니다.');
    return;
  }

  // 3. 헤더 → 인덱스 맵 (공백 제거 + 소문자 정규화)
  var oldHeaders = rawData[0];
  var colMap = {};
  oldHeaders.forEach(function(h, i) {
    var key = String(h).replace(/\s+/g, '').toLowerCase();
    if (key) colMap[key] = i;
  });

  function getVal(row, colName) {
    var key = String(colName).replace(/\s+/g, '').toLowerCase();
    var idx = colMap[key];
    if (idx === undefined || idx < 0) return '';
    var v = row[idx];
    return (v === null || v === undefined) ? '' : String(v).trim();
  }

  // 4. 행 변환
  var VALID_ROLE_KEYWORDS = ['admin', 'leader', 'member'];

  var newRows = rawData.slice(1)
    .filter(function(r) {
      return r.some(function(c) { return c !== '' && c !== null && c !== undefined; });
    })
    .map(function(r) {
      // 역할: '역할' 컬럼 우선, 없으면 '직책' 사용. 단 권한 키워드면 직책으로 쓰지 않음.
      var rawRole = getVal(r, '역할') || getVal(r, '직책');
      var role    = VALID_ROLE_KEYWORDS.indexOf(rawRole) >= 0 ? '' : rawRole;

      // 권한: 기존 '권한' 컬럼 그대로 유지
      var perm = getVal(r, '권한');

      return REBUILD_HEADERS.map(function(h) {
        if (h === '역할') return role;
        if (h === '권한') return perm;
        return getVal(r, h);
      });
    });

  // 5. 시트 초기화 후 재작성
  sheet.clearContents();
  var allRows = [REBUILD_HEADERS].concat(newRows);
  sheet.getRange(1, 1, allRows.length, REBUILD_HEADERS.length).setValues(allRows);

  // 헤더 서식
  sheet.getRange(1, 1, 1, REBUILD_HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#f3f4f6');
  sheet.setFrozenRows(1);

  // 불필요한 열 삭제 (15열 초과분)
  var maxCols = sheet.getMaxColumns();
  if (maxCols > REBUILD_HEADERS.length) {
    sheet.deleteColumns(REBUILD_HEADERS.length + 1, maxCols - REBUILD_HEADERS.length);
  }

  Logger.log('재구축 완료. 구성원 수: ' + newRows.length);
  SpreadsheetApp.getUi().alert(
    '✅ 재구축 완료!\n\n' +
    '• 구성원 수: ' + newRows.length + '명\n' +
    '• 컬럼 수: ' + REBUILD_HEADERS.length + '열\n' +
    '• 백업: ' + backupName + '\n\n' +
    '열 순서: ' + REBUILD_HEADERS.join(' · ')
  );
}
