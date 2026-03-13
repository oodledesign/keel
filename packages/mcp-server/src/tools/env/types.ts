export type EnvMode = 'development' | 'production';

export type ScanFs = {
  readFile: (filePath: string) => Promise<string>;
  readdir: (dirPath: string) => Promise<string[]>;
  stat: (path: string) => Promise<{ isDirectory(): boolean }>;
};

export type ScanOptions = {
  apps?: string[];
  rootDir?: string;
  mode: EnvMode;
  fs?: ScanFs;
};

export type EnvDefinition = {
  key: string;
  value: string;
  source: string;
};

export type EnvVariableState = {
  key: string;
  category: string;
  definitions: EnvDefinition[];
  effectiveValue: string;
  isOverridden: boolean;
  effectiveSource: string;
  isVisible: boolean;
  validation: {
    success: boolean;
    error: {
      issues: string[];
    };
  };
};

export type AppEnvState = {
  appName: string;
  filePath: string;
  mode: EnvMode;
  variables: Record<string, EnvVariableState>;
};

export type EnvFileInfo = {
  appName: string;
  filePath: string;

  variables: Array<{
    key: string;
    value: string;
    source: string;
  }>;
};
