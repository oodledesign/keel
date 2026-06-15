export { classify, type ClassifyResult } from './classify';
export { extract } from './extract';
export { appendSignature, draft } from './draft';
export { parseClassifyResponse, parseExtractResponse, stripJsonFences } from './json';
export type {
  ClassifyResponseJson,
  EmailActionItem,
  EmailThreadCategory,
  ExtractResponseJson,
} from './types';
