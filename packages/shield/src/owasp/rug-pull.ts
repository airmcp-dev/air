// @airmcp-dev/shield — owasp/rug-pull.ts
//
// OWASP MCP-08: Rug Pull 감지.
// 도구 설명/파라미터/annotations/outputSchema가 초기 등록 이후 변경되면 경고.
// 공격자가 승인된 도구의 description을 런타임에 변조하여
// LLM 행동을 조작하는 것을 방지.
//
// CVE-2025-54136 (MCPoison) 대응:
// - description 변경: critical (LLM 행동 조작 가능)
// - annotations 변경: high (readOnly→destructive 전환 등)
// - params 변경: high (입력 스키마 변조)
// - outputSchema 변경: medium (출력 구조 변조)

import { createHash } from 'node:crypto';
import type { ToolIntegritySnapshot, RugPullResult, RugPullSeverity } from '../types.js';

/** Rug Pull 감지 대상 도구 정의 */
export interface ToolDefinition {
  name: string;
  description?: string;
  params?: Record<string, any>;
  annotations?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export class RugPullDetector {
  private snapshots = new Map<string, ToolIntegritySnapshot>();

  /** 도구의 초기 무결성 스냅샷을 기록한다 */
  capture(toolName: string, description: string, params: Record<string, any>, annotations?: Record<string, any>, outputSchema?: Record<string, any>): void {
    this.snapshots.set(toolName, {
      toolName,
      descriptionHash: this.hash(description),
      paramsHash: this.hash(JSON.stringify(params)),
      annotationsHash: annotations ? this.hash(JSON.stringify(annotations)) : undefined,
      outputSchemaHash: outputSchema ? this.hash(JSON.stringify(outputSchema)) : undefined,
      capturedAt: new Date(),
    });
  }

  /** 현재 도구 정의가 스냅샷과 일치하는지 검증한다 */
  verify(toolName: string, description: string, params: Record<string, any>, annotations?: Record<string, any>, outputSchema?: Record<string, any>): RugPullResult {
    const snapshot = this.snapshots.get(toolName);
    if (!snapshot) {
      return { detected: false, changes: [] };
    }

    const changes: RugPullResult['changes'] = [];

    // description 변경 — critical: LLM 행동 직접 조작 (CVE-2025-54136)
    const currentDescHash = this.hash(description);
    if (currentDescHash !== snapshot.descriptionHash) {
      changes.push({
        toolName,
        field: 'description',
        previousHash: snapshot.descriptionHash,
        currentHash: currentDescHash,
        severity: 'critical',
      });
    }

    // params 변경 — high: 입력 스키마 변조로 의도치 않은 데이터 전달 가능
    const currentParamsHash = this.hash(JSON.stringify(params));
    if (currentParamsHash !== snapshot.paramsHash) {
      changes.push({
        toolName,
        field: 'params',
        previousHash: snapshot.paramsHash,
        currentHash: currentParamsHash,
        severity: 'high',
      });
    }

    // annotations 변경 — high: readOnly→destructive 등 안전 힌트 전환
    if (annotations && snapshot.annotationsHash) {
      const currentAnnotHash = this.hash(JSON.stringify(annotations));
      if (currentAnnotHash !== snapshot.annotationsHash) {
        changes.push({
          toolName,
          field: 'annotations',
          previousHash: snapshot.annotationsHash,
          currentHash: currentAnnotHash,
          severity: 'high',
        });
      }
    }

    // outputSchema 변경 — medium: 출력 구조 변조
    if (outputSchema && snapshot.outputSchemaHash) {
      const currentOutputHash = this.hash(JSON.stringify(outputSchema));
      if (currentOutputHash !== snapshot.outputSchemaHash) {
        changes.push({
          toolName,
          field: 'outputSchema',
          previousHash: snapshot.outputSchemaHash,
          currentHash: currentOutputHash,
          severity: 'medium',
        });
      }
    }

    return { detected: changes.length > 0, changes };
  }

  /** 모든 도구의 무결성을 검증한다 */
  verifyAll(tools: ToolDefinition[]): RugPullResult {
    const allChanges: RugPullResult['changes'] = [];

    for (const tool of tools) {
      const result = this.verify(
        tool.name,
        tool.description || '',
        tool.params || {},
        tool.annotations,
        tool.outputSchema,
      );
      allChanges.push(...result.changes);
    }

    return { detected: allChanges.length > 0, changes: allChanges };
  }

  /** 변경 사항 중 최고 심각도를 반환 */
  maxSeverity(result: RugPullResult): RugPullSeverity | null {
    if (!result.detected) return null;
    const order: RugPullSeverity[] = ['low', 'medium', 'high', 'critical'];
    let max = 0;
    for (const c of result.changes) {
      const idx = order.indexOf(c.severity);
      if (idx > max) max = idx;
    }
    return order[max];
  }

  /** 스냅샷 목록 */
  getSnapshots(): ToolIntegritySnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /** 특정 도구 스냅샷 제거 (도구 제거 시) */
  remove(toolName: string): boolean {
    return this.snapshots.delete(toolName);
  }

  /** 전체 스냅샷 초기화 */
  clear(): void {
    this.snapshots.clear();
  }

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }
}
