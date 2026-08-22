export type { GenerateTextFn } from './anthropic';
export { DEFAULT_ANTHROPIC_MODEL } from './anthropic';
export { classify, type ClassifyResult } from './classify';
export { detectPipelineLead } from './detect-lead';
export { extract } from './extract';
export { appendSignature, draft } from './draft';
export {
  parseClassifyResponse,
  parseDetectPipelineLeadResponse,
  parseExtractResponse,
  stripJsonFences,
} from './json';
export type {
  ClassifyResponseJson,
  EmailActionItem,
  EmailThreadCategory,
  ExtractAccountMember,
  ExtractContext,
  ExtractResponseJson,
  PipelineLeadDetection,
} from './types';
