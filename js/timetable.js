// timetable.js - 시간표 격자 렌더링 엔진
const Timetable = (() => {
  const DAYS = ['화', '수', '목', '금', '토'];
  const START_HOUR = 10;
  const END_HOUR = 22;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
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

  function getStatusLabel(count) {
    if (count > MAX_CAPACITY) return '초과';
    if (count >= 9) return '만석';
    if (count >= 5) return '활발';
    return '여유';
  }

  // 겹침 그룹 탐색
  function findOverlapGroups(blocks) {
    if (blocks.length === 0) return [];
    blocks.sort((a, b) => a.start - b.start || a.end - b.end);

    const groups = [];
    let currentGroup = [blocks[0]];
    let groupEnd = blocks[0].end;

    for (let i = 1; i < blocks.length; i++) {
      if (blocks[i].start < groupEnd) {
        currentGroup.push(blocks[i]);
        groupEnd = Math.max(groupEnd, blocks[i].end);
      } else {
        groups.push(currentGroup);
        currentGroup = [blocks[i]];
        groupEnd = blocks[i].end;
      }
    }
    groups.push(currentGroup);
    return groups;
  }

  // 그리디 컬럼 할당
  function assignColumns(group) {
    const columns = [];
    for (const block of group) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (block.start >= columns[col]) {
          columns[col] = block.end;
          block._column = col;
          placed = true;
          break;
        }
      }
      if (!placed) {
        block._column = columns.length;
        columns.push(block.end);
      }
    }
    const maxCols = columns.length;
    group.forEach(block => { block._groupMaxCols = maxCols; });
    return maxCols;
  }

  function render(students, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 학생이 없으면 빈 상태 표시
    if (!students || students.length === 0) {
      container.innerHTML = '<div style="padding:48px;text-align:center;color:#A89585;">등록된 학생이 없습니다. 학생명단 탭에서 학생을 추가해주세요.</div>';
      return;
    }

    // 학생 스케줄 → 블록 생성
    const dayBlocks = {};
    DAYS.forEach(day => { dayBlocks[day] = {}; });

    students.forEach(student => {
      (student.parsedSchedule || []).forEach(slot => {
        if (!DAYS.includes(slot.day)) return;
        const clampedStart = Math.max(slot.start, START_HOUR);
        const clampedEnd = Math.min(slot.end, END_HOUR);
        if (clampedStart >= clampedEnd) return;

        const key = `${clampedStart}-${clampedEnd}`;
        if (!dayBlocks[slot.day][key]) {
          dayBlocks[slot.day][key] = {
            day: slot.day,
            start: clampedStart,
            end: clampedEnd,
            students: []
          };
        }
        dayBlocks[slot.day][key].students.push(student);
      });
    });

    // 겹침 분석 및 컬럼 할당
    const dayOverlapInfo = {};
    DAYS.forEach(day => {
      const blocks = Object.values(dayBlocks[day]);
      const groups = findOverlapGroups(blocks);
      let maxCols = 1;
      groups.forEach(group => {
        const cols = assignColumns(group);
        maxCols = Math.max(maxCols, cols);
      });
      dayOverlapInfo[day] = { blocks, maxCols };
    });

    // 블록이 하나도 없는지 확인
    const totalBlocks = DAYS.reduce((sum, day) => sum + dayOverlapInfo[day].blocks.length, 0);
    if (totalBlocks === 0) {
      container.innerHTML = '<div style="padding:48px;text-align:center;color:#A89585;">수업시간이 입력된 학생이 없습니다.<br>학생명단에서 수업시간을 입력해주세요. (예: 화목7-9)</div>';
      return;
    }

    // 비례 열 너비 계산
    const totalWeight = DAYS.reduce((sum, day) => sum + Math.max(1, dayOverlapInfo[day].maxCols), 0);
    const dayWidths = {};
    DAYS.forEach(day => {
      dayWidths[day] = Math.max(1, dayOverlapInfo[day].maxCols) / totalWeight * 100;
    });

    // HTML 렌더링
    let html = '<div class="timetable">';

    // 범례
    html += '<div class="timetable-legend">';
    html += '<span class="legend-item"><span class="legend-dot status-relaxed"></span>여유 (1~4명)</span>';
    html += '<span class="legend-item"><span class="legend-dot status-active"></span>활발 (5~8명)</span>';
    html += '<span class="legend-item"><span class="legend-dot status-full"></span>만석 (9~12명)</span>';
    html += '<span class="legend-item"><span class="legend-dot status-over"></span>초과 (13명+)</span>';
    html += '</div>';

    // 헤더 — days-header 래퍼로 본문과 동일한 구조
    html += '<div class="timetable-header">';
    html += '<div class="time-header-cell">시간</div>';
    html += '<div class="days-header">';
    DAYS.forEach(day => {
      const blockCount = dayOverlapInfo[day].blocks.reduce((sum, b) => sum + b.students.length, 0);
      html += `<div class="day-header-cell" style="width:${dayWidths[day]}%">`;
      html += `<span class="day-name">${day}</span>`;
      if (blockCount > 0) html += `<span class="day-count">${blockCount}명</span>`;
      html += '</div>';
    });
    html += '</div>'; // days-header
    html += '</div>';

    // 본문
    html += '<div class="timetable-body">';

    // 시간 라벨
    html += '<div class="time-column">';
    for (let h = START_HOUR; h < END_HOUR; h++) {
      const top = ((h - START_HOUR) / TOTAL_HOURS) * 100;
      const isLunch = h === 13;
      const isDinner = h === 18;
      const cls = isLunch ? 'lunch' : isDinner ? 'dinner' : '';
      html += `<div class="time-label ${cls}" style="top:${top}%;height:${100 / TOTAL_HOURS}%">`;
      html += `<span class="time-text">${h}시</span>`;
      if (isLunch) html += '<span class="meal-label">점심</span>';
      if (isDinner) html += '<span class="meal-label">저녁</span>';
      html += '</div>';
    }
    html += '</div>';

    // 요일 컬럼
    html += '<div class="days-container">';
    DAYS.forEach(day => {
      html += `<div class="day-column" style="width:${dayWidths[day]}%">`;

      // 시간 격자선
      for (let h = START_HOUR; h <= END_HOUR; h++) {
        const top = ((h - START_HOUR) / TOTAL_HOURS) * 100;
        const isLunch = h === 13;
        const isDinner = h === 18;
        html += `<div class="hour-line ${isLunch ? 'lunch' : isDinner ? 'dinner' : ''}" style="top:${top}%"></div>`;
      }

      // 블록 렌더링
      const blocks = dayOverlapInfo[day].blocks;
      blocks.forEach(block => {
        const top = ((block.start - START_HOUR) / TOTAL_HOURS) * 100;
        const height = ((block.end - block.start) / TOTAL_HOURS) * 100;
        const maxCols = block._groupMaxCols || 1;
        const col = block._column || 0;

        // Side-by-side: 겹치는 블록은 균등 분할
        let blockWidth, blockLeft;
        if (maxCols === 1) {
          blockWidth = 96;
          blockLeft = 2;
        } else {
          const gap = 1;
          blockWidth = (96 - gap * (maxCols - 1)) / maxCols;
          blockLeft = 2 + col * (blockWidth + gap);
        }

        const count = block.students.length;
        const statusClass = getStatusClass(count);

        html += `<div class="time-block ${statusClass}" style="top:${top}%;height:${height}%;left:${blockLeft}%;width:${blockWidth}%" data-day="${day}" data-start="${block.start}" data-end="${block.end}">`;

        // 헤더: 도트 + 시간 + 인원
        html += '<div class="block-header">';
        html += '<span class="status-dot"></span>';
        html += `<span class="block-time">${block.start}-${block.end}시</span>`;
        html += `<span class="block-count">${count}명</span>`;
        html += '</div>';

        // 학생 이름 목록 (항상 표시)
        html += '<div class="block-names">';
        block.students.forEach((s, i) => {
          const isOver = i >= MAX_CAPACITY;
          const name = escapeHtml(s.name || '?');
          const school = s.school ? `(${escapeHtml(s.school)})` : '';
          html += `<div class="block-student${isOver ? ' over-student' : ''}">${name}${school}</div>`;
        });
        html += '</div>';

        html += '</div>';
      });

      html += '</div>';
    });
    html += '</div>'; // days-container
    html += '</div>'; // timetable-body
    html += '</div>'; // timetable

    container.innerHTML = html;
  }

  return { render, DAYS, START_HOUR, END_HOUR, MAX_CAPACITY };
})();
