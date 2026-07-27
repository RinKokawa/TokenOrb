import path from 'node:path';

export const resolvePackagedEnvPath = (
  resourcesPath: string,
  portableExecutableDir: string | undefined,
): string => {
  const portableDir = portableExecutableDir?.trim();
  return path.join(portableDir || resourcesPath, '.env');
};
