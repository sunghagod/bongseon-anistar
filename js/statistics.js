// statistics.js - 통계 모듈
const Statistics = (() => {
  const MAX_CAPACITY = 12;

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getStatusClass(count) {
    if (count > MAX_CAPACITY) return 'status-over';
    if (count >= 9) return 'status-full';
    if (count >= 5) return 'status-active';
    return 'status-relaxed';
  }

  function render(students, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const babyStudents = students.filter(s => s.classType === 'baby');
    const teenStudents = students.filter(s => s.classType === 'teen');

    // 시간대별 인원 집계
    const slotCounts = {};
    students.forEach(s => {
      (s.parsedSchedule || []).forEach(slot => {
        const key = `${slot.day} ${slot.start}-${slot.end}시`;
        if (!slotCounts[key]) {
          slotCounts[key] = { count: 0, students: [], day: slot.day, start: slot.start, end: slot.end };
        }
        slotCounts[key].count++;
        slotCounts[key].students.push(s);
      });
    });

    const sortedSlots = Object.entries(slotCounts).sort((a, b) => b[1].count - a[1].count);
    const top15 = sortedSlots.slice(0, 15);
    const maxCount = top15.length > 0 ? top15[0][1].count : 1;
    const overCapacity = sortedSlots.filter(([, v]) => v.count > MAX_CAPACITY);

    // 대기자 집계
    const waitlist = [];
    overCapacity.forEach(([slot, v]) => {
      v.students.slice(MAX_CAPACITY).forEach(s => {
        waitlist.push({ name: s.name, school: s.school, contact: s.contact, classType: s.classType, slot });
      });
    });

    let html = '';

    // === 현황 카드 ===
    html += '<div class="stat-cards">';
    html += `<div class="stat-card total">
      <div class="stat-icon">👨‍🎨</div>
      <div class="stat-number">${students.length}</div>
      <div class="stat-label">전체 학생</div>
    </div>`;
    html += `<div class="stat-card baby">
      <div class="stat-icon">🎨</div>
      <div class="stat-number">${babyStudents.length}</div>
      <div class="stat-label">아기반</div>
    </div>`;
    html += `<div class="stat-card teen">
      <div class="stat-icon">🖌️</div>
      <div class="stat-number">${teenStudents.length}</div>
      <div class="stat-label">청소년반</div>
    </div>`;
    html += `<div class="stat-card slots">
      <div class="stat-icon">⏰</div>
      <div class="stat-number">${Object.keys(slotCounts).length}</div>
      <div class="stat-label">운영 시간대</div>
    </div>`;
    html += '</div>';

    // === 인기 시간대 TOP 15 ===
    html += '<div class="stat-section">';
    html += '<h3>인기 시간대 TOP 15</h3>';
    if (top15.length === 0) {
      html += '<p class="empty-message">등록된 수업 데이터가 없습니다.</p>';
    } else {
      html += '<div class="bar-chart">';
      top15.forEach(([slot, v], idx) => {
        const width = (v.count / maxCount) * 100;
        const statusClass = getStatusClass(v.count);
        html += `<div class="bar-row">`;
        html += `<div class="bar-rank">${idx + 1}</div>`;
        html += `<div class="bar-label">${slot}</div>`;
        html += `<div class="bar-track"><div class="bar-fill ${statusClass}" style="width:${width}%"></div></div>`;
        html += `<div class="bar-value">${v.count}명</div>`;
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // === 정원 초과 시간대 ===
    html += '<div class="stat-section">';
    html += '<h3>정원 초과 시간대</h3>';
    if (overCapacity.length === 0) {
      html += '<p class="empty-message good">모든 시간대가 정원 이내입니다.</p>';
    } else {
      html += '<div class="over-list">';
      overCapacity.forEach(([slot, v]) => {
        const overCount = v.count - MAX_CAPACITY;
        html += `<div class="over-item">`;
        html += `<span class="over-dot"></span>`;
        html += `<span class="over-slot">${slot}</span>`;
        html += `<span class="over-info">${v.count}명 <span class="over-count">(+${overCount}명 초과)</span></span>`;
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // === 대기자 명단 ===
    html += '<div class="stat-section">';
    html += '<h3>대기자 명단</h3>';
    if (waitlist.length === 0) {
      html += '<p class="empty-message good">대기자가 없습니다.</p>';
    } else {
      html += `<p class="waitlist-summary">총 ${waitlist.length}명의 대기자가 있습니다.</p>`;
      html += '<table class="waitlist-table"><thead><tr>';
      html += '<th>이름</th><th>학교/학년</th><th>반</th><th>시간대</th>';
      html += '</tr></thead><tbody>';
      waitlist.forEach(w => {
        const classLabel = w.classType === 'baby' ? '아기반' : '청소년반';
        html += '<tr>';
        html += `<td>${escapeHtml(w.name || '-')}</td>`;
        html += `<td>${escapeHtml(w.school || '-')}</td>`;
        html += `<td><span class="class-badge ${w.classType}">${classLabel}</span></td>`;
        html += `<td>${w.slot}</td>`;
        html += '</tr>';
      });
      html += '</tbody></table>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  return { render };
})();
