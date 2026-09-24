// @airmcp-dev/shield — PII 모듈 테스트

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PIIDetector,
  PIITokenizer,
  PIIDictionary,
  PIIRedactor,
} from '../src/pii/index.js';

// ═══════════════════════════════════════════════════
// PIIDictionary
// ═══════════════════════════════════════════════════

describe('PIIDictionary', () => {
  let dict: PIIDictionary;

  beforeEach(() => {
    dict = new PIIDictionary({
      entries: [
        { value: '삼성전자', type: 'COMPANY', aliases: ['삼성', 'Samsung'] },
        { value: '김철수', type: 'PERSON' },
      ],
    });
  });

  it('사전 항목으로 텍스트에서 PII를 탐지한다', () => {
    const entities = dict.detect('삼성전자 평택공장에서 김철수 담당자가');
    expect(entities).toHaveLength(2);
    expect(entities[0].value).toBe('삼성전자');
    expect(entities[0].type).toBe('COMPANY');
    expect(entities[1].value).toBe('김철수');
    expect(entities[1].type).toBe('PERSON');
  });

  it('별칭도 탐지한다', () => {
    const entities = dict.detect('Samsung 공장과 삼성 연구소');
    expect(entities.some((e) => e.value === 'Samsung')).toBe(true);
    expect(entities.some((e) => e.value === '삼성')).toBe(true);
  });

  it('항목 추가/제거가 동작한다', () => {
    dict.add({ value: 'SK하이닉스', type: 'COMPANY' });
    expect(dict.size).toBe(3);

    dict.remove('김철수');
    expect(dict.size).toBe(2);
    expect(dict.detect('김철수')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════
// PIIDetector
// ═══════════════════════════════════════════════════

describe('PIIDetector', () => {
  it('IP 주소를 탐지한다', () => {
    const detector = new PIIDetector();
    const entities = detector.detect('서버 주소: 192.168.1.100');
    const ips = entities.filter((e) => e.type === 'IP');
    expect(ips).toHaveLength(1);
    expect(ips[0].value).toBe('192.168.1.100');
  });

  it('전화번호를 탐지한다', () => {
    const detector = new PIIDetector();
    const entities = detector.detect('연락처: 010-1234-5678');
    const phones = entities.filter((e) => e.type === 'PHONE');
    expect(phones).toHaveLength(1);
    expect(phones[0].value).toBe('010-1234-5678');
  });

  it('DB 접속 문자열을 탐지한다', () => {
    const detector = new PIIDetector();
    const entities = detector.detect('연결: postgresql://admin:pass@db.internal:5432/mydb');
    const conns = entities.filter((e) => e.type === 'DB_CONN');
    expect(conns).toHaveLength(1);
  });

  it('API 키 패턴을 탐지한다', () => {
    const detector = new PIIDetector();
    const entities = detector.detect('api_key=sk-ant-abcdefghijklmnopqrstuvwxyz');
    const keys = entities.filter((e) => e.type === 'API_KEY');
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });

  it('사전 + 정규식 혼합 탐지가 동작한다', () => {
    const detector = new PIIDetector({
      dictionary: {
        entries: [
          { value: '아쿠아웍스', type: 'COMPANY' },
        ],
      },
    });
    const entities = detector.detect('아쿠아웍스 서버 10.0.0.5에서 장애');
    expect(entities.some((e) => e.type === 'COMPANY')).toBe(true);
    expect(entities.some((e) => e.type === 'IP')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// PIITokenizer
// ═══════════════════════════════════════════════════

describe('PIITokenizer', () => {
  it('PII를 토큰으로 치환하고 복원한다', () => {
    const detector = new PIIDetector({
      dictionary: {
        entries: [{ value: '삼성전자', type: 'COMPANY' }],
      },
    });
    const tokenizer = new PIITokenizer(detector);

    const { text, mappings } = tokenizer.tokenize(
      '삼성전자 서버 192.168.1.50에서 장애 발생',
    );

    // 원본이 포함되어 있지 않아야 함
    expect(text).not.toContain('삼성전자');
    expect(text).not.toContain('192.168.1.50');

    // 토큰이 포함되어 있어야 함
    expect(text).toContain('{{COMPANY_1}}');
    expect(text).toContain('{{IP_1}}');

    // 복원
    const restored = tokenizer.detokenize(text, mappings);
    expect(restored.text).toContain('삼성전자');
    expect(restored.text).toContain('192.168.1.50');
    expect(restored.unresolvedTokens).toHaveLength(0);
  });

  it('같은 값은 같은 토큰으로 치환된다', () => {
    const detector = new PIIDetector({
      dictionary: {
        entries: [{ value: 'ACME', type: 'COMPANY' }],
      },
    });
    const tokenizer = new PIITokenizer(detector);

    const { text } = tokenizer.tokenize('ACME 본사와 ACME 공장');
    const matches = text.match(/\{\{COMPANY_1\}\}/g);
    expect(matches).toHaveLength(2);
  });

  it('API_KEY는 기본적으로 비가역 마스킹된다', () => {
    const detector = new PIIDetector();
    const tokenizer = new PIITokenizer(detector);

    const { text, mappings } = tokenizer.tokenize(
      'api_key=sk-ant-abcdefghijklmnopqrstuvwxyz123',
    );

    // 토큰이 아닌 마스킹 값이 들어감
    expect(text).not.toContain('sk-ant-');
    expect(text).toContain('REDACTED');

    // 매핑에 API_KEY가 없어야 함 (비가역)
    expect(mappings.some((m) => m.type === 'API_KEY')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// PIIRedactor (통합)
// ═══════════════════════════════════════════════════

describe('PIIRedactor', () => {
  let redactor: PIIRedactor;

  beforeEach(() => {
    redactor = new PIIRedactor({
      mode: 'strict',
      detector: {
        dictionary: {
          entries: [
            { value: '삼성전자', type: 'COMPANY', aliases: ['Samsung'] },
            { value: '김준욱', type: 'PERSON' },
          ],
        },
      },
    });
  });

  it('strict 모드: 모든 PII를 처리한다', () => {
    const result = redactor.redact(
      '삼성전자 김준욱 담당자 010-9999-8888 서버 172.16.0.1',
    );

    expect(result.text).not.toContain('삼성전자');
    expect(result.text).not.toContain('김준욱');
    expect(result.text).not.toContain('010-9999-8888');
    expect(result.text).not.toContain('172.16.0.1');
    expect(result.mode).toBe('strict');
  });

  it('report 모드: 인프라만 마스킹하고 고객사·사람은 통과', () => {
    redactor.setMode('report');

    const result = redactor.redact(
      '삼성전자 김준욱 담당자 서버 172.16.0.1',
    );

    // 고객사·사람 이름은 그대로
    expect(result.text).toContain('삼성전자');
    expect(result.text).toContain('김준욱');
    // IP는 토큰화
    expect(result.text).not.toContain('172.16.0.1');
  });

  it('off 모드: 탐지만 하고 원본 반환', () => {
    redactor.setMode('off');

    const result = redactor.redact('서버 192.168.0.1에서 장애');
    expect(result.text).toContain('192.168.0.1');
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.mappings).toHaveLength(0);
  });

  it('redact → restore 라운드트립이 동작한다', () => {
    const original = '삼성전자 평택공장 서버 10.0.0.5에서 장애 발생';
    const { text, mappings } = redactor.redact(original);
    const { text: restored } = redactor.restore(text, mappings);

    expect(restored).toContain('삼성전자');
    expect(restored).toContain('10.0.0.5');
  });

  it('사전 동적 추가/제거가 동작한다', () => {
    redactor.addDictionaryEntry({ value: 'SK하이닉스', type: 'COMPANY' });

    const result = redactor.redact('SK하이닉스 이천공장');
    expect(result.text).not.toContain('SK하이닉스');

    redactor.removeDictionaryEntry('SK하이닉스');
    const result2 = redactor.redact('SK하이닉스 이천공장');
    expect(result2.text).toContain('SK하이닉스');
  });
});

// ═══════════════════════════════════════════════════
// 확장 패턴 테스트
// ═══════════════════════════════════════════════════

describe('PIIDetector — 확장 패턴', () => {
  const detector = new PIIDetector();

  it('CIDR 네트워크 대역을 탐지한다', () => {
    const entities = detector.detect('방화벽에 10.0.0.0/8 대역을 허용');
    const cidrs = entities.filter((e) => e.type === 'CIDR');
    expect(cidrs).toHaveLength(1);
    expect(cidrs[0].value).toBe('10.0.0.0/8');
  });

  it('MAC 주소를 탐지한다 (colon 형식)', () => {
    const entities = detector.detect('장비 MAC: AA:BB:CC:DD:EE:FF');
    const macs = entities.filter((e) => e.type === 'MAC');
    expect(macs).toHaveLength(1);
  });

  it('MAC 주소를 탐지한다 (dash 형식)', () => {
    const entities = detector.detect('장비 MAC: AA-BB-CC-DD-EE-FF');
    const macs = entities.filter((e) => e.type === 'MAC');
    expect(macs).toHaveLength(1);
  });

  it('내부 도메인을 탐지한다', () => {
    const entities = detector.detect('db-master.internal에 접속');
    const domains = entities.filter((e) => e.type === 'INTERNAL_DOMAIN');
    expect(domains).toHaveLength(1);
    expect(domains[0].value).toBe('db-master.internal');
  });

  it('다양한 내부 도메인 확장자를 탐지한다', () => {
    const texts = [
      'app.local', 'jenkins.corp', 'wiki.intranet', 'nas.lan',
    ];
    for (const text of texts) {
      const entities = detector.detect(`서버: ${text}`);
      expect(
        entities.some((e) => e.type === 'INTERNAL_DOMAIN'),
        `${text} 탐지 실패`,
      ).toBe(true);
    }
  });

  it('한국 대표번호(1588 등)를 탐지한다', () => {
    const entities = detector.detect('고객센터: 1588-1234');
    const phones = entities.filter((e) => e.type === 'PHONE');
    expect(phones).toHaveLength(1);
  });

  it('GitHub 토큰을 탐지한다', () => {
    const entities = detector.detect('token: ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ12345');
    const keys = entities.filter((e) => e.type === 'API_KEY');
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });

  it('Slack 토큰을 탐지한다', () => {
    const entities = detector.detect('SLACK_TOKEN=xoxb-1234567890-abcdefghij');
    const keys = entities.filter((e) => e.type === 'API_KEY');
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });

  it('PEM 개인키를 탐지한다', () => {
    const pemText = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGcY5unA67hqxnfZ
-----END RSA PRIVATE KEY-----`;
    const entities = detector.detect(pemText);
    const keys = entities.filter((e) => e.type === 'PRIVATE_KEY');
    expect(keys).toHaveLength(1);
  });

  it('환경변수 export 시크릿을 탐지한다', () => {
    const entities = detector.detect('export DB_PASSWORD=super_secret_pass123');
    const envs = entities.filter((e) => e.type === 'ENV_SECRET');
    expect(envs).toHaveLength(1);
  });

  it('Git credential URL을 탐지한다', () => {
    const entities = detector.detect(
      'git clone https://user:ghp_tokenvalue1234567890@github.com/org/repo.git',
    );
    const creds = entities.filter((e) => e.type === 'GIT_CREDENTIAL');
    expect(creds).toHaveLength(1);
  });

  it('Docker login 패스워드를 탐지한다', () => {
    const entities = detector.detect('docker login -u admin -p MyS3cretP@ss registry.internal');
    const secrets = entities.filter((e) => e.type === 'SECRET');
    expect(secrets.length).toBeGreaterThanOrEqual(1);
  });

  it('kubectl create secret을 탐지한다', () => {
    const entities = detector.detect(
      'kubectl create secret generic db-creds --from-literal=password=abc123',
    );
    const secrets = entities.filter((e) => e.type === 'SECRET');
    expect(secrets.length).toBeGreaterThanOrEqual(1);
  });
});

