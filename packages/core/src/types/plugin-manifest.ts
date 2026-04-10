// @airmcp-dev/core — types/plugin-manifest.ts
//
// 서드파티 플러그인 등록/검색/설치를 위한 표준 manifest 규격.
// npm 패키지에 air-plugin.json 파일로 포함한다.
// 플러그인 레지스트리(plugins.airmcp.dev)에서 검색/설치에 사용.

/** 플러그인 manifest — air-plugin.json */
export interface AirPluginManifest {
  /** 플러그인 이름 (npm 패키지명과 별도) */
  name: string;
  /** 버전 (semver) */
  version: string;
  /** 설명 */
  description: string;
  /** 저자 */
  author: string;
  /** 라이선스 */
  license: string;
  /** air 프레임워크 호환 정보 */
  air: {
    /** 최소 air 버전 */
    minVersion: string;
    /** 카테고리 */
    category: PluginCategory;
    /** 태그 (검색용) */
    tags: string[];
    /** 설정 JSON schema (optional) */
    configSchema?: Record<string, any>;
    /** 엔트리포인트 (기본: index.js) */
    entry?: string;
    /** 팩토리 함수 이름 (기본: default export) */
    factory?: string;
  };
  /** npm 패키지명 (자동 매핑) */
  package?: string;
  /** 홈페이지 */
  homepage?: string;
  /** 리포지토리 */
  repository?: string;
}

export type PluginCategory =
  | 'security'
  | 'performance'
  | 'monitoring'
  | 'data'
  | 'network'
  | 'dev'
  | 'storage'
  | 'auth'
  | 'logging'
  | 'other';

/** 플러그인 레지스트리 검색 결과 */
export interface PluginRegistryEntry {
  manifest: AirPluginManifest;
  /** npm 다운로드 수 */
  downloads: number;
  /** 평균 평점 */
  rating: number;
  /** 검증 상태 */
  verified: boolean;
  /** 등록일 */
  publishedAt: string;
  /** 최종 업데이트일 */
  updatedAt: string;
}

/** 플러그인 레지스트리 API 설정 */
export interface PluginRegistryConfig {
  /** 레지스트리 URL */
  url: string;
  /** API 키 (publish 시 필요) */
  apiKey?: string;
}

/** 기본 레지스트리 URL */
export const DEFAULT_REGISTRY_URL = 'https://plugins.airmcp.dev/api/v1';
