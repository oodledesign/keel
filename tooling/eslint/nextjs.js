import nextCoreVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const nextEslintConfig = [...nextCoreVitals, ...nextTypescript];

const rules = {
  '@next/next/no-html-link-for-pages': 'off',
};

export { nextEslintConfig, rules };
