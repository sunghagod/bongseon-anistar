// parser.js - 수업시간 텍스트 파서
// 지원 형식 예시:
//   목3, 화목 3, 화목 3-5, 화2, 수2 목3:30, 목 7
//   수4 금3, 수금 3:30, 수10목2금7토3, 목4 토10
//   목금3-5, 토3, 금3-5, 토4-6, 화목2-4
//   수10토2, 화목4~6시, 수10, 목4, 수7-10, 토2-4

const ScheduleParser = (() => {
  const DAY_SET = new Set(['월', '화', '수', '목', '금', '토', '일']);

  // 시간 변환: 1~9 → 오후(13~21), 10~12 → 오전
  function toHour24(n) {
    n = parseInt(n, 10);
    if (isNaN(n)) return null;
    return (n >= 1 && n <= 9) ? n + 12 : n;
  }

  // "7-9", "3:30", "4~6시", "10" 같은 시간 문자열 → {start, end}
  function parseTime(str) {
    if (!str) return null;
    // 불필요한 문자 제거
    str = str.replace(/시/g, '').replace(/오전|오후/g, '').trim();
    if (!str) return null;

    // 범위 형식: 7-9, 3:30-5:30, 4~6, 3:30-5 등
    const rangeRe = /^(\d+)(?::(\d+))?[-~](\d+)(?::(\d+))?$/;
    const rm = str.match(rangeRe);
    if (rm) {
      let s = toHour24(parseInt(rm[1], 10));
      let e = toHour24(parseInt(rm[3], 10));
      if (s == null || e == null) return null;
      // end <= start 이면 보정 (예: 7-10 → 19-22, 10은 AM이므로 +12)
      if (e <= s) {
        const rawEnd = parseInt(rm[3], 10);
        if (rawEnd >= 10 && rawEnd <= 12) e = rawEnd + 12;
      }
      if (e <= s) return null; // 여전히 이상하면 무시
      return { start: s, end: e };
    }

    // 단일 시간: 3, 10, 3:30 등 → 기본 2시간
    const singleRe = /^(\d+)(?::(\d+))?$/;
    const sm = str.match(singleRe);
    if (sm) {
      const s = toHour24(parseInt(sm[1], 10));
      return s != null ? { start: s, end: s + 2 } : null;
    }

    return null;
  }

  // 메인 파서: 자유 형식 텍스트 → [{day, start, end}, ...]
  function parseSchedule(text) {
    if (!text || typeof text !== 'string') return [];
    text = text.trim();
    if (!text) return [];
    if (/휴|휴원|중단/.test(text)) return [];

    // 정규화
    text = text.replace(/요일/g, '');  // "화요일" → "화"
    text = text.replace(/~/g, '-');     // ~ → -

    // 전략: 텍스트를 공백으로 분리한 후 각 토큰 분석
    const tokens = text.split(/\s+/).filter(Boolean);
    const results = [];
    let waitingDays = []; // 시간 없이 대기 중인 요일들

    for (const rawToken of tokens) {
      const token = rawToken.replace(/,/g, ''); // 쉼표 제거
      if (!token) continue;

      const days = [];  // 이 토큰에서 발견된 요일
      const nums = [];  // 이 토큰에서 발견된 숫자 부분

      // 토큰을 요일/숫자 파트로 분리
      // 예: "수10목2금7토3" → [수,10,목,2,금,7,토,3]
      // 예: "화목3-5" → [화,목,3-5]
      // 예: "3:30" → [3:30]
      const parts = [];
      let buf = '';
      for (const ch of token) {
        if (DAY_SET.has(ch)) {
          if (buf) { parts.push(buf); buf = ''; }
          parts.push(ch);
        } else {
          buf += ch;
        }
      }
      if (buf) parts.push(buf);

      // parts 분석
      const dayList = [];
      const timeParts = [];
      const dayTimePairs = []; // [{day, timeStr}]

      let i = 0;
      while (i < parts.length) {
        if (DAY_SET.has(parts[i])) {
          // 다음이 숫자 파트인지 확인
          if (i + 1 < parts.length && !DAY_SET.has(parts[i + 1])) {
            // 뒤에 또 다른 요일이 있으면 → 이 요일+숫자는 개별 페어
            // 아니면 → 이 요일은 dayList에, 숫자는 나중에 판단
            // 판단 기준: 뒤에 더 있고 그 다음이 요일이면 페어 모드
            let nextDayIdx = -1;
            for (let j = i + 2; j < parts.length; j++) {
              if (DAY_SET.has(parts[j])) { nextDayIdx = j; break; }
            }

            if (nextDayIdx > 0 && nextDayIdx === i + 2) {
              // 바로 다음 요일이 있음 → 페어 모드 (수10목2금7토3)
              dayTimePairs.push({ day: parts[i], timeStr: parts[i + 1] });
              i += 2;
            } else {
              // 그룹 모드: 요일들 모아서 마지막 시간에 적용 (화목3-5)
              dayList.push(parts[i]);
              i++;
            }
          } else {
            // 다음이 요일이거나 없음 → 요일만
            dayList.push(parts[i]);
            i++;
          }
        } else {
          // 숫자 파트
          timeParts.push(parts[i]);
          i++;
        }
      }

      // Case 1: 페어 모드 (수10목2금7토3)
      if (dayTimePairs.length > 0) {
        // 먼저 대기 중이던 요일 처리
        for (const d of waitingDays) {
          results.push({ day: d, start: 19, end: 22 });
        }
        waitingDays = [];

        for (const pair of dayTimePairs) {
          const t = parseTime(pair.timeStr);
          if (t) results.push({ day: pair.day, start: t.start, end: t.end });
        }
        // dayList에 남은 요일이 있을 수 있음 (마지막 요일이 시간 없이 끝난 경우)
        for (const d of dayList) {
          if (timeParts.length > 0) {
            const t = parseTime(timeParts[0]);
            if (t) results.push({ day: d, start: t.start, end: t.end });
          } else {
            waitingDays.push(d);
          }
        }
        continue;
      }

      // Case 2: 그룹 모드 (화목3-5, 수4, 토10 등)
      if (dayList.length > 0 && timeParts.length > 0) {
        // 대기 중이던 요일 + 이 토큰의 요일 모두에 시간 적용
        const allDays = [...waitingDays, ...dayList];
        waitingDays = [];
        const t = parseTime(timeParts.join(''));
        if (t) {
          for (const d of allDays) {
            results.push({ day: d, start: t.start, end: t.end });
          }
        }
        continue;
      }

      // Case 3: 요일만 (화목, 수금 등) → 대기
      if (dayList.length > 0 && timeParts.length === 0) {
        waitingDays.push(...dayList);
        continue;
      }

      // Case 4: 시간만 (3-5, 3:30 등) → 대기 중인 요일에 적용
      if (dayList.length === 0 && timeParts.length > 0) {
        if (waitingDays.length > 0) {
          const t = parseTime(timeParts.join(''));
          if (t) {
            for (const d of waitingDays) {
              results.push({ day: d, start: t.start, end: t.end });
            }
          }
          waitingDays = [];
        }
        continue;
      }
    }

    // 남은 대기 요일 → 기본 시간 19-22
    for (const d of waitingDays) {
      results.push({ day: d, start: 19, end: 22 });
    }

    return results;
  }

  function formatSchedule(parsed) {
    if (!parsed || parsed.length === 0) return [];
    return parsed.map(s => `${s.day} ${s.start}-${s.end}시`);
  }

  return { parseSchedule, formatSchedule, toHour24 };
})();
