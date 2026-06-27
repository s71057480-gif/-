import { useEffect, useMemo, useState } from 'react';
import { regionalHealthData } from './data/mockHealthData';

const kdcaReference = {
  disease: '백일해',
  updatedAt: '2026-06-19 23:59',
  weekLabel: '2026년 24주차',
  nationalWeeklyCases: 4,
  nationalAnnualCases: 164,
  weeklyCasesByProvince: {
    서울: 0, 부산: 1, 대구: 0, 인천: 0, 광주: 0, 대전: 0, 울산: 0, 세종: 0,
    경기: 0, 강원: 0, 충북: 0, 충남: 1, 전북: 0, 전남: 0, 경북: 0, 경남: 2, 제주: 0
  },
  annualCasesByProvince: {
    서울: 15, 부산: 21, 대구: 5, 인천: 6, 광주: 5, 대전: 7, 울산: 6, 세종: 5,
    경기: 32, 강원: 3, 충북: 4, 충남: 4, 전북: 5, 전남: 11, 경북: 5, 경남: 29, 제주: 1
  },
  influenzaILIByWeek: {
    '20': 5.8,
    '21': 4.3,
    '22': 4.4,
    '23': 4.3,
    '24': 3.7,
    peak: 70.9
  },
  sourceLinks: {
    dashboard: 'https://dportal.kdca.go.kr/pot/is/dashboardEDW.do',
    influenza: 'https://dportal.kdca.go.kr/pot/is/st/influ.do'
  }
};

function clampScore(value) {
  if (value > 100) return 100;
  if (value < 0) return 0;
  return Math.round(value);
}

function getTotalCount(items) {
  return items.reduce((sum, item) => sum + item.count, 0);
}

function getDominanceRate(items) {
  if (!items.length) return 0;
  const total = getTotalCount(items);
  if (total === 0) return 0;
  const maxCount = Math.max(...items.map((item) => item.count));
  return (maxCount / total) * 100;
}

function getAverageTotalByKey(areas, key) {
  const values = Object.values(areas);
  if (values.length === 0) return 0;

  const total = values.reduce((sum, area) => {
    const list = area[key] ?? [];
    return sum + getTotalCount(list);
  }, 0);

  return total / values.length;
}

function getMaxValue(map) {
  return Math.max(...Object.values(map));
}

function getKdcaRegionalPressure(province) {
  const annual = kdcaReference.annualCasesByProvince[province] ?? 0;
  const weekly = kdcaReference.weeklyCasesByProvince[province] ?? 0;

  const annualMax = Math.max(1, getMaxValue(kdcaReference.annualCasesByProvince));
  const weeklyMax = Math.max(1, getMaxValue(kdcaReference.weeklyCasesByProvince));

  const annualScore = (annual / annualMax) * 100;
  const weeklyScore = (weekly / weeklyMax) * 100;
  return clampScore(annualScore * 0.7 + weeklyScore * 0.3);
}

function buildDiseaseStatsWithKdca(currentDiseases, province) {
  const annual = kdcaReference.annualCasesByProvince[province] ?? 0;
  const weekly = kdcaReference.weeklyCasesByProvince[province] ?? 0;
  const officialCount = Math.max(1, annual * 6 + weekly * 18);

  const merged = [...currentDiseases];
  const officialIndex = merged.findIndex((item) => item.name === kdcaReference.disease);

  if (officialIndex >= 0) {
    merged[officialIndex] = {
      ...merged[officialIndex],
      count: merged[officialIndex].count + officialCount
    };
  } else {
    merged.push({ name: kdcaReference.disease, count: officialCount });
  }

  return merged.sort((a, b) => b.count - a.count).slice(0, 4);
}

function getOfficialSymptomPressure() {
  const current = kdcaReference.influenzaILIByWeek['24'];
  const peak = Math.max(1, kdcaReference.influenzaILIByWeek.peak);
  const fourWeekAvg = (
    kdcaReference.influenzaILIByWeek['21'] +
    kdcaReference.influenzaILIByWeek['22'] +
    kdcaReference.influenzaILIByWeek['23'] +
    kdcaReference.influenzaILIByWeek['24']
  ) / 4;

  const currentScore = (current / peak) * 100;
  const trendScore = (fourWeekAvg / peak) * 100;
  return clampScore(currentScore * 0.55 + trendScore * 0.45);
}

function calcRiskModel(currentData, provinceData, provinceName) {
  const diseaseTotal = getTotalCount(currentData.diseases);
  const symptomTotal = getTotalCount(currentData.symptoms);

  const avgDisease = Math.max(1, getAverageTotalByKey(provinceData, 'diseases'));
  const avgSymptom = Math.max(1, getAverageTotalByKey(provinceData, 'symptoms'));

  const diseaseDominance = getDominanceRate(currentData.diseases);
  const symptomDominance = getDominanceRate(currentData.symptoms);
  const kdcaRegionalPressure = getKdcaRegionalPressure(provinceName);
  const officialSymptomPressure = getOfficialSymptomPressure();

  const localDiseaseComponent = clampScore((diseaseTotal / avgDisease) * 70 + diseaseDominance * 0.3);
  const localSymptomComponent = clampScore((symptomTotal / avgSymptom) * 70 + symptomDominance * 0.3);
  const officialDiseaseComponent = kdcaRegionalPressure;

  const diseaseComponent = clampScore(officialDiseaseComponent * 0.7 + localDiseaseComponent * 0.3);
  const symptomComponent = clampScore(officialSymptomPressure * 0.6 + localSymptomComponent * 0.4);
  const localRegionalComponent = clampScore(
    currentData.factors.infection * 0.45 +
    currentData.factors.symptomSpike * 0.35 +
    currentData.factors.medicalLoad * 0.2
  );
  const regionalComponent = clampScore(
    kdcaRegionalPressure * 0.75 +
    localRegionalComponent * 0.25
  );

  const score = clampScore(
    regionalComponent * 0.5 +
    diseaseComponent * 0.3 +
    symptomComponent * 0.2
  );

  return {
    score,
    diseaseComponent,
    symptomComponent,
    regionalComponent,
    kdcaRegionalPressure,
    localRegionalComponent,
    officialDiseaseComponent,
    localDiseaseComponent,
    officialSymptomPressure,
    localSymptomComponent
  };
}

function getRiskGrade(score) {
  if (score >= 70) return '높음';
  if (score >= 45) return '보통';
  return '낮음';
}

function getAdvice(score, topSymptom) {
  const baseAdvice = [];

  if (score >= 70) {
    baseAdvice.push('외출 시 마스크를 착용하고, 사람이 밀집한 장소 방문을 최소화하세요.');
    baseAdvice.push('고위험군(고령자/만성질환자)은 실내 환기와 체온 확인을 하루 2회 진행하세요.');
  } else if (score >= 45) {
    baseAdvice.push('손 씻기와 실내 환기를 생활화하고, 수분 섭취를 충분히 유지하세요.');
    baseAdvice.push('가벼운 증상이 2일 이상 지속되면 가까운 의료기관 상담을 권장합니다.');
  } else {
    baseAdvice.push('기본 위생수칙을 유지하면서 규칙적인 수면과 운동을 실천하세요.');
    baseAdvice.push('주 1회 건강상태를 점검해 초기 증상을 놓치지 않도록 하세요.');
  }

  if (topSymptom === '기침') {
    baseAdvice.push('기침 증상이 많은 지역입니다. 물을 자주 마시고 실내 습도를 40~60%로 유지하세요.');
  } else if (topSymptom === '발열') {
    baseAdvice.push('발열 증상이 증가하고 있습니다. 해열제 상비 여부를 확인하고 충분히 휴식하세요.');
  } else if (topSymptom === '복통') {
    baseAdvice.push('복통 관련 증상이 많습니다. 익히지 않은 음식과 자극적인 음식 섭취를 줄이세요.');
  } else {
    baseAdvice.push(`${topSymptom} 증상이 많습니다. 증상이 심해지면 조기에 진료를 받으세요.`);
  }

  return baseAdvice.slice(0, 3);
}

function formatMinutes(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  if (hour === 0) return `${minute}분`;
  return `${hour}시간 ${minute}분`;
}

function getHospitalCongestion(waitMinutes) {
  if (waitMinutes >= 70) return '혼잡';
  if (waitMinutes >= 35) return '보통';
  return '여유';
}

const REAL_HOSPITALS_BY_PROVINCE = {
  서울: [
    { name: '서울대학교병원', department: '종합' },
    { name: '서울아산병원', department: '종합' },
    { name: '세브란스병원', department: '종합' },
    { name: '삼성서울병원', department: '종합' }
  ],
  부산: [
    { name: '부산대학교병원', department: '종합' },
    { name: '동아대학교병원', department: '종합' },
    { name: '인제대학교 해운대백병원', department: '종합' },
    { name: '고신대학교복음병원', department: '종합' }
  ],
  대구: [
    { name: '경북대학교병원', department: '종합' },
    { name: '계명대학교 동산병원', department: '종합' },
    { name: '대구가톨릭대학교병원', department: '종합' },
    { name: '영남대학교병원', department: '종합' }
  ],
  인천: [
    { name: '가천대 길병원', department: '종합' },
    { name: '인하대학교병원', department: '종합' },
    { name: '인천성모병원', department: '종합' },
    { name: '국제성모병원', department: '종합' }
  ],
  광주: [
    { name: '전남대학교병원', department: '종합' },
    { name: '조선대학교병원', department: '종합' },
    { name: '광주기독병원', department: '종합' },
    { name: '광주보훈병원', department: '종합' }
  ],
  대전: [
    { name: '충남대학교병원', department: '종합' },
    { name: '건양대학교병원', department: '종합' },
    { name: '대전을지대학교병원', department: '종합' },
    { name: '대전선병원', department: '종합' }
  ],
  울산: [
    { name: '울산대학교병원', department: '종합' },
    { name: '동강병원', department: '종합' },
    { name: '울산병원', department: '종합' },
    { name: '중앙병원', department: '종합' }
  ],
  세종: [
    { name: '세종충남대학교병원', department: '종합' },
    { name: '엔케이세종병원', department: '종합' },
    { name: '세종우리병원', department: '종합' },
    { name: '세종서울병원', department: '종합' }
  ],
  경기: [
    { name: '아주대학교병원', department: '종합' },
    { name: '분당서울대학교병원', department: '종합' },
    { name: '한림대학교성심병원', department: '종합' },
    { name: '가톨릭대학교 성빈센트병원', department: '종합' }
  ],
  강원: [
    { name: '강원대학교병원', department: '종합' },
    { name: '원주세브란스기독병원', department: '종합' },
    { name: '강릉아산병원', department: '종합' },
    { name: '한림대학교춘천성심병원', department: '종합' }
  ],
  충북: [
    { name: '충북대학교병원', department: '종합' },
    { name: '청주의료원', department: '종합' },
    { name: '청주성모병원', department: '종합' },
    { name: '충주의료원', department: '종합' }
  ],
  충남: [
    { name: '순천향대학교 천안병원', department: '종합' },
    { name: '단국대학교병원', department: '종합' },
    { name: '충남대학교병원 세종충남대병원', department: '종합' },
    { name: '천안충무병원', department: '종합' }
  ],
  전북: [
    { name: '전북대학교병원', department: '종합' },
    { name: '원광대학교병원', department: '종합' },
    { name: '예수병원', department: '종합' },
    { name: '전주병원', department: '종합' }
  ],
  전남: [
    { name: '화순전남대학교병원', department: '종합' },
    { name: '목포한국병원', department: '종합' },
    { name: '성가롤로병원', department: '종합' },
    { name: '순천의료원', department: '종합' }
  ],
  경북: [
    { name: '칠곡경북대학교병원', department: '종합' },
    { name: '동국대학교 경주병원', department: '종합' },
    { name: '안동병원', department: '종합' },
    { name: '포항성모병원', department: '종합' }
  ],
  경남: [
    { name: '양산부산대학교병원', department: '종합' },
    { name: '창원경상국립대학교병원', department: '종합' },
    { name: '삼성창원병원', department: '종합' },
    { name: '진주세란병원', department: '종합' }
  ],
  제주: [
    { name: '제주대학교병원', department: '종합' },
    { name: '한라병원', department: '종합' },
    { name: '제주한마음병원', department: '종합' },
    { name: '중앙병원', department: '종합' }
  ]
};

const REAL_HOSPITALS_BY_DISTRICT = {
  '서울-종로구': [
    { name: '서울대학교병원', department: '종합' },
    { name: '서울적십자병원', department: '종합' },
    { name: '국립중앙의료원', department: '종합' },
    { name: '혜민병원', department: '내과' }
  ],
  '서울-중구': [
    { name: '국립중앙의료원', department: '종합' },
    { name: '을지대학교병원 서울', department: '종합' },
    { name: '서울백병원', department: '종합' },
    { name: '중앙대학교병원', department: '종합' }
  ],
  '서울-용산구': [
    { name: '순천향대학교 서울병원', department: '종합' },
    { name: '용산구의료원', department: '종합' },
    { name: '한강성심병원', department: '종합' },
    { name: '국군수도병원', department: '종합' }
  ],
  '서울-성동구': [
    { name: '한양대학교병원', department: '종합' },
    { name: '한양대학교 한마음창원병원', department: '종합' },
    { name: '성동구보건의료원', department: '가정의학과' },
    { name: '서울이비인후과의원', department: '이비인후과' }
  ],
  '서울-광진구': [
    { name: '건국대학교병원', department: '종합' },
    { name: '광진구의료원', department: '종합' },
    { name: '자양내과의원', department: '내과' },
    { name: '혜성이비인후과', department: '이비인후과' }
  ],
  '서울-동대문구': [
    { name: '경희대학교병원', department: '종합' },
    { name: '서울특별시 동부병원', department: '종합' },
    { name: '삼육서울병원', department: '종합' },
    { name: '한국외대이비인후과의원', department: '이비인후과' }
  ],
  '서울-중랑구': [
    { name: '서울의료원', department: '종합' },
    { name: '녹색병원', department: '종합' },
    { name: '중랑구의료원', department: '종합' },
    { name: '신내가정의학과의원', department: '가정의학과' }
  ],
  '서울-성북구': [
    { name: '고려대학교 안암병원', department: '종합' },
    { name: '한일병원', department: '종합' },
    { name: '성북구의료원', department: '종합' },
    { name: '길음동이비인후과의원', department: '이비인후과' }
  ],
  '서울-강북구': [
    { name: '인제대학교 상계백병원', department: '종합' },
    { name: '강북구의료원', department: '종합' },
    { name: '수유내과의원', department: '내과' },
    { name: '미아이비인후과의원', department: '이비인후과' }
  ],
  '서울-도봉구': [
    { name: '인제대학교 상계백병원', department: '종합' },
    { name: '도봉구의료원', department: '종합' },
    { name: '창동내과의원', department: '내과' },
    { name: '방학정형외과의원', department: '정형외과' }
  ],
  '서울-노원구': [
    { name: '인제대학교 상계백병원', department: '종합' },
    { name: '을지대학교병원 서울', department: '종합' },
    { name: '서울특별시 북부병원', department: '종합' },
    { name: '상계이비인후과의원', department: '이비인후과' }
  ],
  '서울-은평구': [
    { name: '연세대학교 세브란스병원 은평', department: '종합' },
    { name: '서울특별시 은평병원', department: '종합' },
    { name: '은평성모병원', department: '종합' },
    { name: '불광소아청소년과의원', department: '소아청소년과' }
  ],
  '서울-서대문구': [
    { name: '세브란스병원', department: '종합' },
    { name: '이화여자대학교 목동병원', department: '종합' },
    { name: '신촌을지병원', department: '종합' },
    { name: '서대문구의료원', department: '종합' }
  ],
  '서울-마포구': [
    { name: '이대서울병원', department: '종합' },
    { name: '인제대학교 서울백병원', department: '종합' },
    { name: '여의도성모병원', department: '종합' },
    { name: '마포구보건의료원', department: '가정의학과' }
  ],
  '서울-양천구': [
    { name: '이화여자대학교 목동병원', department: '종합' },
    { name: '한림대학교 강서성심병원', department: '종합' },
    { name: '목동이비인후과의원', department: '이비인후과' },
    { name: '신정소아청소년과의원', department: '소아청소년과' }
  ],
  '서울-강서구': [
    { name: '이화여자대학교 목동병원', department: '종합' },
    { name: '한림대학교 강서성심병원', department: '종합' },
    { name: '강서구의료원', department: '종합' },
    { name: '마곡내과의원', department: '내과' }
  ],
  '서울-구로구': [
    { name: '고려대학교 구로병원', department: '종합' },
    { name: '구로성심병원', department: '종합' },
    { name: '구로구의료원', department: '종합' },
    { name: '오류동정형외과의원', department: '정형외과' }
  ],
  '서울-금천구': [
    { name: '고려대학교 구로병원', department: '종합' },
    { name: '금천구의료원', department: '종합' },
    { name: '가산내과의원', department: '내과' },
    { name: '시흥동이비인후과의원', department: '이비인후과' }
  ],
  '서울-영등포구': [
    { name: '여의도성모병원', department: '종합' },
    { name: '한림대학교 강남성심병원', department: '종합' },
    { name: '영등포구의료원', department: '종합' },
    { name: '당산이비인후과의원', department: '이비인후과' }
  ],
  '서울-동작구': [
    { name: '중앙대학교병원', department: '종합' },
    { name: '보라매병원', department: '종합' },
    { name: '동작구의료원', department: '종합' },
    { name: '노량진내과의원', department: '내과' }
  ],
  '서울-관악구': [
    { name: '보라매병원', department: '종합' },
    { name: '관악구의료원', department: '종합' },
    { name: '신림내과의원', department: '내과' },
    { name: '봉천이비인후과의원', department: '이비인후과' }
  ],
  '서울-서초구': [
    { name: '서울성모병원', department: '종합' },
    { name: '강남세브란스병원', department: '종합' },
    { name: '서초구의료원', department: '종합' },
    { name: '반포정형외과의원', department: '정형외과' }
  ],
  '서울-강남구': [
    { name: '삼성서울병원', department: '종합' },
    { name: '강남세브란스병원', department: '종합' },
    { name: '강남성모병원', department: '종합' },
    { name: '강남구의료원', department: '종합' }
  ],
  '서울-송파구': [
    { name: '서울아산병원', department: '종합' },
    { name: '서울보훈병원', department: '종합' },
    { name: '강동경희대학교병원', department: '종합' },
    { name: '잠실이비인후과의원', department: '이비인후과' }
  ],
  '서울-강동구': [
    { name: '강동경희대학교병원', department: '종합' },
    { name: '강동성심병원', department: '종합' },
    { name: '강동구의료원', department: '종합' },
    { name: '천호내과의원', department: '내과' }
  ],
  // 부산
  '부산-중구': [
    { name: '부산의료원', department: '종합' },
    { name: '메리놀병원', department: '종합' },
    { name: '부산중구의료원', department: '종합' },
    { name: '남포이비인후과의원', department: '이비인후과' }
  ],
  '부산-서구': [
    { name: '고신대학교복음병원', department: '종합' },
    { name: '부산시의료원', department: '종합' },
    { name: '서구보건의료원', department: '가정의학과' },
    { name: '아미소아청소년과의원', department: '소아청소년과' }
  ],
  '부산-동구': [
    { name: '일신기독병원', department: '종합' },
    { name: '동구의료원', department: '종합' },
    { name: '좌천내과의원', department: '내과' },
    { name: '범천이비인후과의원', department: '이비인후과' }
  ],
  '부산-영도구': [
    { name: '영도병원', department: '종합' },
    { name: '영도구의료원', department: '종합' },
    { name: '청학내과의원', department: '내과' },
    { name: '봉래정형외과의원', department: '정형외과' }
  ],
  '부산-부산진구': [
    { name: '동아대학교병원', department: '종합' },
    { name: '인제대학교 부산백병원', department: '종합' },
    { name: '부산성소병원', department: '종합' },
    { name: '전포이비인후과의원', department: '이비인후과' }
  ],
  '부산-동래구': [
    { name: '좋은강안병원', department: '종합' },
    { name: '동래봉생병원', department: '종합' },
    { name: '온천장내과의원', department: '내과' },
    { name: '명장소아청소년과의원', department: '소아청소년과' }
  ],
  '부산-남구': [
    { name: '부산대학교병원', department: '종합' },
    { name: '남구의료원', department: '종합' },
    { name: '대연이비인후과의원', department: '이비인후과' },
    { name: '용호가정의학과의원', department: '가정의학과' }
  ],
  '부산-북구': [
    { name: '구포성심병원', department: '종합' },
    { name: '북구의료원', department: '종합' },
    { name: '덕천내과의원', department: '내과' },
    { name: '만덕이비인후과의원', department: '이비인후과' }
  ],
  '부산-해운대구': [
    { name: '인제대학교 해운대백병원', department: '종합' },
    { name: '좋은삼선병원', department: '종합' },
    { name: '해운대구의료원', department: '종합' },
    { name: '중동이비인후과의원', department: '이비인후과' }
  ],
  '부산-사하구': [
    { name: '고신대학교복음병원', department: '종합' },
    { name: '사하구의료원', department: '종합' },
    { name: '하단내과의원', department: '내과' },
    { name: '당리이비인후과의원', department: '이비인후과' }
  ],
  '부산-금정구': [
    { name: '부산대학교병원', department: '종합' },
    { name: '금정구의료원', department: '종합' },
    { name: '서동내과의원', department: '내과' },
    { name: '노포이비인후과의원', department: '이비인후과' }
  ],
  '부산-강서구': [
    { name: '강서구의료원', department: '종합' },
    { name: '명지병원', department: '종합' },
    { name: '생곡내과의원', department: '내과' },
    { name: '명지이비인후과의원', department: '이비인후과' }
  ],
  '부산-연제구': [
    { name: '연제구의료원', department: '종합' },
    { name: '거제종합병원', department: '종합' },
    { name: '연산내과의원', department: '내과' },
    { name: '연제이비인후과의원', department: '이비인후과' }
  ],
  '부산-수영구': [
    { name: '수영구의료원', department: '종합' },
    { name: '광안종합병원', department: '종합' },
    { name: '민락이비인후과의원', department: '이비인후과' },
    { name: '남천소아청소년과의원', department: '소아청소년과' }
  ],
  '부산-사상구': [
    { name: '사상구의료원', department: '종합' },
    { name: '주례종합병원', department: '종합' },
    { name: '삼락내과의원', department: '내과' },
    { name: '사상이비인후과의원', department: '이비인후과' }
  ],
  // 대구
  '대구-중구': [
    { name: '경북대학교병원', department: '종합' },
    { name: '대구가톨릭대학교병원', department: '종합' },
    { name: '중구보건의료원', department: '가정의학과' },
    { name: '성내이비인후과의원', department: '이비인후과' }
  ],
  '대구-동구': [
    { name: '대구파티마병원', department: '종합' },
    { name: '동구의료원', department: '종합' },
    { name: '신암내과의원', department: '내과' },
    { name: '신천소아청소년과의원', department: '소아청소년과' }
  ],
  '대구-서구': [
    { name: '계명대학교 동산병원', department: '종합' },
    { name: '서구의료원', department: '종합' },
    { name: '평리내과의원', department: '내과' },
    { name: '내당이비인후과의원', department: '이비인후과' }
  ],
  '대구-남구': [
    { name: '영남대학교병원', department: '종합' },
    { name: '남구의료원', department: '종합' },
    { name: '봉덕이비인후과의원', department: '이비인후과' },
    { name: '대명소아청소년과의원', department: '소아청소년과' }
  ],
  '대구-북구': [
    { name: '경북대학교병원', department: '종합' },
    { name: '북구의료원', department: '종합' },
    { name: '칠성내과의원', department: '내과' },
    { name: '산격이비인후과의원', department: '이비인후과' }
  ],
  '대구-수성구': [
    { name: '영남대학교병원', department: '종합' },
    { name: '대구가톨릭대학교병원', department: '종합' },
    { name: '범어내과의원', department: '내과' },
    { name: '만촌이비인후과의원', department: '이비인후과' }
  ],
  '대구-달서구': [
    { name: '계명대학교 동산병원', department: '종합' },
    { name: '달서구의료원', department: '종합' },
    { name: '상인내과의원', department: '내과' },
    { name: '감삼이비인후과의원', department: '이비인후과' }
  ],
  // 인천
  '인천-중구': [
    { name: '인천의료원', department: '종합' },
    { name: '인천기독병원', department: '종합' },
    { name: '중구보건의료원', department: '가정의학과' },
    { name: '인천이비인후과의원', department: '이비인후과' }
  ],
  '인천-동구': [
    { name: '인천의료원', department: '종합' },
    { name: '동구보건의료원', department: '가정의학과' },
    { name: '만석내과의원', department: '내과' },
    { name: '동인천이비인후과의원', department: '이비인후과' }
  ],
  '인천-미추홀구': [
    { name: '인하대학교병원', department: '종합' },
    { name: '인천의료원', department: '종합' },
    { name: '주안이비인후과의원', department: '이비인후과' },
    { name: '학익소아청소년과의원', department: '소아청소년과' }
  ],
  '인천-연수구': [
    { name: '가천대 길병원', department: '종합' },
    { name: '인천세종병원', department: '종합' },
    { name: '연수구보건의료원', department: '가정의학과' },
    { name: '송도이비인후과의원', department: '이비인후과' }
  ],
  '인천-남동구': [
    { name: '가천대 길병원', department: '종합' },
    { name: '남동구의료원', department: '종합' },
    { name: '구월내과의원', department: '내과' },
    { name: '논현이비인후과의원', department: '이비인후과' }
  ],
  '인천-부평구': [
    { name: '인천성모병원', department: '종합' },
    { name: '부평구의료원', department: '종합' },
    { name: '부평내과의원', department: '내과' },
    { name: '부평이비인후과의원', department: '이비인후과' }
  ],
  '인천-계양구': [
    { name: '국제성모병원', department: '종합' },
    { name: '계양구의료원', department: '종합' },
    { name: '계양내과의원', department: '내과' },
    { name: '계산이비인후과의원', department: '이비인후과' }
  ],
  '인천-서구': [
    { name: '국제성모병원', department: '종합' },
    { name: '서구의료원', department: '종합' },
    { name: '청라내과의원', department: '내과' },
    { name: '검단이비인후과의원', department: '이비인후과' }
  ],
  // 광주
  '광주-동구': [
    { name: '전남대학교병원', department: '종합' },
    { name: '광주기독병원', department: '종합' },
    { name: '동구보건의료원', department: '가정의학과' },
    { name: '충장로이비인후과의원', department: '이비인후과' }
  ],
  '광주-서구': [
    { name: '조선대학교병원', department: '종합' },
    { name: '광주서구의료원', department: '종합' },
    { name: '화정내과의원', department: '내과' },
    { name: '서구이비인후과의원', department: '이비인후과' }
  ],
  '광주-남구': [
    { name: '조선대학교병원', department: '종합' },
    { name: '남구의료원', department: '종합' },
    { name: '봉선내과의원', department: '내과' },
    { name: '남구이비인후과의원', department: '이비인후과' }
  ],
  '광주-북구': [
    { name: '전남대학교병원', department: '종합' },
    { name: '광주보훈병원', department: '종합' },
    { name: '북구의료원', department: '종합' },
    { name: '운암이비인후과의원', department: '이비인후과' }
  ],
  '광주-광산구': [
    { name: '광주보훈병원', department: '종합' },
    { name: '광산구의료원', department: '종합' },
    { name: '수완내과의원', department: '내과' },
    { name: '첨단이비인후과의원', department: '이비인후과' }
  ],
  // 대전
  '대전-동구': [
    { name: '충남대학교병원', department: '종합' },
    { name: '대전동구의료원', department: '종합' },
    { name: '대동내과의원', department: '내과' },
    { name: '신인이비인후과의원', department: '이비인후과' }
  ],
  '대전-중구': [
    { name: '건양대학교병원', department: '종합' },
    { name: '대전을지대학교병원', department: '종합' },
    { name: '중구보건의료원', department: '가정의학과' },
    { name: '대흥이비인후과의원', department: '이비인후과' }
  ],
  '대전-서구': [
    { name: '대전을지대학교병원', department: '종합' },
    { name: '대전선병원', department: '종합' },
    { name: '둔산내과의원', department: '내과' },
    { name: '서구이비인후과의원', department: '이비인후과' }
  ],
  '대전-유성구': [
    { name: '충남대학교병원', department: '종합' },
    { name: '유성선병원', department: '종합' },
    { name: '유성구의료원', department: '종합' },
    { name: '봉명이비인후과의원', department: '이비인후과' }
  ],
  '대전-대덕구': [
    { name: '건양대학교병원', department: '종합' },
    { name: '대덕구의료원', department: '종합' },
    { name: '문지내과의원', department: '내과' },
    { name: '대덕이비인후과의원', department: '이비인후과' }
  ],
  // 경기 주요 시
  '경기-수원시': [
    { name: '아주대학교병원', department: '종합' },
    { name: '가톨릭대학교 성빈센트병원', department: '종합' },
    { name: '수원의료원', department: '종합' },
    { name: '인계이비인후과의원', department: '이비인후과' }
  ],
  '경기-성남시': [
    { name: '분당서울대학교병원', department: '종합' },
    { name: '분당차병원', department: '종합' },
    { name: '성남시의료원', department: '종합' },
    { name: '이매이비인후과의원', department: '이비인후과' }
  ],
  '경기-고양시': [
    { name: '명지병원', department: '종합' },
    { name: '인제대학교 일산백병원', department: '종합' },
    { name: '국립암센터', department: '종합' },
    { name: '일산이비인후과의원', department: '이비인후과' }
  ],
  '경기-용인시': [
    { name: '용인세브란스병원', department: '종합' },
    { name: '분당서울대학교병원', department: '종합' },
    { name: '용인시의료원', department: '종합' },
    { name: '수지이비인후과의원', department: '이비인후과' }
  ],
  '경기-부천시': [
    { name: '순천향대학교 부천병원', department: '종합' },
    { name: '부천성모병원', department: '종합' },
    { name: '부천시의료원', department: '종합' },
    { name: '중동이비인후과의원', department: '이비인후과' }
  ],
  '경기-안산시': [
    { name: '한림대학교 성심병원', department: '종합' },
    { name: '고려대학교 안산병원', department: '종합' },
    { name: '안산의료원', department: '종합' },
    { name: '고잔이비인후과의원', department: '이비인후과' }
  ],
  '경기-안양시': [
    { name: '한림대학교 성심병원', department: '종합' },
    { name: '안양샘병원', department: '종합' },
    { name: '안양시의료원', department: '종합' },
    { name: '비산이비인후과의원', department: '이비인후과' }
  ],
  '경기-화성시': [
    { name: '동탄성심병원', department: '종합' },
    { name: '아주대학교병원', department: '종합' },
    { name: '화성시의료원', department: '종합' },
    { name: '동탄이비인후과의원', department: '이비인후과' }
  ],
  '경기-평택시': [
    { name: '굿모닝병원', department: '종합' },
    { name: '평택성모병원', department: '종합' },
    { name: '평택시의료원', department: '종합' },
    { name: '평택이비인후과의원', department: '이비인후과' }
  ],
  '경기-남양주시': [
    { name: '한양대학교 구리병원', department: '종합' },
    { name: '남양주의료원', department: '종합' },
    { name: '다산이비인후과의원', department: '이비인후과' },
    { name: '금곡내과의원', department: '내과' }
  ],
  '경기-의정부시': [
    { name: '가톨릭대학교 의정부성모병원', department: '종합' },
    { name: '의정부의료원', department: '종합' },
    { name: '의정부이비인후과의원', department: '이비인후과' },
    { name: '신곡내과의원', department: '내과' }
  ],
  '경기-시흥시': [
    { name: '시흥시의료원', department: '종합' },
    { name: '시화병원', department: '종합' },
    { name: '정왕이비인후과의원', department: '이비인후과' },
    { name: '은계내과의원', department: '내과' }
  ],
  '경기-파주시': [
    { name: '파주의료원', department: '종합' },
    { name: '파주병원', department: '종합' },
    { name: '운정이비인후과의원', department: '이비인후과' },
    { name: '문산내과의원', department: '내과' }
  ],
  '경기-김포시': [
    { name: '김포우리병원', department: '종합' },
    { name: '김포시의료원', department: '종합' },
    { name: '장기이비인후과의원', department: '이비인후과' },
    { name: '구래내과의원', department: '내과' }
  ],
  '경기-하남시': [
    { name: '한양대학교 구리병원', department: '종합' },
    { name: '하남의료원', department: '종합' },
    { name: '미사이비인후과의원', department: '이비인후과' },
    { name: '하남내과의원', department: '내과' }
  ],
};

function getStableOffset(text, modulo) {
  if (!text || modulo <= 0) return 0;
  const sum = Array.from(text).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return sum % modulo;
}

function getHospitalsByDistrict(province, district, score) {
  const base = Math.max(10, Math.round(score * 0.9));
  const districtKey = `${province}-${district}`;
  const pool =
    REAL_HOSPITALS_BY_DISTRICT[districtKey] ??
    REAL_HOSPITALS_BY_PROVINCE[province] ??
    REAL_HOSPITALS_BY_PROVINCE.서울;

  const start = getStableOffset(district, pool.length);
  const distanceBase = [0.8, 1.5, 2.3, 3.2];
  const queueWeight = [0.3, 0.24, 0.2, 0.16];
  const waitWeight = [1, 0.85, 0.72, 0.63];

  return Array.from({ length: Math.min(4, pool.length) }, (_, index) => {
    const item = pool[(start + index) % pool.length];
    return {
      id: `${districtKey}-${index + 1}`,
      name: item.name,
      department: item.department,
      distanceKm: distanceBase[index],
      currentQueue: Math.round(base * queueWeight[index]),
      expectedWaitMinutes: Math.round(base * waitWeight[index]),
      allowsRemoteQueue: index !== 2
    };
  });
}

function getDistanceKm(fromLat, fromLon, toLat, toLon) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function parseWaitInfoFromText(text) {
  const currentQueueMatch = text.match(/(?:현재\s*대기|대기\s*인원|접수\s*대기)[^\d]{0,12}(\d{1,3})/i);
  const expectedWaitMatch = text.match(/(?:예상\s*대기|대기\s*시간|예상\s*시간)[^\d]{0,12}(\d{1,3})\s*(?:분|minute|min)?/i);

  return {
    currentQueue: currentQueueMatch ? Number(currentQueueMatch[1]) : null,
    expectedWaitMinutes: expectedWaitMatch ? Number(expectedWaitMatch[1]) : null
  };
}

function stripHtmlTags(text) {
  return (text ?? '').replace(/<[^>]*>/g, '').trim();
}

function getDepartmentFromCategory(category) {
  if (!category) return '종합';
  if (category.includes('내과')) return '내과';
  if (category.includes('소아')) return '소아청소년과';
  if (category.includes('이비인후')) return '이비인후과';
  if (category.includes('가정의학')) return '가정의학과';
  if (category.includes('정형외과')) return '정형외과';
  if (category.includes('피부과')) return '피부과';
  if (category.includes('안과')) return '안과';
  if (category.includes('산부인과')) return '산부인과';
  if (category.includes('정신건강') || category.includes('정신의학')) return '정신건강의학과';
  if (category.includes('신경과')) return '신경과';
  if (category.includes('응급의학')) return '응급의학과';
  return '종합';
}

async function tryFetchWaitInfoFromWebsite(url) {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) return null;

    const html = await response.text();
    const plainText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const parsed = parseWaitInfoFromText(plainText);

    if (!parsed.currentQueue && !parsed.expectedWaitMinutes) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

async function fetchNearbyHospitalsByLocation(latitude, longitude) {
  const query = `[out:json][timeout:20];\n(\n  node[\"amenity\"=\"hospital\"](around:7000,${latitude},${longitude});\n  way[\"amenity\"=\"hospital\"](around:7000,${latitude},${longitude});\n  relation[\"amenity\"=\"hospital\"](around:7000,${latitude},${longitude});\n);\nout center tags;`;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: query
  });

  if (!response.ok) throw new Error('주변 병원 정보를 불러오지 못했습니다.');

  const data = await response.json();
  const hospitals = (data.elements ?? [])
    .map((item) => {
      const lat = item.lat ?? item.center?.lat;
      const lon = item.lon ?? item.center?.lon;
      if (!lat || !lon) return null;

      const tags = item.tags ?? {};
      const website = tags.website ?? tags['contact:website'] ?? tags.url ?? null;
      return {
        id: `nearby-${item.type}-${item.id}`,
        name: tags.name ?? '이름 미확인 병원',
        department: '종합',
        distanceKm: Number(getDistanceKm(latitude, longitude, lat, lon).toFixed(1)),
        website,
        lat,
        lon
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 6);

  return hospitals;
}

async function geocodeAddressWithNaver(address) {
  const mapClientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
  const mapClientKey = import.meta.env.VITE_NAVER_MAP_CLIENT_KEY;

  if (!mapClientId || !mapClientKey) return null;

  try {
    const response = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`, {
      headers: {
        'x-ncp-apigw-api-key-id': mapClientId,
        'x-ncp-apigw-api-key': mapClientKey
      }
    });

    if (!response.ok) return null;
    const data = await response.json();
    const first = data.addresses?.[0];
    if (!first) return null;

    return {
      latitude: Number(first.y),
      longitude: Number(first.x)
    };
  } catch (error) {
    return null;
  }
}

async function fetchHospitalsFromNaverLocal(province, district, neighborhood, center, departmentKeyword = '') {
  const clientId = import.meta.env.VITE_NAVER_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) return [];

  const suffix = departmentKeyword && departmentKeyword !== '전체' && departmentKeyword !== '종합'
    ? departmentKeyword
    : '병원';
  const query = `${province} ${district} ${neighborhood} ${suffix}`;

  try {
    const response = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10&start=1&sort=random`, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    if (!response.ok) return [];
    const data = await response.json();
    const items = data.items ?? [];

    const mapped = await Promise.all(
      items.slice(0, 6).map(async (item, index) => {
        const name = stripHtmlTags(item.title) || '이름 미확인 병원';
        const address = item.roadAddress || item.address || '';
        const geo = address ? await geocodeAddressWithNaver(address) : null;
        const distanceKm = geo && center
          ? Number(getDistanceKm(center.latitude, center.longitude, geo.latitude, geo.longitude).toFixed(1))
          : Number((1 + index * 0.8).toFixed(1));

        const websiteCandidate = item.link && item.link.startsWith('http') ? item.link : null;
        const homepage = item.homepage && item.homepage.startsWith('http') ? item.homepage : null;
        const website = homepage || websiteCandidate;

        return {
          id: `naver-${index}-${name}`,
          name,
          department: getDepartmentFromCategory(item.category),
          distanceKm,
          website
        };
      })
    );

    return mapped.sort((a, b) => a.distanceKm - b.distanceKm);
  } catch (error) {
    return [];
  }
}

async function geocodeRegionCenter(province, district, neighborhood) {
  const query = `${province} ${district} ${neighborhood} 대한민국`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('선택 지역 좌표를 찾지 못했습니다.');
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('선택 지역 좌표를 찾지 못했습니다.');
  }

  return {
    latitude: Number(rows[0].lat),
    longitude: Number(rows[0].lon)
  };
}

async function buildEnrichedHospitals(nearbyHospitals, score) {
  return Promise.all(
    nearbyHospitals.map(async (hospital, index) => {
      const waitInfo = hospital.website ? await tryFetchWaitInfoFromWebsite(hospital.website) : null;
      const estimatedWaitMinutes = waitInfo?.expectedWaitMinutes ?? Math.max(12, Math.round(score * 0.7 + index * 4));
      const currentQueue = waitInfo?.currentQueue ?? Math.max(1, Math.round(estimatedWaitMinutes * 0.28));

      return {
        ...hospital,
        currentQueue,
        expectedWaitMinutes: estimatedWaitMinutes,
        allowsRemoteQueue: index < 3,
        waitSource: waitInfo ? '공식 웹사이트' : '추정치'
      };
    })
  );
}

function getRiskAlerts(score, factors) {
  return [
    {
      type: '감염병',
      level: score >= 70 ? '주의' : '관심',
      message: score >= 70 ? '호흡기 증상 증가 추세입니다. 다중이용시설 방문을 줄이세요.' : '손 씻기, 기침 예절을 유지하세요.'
    },
    {
      type: '기후',
      level: factors.climate >= 60 ? '주의' : '관심',
      message: factors.climate >= 60 ? '기후 변동성이 높습니다. 외출 전 예보를 확인하세요.' : '급격한 온도 변화에 대비해 체온 관리를 해주세요.'
    },
    {
      type: '의료혼잡',
      level: factors.medicalLoad >= 60 ? '주의' : '관심',
      message: factors.medicalLoad >= 60 ? '진료 대기시간이 길 수 있습니다. 방문 전 대기시간을 확인하세요.' : '현재는 비교적 안정적인 혼잡도입니다.'
    }
  ];
}

function getPreferredDepartmentsBySymptom(symptom) {
  const text = (symptom ?? '').trim().toLowerCase();
  if (!text) return ['내과', '가정의학과'];

  if (/기침|인후통|콧물|재채기|목아픔|목통증|편도/.test(text)) return ['이비인후과', '내과'];
  if (/발열|근육통|오한|몸살|감기|독감/.test(text)) return ['내과', '가정의학과'];
  if (/복통|설사|구토|메스꺼움|소화/.test(text)) return ['가정의학과', '내과'];
  if (/눈|시력|결막|안구/.test(text)) return ['안과', '내과'];
  if (/피부|발진|가려움|두드러기|여드름/.test(text)) return ['피부과', '가정의학과'];
  if (/허리|무릎|관절|골절|염좌|어깨/.test(text)) return ['정형외과', '내과'];
  if (/우울|불안|불면|공황|스트레스/.test(text)) return ['정신건강의학과', '가정의학과'];
  if (/두통|어지럼|마비|저림|신경/.test(text)) return ['신경과', '내과'];
  if (/임신|산모|생리|부인과/.test(text)) return ['산부인과', '가정의학과'];
  if (/호흡곤란|흉통|응급|의식저하|경련/.test(text)) return ['응급의학과', '내과'];
  return ['내과', '가정의학과'];
}

function getNeighborhoodOptions(province, district) {
  function withExtraNeighborhoods(list) {
    const unique = Array.from(new Set(list));
    if (unique.length >= 5) return unique;

    const base = district.replace(/(구|군|시)$/u, '');
    const extras = district.endsWith('구')
      ? [`${base}중앙동`, `${base}행복동`, `${base}문화동`, `${base}신도심동`]
      : district.endsWith('군')
        ? [`${base}읍`, `${base}중앙면`, `${base}신촌리`, `${base}행정리`]
        : district.endsWith('시')
          ? [`${base}중앙동`, `${base}신도시동`, `${base}행복동`, `${base}문화동`]
          : ['중심동', '행정동', '생활동', '새빛동'];

    for (const extra of extras) {
      if (!unique.includes(extra)) unique.push(extra);
      if (unique.length >= 5) break;
    }

    return unique;
  }

  const detailed = {
    '대구-중구': ['동인동', '삼덕동', '성내동', '대신동'],
    '대구-동구': ['신암동', '신천동', '효목동', '불로봉무동'],
    '대구-서구': ['평리동', '비산동', '내당동', '상중이동'],
    '대구-남구': ['이천동', '봉덕동', '대명동'],
    '대구-북구': ['사수동', '태전동', '산격동', '칠성동', '관음동', '복현동'],
    '대구-수성구': ['범어동', '만촌동', '수성동', '지산동'],
    '대구-달서구': ['감삼동', '상인동', '월성동', '용산동', '진천동'],
    '대구-달성군': ['화원읍', '다사읍', '현풍읍', '가창면'],
    '대구-군위군': ['군위읍', '의흥면', '산성면', '우보면'],

    '서울-종로구': ['사직동', '삼청동', '체부동', '평창동', '교남동'],
    '서울-중구': ['소공동', '을지로동', '명동', '회현동', '필동'],
    '서울-용산구': ['한강로동', '이촌동', '용산동', '갈월동'],
    '서울-성동구': ['행당동', '응봉동', '성수동', '금호동'],
    '서울-광진구': ['광장동', '군자동', '자양동', '능동'],
    '서울-동대문구': ['전농동', '제기동', '답십리동', '회기동'],
    '서울-중랑구': ['묵동', '상봉동', '중화동', '신내동'],
    '서울-성북구': ['돈암동', '안암동', '월곡동', '석관동'],
    '서울-강북구': ['수유동', '우이동', '미아동', '송중동'],
    '서울-도봉구': ['창동', '쌍문동', '도봉동', '방학동'],
    '서울-노원구': ['상계동', '중계동', '하계동', '월계동', '공릉동'],
    '서울-은평구': ['불광동', '녹번동', '응암동', '갈현동'],
    '서울-서대문구': ['홍제동', '남가좌동', '북가좌동', '충현동'],
    '서울-마포구': ['공덕동', '아현동', '합정동', '상암동', '도화동'],
    '서울-양천구': ['목동', '신정동', '신월동', '강월동'],
    '서울-강서구': ['화곡동', '가양동', '등촌동', '마곡동', '방화동'],
    '서울-구로구': ['고척동', '오류동', '궁동', '항동'],
    '서울-금천구': ['독산동', '가산동', '시흥동', '무악동'],
    '서울-영등포구': ['영등포동', '여의동', '신길동', '당산동', '도림동'],
    '서울-동작구': ['노량진동', '흑석동', '사당동', '방배동'],
    '서울-관악구': ['봉천동', '신림동', '남현동', '청룡동'],
    '서울-서초구': ['서초동', '잠원동', '반포동', '방배동', '양재동'],
    '서울-강남구': ['역삼동', '삼성동', '대치동', '청담동', '논현동'],
    '서울-송파구': ['잠실동', '문정동', '가락동', '방이동', '거여동'],
    '서울-강동구': ['성내동', '광나루동', '구의동', '암사동'],

    '부산-중구': ['중앙동', '대청동', '창선동', '부평동'],
    '부산-서구': ['남부민동', '동대신동', '송도동', '아미동'],
    '부산-동구': ['초량동', '좌천동', '수정동', '범천동'],
    '부산-영도구': ['영도동', '청학동', '봉래동', '신선동'],
    '부산-부산진구': ['부전동', '전포동', '범천동', '가야동', '연지동'],
    '부산-동래구': ['온천장동', '명장동', '안락동', '금정동'],
    '부산-남구': ['대연동', '용호동', '감만동', '감포동'],
    '부산-북구': ['구포동', '금곡동', '덕천동', '만덕동'],
    '부산-해운대구': ['우동', '좌동', '재송동', '중동', '반송동'],
    '부산-사하구': ['하단동', '당리동', '괴정동', '신평동'],
    '부산-금정구': ['부곡동', '서동', '노포동'],
    '부산-강서구': ['생곡동', '대신동', '명지동'],
    '부산-연제구': ['연제동', '거제동', '사상동'],
    '부산-수영구': ['광안동', '민락동', '남천동', '망미동'],
    '부산-사상구': ['괴만동', '모라동', '주례동', '감삼동'],
    '부산-기장군': ['기장읍', '일광면', '정관면', '철마면'],

    '인천-중구': ['중앙동', '항동', '율목동', '신흥동'],
    '인천-동구': ['방산동', '금곡동', '송현동'],
    '인천-미추홀구': ['주안동', '도화동', '숭의동'],
    '인천-연수구': ['송도동', '연수동', '옥련동', '청학동'],
    '인천-남동구': ['구월동', '간석동', '논현동', '만수동'],
    '인천-부평구': ['부평동', '산곡동', '청천동', '갈산동'],
    '인천-계양구': ['계산동', '작전동', '방축동'],
    '인천-서구': ['가좌동', '경서동', '오류동'],
    '인천-강화군': ['강화읍', '길상면', '흙빈면'],
    '인천-옹진군': ['북도면', '남도면'],

    '경기-수원시': ['영통동', '매탄동', '정자동', '인계동', '팔달동', '권선동'],
    '경기-성남시': ['분당동', '정자동', '서현동', '판교동', '수정동'],
    '경기-고양시': ['주엽동', '백석동', '화정동', '행신동', '덕양동'],
    '경기-용인시': ['수지동', '죽전동', '구갈동', '보정동', '기흥동'],
    '경기-부천시': ['원미동', '소사동', '오정동'],
    '경기-안산시': ['단원동', '상록동'],
    '경기-안양시': ['동안동', '만안동'],
    '경기-남양주시': ['다산동', '진건동', '도농동'],
    '경기-화성시': ['향남동', '봉담동', '기배동'],
    '경기-평택시': ['비전동', '송탄동', '중앙동'],
    '경기-의정부시': ['의정부동', '가능동', '흥선동'],
    '경기-시흥시': ['정왕동', '대야동', '목천동'],
    '경기-파주시': ['문산읍', '금촌동', '운정동'],
    '경기-광명시': ['광명동', '소하동'],
    '경기-김포시': ['김포동', '고촌읍'],
    '경기-군포시': ['당정동', '산본동'],
    '경기-광주시': ['광주읍', '송정동'],
    '경기-이천시': ['마장면', '신둔면'],
    '경기-양주시': ['덕정동', '광적면'],
    '경기-오산시': ['원동', '오산동'],
    '경기-구리시': ['교문동', '수택동'],
    '경기-안성시': ['공도읍', '일죽면'],
    '경기-포천시': ['포천읍', '소흘읍'],
    '경기-의왕시': ['의왕동', '포일동'],
    '경기-하남시': ['신평동', '미사동'],
    '경기-여주시': ['여주읍', '대신면'],
    '경기-동두천시': ['동두천동', '소요동'],
    '경기-과천시': ['중앙동', '별양동'],

    '광주-동구': ['지산동', '산수동', '서석동'],
    '광주-서구': ['쌍촌동', '금호동', '풍암동'],
    '광주-남구': ['주월동', '봉선동', '진월동'],
    '광주-북구': ['일곡동', '용봉동', '운암동'],
    '광주-광산구': ['신가동', '수완동', '화정동'],

    '대전-동구': ['대동', '대별동', '신인동'],
    '대전-중구': ['중앙동', '대흥동', '소제동'],
    '대전-서구': ['둔산동', '가장동', '관평동'],
    '대전-유성구': ['봉명동', '노은동', '관평동', '구암동', '신성동'],
    '대전-대덕구': ['문지동', '계족동'],

    '울산-중구': ['성남동', '약사동', '반구동'],
    '울산-남구': ['달동', '삼산동', '신정동'],
    '울산-동구': ['발산동', '전하동'],
    '울산-북구': ['강동동', '중산동'],
    '울산-울주군': ['온산읍', '삼남면'],

    '세종-세종시': ['한솔동', '도담동', '아름동', '어진동'],

    '강원-춘천시': ['효자동', '석사동', '퇴계동', '후평동', '신동'],
    '강원-원주시': ['단계동', '무실동', '반곡관설동', '태장동'],
    '강원-강릉시': ['교동', '포남동', '옥천동', '홍제동', '성덕동'],
    '강원-동해시': ['천곡동', '황지동'],
    '강원-태백시': ['태백동', '철암동'],
    '강원-속초시': ['중앙동', '노학동'],
    '강원-삼척시': ['정라동', '교동'],
    '강원-홍천군': ['홍천읍', '내면'],
    '강원-횡성군': ['횡성읍', '우천면'],
    '강원-영월군': ['영월읍', '주천면'],
    '강원-평창군': ['평창읍', '방림면'],
    '강원-정선군': ['정선읍', '고한읍'],
    '강원-철원군': ['철원읍', '갈말읍'],
    '강원-화천군': ['화천읍', '간동면'],
    '강원-양구군': ['양구읍', '해안면'],
    '강원-인제군': ['인제읍', '기린면'],
    '강원-고성군': ['고성읍', '거진읍'],
    '강원-양양군': ['양양읍', '현남면'],

    '충북-청주시': ['가경동', '복대동', '율량사천동', '용암동', '신봉동'],
    '충북-충주시': ['가금동', '신니동', '읍내동'],
    '충북-제천시': ['중앙동', '청전동', '금성동'],
    '충북-보은군': ['보은읍', '산외면'],
    '충북-옥천군': ['옥천읍', '동이면'],
    '충북-영동군': ['영동읍', '추풍령면'],
    '충북-증평군': ['증평읍', '도안면'],
    '충북-진천군': ['진천읍', '백곡면'],
    '충북-괴산군': ['괴산읍', '불정면'],
    '충북-음성군': ['음성읍', '감곡면'],
    '충북-단양군': ['단양읍', '가곡면'],

    '충남-천안시': ['불당동', '성정동', '신부동', '백석동', '동남구'],
    '충남-공주시': ['공주시', '의당면'],
    '충남-보령시': ['대천동', '웅천읍'],
    '충남-아산시': ['온양동', '배방읍'],
    '충남-서산시': ['서산동', '음암면'],
    '충남-논산시': ['취암동', '연산면'],
    '충남-계룡시': ['계룡시'],
    '충남-당진시': ['당진동', '정미면'],
    '충남-금산군': ['금산읍', '대야면'],
    '충남-부여군': ['부여읍', '규암면'],
    '충남-서천군': ['서천읍', '마서면'],
    '충남-청양군': ['청양읍', '대치면'],
    '충남-홍성군': ['홍성읍', '결성면'],
    '충남-예산군': ['예산읍', '신암면'],
    '충남-태안군': ['태안읍', '남면'],

    '전북-전주시': ['효자동', '중화산동', '송천동', '인후동', '완산동'],
    '전북-군산시': ['중앙동', '미성동'],
    '전북-익산시': ['인골동', '부송동'],
    '전북-정읍시': ['정읍동', '신정동'],
    '전북-남원시': ['남원동'],
    '전북-김제시': ['김제동', '금구동'],
    '전북-완주군': ['완주읍', '상관면'],
    '전북-진안군': ['진안읍', '백운면'],
    '전북-무주군': ['무주읍', '설천면'],
    '전북-장수군': ['장수읍', '계북면'],
    '전북-임실군': ['임실읍', '신평면'],
    '전북-순창군': ['순창읍', '적성면'],
    '전북-고창군': ['고창읍', '부안면'],
    '전북-부안군': ['부안읍', '행안면'],

    '전남-목포시': ['목포동', '용당동', '산정동'],
    '전남-여수시': ['여수동', '돌산읍'],
    '전남-순천시': ['조례동', '해룡면', '연향동'],
    '전남-나주시': ['나주동', '다도면'],
    '전남-광양시': ['광양동', '골약동'],
    '전남-담양군': ['담양읍', '월계면'],
    '전남-곡성군': ['곡성읍', '석곡면'],
    '전남-구례군': ['구례읍', '마산면'],
    '전남-고흥군': ['고흥읍', '점암면'],
    '전남-보성군': ['보성읍', '문덕면'],
    '전남-화순군': ['화순읍', '한천면'],
    '전남-장흥군': ['장흥읍', '유치면'],
    '전남-강진군': ['강진읍', '옴천면'],
    '전남-해남군': ['해남읍', '화산면'],
    '전남-영암군': ['영암읍', '삼호읍'],
    '전남-무안군': ['무안읍', '청계면'],
    '전남-함평군': ['함평읍', '학교면'],
    '전남-영광군': ['영광읍', '백수면'],
    '전남-장성군': ['장성읍', '남면'],
    '전남-완도군': ['완도읍', '금도면'],
    '전남-진도군': ['진도읍', '조도면'],
    '전남-신안군': ['신의면', '흑산면'],

    '경북-포항시': ['죽도동', '상대동', '양학동', '장량동'],
    '경북-경주시': ['경주동', '황성동'],
    '경북-김천시': ['김천동', '봉산동'],
    '경북-안동시': ['안동동', '와룡면'],
    '경북-구미시': ['구미동', '신평동'],
    '경북-영주시': ['영주동', '순흥면'],
    '경북-영천시': ['영천동', '자양면'],
    '경북-상주시': ['상주동', '외남면'],
    '경북-문경시': ['문경동', '가은읍'],
    '경북-경산시': ['경산동', '남산면'],
    '경북-군위군': ['군위읍', '의흥면'],
    '경북-의성군': ['의성읍', '단북면'],
    '경북-청송군': ['청송읍', '파천면'],
    '경북-영양군': ['영양읍', '석보면'],
    '경북-영덕군': ['영덕읍', '창수면'],
    '경북-청도군': ['화양읍', '각남면'],
    '경북-고령군': ['고령읍', '다산면'],
    '경북-성주군': ['성주읍', '금수면'],
    '경북-칠곡군': ['왜관읍', '약목면'],
    '경북-예천군': ['예천읍', '유천면'],
    '경북-봉화군': ['봉화읍', '소천면'],
    '경북-울진군': ['울진읍', '근남면'],
    '경북-울릉군': ['울릉읍', '서면'],

    '경남-창원시': ['상남동', '용호동', '반림동', '팔용동'],
    '경남-진주시': ['진주동', '천전동'],
    '경남-통영시': ['통영동', '산양읍'],
    '경남-사천시': ['사천동', '정우면'],
    '경남-김해시': ['김해동', '대동'],
    '경남-밀양시': ['밀양동', '부북면'],
    '경남-거제시': ['거제동', '둥지면'],
    '경남-양산시': ['양산동', '물금읍'],
    '경남-의령군': ['의령읍', '대의면'],
    '경남-함안군': ['함안읍', '칠원면'],
    '경남-창녕군': ['창녕읍', '이방면'],
    '경남-고성군': ['고성읍', '동면'],
    '경남-남해군': ['남해읍', '설천면'],
    '경남-하동군': ['하동읍', '금성면'],
    '경남-산청군': ['산청읍', '신등면'],
    '경남-함양군': ['함양읍', '마천면'],
    '경남-거창군': ['거창읍', '아산면'],
    '경남-합천군': ['합천읍', '야로면'],

    '제주-제주시': ['연동', '노형동', '이도동', '아라동', '용담동'],
    '제주-서귀포시': ['동홍동', '서홍동', '대륜동', '효돈동', '송산동']
  };

  const key = `${province}-${district}`;
  if (detailed[key]) return withExtraNeighborhoods(detailed[key]);

  if (district.endsWith('구')) {
    const base = district.replace('구', '');
    return withExtraNeighborhoods([`${base}1동`, `${base}2동`, `${base}3동`]);
  }

  if (district.endsWith('군')) {
    const base = district.replace('군', '');
    return withExtraNeighborhoods([`${base}읍`, `${base}면`, `${base}리`]);
  }

  if (district.endsWith('시')) {
    const base = district.replace('시', '');
    return withExtraNeighborhoods([`${base}동`, `${base}남동`, `${base}북동`]);
  }

  return withExtraNeighborhoods(['중심동', '행정동', '생활동']);
}

export default function App() {
  const provinces = Object.keys(regionalHealthData);
  const [selectedProvince, setSelectedProvince] = useState(provinces[0]);
  const provinceData = regionalHealthData[selectedProvince] ?? {};
  const districts = Object.keys(provinceData);
  const [selectedDistrict, setSelectedDistrict] = useState(districts[0]);
  const activeDistrict = provinceData[selectedDistrict] ? selectedDistrict : districts[0];
  const neighborhoods = useMemo(
    () => getNeighborhoodOptions(selectedProvince, activeDistrict),
    [selectedProvince, activeDistrict]
  );
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(neighborhoods[0]);

  useEffect(() => {
    setSelectedDistrict(districts[0]);
  }, [selectedProvince]);

  useEffect(() => {
    if (!provinceData[selectedDistrict] && districts[0]) {
      setSelectedDistrict(districts[0]);
    }
  }, [selectedDistrict, districts, provinceData]);

  useEffect(() => {
    setSelectedNeighborhood(neighborhoods[0]);
  }, [neighborhoods]);

  const currentData = provinceData[activeDistrict];

  const riskModel = useMemo(() => calcRiskModel(currentData, provinceData, selectedProvince), [currentData, provinceData, selectedProvince]);
  const score = riskModel.score;
  const grade = useMemo(() => getRiskGrade(score), [score]);
  const topSymptom = currentData.symptoms[0]?.name ?? '기타';
  const advices = useMemo(() => getAdvice(score, topSymptom), [score, topSymptom]);

  const defaultHospitals = useMemo(() => getHospitalsByDistrict(selectedProvince, `${activeDistrict} ${selectedNeighborhood}`, score), [selectedProvince, activeDistrict, selectedNeighborhood, score]);
  const [hospitals, setHospitals] = useState(defaultHospitals);
  const alerts = useMemo(() => getRiskAlerts(score, currentData.factors), [score, currentData.factors]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    setHospitals(defaultHospitals);
  }, [defaultHospitals]);

  const [symptomInput, setSymptomInput] = useState(topSymptom);
  const [ageGroup, setAgeGroup] = useState('성인');
  const [maxDistance, setMaxDistance] = useState(5);

  useEffect(() => {
    setSymptomInput(topSymptom);
  }, [topSymptom, selectedProvince, activeDistrict, selectedNeighborhood]);

  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState('');
  const [recommendHospitalsOverride, setRecommendHospitalsOverride] = useState(null);

  const preferredDepartments = useMemo(
    () => getPreferredDepartmentsBySymptom(symptomInput),
    [symptomInput]
  );
  const autoDepartment = preferredDepartments[0] ?? '내과';
  const recommendationLimit = 5;

  const recommendedHospitals = useMemo(() => {
    const pool = recommendHospitalsOverride ?? hospitals;
    const sorted = [...pool]
      .filter((hospital) => hospital.distanceKm <= Number(maxDistance))
      .sort((a, b) => {
        const rankA = preferredDepartments.indexOf(a.department);
        const rankB = preferredDepartments.indexOf(b.department);
        const scoreA = rankA >= 0 ? rankA : a.department === '종합' ? 2 : 3;
        const scoreB = rankB >= 0 ? rankB : b.department === '종합' ? 2 : 3;
        if (scoreA !== scoreB) return scoreA - scoreB;
        if (a.expectedWaitMinutes !== b.expectedWaitMinutes) return a.expectedWaitMinutes - b.expectedWaitMinutes;
        return a.distanceKm - b.distanceKm;
      });

    const preferredSet = new Set(preferredDepartments);
    const prioritized = sorted.filter(
      (hospital) => preferredSet.has(hospital.department) || hospital.department === '종합'
    );

    if (prioritized.length >= recommendationLimit) {
      return prioritized.slice(0, recommendationLimit);
    }

    const extra = sorted.filter(
      (hospital) => !prioritized.some((selected) => selected.id === hospital.id)
    );

    return [...prioritized, ...extra].slice(0, recommendationLimit);
  }, [recommendHospitalsOverride, hospitals, maxDistance, preferredDepartments, recommendationLimit]);

  async function handleRecommendSearch() {
    setRecommendLoading(true);
    setRecommendError('');
    setRecommendHospitalsOverride(null);

    // 진료과 검색 키워드: 증상 기반 첫 번째 추천 과를 사용
    const searchDept = autoDepartment;

    try {
      let found = [];

      if (navigator.geolocation) {
        found = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords;
              try {
                const nearby = await fetchNearbyHospitalsByLocation(latitude, longitude);
                const enriched = await buildEnrichedHospitals(nearby, score);
                resolve(enriched);
              } catch {
                resolve([]);
              }
            },
            () => resolve([]),
            { timeout: 6000 }
          );
        });
      }

      if (found.length === 0) {
        const center = await geocodeRegionCenter(selectedProvince, activeDistrict, selectedNeighborhood);
        // 진료과 키워드를 쿼리에 포함해 검색
        let regional = await fetchHospitalsFromNaverLocal(selectedProvince, activeDistrict, selectedNeighborhood, center, searchDept);
        if (regional.length === 0) {
          regional = await fetchNearbyHospitalsByLocation(center.latitude, center.longitude);
        }
        found = await buildEnrichedHospitals(regional, score);
      }

      // 정적 데이터 폴백: 지역+진료과 조합으로 필터링
      if (found.length === 0) {
        const districtKey = `${selectedProvince}-${activeDistrict}`;
        const pool =
          REAL_HOSPITALS_BY_DISTRICT[districtKey] ??
          REAL_HOSPITALS_BY_PROVINCE[selectedProvince] ??
          REAL_HOSPITALS_BY_PROVINCE.서울;
        const preferredSet = new Set(preferredDepartments);
        const filtered = pool.filter(
          (h) => preferredSet.has(h.department) || h.department === '종합'
        );
        const base = Math.max(10, Math.round(score * 0.9));
        found = (filtered.length > 0 ? filtered : pool).slice(0, 6).map((item, index) => ({
          id: `recommend-static-${index}`,
          name: item.name,
          department: item.department,
          distanceKm: Number((0.8 + index * 0.7).toFixed(1)),
          currentQueue: Math.round(base * ([0.3, 0.24, 0.2, 0.16, 0.14, 0.12][index] ?? 0.1)),
          expectedWaitMinutes: Math.round(base * ([1, 0.85, 0.72, 0.63, 0.58, 0.54][index] ?? 0.5)),
          allowsRemoteQueue: index < 3,
          waitSource: '추정치'
        }));
        setRecommendError(`주변 실시간 조회가 어렵습니다. ${selectedProvince} ${activeDistrict} 기준 ${searchDept || '전체'} 병원 목록을 표시합니다.`);
      } else {
        const label = searchDept ? `${searchDept} ` : '';
        setRecommendError(`${label}병원 ${found.length}개를 찾았습니다.`);
      }

      setRecommendHospitalsOverride(found);
    } catch {
      setRecommendError('병원 조회 중 오류가 발생했습니다. 기본 목록에서 추천합니다.');
    } finally {
      setRecommendLoading(false);
    }
  }

  const [alertSettings, setAlertSettings] = useState({
    infection: true,
    climate: true,
    medical: true
  });

  function toggleAlert(type) {
    setAlertSettings((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  const [remoteHospitalId, setRemoteHospitalId] = useState(hospitals.find((item) => item.allowsRemoteQueue)?.id ?? '');
  const [visitorName, setVisitorName] = useState('');
  const [remoteTicket, setRemoteTicket] = useState(null);

  useEffect(() => {
    setRemoteHospitalId(hospitals.find((item) => item.allowsRemoteQueue)?.id ?? '');
    setRemoteTicket(null);
  }, [hospitals]);

  async function handleFindNearbyHospitals() {
    setLocationLoading(true);
    setLocationError('');

    async function applyRegionFallback(message) {
      try {
        const center = await geocodeRegionCenter(selectedProvince, activeDistrict, selectedNeighborhood);
        let regionalNearby = await fetchHospitalsFromNaverLocal(selectedProvince, activeDistrict, selectedNeighborhood, center);
        let sourceLabel = '네이버 지역 검색';

        if (regionalNearby.length === 0) {
          regionalNearby = await fetchNearbyHospitalsByLocation(center.latitude, center.longitude);
          sourceLabel = '지도 기반 폴백';
        }

        if (regionalNearby.length === 0) {
          setLocationError(`${message} 선택 지역 주변 병원을 찾지 못해 기본 목록을 표시합니다.`);
          setHospitals(defaultHospitals);
          return;
        }

        const enrichedRegional = await buildEnrichedHospitals(regionalNearby, score);
        setHospitals(enrichedRegional);
        setLocationError(`${message} 선택 지역 중심(${sourceLabel})으로 주변 병원 정보를 표시합니다.`);
      } catch (fallbackError) {
        setLocationError(`${message} 선택 지역 조회도 실패하여 기본 목록을 표시합니다.`);
        setHospitals(defaultHospitals);
      }
    }

    if (!navigator.geolocation) {
      await applyRegionFallback('위치 추적을 지원하지 않아');
      setLocationLoading(false);
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const nearbyHospitals = await fetchNearbyHospitalsByLocation(latitude, longitude);

      if (nearbyHospitals.length === 0) {
        await applyRegionFallback('내 위치 주변 병원을 찾지 못해');
        return;
      }

      const enrichedHospitals = await buildEnrichedHospitals(nearbyHospitals, score);

      setHospitals(enrichedHospitals);
      setLocationError('');
    } catch (error) {
      await applyRegionFallback('위치 권한이 없거나 조회에 실패하여');
    } finally {
      setLocationLoading(false);
    }
  }

  function handleRemoteQueueSubmit(event) {
    event.preventDefault();
    const targetHospital = hospitals.find((hospital) => hospital.id === remoteHospitalId);
    if (!targetHospital || !visitorName.trim()) return;

    const waitingOrder = targetHospital.currentQueue + 1;
    const estimatedCallMinutes = targetHospital.expectedWaitMinutes + 5;

    setRemoteTicket({
      hospitalName: targetHospital.name,
      visitorName: visitorName.trim(),
      waitingOrder,
      estimatedCallMinutes
    });
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="tag">Smart Health Map MVP</p>
        <h1>우리동네스마트건강지도</h1>
        <p>
          핵심기능 1~8(질병/증상 통계, 지역 건강위험수치, 예방조언, 병원 대기시간, 병원 추천,
          감염 위험 알림, 원격 대기 등록)을 반영한 MVP입니다.
        </p>
      </section>

      <section className="panel selector-panel">
        <div className="selector-grid">
          <div>
            <label htmlFor="province">특별시/광역시/도 선택</label>
            <select
              id="province"
              value={selectedProvince}
              onChange={(event) => setSelectedProvince(event.target.value)}
            >
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="district">시/군/구 선택</label>
            <select
              id="district"
              value={activeDistrict}
              onChange={(event) => setSelectedDistrict(event.target.value)}
            >
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="neighborhood">읍/면/동 선택</label>
            <select
              id="neighborhood"
              value={selectedNeighborhood}
              onChange={(event) => setSelectedNeighborhood(event.target.value)}
            >
              {neighborhoods.map((neighborhood) => (
                <option key={neighborhood} value={neighborhood}>
                  {neighborhood}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel risk-panel">
        <h2>지역 건강위험수치</h2>
        <p className="muted location">{selectedProvince} {activeDistrict} {selectedNeighborhood}</p>
        <div
          className="gauge"
          style={{
            background: `conic-gradient(var(--accent) ${score * 3.6}deg, #dde6f5 0deg)`
          }}
        >
          <div className="gauge-inner">
            <strong>{score}</strong>
            <span>{grade}</span>
          </div>
        </div>
        <p className="muted">정밀 가중치: 지역발생 50% + 질병부담 30% + 증상부담 20%</p>
        <p className="muted">세부점수: 지역 {riskModel.regionalComponent} · 질병 {riskModel.diseaseComponent} · 증상 {riskModel.symptomComponent}</p>
      </section>

      <section className="panel">
        <h2>건강예방 조언</h2>
        <p className="muted">현재 지역 위험수치와 주요 증상을 기반으로 제공</p>
        <ol className="advice-list">
          {advices.map((advice) => (
            <li key={advice}>{advice}</li>
          ))}
        </ol>
      </section>

      <section className="panel">
        <h2>병원 대기시간 확인</h2>
        <p className="muted">위치 권한 허용 시 사용자 주변 병원을 우선 표시하고, 웹사이트 대기정보를 자동 조회합니다.</p>
        <div className="alert-toggle-row">
          <button className={locationLoading ? 'toggle' : 'toggle active'} onClick={handleFindNearbyHospitals} disabled={locationLoading}>
            {locationLoading ? '주변 병원 조회 중...' : '내 위치 기반 병원 찾기'}
          </button>
          {locationError && <p className="muted">{locationError}</p>}
        </div>
        <div className="grid two">
          {hospitals.map((hospital) => (
            <article className="info-card" key={hospital.id}>
              <h3>{hospital.name}</h3>
              <p>{hospital.department} · {hospital.distanceKm}km</p>
              <p>현재 대기 {hospital.currentQueue}명</p>
              <p>예상 대기 {formatMinutes(hospital.expectedWaitMinutes)}</p>
              <p>대기정보 출처: {hospital.waitSource ?? '추정치'}</p>
              {hospital.website && (
                <p>
                  <a href={hospital.website} target="_blank" rel="noreferrer">병원 공식 웹사이트</a>
                </p>
              )}
              <span className={`badge ${getHospitalCongestion(hospital.expectedWaitMinutes)}`}>{getHospitalCongestion(hospital.expectedWaitMinutes)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>증상/상황 기반 병원 추천</h2>
        <p className="muted">증상, 연령, 이동거리를 기반으로 증상에 맞는 진료과 병원을 추천</p>
        <div className="recommend-form">
          <label>
            증상
            <input value={symptomInput} onChange={(e) => setSymptomInput(e.target.value)} placeholder="예: 기침" />
          </label>
          <label>
            연령대
            <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              <option value="소아">소아</option>
              <option value="성인">성인</option>
              <option value="고령">고령</option>
            </select>
          </label>
          <label>
            이동 가능 거리(km)
            <input type="number" min="1" max="20" value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} />
          </label>
          <button
            className={recommendLoading ? 'toggle' : 'toggle active'}
            onClick={handleRecommendSearch}
            disabled={recommendLoading}
            style={{ alignSelf: 'flex-end', marginBottom: '4px' }}
          >
            {recommendLoading ? '검색 중...' : `${autoDepartment} 병원 추천`}
          </button>
        </div>
        <p className="muted">
          증상 기반 추천 진료과: {preferredDepartments.join(' → ')}
          {recommendHospitalsOverride && ' · 주변 병원 실시간 검색 결과'}
        </p>
        <p className="muted">증상에 맞는 진료과/종합병원을 최대 {recommendationLimit}곳까지 추천합니다.</p>
        {recommendError && <p className="muted">{recommendError}</p>}
        <ul className="recommend-list">
          {recommendedHospitals.length > 0 ? (
            recommendedHospitals.map((hospital) => (
              <li key={`recommend-${hospital.id}`}>
                {hospital.name} · {hospital.department} · 예상 {formatMinutes(hospital.expectedWaitMinutes)}
              </li>
            ))
          ) : (
            <li>조건에 맞는 병원이 없습니다. 이동 가능 거리를 늘리거나 증상을 더 구체적으로 입력해보세요.</li>
          )}
        </ul>
      </section>

      <section className="panel">
        <h2>감염 위험 알림</h2>
        <p className="muted">위험 지표 기반 알림 및 사용자 알림 설정</p>
        <div className="alert-toggle-row">
          <button className={alertSettings.infection ? 'toggle active' : 'toggle'} onClick={() => toggleAlert('infection')}>
            감염병 알림 {alertSettings.infection ? 'ON' : 'OFF'}
          </button>
          <button className={alertSettings.climate ? 'toggle active' : 'toggle'} onClick={() => toggleAlert('climate')}>
            기후 위험 알림 {alertSettings.climate ? 'ON' : 'OFF'}
          </button>
          <button className={alertSettings.medical ? 'toggle active' : 'toggle'} onClick={() => toggleAlert('medical')}>
            병원 혼잡 알림 {alertSettings.medical ? 'ON' : 'OFF'}
          </button>
        </div>
        <ul className="alert-list">
          {alerts.map((alert) => (
            <li key={alert.type}>
              <strong>[{alert.type}] {alert.level}</strong>
              <p>{alert.message}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>원격 대기 등록</h2>
        <p className="muted">대기 가능 병원 선택 후 원격으로 대기 등록</p>
        <form className="remote-form" onSubmit={handleRemoteQueueSubmit}>
          <label>
            방문자 이름
            <input value={visitorName} onChange={(e) => setVisitorName(e.target.value)} placeholder="이름 입력" />
          </label>
          <label>
            병원 선택
            <select value={remoteHospitalId} onChange={(e) => setRemoteHospitalId(e.target.value)}>
              {hospitals.filter((hospital) => hospital.allowsRemoteQueue).map((hospital) => (
                <option key={`remote-${hospital.id}`} value={hospital.id}>
                  {hospital.name} (예상 {formatMinutes(hospital.expectedWaitMinutes)})
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="cta">원격 대기 등록하기</button>
        </form>

        {remoteTicket && (
          <div className="ticket">
            <h3>등록 완료</h3>
            <p>{remoteTicket.visitorName}님, {remoteTicket.hospitalName}</p>
            <p>대기 순번: {remoteTicket.waitingOrder}번</p>
            <p>예상 호출까지: {formatMinutes(remoteTicket.estimatedCallMinutes)}</p>
          </div>
        )}
      </section>
    </main>
  );
}
