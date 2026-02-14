// app.js - 메인 앱 (이벤트, CRUD, 탭 관리)
const App = (() => {
  let students = [];
  const STORAGE_KEY = 'cnc_academy_students';

  // === 초기화 ===
  function init() {
    loadFromStorage();
    setupTabs();
    setupEventListeners();
    renderStudentList();
    updateStudentCounts();
  }

  // === 데이터 저장/로드 ===
  function loadFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        students = JSON.parse(data);
        // 파싱 결과 재생성
        students.forEach(s => {
          if (s.scheduleText) {
            s.parsedSchedule = ScheduleParser.parseSchedule(s.scheduleText);
          }
        });
      } catch (e) {
        students = [];
      }
    }
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    updateStudentCounts();
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  // === 탭 관리 ===
  function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.dataset.tab;
        document.getElementById(tabId).classList.add('active');

        if (tabId === 'baby-timetable') {
          Timetable.render(students.filter(s => s.classType === 'baby'), 'baby-timetable-grid');
        } else if (tabId === 'teen-timetable') {
          Timetable.render(students.filter(s => s.classType === 'teen'), 'teen-timetable-grid');
        } else if (tabId === 'statistics') {
          Statistics.render(students, 'statistics-content');
        }
      });
    });
  }

  // === 학생 수 카운트 업데이트 ===
  function updateStudentCounts() {
    const babyCount = students.filter(s => s.classType === 'baby').length;
    const teenCount = students.filter(s => s.classType === 'teen').length;
    const babyEl = document.getElementById('baby-count');
    const teenEl = document.getElementById('teen-count');
    if (babyEl) babyEl.textContent = babyCount;
    if (teenEl) teenEl.textContent = teenCount;
  }

  // === 학생 CRUD ===
  function addStudent(classType) {
    const student = {
      id: generateId(),
      name: '',
      school: '',
      contact: '',
      classType,
      scheduleText: '',
      parsedSchedule: []
    };
    students.push(student);
    saveToStorage();
    renderStudentList();

    // 새 행의 이름 입력 필드에 포커스
    setTimeout(() => {
      const input = document.querySelector(`tr[data-id="${student.id}"] input[data-field="name"]`);
      if (input) input.focus();
    }, 50);
  }

  function updateStudent(id, field, value) {
    const student = students.find(s => s.id === id);
    if (!student) return;
    student[field] = value;
    if (field === 'scheduleText') {
      student.parsedSchedule = ScheduleParser.parseSchedule(value);
      renderParsedTags(id, student.parsedSchedule);
    }
    saveToStorage();
    // 시간표 탭이 보이고 있으면 자동 갱신
    refreshVisibleTimetable();
  }

  function refreshVisibleTimetable() {
    const activeBaby = document.getElementById('baby-timetable');
    const activeTeen = document.getElementById('teen-timetable');
    const activeStats = document.getElementById('statistics');
    if (activeBaby && activeBaby.classList.contains('active')) {
      Timetable.render(students.filter(s => s.classType === 'baby'), 'baby-timetable-grid');
    }
    if (activeTeen && activeTeen.classList.contains('active')) {
      Timetable.render(students.filter(s => s.classType === 'teen'), 'teen-timetable-grid');
    }
    if (activeStats && activeStats.classList.contains('active')) {
      Statistics.render(students, 'statistics-content');
    }
  }

  function deleteStudent(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    students = students.filter(s => s.id !== id);
    saveToStorage();
    renderStudentList();
    refreshVisibleTimetable();
  }

  function clearAllStudents(classType) {
    const label = classType === 'baby' ? '아기반' : '청소년반';
    const count = students.filter(s => s.classType === classType).length;
    if (count === 0) {
      alert(`${label}에 등록된 학생이 없습니다.`);
      return;
    }
    if (!confirm(`${label} 학생 ${count}명을 전체 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    students = students.filter(s => s.classType !== classType);
    saveToStorage();
    renderStudentList();
    refreshVisibleTimetable();
  }

  function transferStudent(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;
    const targetClass = student.classType === 'baby' ? '청소년반' : '아기반';
    if (!confirm(`${student.name || '이 학생'}을(를) ${targetClass}으로 이동하시겠습니까?`)) return;
    student.classType = student.classType === 'baby' ? 'teen' : 'baby';
    saveToStorage();
    renderStudentList();
    refreshVisibleTimetable();
  }

  // === 렌더링 ===
  function renderStudentList() {
    renderClassPanel('baby');
    renderClassPanel('teen');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderClassPanel(classType) {
    const container = document.getElementById(`${classType}-students`);
    if (!container) return;

    const classStudents = students.filter(s => s.classType === classType);

    if (classStudents.length === 0) {
      container.innerHTML = '<div class="empty-panel">등록된 학생이 없습니다. "학생 추가" 버튼을 눌러 추가하세요.</div>';
      return;
    }

    let html = '<div class="table-scroll"><table class="student-table"><thead><tr>';
    html += '<th class="col-num">#</th>';
    html += '<th class="col-name">이름</th>';
    html += '<th class="col-school">학교/학년</th>';
    html += '<th class="col-contact">연락처</th>';
    html += '<th class="col-schedule">수업시간</th>';
    html += '<th class="col-parsed">파싱결과</th>';
    html += '<th class="col-actions">액션</th>';
    html += '</tr></thead><tbody>';

    classStudents.forEach((s, i) => {
      html += `<tr data-id="${s.id}">`;
      html += `<td class="col-num">${i + 1}</td>`;
      html += `<td class="col-name"><input type="text" class="inline-edit" data-field="name" value="${escapeHtml(s.name)}" placeholder="이름"></td>`;
      html += `<td class="col-school"><input type="text" class="inline-edit" data-field="school" value="${escapeHtml(s.school)}" placeholder="학교/학년"></td>`;
      html += `<td class="col-contact"><input type="text" class="inline-edit" data-field="contact" value="${escapeHtml(s.contact)}" placeholder="연락처"></td>`;
      html += `<td class="col-schedule"><input type="text" class="inline-edit schedule-input" data-field="scheduleText" value="${escapeHtml(s.scheduleText)}" placeholder="예: 화목7-9"></td>`;
      html += `<td class="col-parsed" id="tags-${s.id}">${renderTags(s.parsedSchedule)}</td>`;
      html += `<td class="col-actions">`;
      const targetLabel = classType === 'baby' ? '청소년반' : '아기반';
      html += `<button class="btn-icon btn-transfer" data-id="${s.id}" title="${targetLabel}으로 이동">&#8596;</button>`;
      html += `<button class="btn-icon btn-delete" data-id="${s.id}" title="삭제">&times;</button>`;
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  function renderTags(parsedSchedule) {
    if (!parsedSchedule || parsedSchedule.length === 0) {
      return '<span class="no-schedule">-</span>';
    }
    return parsedSchedule.map(s => {
      return `<span class="schedule-tag">${s.day} ${s.start}-${s.end}시</span>`;
    }).join(' ');
  }

  function renderParsedTags(id, parsedSchedule) {
    const el = document.getElementById(`tags-${id}`);
    if (el) el.innerHTML = renderTags(parsedSchedule);
  }

  // === 일괄 입력 ===
  function showBulkModal(classType) {
    const modal = document.getElementById('bulk-modal');
    modal.classList.add('active');
    modal.dataset.classType = classType;
    document.getElementById('bulk-textarea').value = '';
    document.getElementById('bulk-title').textContent =
      classType === 'baby' ? '아기반 일괄 입력' : '청소년반 일괄 입력';
    document.getElementById('bulk-textarea').focus();
  }

  function closeBulkModal() {
    document.getElementById('bulk-modal').classList.remove('active');
  }

  function confirmBulkImport() {
    const modal = document.getElementById('bulk-modal');
    const classType = modal.dataset.classType;
    const text = document.getElementById('bulk-textarea').value;
    if (!text.trim()) {
      alert('데이터를 입력해주세요.');
      return;
    }
    const count = parseBulkInput(text, classType);
    closeBulkModal();
    if (count > 0) {
      alert(`${count}명의 학생이 등록되었습니다.`);
    }
  }

  // ========================================
  // 일괄 입력 파서 — 마크다운 테이블 형식 지원
  // 지원 형식:
  //   | 14 | 최희준 | 불로초5 | 010-6627-2365(부) | 목3 |
  //   최희준\t불로초5\t010-1234\t화목7-9
  //   최희준  불로초5  010-1234  화목7-9
  // ========================================
  function parseBulkInput(text, classType) {
    const lines = text.trim().split('\n');
    const newStudents = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // 마크다운 구분선: |---|---|---| 또는 --- 만 있는 줄
      if (/^[\|\s\-:]+$/.test(line) && line.includes('-')) continue;

      // 헤더 행: "이름", "학교", "연락처" 등의 키워드가 있으면 건너뛰기
      // 단, 전화번호(010 등)가 포함된 데이터 행은 건너뛰지 않음
      if (/이름|학교|학년|연락처|수업시간/.test(line) && !/010/.test(line)) continue;

      // 셀 분리
      let cells;
      if (line.includes('|')) {
        // 마크다운 테이블: | 값 | 값 | 값 |
        cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
      } else if (line.includes('\t')) {
        // 탭 구분
        cells = line.split('\t').map(c => c.trim());
      } else {
        // 2칸 이상 공백 구분
        cells = line.split(/\s{2,}/).map(c => c.trim());
      }

      if (cells.length < 2) continue;

      // 첫 번째 셀이 행 번호인지 판별
      // "14", "14.", "#14", " 3 " 등
      if (/^\#?\s*\d+\s*\.?\s*$/.test(cells[0])) {
        cells = cells.slice(1); // 번호 컬럼 제거
      }

      if (cells.length < 1 || !cells[0]) continue;

      // 열 매핑: 이름, 학교, 연락처, 수업시간
      const name = cells[0] || '';
      const school = cells[1] || '';
      const contact = cells[2] || '';

      // 수업시간: 4번째 열 또는 그 이후 열에서 찾기
      let scheduleText = '';
      // cells[3]부터 끝까지 확인, 한글 요일 문자가 있는 셀을 수업시간으로
      for (let ci = 3; ci < cells.length; ci++) {
        if (cells[ci]) {
          scheduleText = cells[ci];
          break;
        }
      }
      // 만약 cells[3]이 없으면 빈 문자열
      if (!scheduleText && cells.length > 3) {
        scheduleText = cells[3] || '';
      }

      newStudents.push({
        id: generateId(),
        name,
        school,
        contact,
        classType,
        scheduleText,
        parsedSchedule: ScheduleParser.parseSchedule(scheduleText)
      });
    }

    students.push(...newStudents);
    saveToStorage();
    renderStudentList();
    return newStudents.length;
  }

  // === JSON 내보내기/가져오기 ===
  function exportJSON() {
    const exportData = students.map(s => ({
      id: s.id,
      name: s.name,
      school: s.school,
      contact: s.contact,
      classType: s.classType,
      scheduleText: s.scheduleText
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `봉선CNC_학생데이터_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          alert('올바른 JSON 형식이 아닙니다.');
          return;
        }
        let count = 0;
        data.forEach(s => {
          if (!s.id) s.id = generateId();
          s.parsedSchedule = ScheduleParser.parseSchedule(s.scheduleText || '');
          students.push(s);
          count++;
        });
        saveToStorage();
        renderStudentList();
        alert(`${count}명의 학생 데이터를 가져왔습니다.`);
      } catch (err) {
        alert('JSON 파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // === 인쇄 ===
  function printTimetable(classType) {
    // 먼저 시간표를 렌더링
    const gridId = classType === 'baby' ? 'baby-timetable-grid' : 'teen-timetable-grid';
    Timetable.render(students.filter(s => s.classType === classType), gridId);

    document.body.dataset.printTarget = classType + '-timetable';
    window.print();
    delete document.body.dataset.printTarget;
  }

  // === 이벤트 리스너 ===
  function setupEventListeners() {
    // 인라인 편집
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('inline-edit')) {
        const row = e.target.closest('tr');
        if (row) {
          updateStudent(row.dataset.id, e.target.dataset.field, e.target.value);
        }
      }
    });

    // 삭제/이동 버튼 (이벤트 위임)
    document.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.btn-delete');
      const transferBtn = e.target.closest('.btn-transfer');
      if (deleteBtn) deleteStudent(deleteBtn.dataset.id);
      if (transferBtn) transferStudent(transferBtn.dataset.id);
    });

    // 학생 추가
    document.getElementById('add-baby')?.addEventListener('click', () => addStudent('baby'));
    document.getElementById('add-teen')?.addEventListener('click', () => addStudent('teen'));

    // 일괄 입력
    document.getElementById('bulk-baby')?.addEventListener('click', () => showBulkModal('baby'));
    document.getElementById('bulk-teen')?.addEventListener('click', () => showBulkModal('teen'));

    // 전체 삭제
    document.getElementById('clear-baby')?.addEventListener('click', () => clearAllStudents('baby'));
    document.getElementById('clear-teen')?.addEventListener('click', () => clearAllStudents('teen'));

    // 일괄 입력 모달
    document.getElementById('bulk-confirm')?.addEventListener('click', confirmBulkImport);
    document.getElementById('bulk-cancel')?.addEventListener('click', closeBulkModal);
    document.querySelector('.modal-close')?.addEventListener('click', closeBulkModal);
    document.getElementById('bulk-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'bulk-modal') closeBulkModal();
    });

    // JSON 내보내기/가져오기
    document.getElementById('export-json')?.addEventListener('click', exportJSON);
    document.getElementById('import-json-btn')?.addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file')?.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        importJSON(e.target.files[0]);
        e.target.value = '';
      }
    });

    // 시간표 새로고침
    document.getElementById('refresh-baby')?.addEventListener('click', () => {
      Timetable.render(students.filter(s => s.classType === 'baby'), 'baby-timetable-grid');
    });
    document.getElementById('refresh-teen')?.addEventListener('click', () => {
      Timetable.render(students.filter(s => s.classType === 'teen'), 'teen-timetable-grid');
    });

    // 인쇄
    document.getElementById('print-baby')?.addEventListener('click', () => printTimetable('baby'));
    document.getElementById('print-teen')?.addEventListener('click', () => printTimetable('teen'));

    // Enter 키로 다음 행 이동
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('inline-edit')) {
        e.preventDefault();
        const currentRow = e.target.closest('tr');
        const nextRow = currentRow?.nextElementSibling;
        if (nextRow) {
          const field = e.target.dataset.field;
          const nextInput = nextRow.querySelector(`input[data-field="${field}"]`);
          if (nextInput) nextInput.focus();
        }
      }
    });
  }

  return {
    init,
    getStudents: () => students
  };
})();

// === 접근 제한 ===
const ACCESS_KEY = 'bongseon2026';

function checkAccess() {
  // 1) URL 파라미터 확인 (?access=bongseon2026)
  const params = new URLSearchParams(window.location.search);
  if (params.get('access') === ACCESS_KEY) {
    sessionStorage.setItem('cnc_access', 'granted');
    // URL에서 파라미터 제거 (깔끔하게)
    const url = new URL(window.location);
    url.searchParams.delete('access');
    window.history.replaceState({}, '', url.pathname);
    return true;
  }
  // 2) 세션 스토리지 확인
  if (sessionStorage.getItem('cnc_access') === 'granted') {
    return true;
  }
  return false;
}

function unlockApp() {
  document.getElementById('lock-screen').style.display = 'none';
  document.getElementById('app-body').style.display = '';
  App.init();
}

function setupLockScreen() {
  const passwordInput = document.getElementById('lock-password');
  const submitBtn = document.getElementById('lock-submit');
  const errorEl = document.getElementById('lock-error');

  function tryUnlock() {
    if (passwordInput.value === ACCESS_KEY) {
      sessionStorage.setItem('cnc_access', 'granted');
      unlockApp();
    } else {
      errorEl.textContent = '비밀번호가 올바르지 않습니다.';
      passwordInput.value = '';
      passwordInput.focus();
    }
  }

  submitBtn.addEventListener('click', tryUnlock);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryUnlock();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (checkAccess()) {
    unlockApp();
  } else {
    setupLockScreen();
    document.getElementById('lock-password').focus();
  }
});
