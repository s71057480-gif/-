const provinceBaseData = {
  서울: {
    diseases: [
      { name: '감기', count: 1240 },
      { name: '기관지염', count: 860 },
      { name: '장염', count: 540 }
    ],
    symptoms: [
      { name: '기침', count: 930 },
      { name: '발열', count: 710 },
      { name: '인후통', count: 670 },
      { name: '복통', count: 320 }
    ],
    factors: { climate: 62, infection: 58, medicalLoad: 66, symptomSpike: 61 }
  },
  부산: {
    diseases: [
      { name: '감기', count: 980 },
      { name: '독감', count: 620 },
      { name: '비염', count: 510 }
    ],
    symptoms: [
      { name: '기침', count: 710 },
      { name: '콧물', count: 660 },
      { name: '두통', count: 420 },
      { name: '근육통', count: 290 }
    ],
    factors: { climate: 56, infection: 51, medicalLoad: 49, symptomSpike: 54 }
  },
  대구: {
    diseases: [
      { name: '감기', count: 770 },
      { name: '장염', count: 500 },
      { name: '결막염', count: 260 }
    ],
    symptoms: [
      { name: '발열', count: 520 },
      { name: '복통', count: 430 },
      { name: '설사', count: 310 },
      { name: '충혈', count: 200 }
    ],
    factors: { climate: 64, infection: 46, medicalLoad: 55, symptomSpike: 60 }
  },
  인천: {
    diseases: [
      { name: '비염', count: 790 },
      { name: '감기', count: 680 },
      { name: '기관지염', count: 470 }
    ],
    symptoms: [
      { name: '재채기', count: 620 },
      { name: '콧물', count: 590 },
      { name: '기침', count: 520 },
      { name: '눈가려움', count: 260 }
    ],
    factors: { climate: 59, infection: 45, medicalLoad: 52, symptomSpike: 57 }
  },
  광주: {
    diseases: [
      { name: '감기', count: 610 },
      { name: '장염', count: 420 },
      { name: '독감', count: 280 }
    ],
    symptoms: [
      { name: '기침', count: 450 },
      { name: '발열', count: 400 },
      { name: '복통', count: 260 },
      { name: '오한', count: 180 }
    ],
    factors: { climate: 52, infection: 48, medicalLoad: 44, symptomSpike: 50 }
  },
  대전: {
    diseases: [
      { name: '감기', count: 640 },
      { name: '기관지염', count: 390 },
      { name: '독감', count: 250 }
    ],
    symptoms: [
      { name: '기침', count: 470 },
      { name: '인후통', count: 360 },
      { name: '발열', count: 310 },
      { name: '두통', count: 210 }
    ],
    factors: { climate: 57, infection: 49, medicalLoad: 47, symptomSpike: 53 }
  },
  울산: {
    diseases: [
      { name: '비염', count: 520 },
      { name: '감기', count: 500 },
      { name: '기관지염', count: 320 }
    ],
    symptoms: [
      { name: '콧물', count: 410 },
      { name: '기침', count: 380 },
      { name: '재채기', count: 290 },
      { name: '가래', count: 180 }
    ],
    factors: { climate: 55, infection: 44, medicalLoad: 42, symptomSpike: 49 }
  },
  세종: {
    diseases: [
      { name: '감기', count: 280 },
      { name: '장염', count: 170 },
      { name: '비염', count: 150 }
    ],
    symptoms: [
      { name: '기침', count: 210 },
      { name: '발열', count: 160 },
      { name: '복통', count: 120 },
      { name: '콧물', count: 90 }
    ],
    factors: { climate: 51, infection: 43, medicalLoad: 38, symptomSpike: 46 }
  },
  경기: {
    diseases: [
      { name: '감기', count: 1680 },
      { name: '비염', count: 1220 },
      { name: '기관지염', count: 980 }
    ],
    symptoms: [
      { name: '기침', count: 1290 },
      { name: '콧물', count: 990 },
      { name: '인후통', count: 860 },
      { name: '두통', count: 520 }
    ],
    factors: { climate: 61, infection: 57, medicalLoad: 63, symptomSpike: 60 }
  },
  강원: {
    diseases: [
      { name: '감기', count: 590 },
      { name: '독감', count: 330 },
      { name: '장염', count: 260 }
    ],
    symptoms: [
      { name: '발열', count: 420 },
      { name: '기침', count: 360 },
      { name: '근육통', count: 220 },
      { name: '오한', count: 170 }
    ],
    factors: { climate: 67, infection: 50, medicalLoad: 46, symptomSpike: 58 }
  },
  충북: {
    diseases: [
      { name: '감기', count: 510 },
      { name: '장염', count: 310 },
      { name: '기관지염', count: 250 }
    ],
    symptoms: [
      { name: '기침', count: 370 },
      { name: '복통', count: 280 },
      { name: '발열', count: 240 },
      { name: '인후통', count: 190 }
    ],
    factors: { climate: 58, infection: 47, medicalLoad: 43, symptomSpike: 52 }
  },
  충남: {
    diseases: [
      { name: '감기', count: 560 },
      { name: '비염', count: 340 },
      { name: '장염', count: 280 }
    ],
    symptoms: [
      { name: '기침', count: 390 },
      { name: '콧물', count: 300 },
      { name: '복통', count: 220 },
      { name: '두통', count: 160 }
    ],
    factors: { climate: 56, infection: 46, medicalLoad: 44, symptomSpike: 51 }
  },
  전북: {
    diseases: [
      { name: '감기', count: 520 },
      { name: '독감', count: 300 },
      { name: '장염', count: 270 }
    ],
    symptoms: [
      { name: '발열', count: 360 },
      { name: '기침', count: 340 },
      { name: '복통', count: 230 },
      { name: '오한', count: 160 }
    ],
    factors: { climate: 54, infection: 48, medicalLoad: 42, symptomSpike: 50 }
  },
  전남: {
    diseases: [
      { name: '감기', count: 500 },
      { name: '비염', count: 320 },
      { name: '장염', count: 240 }
    ],
    symptoms: [
      { name: '기침', count: 350 },
      { name: '콧물', count: 290 },
      { name: '복통', count: 190 },
      { name: '인후통', count: 150 }
    ],
    factors: { climate: 53, infection: 44, medicalLoad: 41, symptomSpike: 48 }
  },
  경북: {
    diseases: [
      { name: '감기', count: 690 },
      { name: '기관지염', count: 430 },
      { name: '장염', count: 300 }
    ],
    symptoms: [
      { name: '기침', count: 500 },
      { name: '발열', count: 360 },
      { name: '인후통', count: 280 },
      { name: '복통', count: 210 }
    ],
    factors: { climate: 60, infection: 49, medicalLoad: 47, symptomSpike: 54 }
  },
  경남: {
    diseases: [
      { name: '감기', count: 760 },
      { name: '비염', count: 520 },
      { name: '독감', count: 360 }
    ],
    symptoms: [
      { name: '기침', count: 560 },
      { name: '콧물', count: 420 },
      { name: '발열', count: 310 },
      { name: '근육통', count: 220 }
    ],
    factors: { climate: 57, infection: 50, medicalLoad: 48, symptomSpike: 55 }
  },
  제주: {
    diseases: [
      { name: '비염', count: 410 },
      { name: '감기', count: 370 },
      { name: '장염', count: 200 }
    ],
    symptoms: [
      { name: '콧물', count: 300 },
      { name: '기침', count: 260 },
      { name: '복통', count: 150 },
      { name: '재채기', count: 140 }
    ],
    factors: { climate: 58, infection: 42, medicalLoad: 37, symptomSpike: 45 }
  }
};

const districtsByProvince = {
  서울: [
    '종로구',
    '중구',
    '용산구',
    '성동구',
    '광진구',
    '동대문구',
    '중랑구',
    '성북구',
    '강북구',
    '도봉구',
    '노원구',
    '은평구',
    '서대문구',
    '마포구',
    '양천구',
    '강서구',
    '구로구',
    '금천구',
    '영등포구',
    '동작구',
    '관악구',
    '서초구',
    '강남구',
    '송파구',
    '강동구'
  ],
  부산: [
    '중구',
    '서구',
    '동구',
    '영도구',
    '부산진구',
    '동래구',
    '남구',
    '북구',
    '해운대구',
    '사하구',
    '금정구',
    '강서구',
    '연제구',
    '수영구',
    '사상구',
    '기장군'
  ],
  대구: ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군', '군위군'],
  인천: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  광주: ['동구', '서구', '남구', '북구', '광산구'],
  대전: ['동구', '중구', '서구', '유성구', '대덕구'],
  울산: ['중구', '남구', '동구', '북구', '울주군'],
  세종: ['세종시'],
  경기: [
    '수원시',
    '성남시',
    '고양시',
    '용인시',
    '부천시',
    '안산시',
    '안양시',
    '남양주시',
    '화성시',
    '평택시',
    '의정부시',
    '시흥시',
    '파주시',
    '광명시',
    '김포시',
    '군포시',
    '광주시',
    '이천시',
    '양주시',
    '오산시',
    '구리시',
    '안성시',
    '포천시',
    '의왕시',
    '하남시',
    '여주시',
    '동두천시',
    '과천시',
    '가평군',
    '양평군',
    '연천군'
  ],
  강원: [
    '춘천시',
    '원주시',
    '강릉시',
    '동해시',
    '태백시',
    '속초시',
    '삼척시',
    '홍천군',
    '횡성군',
    '영월군',
    '평창군',
    '정선군',
    '철원군',
    '화천군',
    '양구군',
    '인제군',
    '고성군',
    '양양군'
  ],
  충북: ['청주시', '충주시', '제천시', '보은군', '옥천군', '영동군', '증평군', '진천군', '괴산군', '음성군', '단양군'],
  충남: ['천안시', '공주시', '보령시', '아산시', '서산시', '논산시', '계룡시', '당진시', '금산군', '부여군', '서천군', '청양군', '홍성군', '예산군', '태안군'],
  전북: ['전주시', '군산시', '익산시', '정읍시', '남원시', '김제시', '완주군', '진안군', '무주군', '장수군', '임실군', '순창군', '고창군', '부안군'],
  전남: ['목포시', '여수시', '순천시', '나주시', '광양시', '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군', '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군'],
  경북: ['포항시', '경주시', '김천시', '안동시', '구미시', '영주시', '영천시', '상주시', '문경시', '경산시', '군위군', '의성군', '청송군', '영양군', '영덕군', '청도군', '고령군', '성주군', '칠곡군', '예천군', '봉화군', '울진군', '울릉군'],
  경남: ['창원시', '진주시', '통영시', '사천시', '김해시', '밀양시', '거제시', '양산시', '의령군', '함안군', '창녕군', '고성군', '남해군', '하동군', '산청군', '함양군', '거창군', '합천군'],
  제주: ['제주시', '서귀포시']
};

function clampFactor(value) {
  if (value > 90) return 90;
  if (value < 20) return 20;
  return value;
}

function createDistrictData(base, index) {
  const variant = (index % 7) - 3;
  const multiplier = 1 + variant * 0.04;
  const factorShift = variant * 2;

  return {
    diseases: base.diseases.map((item) => ({
      name: item.name,
      count: Math.max(50, Math.round(item.count * multiplier))
    })),
    symptoms: base.symptoms.map((item) => ({
      name: item.name,
      count: Math.max(30, Math.round(item.count * multiplier))
    })),
    factors: {
      climate: clampFactor(base.factors.climate + factorShift),
      infection: clampFactor(base.factors.infection + factorShift),
      medicalLoad: clampFactor(base.factors.medicalLoad + factorShift),
      symptomSpike: clampFactor(base.factors.symptomSpike + factorShift)
    }
  };
}

export const regionalHealthData = Object.fromEntries(
  Object.entries(districtsByProvince).map(([province, districts]) => {
    const provinceData = Object.fromEntries(
      districts.map((district, index) => [district, createDistrictData(provinceBaseData[province], index)])
    );

    return [province, provinceData];
  })
);

export const riskWeights = {
  infection: 0.35,
  climate: 0.25,
  medicalLoad: 0.2,
  symptomSpike: 0.2
};
